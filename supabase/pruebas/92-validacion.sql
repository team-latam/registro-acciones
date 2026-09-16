\set QUIET on
truncate lab.resultados;

-- Comprueba un VALOR, no solo si dejó o no dejó: hace el cambio, mira cómo
-- quedó, y lo deshace.
create or replace function lab.probar_valor(nombre text, quien jsonb, sentencia text, consulta text, espera text)
returns void language plpgsql as $$
declare obtenido text; ok boolean;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', quien::text, true);
    execute sentencia;
    execute consulta into obtenido;
    raise exception using errcode = '22000', message = 'VAL=' || coalesce(obtenido, '(nulo)');
  exception
    when sqlstate '22000' then
      if sqlerrm like 'VAL=%' then obtenido := replace(sqlerrm, 'VAL=', '');
      else obtenido := left(sqlerrm, 60); end if;
    when others then obtenido := left(sqlerrm, 60);
  end;
  execute 'reset role';
  ok := obtenido = espera;
  insert into lab.resultados(nombre, esperado, obtenido, detalle)
    values (nombre, true, ok, case when ok then '' else 'dio: ' || obtenido end);
end $$;

truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('juan@x.com','Juan','juan','member');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('p1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com');

\set YO 'lab.como(''benny@team-latam.com'')'
\set NUEVO 'insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email'

