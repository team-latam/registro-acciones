import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   Revisar el Mapeo (herramientas/mapeo.html)

   La página abre el Excel del Mapeo de comunidades, lo muestra como fichas
   y lo exporta con el mismo formato. Acá se prueba con un Excel de la
   misma estructura que el real pero con gente inventada
   (mapeo_de_prueba.xlsx, armado desde el real sin ningún nombre ni
   teléfono de verdad): las regiones, las fichas, los avisos, el guardado
   en el navegador, y sobre todo lo que exporta. Lo exportado lo revisa
   mapeo_revisar_xlsx.py con las herramientas de Python de serie, sin
   nada del código de la página: celdas combinadas, listas, formato
   condicional, fórmulas, totales, comentarios y cadenas compartidas
   tienen que seguir bien después de sumar, sacar y mover filas.

   El bloque «NUCLEO XLSX» de la página se saca entero y se corre en Node
   para los casos finos de mover referencias (moverRango).
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const PAGINA = process.env.MAPEO || path.join(RAIZ, "herramientas", "mapeo.html");
const FIXTURE = path.resolve("mapeo_de_prueba.xlsx");
const html = fs.readFileSync(PAGINA, "utf8");
const revisar = (ruta, hoja) => JSON.parse(execFileSync("python3", ["-I", "mapeo_revisar_xlsx.py", ruta, ...(hoja ? [hoja] : [])], { encoding: "utf8" }));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mapeo-"));

/* ---------- 1. El núcleo, suelto en Node ---------- */
{
  const bloque = html.slice(html.indexOf("/* ====================== NUCLEO XLSX (empieza)"), html.indexOf("/* ====================== NUCLEO XLSX (termina)"));
  eq("la página trae el bloque del núcleo entre sus dos marcas", bloque.length > 1000, true);
  const api = new Function(bloque + "\nreturn { moverRango, moverTexto, moverSqrefs, evaluarFormula, correrColumnas, leerCadenas, escribirCadenas, leerLibro, escribirLibro };")();
  // Sumar 2 filas después de la 27 (última de la región): lo que termina en 27 se estira; lo de abajo baja.
  eq("mover: rango que termina en la última fila de la región se estira", api.moverRango("D3:D27", 28, 2, 27), "D3:D29");
  eq("mover: rango entero más abajo baja", api.moverRango("A29:A67", 28, 2, 27), "A31:A69");
  eq("mover: rango que cruza la inserción se estira", api.moverRango("Z1:Z87", 28, 2, 27), "Z1:Z89");
  eq("mover: rango de arriba no se toca", api.moverRango("G2:H2", 28, 2, 27), "G2:H2");
  eq("mover: una celda sola de abajo baja", api.moverRango("J80", 28, 2, 27), "J82");
  eq("mover: con $ se respeta", api.moverRango("$A$1:$Y$87", 28, 2, 27), "$A$1:$Y$89");
  // Sacar las filas 26 y 27.
  eq("sacar: rango que termina adentro se acorta", api.moverRango("D3:D27", 26, -2), "D3:D25");
  eq("sacar: rango que estaba entero adentro desaparece", api.moverRango("X26:Y27", 26, -2), null);
  eq("sacar: rango de abajo sube", api.moverRango("A29:A67", 26, -2), "A27:A65");
  eq("sacar: rango que empieza adentro y sigue abajo arranca donde empezó lo sacado", api.moverRango("X27:Y30", 26, -2), "X26:Y28");
  eq("mover texto: una fórmula con varias referencias", api.moverTexto("SUM(D28,D68,D86)", 28, 2, 27), "SUM(D30,D70,D88)");
  eq("sqref: los rangos que desaparecen se sacan de la lista", api.moverSqrefs('<x sqref="X26:Y27 D3:E27 A29:A67"/>', 26, -2), '<x sqref="D3:E25 A27:A65"/>');
  eq("sqref vacío: el bloque entero se va", api.moverSqrefs('<conditionalFormatting sqref="X26:Y27"><cfRule/></conditionalFormatting><k/>', 26, -2), "<k/>");
  eq("SUM de un rango suma solo los números", api.evaluarFormula("SUM(D3:D5)", r => ({ D3: 10, D4: "x", D5: 2.5 })[r] ?? ""), 12.5);
  eq("SUM de varias referencias", api.evaluarFormula("SUM(D28,D68)", r => ({ D28: 1, D68: 2 })[r]), 3);
  eq("COUNTIF sin distinguir mayúsculas", api.evaluarFormula('COUNTIF(K3:K6,"si")', r => ({ K3: "SI", K4: "si", K5: "NO", K6: "" })[r]), 2);
  eq("una fórmula desconocida no se inventa", api.evaluarFormula("AVERAGE(D3:D5)", () => 1), null);
  eq("fórmula compartida: la copia corre las columnas", api.correrColumnas("SUM(D3:D27)", 1), "SUM(E3:E27)");
  eq("cadenas: se leen con entidades y runs", api.leerCadenas('<sst><si><t>a &amp; b</t></si><si><r><t>x</t></r><r><t xml:space="preserve"> y</t></r></si><si/></sst>'), ["a & b", "x y", ""]);
  eq("cadenas: se escriben escapadas", api.escribirCadenas(["a<b", "c"], 5).includes('count="5" uniqueCount="2"><si><t xml:space="preserve">a&lt;b</t></si>'), true);
  // Ida y vuelta sin tocar nada: los mismos valores, fórmulas y rangos.
  const bytes = new Uint8Array(fs.readFileSync(FIXTURE));
  const libro = await api.leerLibro(bytes);
  eq("lee el archivo de prueba: 3 regiones, 4 listas, un comentario", [libro.combinadas.filter(r => /^A\d+:A\d+$/.test(r)).length, libro.listas.length, libro.comentarios], [3, 4, [{ ref: "J80", texto: "Presidente" }]]);
}

