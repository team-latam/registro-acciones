\set QUIET on
-- La última entrada de cada persona (28-ultimas-entradas.sql, Y7 de la auditoría del 20/11/2026):
-- sale de TODO el registro, no de las últimas 1.000 acciones; solo la ve un admin; y cuenta solo
-- las entradas (`login`), no cualquier acción.
truncate lab.resultados;
truncate public.audit_log, public.members, public.app_config, public.user_prefs cascade;
insert into public.members(email, name, nickname, role) values
  ('otra.admin@x.com', 'Otra', 'otra', 'admin'), ('juan@x.com', 'Juan', 'juan', 'member'), ('ana@x.com', 'Ana', 'ana', 'member');
-- Ana entró hace 12 días; después de eso hubo 1.500 acciones de otros (ahí se perdía en la app).
insert into public.audit_log(id, type, actor_email, actor_name, created_at) values
  ('a-ana-1', 'login', 'ana@x.com', 'Ana', now() - interval '40 days'),
  ('a-ana-2', 'login', 'ana@x.com', 'Ana', now() - interval '12 days'),
  ('a-ana-3', 'post_created', 'ana@x.com', 'Ana', now() - interval '2 days');
insert into public.audit_log(id, type, actor_email, actor_name, created_at)
  select 'j-' || g, case when g % 3 = 0 then 'login' else 'post_edited' end, 'juan@x.com', 'Juan', now() - (g || ' minutes')::interval
    from generate_series(1, 1500) g;

select lab.probar_valor('el admin ve la última entrada de Ana: la de hace 12 días (no la de hace 40, ni su último posteo)',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select to_char(ultima, 'YYYY-MM-DD') = to_char(now() - interval '12 days', 'YYYY-MM-DD') from public.ultimas_entradas() where email = 'ana@x.com'$q$, 'true');
select lab.probar_valor('y la de Juan, la más reciente',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select (ultima > now() - interval '10 minutes')::text from public.ultimas_entradas() where email = 'juan@x.com'$q$, 'true');
select lab.probar_valor('una persona por fila, solo las que entraron',
  lab.como('otra.admin@x.com'), $q$select 1$q$,
  $q$select string_agg(email, ',' order by email) from public.ultimas_entradas()$q$, 'ana@x.com,juan@x.com');
select lab.probar_valor('el admin fijo también la ve',
  lab.como('benny@team-latam.com'), $q$select 1$q$,
  $q$select count(*)::text from public.ultimas_entradas()$q$, '2');
select lab.probar_valor('un integrante no ve nada (el registro de actividad es solo de los admins)',
  lab.como('juan@x.com'), $q$select 1$q$,
  $q$select count(*)::text from public.ultimas_entradas()$q$, '0');
select lab.probar_valor('alguien de afuera tampoco',
  lab.como('afuera@x.com'), $q$select 1$q$,
  $q$select count(*)::text from public.ultimas_entradas()$q$, '0');

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