-- ---------- Largos y formatos ----------
select lab.probar('un posteo normal entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('ok1','Titulo','Contenido','2026-09-10','2026-09-10','2026-09-11','evento','Benny','benny@team-latam.com')$q$, true);
select lab.probar('un título de 200 caracteres NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x1',repeat('a',200),'C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, false);
select lab.probar('un contenido vacío tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x2','T','','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, false);
select lab.probar('un tipo con mayúsculas y espacios tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x3','T','C','2026-09-10','2026-09-10','2026-09-10','Evento Nuevo','B','benny@team-latam.com')$q$, false);
select lab.probar('un tipo nuevo inventado por el admin SÍ (no son una lista fija)', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('ok2','T','C','2026-09-10','2026-09-10','2026-09-10','capacitacion2','B','benny@team-latam.com')$q$, true);
select lab.probar('que termine antes de empezar, NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x4','T','C','2026-09-10','2026-09-10','2026-09-01','evento','B','benny@team-latam.com')$q$, false);

-- ---------- Imágenes y adjuntos: rutas, no archivos ----------
select lab.probar('una ruta del bucket entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('ok3','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['posts/ok3/foto1.jpg'])$q$, true);
select lab.probar('una imagen embebida en base64 NO (es el problema que vinimos a resolver)', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('x5','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['data:image/png;base64,iVBORw0KGgo='])$q$, false);
select lab.probar('una ruta que se escapa de su carpeta NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('x6','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['posts/../../otro/secreto.jpg'])$q$, false);
select lab.probar('siete imágenes NO (el tope es seis)', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('x7','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['a','b','c','d','e','f','g'])$q$, false);
select lab.probar('un adjunto embebido tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,files)
     values ('x8','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             '[{"name":"a.pdf","path":"data:application/pdf;base64,JVBERi0="}]')$q$, false);

-- ---------- Listas ----------
select lab.probar('once enlaces NO (el tope es diez)', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,links)
     values ('x9','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('label','x','url','http://x')) from generate_series(1,11)))$q$, false);
select lab.probar('un enlace de 3000 caracteres NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,links)
     values ('x10','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       jsonb_build_array(jsonb_build_object('label','x','url',repeat('u',3000))))$q$, false);
select lab.probar('dieciséis alcances NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,scopes)
     values ('x11','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
       (select jsonb_agg(jsonb_build_object('pais','AR')) from generate_series(1,16)))$q$, false);

-- ---------- Repetición ----------
select lab.probar('una serie con fechas corridas bien puestas entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,recurrence,recurrence_moves)
     values ('ok4','T','C','2026-09-07','2026-09-07','2026-09-07','evento','B','benny@team-latam.com',
       array['RRULE:FREQ=WEEKLY;BYDAY=MO'], '{"2026-09-07":"2026-09-09"}')$q$, true);
select lab.probar('una fecha corrida que no es una fecha, NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,recurrence_moves)
     values ('x12','T','C','2026-09-07','2026-09-07','2026-09-07','evento','B','benny@team-latam.com',
       '{"el lunes":"2026-09-09"}')$q$, false);
select lab.probar('una fecha suspendida que no es una fecha, tampoco', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,recurrence_skip)
     values ('x13','T','C','2026-09-07','2026-09-07','2026-09-07','evento','B','benny@team-latam.com',
       array['mañana'])$q$, false);

-- ---------- Comentarios ----------
select lab.probar('un comentario normal entra', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r1','p1','hola','Benny','benny@team-latam.com')$q$, true);
select lab.probar('uno de 4000 caracteres NO', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r2','p1',repeat('a',4000),'Benny','benny@team-latam.com')$q$, false);
select lab.probar('un comentario con una imagen embebida tampoco', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,images)
     values ('r3','p1','hola','Benny','benny@team-latam.com',array['data:image/png;base64,AAA='])$q$, false);

-- ---------- Auditoría ----------
select lab.probar('un tipo de auditoría inventado NO', :YO,
  $q$insert into public.audit_log(id,type,actor_email,actor_name)
     values ('z1','borro_todo','benny@team-latam.com','B')$q$, false);
select lab.probar('uno de los ocho conocidos, sí', :YO,
  $q$insert into public.audit_log(id,type,actor_email,actor_name)
     values ('z2','role_changed','benny@team-latam.com','B')$q$, true);

-- ---------- @nickname ----------
select lab.probar('cambiarse el @nickname a algo válido, sí', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'juan_2' where email = 'juan@x.com'$q$, true);
select lab.probar('con mayúsculas NO', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'Juan' where email = 'juan@x.com'$q$, false);
select lab.probar('con acentos tampoco (las menciones van en minúscula ASCII)', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'juanín' where email = 'juan@x.com'$q$, false);
select lab.probar('de un solo carácter tampoco', lab.como('juan@x.com'),
  $q$update public.members set nickname = 'j' where email = 'juan@x.com'$q$, false);
select lab.probar('pero el alta SÍ puede generar uno con acentos (sale del nombre real)', :YO,
  $q$insert into public.members(email,name,nickname) values ('maria@x.com','María','maría')$q$, true);

-- ---------- La hora la pone el servidor ----------
select lab.probar_valor('nadie se inventa cuándo se creó un posteo', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,created_at)
     values ('h1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com','2001-01-01')$q$,
  $q$select case when created_at > now() - interval '1 minute' then 'ahora' else 'la falsa' end
     from public.posts where id = 'h1'$q$, 'ahora');

\set QUIET off
\echo ''
select n, '  FALLA  ' || nombre || coalesce(nullif(' — ' || detalle, ' — '), '') as falla
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;

-- ---------- Pero la importación conserva la fecha REAL ----------
-- Sin esto, traer diez años de historia desde Firebase convertiría todo en
-- "hoy". Corre sin sesión de persona, que es como corre el importador.
\set QUIET on
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,created_at)
  values ('h2','Titulo viejo','C','2019-03-05','2019-03-05','2019-03-05','evento','Alguien','viejo@x.com','2019-03-05 10:00+00');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'la importación conserva la fecha real (no la pisa con hoy)', true,
         created_at = '2019-03-05 10:00+00'::timestamptz, ''
  from public.posts where id = 'h2';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y no le arruina el resto de la fila', true,
         title = 'Titulo viejo' and author_email = 'viejo@x.com' and start_date = '2019-03-05', ''
  from public.posts where id = 'h2';
\set QUIET off
select n, '  FALLA  ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
