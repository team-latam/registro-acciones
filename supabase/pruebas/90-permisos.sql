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
select lab.probar('NADIE cambia de quién es un posteo', lab.como('ana@x.com'),
  $q$update public.posts set author_email = 'ana@x.com' where id = 'p_evento'$q$, false);
select lab.probar('ni cuándo se creó', lab.como('benny@team-latam.com'),
  $q$update public.posts set created_at = now() - interval '1 year' where id = 'p_evento'$q$, false);

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
select lab.probar('un aprobado común NO ve la cola de solicitudes', lab.como('juan@x.com'),
  'create temp table t20 as select * from public.access_requests', false);

-- ---------- AUDITORÍA ----------
select lab.probar('cualquiera registra SU login', lab.como('quien@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('a2','login','quien@x.com','Quien')$q$, true);
select lab.probar('NADIE registra el login de otro', lab.como('quien@x.com'),
  $q$insert into public.audit_log(id,type,actor_email,actor_name) values ('a3','login','juan@x.com','Juan')$q$, false);
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
select lab.probar('pero NO cambia las zonas del equipo', lab.como('juan@x.com'),
  $q$update public.app_config set value = '{"zones":{}}' where key = 'territoryConfig'$q$, false);
select lab.probar('un admin por rol sí cambia las zonas', lab.como('ana@x.com'),
  $q$update public.app_config set value = '{"zones":{}}' where key = 'territoryConfig'$q$, true);
select lab.probar('un observador NO toca la sincronización', lab.como('obs@x.com'),
  $q$update public.app_config set value = '{"syncToken":"y"}' where key = 'calendarSync'$q$, false);

-- ---------- PREFERENCIAS ----------
select lab.probar('cada uno guarda las suyas', lab.como('juan@x.com'),
  $q$update public.user_prefs set prefs = '{"weekStart":0}' where email = 'juan@x.com'$q$, true);
select lab.probar('y NO las de otro', lab.como('ana@x.com'),
  $q$update public.user_prefs set prefs = '{"weekStart":6}' where email = 'juan@x.com'$q$, false);
select lab.probar('alguien de afuera NO se crea preferencias', lab.como('intruso@x.com'),
  $q$insert into public.user_prefs(email,prefs) values ('intruso@x.com','{}')$q$, false);

\set QUIET off
\echo ''
select n, case when esperado = obtenido then '  ok' else '  FALLA' end as r,
       case when esperado then 'permite' else 'deniega' end as esperaba, nombre, detalle
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