/* ---------- 2. La página, en Chromium ---------- */
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errores = [];
p.on("pageerror", e => errores.push(String(e))); p.on("console", m => { if(m.type() === "error") errores.push(m.text()); });
await p.goto("file://" + PAGINA);
eq("sin archivo: la portada explica los tres pasos y Exportar está apagado", [await p.$$eval(".portada ol li", l => l.length), await p.$eval("#btnExportar", e => e.disabled)], [3, true]);
await p.setInputFiles("#archivo", FIXTURE);
await p.waitForSelector(".ficha");
const texto = async s => (await p.$eval(s, e => e.textContent)).replace(/\s+/g, " ").trim();
eq("abre: 81 fichas en 3 regiones, con el nombre del archivo arriba", [await p.$$eval(".ficha", l => l.length), await p.$$eval(".region", l => l.length), await texto("#nombreArchivo")], [81, 3, "mapeo_de_prueba.xlsx"]);
eq("las regiones: la primera sin nombre, NORTE y BRASIL", await p.$$eval("[data-region-etiqueta]", l => l.map(e => e.value)), ["", "NORTE", "BRASIL"]);
eq("el resumen de la región sale de las fórmulas del TOTAL", (await texto('.region[data-region="0"] .resumen')).startsWith("25 comunidades · 246.150 miembros · 355 entidades"), true);
eq("las listas desplegables son las del Excel", [await p.$eval('[data-fila="3"][data-col="F"]', e => [...e.options].map(o => o.value)), await p.$eval('[data-fila="3"][data-col="I"]', e => [...e.options].map(o => o.value))],
  [["", "Pequeña", "Mediana", "Grande"], ["", "Director Ejecutivo", "Kabat Kehila", "Contacto", "No aplica"]]);
