/* ======================================================================
   Finanzas: el rol que gestiona los gastos de todos, y el Resumen
   (19/11/2026; docs/rendicion-gastos/README.md, «El rol nuevo: Finanzas»)

   - Entra y escribe como un integrante, no es admin (no ve Administración) y
     en Gastos ve las rendiciones de todos, aprueba las de otros y no la suya.
   - Tiene «Para aprobar» y el «Resumen»; un integrante común, ninguno de los dos.
   - El Resumen suma al equipo entero, cada moneda aparte, y no muestra
     nombres de personas.
   - Un admin puede darle el rol a alguien (Administración → Personas).
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, irAdmin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const hasta = async (p, f, ...a) => { const fin = Date.now() + 5000; while(Date.now() < fin){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
const pestanas = p => p.$$eval("#tabs button[data-view]", l => l.filter(b => !b.hidden && b.offsetParent).map(b => b.dataset.view));
const irGastos = async p => { await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200); };
const irSeccion = async (p, k) => { await p.click(`[data-action="gastos-seccion"][data-key="${k}"]`); await p.waitForTimeout(250); };
const secciones = p => p.$$eval('.admin-menu [data-action="gastos-seccion"]', l => l.map(e => e.dataset.key));
const rpcs = (p, n) => p.evaluate(n => window.__sb.rpc.filter(r => r[0] === n).map(r => r[1]), n);

const Y = new Date().getFullYear(), ahora = Date.now();
const hace = d => new Date(ahora - d * 86400e3).toISOString();
const ANA = PERS[1], DIEGO = PERS[2], FIN = { email: "fabi@x.com", name: "Fabi Finanzas", nickname: "fabi", role: "finance" };
const g = (o) => ({ autor: ADMIN, rendicion_id: null, fecha: null, concepto: "", tipo: null, moneda: "USD", monto: null, rendido_moneda: "USD", rendido_monto: null,
  pago: "persona", forma_pago: null, tarjeta: null, factura: true, observaciones: "", estado: "aprobado", archivo: null, archivo_nombre: null,
  archivo_tipo: "image/jpeg", archivo_hash: null, lectura: null, creado_el: hace(3), tocado_el: hace(3), ...o });
const r = (o) => ({ autor: ADMIN, post_id: null, rutina_mes: null, titulo: "", estado: "aprobada", enviada_el: null, aprobada_el: hace(1), aprobada_por: ADMIN,
  total_manual: {}, total_manual_confirmado: false, total_manual_por: null, total_manual_el: null, creada_el: hace(5), tocada_el: hace(5), ...o });
const datos = ({ conAbierta } = {}) => {
  const b = BASE();
  b.members = b.members.concat([{ ...FIN, approved_at: "2025-01-10T12:00:00Z" }]);
  const pref = b.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos: { prendido: true } };
  Object.assign(b, {
    gastos_rendiciones: [
      r({ id: "re_a", autor: ANA.email, post_id: "p1", estado: "enviada", enviada_el: hace(10), aprobada_el: null, aprobada_por: null }),
      r({ id: "re_d", autor: DIEGO.email, rutina_mes: `${Y}-02-01` }),
      r({ id: "re_x", post_id: "p9" }),
      r({ id: "re_f", autor: FIN.email, rutina_mes: `${Y}-03-01`, estado: "enviada", enviada_el: hace(2), aprobada_el: null, aprobada_por: null }),
      r({ id: "re_p", autor: DIEGO.email, rutina_mes: `${Y - 1}-02-01` }),
    ],
    gastos: [
      g({ id: "x1", autor: ANA.email, rendicion_id: "re_a", fecha: `${Y}-02-10`, concepto: "Hotel", tipo: "alojamiento", monto: 100, estado: "enviado" }),
      g({ id: "x2", autor: DIEGO.email, rendicion_id: "re_d", fecha: `${Y}-02-12`, concepto: "Cena", tipo: "comida", monto: 50, pago: "organizacion" }),
      g({ id: "x3", rendicion_id: "re_x", fecha: `${Y}-03-03`, concepto: "Pasaje", tipo: "pasaje", monto: 200 }),
      g({ id: "x4", autor: FIN.email, rendicion_id: "re_f", fecha: `${Y}-03-04`, concepto: "Almuerzo", tipo: "comida", monto: 25, estado: "enviado" }),
      g({ id: "x5", autor: DIEGO.email, rendicion_id: "re_p", fecha: `${Y - 1}-02-12`, concepto: "Del año pasado", tipo: "comida", monto: 300 }),
      g({ id: "x6", autor: ANA.email, rendicion_id: "re_a", fecha: `${Y}-02-11`, concepto: "Sin confirmar", tipo: "comida", monto: 999, estado: "borrador" }),
    ],
    gastos_comentarios: [], gastos_cambios: [], gastos_movimientos: [],
  });
  if(conAbierta){
    b.gastos_rendiciones.push(r({ id: "re_ab", autor: ANA.email, rutina_mes: `${Y}-05-01`, estado: "abierta", aprobada_el: null, aprobada_por: null }));
    b.gastos.push(g({ id: "x7", autor: ANA.email, rendicion_id: "re_ab", fecha: `${Y}-05-04`, concepto: "Taxi", tipo: "transporte", monto: 20, estado: "confirmado" }));
  }
  return b;
};

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };

/* ---------------- Finanzas: lo suyo y lo de todos ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos() });
  eq("entra como un integrante: las mismas pestañas, con Gastos", await pestanas(p), ["feed", "calendario", "paises", "proyectos", "gastos", "reportes"]);
  await p.click('[data-action="toggle-user-menu"]'); await p.waitForSelector(".user-menu");
  eq("…y no tiene Administración (no es admin)", await p.$$eval('.user-menu [data-view="admin"]', l => l.length), 0);
  await p.keyboard.press("Escape");
  await irGastos(p);
  eq("en Gastos: sus secciones, más «Para aprobar», «Resumen» y «Análisis»", await secciones(p), ["rendir", "rendiciones", "cuenta", "estadisticas", "aprobar", "resumen", "analisis"]);
  eq("«Para aprobar» avisa lo que ella puede aprobar (la mandada de Ana; la suya no)", await textos(p, '#tabs button[data-view="gastos"]'), ["Gastos 1"]);
  await irSeccion(p, "rendiciones");
  eq("«Rendiciones»: ve las de todo el equipo (cinco)", await p.evaluate(() => document.querySelectorAll(".gx-grupo").length), 5);

  // Para aprobar: la franja de cuánto hace que esperan y las dos rendiciones.
  await irSeccion(p, "aprobar");
  eq("«Para aprobar»: la franja cuenta cuántas esperan y hace cuánto (hasta 7 días, 8 a 30, más de 30)", await textos(p, ".gxe-franja b"), ["1", "1", "0"]);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="re_a"]'); await p.waitForTimeout(250);
  eq("la rendición de otra persona se puede aprobar", await p.evaluate(() => !!document.querySelector('[data-action="gastos-aprobar"][data-id="re_a"]')), true);
  await p.click('[data-action="gastos-aprobar"][data-id="re_a"]'); await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk");
  eq("…con la función de la base", await hasta(p, () => window.__sb.rpc.some(x => x[0] === "gastos_rendicion_aprobar")), true);
  eq("…de esa rendición", await rpcs(p, "gastos_rendicion_aprobar"), [{ p_id: "re_a" }]);
  await irSeccion(p, "aprobar");
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="re_f"]'); await p.waitForTimeout(250);
  eq("la suya no se aprueba: lo dice, sin botón «Aprobar»", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-aprobar"]'), (document.querySelector(".gx-paso b") || {}).textContent]), [false, "La aprueba otro admin o Finanzas"]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- El Resumen: números del equipo, sin nombres ---------------- */
{
  const { p, errores } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos() });
  await irGastos(p); await irSeccion(p, "resumen");
  // «Se debe» es el saldo de hoy: lo aprobado de Benny (200) y el del año pasado de Diego (300), no solo lo del año elegido.
