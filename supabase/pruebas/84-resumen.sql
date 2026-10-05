\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny','benny','admin'),
  ('ana@x.com','Ana','ana','member');

\set ANA 'lab.como(''ana@x.com'')'

-- ============================================================
-- El resumen de una visita (6/10/2026)
-- ============================================================
-- La app lee el Formulario de Cierre y guarda en posts.resumen el
-- resumen ejecutivo, los objetivos y "lo que sigue". Marcar un paso como
-- hecho es escribir ahí: lo puede hacer cualquiera que pueda editar el
-- evento, igual que el resto.
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email) values
  ('v1','Visita','x','2026-08-13','2026-08-13','2026-08-16','visita','Benny','benny@team-latam.com'),
  ('r1','Rutina','x','2026-08-13','2026-08-13','2026-08-13','rutina','Benny','benny@team-latam.com');

select lab.probar('un integrante guarda el resumen de una visita de otro', :ANA,
  $q$update public.posts set resumen = '{"v":1,"tipo":"cierre","objetivos":[],"pasos":[{"id":"p1","t":"Seguir","estado":"hecho"}]}' where id='v1'$q$, true);
select lab.probar_valor('y queda guardado', :ANA,
  $q$update public.posts set resumen = '{"v":1,"tipo":"cierre","objetivos":[],"pasos":[{"id":"p1","t":"Seguir","estado":"hecho"}]}' where id='v1'$q$,
  $q$select resumen #>> '{pasos,0,estado}' from public.posts where id='v1'$q$, 'hecho');
select lab.probar('el de una rutina ajena no (una rutina la edita quien la escribió)', :ANA,
  $q$update public.posts set resumen = '{"v":1}' where id='r1'$q$, false);
select lab.probar('el resumen tiene que ser un objeto', :ANA,
  $q$update public.posts set resumen = '[1,2]' where id='v1'$q$, false);
select lab.probar('y con un tope de tamaño', :ANA,
  $q$update public.posts set resumen = jsonb_build_object('ejecutivo', repeat(md5(random()::text), 4000)) where id='v1'$q$, false);
select lab.probar('el me gusta sigue yendo solo, no junto con el resumen', :ANA,
  $q$update public.posts set resumen = '{"v":1}', liked_by = '{ana@x.com}' where id='v1'$q$, false);
select lab.probar('y se puede volver a dejar sin resumen', :ANA,
  $q$update public.posts set resumen = null where id='v1'$q$, true);

\set QUIET off
select n, '  FALLA  ' || nombre as falla, detalle from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
