\set QUIET on
-- Alguien de afuera: entró con su cuenta de Google (la sesión es válida) pero
-- no figura en el equipo (`members`). Es quien acaba de pedir acceso, un
-- ex integrante, o alguien que encontró la dirección (docs/AUDITORIA.md,
-- R27). Lo único que puede hacer es lo que hace falta para pedir entrar:
-- anotar su login y su pedido, y leer su propia solicitud. Todo lo demás
-- (las tablas de administración, las funciones de admin y de avisos, el
-- bucket) tiene que rebotarle.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members, public.access_requests,
  public.user_prefs, public.app_config, public.audit_log, public.personas, public.agenda_listas,
  public.instituciones, public.contactos, public.calendar_sugerencias, public.calendar_sacados cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'member'),   -- admin fijo, a propósito SIN rol admin
  ('ana@x.com',  'Ana',  'ana',  'admin'),
  ('juan@x.com', 'Juan', 'juan', 'member');
-- Tres formas de estar afuera: sin ninguna ficha, ex integrante, y con un
-- pedido de acceso pendiente.
insert into public.former_members(email, name, nickname) values ('vieja@x.com', 'Vieja', 'vieja');
insert into public.access_requests(email, name) values ('pendiente@x.com', 'Pendiente'), ('otro@x.com', 'Otro');
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
insert into public.calendar_sugerencias(evento, grupo) values ('ev1', 'actividad');
insert into public.calendar_sacados(evento, sacado_por) values ('ev2', 'ana@x.com');
insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/p_evento/foto.jpg'), ('adjuntos', 'replies/r1/doc.pdf');

create temp table afuera(correo text);
insert into afuera values ('intruso@x.com'), ('vieja@x.com'), ('pendiente@x.com');

-- ---------- Lo que se rechaza, para cada uno de los tres ----------
create temp table rechazos(nombre text, sentencia text);
insert into rechazos values
  -- lo que es de administración
  ('NO lee las sugerencias de Calendar', $q$create temp table z as select * from public.calendar_sugerencias$q$),
  ('NO lee lo sacado del Registro', $q$create temp table z as select * from public.calendar_sacados$q$),
  ('NO lee la auditoría', $q$create temp table z as select * from public.audit_log$q$),
  ('NO lee las solicitudes de los demás', $q$create temp table z as select * from public.access_requests where email = 'otro@x.com'$q$),
  ('NO aprueba una solicitud', $q$update public.access_requests set status = 'approved' where email = 'otro@x.com'$q$),
  ('NO borra una solicitud ajena', $q$delete from public.access_requests where email = 'otro@x.com'$q$),
  -- lo del equipo
  ('NO lee los posteos', $q$create temp table z as select * from public.posts$q$),
  ('NO lee los comentarios', $q$create temp table z as select * from public.replies$q$),
  ('NO lee la lista del equipo', $q$create temp table z as select * from public.members where email = 'juan@x.com'$q$),
  ('NO lee los ex integrantes', $q$create temp table z as select * from public.former_members$q$),
  ('NO lee las preferencias de nadie', $q$create temp table z as select * from public.user_prefs$q$),
  ('NO lee la configuración', $q$create temp table z as select * from public.app_config$q$),
  ('NO lee la Agenda: personas', $q$create temp table z as select * from public.personas$q$),
  ('NO lee la Agenda: instituciones', $q$create temp table z as select * from public.instituciones$q$),
  ('NO lee la Agenda: contactos', $q$create temp table z as select * from public.contactos$q$),
  ('NO lee la Agenda: listas', $q$create temp table z as select * from public.agenda_listas$q$),
  ('NO lee los archivos del bucket', $q$create temp table z as select * from storage.objects$q$),
  ('NO sube al bucket', $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/x/img0_1.jpg')$q$),
  ('NO borra del bucket', $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$),
  -- no escribe
  ('NO crea un posteo', $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     select 'z1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','X',mi_correo from (select public.mi_correo() as mi_correo) c$q$),
  ('NO comenta', $q$insert into public.replies(id,post_id,content,author_name,author_email)
     select 'z2','p_evento','hola','X',mi_correo from (select public.mi_correo() as mi_correo) c$q$),
  ('NO escribe un mensaje de sistema', $q$insert into public.replies(id,post_id,content,author_name,author_email,system)
     values ('z3','p_evento','📅','Google Calendar',null,true)$q$),
  ('NO crea una persona', $q$insert into public.personas(id, name, created_by) select 'z4', 'X', mi_correo from (select public.mi_correo() as mi_correo) c$q$),
  ('NO suma una institución', $q$insert into public.instituciones(id, name, country) values ('z5', 'X', 'Chile')$q$),
  ('NO suma un contacto', $q$insert into public.contactos(id, nivel, country, persona) values ('z6', 'pais', 'Chile', 'per1')$q$),
  ('NO se da de alta en el equipo', $q$insert into public.members(email, name, nickname) select mi_correo, 'X', 'x' from (select public.mi_correo() as mi_correo) c$q$),
  ('NO se aprueba solo', $q$insert into public.access_requests(email, name, status) select mi_correo, 'X', 'approved' from (select public.mi_correo() as mi_correo) c$q$),
  ('NO se crea preferencias', $q$insert into public.user_prefs(email, prefs) select mi_correo, '{}' from (select public.mi_correo() as mi_correo) c$q$),
  ('NO escribe configuración', $q$insert into public.app_config(key, value) values ('calendarSync', '{}') on conflict (key) do update set value = excluded.value$q$),
  ('NO anota un tipo de auditoría de administración', $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email)
     select 'z7', 'access_approved', mi_correo, 'X', 'juan@x.com' from (select public.mi_correo() as mi_correo) c$q$),
  -- las funciones
  ('tamano_del_bucket', $q$select public.tamano_del_bucket()$q$),
  ('olvidar_preferencias', $q$select public.olvidar_preferencias('juan@x.com')$q$),
  ('agenda_traer', $q$select public.agenda_traer('X', '[{"name":"Y","country":"Chile","gente":[]}]')$q$),
  ('unir_personas', $q$select public.unir_personas('per1', 'per1')$q$),
  ('vincular_persona', $q$select public.vincular_persona('per1', 'juan@x.com')$q$),
  ('sacar_del_registro', $q$select public.sacar_del_registro('{p_evento}')$q$),
  ('devolver_al_registro', $q$select public.devolver_al_registro('{ev2}')$q$),
  ('clasificar_importados', $q$select public.clasificar_importados('[]')$q$),
  ('unificar_cuentas', $q$select public.unificar_cuentas('juan@x.com', 'ana@x.com')$q$),
  ('guardar_preferencias', $q$select public.guardar_preferencias('{"weekStart":0}')$q$),
  ('guardar_config', $q$select public.guardar_config('territoryConfig', '{"zones":{}}')$q$);

