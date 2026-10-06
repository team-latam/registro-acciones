\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members, public.user_prefs, public.calendar_sacados, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com','Benny LatAm','benny','admin'),
  ('viejo@x.com','Benny Viejo','bennyv','member'),
  ('juan@x.com','Juan','juan','member');
insert into public.user_prefs(email, prefs) values ('viejo@x.com', '{"lang":"he"}');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,
                         liked_by,editors,mentions,participants,milestones,last_edited_by,last_edited_by_email,project_done_by,last_edited_at) values
  ('p1','Del viejo','Hola @bennyv y @juan, chau @bennyvx','2026-01-10','2026-01-10','2026-01-10','visita','Benny Viejo','viejo@x.com',
   '{viejo@x.com,juan@x.com}','{viejo@x.com,benny@team-latam.com}','{viejo@x.com}',
   '[{"email":"viejo@x.com","name":"Benny Viejo"},{"email":"benny@team-latam.com","name":"Benny"},{"name":"Zeka"}]',
   '[{"id":"h1","title":"Uno","owner":"viejo@x.com"},{"id":"h2","title":"Dos","owners":["viejo@x.com","juan@x.com"]}]',
   'Benny Viejo','viejo@x.com','viejo@x.com','2026-02-01'),
  ('p2','De Juan','nada','2026-01-11','2026-01-11','2026-01-11','curso','Juan','juan@x.com',
   '{}','{}','{}','[]','[]',null,null,null,null);
insert into public.replies(id,post_id,content,author_name,author_email,liked_by,mentions) values
  ('r1','p2','¡Bien @BennyV!','Benny Viejo','viejo@x.com','{viejo@x.com}','{viejo@x.com}');

-- Un integrante común no puede.
select lab.probar('un integrante común no puede unificar cuentas', lab.como('juan@x.com'),
  $q$select public.unificar_cuentas('viejo@x.com','benny@team-latam.com')$q$, false);
select lab.probar('la cuenta nueva tiene que estar en el equipo', lab.como('benny@team-latam.com'),
  $q$select public.unificar_cuentas('viejo@x.com','nadie@x.com')$q$, false);

-- El admin la usa de verdad.
set role authenticated;
\o /dev/null
select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, false);
\o /dev/null
select public.unificar_cuentas('VIEJO@x.com', 'benny@team-latam.com');
reset role;
select set_config('request.jwt.claims', '', false);
\o

insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'lo que cargó pasa a la cuenta nueva, con su nombre', true, author_email = 'benny@team-latam.com' and author_name = 'Benny LatAm', author_email || ' ' || author_name from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'me gusta, editores y menciones: reemplazados y sin repetir', true,
       liked_by @> '{benny@team-latam.com,juan@x.com}' and not ('viejo@x.com' = any(liked_by))
       and editors = '{benny@team-latam.com}' and mentions = '{benny@team-latam.com}',
       liked_by::text || editors::text || mentions::text from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'participantes: el viejo pasa al nuevo, una sola vez, y el de sin correo sigue', true,
       jsonb_array_length(participants) = 2 and participants::text not like '%viejo%' and participants::text like '%Zeka%',
       participants::text from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'hitos: responsable y responsables', true,
       milestones -> 0 ->> 'owner' = 'benny@team-latam.com' and milestones -> 1 -> 'owners' @> '["benny@team-latam.com","juan@x.com"]' and milestones::text not like '%viejo%',
       milestones::text from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'quién editó y quién completó el proyecto', true,
       last_edited_by_email = 'benny@team-latam.com' and project_done_by = 'benny@team-latam.com' and last_edited_at = '2026-02-01',
       coalesce(last_edited_by_email,'') || ' ' || coalesce(project_done_by,'') from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'el @usuario escrito pasa al nuevo, sin tocar uno que solo empieza igual', true,
       content = 'Hola @benny y @juan, chau @bennyvx', content from public.posts where id = 'p1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'comentarios: autor, me gusta, menciones y el @ del texto (sin importar mayúsculas)', true,
       author_email = 'benny@team-latam.com' and liked_by = '{benny@team-latam.com}' and mentions = '{benny@team-latam.com}' and content = '¡Bien @benny!',
       author_email || ' ' || content from public.replies where id = 'r1';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'lo de otros no se toca', true, author_email = 'juan@x.com' and author_name = 'Juan', author_email from public.posts where id = 'p2';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'las preferencias pasan si la cuenta nueva no tenía', true, prefs ->> 'lang' = 'he', prefs::text from public.user_prefs where email = 'benny@team-latam.com';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'no queda anotado como edición en el registro de actividad', true, count(*) = 0, count(*)::text from public.audit_log where type like 'post_%';

