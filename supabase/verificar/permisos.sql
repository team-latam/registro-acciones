-- ============================================================
-- Verificar los permisos de toda la base de verdad
-- ============================================================
-- SOLO LECTURA: crea unas tablas temporales (que se van con la sesión),
-- después pone la transacción en solo lectura y termina en rollback. No
-- imprime correos ni identificadores: solo nombres de tablas y funciones, y
-- cantidades.
--
-- Son las comprobaciones de la auditoría (R27) que el laboratorio hace contra
-- una base de mentira, pero acá contra la de verdad, donde Supabase pone sus
-- propios permisos de entrada y alguien pudo tocar algo desde el panel:
--   1. Todas las tablas de `public` tienen las políticas por fila (RLS) prendidas.
--   2. Quien no inició sesión (anon) no tiene permiso sobre ninguna tabla.
--   3. Las tablas internas (avisos, resúmenes) no las toca ninguna sesión de persona.
--   4. En vivo (Realtime) solo van las doce tablas de siempre.
--   5. Las funciones que se pueden llamar desde el navegador son exactamente las
--      de la lista (supabase/pruebas/funciones-esperadas.sql), ni una más.
--   6. Las funciones con permisos de dueño llevan el camino de búsqueda fijo.
--   7. El bucket «adjuntos» es privado, con tope de tamaño y de tipos.
--   8. Lo que ve de las tablas delicadas cada rol (admin, integrante, observador).
-- Sale en rojo si algo no coincide.
--
-- Uso:  psql "$SUPABASE_DB_URL" -X -q -f supabase/verificar/permisos.sql
-- ============================================================
\set ON_ERROR_STOP on
begin;
\ir ../pruebas/funciones-esperadas.sql

create temp table reales as
  select p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as firma,
         has_function_privilege('anon', p.oid, 'execute') as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as authenticated
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
create temp table res (n serial, nombre text, esperado text, obtenido text);

-- Desde acá, nada se escribe (las tablas temporales ya están hechas).
set local transaction_read_only = on;

