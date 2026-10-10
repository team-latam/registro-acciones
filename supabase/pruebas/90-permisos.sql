\set QUIET on
\set ON_ERROR_STOP on
-- El banco de pruebas (lab.como, lab.probar, lab.probar_valor) vive en
-- 00-laboratorio.sql. No repetirlo acá: una copia vieja adentro de un
-- archivo pisa la compartida, y el resultado de las demás pruebas pasa a
-- depender del orden en que se corran. Ya pasó una vez.

-- La pizarra, limpia. Sin esto este archivo sumaba a su cuenta los
-- resultados del que se hubiera corrido antes: "87 pasaron" cuando sus
-- pruebas son 66. Otra forma del mismo problema de arriba.
truncate lab.resultados;

-- ---------- Datos de prueba ----------
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;

insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'member'),   -- admin fijo, a propósito SIN rol admin
  ('ana@x.com',  'Ana',  'ana',  'admin'),
  ('juan@x.com', 'Juan', 'juan', 'member'),
  ('pedro@x.com', 'Pedro', 'pedro', 'member'),   -- otro integrante común, sin posteos
  ('obs@x.com',  'Obs',  'obs',  'observer');
insert into public.former_members(email, name, nickname) values ('vieja@x.com', 'Vieja', 'vieja');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email) values
  ('p_evento',  'Evento de Juan', 'texto', '2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com'),
  ('p_rutina',  'Rutina de Juan', 'texto', '2026-09-10','2026-09-10','2026-09-10','rutina','Juan','juan@x.com'),
  ('p_de_ana',  'Evento de Ana',  'texto', '2026-09-10','2026-09-10','2026-09-10','evento','Ana','ana@x.com');
update public.posts set liked_by = array['juan@x.com','ana@x.com'] where id = 'p_evento';
insert into public.replies(id, post_id, content, author_name, author_email) values
  ('r1', 'p_evento', 'un comentario', 'Juan', 'juan@x.com');
insert into public.user_prefs(email, prefs) values ('juan@x.com', '{"weekStart":1}');
insert into public.app_config(key, value) values ('territoryConfig','{}'), ('calendarSync','{}');
insert into public.audit_log(id, type, actor_email, actor_name) values ('a1','login','juan@x.com','Juan');

-- ---------- LECTURA ----------
select lab.probar('alguien de afuera NO ve los posteos', lab.como('intruso@x.com'),
  'create temp table t1 as select * from public.posts', false);
select lab.probar('un aprobado SÍ ve los posteos', lab.como('juan@x.com'),
  'create temp table t2 as select * from public.posts', true);
select lab.probar('un observador también lee (ve todo, no escribe)', lab.como('obs@x.com'),
  'create temp table t3 as select * from public.posts', true);
select lab.probar('el admin fijo ve los posteos aunque su fila diga "member"', lab.como('benny@team-latam.com'),
  'create temp table t4 as select * from public.posts', true);
select lab.probar('alguien de afuera NO ve la lista del equipo', lab.como('intruso@x.com'),
  'create temp table t5 as select * from public.members where email <> ''intruso@x.com''', false);
select lab.probar('pero SÍ ve su propia ficha (así la app sabe si tiene acceso)', lab.como('juan@x.com'),
  'create temp table t6 as select * from public.members where email = ''juan@x.com''', true);
select lab.probar('nadie ve las preferencias de otro', lab.como('ana@x.com'),
  'create temp table t7 as select * from public.user_prefs where email = ''juan@x.com''', false);
select lab.probar('un aprobado común NO lee la auditoría', lab.como('juan@x.com'),
  'create temp table t8 as select * from public.audit_log', false);
select lab.probar('un admin por rol SÍ lee la auditoría', lab.como('ana@x.com'),
  'create temp table t9 as select * from public.audit_log', true);
select lab.probar('los ex integrantes los lee cualquier aprobado', lab.como('juan@x.com'),
  'create temp table t10 as select * from public.former_members', true);

-- ---------- LA SESIÓN ----------
select lab.probar('sin haber entrado con Google, nada', lab.como('juan@x.com', 'email'),
  'create temp table t11 as select * from public.posts', false);
select lab.probar('con el correo sin verificar, nada', lab.como('juan@x.com', 'google', false),
  'create temp table t12 as select * from public.posts', false);

