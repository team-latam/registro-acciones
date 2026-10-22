-- ============================================================
-- Sacar una lista de la Agenda (22/10/2026)
-- ============================================================
-- Hasta hoy una lista traída (Administración › Agenda) no se podía sacar:
-- la base dejaba borrar su renglón, pero eso solo le quitaba el nombre y
-- las instituciones y la gente quedaban sueltas. El usuario pidió poder
-- sacarla, con un botón en el mismo renglón de la lista.
--
-- agenda_sacar_lista(p_lista, p_ejecutar): solo un admin.
--   p_ejecutar = false  no toca nada y cuenta qué pasaría (la app lo usa
--                       para mostrar el aviso antes de pedir confirmar).
--   p_ejecutar = true   lo hace, todo junto o nada.
--
-- Lo que se saca: las instituciones de la lista, quién figuraba en ellas
-- (también lo que alguien sumó a mano a esas instituciones: la institución
-- se va), los contactos de ciudades y países que trajo la lista, y la lista.
--
-- Las personas (elección del usuario, 22/10/2026: la opción «A»). Solo se
-- piensa en borrar a quien vino de ESTA lista (`personas.lista`): una ficha
-- sumada a mano o traída por otra lista no se toca nunca. De esas, se
-- CONSERVA la que:
--   - figura en algún evento (el disparador personas_no_borrar_en_uso de
--     18-personas.sql igual no dejaría borrarla);
--   - tiene una nota, un correo o idiomas (algo que alguien escribió);
--   - figura en algún lugar que no se está sacando.
-- Se borra solo la que quedó sin nada. Nunca se pisa lo que alguien escribió.
--
-- Devuelve {lista, nombre, instituciones, contactos, lugares,
--           personas_borrar, personas_conservar, por_evento, por_dato,
--           por_otro_lugar, de_otra_procedencia, hecho}.

create or replace function public.agenda_sacar_lista(p_lista text, p_ejecutar boolean default false) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  nombre text; inst text[]; borrables text[];
  n_inst int; n_cont int; n_lugares int; n_cand int; n_ev int; n_dato int; n_otro int; n_otras int;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Sacar una lista lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  select l.name into nombre from public.agenda_listas l where l.id = p_lista;
  if nombre is null then
    raise exception 'Esa lista no existe' using errcode = 'check_violation';
  end if;

  inst := coalesce(array(select i.id from public.instituciones i where i.lista = p_lista), '{}'::text[]);
  n_inst := coalesce(array_length(inst, 1), 0);

  select count(*),
         count(distinct (c.nivel, coalesce(c.country, ''), lower(public.sin_tildes(coalesce(c.city, ''))), coalesce(c.zona, ''))) filter (where c.institucion is null)
    into n_cont, n_lugares
    from public.contactos c
   where c.institucion = any(inst) or (c.institucion is null and c.lista = p_lista);

  select coalesce(array_agg(q.id) filter (where not q.ev and not q.dato and not q.otro), '{}'::text[]),
         count(*),
         count(*) filter (where q.ev),
         count(*) filter (where q.dato and not q.ev),
         count(*) filter (where q.otro and not q.ev and not q.dato)
    into borrables, n_cand, n_ev, n_dato, n_otro
    from (
      select p.id,
             exists (select 1 from public.posts po,
                       jsonb_array_elements(case when jsonb_typeof(po.participants) = 'array' then po.participants else '[]'::jsonb end) e
                      where e ->> 'persona' = p.id) as ev,
             (nullif(btrim(coalesce(p.note, '')), '') is not null or p.email is not null or coalesce(array_length(p.idiomas, 1), 0) > 0) as dato,
             exists (select 1 from public.contactos c
                      where c.persona = p.id
                        and not (c.institucion = any(inst) or (c.institucion is null and c.lista = p_lista))) as otro
        from public.personas p
       where p.lista = p_lista
    ) q;

  -- Quién figuraba en la lista sin haber venido de ella: se queda, solo deja de figurar acá.
  select count(distinct c.persona) into n_otras
    from public.contactos c
   where (c.institucion = any(inst) or (c.institucion is null and c.lista = p_lista))
     and not exists (select 1 from public.personas p where p.id = c.persona and p.lista = p_lista);

  if p_ejecutar then
    delete from public.contactos c where c.institucion = any(inst) or (c.institucion is null and c.lista = p_lista);
    delete from public.instituciones i where i.lista = p_lista;
    delete from public.personas p where p.id = any(borrables);
    delete from public.agenda_listas l where l.id = p_lista;
  end if;

  return jsonb_build_object('lista', p_lista, 'nombre', nombre, 'instituciones', n_inst, 'contactos', n_cont, 'lugares', n_lugares,
    'personas_borrar', coalesce(array_length(borrables, 1), 0), 'personas_conservar', n_cand - coalesce(array_length(borrables, 1), 0),
    'por_evento', n_ev, 'por_dato', n_dato, 'por_otro_lugar', n_otro, 'de_otra_procedencia', n_otras, 'hecho', p_ejecutar);
end $$;
revoke execute on function public.agenda_sacar_lista(text, boolean) from public, anon;
grant execute on function public.agenda_sacar_lista(text, boolean) to authenticated;
