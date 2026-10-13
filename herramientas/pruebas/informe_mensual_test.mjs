/* ======================================================================
   El informe mensual: el enlace del correo (?informe=2026-09), que vale 48
   horas, y el informe en pantalla (13/10/2026, propuesta 3-A)

   El correo no lleva números: trae un botón a la app. Al abrirlo la app le
   pregunta a la base si el enlace de ese mes sigue valiendo para esa cuenta
   (informe_vigente, 23-informe-mensual.sql) y recién ahí muestra el informe,
   con las diapositivas del modo presentación para el mes completo:
   - vale: se abre el informe (también para un observador), con los números del mes
     contra el anterior, los países, los tipos, los últimos 12 meses y el aviso de
     cuándo vence; se puede imprimir y bajar la planilla del mes;
   - venció (más de 48 horas), nunca salió, o no es para esa persona: un aviso y la
     app de siempre; si la base no contesta, otro aviso;
   - un mes mal escrito no hace nada ni le pregunta a la base.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, pais, hace } from "./app_de_mentira.mjs";
import { abrirZip, leerHoja } from "./xlsx_lector.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const JEFE = "jefe@team-latam.com";
// El mes que terminó, y el de antes, y el que sigue: las fechas fijas para que no dependan del día de hoy.
const hoy = new Date().toISOString().slice(0, 7) + "-01";
const mesDe = (iso, n) => { const d = new Date(Date.parse(iso + "T12:00:00Z")); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const MES = mesDe(hoy, -1), ANTES = mesDe(hoy, -2), DESPUES = mesDe(hoy, 0);
const datos = ({ marca = hace(1 / 24), observador = true } = {}) => {
  const base = BASE();
  base.members = base.members.concat([{ email: JEFE, name: "Jefa Mirón", nickname: "jefa", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  base.posts = [
    post({ id: "a", title: "Reunión en Santiago", start: `${MES}-05`, a: 0, type: "visita", scopes: [ciudad("Chile", "Santiago")] }),
    post({ id: "b", title: "Charla en Chile", start: `${MES}-12`, a: 1, type: "curso", scopes: [pais("Chile")] }),
    post({ id: "c", title: "Visita a Rosario", start: `${MES}-20`, a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")] }),
    post({ id: "d", title: "Cosa del mes de antes", start: `${ANTES}-10`, a: 2, type: "visita", scopes: [pais("Uruguay")] }),
    post({ id: "e", title: "Cancelada del mes", start: `${MES}-15`, a: 1, type: "curso", scopes: [pais("Chile")], extra: { cancelled: true } }),
    post({ id: "f", title: "Algo de este mes", start: `${DESPUES}-02`, a: 1, type: "curso", scopes: [pais("Chile")] }),
  ];
  base.replies = [];
  if(marca) base.informe_marcas = [{ mes: MES, email: ADMIN, enviado_el: marca }, { mes: MES, email: JEFE, enviado_el: marca }];
  return base;
};
const vp = { width: 1280, height: 800 };
const enlace = (mes = MES) => `?informe=${mes}`;
const llamadas = p => p.evaluate(() => window.__sb.rpc.filter(r => r[0] === "informe_vigente"));
const abierto = p => p.evaluate(() => { const o = document.getElementById("presOverlay"); return !!o && !o.hidden; });
const aviso = p => p.evaluate(() => { const o = document.getElementById("confirmOverlay"); return o && !o.hidden ? o.textContent.replace(/\s+/g, " ").trim() : ""; });

const b = await abrirNavegador();

/* ---- Vale: se abre el informe ---- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos(), query: enlace() });
  eq("el enlace del correo abre el informe en pantalla completa", await p.waitForFunction(() => { const o = document.getElementById("presOverlay"); return o && !o.hidden; }, null, { timeout: 5000 }).then(() => true, () => false), true);
  eq("le preguntó a la base una vez, por ese mes", (await llamadas(p)).map(r => r[1]), [{ p_mes: MES }]);
  eq("y la dirección quedó limpia", await p.evaluate(() => location.search), "");
  eq("la portada: «Informe de <mes> de <año>», con el período del mes entero",
     await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), document.querySelector("#presEscena .ps-sub").textContent.trim()]).then(([t, s]) => [new RegExp("^Informe de [a-záéíóúñ]+ de " + MES.slice(0, 4) + "$").test(t), s.length > 5]), [true, true]);
  eq("los cuatro números del mes: 3 hechas (la cancelada y las de otros meses no), 2 países, 2 ciudades, 2 personas",
     await p.$$eval("#presEscena .ps-nums b", l => l.map(x => x.textContent)), ["3", "2", "2", "2"]);
  eq("contra el mes anterior (que tuvo 1): 2 más", await p.$eval("#presEscena .ps-cmp", e => /2 más que el mes anterior/.test(e.textContent) && e.classList.contains("sube")), true);
  eq("y dice hasta cuándo vale el enlace", await p.$eval("#presEscena .ps-nota", e => /vence/.test(e.textContent)), true);
  await p.keyboard.press("ArrowRight");
  eq("la siguiente: los países del mes", await p.$$eval("#presEscena .ps-barras li", l => l.map(li => li.querySelector(".ps-et").textContent.trim() + ":" + li.querySelector("b").textContent).sort()), ["Argentina:1", "Chile:2"]);
  await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
  eq("«Mes a mes»: los últimos 12 meses, y el del informe, el último, con sus 3", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), document.querySelectorAll("#presEscena .ps-col").length, [...document.querySelectorAll("#presEscena .ps-col b")].pop().textContent]), ["Mes a mes", 12, "3"]);
  eq("tiene «Planilla» e «Imprimir / PDF»", await p.evaluate(() => [!document.getElementById("presPlanilla").hidden, document.getElementById("presPlanilla").textContent.trim(), document.getElementById("presImprimir").textContent.trim()]), [true, "⬇ Planilla", "🖨 Imprimir / PDF"]);
  // La planilla del mes: lo que cayó en ese mes (con lo cancelado marcado), no lo de otros meses.
  const bajada = p.waitForEvent("download", { timeout: 5000 });
  await p.click("#presPlanilla");
  const d = await bajada;
  const zip = abrirZip((await import("node:fs")).readFileSync(await d.path()));
  const filas = leerHoja(zip).slice(1), titulos = filas.map(f => f[5]);
  const estado = f => f[16];
  eq("la planilla es un .xlsx llamado informe-<mes>, y trae las del mes (la cancelada marcada) y nada de otros meses",
     [d.suggestedFilename(), ["Reunión en Santiago", "Charla en Chile", "Visita a Rosario"].every(t => titulos.includes(t)), estado(filas[titulos.indexOf("Cancelada del mes")]), titulos.includes("Cosa del mes de antes"), titulos.includes("Algo de este mes")],
     [`informe-${MES}.xlsx`, true, "Cancelada", false, false]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  eq("Escape cierra el informe y queda la app", [await abierto(p), await p.$('[data-action="toggle-user-menu"]').then(x => !!x)], [false, true]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Un observador también lo ve ---- */
{
  const { p } = await entrar(b, JEFE, "Jefa Mirón", { viewport: vp, lang: "es", base: datos(), query: enlace() });
  eq("un observador, con su cuenta, ve el informe", await p.waitForFunction(() => { const o = document.getElementById("presOverlay"); return o && !o.hidden; }, null, { timeout: 5000 }).then(() => true, () => false), true);
  await p.close();
}