-- Un correo que no está en ningún lado (ni en Personas ni entre los ex
-- integrantes: la cuenta se borró a mano) también se puede pasar.
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,liked_by,editors,mentions,participants,milestones) values
  ('p3','','Rutina del borrado','2026-09-11','2026-09-11','2026-09-11','rutina','Borrado','Borrado@x.com','{borrado@x.com,juan@x.com}','{}','{}','[]','[]');
insert into public.replies(id,post_id,content,author_name,author_email,liked_by,mentions) values
  ('r2','p2','de un borrado','Borrado','borrado@x.com','{BORRADO@x.com}','{}');
set role authenticated;
\o /dev/null
select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, false);
select public.unificar_cuentas('borrado@x.com', 'benny@team-latam.com');
reset role;
select set_config('request.jwt.claims', '', false);
\o
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'un correo sin ficha: su rutina pasa a la cuenta nueva', true, author_email = 'benny@team-latam.com', author_email from public.posts where id = 'p3';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'un correo sin ficha: sus me gusta también, en el mismo lugar', true, liked_by = '{benny@team-latam.com,juan@x.com}', liked_by::text from public.posts where id = 'p3';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'un correo sin ficha: sus comentarios y sus me gusta en comentarios', true,
       author_email = 'benny@team-latam.com' and liked_by = '{benny@team-latam.com}', author_email || liked_by::text from public.replies where id = 'r2';


-- ---------- El admin fijo y el registro (docs/AUDITORIA.md, I6) ----------
-- Después de unificar la sesión queda sin persona (así corren los
-- arreglos): para mirar el resultado hace falta esta ventana del laboratorio.
create or replace function lab.leer(consulta text) returns text
  language plpgsql security definer set search_path = '' as $$
declare r text; begin execute consulta into r; return r; end $$;
grant execute on function lab.leer(text) to authenticated;
grant usage on schema lab to authenticated;
insert into public.members(email, name, nickname, role) values ('rol@x.com','Admin por rol','rol','admin')
  on conflict (email) do nothing;
select lab.probar('un admin por rol NO se queda con lo del admin fijo', lab.como('rol@x.com'),
  $q$select public.unificar_cuentas('benny@team-latam.com','rol@x.com')$q$, false);
select lab.probar('ni le pasa lo de otro al admin fijo', lab.como('rol@x.com'),
  $q$select public.unificar_cuentas('juan@x.com','benny@team-latam.com')$q$, false);
select lab.probar('entre otras dos cuentas, un admin por rol sí puede', lab.como('rol@x.com'),
  $q$select public.unificar_cuentas('juan@x.com','rol@x.com')$q$, true);
select lab.probar_valor('y queda anotado en el registro de actividad', lab.como('rol@x.com'),
  $q$select public.unificar_cuentas('juan@x.com','rol@x.com')$q$,
  $q$select lab.leer($x$select string_agg(type || '|' || actor_email || '|' || target_email || '|' || detail, ';') from public.audit_log where type = 'accounts_merged' and actor_email = 'rol@x.com'$x$)$q$,
  'accounts_merged|rol@x.com|juan@x.com|rol@x.com');
select lab.probar('el tipo nuevo no lo puede escribir nadie a mano', lab.como('rol@x.com'),
  $q$insert into public.audit_log(id, type, actor_email, actor_name, target_email) values ('am1','accounts_merged','rol@x.com','Rol','juan@x.com')$q$, false);
update public.members set nickname = 'ju.an(' where email = 'juan@x.com';
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email)
  values ('pnick','N','Hola @ju.an( y @juXan(','2026-01-12','2026-01-12','2026-01-12','visita','Juan','juan@x.com');
select lab.probar_valor('un @usuario con punto y paréntesis se reemplaza solo él', lab.como('rol@x.com'),
  $q$select public.unificar_cuentas('juan@x.com','rol@x.com')$q$,
  $q$select lab.leer($x$select content from public.posts where id = 'pnick'$x$)$q$, 'Hola @rol y @juXan(');

\set QUIET off
select n, '  FALLA  ' || nombre as falla, detalle from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
