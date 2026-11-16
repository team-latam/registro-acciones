\set QUIET on
-- ============================================================
-- Gastos y rendiciones (27-gastos.sql)
-- ============================================================
-- Lo que más importa: que cada persona vea y toque SOLO lo suyo, y que una
-- rendición pase por sus estados como se acordó (cargar, confirmar, mandar,
-- observar, corregir, volver a mandar, aprobar). Y la cuenta corriente con
-- números a mano, para que la cuenta no se pueda torcer sin que se note.
-- Personas y montos inventados.
truncate lab.resultados;
truncate public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
truncate public.posts, public.members cascade;
delete from public.app_config where key = 'preferences';
delete from storage.objects;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('diego@x.com', 'Diego', 'diego', 'member'), ('olga@x.com', 'Olga', 'olga', 'observer'),
  ('otra.admin@x.com', 'Otra', 'otra', 'admin');
insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Visita a Lima', 'C', '2026-09-10', '2026-09-10', '2026-09-12', 'visita', 'Benny', 'benny@team-latam.com', '[{"name":"Ana","email":"ana@x.com"}]'),
  ('p2', 'Curso en Quito', 'C', '2026-09-20', '2026-09-20', '2026-09-21', 'curso', 'Benny', 'benny@team-latam.com', '[]'),
  ('p3', 'Rutina del lunes', 'C', '2026-09-07', '2026-09-07', '2026-09-07', 'rutina', 'Ana', 'ana@x.com', '[]'),
  ('p4', 'Seminario de Diego', 'C', '2026-09-25', '2026-09-25', '2026-09-25', 'seminario', 'Diego', 'diego@x.com', '[]');

-- Hacer algo como una persona y que QUEDE (lab.probar lo deshace). Devuelve
-- el resultado, o «error: …» si la base no lo dejó. (La misma de 73-problemas.sql.)
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
-- ¿La base lo rechazó? (cualquier error cuenta)
create or replace function lab.rechaza(quien jsonb, sentencia text) returns text language sql as $$
  select (lab.hacer(quien, sentencia) like 'error:%')::text
$$;

