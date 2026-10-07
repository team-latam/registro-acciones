-- ============================================================
-- El aviso al administrador cuando alguien pide entrar
-- ============================================================
-- La pantalla de espera decía «Le avisamos al administrador ✓» y no era
-- cierto: no salía ningún aviso, el admin se enteraba cuando abría la app
-- (docs/AUDITORIA.md, I10). Ahora sale un correo: la app llama a la
-- función `avisar` de Supabase con la sesión de quien pidió entrar, y la
-- función le pregunta a esta base a quién mandarlo y lo manda con Resend
-- (supabase/functions/LEEME.md).
--
-- Lo que se cuida acá es que nadie pueda usar eso para llenarle la casilla
-- al admin: la base decide si corresponde, y solo una vez por pedido.
--   aviso_pedido_at  la última vez que se intentó (un intento por hora)
--   avisado_at       cuándo salió el correo (después de eso, ninguno más)
-- Las dos columnas las escriben solo estas funciones: desde la app no se
-- pueden tocar. La pantalla de espera muestra el ✓ solo con avisado_at.

alter table public.access_requests add column if not exists aviso_pedido_at timestamptz;
alter table public.access_requests add column if not exists avisado_at timestamptz;

create or replace function public.solicitudes_aviso_intacto() returns trigger
  language plpgsql set search_path = '' as $$
begin
  -- La llave de servicio (restaurar una copia) escribe todo tal cual.
  if public.sin_sesion_de_persona() then return new; end if;
  if coalesce(current_setting('registro.aviso', true), '') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    new.aviso_pedido_at := null; new.avisado_at := null;
  elsif old.status is distinct from 'pending' and new.status = 'pending' then
    -- Volver a pedir después de un rechazo es un pedido nuevo: le
    -- corresponde su aviso (y volver a pedir ya tiene su tope de una vez
    -- por hora, en solicitudes_reintento).
    new.aviso_pedido_at := null; new.avisado_at := null;
  else
    new.aviso_pedido_at := old.aviso_pedido_at; new.avisado_at := old.avisado_at;
  end if;
  return new;
end $$;
drop trigger if exists solicitudes_aviso_intacto on public.access_requests;
create trigger solicitudes_aviso_intacto before insert or update on public.access_requests
  for each row execute function public.solicitudes_aviso_intacto();

-- ¿Corresponde avisar? Solo a quien tiene SU pedido pendiente, sin aviso
-- salido, y como mucho un intento por hora (si Resend falló, se reintenta
-- más tarde). Devuelve a quién mandarlo y qué decir, o null.
create or replace function public.pedir_aviso_al_admin() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare fila public.access_requests; para text[];
begin
  perform set_config('registro.aviso', '1', true);
  update public.access_requests set aviso_pedido_at = now()
   where email = public.mi_correo() and status = 'pending' and avisado_at is null
     and (aviso_pedido_at is null or aviso_pedido_at < now() - interval '1 hour')
  returning * into fila;
  perform set_config('registro.aviso', '', true);
  if fila.email is null then return null; end if;
  select array_agg(distinct e order by e) into para from (
    select public.admin_fijo() as e
    union select m.email from public.members m where m.role = 'admin') x;
  return jsonb_build_object('para', to_jsonb(para), 'nombre', fila.name, 'correo', fila.email);
end $$;
revoke execute on function public.pedir_aviso_al_admin() from public, anon;
grant execute on function public.pedir_aviso_al_admin() to authenticated;

-- El correo salió: queda anotado, y eso es lo que muestra el ✓. Solo
-- justo después de un intento (los 10 minutos siguientes).
create or replace function public.aviso_al_admin_enviado() returns boolean
  language plpgsql security definer set search_path = '' as $$
declare hecho boolean;
begin
  perform set_config('registro.aviso', '1', true);
  update public.access_requests set avisado_at = now()
   where email = public.mi_correo() and status = 'pending' and avisado_at is null
     and aviso_pedido_at > now() - interval '10 minutes';
  hecho := found;
  perform set_config('registro.aviso', '', true);
  return hecho;
end $$;
revoke execute on function public.aviso_al_admin_enviado() from public, anon;
grant execute on function public.aviso_al_admin_enviado() to authenticated;
