/* ======================================================================
   La planilla de actividades: una tabla de Excel, de un clic (13/10/2026;
   pedido del usuario sobre la propuesta 5-C)

   Pidió: que la planilla sea de verdad una TABLA, con cada dato en su columna;
   que baje todo, también el texto de los posteos; y que el botón sea solo la
   flecha ⬇, con la leyenda al pasar el mouse. Primero se hizo con una ventana
   para elegir actividades, columnas y formato; el usuario la vio y la criticó
   («poco profesional», y repite lo que ya hacen los filtros): se sacó.
   - En el Inicio, la flecha ⬇ baja un .xlsx de una, con las 25 columnas. Sin
     filtros, todo el Registro (también lo cancelado y lo que viene, que la
     columna «Estado» distingue); con filtros, lo que ellos dejan, de las dos
     solapas juntas. La leyenda dice cuántas; con filtros, un puntito; al bajar,
     un aviso. No hay ventana.
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

// Baja lo que dispara `hacer` y lo lee: { nombre, zip, filas, tabla }.
async function bajar(p, hacer){
  const [bajada] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), hacer()]);
  const buffer = fs.readFileSync(await bajada.path()), nombre = bajada.suggestedFilename();
  const zip = abrirZip(buffer);
  return { nombre, zip, filas: leerHoja(zip), tabla: leerTabla(zip) };
}
// Si el clic no baja nada, no hay evento de descarga (ni aviso).
async function noPasaNada(p, accion){
  let bajo = false; const oyente = () => { bajo = true; }; p.on("download", oyente);
  await p.evaluate(a => { const b = document.createElement("button"); b.dataset.action = a; document.body.appendChild(b); b.click(); b.remove(); }, accion);
  await p.waitForTimeout(500); p.off("download", oyente);
  return !bajo && await p.evaluate(() => document.getElementById("calendarToast").hidden);
}
const flecha = '[data-action="feed-planilla"]';
const aviso = p => p.evaluate(() => { const e = document.getElementById("calendarToast"); return e.hidden ? "" : e.textContent.replace(/\s+/g, " ").trim().replace(/ Cerrar$/, ""); });
const leyenda = p => p.$eval(flecha, e => [e.title, e.getAttribute("aria-label")]);
const hayPunto = p => p.$$eval(flecha + " .fp-punto", l => l.length);
const nDelFeed = async p => await p.$eval('[data-key="pasado"] .fs-n', e => Number(e.textContent)) + await p.$eval('[data-key="futuro"] .fs-n', e => Number(e.textContent));

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };
const total = datos().posts.length;

/* ---- Inicio: quién lo ve y cómo es el botón ---- */
for(const [quien, nombre, espera] of [[OBS, "Olga Observa", 0], [PERS[1].email, PERS[1].name, 1], [ADMIN, "Benny Rosenthal", 1]]){
  const { p } = await entrar(b, quien, nombre, { viewport: vp, lang: "es", base: datos() });
  eq(`${nombre}: ${espera ? "ve" : "no ve"} la flecha de la planilla en el Inicio`, await p.$$eval(flecha, l => l.length), espera);
  if(!espera) eq(`${nombre}: la acción no baja nada ni avisa nada`, await noPasaNada(p, "feed-planilla"), true);
  if(espera){
    eq("la flecha es un dibujo, sin texto, y su leyenda dice cuántas actividades baja", await p.$eval(flecha, e => [e.textContent.trim(), !!e.querySelector("svg"), e.title, e.getAttribute("aria-label"), e.hasAttribute("aria-haspopup")]), ["", true, `Bajar planilla: ${total} actividades`, `Bajar planilla: ${total} actividades`, false]);
    eq("sin filtros no lleva el puntito", await hayPunto(p), 0);
  }
  await p.close();
}

