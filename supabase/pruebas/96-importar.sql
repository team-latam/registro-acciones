\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('ana@x.com','Ana','ana','admin'),
  ('juan@x.com','Juan','juan','member');

-- Un posteo como los que vienen de Firebase: viejo, de otra persona, con
-- su fecha de creación real.
create or replace function lab.posteo_viejo() returns jsonb language sql immutable as $f$
  select '[{"id":"p_viejo","title":"De 2019","content":"C","date":"2019-03-05",
             "start_date":"2019-03-05","end_date":"2019-03-05","activity_type":"evento",
             "author_name":"Alguien","author_email":"alguien@x.com",
             "created_at":"2019-03-05T10:00:00Z","last_edited_at":"2019-04-01T10:00:00Z"}]'::jsonb
$f$;
grant execute on function lab.posteo_viejo() to authenticated;

select lab.probar_valor('el admin importa un posteo viejo', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select title from public.posts where id='p_viejo'$q$, 'De 2019');
select lab.probar_valor('y le CONSERVA la fecha real de creación', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select to_char(created_at at time zone 'UTC','YYYY-MM-DD') from public.posts where id='p_viejo'$q$, '2019-03-05');
select lab.probar_valor('y también la de edición', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select to_char(last_edited_at at time zone 'UTC','YYYY-MM-DD') from public.posts where id='p_viejo'$q$, '2019-04-01');
select lab.probar_valor('y de quién era, aunque esa persona ya no esté', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select author_email from public.posts where id='p_viejo'$q$, 'alguien@x.com');
select lab.probar_valor('correrla dos veces no duplica nada', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo()); select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select count(*)::text from public.posts where id='p_viejo'$q$, '1');
select lab.probar_valor('y devuelve cuántas entraron de verdad la segunda vez', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select public.importar('posts', lab.posteo_viejo())::text$q$, '0');

-- Lo que NO puede pasar
select lab.probar_valor('un admin POR ROL no puede importar', lab.como('ana@x.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select count(*)::text from public.posts$q$, 'Solo el administrador puede importar');
select lab.probar_valor('un integrante común, menos', lab.como('juan@x.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select count(*)::text from public.posts$q$, 'Solo el administrador puede importar');
select lab.probar_valor('alguien de afuera, tampoco', lab.como('intruso@x.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select count(*)::text from public.posts$q$, 'Solo el administrador puede importar');
select lab.probar_valor('ni con una sesión que no entró por Google', lab.como('benny@team-latam.com','email'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select count(*)::text from public.posts$q$, 'Solo el administrador puede importar');
select lab.probar_valor('una tabla inventada se rechaza (el nombre entra en una consulta)', lab.como('benny@team-latam.com'),
  $q$select public.importar('pg_shadow', '[]'::jsonb)$q$,
  $q$select count(*)::text from public.posts$q$, 'No existe la tabla pg_shadow');
select lab.probar_valor('y algo que no sea una lista de filas, igual', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', '{"no":"soy una lista"}'::jsonb)$q$,
  $q$select count(*)::text from public.posts$q$, 'Se esperaba una lista de filas');

-- Y lo más importante: que la marca NO quede prendida después
select lab.probar_valor('después de importar, la puerta se cierra sola', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo());
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,created_at)
     values ('p_nuevo','Nuevo','C','2026-09-10','2026-09-10','2026-09-10','evento','Benny','benny@team-latam.com','2001-01-01')$q$,
  $q$select case when created_at > now() - interval '1 minute' then 'la hora de la base' else 'la falsa' end
     from public.posts where id='p_nuevo'$q$, 'la hora de la base');
select lab.probar_valor('y tampoco deja firmar como otro después de importar', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo());
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p_falso','X','C','2026-09-10','2026-09-10','2026-09-10','evento','Otro','otro@x.com')$q$,
  $q$select count(*)::text from public.posts where id='p_falso'$q$,
  'new row violates row-level security policy for table "posts"');

select lab.probar_valor('y el conteo sirve para comprobar que está todo', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select filas::text from public.cuantas_filas() where tabla='posts'$q$, '1');

-- ============================================================
-- La importación FINAL: lo que viene de Firebase pisa lo que hay
-- ============================================================
-- El mismo posteo, editado en Firebase después de la primera importación:
-- otro título, otra fecha de fin, cancelado, con un «me gusta» y una foto.
create or replace function lab.posteo_editado() returns jsonb language sql immutable as $f$
  select '[{"id":"p_viejo","title":"De 2019, corregido","content":"C2","date":"2019-03-05",
             "start_date":"2019-03-05","end_date":"2019-03-06","activity_type":"evento",
             "author_name":"Alguien","author_email":"alguien@x.com","cancelled":true,
             "liked_by":["ana@x.com"],"images":["posts/p_viejo/img0_0123456789ab.jpg"],
             "created_at":"2019-03-05T10:00:00Z","last_edited_at":"2026-09-30T10:00:00Z"}]'::jsonb
$f$;
grant execute on function lab.posteo_editado() to authenticated;

select lab.probar_valor('sin reemplazar, lo que ya estaba se saltea, como siempre', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo()); select public.importar('posts', lab.posteo_editado())$q$,
  $q$select title from public.posts where id='p_viejo'$q$, 'De 2019');
select lab.probar_valor('reemplazando, lo editado en Firebase llega', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo()); select public.importar('posts', lab.posteo_editado(), true)$q$,
  $q$select title || ' / ' || end_date || ' / ' || cancelled || ' / ' || array_to_string(liked_by, ',') || ' / ' || array_to_string(images, ',')
     from public.posts where id='p_viejo'$q$,
  'De 2019, corregido / 2019-03-06 / true / ana@x.com / posts/p_viejo/img0_0123456789ab.jpg');