-- ---------- CREAR POSTEOS ----------
select lab.probar('un aprobado crea un posteo firmado con su correo', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('nuevo1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com')$q$, true);
select lab.probar('NADIE firma un posteo con el correo de otro', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('nuevo2','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Ana','ana@x.com')$q$, false);
select lab.probar('un observador NO crea posteos', lab.como('obs@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('nuevo3','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Obs','obs@x.com')$q$, false);
select lab.probar('alguien de afuera NO crea posteos', lab.como('intruso@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('nuevo4','T','C','2026-09-10','2026-09-10','2026-09-10','evento','X','intruso@x.com')$q$, false);
-- Nace sin me gusta (docs/AUDITORIA.md, R20): al editar ya no se podía
-- poner el de otro, pero al crear entraba cualquier lista.
select lab.probar('un posteo nuevo NO trae puestos los me gusta de otros', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,liked_by)
     values ('nuevo5','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com',array['ana@x.com','obs@x.com'])$q$, false);
select lab.probar('ni el propio (se pone después, de a uno)', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,liked_by)
     values ('nuevo6','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com',array['juan@x.com'])$q$, false);

-- ---------- EDITAR POSTEOS ----------
select lab.probar('un aprobado edita un EVENTO de otro (son del equipo)', lab.como('ana@x.com'),
  $q$update public.posts set content = 'editado' where id = 'p_evento'$q$, true);
select lab.probar('pero NO la RUTINA de otro', lab.como('ana@x.com'),
  $q$update public.posts set content = 'editado' where id = 'p_rutina'$q$, false);
select lab.probar('el autor SÍ edita su propia rutina', lab.como('juan@x.com'),
  $q$update public.posts set content = 'editado' where id = 'p_rutina'$q$, true);
select lab.probar('ni el admin fijo puede editar la rutina ajena', lab.como('benny@team-latam.com'),
  $q$update public.posts set content = 'editado' where id = 'p_rutina'$q$, false);
select lab.probar('un observador NO edita nada', lab.como('obs@x.com'),
  $q$update public.posts set content = 'editado' where id = 'p_evento'$q$, false);
update public.posts set editors = array['ana@x.com'] where id = 'p_rutina';
select lab.probar('una rutina la edita también quien su autor sumó como editor', lab.como('ana@x.com'),
  $q$update public.posts set content = 'editado por la editora' where id = 'p_rutina'$q$, true);
update public.posts set editors = '{}' where id = 'p_rutina';

-- ---------- CANCELAR ----------
-- Editar está abierto a todo el equipo; cancelar, no: saca el evento del
-- Calendar de todos. Lo hace el autor, un participante, un editor o un
-- admin. (Juan es integrante común; Ana, admin por rol.)
select lab.probar('cancelar el evento de otro, sin ser participante ni editor, NO', lab.como('juan@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_de_ana'$q$, false);
select lab.probar('pero editarlo SÍ (es del equipo)', lab.como('juan@x.com'),
  $q$update public.posts set content = 'editado' where id = 'p_de_ana'$q$, true);
select lab.probar('el autor SÍ cancela el suyo', lab.como('juan@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_evento'$q$, true);
select lab.probar('un admin por rol cancela el de otro', lab.como('ana@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_evento'$q$, true);
select lab.probar('el admin fijo también', lab.como('benny@team-latam.com'),
  $q$update public.posts set cancelled = true where id = 'p_evento'$q$, true);
update public.posts set participants = '[{"email":"juan@x.com","name":"Juan"}]' where id = 'p_de_ana';
select lab.probar('un participante del evento SÍ lo cancela', lab.como('juan@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_de_ana'$q$, true);
update public.posts set participants = '[]', editors = array['juan@x.com'] where id = 'p_de_ana';
select lab.probar('y un editor del evento también', lab.como('juan@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_de_ana'$q$, true);
update public.posts set editors = '{}' where id = 'p_de_ana';
select lab.probar('quién editó por última vez se guarda también por correo', lab.como('juan@x.com'),
  $q$update public.posts set content = 'editado', last_edited_by = 'Juan', last_edited_by_email = 'juan@x.com' where id = 'p_de_ana'$q$, true);
select lab.probar('NADIE cambia de quién es un posteo', lab.como('ana@x.com'),
  $q$update public.posts set author_email = 'ana@x.com' where id = 'p_evento'$q$, false);
select lab.probar('ni cuándo se creó', lab.como('benny@team-latam.com'),
  $q$update public.posts set created_at = now() - interval '1 year' where id = 'p_evento'$q$, false);

-- ---------- SUMARSE PARA CANCELAR (docs/AUDITORIA.md, R3) ----------
-- Hasta el 10/10/2026 un integrante se sumaba a sí mismo como editor o
-- participante de un evento ajeno (editarlo está abierto a todo el
-- equipo) y en la escritura siguiente lo cancelaba. Los editores los suma
-- quien maneja el posteo (autor, editor, admin); como participante nadie
-- se suma solo a un evento ajeno. (Pedro es integrante común, sin
-- posteos; p_de_ana es de Ana, admin por rol; p_evento es de Juan.)
select lab.probar('un integrante NO se suma como editor de un evento ajeno', lab.como('pedro@x.com'),
  $q$update public.posts set editors = array['pedro@x.com'] where id = 'p_de_ana'$q$, false);
select lab.probar('ni suma a otro como editor', lab.como('pedro@x.com'),
  $q$update public.posts set editors = array['juan@x.com'] where id = 'p_de_ana'$q$, false);
select lab.probar('ni se suma a sí mismo como participante', lab.como('pedro@x.com'),
  $q$update public.posts set participants = '[{"email":"pedro@x.com","name":"Pedro"}]' where id = 'p_de_ana'$q$, false);
select lab.probar('ni con el correo en otras mayúsculas', lab.como('pedro@x.com'),
  $q$update public.posts set participants = '[{"email":"Pedro@X.com","name":"Pedro"}]' where id = 'p_de_ana'$q$, false);
select lab.probar('sumarse y cancelar, en dos escrituras: NO', lab.como('pedro@x.com'),
  $q$update public.posts set editors = array['pedro@x.com'] where id = 'p_de_ana';
     update public.posts set cancelled = true where id = 'p_de_ana'$q$, false);
select lab.probar('pero SÍ carga a OTRO como participante (es editar un evento del equipo)', lab.como('pedro@x.com'),
  $q$update public.posts set participants = '[{"email":"juan@x.com","name":"Juan"}]' where id = 'p_de_ana'$q$, true);
select lab.probar('el autor SÍ suma un editor', lab.como('juan@x.com'),
  $q$update public.posts set editors = array['pedro@x.com'] where id = 'p_evento'$q$, true);
update public.posts set editors = array['pedro@x.com'] where id = 'p_evento';
select lab.probar('y ese editor cancela', lab.como('pedro@x.com'),
  $q$update public.posts set cancelled = true where id = 'p_evento'$q$, true);
select lab.probar('y suma otro editor', lab.como('pedro@x.com'),
  $q$update public.posts set editors = array['pedro@x.com','obs@x.com'] where id = 'p_evento'$q$, true);
select lab.probar('y se suma como participante', lab.como('pedro@x.com'),
  $q$update public.posts set participants = '[{"email":"pedro@x.com","name":"Pedro"}]' where id = 'p_evento'$q$, true);
update public.posts set editors = '{}' where id = 'p_evento';
select lab.probar('un admin por rol suma un editor a un evento ajeno', lab.como('ana@x.com'),
  $q$update public.posts set editors = array['pedro@x.com'] where id = 'p_evento'$q$, true);
select lab.probar('el admin fijo también', lab.como('benny@team-latam.com'),
  $q$update public.posts set editors = array['pedro@x.com'] where id = 'p_evento'$q$, true);
select lab.probar('y un admin se suma como participante donde quiera', lab.como('ana@x.com'),
  $q$update public.posts set participants = '[{"email":"ana@x.com","name":"Ana"}]' where id = 'p_evento'$q$, true);

-- ---------- ME GUSTA ----------
select lab.probar('un aprobado pone su me gusta', lab.como('juan@x.com'),
  $q$update public.posts set liked_by = liked_by || 'juan@x.com'::text where id = 'p_de_ana'$q$, true);
select lab.probar('y saca el suyo, que estaba puesto', lab.como('juan@x.com'),
  $q$update public.posts set liked_by = array_remove(liked_by, 'juan@x.com') where id = 'p_evento'$q$, true);
select lab.probar('NADIE saca el me gusta de otro', lab.como('juan@x.com'),
  $q$update public.posts set liked_by = array_remove(liked_by, 'ana@x.com') where id = 'p_evento'$q$, false);
select lab.probar('NADIE pone el me gusta de otro', lab.como('juan@x.com'),
  $q$update public.posts set liked_by = liked_by || 'ana@x.com'::text where id = 'p_de_ana'$q$, false);
select lab.probar('NADIE pisa la lista de me gusta entera', lab.como('juan@x.com'),
  $q$update public.posts set liked_by = array['juan@x.com','otro@x.com'] where id = 'p_de_ana'$q$, false);
select lab.probar('no se cuela un me gusta dentro de una edición', lab.como('juan@x.com'),
  $q$update public.posts set content='x', liked_by = liked_by || 'juan@x.com'::text where id = 'p_evento'$q$, false);
select lab.probar('un observador NO da me gusta', lab.como('obs@x.com'),
  $q$update public.posts set liked_by = liked_by || 'obs@x.com'::text where id = 'p_evento'$q$, false);

-- ---------- BORRAR POSTEOS ----------
select lab.probar('solo el admin fijo borra un posteo', lab.como('benny@team-latam.com'),
  $q$delete from public.posts where id = 'p_de_ana'$q$, true);
select lab.probar('un admin por rol NO borra posteos', lab.como('ana@x.com'),
  $q$delete from public.posts where id = 'p_evento'$q$, false);
select lab.probar('el autor tampoco borra el suyo (se cancela, no se borra)', lab.como('juan@x.com'),
  $q$delete from public.posts where id = 'p_evento'$q$, false);

-- ---------- COMENTARIOS ----------
select lab.probar('un aprobado comenta firmando con su correo', lab.como('ana@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r2','p_evento','hola','Ana','ana@x.com')$q$, true);
select lab.probar('NADIE comenta firmando como otro', lab.como('ana@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r3','p_evento','hola','Juan','juan@x.com')$q$, false);
select lab.probar('un comentario NO se edita', lab.como('juan@x.com'),
  $q$update public.replies set content = 'cambiado' where id = 'r1'$q$, false);
select lab.probar('pero el me gusta de un comentario sí', lab.como('ana@x.com'),
  $q$update public.replies set liked_by = liked_by || 'ana@x.com'::text where id = 'r1'$q$, true);
select lab.probar('y no el de otro', lab.como('ana@x.com'),
  $q$update public.replies set liked_by = liked_by || 'juan@x.com'::text where id = 'r1'$q$, false);

-- ---------- MENSAJES DE SISTEMA (docs/AUDITORIA.md, R20) ----------
-- «✏️ editó…», «🚫 canceló…», «📅 Google Calendar»: la constancia de algo que
-- quien lo escribe acaba de hacer sobre el posteo (la app lo escribe
-- siempre después de editarlo). Solo lo escribe quien puede editar ese
-- posteo: hasta el 10/10/2026 cualquiera podía hacerlo, con la firma
-- «Google Calendar», en la Rutina de otra persona. (p_rutina es de Juan;
-- Pedro es integrante común, Ana admin por rol.)
select lab.probar('un integrante NO escribe un mensaje de sistema «Google Calendar» en la Rutina de otra persona', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s1','p_rutina','Se actualizó desde Google Calendar: título','Google Calendar',null,true,'📅')$q$, false);
select lab.probar('ni uno firmado con su nombre', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s2','p_rutina','✏️ Pedro editó la rutina','Pedro','pedro@x.com',true,'✏️')$q$, false);
select lab.probar('ni un admin por rol (no puede editar la Rutina de otro)', lab.como('ana@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s3','p_rutina','📅','Google Calendar',null,true,'📅')$q$, false);
select lab.probar('ni el admin fijo (tampoco la edita)', lab.como('benny@team-latam.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s4','p_rutina','📅','Google Calendar',null,true,'📅')$q$, false);
select lab.probar('el autor de la Rutina sí (lo escribe al editarla)', lab.como('juan@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s5','p_rutina','✏️ Juan editó la rutina','Juan','juan@x.com',true,'✏️')$q$, true);
select lab.probar('con la firma de Calendar también', lab.como('juan@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s6','p_rutina','📅','Google Calendar',null,true,'📅')$q$, true);
update public.posts set editors = array['pedro@x.com'] where id = 'p_rutina';
select lab.probar('un editor de la Rutina que su autor sumó, sí', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s7','p_rutina','✏️ Pedro editó la rutina','Pedro','pedro@x.com',true,'✏️')$q$, true);
update public.posts set editors = '{}' where id = 'p_rutina';
select lab.probar('en un EVENTO de otro (lo puede editar todo el equipo), sí: «canceló»', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s8','p_evento','🚫 Pedro canceló este evento.','Pedro','pedro@x.com',true,'🚫')$q$, true);
select lab.probar('y el de Calendar, sin correo', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s9','p_evento','Este evento se canceló directamente en Google Calendar.','Google Calendar',null,true,'📅')$q$, true);
select lab.probar('un comentario común en la Rutina de otra persona sigue abierto', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('s10','p_rutina','Me gusta la rutina','Pedro','pedro@x.com')$q$, true);
select lab.probar('un observador no escribe ni un mensaje de sistema', lab.como('obs@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s11','p_evento','📅','Google Calendar',null,true,'📅')$q$, false);
select lab.probar('uno de sistema en un posteo que no existe, no', lab.como('pedro@x.com'),
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon)
     values ('s12','no_existe','📅','Google Calendar',null,true,'📅')$q$, false);

-- ---------- EL EQUIPO ----------
select lab.probar('cada uno cambia su propio @nickname', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'juancito' where email = 'juan@x.com'$q$, true);
select lab.probar('pero NO su propio rol', lab.como('juan@x.com'),
  $q$update public.members set role = 'admin' where email = 'juan@x.com'$q$, false);
select lab.probar('ni el @nickname de otro', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'robado' where email = 'ana@x.com'$q$, false);
select lab.probar('un admin por rol cambia el rol de otro', lab.como('ana@x.com'),
  $q$update public.members set role = 'observer' where email = 'juan@x.com'$q$, true);
select lab.probar('pero NO el suyo propio', lab.como('ana@x.com'),
  $q$update public.members set role = 'member' where email = 'ana@x.com'$q$, false);
select lab.probar('y NO toca la ficha del admin fijo', lab.como('ana@x.com'),
  $q$update public.members set role = 'observer' where email = 'benny@team-latam.com'$q$, false);
select lab.probar('ni lo saca del equipo', lab.como('ana@x.com'),
  $q$delete from public.members where email = 'benny@team-latam.com'$q$, false);
select lab.probar('un admin por rol tampoco se saca a sí mismo', lab.como('ana@x.com'),
  $q$delete from public.members where email = 'ana@x.com'$q$, false);
select lab.probar('un admin por rol sí da de alta a alguien', lab.como('ana@x.com'),
  $q$insert into public.members(email,name,nickname) values ('nuevo@x.com','Nuevo','nuevo')$q$, true);
select lab.probar('el correo de una persona NUNCA cambia', lab.como('benny@team-latam.com'),
  $q$update public.members set email = 'otro@x.com' where email = 'juan@x.com'$q$, false);
select lab.probar('un aprobado común no da de alta a nadie', lab.como('juan@x.com'),
  $q$insert into public.members(email,name,nickname) values ('colado@x.com','Colado','colado')$q$, false);

-- ---------- SOLICITUDES DE ACCESO ----------
select lab.probar('alguien de afuera pide acceso para sí mismo', lab.como('nuevo2@x.com'),
  $q$insert into public.access_requests(email,name) values ('nuevo2@x.com','Nuevo Dos')$q$, true);
select lab.probar('pero NO a nombre de otro', lab.como('nuevo2@x.com'),
  $q$insert into public.access_requests(email,name) values ('ajeno@x.com','Ajeno')$q$, false);
select lab.probar('ni se aprueba solo', lab.como('nuevo2@x.com'),
  $q$insert into public.access_requests(email,name,status) values ('nuevo2@x.com','N','approved')$q$, false);
-- Rechazado: volver a pedir, una vez por hora como mucho (AUDITORIA B6).
select lab.probar('un rechazado recién no vuelve a pedir enseguida', lab.como('rech@x.com'),
  $q$set local role postgres; insert into public.access_requests(email,name,status) values ('rech@x.com','Rech','rejected'); set local role authenticated;
     update public.access_requests set status = 'pending' where email = 'rech@x.com'$q$, false);
select lab.probar('un rechazado hace más de una hora sí vuelve a pedir', lab.como('rech2@x.com'),
  $q$set local role postgres; insert into public.access_requests(email,name,status) values ('rech2@x.com','Rech','rejected');
     alter table public.access_requests disable trigger user;
     update public.access_requests set requested_at = now() - interval '2 hours' where email = 'rech2@x.com';
     alter table public.access_requests enable trigger user; set local role authenticated;
     update public.access_requests set status = 'pending' where email = 'rech2@x.com'$q$, true);
select lab.probar('un admin sí lo devuelve a la cola cuando quiera', lab.como('ana@x.com'),
  $q$set local role postgres; insert into public.access_requests(email,name,status) values ('rech3@x.com','Rech','rejected'); set local role authenticated;
     update public.access_requests set status = 'pending' where email = 'rech3@x.com'$q$, true);
-- Al quitarle el acceso a alguien, un admin borra sus preferencias.
select lab.probar('un admin borra las preferencias de alguien', lab.como('ana@x.com'),
  $q$select public.olvidar_preferencias('juan@x.com');
     delete from public.access_requests where false; update public.members set name = name where email = 'juan@x.com' and not exists (select 1 from public.user_prefs where email = 'juan@x.com')$q$, true);
select lab.probar('un integrante no borra las de otro', lab.como('juan@x.com'),
  $q$set local role postgres; insert into public.user_prefs(email, prefs) values ('obs@x.com', '{}') on conflict do nothing; set local role authenticated;
     select public.olvidar_preferencias('obs@x.com')$q$, false);
select lab.probar('un aprobado común NO ve la cola de solicitudes', lab.como('juan@x.com'),
  'create temp table t20 as select * from public.access_requests', false);

-- ---------- AUDITORÍA ----------
select lab.probar('cualquiera registra SU login', lab.como('quien@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('quien@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login','quien@x.com','Quien')$q$, true);
select lab.probar('NADIE registra el login de otro', lab.como('quien@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('juan@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login','juan@x.com','Juan')$q$, false);
select lab.probar('un no admin NO inventa un "acceso aprobado"', lab.como('quien@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name,target_email)
     values ('a4','access_approved','quien@x.com','Quien','juan@x.com')$q$, false);
select lab.probar('un admin por rol sí lo registra', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name,target_email)
     values ('a5','access_approved','ana@x.com','Ana','juan@x.com')$q$, true);
select lab.probar('la auditoría NO se edita, ni por el admin fijo', lab.como('benny@team-latam.com'),
  $q$update public.audit_log set detail = 'cambiado' where id = 'a1'$q$, false);
select lab.probar('ni se borra', lab.como('benny@team-latam.com'),
  $q$delete from public.audit_log where id = 'a1'$q$, false);

-- ---------- CONFIGURACIÓN ----------
select lab.probar('cualquiera que escribe deja el estado de la sincronización', lab.como('juan@x.com'),
  $q$update public.app_config set value = '{"syncToken":"x"}' where key = 'calendarSync'$q$, true);
-- Con la forma que guarda la app (al menos una zona, con nombre y color):
-- lo que se prueba acá es QUIÉN, la forma se prueba en 92-validacion.sql.
select lab.probar('pero NO cambia las zonas del equipo', lab.como('juan@x.com'),
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb"}},"countryZones":{"Argentina":"sur"}}' where key = 'territoryConfig'$q$, false);
select lab.probar('un admin por rol sí cambia las zonas', lab.como('ana@x.com'),
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb"}},"countryZones":{"Argentina":"sur"}}' where key = 'territoryConfig'$q$, true);
select lab.probar('un observador NO toca la sincronización', lab.como('obs@x.com'),
  $q$update public.app_config set value = '{"syncToken":"y"}' where key = 'calendarSync'$q$, false);

-- ---------- PREFERENCIAS ----------
select lab.probar('cada uno guarda las suyas', lab.como('juan@x.com'),
  $q$update public.user_prefs set prefs = '{"weekStart":0}' where email = 'juan@x.com'$q$, true);
select lab.probar('y NO las de otro', lab.como('ana@x.com'),
  $q$update public.user_prefs set prefs = '{"weekStart":6}' where email = 'juan@x.com'$q$, false);
select lab.probar('alguien de afuera NO se crea preferencias', lab.como('intruso@x.com'),
  $q$insert into public.user_prefs(email,prefs) values ('intruso@x.com','{}')$q$, false);

-- ---------- EL CORREO TIENE QUE SER EL DE SU GOOGLE ----------
-- Alguien que entró con su propio Google y se cambió el correo de la cuenta
-- de Supabase por el de otra persona (posible si el panel tuviera apagado
-- «Confirm email»). Su token dice que es esa persona, con email_verified en
-- true y todo; lo que Google autenticó es otra cuenta.
select lab.probar('quien se puso el correo de una integrante NO ve los posteos',
  lab.como_suplantando('juan@x.com', 'atacante@gmail.com'),
  $q$select 1 from public.posts$q$, false);
select lab.probar('ni publica en su nombre', lab.como_suplantando('juan@x.com', 'atacante@gmail.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('falso','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com')$q$, false);
select lab.probar('ni con el correo del admin fijo borra nada',
  lab.como_suplantando('benny@team-latam.com', 'atacante@gmail.com'),
  $q$delete from public.posts where id = 'p_evento'$q$, false);
select lab.probar('ni con el de una admin por rol aprueba a nadie',
  lab.como_suplantando('ana@x.com', 'atacante@gmail.com'),
  $q$insert into public.members(email, name) values ('atacante@gmail.com', 'Yo')$q$, false);
select lab.probar('y la integrante de verdad, con su Google, sigue entrando', lab.como('juan@x.com'),
  $q$select 1 from public.posts$q$, true);

-- ---------- UNA ENTRADA DE LOGIN POR DÍA ----------
-- La app anota correo_tipo_fecha; el segundo del día choca con ese id.
select lab.probar('alguien de afuera anota su login, con el id que arma la app', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'I')$q$, true);
select lab.probar('con la fecha de su huso horario (ayer o mañana en UTC) también', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char((now() at time zone 'utc')::date - 1, 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'I')$q$, true);
select lab.probar('pero un id inventado NO se guarda', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name) values ('l2','login','intruso@x.com','I')$q$, false);
select lab.probar('ni uno con la fecha de otro mes', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char((now() at time zone 'utc')::date - 30, 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'I')$q$, false);
select lab.probar('ni el mismo dos veces', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'I');
     insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'I')$q$, false);
select lab.probar('lo que registra un admin no tiene ese límite', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email) values ('t1','role_changed','ana@x.com','Ana','juan@x.com');
     insert into public.audit_log(id, type, actor_email, actor_name, target_email) values ('t2','role_changed','ana@x.com','Ana','obs@x.com')$q$, true);

-- ---------- LO QUE CADA UNO HACE CON LOS POSTEOS ----------
-- Quién cargó, editó, canceló o borró un posteo lo anota solo la base
-- (ver 97-registro-de-posteos.sql): a mano no lo escribe nadie.
select lab.probar('un integrante NO anota a mano que cargó un posteo', lab.como('juan@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc1','post_created','juan@x.com','Juan','«Evento de Juan»')$q$, false);
select lab.probar('ni que lo editó o lo borró', lab.como('juan@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc2','post_edited','juan@x.com','Juan','«Evento de Juan»');
     insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc3','post_deleted','juan@x.com','Juan','«Evento de Juan»')$q$, false);
select lab.probar('un observador tampoco', lab.como('obs@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name) values ('pc6','post_created','obs@x.com','Obs')$q$, false);
select lab.probar('alguien de afuera tampoco', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name) values ('pc7','post_created','intruso@x.com','I')$q$, false);
select lab.probar('y un tipo inventado no entra ni para el admin', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name) values ('pc8','post_liked','ana@x.com','Ana')$q$, false);


-- ---------- TEXTO LIBRE EN LA AUDITORÍA (docs/AUDITORIA.md, R20) ----------
-- Alguien de afuera (o un integrante) puede anotar su login y su pedido de
-- acceso, y hasta el 10/10/2026 escribía a gusto en `detail`: lo que lee el
-- admin en Actividad. Sin ser admin, `detail` va vacío salvo el texto que
-- la app manda de verdad al volver a pedir acceso tras un rechazo
-- (index.html, requestAccessAgain), en sus cuatro idiomas. Si ese texto
-- cambia en la app, hay que cambiarlo en audit_crear (02-politicas.sql).
-- El nombre y el navegador ya tienen tope (audit_textos): 120 y 60.
select lab.probar('el primer pedido de acceso, sin texto (como lo manda la app)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso', 'Chrome · Windows')$q$, true);
select lab.probar('el pedido de nuevo tras un rechazo, en español', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail, device)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'pidió de nuevo tras un rechazo', 'Chrome · Windows')$q$, true);
select lab.probar('en inglés', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail, device)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'requested again after a rejection', 'Safari · iOS')$q$, true);
select lab.probar('en portugués', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail, device)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'pediu de novo após uma rejeição', 'Firefox · Linux')$q$, true);
select lab.probar('y en hebreo (con el navegador en hebreo)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail, device)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'ביקש/ה שוב אחרי דחייה', 'דפדפן · Android')$q$, true);
select lab.probar('un texto inventado en el pedido de acceso, NO', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'Benny aprobó este acceso por teléfono')$q$, false);
select lab.probar('ni el texto de verdad con una palabra de más', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso',
             'pidió de nuevo tras un rechazo y es urgente')$q$, false);
select lab.probar('un login no lleva texto, ni el de verdad', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'Intruso',
             'pidió de nuevo tras un rechazo')$q$, false);
-- Y sin ser admin, solo esos dos tipos: los de administración (aprobar,
-- rechazar, revocar, cambiar un rol, compartir el Calendar) los anota un
-- admin desde su panel, a nombre propio, sobre otra persona.
select lab.probar(q.quien || ' · NO anota «' || t || '» (es de administración)', lab.como(q.quien),
       format($f$insert into public.audit_log(id, type, actor_email, actor_name, target_email)
                 values ('x_%s', %L, %L, 'X', 'pedro@x.com')$f$, t, t, q.quien), false)
  from unnest(array['access_approved', 'access_rejected', 'access_revoked', 'role_changed', 'calendar_shared', 'calendar_unshared']) t,
       (values ('juan@x.com'), ('intruso@x.com'), ('obs@x.com')) q(quien);
select lab.probar('ni un pedido de acceso «sobre» otra persona (con target_email)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email)
     values ('intruso@x.com_access_requested_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'access_requested', 'intruso@x.com', 'Intruso', 'juan@x.com')$q$, false);
select lab.probar('un login común, sin texto, sigue entrando', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'Intruso', 'Edge · Windows')$q$, true);
select lab.probar('un integrante tampoco escribe texto libre en su login', lab.como('juan@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail)
     values ('juan@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'juan@x.com', 'Juan', '<img src=x onerror=alert(1)>')$q$, false);
select lab.probar('un observador anota su login como todos', lab.como('obs@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('obs@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'obs@x.com', 'Obs', 'Chrome · Mac')$q$, true);
select lab.probar('un navegador de 5.000 caracteres, NO', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'Intruso', repeat('x', 5000))$q$, false);
select lab.probar('ni uno de 61 (el tope es 60)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, device)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', 'Intruso', repeat('x', 61))$q$, false);
select lab.probar('un nombre de 5.000 caracteres, NO', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', repeat('N', 5000))$q$, false);
select lab.probar('ni uno de 121 (el tope es 120, el de una ficha)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', repeat('N', 121))$q$, false);
select lab.probar('uno de 120 sí (una ficha lo permite)', lab.como('intruso@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name)
     values ('intruso@x.com_login_' || to_char(now() at time zone 'utc', 'YYYY-MM-DD'), 'login', 'intruso@x.com', repeat('N', 120))$q$, true);
select lab.probar('un admin sí lleva el rol en el texto (así lo manda la app)', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email, detail)
     values ('r1x','role_changed','ana@x.com','Ana','juan@x.com','observer')$q$, true);
select lab.probar('y «por adelantado» al aprobar a alguien antes de que pida', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email, detail)
     values ('r2x','access_approved','ana@x.com','Ana','nuevo@x.com','por adelantado')$q$, true);


-- ---------- A qué carpeta del bucket se sube (docs/AUDITORIA.md, I6) ----------
-- En Supabase `authenticated` puede insertar en storage.objects (lo que
-- filtra es la política); el permiso lo da el laboratorio
-- (00-laboratorio.sql), como el de leer.
select lab.probar('subir a posts/<id>/ se puede', lab.como('juan@x.com'),
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/abc/img0_1.jpg')$q$, true);
select lab.probar('y a replies/<id>/ también', lab.como('juan@x.com'),
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'replies/abc/img0_1.jpg')$q$, true);
select lab.probar('a la papelera NO', lab.como('juan@x.com'),
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'papelera/2026-01-01/x.jpg')$q$, false);
select lab.probar('a la raíz NO', lab.como('juan@x.com'),
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'suelto.jpg')$q$, false);
select lab.probar('ni el admin fijo a otra carpeta', lab.como('benny@team-latam.com'),
  $q$insert into storage.objects(bucket_id, name) values ('adjuntos', 'otra/x.jpg')$q$, false);

-- ---------- Y qué se puede leer, o sea pedir la firma de (docs/AUDITORIA.md, R20) ----------
-- Solo lo que la app nombra. La papelera (lo que apartó la limpieza
-- semanal) la ve solo la llave de servicio.
delete from storage.objects;
insert into storage.objects(bucket_id, name) values
  ('adjuntos', 'posts/p_evento/foto.jpg'), ('adjuntos', 'replies/r1/doc.pdf'),
  ('adjuntos', 'papelera/2026-10-04/posts/viejo/foto.jpg'), ('adjuntos', 'suelto.jpg');
select lab.probar('un aprobado lee posts/…', lab.como('juan@x.com'),
  $q$create temp table s1 as select * from storage.objects where name like 'posts/%'$q$, true);
select lab.probar('y replies/…', lab.como('juan@x.com'),
  $q$create temp table s2 as select * from storage.objects where name like 'replies/%'$q$, true);
select lab.probar('un observador también (ve todo, no escribe)', lab.como('obs@x.com'),
  $q$create temp table s3 as select * from storage.objects where name like 'posts/%'$q$, true);
select lab.probar('pero la papelera NO', lab.como('juan@x.com'),
  $q$create temp table s4 as select * from storage.objects where name like 'papelera/%'$q$, false);
select lab.probar('ni lo suelto en la raíz', lab.como('juan@x.com'),
  $q$create temp table s5 as select * from storage.objects where name = 'suelto.jpg'$q$, false);
select lab.probar('ni el admin fijo la papelera (es de la limpieza)', lab.como('benny@team-latam.com'),
  $q$create temp table s6 as select * from storage.objects where name like 'papelera/%'$q$, false);
select lab.probar('alguien de afuera no lee nada', lab.como('intruso@x.com'),
  $q$create temp table s7 as select * from storage.objects where name like 'posts/%'$q$, false);
-- Otro bucket (el esquema solo habla de `adjuntos`): ni se lee ni se sube.
insert into storage.buckets(id, name) values ('otro', 'otro') on conflict do nothing;
insert into storage.objects(bucket_id, name) values ('otro', 'posts/p_evento/foto.jpg');
select lab.probar('un archivo de OTRO bucket, aunque se llame posts/…, no se lee', lab.como('juan@x.com'),
  $q$create temp table s8 as select * from storage.objects where bucket_id = 'otro'$q$, false);
select lab.probar('ni el admin fijo lo lee', lab.como('benny@team-latam.com'),
  $q$create temp table s9 as select * from storage.objects where bucket_id = 'otro'$q$, false);
select lab.probar('ni se sube a otro bucket', lab.como('benny@team-latam.com'),
  $q$insert into storage.objects(bucket_id, name) values ('otro', 'posts/abc/img0_1.jpg')$q$, false);
delete from storage.objects where bucket_id = 'otro';
delete from storage.buckets where id = 'otro';

-- ---------- Cambiar y borrar lo subido ----------
-- «Un archivo subido no se pisa» (02-politicas.sql): no hay política de
-- update, así que nadie lo cambia, ni renombra, ni el admin fijo. Borrar,
-- solo el admin fijo (y la llave de servicio, que es la limpieza semanal).
-- Las filas se ven (la política de leer las deja pasar): si el update o el
-- delete no tocan nada es por la falta de permiso, no por no encontrarlas.
select lab.probar('el control: un aprobado VE el archivo que sigue', lab.como('juan@x.com'),
  $q$create temp table s10 as select * from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, true);
select lab.probar('un aprobado NO cambia un archivo subido', lab.como('juan@x.com'),
  $q$update storage.objects set metadata = '{"size": 1}' where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni lo renombra', lab.como('juan@x.com'),
  $q$update storage.objects set name = 'posts/p_evento/otra.jpg' where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni un admin por rol', lab.como('ana@x.com'),
  $q$update storage.objects set name = 'posts/p_evento/otra.jpg' where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni el admin fijo (no hay política de cambiar)', lab.como('benny@team-latam.com'),
  $q$update storage.objects set name = 'posts/p_evento/otra.jpg' where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('un observador tampoco', lab.como('obs@x.com'),
  $q$update storage.objects set name = 'posts/p_evento/otra.jpg' where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('un aprobado NO borra un archivo', lab.como('juan@x.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni uno de replies/', lab.como('juan@x.com'),
  $q$delete from storage.objects where name = 'replies/r1/doc.pdf'$q$, false);
select lab.probar('ni un admin por rol', lab.como('ana@x.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni un observador', lab.como('obs@x.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('ni alguien de afuera', lab.como('intruso@x.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('el admin fijo sí borra un archivo', lab.como('benny@team-latam.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, true);
delete from storage.objects;

\set QUIET off
\echo ''
select n, case when esperado = obtenido then '  ok' else '  FALLA' end as r,
       case when esperado then 'permite' else 'deniega' end as esperaba, nombre, detalle
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
