-- ============================================================
-- Registro de Acciones — Paso 3: qué forma tiene que tener
-- ============================================================
-- El paso 2 contestó QUIÉN puede escribir. Éste contesta QUÉ puede
-- escribir: largos, formatos, cuántos elementos entran en cada lista.
--
-- La validación y el permiso van separados a propósito (en las reglas de
-- Firestore, cuando la base era Firebase, vivían mezclados en la misma
-- línea `allow`). Si mañana hay que aflojar un largo, se toca este archivo y
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
-- El tope era 2, heredado de Firestore: ahí el archivo iba ADENTRO del
-- documento en base64 y no entraba más. Acá el documento guarda la ruta,
-- así que el posteo pesa lo mismo con dos archivos que con diez.
create or replace function public.archivos_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 10) and (v is null or not exists (
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
  drop constraint if exists posts_fechas,
  drop constraint if exists posts_resumen;

alter table public.posts
  add constraint posts_textos check (
    length(title) between 1 and 140
    -- Puede estar vacío: un evento de Google Calendar sin descripción no
    -- tiene nada que decir, y el título y la fecha ya lo describen (ver
    -- 09-contenido-vacio.sql). Estaba en 1 acá y en 0 en el 09, y como
    -- los archivos se vuelven a aplicar en orden en cada push, este
    -- intentaba recrear la restricción vieja sobre filas que ya no la
    -- cumplían: el esquema dejaba de poder aplicarse.
    and length(content) between 0 and 5000
    and length(author_name) between 1 and 120
    and length(coalesce(author_email, '')) <= 200
    and length(coalesce(organizer, '')) <= 140
    and length(coalesce(location, '')) <= 200
    and length(coalesce(project_notes, '')) <= 2000
    and length(coalesce(project_done_by, '')) <= 200
    and length(coalesce(calendar_event_id, '')) <= 200
    and length(coalesce(last_edited_by, '')) <= 120
    and length(coalesce(last_edited_by_email, '')) <= 254
  ),
  -- Los tipos NO son una lista fija: el admin agrega y renombra desde
  -- Configuración. Se valida la forma del identificador, no cuál es.
  add constraint posts_tipo check (activity_type ~ '^[a-z0-9]{1,40}$'),
  add constraint posts_listas check (
    public.lista_ok(scopes, 15)
    and public.links_ok(links)
    and public.participantes_ok(participants)
    and public.rutas_ok(images, 20)
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
  add constraint posts_fechas check (end_date >= start_date),
  -- El resumen leído del Formulario de Cierre: un objeto, con un tope de
  -- tamaño (el resumen ejecutivo, hasta 12 objetivos y 30 pasos entran
  -- holgados en 64 KB).
  add constraint posts_resumen check (
    resumen is null or (jsonb_typeof(resumen) = 'object' and pg_column_size(resumen) <= 65536)
  );


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
    and public.rutas_ok(images, 20)
    and public.archivos_ok(files)
    and public.textos_ok(mentions, 10, 200)
    and public.textos_ok(liked_by, 1000, 200)
  );


-- ------------------------------------------------------------
-- El id de un posteo o de un comentario: solo letras, números y _ . : @ -
-- ------------------------------------------------------------
-- El id lo elige quien escribe (la app arma 20 caracteres al azar, lo
-- traído de Calendar es «cal_» + el id del evento) y nada lo revisaba. La
-- app lo pone en el HTML de cada tarjeta, así que un id con comillas o con
-- < > metía código en la pantalla de todos (docs/AUDITORIA.md, U3). La app
-- ahora lo escapa igual; esto lo cierra del lado de la base, para
-- cualquiera que escriba directo por la API.
--
-- Se agrega NOT VALID y después se intenta validar: si la base de verdad
-- tuviera de antes alguna fila con otra forma, la restricción queda igual
-- para todo lo nuevo (y para editar esa fila habría que corregirle el id),
-- en vez de frenar la aplicación entera del esquema.
alter table public.posts   drop constraint if exists posts_id_forma;
alter table public.replies drop constraint if exists replies_id_forma;
alter table public.posts
  add constraint posts_id_forma check (id ~ '^[A-Za-z0-9_.:@-]{1,200}$') not valid;
alter table public.replies
  add constraint replies_id_forma check (
    id ~ '^[A-Za-z0-9_.:@-]{1,200}$'
    and (reply_to_id is null or reply_to_id ~ '^[A-Za-z0-9_.:@-]{1,200}$')
  ) not valid;
do $$
begin
  begin
    alter table public.posts validate constraint posts_id_forma;
  exception when check_violation then
    raise notice 'Hay posteos con un id de otra forma: posts_id_forma vale solo para lo nuevo.';
  end;
  begin
    alter table public.replies validate constraint replies_id_forma;
  exception when check_violation then
    raise notice 'Hay comentarios con un id de otra forma: replies_id_forma vale solo para lo nuevo.';
  end;
end
$$;


-- ============================================================
-- 4. EL EQUIPO Y LOS EX INTEGRANTES
-- ============================================================
-- El @nickname autogenerado en el alta puede traer tildes o ñ (sale del
-- nombre real de Google), así que acá solo se controla el largo. La forma
-- estricta — solo minúsculas ASCII — se exige únicamente cuando alguien lo
-- cambia a mano.
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

-- La foto de quien pide entrar: solo la de su cuenta de Google. La
-- escribe alguien que todavía no es del equipo, y una dirección de otro
-- sitio le contaba a ese sitio la IP y el momento en que un admin abría
-- Personas (docs/AUDITORIA.md, M11). NOT VALID + validar, como el id.
alter table public.access_requests drop constraint if exists solicitudes_foto;
alter table public.access_requests
  add constraint solicitudes_foto check (
    coalesce(photo_url, '') = '' or photo_url ~ '^https://([a-z0-9-]+\.)*googleusercontent\.com/'
  ) not valid;
do $$
begin
  alter table public.access_requests validate constraint solicitudes_foto;
exception when check_violation then
  raise notice 'Hay solicitudes con una foto de otro lado: solicitudes_foto vale solo para lo nuevo.';
end
$$;

alter table public.audit_log
  drop constraint if exists audit_tipo,
  drop constraint if exists audit_textos;
alter table public.audit_log
  add constraint audit_tipo check (type in (
    'login', 'access_requested', 'access_approved', 'access_rejected',
    'access_revoked', 'role_changed', 'calendar_shared', 'calendar_unshared',
    -- Lo que cada integrante hace con los posteos (quién cargó, editó,
    -- canceló o borró qué): lo escribe la base, ver registrar_posteo.
    'post_created', 'post_edited', 'post_cancelled', 'post_deleted',
    -- Unificar dos cuentas: lo anota la base (15-unificar-cuentas.sql).
    'accounts_merged')),
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
-- Nadie puede inventarse cuándo pasó algo. Se pisa el valor
-- directamente, que es más simple que rechazarlo y da lo mismo desde
-- afuera.
--
-- Sin una persona detrás (la llave de servicio del sincronizador nocturno,
-- el editor SQL) se respeta la fecha que venga, salvo la MARCA: el
-- 1/1/1970 quiere decir «poné vos la hora». Antes se respetaba también la
-- marca, y todo lo que creaba el sincronizador nacía en 1970: el
-- comentario de sistema aparecía primero en el hilo y el posteo nunca
-- contaba como nuevo.
create or replace function public.hora_del_servidor() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare valor text := to_jsonb(new) ->> tg_argv[0];
begin
  if public.sin_sesion_de_persona()
     and (valor is null or valor::timestamptz <> 'epoch'::timestamptz) then
    return new;
  end if;
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

-- Y al editar un pedido, la fecha tampoco la pone quien pide: hasta el
-- 10/10/2026 solo el insert pasaba por hora_del_servidor, y en un PATCH
-- (o en el upsert con que la app vuelve a pedir) entraba la que viniera.
-- Con eso un rechazado volvía a la cola sin esperar la hora
-- (solicitudes_reintento mira old.requested_at) y cada vuelta era otro
-- correo al admin (docs/AUDITORIA.md, R20). Ahora la que estaba queda;
-- la única que se renueva es la de volver a pedir (de rechazado a
-- pendiente): es un pedido nuevo, y así sube arriba en la cola del admin.
-- Sin una persona detrás (restaurar una copia) se respeta lo que venga.
create or replace function public.solicitudes_hora_al_editar() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() then return new; end if;
  if old.status is distinct from 'pending' and new.status = 'pending' then
    new.requested_at := now();
  else
    new.requested_at := old.requested_at;
  end if;
  return new;
end $$;
drop trigger if exists solicitudes_hora_al_editar on public.access_requests;
create trigger solicitudes_hora_al_editar before update on public.access_requests
  for each row execute function public.solicitudes_hora_al_editar();

-- Volver a pedir acceso después de un rechazo: una vez por hora como
-- mucho. Sin tope, alguien rechazado podía reaparecer en la cola del admin
-- cada minuto (docs/AUDITORIA.md, B6). El admin, sin tope.
create or replace function public.solicitudes_reintento() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() or public.es_admin_fijo() or public.es_admin_rol() then return new; end if;
  if old.status = 'rejected' and new.status = 'pending'
     and old.requested_at > now() - interval '1 hour' then
    raise exception 'Esperá un rato para volver a pedir acceso' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists solicitudes_reintento on public.access_requests;
create trigger solicitudes_reintento before update on public.access_requests
  for each row execute function public.solicitudes_reintento();

drop trigger if exists former_hora on public.former_members;
create trigger former_hora before insert on public.former_members
  for each row execute function public.hora_del_servidor('revoked_at');


-- ============================================================
-- 8. CUÁNTO PUEDE PESAR UNA FILA
-- ============================================================
-- Los largos de arriba cuidan cada campo de texto, pero un jsonb no tiene
-- largo: una integrante común podía guardar 5 MB en sus preferencias, 4 MB
-- de hitos en un posteo (que después baja todo el equipo en cada carga) o
-- 5 MB en el estado de la sincronización con Calendar, que el navegador de
-- cada integrante lee cada 30 segundos. Se probó en el laboratorio: todo
-- entraba.
--
-- Se mide la fila entera como JSON, que es como viaja. Los topes están muy
-- por encima de cualquier uso real (un posteo con todo completo no llega a
-- 60 KB) y muy por debajo de lo que haría daño. Como todos los controles de
-- este esquema, se aplica a lo que escribe una persona: el sincronizador
-- nocturno y las migraciones son de confianza.
create or replace function public.limitar_peso() returns trigger
  language plpgsql set search_path = '' as $$
declare
  tope int := tg_argv[0]::int;
  peso int := octet_length(to_jsonb(new)::text);
begin
  if public.sin_sesion_de_persona() then return new; end if;
  if peso > tope then
    raise exception 'Es demasiado grande para guardarse: % KB, y el máximo es % KB',
      ceil(peso / 1024.0), tope / 1024
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists posts_peso on public.posts;
create trigger posts_peso before insert or update on public.posts
  for each row execute function public.limitar_peso('262144');
drop trigger if exists replies_peso on public.replies;
create trigger replies_peso before insert or update on public.replies
  for each row execute function public.limitar_peso('131072');
drop trigger if exists prefs_peso on public.user_prefs;
create trigger prefs_peso before insert or update on public.user_prefs
  for each row execute function public.limitar_peso('32768');
drop trigger if exists config_peso on public.app_config;
create trigger config_peso before insert or update on public.app_config
  for each row execute function public.limitar_peso('262144');


-- ============================================================
-- 9. LA FORMA DE LA CONFIGURACIÓN DEL EQUIPO
-- ============================================================
-- Tres bloques de `app_config` con forma conocida. Lo que importa más es
-- el estado de la sincronización: es el único que puede escribir CUALQUIER
-- integrante (la app lo va dejando al vuelo), y lo lee el navegador de
-- todos cada 30 segundos.
--
-- Tipos y zonas los escribe solo un admin, pero terminan en cada tarjeta
-- y en el mapa de todo el equipo. Es lo que en Firestore no se podía
-- validar entero por el tope de expresiones de las reglas; acá sí.
--
-- Cada bloque se valida cuando CAMBIA. Las Preferencias se guardan por
-- partes adentro del mismo valor: si se revalidara todo en cada guardado,
-- un dato viejo de una sección trabaría el guardado de las demás.

-- Un tipo de actividad, con la forma exacta que escribe la app desde su
-- primera versión (key, label, icon, calendarSync, después docs, y
-- después archived: un tipo que ya no se ofrece al cargar pero sigue
-- nombrando a sus posteos viejos). La clave, con la misma forma que
-- exige un posteo (slugifyKey → [a-z0-9]).
create or replace function public.tipo_ok(t jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(t) = 'object'
     and not exists (select 1 from jsonb_object_keys(t) k
                      where k not in ('key', 'label', 'icon', 'calendarSync', 'docs', 'archived'))
     and coalesce(t ->> 'key', '') ~ '^[a-z0-9]{1,40}$'
     and jsonb_typeof(t -> 'label') = 'string' and length(t ->> 'label') <= 60
     and coalesce(jsonb_typeof(t -> 'icon'), 'null') in ('string', 'null')
     and length(coalesce(t ->> 'icon', '')) <= 16
     and coalesce(jsonb_typeof(t -> 'calendarSync'), 'null') in ('boolean', 'null')
     and coalesce(jsonb_typeof(t -> 'archived'), 'null') in ('boolean', 'null')
     and (coalesce(jsonb_typeof(t -> 'docs'), 'null') = 'null' or (
          jsonb_typeof(t -> 'docs') = 'array' and jsonb_array_length(t -> 'docs') <= 10
          and not exists (select 1 from jsonb_array_elements(t -> 'docs') d
                           where jsonb_typeof(d) <> 'object'
                              or length(coalesce(d ->> 'id', '')) not between 1 and 80
                              or length(coalesce(d ->> 'label', '')) not between 1 and 100)))
$$;

create or replace function public.tipos_ok(v jsonb) returns boolean
  language sql immutable as $$
  select coalesce(jsonb_typeof(v), 'null') = 'null' or (
    jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 30
    and not exists (select 1 from jsonb_array_elements(v) t where not public.tipo_ok(t)))
$$;

-- Ciudades sumadas a mano: { país: [ciudad, …] }.
create or replace function public.ciudades_ok(v jsonb) returns boolean
  language sql immutable as $$
  select coalesce(jsonb_typeof(v), 'null') = 'null' or (
    jsonb_typeof(v) = 'object'
    and (select count(*) from jsonb_object_keys(v)) <= 60
    and not exists (
      select 1 from jsonb_each(v) as par(pais, lista)
       where length(pais) > 120 or jsonb_typeof(lista) <> 'array' or jsonb_array_length(lista) > 300
          or exists (select 1 from jsonb_array_elements(lista) c
                      where jsonb_typeof(c) <> 'string' or length(c #>> '{}') > 120)))
$$;

-- Zonas y países: hasta 20 zonas con nombre y color (el color va adentro
-- de un style=, así que solo hex), y cada país en una zona QUE EXISTE.
create or replace function public.territorio_ok(v jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(v) = 'object'
     and not exists (select 1 from jsonb_object_keys(v) k where k not in ('zones', 'countryZones'))
     and jsonb_typeof(v -> 'zones') = 'object'
     and (select count(*) from jsonb_object_keys(v -> 'zones')) between 1 and 20
     and not exists (
       select 1 from jsonb_each(v -> 'zones') as z(clave, zona)
        where length(clave) > 60 or jsonb_typeof(zona) <> 'object'
           or exists (select 1 from jsonb_object_keys(zona) k where k not in ('label', 'color'))
           or jsonb_typeof(zona -> 'label') <> 'string' or length(zona ->> 'label') > 60
           or coalesce(zona ->> 'color', '') !~ '^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$')
     and coalesce(jsonb_typeof(v -> 'countryZones'), 'object') = 'object'
     and (select count(*) from jsonb_object_keys(coalesce(v -> 'countryZones', '{}'))) <= 60
     and not exists (
       select 1 from jsonb_each_text(coalesce(v -> 'countryZones', '{}')) as p(pais, zona)
        where length(pais) > 120 or not (v -> 'zones') ? zona)
$$;

-- El estado de la sincronización con Calendar: el token y cuándo corrió.
create or replace function public.sincronizacion_ok(v jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(v) = 'object'
     and not exists (select 1 from jsonb_object_keys(v) k where k not in ('syncToken', 'lastSyncedAt'))
     and coalesce(jsonb_typeof(v -> 'syncToken'), 'null') in ('string', 'null')
     and length(coalesce(v ->> 'syncToken', '')) <= 2000
     and coalesce(jsonb_typeof(v -> 'lastSyncedAt'), 'null') in ('string', 'null')
     and length(coalesce(v ->> 'lastSyncedAt', '')) <= 40
$$;

create or replace function public.config_controlar() returns trigger
  language plpgsql set search_path = '' as $$
declare
  antes jsonb := case when tg_op = 'UPDATE' then old.value else '{}'::jsonb end;
  cambio boolean;
begin
  if public.sin_sesion_de_persona() then return new; end if;
  if new.key = 'calendarSync' and not public.sincronizacion_ok(new.value) then
    raise exception 'El estado de la sincronización con Calendar no tiene la forma esperada'
      using errcode = 'check_violation';
  end if;
  if new.key = 'territoryConfig' and not public.territorio_ok(new.value) then
    raise exception 'Las zonas no tienen la forma esperada (hasta 20, con nombre y color, y cada país en una zona que exista)'
      using errcode = 'check_violation';
  end if;
  if new.key = 'preferences' then
    cambio := (new.value -> 'activityTypes') is distinct from (antes -> 'activityTypes');
    if cambio and not public.tipos_ok(new.value -> 'activityTypes') then
      raise exception 'Los tipos de actividad no tienen la forma esperada (hasta 30, con clave, nombre e ícono)'
        using errcode = 'check_violation';
    end if;
    cambio := (new.value -> 'extraCities') is distinct from (antes -> 'extraCities');
    if cambio and not public.ciudades_ok(new.value -> 'extraCities') then
      raise exception 'Las ciudades sumadas no tienen la forma esperada'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists config_controlar on public.app_config;
create trigger config_controlar before insert or update on public.app_config
  for each row execute function public.config_controlar();


-- ============================================================
-- 10. UNA ENTRADA DE LOGIN POR PERSONA Y POR DÍA
-- ============================================================
-- Cualquier cuenta de Google, aunque no esté aprobada, puede anotar su
-- propio login o su pedido de acceso (si no, no se podría registrar la
-- entrada de alguien que todavía no tiene acceso). La app manda una por
-- día con un id fijo — correo_tipo_fecha, con la fecha del navegador de
-- quien entra — y el segundo intento del día choca con ese id. Pero
-- escribiendo directo se podía inventar un id nuevo por pedido y engordar
-- la tabla sin límite.
--
-- Acá se exige ese mismo id, con una fecha de ayer, hoy o mañana (la del
-- navegador puede ser cualquiera de las tres según el huso horario). Para
-- la app no cambia nada; para quien escriba directo, son tres filas como
-- mucho.
create or replace function public.auditoria_una_por_dia() returns trigger
  language plpgsql set search_path = '' as $$
declare
  prefijo text;
  fecha text;
  hoy date := (now() at time zone 'utc')::date;
begin
  if public.sin_sesion_de_persona() then return new; end if;
  if new.type not in ('login', 'access_requested') then return new; end if;
  prefijo := regexp_replace(new.actor_email, '[^A-Za-z0-9_.@-]', '_', 'g') || '_' || new.type || '_';
  fecha := substr(new.id, length(prefijo) + 1);
  if left(new.id, length(prefijo)) <> prefijo
     or fecha !~ '^\d{4}-\d{2}-\d{2}$'
     or fecha::date not between hoy - 1 and hoy + 1 then
    raise exception 'Un login se anota una vez por día, con el id que arma la app'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists audit_una_por_dia on public.audit_log;
create trigger audit_una_por_dia before insert on public.audit_log
  for each row execute function public.auditoria_una_por_dia();
