-- ============================================================
-- Cuándo entró cada persona por última vez
-- ============================================================
-- Administración › Personas decía «Nunca entró» (y sumaba a «Inactivos») de alguien que entró hace
-- 12 días cuando el registro de actividad tenía más de 1.000 acciones nuevas: la app solo carga las
-- últimas 1.000 y de ahí sacaba el último ingreso de cada uno (docs/AUDITORIA.md, Y7, 20/11/2026).
-- Con 25 o 30 personas activas, 1.000 acciones son menos de un mes: la pantalla empezaba a mentir
-- justo cuando más hace falta.
--
-- Esta función le pregunta a la base lo que de verdad hace falta: la última entrada de cada
-- persona, sin importar cuántas acciones haya habido después. Solo para admins (el registro de
-- actividad ya es solo de ellos, 02-politicas.sql); para cualquier otra persona no devuelve nada.
-- No devuelve nombres ni detalles: un correo y una fecha.

create or replace function public.ultimas_entradas()
returns table (email text, ultima timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.actor_email, max(a.created_at)
    from public.audit_log a
   where a.type = 'login'
     and (public.es_admin_fijo() or public.es_admin_rol())
   group by a.actor_email
$$;
revoke execute on function public.ultimas_entradas() from public, anon;
grant execute on function public.ultimas_entradas() to authenticated;
