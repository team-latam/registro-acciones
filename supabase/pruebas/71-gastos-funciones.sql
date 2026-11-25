\set QUIET on
-- ============================================================
-- Gastos y rendiciones: las funciones, cada razón por la que dicen que no (25/11/2026)
-- ============================================================
-- El rompe-código sobre 27-gastos.sql (herramientas/auditoria/herramientas/mutaciones_sql.mjs) mostró que las funciones que
-- abren, mandan, observan, devuelven, aprueban y reabren una rendición, y las que importan y deshacen una tanda, tenían
-- probado el camino feliz pero no cada «no»: se podía sacar un «raise exception» o cambiar un «or» por un «and» y ninguna
-- prueba se enteraba. Acá cada función se llama como cada persona (administradora por rol, Finanzas, integrante, otra
-- integrante, observadora) y se comprueba el MENSAJE que da la base: así se sabe cuál de los controles fue el que frenó.
-- Cada llamada se deshace sola (lab.llama): la prueba siguiente parte del mismo punto. Personas y montos inventados.
truncate lab.resultados;
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('otra@x.com', 'Otra', 'otra', 'admin'), ('fin@x.com', 'Fina', 'fina', 'finance'),
  ('ana@x.com', 'Ana', 'ana', 'member'), ('diego@x.com', 'Diego', 'diego', 'member'), ('olga@x.com', 'Olga', 'olga', 'observer');
insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Visita a Lima', 'C', '2026-09-10', '2026-09-10', '2026-09-12', 'visita', 'Benny', 'benny@team-latam.com', '[{"name":"Ana","email":"ana@x.com"}]'),
  ('p2', 'Curso en Quito', 'C', '2026-09-20', '2026-09-20', '2026-09-21', 'curso', 'Diego', 'diego@x.com', '[]'),
  ('p3', 'Rutina del lunes', 'C', '2026-09-07', '2026-09-07', '2026-09-07', 'rutina', 'Ana', 'ana@x.com', '[]');
insert into public.gastos_rendiciones (id, autor, rutina_mes, titulo, estado, enviada_el, aprobada_el, aprobada_por) values
  ('a0000000-0000-4000-8000-0000000000a1', 'ana@x.com', '2026-09-01', 'Abierta', 'abierta', null, null, null),
  ('a0000000-0000-4000-8000-0000000000a2', 'ana@x.com', '2026-08-01', 'Enviada con observado', 'enviada', now(), null, null),
  ('a0000000-0000-4000-8000-0000000000a3', 'ana@x.com', '2026-07-01', 'Aprobada', 'aprobada', now(), now(), 'benny@team-latam.com'),
  ('a0000000-0000-4000-8000-0000000000a4', 'ana@x.com', '2026-06-01', 'Enviada limpia', 'enviada', now(), null, null),
  ('a0000000-0000-4000-8000-0000000000a5', 'ana@x.com', '2026-05-01', 'Vacía', 'abierta', null, null, null),
  ('a0000000-0000-4000-8000-0000000000a6', 'ana@x.com', '2026-04-01', 'Reabierta', 'abierta', null, null, null),
  ('a0000000-0000-4000-8000-0000000000a7', 'ana@x.com', '2026-03-01', 'Solo total', 'abierta', null, null, null),
  ('b0000000-0000-4000-8000-0000000000b1', 'benny@team-latam.com', '2026-09-01', 'De Benny', 'enviada', now(), null, null);