-- 1. RLS prendido en todas las tablas
insert into res(nombre, esperado, obtenido)
  select 'todas las tablas de public tienen las políticas por fila (RLS) prendidas', 'ninguna sin RLS',
         coalesce((select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'ninguna sin RLS');
insert into res(nombre, esperado, obtenido)
  select 'hay tablas en public (si no, lo de arriba no miraba nada)', 'true',
         (select count(*) >= 15 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r')::text;

-- 2. anon, sin permiso sobre ninguna tabla
insert into res(nombre, esperado, obtenido)
  select 'quien no inició sesión (anon) no tiene permiso sobre ninguna tabla de public', 'ninguna',
         coalesce((select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p') and has_table_privilege('anon', c.oid, 'select,insert,update,delete')), 'ninguna');

-- 3. las tablas internas, fuera del alcance de las sesiones de persona
insert into res(nombre, esperado, obtenido)
  select 'las tablas de avisos y resúmenes no las toca ninguna sesión de persona (authenticated)', 'ninguna',
         coalesce((select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname in ('avisos_enviados', 'avisos_listos', 'resumenes_enviados')
                      and has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')), 'ninguna');
insert into res(nombre, esperado, obtenido)
  select 'y esas tres existen (si no, lo de arriba no miraba nada)', '3',
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname in ('avisos_enviados', 'avisos_listos', 'resumenes_enviados'))::text;

-- 4. Realtime: las doce de siempre y ninguna de las internas
insert into res(nombre, esperado, obtenido)
  select 'en vivo (Realtime) van solo las doce tablas de siempre',
         'access_requests,agenda_listas,app_config,audit_log,contactos,former_members,instituciones,members,personas,posts,replies,user_prefs',
         coalesce((select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'), '(ninguna)');

-- 5. Las funciones que el navegador puede llamar
insert into res(nombre, esperado, obtenido)
  select 'ninguna función ejecutable desde el navegador fuera de la lista (o con más permiso del esperado)', 'ninguna',
         coalesce((select string_agg(r.firma || case when e.firma is null then ' (NUEVA)'
                                                      else ' (permiso de más: anon=' || r.anon || ' authenticated=' || r.authenticated || ')' end, ', ' order by r.firma)
                     from reales r left join esperadas e using (firma)
                    where e.firma is null or (r.anon and not e.anon) or (r.authenticated and not e.authenticated)), 'ninguna');
insert into res(nombre, esperado, obtenido)
  select 'y la lista no nombra ninguna que ya no exista o ya no se pueda llamar', 'ninguna',
         coalesce((select string_agg(e.firma, ', ' order by e.firma) from esperadas e left join reales r using (firma)
                    where r.firma is null or (e.anon and not r.anon) or (e.authenticated and not r.authenticated)), 'ninguna');
insert into res(nombre, esperado, obtenido)
  select 'las funciones de los trabajos automáticos no las ejecuta anon ni authenticated', 'ninguna',
         coalesce((select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public'
                      and p.proname in ('tomar_aviso', 'guardar_aviso', 'limpieza_del_bucket', 'prefs_de_correo', 'puede_recibir_correos',
                                        'reemplazar_persona', 'personas_desde_nombres_sueltos', 'limpiar_tipo_en_titulos', 'posts_de_fabrica',
                                        'agenda_id', 'registrar_posteo')
                      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))), 'ninguna');

-- 6. search_path fijo en las funciones con permisos de dueño
insert into res(nombre, esperado, obtenido)
  select 'hay funciones con permisos de dueño (security definer), o esto no miraba nada', 'true',
         (select count(*) >= 20 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef)::text;
insert into res(nombre, esperado, obtenido)
  select 'toda función con permisos de dueño lleva el camino de búsqueda fijo y vacío', 'ninguna',
         coalesce((select string_agg(p.proname || '(' || oidvectortypes(p.proargtypes) || ')', ', ' order by p.proname)
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.prosecdef
                      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c = 'search_path=""')), 'ninguna');

-- 7. El bucket de archivos
insert into res(nombre, esperado, obtenido)
  select 'el bucket «adjuntos» es privado, con tope de tamaño y de tipos de archivo', 'privado, con tope y con tipos',
         coalesce((select case when b.public then 'PÚBLICO' when b.file_size_limit is null then 'sin tope de tamaño'
                               when b.allowed_mime_types is null then 'sin lista de tipos' else 'privado, con tope y con tipos' end
                     from storage.buckets b where b.id = 'adjuntos'), 'no existe');

-- Lo anotado hasta acá
select n || '. ' || case when esperado = obtenido then 'BIEN   ' else 'MAL    ' end || nombre
       || case when esperado = obtenido then '' else E'\n      esperado: ' || esperado || E'\n      obtenido: ' || obtenido end as resultado
  from res order by n;
select count(*) filter (where esperado <> obtenido) as mal from res \gset
\if :mal
  do $$ begin raise exception 'FALLÓ: algo de los permisos de la base de verdad no coincide con lo esperado (ver arriba)'; end $$;
\endif

-- 8. Lo que ve cada rol (una cuenta real de cada uno)
-- Lo que hay, como dueño: sirve de control (si una tabla está vacía, que un rol no vea nada no prueba nada).
select (select count(*) from public.posts) as posteos, (select count(*) from public.audit_log) as auditoria,
       (select count(*) from public.calendar_sugerencias) as sugerencias, (select count(*) from public.calendar_sacados) as sacados,
       (select count(*) from public.access_requests) as pedidos \gset
\echo == Lo que hay, como dueño de la base ==
\echo posteos: :posteos · registro de actividad: :auditoria · sugerencias de Calendar: :sugerencias · sacados del Registro: :sacados · pedidos de acceso: :pedidos
select set_config('verificar.posteos', :'posteos', true) as _ \gset
select set_config('verificar.auditoria', :'auditoria', true) as _ \gset
select set_config('verificar.sugerencias', :'sugerencias', true) as _ \gset
select set_config('verificar.sacados', :'sacados', true) as _ \gset
select set_config('verificar.pedidos', :'pedidos', true) as _ \gset
\set rol admin
\ir permisos-rol.sql
\set rol member
\ir permisos-rol.sql
\set rol observer
\ir permisos-rol.sql

rollback;
\echo
\echo == Listo: los permisos de la base de verdad son los esperados ==
