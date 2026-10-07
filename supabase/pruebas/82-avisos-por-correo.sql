\set QUIET on
-- Avisos por correo (17-avisos-por-correo.sql): quién puede recibir,
-- las preferencias de cada uno, y que nada salga dos veces.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.user_prefs, public.app_config,
         public.avisos_enviados, public.access_requests cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('juan@x.com', 'Juan', 'juan', 'member'), ('otra.admin@x.com', 'Otra', 'otra', 'admin');
-- Benny los quiere al momento; Ana y Juan también (para ver que igual no les llega).
insert into public.user_prefs(email, prefs) values
  ('benny@team-latam.com', '{"emailWhen":"instant"}'), ('ana@x.com', '{"emailWhen":"instant"}'),
  ('juan@x.com', '{"emailWhen":"instant"}');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email, mentions) values
  ('p1', 'Visita a Rosario', 'Hola @benny y @juan', '2026-10-01', '2026-10-01', '2026-10-01', 'visita', 'Ana', 'ana@x.com', '{benny@team-latam.com,juan@x.com}'),
  ('p2', 'Programa de becas', 'De Benny', '2026-10-01', '2026-10-01', '2026-10-01', 'visita', 'Benny', 'benny@team-latam.com', '{}');
insert into public.replies(id, post_id, content, author_name, author_email, mentions) values
  ('r1', 'p2', 'Buenísimo', 'Juan', 'juan@x.com', '{}');

insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'de fábrica, solo el admin fijo puede recibir correos', true, x = 'ana@x.com=false benny@team-latam.com=true juan@x.com=false', x
  from (select string_agg(e || '=' || public.puede_recibir_correos(e), ' ' order by e) x
          from unnest(array['ana@x.com','benny@team-latam.com','juan@x.com']) e) y;
select lab.probar_valor('una mención a Benny y a Juan: le llega solo a Benny',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (select string_agg(x ->> 'email' || ':' || (x ->> 'motivo'), ',') from jsonb_array_elements(lab.aviso(public.preparar_aviso('posteo', 'p1')) -> 'para') x)$q$,
  'benny@team-latam.com:menciones');