-- ---------- ¿Para quién están abiertos? ----------
select lab.comprobar('el admin fijo tiene los gastos abiertos (la etapa de prueba es suya)',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'true');
select lab.comprobar('un admin por rol, también',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'true');
select lab.comprobar('una integrante, no: todavía no se abrieron para el equipo',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'false');
select lab.comprobar('una observadora, no',
  $q$select lab.hacer(lab.como('olga@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'false');
select lab.comprobar('alguien de afuera, no',
  $q$select lab.hacer(lab.como('afuera@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'false');
select lab.comprobar('cerrados, una integrante no puede abrir una rendición aunque llame a la base por su cuenta',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p1', null)::text$x$)$q$, 'true');
select lab.comprobar('…ni cargar un gasto directo',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto) values ('x') returning id::text$x$)$q$, 'true');
select lab.comprobar('…ni anotar un movimiento',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('ana@x.com', 'recibido', '2026-09-01', 'USD', 10) returning id::text$x$)$q$, 'true');

-- ---------- El admin, en la etapa de prueba ----------
select lab.comprobar('el admin abre su rendición en cualquier actividad, aunque no figure como participante',
  $q$select (lab.hacer(lab.como('benny@team-latam.com'), $x$select public.gastos_rendicion_abrir('p2', null)::text$x$) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.comprobar('…y abrirla de nuevo da la misma (no se duplica)',
  $q$select (lab.hacer(lab.como('benny@team-latam.com'), $x$select public.gastos_rendicion_abrir('p2', null)::text$x$)
          = (select id::text from public.gastos_rendiciones where autor = 'benny@team-latam.com' and post_id = 'p2'))::text$q$, 'true');
select lab.comprobar('la rendición guarda el título de la actividad',
  $q$select titulo from public.gastos_rendiciones where autor = 'benny@team-latam.com' and post_id = 'p2'$q$, 'Curso en Quito');
select lab.hacer(lab.como('benny@team-latam.com'), $x$select public.gastos_rendicion_abrir(null, '2026-09-17')::text$x$) as rb_mes \gset
select lab.comprobar('la rutina de un mes: con cualquier día del mes queda el primero',
  $q$select rutina_mes::text from public.gastos_rendiciones where id = '$q$ || :'rb_mes' || $q$'$q$, '2026-09-01');

-- ---------- Se abren para el equipo ----------
insert into public.app_config(key, value) values ('preferences', '{"gastos": {"abierto": true}}');
select lab.comprobar('abiertos: una integrante los tiene', $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'true');
select lab.comprobar('una observadora sigue sin tenerlos (no carga nada)', $q$select lab.hacer(lab.como('olga@x.com'), $x$select public.gastos_habilitado()::text$x$)$q$, 'false');
select lab.comprobar('una integrante abre su rendición en una actividad donde figura como participante',
  $q$select (lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p1', null)::text$x$) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.comprobar('…pero no en una donde no participó',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p2', null)::text$x$)$q$, 'true');
select lab.comprobar('…ni en una que cargó otra persona',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p4', null)::text$x$)$q$, 'true');
select lab.comprobar('…ni en una Rutina (sus gastos van a la rutina del mes)',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p3', null)::text$x$)$q$, 'true');
select lab.comprobar('…ni en una actividad que no existe',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('nada', null)::text$x$)$q$, 'true');
select lab.comprobar('una actividad o un mes: las dos juntas, no',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir('p1', '2026-09-01')::text$x$)$q$, 'true');
select lab.comprobar('…y ninguna de las dos, tampoco',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir(null, null)::text$x$)$q$, 'true');
select lab.comprobar('quien cargó la actividad abre su rendición ahí', $q$select (lab.hacer(lab.como('diego@x.com'), $x$select public.gastos_rendicion_abrir('p4', null)::text$x$) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.comprobar('una integrante abre su rutina del mes', $q$select (lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir(null, '2026-09-30')::text$x$) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.comprobar('una rendición no se crea directo (solo con la función)',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos_rendiciones(autor, rutina_mes) values ('ana@x.com', '2026-10-01') returning id::text$x$)$q$, 'true');

select id as ra from public.gastos_rendiciones where autor = 'ana@x.com' and post_id = 'p1' \gset
select id as ra_mes from public.gastos_rendiciones where autor = 'ana@x.com' and rutina_mes = '2026-09-01' \gset
select id as rd from public.gastos_rendiciones where autor = 'diego@x.com' and post_id = 'p4' \gset

-- ---------- Borrar una rendición vacía ----------
select lab.probar('una integrante borra una rendición suya, abierta y vacía', lab.como('ana@x.com'),
  format($x$delete from public.gastos_rendiciones where id = %L$x$, :'ra'), true);
select lab.probar('…no la de otra persona', lab.como('ana@x.com'), format($x$delete from public.gastos_rendiciones where id = %L$x$, :'rd'), false);
select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir(null, '2026-08-05')::text$x$) as ra_ago \gset
update public.gastos_rendiciones set estado = 'enviada' where id = :'ra_ago';
select lab.probar('…ni una suya que ya mandó', lab.como('ana@x.com'), format($x$delete from public.gastos_rendiciones where id = %L$x$, :'ra_ago'), false);
select lab.probar('el admin fijo borra cualquiera vacía', lab.como('benny@team-latam.com'), format($x$delete from public.gastos_rendiciones where id = %L$x$, :'ra_ago'), true);
delete from public.gastos_rendiciones where id = :'ra_ago';

-- ---------- Cargar gastos ----------
select lab.hacer(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, fecha, concepto, tipo, moneda, monto, pago, forma_pago, tarjeta, archivo_hash, estado)
  values (%L, '2026-09-10', 'Hotel x 2 noches', 'alojamiento', 'USD', 100, 'persona', 'tarjeta', '1234', repeat('a', 64), 'confirmado') returning id::text$x$, :'ra')) as g1 \gset
select lab.hacer(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, fecha, concepto, tipo, moneda, monto, rendido_moneda, rendido_monto, pago, estado)
  values (%L, '2026-09-11', 'Taxi', 'transporte', 'mxn', 350, 'USD', 17.50, 'persona', 'confirmado') returning id::text$x$, :'ra')) as g2 \gset
select lab.hacer(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, fecha, concepto, tipo, moneda, monto, pago, estado)
  values (%L, '2026-09-11', 'Almuerzo', 'comida', 'MXN', 200, 'persona', 'confirmado') returning id::text$x$, :'ra')) as g3 \gset
select lab.hacer(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, fecha, concepto, tipo, moneda, monto, pago, estado)
  values (%L, '2026-09-12', 'Pasaje', 'pasaje', 'USD', 50, 'organizacion', 'borrador') returning id::text$x$, :'ra')) as g4 \gset
