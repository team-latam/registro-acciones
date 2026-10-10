-- ============================================================
-- Revisar lo que llegó de Google Calendar
-- ============================================================
-- Todo evento creado directo en Google Calendar entra al Registro como
-- "Otro" y sin lugar (lo trae el sincronizador o el navegador de alguien,
-- a nombre de "Google Calendar"). En Administración › Revisar lo de
-- Calendar un admin los ordena de a muchos: les pone tipo, lugar y
-- personas, o los saca del Registro. Pedido del usuario el 3/10/2026
-- (REDISENO.md, tanda 19).
--
-- Tres piezas:
--   calendar_sugerencias  lo que propuso la clasificación del 3/10/2026
--                         para cada evento (sin títulos ni fechas).
--   calendar_sacados      los eventos que un admin sacó del Registro: los
--                         dos sincronizadores los saltean, así no vuelven.
--   dos funciones         clasificar_importados y sacar_del_registro.
--
-- Nada de esto avisa a nadie ni toca Google Calendar: no cambia la fecha
-- de edición (sin "Cambios en tus eventos" ni "Editado por") y no pasa
-- por la app que sincroniza con Calendar.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

create table if not exists public.calendar_sugerencias (
  evento     text primary key,         -- el id del evento (o de la serie) en Google Calendar
  grupo      text not null,
  tipo       text,
  lugares    jsonb not null default '[]'::jsonb,   -- con la forma de posts.scopes
  personas   text[] not null default '{}',         -- nombres tal como aparecen en el título
  confianza  text not null default 'media'
);

alter table public.calendar_sugerencias
  drop constraint if exists sugerencias_forma;
alter table public.calendar_sugerencias
  add constraint sugerencias_forma check (
    grupo in ('actividad', 'reunion', 'personal', 'gestion')
    and (tipo is null or tipo ~ '^[a-z0-9]{1,40}$')
    and confianza in ('alta', 'media', 'baja')
    and jsonb_typeof(lugares) = 'array' and jsonb_array_length(lugares) <= 15
    and coalesce(array_length(personas, 1), 0) <= 10
  );

-- El id del evento tiene tope, como el de calendar_sacados (abajo): Google
-- los hace de hasta 1024 caracteres, y los reales miden menos de 200. Nadie
-- las escribe desde el navegador, pero un campo sin tope es un campo que el
-- día que alguien los escriba se llena de cualquier cosa (10/10/2026,
-- docs/AUDITORIA.md, R27). NOT VALID + validar, como el id de un posteo
-- (03-validacion.sql): lo que ya estuviera guardado no frena la aplicación.
alter table public.calendar_sugerencias drop constraint if exists sugerencias_evento;
alter table public.calendar_sugerencias
  add constraint sugerencias_evento check (length(evento) between 1 and 1024) not valid;
do $$
begin
  alter table public.calendar_sugerencias validate constraint sugerencias_evento;
exception when check_violation then
  raise notice 'Hay sugerencias con un id de evento de otro largo: sugerencias_evento vale solo para lo nuevo.';
end
$$;

create table if not exists public.calendar_sacados (
  evento     text primary key,
  titulo     text not null default '',
  sacado_por text not null,
  sacado_el  timestamptz not null default now()
);

-- Una copia del posteo tal como estaba al sacarlo, para poder devolverlo
-- igual (ver devolver_al_registro). Los sacados antes de que existiera
-- (3/10/2026) no la tienen: se vuelven a traer de Google Calendar.
alter table public.calendar_sacados add column if not exists fila jsonb;

alter table public.calendar_sacados
  drop constraint if exists sacados_textos;
alter table public.calendar_sacados
  add constraint sacados_textos check (
    length(evento) between 1 and 1024
    and length(titulo) <= 300
    and length(sacado_por) between 1 and 200
  );

-- 02-politicas.sql reparte los permisos de todas las tablas que existen
-- cuando corre, y estas nacen después: se dan acá. Quién ve qué fila lo
-- deciden las políticas de abajo.
grant select on public.calendar_sugerencias to authenticated;
grant select, delete on public.calendar_sacados to authenticated;
-- La llave de servicio, a mano (ver 02-politicas.sql): el trabajo de la
-- madrugada lee lo sacado del Registro y la copia guarda las dos.
grant all on public.calendar_sugerencias, public.calendar_sacados to service_role;
-- El `grant … on all tables` del 02 les suma insert y update a estas
-- dos en la segunda aplicación (RLS las frenaba igual, porque no hay
-- política de escritura). Se sacan, para que lo de arriba sea verdad y el
-- día que alguien agregue una política no quede abierto sin querer
-- (docs/AUDITORIA.md, B4).
revoke insert, update on public.calendar_sugerencias, public.calendar_sacados from authenticated;
revoke delete on public.calendar_sugerencias from authenticated;
revoke all on public.calendar_sugerencias, public.calendar_sacados from anon;

