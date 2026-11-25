\set QUIET on
-- ============================================================
-- Gastos y rendiciones: los límites de cada campo, uno por uno (25/11/2026)
-- ============================================================
-- El rompe-código sobre 27-gastos.sql (herramientas/auditoria/herramientas/mutaciones_sql.mjs) mostró que las reglas de
-- forma de cada tabla (los CHECK) casi no tenían prueba de borde: se podía cambiar un «<= 140» por «< 140», o
-- «is null» por «is not null» dentro de una regla, y ninguna prueba se enteraba. Acá cada regla tiene su caso: el
-- valor justo en el límite PASA y el primero que se pasa se RECHAZA (con el código 23514, check_violation).
-- Se prueban como el dueño de la base (sin pasar por las políticas): lo que se mide es la forma de los datos.
-- Personas y montos inventados.
truncate lab.resultados;
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
insert into public.members(email, name, nickname, role) values ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member');
insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Visita a Lima', 'C', '2026-09-10', '2026-09-10', '2026-09-12', 'visita', 'Benny', 'benny@team-latam.com', '[]');
insert into public.gastos_rendiciones (id, autor, rutina_mes, titulo, estado) values ('10000000-0000-4000-8000-000000000001', 'ana@x.com', '2026-09-01', 'Rutina', 'abierta');
insert into public.gastos (id, autor, rendicion_id, estado) values ('20000000-0000-4000-8000-000000000001', 'ana@x.com', '10000000-0000-4000-8000-000000000001', 'borrador');
insert into public.gastos_movimientos (id, persona, tipo, fecha, moneda, monto, cargado_por) values ('30000000-0000-4000-8000-000000000001', 'ana@x.com', 'recibido', '2026-09-01', 'USD', 10, 'ana@x.com');
insert into public.gastos_cambios (id, rendicion_id, autor, fecha, entregado_moneda, entregado_monto, recibido_moneda, recibido_monto)
  values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'ana@x.com', '2026-09-02', 'USD', 100, 'ANG', 180);
insert into public.gastos_comentarios (id, gasto_id, autor, texto) values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'benny@team-latam.com', 'Hola');

-- Intenta algo y dice qué pasó: «ok», o «error» con el código (23514 = la regla de forma lo rechazó).
create or replace function lab.intenta(s text) returns text language plpgsql as $$
begin execute s; return 'ok'; exception when others then return 'error ' || sqlstate; end $$;

