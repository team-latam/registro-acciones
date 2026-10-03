\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.app_config, public.audit_log,
         public.calendar_sugerencias, public.calendar_sacados cascade;
insert into public.members(email,name,nickname,role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('ana@x.com','Ana','ana','admin'),
  ('juan@x.com','Juan','juan','member'),
  ('obs@x.com','Obs','obs','observer');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,calendar_event_id) values
  ('cal_ev1','Visita Tucumán - Ran','','2025-02-04','2025-02-04','2025-02-04','otro','Google Calendar','','ev1'),
  ('cal_ev2','Reunión semanal','','2025-02-05','2025-02-05','2025-02-05','otro','Google Calendar','','ev2'),
  ('p_juan','Evento de Juan','x','2025-02-06','2025-02-06','2025-02-06','visita','Juan','juan@x.com','ev3');
insert into public.replies(id,post_id,content,author_name,author_email) values ('r1','cal_ev2','hola','Juan','juan@x.com');
insert into public.calendar_sugerencias(evento,grupo,tipo,lugares,personas,confianza) values
  ('ev1','actividad','visita','[{"type":"ciudad","country":"Argentina","city":"Tucuman"}]','{Ran}','alta');

-- ============================================================
-- Revisar lo que llegó de Calendar (12-revisar-calendar.sql)
-- ============================================================

-- ---------- Las sugerencias ----------
select lab.probar_valor('un admin ve las sugerencias', lab.como('ana@x.com'),
  'select 1', 'select count(*)::text from public.calendar_sugerencias', '1');
select lab.probar_valor('un integrante no', lab.como('juan@x.com'),
  'select 1', 'select count(*)::text from public.calendar_sugerencias', '0');
select lab.probar('y nadie las escribe desde el navegador, ni el admin fijo', lab.como('benny@team-latam.com'),
  $q$insert into public.calendar_sugerencias(evento,grupo) values ('evX','actividad')$q$, false);

-- ---------- Clasificar ----------
select lab.probar_valor('un admin les pone tipo, lugar y personas de a muchos', lab.como('ana@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","activity_type":"visita","scopes":[{"type":"ciudad","country":"Argentina","city":"Tucuman"}],"participants":[{"name":"Ran"}]},{"id":"cal_ev2","activity_type":"seminario"}]')$q$,
  $q$select string_agg(id || ':' || activity_type || ':' || jsonb_array_length(scopes) || ':' || jsonb_array_length(participants), ' ' order by id) from public.posts where id like 'cal_%'$q$,
  'cal_ev1:visita:1:1 cal_ev2:seminario:0:0');
select lab.probar_valor('lo que no viene en el cambio no se toca', lab.como('ana@x.com'),
  $q$update public.posts set scopes = '[{"type":"pais","country":"Chile"}]' where id = 'cal_ev2';
     select public.clasificar_importados('[{"id":"cal_ev2","activity_type":"curso"}]')$q$,
  $q$select activity_type || ':' || (scopes->0->>'country') from public.posts where id = 'cal_ev2'$q$, 'curso:Chile');
select lab.probar_valor('ordenar no es editar: sin "Editado por" ni entrada en el registro', lab.como('ana@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","activity_type":"curso"}]')$q$,
  $q$select coalesce(last_edited_at::text, 'sin fecha') || ' / ' || (select count(*) from public.audit_log) from public.posts where id = 'cal_ev1'$q$,
  'sin fecha / 0');
select lab.probar_valor('solo lo que vino de Calendar: el evento de Juan no se toca', lab.como('ana@x.com'),
  $q$select public.clasificar_importados('[{"id":"p_juan","activity_type":"curso"}]')$q$,
  $q$select activity_type from public.posts where id = 'p_juan'$q$, 'visita');
select lab.probar('un integrante no ordena', lab.como('juan@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","activity_type":"curso"}]')$q$, false);
select lab.probar('ni un observador', lab.como('obs@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","activity_type":"curso"}]')$q$, false);
select lab.probar('un campo que no corresponde no entra', lab.como('ana@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","author_email":"ana@x.com"}]')$q$, false);
select lab.probar('y las validaciones de siempre siguen valiendo (tipo con forma rara)', lab.como('ana@x.com'),
  $q$select public.clasificar_importados('[{"id":"cal_ev1","activity_type":"Tipo Raro!"}]')$q$, false);

-- ---------- Sacar del Registro ----------
select lab.probar_valor('un admin saca un evento: se va con sus respuestas y queda anotado', lab.como('ana@x.com'),
  $q$select public.sacar_del_registro(array['cal_ev2'])$q$,
  $q$select (select count(*) from public.posts where id = 'cal_ev2') || '/' || (select count(*) from public.replies)
         || '/' || (select string_agg(evento || ':' || sacado_por || ':' || titulo, ',') from public.calendar_sacados)$q$,
  '0/0/ev2:ana@x.com:Reunión semanal');
select lab.probar_valor('y el registro de actividad anota quién lo sacó', lab.como('ana@x.com'),
  $q$select public.sacar_del_registro(array['cal_ev2'])$q$,
  $q$select (select type || ':' || actor_email from public.audit_log where type = 'post_deleted') from (select 1) x$q$,
  'post_deleted:ana@x.com');
select lab.probar_valor('lo que no vino de Calendar no se saca', lab.como('ana@x.com'),
  $q$select public.sacar_del_registro(array['p_juan'])$q$,
  $q$select count(*)::text from public.posts where id = 'p_juan'$q$, '1');
select lab.probar('un integrante no saca', lab.como('juan@x.com'),
  $q$select public.sacar_del_registro(array['cal_ev1'])$q$, false);
select lab.probar_valor('cualquiera que escribe ve lo sacado (su navegador sincroniza)', lab.como('juan@x.com'),
  $q$set local role postgres; insert into public.calendar_sacados(evento,sacado_por) values ('ev9','ana@x.com'); set local role authenticated$q$,
  'select count(*)::text from public.calendar_sacados', '1');
select lab.probar_valor('un observador no (no sincroniza)', lab.como('obs@x.com'),
  $q$set local role postgres; insert into public.calendar_sacados(evento,sacado_por) values ('ev9','ana@x.com'); set local role authenticated$q$,
  'select count(*)::text from public.calendar_sacados', '0');
select lab.probar('nadie anota a mano un evento como sacado', lab.como('ana@x.com'),
  $q$insert into public.calendar_sacados(evento,sacado_por) values ('evZ','ana@x.com')$q$, false);
select lab.probar('un admin lo puede devolver (borrarlo de la lista)', lab.como('ana@x.com'),
  $q$set local role postgres; insert into public.calendar_sacados(evento,sacado_por) values ('ev8','ana@x.com'); set local role authenticated;
     delete from public.calendar_sacados where evento = 'ev8'$q$, true);
select lab.probar('un integrante no', lab.como('juan@x.com'),
  $q$set local role postgres; insert into public.calendar_sacados(evento,sacado_por) values ('ev8','ana@x.com'); set local role authenticated;
     delete from public.calendar_sacados where evento = 'ev8'$q$, false);

\set QUIET off
\echo ''
select n, case when esperado = obtenido then '  ok' else '  FALLA' end as r, nombre, detalle
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
