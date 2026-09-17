\set QUIET on
truncate lab.resultados;
-- El estado EXACTO en el que está tu Supabase ahora: permisos puestos y la
-- tabla del equipo VACÍA (todavía no importamos nada).
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;

select lab.probar('el admin fijo escribe config aunque NO figure en el equipo', lab.como('benny@team-latam.com'),
  $q$insert into public.app_config(key,value) values ('prueba','{}')$q$, true);
select lab.probar('cualquier otro logueado NO escribe config', lab.como('intruso@x.com'),
  $q$insert into public.app_config(key,value) values ('prueba2','{}')$q$, false);
select lab.probar('ni siquiera calendarSync, que es la más floja', lab.como('intruso@x.com'),
  $q$insert into public.app_config(key,value) values ('calendarSync','{}')$q$, false);
select lab.probar('NADIE escribe un posteo con la tabla del equipo vacía', lab.como('intruso@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x','T','C','2026-09-10','2026-09-10','2026-09-10','evento','X','intruso@x.com')$q$, false);
select lab.probar('ni lee nada', lab.como('intruso@x.com'),
  'create temp table z1 as select * from public.app_config', false);
select lab.probar('NADIE registra auditoría a nombre de otro — ni el admin fijo', lab.como('benny@team-latam.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('z','login','otro@x.com','Otro')$q$, false);
select lab.probar('el admin fijo SÍ registra la suya', lab.como('benny@team-latam.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('z2','login','benny@team-latam.com','B')$q$, true);
select lab.probar('alguien de afuera NO se da de alta en el equipo', lab.como('intruso@x.com'),
  $q$insert into public.members(email,name,nickname) values ('intruso@x.com','X','x')$q$, false);
select lab.probar('el admin fijo sí (es como arranca todo)', lab.como('benny@team-latam.com'),
  $q$insert into public.members(email,name,nickname) values ('benny@team-latam.com','Benny','benny')$q$, true);

\set QUIET off
\echo ''
select case when esperado = obtenido then 'ok     ' else 'FALLA  ' end || nombre as resultado,
       detalle from lab.resultados order by n;
-- El mismo resumen que los demás archivos, para poder correrlos todos de
-- una y leer una sola línea por archivo.
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
