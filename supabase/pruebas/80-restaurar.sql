\set QUIET on
\set ON_ERROR_STOP on
-- Restaurar una copia (supabase/respaldo/restaurar.mjs, docs/AUDITORIA.md
-- I7). La herramienta carga cada tabla con la llave de servicio, por la
-- API: un INSERT … ON CONFLICT DO UPDATE de las filas de la copia. Acá se
-- comprueba lo que eso tiene que dar en la base de verdad: que cada fila
-- vuelve IDÉNTICA (sus fechas incluidas, que las reglas de la hora del
-- servidor no le ponen la de ahora), que la auditoría no se llena de
-- "creó" falsos, y que pisar una fila cambiada la deja como en la copia.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members,
         public.access_requests, public.user_prefs, public.app_config, public.audit_log,
         public.calendar_sugerencias, public.calendar_sacados cascade;

-- Datos de antes, con fechas viejas (cargados sin sesión, como los deja la copia).
insert into public.members(email, name, nickname, role, approved_at) values
  ('ana@x.com', 'Ana', 'ana', 'admin', '2025-01-02T10:00:00Z'), ('juan@x.com', 'Juan', 'juan', 'member', '2025-03-04T10:00:00Z');
insert into public.former_members(email, name, nickname, revoked_at) values ('vieja@x.com', 'Vieja', 'vieja', '2025-05-06T10:00:00Z');
insert into public.access_requests(email, name, status, requested_at) values ('nuevo@x.com', 'Nuevo', 'pending', '2026-01-01T10:00:00Z');
insert into public.app_config(key, value) values ('preferences', '{"activityTypes":[]}');
insert into public.user_prefs(email, prefs) values ('juan@x.com', '{"weekStart":1}');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email,
                         created_at, last_edited_at, last_edited_by, last_edited_by_email, images, liked_by) values
  ('p1', 'Visita a Rosario', 'texto', '2025-06-10', '2025-06-10', '2025-06-12', 'visita', 'Juan', 'juan@x.com',
   '2025-06-01T09:00:00Z', '2025-06-15T09:00:00Z', 'Ana', 'ana@x.com', '{posts/p1/img0_1.jpg}', '{ana@x.com}');
insert into public.replies(id, post_id, content, author_name, author_email, created_at) values
  ('r1', 'p1', 'un comentario', 'Ana', 'ana@x.com', '2025-06-16T09:00:00Z');
insert into public.audit_log(id, type, actor_email, actor_name, ip, created_at) values
  ('a1', 'login', 'juan@x.com', 'Juan', '200.1.2.3', '2025-06-01T08:00:00Z');
insert into public.calendar_sugerencias(evento, grupo) values ('ev1', 'actividad');
insert into public.calendar_sacados(evento, sacado_por, sacado_el) values ('ev2', 'ana@x.com', '2025-07-01T10:00:00Z');

-- La copia: cada tabla en jsonb, como la deja respaldar.mjs.
create temp table copia as
  select t, (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from (select * from public.members) x) as filas from (values ('members')) v(t);
do $$
declare t text;
begin
  delete from copia;
  foreach t in array array['members','former_members','access_requests','app_config','user_prefs',
                           'posts','replies','audit_log','calendar_sugerencias','calendar_sacados'] loop
    execute format('insert into copia select %L, coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from public.%I x', t, t);
  end loop;
end $$;
grant select on copia to service_role;

-- Restaurar todo en el orden de restaurar.mjs, con la llave de servicio.
create or replace function lab.restaurar_todo() returns void language plpgsql as $$
declare t text; clave text;
begin
  foreach t in array array['members','former_members','access_requests','app_config','user_prefs',
                           'posts','replies','audit_log','calendar_sugerencias','calendar_sacados'] loop
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, (select filas from copia where t = %L))', t, t, t);
  end loop;
end $$;
grant execute on function lab.restaurar_todo() to service_role;
grant usage on schema lab to service_role;