alter table public.calendar_sugerencias enable row level security;
alter table public.calendar_sacados     enable row level security;

-- Las sugerencias las lee solo un admin (es quien ordena). Nadie las
-- escribe desde el navegador: vienen de este archivo.
drop policy if exists sugerencias_leer on public.calendar_sugerencias;
create policy sugerencias_leer on public.calendar_sugerencias for select
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- Lo sacado lo lee cualquiera que puede escribir posteos: el navegador
-- de cualquiera de ellos sincroniza con Calendar y tiene que saltearlo.
-- Se escribe solo con sacar_del_registro; volver a traer uno es borrarlo
-- de acá, y eso lo hace un admin.
drop policy if exists sacados_leer on public.calendar_sacados;
create policy sacados_leer on public.calendar_sacados for select
  using ((select public.es_admin_fijo()) or (select public.puede_escribir()));

drop policy if exists sacados_devolver on public.calendar_sacados;
create policy sacados_devolver on public.calendar_sacados for delete
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- Un posteo que vino de Calendar: lo creó "Google Calendar", sin correo
-- de nadie, y está atado a un evento.
create or replace function public.es_importado(p public.posts) returns boolean
  language sql stable as $$
  select p.author_name = 'Google Calendar' and coalesce(p.author_email, '') = ''
     and p.calendar_event_id is not null
$$;


-- ---------- Ponerles tipo, lugar y personas, de a muchos ----------
-- p_cambios: [{ "id": "<posteo>", "activity_type"?: "...", "scopes"?: [...],
-- "participants"?: [...], "location"?: "..." }, ...]. Lo que no viene, no
-- se toca. `scopes` es a quién alcanza (país, ciudad, región, toda LatAm);
-- `location`, dónde fue de verdad ("Israel", "Online", una dirección):
-- son dos cosas distintas, como en el formulario de un evento.
--
-- `security invoker`: corre con los permisos de quien llama, así que pasa
-- por las mismas políticas, disparadores y validaciones que cualquier
-- edición. No toca last_edited_*: ordenar no es editar el contenido.
create or replace function public.clasificar_importados(p_cambios jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  c jsonb;
  n integer := 0;
  filas integer;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Ordenar lo que vino de Calendar lo hace un admin'
      using errcode = 'insufficient_privilege';
  end if;
  -- Ordenar no es editar: no va al registro de actividad (registrar_posteo
  -- mira esta marca, que vale hasta el final de esta transacción). Desde la
  -- API no se puede poner a mano: solo la pone esta función.
  perform set_config('registro.ordenando_calendar', 'si', true);
  if jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) > 1000 then
    raise exception 'Se ordenan hasta 1000 por vez'
      using errcode = 'check_violation';
  end if;
  for c in select * from jsonb_array_elements(p_cambios) loop
    if jsonb_typeof(c) <> 'object' or coalesce(c ->> 'id', '') = ''
       or exists (select 1 from jsonb_object_keys(c) k
                   where k not in ('id', 'activity_type', 'scopes', 'participants', 'location')) then
      raise exception 'Cada cambio es {id, activity_type, scopes, participants, location}'
        using errcode = 'check_violation';
    end if;
    update public.posts p set
      activity_type = case when c ? 'activity_type' then c ->> 'activity_type' else p.activity_type end,
      scopes        = case when c ? 'scopes' then c -> 'scopes' else p.scopes end,
      participants  = case when c ? 'participants' then c -> 'participants' else p.participants end,
      location      = case when c ? 'location' then nullif(c ->> 'location', '') else p.location end
    where p.id = c ->> 'id' and public.es_importado(p);
    get diagnostics filas = row_count;
    n := n + filas;
  end loop;
  return n;
end $$;

revoke execute on function public.clasificar_importados(jsonb) from public, anon;
grant execute on function public.clasificar_importados(jsonb) to authenticated;


