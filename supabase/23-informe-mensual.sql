-- ============================================================
-- Informe mensual por correo, con enlace que vence a las 48 horas (13/10/2026)
-- ============================================================
-- Propuesta 3-A (segunda vuelta) del usuario: el primer día de cada mes, a
-- quienes eligió un admin (Administración → Correos → «Informe mensual»,
-- app_config 'preferences' → correos.informe = {on, para: [correos]}) les
-- llega un correo que NO lleva ningún número: dice qué es y trae un botón.
-- El informe se abre dentro del Registro (hay que entrar con la cuenta del
-- equipo) y el enlace deja de andar a las 48 horas. Desde ahí se puede
-- imprimir, guardar como PDF o bajar la planilla.
--
-- «Vence a las 48 horas» tiene que ser algo que decide el SERVIDOR, no la
-- pantalla: lo que cuenta es cuándo salió el correo, y eso lo sabe la marca de
-- avisos_enviados (tipo 'informe', objeto = el mes, «2026-10»; la escribe
-- supabase/avisos/informe.mjs con la llave de servicio al mandarlo). La app
-- pregunta con informe_vigente() al abrir el enlace.
--
-- Lo que NO hace, dicho al usuario: un correo que ya llegó no se puede borrar
-- ni apagar desde acá. Por eso el correo no lleva números: lo único que queda
-- en la casilla es el aviso y un enlace vencido. Y los números del informe son los
-- del Registro, que cada integrante puede ver en Reportes cuando quiera: el
-- vencimiento es del enlace, no un secreto sobre los datos.
--
-- «Mandarme un informe de prueba» (Administración → Correos): para que el
-- admin vea cómo llega sin esperar al día 1. Pasa por la función `avisar`
-- como los demás avisos (preparar_informe_de_prueba devuelve solo un turno)
-- y deja una marca propia (tipo 'informe-prueba') que cuenta igual para el
-- vencimiento, para poder probar el enlace.

-- ¿El enlace del informe de ese mes sigue valiendo para quien llama?
-- Contesta {vigente: true, vence: <cuándo>} o {vigente: false}: sin decir
-- más (quién más lo recibió, cuándo salió).
create or replace function public.informe_vigente(p_mes text) returns jsonb
  language plpgsql stable security definer set search_path = '' as $$
declare yo text := public.mi_correo(); salio timestamptz;
begin
  if yo is null or not public.esta_aprobado() then return jsonb_build_object('vigente', false); end if;
  if coalesce(p_mes, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then return jsonb_build_object('vigente', false); end if;
  select max(a.enviado_el) into salio from public.avisos_enviados a
   where a.tipo in ('informe', 'informe-prueba') and a.objeto = p_mes and a.email = yo;
  if salio is null or salio < now() - interval '48 hours' then return jsonb_build_object('vigente', false); end if;
  return jsonb_build_object('vigente', true, 'vence', salio + interval '48 hours');
end $$;
revoke execute on function public.informe_vigente(text) from public, anon;
grant execute on function public.informe_vigente(text) to authenticated;

-- El correo de prueba del informe: solo un admin, solo para sí mismo, uno por
-- minuto y no más de 5 por día. Devuelve un turno (guardar_aviso); lo que hay
-- que mandar lo lee la función `avisar` con la llave de servicio.
create or replace function public.preparar_informe_de_prueba(p_mes text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); pr jsonb; ultimo timestamptz; hoy integer;
begin
  if yo is null or not (public.es_admin_fijo() or public.es_admin_rol()) then return null; end if;
  if coalesce(p_mes, '') !~ '^\d{4}-(0[1-9]|1[0-2])$' then return null; end if;
  select max(a.enviado_el) into ultimo from public.avisos_enviados a where a.tipo = 'informe-prueba' and a.email = yo;
  if ultimo is not null and ultimo > now() - interval '1 minute' then return null; end if;
  select count(*) into hoy from public.avisos_enviados a
   where a.tipo = 'informe-prueba' and a.email = yo and a.enviado_el > now() - interval '1 day';
  if hoy >= 5 then return null; end if;
  -- Una marca por mes: repetir la prueba la renueva (y renueva las 48 horas).
  insert into public.avisos_enviados(tipo, objeto, email, autor) values ('informe-prueba', p_mes, yo, yo)
    on conflict (tipo, objeto, email) do update set enviado_el = now();
  pr := public.prefs_de_correo(yo);
  return public.guardar_aviso(jsonb_build_object('para', jsonb_build_array(jsonb_build_object('email', yo,
    'nombre', (select m.name from public.members m where m.email = yo), 'lang', pr ->> 'lang', 'tz', pr ->> 'tz')),
    'mes', p_mes, 'vence', now() + interval '48 hours'));
end $$;
revoke execute on function public.preparar_informe_de_prueba(text) from public, anon;
grant execute on function public.preparar_informe_de_prueba(text) to authenticated;
