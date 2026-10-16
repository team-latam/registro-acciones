-- ============================================================
-- Traer una lista con gente de una ciudad o de un país (14/10/2026)
-- ============================================================
-- La Agenda ya acepta contactos que no van con una institución sino con una
-- ciudad, un país, una región o toda LatAm (20-contactos-por-lugar.sql), pero
-- «traer una lista» (agenda_traer, 19-agenda.sql) solo sabía de
-- instituciones. El usuario lo recordó al ver cómo quedaba su Mapeo de
-- comunidades: el presidente de la comunidad de Córdoba, quien cubre Brasil,
-- son contactos de un lugar, no de una «Comunidad de Córdoba» inventada.
--
-- Cambia en tres cosas:
--   - agenda_traer recibe un tercer parámetro, `p_lugares`: una lista de
--     lugares, cada uno con su gente, como las instituciones pero sin
--     institución:
--       [{nivel: ciudad|pais|region|latam, country, city, zona,
--         gente: [{name, cargo, telefonos: [{n, wa}]}]}]
--     Cada contacto queda como los que se suman a mano (nivel, país, ciudad…),
--     y la restricción de 20-contactos-por-lugar.sql no deja nada a medias.
--   - `contactos.lista`: de qué lista vino cada contacto de un lugar (las
--     instituciones y las personas ya lo sabían). Sirve para «Ver Agenda» de
--     una lista que solo trajo lugares.
--   - Buscar o crear a la persona es ahora una función aparte
--     (agenda_persona_traida), que usan las dos partes: no se duplica la
--     misma lógica. Una persona que ya estaba (mismo nombre, sin tildes ni
--     mayúsculas) es la misma ficha y se le suman los teléfonos que no tenía.
--
-- Se puede traer solo instituciones, solo lugares, o las dos cosas. Si
-- alguien ya era contacto de ese mismo lugar, no se repite.

alter table public.contactos add column if not exists lista text references public.agenda_listas(id) on delete set null;

create or replace function public.agenda_persona_traida(g jsonb, lid text, out pid text, out nueva boolean)
  language plpgsql security definer set search_path = '' as $$
declare ya public.personas; tel jsonb;
begin
  select * into ya from public.personas
   where lower(public.sin_tildes(btrim(name))) = lower(public.sin_tildes(btrim(g ->> 'name')))
   order by created_at limit 1;
  if ya.id is null then
    pid := public.agenda_id(); nueva := true;
    insert into public.personas(id, name, telefonos, lista)
    values (pid, g ->> 'name', coalesce(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' end, '[]'::jsonb), lid);
  else
    pid := ya.id; nueva := false;
    -- Los teléfonos que no tenía (por los números, sin espacios ni guiones), hasta seis.
    for tel in select e from jsonb_array_elements(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' else '[]'::jsonb end) e loop
      update public.personas p set telefonos = p.telefonos || jsonb_build_array(tel)
       where p.id = pid and jsonb_array_length(p.telefonos) < 6
         and not exists (select 1 from jsonb_array_elements(p.telefonos) y
                          where regexp_replace(y ->> 'n', '[^0-9]', '', 'g') = regexp_replace(tel ->> 'n', '[^0-9]', '', 'g'));
    end loop;
  end if;
end $$;
revoke execute on function public.agenda_persona_traida(jsonb, text) from public, anon, authenticated;

-- La de dos parámetros se va: con las dos, llamar con dos sería ambiguo.
drop function if exists public.agenda_traer(text, jsonb);
create or replace function public.agenda_traer(p_nombre text, p_instituciones jsonb, p_lugares jsonb default '[]'::jsonb) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  lid text := public.agenda_id(); i jsonb; l jsonb; g jsonb; iid text; pid text; es_nueva boolean; orden int;
  creadas text[] := '{}'; ya_estaban text[] := '{}'; n_inst int := 0; n_lugares int := 0; n_contactos int := 0;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Traer una lista lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(jsonb_typeof(p_instituciones), '') <> 'array' or coalesce(jsonb_typeof(p_lugares), '') <> 'array'
     or jsonb_array_length(p_instituciones) + jsonb_array_length(p_lugares) not between 1 and 3000 then
    raise exception 'La lista viene vacía o es demasiado larga (hasta 3000 instituciones y lugares)' using errcode = 'check_violation';
  end if;
  insert into public.agenda_listas(id, name) values (lid, p_nombre);
  for i in select e from jsonb_array_elements(p_instituciones) e loop
    iid := public.agenda_id();
    insert into public.instituciones(id, name, country, city, address, tipo, estado, lista)
    values (iid, i ->> 'name', i ->> 'country', i ->> 'city', i ->> 'address', i ->> 'tipo', coalesce(i ->> 'estado', 'activa'), lid);
    n_inst := n_inst + 1;
    orden := 0;
    for g in select e from jsonb_array_elements(case when jsonb_typeof(i -> 'gente') = 'array' then i -> 'gente' else '[]'::jsonb end) e loop
      select p.pid, p.nueva into pid, es_nueva from public.agenda_persona_traida(g, lid) p;
      if es_nueva then creadas := creadas || pid;
      elsif not pid = any(creadas) and not pid = any(ya_estaban) then ya_estaban := ya_estaban || pid; end if;
      insert into public.contactos(id, institucion, persona, cargo, orden)
      values (public.agenda_id(), iid, pid, g ->> 'cargo', orden)
      on conflict (institucion, persona) do nothing;
      orden := orden + 1; n_contactos := n_contactos + 1;
    end loop;
  end loop;
  -- La gente de un lugar: sin institución. Si ya era contacto de ese mismo lugar, no se repite
  -- (contactos_lugar_unico, 20-contactos-por-lugar.sql).
  for l in select e from jsonb_array_elements(p_lugares) e loop
    n_lugares := n_lugares + 1;
    orden := 0;
    for g in select e from jsonb_array_elements(case when jsonb_typeof(l -> 'gente') = 'array' then l -> 'gente' else '[]'::jsonb end) e loop
      select p.pid, p.nueva into pid, es_nueva from public.agenda_persona_traida(g, lid) p;
      if es_nueva then creadas := creadas || pid;
      elsif not pid = any(creadas) and not pid = any(ya_estaban) then ya_estaban := ya_estaban || pid; end if;
      insert into public.contactos(id, institucion, persona, cargo, orden, nivel, country, city, zona, lista)
      values (public.agenda_id(), null, pid, g ->> 'cargo', orden, l ->> 'nivel', l ->> 'country', l ->> 'city', l ->> 'zona', lid)
      on conflict do nothing;
      orden := orden + 1; n_contactos := n_contactos + 1;
    end loop;
  end loop;
  return jsonb_build_object('lista', lid, 'instituciones', n_inst, 'lugares', n_lugares, 'contactos', n_contactos,
    'personas_nuevas', coalesce(array_length(creadas, 1), 0), 'personas_que_ya_estaban', coalesce(array_length(ya_estaban, 1), 0));
end $$;
revoke execute on function public.agenda_traer(text, jsonb, jsonb) from public, anon;
grant execute on function public.agenda_traer(text, jsonb, jsonb) to authenticated;
