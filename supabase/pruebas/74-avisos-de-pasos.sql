\set QUIET on
-- El aviso por correo de un paso asignado (21-avisos-de-pasos.sql) y las dos
-- preferencias nuevas (emailPasos, emailVence): a quién le llega, cuándo no
-- sale y que quien llama no ve a quién.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.user_prefs, public.app_config,
         public.avisos_enviados, public.avisos_listos cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('diego@x.com', 'Diego', 'diego', 'member'), ('juan@x.com', 'Juan', 'juan', 'member');
-- El admin abre los correos a todo el equipo.
insert into public.app_config(key, value) values ('preferences', '{"correos":{"quienes":"todos"}}');

-- Un posteo con un Cierre leído: x1 se le dio a Diego hace un momento (lo asignó Ana),
-- x2 se le dio a Ana (a sí misma), x3 ya está hecho, x4 se asignó hace una hora, x5 no tiene responsable,
-- x6 es para alguien que no está en el equipo.
create or replace function lab.paso(id text, extra jsonb) returns jsonb language sql as $$
  select jsonb_build_object('id', id, 't', 'Paso ' || id, 'estado', 'pendiente') || extra $$;
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email, resumen) values
  ('p1', 'Visita a Rosario', '', '2026-10-01', '2026-10-01', '2026-10-01', 'visita', 'Ana', 'ana@x.com',
   jsonb_build_object('v', 2, 'partes', jsonb_build_array(jsonb_build_object('tipo', 'cierre', 'pasos', jsonb_build_array(
     lab.paso('x1', jsonb_build_object('resp', 'diego@x.com', 'para', '2026-12-01', 'asigPor', 'ana@x.com', 'asigEl', now())),
     lab.paso('x2', jsonb_build_object('resp', 'ana@x.com', 'asigPor', 'ana@x.com', 'asigEl', now())),
     lab.paso('x3', jsonb_build_object('resp', 'diego@x.com', 'estado', 'hecho', 'asigPor', 'ana@x.com', 'asigEl', now())),
     lab.paso('x4', jsonb_build_object('resp', 'diego@x.com', 'asigPor', 'ana@x.com', 'asigEl', now() - interval '1 hour')),
     lab.paso('x5', '{}'::jsonb),
     lab.paso('x6', jsonb_build_object('resp', 'afuera@x.com', 'asigPor', 'ana@x.com', 'asigEl', now()))))))),
  ('p2', 'Cancelada', '', '2026-10-01', '2026-10-01', '2026-10-01', 'visita', 'Ana', 'ana@x.com',
   jsonb_build_object('v', 2, 'partes', jsonb_build_array(jsonb_build_object('tipo', 'cierre', 'pasos', jsonb_build_array(
     lab.paso('y1', jsonb_build_object('resp', 'diego@x.com', 'asigPor', 'ana@x.com', 'asigEl', now())))))));
update public.posts set cancelled = true where id = 'p2';

select lab.probar_valor('un paso asignado a Diego: le llega a Diego, y el correo lleva el paso, el posteo y quién lo asignó',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (select x -> 'para' -> 0 ->> 'email' || '|' || (x ->> 'autor') || '|' || (x ->> 'texto') || '|' || (x ->> 'titulo') || '|' || (x ->> 'cuando') || '|' || (x ->> 'post')
       from (select lab.aviso(public.preparar_aviso_de_paso('p1#x1')) x) y)$q$,
  'diego@x.com|Ana|Paso x1|Visita a Rosario|2026-12-01|p1');
