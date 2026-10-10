\set QUIET on
truncate lab.resultados;

-- El banco de pruebas (lab.probar, lab.probar_valor, lab.como) vive en
-- 00-laboratorio.sql: tenerlo repetido acá hacía que este archivo pisara
-- la versión compartida, y el resultado de otras pruebas cambiaba según en
-- qué orden se corrieran.
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny','benny','member'),
  ('juan@x.com','Juan','juan','member');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('p1','T','C','2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com');

\set YO 'lab.como(''benny@team-latam.com'')'
\set NUEVO 'insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email'

-- ---------- La forma del id (docs/AUDITORIA.md, U3) ----------
select lab.probar('un id como los que arma la app entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('k3m9x0abcdefghij1234','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, true);
select lab.probar('un id de Calendar (cal_ + evento con _ y T/Z) entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('cal_abc123_20260113T010000Z','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, true);
select lab.probar('un id con comillas y < > NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x"><b>','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, false);
select lab.probar('un id con espacios NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('a b','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, false);
select lab.probar('un comentario con id raro NO', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email)
     values ('r''x','p1','Hola','Benny','benny@team-latam.com')$q$, false);
select lab.probar('un comentario que responde a un id raro NO', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,reply_to_id)
     values ('r_ok','p1','Hola','Benny','benny@team-latam.com','"onx=')$q$, false);
select lab.probar('un comentario normal que responde a otro entra', :YO,
  $q$insert into public.replies(id,post_id,content,author_name,author_email,reply_to_id)
     values ('r_ok2','p1','Hola','Benny','benny@team-latam.com','r_ok')$q$, true);

-- ---------- Largos y formatos ----------
select lab.probar('un posteo normal entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('ok1','Titulo','Contenido','2026-09-10','2026-09-10','2026-09-11','evento','Benny','benny@team-latam.com')$q$, true);
select lab.probar('un título de 200 caracteres NO', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x1',repeat('a',200),'C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, false);
-- El contenido vacío SÍ entra desde 09-contenido-vacio.sql: un evento de
-- Calendar sin descripción no tiene contenido, y eso es correcto. Lo que
-- sigue sin entrar es un contenido demasiado largo, y un COMENTARIO vacío
-- (ver 98-contenido-vacio.sql).
select lab.probar('un contenido vacío ahora SÍ entra', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
     values ('x2','T','','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com')$q$, true);
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
-- El tope pasó de 6 a 20 cuando los archivos salieron del documento y se
-- fueron al bucket (ver 07-adjuntos-grandes.sql). Las pruebas de ese
-- cambio están en 99-adjuntos-grandes.sql; acá queda una sola, para que
-- este archivo no diga otra cosa.
select lab.probar('siete imágenes ahora SÍ (el tope dejó de ser seis)', :YO,
  $q$insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,images)
     values ('x7','T','C','2026-09-10','2026-09-10','2026-09-10','evento','B','benny@team-latam.com',
             array['a','b','c','d','e','f','g'])$q$, true);
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

-- ---------- Sin una persona detrás, se respeta la fecha REAL ----------
-- El editor SQL o una migración que trae filas viejas: si la base pisara
-- la fecha, convertiría la historia en "hoy". Corre sin sesión de persona.
\set QUIET on
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,created_at)
  values ('h2','Titulo viejo','C','2019-03-05','2019-03-05','2019-03-05','evento','Alguien','viejo@x.com','2019-03-05 10:00+00');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'sin una persona detrás, se respeta la fecha real (no la pisa con hoy)', true,
         created_at = '2019-03-05 10:00+00'::timestamptz, ''
  from public.posts where id = 'h2';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y no le arruina el resto de la fila', true,
         title = 'Titulo viejo' and author_email = 'viejo@x.com' and start_date = '2019-03-05', ''
  from public.posts where id = 'h2';
-- ---------- CUÁNTO PUEDE PESAR UNA FILA ----------
-- Con la credencial de un integrante común. Antes todo esto entraba.
insert into public.app_config(key, value) values
  ('calendarSync', '{}'), ('preferences', '{}'),
  ('territoryConfig', '{"zones":{"sur":{"label":"Sur","color":"#2563eb"}},"countryZones":{"Argentina":"sur"}}')
  on conflict (key) do nothing;
select lab.probar('preferencias personales de 5 MB NO entran', lab.como('juan@x.com'),
  $q$select public.guardar_preferencias(jsonb_build_object('relleno', repeat('x', 5*1024*1024)))$q$, false);
select lab.probar('las de verdad sí', lab.como('juan@x.com'),
  $q$select public.guardar_preferencias('{"weekStart":1,"holidayCountries":["Argentina","Chile"],"dimPast":true}')$q$, true);
