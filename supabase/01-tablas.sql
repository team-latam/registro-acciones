-- ============================================================
-- Registro de Acciones — Paso 1: las tablas
-- ============================================================
-- Se puede correr más de una vez sin romper nada (todo es "if not
-- exists"). No toca datos: solo crea la estructura vacía.
--
-- Dos decisiones de diseño, para que se entiendan al leer:
--
-- 1) Los IDS SE CONSERVAN TAL CUAL vienen de Firestore (texto de 20
--    caracteres), en vez de generar unos nuevos. Es lo que permite
--    volver atrás: si hay que regresar a Firebase, cada fila vuelve a
--    su documento original. Además, adentro de los datos hay
--    referencias por id (replyToId, calendarEventId) que se romperían
--    si los cambiáramos.
--
-- 2) LO QUE ES ESCALAR VA EN COLUMNAS DE VERDAD (fecha, tipo, autor,
--    estado): ahí es donde SQL sirve, y es lo que hoy no se puede
--    consultar. LO QUE ES UNA LISTA ANIDADA VA EN jsonb (hitos,
--    alcances, participantes, links): la app ya los trata como un
--    bloque entero, y normalizarlos sería reescribirla, no migrarla.
--    Se pueden normalizar más adelante, de a uno, sin rehacer esto.
--
-- Todas las tablas quedan con RLS PRENDIDO Y SIN POLÍTICAS: o sea,
-- nadie puede leer ni escribir nada todavía. Es a propósito — las
-- políticas van en el paso 2. Así, si algo sale mal acá, no queda una
-- base abierta.
-- ============================================================


-- ---------- POSTEOS ----------
create table if not exists public.posts (
  id                text primary key,
  title             text not null,
  content           text not null,
  -- `date` es igual a start_date; existe en Firestore y la app la usa
  -- para ordenar. Se conserva para no cambiar el comportamiento ahora.
  date              date not null,
  start_date        date not null,
  end_date          date not null,
  start_time        time,
  end_time          time,
  activity_type     text not null,
  author_name       text not null,
  author_email      text,
  organizer         text,
  location          text,
  cancelled         boolean not null default false,
  -- Proyecto
  is_project        boolean not null default false,
  project_notes     text,
  project_status    text,
  project_done_by   text,
  project_done_at   timestamptz,
  milestones        jsonb not null default '[]'::jsonb,
  editors           text[] not null default '{}',
  -- Repetición (ver expandRecurrence en index.html)
  recurrence        text[],
  recurrence_skip   text[] not null default '{}',
  recurrence_moves  jsonb not null default '{}'::jsonb,
  -- Contenido
  scopes            jsonb not null default '[]'::jsonb,
  participants      jsonb not null default '[]'::jsonb,
  links             jsonb not null default '[]'::jsonb,
  mentions          text[] not null default '{}',
  -- OJO: en Firestore esto guarda el archivo entero en base64. Acá
  -- guarda la RUTA dentro del bucket. Es la diferencia que hace que
  -- entremos en los 500 MB del plan gratis.
  images            text[] not null default '{}',
  files             jsonb not null default '[]'::jsonb,
  liked_by          text[] not null default '{}',
  calendar_event_id text,
  created_at        timestamptz not null default now(),
  last_edited_at    timestamptz,
  last_edited_by    text
);

create index if not exists posts_date_idx           on public.posts (date desc);
create index if not exists posts_start_date_idx     on public.posts (start_date);
create index if not exists posts_activity_type_idx  on public.posts (activity_type);
create index if not exists posts_author_email_idx   on public.posts (author_email);
create index if not exists posts_calendar_event_idx on public.posts (calendar_event_id);
-- GIN sobre los alcances: es lo que va a permitir preguntar "cuántos
-- eventos hubo en tal país" sin traerse todo al navegador.
create index if not exists posts_scopes_idx         on public.posts using gin (scopes);


-- ---------- COMENTARIOS ----------
-- En Firestore son una subcolección de cada posteo. Acá son una tabla
-- con la referencia al posteo: es lo mismo, pero se puede consultar.
create table if not exists public.replies (
  id           text primary key,
  post_id      text not null references public.posts(id) on delete cascade,
  content      text not null,
  author_name  text not null,
  author_email text,
  scopes       jsonb not null default '[]'::jsonb,
  links        jsonb not null default '[]'::jsonb,
  images       text[] not null default '{}',
  files        jsonb not null default '[]'::jsonb,
  mentions     text[] not null default '{}',
  liked_by     text[] not null default '{}',
  -- Respuesta a otra respuesta (un solo nivel, ver submitNestedReply).
  reply_to_id  text,
  -- Mensaje de sistema (✏️ editó, 📅 Calendar), no escrito por una persona.
  system       boolean not null default false,
  icon         text,
  -- A qué fecha de una serie que se repite pertenece (ver occurrenceOf).
  occ          date,
  created_at   timestamptz not null default now()
);