-- Una fila por regla: tabla, id de la fila de prueba, qué se escribe y qué vuelve a quedar.
--   ok   lo que se acepta (el borde justo), mal   lo que se rechaza (el primero que se pasa), base   cómo vuelve la fila.
create temp table limites (n serial, tabla text, id uuid, nombre text, ok text, mal text, base text);
insert into limites (tabla, id, nombre, ok, mal, base)
select tabla, id::uuid, nombre, ok, mal, base from (values
  -- ----- gastos (27-gastos.sql, gastos_forma) -----
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el estado «confirmado» pide fecha, concepto y tipo (un borrador no)',
     $a$estado = 'confirmado', fecha = '2026-09-01', concepto = 'Taxi', tipo = 'transporte'$a$, $a$estado = 'confirmado'$a$, $a$estado = 'borrador', fecha = null, concepto = '', tipo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'un estado que no existe',
     $a$estado = 'borrador'$a$, $a$estado = 'archivado'$a$, $a$estado = 'borrador'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'confirmado con «otra persona» pide decir quién (pago_quien)',
     $a$estado = 'confirmado', fecha = '2026-09-01', concepto = 'Taxi', tipo = 'transporte', pago = 'otro', pago_quien = 'Diego'$a$,
     $a$estado = 'confirmado', fecha = '2026-09-01', concepto = 'Taxi', tipo = 'transporte', pago = 'otro', pago_quien = '  '$a$,
     $a$estado = 'borrador', fecha = null, concepto = '', tipo = null, pago = 'persona', pago_quien = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'quién pagó: solo organizacion, persona u otro',
     $a$pago = 'organizacion'$a$, $a$pago = 'banco'$a$, $a$pago = 'persona'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'pago_quien solo con «otro»',
     $a$pago = 'otro', pago_quien = 'Diego'$a$, $a$pago = 'persona', pago_quien = 'Diego'$a$, $a$pago = 'persona', pago_quien = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'pago_quien de hasta 200 letras',
     $a$pago = 'otro', pago_quien = repeat('x', 200)$a$, $a$pago = 'otro', pago_quien = repeat('x', 201)$a$, $a$pago = 'persona', pago_quien = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'forma de pago: tarjeta, efectivo o transferencia',
     $a$forma_pago = 'transferencia'$a$, $a$forma_pago = 'bitcoin'$a$, $a$forma_pago = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la tarjeta son sus 4 últimos dígitos',
     $a$tarjeta = '0123'$a$, $a$tarjeta = '01234'$a$, $a$tarjeta = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la tarjeta no admite letras',
     $a$tarjeta = '0123'$a$, $a$tarjeta = '01a3'$a$, $a$tarjeta = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la moneda del comprobante: con tres letras',
     $a$moneda = 'EUR'$a$, $a$moneda = 'E1R'$a$, $a$moneda = 'USD'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la moneda no puede tener cuatro letras',
     $a$moneda = 'EUR'$a$, $a$moneda = 'EURO'$a$, $a$moneda = 'USD'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la moneda en que se rinde: con tres letras',
     $a$rendido_moneda = 'EUR'$a$, $a$rendido_moneda = 'E1R'$a$, $a$rendido_moneda = 'USD'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el tipo: minúsculas, números y guion bajo',
     $a$tipo = 'compra_2'$a$, $a$tipo = 'Compra'$a$, $a$tipo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el tipo, hasta 40 letras',
     $a$tipo = repeat('a', 40)$a$, $a$tipo = repeat('a', 41)$a$, $a$tipo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el tipo no puede estar vacío si se escribe',
     $a$tipo = 'a'$a$, $a$tipo = ''$a$, $a$tipo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el monto, menos de diez mil millones',
     $a$monto = 9999999999.99$a$, $a$monto = 10000000000$a$, $a$monto = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el monto negativo, también por valor absoluto',
     $a$monto = -9999999999.99$a$, $a$monto = -10000000000$a$, $a$monto = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el monto en dólares, menos de diez mil millones',
     $a$rendido_monto = 9999999999.99$a$, $a$rendido_monto = 10000000000$a$, $a$rendido_monto = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el monto en dólares negativo, también por valor absoluto',
     $a$rendido_monto = -9999999999.99$a$, $a$rendido_monto = -10000000000$a$, $a$rendido_monto = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la fecha: desde el 1/1/2000',
     $a$fecha = '2000-01-01'$a$, $a$fecha = '1999-12-31'$a$, $a$fecha = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la fecha: hasta el 31/12/2100',
     $a$fecha = '2100-12-31'$a$, $a$fecha = '2101-01-01'$a$, $a$fecha = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el concepto, hasta 140 letras',
     $a$concepto = repeat('x', 140)$a$, $a$concepto = repeat('x', 141)$a$, $a$concepto = ''$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'las observaciones, hasta 500 letras',
     $a$observaciones = repeat('x', 500)$a$, $a$observaciones = repeat('x', 501)$a$, $a$observaciones = ''$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el comprobante va en la carpeta gastos/',
     $a$archivo = 'gastos/x/a.pdf'$a$, $a$archivo = 'otra/x/a.pdf'$a$, $a$archivo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la ruta del comprobante, hasta 300 letras',
     $a$archivo = 'gastos/' || repeat('x', 293)$a$, $a$archivo = 'gastos/' || repeat('x', 294)$a$, $a$archivo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el nombre del comprobante, hasta 200 letras',
     $a$archivo_nombre = repeat('x', 200)$a$, $a$archivo_nombre = repeat('x', 201)$a$, $a$archivo_nombre = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el tipo del comprobante, hasta 100 letras',
     $a$archivo_tipo = repeat('x', 100)$a$, $a$archivo_tipo = repeat('x', 101)$a$, $a$archivo_tipo = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la huella del comprobante: 64 caracteres hexadecimales en minúscula',
     $a$archivo_hash = repeat('a', 64)$a$, $a$archivo_hash = repeat('a', 63)$a$, $a$archivo_hash = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la huella no admite mayúsculas ni otras letras',
     $a$archivo_hash = repeat('0', 64)$a$, $a$archivo_hash = repeat('g', 64)$a$, $a$archivo_hash = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la lectura del comprobante es un objeto',
     $a$lectura = '{"a": 1}'::jsonb$a$, $a$lectura = '[1]'::jsonb$a$, $a$lectura = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'la lectura del comprobante pesa hasta 8000 bytes',
     $a$lectura = jsonb_build_object('x', repeat('y', 100))$a$, $a$lectura = jsonb_build_object('x', repeat(md5('a'), 400))$a$, $a$lectura = null$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el autor de un gasto: de 3 a 200 letras (mínimo)',
     $a$autor = 'a@b'$a$, $a$autor = 'ab'$a$, $a$autor = 'ana@x.com'$a$),
  ('gastos', '20000000-0000-4000-8000-000000000001', 'el autor de un gasto: de 3 a 200 letras (máximo)',
     $a$autor = repeat('a', 200)$a$, $a$autor = repeat('a', 201)$a$, $a$autor = 'ana@x.com'$a$),
  -- ----- rendiciones (rendiciones_forma, rendiciones_historica) -----
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el estado de una rendición',
     $a$estado = 'observada'$a$, $a$estado = 'cerrada'$a$, $a$estado = 'abierta'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'una rendición es de una actividad O de un mes, no de las dos',
     $a$rutina_mes = null, post_id = 'p1'$a$, $a$post_id = 'p1'$a$, $a$post_id = null, rutina_mes = '2026-09-01'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el mes de la rutina es siempre un día 1',
     $a$rutina_mes = '2026-10-01'$a$, $a$rutina_mes = '2026-10-02'$a$, $a$rutina_mes = '2026-09-01'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el mes de la rutina: desde enero de 2000',
     $a$rutina_mes = '2000-01-01'$a$, $a$rutina_mes = '1999-12-01'$a$, $a$rutina_mes = '2026-09-01'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el mes de la rutina: hasta diciembre de 2100',
     $a$rutina_mes = '2100-12-01'$a$, $a$rutina_mes = '2101-01-01'$a$, $a$rutina_mes = '2026-09-01'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el título de una rendición, hasta 200 letras',
     $a$titulo = repeat('x', 200)$a$, $a$titulo = repeat('x', 201)$a$, $a$titulo = 'Rutina'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: hasta 10 monedas',
     $a$total_manual = '{"AAA":1,"BBB":1,"CCC":1,"DDD":1,"EEE":1,"FFF":1,"GGG":1,"HHH":1,"III":1,"JJJ":1}'::jsonb$a$,
     $a$total_manual = '{"AAA":1,"BBB":1,"CCC":1,"DDD":1,"EEE":1,"FFF":1,"GGG":1,"HHH":1,"III":1,"JJJ":1,"KKK":1}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: menos de diez mil millones por moneda',
     $a$total_manual = '{"USD": 9999999999.99}'::jsonb$a$, $a$total_manual = '{"USD": 10000000000}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: lo negativo también por valor absoluto',
     $a$total_manual = '{"USD": -9999999999.99}'::jsonb$a$, $a$total_manual = '{"USD": -10000000000}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: con hasta dos decimales',
     $a$total_manual = '{"USD": 10.25}'::jsonb$a$, $a$total_manual = '{"USD": 10.255}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: la moneda en mayúscula',
     $a$total_manual = '{"USD": 1}'::jsonb$a$, $a$total_manual = '{"usd": 1}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido: el monto es un número',
     $a$total_manual = '{"USD": 1}'::jsonb$a$, $a$total_manual = '{"USD": "1"}'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el total rápido es un objeto',
     $a$total_manual = '{"USD": 1}'::jsonb$a$, $a$total_manual = '[1]'::jsonb$a$, $a$total_manual = '{}'::jsonb$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'quién anotó el total rápido, hasta 200 letras',
     $a$total_manual_por = repeat('x', 200)$a$, $a$total_manual_por = repeat('x', 201)$a$, $a$total_manual_por = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'quién aprobó, hasta 200 letras',
     $a$aprobada_por = repeat('x', 200)$a$, $a$aprobada_por = repeat('x', 201)$a$, $a$aprobada_por = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el autor de una rendición: de 3 a 200 letras',
     $a$autor = 'a@b'$a$, $a$autor = 'ab'$a$, $a$autor = 'ana@x.com'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el autor de una rendición, hasta 200 letras',
     $a$autor = repeat('a', 200)$a$, $a$autor = repeat('a', 201)$a$, $a$autor = 'ana@x.com'$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el lugar de una rendición histórica, hasta 120 letras',
     $a$lugar = repeat('x', 120)$a$, $a$lugar = repeat('x', 121)$a$, $a$lugar = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'el país de una rendición histórica, hasta 120 letras',
     $a$pais = repeat('x', 120)$a$, $a$pais = repeat('x', 121)$a$, $a$pais = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'la fecha «desde»: desde el 1/1/2000',
     $a$desde = '2000-01-01'$a$, $a$desde = '1999-12-31'$a$, $a$desde = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'la fecha «desde»: hasta el 31/12/2100',
     $a$desde = '2100-12-31'$a$, $a$desde = '2101-01-01'$a$, $a$desde = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'la fecha «hasta»: desde el 1/1/2000',
     $a$hasta = '2000-01-01'$a$, $a$hasta = '1999-12-31'$a$, $a$hasta = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'la fecha «hasta»: hasta el 31/12/2100',
     $a$hasta = '2100-12-31'$a$, $a$hasta = '2101-01-01'$a$, $a$hasta = null$a$),
  ('gastos_rendiciones', '10000000-0000-4000-8000-000000000001', 'un viaje no termina antes de empezar (pueden ser el mismo día)',
     $a$desde = '2026-09-10', hasta = '2026-09-10'$a$, $a$desde = '2026-09-11', hasta = '2026-09-10'$a$, $a$desde = null, hasta = null$a$),
  -- ----- movimientos (movimientos_forma, movimientos_archivo) -----
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el tipo de un movimiento',
     $a$tipo = 'devuelto'$a$, $a$tipo = 'regalo'$a$, $a$tipo = 'recibido'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el estado de un movimiento',
     $a$estado = 'confirmado'$a$, $a$estado = 'rechazado'$a$, $a$estado = 'pendiente'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la moneda de un movimiento: con tres letras',
     $a$moneda = 'EUR'$a$, $a$moneda = 'E1R'$a$, $a$moneda = 'USD'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el monto de un movimiento no es cero',
     $a$monto = 0.01$a$, $a$monto = 0$a$, $a$monto = 10$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'lo recibido y lo devuelto son positivos',
     $a$monto = 1$a$, $a$monto = -1$a$, $a$monto = 10$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'un ajuste puede ser negativo',
     $a$tipo = 'ajuste', monto = -5$a$, $a$tipo = 'devuelto', monto = -5$a$, $a$tipo = 'recibido', monto = 10$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el monto de un movimiento, menos de diez mil millones',
     $a$monto = 9999999999.99$a$, $a$monto = 10000000000$a$, $a$monto = 10$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el monto negativo de un ajuste, también por valor absoluto',
     $a$tipo = 'ajuste', monto = -9999999999.99$a$, $a$tipo = 'ajuste', monto = -10000000000$a$, $a$tipo = 'recibido', monto = 10$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la fecha de un movimiento: desde el 1/1/2000',
     $a$fecha = '2000-01-01'$a$, $a$fecha = '1999-12-31'$a$, $a$fecha = '2026-09-01'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la fecha de un movimiento: hasta el 31/12/2100',
     $a$fecha = '2100-12-31'$a$, $a$fecha = '2101-01-01'$a$, $a$fecha = '2026-09-01'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la descripción de un movimiento, hasta 300 letras',
     $a$descripcion = repeat('x', 300)$a$, $a$descripcion = repeat('x', 301)$a$, $a$descripcion = ''$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la persona de un movimiento: de 3 a 200 letras',
     $a$persona = 'a@b'$a$, $a$persona = 'ab'$a$, $a$persona = 'ana@x.com'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la persona de un movimiento, hasta 200 letras',
     $a$persona = repeat('a', 200)$a$, $a$persona = repeat('a', 201)$a$, $a$persona = 'ana@x.com'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'quién cargó un movimiento: de 3 a 200 letras',
     $a$cargado_por = 'a@b'$a$, $a$cargado_por = 'ab'$a$, $a$cargado_por = 'ana@x.com'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'quién cargó un movimiento, hasta 200 letras',
     $a$cargado_por = repeat('a', 200)$a$, $a$cargado_por = repeat('a', 201)$a$, $a$cargado_por = 'ana@x.com'$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el comprobante de un movimiento va en gastos/mov-',
     $a$archivo = 'gastos/mov-1/a.pdf'$a$, $a$archivo = 'gastos/1/a.pdf'$a$, $a$archivo = null$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'la ruta del comprobante de un movimiento, hasta 300 letras',
     $a$archivo = 'gastos/mov-' || repeat('x', 289)$a$, $a$archivo = 'gastos/mov-' || repeat('x', 290)$a$, $a$archivo = null$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el nombre del comprobante de un movimiento, hasta 200 letras',
     $a$archivo_nombre = repeat('x', 200)$a$, $a$archivo_nombre = repeat('x', 201)$a$, $a$archivo_nombre = null$a$),
  ('gastos_movimientos', '30000000-0000-4000-8000-000000000001', 'el tipo del comprobante de un movimiento, hasta 100 letras',
     $a$archivo_tipo = repeat('x', 100)$a$, $a$archivo_tipo = repeat('x', 101)$a$, $a$archivo_tipo = null$a$),
  -- ----- cambios de moneda (cambios_forma) -----
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'lo que se entrega y lo que se recibe, en monedas distintas',
     $a$recibido_moneda = 'EUR'$a$, $a$recibido_moneda = 'USD'$a$, $a$recibido_moneda = 'ANG'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'la moneda que se recibe: con tres letras',
     $a$recibido_moneda = 'EUR'$a$, $a$recibido_moneda = 'E1R'$a$, $a$recibido_moneda = 'ANG'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'la moneda que se entrega: con tres letras',
     $a$entregado_moneda = 'EUR'$a$, $a$entregado_moneda = 'E1R'$a$, $a$entregado_moneda = 'USD'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'lo que se entrega es más que cero',
     $a$entregado_monto = 0.01$a$, $a$entregado_monto = 0$a$, $a$entregado_monto = 100$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'lo que se entrega, menos de diez mil millones',
     $a$entregado_monto = 9999999999.99$a$, $a$entregado_monto = 10000000000$a$, $a$entregado_monto = 100$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'lo que se recibe es más que cero',
     $a$recibido_monto = 0.01$a$, $a$recibido_monto = 0$a$, $a$recibido_monto = 180$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'lo que se recibe, menos de diez mil millones',
     $a$recibido_monto = 9999999999.99$a$, $a$recibido_monto = 10000000000$a$, $a$recibido_monto = 180$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'la fecha de un cambio: desde el 1/1/2000',
     $a$fecha = '2000-01-01'$a$, $a$fecha = '1999-12-31'$a$, $a$fecha = '2026-09-02'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'la fecha de un cambio: hasta el 31/12/2100',
     $a$fecha = '2100-12-31'$a$, $a$fecha = '2101-01-01'$a$, $a$fecha = '2026-09-02'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'las observaciones de un cambio, hasta 300 letras',
     $a$observaciones = repeat('x', 300)$a$, $a$observaciones = repeat('x', 301)$a$, $a$observaciones = ''$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'el autor de un cambio: de 3 a 200 letras',
     $a$autor = 'a@b'$a$, $a$autor = 'ab'$a$, $a$autor = 'ana@x.com'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'el autor de un cambio, hasta 200 letras',
     $a$autor = repeat('a', 200)$a$, $a$autor = repeat('a', 201)$a$, $a$autor = 'ana@x.com'$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'el comprobante de un cambio va en gastos/cambio-',
     $a$archivo = 'gastos/cambio-1/a.pdf'$a$, $a$archivo = 'gastos/1/a.pdf'$a$, $a$archivo = null$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'la ruta del comprobante de un cambio, hasta 300 letras',
     $a$archivo = 'gastos/cambio-' || repeat('x', 286)$a$, $a$archivo = 'gastos/cambio-' || repeat('x', 287)$a$, $a$archivo = null$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'el nombre del comprobante de un cambio, hasta 200 letras',
     $a$archivo_nombre = repeat('x', 200)$a$, $a$archivo_nombre = repeat('x', 201)$a$, $a$archivo_nombre = null$a$),
  ('gastos_cambios', '40000000-0000-4000-8000-000000000001', 'el tipo del comprobante de un cambio, hasta 100 letras',
     $a$archivo_tipo = repeat('x', 100)$a$, $a$archivo_tipo = repeat('x', 101)$a$, $a$archivo_tipo = null$a$),
  -- ----- comentarios (comentarios_forma) -----
  ('gastos_comentarios', '50000000-0000-4000-8000-000000000001', 'un comentario de 1 a 1000 letras (máximo)',
     $a$texto = repeat('x', 1000)$a$, $a$texto = repeat('x', 1001)$a$, $a$texto = 'Hola'$a$),
  ('gastos_comentarios', '50000000-0000-4000-8000-000000000001', 'un comentario no puede estar vacío',
     $a$texto = 'x'$a$, $a$texto = ''$a$, $a$texto = 'Hola'$a$),
  ('gastos_comentarios', '50000000-0000-4000-8000-000000000001', 'ni tener solo espacios',
     $a$texto = ' x '$a$, $a$texto = '   '$a$, $a$texto = 'Hola'$a$),
  ('gastos_comentarios', '50000000-0000-4000-8000-000000000001', 'el autor de un comentario: de 3 a 200 letras',
     $a$autor = 'a@b'$a$, $a$autor = 'ab'$a$, $a$autor = 'benny@team-latam.com'$a$),
  ('gastos_comentarios', '50000000-0000-4000-8000-000000000001', 'el autor de un comentario, hasta 200 letras',
     $a$autor = repeat('a', 200)$a$, $a$autor = repeat('a', 201)$a$, $a$autor = 'benny@team-latam.com'$a$)
) as v(tabla, id, nombre, ok, mal, base);