select lab.comprobar('una integrante carga sus gastos (cuatro, en su rendición)', $q$select count(*)::text from public.gastos where autor = 'ana@x.com'$q$, '4');
select lab.probar('una rendición con gastos no se borra', lab.como('ana@x.com'), format($x$delete from public.gastos_rendiciones where id = %L$x$, :'ra'), false);
select lab.comprobar('la moneda se guarda en mayúsculas', $q$select moneda from public.gastos where concepto = 'Taxi'$q$, 'MXN');
select lab.comprobar('el gasto queda a nombre de quien lo carga aunque diga otra persona',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos(autor, concepto) values ('diego@x.com', 'a nombre de otro') returning autor$x$)$q$, 'ana@x.com');
delete from public.gastos where concepto = 'a nombre de otro';
select lab.comprobar('no se carga un gasto en la rendición de otra persona',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, concepto) values (%L, 'x') returning id::text$x$, '$q$ || :'rd' || $q$'))$q$, 'true');
select lab.comprobar('un gasto nuevo no nace mandado',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto, estado, fecha, tipo) values ('x', 'enviado', '2026-09-01', 'comida') returning id::text$x$)$q$, 'true');
select lab.comprobar('confirmado sin fecha, no (un borrador sí puede estar a medias)',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto, tipo, estado) values ('x', 'comida', 'confirmado') returning id::text$x$)$q$, 'true');
select lab.comprobar('una tarjeta se guarda con sus 4 últimos números, no más',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto, tarjeta) values ('x', '12345') returning id::text$x$)$q$, 'true');
select lab.comprobar('el comprobante va en la carpeta de su propio gasto',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto, archivo) values ('x', 'gastos/otro-gasto/a.pdf') returning id::text$x$)$q$, 'true');
select lab.comprobar('el mismo comprobante dos veces (misma huella) de la misma persona: no',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos(concepto, archivo_hash) values ('repetido', repeat('a', 64)) returning id::text$x$)$q$, 'true');
select lab.comprobar('…de otra persona, sí (cada uno tiene los suyos)',
  $q$select (lab.hacer(lab.como('diego@x.com'), $x$insert into public.gastos(concepto, archivo_hash) values ('el mismo ticket', repeat('a', 64)) returning id::text$x$) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.hacer(lab.como('diego@x.com'), format($x$insert into public.gastos(rendicion_id, fecha, concepto, tipo, moneda, monto, pago, estado)
  values (%L, '2026-09-25', 'Cena', 'comida', 'USD', 30, 'persona', 'confirmado') returning id::text$x$, :'rd')) as gd \gset

-- ---------- Cada uno ve lo suyo ----------
select lab.comprobar('una integrante NO ve los gastos de otra persona',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.gastos where autor <> 'ana@x.com'$x$)$q$, '0');
select lab.comprobar('…ni sus rendiciones', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.gastos_rendiciones where autor <> 'ana@x.com'$x$)$q$, '0');
select lab.comprobar('ve los suyos', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.gastos$x$)$q$, '4');
select lab.comprobar('un admin ve los de todos', $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select count(distinct autor)::text from public.gastos$x$)$q$, '2');
select lab.comprobar('una observadora no ve ninguno', $q$select lab.hacer(lab.como('olga@x.com'), $x$select count(*)::text from public.gastos$x$)$q$, '0');
select lab.probar('una integrante no puede cambiar un gasto de otra persona', lab.como('ana@x.com'),
  format($x$update public.gastos set monto = 1 where id = %L$x$, :'gd'), false);
select lab.probar('…ni borrarlo', lab.como('ana@x.com'), format($x$delete from public.gastos where id = %L$x$, :'gd'), false);

-- ---------- Corregir lo propio ----------
select lab.probar('corrige un gasto suyo que todavía no mandó', lab.como('ana@x.com'),
  format($x$update public.gastos set concepto = 'Hotel x 2 noches (Miraflores)' where id = %L$x$, :'g1'), true);
select lab.probar('no se lo aprueba sola', lab.como('ana@x.com'), format($x$update public.gastos set estado = 'aprobado' where id = %L$x$, :'g1'), false);
select lab.probar('ni se lo «observa»', lab.como('ana@x.com'), format($x$update public.gastos set estado = 'observado' where id = %L$x$, :'g1'), false);
select lab.probar('ni se lo pasa a otra persona', lab.como('ana@x.com'), format($x$update public.gastos set autor = 'diego@x.com' where id = %L$x$, :'g1'), false);

-- ---------- Borrar una rendición entera, con sus gastos ----------
select lab.probar_valor('una integrante borra su rendición entera, con sus gastos', lab.como('ana@x.com'),
  format($x$select public.gastos_rendicion_borrar(%L)$x$, :'ra'),
  format($x$select (select count(*) from public.gastos where rendicion_id = %L) || '/' || (select count(*) from public.gastos_rendiciones where id = %L)$x$, :'ra', :'ra'), '0/0');
