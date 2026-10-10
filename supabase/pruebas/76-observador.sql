\set QUIET on
-- El observador (rol `observer`): ve todo lo del equipo y no escribe nada,
-- salvo lo suyo (sus preferencias y su @nickname). Es alguien de dirección
-- que mira, no que carga (docs/AUDITORIA.md, R27). Lo que no puede escribir
-- en cada tabla, lo que no puede leer de administración, y que las
-- funciones que arman avisos o tocan cosas de admin no le sirvan.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members, public.access_requests,
  public.user_prefs, public.app_config, public.audit_log, public.personas, public.agenda_listas,
  public.instituciones, public.contactos, public.calendar_sugerencias, public.calendar_sacados cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'member'),   -- admin fijo, a propósito SIN rol admin
  ('ana@x.com',  'Ana',  'ana',  'admin'),
  ('juan@x.com', 'Juan', 'juan', 'member'),
  ('obs@x.com',  'Obs',  'obs',  'observer');
insert into public.former_members(email, name, nickname) values ('vieja@x.com', 'Vieja', 'vieja');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email) values
  ('p_evento', 'Evento de Juan', 'texto', '2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com'),
  ('p_rutina', 'Rutina de Juan', 'texto', '2026-09-10','2026-09-10','2026-09-10','rutina','Juan','juan@x.com');
insert into public.replies(id, post_id, content, author_name, author_email) values ('r1', 'p_evento', 'un comentario', 'Juan', 'juan@x.com');
insert into public.personas(id, name, created_by) values ('per1', 'Persona Uno', 'juan@x.com');
insert into public.agenda_listas(id, name) values ('lis1', 'Directorio');
insert into public.instituciones(id, name, country, created_by) values ('ins1', 'Beit Chabad', 'Argentina', 'juan@x.com');
insert into public.contactos(id, institucion, persona, cargo) values ('con1', 'ins1', 'per1', 'Rab');
insert into public.user_prefs(email, prefs) values ('juan@x.com', '{"weekStart":1}');
insert into public.app_config(key, value) values ('territoryConfig','{}'), ('calendarSync','{}');
insert into public.audit_log(id, type, actor_email, actor_name) values ('a1','login','juan@x.com','Juan');
insert into public.access_requests(email, name) values ('pide@x.com', 'Pide');
insert into public.calendar_sugerencias(evento, grupo) values ('ev1', 'actividad');
insert into public.calendar_sacados(evento, sacado_por) values ('ev2', 'ana@x.com');
insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/p_evento/foto.jpg');

\set OBS 'lab.como(''obs@x.com'')'

-- ---------- Lo que ve ----------
select lab.probar('ve los posteos', :OBS, $q$create temp table v1 as select * from public.posts$q$, true);
select lab.probar('ve los comentarios', :OBS, $q$create temp table v2 as select * from public.replies$q$, true);
select lab.probar('ve el equipo', :OBS, $q$create temp table v3 as select * from public.members$q$, true);
select lab.probar('y los ex integrantes', :OBS, $q$create temp table v4 as select * from public.former_members$q$, true);
select lab.probar('ve la Agenda (decisión del usuario): personas, instituciones, contactos y listas', :OBS,
  $q$create temp table v5 as select p.id from public.personas p, public.instituciones i, public.contactos c, public.agenda_listas l$q$, true);
select lab.probar('ve la configuración del equipo', :OBS, $q$create temp table v6 as select * from public.app_config$q$, true);
select lab.probar('y los archivos de los posteos', :OBS, $q$create temp table v7 as select * from storage.objects where name like 'posts/%'$q$, true);

-- ---------- Lo que NO ve (es de administración) ----------
select lab.probar('NO lee la auditoría', :OBS, $q$create temp table n1 as select * from public.audit_log$q$, false);
select lab.probar('NO lee las solicitudes de acceso de los demás', :OBS, $q$create temp table n2 as select * from public.access_requests$q$, false);
select lab.probar('NO lee las sugerencias de Calendar', :OBS, $q$create temp table n3 as select * from public.calendar_sugerencias$q$, false);
select lab.probar('NO lee lo sacado del Registro', :OBS, $q$create temp table n4 as select * from public.calendar_sacados$q$, false);
select lab.probar('NO lee las preferencias de otro', :OBS, $q$create temp table n5 as select * from public.user_prefs where email = 'juan@x.com'$q$, false);

