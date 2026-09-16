\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('juan@x.com','Juan','juan','member'),
  ('ana@x.com','Ana','ana','member'),
  ('obs@x.com','Obs','obs','observer');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,liked_by) values
  ('p1','Evento','C','2026-09-10','2026-09-10','2026-09-10','evento','Ana','ana@x.com','{}'),
  ('rut','Rutina de Ana','C','2026-09-10','2026-09-10','2026-09-10','rutina','Ana','ana@x.com','{ana@x.com}');
insert into public.replies(id,post_id,content,author_name,author_email,liked_by)
  values ('r1','p1','hola','Ana','ana@x.com','{}');

select lab.probar_valor('poner me gusta suma el propio correo', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('p1', true)$q$,
  $q$select array_to_string(liked_by,',') from public.posts where id='p1'$q$, 'juan@x.com');
select lab.probar_valor('NO se puede dar me gusta en nombre de otro (ni pasándolo a mano)', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('p1', true)$q$,
  $q$select case when 'ana@x.com' = any(liked_by) then 'se coló' else 'solo el suyo' end
     from public.posts where id='p1'$q$, 'solo el suyo');
select lab.probar_valor('darlo dos veces no lo duplica', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('p1', true); select public.me_gusta_posteo('p1', true)$q$,
  $q$select array_length(liked_by,1)::text from public.posts where id='p1'$q$, '1');
select lab.probar_valor('sacarlo lo saca', lab.como('ana@x.com'),
  $q$select public.me_gusta_posteo('rut', false)$q$,
  $q$select coalesce(array_length(liked_by,1),0)::text from public.posts where id='rut'$q$, '0');
select lab.probar_valor('sacar uno que no estaba no rompe nada', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('p1', false)$q$,
  $q$select coalesce(array_length(liked_by,1),0)::text from public.posts where id='p1'$q$, '0');
select lab.probar_valor('un me gusta repetido en la Rutina de OTRA persona no rompe', lab.como('ana@x.com'),
  $q$select public.me_gusta_posteo('rut', true)$q$,
  $q$select array_to_string(liked_by,',') from public.posts where id='rut'$q$, 'ana@x.com');
select lab.probar_valor('se puede dar me gusta a la Rutina de otro (aunque no se pueda editar)', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('rut', true)$q$,
  $q$select array_to_string(liked_by,',') from public.posts where id='rut'$q$, 'ana@x.com,juan@x.com');
select lab.probar_valor('un observador NO puede dar me gusta', lab.como('obs@x.com'),
  $q$select public.me_gusta_posteo('p1', true)$q$,
  $q$select coalesce(array_length(liked_by,1),0)::text from public.posts where id='p1'$q$, '0');
-- Alguien de afuera ni siquiera puede LEER el posteo para comprobarlo, así
-- que la consulta no devuelve fila: eso mismo es la prueba. Que el me gusta
-- tampoco entró se comprueba abajo, con alguien que sí puede mirar.
select lab.probar_valor('alguien de afuera ni ve el posteo', lab.como('intruso@x.com'),
  $q$select public.me_gusta_posteo('p1', true)$q$,
  $q$select coalesce(array_length(liked_by,1),0)::text from public.posts where id='p1'$q$, '(nulo)');
select lab.probar_valor('y su me gusta no entró', lab.como('juan@x.com'),
  $q$select 1$q$,
  $q$select coalesce(array_length(liked_by,1),0)::text from public.posts where id='p1'$q$, '0');
select lab.probar_valor('el me gusta de un comentario, igual', lab.como('juan@x.com'),
  $q$select public.me_gusta_comentario('r1', true)$q$,
  $q$select array_to_string(liked_by,',') from public.replies where id='r1'$q$, 'juan@x.com');
select lab.probar_valor('y dar me gusta NO deja editar el texto de contrabando', lab.como('juan@x.com'),
  $q$select public.me_gusta_posteo('rut', true);
     update public.posts set content='pisado' where id='rut'$q$,
  $q$select content from public.posts where id='rut'$q$, 'Una Rutina la edita solo quien la escribió');

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
