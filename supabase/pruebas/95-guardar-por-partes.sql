\set QUIET on
truncate lab.resultados;
truncate public.members, public.user_prefs, public.app_config cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('ana@x.com','Ana','ana','admin'),
  ('juan@x.com','Juan','juan','member');

select lab.probar_valor('guardar una preferencia la crea', lab.como('juan@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":1}')$q$,
  $q$select prefs::text from public.user_prefs where email='juan@x.com'$q$, '{"weekStart": 1}');
select lab.probar_valor('guardar otra NO borra la primera (es lo que hacía merge:true)', lab.como('juan@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":1}');
     select public.guardar_preferencias('{"dimPast":true}')$q$,
  $q$select (prefs->>'weekStart') || '/' || (prefs->>'dimPast') from public.user_prefs where email='juan@x.com'$q$, '1/true');
select lab.probar_valor('y cambiar la misma la pisa', lab.como('juan@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":1}');
     select public.guardar_preferencias('{"weekStart":6}')$q$,
  $q$select prefs->>'weekStart' from public.user_prefs where email='juan@x.com'$q$, '6');
select lab.probar_valor('de quién son NO es un parámetro: sale de la credencial', lab.como('ana@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":3}')$q$,
  $q$select coalesce((select prefs->>'weekStart' from public.user_prefs where email='juan@x.com'),'(sin tocar)')$q$,
  '(sin tocar)');
select lab.probar_valor('alguien de afuera no guarda preferencias', lab.como('intruso@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":1}')$q$,
  $q$select count(*)::text from public.user_prefs$q$, 'new row violates row-level security policy for table "user_prefs"');

select lab.probar_valor('un admin guarda una sección de la configuración', lab.como('ana@x.com'),
  $q$select public.guardar_config('preferences','{"calendarId":"x"}')$q$,
  $q$select value->>'calendarId' from public.app_config where key='preferences'$q$, 'x');
select lab.probar_valor('y guardar otra sección NO borra la anterior', lab.como('ana@x.com'),
  $q$select public.guardar_config('preferences','{"calendarId":"x"}');
     select public.guardar_config('preferences','{"maxImages":4}')$q$,
  $q$select (value->>'calendarId') || '/' || (value->>'maxImages') from public.app_config where key='preferences'$q$, 'x/4');
select lab.probar_valor('un integrante común NO toca la configuración del equipo', lab.como('juan@x.com'),
  $q$select public.guardar_config('preferences','{"calendarId":"pirata"}')$q$,
  $q$select count(*)::text from public.app_config where key='preferences'$q$,
  'new row violates row-level security policy for table "app_config"');
select lab.probar_valor('pero sí deja el estado de la sincronización', lab.como('juan@x.com'),
  $q$select public.guardar_config('calendarSync','{"syncToken":"abc"}')$q$,
  $q$select value->>'syncToken' from public.app_config where key='calendarSync'$q$, 'abc');

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