eq("los números se muestran con puntos y los textos con fondo verde, como en el Excel", [await p.inputValue('[data-fila="3"][data-col="D"]'), await p.$eval('[data-fila="3"][data-col="B"]', e => e.classList.contains("con-valor"))], ["190.000", true]);
const contadores = async () => await texto("#contadores");
eq("contadores al abrir: nada revisado, con avisos y arreglos seguros, 0 cambios", /81 comunidades 0 revisadas \d+ con avisos 0 cambios Aplicar \d+ arreglos seguros/.test(await contadores()), true);
// Un aviso con arreglo seguro: Persona 9 (1 555 …) sin el «+», en Córdoba (fila 4, columna H).
eq("Córdoba: aviso del teléfono sin «+» con su botón Aplicar", await p.$$eval('.ficha[data-ficha="4"] [data-col="H"] .aviso', l => l.map(e => e.textContent.trim())), ["El teléfono no empieza con «+».Aplicar"]);
await p.click('[data-action="aplicar-arreglo"][data-fila="4"][data-col="H"]');
eq("aplicar: el campo cambia, queda marcado y el aviso se va", [await p.inputValue('[data-fila="4"][data-col="H"]'), await p.$eval('[data-fila="4"][data-col="H"]', e => e.classList.contains("cambiado")), await p.$$eval('.ficha[data-ficha="4"] [data-col="H"] .aviso', l => l.length)], ["Persona 9 (+1 555 171 4943)", true, 0]);
// Editar a mano: miembros con punto, un SI/NO, y marcar revisada.
await p.fill('[data-fila="5"][data-col="D"]', "1.750");
await p.selectOption('[data-fila="5"][data-col="X"]', "NO");
await p.check('[data-revisada="3"]');
eq("SI → NO con «-» al lado: no avisa nada", await p.$$eval('.ficha[data-ficha="5"] [data-col="X"] .aviso, .ficha[data-ficha="5"] [data-col="Y"] .aviso', l => l.map(e => e.textContent.trim())), []);
eq("SI sin nadie anotado al lado: avisa (Rosario, R HABTAJA)", await p.$$eval('.ficha[data-ficha="6"] .aviso', l => l.map(e => e.textContent.trim()).filter(t => /Dice SI/.test(t))), ["Dice SI en R HABTAJA pero no hay nadie anotado."]);
eq("revisada: la ficha lo muestra y el contador también", [await p.$eval('.ficha[data-ficha="3"]', e => e.classList.contains("revisada")), /1 revisada/.test(await contadores())], [true, true]);
// Sumar una comunidad en la primera región, con el foco en Ciudad.
await p.click('[data-action="sumar-fila"][data-region="0"]');
await p.waitForSelector(".ficha.nueva");
const nueva = await p.$eval(".ficha.nueva", e => e.dataset.ficha);
eq("sumar: la ficha nueva está al final de su región y el foco en Ciudad", [await p.$$eval('.region[data-region="0"] .ficha', l => l.length), await p.$eval(".ficha.nueva", e => e.parentElement.lastElementChild === e), await p.evaluate(() => document.activeElement.dataset.col)], [26, true, "B"]);
await p.fill(`[data-fila="${nueva}"][data-col="B"]`, "Ushuaia"); await p.fill(`[data-fila="${nueva}"][data-col="C"]`, "Argentina"); await p.fill(`[data-fila="${nueva}"][data-col="D"]`, "120"); await p.selectOption(`[data-fila="${nueva}"][data-col="F"]`, "Pequeña");
// Quitar dos de NORTE (Chiapas y Playa del Carmen, filas 34 y 35), con su confirmación.
for(const id of ["34", "35"]){
  p.once("dialog", d => { eq("quitar: pregunta antes, nombrando la comunidad", /¿Quitar «(Chiapas|Playa del Carmen)»/.test(d.message()), true); d.accept(); });
  await p.click(`[data-action="menu-ficha"][data-fila="${id}"]`); await p.click(`[data-action="quitar"][data-fila="${id}"]`);
  await p.waitForTimeout(100);
}
eq("quitar: NORTE tiene dos menos", await p.$$eval('.region[data-region="1"] .ficha', l => l.length), 37);
// Mover Rosario (6) arriba de Santa Fe (5), renombrar la región, sumar una en BRASIL.
await p.click('[data-action="menu-ficha"][data-fila="6"]'); await p.click('[data-action="mover"][data-fila="6"][data-d="-1"]');
eq("mover arriba: Rosario queda antes que Santa Fe", await p.$$eval('.region[data-region="0"] .ficha', l => l.slice(1, 4).map(e => e.dataset.ficha)), ["4", "6", "5"]);
await p.fill('[data-region-etiqueta="0"]', "SUR");
await p.click('[data-action="sumar-fila"][data-region="2"]');
const nueva2 = (await p.$$eval(".ficha.nueva", l => l.map(e => e.dataset.ficha))).find(id => id !== nueva);
await p.fill(`[data-fila="${nueva2}"][data-col="B"]`, "Nova"); await p.fill(`[data-fila="${nueva2}"][data-col="D"]`, "10");
eq("cambios: 2 nuevas + 2 editadas + 2 sacadas + la región renombrada", /7 cambios/.test(await contadores()), true);
// Recargar enseguida (sin darle tiempo al guardado diferido): sigue todo igual.
await p.reload(); await p.waitForSelector(".ficha");
eq("al recargar sigue todo: fichas, cambios, el valor escrito y la revisada", [await p.$$eval(".ficha", l => l.length), /7 cambios/.test(await contadores()), await p.inputValue('[data-fila="5"][data-col="D"]'), await p.$eval('.ficha[data-ficha="3"]', e => e.classList.contains("revisada")), await p.inputValue('[data-region-etiqueta="0"]')], [81, true, "1.750", true, "SUR"]);

