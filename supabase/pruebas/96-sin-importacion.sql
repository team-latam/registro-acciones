\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.app_config, public.audit_log cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('ana@x.com','Ana','ana','admin'),
  ('juan@x.com','Juan','juan','member');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email) values
  ('p1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com');
insert into public.replies(id,post_id,content,author_name,author_email) values
  ('r1','p1','hola','Juan','juan@x.com');

-- ============================================================
-- La puerta de la importación, cerrada
-- ============================================================
-- importar() existió para traer de Firebase lo que ningún navegador puede
-- escribir: la fecha real de cada posteo y de quién era. Para eso prendía
-- una marca (app.importando) que hacía a un lado los controles de la
-- base. Firebase se cerró el 3 de octubre de 2026 y lo que faltaba ya se
-- trajo: esa puerta, abierta sin motivo, era una de más.
--
-- Acá se prueba que no quede nada: ni las funciones, ni el efecto de la
-- marca. Cada prueba prende la marca a mano antes de intentar lo que la
-- importación podía y una persona no.

select lab.probar_valor('ya no existe ninguna de las funciones de la importación', lab.como('benny@team-latam.com'),
  $q$select 1$q$,
  $q$select coalesce(string_agg(p.proname, ',' order by p.proname), 'ninguna')
       from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('importar', 'importar_quitar', 'es_importacion', 'cuantas_filas')$q$, 'ninguna');

-- La fecha de creación la pone la base, aunque se mande otra.
select lab.probar_valor('con la marca prendida, la fecha de creación la sigue poniendo la base', lab.como('benny@team-latam.com'),
  $q$select set_config('app.importando', 'si', true);
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,created_at)
     values ('p_2019','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Benny','benny@team-latam.com','2019-03-05T10:00:00Z')$q$,
  $q$select (extract(year from created_at) = extract(year from now()))::text from public.posts where id = 'p_2019'$q$, 'true');
select lab.probar_valor('y la de edición también', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     update public.posts set title = 'Otro', last_edited_at = '2019-04-01T10:00:00Z' where id = 'p1'$q$,
  $q$select (extract(year from last_edited_at) = extract(year from now()))::text from public.posts where id = 'p1'$q$, 'true');

-- De quién es un posteo no cambia nunca.
select lab.probar('con la marca prendida, nadie le cambia el autor a un posteo', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     update public.posts set author_email = 'otro@x.com' where id = 'p1'$q$, false);

-- Un comentario no se edita.
select lab.probar('ni edita un comentario', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     update public.replies set content = 'cambiado' where id = 'r1'$q$, false);

-- El propio rol no se toca.
select lab.probar('ni se sube el rol', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     update public.members set role = 'admin' where email = 'juan@x.com'$q$, false);

-- El @nickname tiene su forma.
select lab.probar('ni se pone un @nickname con espacios', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     update public.members set nickname = 'Juan Pérez' where email = 'juan@x.com'$q$, false);

-- La configuración tiene su forma.
select lab.probar('ni guarda una configuración con otra forma', lab.como('ana@x.com'),
  $q$select set_config('app.importando', 'si', true);
     insert into public.app_config(key, value) values ('calendarSync', '{"syncToken": 5}')$q$, false);

-- Un login, una vez por día y con el id que arma la app.
select lab.probar('ni anota logins con ids inventados', lab.como('pedro@x.com'),
  $q$select set_config('app.importando', 'si', true);
     insert into public.audit_log(id, type, actor_email, actor_name) values ('cualquiera1', 'login', 'pedro@x.com', 'Pedro')$q$, false);

-- Una fila no puede pesar lo que quiera (las preferencias, 32 KB).
select lab.probar('ni guarda preferencias de 40 KB', lab.como('juan@x.com'),
  $q$select set_config('app.importando', 'si', true);
     select public.guardar_preferencias(jsonb_build_object('relleno', repeat('x', 40 * 1024)))$q$, false);

-- Lo que sigue andando: lo de siempre, sin marca.
select lab.probar('y lo de todos los días sigue andando: comentar', lab.como('benny@team-latam.com'),
  $q$insert into public.replies(id, post_id, content, author_name, author_email)
     values ('r2', 'p1', 'buenísimo', 'Benny', 'benny@team-latam.com')$q$, true);
select lab.probar('y darle me gusta a un comentario', lab.como('benny@team-latam.com'),
  $q$select public.me_gusta_comentario('r1', true)$q$, true);

select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
