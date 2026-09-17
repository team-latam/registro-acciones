-- Generada por imp_test.mjs + este armador: toma lo que produce el
-- importador con un respaldo de forma real y lo mete en una base
-- Postgres de verdad, con los permisos puestos.
\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log cascade;

-- La importación va DE VERDAD (sin deshacerla), porque lo que se
-- comprueba después es que los datos hayan quedado.
set role authenticated;
select set_config('request.jwt.claims', (lab.como('benny@team-latam.com'))::text, false);
select 'members' as tabla, public.importar('members', $json$[{"email": "benny@team-latam.com", "name": "Benny", "nickname": "benny", "photo_url": "http://foto", "role": "admin", "approved_at": "2024-01-01T00:00:00.000Z", "approved_by": "benny@team-latam.com", "calendar_shared": true, "calendar_invite_sent_at": "2025-06-01T00:00:00.000Z", "tour_seen_at": "2025-06-02T00:00:00.000Z"}, {"name": "Ana", "nickname": "ana", "email": "ana@x.com"}]$json$::jsonb) as entraron;
select 'former_members' as tabla, public.importar('former_members', $json$[{"email": "vieja@x.com", "name": "Vieja", "nickname": "vieja", "approved_at": "2020-01-01T00:00:00.000Z", "revoked_at": "2023-01-01T00:00:00.000Z"}]$json$::jsonb) as entraron;
select 'access_requests' as tabla, public.importar('access_requests', $json$[{"email": "nuevo@x.com", "name": "Nuevo", "status": "pending", "photo_url": null, "requested_at": "2026-09-01T00:00:00.000Z"}]$json$::jsonb) as entraron;
select 'posts' as tabla, public.importar('posts', $json$[{"id": "p1", "title": "Evento", "content": "C", "date": "2026-09-10", "start_date": "2026-09-10", "end_date": "2026-09-10", "activity_type": "evento", "author_name": "Ana", "author_email": "ana@x.com", "created_at": "2019-03-05T10:00:00.000Z", "last_edited_at": "2019-04-01T10:00:00.000Z", "is_project": true, "calendar_event_id": "cal1", "milestones": [{"text": "Hito", "dueDate": "2026-09-20", "done": false}], "scopes": [{"pais": "AR"}], "liked_by": ["juan@x.com"], "images": ["posts/p1/img0.png"]}, {"id": "p2", "title": "Rutina vieja", "content": "C", "date": "2018-01-01", "start_date": "2018-01-01", "end_date": "2018-01-01", "activity_type": "rutina", "author_name": "Alguien", "created_at": "2018-01-01T00:00:00.000Z"}]$json$::jsonb) as entraron;
select 'replies' as tabla, public.importar('replies', $json$[{"id": "r1", "post_id": "p1", "content": "hola", "author_name": "Juan", "author_email": "juan@x.com", "created_at": "2026-09-11T00:00:00.000Z", "occ": "2026-09-10", "reply_to_id": null}]$json$::jsonb) as entraron;
select 'audit_log' as tabla, public.importar('audit_log', $json$[{"id": "a1", "type": "login", "actor_email": "ana@x.com", "actor_name": "Ana", "created_at": "2026-09-16T00:00:00.000Z", "device": "Chrome / Windows", "ip": "1.2.3.4"}]$json$::jsonb) as entraron;
select 'app_config' as tabla, public.importar('app_config', $json$[{"key": "territoryConfig", "value": {"zones": {"sur": {"label": "Sur"}}, "countryZones": {"AR": "sur"}}}, {"key": "preferences", "value": {"activityTypes": [{"key": "evento", "label": "Evento"}], "maxImages": 6}}]$json$::jsonb) as entraron;
select 'user_prefs' as tabla, public.importar('user_prefs', $json$[{"email": "benny@team-latam.com", "prefs": {"weekStart": 1, "dimPast": true}}]$json$::jsonb) as entraron;
reset role;
\set QUIET off

