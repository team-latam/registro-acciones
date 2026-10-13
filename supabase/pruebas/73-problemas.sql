\set QUIET on
-- «Algo no anda» y los errores que la app anota sola (22-problemas.sql): quién
-- escribe, quién lee, que el mismo error se agrupe y que los topes funcionen.
truncate lab.resultados;
truncate public.problemas, public.members cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('diego@x.com', 'Diego', 'diego', 'member'), ('olga@x.com', 'Olga', 'olga', 'observer'),
  ('otra.admin@x.com', 'Otra', 'otra', 'admin');

-- Hacer algo como una persona y que QUEDE (probar_valor lo deshace): el rol y la
-- sesión se ponen, se corre la sentencia y se vuelve a lo de siempre.
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

-- ---------- Lo que cuenta una persona ----------
select lab.comprobar('una integrante cuenta qué pasó, y la función contesta que sí',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.contar_problema('Reportes', 'Se queda en blanco al tocar un mes', '{"ua":"iPhone","pantalla":"390x844"}'::jsonb)::text$x$)$q$, 'true');
select lab.comprobar('queda a su nombre, con su nombre de cuenta, la pantalla, lo técnico y el estado «nuevo»',
  $q$select origen || '|' || autor || '|' || nombre || '|' || pantalla || '|' || estado || '|' || (tecnico ->> 'ua') || '|' || veces || '|' || cardinality(personas) from public.problemas$q$,
  'persona|ana@x.com|Ana|Reportes|nuevo|iPhone|1|1');
select lab.comprobar('un observador también puede avisar de un problema',
  $q$select lab.hacer(lab.como('olga@x.com'), $x$select public.contar_problema('Inicio', 'No carga', null)::text$x$)$q$, 'true');
select lab.comprobar('alguien que no está en el equipo, no',
  $q$select lab.hacer(lab.como('afuera@x.com'), $x$select public.contar_problema('Inicio', 'No carga', null)::text$x$)$q$, 'false');
select lab.comprobar('un mensaje vacío, no',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.contar_problema('Inicio', '   ', null)::text$x$)$q$, 'false');
select lab.comprobar('lo técnico demasiado grande no frena el aviso: se guarda sin eso',
  $q$select lab.hacer(lab.como('diego@x.com'), $x$select public.contar_problema('Inicio', 'Falla', jsonb_build_object('x', repeat('a', 5000)))::text$x$)$q$, 'true');
select lab.comprobar('…y quedó sin lo técnico', $q$select coalesce(tecnico::text, 'sin') from public.problemas where autor = 'diego@x.com'$q$, 'sin');
select lab.comprobar('un mensaje muy largo se recorta a 1000',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.contar_problema('Inicio', repeat('x', 3000), null)::text$x$)$q$, 'true');
select lab.comprobar('…recortado', $q$select max(char_length(mensaje))::text from public.problemas where autor = 'ana@x.com'$q$, '1000');
-- El tope: 10 por hora por persona.
delete from public.problemas where autor = 'ana@x.com';
insert into public.problemas(origen, autor, mensaje, personas) select 'persona', 'ana@x.com', 'p' || g, array['ana@x.com'] from generate_series(1, 10) g;
select lab.comprobar('con 10 avisos en la última hora, el próximo de esa persona no entra',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.contar_problema('Inicio', 'otro más', null)::text$x$)$q$, 'false');
select lab.comprobar('pero otra persona sí',
  $q$select lab.hacer(lab.como('olga@x.com'), $x$select public.contar_problema('Inicio', 'otro más', null)::text$x$)$q$, 'true');
delete from public.problemas;

-- ---------- Lo que anota la app sola ----------
select lab.comprobar('un error anotado por primera vez abre uno',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('h1', 'Reportes', 'Cannot read properties of undefined (reading …)', '{"ua":"Safari"}'::jsonb)::text$x$)$q$, 'true');
select lab.comprobar('…automático, sin nombre, una vez y una persona',
  $q$select origen || '|' || coalesce(nombre, 'sin nombre') || '|' || veces || '|' || cardinality(personas) || '|' || estado from public.problemas$q$, 'automatico|sin nombre|1|1|nuevo');
select lab.comprobar('el mismo error de la misma persona: la función contesta que sí',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('h1', 'Reportes', 'otro texto', null)::text$x$)$q$, 'true');
select lab.comprobar('…y suma una vez más, no una persona más', $q$select veces || '/' || cardinality(personas) from public.problemas$q$, '2/1');
select lab.comprobar('el mismo error de otra persona: también',
  $q$select lab.hacer(lab.como('diego@x.com'), $x$select public.anotar_error('h1', 'Reportes', null, null)::text$x$)$q$, 'true');
select lab.comprobar('…suma a esa persona: dos personas, tres veces, una sola fila',
  $q$select veces || '/' || cardinality(personas) || ' ' || (select count(*) from public.problemas) from public.problemas$q$, '3/2 1');
