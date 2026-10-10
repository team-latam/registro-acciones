-- ============================================================
-- Verificar, en la base de verdad, qué ve cada rol de la papelera
-- ============================================================
-- SOLO LECTURA: todo va en una transacción de lectura que termina en
-- rollback, y no imprime correos ni identificadores, solo cantidades.
--
-- La regla (02-politicas.sql, adjuntos_leer, auditoría R20): quien tiene la
-- sesión de una persona (integrante, observador, admin) lee únicamente las
-- carpetas posts/ y replies/ del bucket «adjuntos». La carpeta papelera/ (lo
-- que la limpieza semanal aparta antes de borrar) la ve solo la llave de
-- servicio. En el laboratorio ya se probaba; esto lo comprueba en la base
-- real, donde `storage.objects` trae sus permisos de verdad.
--
-- Para cada rol se hace pasar a una cuenta real de ese rol (la que guardó
-- Supabase cuando entró con Google) y se cuenta qué archivos ve. Si algún
-- rol ve aunque sea un archivo de la papelera, la corrida sale en rojo.
--
-- Uso:  psql "$SUPABASE_DB_URL" -X -q -f supabase/verificar/papelera.sql
-- ============================================================
\set ON_ERROR_STOP on
begin read only;

select count(*) filter (where split_part(name, '/', 1) = 'papelera') as papelera,
       count(*) filter (where split_part(name, '/', 1) in ('posts', 'replies')) as publicos
  from storage.objects where bucket_id = 'adjuntos' \gset
-- Para el control de cada rol (se lee adentro de los bloques DO).
select set_config('verificar.publicos', :'publicos', true) as _ \gset
\echo == Lo que hay en el bucket «adjuntos» (visto como dueño de la base) ==
\echo archivos en papelera/ : :papelera
\echo archivos en posts/ y replies/ : :publicos

-- La regla tal como quedó puesta.
select coalesce((select qual from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'adjuntos_leer'), '') as regla \gset
select (:'regla' like '%split_part%' and :'regla' like '%posts%' and :'regla' like '%replies%') as regla_con_carpetas \gset
\echo
\echo == La regla puesta (adjuntos_leer) ==
\echo :regla
\if :regla_con_carpetas
  \echo -> limita la lectura a posts/ y replies/: BIEN
\else
  \echo -> NO limita la lectura a posts/ y replies/: MAL
  do $$ begin raise exception 'FALLÓ: la regla adjuntos_leer no limita la lectura a posts/ y replies/'; end $$;
\endif

-- Una cuenta de cada rol, con la forma de la credencial que manda Supabase
-- cuando alguien entra con Google (ver sesion_valida en 02-politicas.sql).
\set rol admin
\ir papelera-rol.sql
\set rol member
\ir papelera-rol.sql
\set rol observer
\ir papelera-rol.sql

rollback;
\echo
\echo == Listo: nadie con sesión de persona ve la papelera ==
