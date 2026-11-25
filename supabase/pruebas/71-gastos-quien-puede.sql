\set QUIET on
-- ============================================================
-- Gastos y rendiciones: quién puede tocar qué, caso por caso (25/11/2026)
-- ============================================================
-- El rompe-código sobre 27-gastos.sql (herramientas/auditoria/herramientas/mutaciones_sql.mjs) mostró que muchas condiciones
-- de las políticas y de los disparadores no tenían un caso que las hiciera fallar: se podía cambiar un «and» por un «or»
-- en «solo con Gastos abierto» o «solo mientras la rendición se corrige» y ninguna prueba se enteraba. Acá, para cada tabla
-- y cada operación, se prueba quién SÍ puede, y cada razón por la que otro NO puede: de otra persona, con Gastos
-- cerrado al equipo, con la rendición ya mandada o aprobada, siendo admin por rol (que no es el admin fijo), Finanzas u
-- observadora. Cada prueba se hace como esa persona y se deshace sola (lab.filas, lab.ve). Personas y montos inventados.
truncate lab.resultados;
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('otra@x.com', 'Otra', 'otra', 'admin'), ('fin@x.com', 'Fina', 'fina', 'finance'),
  ('ana@x.com', 'Ana', 'ana', 'member'), ('diego@x.com', 'Diego', 'diego', 'member'), ('olga@x.com', 'Olga', 'olga', 'observer');
insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Visita a Lima', 'C', '2026-09-10', '2026-09-10', '2026-09-12', 'visita', 'Benny', 'benny@team-latam.com', '[{"name":"Ana","email":"ana@x.com"}]');

-- Rendiciones de Ana en cada estado, y una de Diego.
insert into public.gastos_rendiciones (id, autor, rutina_mes, titulo, estado, enviada_el, aprobada_el, aprobada_por) values
  ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', '2026-09-01', 'Abierta', 'abierta', null, null, null),
  ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', '2026-08-01', 'Enviada', 'enviada', now(), null, null),
  ('a0000000-0000-4000-8000-0000000000a3', 'ana@x.com', '2026-07-01', 'Aprobada', 'aprobada', now(), now(), 'benny@team-latam.com'),
  ('a0000000-0000-4000-8000-0000000000a4', 'ana@x.com', '2026-06-01', 'Observada', 'observada', now(), null, null),
  ('a0000000-0000-4000-8000-0000000000a5', 'ana@x.com', '2026-05-01', 'Vacía', 'abierta', null, null, null),
  ('d0000000-0000-4000-8000-0000000000d1', 'diego@x.com', '2026-09-01', 'De Diego', 'abierta', null, null, null);