insert into public.gastos_rendiciones (id, autor, post_id, titulo, estado) values ('d0000000-0000-4000-8000-0000000000d1', 'diego@x.com', 'p1', 'De Diego en Lima', 'abierta');
update public.gastos_rendiciones set total_manual = '{"USD": 50}' where id = 'a0000000-0000-4000-8000-0000000000a7';
insert into public.gastos (id, autor, rendicion_id, estado, fecha, concepto, tipo) values
  ('c0000000-0000-4000-8000-0000000000c1', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'borrador', null, '', null),
  ('c0000000-0000-4000-8000-0000000000c2', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a1', 'confirmado', '2026-09-02', 'Taxi', 'transporte'),
  ('c0000000-0000-4000-8000-0000000000c3', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'observado', '2026-08-02', 'Hotel', 'alojamiento'),
  ('c0000000-0000-4000-8000-0000000000c4', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a2', 'enviado', '2026-08-03', 'Cena', 'comida'),
  ('c0000000-0000-4000-8000-0000000000c5', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a3', 'aprobado', '2026-07-02', 'Pasaje', 'pasaje'),
  ('c0000000-0000-4000-8000-0000000000c6', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a4', 'enviado', '2026-06-02', 'Taxi', 'transporte'),
  ('c0000000-0000-4000-8000-0000000000c7', 'ana@x.com', null, 'borrador', null, '', null),
  ('c0000000-0000-4000-8000-0000000000c8', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a6', 'aprobado', '2026-04-02', 'Taxi', 'transporte'),
  ('c0000000-0000-4000-8000-0000000000c9', 'benny@team-latam.com', 'b0000000-0000-4000-8000-0000000000b1', 'enviado', '2026-09-02', 'Taxi', 'transporte'),
  ('c0000000-0000-4000-8000-0000000000ca', 'ana@x.com', 'a0000000-0000-4000-8000-0000000000a4', 'confirmado', '2026-06-03', 'Taxi', 'transporte');
insert into public.gastos_movimientos (id, persona, tipo, fecha, moneda, monto, estado, cargado_por, confirmado_por, confirmado_el) values
  ('e0000000-0000-4000-8000-0000000000e1', 'ana@x.com', 'recibido', '2026-09-01', 'USD', 100, 'pendiente', 'ana@x.com', null, null),
  ('e0000000-0000-4000-8000-0000000000e2', 'ana@x.com', 'recibido', '2026-09-02', 'USD', 50, 'confirmado', 'benny@team-latam.com', 'benny@team-latam.com', now());

-- Llama algo como esa persona y dice qué contestó (o «ERR» y el mensaje); siempre lo deshace. Varias sentencias se separan
-- con « ;; »: las que empiezan con «select» suman su resultado (separados por «/»), las que empiezan con «!» se hacen y no
-- suman, el resto (update…) se hace. Así se puede llamar a una función y MIRAR después lo que dejó.
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
      elsif left(p, 1) = '!' then execute substr(p, 2);
      else execute p; end if;
    end loop;
    raise exception '#%', array_to_string(salida, '/') using errcode = 'P0001';
  exception when others then
    if sqlerrm like '#%' then r := substr(sqlerrm, 2); else r := 'ERR ' || sqlerrm; end if;
  end;
  execute 'reset role';
  return r;
end $$;
-- Lo mismo pero DEJANDO lo hecho (para los pasos que se miran después).
create or replace function lab.hacer(quien text, sentencia text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', lab.como(quien)::text, true);
  begin execute sentencia into r;
  exception when others then r := 'ERR ' || sqlerrm; end;
  execute 'reset role';
  return r;
end $$;

create temp table casos (n serial, nombre text, quien text, sentencia text, esperado text);
insert into casos (nombre, quien, sentencia, esperado) values
  -- ----- abrir la rendición de una actividad o de un mes -----
  ('abrir: una observadora, no', 'olga@x.com', $s$select public.gastos_rendicion_abrir('p1', null)::text$s$, 'ERR Los gastos no están abiertos para tu cuenta'),
  ('abrir: ni una actividad ni un mes', 'ana@x.com', $s$select public.gastos_rendicion_abrir(null, null)::text$s$, 'ERR Una actividad o un mes, uno de los dos'),
  ('abrir: las dos a la vez, tampoco', 'ana@x.com', $s$select public.gastos_rendicion_abrir('p1', '2026-09-01')::text$s$, 'ERR Una actividad o un mes, uno de los dos'),
  ('abrir: una actividad que no existe', 'ana@x.com', $s$select public.gastos_rendicion_abrir('nada', null)::text$s$, 'ERR Esa actividad no existe'),
  ('abrir: una rutina va a la rutina del mes', 'ana@x.com', $s$select public.gastos_rendicion_abrir('p3', null)::text$s$, 'ERR Los gastos de rutina van a la rutina del mes'),
  ('abrir: Diego no participó en la visita a Lima', 'diego@x.com', $s$select public.gastos_rendicion_abrir('p1', null)::text$s$, 'ERR Solo podés cargar gastos en actividades en las que participaste'),
  ('abrir: Ana, que participó, sí', 'ana@x.com', $s$select (public.gastos_rendicion_abrir('p1', null) is not null)::text$s$, 'true'),
  ('abrir: Diego, que es quien cargó el curso, sí', 'diego@x.com', $s$select (public.gastos_rendicion_abrir('p2', null) is not null)::text$s$, 'true'),
  ('abrir: una administradora por rol, en cualquiera', 'otra@x.com', $s$select (public.gastos_rendicion_abrir('p2', null) is not null)::text$s$, 'true'),
  ('abrir: el admin fijo, en cualquiera', 'benny@team-latam.com', $s$select (public.gastos_rendicion_abrir('p2', null) is not null)::text$s$, 'true'),
  ('abrir: Finanzas no, en una actividad en la que no participó', 'fin@x.com', $s$select public.gastos_rendicion_abrir('p2', null)::text$s$, 'ERR Solo podés cargar gastos en actividades en las que participaste'),
  ('abrir: Ana recibe SU rendición de la actividad, no la de otra persona', 'ana@x.com', $s$!select set_config('lab.ult', public.gastos_rendicion_abrir('p1', null)::text, true) ;; select autor from public.gastos_rendiciones where id = current_setting('lab.ult')::uuid$s$, 'ana@x.com'),
  ('abrir: dos veces la misma devuelve la misma', 'ana@x.com', $s$select (public.gastos_rendicion_abrir('p1', null) = public.gastos_rendicion_abrir('p1', null))::text$s$, 'true'),
  ('abrir: la rutina de un mes: dos veces la misma', 'ana@x.com', $s$select (public.gastos_rendicion_abrir(null, '2026-10-15') = public.gastos_rendicion_abrir(null, '2026-10-01'))::text$s$, 'true'),
  ('abrir: la rutina de un mes queda en el día 1', 'ana@x.com', $s$!select public.gastos_rendicion_abrir(null, '2026-10-15') ;; select rutina_mes::text from public.gastos_rendiciones where autor = 'ana@x.com' and rutina_mes = '2026-10-01'$s$, '2026-10-01'),
  ('abrir: un mes de enero de 2000, sí', 'ana@x.com', $s$select (public.gastos_rendicion_abrir(null, '2000-01-31') is not null)::text$s$, 'true'),
  ('abrir: un mes anterior a enero de 2000, no', 'ana@x.com', $s$select public.gastos_rendicion_abrir(null, '1999-12-31')::text$s$, 'ERR Ese mes no'),
  ('abrir: diciembre de 2100, sí', 'ana@x.com', $s$select (public.gastos_rendicion_abrir(null, '2100-12-31') is not null)::text$s$, 'true'),
  ('abrir: enero de 2101, no', 'ana@x.com', $s$select public.gastos_rendicion_abrir(null, '2101-01-01')::text$s$, 'ERR Ese mes no'),
  -- ----- mandar -----
  ('mandar: no es de Diego', 'diego@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a1')::text$s$, 'ERR Esa rendición no es tuya'),
  ('mandar: una que no existe', 'ana@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000ff')::text$s$, 'ERR Esa rendición no es tuya'),
  ('mandar: ya mandada', 'ana@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'ERR Esa rendición ya se mandó'),
  ('mandar: sin nada para mandar', 'ana@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a5')::text$s$, 'ERR No hay nada para mandar'),
  ('mandar: con gastos sin confirmar', 'ana@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a1')::text$s$, 'ERR Faltan confirmar 1 gasto(s)'),
  ('mandar: con solo un total rápido, sí', 'ana@x.com', $s$select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a7')::text$s$, 'true'),
  ('mandar: con el borrador confirmado, sí, y los gastos pasan a enviados', 'ana@x.com', $s$update public.gastos set estado = 'confirmado', fecha = '2026-09-03', concepto = 'x', tipo = 'comida' where id = 'c0000000-0000-4000-8000-0000000000c1' ;; select public.gastos_rendicion_enviar('a0000000-0000-4000-8000-0000000000a1')::text ;; select string_agg(estado, ',' order by id) from public.gastos where rendicion_id = 'a0000000-0000-4000-8000-0000000000a1'$s$, 'true/enviado,enviado'),
  -- ----- borrar una rendición entera -----
  ('borrar rendición: no es de Diego', 'diego@x.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a1')::text$s$, 'ERR Esa rendición no es tuya'),
  ('borrar rendición: una mandada la borra solo el admin', 'ana@x.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'ERR Una rendición mandada o aprobada la borra solo el admin'),
  ('borrar rendición: con aprobados (reabierta), solo el admin', 'ana@x.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a6')::text$s$, 'ERR Tiene gastos aprobados (se reabrió): la borra solo el admin'),
  ('borrar rendición: una administradora por rol no la borra', 'otra@x.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a1')::text$s$, 'ERR Esa rendición no es tuya'),
  ('borrar rendición: Ana la suya abierta, con 2 gastos', 'ana@x.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a1')::text$s$, '2'),
  ('borrar rendición: el admin fijo borra una aprobada, con su gasto', 'benny@team-latam.com', $s$select public.gastos_rendicion_borrar('a0000000-0000-4000-8000-0000000000a3')::text$s$, '1'),
  -- ----- observar -----
  ('observar: una integrante no', 'ana@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', 'Falta la factura')::text$s$, 'ERR Observa un admin'),
  ('observar: sin comentario', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', '   ')::text$s$, 'ERR Hace falta un comentario (hasta 1000 letras)'),
  ('observar: con un comentario de más de 1000 letras', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', repeat('x', 1001))::text$s$, 'ERR Hace falta un comentario (hasta 1000 letras)'),
  ('observar: con uno de justo 1000 letras, sí', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', repeat('x', 1000))::text$s$, 'true'),
  ('observar: uno confirmado dentro de una rendición mandada, no (solo lo mandado)', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000ca', 'x')::text$s$, 'ERR Se observa un gasto de una rendición mandada (o uno aprobado de una reabierta)'),
  ('observar: un gasto que no existe', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000ff', 'x')::text$s$, 'ERR Ese gasto no está en una rendición'),
  ('observar: un gasto sin rendición', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c7', 'x')::text$s$, 'ERR Ese gasto no está en una rendición'),
  ('observar: uno confirmado de una rendición abierta, no', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c2', 'x')::text$s$, 'ERR Se observa un gasto de una rendición mandada (o uno aprobado de una reabierta)'),
  ('observar: uno aprobado de una rendición aprobada, no', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c5', 'x')::text$s$, 'ERR Se observa un gasto de una rendición mandada (o uno aprobado de una reabierta)'),
  ('observar: uno aprobado de una reabierta, sí; la rendición pasa a observada', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c8', 'x')::text ;; select estado from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a6'$s$, 'true/observada'),
  ('observar: uno enviado de una rendición mandada, sí; la rendición sigue mandada', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', 'x')::text ;; select estado from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a2' ;; select estado from public.gastos where id = 'c0000000-0000-4000-8000-0000000000c4'$s$, 'true/enviada/observado'),
  ('observar: deja el comentario con quién lo escribió', 'otra@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', '  Falta la factura  ')::text ;; select autor || ':' || texto from public.gastos_comentarios where gasto_id = 'c0000000-0000-4000-8000-0000000000c4'$s$, 'true/otra@x.com:Falta la factura'),
  ('observar: Finanzas también observa', 'fin@x.com', $s$select public.gastos_observar('c0000000-0000-4000-8000-0000000000c4', 'x')::text$s$, 'true'),
  -- ----- devolver -----
  ('devolver: una integrante no', 'ana@x.com', $s$select public.gastos_rendicion_devolver('a0000000-0000-4000-8000-0000000000a2')::text$s$, 'ERR Devuelve un admin'),
  ('devolver: una que no existe', 'otra@x.com', $s$select public.gastos_rendicion_devolver('a0000000-0000-4000-8000-0000000000ff')::text$s$, 'ERR Esa rendición no existe'),
  ('devolver: una abierta, no', 'otra@x.com', $s$select public.gastos_rendicion_devolver('a0000000-0000-4000-8000-0000000000a5')::text$s$, 'ERR Se devuelve una rendición que está en revisión'),
  ('devolver: sin ningún gasto observado', 'otra@x.com', $s$select public.gastos_rendicion_devolver('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'ERR Para devolverla, observá al menos un gasto'),
  ('devolver: con uno observado, devuelve cuántos y la rendición pasa a observada', 'otra@x.com', $s$select public.gastos_rendicion_devolver('a0000000-0000-4000-8000-0000000000a2')::text ;; select estado from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a2'$s$, '1/observada'),
  -- ----- comentar -----
  ('comentar: Diego no en un gasto de Ana', 'diego@x.com', $s$select public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', 'hola')::text$s$, 'ERR Ese gasto no es tuyo'),
  ('comentar: en uno que no existe', 'ana@x.com', $s$select public.gastos_comentar('c0000000-0000-4000-8000-0000000000ff', 'hola')::text$s$, 'ERR Ese gasto no es tuyo'),
  ('comentar: sin texto', 'ana@x.com', $s$select public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', '  ')::text$s$, 'ERR Un comentario de 1 a 1000 letras'),
  ('comentar: de más de 1000 letras', 'ana@x.com', $s$select public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', repeat('x', 1001))::text$s$, 'ERR Un comentario de 1 a 1000 letras'),
  ('comentar: de justo 1000 letras, sí', 'ana@x.com', $s$select (public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', repeat('x', 1000)) is not null)::text$s$, 'true'),
  ('comentar: de 1 letra, sí', 'ana@x.com', $s$select (public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', 'x') is not null)::text$s$, 'true'),
  ('comentar: una administradora por rol, en el de Ana, sí', 'otra@x.com', $s$select (public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', 'hola') is not null)::text$s$, 'true'),
  ('comentar: Finanzas también', 'fin@x.com', $s$select (public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', 'hola') is not null)::text$s$, 'true'),
  ('comentar: una observadora no', 'olga@x.com', $s$select public.gastos_comentar('c0000000-0000-4000-8000-0000000000c1', 'hola')::text$s$, 'ERR Ese gasto no es tuyo'),
  -- ----- aprobar -----
  ('aprobar: una integrante no', 'ana@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'ERR Aprueba un admin'),
  ('aprobar: una que no existe', 'otra@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000ff')::text$s$, 'ERR Esa rendición no existe'),
  ('aprobar: una abierta, no', 'otra@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000a5')::text$s$, 'ERR Se aprueba una rendición mandada y sin observaciones pendientes'),
  ('aprobar: una con un gasto observado, no', 'otra@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000a2')::text$s$, 'ERR Se aprueba una rendición mandada y sin observaciones pendientes'),
  ('aprobar: una mandada y limpia, sí; sus gastos quedan aprobados con la hora', 'otra@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000a4')::text ;; select estado || ':' || (aprobado_el is not null)::text from public.gastos where id = 'c0000000-0000-4000-8000-0000000000c6' ;; select aprobada_por from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a4'$s$, 'true/aprobado:true/otra@x.com'),
  ('aprobar: Finanzas también', 'fin@x.com', $s$select public.gastos_rendicion_aprobar('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'true'),
  ('aprobar: la propia de Benny no la aprueba Benny si hay otros admin', 'benny@team-latam.com', $s$select public.gastos_rendicion_aprobar('b0000000-0000-4000-8000-0000000000b1')::text$s$, 'ERR La tuya la aprueba otro admin o Finanzas'),
  ('aprobar: la de Benny la aprueba otra administradora', 'otra@x.com', $s$select public.gastos_rendicion_aprobar('b0000000-0000-4000-8000-0000000000b1')::text$s$, 'true'),
  ('aprobar: sin otro admin ni Finanzas, el admin fijo aprueba la suya', 'benny@team-latam.com', $s$update public.members set role = 'member' where email in ('otra@x.com', 'fin@x.com') ;; select public.gastos_rendicion_aprobar('b0000000-0000-4000-8000-0000000000b1')::text$s$, 'true'),
  ('aprobar: con Finanzas sola, el admin fijo no aprueba la suya', 'benny@team-latam.com', $s$update public.members set role = 'member' where email = 'otra@x.com' ;; select public.gastos_rendicion_aprobar('b0000000-0000-4000-8000-0000000000b1')::text$s$, 'ERR La tuya la aprueba otro admin o Finanzas'),
  -- ----- reabrir -----
  ('reabrir: una integrante no', 'ana@x.com', $s$select public.gastos_rendicion_reabrir('a0000000-0000-4000-8000-0000000000a3')::text$s$, 'ERR Reabre un admin'),
  ('reabrir: una que no existe', 'otra@x.com', $s$select public.gastos_rendicion_reabrir('a0000000-0000-4000-8000-0000000000ff')::text$s$, 'ERR Esa rendición no existe'),
  ('reabrir: una que no está aprobada', 'otra@x.com', $s$select public.gastos_rendicion_reabrir('a0000000-0000-4000-8000-0000000000a4')::text$s$, 'ERR Se reabre una rendición aprobada'),
  ('reabrir: una aprobada vuelve a abierta, sin quién aprobó', 'otra@x.com', $s$select public.gastos_rendicion_reabrir('a0000000-0000-4000-8000-0000000000a3')::text ;; select estado || ':' || coalesce(aprobada_por, 'nadie') || ':' || (aprobada_el is null)::text from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000a3'$s$, 'true/abierta:nadie:true'),
  ('reabrir: lo aprobado sigue aprobado', 'otra@x.com', $s$select public.gastos_rendicion_reabrir('a0000000-0000-4000-8000-0000000000a3')::text ;; select estado from public.gastos where id = 'c0000000-0000-4000-8000-0000000000c5'$s$, 'true/aprobado'),
  -- ----- confirmar un movimiento -----
  ('confirmar movimiento: una integrante no', 'ana@x.com', $s$select public.gastos_movimiento_confirmar('e0000000-0000-4000-8000-0000000000e1')::text$s$, 'ERR Confirma un admin'),
  ('confirmar movimiento: un admin confirma uno pendiente y queda quién', 'otra@x.com', $s$select public.gastos_movimiento_confirmar('e0000000-0000-4000-8000-0000000000e1')::text ;; select estado || ':' || confirmado_por from public.gastos_movimientos where id = 'e0000000-0000-4000-8000-0000000000e1'$s$, 'true/confirmado:otra@x.com'),
  ('confirmar movimiento: uno ya confirmado, no cambia', 'otra@x.com', $s$select public.gastos_movimiento_confirmar('e0000000-0000-4000-8000-0000000000e2')::text$s$, 'false'),
  ('confirmar movimiento: Finanzas también', 'fin@x.com', $s$select public.gastos_movimiento_confirmar('e0000000-0000-4000-8000-0000000000e1')::text$s$, 'true');
do $$
declare c record;
begin
  for c in select * from casos order by n loop
    perform lab.comprobar(c.nombre, format('select lab.llama(%L, %L)', c.quien, c.sentencia), c.esperado);
  end loop;
end $$;

-- ---------- Lo que valen por defecto, y la configuración del módulo ----------
select lab.comprobar('un gasto nuevo, sin decir nada, lleva factura', $q$select lab.llama('otra@x.com', $x$#insert into public.gastos (id, autor) values ('c0000000-0000-4000-8000-0000000000d0', 'ana@x.com') ;; #select factura::text from public.gastos where id = 'c0000000-0000-4000-8000-0000000000d0'$x$)$q$, 'true');
select lab.comprobar('una rendición nueva no tiene el total rápido confirmado', $q$select lab.llama('otra@x.com', $x$#insert into public.gastos_rendiciones (id, autor, rutina_mes) values ('a0000000-0000-4000-8000-0000000000d0', 'diego@x.com', '2026-01-01') ;; #select total_manual_confirmado::text from public.gastos_rendiciones where id = 'a0000000-0000-4000-8000-0000000000d0'$x$)$q$, 'false');
select lab.comprobar('configuración: hasta 40 tipos', $q$select public.gastos_config_ok(jsonb_build_object('tipos', (select jsonb_agg(jsonb_build_object('key', 't' || i)) from generate_series(1, 40) i)))::text$q$, 'true');
select lab.comprobar('configuración: 41 no', $q$select public.gastos_config_ok(jsonb_build_object('tipos', (select jsonb_agg(jsonb_build_object('key', 't' || i)) from generate_series(1, 41) i)))::text$q$, 'false');
select lab.comprobar('configuración: el nombre de un tipo, hasta 60 letras', $q$select public.gastos_config_ok(jsonb_build_object('tipos', jsonb_build_array(jsonb_build_object('key', 'a', 'label', repeat('x', 60)))))::text$q$, 'true');
select lab.comprobar('configuración: 61 no', $q$select public.gastos_config_ok(jsonb_build_object('tipos', jsonb_build_array(jsonb_build_object('key', 'a', 'label', repeat('x', 61)))))::text$q$, 'false');
select lab.comprobar('configuración: un tipo con una clave de más no', $q$select public.gastos_config_ok('{"tipos": [{"key": "a", "color": "rojo"}]}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: un tipo con clave, nombre y «oculto» sí', $q$select public.gastos_config_ok('{"tipos": [{"key": "a", "label": "A", "oculto": true}], "prendido": true, "abierto": false}'::jsonb)::text$q$, 'true');
select lab.comprobar('configuración: dos tipos con la misma clave no', $q$select public.gastos_config_ok('{"tipos": [{"key": "a"}, {"key": "a"}]}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: una clave en mayúscula no', $q$select public.gastos_config_ok('{"tipos": [{"key": "A"}]}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: una clave de más arriba no', $q$select public.gastos_config_ok('{"color": "rojo"}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: «prendido» tiene que ser verdadero o falso', $q$select public.gastos_config_ok('{"prendido": "si"}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: los tipos tienen que ser una lista', $q$select public.gastos_config_ok('{"tipos": {}}'::jsonb)::text$q$, 'false');
select lab.comprobar('configuración: lo que guarda un admin con la forma mala se rechaza, con el aviso', $q$select lab.llama('benny@team-latam.com', $x$select public.guardar_config('preferences', '{"gastos": {"color": "rojo"}}')::text$x$)$q$, 'ERR La configuración de los gastos no tiene la forma esperada (prendido, abierto y hasta 40 tipos con clave y nombre)');
select lab.comprobar('…y con la forma buena se guarda', $q$select lab.llama('benny@team-latam.com', $x$select public.guardar_config('preferences', '{"gastos": {"prendido": true}}')::text$x$)$q$, '');

-- ---------- Importar una tanda, y deshacerla ----------
create or replace function lab.tanda(n_r integer, n_m integer default 0) returns text language sql as $$
  select format('select public.gastos_importar(%L, %L::jsonb, %L::jsonb)::text', 'a1000000-0000-4000-8000-000000000001',
    (select coalesce(jsonb_agg(jsonb_build_object('titulo', 'T' || i, 'gastos', '[]'::jsonb)), '[]'::jsonb)::text from generate_series(1, n_r) i),
    (select coalesce(jsonb_agg(jsonb_build_object('tipo', 'recibido', 'fecha', '2026-10-01', 'moneda', 'usd', 'monto', 1)), '[]'::jsonb)::text from generate_series(1, n_m) i))
$$;
select lab.comprobar('importar: una integrante no', $q$select lab.llama('ana@x.com', lab.tanda(1))$q$, 'ERR Importa un admin');
select lab.comprobar('importar: Finanzas tampoco', $q$select lab.llama('fin@x.com', lab.tanda(1))$q$, 'ERR Importa un admin');
select lab.comprobar('importar: una administradora por rol sí', $q$select lab.llama('otra@x.com', lab.tanda(1))$q$, '{"gastos": 0, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('importar: el admin fijo sí', $q$select lab.llama('benny@team-latam.com', lab.tanda(1))$q$, '{"gastos": 0, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('importar: sin tanda (lote vacío)', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar(null, '[]'::jsonb, '[]'::jsonb)::text$x$)$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: las rendiciones tienen que ser una lista', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar('a1000000-0000-4000-8000-000000000001', '{}'::jsonb, '[]'::jsonb)::text$x$)$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: los movimientos también', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar('a1000000-0000-4000-8000-000000000001', '[]'::jsonb, '{}'::jsonb)::text$x$)$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: una tanda vacía no', $q$select lab.llama('otra@x.com', lab.tanda(0, 0))$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: 300 rendiciones sí', $q$select lab.llama('otra@x.com', lab.tanda(300, 0))$q$, '{"gastos": 0, "movimientos": 0, "rendiciones": 300}');
select lab.comprobar('importar: 301 no', $q$select lab.llama('otra@x.com', lab.tanda(301, 0))$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: 500 movimientos sí', $q$select lab.llama('otra@x.com', lab.tanda(0, 500))$q$, '{"gastos": 0, "movimientos": 500, "rendiciones": 0}');
select lab.comprobar('importar: 501 no', $q$select lab.llama('otra@x.com', lab.tanda(0, 501))$q$, 'ERR Una tanda tiene hasta 300 rendiciones y 500 movimientos, y algo adentro');
select lab.comprobar('importar: solo movimientos, sí', $q$select lab.llama('otra@x.com', lab.tanda(0, 1))$q$, '{"gastos": 0, "movimientos": 1, "rendiciones": 0}');
select lab.comprobar('importar: una rendición con 2000 gastos sí', $q$select lab.llama('otra@x.com', format($x$select public.gastos_importar('a1000000-0000-4000-8000-000000000001', %L::jsonb)::text$x$, (select jsonb_build_array(jsonb_build_object('titulo', 'Grande', 'gastos', (select jsonb_agg(jsonb_build_object('fecha', '2026-01-01', 'concepto', 'x', 'tipo', 'comida', 'monto', 1)) from generate_series(1, 2000))))::text)))$q$, '{"gastos": 2000, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('importar: con 2001 no', $q$select lab.llama('otra@x.com', format($x$select public.gastos_importar('a1000000-0000-4000-8000-000000000001', %L::jsonb)::text$x$, (select jsonb_build_array(jsonb_build_object('titulo', 'Grande', 'gastos', (select jsonb_agg(jsonb_build_object('fecha', '2026-01-01', 'concepto', 'x', 'tipo', 'comida', 'monto', 1)) from generate_series(1, 2001))))::text)))$q$, 'ERR Una rendición lleva hasta 2000 gastos');
select lab.comprobar('importar: los gastos de una rendición tienen que ser una lista', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar('a1000000-0000-4000-8000-000000000001', '[{"titulo": "x", "gastos": {}}]'::jsonb)::text$x$)$q$, 'ERR Una rendición lleva hasta 2000 gastos');
-- Lo que queda guardado (se importa de verdad y se mira): las rendiciones históricas, aprobadas, a nombre de quien importa.
select lab.comprobar('importar: de verdad, con un gasto sin «historica» ni «factura»',
  $q$select lab.hacer('otra@x.com', $x$select public.gastos_importar('a1000000-0000-4000-8000-000000000002', '[{"titulo": "Histórica", "lugar": "Lima", "pais": "Perú", "desde": "2025-01-01", "hasta": "2025-01-05", "gastos": [{"fecha": "2025-01-02", "concepto": "Taxi", "tipo": "transporte", "moneda": "PEN", "monto": 30}]}]'::jsonb)::text$x$)$q$, '{"gastos": 1, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('…la rendición queda aprobada, histórica y a nombre de quien importa',
  $q$select estado || ':' || historica::text || ':' || autor || ':' || aprobada_por || ':' || lugar from public.gastos_rendiciones where lote_id = 'a1000000-0000-4000-8000-000000000002'$q$, 'aprobada:true:otra@x.com:otra@x.com:Lima');
select lab.comprobar('…y el gasto, aprobado, con factura, a nombre de quien importa',
  $q$select estado || ':' || factura::text || ':' || autor || ':' || moneda || ':' || rendido_moneda from public.gastos where lote_id = 'a1000000-0000-4000-8000-000000000002'$q$, 'aprobado:true:otra@x.com:PEN:PEN');
select lab.comprobar('importar: con «historica» en falso y «factura» en falso se respeta',
  $q$select lab.hacer('otra@x.com', $x$select public.gastos_importar('a1000000-0000-4000-8000-000000000003', '[{"titulo": "Cuenta", "historica": false, "gastos": [{"fecha": "2026-10-02", "concepto": "Taxi", "tipo": "transporte", "factura": false}]}]'::jsonb)::text$x$)$q$, '{"gastos": 1, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('…no histórica', $q$select historica::text from public.gastos_rendiciones where lote_id = 'a1000000-0000-4000-8000-000000000003'$q$, 'false');
select lab.comprobar('…y sin factura', $q$select factura::text from public.gastos where lote_id = 'a1000000-0000-4000-8000-000000000003'$q$, 'false');
select lab.comprobar('importar: la misma tanda dos veces no', $q$select lab.hacer('otra@x.com', lab.tanda(1))$q$, '{"gastos": 0, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('…la segunda vez se frena', $q$select lab.hacer('otra@x.com', lab.tanda(1))$q$, 'ERR Esa tanda ya se importó');
select lab.comprobar('importar: una tanda con solo movimientos tampoco se repite',
  $q$select lab.hacer('otra@x.com', replace(lab.tanda(0, 1), 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009'))$q$, '{"gastos": 0, "movimientos": 1, "rendiciones": 0}');
select lab.comprobar('…ni la segunda vez',
  $q$select lab.hacer('otra@x.com', replace(lab.tanda(0, 1), 'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009'))$q$, 'ERR Esa tanda ya se importó');
select lab.comprobar('importar: los movimientos importados quedan confirmados, en mayúscula y a nombre de quien importa',
  $q$select estado || ':' || moneda || ':' || persona || ':' || confirmado_por from public.gastos_movimientos where lote_id = 'a1000000-0000-4000-8000-000000000009'$q$, 'confirmado:USD:otra@x.com:otra@x.com');
-- Deshacer
select lab.comprobar('deshacer: una integrante no', $q$select lab.llama('ana@x.com', $x$select public.gastos_importar_deshacer('a1000000-0000-4000-8000-000000000002')::text$x$)$q$, 'ERR Deshace un admin');
select lab.comprobar('deshacer: Finanzas tampoco', $q$select lab.llama('fin@x.com', $x$select public.gastos_importar_deshacer('a1000000-0000-4000-8000-000000000002')::text$x$)$q$, 'ERR Deshace un admin');
select lab.comprobar('deshacer: sin tanda', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar_deshacer(null)::text$x$)$q$, 'ERR Falta la tanda');
select lab.comprobar('deshacer: una administradora por rol sí, y dice qué borró', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar_deshacer('a1000000-0000-4000-8000-000000000002')::text$x$)$q$, '{"gastos": 1, "movimientos": 0, "rendiciones": 1}');
select lab.comprobar('deshacer: el admin fijo también, con los movimientos', $q$select lab.llama('benny@team-latam.com', $x$select public.gastos_importar_deshacer('a1000000-0000-4000-8000-000000000009')::text$x$)$q$, '{"gastos": 0, "movimientos": 1, "rendiciones": 0}');
select lab.comprobar('deshacer: una tanda que no existe borra cero', $q$select lab.llama('otra@x.com', $x$select public.gastos_importar_deshacer('a1000000-0000-4000-8000-0000000000ff')::text$x$)$q$, '{"gastos": 0, "movimientos": 0, "rendiciones": 0}');

-- Limpieza, para las pruebas que vienen después.
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