select lab.probar_valor('con sus fechas de Firebase, no con la hora de ahora', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo()); select public.importar('posts', lab.posteo_editado(), true)$q$,
  $q$select to_char(created_at at time zone 'UTC','YYYY-MM-DD') || ' / ' || to_char(last_edited_at at time zone 'UTC','YYYY-MM-DD')
     from public.posts where id='p_viejo'$q$, '2019-03-05 / 2026-09-30');
select lab.probar_valor('y cuenta la fila que cambió', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo())$q$,
  $q$select public.importar('posts', lab.posteo_editado(), true)::text$q$, '1');
select lab.probar_valor('una fila que vino igual no se reescribe ni se cuenta', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_editado(), true)$q$,
  $q$select public.importar('posts', lab.posteo_editado(), true)::text$q$, '0');
select lab.probar_valor('lo nuevo entra igual', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_editado(), true)$q$,
  $q$select title from public.posts where id='p_viejo'$q$, 'De 2019, corregido');
-- Lo que en Firebase ya no está en el documento, acá tampoco: la fila
-- queda como vino, no mezclada con la de antes.
select lab.probar_valor('un campo que el documento ya no trae vuelve a su valor de siempre', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_editado()); select public.importar('posts', lab.posteo_viejo(), true)$q$,
  $q$select cancelled || ' / ' || coalesce(array_length(liked_by, 1), 0) || ' / ' || coalesce(array_length(images, 1), 0)
     from public.posts where id='p_viejo'$q$, 'false / 0 / 0');
-- Los disparadores que en la app impiden cambiar de quién es un posteo se
-- hacen a un lado: lo que manda es Firebase.
select lab.probar_valor('reemplazar puede cambiar lo que desde la app no se puede (de quién es)', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo());
     select public.importar('posts', jsonb_set(lab.posteo_viejo(), '{0,author_email}', '"otra@x.com"'), true)$q$,
  $q$select author_email from public.posts where id='p_viejo'$q$, 'otra@x.com');
