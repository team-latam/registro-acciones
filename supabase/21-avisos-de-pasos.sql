-- ============================================================
-- Avisos por correo de los pasos de «Lo que sigue» (13/10/2026)
-- ============================================================
-- Propuesta 1-B del usuario: cada paso que sale de un Formulario de Cierre
-- puede tener un responsable y una fecha (posts.resumen → partes[].pasos[]:
-- `resp`, `para`, `asigPor`, `asigEl`). Cuando alguien se lo da a OTRA
-- persona, a esa persona le llega un correo; y el día que vence, otro (eso
-- lo manda supabase/avisos/vencimientos.mjs, que corre cada hora). Cada
-- uno apaga los dos en Tu cuenta (emailPasos y emailVence, ver
-- prefs_de_correo en 17-avisos-por-correo.sql).
--
-- Va como el resto de los avisos al momento (preparar_aviso): la función
-- `avisar` la llama con la sesión de quien asignó, la base decide si
-- corresponde y a quién, y devuelve solo un turno (guardar_aviso): quien
-- llama no ve a quién le llega nada. Reglas:
--   - solo quien asignó el paso (`asigPor`) la puede pedir, y en los primeros
--     15 minutos;
--   - el paso tiene que seguir pendiente y tener un responsable que no sea
--     quien llama;
--   - el responsable tiene que poder recibir correos (Administración →
--     Correos), tenerlos prendidos y no haber apagado «pasos»;
--   - no sale dos veces por la misma asignación (avisos_enviados), y cuenta
--     para el tope de 30 avisos por hora de quien asigna;
--   - llega al momento aunque la persona haya elegido el resumen diario o
--     semanal: es algo que le pidieron a ella, y lo apaga en Tu cuenta.
-- El nombre de quien asigna sale de su cuenta, no de lo guardado en el paso.

create or replace function public.preparar_aviso_de_paso(p_id text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  hasta_aca integer; post_id text; paso_id text;
  titulo text; tipo_act text; paso jsonb; resp text; asignado timestamptz; pr jsonb;
  quien text; ya_salieron integer;
begin
  if yo is null or not public.esta_aprobado() then return null; end if;
  -- «<id del posteo>#<id del paso>»
  hasta_aca := position('#' in coalesce(p_id, ''));
  if hasta_aca < 2 then return null; end if;
  post_id := left(p_id, hasta_aca - 1);
  paso_id := substr(p_id, hasta_aca + 1);
  select p.title, p.activity_type,
         jsonb_path_query_first(p.resumen, '$.partes[*].pasos[*] ? (@.id == $id)', jsonb_build_object('id', paso_id))
    into titulo, tipo_act, paso
    from public.posts p where p.id = post_id and not coalesce(p.cancelled, false);
  if paso is null then return null; end if;

  resp := lower(paso ->> 'resp');
  if resp is null or resp = '' or resp = yo then return null; end if;
  if lower(coalesce(paso ->> 'asigPor', '')) <> yo then return null; end if;
  if coalesce(paso ->> 'estado', 'pendiente') <> 'pendiente' then return null; end if;
  -- La fecha de la asignación la escribe la app; por la API puede ser cualquier cosa.
  begin asignado := (paso ->> 'asigEl')::timestamptz; exception when others then return null; end;
  if asignado is null or asignado < now() - interval '15 minutes' or asignado > now() + interval '5 minutes' then return null; end if;

  select count(*) into ya_salieron from public.avisos_enviados a
   where a.autor = yo and a.enviado_el > now() - interval '1 hour';
  if ya_salieron >= 30 then return null; end if;

  if not exists (select 1 from public.members m where m.email = resp) or not public.puede_recibir_correos(resp) then return null; end if;
  pr := public.prefs_de_correo(resp);
  if not (pr ->> 'on')::boolean or not (pr ->> 'pasos')::boolean then return null; end if;

  insert into public.avisos_enviados(tipo, objeto, email, autor)
    values ('paso', p_id || '@' || (paso ->> 'asigEl'), resp, yo)
    on conflict do nothing;
  if not found then return null; end if;

  quien := coalesce((select nullif(m.name, '') from public.members m where m.email = yo), yo);
  return public.guardar_aviso(jsonb_build_object(
    'para', jsonb_build_array(jsonb_build_object('email', resp, 'nombre', (select m.name from public.members m where m.email = resp), 'lang', pr ->> 'lang')),
    'autor', quien, 'titulo', titulo, 'tipo', tipo_act, 'texto', left(coalesce(paso ->> 't', ''), 300),
    'cuando', nullif(paso ->> 'para', ''), 'post', post_id, 'en', 'paso', 'id', p_id));
end $$;
revoke execute on function public.preparar_aviso_de_paso(text) from public, anon;
grant execute on function public.preparar_aviso_de_paso(text) to authenticated;
