\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny','benny','member');
-- Un posteo de verdad, insertado ACÁ y no adentro de lab.probar: cada
-- prueba termina en excepción a propósito (así se sabe si dejó o no
-- dejó), y eso deshace lo que haya insertado. Los comentarios necesitan
-- un posteo que exista después, o fallan por la clave foránea y la
-- prueba mide otra cosa.
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('p1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Benny','benny@team-latam.com');

\set YO 'lab.como(''benny@team-latam.com'')'

-- ---------- Imágenes: el tope nuevo ----------
select lab.probar('veinte imágenes entran', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('i20','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select array_agg('posts/i20/f' || g || '.jpg') from generate_series(1,20) g))$q$, true);
select lab.probar('veintiuna NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('i21','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select array_agg('posts/i21/f' || g || '.jpg') from generate_series(1,21) g))$q$, false);
select lab.probar('y en un comentario, igual: veinte sí', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,images)
     values ('r20','p1','C','B','benny@team-latam.com',
       (select array_agg('replies/r20/f' || g || '.jpg') from generate_series(1,20) g))$q$, true);
select lab.probar('veintiuna en un comentario NO', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,images)
     values ('r21','p1','C','B','benny@team-latam.com',
       (select array_agg('replies/r21/f' || g || '.jpg') from generate_series(1,21) g))$q$, false);

-- ---------- Adjuntos: el tope nuevo ----------
select lab.probar('diez adjuntos entran', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,files)
     values ('a10','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('name','x'||g||'.pdf','path','posts/a10/x'||g||'.pdf'))
          from generate_series(1,10) g))$q$, true);
select lab.probar('once NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,files)
     values ('a11','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('name','x'||g||'.pdf','path','posts/a11/x'||g||'.pdf'))
          from generate_series(1,11) g))$q$, false);
select lab.probar('diez en un comentario sí', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,files)
     values ('ra10','p1','C','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('name','x'||g||'.pdf','path','replies/ra10/x'||g||'.pdf'))
          from generate_series(1,10) g))$q$, true);
select lab.probar('once en un comentario NO', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,files)
     values ('ra11','p1','C','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('name','x'||g||'.pdf','path','replies/ra11/x'||g||'.pdf'))
          from generate_series(1,11) g))$q$, false);

-- ---------- Lo que el tope más alto NO tiene que aflojar ----------
-- Soltar la cantidad no es soltar la forma: un archivo embebido sigue
-- siendo el problema que vinimos a resolver, y una ruta que se escapa de
-- su carpeta sigue siendo un intento de leer lo que no le toca.
select lab.probar('una imagen embebida sigue sin entrar', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('e1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['data:image/png;base64,iVBORw0KGgo='])$q$, false);
select lab.probar('un adjunto embebido tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,files)
     values ('e2','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             '[{"name":"a.pdf","path":"data:application/pdf;base64,JVBERi0="}]')$q$, false);
select lab.probar('una ruta que se escapa de su carpeta tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('e3','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['posts/../../otro/secreto.jpg'])$q$, false);
select lab.probar('ni un adjunto sin ruta', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,files)
     values ('e4','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             '[{"name":"a.pdf","path":""}]')$q$, false);
select lab.probar('ni una ruta de 500 caracteres', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('e5','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array[repeat('a',500)])$q$, false);
-- Y los topes de OTRAS listas no se movieron: subir el de adjuntos no
-- tenía por qué tocar los enlaces ni los alcances.
select lab.probar('once enlaces sigue siendo NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,links)
     values ('e6','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('label','x','url','http://x')) from generate_series(1,11)))$q$, false);
select lab.probar('dieciséis alcances tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,scopes)
     values ('e7','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('pais','AR')) from generate_series(1,16)))$q$, false);

-- ---------- El techo del bucket ----------
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'el bucket tiene techo propio de 25 MB', true,
         file_size_limit = 26214400, coalesce(file_size_limit::text, 'sin techo')
  from storage.buckets where id = 'adjuntos';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y una lista de tipos permitidos', true,
         allowed_mime_types is not null and array_length(allowed_mime_types, 1) > 0, ''
  from storage.buckets where id = 'adjuntos';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'con las imágenes y el PDF adentro', true,
         allowed_mime_types @> array['image/jpeg','image/png','application/pdf'], ''
  from storage.buckets where id = 'adjuntos';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y el audio, que antes ni se nombraba', true,
         allowed_mime_types @> array['audio/mpeg','audio/mp4','audio/ogg'], ''
  from storage.buckets where id = 'adjuntos';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'el video queda afuera a propósito (por la descarga, no por el lugar)', true,
         not (allowed_mime_types && array['video/mp4','video/quicktime','video/webm']), ''
  from storage.buckets where id = 'adjuntos';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y el bucket sigue siendo privado', true, public = false, ''
  from storage.buckets where id = 'adjuntos';

\set QUIET off
select n, '  FALLA  ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