select lab.comprobar('…no la de otra persona',
  $q$select lab.rechaza(lab.como('diego@x.com'), format($x$select public.gastos_rendicion_borrar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.comprobar('…ni un admin por rol',
  $q$select lab.rechaza(lab.como('otra.admin@x.com'), format($x$select public.gastos_rendicion_borrar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.probar_valor('el admin fijo, sí (y dice cuántos gastos se fueron)', lab.como('benny@team-latam.com'),
  format($x$create temp table if not exists borrados(n int) on commit drop; insert into borrados select public.gastos_rendicion_borrar(%L)$x$, :'ra'),
  $x$select n::text from borrados$x$, '4');
select lab.comprobar('lo de arriba no quedó: los cuatro gastos siguen', $q$select count(*)::text from public.gastos where rendicion_id = '$q$ || :'ra' || $q$'$q$, '4');

-- ---------- Mandar la rendición ----------
select lab.comprobar('con un borrador adentro, la rendición no se manda',
  $q$select lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$,
  'error: Faltan confirmar 1 gasto(s)');
select lab.hacer(lab.como('ana@x.com'), format($x$update public.gastos set estado = 'confirmado' where id = %L returning estado$x$, :'g4'));
select lab.comprobar('otra persona no puede mandar la rendición de Ana',
  $q$select lab.rechaza(lab.como('diego@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.comprobar('con todo confirmado, se manda',
  $q$select lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.comprobar('…y sus gastos quedan mandados', $q$select string_agg(distinct estado, ',') from public.gastos where rendicion_id = '$q$ || :'ra' || $q$'$q$, 'enviado');
select lab.comprobar('una rendición sin nada no se manda',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra_mes' || $q$'))$q$, 'true');
select lab.probar('mandado, un gasto ya no se corrige', lab.como('ana@x.com'), format($x$update public.gastos set monto = 99 where id = %L$x$, :'g1'), false);
select lab.probar('…ni se borra', lab.como('ana@x.com'), format($x$delete from public.gastos where id = %L$x$, :'g1'), false);
select lab.comprobar('…ni se le suma otro gasto a esa rendición',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$insert into public.gastos(rendicion_id, concepto) values (%L, 'otro') returning id::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.probar('…ni se cambia su total rápido', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"USD": 1}' where id = %L$x$, :'ra'), false);
select lab.comprobar('…ni se borra entera (ni el admin fijo)', $q$select lab.rechaza(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_borrar(%L)::text$x$, '$q$ || :'ra' || $q$'))
  || '/' || lab.rechaza(lab.como('benny@team-latam.com'), format($x$select public.gastos_rendicion_borrar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true/true');

-- ---------- Observar y corregir ----------
select lab.comprobar('una integrante no observa nada',
  $q$select lab.rechaza(lab.como('diego@x.com'), format($x$select public.gastos_observar(%L, 'mmm')::text$x$, '$q$ || :'g1' || $q$'))$q$, 'true');
select lab.comprobar('un admin no observa sin un comentario',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), format($x$select public.gastos_observar(%L, '   ')::text$x$, '$q$ || :'g1' || $q$'))$q$, 'true');
select lab.comprobar('un admin observa un gasto con un comentario',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), format($x$select public.gastos_observar(%L, 'Falta la factura del hotel')::text$x$, '$q$ || :'g1' || $q$'))$q$, 'true');
select lab.comprobar('…el gasto queda observado y la rendición vuelve a la persona',
  $q$select g.estado || '/' || r.estado from public.gastos g join public.gastos_rendiciones r on r.id = g.rendicion_id where g.id = '$q$ || :'g1' || $q$'$q$, 'observado/observada');
select lab.comprobar('…los demás gastos siguen mandados', $q$select string_agg(distinct estado, ',') from public.gastos where rendicion_id = '$q$ || :'ra' || $q$' and id <> '$q$ || :'g1' || $q$'$q$, 'enviado');
select lab.comprobar('…y la persona ve el comentario', $q$select lab.hacer(lab.como('ana@x.com'), $x$select string_agg(texto, '|') from public.gastos_comentarios$x$)$q$, 'Falta la factura del hotel');
select lab.comprobar('otra persona no lo ve', $q$select lab.hacer(lab.como('diego@x.com'), $x$select count(*)::text from public.gastos_comentarios$x$)$q$, '0');
select lab.comprobar('otro admin, sí', $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select count(*)::text from public.gastos_comentarios$x$)$q$, '1');
select lab.comprobar('un comentario no se escribe directo (solo con las funciones)',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$insert into public.gastos_comentarios(gasto_id, autor, texto) values (%L, 'ana@x.com', 'hola') returning id::text$x$, '$q$ || :'g1' || $q$'))$q$, 'true');
select lab.probar('la persona corrige el gasto observado', lab.como('ana@x.com'),
  format($x$update public.gastos set observaciones = 'VISA. Factura pedida al hotel' where id = %L$x$, :'g1'), true);
select lab.probar('…pero no los que no le observaron', lab.como('ana@x.com'), format($x$update public.gastos set monto = 1 where id = %L$x$, :'g2'), false);
select lab.comprobar('con el gasto todavía observado, no se vuelve a mandar',
  $q$select lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'error: Faltan confirmar 1 gasto(s)');
select lab.comprobar('la persona responde', $q$select (lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_comentar(%L, 'Ya la pedí')::text$x$, '$q$ || :'g1' || $q$')) ~ '^[0-9a-f-]{36}$')::text$q$, 'true');
select lab.comprobar('otra persona no puede comentar ese gasto',
  $q$select lab.rechaza(lab.como('diego@x.com'), format($x$select public.gastos_comentar(%L, 'hola')::text$x$, '$q$ || :'g1' || $q$'))$q$, 'true');
select lab.comprobar('un admin no aprueba una rendición con una observación pendiente',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), format($x$select public.gastos_rendicion_aprobar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.hacer(lab.como('ana@x.com'), format($x$update public.gastos set estado = 'confirmado' where id = %L returning estado$x$, :'g1'));
select lab.comprobar('corregido y confirmado, se vuelve a mandar',
  $q$select lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');

-- ---------- Aprobar ----------
select lab.comprobar('una integrante no aprueba',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_aprobar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.comprobar('un admin aprueba la rendición entera',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), format($x$select public.gastos_rendicion_aprobar(%L)::text$x$, '$q$ || :'ra' || $q$'))$q$, 'true');
select lab.comprobar('…con todos sus gastos, y queda quién la aprobó',
  $q$select (select string_agg(distinct estado, ',') from public.gastos where rendicion_id = '$q$ || :'ra' || $q$') || '/' || estado || '/' || aprobada_por
     from public.gastos_rendiciones where id = '$q$ || :'ra' || $q$'$q$, 'aprobado/aprobada/otra.admin@x.com');
select lab.probar('aprobado, un gasto no se corrige', lab.como('ana@x.com'), format($x$update public.gastos set monto = 1 where id = %L$x$, :'g1'), false);
select lab.probar('…ni se borra', lab.como('ana@x.com'), format($x$delete from public.gastos where id = %L$x$, :'g1'), false);
select lab.comprobar('…ni se observa', $q$select lab.rechaza(lab.como('benny@team-latam.com'), format($x$select public.gastos_observar(%L, 'otra cosa')::text$x$, '$q$ || :'g2' || $q$'))$q$, 'true');
select lab.comprobar('Diego manda la suya (queda en revisión)',
  $q$select lab.hacer(lab.como('diego@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'rd' || $q$'))$q$, 'true');

-- ---------- El total rápido ----------
select lab.probar('una persona anota el total rápido de su rendición abierta', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"USD": 120.5, "MXN": 300}' where id = %L$x$, :'ra_mes'), true);
select lab.hacer(lab.como('ana@x.com'), format($x$update public.gastos_rendiciones set total_manual = '{"USD": 120.5, "MXN": 300}' where id = %L returning id::text$x$, :'ra_mes'));
select lab.comprobar('…y queda quién lo anotó', $q$select total_manual_por from public.gastos_rendiciones where id = '$q$ || :'ra_mes' || $q$'$q$, 'ana@x.com');
select lab.probar('una moneda en minúsculas, no', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"usd": 1}' where id = %L$x$, :'ra_mes'), false);
select lab.probar('un monto que no es número, no', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"USD": "mucho"}' where id = %L$x$, :'ra_mes'), false);
select lab.probar('con tres decimales, no', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"USD": 1.005}' where id = %L$x$, :'ra_mes'), false);
select lab.probar('de una rendición, por el navegador se toca solo el total rápido (no el estado)', lab.como('ana@x.com'),
  format($x$update public.gastos_rendiciones set estado = 'aprobada' where id = %L$x$, :'ra_mes'), false);
select lab.probar('…ni el total rápido de otra persona', lab.como('diego@x.com'),
  format($x$update public.gastos_rendiciones set total_manual = '{"USD": 1}' where id = %L$x$, :'ra_mes'), false);
select lab.comprobar('con solo un total rápido, la rendición se puede mandar',
  $q$select lab.hacer(lab.como('ana@x.com'), format($x$select public.gastos_rendicion_enviar(%L)::text$x$, '$q$ || :'ra_mes' || $q$'))$q$, 'true');

-- ---------- La cuenta corriente: los movimientos ----------
select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto, estado, descripcion)
  values ('ana@x.com', 'recibido', '2026-09-01', 'usd', 500, 'confirmado', 'Adelanto') returning id::text$x$) as m1 \gset