select lab.probar_valor('la segunda vez, nada (no sale dos veces)',
  lab.como('ana@x.com'), $q$select public.preparar_aviso('posteo', 'p1')$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
select lab.probar_valor('solo lo puede pedir quien lo escribió',
  lab.como('juan@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un comentario en un posteo de Benny: le llega como «respuestas»',
  lab.como('juan@x.com'), $q$select 1$q$,
  $q$select (lab.aviso(public.preparar_aviso('respuesta', 'r1')) -> 'para' -> 0 ->> 'motivo')$q$, 'respuestas');
update public.user_prefs set prefs = '{}' where email = 'benny@team-latam.com';
select lab.probar_valor('con el resumen diario (lo de fábrica), al momento no sale nada',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
update public.user_prefs set prefs = '{"emailWhen":"instant","emailOn":false}' where email = 'benny@team-latam.com';
select lab.probar_valor('apagado, tampoco',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
update public.user_prefs set prefs = '{"emailWhen":"instant","emailWhat":["respuestas"]}' where email = 'benny@team-latam.com';
select lab.probar_valor('sin «menciones» marcado, tampoco',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
update public.user_prefs set prefs = '{"emailWhen":"instant"}' where email = 'benny@team-latam.com';
insert into public.app_config(key, value) values ('preferences', '{"correos":{"quienes":"todos"}}');
select lab.probar_valor('si el admin abre los correos a todo el equipo, a Juan también le llega',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (select string_agg(x ->> 'email', ',' order by x ->> 'email') from jsonb_array_elements(lab.aviso(public.preparar_aviso('posteo', 'p1')) -> 'para') x)$q$,
  'benny@team-latam.com,juan@x.com');
update public.app_config set value = '{"correos":{"quienes":"elegidos","elegidos":["juan@x.com"]}}' where key = 'preferences';
select lab.probar_valor('o solo a los elegidos',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (select string_agg(x ->> 'email', ',' order by x ->> 'email') from jsonb_array_elements(lab.aviso(public.preparar_aviso('posteo', 'p1')) -> 'para') x)$q$,
  'benny@team-latam.com,juan@x.com');
select lab.probar('quién recibe correos lo decide un admin, no cualquiera',
  lab.como('ana@x.com'), $q$update public.app_config set value = '{"correos":{"quienes":"todos"}}' where key = 'preferences'$q$, false);
select lab.probar('un admin sí',
  lab.como('benny@team-latam.com'), $q$update public.app_config set value = '{"correos":{"quienes":"todos"}}' where key = 'preferences'$q$, true);
delete from public.app_config where key = 'preferences';
select lab.probar_valor('el correo de prueba: a quien puede recibir, uno por hora',
  lab.como('benny@team-latam.com'), $q$select 1$q$,
  $q$select (public.preparar_prueba() is not null)::text || ' ' || (public.preparar_prueba() is null)::text$q$, 'true true');
select lab.probar_valor('a quien no puede recibir, ninguno',
  lab.como('ana@x.com'), $q$select 1$q$, $q$select coalesce(public.preparar_prueba()::text, 'nada')$q$, 'nada');
insert into public.access_requests(email, name, status) values ('nuevo@x.com', 'Nuevo', 'pending');
select lab.probar_valor('el pedido de acceso: solo a los admins que pueden recibir (hoy, Benny)',
  lab.como('nuevo@x.com'), $q$select 1$q$, $q$select (lab.aviso(public.pedir_aviso_al_admin()) -> 'para')::text$q$, '["benny@team-latam.com"]');
update public.user_prefs set prefs = '{"emailWhat":["menciones"]}' where email = 'benny@team-latam.com';
select lab.probar_valor('y si Benny desmarcó «pedidos», a nadie',
  lab.como('nuevo@x.com'), $q$select 1$q$,
  $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');

-- ---------- Lo de la auditoría del 7/10/2026 ----------
update public.user_prefs set prefs = '{"emailWhen":"instant"}' where email = 'benny@team-latam.com';
delete from public.avisos_enviados;
select lab.probar_valor('quien publica recibe solo un turno: no ve a quién le llega el aviso',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select string_agg(k, ',') from jsonb_object_keys(public.preparar_aviso('posteo', 'p1')) k$q$, 'ticket');
update public.posts set author_name = 'Benny (admin)' where id = 'p1';
select lab.probar_valor('el nombre del autor sale de su cuenta, no de la firma del posteo (que la escribe quien publica)',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select lab.aviso(public.preparar_aviso('posteo', 'p1')) ->> 'autor'$q$, 'Ana');
update public.posts set author_name = 'Ana' where id = 'p1';
insert into public.avisos_enviados(tipo, objeto, email, autor)
  select 'posteo', 'otro' || g, 'benny@team-latam.com', 'ana@x.com' from generate_series(1, 30) g;
select lab.probar_valor('con 30 avisos en la última hora, el próximo no sale al momento (va al resumen)',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p1')::text, 'nada')$q$, 'nada');
delete from public.avisos_enviados;
insert into public.avisos_enviados(tipo, objeto, email, autor, enviado_el)
  select 'prueba', 'h' || g, 'benny@team-latam.com', 'benny@team-latam.com', now() - g * interval '2 hours' from generate_series(1, 3) g;
select lab.probar_valor('el correo de prueba: como mucho tres por día',
  lab.como('benny@team-latam.com'), $q$select 1$q$, $q$select coalesce(public.preparar_prueba()::text, 'nada')$q$, 'nada');
delete from public.avisos_enviados;
-- Cada uno en su idioma y en su hora (decisión del usuario del 7/10/2026).
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'de fábrica, español y la hora de Argentina', true,
  (select x ->> 'lang' = 'es' and x ->> 'tz' = 'America/Argentina/Buenos_Aires' from (select public.prefs_de_correo('juan@x.com') x) y), '';
update public.user_prefs set prefs = '{"emailWhen":"instant","emailLang":"he","emailTz":"Asia/Jerusalem"}' where email = 'benny@team-latam.com';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'el idioma y la zona que guardó la app', true,
  (select x ->> 'lang' = 'he' and x ->> 'tz' = 'Asia/Jerusalem' from (select public.prefs_de_correo('benny@team-latam.com') x) y), '';
select lab.probar_valor('y el aviso al momento lleva el idioma de quien lo recibe',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select lab.aviso(public.preparar_aviso('posteo', 'p1')) -> 'para' -> 0 ->> 'lang'$q$, 'he');
update public.user_prefs set prefs = '{"emailWhen":"instant","emailLang":"klingon","emailTz":"x; drop table"}' where email = 'benny@team-latam.com';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'un idioma o una zona que no son, valen lo de fábrica', true,
  (select x ->> 'lang' = 'es' and x ->> 'tz' = 'America/Argentina/Buenos_Aires' from (select public.prefs_de_correo('benny@team-latam.com') x) y), '';
update public.user_prefs set prefs = '{"emailWhen":"instant"}' where email = 'benny@team-latam.com';
delete from public.avisos_enviados;

insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'lo que hay que mandar lo lee solo la llave de servicio (tomar_aviso), no la app', true,
  not has_table_privilege('authenticated', 'public.avisos_listos', 'select')
  and not has_function_privilege('authenticated', 'public.tomar_aviso(text)', 'execute')
  and not has_function_privilege('anon', 'public.tomar_aviso(text)', 'execute')
  and has_function_privilege('service_role', 'public.tomar_aviso(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.guardar_aviso(jsonb)', 'execute'), '';

insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'lo ya enviado y los resúmenes no se ven desde la app', true,
  not has_table_privilege('authenticated', 'public.avisos_enviados', 'select')
  and not has_table_privilege('authenticated', 'public.resumenes_enviados', 'select')
  and not has_function_privilege('authenticated', 'public.puede_recibir_correos(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.prefs_de_correo(text)', 'execute'), '';

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
