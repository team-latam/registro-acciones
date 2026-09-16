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
-- Pero la importación (sin persona detrás) conserva las fechas reales de
-- Firebase: si no, diez años de historia quedarían editados hoy.
\set QUIET on
update public.posts set content='importado', last_edited_at='2019-05-05 12:00+00' where id='p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'pero la importación conserva la fecha real de edición', true,
         to_char(last_edited_at at time zone 'UTC','YYYY-MM-DD') = '2019-05-05', ''
  from public.posts where id='p1';
select lab.probar_valor('destildar un hito deja la fecha en blanco, no la pisa con hoy', lab.como('juan@x.com'),
  $q$update public.posts set project_status='open', project_done_at=null where id='p1'$q$,
  $q$select coalesce(project_done_at::text,'(en blanco)') from public.posts where id='p1'$q$, '(en blanco)');
\set QUIET off

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