select lab.comprobar('una persona anota lo que recibió, y queda pendiente aunque diga confirmado',
  $q$select estado || '/' || moneda || '/' || cargado_por from public.gastos_movimientos where id = '$q$ || :'m1' || $q$'$q$, 'pendiente/USD/ana@x.com');
select lab.comprobar('no anota movimientos de otra persona',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('diego@x.com', 'recibido', '2026-09-01', 'USD', 10) returning id::text$x$)$q$, 'true');
select lab.comprobar('un ajuste lo anota un admin, no la persona',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('ana@x.com', 'ajuste', '2026-09-01', 'USD', 10) returning id::text$x$)$q$, 'true');
select lab.comprobar('lo recibido es un monto positivo',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('ana@x.com', 'recibido', '2026-09-01', 'USD', -10) returning id::text$x$)$q$, 'true');
select lab.comprobar('la persona no se confirma un movimiento',
  $q$select lab.rechaza(lab.como('ana@x.com'), format($x$select public.gastos_movimiento_confirmar(%L)::text$x$, '$q$ || :'m1' || $q$'))$q$, 'true');
select lab.comprobar('un admin lo confirma',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), format($x$select public.gastos_movimiento_confirmar(%L)::text$x$, '$q$ || :'m1' || $q$'))$q$, 'true');
select lab.comprobar('…y queda quién lo confirmó', $q$select estado || '/' || confirmado_por from public.gastos_movimientos where id = '$q$ || :'m1' || $q$'$q$, 'confirmado/benny@team-latam.com');
select lab.probar('confirmado, la persona ya no lo cambia', lab.como('ana@x.com'), format($x$update public.gastos_movimientos set monto = 1 where id = %L$x$, :'m1'), false);
select lab.probar('…ni lo borra', lab.como('ana@x.com'), format($x$delete from public.gastos_movimientos where id = %L$x$, :'m1'), false);
select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('ana@x.com', 'devuelto', '2026-09-20', 'USD', 20) returning id::text$x$) as m2 \gset
select lab.hacer(lab.como('benny@team-latam.com'), format($x$select public.gastos_movimiento_confirmar(%L)::text$x$, :'m2'));
select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto) values ('ana@x.com', 'recibido', '2026-10-01', 'USD', 1000) returning id::text$x$) as m3 \gset
select lab.probar('lo pendiente lo puede corregir la persona', lab.como('ana@x.com'), format($x$update public.gastos_movimientos set descripcion = 'Adelanto de octubre' where id = %L$x$, :'m3'), true);
select lab.comprobar('un admin anota un ajuste (un saldo inicial), ya confirmado',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.gastos_movimientos(persona, tipo, fecha, moneda, monto, estado, descripcion)
      values ('ana@x.com', 'ajuste', '2026-08-31', 'USD', -50, 'confirmado', 'Saldo inicial') returning estado || '/' || confirmado_por$x$)$q$, 'confirmado/benny@team-latam.com');
