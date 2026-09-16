-- ============================================================
-- Registro de Acciones — Paso 3: qué forma tiene que tener
-- ============================================================
-- El paso 2 contestó QUIÉN puede escribir. Éste contesta QUÉ puede
-- escribir: largos, formatos, cuántos elementos entran en cada lista.
--
-- Es el equivalente de las funciones isValidX() de firestore.rules, con
-- una diferencia que conviene tener presente: allá la validación y el
-- permiso viven mezclados en la misma línea `allow`; acá van separados a
-- propósito. Si mañana hay que aflojar un largo, se toca este archivo y
-- los permisos no se mueven — que es lo que uno quiere cuando el que se
-- toca es el archivo delicado.
--
-- Se puede correr más de una vez sin romper nada.
--
-- UN CAMBIO REAL RESPECTO DE FIRESTORE, y es el motivo de toda la
-- migración: las imágenes y los adjuntos ya NO se guardan adentro de la
-- fila en base64. Se guarda la RUTA dentro del bucket. Por eso acá se
-- rechaza explícitamente cualquier cosa que empiece con "data:" — si algo
-- intentara guardar un archivo embebido, se estaría volviendo al problema
-- que vinimos a resolver, y es mejor que rebote a que pase inadvertido.
-- ============================================================


-- ============================================================
-- 1. Ayudantes
-- ============================================================
-- Tienen que ser `immutable`: Postgres solo acepta en una restricción
-- funciones que den siempre el mismo resultado para la misma entrada.

-- Una lista de textos: cuántos entran y qué largo tiene cada uno.
create or replace function public.textos_ok(v text[], tope int, largo int) returns boolean
  language sql immutable as $$
  select v is null or (
    coalesce(array_length(v, 1), 0) <= tope
    and not exists (select 1 from unnest(v) t where t is null or length(t) > largo)
  )
$$;

-- Rutas dentro del bucket (imágenes y adjuntos). Tres cosas: que no sea un
-- archivo embebido disfrazado de ruta, que no se escape de su carpeta, y
-- que no sea absurdamente larga.
create or replace function public.rutas_ok(v text[], tope int) returns boolean
  language sql immutable as $$
  select v is null or (
    coalesce(array_length(v, 1), 0) <= tope
    and not exists (
      select 1 from unnest(v) t
      where t is null or length(t) = 0 or length(t) > 400
         or t like 'data:%'            -- un archivo embebido, no una ruta
         or t like '/%'                -- ruta absoluta
         or position('..' in t) > 0    -- salir de la carpeta
    )
  )
$$;

-- Una lista jsonb: cuántos elementos entran.
create or replace function public.lista_ok(v jsonb, tope int) returns boolean
  language sql immutable as $$
  select v is null or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= tope)
$$;

-- Enlaces: {label, url}.
create or replace function public.links_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 10) and (v is null or not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or length(coalesce(e ->> 'label', '')) > 200
       or length(coalesce(e ->> 'url', '')) > 2000))
$$;

-- Participantes etiquetados: {email, name}.
create or replace function public.participantes_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 10) and (v is null or not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or length(coalesce(e ->> 'email', '')) > 200
       or length(coalesce(e ->> 'name', '')) > 120))
$$;

-- Adjuntos: {name, path}. El archivo vive en el bucket; acá va su ruta.
create or replace function public.archivos_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 2) and (v is null or not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or length(coalesce(e ->> 'name', '')) > 200
       or coalesce(e ->> 'path', '') = ''
       or length(e ->> 'path') > 400
       or (e ->> 'path') like 'data:%'
       or position('..' in (e ->> 'path')) > 0))
$$;

-- Fechas corridas a otro día: { "2026-09-07": "2026-09-09" }. Las dos
-- puntas tienen que ser fechas de verdad — es la identidad de una
-- repetición y de ahí cuelgan los comentarios de ese día.
create or replace function public.mudanzas_ok(v jsonb) returns boolean
  language sql immutable as $$
  select v is null or (
    jsonb_typeof(v) = 'object'
    and (select count(*) from jsonb_object_keys(v)) <= 60
    and not exists (
      select 1 from jsonb_each_text(v) as par(k, val)
      where k !~ '^\d{4}-\d{2}-\d{2}$' or val !~ '^\d{4}-\d{2}-\d{2}$')
  )
