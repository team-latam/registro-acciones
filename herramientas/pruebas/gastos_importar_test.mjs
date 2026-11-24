/* ======================================================================
   Importador de gastos: la pantalla (20/11/2026; docs/rendicion-gastos/README.md, «Importador»)

   - Solo un admin ve «Importar» (Finanzas y un integrante, no).
   - Se elige la planilla, se ve lo que se entendió (solapas, para cargar, dudosas, de empleados), la suma por moneda,
     los tipos y quién pagó para elegir, y las rendiciones que se crearían con el enlace propuesto a la Agenda.
   - Lo dudoso no se carga; al elegir el tipo que faltaba, entra.
   - Importar pide OK, carga todo junto, queda aprobado y a nombre del admin, y lo histórico NO crea deuda en la cuenta corriente.
   - Una tanda se deshace entera.
   Con la app de verdad y el Supabase de mentira; SheetJS (que viene de un CDN) se reemplaza por uno de mentira que devuelve
   filas inventadas. El lector en sí se prueba en gastos_importar_lector_test.mjs.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const hasta = async (p, f, ...a) => { const fin = Date.now() + 5000; while(Date.now() < fin){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
const secciones = p => p.$$eval('.admin-menu [data-action="gastos-seccion"]', l => l.map(e => e.dataset.key));
const irGastos = async p => { await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200); };
const irSeccion = async (p, k) => { await p.click(`[data-action="gastos-seccion"][data-key="${k}"]`); await p.waitForTimeout(250); };
const tiles = p => p.$$eval('.gx-imp .gxe-tiles .gxe-tile', l => l.map(e => e.querySelector('.gxe-k').textContent.trim() + ' ' + e.querySelector('.gxe-v').textContent.trim()));
const FIN = { email: "fabi@x.com", name: "Fabi Finanzas", nickname: "fabi", role: "finance" };

const T = ["Concepto", "Fecha", "Monto", "Moneda", "Tipo", "Actividad", "Cuenta", "Forma de pago", "Quién pagó", "Factura", "Observaciones"];
const SEP = [[], T,
  ["Taxi aeropuerto", "10-9-2026", 40, "USD", "Transporte", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Hotel en Montevideo", "11-9-2026", 300, "USD", "Alojamiento", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Cena", "12-9-2026", 45.5, "USD", "Comida", "Visita", "", "Efectivo", "", "Si", "Gasto por MEX 2,834.00.-"],
  ["Librería", "4-9-2026", 25, "USD", "Papelería", "Rutina", "", "Tarjeta", "", "Si", ""],
  ["Pasaje de Iván", "14-9-2026", 80, "USD", "Pasaje", "Visita", "Empleados", "Tarjeta", "ORG", "Si", ""],
  ["Sin fecha", "", 10, "USD", "Comida", "Rutina", "", "", "", "Si", ""]];
const RESUMEN = [["Total", 1]];
// El libro de movimientos de plata (inventado): lo gastado a comparar, lo recibido y un salario que NO debe entrar.
const LIBRO = [["Work Expenses and Salary"], ["Date", "Type", "Description", "Currency", "Amount", "Note"],
  ["2026-09-30", "Spent", "Septiembre", "USD", 70.5, ""],
  ["2026-09-08", "Salary", "Sueldo inventado", "USD", 4321, "no entra"],
  ["2026-10-15", "Received for expenses", "Fondos de prueba", "USD", 20, ""]];
// Dos archivos de mentira: el que empieza con «m» es el libro; el otro, la planilla de rendiciones.
const XLSX_FALSO = `window.__importarEncendido = true; window.XLSX = { read: buf => new Uint8Array(buf)[0] === 109 ? { SheetNames: ["Summary", "Transactions"], Sheets: { Summary: [["Resumen"]], Transactions: ${JSON.stringify(LIBRO)} } }
  : { SheetNames: ["SEP26", "Resumen"], Sheets: { SEP26: ${JSON.stringify(SEP)}, Resumen: ${JSON.stringify(RESUMEN)} } }, utils: { sheet_to_json: ws => ws } };`;

const datos = () => {
  const b = BASE();
  b.members = b.members.concat([{ ...FIN, approved_at: "2025-01-10T12:00:00Z" }]);
  const pref = b.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos: { prendido: true } };
  const p9 = b.posts.find(x => x.id === "p9"); p9.startDate = "2026-09-09"; p9.endDate = "2026-09-13"; p9.date = "2026-09-09";
  b.gastos_rendiciones = []; b.gastos = []; b.gastos_comentarios = []; b.gastos_cambios = []; b.gastos_movimientos = [];
  return b;
};
const b = await abrirNavegador();
const vp = { width: 1280, height: 1000 };
const elegir = async (p, libro) => { const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click('[data-action="gastos-imp-archivo"]')]); await fc.setFiles({ name: libro ? "libro.xlsx" : "gastos.xlsx", mimeType: "application/vnd.ms-excel", buffer: Buffer.from(libro ? "m" : "x") }); await p.waitForTimeout(300); };

{
  // Apagado (20/11, pedido del usuario): sin el interruptor de las pruebas, ni un admin ve «Importar».
  const { p } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos() });
  await irGastos(p);
  eq("apagado: ni un admin ve «Importar» en Gastos", (await secciones(p)).includes("importar"), false);
  await p.close();
}

{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos(), iniciar: XLSX_FALSO });
  await irGastos(p);
  eq("un admin ve «Importar» en Gastos", (await secciones(p)).includes("importar"), true);
  await irSeccion(p, "importar");
  eq("al entrar, solo el botón para elegir la planilla (nada cargado)", [(await textos(p, '[data-action="gastos-imp-archivo"]')), await p.$$('.gx-imp-rend').then(l => l.length)], [["📂 Elegir la planilla (Excel)"], 0]);
  await elegir(p);
  eq("deja la solapa «Resumen» afuera, avisando", await textos(p, ".gx-imp > .gx-suave"), ["Solapas que no son de un mes y no se leyeron: Resumen"]);
  eq("las cuentas: solapas, a cargar (los tipos que se reconocen por su nombre; «Cuenta = Empleados» no deja nada afuera), dudosas y repetidas", await tiles(p), ["Solapas leídas 1", "Para cargar 4", "Dudosas 2", "Repetidas 0"]);
  eq("dudosas: «Papelería» sin elegir y la sin fecha", await textos(p, ".gx-imp-duda li"), ["SEP26 · fila 6 Librería — Elegí a qué tipo corresponde", "SEP26 · fila 8 Sin fecha — No se entiende la fecha"]);
  // Elegir los tipos de la planilla
  await p.selectOption('select[data-gimp="tipo"][data-k="papeleria"]', "material"); await p.waitForTimeout(150);
  const tiles2 = await tiles(p);
  eq("al elegir el tipo que faltaba, esa fila entra; queda dudosa solo la sin fecha", [tiles2[1], tiles2[2]], ["Para cargar 5", "Dudosas 1"]);
  eq("la sigla «ORG» se propone como tarjeta de la organización; lo vacío no es una sigla, no aparece", await p.$$eval('select[data-gimp="pago"]', l => l.map(s => [s.dataset.k, s.value])), [["org", "organizacion"]]);
  eq("dos rendiciones: la rutina de septiembre y el viaje, con enlace propuesto a la Agenda", await textos(p, ".gx-imp-rend .gx-imp-cab b"), ["Rutina de septiembre de 2026", "Visita a Montevideo"]);
  eq("…con sus totales por moneda", await textos(p, ".gx-imp-rend .gx-imp-cab span"), ["1 gasto · USD 25.00", "4 gastos · USD 465.50"]);
  eq("«Ver los N gastos»: con uno solo, «Ver el gasto»", await textos(p, ".gx-imp-rend .gx-imp-det summary"), ["Ver el gasto", "Ver los 4 gastos"]);
  eq("…y el enlace elegido es la actividad de esa fecha", await p.$eval('select[data-gimp="rend"][data-c="postId"]', s => s.value), "p9");
  eq("septiembre cuenta en la cuenta corriente (corre desde el 1/8): no están marcadas como históricas", await p.$$eval('input[data-c="historica"]', l => l.map(i => i.checked)), [false, false]);
  for(let i = 0; i < 2; i++){ await p.locator('input[data-c="historica"]').nth(i).check(); await p.waitForTimeout(150); }
  eq("el admin las marca como históricas", await p.$$eval('input[data-c="historica"]', l => l.map(i => i.checked)), [true, true]);
  eq("la suma de lo que se carga, por moneda, para comparar con la planilla", (await textos(p, ".gx-imp-suma"))[0].startsWith("Suma de lo que se va a cargar: USD 490.50"), true);
  eq("el botón dice cuántos gastos se importan", await textos(p, '[data-action="gastos-imp-importar"]'), ["Importar 5 gastos"]);
  await p.click('[data-action="gastos-imp-importar"]'); await p.waitForSelector("#confirmOverlay:not([hidden])");
  eq("al importar pregunta con las cuentas en palabras", (await textos(p, "#confirmMessage"))[0].startsWith("¿Importar 5 gastos en 2 rendiciones y 0 movimientos de plata?"), true);
  await p.click("#confirmOk");
  await hasta(p, () => window.__sb.rpc.some(r => r[0] === "gastos_importar"));
  eq("se llama a la base una vez, con las dos rendiciones y sus gastos", await p.evaluate(() => window.__sb.rpc.filter(r => r[0] === "gastos_importar").map(r => [r[1].p_rendiciones.length, r[1].p_rendiciones.reduce((n, x) => n + x.gastos.length, 0)])), [[2, 5]]);
  eq("quedan en la base: aprobadas, a nombre del admin, históricas y con el lote", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.length === 2), true);
  eq("…con lo que corresponde", await p.evaluate(() => window.__sb.tablas.gastos_rendiciones.map(r => [r.estado, r.autor, r.historica, !!r.lote_id, r.post_id]).sort().map(String)), [["aprobada", "benny@team-latam.com", true, true, ""].toString(), ["aprobada", "benny@team-latam.com", true, true, "p9"].toString()].sort());
  eq("la cena en pesos mexicanos quedó en MXN y rendida en dólares", await p.evaluate(() => window.__sb.tablas.gastos.filter(g => g.moneda === "MXN").map(g => [g.monto, g.rendido_moneda, g.rendido_monto])), [[2834, "USD", 45.5]]);
  eq("aviso de que se cargó", (await textos(p, ".gx-imp .admin-ok"))[0].startsWith("✅ Listo. Se cargó: 2 rendiciones, 5 gastos y"), true);
  eq("aparece la tanda, para poder deshacerla", await textos(p, ".gx-imp-tanda span"), ["2 rendiciones, 5 gastos"]);
  // Lo histórico no inventa deuda
  await irSeccion(p, "cuenta");
  eq("la cuenta corriente del admin no muestra deuda ni gastado de lo importado", (await p.$$eval(".gx-cuenta-mon .gx-saldo", l => l.map(e => e.textContent.trim()))).every(x => /^0(\.00)?$/.test(x)), true);
  // Deshacer
  await irSeccion(p, "importar");
  await p.click('[data-action="gastos-imp-deshacer"]'); await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk");
  eq("deshacer borra la tanda entera: ni rendiciones ni gastos", await hasta(p, () => window.__sb.tablas.gastos.length === 0 && window.__sb.tablas.gastos_rendiciones.length === 0), true);
  eq("…y la tanda desaparece de la lista", await p.$$(".gx-imp-tanda").then(l => l.length), 0);
  eq("sin errores de página", errores, []);
  await p.close();
}

// El libro de movimientos de plata: la cuenta corriente sale de lo gastado (desde agosto) y de lo recibido
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos(), iniciar: XLSX_FALSO });
  await irGastos(p); await irSeccion(p, "importar"); await elegir(p);
  await p.selectOption('select[data-gimp="tipo"][data-k="papeleria"]', "material"); await p.waitForTimeout(150);
  await elegir(p, true);
  eq("el libro se suma a lo ya leído: siguen las rendiciones", await textos(p, ".gx-imp-rend .gx-imp-cab b"), ["Rutina de septiembre de 2026", "Visita a Montevideo"]);
  eq("lo recibido se lista; lo gastado no (solo sirve para comparar)", await textos(p, ".gx-imp-mov"), ["Recibido · 15 de oct de 2026 · Fondos de pruebaUSD 20.00"]);
  eq("el salario no se importa y se avisa, sin mostrar nada de él", await textos(p, ".gx-imp .gx-suave").then(l => l.filter(x => x.includes("salario"))), ["🔒 1 fila de salario: no se lee ni se importa."]);
  eq("…ni el monto ni la descripción del salario aparecen en la pantalla", await p.evaluate(() => /4321|Sueldo/.test(document.querySelector(".gx-imp").innerText)), false);
  eq("contra el libro: lo gastado de bolsillo (70.50) menos lo recibido (20) da lo mismo que el libro: coincide", await textos(p, ".gx-imp-conc .gx-imp-cab"), ["USD✅ coincide con el libro"]);
  eq("…con el saldo a favor", (await textos(p, ".gx-imp-conc .gx-imp-cuenta b")), ["USD 50.50", "USD 50.50"]);
  eq("el botón suma los movimientos", await textos(p, '[data-action="gastos-imp-importar"]'), ["Importar 5 gastos y 1 movimiento de plata"]);
  await p.click('[data-action="gastos-imp-importar"]'); await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk");
  eq("en la base: un movimiento recibido, confirmado, de quien importó", await hasta(p, () => window.__sb.tablas.gastos_movimientos.length === 1), true);
  eq("…con lo que corresponde, y sin nada del salario", await p.evaluate(() => [JSON.stringify(window.__sb.tablas.gastos_movimientos.map(m => [m.tipo, m.estado, m.persona, m.moneda, m.monto, m.descripcion])), JSON.stringify(window.__sb.rpc).includes("4321")]),
    [JSON.stringify([["recibido", "confirmado", "benny@team-latam.com", "USD", 20, "Fondos de prueba"]]), false]);
  await irSeccion(p, "cuenta");
  eq("la cuenta corriente del admin da lo mismo que el libro: a su favor USD 50.50", await p.$$eval(".gx-cuenta-mon .gx-saldo", l => l.map(e => e.textContent.trim())), ["50.50"]);
  await irSeccion(p, "importar");
  eq("la tanda lista cuántas rendiciones, gastos y movimientos trae", await textos(p, ".gx-imp-tanda span"), ["2 rendiciones, 5 gastos · 1 movimiento de plata"]);
  await p.click('[data-action="gastos-imp-deshacer"]'); await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk");
  eq("deshacer saca también el movimiento", await hasta(p, () => window.__sb.tablas.gastos_movimientos.length === 0 && window.__sb.tablas.gastos.length === 0), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

// Lo ya cargado no se repite
{
  const base = datos();
  base.gastos_rendiciones.push({ id: "r_viejo", autor: ADMIN, post_id: null, rutina_mes: "2026-09-01", titulo: "", estado: "aprobada", enviada_el: null, aprobada_el: null, aprobada_por: ADMIN,
    total_manual: {}, total_manual_confirmado: false, total_manual_por: null, total_manual_el: null, creada_el: "2026-09-30T00:00:00Z", tocada_el: "2026-09-30T00:00:00Z" });
  base.gastos.push({ id: "g_viejo", autor: ADMIN, rendicion_id: "r_viejo", fecha: "2026-09-10", concepto: "Taxi aeropuerto", tipo: "transporte", moneda: "USD", monto: 40, rendido_moneda: "USD", rendido_monto: 40,
    pago: "persona", forma_pago: null, tarjeta: null, factura: true, observaciones: "", estado: "aprobado", archivo: null, archivo_nombre: null, archivo_tipo: null, archivo_hash: null, lectura: null, creado_el: "2026-09-30T00:00:00Z", tocado_el: "2026-09-30T00:00:00Z" });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base, iniciar: XLSX_FALSO });
  await irGastos(p); await irSeccion(p, "importar"); await elegir(p);
  await p.selectOption('select[data-gimp="tipo"][data-k="papeleria"]', "material"); await p.waitForTimeout(150);
  eq("el taxi que ya estaba cargado queda como repetido y no se vuelve a cargar", (await tiles(p)).slice(1, 4), ["Para cargar 4", "Dudosas 1", "Repetidas 1"]);
  eq("sin errores de página", errores, []);
  await p.close();
}

// Finanzas y un integrante no ven «Importar»; tampoco pueden por la base
for(const [email, nombre] of [[FIN.email, FIN.name], [PERS[1].email, PERS[1].name]]){
  const base = datos();
  const { p, errores } = await entrar(b, email, nombre, { viewport: vp, base });
  await irGastos(p);
  eq(`${nombre}: sin «Importar» en el menú de Gastos`, (await secciones(p)).includes("importar"), false);
  eq(`${nombre}: sin errores de página`, errores, []);
  await p.close();
}

// En el celular no se desborda
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 390, height: 844 }, base: datos(), iniciar: XLSX_FALSO });
  await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); await p.waitForSelector(".gastos-view");
  await irSeccion(p, "importar"); await elegir(p);
  eq("celular: la página no se corre para el costado", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