select lab.probar_valor('y después la puerta se cierra igual', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_viejo()); select public.importar('posts', lab.posteo_editado(), true);
     update public.posts set author_email = 'benny@team-latam.com' where id = 'p_viejo'$q$,
  $q$select author_email from public.posts where id='p_viejo'$q$, 'No se puede cambiar de quién es un posteo ni cuándo se creó');
select lab.probar_valor('reemplazar sirve para cualquier tabla: el rol de alguien', lab.como('benny@team-latam.com'),
  $q$select public.importar('members', '[{"email":"juan@x.com","name":"Juan","nickname":"juan","role":"observer"}]', true)$q$,
  $q$select role from public.members where email='juan@x.com'$q$, 'observer');
select lab.probar_valor('y la configuración', lab.como('benny@team-latam.com'),
  $q$select public.importar('app_config', '[{"key":"calendarSync","value":{"syncToken":"viejo"}}]');
     select public.importar('app_config', '[{"key":"calendarSync","value":{"syncToken":"de-firebase"}}]', true)$q$,
  $q$select value->>'syncToken' from public.app_config where key='calendarSync'$q$, 'de-firebase');
select lab.probar_valor('reemplazar tampoco lo puede un admin por rol', lab.como('ana@x.com'),
  $q$select public.importar('posts', lab.posteo_editado(), true)$q$,
  $q$select count(*)::text from public.posts$q$, 'Solo el administrador puede importar');

-- ============================================================
-- Sacar lo que ya no está en Firebase
-- ============================================================
create or replace function lab.dos_posteos() returns void language sql as $f$
  select public.importar('posts', '[
    {"id":"p_queda","title":"Queda","content":"C","date":"2026-09-10","start_date":"2026-09-10","end_date":"2026-09-10",
     "activity_type":"evento","author_name":"Ana","author_email":"ana@x.com"},
    {"id":"p_se_va","title":"Se va","content":"C","date":"2026-09-10","start_date":"2026-09-10","end_date":"2026-09-10",
     "activity_type":"evento","author_name":"Ana","author_email":"ana@x.com"}]');
  select public.importar('replies', '[
    {"id":"r_queda","post_id":"p_queda","content":"hola","author_name":"Juan","author_email":"juan@x.com"},
    {"id":"r_se_va","post_id":"p_se_va","content":"chau","author_name":"Juan","author_email":"juan@x.com"}]');
$f$;
grant execute on function lab.dos_posteos() to authenticated;

select lab.probar_valor('el admin saca los posteos que se le nombran', lab.como('benny@team-latam.com'),
  $q$select lab.dos_posteos(); select public.importar_quitar('posts', '["p_se_va"]')$q$,
  $q$select string_agg(id, ',' order by id) from public.posts where id like 'p\_%'$q$, 'p_queda');
select lab.probar_valor('y sus comentarios se van con ellos', lab.como('benny@team-latam.com'),
  $q$select lab.dos_posteos(); select public.importar_quitar('posts', '["p_se_va"]')$q$,
  $q$select string_agg(id, ',' order by id) from public.replies$q$, 'r_queda');
select lab.probar_valor('devuelve cuántas sacó', lab.como('benny@team-latam.com'),
  $q$select lab.dos_posteos()$q$,
  $q$select public.importar_quitar('posts', '["p_se_va","no_existe"]')::text$q$, '1');
select lab.probar_valor('una lista vacía no saca nada', lab.como('benny@team-latam.com'),
  $q$select lab.dos_posteos(); select public.importar_quitar('posts', '[]')$q$,
  $q$select count(*)::text from public.posts$q$, '2');
select lab.probar_valor('saca a alguien del equipo por su correo', lab.como('benny@team-latam.com'),
  $q$select public.importar_quitar('members', '["juan@x.com"]')$q$,
  $q$select string_agg(email, ',' order by email) from public.members$q$, 'ana@x.com,benny@team-latam.com');