eq("gastado, se debe, por aprobar y pagado por la organización", await textos(p, ".gxe-grandes .gxe-v"), ["USD 375.00", "USD 500.00", "USD 125.00", "USD 50.00"]);
  eq("gastado, contra el mismo período del año pasado", (await textos(p, ".gxe-grandes .gxe-tile:nth-child(1) .gxe-n .gx-chip"))[0], "+25%");
  eq("por aprobar dice cuántas esperan", (await textos(p, ".gxe-grandes .gxe-tile:nth-child(3) .gxe-n"))[0], "2 rendiciones esperando");
  eq("actividades, costo promedio, personas que rindieron y rutina", await textos(p, ".gxe-tiles:not(.gxe-grandes) .gxe-v"), ["2", "USD 150.00", "4", "USD 75.00"]);
  eq("lo que espera aprobación, por antigüedad", await textos(p, ".gxe-edades b"), ["USD 25.00", "USD 100.00", "USD 0.00"]);
  eq("por tipo, de mayor a menor", await textos(p, ".gxe-tarjeta:nth-of-type(1) .gxe-l"), ["Pasaje", "Alojamiento", "Comida"]);
  const texto = await p.evaluate(() => document.querySelector(".gastos-view .admin-body").textContent);
  eq("el Resumen no muestra nombres de personas", [ANA.name, DIEGO.name, "Benny", "Fabi"].filter(n => texto.includes(n)), []);
  await p.click('[data-action="gastos-res-anio"][data-year="' + (Y - 1) + '"]'); await p.waitForTimeout(200);
  eq("cambiando el año, cuenta solo ese año", await textos(p, ".gxe-grandes .gxe-v").then(l => l[0]), "USD 300.00");
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Quien no es gestor, no lo ve ---------------- */
{
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos() });
  await irGastos(p);
  eq("una integrante común: sin «Para aprobar» ni «Resumen»", await secciones(p), ["rendir", "rendiciones", "cuenta", "estadisticas"]);
  await irSeccion(p, "rendiciones");
  eq("…y en «Rendiciones» solo ve las suyas", await p.evaluate(() => document.querySelectorAll(".gx-grupo").length), 1);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- El correo de «te mandaron una rendición» (19/11) ---------------- */
{
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos({ conAbierta: true }) });
  const avisos = [];
  await p.route(/\/functions\/v1\/avisar/, ruta => { avisos.push(JSON.parse(ruta.request().postData() || "{}")); return ruta.fulfill({ contentType: "application/json", body: '{"enviado":true}' }); });
  await irGastos(p);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="re_ab"]'); await p.waitForTimeout(250);
  await p.click('[data-action="gastos-enviar"]'); await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk");
  eq("mandar la rendición pide el correo para quien la revisa (a quién le llega lo decide la base)", await hasta(p, () => true).then(() => p.waitForTimeout(400)).then(() => avisos), [{ tipo: "rendicion", id: "re_ab" }]);
  eq("…y la manda con la función de la base", await rpcs(p, "gastos_rendicion_enviar"), [{ p_id: "re_ab" }]);
  eq("sin errores de página", errores, []);
  await p.close();
  // «Revisar la rendición» del correo: ?rendicion=<id> la abre en «Para aprobar» para quien la gestiona.
  const { p: q, errores: e2 } = await entrar(b, FIN.email, FIN.name, { viewport: vp, base: datos(), query: "?rendicion=re_a" });
  await q.waitForSelector(".gastos-view .gx-volver", { timeout: 4000 }).catch(() => {});
  eq("el enlace del correo abre la rendición, en «Para aprobar», con «Aprobar»", await q.evaluate(() => [(document.querySelector(".gx-volver") || {}).textContent, !!document.querySelector('[data-action="gastos-aprobar"][data-id="re_a"]')]), ["← Para aprobar", true]);
  eq("…y limpia la dirección", await q.evaluate(() => location.search), "");
  await q.close();
  const { p: z, errores: e3 } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos(), query: "?rendicion=re_a" });
  await z.waitForTimeout(800);
  eq("una integrante común con ese enlace: no pasa nada (no abre rendiciones ajenas)", await z.evaluate(() => !document.querySelector(".gastos-view")), true);
  eq("sin errores de página", [...e2, ...e3], []);
  await z.close();
}

/* ---------------- Un admin le da el rol ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos() });
  await irAdmin(p);
  await p.evaluate(() => { const x = document.querySelector('[data-action="admin-go"][data-view="solicitudes"]'); x && x.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(e => { const x = document.querySelector(`.lp-row[data-action="usuario-abrir"][data-email="${e}"]`); x && x.click(); }, ANA.email);
  await p.waitForTimeout(400);
  const opciones = await p.$$eval('select.role-select[data-email="' + ANA.email + '"] option', l => l.map(o => o.value)).catch(() => null);
  eq("en Personas, el rol «Finanzas» se puede elegir", opciones && opciones.includes("finance"), true);
  await p.selectOption('select.role-select[data-email="' + ANA.email + '"]', "finance").catch(() => {});
  eq("…y se guarda como rol de esa persona", await hasta(p, e => (window.__sb.tablas.members.find(m => m.email === e) || {}).role === "finance", ANA.email), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