select lab.probar('hitos de 4 MB en un posteo NO entran', lab.como('juan@x.com'),
  $q$update public.posts set milestones = (select jsonb_agg(jsonb_build_object('label', repeat('y', 100*1024))) from generate_series(1, 40) g) where id = 'p1'$q$, false);
select lab.probar('cuarenta hitos de verdad sí', lab.como('juan@x.com'),
  $q$update public.posts set milestones = (select jsonb_agg(jsonb_build_object('id', 'm' || g, 'label', 'Hito número ' || g, 'date', '2026-10-01', 'done', false, 'owners', '["juan@x.com"]'::jsonb)) from generate_series(1, 40) g) where id = 'p1'$q$, true);

-- ---------- EL ESTADO DE LA SINCRONIZACIÓN ----------
-- Lo escribe cualquier integrante y lo lee el navegador de todos cada 30 s.
select lab.probar('5 MB en la sincronización NO entran', lab.como('juan@x.com'),
  $q$select public.guardar_config('calendarSync', jsonb_build_object('syncToken', repeat('x', 5*1024*1024)))$q$, false);
select lab.probar('ni un campo que la app no escribe', lab.como('juan@x.com'),
  $q$select public.guardar_config('calendarSync', '{"relleno":"x"}')$q$, false);
select lab.probar('lo que escribe la app sí', lab.como('juan@x.com'),
  $q$select public.guardar_config('calendarSync', '{"syncToken":"CPDAlvWDx4sCEPDAlvWDx4sCGAU=","lastSyncedAt":"2026-10-03T03:00:00.000Z"}')$q$, true);

-- ---------- LOS TIPOS DE ACTIVIDAD ----------
select lab.probar('los tipos como los guarda la app entran', :YO,
  $q$select public.guardar_config('preferences', '{"activityTypes":[{"key":"visita","label":"Visita","icon":"🧳","calendarSync":true,"docs":[{"id":"plandeviaje","label":"Plan de viaje"},{"id":"reporte","label":"Reporte de cierre"}]},{"key":"taller","label":"Taller","icon":"🛠️","calendarSync":true},{"key":"otro","label":"Otro","icon":"✨","calendarSync":false,"docs":[]}]}')$q$, true);
select lab.probar('31 tipos NO', :YO,
  $q$select public.guardar_config('preferences', jsonb_build_object('activityTypes', (select jsonb_agg(jsonb_build_object('key', 't' || g, 'label', 'Tipo ' || g, 'icon', '✨')) from generate_series(1, 31) g)))$q$, false);
select lab.probar('una clave con HTML NO', :YO,
  $q$select public.guardar_config('preferences', '{"activityTypes":[{"key":"<img src=x>","label":"X"}]}')$q$, false);
select lab.probar('un campo que la app no escribe NO', :YO,
  $q$select public.guardar_config('preferences', '{"activityTypes":[{"key":"x","label":"X","html":"<b>"}]}')$q$, false);
select lab.probar('un nombre de 5.000 caracteres NO', :YO,
  $q$select public.guardar_config('preferences', jsonb_build_object('activityTypes', jsonb_build_array(jsonb_build_object('key', 'x', 'label', repeat('x', 5000)))))$q$, false);
select lab.probar('once documentos esperados NO', :YO,
  $q$select public.guardar_config('preferences', jsonb_build_object('activityTypes', jsonb_build_array(jsonb_build_object('key', 'x', 'label', 'X', 'docs', (select jsonb_agg(jsonb_build_object('id', 'd' || g, 'label', 'D')) from generate_series(1, 11) g)))))$q$, false);
-- Un tipo archivado (ya no se ofrece al cargar, pero sigue nombrando a
-- sus posteos viejos) lleva archived:true; cualquier otra cosa ahí, no.
select lab.probar('un tipo archivado entra', :YO,
  $q$select public.guardar_config('preferences', '{"activityTypes":[{"key":"visita","label":"Visita","icon":"🧳","calendarSync":true},{"key":"taller","label":"Taller","icon":"🛠️","calendarSync":true,"archived":true}]}')$q$, true);
select lab.probar('archived que no sea sí/no NO', :YO,
  $q$select public.guardar_config('preferences', '{"activityTypes":[{"key":"taller","label":"Taller","archived":"si"}]}')$q$, false);
-- Las Preferencias se guardan por partes adentro del mismo valor: un dato
-- viejo de una sección no puede trabar el guardado de las otras.
update public.app_config set value = value || '{"activityTypes":[{"key":"Viejo-Mal","label":"Viejo"}]}' where key = 'preferences';
select lab.probar('con un tipo viejo mal guardado, las otras secciones se siguen guardando', :YO,
  $q$select public.guardar_config('preferences', '{"calendarId":"equipo@group.calendar.google.com"}')$q$, true);

