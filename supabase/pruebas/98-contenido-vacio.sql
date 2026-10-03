\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny','benny','member');

\set YO 'lab.como(''benny@team-latam.com'')'

-- ============================================================
-- Un evento de Calendar sin descripción no tiene contenido
-- ============================================================
-- Antes el contenido tenía que medir al menos 1, así que un evento traído
-- de Calendar sin descripción se guardaba con un relleno: "Creado
-- automáticamente desde Google Calendar." Esa línea terminaba repetida en
-- media pantalla del Feed sin decir nada.

select lab.probar('un posteo con contenido vacío ahora entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('v1','Swimmers Online','','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com')$q$, true);
select lab.probar_valor('y queda vacío de verdad, no nulo', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('v2','T','','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com')$q$,
  $q$select coalesce(content,'(nulo)') from public.posts where id='v2'$q$, '');

-- ---------- Lo que NO cambió ----------
select lab.probar('un título vacío sigue sin entrar', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('v3','','C','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com')$q$, false);
select lab.probar('un contenido de más de 5000 sigue sin entrar', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('v4','T',repeat('a',5001),'2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com')$q$, false);
select lab.probar('un autor vacío tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('v5','T','C','2026-12-09','2026-12-09','2026-12-09','otro','','benny@team-latam.com')$q$, false);

-- Un comentario vacío NO: un comentario sin texto no es un comentario.
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('base','Para comentar','x','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com');
select lab.probar('un comentario vacío sigue sin entrar', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r1','base','','LatAm','benny@team-latam.com')$q$, false);

-- ============================================================
-- El relleno viejo se va de los que ya lo tienen
-- ============================================================
-- Estos entran como service_role (sin la sesión de nadie), que es como
-- corre la migración de verdad.
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email) values
 ('r_es','A','Creado automáticamente desde Google Calendar.','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_en','B','Automatically created from Google Calendar.','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_pt','C','Criado automaticamente a partir do Google Calendar.','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_he','D','.נוצר אוטומטית מ-Google Calendar','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_sp','E','  Creado automáticamente desde Google Calendar.  ','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_mas','F','Creado automáticamente desde Google Calendar. Además fuimos al puerto.','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com'),
 ('r_otro','G','Reunión con el equipo.','2026-12-09','2026-12-09','2026-12-09','otro','LatAm','benny@team-latam.com');

-- La misma sentencia que corre 09-contenido-vacio.sql.
update public.posts
   set content = ''
 where btrim(content) in (
   'Creado automáticamente desde Google Calendar.',
   'Automatically created from Google Calendar.',
   'Criado automaticamente a partir do Google Calendar.',
   '.נוצר אוטומטית מ-Google Calendar'
 );

insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'se limpia en los cuatro idiomas', true,
         count(*) filter (where content = '') = 4, 'limpios: ' || count(*) filter (where content = '')
  from public.posts where id in ('r_es','r_en','r_pt','r_he');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y con espacios alrededor también', true, content = '', 'dio: ' || content
  from public.posts where id = 'r_sp';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'pero NO le come el texto a quien escribió algo más', true,
         content = 'Creado automáticamente desde Google Calendar. Además fuimos al puerto.', 'dio: ' || content
  from public.posts where id = 'r_mas';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'ni toca un posteo que no tiene nada que ver', true,
         content = 'Reunión con el equipo.', 'dio: ' || content
  from public.posts where id = 'r_otro';

-- Correrla dos veces no cambia nada (la migración se aplica en cada push).
update public.posts set content = ''
 where btrim(content) in ('Creado automáticamente desde Google Calendar.',
   'Automatically created from Google Calendar.',
   'Criado automaticamente a partir do Google Calendar.',
   '.נוצר אוטומטית מ-Google Calendar');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'aplicarla de nuevo es inofensivo', true, count(*) = 5, 'vacíos: ' || count(*)
  from public.posts where content = '';

\set QUIET off
select n, '  FALLA  ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