/* ---------- 3. Lo exportado ---------- */
const [bajada] = await Promise.all([p.waitForEvent("download"), p.click("#btnExportar")]);
eq("exporta con el mismo nombre de archivo", bajada.suggestedFilename(), "mapeo_de_prueba.xlsx");
const salida = path.join(tmp, "salida.xlsx"); await bajada.saveAs(salida);
const antes = revisar(FIXTURE), despues = revisar(salida);
eq("exportado: las mismas partes adentro del zip, todas bien formadas", [despues.partes, despues.mal_formados], [antes.partes, []]);
eq("exportado: las cadenas compartidas cierran (cuentas y ningún índice roto)", [despues.indices_rotos, despues.sst_count === despues.refs_sst, despues.sst_unique === despues.cadenas], [[], true, true]);
eq("exportado: Excel recalcula al abrir", despues.calcPr, { fullCalcOnLoad: "1" });
eq("exportado: la misma cantidad de filas (+1 −2 +1) y el filtro y el nombre definido hasta la última", [despues.filas.length, despues.autoFilter, despues.nombres], [antes.filas.length, antes.autoFilter, antes.nombres]);
eq("exportado: las regiones combinadas se estiraron y se acortaron", despues.combinadas.filter(r => /^A\d+:A\d+$/.test(r)), ["A30:A66", "A3:A28", "A68:A85"]);
eq("exportado: los TOTAL combinados bajaron con todo", despues.combinadas.filter(r => /^A\d+:C\d+$/.test(r)).sort(), ["A1:C1", "A29:C29", "A67:C67", "A86:C86", "A87:C87"]);
eq("exportado: la columna del borde (Z) sigue hasta la última", despues.combinadas.find(r => r.startsWith("Z")), antes.combinadas.find(r => r.startsWith("Z")));
eq("exportado: las listas desplegables cubren las filas nuevas y no las sacadas", despues.listas.map(l => l.sqref).slice(0, 2), ["I3:I28 I30:I66 I68:I85", "F3:F28 F30:F66 F68:F85"]);
eq("exportado: el formato condicional también (la regla grande cubre cada región entera)", ["D3:E28", "D30:M66", "D68:Y85", "X26:Y28"].filter(r => despues.condicional[0].split(" ").includes(r)), ["D3:E28", "D30:M66", "D68:Y85", "X26:Y28"]);
eq("exportado: los TOTAL suman sus regiones nuevas, y el general los tres", [despues.formulas.D29.f, despues.formulas.D67.f, despues.formulas.D86.f, despues.formulas.D87.f, despues.formulas.K87.f], ["SUM(D3:D28)", "SUM(D30:D66)", "SUM(D69:D85)", "SUM(D29,D67,D86)", "SUM(K29,K67,K86)"]);
eq("exportado: la fórmula compartida de E sigue atada a la de D", [despues.formulas.E29.si, despues.formulas.E29.f], [despues.formulas.D29.si, ""]);
const suma = (col, desde, hasta) => { let s = 0; for(let f = desde; f <= hasta; f++){ const v = despues.celdas[col + f]; if(typeof v === "number") s += v; } return s; };
eq("exportado: los totales traen el número al día (sin esperar a Excel)", [Number(despues.formulas.D29.v), Number(despues.formulas.D87.v), Number(despues.formulas.X29.v)], [suma("D", 3, 28), suma("D", 3, 28) + suma("D", 30, 66) + suma("D", 69, 85), [...Array(26)].map((_, i) => despues.celdas["X" + (i + 3)]).filter(v => String(v).toLowerCase() === "si").length]);
eq("exportado: los valores en su lugar (la región, lo editado, lo movido, lo nuevo, lo corrido)", [despues.celdas.A3, despues.celdas.B5, despues.celdas.B6, despues.celdas.D6, despues.celdas.X6, despues.celdas.H4, despues.celdas.B28, despues.celdas.D28, despues.celdas.F28, despues.celdas.B30, despues.celdas.B34, despues.celdas.B35, despues.celdas.A68, despues.celdas.B68, despues.celdas.B69, despues.celdas.B84, despues.celdas.B85, despues.celdas.D85],
  ["SUR", "Rosario", "Santa Fe", 1750, "NO", "Persona 9 (+1 555 171 4943)", "Ushuaia", 120, "Pequeña", "Mexico City", "Cancun", "Cozumel", "BRASIL", "Brasil", "São Paulo", "Belém", "Nova", 10]);