select lab.probar_valor('quien lo pide recibe solo un turno: no ve a quién le llega',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select string_agg(k, ',') from jsonb_object_keys(public.preparar_aviso_de_paso('p1#x1')) k$q$, 'ticket');
select lab.probar_valor('la segunda vez por la misma asignación, nada (no sale dos veces)',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (public.preparar_aviso_de_paso('p1#x1') is not null)::text || ' ' || coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'true nada');
select lab.probar_valor('solo quien asignó el paso lo puede pedir: otra persona, no',
  lab.como('juan@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
select lab.probar_valor('si el responsable es quien lo asigna, no se avisa a sí mismo',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x2')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un paso que ya está hecho, no',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x3')::text, 'nada')$q$, 'nada');
select lab.probar_valor('una asignación de hace más de 15 minutos, no',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x4')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un paso sin responsable, no',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x5')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un responsable que no está en el equipo, no',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x6')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un posteo cancelado, no',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p2#y1')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un identificador mal armado o un paso que no existe, nada',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1')::text, 'nada') || ' ' || coalesce(public.preparar_aviso_de_paso('p1#nada')::text, 'nada') || ' ' || coalesce(public.preparar_aviso_de_paso('#x1')::text, 'nada') || ' ' || coalesce(public.preparar_aviso_de_paso(null)::text, 'nada')$q$, 'nada nada nada nada');

-- Quién puede recibir correos lo decide el admin.
update public.app_config set value = '{"correos":{"quienes":"admin"}}' where key = 'preferences';
select lab.probar_valor('si el admin no abrió los correos al equipo, a Diego no le llega',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
update public.app_config set value = '{"correos":{"quienes":"elegidos","elegidos":["diego@x.com"]}}' where key = 'preferences';
select lab.probar_valor('si lo eligió como uno de los que reciben, sí',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (public.preparar_aviso_de_paso('p1#x1') is not null)::text$q$, 'true');
update public.app_config set value = '{"correos":{"quienes":"todos"}}' where key = 'preferences';

-- Las preferencias de Diego.
insert into public.user_prefs(email, prefs) values ('diego@x.com', '{"emailPasos":false}');
select lab.probar_valor('si Diego apagó «pasos» en Tu cuenta, no le llega',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
update public.user_prefs set prefs = '{"emailOn":false}' where email = 'diego@x.com';
select lab.probar_valor('ni si apagó todos los correos',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
update public.user_prefs set prefs = '{"emailWhen":"weekly"}' where email = 'diego@x.com';
select lab.probar_valor('con el resumen semanal igual le llega: es algo que le pidieron a él',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (public.preparar_aviso_de_paso('p1#x1') is not null)::text$q$, 'true');
update public.user_prefs set prefs = '{"emailWhat":["menciones"]}' where email = 'diego@x.com';
select lab.probar_valor('y no depende de qué temas marcó en el resto',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select (public.preparar_aviso_de_paso('p1#x1') is not null)::text$q$, 'true');
delete from public.user_prefs;

-- Las dos preferencias nuevas: de fábrica sí, y una mal formada vale lo de fábrica.
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'de fábrica, «pasos» y «vence» están prendidos', true,
  (select (x ->> 'pasos')::boolean and (x ->> 'vence')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
insert into public.user_prefs(email, prefs) values ('diego@x.com', '{"emailPasos":false,"emailVence":false}');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'apagadas, valen apagadas', true,
  (select not (x ->> 'pasos')::boolean and not (x ->> 'vence')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
update public.user_prefs set prefs = '{"emailPasos":"no","emailVence":7}' where email = 'diego@x.com';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'una preferencia que no es sí/no (guardada por la API) vale lo de fábrica', true,
  (select (x ->> 'pasos')::boolean and (x ->> 'vence')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
delete from public.user_prefs;

-- «Lugares sin actividad» (el correo del primer lunes, para admins): de fábrica sí;
-- apagada vale apagada; mal formada vale lo de fábrica.
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'de fábrica, «lugares» está prendido', true, (select (x ->> 'lugares')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
insert into public.user_prefs(email, prefs) values ('diego@x.com', '{"emailLugares":false}');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'apagada, vale apagada', false, (select (x ->> 'lugares')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
update public.user_prefs set prefs = '{"emailLugares":"no"}' where email = 'diego@x.com';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'mal formada (guardada por la API), vale lo de fábrica', true, (select (x ->> 'lugares')::boolean from (select public.prefs_de_correo('diego@x.com') x) y), '';
delete from public.user_prefs;

-- El tope de 30 avisos por hora de quien asigna.
insert into public.avisos_enviados(tipo, objeto, email, autor)
  select 'paso', 'otro' || g, 'diego@x.com', 'ana@x.com' from generate_series(1, 30) g;
select lab.probar_valor('con 30 avisos en la última hora de quien asigna, el próximo no sale',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
delete from public.avisos_enviados;

-- Una asignación con datos que no son lo que escribe la app no rompe nada.
update public.posts set resumen = jsonb_set(resumen, '{partes,0,pasos,0,asigEl}', '"ayer a la tarde"') where id = 'p1';
select lab.probar_valor('una fecha de asignación que no es fecha: nada, sin error',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');
update public.posts set resumen = '{"v":1}' where id = 'p1';
select lab.probar_valor('un resumen de otra forma: nada, sin error',
  lab.como('ana@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_paso('p1#x1')::text, 'nada')$q$, 'nada');

-- Permisos: quien no tiene sesión no la llama, y la función no es pública.
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'preparar_aviso_de_paso la ejecuta quien tiene sesión y no anon', true,
  has_function_privilege('authenticated', 'public.preparar_aviso_de_paso(text)', 'execute')
  and not has_function_privilege('anon', 'public.preparar_aviso_de_paso(text)', 'execute'), '';

drop function lab.paso(text, jsonb);
\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
