/* ======================================================================
   Gastos → Análisis (19/11/2026; docs/rendicion-gastos/README.md, «Estadísticas, rol Finanzas y análisis»)

   - Solo admins y Finanzas; con nombres. Cuenta lo confirmado en actividades (no la rutina), cada moneda aparte.
   - Por actividad y por persona, con el % contra el promedio.
   - Comparar años: al mismo corte o completos, con el cambio contra el año anterior, por tipo y por destino.
   - Para el año que viene: la tendencia, el cierre estimado, los escenarios y el presupuesto armado con la Agenda.
   - Con un solo año cargado avisa qué falta, y en el celular no se desborda.
   Los números esperados están calculados aparte, a mano, no con la misma cuenta que la pantalla.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
const irAna = async (p, sub) => {
  if(await p.evaluate(() => { const b = document.querySelector('#tabs button[data-view="gastos"]'); return !!(b && b.offsetParent); })) await p.click('#tabs button[data-view="gastos"]');
  else { await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); }
  await p.waitForSelector(".gastos-view");
  await p.click('[data-action="gastos-seccion"][data-key="analisis"]'); await p.waitForTimeout(200);
  if(sub) await sub1(p, sub);
};
const sub1 = async (p, k) => { await p.click(`[data-action="gastos-ana-set"][data-k="sub"][data-v="${k}"]`); await p.waitForTimeout(200); };
const set = async (p, k, v) => { await p.click(`[data-action="gastos-ana-set"][data-k="${k}"][data-v="${v}"]`); await p.waitForTimeout(150); };

const Y = new Date().getFullYear();
const hace = d => new Date(Date.now() - d * 86400e3).toISOString();
const FIN = { email: "fabi@x.com", name: "Fabi Finanzas", nickname: "fabi", role: "finance" };
const BENNY = ADMIN, ANA = PERS[1].email, LUCIA = PERS[3].email, DIEGO = PERS[2].email;
const g = (o) => ({ autor: ADMIN, rendicion_id: null, fecha: null, concepto: "", tipo: null, moneda: "USD", monto: null, rendido_moneda: "USD", rendido_monto: null,
  pago: "persona", forma_pago: null, tarjeta: null, factura: true, observaciones: "", estado: "aprobado", archivo: null, archivo_nombre: null,
  archivo_tipo: "image/jpeg", archivo_hash: null, lectura: null, creado_el: hace(3), tocado_el: hace(3), ...o });
const r = (o) => ({ autor: ADMIN, post_id: null, rutina_mes: null, titulo: "", estado: "aprobada", enviada_el: null, aprobada_el: hace(1), aprobada_por: ADMIN,
  total_manual: {}, total_manual_confirmado: false, total_manual_por: null, total_manual_el: null, creada_el: hace(5), tocada_el: hace(5), ...o });
let n = 0;
const trio = (rid, autor, anio, mesdia, pasaje, aloj, comida) => [["pasaje", pasaje], ["alojamiento", aloj], ["comida", comida]].map(([tipo, monto]) =>
  g({ id: "an" + (++n), autor, rendicion_id: rid, fecha: `${anio}-${mesdia}`, concepto: tipo, tipo, monto }));
const datos = ({ soloEsteAnio } = {}) => {
  const b = BASE();
  b.members = b.members.concat([{ ...FIN, approved_at: "2025-01-10T12:00:00Z" }]);
  const pref = b.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos: { prendido: true } };
  // La Agenda del año que viene: sin participantes de más, para que cada actividad cuente una persona.
  b.posts.filter(p => ["p4", "p14"].includes(p.id)).forEach(p => { p.participants = []; });
  const rs = [
    r({ id: "r_u", autor: BENNY, post_id: "p9" }), r({ id: "r_u2", autor: ANA, post_id: "p9" }), r({ id: "r_m", autor: LUCIA, post_id: "p10" }),
    r({ id: "r_rut", autor: DIEGO, rutina_mes: `${Y}-02-01` }),
  ];
  const gs = [...trio("r_u", BENNY, Y, "03-10", 300, 200, 90), ...trio("r_u2", ANA, Y, "03-10", 280, 180, 60), ...trio("r_m", LUCIA, Y, "04-10", 500, 400, 150),
    g({ id: "an_rut", autor: DIEGO, rendicion_id: "r_rut", fecha: `${Y}-02-05`, concepto: "Zoom", tipo: "suscripcion", monto: 40 })];
  if(!soloEsteAnio){
    rs.push(r({ id: "r_u25", autor: BENNY, post_id: "p9" }), r({ id: "r_m25", autor: LUCIA, post_id: "p10" }), r({ id: "r_m24", autor: LUCIA, post_id: "p10" }));
    gs.push(...trio("r_u25", BENNY, Y - 1, "03-10", 250, 160, 70), ...trio("r_m25", LUCIA, Y - 1, "04-10", 450, 360, 120),
      g({ id: "an_dic", autor: LUCIA, rendicion_id: "r_m25", fecha: `${Y - 1}-12-31`, concepto: "Cena", tipo: "comida", monto: 100 }),
      ...trio("r_m24", LUCIA, Y - 2, "04-10", 400, 300, 100));
  }
  Object.assign(b, { gastos_rendiciones: rs, gastos: gs, gastos_comentarios: [], gastos_cambios: [], gastos_movimientos: [] });
  return b;
};

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 }, celu = { width: 390, height: 844 };
const tabla = (p, i) => textos(p, `.gxe-tarjeta:first-of-type .gxe-tabla tbody tr:nth-child(${i}) td`);

/* ---------------- Por actividad y por persona ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos() });
  await irAna(p);
  eq("arranca «Por actividad», en el año de hoy", await textos(p, ".gxe-ctl .chip-toggle.active"), ["Por actividad", String(Y)]);
  eq("una fila por actividad (la rutina no), de mayor a menor", await textos(p, ".gx-grupos .gx-t-txt b"), ["Visita a Montevideo", "Visita a Ciudad de México"]);
  eq("…con el total de cada una", await textos(p, ".gx-grupos .gx-t-total"), ["USD 1,110.00", "USD 1,050.00"]);
  eq("…y cuántas personas, días y cuánto por persona", await textos(p, ".gx-grupos .gx-t-txt small"), ["2 personas · 3 días · USD 555.00 por persona", "1 persona · 5 días · USD 1,050.00 por persona"]);
  eq("…con el % contra el promedio por persona", await textos(p, ".gx-grupos .gx-t-der .gx-chip"), ["−31%", "+31%"]);
  await p.click('[data-action="gastos-ana-grupo"]'); await p.waitForTimeout(150);
  eq("abierta: qué gastó cada persona, con nombres", await textos(p, ".gxe-tabla tbody tr td:first-child"), ["Benny Rosenthal", "Ana Pérez"]);
  eq("…y su gasto por día", await textos(p, ".gxe-tabla tbody tr td:nth-child(3)"), ["USD 196.67", "USD 173.33"]);
  await sub1(p, "persona");
  eq("«Por persona»: de más a menos gasto, con nombres", await textos(p, ".gx-grupos .gx-t-txt b"), ["Lucía Fernández Goldberg", "Benny Rosenthal", "Ana Pérez"]);
  eq("…con su gasto por día", await textos(p, ".gx-grupos .gx-t-txt small"), ["1 actividad · USD 210.00 por día", "1 actividad · USD 196.67 por día", "1 actividad · USD 173.33 por día"]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Comparar años ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos() });
  await irAna(p, "anios");
  eq("tres años, al mismo corte: gastado en total y su cambio contra el año anterior", await tabla(p, 1), ["Gastado en total", "800", "1,410 +76%", "2,200 +56%"]);
  eq("…actividades y personas", [await tabla(p, 2), await tabla(p, 3)], [["Actividades", "1", "2 +100%", "2 +0%"], ["Personas que rindieron", "1", "2 +100%", "4 +100%"]]);
  eq("…costo por persona y día", await tabla(p, 5), ["Costo por persona y día", "160", "176 +10%", "196 +11%"]);
  await set(p, "corte", "false");
  eq("con los años completos, el año pasado suma lo de fin de año", (await tabla(p, 1))[2].startsWith("1,510"), true);
  eq("la moneda va una sola vez, arriba de la tabla (los números no la repiten)", (await textos(p, ".gxe-tarjeta:first-of-type .gxe-sub"))[0].startsWith("USD · "), true);
  eq("por destino: costo por persona y día, año por año", [await textos(p, ".gxe-tarjeta:last-of-type .gxe-tabla tbody tr:nth-child(1) td"), await textos(p, ".gxe-tarjeta:last-of-type .gxe-tabla tbody tr:nth-child(2) td")],
    [["México", "160", "206", "210", "+31%"], ["Uruguay", "–", "160", "185", "–"]]);
  eq("el ritmo del año se dibuja con una línea por año", await p.$$eval(".gxe-svg polyline", l => l.length), 3);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Con un solo año, avisa qué falta ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos({ soloEsteAnio: true }) });
  await irAna(p, "anios");
  eq("sin otro año, la comparación dice qué hace falta (no una tabla vacía)", [(await textos(p, ".gx-nada"))[0].startsWith("Todavía hay gastos de un solo año."), await p.$$eval(".gxe-tabla", l => l.length)], [true, 0]);
  await sub1(p, "futuro");
  eq("el año que viene avisa que sin otro año no hay tendencia, pero igual arma el presupuesto", [(await textos(p, ".gx-nada"))[0].startsWith("Para ver la tendencia hace falta al menos otro año"), await p.$$eval(".gxe-total", l => l.length)], [true, 1]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- El año que viene ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos() });
  await irAna(p, "futuro");
  const tiles = () => textos(p, ".gxe-tarjeta:first-of-type .gxe-tile .gxe-v");
  eq("la tendencia: costo por persona y día, actividades, cierre estimado y proyección", await tiles(), ["USD 196.36", "2", "USD 2,313.19", "USD 3,843.97"]);
  eq("…con lo que crece por año", await textos(p, ".gxe-tarjeta:first-of-type .gxe-tile:nth-child(-n+2) .gxe-n"), ["+11% por año", "+50% por año"]);
  await set(p, "esc", "igual");
  eq("«Igual que este año»: la proyección es el cierre", (await tiles())[3], "USD 2,313.19");
  await set(p, "esc", "mio");
  eq("«A mi manera»: +10% de actividades y +5% de precios por defecto", (await tiles())[3], "USD 2,671.74");
  eq("el costo típico por destino, de mayor a menor (y una actividad de 5 días)", [await textos(p, ".gxe-tarjeta:nth-of-type(2) .gxe-tabla tbody tr:nth-child(1) td"), await textos(p, ".gxe-tarjeta:nth-of-type(2) .gxe-tabla tbody tr:nth-child(2) td")],
    [["México", "500", "100", "30", "0", "1,050"], ["Uruguay", "290", "95", "25", "0", "795"]]);
  eq("el presupuesto sale de las actividades de la Agenda del año que viene", await textos(p, ".gxe-tarjeta:last-of-type .gxe-tabla tbody tr td:first-child"), ["Capacitación anual – Instituciones de Bolivia", "Congreso Latinoamericano"]);
  eq("…con la reserva para imprevistos del 10%", await textos(p, ".gxe-total b"), ["USD 1,617.00"]);
  await p.click('[data-action="gastos-ana-plan"][data-k="d+"][data-i="1"]'); await p.waitForTimeout(150);
  eq("sumar un día al Congreso actualiza el total", await textos(p, ".gxe-total b"), ["USD 1,754.50"]);
  await p.click('[data-action="gastos-ana-plan"][data-k="tog"][data-i="0"]'); await p.waitForTimeout(150);
  eq("destildar Bolivia la saca de la cuenta", await textos(p, ".gxe-total b"), ["USD 1,014.75"]);
  await p.click('[data-action="gastos-ana-plan"][data-k="tog"][data-i="0"]'); await p.waitForTimeout(150);
  await set(p, "prec", "tend");
  eq("con los precios de la tendencia (+11%) sube el presupuesto", await textos(p, ".gxe-total b"), ["USD 1,943.71"]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Quién lo ve, y el celular ---------------- */
{
  const { p, errores } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, base: datos() });
  await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  eq("una integrante común no tiene «Análisis»", await p.$$eval('[data-action="gastos-seccion"][data-key="analisis"]', l => l.length), 0);
  eq("sin errores de página", errores, []);
  await p.close();
  const { p: q, errores: e2 } = await entrar(b, FIN.email, FIN.name, { viewport: celu, base: datos() });
  for(const sub of ["viaje", "persona", "anios", "futuro"]){
    await irAna(q, sub);
    eq(`en el celular, «${sub}» no se desborda hacia el costado`, await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  }
  eq("sin errores de página", e2, []);
  await q.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
