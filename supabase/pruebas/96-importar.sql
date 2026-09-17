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
