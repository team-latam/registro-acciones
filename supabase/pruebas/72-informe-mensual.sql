\set QUIET on
-- El informe mensual por correo (23-informe-mensual.sql): si el enlace de ese mes
-- sigue valiendo para quien llama (vigente a las 48 horas de salido el correo, y
-- solo para quien lo recibió) y el correo de prueba que se manda un admin.
truncate lab.resultados;
truncate public.members, public.avisos_enviados, public.avisos_listos cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('jefe@x.com', 'Jefe', 'jefe', 'observer'), ('otra.admin@x.com', 'Otra', 'otra', 'admin');

-- Hacer algo como una persona y que QUEDE (probar_valor lo deshace).
create or replace function lab.hacer(quien jsonb, sentencia text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', quien::text, true);
  execute sentencia into r;
  execute 'reset role';
  return r;
exception when others then
  execute 'reset role';
  return 'error: ' || left(sqlerrm, 80);
end $$;
create or replace function lab.vigente(quien text, mes text) returns text language sql as $$
  select lab.hacer(lab.como(quien), format($x$select (public.informe_vigente(%L) ->> 'vigente')$x$, mes))
$$;

-- ---------- El enlace ----------
select lab.comprobar('sin que haya salido el correo, no vale', $q$select lab.vigente('jefe@x.com', '2026-10')$q$, 'false');
insert into public.avisos_enviados(tipo, objeto, email, autor, enviado_el) values ('informe', '2026-10', 'jefe@x.com', null, now() - interval '1 hour');
select lab.comprobar('a la hora de salido, vale', $q$select lab.vigente('jefe@x.com', '2026-10')$q$, 'true');
select lab.comprobar('…solo para ese mes', $q$select lab.vigente('jefe@x.com', '2026-09')$q$, 'false');
select lab.comprobar('…y solo para quien lo recibió: otra persona del equipo, no', $q$select lab.vigente('ana@x.com', '2026-10')$q$, 'false');
select lab.comprobar('…ni un admin que no estaba en la lista', $q$select lab.vigente('benny@team-latam.com', '2026-10')$q$, 'false');
select lab.comprobar('dice cuándo vence: 48 horas después de salido',
  $q$select (lab.hacer(lab.como('jefe@x.com'), $x$select (public.informe_vigente('2026-10') ->> 'vence')$x$)::timestamptz - (select enviado_el from public.avisos_enviados where tipo = 'informe'))::text$q$, '2 days');
select lab.comprobar('…y no cuenta nada más', $q$select lab.hacer(lab.como('jefe@x.com'), $x$select (select string_agg(k, ',' order by k) from jsonb_object_keys(public.informe_vigente('2026-10')) k)$x$)$q$, 'vence,vigente');
update public.avisos_enviados set enviado_el = now() - interval '47 hours 59 minutes';
select lab.comprobar('a los 47 h 59 min, todavía vale', $q$select lab.vigente('jefe@x.com', '2026-10')$q$, 'true');
update public.avisos_enviados set enviado_el = now() - interval '48 hours 1 minute';
select lab.comprobar('pasadas las 48 horas, ya no', $q$select lab.vigente('jefe@x.com', '2026-10')$q$, 'false');
select lab.comprobar('…y al vencer no dice cuándo salió', $q$select lab.hacer(lab.como('jefe@x.com'), $x$select public.informe_vigente('2026-10')::text$x$)$q$, '{"vigente": false}');
select lab.comprobar('alguien de afuera del equipo, no', $q$select lab.vigente('afuera@x.com', '2026-10')$q$, 'false');
select lab.comprobar('un mes mal escrito, no', $q$select lab.vigente('jefe@x.com', '2026-13') || ' ' || lab.vigente('jefe@x.com', 'octubre') || ' ' || lab.vigente('jefe@x.com', '')$q$, 'false false false');
select lab.comprobar('sin sesión, no', $q$select public.informe_vigente('2026-10') ->> 'vigente'$q$, 'false');
-- Un mes nuevo se manda como una marca nueva y vale por sí misma.
insert into public.avisos_enviados(tipo, objeto, email, autor) values ('informe', '2026-11', 'jefe@x.com', null);
select lab.comprobar('el informe del mes siguiente, recién salido, vale', $q$select lab.vigente('jefe@x.com', '2026-11')$q$, 'true');
select lab.comprobar('…y el del mes anterior sigue vencido', $q$select lab.vigente('jefe@x.com', '2026-10')$q$, 'false');
delete from public.avisos_enviados;

-- ---------- El correo de prueba ----------
select lab.comprobar('un admin se manda un correo de prueba: la función contesta un turno',
  $q$select (lab.hacer(lab.como('benny@team-latam.com'), $x$select (public.preparar_informe_de_prueba('2026-10') ->> 'ticket') is not null$x$))$q$, 'true');
select lab.comprobar('…el turno lleva solo a él, el mes y cuándo vence (y no se lo cuenta a quien llama)',
  $q$select (datos -> 'para' -> 0 ->> 'email') || ' ' || (datos ->> 'mes') || ' ' || ((datos ->> 'vence')::timestamptz > now() + interval '47 hours')::text || ' ' || jsonb_array_length(datos -> 'para') from public.avisos_listos$q$,
  'benny@team-latam.com 2026-10 true 1');
select lab.comprobar('…y deja su marca de prueba, que hace valer el enlace', $q$select lab.vigente('benny@team-latam.com', '2026-10')$q$, 'true');
select lab.comprobar('otra prueba enseguida (menos de un minuto), no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select (public.preparar_informe_de_prueba('2026-10') is null)::text$x$)$q$, 'true');
update public.avisos_enviados set enviado_el = now() - interval '2 minutes';
select lab.comprobar('pasado el minuto, sí, y renueva las 48 horas',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select (public.preparar_informe_de_prueba('2026-10') is not null)::text$x$)$q$, 'true');
select lab.comprobar('…con una sola marca por mes', $q$select count(*)::text from public.avisos_enviados where tipo = 'informe-prueba'$q$, '1');
select lab.comprobar('un integrante común no puede', $q$select lab.hacer(lab.como('ana@x.com'), $x$select (public.preparar_informe_de_prueba('2026-10') is null)::text$x$)$q$, 'true');
select lab.comprobar('un observador, tampoco', $q$select lab.hacer(lab.como('jefe@x.com'), $x$select (public.preparar_informe_de_prueba('2026-10') is null)::text$x$)$q$, 'true');
select lab.comprobar('otro admin (por rol), sí', $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select (public.preparar_informe_de_prueba('2026-11') is not null)::text$x$)$q$, 'true');
select lab.comprobar('un mes mal escrito, no', $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select (public.preparar_informe_de_prueba('mañana') is null)::text$x$)$q$, 'true');
delete from public.avisos_enviados where email = 'benny@team-latam.com';
insert into public.avisos_enviados(tipo, objeto, email, autor, enviado_el)
  select 'informe-prueba', '2026-0' || g, 'benny@team-latam.com', 'benny@team-latam.com', now() - interval '5 minutes' from generate_series(1, 5) g;
select lab.comprobar('con 5 pruebas en el día, la sexta no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select (public.preparar_informe_de_prueba('2026-10') is null)::text$x$)$q$, 'true');

-- ---------- Permisos ----------
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'las dos funciones las ejecuta quien tiene sesión y no anon', true,
  has_function_privilege('authenticated', 'public.informe_vigente(text)', 'execute')
  and has_function_privilege('authenticated', 'public.preparar_informe_de_prueba(text)', 'execute')
  and not has_function_privilege('anon', 'public.informe_vigente(text)', 'execute')
  and not has_function_privilege('anon', 'public.preparar_informe_de_prueba(text)', 'execute'), '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'nadie lee las marcas directo', true, not has_table_privilege('authenticated', 'public.avisos_enviados', 'select'), '';

drop function lab.vigente(text, text);
drop function lab.hacer(jsonb, text);
\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