-- ---------- Lo que NO escribe ----------
select lab.probar('NO crea un posteo', :OBS,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('o1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Obs','obs@x.com')$q$, false);
select lab.probar('NO crea una Rutina', :OBS,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('o2','T','C','2026-09-10','2026-09-10','2026-09-10','rutina','Obs','obs@x.com')$q$, false);
select lab.probar('NO edita un evento', :OBS, $q$update public.posts set content = 'x' where id = 'p_evento'$q$, false);
select lab.probar('NO cancela un evento', :OBS, $q$update public.posts set cancelled = true where id = 'p_evento'$q$, false);
select lab.probar('NO borra un posteo', :OBS, $q$delete from public.posts where id = 'p_evento'$q$, false);
select lab.probar('NO comenta', :OBS,
  $q$insert into public.replies(id,post_id,content,author_name,author_email) values ('o3','p_evento','hola','Obs','obs@x.com')$q$, false);
select lab.probar('NO comenta ni en una Rutina', :OBS,
  $q$insert into public.replies(id,post_id,content,author_name,author_email) values ('o4','p_rutina','hola','Obs','obs@x.com')$q$, false);
select lab.probar_valor('NO da me gusta a un posteo (ni con la función de la app)', :OBS,
  $q$select public.me_gusta_posteo('p_evento', true)$q$,
  $q$select (liked_by @> array['obs@x.com'])::text from public.posts where id = 'p_evento'$q$, 'false');
select lab.probar_valor('ni a un comentario', :OBS,
  $q$select public.me_gusta_comentario('r1', true)$q$,
  $q$select (liked_by @> array['obs@x.com'])::text from public.replies where id = 'r1'$q$, 'false');