select lab.comprobar('otra persona no ve los movimientos de Ana', $q$select lab.hacer(lab.como('diego@x.com'), $x$select count(*)::text from public.gastos_movimientos$x$)$q$, '0');

-- ---------- La cuenta corriente: los números ----------
-- Ana: gastos aprobados de su bolsillo: USD 100 (hotel) + USD 17,50 (el taxi
-- de MXN 350, rendido a mano en dólares) y MXN 200 (el almuerzo, sin
-- rendir en dólares). El pasaje de USD 50 lo pagó la organización: no entra.
-- Movimientos confirmados: recibió 500, devolvió 20, ajuste −50. El pedido
-- de 1000 sigue pendiente. Saldo USD: 117,50 + 20 − 50 − 500 = −412,50 (Ana
-- debe); MXN: 200 a su favor.
select lab.comprobar('lo gastado en dólares: solo lo de su bolsillo, con el monto rendido',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'USD' ->> 'gastado'$x$)$q$, '117.50');
select lab.comprobar('el saldo en dólares (gastado + devuelto + ajuste − recibido)',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'USD' ->> 'saldo'$x$)$q$, '-412.50');
select lab.comprobar('lo pendiente se muestra aparte y no cuenta',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'USD' ->> 'pendiente'$x$)$q$, '-1000.00');
select lab.comprobar('lo que no se rindió en dólares queda en su moneda',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'MXN' ->> 'saldo'$x$)$q$, '200.00');
select lab.comprobar('el total rápido no mueve la cuenta (sigue sin pesos de más)',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'MXN' ->> 'gastado'$x$)$q$, '200.00');
select lab.comprobar('una rendición mandada y sin aprobar aparece «en revisión», no gastada',
  $q$select lab.hacer(lab.como('diego@x.com'), $x$select (public.gastos_cuenta('diego@x.com') -> 'USD' ->> 'en_revision') || '/' || (public.gastos_cuenta('diego@x.com') -> 'USD' ->> 'gastado')$x$)$q$, '30.00/0');