/* ---- En inglés ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "en", base: datos(), query: enlace() });
  await p.waitForFunction(() => { const o = document.getElementById("presOverlay"); return o && !o.hidden; }, null, { timeout: 5000 });
  eq("en inglés: el título, la comparación y el botón", await p.evaluate(() => [/ report$/.test(document.querySelector("#presEscena .ps-tit").textContent.trim()), /2 more than the previous month/.test(document.querySelector("#presEscena .ps-cmp").textContent), document.getElementById("presPlanilla").textContent.trim()]), [true, true, "⬇ Spreadsheet"]);
  await p.close();
}

/* ---- No vale ---- */
for(const [nombre, marca] of [["pasadas las 48 horas", hace(49 / 24)], ["si el correo nunca salió para ese mes", null]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos({ marca }), query: enlace() });
  await p.waitForTimeout(800);
  eq(`${nombre}: no se abre el informe y se avisa que venció, con los números siguiendo en Reportes`, [await abierto(p), /venció/.test(await aviso(p)), /Reportes/.test(await aviso(p))], [false, true, true]);
  await p.close();
}
{
  // El correo salió para otra persona: para esta cuenta no vale.
  const base = datos(); base.informe_marcas = [{ mes: MES, email: "otra@x.com", enviado_el: hace(1 / 24) }];
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base, query: enlace() });
  await p.waitForTimeout(800);
  eq("si la marca es de otra persona, para esta cuenta no vale", [await abierto(p), /venció/.test(await aviso(p))], [false, true]);
  await p.close();
}
{
  // Un día antes del límite todavía vale: hace 47 horas.
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos({ marca: hace(47 / 24) }), query: enlace() });
  eq("a las 47 horas todavía vale", await p.waitForFunction(() => { const o = document.getElementById("presOverlay"); return o && !o.hidden; }, null, { timeout: 5000 }).then(() => true, () => false), true);
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos(), query: enlace(), falla: "informeFalla" });
  await p.waitForTimeout(800);
  eq("si la base no contesta: no se abre, y se avisa que no se pudo comprobar", [await abierto(p), /No pude comprobar/.test(await aviso(p))], [false, true]);
  await p.close();
}

/* ---- Un mes mal escrito ---- */
for(const mal of ["2026-13", "septiembre", "2026-9", "../x"]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos(), query: `?informe=${encodeURIComponent(mal)}` });
  await p.waitForTimeout(500);
  eq(`?informe=${mal}: no hace nada ni le pregunta a la base`, [await abierto(p), (await llamadas(p)).length, await aviso(p)], [false, 0, ""]);
  await p.close();
}

/* ---- Al abrir el modo presentación desde Reportes no hay «Planilla» ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await p.evaluate(() => { document.querySelector('.tabs [data-view="reportes"], .bn-item[data-view="reportes"]')?.click(); });
  await p.waitForTimeout(500);
  const hay = await p.$('[data-action="reporte-presentar"]');
  if(hay){ await hay.click(); await p.waitForTimeout(300); }
  eq("el modo presentación común no trae el botón de planilla del informe", [!!hay, await p.evaluate(() => document.getElementById("presPlanilla").hidden)], [true, true]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
