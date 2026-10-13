/* ======================================================================
   La planilla de actividades: una tabla de Excel, con ventana para elegir
   (13/10/2026; pedido del usuario sobre la propuesta 5-C)

   Pidió: que la planilla sea de verdad una TABLA, con cada dato en su columna;
   que baje todo, también el texto de los posteos; que, si hay filtros puestos, se
   pueda elegir qué sí y qué no; y que el botón sea solo la flecha ⬇, con la
   leyenda al pasar el mouse.
   - En el Inicio, el botón ⬇ abre «Bajar planilla»: qué actividades (todo el
     Registro, lo que se está filtrando, o solo la solapa), qué columnas (por
     grupos) y el formato (.xlsx o CSV). Se acuerda de lo elegido.
   - Solo para quien carga eventos: un observador no lo ve.
   - En Administración › Copia de seguridad, «Bajar todo <año>» baja un .xlsx
     con todas las columnas.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import fs from "node:fs";
import { abrirNavegador, entrar, ADMIN, PERS, BASE, post, ciudad, dia, tab, admin, irAdmin } from "./app_de_mentira.mjs";
import { abrirZip, leerHoja, leerTabla } from "./xlsx_lector.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const anio = new Date().toISOString().slice(0, 4);
const hoy = new Date().toISOString().slice(0, 10);
// Los datos de siempre más un observador y un título que Excel tomaría por fórmula.
const datos = () => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  base.posts = base.posts.concat([post({ title: '=HYPERLINK("http://x")', d: 1, a: 1, type: "otro", scopes: [ciudad("Argentina", "Rosario")], content: "Texto con ; punto y coma y \"comillas\"." })]);
  return base;
};
const TITULOS = ["Desde", "Hasta", "Año", "Mes", "Tipo", "Título", "Texto del posteo", "Países", "Ciudades", "Zonas", "Alcance", "Dónde", "Cargó", "Correo de quien cargó", "Participantes", "Cantidad de participantes", "Estado", "Proyecto", "Se repite", "Objetivos", "Objetivos logrados", "Pasos pendientes", "Pasos hechos", "Cargado el", "Enlace"];

// CSV con punto y coma y celdas entre comillas.
function leerCsv(texto){
  const filas = []; let fila = [], celda = "", dentro = false;
  for(let i = 0; i < texto.length; i++){
    const c = texto[i];
    if(dentro){ if(c === '"' && texto[i + 1] === '"'){ celda += '"'; i++; } else if(c === '"') dentro = false; else celda += c; }
    else if(c === '"') dentro = true;
    else if(c === ";"){ fila.push(celda); celda = ""; }
    else if(c === "\r" && texto[i + 1] === "\n"){ fila.push(celda); filas.push(fila); fila = []; celda = ""; i++; }
    else celda += c;
  }
  if(celda || fila.length){ fila.push(celda); filas.push(fila); }
  return filas;
}
// Baja lo que dispara `hacer` y lo lee: { nombre, filas } (de un .xlsx o de un CSV según la extensión).
async function bajar(p, hacer){
  const [bajada] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), hacer()]);
  const buffer = fs.readFileSync(await bajada.path()), nombre = bajada.suggestedFilename();
  if(nombre.endsWith(".xlsx")){ const zip = abrirZip(buffer); return { nombre, zip, filas: leerHoja(zip), tabla: leerTabla(zip) }; }
  const texto = buffer.toString("utf8");
  return { nombre, texto, filas: leerCsv(texto.replace(/^﻿/, "")) };
}
// Si el clic no baja nada ni abre nada, no hay evento de descarga ni ventana.
async function noPasaNada(p, accion){
  let bajo = false; const oyente = () => { bajo = true; }; p.on("download", oyente);
  await p.evaluate(a => { const b = document.createElement("button"); b.dataset.action = a; document.body.appendChild(b); b.click(); b.remove(); }, accion);
  await p.waitForTimeout(500); p.off("download", oyente);
  return !bajo && await p.evaluate(() => document.getElementById("planillaOverlay").hidden);
}
const abierta = p => p.evaluate(() => !document.getElementById("planillaOverlay").hidden);
const opciones = (p, accion) => p.$$eval(`#planillaBody [data-action="${accion}"]`, l => l.map(e => ({ k: e.dataset.key, on: e.classList.contains("active"), t: e.querySelector("b").textContent, d: (e.querySelector("small") || {}).textContent || "" })));
const boton = p => p.$eval('#planillaBody [data-action="planilla-bajar"]', e => ({ txt: e.textContent.trim(), off: e.disabled }));

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };
const total = datos().posts.length;

/* ---- Inicio: quién lo ve y cómo es el botón ---- */
for(const [quien, nombre, espera] of [[OBS, "Olga Observa", 0], [PERS[1].email, PERS[1].name, 1], [ADMIN, "Benny Rosenthal", 1]]){
  const { p } = await entrar(b, quien, nombre, { viewport: vp, lang: "es", base: datos() });
  eq(`${nombre}: ${espera ? "ve" : "no ve"} el botón de planilla en el Inicio`, await p.$$eval('[data-action="feed-planilla"]', l => l.length), espera);
  if(!espera) eq(`${nombre}: la acción no abre ni baja nada`, await noPasaNada(p, "feed-planilla"), true);
  if(espera) eq("el botón es solo la flecha, con la leyenda al pasar el mouse y para el lector de pantalla", await p.$eval('[data-action="feed-planilla"]', e => [e.textContent.trim(), e.title, e.getAttribute("aria-label")]), ["⬇", "Bajar planilla", "Bajar planilla"]);
  await p.close();
}