select lab.comprobar('una persona no pide la cuenta de otra',
  $q$select lab.rechaza(lab.como('diego@x.com'), $x$select public.gastos_cuenta('ana@x.com')::text$x$)$q$, 'true');
select lab.comprobar('un admin ve la de cualquiera',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select public.gastos_cuenta('ana@x.com') -> 'USD' ->> 'saldo'$x$)$q$, '-412.50');

-- ---------- Sin vincular ----------
select lab.hacer(lab.como('ana@x.com'), $x$insert into public.gastos(fecha, concepto, tipo, moneda, monto) values ('2026-10-02', 'Taxi', 'transporte', 'USD', 9) returning id::text$x$) as g5 \gset
select lab.comprobar('un gasto se puede cargar sin vincular (la actividad todavía no está)', $q$select coalesce(rendicion_id::text, 'sin vincular') from public.gastos where id = '$q$ || :'g5' || $q$'$q$, 'sin vincular');
select lab.hacer(lab.como('ana@x.com'), $x$select public.gastos_rendicion_abrir(null, '2026-10-02')::text$x$) as ra_oct \gset
select lab.probar('…y se vincula después a una rendición suya abierta', lab.como('ana@x.com'),
  format($x$update public.gastos set rendicion_id = %L where id = %L$x$, :'ra_oct', :'g5'), true);
select lab.probar('…pero no a una ya aprobada', lab.como('ana@x.com'), format($x$update public.gastos set rendicion_id = %L where id = %L$x$, :'ra', :'g5'), false);

-- ---------- Los comprobantes en el bucket ----------
select lab.probar('sube el comprobante a la carpeta de un gasto suyo que todavía se corrige', lab.como('ana@x.com'),
  format($x$insert into storage.objects(bucket_id, name) values ('adjuntos', 'gastos/%s/ticket.pdf')$x$, :'g5'), true);
select lab.probar('…no a la de un gasto de otra persona', lab.como('ana@x.com'),
  format($x$insert into storage.objects(bucket_id, name) values ('adjuntos', 'gastos/%s/ticket.pdf')$x$, :'gd'), false);
select lab.probar('…ni a la de un gasto ya aprobado', lab.como('ana@x.com'),
  format($x$insert into storage.objects(bucket_id, name) values ('adjuntos', 'gastos/%s/ticket.pdf')$x$, :'g1'), false);
select lab.probar('…ni a una subcarpeta', lab.como('ana@x.com'),
  format($x$insert into storage.objects(bucket_id, name) values ('adjuntos', 'gastos/%s/otra/ticket.pdf')$x$, :'g5'), false);
select lab.probar('…ni a la carpeta de los gastos sin un gasto', lab.como('ana@x.com'),
  $x$insert into storage.objects(bucket_id, name) values ('adjuntos', 'gastos/suelto.pdf')$x$, false);
insert into storage.objects (bucket_id, name, created_at) values
  ('adjuntos', 'gastos/' || :'g5' || '/ticket.pdf', now() - interval '10 days'),
  ('adjuntos', 'gastos/' || :'g5' || '/viejo.pdf', now() - interval '10 days'),
  ('adjuntos', 'gastos/' || :'gd' || '/cena.pdf', now() - interval '10 days'),
  ('adjuntos', 'posts/p1/img0_1.jpg', now() - interval '10 days');
update public.gastos set archivo = 'gastos/' || id || '/ticket.pdf' where id = :'g5';
update public.gastos set archivo = 'gastos/' || id || '/cena.pdf' where id = :'gd';
select lab.comprobar('ve su comprobante', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from storage.objects where name like 'gastos/%'$x$)$q$, '2');
select lab.comprobar('no ve el de otra persona', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from storage.objects where name like '%cena.pdf'$x$)$q$, '0');
select lab.comprobar('un admin los ve todos', $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select count(*)::text from storage.objects where name like 'gastos/%'$x$)$q$, '3');
select lab.comprobar('una observadora, ninguno', $q$select lab.hacer(lab.como('olga@x.com'), $x$select count(*)::text from storage.objects where name like 'gastos/%'$x$)$q$, '0');
select lab.comprobar('las fotos de los posteos se siguen viendo como siempre', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from storage.objects where name like 'posts/%'$x$)$q$, '1');
select lab.comprobar('alguien sin sesión pregunta por un comprobante y recibe un «no», no un error',
  $q$select public.gastos_archivo_visible('gastos/' || '$q$ || :'g5' || $q$' || '/ticket.pdf')::text$q$, 'false');