-- La foto de cómo estaba todo, para comparar.
create or replace function lab.foto() returns text language sql as $$
  select string_agg(t || '=' || md5(filas::text), ' ' order by t) from (
    select 'members' t, jsonb_agg(to_jsonb(x) order by email) filas from public.members x union all
    select 'former_members', jsonb_agg(to_jsonb(x) order by email) from public.former_members x union all
    select 'access_requests', jsonb_agg(to_jsonb(x) order by email) from public.access_requests x union all
    select 'app_config', jsonb_agg(to_jsonb(x) order by key) from public.app_config x union all
    select 'user_prefs', jsonb_agg(to_jsonb(x) order by email) from public.user_prefs x union all
    select 'posts', jsonb_agg(to_jsonb(x) order by id) from public.posts x union all
    select 'replies', jsonb_agg(to_jsonb(x) order by id) from public.replies x union all
    select 'audit_log', jsonb_agg(to_jsonb(x) order by id) from public.audit_log x union all
    select 'calendar_sugerencias', jsonb_agg(to_jsonb(x) order by evento) from public.calendar_sugerencias x union all
    select 'calendar_sacados', jsonb_agg(to_jsonb(x) order by evento) from public.calendar_sacados x) s
$$;
grant execute on function lab.foto() to service_role;
create temp table antes as select lab.foto() as f;
grant select on antes to service_role;

-- ---------- En una base vacía ----------
select lab.probar_valor_servicio('en una base vacía, todo vuelve idéntico (fechas incluidas)',
  $q$truncate public.posts, public.replies, public.members, public.former_members,
       public.access_requests, public.user_prefs, public.app_config, public.audit_log,
       public.calendar_sugerencias, public.calendar_sacados cascade;
     select lab.restaurar_todo()$q$,
  $q$select case when lab.foto() = (select f from antes) then 'igual' else 'distinto' end$q$, 'igual');
select lab.probar_valor_servicio('y la auditoría no se llena de «creó» falsos',
  $q$truncate public.posts, public.replies, public.audit_log cascade;
     insert into public.posts select * from jsonb_populate_recordset(null::public.posts, (select filas from copia where t = 'posts'));
     insert into public.replies select * from jsonb_populate_recordset(null::public.replies, (select filas from copia where t = 'replies'));
     insert into public.audit_log select * from jsonb_populate_recordset(null::public.audit_log, (select filas from copia where t = 'audit_log'))$q$,
  $q$select count(*)::text from public.audit_log$q$, '1');

-- ---------- Encima de lo que hay ----------
select lab.probar_valor_servicio('pisar una fila cambiada la deja como estaba en la copia',
  $q$update public.posts set title = 'Cambiado', content = 'otro' where id = 'p1';
     insert into public.posts select * from jsonb_populate_recordset(null::public.posts, (select filas from copia where t = 'posts'))
     on conflict (id) do update set title = excluded.title, content = excluded.content,
       created_at = excluded.created_at, last_edited_at = excluded.last_edited_at,
       last_edited_by = excluded.last_edited_by, last_edited_by_email = excluded.last_edited_by_email$q$,
  $q$select title || ' / ' || to_char(created_at at time zone 'utc', 'YYYY-MM-DD') || ' / ' || last_edited_by from public.posts where id = 'p1'$q$,
  'Visita a Rosario / 2025-06-01 / Ana');
select lab.probar_valor_servicio('un comentario sin su posteo no entra (por eso van después)',
  $q$truncate public.posts cascade;
     insert into public.replies select * from jsonb_populate_recordset(null::public.replies, (select filas from copia where t = 'replies'))$q$,
  $q$select 'entró'$q$, 'insert or update on table "replies" violates foreign key constraint "r');

\set QUIET off
\echo ''
select n, case when esperado = obtenido then '  ok' else '  FALLA' end as r, nombre, detalle
from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