$$;

-- Fechas sueltas suspendidas: solo fechas.
create or replace function public.fechas_ok(v text[], tope int) returns boolean
  language sql immutable as $$
  select v is null or (
    coalesce(array_length(v, 1), 0) <= tope
    and not exists (select 1 from unnest(v) t where t is null or t !~ '^\d{4}-\d{2}-\d{2}$')
  )
$$;


-- ============================================================
-- 2. POSTEOS
-- ============================================================
alter table public.posts
  drop constraint if exists posts_textos,
  drop constraint if exists posts_tipo,
  drop constraint if exists posts_listas,
  drop constraint if exists posts_proyecto,
  drop constraint if exists posts_repeticion,
  drop constraint if exists posts_fechas;

alter table public.posts
  add constraint posts_textos check (
    length(title) between 1 and 140
    and length(content) between 1 and 5000
    and length(author_name) between 1 and 120
    and length(coalesce(author_email, '')) <= 200
    and length(coalesce(organizer, '')) <= 140
    and length(coalesce(location, '')) <= 200
    and length(coalesce(project_notes, '')) <= 2000
    and length(coalesce(project_done_by, '')) <= 200
    and length(coalesce(calendar_event_id, '')) <= 200
    and length(coalesce(last_edited_by, '')) <= 120
  ),
  -- Los tipos NO son una lista fija: el admin agrega y renombra desde
  -- Configuración. Se valida la forma del identificador, no cuál es.
  add constraint posts_tipo check (activity_type ~ '^[a-z0-9]{1,40}$'),
  add constraint posts_listas check (
    public.lista_ok(scopes, 15)
    and public.links_ok(links)
    and public.participantes_ok(participants)
    and public.rutas_ok(images, 6)
    and public.archivos_ok(files)
    and public.textos_ok(mentions, 10, 200)
    and public.textos_ok(editors, 20, 200)
    and public.textos_ok(liked_by, 1000, 200)
  ),
  add constraint posts_proyecto check (
    public.lista_ok(milestones, 40)
    and (project_status is null or project_status in ('open', 'done'))
  ),
  add constraint posts_repeticion check (
    public.textos_ok(recurrence, 10, 500)
    and public.fechas_ok(recurrence_skip, 200)
    and public.mudanzas_ok(recurrence_moves)
  ),
  -- Que el final no sea anterior al principio. Firestore no lo controlaba
  -- (el lenguaje de reglas no compara fechas cómodamente) y quedaba
  -- únicamente en manos del navegador.
  add constraint posts_fechas check (end_date >= start_date);


-- ============================================================
-- 3. COMENTARIOS
-- ============================================================
alter table public.replies
  drop constraint if exists replies_textos,
  drop constraint if exists replies_listas;

alter table public.replies
  add constraint replies_textos check (
    length(content) between 1 and 3000
    and length(author_name) between 1 and 120
    and length(coalesce(author_email, '')) <= 200
    and length(coalesce(icon, '')) <= 8
    and length(coalesce(reply_to_id, '')) <= 200
  ),
  add constraint replies_listas check (
    public.lista_ok(scopes, 15)
    and public.links_ok(links)
    and public.rutas_ok(images, 6)
    and public.archivos_ok(files)
    and public.textos_ok(mentions, 10, 200)
    and public.textos_ok(liked_by, 1000, 200)
  );


-- ============================================================
-- 4. EL EQUIPO Y LOS EX INTEGRANTES
-- ============================================================
-- El @nickname autogenerado en el alta puede traer tildes o ñ (sale del
-- nombre real de Google), así que acá solo se controla el largo. La forma
-- estricta — solo minúsculas ASCII — se exige únicamente cuando alguien lo
-- cambia a mano, que es lo mismo que hace firestore.rules.
alter table public.members
  drop constraint if exists members_textos;
