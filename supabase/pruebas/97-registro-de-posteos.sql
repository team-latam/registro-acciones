\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.app_config, public.audit_log cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('ana@x.com','Ana','ana','admin'),
  ('juan@x.com','Juan','juan','member');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email) values
  ('p1','Visita a Lima','C','2026-09-10','2026-09-10','2026-09-10','visita','Juan','juan@x.com');

-- ============================================================
-- Quién cargó, editó, canceló o borró cada posteo
-- ============================================================
-- Lo anota la base sola (registrar_posteo, en 04-funciones.sql), con la
-- misma escritura del posteo. Antes lo anotaba la app con un segundo
-- pedido, que se podía perder o saltear.
--
-- El registro solo lo lee un admin, así que para mirarlo desde la sesión
-- de un integrante hace falta esta ventana. Es del laboratorio: no existe
-- en la base de verdad.
create or replace function lab.registro() returns text
  language sql security definer set search_path = '' as $$
  select coalesce(string_agg(type || '|' || actor_email || '|' || actor_name || '|' || coalesce(detail, '-'),
                             ' ; ' order by created_at, id), 'nada')
    from public.audit_log where type like 'post_%'
$$;
create or replace function lab.registro_pedido() returns text
  language sql security definer set search_path = '' as $$
  select string_agg(coalesce(device, '-') || ' / ' || coalesce(ip, '-'), ' ; ')
    from public.audit_log where type like 'post_%'
$$;
grant execute on function lab.registro(), lab.registro_pedido() to authenticated, service_role;
grant usage on schema lab to authenticated, service_role;

select lab.probar_valor('cargar un posteo lo anota, con quién y qué', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p2','Curso   en
Quito','C','2026-09-10','2026-09-10','2026-09-10','curso','Juan','juan@x.com')$q$,
  $q$select lab.registro()$q$, 'post_created|juan@x.com|Juan|«Curso en Quito» (Curso)');

select lab.probar_valor('el tipo, con el nombre que le puso el equipo', lab.como('juan@x.com'),
  $q$set local role postgres;
     insert into public.app_config(key, value) values ('preferences', '{"activityTypes":[{"key":"curso","label":"Capacitación","icon":"🎓"}]}');
     set local role authenticated;
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p2','Curso','C','2026-09-10','2026-09-10','2026-09-10','curso','Juan','juan@x.com')$q$,
  $q$select lab.registro()$q$, 'post_created|juan@x.com|Juan|«Curso» (Capacitación)');

select lab.probar_valor('un título largo, cortado, y un tipo que no existe, sin nombre', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p2',repeat('a', 100),'C','2026-09-10','2026-09-10','2026-09-10','tipoinventado','Juan','juan@x.com')$q$,
  $q$select lab.registro()$q$, 'post_created|juan@x.com|Juan|«' || repeat('a', 80) || '»');

select lab.probar_valor('editar lo anota', lab.como('ana@x.com'),
  $q$update public.posts set title = 'Visita a Lima y Cusco', last_edited_at = now(),
       last_edited_by = 'Ana', last_edited_by_email = 'ana@x.com' where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'post_edited|ana@x.com|Ana|«Visita a Lima y Cusco» (Visita)');

select lab.probar_valor('quién editó sale de la credencial, no del nombre firmado', lab.como('juan@x.com'),
  $q$update public.posts set title = 'Otra', last_edited_at = now(),
       last_edited_by = 'Ana', last_edited_by_email = 'ana@x.com' where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'post_edited|juan@x.com|Juan|«Otra» (Visita)');

select lab.probar_valor('cancelar se anota como cancelación', lab.como('juan@x.com'),
  $q$update public.posts set cancelled = true, last_edited_at = now(),
       last_edited_by = 'Juan', last_edited_by_email = 'juan@x.com' where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'post_cancelled|juan@x.com|Juan|«Visita a Lima» (Visita)');

select lab.probar_valor('un me gusta NO es una edición', lab.como('ana@x.com'),
  $q$select public.me_gusta_posteo('p1', true)$q$,
  $q$select lab.registro()$q$, 'nada');

select lab.probar_valor('ni guardar el id del evento de Calendar (no firma)', lab.como('juan@x.com'),
  $q$update public.posts set calendar_event_id = 'ev1' where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'nada');

select lab.probar_valor('lo que el navegador trae de Google Calendar no lo editó nadie', lab.como('juan@x.com'),
  $q$update public.posts set start_date = '2026-09-11', end_date = '2026-09-11', date = '2026-09-11',
       last_edited_at = now(), last_edited_by = 'Google Calendar' where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'nada');

select lab.probar_valor('ni lo cargó nadie', lab.como('juan@x.com'),
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,calendar_event_id)
     values ('cal_ev2','Del Calendar','','2026-09-10','2026-09-10','2026-09-10','visita','Google Calendar','','ev2')$q$,
  $q$select lab.registro()$q$, 'nada');

select lab.probar_valor('borrar lo anota (solo el admin fijo puede)', lab.como('benny@team-latam.com'),
  $q$delete from public.posts where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'post_deleted|benny@team-latam.com|Benny|«Visita a Lima» (Visita)');

select lab.probar_valor_servicio('lo que escribe el sincronizador nocturno no se anota',
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,calendar_event_id)
     values ('cal_ev3','Del Calendar','','2026-09-10','2026-09-10','2026-09-10','visita','Google Calendar','','ev3');
     delete from public.posts where id = 'p1'$q$,
  $q$select lab.registro()$q$, 'nada');

-- El navegador y la dirección salen del pedido que Supabase le pasa a la
-- base (antes la app le preguntaba la IP a un servicio de afuera).
select lab.probar_valor('anota desde qué navegador y qué dirección', lab.como('juan@x.com'),
  $q$select set_config('request.headers',
       '{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36","x-forwarded-for":"200.1.2.3, 10.0.0.1"}', true);
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p2','T','C','2026-09-10','2026-09-10','2026-09-10','visita','Juan','juan@x.com')$q$,
  $q$select lab.registro_pedido()$q$,
  'Chrome · Windows / 200.1.2.3');

select lab.probar_valor('con un pedido raro, el posteo se guarda igual', lab.como('juan@x.com'),
  $q$select set_config('request.headers', 'esto no es json', true);
     insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('p2','T','C','2026-09-10','2026-09-10','2026-09-10','visita','Juan','juan@x.com')$q$,
  $q$select lab.registro()$q$, 'post_created|juan@x.com|Juan|«T» (Visita)');

-- Y a mano no lo escribe nadie: si no, se podría anotar algo que no pasó.
select lab.probar('un integrante NO puede anotar a mano que cargó algo', lab.como('juan@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc1','post_created','juan@x.com','Juan','«Evento»')$q$, false);
select lab.probar('ni un admin', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc2','post_deleted','ana@x.com','Ana','«Evento»')$q$, false);
select lab.probar('ni el admin fijo', lab.como('benny@team-latam.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, detail) values ('pc3','post_cancelled','benny@team-latam.com','Benny','«Evento»')$q$, false);
select lab.probar('lo demás que anota un admin sigue igual', lab.como('ana@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email) values ('t1','role_changed','ana@x.com','Ana','juan@x.com')$q$, true);

\set QUIET off
\echo ''
select n, case when esperado = obtenido then '  ok' else '  FALLA' end as r, nombre, detalle
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
