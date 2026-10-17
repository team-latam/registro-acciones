-- ============================================================
-- Traer una lista con la nota de cada persona (16/10/2026)
-- ============================================================
-- Cada persona ya tiene una «Nota» en su ficha (`personas.note`, hasta 300
-- letras: 18-personas.sql), pero «traer una lista» no la traía. El usuario
-- pidió que el Excel pueda llevar una columna «Notas»: elegió que sea de la
-- persona (no del contacto en su lugar, ni de la ciudad).
--
-- agenda_persona_traida (24-agenda-lugares-al-traer.sql) lee `nota` de cada
-- persona de la lista:
--   - una persona nueva nace con esa nota;
--   - una que ya estaba y no tenía nota, la recibe;
--   - una que ya tenía una se queda con la suya y la nueva se le suma al
--     final (« · »), salvo que ya la diga (traer la misma lista dos veces no
--     la repite); siempre hasta 300 letras, lo que pasa se corta.
-- Nunca se pisa lo que alguien escribió.

create or replace function public.agenda_persona_traida(g jsonb, lid text, out pid text, out nueva boolean)
  language plpgsql security definer set search_path = '' as $$
declare ya public.personas; tel jsonb; nota text := nullif(left(btrim(coalesce(g ->> 'nota', '')), 300), '');
begin
  select * into ya from public.personas
   where lower(public.sin_tildes(btrim(name))) = lower(public.sin_tildes(btrim(g ->> 'name')))
   order by created_at limit 1;
  if ya.id is null then
    pid := public.agenda_id(); nueva := true;
    insert into public.personas(id, name, telefonos, note, lista)
    values (pid, g ->> 'name', coalesce(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' end, '[]'::jsonb), nota, lid);
  else
    pid := ya.id; nueva := false;
    -- Los teléfonos que no tenía (por los números, sin espacios ni guiones), hasta seis.
    for tel in select e from jsonb_array_elements(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' else '[]'::jsonb end) e loop
      update public.personas p set telefonos = p.telefonos || jsonb_build_array(tel)
       where p.id = pid and jsonb_array_length(p.telefonos) < 6
         and not exists (select 1 from jsonb_array_elements(p.telefonos) y
                          where regexp_replace(y ->> 'n', '[^0-9]', '', 'g') = regexp_replace(tel ->> 'n', '[^0-9]', '', 'g'));
    end loop;
    -- La nota: se suma, no se pisa.
    if nota is not null then
      update public.personas p set note = case
          when coalesce(btrim(p.note), '') = '' then nota
          when position(lower(nota) in lower(p.note)) > 0 then p.note
          else left(p.note || ' · ' || nota, 300) end
       where p.id = pid;
    end if;
  end if;
end $$;
revoke execute on function public.agenda_persona_traida(jsonb, text) from public, anon, authenticated;
