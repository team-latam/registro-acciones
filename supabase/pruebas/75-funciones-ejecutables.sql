\set QUIET on
-- Qué funciones puede llamar cada rol, y que ninguna función con permisos
-- de dueño (`security definer`) deje su camino de búsqueda abierto
-- (docs/AUDITORIA.md, R27).
--
-- En Supabase toda función nueva de `public` se puede llamar de entrada
-- desde el navegador (anon y authenticated) si no se le saca el permiso: el
-- laboratorio lo imita (00-laboratorio.sql). Una función que escribe, o que
-- devuelve datos de otros, y se queda así por descuido es una puerta abierta
-- sin que ninguna otra prueba lo note: cada una prueba lo que SU autor
-- pensó. Esta lista blanca es el aviso: si alguien suma una función que
-- anon o authenticated pueden ejecutar, esta prueba falla y obliga a mirar
-- qué devuelve antes de dejarla.
truncate lab.resultados;

-- ---------- La lista ----------
-- Vive en funciones-esperadas.sql: la comparte supabase/verificar/permisos.sql (la base de verdad).
\ir funciones-esperadas.sql

create temp table reales as
  select p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as firma,
         has_function_privilege('anon', p.oid, 'execute') as anon,
         has_function_privilege('authenticated', p.oid, 'execute') as authenticated
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
     -- lo que trae una extensión no lo escribimos nosotros
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

-- ---------- 1. Ninguna función de más, ni con más permiso que el esperado ----------
select lab.comprobar(
  'hay una función que anon o authenticated pueden ejecutar y no está en la lista de supabase/pruebas/75-funciones-ejecutables.sql: '
  'MIRÁ QUÉ DEVUELVE Y QUÉ ESCRIBE. Si es a propósito, sumala a la lista con una línea que diga por qué es segura; '
  'si no, sacale el permiso (revoke execute on function … from public, anon, authenticated) en el archivo donde la creás',
  $q$select coalesce(string_agg(r.firma || case when e.firma is null then ' (NUEVA)'
                                                else ' (permiso de más: anon=' || r.anon || ' authenticated=' || r.authenticated || ')' end,
                                ', ' order by r.firma), 'ninguna')
       from reales r left join esperadas e using (firma)
      where e.firma is null or (r.anon and not e.anon) or (r.authenticated and not e.authenticated)$q$,
  'ninguna');

-- ---------- 2. La lista no se pudrió ----------
select lab.comprobar(
  'la lista de supabase/pruebas/75-funciones-ejecutables.sql nombra una función que ya no existe, o a la que se le sacó un permiso: actualizá la línea (o sacala)',
  $q$select coalesce(string_agg(e.firma, ', ' order by e.firma), 'ninguna')
       from esperadas e left join reales r using (firma)
      where r.firma is null or (e.anon and not r.anon) or (e.authenticated and not r.authenticated)$q$,
  'ninguna');

-- ---------- 3. Lo que NUNCA puede llamar el navegador ----------
-- Funciones de los trabajos automáticos y de la base: si una de estas
-- apareciera ejecutable por anon o authenticated, la lista de arriba ya
-- fallaría; esto lo dice con nombre propio, y comprueba que la llave de
-- servicio sí las puede llamar (si no, el trabajo se cae).
select lab.comprobar('tomar_aviso, guardar_aviso, limpieza_del_bucket, prefs_de_correo y puede_recibir_correos no las ejecuta anon ni authenticated',
  $q$select coalesce(string_agg(p.proname, ', ' order by p.proname), 'ninguna')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('tomar_aviso', 'guardar_aviso', 'limpieza_del_bucket', 'prefs_de_correo', 'puede_recibir_correos',
                          'reemplazar_persona', 'personas_desde_nombres_sueltos', 'limpiar_tipo_en_titulos', 'posts_de_fabrica',
                          'agenda_id', 'registrar_posteo')
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))$q$,
  'ninguna');
select lab.comprobar('y existen las once (si una cambia de nombre, la de arriba no miraba nada)',
  $q$select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('tomar_aviso', 'guardar_aviso', 'limpieza_del_bucket', 'prefs_de_correo', 'puede_recibir_correos',
                          'reemplazar_persona', 'personas_desde_nombres_sueltos', 'limpiar_tipo_en_titulos', 'posts_de_fabrica',
                          'agenda_id', 'registrar_posteo')$q$, '11');
select lab.comprobar('la llave de servicio sí llama a las que usan los trabajos (la función de avisos y la limpieza del bucket)',
  $q$select (has_function_privilege('service_role', 'public.tomar_aviso(text)', 'execute')
         and has_function_privilege('service_role', 'public.limpieza_del_bucket(integer, integer, date)', 'execute')
         and has_function_privilege('service_role', 'public.prefs_de_correo(text)', 'execute')
         and has_function_privilege('service_role', 'public.puede_recibir_correos(text)', 'execute'))::text$q$, 'true');

-- ---------- 4. Los disparadores no se llaman a mano ----------
select lab.probar('una función de disparador (con permiso de ejecutar) no se puede llamar desde la API', lab.como('juan@x.com'),
  $q$select public.posts_controlar_update()$q$, false);
select lab.probar('ni la del registro de actividad', lab.como('juan@x.com'),
  $q$select public.registrar_posteo()$q$, false);

-- ---------- 5. search_path fijo en las que corren con permisos de dueño ----------
-- Una función `security definer` que resuelve nombres por un camino que otro
-- puede alterar (un objeto con el mismo nombre en un esquema que él
-- escribe) corre ese objeto CON los permisos del dueño. Todas llevan
-- `set search_path = ''` y los nombres con su esquema.
select lab.comprobar('hay funciones security definer, o la prueba no miraba nada',
  $q$select (count(*) >= 20)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef$q$, 'true');
select lab.comprobar(
  'hay una función security definer en public SIN search_path fijo: agregale «set search_path = ''''» (vacío) y escribí los nombres con su esquema: public.tabla',
  $q$select coalesce(string_agg(p.proname || '(' || oidvectortypes(p.proargtypes) || ')', ', ' order by p.proname), 'ninguna')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')$q$,
  'ninguna');
select lab.comprobar(
  'hay una función security definer en public con un search_path que NO es vacío (incluye un esquema que se puede escribir): dejalo vacío («set search_path = ''''»)',
  $q$select coalesce(string_agg(p.proname || '(' || oidvectortypes(p.proargtypes) || ')', ', ' order by p.proname), 'ninguna')
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%' and c <> 'search_path=""')$q$,
  'ninguna');

\set QUIET off
-- Primero QUÉ función es, y después cómo se arregla (el aviso es largo).
select n, '  FALLA  ' || detalle || '   <--   ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
