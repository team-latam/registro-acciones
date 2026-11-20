/* ======================================================================
   Gastos → «Mis estadísticas» (19/11/2026; docs/rendicion-gastos/README.md,
   «Estadísticas, rol Finanzas y análisis»)

   - Cuenta solo lo propio y confirmado: un borrador no entra, ni lo de otra
     persona, ni un gasto sin fecha.
   - Cada moneda va aparte (nunca se suman) y se elige con fichas.
   - Contra el año anterior hasta la misma fecha, no contra el año entero.
   - Cada actividad se despliega y lleva al gasto y a la rendición.
   - Sin gastos: un vacío que explica cómo llenarlo. Y en el celular, sin
     desborde horizontal.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const hasta = async (p, f, ...a) => { for(let i = 0; i < 50; i++){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
const irEstadisticas = async p => {
  if(await p.evaluate(() => { const b = document.querySelector('#tabs button[data-view="gastos"]'); return !!(b && b.offsetParent); })) await p.click('#tabs button[data-view="gastos"]');
  else { await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); }
  await p.waitForSelector(".gastos-view");
  await p.click('[data-action="gastos-seccion"][data-key="estadisticas"]');
  await p.waitForTimeout(200);
};

const Y = new Date().getFullYear(), hoy = new Date().toISOString().slice(5, 10);
const g = (o) => ({ autor: ADMIN, rendicion_id: null, fecha: null, concepto: "", tipo: null, moneda: "USD", monto: null, rendido_moneda: "USD", rendido_monto: null,
  pago: "persona", forma_pago: null, tarjeta: null, factura: true, observaciones: "", estado: "aprobado", archivo: null, archivo_nombre: null,
  archivo_tipo: "image/jpeg", archivo_hash: null, lectura: null, creado_el: new Date().toISOString(), tocado_el: new Date().toISOString(), ...o });
const r = (o) => ({ autor: ADMIN, post_id: null, rutina_mes: null, titulo: "", estado: "aprobada", enviada_el: null, aprobada_el: null, aprobada_por: null,
  total_manual: {}, total_manual_confirmado: false, total_manual_por: null, total_manual_el: null, creada_el: new Date().toISOString(), tocada_el: new Date().toISOString(), ...o });
const base = (rendiciones, gastos) => {
  const b = BASE();
  const pref = b.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos: { prendido: true } };
  Object.assign(b, { gastos_rendiciones: rendiciones, gastos, gastos_comentarios: [], gastos_cambios: [], gastos_movimientos: [] });
  return b;
};
// El año anterior solo cuenta hasta hoy: el gasto del 31/12 queda afuera salvo que hoy sea 31/12.
const previo = 200 + (hoy >= "12-31" ? 500 : 0);
const esperadoVs = "+" + Math.round((360 / previo - 1) * 100) + "%";

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 }, celu = { width: 390, height: 844 };

const rendiciones = [
  r({ id: "re_x", post_id: "p9", titulo: "Visita a Montevideo" }),
  r({ id: "re_r", rutina_mes: `${Y}-02-01`, estado: "abierta" }),
  r({ id: "re_prev", post_id: "p1", titulo: "Visita anterior" }),
  r({ id: "re_otra", autor: PERS[1].email, post_id: "p1", titulo: "De otra persona" }),
];
const gastos = [
  g({ id: "e1", rendicion_id: "re_x", fecha: `${Y}-02-10`, concepto: "Almuerzo", tipo: "comida", monto: 40 }),
  g({ id: "e2", rendicion_id: "re_x", fecha: `${Y}-02-11`, concepto: "Hotel", tipo: "alojamiento", moneda: "UYU", monto: 12000, rendido_monto: 300 }),
  g({ id: "e3", rendicion_id: "re_x", fecha: `${Y}-03-05`, concepto: "Micro", tipo: "pasaje", moneda: "ARS", monto: 150000 }),
  g({ id: "e4", rendicion_id: "re_r", fecha: `${Y}-02-20`, concepto: "Remís", tipo: "transporte", monto: 20, estado: "confirmado" }),
  g({ id: "e5", rendicion_id: "re_r", fecha: `${Y}-02-21`, concepto: "Sin confirmar", tipo: "comida", monto: 999, estado: "borrador" }),
  g({ id: "e6", rendicion_id: "re_x", concepto: "Sin fecha", tipo: "comida", monto: 888 }),
  g({ id: "e7", rendicion_id: "re_prev", fecha: `${Y - 1}-02-10`, concepto: "Del año pasado", tipo: "comida", monto: 200 }),
  g({ id: "e8", rendicion_id: "re_prev", fecha: `${Y - 1}-12-31`, concepto: "Fin del año pasado", tipo: "comida", monto: 500 }),
  g({ id: "e9", autor: PERS[1].email, rendicion_id: "re_otra", fecha: `${Y}-02-12`, concepto: "De otra persona", tipo: "comida", monto: 777 }),
];

/* ---------------- Lo propio, y solo lo confirmado ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: base(rendiciones, gastos) });
  await irEstadisticas(p);
  eq("«Mis estadísticas» está en el menú de Gastos", await p.$$eval('[data-action="gastos-seccion"][data-key="estadisticas"]', l => l.length), 1);
  eq("arranca en el año de hoy", await textos(p, ".gxe-ctl:first-of-type .chip-toggle.active"), [String(Y)]);
  eq("gastado en dólares: lo confirmado y lo aprobado, sin el borrador, el sin fecha ni lo de otra persona", await textos(p, ".gxe-tile:nth-child(1) .gxe-v"), ["USD 360.00"]);
  eq("contra el año anterior, hasta la misma fecha", (await textos(p, ".gxe-tile:nth-child(1) .gxe-n .gx-chip"))[0], esperadoVs);
  eq("cuenta las actividades (la rutina no)", await textos(p, ".gxe-tile:nth-child(2) .gxe-v"), ["1"]);
  eq("en qué se gastó, de mayor a menor", await textos(p, ".gxe-tarjeta:nth-of-type(1) .gxe-l"), ["Alojamiento", "Comida", "Transporte"]);
  eq("mes a mes: doce meses", await p.$$eval(".gxe-meses .gxe-c", l => l.length), 12);
  eq("…y todo en un mes (febrero)", await p.$$eval(".gxe-meses .gxe-c[aria-label*='360.00']", l => l.length), 1);
  eq("dos actividades en la lista: la visita y la rutina (no la del año pasado ni la de otra persona)", await p.$$eval(".gx-grupos .gx-grupo", l => l.length), 2);
  eq("fichas de moneda: dólar y peso argentino (cada una aparte)", await textos(p, '.gxe-ctl [data-action="gastos-est-moneda"]'), ["USD", "ARS"]);
  await p.click('[data-action="gastos-est-moneda"][data-m="ARS"]'); await p.waitForTimeout(150);
  eq("en pesos, solo lo que está en pesos (sin sumar con dólares)", await textos(p, ".gxe-tile:nth-child(1) .gxe-v"), ["ARS 150,000.00"]);
  await p.click('[data-action="gastos-est-moneda"][data-m="USD"]'); await p.waitForTimeout(150);
  // Una actividad se despliega y lleva al gasto y a la rendición.
  await p.click('[data-action="gastos-est-grupo"][data-id="re_x"]'); await p.waitForTimeout(150);
  eq("la actividad se despliega con sus gastos en esa moneda", await p.$$eval('.gxe-gasto', l => l.length), 2);
  eq("…y el botón dice que está abierta", await p.$eval('[data-action="gastos-est-grupo"][data-id="re_x"]', e => e.getAttribute("aria-expanded")), "true");
  await p.click('.gxe-gasto[data-id="e1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])").catch(() => {});
  eq("tocar un gasto abre su ventana", await p.evaluate(() => !document.getElementById("gastoOverlay").hidden), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.click('[data-action="gastos-est-abrir"][data-id="re_x"]'); await p.waitForTimeout(200);
  eq("«Abrir la rendición» abre la rendición (no se queda en estadísticas)", await p.evaluate(() => !!document.querySelector(".gastos-view .gx-volver")), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Cada persona ve lo suyo ---------------- */
{
  const ana = PERS[1];
  const gs = [g({ id: "a1", autor: ana.email, rendicion_id: "re_ana", fecha: `${Y}-03-01`, concepto: "Suyo", tipo: "comida", monto: 50 }),
    g({ id: "a2", autor: ADMIN, rendicion_id: "re_x", fecha: `${Y}-03-02`, concepto: "Del admin", tipo: "comida", monto: 999 })];
  const rs = [r({ id: "re_ana", autor: ana.email, post_id: "p1", titulo: "Visita de Ana" }), r({ id: "re_x", post_id: "p9", titulo: "Del admin" })];
  const { p, errores } = await entrar(b, ana.email, ana.name, { viewport: vp, base: base(rs, gs) });
  await irEstadisticas(p);
  eq("una integrante ve solo lo suyo", await textos(p, ".gxe-tile:nth-child(1) .gxe-v"), ["USD 50.00"]);
  eq("…y solo su actividad", await textos(p, ".gx-grupos .gx-t-txt b"), ["Visita a la comunidad de Rosario"]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Sin gastos, y en el celular ---------------- */
{
  const ana = PERS[1];
  const { p, errores } = await entrar(b, ana.email, ana.name, { viewport: celu, base: base([], []) });
  await irEstadisticas(p);
  eq("sin gastos: explica cómo llenarlo, sin números en cero", (await textos(p, ".gx-nada"))[0].startsWith(`Todavía no hay gastos confirmados en ${Y}.`), true);
  eq("…y no dibuja números ni gráficos vacíos", await p.$$eval(".gxe-tile, .gxe-tarjeta", l => l.length), 0);
  await p.close();
  const { p: q, errores: e2 } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: base(rendiciones, gastos) });
  await irEstadisticas(q);
  await q.click('[data-action="gastos-est-grupo"][data-id="re_x"]'); await q.waitForTimeout(150);
  eq("en el celular, el número de cada recuadro entra en su recuadro (no se corta)", await q.evaluate(() => [...document.querySelectorAll(".gxe-tile")].every(t => { const v = t.querySelector(".gxe-v"), r = t.getBoundingClientRect(); return v.scrollWidth <= v.clientWidth + 1 && [...v.querySelectorAll("span")].every(x => x.getBoundingClientRect().right <= r.right + 1); })), true);
  eq("en el celular no hay desborde horizontal", await q.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  eq("sin errores de página", [...errores, ...e2], []);
  await q.close();
}

/* ---------------- Montos muy grandes (X20, 20/11): nada se sale ni se pisa, en compu y celular ---------------- */
{
  const grandes = [48750000.5, 1234567890.12, 9850.4, 125, 3300000, 87650, 640000.75].map((m, i) => g({ id: "gr" + i, rendicion_id: "re_x", fecha: `${Y}-0${i + 1}-05`, concepto: "Grande " + i, tipo: ["pasaje", "alojamiento", "comida"][i % 3], moneda: "USD", monto: m, rendido_monto: m }));
  for(const [nombre, vpt] of [["compu", vp], ["celular", celu]]){
    const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vpt, base: base([r({ id: "re_x", autor: ADMIN, post_id: "p9" })], grandes) });
    await irEstadisticas(p);
    eq(`${nombre}: con montos de miles de millones, cada número entra en su recuadro`, await p.evaluate(() => [...document.querySelectorAll(".gxe-tile .gx-val")].every(v => { const t = v.closest(".gxe-tile").getBoundingClientRect(), x = v.getBoundingClientRect(); return x.right <= t.right - 8 && x.left >= t.left; })), true);
    eq(`${nombre}: los montos de las barras quedan dentro de su tarjeta`, await p.evaluate(() => [...document.querySelectorAll(".gxe-fila .gx-num")].every(v => v.getBoundingClientRect().right <= v.closest(".gxe-tarjeta").getBoundingClientRect().right)), true);
    eq(`${nombre}: las etiquetas de «Mes a mes» no se pisan`, await p.evaluate(() => { const l = [...document.querySelectorAll(".gxe-c b")].map(e => e.getBoundingClientRect()).filter(r => r.width); return l.every((r, i) => !i || r.left >= l[i - 1].right - 1); }), true);
    eq(`${nombre}: sin desborde horizontal`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    eq(`${nombre}: sin errores de página`, errores, []);
    await p.close();
  }
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
