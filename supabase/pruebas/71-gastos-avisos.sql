\set QUIET on
-- ============================================================
-- Gastos: los avisos por correo, cada regla con su caso (25/11/2026)
-- ============================================================
-- El rompe-código sobre 27-gastos.sql (herramientas/auditoria/herramientas/mutaciones_sql.mjs) mostró que las reglas de los
-- dos avisos («te observaron un gasto» y «te mandaron una rendición») tenían probado el camino feliz y poco más: el tope de
-- 30 avisos por hora, quién cuenta para ese tope, a quién le puede llegar, qué pasa con una rendición vieja, a medio hacer o
-- ajena. Acá cada regla tiene su caso. Cada llamada se hace como esa persona y se deshace sola (lab.llama): las filas que el
-- aviso deja anotadas (avisos_enviados) no pasan a la prueba siguiente. Personas y montos inventados.
truncate lab.resultados;
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.avisos_enviados, public.avisos_listos;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';
delete from public.user_prefs;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('otra@x.com', 'Otra', 'otra', 'admin'), ('fin@x.com', 'Fina', 'fina', 'finance'),
  ('ana@x.com', 'Ana', 'ana', 'member'), ('diego@x.com', 'Diego', 'diego', 'member');
insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Visita a Lima', 'C', '2026-09-10', '2026-09-10', '2026-09-12', 'visita', 'Benny', 'benny@team-latam.com', '[{"name":"Ana","email":"ana@x.com"}]');
insert into public.app_config(key, value) values ('preferences', '{"correos": {"quienes": "todos"}}');
-- Una rendición de Ana, ya devuelta (observada), con un gasto observado y un comentario de Benny de recién.
insert into public.gastos_rendiciones (id, autor, post_id, titulo, estado, enviada_el) values
  ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', 'p1', 'Visita a Lima', 'observada', now() - interval '2 days');
insert into public.gastos (id, autor, rendicion_id, estado, fecha, concepto, tipo, moneda, monto) values
  ('c0000000-0000-4000-8000-0000000000c1', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'observado', '2026-09-02', 'Hotel', 'alojamiento', 'USD', 100);
insert into public.gastos_comentarios (id, gasto_id, autor, texto) values ('90000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000c1', 'benny@team-latam.com', 'Falta la factura');
-- Una rendición de Ana recién mandada, para el otro aviso.
insert into public.gastos_rendiciones (id, autor, post_id, titulo, estado, enviada_el) values
  ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', null, 'Rutina de septiembre', 'enviada', now() - interval '5 minutes');
update public.gastos_rendiciones set rutina_mes = '2026-09-01', titulo = '' where id = 'a0000000-0000-4000-8000-0000000000a2';
insert into public.gastos (id, autor, rendicion_id, estado, fecha, concepto, tipo, moneda, monto, rendido_moneda, rendido_monto) values
  ('c0000000-0000-4000-8000-0000000000c2', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'enviado', '2026-09-02', 'Pasajes', 'pasaje', 'ARS', 90000, 'USD', 80),
  ('c0000000-0000-4000-8000-0000000000c3', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'enviado', '2026-09-03', 'Taxi', 'transporte', 'EUR', 20, 'EUR', null),
  ('c0000000-0000-4000-8000-0000000000c4', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'borrador', null, '', null, 'USD', 999, 'USD', null);

-- Llama algo como esa persona y dice qué contestó (o «ERR» y el mensaje); siempre lo deshace. Varias sentencias se separan
-- con « ;; »: las que empiezan con «select» suman su resultado (separados por «/»), las que empiezan con «#» se hacen como
-- el dueño de la base (para dejar el escenario como se necesita), los «#select» también suman su resultado, el resto se hace como esa persona.
create or replace function lab.llama(quien text, sentencia text) returns text language plpgsql as $$
declare r text; p text; salida text[] := '{}';
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', lab.como(quien)::text, true);
  begin
    foreach p in array string_to_array(sentencia, ' ;; ') loop
      if left(p, 1) = '#' then
        execute 'reset role';
        if substr(p, 2) ~* '^\s*select' then execute substr(p, 2) into r; salida := salida || coalesce(r, '(nulo)'); else execute substr(p, 2); end if;
        execute 'set local role authenticated';
      elsif p ~* '^\s*select' then execute p into r; salida := salida || coalesce(r, '(nulo)');
      else execute p; end if;
    end loop;
    raise exception '#%', array_to_string(salida, '/') using errcode = 'P0001';
  exception when others then
    if sqlerrm like '#%' then r := substr(sqlerrm, 2); else r := 'ERR ' || sqlerrm; end if;
  end;
  execute 'reset role';
  return r;
end $$;