select lab.comprobar('otro error',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('h2', 'Inicio', 'Failed to fetch', null)::text$x$)$q$, 'true');
select lab.comprobar('…es otra fila', $q$select count(*)::text from public.problemas$q$, '2');
update public.problemas set estado = 'resuelto' where huella = 'h1';
select lab.comprobar('si ya estaba resuelto y vuelve a pasar, la función contesta que sí',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('h1', 'Reportes', null, null)::text$x$)$q$, 'true');
select lab.comprobar('…y se abre uno nuevo (el admin lo tiene que ver): el resuelto sigue y hay uno «nuevo»',
  $q$select (select count(*) from public.problemas where huella = 'h1') || ' ' || (select count(*) from public.problemas where huella = 'h1' and estado = 'nuevo')$q$, '2 1');
select lab.comprobar('sin huella o con una demasiado larga, no',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('', 'Inicio', 'x', null)::text || ' ' || public.anotar_error(repeat('h', 65), 'Inicio', 'x', null)::text$x$)$q$, 'false false');
select lab.comprobar('alguien de afuera no anota errores',
  $q$select lab.hacer(lab.como('afuera@x.com'), $x$select public.anotar_error('h9', 'Inicio', 'x', null)::text$x$)$q$, 'false');
delete from public.problemas;
insert into public.problemas(origen, autor, huella, personas) select 'automatico', 'ana@x.com', 'g' || g, array['ana@x.com'] from generate_series(1, 20) g;
select lab.comprobar('con 20 errores nuevos en la última hora de esa persona, uno nuevo más no entra',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('nuevo', 'Inicio', 'x', null)::text$x$)$q$, 'false');
select lab.comprobar('pero sumar a uno que ya existe sí',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.anotar_error('g1', 'Inicio', 'x', null)::text$x$)$q$, 'true');
delete from public.problemas;
insert into public.problemas(origen, autor, huella, personas, veces) values ('automatico', 'ana@x.com', 'tope', array['ana@x.com'], 1000000);
select lab.comprobar('el contador no se pasa del tope: contesta que sí',
  $q$select lab.hacer(lab.como('diego@x.com'), $x$select public.anotar_error('tope', 'Inicio', 'x', null)::text$x$)$q$, 'true');
select lab.comprobar('…y queda en el tope', $q$select veces::text from public.problemas$q$, '1000000');
delete from public.problemas;

-- ---------- Quién lee, cambia y borra ----------
insert into public.problemas(origen, autor, nombre, pantalla, mensaje, personas) values ('persona', 'ana@x.com', 'Ana', 'Inicio', 'No carga', array['ana@x.com']);
select lab.probar('un admin lee la lista', lab.como('benny@team-latam.com'), $q$select * from public.problemas$q$, true);
select lab.probar('otro admin (por rol), también', lab.como('otra.admin@x.com'), $q$select * from public.problemas$q$, true);
select lab.probar('un integrante común no la lee (ni lo suyo)', lab.como('ana@x.com'), $q$select * from public.problemas$q$, false);
select lab.probar('un observador, tampoco', lab.como('olga@x.com'), $q$select * from public.problemas$q$, false);
select lab.probar('un admin cambia el estado', lab.como('benny@team-latam.com'), $q$update public.problemas set estado = 'visto'$q$, true);
select lab.probar('pero solo el estado: no el mensaje', lab.como('benny@team-latam.com'), $q$update public.problemas set mensaje = 'otro'$q$, false);
select lab.probar('ni a quién le pasó', lab.como('benny@team-latam.com'), $q$update public.problemas set autor = 'diego@x.com'$q$, false);
select lab.probar('un estado que no existe, no', lab.como('benny@team-latam.com'), $q$update public.problemas set estado = 'archivado'$q$, false);
select lab.probar('un integrante no cambia el estado', lab.como('ana@x.com'), $q$update public.problemas set estado = 'resuelto'$q$, false);
select lab.probar('nadie escribe directo: ni un integrante', lab.como('ana@x.com'), $q$insert into public.problemas(origen, autor, personas) values ('persona', 'ana@x.com', '{}')$q$, false);
select lab.probar('ni un admin', lab.como('benny@team-latam.com'), $q$insert into public.problemas(origen, autor, personas) values ('persona', 'benny@team-latam.com', '{}')$q$, false);
select lab.probar('un integrante no borra', lab.como('ana@x.com'), $q$delete from public.problemas$q$, false);
select lab.probar('un admin sí', lab.como('benny@team-latam.com'), $q$delete from public.problemas$q$, true);

-- ---------- Permisos ----------
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'las dos funciones las ejecuta quien tiene sesión y no anon', true,
  has_function_privilege('authenticated', 'public.contar_problema(text, text, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.anotar_error(text, text, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.contar_problema(text, text, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.anotar_error(text, text, text, jsonb)', 'execute'), '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'la tabla no se ve sin sesión, y no se publica en vivo', true,
  not has_table_privilege('anon', 'public.problemas', 'select')
  and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'problemas'), '';

drop function lab.hacer(jsonb, text);
\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
