\set QUIET on
-- El aviso de «ya podés entrar» a quien pidió acceso (29-aviso-de-acceso.sql, Z4 y D26-A de la
-- auditoría del 20/11/2026): solo un admin lo pide, solo para alguien recién aprobado que ya está en
-- el equipo, una sola vez, y devuelve un turno (no la dirección ni los datos).
truncate lab.resultados;
truncate public.avisos_enviados, public.avisos_listos, public.access_requests, public.members, public.app_config, public.user_prefs cascade;
insert into public.members(email, name, nickname, role, approved_at) values
  ('otra.admin@x.com', 'Otra', 'otra', 'admin', now() - interval '90 days'),
  ('juan@x.com', 'Juan', 'juan', 'member', now() - interval '90 days'),
  ('nuevo@x.com', 'Nuevo Ingreso', 'nuevo', 'member', now() - interval '2 minutes'),
  ('viejo@x.com', 'Viejo', 'viejo', 'member', now() - interval '3 hours');
insert into public.access_requests(email, name, status) values ('pendiente@x.com', 'Pendiente', 'pending');

select lab.probar_valor('un admin pide el aviso para alguien aprobado hace 2 minutos: recibe un turno',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select (public.preparar_aviso_de_acceso('nuevo@x.com') ? 'ticket')::text$q$, 'true');
select lab.probar_valor('el turno es lo único que devuelve: ni dirección ni nombre',
  lab.como('benny@team-latam.com'), $q$select 1$q$,
  $q$select string_agg(k, ',') from jsonb_object_keys(public.preparar_aviso_de_acceso('nuevo@x.com')) k$q$, 'ticket');
select lab.probar_valor('lo que se manda: a la dirección con la que entró, con su nombre, en español',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select (r->'para'->0->>'email') || ' ' || (r->'para'->0->>'nombre') || ' ' || (r->'para'->0->>'lang') || ' ' || (r->>'en') from (select lab.aviso(public.preparar_aviso_de_acceso('nuevo@x.com')) r) x$q$,
  'nuevo@x.com Nuevo Ingreso es acceso');
select lab.probar_valor('pedirlo dos veces para la misma persona: la segunda no (una sola vez)',
  lab.como('otra.admin@x.com'), $q$select public.preparar_aviso_de_acceso('nuevo@x.com')$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('nuevo@x.com')::text, 'nada')$q$, 'nada');
select lab.probar_valor('un integrante no puede pedirlo (aunque el otro sea nuevo)',
  lab.como('juan@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('nuevo@x.com')::text, 'nada')$q$, 'nada');
delete from public.avisos_enviados;
select lab.probar_valor('alguien de afuera tampoco',
  lab.como('afuera@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('nuevo@x.com')::text, 'nada')$q$, 'nada');
select lab.probar_valor('para alguien aprobado hace horas no corresponde (solo los recién aprobados)',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('viejo@x.com')::text, 'nada')$q$, 'nada');
select lab.probar_valor('para una dirección que no está en el equipo, tampoco (no se usa para escribirle a cualquiera)',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('cualquiera@x.com')::text, 'nada')$q$, 'nada');
select lab.probar_valor('ni para alguien que solo tiene un pedido pendiente',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('pendiente@x.com')::text, 'nada')$q$, 'nada');
select lab.probar_valor('ni con un texto vacío',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('')::text, 'nada')$q$, 'nada');
-- El tope de 30 por hora de quien aprueba.
insert into public.avisos_enviados(tipo, objeto, email, autor)
  select 'paso', 'x' || g, 'z' || g || '@x.com', 'otra.admin@x.com' from generate_series(1, 30) g;
select lab.probar_valor('con 30 avisos en la última hora de quien aprueba, no sale otro',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select coalesce(public.preparar_aviso_de_acceso('nuevo@x.com')::text, 'nada')$q$, 'nada');

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