do $$
declare c record; sentencia text;
begin
  for c in select * from limites order by n loop
    -- el borde justo pasa…
    sentencia := format('update public.%I set %s where id = %L', c.tabla, c.ok, c.id);
    perform lab.comprobar(c.tabla || ': ' || c.nombre || ' — lo que está en el límite pasa', format('select lab.intenta(%L)', sentencia), 'ok');
    perform lab.intenta(format('update public.%I set %s where id = %L', c.tabla, c.base, c.id));
    -- …y el primero que se pasa se rechaza por la regla de forma.
    sentencia := format('update public.%I set %s where id = %L', c.tabla, c.mal, c.id);
    perform lab.comprobar(c.tabla || ': ' || c.nombre || ' — lo que se pasa se rechaza', format('select lab.intenta(%L)', sentencia), 'error 23514');
    perform lab.intenta(format('update public.%I set %s where id = %L', c.tabla, c.base, c.id));
  end loop;
end $$;

-- ---------- La moneda se acomoda sola: minúsculas y espacios no estorban ----------
update public.gastos set moneda = ' eur ', rendido_moneda = ' ars ' where id = '20000000-0000-4000-8000-000000000001';
select lab.comprobar('gastos: la moneda del comprobante se guarda en mayúscula y sin espacios', $q$select moneda from public.gastos where id = '20000000-0000-4000-8000-000000000001'$q$, 'EUR');
select lab.comprobar('gastos: la moneda en que se rinde, también', $q$select rendido_moneda from public.gastos where id = '20000000-0000-4000-8000-000000000001'$q$, 'ARS');
update public.gastos set moneda = 'USD', rendido_moneda = 'USD' where id = '20000000-0000-4000-8000-000000000001';
update public.gastos_movimientos set moneda = ' eur ' where id = '30000000-0000-4000-8000-000000000001';
select lab.comprobar('movimientos: la moneda se guarda en mayúscula y sin espacios', $q$select moneda from public.gastos_movimientos where id = '30000000-0000-4000-8000-000000000001'$q$, 'EUR');
update public.gastos_movimientos set moneda = 'USD' where id = '30000000-0000-4000-8000-000000000001';
update public.gastos_cambios set entregado_moneda = ' eur ', recibido_moneda = ' ars ' where id = '40000000-0000-4000-8000-000000000001';
select lab.comprobar('cambios: la moneda que se entrega se guarda en mayúscula y sin espacios', $q$select entregado_moneda from public.gastos_cambios where id = '40000000-0000-4000-8000-000000000001'$q$, 'EUR');
select lab.comprobar('cambios: la moneda que se recibe, también', $q$select recibido_moneda from public.gastos_cambios where id = '40000000-0000-4000-8000-000000000001'$q$, 'ARS');
update public.gastos_cambios set entregado_moneda = 'USD', recibido_moneda = 'ANG' where id = '40000000-0000-4000-8000-000000000001';

