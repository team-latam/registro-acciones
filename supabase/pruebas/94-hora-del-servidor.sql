\set QUIET on
truncate lab.resultados;
truncate public.posts, public.members cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('juan@x.com','Juan','juan','member');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('p1','Evento','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com');

select lab.probar_valor('la marca se convierte en la hora de la base', lab.como('juan@x.com'),
  $q$update public.posts set content='editado', last_edited_at='epoch' where id='p1'$q$,
  $q$select case when last_edited_at > now() - interval '1 minute' then 'ahora' else 'la marca cruda' end
     from public.posts where id='p1'$q$, 'ahora');
select lab.probar_valor('una fecha inventada por el navegador se PISA, no se acepta', lab.como('juan@x.com'),
  $q$update public.posts set content='editado', last_edited_at='2001-01-01' where id='p1'$q$,
  $q$select case when last_edited_at > now() - interval '1 minute' then 'la de la base'
                 else 'se coló la falsa' end from public.posts where id='p1'$q$, 'la de la base');
select lab.probar_valor('un hito dado por cumplido también lleva la hora de la base', lab.como('juan@x.com'),
  $q$update public.posts set project_status='done', project_done_by='juan@x.com', project_done_at='epoch' where id='p1'$q$,
  $q$select case when project_done_at > now() - interval '1 minute' then 'ahora' else 'no' end
     from public.posts where id='p1'$q$, 'ahora');
select lab.probar_valor('y compartir el Calendar anota cuándo, con el reloj de la base', lab.como('benny@team-latam.com'),
  $q$update public.members set calendar_shared=true, calendar_invite_sent_at='epoch' where email='juan@x.com'$q$,
  $q$select case when calendar_invite_sent_at > now() - interval '1 minute' then 'ahora' else 'no' end
     from public.members where email='juan@x.com'$q$, 'ahora');
-- Pero sin una persona detrás (el editor SQL, una migración) se respeta la
-- fecha que venga: si no, la historia que se trae a mano quedaría editada
-- hoy.
\set QUIET on
update public.posts set content='traído a mano', last_edited_at='2019-05-05 12:00+00' where id='p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'pero sin una persona detrás se respeta la fecha real de edición', true,
         to_char(last_edited_at at time zone 'UTC','YYYY-MM-DD') = '2019-05-05', ''
  from public.posts where id='p1';
select lab.probar_valor('destildar un hito deja la fecha en blanco, no la pisa con hoy', lab.como('juan@x.com'),
  $q$update public.posts set project_status='open', project_done_at=null where id='p1'$q$,
  $q$select coalesce(project_done_at::text,'(en blanco)') from public.posts where id='p1'$q$, '(en blanco)');
\set QUIET off

-- ---------- SIN PERSONA DETRÁS: EL SINCRONIZADOR NOCTURNO ----------
-- Escribe con la llave de servicio y manda la marca de 1970 («poné vos la
-- hora»). Antes la marca quedaba guardada tal cual.
select lab.probar_valor_servicio('un posteo que crea el sincronizador nace con la hora de la base, no en 1970',
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,calendar_event_id,created_at)
     values ('noc1','Congreso','','2026-11-10','2026-11-10','2026-11-12','congreso','Google Calendar','','ev1','1970-01-01T00:00:00.000Z')$q$,
  $q$select case when created_at > now() - interval '1 minute' then 'ahora' else created_at::text end from public.posts where id='noc1'$q$,
  'ahora');
select lab.probar_valor_servicio('su comentario de sistema también',
  $q$insert into public.replies(id,post_id,content,author_name,author_email,system,icon,created_at)
     values ('noc2','p1','📅 Se movió en Google Calendar','Google Calendar',null,true,'📅','1970-01-01T00:00:00.000Z')$q$,
  $q$select case when created_at > now() - interval '1 minute' then 'ahora' else created_at::text end from public.replies where id='noc2'$q$,
  'ahora');
select lab.probar_valor_servicio('y la hora de una edición suya',
  $q$update public.posts set title='Corrido', last_edited_at='1970-01-01T00:00:00.000Z', last_edited_by='Google Calendar' where id='p1'$q$,
  $q$select case when last_edited_at > now() - interval '1 minute' then 'ahora' else last_edited_at::text end from public.posts where id='p1'$q$,
  'ahora');
select lab.probar_valor_servicio('una fecha real que mande, se respeta',
  $q$update public.posts set last_edited_at='2026-09-01T12:00:00Z' where id='p1'$q$,
  $q$select last_edited_at::date::text from public.posts where id='p1'$q$,
  '2026-09-01');

-- ---------- LO QUE YA HABÍA QUEDADO EN 1970 ----------
-- Así quedaban antes: se escribe salteando los disparadores, y después se
-- corre el archivo de verdad que lo corrige (10-fechas-de-1970.sql).
set session_replication_role = replica;
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,calendar_event_id,created_at,last_edited_at)
  values ('v1970','Evento','','2026-08-20','2026-08-20','2026-08-20','visita','Google Calendar','','ev9','epoch','epoch');
insert into public.replies(id,post_id,content,author_name,author_email,system,created_at)
  values ('rv1970','v1970','📅 Cambió en Google Calendar','Google Calendar',null,true,'epoch');
set session_replication_role = origin;
\ir ../10-fechas-de-1970.sql
select lab.probar_valor('un posteo que quedó en 1970 pasa al día de su evento', lab.como('juan@x.com'), $q$select 1$q$,
  $q$select created_at::date::text from public.posts where id='v1970'$q$, '2026-08-20');
select lab.probar_valor('su edición, a ahora', lab.como('juan@x.com'), $q$select 1$q$,
  $q$select case when last_edited_at > now() - interval '1 minute' then 'ahora' else last_edited_at::text end from public.posts where id='v1970'$q$, 'ahora');
select lab.probar_valor('y su comentario de sistema, a ahora (queda último en el hilo)', lab.como('juan@x.com'), $q$select 1$q$,
  $q$select case when created_at > now() - interval '1 minute' then 'ahora' else created_at::text end from public.replies where id='rv1970'$q$, 'ahora');

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