-- ---------- LAS ZONAS ----------
select lab.probar('las zonas como las guarda la app entran', :YO,
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb"},"caribe":{"label":"Caribe","color":"#0ea5e9"}},"countryZones":{"Argentina":"sur","Cuba":"caribe"}}' where key = 'territoryConfig'$q$, true);
select lab.probar('un color que no es un color NO (va adentro de un style=)', :YO,
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"red;background:url(https://x)"}},"countryZones":{}}' where key = 'territoryConfig'$q$, false);
select lab.probar('un país en una zona que no existe NO', :YO,
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb"}},"countryZones":{"Chile":"inventada"}}' where key = 'territoryConfig'$q$, false);
select lab.probar('21 zonas NO', :YO,
  $q$update public.app_config set value = jsonb_build_object('zones', (select jsonb_object_agg('z' || g, jsonb_build_object('label', 'Zona ' || g, 'color', '#000000')) from generate_series(1, 21) g), 'countryZones', '{}'::jsonb) where key = 'territoryConfig'$q$, false);
select lab.probar('un campo de más en una zona NO', :YO,
  $q$update public.app_config set value = '{"zones":{"sur":{"label":"Sur","color":"#2563eb","html":"<b>"}},"countryZones":{}}' where key = 'territoryConfig'$q$, false);


-- ---------- La foto de una solicitud (docs/AUDITORIA.md, M11) ----------
select lab.probar('pedir acceso con la foto de Google entra', lab.como('nuevo1@x.com'),
  $q$insert into public.access_requests(email, name, status, photo_url) values ('nuevo1@x.com','Nuevo','pending','https://lh3.googleusercontent.com/a/abc=s96-c')$q$, true);
select lab.probar('sin foto también', lab.como('nuevo2@x.com'),
  $q$insert into public.access_requests(email, name, status) values ('nuevo2@x.com','Nuevo','pending')$q$, true);
select lab.probar('con una foto de otro sitio NO', lab.como('nuevo3@x.com'),
  $q$insert into public.access_requests(email, name, status, photo_url) values ('nuevo3@x.com','Nuevo','pending','https://rastreo.example.com/pixel.gif')$q$, false);
select lab.probar('ni haciéndose pasar por Google en el nombre', lab.como('nuevo4@x.com'),
  $q$insert into public.access_requests(email, name, status, photo_url) values ('nuevo4@x.com','Nuevo','pending','https://googleusercontent.com.example.com/x.gif')$q$, false);

-- ---------- La fecha de un pedido la pone la base, también al editarlo (docs/AUDITORIA.md, R20) ----------
-- Hasta el 10/10/2026 solo el insert pasaba por la hora del servidor: en
-- un PATCH entraba la fecha que viniera, y con eso un rechazado volvía a
-- la cola sin esperar la hora. Sin sesión de persona (restaurar una
-- copia) entra la que venga: así se arman los dos pedidos de abajo.
insert into public.access_requests(email, name, status, requested_at) values
  ('pide@x.com', 'Pide', 'pending', now() - interval '3 days'),
  ('rech9@x.com', 'Rech', 'rejected', now() - interval '3 days');
select lab.probar_valor('quien pide no cambia la fecha de su pedido (queda la que estaba)', lab.como('pide@x.com'),
  $q$update public.access_requests set requested_at = now(), name = 'Pide otra vez' where email = 'pide@x.com'$q$,
  $q$select (requested_at between now() - interval '4 days' and now() - interval '2 days')::text || ' ' || name
     from public.access_requests where email = 'pide@x.com'$q$, 'true Pide otra vez');
select lab.probar_valor('ni con la marca «poné vos la hora» (1/1/1970) del upsert de la app', lab.como('pide@x.com'),
  $q$update public.access_requests set requested_at = 'epoch', status = 'pending' where email = 'pide@x.com'$q$,
  $q$select (requested_at between now() - interval '4 days' and now() - interval '2 days')::text
     from public.access_requests where email = 'pide@x.com'$q$, 'true');
select lab.probar_valor('volver a pedir después de un rechazo sí es un pedido nuevo: con la fecha de ahora', lab.como('rech9@x.com'),
  $q$update public.access_requests set status = 'pending' where email = 'rech9@x.com'$q$,
  $q$select (requested_at > now() - interval '1 minute')::text from public.access_requests where email = 'rech9@x.com'$q$, 'true');

\set QUIET off
select n, '  FALLA  ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