insert into public.gastos (id, autor, rendicion_id, estado, fecha, concepto, tipo) values
  ('b0000000-0000-4000-8000-0000000000b1', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'borrador', null, '', null),
  ('b0000000-0000-4000-8000-0000000000b2', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'confirmado', '2026-09-02', 'Taxi', 'transporte'),
  ('b0000000-0000-4000-8000-0000000000b3', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'enviado', '2026-08-02', 'Hotel', 'alojamiento'),
  ('b0000000-0000-4000-8000-0000000000b4', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a3', 'aprobado', '2026-07-02', 'Cena', 'comida'),
  ('b0000000-0000-4000-8000-0000000000b5', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a4', 'observado', '2026-06-02', 'Pasaje', 'pasaje'),
  ('b0000000-0000-4000-8000-0000000000b6', 'ana@x.com', null, 'borrador', null, '', null),
  ('b0000000-0000-4000-8000-0000000000b7', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'observado', '2026-08-03', 'Taxi', 'transporte'),
  ('b0000000-0000-4000-8000-0000000000b8', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'borrador', null, '', null),
  ('c0000000-0000-4000-8000-0000000000c1', 'diego@x.com', 'd0000000-0000-4000-8000-0000000000d1', 'borrador', null, '', null);
insert into public.gastos_movimientos (id, persona, tipo, fecha, moneda, monto, estado, cargado_por, confirmado_por, confirmado_el) values
  ('e0000000-0000-4000-8000-0000000000e1', 'ana@x.com', 'recibido', '2026-09-01', 'USD', 100, 'pendiente', 'ana@x.com', null, null),
  ('e0000000-0000-4000-8000-0000000000e2', 'ana@x.com', 'recibido', '2026-09-02', 'USD', 50, 'confirmado', 'benny@team-latam.com', 'benny@team-latam.com', now()),
  ('e0000000-0000-4000-8000-0000000000e3', 'diego@x.com', 'recibido', '2026-09-03', 'USD', 20, 'pendiente', 'diego@x.com', null, null);
insert into public.gastos_cambios (id, rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values
  ('f0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', '2026-09-02', 'USD', 100, 'ANG', 180),
  ('f0000000-0000-4000-8000-0000000000f2', 'a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', '2026-08-02', 'USD', 100, 'ANG', 180),
  ('f0000000-0000-4000-8000-0000000000f3', 'd0000000-0000-4000-8000-0000000000d1', 'diego@x.com', '2026-09-02', 'USD', 100, 'ANG', 180);
insert into public.gastos_comentarios (id, gasto_id, autor, texto) values ('90000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-0000000000b5', 'benny@team-latam.com', 'Falta la factura');

-- ¿Cuántas filas ve esa persona? («error» si la base la frena)
create or replace function lab.ve(quien text, consulta text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', lab.como(quien)::text, true);
  begin execute format('select count(*)::text from (%s) t', consulta) into r;
  exception when others then r := 'error ' || sqlstate; end;
  execute 'reset role';
  return r;
end $$;
-- ¿Cuántas filas toca esa persona con esa sentencia (insert, update o delete)? Se deshace sola, así la prueba siguiente parte
-- del mismo punto. «0» = la política la dejó afuera; «error 42501» = el disparador o la política la frenó; «error 23514» = una regla de forma.
create or replace function lab.filas(quien text, sentencia text) returns text language plpgsql as $$
declare r text; n bigint;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', lab.como(quien)::text, true);
  begin
    -- Sin «returning»: así lo que se prueba es la política de escribir y no la de leer lo escrito.
    execute sentencia;
    get diagnostics n = row_count; r := n::text;
    raise exception '#%', r using errcode = 'P0001';       -- fuerza el rollback del bloque: la sentencia no queda hecha
  exception when others then
    if sqlerrm like '#%' then r := substr(sqlerrm, 2); else r := 'error ' || sqlstate; end if;
  end;
  execute 'reset role';
  return r;
end $$;

-- Qué mensaje dio la base (o «sin error»): sirve para distinguir al disparador de la política cuando los dos frenan con el mismo código.
create or replace function lab.mensaje(quien text, sentencia text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', lab.como(quien)::text, true);
  begin
    execute sentencia;
    raise exception '#sin error' using errcode = 'P0001';
  exception when others then
    if sqlerrm like '#%' then r := substr(sqlerrm, 2); else r := sqlerrm; end if;
  end;
  execute 'reset role';
  return r;
end $$;

create temp table casos (n serial, nombre text, quien text, sentencia text, esperado text, ve boolean default false);
-- Los gastos están abiertos para el equipo (no hay nada guardado).
insert into casos (nombre, quien, sentencia, esperado, ve) values
  -- ----- ¿Quién ve las rendiciones, los gastos, los movimientos, los cambios? -----
  ('rendiciones: Ana ve las suyas (5)', 'ana@x.com', 'select 1 from public.gastos_rendiciones', '5', true),
  ('rendiciones: Diego ve la suya (1)', 'diego@x.com', 'select 1 from public.gastos_rendiciones', '1', true),
  ('rendiciones: una administradora por rol ve todas (6)', 'otra@x.com', 'select 1 from public.gastos_rendiciones', '6', true),
  ('rendiciones: Finanzas ve todas (6)', 'fin@x.com', 'select 1 from public.gastos_rendiciones', '6', true),
  ('rendiciones: el admin fijo ve todas (6)', 'benny@team-latam.com', 'select 1 from public.gastos_rendiciones', '6', true),
  ('rendiciones: una observadora no ve ninguna', 'olga@x.com', 'select 1 from public.gastos_rendiciones', '0', true),
  ('gastos: Ana ve los suyos (8)', 'ana@x.com', 'select 1 from public.gastos', '8', true),
  ('gastos: Diego ve el suyo (1)', 'diego@x.com', 'select 1 from public.gastos', '1', true),
  ('gastos: Finanzas ve todos (9)', 'fin@x.com', 'select 1 from public.gastos', '9', true),
  ('gastos: una observadora no ve ninguno', 'olga@x.com', 'select 1 from public.gastos', '0', true),
  ('movimientos: Ana ve los suyos (2)', 'ana@x.com', 'select 1 from public.gastos_movimientos', '2', true),
  ('movimientos: Diego ve el suyo (1)', 'diego@x.com', 'select 1 from public.gastos_movimientos', '1', true),
  ('movimientos: Finanzas ve todos (3)', 'fin@x.com', 'select 1 from public.gastos_movimientos', '3', true),
  ('movimientos: una observadora no ve ninguno', 'olga@x.com', 'select 1 from public.gastos_movimientos', '0', true),
  ('cambios: Ana ve los suyos (2)', 'ana@x.com', 'select 1 from public.gastos_cambios', '2', true),
  ('cambios: Diego ve el suyo (1)', 'diego@x.com', 'select 1 from public.gastos_cambios', '1', true),
  ('cambios: Finanzas ve todos (3)', 'fin@x.com', 'select 1 from public.gastos_cambios', '3', true),
  ('cambios: una observadora no ve ninguno', 'olga@x.com', 'select 1 from public.gastos_cambios', '0', true),
  ('comentarios: Ana ve los de sus gastos (1)', 'ana@x.com', 'select 1 from public.gastos_comentarios', '1', true),
  ('comentarios: Diego no ve los de Ana', 'diego@x.com', 'select 1 from public.gastos_comentarios', '0', true),
  -- ----- Rendiciones: el total rápido, y borrar -----
  ('total rápido: Ana lo anota en una rendición abierta', 'ana@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a1'$s$, '1', false),
  ('total rápido: en una observada también', 'ana@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a4'$s$, '1', false),
  ('total rápido: en una ya mandada, no', 'ana@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a2'$s$, '0', false),
  ('total rápido: en una aprobada, no', 'ana@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a3'$s$, '0', false),
  ('total rápido: Diego no lo anota en la rendición de Ana', 'diego@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a1'$s$, '0', false),
  ('total rápido: una administradora por rol tampoco lo anota en la de Ana (lo hace Ana)', 'otra@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a1'$s$, '0', false),
  ('total rápido: nadie cambia el estado desde el navegador', 'ana@x.com', $s$update public.gastos_rendiciones set estado = 'aprobada' where id = 'a0000000-0000-4000-8000-0000000000a1'$s$, 'error 42501', false),
  ('borrar rendición: Ana borra una suya, abierta y vacía', 'ana@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '1', false),
  ('borrar rendición: una ya mandada, no', 'ana@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a2'$s$, '0', false),
  ('borrar rendición: una observada, no', 'ana@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a4'$s$, '0', false),
  ('borrar rendición: Diego no borra la de Ana', 'diego@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '0', false),
  ('borrar rendición: una administradora por rol no borra la de Ana', 'otra@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '0', false),
  ('borrar rendición: el admin fijo borra una vacía de cualquiera', 'benny@team-latam.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '1', false),
  ('borrar rendición: el admin fijo borra una ya mandada, vacía', 'benny@team-latam.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a4'$s$, 'error 23503', false),
  -- ----- Gastos: crear, editar, borrar -----
  ('gastos: Ana carga uno suyo en su rendición abierta', 'ana@x.com', $s$insert into public.gastos (rendicion_id, autor) values ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com')$s$, '1', false),
  ('gastos: Ana carga uno sin rendición («sin vincular»)', 'ana@x.com', $s$insert into public.gastos (autor) values ('ana@x.com')$s$, '1', false),
  ('gastos: Ana no carga uno en la rendición de Diego', 'ana@x.com', $s$insert into public.gastos (rendicion_id, autor) values ('d0000000-0000-4000-8000-0000000000d1', 'ana@x.com')$s$, 'error 42501', false),
  ('gastos: Ana no carga uno en una rendición ya mandada', 'ana@x.com', $s$insert into public.gastos (rendicion_id, autor) values ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com')$s$, 'error 23514', false),
  ('gastos: Ana no carga uno ya mandado', 'ana@x.com', $s$insert into public.gastos (autor, estado, fecha, concepto, tipo) values ('ana@x.com', 'enviado', '2026-09-01', 'x', 'comida')$s$, 'error 23514', false),
  ('gastos: una observadora no carga', 'olga@x.com', $s$insert into public.gastos (autor) values ('olga@x.com')$s$, 'error 42501', false),
  ('gastos: Ana corrige uno borrador', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '1', false),
  ('gastos: …uno confirmado', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b2'$s$, '1', false),
  ('gastos: …uno observado en una rendición observada', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b5'$s$, '1', false),
  ('gastos: uno ya mandado, no', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b3'$s$, '0', false),
  ('gastos: uno aprobado, no', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b4'$s$, '0', false),
  ('gastos: uno observado cuya rendición sigue en revisión, no (D18)', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b7'$s$, '0', false),
  ('gastos: uno sin rendición se corrige', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b6'$s$, '1', false),
  ('gastos: Diego no corrige los de Ana', 'diego@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('gastos: ni una administradora por rol, ni Finanzas', 'otra@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('gastos: de quién es un gasto no se cambia', 'ana@x.com', $s$update public.gastos set autor = 'diego@x.com' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 42501', false),
  ('gastos: de cuándo es la carga, tampoco', 'ana@x.com', $s$update public.gastos set creado_el = now() - interval '1 day' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 42501', false),
  ('gastos: Ana no pasa uno a «aprobado»', 'ana@x.com', $s$update public.gastos set estado = 'aprobado' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 42501', false),
  ('gastos: Ana no pasa uno a «enviado»', 'ana@x.com', $s$update public.gastos set estado = 'enviado' where id = 'b0000000-0000-4000-8000-0000000000b2'$s$, 'error 42501', false),
  ('gastos: Ana no se pone uno «observado» sola', 'ana@x.com', $s$update public.gastos set estado = 'observado' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 42501', false),
  ('gastos: uno observado puede volver a confirmado', 'ana@x.com', $s$update public.gastos set estado = 'confirmado' where id = 'b0000000-0000-4000-8000-0000000000b5'$s$, '1', false),
  ('gastos: el comprobante va en la carpeta de su gasto', 'ana@x.com', $s$update public.gastos set archivo = 'gastos/b0000000-0000-4000-8000-0000000000b1/a.pdf' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '1', false),
  ('gastos: y no en la de otro', 'ana@x.com', $s$update public.gastos set archivo = 'gastos/b0000000-0000-4000-8000-0000000000b2/a.pdf' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 23514', false),
  ('gastos: ni sin carpeta de gasto', 'ana@x.com', $s$update public.gastos set archivo = 'gastos/a.pdf' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 23514', false),
  ('gastos: Ana pasa uno a otra rendición suya que se corrige', 'ana@x.com', $s$update public.gastos set rendicion_id = 'a0000000-0000-4000-8000-0000000000a4' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '1', false),
  ('gastos: no a la rendición de otra persona', 'ana@x.com', $s$update public.gastos set rendicion_id = 'd0000000-0000-4000-8000-0000000000d1' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 42501', false),
  ('gastos: no a una rendición ya mandada', 'ana@x.com', $s$update public.gastos set rendicion_id = 'a0000000-0000-4000-8000-0000000000a2' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'error 23514', false),
  ('gastos: lo de «cuándo se aprobó» no lo escribe nadie desde el navegador', 'ana@x.com', $s$update public.gastos set aprobado_el = now() where id = 'b0000000-0000-4000-8000-0000000000b1' and aprobado_el is null$s$, '1', false),
  ('gastos: Ana borra uno borrador', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '1', false),
  ('gastos: …uno confirmado', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b2'$s$, '1', false),
  ('gastos: …uno observado de una rendición observada', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b5'$s$, '1', false),
  ('gastos: …uno sin rendición', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b6'$s$, '1', false),
  ('gastos: uno ya mandado, no', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b3'$s$, '0', false),
  ('gastos: uno aprobado, no', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b4'$s$, '0', false),
  ('gastos: uno observado en una rendición en revisión, no', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b7'$s$, '0', false),
  ('gastos: Diego no borra los de Ana', 'diego@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('gastos: una administradora por rol no borra gastos ajenos', 'otra@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('gastos: el admin fijo borra uno ya mandado', 'benny@team-latam.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b3'$s$, '1', false),
  ('gastos: …y uno aprobado, de cualquiera', 'benny@team-latam.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b4'$s$, '1', false),
  -- ----- Comentarios -----
  ('comentarios: el admin fijo los borra', 'benny@team-latam.com', $s$delete from public.gastos_comentarios where id = '90000000-0000-4000-8000-000000000001'$s$, '1', false),
  ('comentarios: una administradora por rol no', 'otra@x.com', $s$delete from public.gastos_comentarios where id = '90000000-0000-4000-8000-000000000001'$s$, '0', false),
  ('comentarios: la autora del gasto no', 'ana@x.com', $s$delete from public.gastos_comentarios where id = '90000000-0000-4000-8000-000000000001'$s$, '0', false),
  ('comentarios: nadie los escribe directo (solo con las funciones)', 'benny@team-latam.com', $s$insert into public.gastos_comentarios (gasto_id, autor, texto) values ('b0000000-0000-4000-8000-0000000000b5', 'benny@team-latam.com', 'x')$s$, 'error 42501', false),
  -- ----- Movimientos de plata -----
  ('movimientos: Ana anota uno suyo', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, '1', false),
  ('movimientos: queda pendiente aunque Ana diga «confirmado»', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por, estado) values ('ana@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'ana@x.com', 'confirmado')$s$, '1', false),
  ('movimientos: Ana no anota uno de Diego', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('diego@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, 'error 42501', false),
  ('movimientos: Ana no anota un ajuste', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'ajuste', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, 'error 42501', false),
  ('movimientos: una administradora por rol anota uno de Ana', 'otra@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'recibido', '2026-09-05', 'USD', 5, 'otra@x.com')$s$, '1', false),
  ('movimientos: …y un ajuste', 'otra@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'ajuste', '2026-09-05', 'USD', -5, 'otra@x.com')$s$, '1', false),
  ('movimientos: Finanzas también anota uno de Ana', 'fin@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'recibido', '2026-09-05', 'USD', 5, 'fin@x.com')$s$, '1', false),
  ('movimientos: una observadora no anota', 'olga@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('olga@x.com', 'recibido', '2026-09-05', 'USD', 5, 'olga@x.com')$s$, 'error 42501', false),
  ('movimientos: Ana corrige uno suyo pendiente', 'ana@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('movimientos: uno ya confirmado, no', 'ana@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e2'$s$, '0', false),
  ('movimientos: Diego no toca los de Ana', 'diego@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '0', false),
  ('movimientos: Ana no confirma el suyo', 'ana@x.com', $s$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 42501', false),
  ('movimientos: Ana no lo vuelve un ajuste', 'ana@x.com', $s$update public.gastos_movimientos set tipo = 'ajuste' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 42501', false),
  ('movimientos: de quién es no se cambia (ni Ana)', 'ana@x.com', $s$update public.gastos_movimientos set persona = 'diego@x.com' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 42501', false),
  ('movimientos: ni un admin cambia de quién es', 'benny@team-latam.com', $s$update public.gastos_movimientos set persona = 'diego@x.com' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 42501', false),
  ('movimientos: ni quién lo cargó', 'benny@team-latam.com', $s$update public.gastos_movimientos set cargado_por = 'diego@x.com' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 42501', false),
  ('movimientos: un admin confirma el de Ana', 'otra@x.com', $s$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('movimientos: Finanzas también', 'fin@x.com', $s$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('movimientos: un admin corrige uno ya confirmado', 'otra@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e2'$s$, '1', false),
  ('movimientos: Ana borra uno suyo pendiente', 'ana@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('movimientos: uno confirmado, no', 'ana@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e2'$s$, '0', false),
  ('movimientos: Diego no borra los de Ana', 'diego@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '0', false),
  ('movimientos: un admin borra uno confirmado', 'otra@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e2'$s$, '1', false),
  ('movimientos: Finanzas también', 'fin@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e2'$s$, '1', false),
  ('movimientos: el comprobante va en la carpeta de su movimiento', 'ana@x.com', $s$update public.gastos_movimientos set archivo = 'gastos/mov-e0000000-0000-4000-8000-0000000000e1/a.pdf' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('movimientos: y no en otra', 'ana@x.com', $s$update public.gastos_movimientos set archivo = 'gastos/mov-otra/a.pdf' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'error 23514', false),
  -- ----- Cambios de moneda -----
  ('cambios: Ana anota uno en su rendición abierta', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, '1', false),
  ('cambios: …y en una observada', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a4', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, '1', false),
  ('cambios: no en una ya mandada', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'error 23514', false),
  ('cambios: no en la rendición de Diego', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('d0000000-0000-4000-8000-0000000000d1', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'error 42501', false),
  ('cambios: una observadora no anota', 'olga@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a1', 'olga@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'error 42501', false),
  ('cambios: Ana corrige uno suyo de una rendición abierta', 'ana@x.com', $s$update public.gastos_cambios set observaciones = 'x' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '1', false),
  ('cambios: de una rendición ya mandada, no', 'ana@x.com', $s$update public.gastos_cambios set observaciones = 'x' where id = 'f0000000-0000-4000-8000-0000000000f2'$s$, '0', false),
  ('cambios: Diego no toca los de Ana', 'diego@x.com', $s$update public.gastos_cambios set observaciones = 'x' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cambios: un admin no los corrige (los corrige quien rinde)', 'otra@x.com', $s$update public.gastos_cambios set observaciones = 'x' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cambios: de quién es no se cambia', 'ana@x.com', $s$update public.gastos_cambios set autor = 'diego@x.com' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'error 42501', false),
  ('cambios: ni en qué rendición está', 'ana@x.com', $s$update public.gastos_cambios set rendicion_id = 'a0000000-0000-4000-8000-0000000000a4' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'error 42501', false),
  ('cambios: el comprobante va en la carpeta de su cambio', 'ana@x.com', $s$update public.gastos_cambios set archivo = 'gastos/cambio-f0000000-0000-4000-8000-0000000000f1/a.pdf' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '1', false),
  ('cambios: y no en otra', 'ana@x.com', $s$update public.gastos_cambios set archivo = 'gastos/cambio-otro/a.pdf' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'error 23514', false),
  ('cambios: Ana borra uno suyo de una rendición abierta', 'ana@x.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '1', false),
  ('cambios: de una ya mandada, no', 'ana@x.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f2'$s$, '0', false),
  ('cambios: Diego no borra los de Ana', 'diego@x.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cambios: una administradora por rol no los borra', 'otra@x.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cambios: el admin fijo borra uno de una rendición ya mandada', 'benny@team-latam.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f2'$s$, '1', false);

do $$
declare c record; consulta text;
begin
  for c in select * from casos order by n loop
    consulta := case when c.ve then format('select lab.ve(%L, %L)', c.quien, c.sentencia) else format('select lab.filas(%L, %L)', c.quien, c.sentencia) end;
    perform lab.comprobar(c.nombre, consulta, c.esperado);
  end loop;
end $$;

-- ---------- Los disparadores dicen por qué frenan (y no es la política la que frena) ----------
-- Política y disparador frenan con el mismo código; el mensaje dice cuál de los dos fue.
truncate casos;
insert into casos (nombre, quien, sentencia, esperado) values
  ('gastos: de quién es un gasto no se cambia', 'ana@x.com', $s$update public.gastos set autor = 'diego@x.com' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'De quién es un gasto no se cambia'),
  ('gastos: el estado lo cambia la rendición', 'ana@x.com', $s$update public.gastos set estado = 'aprobado' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'Ese cambio de estado lo hace la rendición'),
  ('gastos: uno nuevo es borrador o confirmado', 'ana@x.com', $s$insert into public.gastos (autor, estado, fecha, concepto, tipo) values ('ana@x.com', 'enviado', '2026-09-01', 'x', 'comida')$s$, 'Un gasto nuevo es un borrador o está confirmado'),
  ('gastos: el comprobante va en la carpeta de su gasto', 'ana@x.com', $s$update public.gastos set archivo = 'gastos/otro/a.pdf' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'El comprobante va en la carpeta de su gasto'),
  ('gastos: no en la rendición de otra persona', 'ana@x.com', $s$insert into public.gastos (rendicion_id, autor) values ('d0000000-0000-4000-8000-0000000000d1', 'ana@x.com')$s$, 'Esa rendición no es tuya'),
  ('gastos: no en una rendición ya mandada', 'ana@x.com', $s$insert into public.gastos (rendicion_id, autor) values ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com')$s$, 'Esa rendición ya se mandó'),
  ('gastos: pasarlo a una rendición de otra persona', 'ana@x.com', $s$update public.gastos set rendicion_id = 'd0000000-0000-4000-8000-0000000000d1' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'Esa rendición no es tuya'),
  ('gastos: pasarlo a una rendición ya mandada', 'ana@x.com', $s$update public.gastos set rendicion_id = 'a0000000-0000-4000-8000-0000000000a2' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, 'Esa rendición ya se mandó'),
  ('movimientos: solo los propios', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('diego@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, 'Solo podés anotar movimientos tuyos'),
  ('movimientos: un ajuste lo anota un admin (al crear)', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'ajuste', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, 'Un ajuste lo anota un admin'),
  ('movimientos: un ajuste lo anota un admin (al corregir)', 'ana@x.com', $s$update public.gastos_movimientos set tipo = 'ajuste' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'Un ajuste lo anota un admin'),
  ('movimientos: lo confirma un admin', 'ana@x.com', $s$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'Un movimiento lo confirma un admin'),
  ('movimientos: de quién es no se cambia (la persona)', 'ana@x.com', $s$update public.gastos_movimientos set persona = 'diego@x.com' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'De quién es un movimiento no se cambia'),
  ('movimientos: ni quién lo cargó', 'otra@x.com', $s$update public.gastos_movimientos set cargado_por = 'diego@x.com' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'De quién es un movimiento no se cambia'),
  ('movimientos: ni cuándo', 'otra@x.com', $s$update public.gastos_movimientos set creado_el = now() - interval '1 day' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'De quién es un movimiento no se cambia'),
  ('movimientos: el comprobante va en la carpeta de su movimiento', 'ana@x.com', $s$update public.gastos_movimientos set archivo = 'gastos/mov-otro/a.pdf' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'El comprobante va en la carpeta de su movimiento'),
  ('cambios: de quién es no se cambia', 'ana@x.com', $s$update public.gastos_cambios set autor = 'diego@x.com' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'De quién es un cambio, y en qué rendición, no se cambia'),
  ('cambios: ni cuándo', 'ana@x.com', $s$update public.gastos_cambios set creado_el = now() - interval '1 day' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'De quién es un cambio, y en qué rendición, no se cambia'),
  ('cambios: ni en qué rendición', 'ana@x.com', $s$update public.gastos_cambios set rendicion_id = 'a0000000-0000-4000-8000-0000000000a4' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'De quién es un cambio, y en qué rendición, no se cambia'),
  ('cambios: la rendición tiene que ser suya', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('d0000000-0000-4000-8000-0000000000d1', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'Esa rendición no es tuya'),
  ('cambios: y no estar mandada', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'Esa rendición ya se mandó'),
  ('cambios: el comprobante va en la carpeta de su cambio', 'ana@x.com', $s$update public.gastos_cambios set archivo = 'gastos/cambio-otro/a.pdf' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, 'El comprobante va en la carpeta de su cambio');
do $$
declare c record;
begin
  for c in select * from casos order by n loop
    perform lab.comprobar(c.nombre || ' (lo frena el disparador)', format('select lab.mensaje(%L, %L)', c.quien, c.sentencia), c.esperado);
  end loop;
end $$;

-- ---------- Con Gastos cerrado al equipo: solo quien administra ----------
insert into public.app_config(key, value) values ('preferences', '{"gastos": {"abierto": false}}');
truncate casos;
insert into casos (nombre, quien, sentencia, esperado, ve) values
  ('cerrado: Ana no ve sus rendiciones', 'ana@x.com', 'select 1 from public.gastos_rendiciones', '0', true),
  ('cerrado: Ana no ve sus gastos', 'ana@x.com', 'select 1 from public.gastos', '0', true),
  ('cerrado: Ana no ve sus movimientos', 'ana@x.com', 'select 1 from public.gastos_movimientos', '0', true),
  ('cerrado: Ana no ve sus cambios', 'ana@x.com', 'select 1 from public.gastos_cambios', '0', true),
  ('cerrado: una administradora por rol ve todas las rendiciones', 'otra@x.com', 'select 1 from public.gastos_rendiciones', '6', true),
  ('cerrado: Finanzas ve todos los gastos', 'fin@x.com', 'select 1 from public.gastos', '9', true),
  ('cerrado: Ana no anota el total rápido', 'ana@x.com', $s$update public.gastos_rendiciones set total_manual = '{"USD": 10}' where id = 'a0000000-0000-4000-8000-0000000000a1'$s$, '0', false),
  ('cerrado: Ana no borra una rendición suya vacía', 'ana@x.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '0', false),
  ('cerrado: el admin fijo sí', 'benny@team-latam.com', $s$delete from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a5'$s$, '1', false),
  ('cerrado: Ana no carga un gasto', 'ana@x.com', $s$insert into public.gastos (autor) values ('ana@x.com')$s$, 'error 42501', false),
  ('cerrado: Ana no corrige un gasto', 'ana@x.com', $s$update public.gastos set concepto = 'x' where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('cerrado: Ana no borra un gasto', 'ana@x.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '0', false),
  ('cerrado: el admin fijo borra un gasto', 'benny@team-latam.com', $s$delete from public.gastos where id = 'b0000000-0000-4000-8000-0000000000b1'$s$, '1', false),
  ('cerrado: Ana no anota un movimiento', 'ana@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'ana@x.com')$s$, 'error 42501', false),
  ('cerrado: un admin sí anota uno de Ana', 'otra@x.com', $s$insert into public.gastos_movimientos (persona, tipo, fecha, moneda, monto, cargado_por) values ('ana@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'otra@x.com')$s$, '1', false),
  ('cerrado: Ana no corrige un movimiento', 'ana@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '0', false),
  ('cerrado: un admin sí', 'otra@x.com', $s$update public.gastos_movimientos set descripcion = 'x' where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('cerrado: Ana no borra un movimiento', 'ana@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '0', false),
  ('cerrado: un admin sí', 'otra@x.com', $s$delete from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, '1', false),
  ('cerrado: Ana no anota un cambio de moneda', 'ana@x.com', $s$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto) values ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', '2026-09-03', 'USD', 10, 'ANG', 18)$s$, 'error 42501', false),
  ('cerrado: Ana no corrige un cambio', 'ana@x.com', $s$update public.gastos_cambios set observaciones = 'x' where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cerrado: Ana no borra un cambio', 'ana@x.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '0', false),
  ('cerrado: el admin fijo borra un cambio', 'benny@team-latam.com', $s$delete from public.gastos_cambios where id = 'f0000000-0000-4000-8000-0000000000f1'$s$, '1', false);
do $$
declare c record; consulta text;
begin
  for c in select * from casos order by n loop
    consulta := case when c.ve then format('select lab.ve(%L, %L)', c.quien, c.sentencia) else format('select lab.filas(%L, %L)', c.quien, c.sentencia) end;
    perform lab.comprobar(c.nombre, consulta, c.esperado);
  end loop;
end $$;
delete from public.app_config where key = 'preferences';

-- ---------- Lo que la base escribe sola (no se hace a mano) ----------
-- Se hacen como esa persona y DEJAN el cambio (lab.hacer), para mirar qué quedó.
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
select lab.comprobar('un movimiento nuevo de Ana queda a su nombre y pendiente, con ella como quien lo cargó',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos (id, persona, tipo, fecha, moneda, monto, cargado_por, estado) values ('e0000000-0000-4000-8000-0000000000e9', 'ana@x.com', 'devuelto', '2026-09-05', 'USD', 5, 'diego@x.com', 'confirmado') returning estado || '/' || cargado_por$x$)$q$, 'pendiente/ana@x.com');
select lab.comprobar('…sin confirmado_por ni confirmado_el', $q$select (confirmado_por is null and confirmado_el is null)::text from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e9'$q$, 'true');
select lab.comprobar('cuando un admin lo confirma, queda quién y cuándo',
  $q$select lab.hacer(lab.como('otra@x.com'), $x$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e9' returning confirmado_por$x$)$q$, 'otra@x.com');
select lab.comprobar('…con la hora', $q$select (confirmado_el is not null)::text from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e9'$q$, 'true');
select lab.comprobar('si un admin lo vuelve a pendiente, se borra quién lo confirmó',
  $q$select lab.hacer(lab.como('otra@x.com'), $x$update public.gastos_movimientos set estado = 'pendiente' where id = 'e0000000-0000-4000-8000-0000000000e9' returning coalesce(confirmado_por, 'nadie')$x$)$q$, 'nadie');
select lab.comprobar('…y la hora', $q$select (confirmado_el is null)::text from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e9'$q$, 'true');
select lab.comprobar('si un admin lo deja confirmado y lo corrige, no cambia quién lo confirmó la primera vez',
  $q$select lab.hacer(lab.como('otra@x.com'), $x$update public.gastos_movimientos set estado = 'confirmado' where id = 'e0000000-0000-4000-8000-0000000000e9' returning confirmado_por$x$)$q$, 'otra@x.com');
select lab.comprobar('…ni siquiera si lo corrige otro admin',
  $q$select lab.hacer(lab.como('fin@x.com'), $x$update public.gastos_movimientos set descripcion = 'corregido' where id = 'e0000000-0000-4000-8000-0000000000e9' returning confirmado_por$x$)$q$, 'otra@x.com');
select lab.comprobar('un gasto nuevo de Ana queda a su nombre aunque diga otro autor',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos (id, autor, rendicion_id) values ('b0000000-0000-4000-8000-0000000000e9', 'diego@x.com', null) returning autor$x$)$q$, 'ana@x.com');
select lab.comprobar('un gasto nuevo: «cuándo se aprobó» arranca vacío aunque se escriba',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos (id, autor, aprobado_el) values ('b0000000-0000-4000-8000-0000000000e8', 'ana@x.com', now()) returning coalesce(aprobado_el::text, 'vacío')$x$)$q$, 'vacío');
select lab.comprobar('el concepto se guarda sin espacios de más', $q$select lab.hacer(lab.como('ana@x.com'), $x$update public.gastos set concepto = '  Taxi  ' where id = 'b0000000-0000-4000-8000-0000000000e8' returning concepto$x$)$q$, 'Taxi');
select lab.comprobar('las observaciones, también', $q$select lab.hacer(lab.como('ana@x.com'), $x$update public.gastos set observaciones = '  ok  ' where id = 'b0000000-0000-4000-8000-0000000000e8' returning observaciones$x$)$q$, 'ok');
select lab.comprobar('el total rápido de una rendición deja quién lo anotó',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$update public.gastos_rendiciones set total_manual = '{"USD": 12}' where id = 'a0000000-0000-4000-8000-0000000000a1' returning total_manual_por$x$)$q$, 'ana@x.com');
select lab.comprobar('…y cuándo', $q$select (total_manual_el is not null)::text from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a1'$q$, 'true');
select lab.comprobar('un cambio de moneda nuevo queda a nombre de Ana aunque diga otro autor',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos_cambios (rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto, observaciones) values ('a0000000-0000-4000-8000-0000000000a1', 'diego@x.com', '2026-09-03', 'USD', 10, 'ANG', 18, '  nota  ') returning autor || '/' || observaciones$x$)$q$, 'ana@x.com/nota');

-- Limpieza, para las pruebas que vienen después.
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