create index if not exists replies_post_id_idx    on public.replies (post_id, created_at);
create index if not exists replies_occ_idx        on public.replies (post_id, occ);
create index if not exists replies_author_idx     on public.replies (author_email);


-- ---------- QUIÉN TIENE ACCESO ----------
-- El equivalente de `allowlist`. La clave sigue siendo el EMAIL, no un
-- id nuevo: toda la app está construida sobre el email (autoría,
-- @menciones, responsables de hitos), y cambiarlo sería otra migración
-- adentro de esta.
create table if not exists public.members (
  email                     text primary key,
  name                      text not null,
  nickname                  text,
  photo_url                 text,
  role                      text not null default 'member'
                            check (role in ('admin','member','observer')),
  approved_at               timestamptz,
  approved_by               text,
  calendar_shared           boolean not null default false,
  calendar_invite_sent_at   timestamptz,
  tour_seen_at              timestamptz
);

-- El @nickname tiene que ser único: es con lo que se etiqueta a la
-- gente. Hoy eso lo controla el navegador antes de escribir, porque las
-- reglas de Firestore no saben mirar el resto de la colección. Acá lo
-- puede garantizar la base, que es donde corresponde.
create unique index if not exists members_nickname_idx
  on public.members (lower(nickname)) where nickname is not null;


-- ---------- EX INTEGRANTES ----------
-- Se guarda al revocar el acceso, ANTES de borrar de members, porque el
-- @nickname vive únicamente ahí: sin esta copia, los posteos viejos de
-- esa persona quedan con el nombre crudo de Google.
create table if not exists public.former_members (
  email       text primary key,
  name        text not null,
  nickname    text,
  photo_url   text,
  approved_at timestamptz,
  revoked_at  timestamptz not null default now()
);


-- ---------- SOLICITUDES DE ACCESO ----------
create table if not exists public.access_requests (
  email        text primary key,
  name         text not null,
  photo_url    text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now()
);

create index if not exists access_requests_status_idx on public.access_requests (status, requested_at desc);


-- ---------- PREFERENCIAS DE CADA PERSONA ----------
-- Tabla aparte y no columnas de `members`, por el mismo motivo que en
-- Firestore: `members` lo lee TODO el equipo (para las @menciones), y
-- la configuración de cada uno no tiene por qué estar a la vista de los
-- demás. Van como jsonb porque son ~25 opciones que cambian seguido:
-- una columna por opción obligaría a migrar la tabla cada vez que
-- agregamos una.
create table if not exists public.user_prefs (
  email text primary key,
  prefs jsonb not null default '{}'::jsonb
);


-- ---------- CONFIGURACIÓN DEL EQUIPO ----------
-- Los tres documentos de `meta` de Firestore: territoryConfig (zonas y
-- países), preferences (tipos, lugares, calendar, adjuntos) y
-- calendarSync (el token de sincronización).
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);


-- ---------- AUDITORÍA ----------
create table if not exists public.audit_log (
  id           text primary key,
  type         text not null,
  actor_email  text not null,
  actor_name   text not null,
  target_email text,
  detail       text,
  device       text,
  ip           text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_idx   on public.audit_log (actor_email);


-- ============================================================
-- RLS: prendido en todo, sin políticas todavía
-- ============================================================
-- Con RLS prendido y ninguna política, Postgres RECHAZA TODO desde el
-- navegador. Es el estado seguro para terminar este paso: la base
-- existe pero no está abierta. Los permisos van en 02-politicas.sql.
alter table public.posts           enable row level security;
alter table public.replies         enable row level security;
alter table public.members         enable row level security;
alter table public.former_members  enable row level security;
alter table public.access_requests enable row level security;
alter table public.user_prefs      enable row level security;
alter table public.app_config      enable row level security;
alter table public.audit_log       enable row level security;


-- ============================================================
-- El bucket para los adjuntos
-- ============================================================
-- Privado (public = false): se llega a los archivos con una URL firmada
-- que caduca, no con un enlace abierto a todo internet. Los posteos son
-- internos del equipo.
insert into storage.buckets (id, name, public)
values ('adjuntos', 'adjuntos', false)
on conflict (id) do nothing;


-- ============================================================
-- Listo. Para comprobar que quedó bien:
-- ============================================================
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
-- Tienen que aparecer las 8:
-- access_requests, app_config, audit_log, former_members, members,
-- posts, replies, user_prefs