eq("exportado: lo que no se tocó sigue igual (Buenos Aires entero)", [..."BCDEFGHIJKLMNOPQRSTUVWXY"].map(c => despues.celdas[c + "3"]), [..."BCDEFGHIJKLMNOPQRSTUVWXY"].map(c => antes.celdas[c + "3"]));
eq("exportado: el comentario de Natal viajó con su fila (80 → 79), también en el dibujo", [despues.comentarios, despues.celdas.B79, despues.vml], [[{ ref: "J79", texto: "Presidente" }], "Natal", [{ anchor: "10, 15, 79, 10, 14, 15, 81, 4", row: 78 }]]);
eq("exportado: la fila nueva no inventa valores en las columnas vacías", Object.keys(despues.celdas).filter(r => /^[G-Y]28$/.test(r)), []);
// Sin tocar nada, lo exportado es lo mismo que lo abierto.
{
  const q = await ctx.newPage(); await q.goto("file://" + PAGINA);
  await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.setInputFiles("#archivo", FIXTURE); await q.waitForSelector(".ficha");
  const [bajada2] = await Promise.all([q.waitForEvent("download"), q.click("#btnExportar")]);
  const igual = path.join(tmp, "igual.xlsx"); await bajada2.saveAs(igual);
  const r = revisar(igual);
  const sinV = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { ...v, v: undefined }]));
  eq("sin cambios: exporta las mismas celdas, fórmulas, rangos y comentarios", [r.celdas, sinV(r.formulas), r.combinadas, r.listas, r.condicional, r.comentarios, r.vml], [antes.celdas, sinV(antes.formulas), antes.combinadas, antes.listas, antes.condicional, antes.comentarios, antes.vml]);
  await q.close();
}
/* ---------- 4. Un Excel con dos pestañas (la copia vieja a la izquierda) ---------- */
{
  const dos = path.join(tmp, "dos_hojas.xlsx");
  execFileSync("python3", ["-I", "mapeo_dos_hojas.py", FIXTURE, dos]);
  const q = await ctx.newPage(); const erroresQ = []; q.on("pageerror", e => erroresQ.push(String(e)));
  await q.goto("file://" + PAGINA); await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.setInputFiles("#archivo", dos);
  await q.waitForSelector("#eleccionHoja");
  eq("dos pestañas: la portada pregunta cuál, con las dos, y no abre ninguna sola", [await q.$$eval("#eleccionHoja button", l => l.map(b => b.textContent)), await q.$$eval(".ficha", l => l.length)], [["Mapping viejo", "Mapping"], 0]);
  await q.click('#eleccionHoja [data-hoja="Mapping"]'); await q.waitForSelector(".ficha");
  eq("elegida la segunda: abre esa y lo dice arriba", [await q.$$eval(".ficha", l => l.length), await q.$eval("#nombreArchivo", e => e.textContent)], [81, "dos_hojas.xlsx · pestaña «Mapping»"]);
  await q.fill('[data-fila="3"][data-col="B"]', "Buenos Aires (capital)");
  await q.reload(); await q.waitForSelector(".ficha");
  eq("al recargar se acuerda de la pestaña y del cambio", [await q.$eval("#nombreArchivo", e => e.textContent), await q.inputValue('[data-fila="3"][data-col="B"]')], ["dos_hojas.xlsx · pestaña «Mapping»", "Buenos Aires (capital)"]);
  const [bajadaDos] = await Promise.all([q.waitForEvent("download"), q.click("#btnExportar")]);
  const salidaDos = path.join(tmp, "salida_dos.xlsx"); await bajadaDos.saveAs(salidaDos);
  const r = revisar(salidaDos, "xl/worksheets/sheet1.xml"), v = revisar(salidaDos, "xl/worksheets/sheet2.xml"), antesDos = revisar(dos, "xl/worksheets/sheet1.xml");
  eq("exportado con dos pestañas: la elegida cambió, la otra quedó igual, y las cadenas sirven para las dos", [r.celdas.B3, v.celdas.B3, v.celdas, r.indices_rotos, v.indices_rotos, r.sst_unique === r.cadenas, r.partes.includes("xl/worksheets/sheet2.xml")], ["Buenos Aires (capital)", "Buenos Aires", antesDos.celdas, [], [], true, true]);
  eq("sin errores de página con dos pestañas", erroresQ, []);
  await q.close();
}

