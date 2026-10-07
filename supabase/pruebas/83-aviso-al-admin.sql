\set QUIET on
-- El aviso al administrador (16-aviso-al-admin.sql): solo quien tiene su
-- pedido pendiente, una vez por pedido, un intento por hora, y las dos
-- marcas no se pueden tocar desde la app.
truncate lab.resultados;
truncate public.access_requests, public.members cascade;
insert into public.members(email, name, nickname, role) values
  ('otra.admin@x.com', 'Otra', 'otra', 'admin'), ('juan@x.com', 'Juan', 'juan', 'member');
insert into public.access_requests(email, name, status) values
  ('nuevo@x.com', 'Nuevo <b>', 'pending'), ('rechazado@x.com', 'Rech', 'rejected');

select lab.probar_valor('quien pidió entrar: corresponde, a los dos admins, con su nombre',
  lab.como('nuevo@x.com'), $q$select 1$q$,
  $q$select (r->'para')::text || ' ' || (r->>'nombre') || ' ' || (r->>'correo') from (select public.pedir_aviso_al_admin() r) x$q$,
  '["benny@team-latam.com", "otra.admin@x.com"] Nuevo <b> nuevo@x.com');
select lab.probar_valor('pedirlo dos veces seguidas: la segunda no (un intento por hora)',
  lab.como('nuevo@x.com'), $q$select public.pedir_aviso_al_admin()$q$,
  $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
select lab.probar_valor('después de un intento, anotar que salió da sí',
  lab.como('nuevo@x.com'), $q$select public.pedir_aviso_al_admin()$q$,
  $q$select public.aviso_al_admin_enviado()::text$q$, 'true');
select lab.probar_valor('y queda la marca que muestra el ✓',
  lab.como('nuevo@x.com'), $q$select public.pedir_aviso_al_admin(); select public.aviso_al_admin_enviado()$q$,
  $q$select (avisado_at is not null)::text from public.access_requests where email = 'nuevo@x.com'$q$, 'true');
select lab.probar_valor('sin un intento antes, no se puede anotar como salido',
  lab.como('nuevo@x.com'), $q$select 1$q$, $q$select public.aviso_al_admin_enviado()::text$q$, 'false');
select lab.probar_valor('quien no tiene pedido (o ya está adentro) no hace salir nada',
  lab.como('juan@x.com'), $q$select 1$q$, $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
select lab.probar_valor('un pedido rechazado tampoco',
  lab.como('rechazado@x.com'), $q$select 1$q$, $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
select lab.probar_valor('las marcas no se tocan desde la app (ni para tener el ✓ ni para volver a mandar)',
  lab.como('nuevo@x.com'),
  $q$update public.access_requests set avisado_at = now(), aviso_pedido_at = '2000-01-01' where email = 'nuevo@x.com'$q$,
  $q$select (avisado_at is null)::text || ' ' || (aviso_pedido_at is null)::text from public.access_requests where email = 'nuevo@x.com'$q$,
  'true true');
select lab.probar_valor('ni al crear el pedido',
  lab.como('otro@x.com'),
  $q$insert into public.access_requests(email, name, status, avisado_at) values ('otro@x.com', 'Otro', 'pending', now())$q$,
  $q$select (avisado_at is null)::text from public.access_requests where email = 'otro@x.com'$q$, 'true');

-- Con un aviso ya salido: no sale otro, y volver a pedir después de un rechazo sí da uno nuevo.
update public.access_requests set aviso_pedido_at = now() - interval '2 hours', avisado_at = now() - interval '2 hours' where email = 'nuevo@x.com';
select lab.probar_valor('con el correo ya salido, no sale otro (aunque pase la hora)',
  lab.como('nuevo@x.com'), $q$select 1$q$, $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
update public.access_requests set status = 'rejected', requested_at = now() - interval '2 hours' where email = 'rechazado@x.com';
update public.access_requests set aviso_pedido_at = now() - interval '3 hours', avisado_at = now() - interval '3 hours' where email = 'rechazado@x.com';
select lab.probar_valor('volver a pedir después de un rechazo es un pedido nuevo: tiene su aviso',
  lab.como('rechazado@x.com'),
  $q$update public.access_requests set status = 'pending' where email = 'rechazado@x.com'$q$,
  $q$select (public.pedir_aviso_al_admin() is not null)::text$q$, 'true');
select lab.probar_valor('una sesión sin correo de Google no hace salir nada',
  '{"role":"authenticated"}'::jsonb, $q$select 1$q$, $q$select coalesce(public.pedir_aviso_al_admin()::text, 'nada')$q$, 'nada');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'desde afuera (anon) ni se pueden llamar', true,
  not has_function_privilege('anon', 'public.pedir_aviso_al_admin()', 'execute')
  and not has_function_privilege('anon', 'public.aviso_al_admin_enviado()', 'execute'), '';

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
