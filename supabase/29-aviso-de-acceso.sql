-- ============================================================
-- El aviso de «ya podés entrar» a quien pidió acceso
-- ============================================================
-- Quien pedía entrar no se enteraba de que lo habían aprobado salvo que dejara abierta la
-- pantalla de espera: cerraba la pestaña y no volvía (docs/AUDITORIA.md, Z4 y D26, 20/11/2026).
-- Ahora, cuando un admin aprueba un pedido, la app llama a la función `avisar` (tipo «acceso») y
-- esta función de la base decide si corresponde y a quién:
--   - solo un admin (el fijo o uno por rol) puede pedirlo;
--   - solo para alguien que YA está en el equipo y fue aprobado hace menos de 15 minutos (no se
--     puede usar para escribirle a cualquier dirección);
--   - una sola vez por persona (avisos_enviados), y cuenta para el tope de 30 avisos por hora de
--     quien aprueba (el mismo de los demás avisos).
-- Devuelve solo un turno (`guardar_aviso`): lo que hay que mandar lo lee la función con la llave
-- de servicio, como en el resto (17-avisos-por-correo.sql).

create or replace function public.preparar_aviso_de_acceso(p_email text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  quien text; nuevo public.members; ya_salieron integer;
begin
  if yo is null or not (public.es_admin_fijo() or public.es_admin_rol()) then return null; end if;
  select * into nuevo from public.members m where m.email = lower(btrim(coalesce(p_email, '')));
  if nuevo.email is null then return null; end if;
  if nuevo.approved_at is null or nuevo.approved_at < now() - interval '15 minutes' then return null; end if;

  select count(*) into ya_salieron from public.avisos_enviados a
   where a.autor = yo and a.enviado_el > now() - interval '1 hour';
  if ya_salieron >= 30 then return null; end if;

  insert into public.avisos_enviados(tipo, objeto, email, autor)
    values ('acceso', nuevo.email, nuevo.email, yo)
    on conflict do nothing;
  if not found then return null; end if;

  quien := coalesce((select nullif(m.name, '') from public.members m where m.email = yo), yo);
  return public.guardar_aviso(jsonb_build_object(
    'para', jsonb_build_array(jsonb_build_object('email', nuevo.email, 'nombre', nuevo.name, 'lang', 'es')),
    'autor', quien, 'en', 'acceso', 'id', nuevo.email));
end $$;
revoke execute on function public.preparar_aviso_de_acceso(text) from public, anon;
grant execute on function public.preparar_aviso_de_acceso(text) to authenticated;