select lab.probar('NO crea una persona', :OBS, $q$insert into public.personas(id, name, created_by) values ('o5', 'X', 'obs@x.com')$q$, false);
select lab.probar('NO corrige una persona', :OBS, $q$update public.personas set note = 'x' where id = 'per1'$q$, false);
select lab.probar('NO borra una persona', :OBS, $q$delete from public.personas where id = 'per1'$q$, false);
select lab.probar('NO suma una institución', :OBS, $q$insert into public.instituciones(id, name, country) values ('o6', 'X', 'Chile')$q$, false);
select lab.probar('NO corrige una institución', :OBS, $q$update public.instituciones set address = 'x' where id = 'ins1'$q$, false);
select lab.probar('NO suma un contacto a una institución', :OBS, $q$insert into public.contactos(id, institucion, persona) values ('o7', 'ins1', 'per1')$q$, false);
select lab.probar('NO suma un contacto de un lugar', :OBS, $q$insert into public.contactos(id, nivel, country, persona) values ('o8', 'pais', 'Chile', 'per1')$q$, false);
select lab.probar('NO saca a alguien de un lugar', :OBS, $q$delete from public.contactos where id = 'con1'$q$, false);
select lab.probar('NO crea una lista de la Agenda', :OBS, $q$insert into public.agenda_listas(id, name) values ('o9', 'X')$q$, false);
select lab.probar('NO cambia la configuración del equipo', :OBS,
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb"}},"countryZones":{}}' where key = 'territoryConfig'$q$, false);
select lab.probar('NO deja el estado de la sincronización con Calendar', :OBS, $q$update public.app_config set value = '{"syncToken":"y"}' where key = 'calendarSync'$q$, false);
select lab.probar('NO sube un archivo al bucket', :OBS,
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/o1/img0_1.jpg')$q$, false);
select lab.probar('NO se da de alta en otra parte del equipo', :OBS, $q$insert into public.members(email, name) values ('amigo@x.com', 'Amigo')$q$, false);
select lab.probar('NO se anota un tipo de auditoría de administración', :OBS,
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email) values ('o10', 'access_approved', 'obs@x.com', 'Obs', 'juan@x.com')$q$, false);

-- ---------- Lo que SÍ es suyo ----------
select lab.probar('anota su login, como todos', :OBS,
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('obs@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'obs@x.com', 'Obs', 'Chrome · Windows')$q$, true);
select lab.probar_valor('guarda sus propias preferencias', :OBS,
  $q$select public.guardar_preferencias('{"weekStart":0,"emailOn":false}')$q$,
  $q$select (prefs ->> 'weekStart') || ' ' || (prefs ->> 'emailOn') from public.user_prefs where email = 'obs@x.com'$q$, '0 false');
select lab.probar('y las cambia', :OBS,
  $q$select public.guardar_preferencias('{"weekStart":1}'); update public.user_prefs set prefs = '{"weekStart":2}' where email = 'obs@x.com'$q$, true);
select lab.probar('NO guarda las de otro', :OBS, $q$update public.user_prefs set prefs = '{"weekStart":6}' where email = 'juan@x.com'$q$, false);
select lab.probar_valor('cambia su @nickname', :OBS,
  $q$update public.members set nickname = 'observando' where email = 'obs@x.com'$q$,
  $q$select nickname from public.members where email = 'obs@x.com'$q$, 'observando');
select lab.probar('marca que ya vio el tutorial', :OBS,
  $q$update public.members set tour_seen_at = 'epoch' where email = 'obs@x.com'$q$, true);
select lab.probar('pero NO cambia su rol', :OBS, $q$update public.members set role = 'member' where email = 'obs@x.com'$q$, false);
select lab.probar('ni su nombre', :OBS, $q$update public.members set name = 'Otro Nombre' where email = 'obs@x.com'$q$, false);
select lab.probar('ni el @nickname de otro', :OBS, $q$update public.members set nickname = 'robado' where email = 'juan@x.com'$q$, false);
select lab.probar('NO se aprueba solo un pedido de acceso', :OBS,
  $q$insert into public.access_requests(email, name, status) values ('obs@x.com', 'Obs', 'approved')$q$, false);

-- ---------- Las funciones ----------
-- Las de avisos (17-avisos-por-correo.sql) arman el turno de un correo, y
-- solo sobre lo que escribió quien llama: el observador no escribe nada.
select lab.probar_valor('preparar_aviso de un posteo de otro: nada', :OBS, $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('posteo', 'p_evento')::text, 'nada')$q$, 'nada');
select lab.probar_valor('preparar_aviso de un comentario de otro: nada', :OBS, $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso('respuesta', 'r1')::text, 'nada')$q$, 'nada');
select lab.probar_valor('preparar_prueba: nada, mientras los correos sean solo del admin fijo (de fábrica)', :OBS, $q$select 1$q$,
  $q$select coalesce(public.preparar_prueba()::text, 'nada')$q$, 'nada');
-- Si el admin abre los correos a todo el equipo, el observador también los
-- recibe (es del equipo): la prueba es a su propio correo, de a una por
-- hora y tres por día.
insert into public.app_config(key, value) values ('preferences', '{"correos":{"quienes":"todos"}}');
select lab.probar_valor('si los correos se abren a todos, la prueba a su propio correo le sirve', :OBS, $q$select 1$q$,
  $q$select (public.preparar_prueba() is not null)::text$q$, 'true');
delete from public.app_config where key = 'preferences';
select lab.probar_valor('pedir_aviso_al_admin: nada (no tiene un pedido de acceso)', :OBS, $q$select 1$q$,
  $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
select lab.probar('tamano_del_bucket es de admin', :OBS, $q$select public.tamano_del_bucket()$q$, false);
select lab.probar('olvidar_preferencias es de admin', :OBS, $q$select public.olvidar_preferencias('juan@x.com')$q$, false);
select lab.probar('traer una lista de la Agenda es de admin', :OBS,
  $q$select public.agenda_traer('X', '[{"name":"Y","country":"Chile","gente":[]}]')$q$, false);
select lab.probar('unir personas es de admin', :OBS, $q$select public.unir_personas('per1', 'per1')$q$, false);
select lab.probar('vincular una persona es de admin', :OBS, $q$select public.vincular_persona('per1', 'juan@x.com')$q$, false);
select lab.probar('unificar cuentas es de admin', :OBS, $q$select public.unificar_cuentas('juan@x.com', 'ana@x.com')$q$, false);
select lab.probar('ordenar lo de Calendar es de admin', :OBS, $q$select public.clasificar_importados('[]')$q$, false);
select lab.probar('sacar del Registro es de admin', :OBS, $q$select public.sacar_del_registro('{p_evento}')$q$, false);
select lab.probar('devolver al Registro es de admin', :OBS, $q$select public.devolver_al_registro('{ev2}')$q$, false);
select lab.probar('guardar_config no le sirve', :OBS, $q$select public.guardar_config('territoryConfig', '{"zones":{}}')$q$, false);
-- Los controles de arriba no pasan por una falla de las pruebas mismas:
-- el mismo pedido, hecho por quien sí puede, funciona.
select lab.probar('(control) un integrante comenta donde el observador no puede', lab.como('juan@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email) values ('c1','p_evento','hola','Juan','juan@x.com')$q$, true);
select lab.probar('(control) una admin trae la lista de la Agenda', lab.como('ana@x.com'),
  $q$select public.agenda_traer('X', '[{"name":"Y","country":"Chile","gente":[]}]')$q$, true);

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