/* ---------- 5. Arreglar todo lo seguro, filtros, cerrar ---------- */
const seguros = Number((await contadores()).match(/Aplicar (\d+) arreglos? seguros?/)[1]);
await p.click('[data-action="arreglar-todo"]');
eq("arreglar todo: después no queda ningún arreglo seguro y los cambios suben", [/Aplicar \d+ arreglo/.test(await contadores()), seguros > 10], [false, true]);
await p.fill("#buscar", "natal"); await p.waitForTimeout(50);
eq("buscar: filtra las fichas", await p.$$eval(".ficha", l => l.map(e => e.querySelector('[data-col="B"]').value)), ["Natal"]);
await p.fill("#buscar", ""); await p.selectOption("#fQue", "sin-revisar");
eq("filtro «sin revisar»: deja afuera la revisada", await p.$$eval('.ficha', l => l.length), 80);
await p.selectOption("#fQue", ""); await p.selectOption("#fPais", "Uruguay");
eq("filtro por país", await p.$$eval(".ficha", l => l.map(e => e.querySelector('[data-col="C"]').value).every(v => v === "Uruguay")), true);
await p.selectOption("#fPais", "");
p.once("dialog", d => d.accept());
await p.click('[data-action="empezar-de-nuevo"]');
await p.waitForSelector(".portada");
eq("cerrar el archivo: vuelve la portada y no queda archivo en el navegador", [await p.$$eval(".ficha", l => l.length), await p.evaluate(() => (JSON.parse(localStorage.getItem("mapeo-latam-revision") || "{}").base64 || null))], [0, null]);
await p.setInputFiles("#archivo", FIXTURE); await p.waitForSelector(".ficha");
eq("al volver a abrir el archivo, lo revisado se acuerda (por ciudad y país)", await p.$eval('.ficha[data-ficha="3"]', e => e.classList.contains("revisada")), true);
eq("sin errores de página en todo el recorrido", errores, []);
await b.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