select lab.probar_valor('el registro de auditoría no se toca nunca', lab.como('benny@team-latam.com'),
  $q$select public.importar_quitar('audit_log', '["a1"]')$q$,
  $q$select 'no debería llegar'$q$, 'De audit_log no se saca nada');
select lab.probar_valor('ni la configuración', lab.como('benny@team-latam.com'),
  $q$select public.importar_quitar('app_config', '["preferences"]')$q$,
  $q$select 'no debería llegar'$q$, 'De app_config no se saca nada');
select lab.probar_valor('ni las preferencias de cada uno (la copia trae solo las del admin)', lab.como('benny@team-latam.com'),
  $q$select public.importar_quitar('user_prefs', '["ana@x.com"]')$q$,
  $q$select 'no debería llegar'$q$, 'De user_prefs no se saca nada');
select lab.probar_valor('algo que no es una lista de claves se rechaza', lab.como('benny@team-latam.com'),
  $q$select public.importar_quitar('posts', '{"id":"p_se_va"}')$q$,
  $q$select 'no debería llegar'$q$, 'Se esperaba una lista de claves');
select lab.probar_valor('sacar no lo puede un admin por rol', lab.como('ana@x.com'),
  $q$select public.importar_quitar('members', '["juan@x.com"]')$q$,
  $q$select 'no debería llegar'$q$, 'Solo el administrador puede importar');
select lab.probar_valor('ni un integrante', lab.como('juan@x.com'),
  $q$select public.importar_quitar('posts', '["p_se_va"]')$q$,
  $q$select 'no debería llegar'$q$, 'Solo el administrador puede importar');
select lab.probar_valor('ni alguien de afuera', lab.como('intruso@x.com'),
  $q$select public.importar_quitar('posts', '["p_se_va"]')$q$,
  $q$select 'no debería llegar'$q$, 'Solo el administrador puede importar');

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
\set QUIET on
-- Un posteo de Firestore al que le faltan campos, que es lo normal: los
-- viejos no tienen `cancelled`, ni `images`, ni `liked_by`.
create or replace function lab.posteo_pelado() returns jsonb language sql immutable as $f$
  select '[{"id":"p_pelado","title":"Viejo pelado","content":"C","date":"2018-01-01",
             "start_date":"2018-01-01","end_date":"2018-01-01","activity_type":"rutina",
             "author_name":"Alguien","created_at":"2018-01-01T00:00:00Z"}]'::jsonb
$f$;
grant execute on function lab.posteo_pelado() to authenticated;
\set QUIET off
select lab.probar_valor('un posteo viejo SIN la mitad de los campos también entra', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_pelado())$q$,
  $q$select title from public.posts where id='p_pelado'$q$, 'Viejo pelado');
select lab.probar_valor('y los campos que no traía quedan como corresponde, no en blanco', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_pelado())$q$,
  $q$select cancelled::text || '/' || coalesce(array_length(images,1),0)::text
     from public.posts where id='p_pelado'$q$, 'false/0');
select lab.probar_valor('sin perder la fecha real que sí traía', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', lab.posteo_pelado())$q$,
  $q$select to_char(created_at at time zone 'UTC','YYYY-MM-DD') from public.posts where id='p_pelado'$q$, '2018-01-01');
select lab.probar_valor('una lista vacía no rompe nada', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', '[]'::jsonb)$q$,
  $q$select public.importar('posts','[]'::jsonb)::text$q$, '0');
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
\set QUIET on
\set QUIET off
-- Lo mismo, desde el otro lado: que una sesión sin correo válido no pueda
-- NADA, ni por la puerta de la importación ni por ninguna otra.
select lab.probar('una sesión sin Google no lee ni los posteos', lab.como('benny@team-latam.com','email'),
  'create temp table zz as select * from public.posts', false);
select lab.probar_valor('ni escribe uno', lab.como('benny@team-latam.com','email'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('z','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$,
  $q$select count(*)::text from public.posts$q$,
  'new row violates row-level security policy for table "posts"');
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