select lab.probar_valor('la fecha real de creación de 2019 se conservó', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select to_char(created_at at time zone 'UTC','YYYY-MM-DD') from public.posts where id='p1'$q$, '2019-03-05');
select lab.probar_valor('y la de edición también', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select to_char(last_edited_at at time zone 'UTC','YYYY-MM-DD') from public.posts where id='p1'$q$, '2019-04-01');
select lab.probar_valor('de quién era el posteo, intacto', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select author_email from public.posts where id='p1'$q$, 'ana@x.com');
select lab.probar_valor('el hito llegó entero, con sus campos originales', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select milestones->0->>'dueDate' from public.posts where id='p1'$q$, '2026-09-20');
select lab.probar_valor('la imagen quedó como ruta del bucket, no como archivo embebido', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select images[1] from public.posts where id='p1'$q$, 'posts/p1/img0.png');
select lab.probar_valor('el posteo viejo sin la mitad de los campos quedó bien igual', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select cancelled::text || '/' || coalesce(array_length(images,1),0)::text from public.posts where id='p2'$q$, 'false/0');
select lab.probar_valor('el comentario quedó colgado de su posteo', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select post_id from public.replies where id='r1'$q$, 'p1');
select lab.probar_valor('y sabe a qué fecha de la serie pertenece', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select occ::text from public.replies where id='r1'$q$, '2026-09-10');
select lab.probar_valor('el roster entró con el correo como clave', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select string_agg(email, ',' order by email) from public.members$q$, 'ana@x.com,benny@team-latam.com');
select lab.probar_valor('con su foto y su rol', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select photo_url || '/' || role from public.members where email='benny@team-latam.com'$q$, 'http://foto/admin');
select lab.probar_valor('la fecha de alta de 2024 se conservó (no se puso la de hoy)', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select to_char(approved_at at time zone 'UTC','YYYY') from public.members where email='benny@team-latam.com'$q$, '2024');
select lab.probar_valor('el ex integrante conservó su @nickname, que es para lo que existe', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select nickname from public.former_members where email='vieja@x.com'$q$, 'vieja');
select lab.probar_valor('la configuración de zonas entró como un bloque', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select value->'countryZones'->>'AR' from public.app_config where key='territoryConfig'$q$, 'sur');
select lab.probar_valor('las preferencias personales, también', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select prefs->>'weekStart' from public.user_prefs where email='benny@team-latam.com'$q$, '1');
select lab.probar_valor('la auditoría conservó su fecha', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select to_char(created_at at time zone 'UTC','YYYY-MM-DD') from public.audit_log where id='a1'$q$, '2026-09-16');
select lab.probar_valor('y el conteo final da lo que tiene que dar', lab.como('benny@team-latam.com'),
  $q$select 1$q$, $q$select filas::text from public.cuantas_filas() where tabla='posts'$q$, '2');

-- Correrla otra vez no duplica nada: es lo que hace que si se corta por
-- la mitad se pueda volver a empezar sin pensar.
select lab.probar_valor('correr la importación de nuevo no duplica nada', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', $json$[{"id": "p1", "title": "Evento", "content": "C", "date": "2026-09-10", "start_date": "2026-09-10", "end_date": "2026-09-10", "activity_type": "evento", "author_name": "Ana", "author_email": "ana@x.com", "created_at": "2019-03-05T10:00:00.000Z", "last_edited_at": "2019-04-01T10:00:00.000Z", "is_project": true, "calendar_event_id": "cal1", "milestones": [{"text": "Hito", "dueDate": "2026-09-20", "done": false}], "scopes": [{"pais": "AR"}], "liked_by": ["juan@x.com"], "images": ["posts/p1/img0.png"]}, {"id": "p2", "title": "Rutina vieja", "content": "C", "date": "2018-01-01", "start_date": "2018-01-01", "end_date": "2018-01-01", "activity_type": "rutina", "author_name": "Alguien", "created_at": "2018-01-01T00:00:00.000Z"}]$json$::jsonb)$q$,
  $q$select count(*)::text from public.posts$q$, '2');
-- Y el bucket sigue protegido: una imagen embebida rebota incluso
-- importando, que es el único camino que puede escribir fechas viejas.
select lab.probar_valor('una imagen embebida en base64 NO entra, ni importando', lab.como('benny@team-latam.com'),
  $q$select public.importar('posts', $json$[{"id": "p1", "title": "Evento", "content": "C", "date": "2026-09-10", "start_date": "2026-09-10", "end_date": "2026-09-10", "activity_type": "evento", "author_name": "Ana", "author_email": "ana@x.com", "created_at": "2019-03-05T10:00:00.000Z", "last_edited_at": "2019-04-01T10:00:00.000Z", "is_project": true, "calendar_event_id": "cal1", "milestones": [{"text": "Hito", "dueDate": "2026-09-20", "done": false}], "scopes": [{"pais": "AR"}], "liked_by": ["juan@x.com"], "images": ["data:image/png;base64,iVBORw0KGgo="]}]$json$::jsonb)$q$,
  $q$select 1::text$q$,
  'new row for relation "posts" violates check constraint "posts_listas"');
select n, '  FALLA  ' || nombre || ' — ' || left(detalle,90) as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' || count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;