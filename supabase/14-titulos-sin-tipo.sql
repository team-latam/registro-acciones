-- ============================================================
-- Los títulos, sin el tipo pegado adelante
-- ============================================================
-- Hasta el 5/10/2026 la app mandaba los eventos a Google Calendar como
-- "Tipo: Título" ("Curso: Curso de Team Leader"), y lo que volvía de
-- Calendar a veces traía ese prefijo pegado al título del posteo
-- ("Visita: Quintana Roo", y hasta "Visita: Visita: …"). El usuario pidió
-- sacarlo: la app ya no lo agrega (calendarSummary en index.html) y esto
-- limpia lo que ya estaba guardado.
--
-- Se saca solo un prefijo EXACTO "<nombre de un tipo>: " —los de fábrica
-- en los cuatro idiomas, "Actividad" y los que el admin haya creado o
-- renombrado— y las veces que esté repetido. Un título que es solo el
-- prefijo no se toca (quedaría vacío), y "Cursos de verano" tampoco: no
-- es "Curso: ".
--
-- No cambia la fecha de edición: ordenar no es editar (mismo criterio que
-- clasificar_importados). Corre en cada aplicación del esquema y es
-- inofensivo repetirlo: la segunda vez no encuentra nada.
-- ============================================================

create or replace function public.limpiar_tipo_en_titulos()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  etiquetas text[] := array[
    'Actividad',
    'Rutina', 'Routine', 'Rotina', 'שגרה',
    'Visita', 'Visit', 'ביקור',
    'Curso', 'Course', 'קורס',
    'Seminario', 'Seminar', 'Seminário', 'סמינר',
    'Congreso', 'Congress', 'Congresso', 'כנס',
    'Virtual', 'וירטואלי',
    'Otro', 'Other', 'Outro', 'אחר'
  ];
  e text;
  n integer := 0;
  filas integer;
  hubo boolean;
begin
  etiquetas := etiquetas || coalesce((
    select array_agg(distinct btrim(t ->> 'label'))
      from public.app_config c,
           jsonb_array_elements(case when jsonb_typeof(c.value -> 'activityTypes') = 'array'
                                     then c.value -> 'activityTypes' else '[]'::jsonb end) t
     where c.key = 'preferences' and btrim(coalesce(t ->> 'label', '')) <> ''), '{}');
  loop
    hubo := false;
    foreach e in array etiquetas loop
      update public.posts
         set title = substr(title, length(e) + 3)
       where left(title, length(e) + 2) = e || ': '
         and btrim(substr(title, length(e) + 3)) <> '';
      get diagnostics filas = row_count;
      if filas > 0 then hubo := true; n := n + filas; end if;
    end loop;
    exit when not hubo;
  end loop;
  return n;
end $$;

revoke execute on function public.limpiar_tipo_en_titulos() from public, anon, authenticated;

select public.limpiar_tipo_en_titulos();