select lab.probar_valor_servicio('la limpieza del bucket NO toma como sobrante un comprobante en uso', 'select 1',
  $q$select case when (public.limpieza_del_bucket() -> 'huerfanos') ? ('gastos/' || '$q$ || :'g5' || $q$' || '/ticket.pdf') then 'sobra' else 'no' end$q$, 'no');
select lab.probar_valor_servicio('…pero sí uno que ningún gasto nombra', 'select 1',
  $q$select case when (public.limpieza_del_bucket() -> 'huerfanos') ? ('gastos/' || '$q$ || :'g5' || $q$' || '/viejo.pdf') then 'sobra' else 'no' end$q$, 'sobra');

-- ---------- La llave de servicio (una restauración) escribe tal cual ----------
select lab.probar_valor_servicio('una copia restaurada trae los gastos con su estado y su autor',
  $q$insert into public.gastos(id, autor, concepto, estado, fecha, tipo, creado_el) values ('00000000-0000-0000-0000-000000000001', 'ana@x.com', 'Restaurado', 'aprobado', '2026-01-01', 'comida', '2026-01-02')$q$,
  $q$select estado || '/' || autor || '/' || creado_el::date from public.gastos where id = '00000000-0000-0000-0000-000000000001'$q$, 'aprobado/ana@x.com/2026-01-02');

-- ---------- La configuración del módulo (Administración → Gastos) ----------
-- Un admin prende el módulo y arma los tipos; la forma la controla la base.
select lab.comprobar('un admin guarda el interruptor y los tipos',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"prendido": true, "abierto": false, "tipos": [{"key": "comida"}, {"key": "peajes", "label": "Peajes"}, {"key": "reunion", "oculto": true}]}}')::text$x$)$q$, 'false');
select lab.comprobar('…y queda guardado tal cual',
  $q$select jsonb_array_length(value -> 'gastos' -> 'tipos')::text || '/' || (value -> 'gastos' ->> 'prendido') from public.app_config where key = 'preferences'$q$, '3/true');
select lab.comprobar('cambiar otra preferencia no tropieza con la de gastos',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"extraCities": {}}')::text$x$)$q$, 'false');
select lab.comprobar('una clave que no existe, no',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"color": "rojo"}}')::text$x$)$q$, 'true');
select lab.comprobar('el interruptor es sí o no, no un texto',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"prendido": "si"}}')::text$x$)$q$, 'true');
select lab.comprobar('los tipos son una lista',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"tipos": {"key": "comida"}}}')::text$x$)$q$, 'true');
select lab.comprobar('la clave de un tipo, en minúscula y sin espacios',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"tipos": [{"key": "Comida rica"}]}}')::text$x$)$q$, 'true');
select lab.comprobar('dos tipos con la misma clave, no',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', '{"gastos": {"tipos": [{"key": "comida"}, {"key": "comida", "label": "Otra"}]}}')::text$x$)$q$, 'true');
select lab.comprobar('un nombre de más de 60 letras, no',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', jsonb_build_object('gastos', jsonb_build_object('tipos', jsonb_build_array(jsonb_build_object('key', 'largo', 'label', repeat('x', 61))))))::text$x$)$q$, 'true');
select lab.comprobar('más de 40 tipos, no',
  $q$select lab.rechaza(lab.como('benny@team-latam.com'), $x$select public.guardar_config('preferences', jsonb_build_object('gastos', jsonb_build_object('tipos', (select jsonb_agg(jsonb_build_object('key', 't' || i)) from generate_series(1, 41) i))))::text$x$)$q$, 'true');
select lab.comprobar('una integrante no abre los gastos para sí misma',
  $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.guardar_config('preferences', '{"gastos": {"abierto": true}}')::text$x$)$q$, 'true');
select lab.comprobar('lo rechazado no cambió nada',
  $q$select jsonb_array_length(value -> 'gastos' -> 'tipos')::text || '/' || coalesce(value -> 'gastos' ->> 'abierto', '-') from public.app_config where key = 'preferences'$q$, '3/false');

-- ---------- Cerrados de nuevo para el equipo ----------
update public.app_config set value = '{"gastos": {"abierto": false}}' where key = 'preferences';
select lab.comprobar('cerrados, la integrante deja de ver hasta lo suyo', $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.gastos$x$)$q$, '0');
select lab.comprobar('…y su cuenta', $q$select lab.rechaza(lab.como('ana@x.com'), $x$select public.gastos_cuenta('ana@x.com')::text$x$)$q$, 'true');
select lab.comprobar('el admin sigue viendo todo', $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select (count(*) > 0)::text from public.gastos$x$)$q$, 'true');

-- Limpieza, para las pruebas que vienen después.
truncate public.gastos_comentarios, public.gastos, public.gastos_rendiciones, public.gastos_movimientos cascade;
delete from public.app_config where key = 'preferences';
delete from storage.objects;

\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