-- ---------- Sacarlos del Registro ----------
-- Borra el posteo (y sus respuestas, en cascada) y anota el evento en
-- calendar_sacados para que no vuelva. Google Calendar no se toca.
--
-- `security definer` porque borrar posteos es solo del admin fijo (ver
-- posts_borrar): esto abre esa puerta a los admins, pero solo para lo que
-- vino de Calendar, y deja anotado quién lo sacó. El registro de
-- actividad anota cada borrado (registrar_posteo, 04-funciones.sql).
create or replace function public.sacar_del_registro(p_ids text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  p public.posts;
  n integer := 0;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Sacar del Registro lo que vino de Calendar lo hace un admin'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_ids, 1), 0) > 1000 then
    raise exception 'Se sacan hasta 1000 por vez'
      using errcode = 'check_violation';
  end if;
  for p in select * from public.posts where id = any(p_ids) loop
    if not public.es_importado(p) then continue; end if;
    insert into public.calendar_sacados (evento, titulo, sacado_por, fila)
    values (p.calendar_event_id, left(coalesce(p.title, ''), 300), yo, to_jsonb(p))
    on conflict (evento) do nothing;
    delete from public.posts where id = p.id;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.sacar_del_registro(text[]) from public, anon;
grant execute on function public.sacar_del_registro(text[]) to authenticated;


-- ---------- Devolverlos al Registro ----------
-- Pasó el 3/10/2026: "Sacar del Registro" se usó creyendo que marcaba el
-- evento como listo. Esto deshace: el posteo vuelve tal como estaba (de
-- la copia guardada en `fila`) y el evento deja de estar sacado. Los que
-- no tienen copia (sacados antes de que existiera) solo dejan de estar
-- sacados, y la app los vuelve a traer de Google Calendar; esos vuelven
-- como llegaron la primera vez ("Otro", sin lugar). Los comentarios que
-- tenía no vuelven.
--
-- Los valores de fábrica de las columnas obligatorias de `posts`, como
-- jsonb ({"cancelled": false, "sin_calendar": false, "liked_by": [], …}).
-- Para devolver una copia guardada ANTES de que existiera una columna:
-- jsonb_populate_record deja en null lo que la copia no trae, y una
-- columna `not null` lo rechaza. Pasó con sin_calendar (del 4/10/2026):
-- «Devolver al Registro» fallaba con lo sacado el 3/10 (docs/AUDITORIA.md,
-- R9). Se leen del catálogo, no de una lista a mano, para que la próxima
-- columna obligatoria no repita el problema. Los default son los del
-- esquema (false, '[]', now()…), no texto de nadie.
create or replace function public.posts_de_fabrica() returns jsonb
  language plpgsql stable set search_path = '' as $$
declare r record; v jsonb; fabrica jsonb := '{}'::jsonb;
begin
  for r in select a.attname, pg_get_expr(d.adbin, d.adrelid) as expr
             from pg_attribute a
             join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
            where a.attrelid = 'public.posts'::regclass and a.attnum > 0
              and not a.attisdropped and a.attnotnull
  loop
    execute 'select to_jsonb(' || r.expr || ')' into v;
    fabrica := fabrica || jsonb_build_object(r.attname, v);
  end loop;
  return fabrica;
end $$;
revoke execute on function public.posts_de_fabrica() from public, anon, authenticated;

-- Devuelve { "devueltos": n, "aTraer": [eventos sin copia] }.
create or replace function public.devolver_al_registro(p_eventos text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.calendar_sacados;
  n integer := 0;
  traer text[] := '{}';
  sesion text := current_setting('request.jwt.claims', true);
  fabrica jsonb := public.posts_de_fabrica();
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Devolver al Registro lo hace un admin'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(array_length(p_eventos, 1), 0) > 1000 then
    raise exception 'Se devuelven hasta 1000 por vez'
      using errcode = 'check_violation';
  end if;
  -- Sin sesión de persona desde acá (ya se comprobó que es un admin):
  -- con la del admin, la base le ponía al posteo devuelto la hora de
  -- ahora como creación y edición, y aparecía como «nuevo» para todos
  -- (docs/AUDITORIA.md, B6). Así vuelve con sus fechas. Al terminar se
  -- repone la sesión, para lo que siga en la misma transacción.
  perform set_config('request.jwt.claims', '{}', true);
  for s in select * from public.calendar_sacados where evento = any(p_eventos) loop
    if s.fila is not null then
      -- Lo de fábrica debajo de la copia: lo que la copia trae manda, y
      -- lo que no trae (una columna nacida después) no queda en null.
      insert into public.posts select * from jsonb_populate_record(null::public.posts, fabrica || s.fila)
      on conflict (id) do nothing;
      n := n + 1;
    else
      traer := traer || s.evento;
    end if;
    delete from public.calendar_sacados where evento = s.evento;
  end loop;
  perform set_config('request.jwt.claims', coalesce(sesion, ''), true);
  return jsonb_build_object('devueltos', n, 'aTraer', to_jsonb(traer));
end $$;

revoke execute on function public.devolver_al_registro(text[]) from public, anon;
grant execute on function public.devolver_al_registro(text[]) to authenticated;