/* ---- Sin filtros: baja todo, de un clic ---- */
{
  const { p, errores } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  eq("no hay ventana de planilla en la página", await p.evaluate(() => [!!document.getElementById("planillaOverlay"), !!document.querySelector('[data-action^="planilla-"]')]), [false, false]);
  const r = await bajar(p, () => p.click(flecha));
  eq("un clic baja un .xlsx con la fecha de hoy", r.nombre, `registro-${hoy}.xlsx`);
  eq("el aviso dice qué se bajó y cuántas", await aviso(p), `✓ Se bajó registro-${hoy}.xlsx · ${total} actividades.`);
  eq("el foco queda en la flecha", await p.evaluate(() => document.activeElement && document.activeElement.dataset.action), "feed-planilla");
  eq("es una tabla de Excel con los 25 títulos, un rango que cubre todo y filtros", [r.filas[0], r.tabla.columnas, r.tabla.ref, r.tabla.filtro], [TITULOS, TITULOS, `A1:Y${total + 1}`, `A1:Y${total + 1}`]);
  eq("una fila por actividad: todas, también lo cancelado y lo que viene", [r.filas.length - 1, r.zip.crcBien, r.filas.slice(1).some(f => f[16] === "Cancelada"), r.filas.slice(1).some(f => f[16] === "Planificada")], [total, true, true, true]);
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
  // En «Próximos», sin filtros, baja lo mismo: todo.
  await p.click('[data-action="feed-solapa"][data-key="futuro"]'); await p.waitForTimeout(400);
  const r2 = await bajar(p, () => p.click(flecha));
  eq("en la solapa «Próximos» y sin filtros, también baja todo el Registro", [r2.nombre, r2.filas.length - 1], [`registro-${hoy}.xlsx`, total]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Con filtros: lo que ellos dejan, de las dos solapas ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  await p.fill("#feedSearch", "Rosario"); await p.waitForTimeout(700);
  const filtradas = await nDelFeed(p);
  eq("con un filtro, la leyenda dice cuántas de cuántas, y la flecha lleva el puntito", [await leyenda(p), await hayPunto(p)], [[`Bajar lo filtrado: ${filtradas} de ${total} actividades`, `Bajar lo filtrado: ${filtradas} de ${total} actividades`], 1]);
  const f = await bajar(p, () => p.click(flecha));
  eq("baja solo lo filtrado: el archivo lo dice, y está lo de Rosario y no lo de Quito", [f.nombre, f.filas.length - 1, f.filas.some(x => x && x[5] === "Visita a la comunidad de Rosario"), f.filas.some(x => x && x[5] === "Visita a Quito")], [`registro-filtrado-${hoy}.xlsx`, filtradas, true, false]);
  eq("el aviso lo repite: son las filtradas, con los filtros puestos", await aviso(p), `✓ Se bajó registro-filtrado-${hoy}.xlsx · ${filtradas === 1 ? "1 actividad" : filtradas + " actividades"}, con los filtros puestos.`);
  // Desde la otra solapa baja lo mismo (las dos juntas).
  await p.click('[data-action="feed-solapa"][data-key="futuro"]'); await p.waitForTimeout(400);
  const g = await bajar(p, () => p.click(flecha));
  eq("lo filtrado es lo mismo vista la solapa que vista", [g.nombre, g.filas.length - 1], [`registro-filtrado-${hoy}.xlsx`, filtradas]);
  // Sacar el filtro: vuelve la leyenda de siempre y se va el puntito.
  await p.fill("#feedSearch", ""); await p.waitForTimeout(700);
  eq("sin filtro otra vez: la leyenda de todo y sin puntito", [(await leyenda(p))[0], await hayPunto(p)], [`Bajar planilla: ${total} actividades`, 0]);
  await p.close();
}

/* ---- Con filtros de los de la barra (país y período, llegando desde Reportes), no solo el texto ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await tab(p, "reportes"); await p.waitForTimeout(300);
  await p.selectOption("#repAnio", anio); await p.waitForTimeout(200);
  await p.click('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]'); await p.waitForTimeout(500);
  const filtradas = await nDelFeed(p);
  eq("con país y período puestos desde Reportes, la flecha lo sabe: puntito y cuántas de cuántas", [(await leyenda(p))[0], await hayPunto(p)], [`Bajar lo filtrado: ${filtradas} de ${total} actividades`, 1]);
  const f = await bajar(p, () => p.click(flecha));
  eq("baja solo lo de Argentina: tantas como las solapas, con Rosario y sin Quito", [f.nombre, f.filas.length - 1, f.filas.some(x => x && x[5] === "Visita a la comunidad de Rosario"), f.filas.some(x => x && x[5] === "Visita a Quito")], [`registro-filtrado-${hoy}.xlsx`, filtradas, true, false]);
  await p.close();
}

/* ---- Sin resultados, un clic doble y un fallo ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  await p.fill("#feedSearch", "zzzzzz-nada"); await p.waitForTimeout(700);
  eq("con un filtro que no deja nada: la leyenda dice 0 de todas", (await leyenda(p))[0], `Bajar lo filtrado: 0 de ${total} actividades`);
  let sinBajar = true; const oyente = () => { sinBajar = false; }; p.on("download", oyente);
  await p.click(flecha); await p.waitForTimeout(500); p.off("download", oyente);
  eq("…y el clic no baja nada: avisa que no hay", [sinBajar, await aviso(p)], [true, "⚠️ No hay actividades para bajar con estos filtros."]);
  await p.fill("#feedSearch", ""); await p.waitForTimeout(700);

  // Dos clics seguidos: baja una sola vez.
  let bajadas = 0; p.on("download", () => { bajadas++; });
  await p.evaluate(sel => { const e = document.querySelector(sel); e.click(); e.click(); e.click(); }, flecha);
  await p.waitForTimeout(1500);
  eq("tres clics seguidos bajan un solo archivo", bajadas, 1);

  // Un fallo al armar el archivo: un aviso, y se puede volver a probar.
  await p.evaluate(() => { window.__crear = URL.createObjectURL; URL.createObjectURL = () => { throw new Error("sin lugar"); }; });
  await p.click(flecha);
  await p.waitForFunction(() => { const o = document.getElementById("confirmOverlay"); return o && !o.hidden; });
  eq("si falla armarlo, avisa con el motivo", await p.evaluate(() => document.getElementById("confirmOverlay").textContent.replace(/\s+/g, " ").trim().includes("No se pudo armar la planilla (sin lugar)")), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.evaluate(() => { URL.createObjectURL = window.__crear; });
  const r = await bajar(p, () => p.click(flecha));
  eq("…y después de un fallo vuelve a bajar", r.filas.length - 1, total);
  await p.close();
}

/* ---- Lo que alguien dejó guardado de la ventana de antes no cambia nada ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  await p.evaluate(() => localStorage.setItem("ra_planilla", JSON.stringify({ sin: ["texto", "personas"], formato: "csv" })));
  const r = await bajar(p, () => p.click(flecha));
  eq("con columnas y formato guardados por la ventana vieja, igual baja el .xlsx con las 25 columnas", [r.nombre, r.filas[0].length], [`registro-${hoy}.xlsx`, 25]);
  await p.close();
}

/* ---- En hebreo y en el celular ---- */
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: { width: 390, height: 800 }, lang: "he", base: datos() });
  eq("en hebreo la leyenda de la flecha está traducida", (await leyenda(p))[0].startsWith("הורדת גיליון"), true);
  eq("en el celular la flecha se ve entera y la página no se corre de costado", await p.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left >= 0 && r.right <= innerWidth + 1 && r.width >= 32, document.documentElement.scrollWidth <= window.innerWidth + 1]; }, flecha), [true, true]);
  const r = await bajar(p, () => p.click(flecha));
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