select lab.probar(a.correo || ' · ' || r.nombre, lab.como(a.correo), r.sentencia, false)
  from rechazos r cross join afuera a order by a.correo, r.nombre;

-- ---------- Funciones que contestan "nada" en vez de fallar ----------
-- (preparar_*: sin ser del equipo no hay nada que preparar)
create temp table nadas(nombre text, consulta text);
insert into nadas values
  ('preparar_aviso de un posteo: nada', $q$select coalesce(public.preparar_aviso('posteo', 'p_evento')::text, 'nada')$q$),
  ('preparar_aviso de un comentario: nada', $q$select coalesce(public.preparar_aviso('respuesta', 'r1')::text, 'nada')$q$),
  ('preparar_prueba: nada', $q$select coalesce(public.preparar_prueba()::text, 'nada')$q$),
  ('el me gusta a un posteo no cambia nada', $q$select (select count(*) from public.posts where liked_by <> '{}')::text || coalesce(public.me_gusta_posteo('p_evento', true)::text, '')$q$);
select lab.probar_valor(a.correo || ' · ' || n.nombre, lab.como(a.correo), $q$select 1$q$, n.consulta,
                        case when n.nombre like 'el me gusta%' then '0' else 'nada' end)
  from nadas n cross join afuera a order by a.correo, n.nombre;
select lab.comprobar('(control) el me gusta de alguien de afuera no quedó puesto en ningún posteo',
  $q$select count(*)::text from public.posts where liked_by <> '{}'$q$, '0');

-- ---------- Y lo único que sí puede hacer ----------
select lab.probar('intruso@x.com · anota su login', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'Intruso', 'Chrome · Windows')$q$, true);
select lab.probar('intruso@x.com · pide acceso', lab.como('intruso@x.com'),
  $q$insert into public.access_requests(email, name) values ('intruso@x.com', 'Intruso')$q$, true);
select lab.probar('pendiente@x.com · lee su propia solicitud', lab.como('pendiente@x.com'),
  $q$create temp table z as select * from public.access_requests where email = 'pendiente@x.com'$q$, true);
select lab.probar('pendiente@x.com · NO se aprueba a sí mismo (update de su propia solicitud)', lab.como('pendiente@x.com'),
  $q$update public.access_requests set status = 'approved' where email = 'pendiente@x.com'$q$, false);
select lab.probar_valor('pendiente@x.com · no se anota solo el ✓ de «le avisamos al administrador» (lo escriben solo las funciones de aviso)',
  lab.como('pendiente@x.com'),
  $q$update public.access_requests set avisado_at = now(), aviso_pedido_at = now() where email = 'pendiente@x.com'$q$,
  $q$select (avisado_at is null and aviso_pedido_at is null)::text from public.access_requests where email = 'pendiente@x.com'$q$, 'true');
-- (control) los mismos pedidos, hechos por alguien del equipo, andan:
select lab.probar('(control) un integrante lee los posteos', lab.como('juan@x.com'),
  $q$create temp table z as select * from public.posts$q$, true);
select lab.probar('(control) una admin trae una lista de la Agenda', lab.como('ana@x.com'),
  $q$select public.agenda_traer('X', '[{"name":"Y","country":"Chile","gente":[]}]')$q$, true);
select lab.probar('(control) una admin lee las sugerencias de Calendar', lab.como('ana@x.com'),
  $q$create temp table z as select * from public.calendar_sugerencias$q$, true);
select lab.probar('(control) una admin lee lo sacado', lab.como('ana@x.com'),
  $q$create temp table z as select * from public.calendar_sacados$q$, true);

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