alter table public.members
  add constraint members_textos check (
    length(name) between 1 and 120
    and length(coalesce(nickname, '')) <= 40
    and length(coalesce(photo_url, '')) <= 500
    and length(coalesce(approved_by, '')) <= 200
  );

alter table public.former_members
  drop constraint if exists former_textos;
alter table public.former_members
  add constraint former_textos check (
    length(name) between 1 and 120
    and length(coalesce(nickname, '')) <= 40
    and length(coalesce(photo_url, '')) <= 500
  );


-- ============================================================
-- 5. SOLICITUDES Y AUDITORÍA
-- ============================================================
alter table public.access_requests
  drop constraint if exists solicitudes_textos;
alter table public.access_requests
  add constraint solicitudes_textos check (
    length(name) between 1 and 120
    and length(coalesce(photo_url, '')) <= 500
  );

alter table public.audit_log
  drop constraint if exists audit_tipo,
  drop constraint if exists audit_textos;
alter table public.audit_log
  add constraint audit_tipo check (type in (
    'login', 'access_requested', 'access_approved', 'access_rejected',
    'access_revoked', 'role_changed', 'calendar_shared', 'calendar_unshared')),
  add constraint audit_textos check (
    length(actor_email) between 1 and 200
    and length(actor_name) between 1 and 120
    and length(coalesce(target_email, '')) <= 200
    and length(coalesce(detail, '')) <= 300
    -- Resumen corto de navegador/sistema, sacado del propio navegador.
    and length(coalesce(device, '')) <= 60
    -- 45 alcanza para IPv4 y para la forma más larga de IPv6.
    and length(coalesce(ip, '')) <= 45
  );


-- ============================================================
-- 6. EL @NICKNAME QUE SE CAMBIA A MANO
-- ============================================================
-- Solo minúsculas ASCII, números y guion bajo, de 2 a 20. Es la forma con
-- la que se etiqueta a alguien con @, y las menciones se muestran siempre
-- en minúscula. No aplica al que genera el alta automáticamente, que puede
-- tener tildes: por eso es un disparador y no una restricción de la tabla.
create or replace function public.members_controlar_nickname() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() then return new; end if;
  if new.nickname is distinct from old.nickname
     and new.nickname is not null
     and new.nickname !~ '^[a-z0-9_]{2,20}$' then
    raise exception 'El @nickname va en minúsculas, sin espacios ni acentos, de 2 a 20 caracteres'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists members_controlar_nickname on public.members;
create trigger members_controlar_nickname before update on public.members
  for each row execute function public.members_controlar_nickname();


-- ============================================================
-- 7. LA HORA LA PONE EL SERVIDOR
-- ============================================================
-- En firestore.rules esto era `d.createdAt == request.time`: nadie puede
-- inventarse cuándo pasó algo. Acá se pisa el valor directamente, que es
-- más simple y da lo mismo desde afuera.
--
-- No corre para la importación: esas filas traen la fecha REAL de
-- Firebase, y pisarla convertiría diez años de historia en "hoy".
create or replace function public.hora_del_servidor() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() then return new; end if;
  return jsonb_populate_record(new, jsonb_build_object(tg_argv[0], now()));
end $$;

drop trigger if exists posts_hora on public.posts;
create trigger posts_hora before insert on public.posts
  for each row execute function public.hora_del_servidor('created_at');

drop trigger if exists replies_hora on public.replies;
create trigger replies_hora before insert on public.replies
  for each row execute function public.hora_del_servidor('created_at');

drop trigger if exists audit_hora on public.audit_log;
create trigger audit_hora before insert on public.audit_log
  for each row execute function public.hora_del_servidor('created_at');

drop trigger if exists solicitudes_hora on public.access_requests;
create trigger solicitudes_hora before insert on public.access_requests
  for each row execute function public.hora_del_servidor('requested_at');

drop trigger if exists former_hora on public.former_members;
create trigger former_hora before insert on public.former_members
  for each row execute function public.hora_del_servidor('revoked_at');