/* ---- La ventana, sin filtros ---- */
{
  const { p, errores } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  const pasadas = await p.$eval('[data-key="pasado"] .fs-n', e => Number(e.textContent));
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  eq("la ventana tiene su título y es un diálogo", await p.$eval("#planillaOverlay .modal", e => [e.getAttribute("role"), e.getAttribute("aria-modal"), document.getElementById("planillaTitle").textContent.trim()]), ["dialog", "true", "⬇ Bajar planilla"]);
  const alc = await opciones(p, "planilla-alcance");
  eq("sin filtros: «Todo el Registro» (con todo, también lo cancelado y lo que viene) y «Solo Lo que pasó»; no se ofrece «filtrando»",
    alc.map(x => [x.k, x.on, x.t, x.d.match(/^\d+/)[0]]), [["todo", true, "Todo el Registro", String(total)], ["solapa", false, "Solo «Lo que pasó»", String(pasadas)]]);
  const cols = await opciones(p, "planilla-grupo");
  eq("ocho grupos de columnas, todos marcados", [cols.map(x => x.k), cols.every(x => x.on)], [["fechas", "actividad", "texto", "lugares", "personas", "estado", "cierre", "extra"], true]);
  eq("dice cuántas columnas se bajan", await p.$eval("#planillaBody .rs-h b", e => e.textContent), "25 columnas");
  eq("el formato de fábrica es Excel", (await opciones(p, "planilla-formato")).map(x => [x.k, x.on]), [["xlsx", true], ["csv", false]]);
  eq("el foco entra a la ventana", await p.evaluate(() => document.getElementById("planillaOverlay").contains(document.activeElement)), true);

  // Bajar todo.
  const r = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("baja un .xlsx con la fecha de hoy", r.nombre, `registro-${hoy}.xlsx`);
  eq("la ventana se cierra y el foco vuelve a la flecha", [await abierta(p), await p.evaluate(() => document.activeElement && document.activeElement.dataset.action)], [false, "feed-planilla"]);
  eq("es una tabla de Excel con los 25 títulos, un rango que cubre todo y filtros", [r.filas[0], r.tabla.columnas, r.tabla.ref, r.tabla.filtro], [TITULOS, TITULOS, `A1:Y${total + 1}`, `A1:Y${total + 1}`]);
  eq("una fila por actividad: todas", [r.filas.length - 1, r.zip.crcBien], [total, true]);
  const col = n => TITULOS.indexOf(n);
  const rosario = r.filas.find(f => f && f[col("Título")] === "Visita a la comunidad de Rosario");
  eq("la visita a Rosario, cada dato en su columna: tipo, país, ciudad, zona, cargó, correo, participantes, cuántos, estado, proyecto",
    rosario && ["Tipo", "Países", "Ciudades", "Zonas", "Cargó", "Correo de quien cargó", "Participantes", "Cantidad de participantes", "Estado", "Proyecto"].map(n => rosario[col(n)]),
    ["Visita", "Argentina", "Rosario", "Sur", "Ana Pérez", PERS[1].email, "Diego Martínez; Lucía Fernández Goldberg", 2, "Hecha", "No"]);
  eq("…con el texto del posteo entero (también los saltos de línea)", rosario[col("Texto del posteo")].startsWith("Reunión con la comisión directiva") && rosario[col("Texto del posteo")].includes("\n\nQuedó pendiente la charla con los padres."), true);
  eq("…y su cierre: 3 objetivos, 2 logrados, 2 pasos pendientes y 1 hecho", ["Objetivos", "Objetivos logrados", "Pasos pendientes", "Pasos hechos"].map(n => rosario[col(n)]), [3, 2, 2, 1]);
  eq("las fechas son fechas de Excel (números con estilo de fecha), y el año y el mes, números", [typeof rosario[col("Desde")], typeof rosario[col("Año")], rosario[col("Mes")] >= 1 && rosario[col("Mes")] <= 12], ["number", "number", true]);
  eq("«Enlace» es un hipervínculo al posteo", rosario[col("Enlace")] && /^HYPERLINK\(".*\?post=[\w-]+","Abrir"\)$/.test(rosario[col("Enlace")].f), true);
  const formula = r.filas.find(f => f && f[col("Título")] === '=HYPERLINK("http://x")');
  eq("un título que empieza con = queda como texto, no como fórmula; y su texto con ; y comillas, igual", formula && [formula[col("Título")], formula[col("Texto del posteo")]], ['=HYPERLINK("http://x")', 'Texto con ; punto y coma y "comillas".']);
  eq("de la más vieja a la más nueva", r.filas.slice(1).map(f => f[0]).every((d, i, l) => i === 0 || l[i - 1] <= d), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Con un filtro puesto: se puede elegir ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  await p.fill("#feedSearch", "Rosario"); await p.waitForTimeout(600);
  const filtradas = await p.$eval('[data-key="pasado"] .fs-n', e => Number(e.textContent)) + await p.$eval('[data-key="futuro"] .fs-n', e => Number(e.textContent));
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  const alc = await opciones(p, "planilla-alcance");
  eq("con un filtro puesto aparece «Lo que estoy filtrando», marcado de fábrica, con las dos solapas juntas", alc.map(x => [x.k, x.on]), [["todo", false], ["filtradas", true], ["solapa", false]]);
  eq("…y su cuenta es la de las dos solapas con el filtro", alc[1].d.match(/^\d+/)[0], String(filtradas));
  const f = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("baja lo filtrado: el archivo lo dice, y está lo de Rosario y no lo de Quito", [f.nombre, f.filas.length - 1, f.filas.some(x => x && x[5] === "Visita a la comunidad de Rosario"), f.filas.some(x => x && x[5] === "Visita a Quito")], [`registro-filtrado-${hoy}.xlsx`, filtradas, true, false]);
  // Y se puede decidir bajar todo igual.
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  await p.click('#planillaBody [data-action="planilla-alcance"][data-key="todo"]');
  eq("elegir «Todo el Registro» marca esa y sigue ofreciendo las otras", (await opciones(p, "planilla-alcance")).map(x => [x.k, x.on]), [["todo", true], ["filtradas", false], ["solapa", false]]);
  const t = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("…y baja todo, filtro o no", [t.nombre, t.filas.length - 1], [`registro-${hoy}.xlsx`, total]);
  // La solapa «Próximos».
  await p.fill("#feedSearch", ""); await p.waitForTimeout(500);
  await p.click('[data-action="feed-solapa"][data-key="futuro"]'); await p.waitForTimeout(400);
  const proximas = await p.$eval('[data-key="futuro"] .fs-n', e => Number(e.textContent));
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  const alc2 = await opciones(p, "planilla-alcance");
  eq("sin filtros y en «Próximos»: «Solo Próximos» con su cuenta", alc2.filter(x => x.k === "solapa").map(x => [x.t, x.d.match(/^\d+/)[0]]), [["Solo «Próximos»", String(proximas)]]);
  await p.click('#planillaBody [data-action="planilla-alcance"][data-key="solapa"]');
  const pr = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("«Próximos»: una fila por cada una, y figuran como planificadas (o canceladas)", [pr.nombre, pr.filas.length - 1, [...new Set(pr.filas.slice(1).map(x => x[16]))].sort()], [`actividades-proximas-${hoy}.xlsx`, proximas, ["Cancelada", "Planificada"]]);
  await p.close();
}

/* ---- Elegir columnas y el formato; se acuerda ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  await p.click('#planillaBody [data-action="planilla-grupo"][data-key="texto"]');
  await p.click('#planillaBody [data-action="planilla-grupo"][data-key="personas"]');
  await p.click('#planillaBody [data-action="planilla-grupo"][data-key="cierre"]');
  eq("desmarcar tres grupos: quedan 5 grupos y 16 columnas", [(await opciones(p, "planilla-grupo")).filter(x => x.on).map(x => x.k), await p.$eval("#planillaBody .rs-h b", e => e.textContent)], [["fechas", "actividad", "lugares", "estado", "extra"], "16 columnas"]);
  eq("los chips son botones que dicen si están marcados (para el lector de pantalla)", await p.$$eval('#planillaBody [data-action="planilla-grupo"]', l => l.map(e => e.getAttribute("aria-pressed") + e.getAttribute("role")).slice(0, 3)), ["truecheckbox", "truecheckbox", "falsecheckbox"]);
  await p.click('#planillaBody [data-action="planilla-formato"][data-key="csv"]');
  const r = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("baja un CSV con solo las columnas elegidas, separadas, con BOM para los acentos", [r.nombre, r.texto.charCodeAt(0), r.filas[0]],
    [`registro-${hoy}.csv`, 0xFEFF, ["Desde", "Hasta", "Año", "Mes", "Tipo", "Título", "Países", "Ciudades", "Zonas", "Alcance", "Dónde", "Estado", "Proyecto", "Se repite", "Cargado el", "Enlace"].map(x => x)]);
  eq("en el CSV, un título que empieza con = lleva un apóstrofo delante", r.filas.some(f => f[5] === `'=HYPERLINK("http://x")`), true);
  // Lo elegido se recuerda.
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  eq("al volver a abrir, se acuerda de las columnas y del formato", [(await opciones(p, "planilla-grupo")).filter(x => !x.on).map(x => x.k), (await opciones(p, "planilla-formato")).find(x => x.on).k], [["texto", "personas", "cierre"], "csv"]);
  // Sin ninguna columna, no se puede bajar.
  for(const g of ["fechas", "actividad", "lugares", "estado", "extra"]) await p.click(`#planillaBody [data-action="planilla-grupo"][data-key="${g}"]`);
  eq("sin ninguna columna: el botón de bajar se apaga y lo explica", [(await boton(p)).off, await p.$eval("#planillaBody .form-error", e => e.textContent.trim())], [true, "Marcá al menos un grupo de columnas."]);
  // Escape y Cancelar.
  await p.keyboard.press("Escape");
  eq("Escape cierra la ventana y el foco vuelve a la flecha", [await abierta(p), await p.evaluate(() => document.activeElement && document.activeElement.dataset.action)], [false, "feed-planilla"]);
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  await p.click('#planillaBody [data-action="planilla-cerrar"]');
  eq("Cancelar también la cierra", await abierta(p), false);
  await p.close();
}

/* ---- En hebreo y en el celular ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: { width: 390, height: 800 }, lang: "he", base: datos() });
  eq("en hebreo la leyenda del botón está traducida", await p.$eval('[data-action="feed-planilla"]', e => [e.textContent.trim(), e.title]), ["⬇", "הורדת גיליון"]);
  await p.click('[data-action="feed-planilla"]'); await p.waitForSelector("#planillaOverlay:not([hidden])");
  eq("en el celular la ventana entra en la pantalla y no se corre de costado", await p.evaluate(() => { const m = document.querySelector("#planillaOverlay .modal").getBoundingClientRect(); return [m.left >= 0 && m.right <= innerWidth + 1, document.documentElement.scrollWidth <= innerWidth + 1]; }), [true, true]);
  const r = await bajar(p, () => p.click('[data-action="planilla-bajar"]'));
  eq("en hebreo, el .xlsx se abre de derecha a izquierda y los títulos están en hebreo", [/rightToLeft="1"/.test(r.zip.archivos["xl/worksheets/sheet1.xml"]), r.filas[0].slice(0, 3)], [true, ["מתאריך", "עד תאריך", "שנה"]]);
  await p.close();
}

/* ---- Administración: todo el año ---- */
{
  const esperado = datos().posts
    .filter(x => x.start_date <= `${anio}-12-31` && (x.end_date || x.start_date) >= `${anio}-01-01`)
    .map(x => x.title).sort();
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await irAdmin(p); await admin(p, "preferencias", "copia");
  eq("el admin ve «Bajar todo <año>»", await p.$eval('[data-action="anio-planilla"]', e => e.textContent.trim()), `⬇ Bajar todo ${anio}`);
  const r = await bajar(p, () => p.click('[data-action="anio-planilla"]'));
  eq("el archivo lleva el año y es un .xlsx con todas las columnas", [r.nombre, r.filas[0].length], [`registro-${anio}.xlsx`, 25]);
  eq("están las actividades del año y solo ésas", r.filas.slice(1).map(f => f[5]).sort(), esperado);
  eq("de la más vieja a la más nueva", r.filas.slice(1).map(f => f[0]).every((d, i, l) => i === 0 || l[i - 1] <= d), true);
  await p.close();
}
// Un integrante que no es admin no baja el año.
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  eq("un integrante no baja el año", await noPasaNada(p, "anio-planilla"), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