-- ---------- gastos_totales_ok, directo ----------
select lab.comprobar('totales: un objeto con monedas en mayúscula y números', $q$select public.gastos_totales_ok('{"USD": 1910.67, "BZD": 300}'::jsonb)::text$q$, 'true');
select lab.comprobar('totales: vacío es válido', $q$select public.gastos_totales_ok('{}'::jsonb)::text$q$, 'true');
select lab.comprobar('totales: una lista no', $q$select public.gastos_totales_ok('[]'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: un texto no', $q$select public.gastos_totales_ok('"USD"'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: una moneda de dos letras no', $q$select public.gastos_totales_ok('{"US": 1}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: una moneda de cuatro letras no', $q$select public.gastos_totales_ok('{"USDD": 1}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: un monto que no es número no', $q$select public.gastos_totales_ok('{"USD": null}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: tres decimales no', $q$select public.gastos_totales_ok('{"USD": 1.005}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: justo menos de diez mil millones sí', $q$select public.gastos_totales_ok('{"USD": 9999999999.99}'::jsonb)::text$q$, 'true');
select lab.comprobar('totales: diez mil millones no', $q$select public.gastos_totales_ok('{"USD": 10000000000}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: menos diez mil millones tampoco', $q$select public.gastos_totales_ok('{"USD": -10000000000}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: diez monedas sí', $q$select public.gastos_totales_ok('{"AAA":1,"BBB":1,"CCC":1,"DDD":1,"EEE":1,"FFF":1,"GGG":1,"HHH":1,"III":1,"JJJ":1}'::jsonb)::text$q$, 'true');
select lab.comprobar('totales: once no', $q$select public.gastos_totales_ok('{"AAA":1,"BBB":1,"CCC":1,"DDD":1,"EEE":1,"FFF":1,"GGG":1,"HHH":1,"III":1,"JJJ":1,"KKK":1}'::jsonb)::text$q$, 'false');
select lab.comprobar('totales: una buena y una mala, no', $q$select public.gastos_totales_ok('{"USD": 1, "EUR": "x"}'::jsonb)::text$q$, 'false');

-- Limpieza, para las pruebas que vienen después.
truncate public.gastos_cambios, public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