-- «sale» si la función devuelve un turno; «nada» si no.
create temp table casos (n serial, nombre text, quien text, sentencia text, esperado text);
-- ----- «Te observaron un gasto» -----
insert into casos (nombre, quien, sentencia, esperado) values
  ('observación: el admin que comentó, con la rendición devuelta, sí', 'benny@team-latam.com', $s$select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: otra administradora que no comentó, no', 'otra@x.com', $s$select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: quien comentó y es Finanzas, sí', 'fin@x.com', $s$#insert into public.gastos_comentarios (gasto_id, autor, texto) values ('c0000000-0000-4000-8000-0000000000c1', 'fin@x.com', 'Y la fecha') ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: una integrante no la pide', 'diego@x.com', $s$#insert into public.gastos_comentarios (gasto_id, autor, texto) values ('c0000000-0000-4000-8000-0000000000c1', 'diego@x.com', 'hola') ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: un gasto que no existe, no', 'benny@team-latam.com', $s$select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000ff') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: un gasto que ya no está observado, no', 'benny@team-latam.com', $s$#update public.gastos set estado = 'confirmado' where id = 'c0000000-0000-4000-8000-0000000000c1' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: si la rendición sigue en revisión (enviada), no', 'benny@team-latam.com', $s$#update public.gastos_rendiciones set estado = 'enviada' where id = 'a0000000-0000-4000-8000-0000000000a1' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: el admin no se avisa a sí mismo (un gasto suyo observado por él)', 'benny@team-latam.com', $s$#update public.gastos set autor = 'benny@team-latam.com' where id = 'c0000000-0000-4000-8000-0000000000c1' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: un comentario de hace una semana y una hora, no', 'benny@team-latam.com', $s$#update public.gastos_rendiciones set enviada_el = now() - interval '20 days' ;; #update public.gastos_comentarios set creado_el = now() - interval '7 days 1 hour' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: uno de hace seis días, sí', 'benny@team-latam.com', $s$#update public.gastos_rendiciones set enviada_el = now() - interval '20 days' ;; #update public.gastos_comentarios set creado_el = now() - interval '6 days' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: un comentario anterior al último envío de la rendición, no', 'benny@team-latam.com', $s$#update public.gastos_comentarios set creado_el = now() - interval '3 days' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: tope de 30 por hora: con 29 anotados, sale', 'benny@team-latam.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'benny@team-latam.com' from generate_series(1, 29) i ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: con 30 anotados, no', 'benny@team-latam.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'benny@team-latam.com' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: 30 anotados hace más de una hora no cuentan', 'benny@team-latam.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor, enviado_el) select 'gasto', 'x' || i, 'diego@x.com', 'benny@team-latam.com', now() - interval '2 hours' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: 30 anotados por otro admin no cuentan', 'benny@team-latam.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'otra@x.com' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: con Gastos cerrado al equipo, a una integrante no le llega', 'benny@team-latam.com', $s$#update public.app_config set value = '{"correos": {"quienes": "todos"}, "gastos": {"abierto": false}}' where key = 'preferences' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: …pero a una administradora sí', 'benny@team-latam.com', $s$#update public.app_config set value = '{"correos": {"quienes": "todos"}, "gastos": {"abierto": false}}' where key = 'preferences' ;; #update public.gastos set autor = 'otra@x.com' where id = 'c0000000-0000-4000-8000-0000000000c1' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: …y a Finanzas también', 'benny@team-latam.com', $s$#update public.app_config set value = '{"correos": {"quienes": "todos"}, "gastos": {"abierto": false}}' where key = 'preferences' ;; #update public.gastos set autor = 'fin@x.com' where id = 'c0000000-0000-4000-8000-0000000000c1' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('observación: a una observadora no (ya no es integrante del equipo)', 'benny@team-latam.com', $s$#update public.members set role = 'observer' where email = 'ana@x.com' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: a quien no es del equipo, no', 'benny@team-latam.com', $s$#delete from public.members where email = 'ana@x.com' ;; select coalesce((public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('observación: el aviso lleva al gasto, a quién y de qué actividad', 'benny@team-latam.com', $s$select (x -> 'para' -> 0 ->> 'email') || '|' || (x ->> 'concepto') || '|' || (x ->> 'actividad') || '|' || (x ->> 'texto') || '|' || (x ->> 'autor') from (select lab.aviso(public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1')) x) y$s$, 'ana@x.com|Hotel|Visita a Lima|Falta la factura|Benny'),
  ('observación: queda anotado para que no salga dos veces', 'benny@team-latam.com', $s$select (public.preparar_aviso_de_gasto('c0000000-0000-4000-8000-0000000000c1') is not null)::text ;; #select count(*)::text from public.avisos_enviados where tipo = 'gasto'$s$, 'true/1'),
  -- ----- «Te mandaron una rendición» -----
  ('rendición: Ana, que la mandó, la avisa', 'ana@x.com', $s$select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('rendición: no la avisa quien no la mandó', 'diego@x.com', $s$select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: una administradora tampoco', 'otra@x.com', $s$select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: una que no existe, no', 'ana@x.com', $s$select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000ff') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: una que no está mandada (abierta), no', 'ana@x.com', $s$#update public.gastos_rendiciones set estado = 'abierta' where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: una sin fecha de envío, no', 'ana@x.com', $s$#update public.gastos_rendiciones set enviada_el = null where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: mandada hace más de una hora, no', 'ana@x.com', $s$#update public.gastos_rendiciones set enviada_el = now() - interval '61 minutes' where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: mandada hace 59 minutos, sí', 'ana@x.com', $s$#update public.gastos_rendiciones set enviada_el = now() - interval '59 minutes' where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('rendición: con Gastos cerrado al equipo, Ana no la avisa', 'ana@x.com', $s$#update public.app_config set value = '{"correos": {"quienes": "todos"}, "gastos": {"abierto": false}}' where key = 'preferences' ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: tope de 30 por hora: con 29 anotados, sale', 'ana@x.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'ana@x.com' from generate_series(1, 29) i ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('rendición: con 30 anotados, no', 'ana@x.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'ana@x.com' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: 30 anotados hace más de una hora no cuentan', 'ana@x.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor, enviado_el) select 'gasto', 'x' || i, 'diego@x.com', 'ana@x.com', now() - interval '2 hours' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('rendición: 30 anotados por otra persona no cuentan', 'ana@x.com', $s$#insert into public.avisos_enviados(tipo, objeto, email, autor) select 'gasto', 'x' || i, 'diego@x.com', 'otra@x.com' from generate_series(1, 30) i ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true'),
  ('rendición: le llega al admin fijo, a la administradora y a Finanzas (no a quien la mandó ni a una integrante)', 'ana@x.com', $s$select string_agg(e ->> 'email', ',' order by e ->> 'email') from (select jsonb_array_elements(lab.aviso(public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2')) -> 'para') e) q$s$, 'benny@team-latam.com,fin@x.com,otra@x.com'),
  ('rendición: si quien la manda es una administradora, no se avisa a sí misma', 'otra@x.com', $s$#update public.gastos_rendiciones set autor = 'otra@x.com' where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select string_agg(e ->> 'email', ',' order by e ->> 'email') from (select jsonb_array_elements(lab.aviso(public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2')) -> 'para') e) q$s$, 'benny@team-latam.com,fin@x.com'),
  ('rendición: dice cuántos gastos (sin los borradores) y el total por moneda, en lo que se rinde', 'ana@x.com', $s$select (x ->> 'gastos') || '|' || (x -> 'totales' ->> 'USD') || '|' || (x -> 'totales' ->> 'EUR') || '|' || coalesce(x -> 'totales' ->> 'ARS', 'sin ARS') from (select lab.aviso(public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2')) x) y$s$, '2|80.00|20.00|sin ARS'),
  ('rendición: dice de qué mes es (la rutina) y de quién', 'ana@x.com', $s$select (x ->> 'mes') || '|' || (x ->> 'autor') from (select lab.aviso(public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2')) x) y$s$, '2026-09-01|Ana'),
  ('rendición: si todos los que la tienen que revisar apagaron los correos, no sale', 'ana@x.com', $s$#insert into public.user_prefs(email, prefs) select email, '{"emailOn": false}' from public.members where role in ('admin', 'finance') ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'nada'),
  ('rendición: quien apagó «gastos» no la recibe; los demás sí', 'ana@x.com', $s$#insert into public.user_prefs(email, prefs) values ('otra@x.com', '{"emailGastos": false}') ;; select string_agg(e ->> 'email', ',' order by e ->> 'email') from (select jsonb_array_elements(lab.aviso(public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2')) -> 'para') e) q$s$, 'benny@team-latam.com,fin@x.com'),
  ('rendición: sale una sola vez por envío', 'ana@x.com', $s$select (public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') is not null)::text ;; select coalesce((public.preparar_aviso_de_rendicion('a0000000-0000-4000-8000-0000000000a2') ? 'ticket')::text, 'nada')$s$, 'true/nada');
do $$
declare c record;
begin
  for c in select * from casos order by n loop
    perform lab.comprobar(c.nombre, format('select lab.llama(%L, %L)', c.quien, c.sentencia), c.esperado);
  end loop;
end $$;

-- Limpieza, para las pruebas que vienen después.
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.avisos_enviados, public.avisos_listos;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';
delete from public.user_prefs;

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
