/* ======================================================================
   Las planillas de actividades: Inicio y «Todo el año» (propuesta 5-C,
   13/10/2026)

   El usuario eligió «las dos, y todo el año». Reportes ya tenía su
   «Planilla»; faltaban dos:
   - En el Inicio, un botón «Planilla» que baja lo que la solapa muestra con
     los filtros puestos (entero, no solo las 15 tarjetas pintadas). Solo
     para quien carga eventos: un observador no lo ve y la acción no hace
     nada para él (igual que la planilla de la Agenda).
   - En Administración › Copia de seguridad, «Bajar todo <año>»: las
     actividades del año, solo para el admin.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import fs from "node:fs";
import { abrirNavegador, entrar, ADMIN, PERS, BASE, post, ciudad, dia, tab, admin, irAdmin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const anio = new Date().toISOString().slice(0, 4);
// Los datos de siempre más un observador y un título que Excel tomaría por
// fórmula (celdaCsv le antepone un apóstrofo).
const datos = () => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  base.posts = base.posts.concat([post({ title: '=HYPERLINK("http://x")', d: 1, a: 1, type: "otro", scopes: [ciudad("Argentina", "Rosario")] })]);
  return base;
};

// Un CSV con punto y coma y celdas entre comillas (con "" adentro).
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
// Baja lo que dispara `hacer` y lo lee: { nombre, filas, texto }.
async function bajar(p, hacer){
  const [bajada] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }), hacer()]);
  const ruta = await bajada.path();
  const texto = fs.readFileSync(ruta, "utf8");
  return { nombre: bajada.suggestedFilename(), texto, filas: leerCsv(texto.replace(/^﻿/, "")) };
}
// Si el clic no baja nada, no hay evento de descarga.
async function noBaja(p, selector){
  let bajo = false; const oyente = () => { bajo = true; }; p.on("download", oyente);
  await p.evaluate(sel => { const b = document.createElement("button"); b.dataset.action = sel; b.id = "falso"; document.body.appendChild(b); b.click(); b.remove(); }, selector);
  await p.waitForTimeout(500); p.off("download", oyente);
  return !bajo;
}

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };

/* ---- Inicio: quién lo ve y qué baja ---- */
for(const [quien, nombre, espera] of [[OBS, "Olga Observa", 0], [PERS[1].email, PERS[1].name, 1], [ADMIN, "Benny Rosenthal", 1]]){
  const { p } = await entrar(b, quien, nombre, { viewport: vp, lang: "es", base: datos() });
  eq(`${nombre}: ${espera ? "ve" : "no ve"} «Planilla» en el Inicio`, await p.$$eval('[data-action="feed-planilla"]', l => l.length), espera);
  if(!espera) eq(`${nombre}: la acción no baja nada`, await noBaja(p, "feed-planilla"), true);
  await p.close();
}

{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  const cuantas = await p.$eval('[data-key="pasado"] .fs-n', e => Number(e.textContent));
  const r = await bajar(p, () => p.click('[data-action="feed-planilla"]'));
  eq("«Lo que pasó»: el archivo lleva la fecha de hoy", /^actividades-\d{4}-\d{2}-\d{2}\.csv$/.test(r.nombre), true);
  eq("empieza con el BOM, para que Excel lea los acentos", r.texto.charCodeAt(0), 0xFEFF);
  eq("encabezado de la planilla", r.filas[0], ["Fecha", "Hasta", "Tipo", "Título", "Lugares", "Dónde", "Personas", "Cargó", "Estado", "Se repite"]);
  eq("una fila por cada actividad de la solapa (no solo las 15 pintadas)", r.filas.length - 1, cuantas);
  const rosario = r.filas.find(f => f[3] === "Visita a la comunidad de Rosario");
  eq("la visita a Rosario: lugar, personas, quién la cargó y estado", rosario && [rosario[4], rosario[6], rosario[7], rosario[8]], ["Rosario, Argentina", "Diego Martínez, Lucía Fernández Goldberg", "Ana Pérez", "Hecha"]);
  eq("un título que empieza con = no queda como fórmula", r.filas.some(f => f[3] === `'=HYPERLINK("http://x")`), true);

  // Con un filtro puesto, baja lo filtrado.
  await p.fill("#feedSearch", "Rosario"); await p.waitForTimeout(600);
  const filtradas = await p.$eval('[data-key="pasado"] .fs-n', e => Number(e.textContent));
  const f = await bajar(p, () => p.click('[data-action="feed-planilla"]'));
  eq("con un filtro puesto, baja solo lo filtrado", f.filas.length - 1, filtradas);
  eq("…está lo de Rosario y no lo de Quito", [f.filas.some(x => x[3] === "Visita a la comunidad de Rosario"), f.filas.some(x => x[3] === "Visita a Quito")], [true, false]);
  eq("…y hay menos que sin filtro", filtradas < cuantas, true);

  // «Próximos»: otra solapa, otro archivo, y lo planificado figura como tal.
  await p.fill("#feedSearch", ""); await p.waitForTimeout(600);
  await p.click('[data-action="feed-solapa"][data-key="futuro"]'); await p.waitForTimeout(400);
  const proximas = await p.$eval('[data-key="futuro"] .fs-n', e => Number(e.textContent));
  const pr = await bajar(p, () => p.click('[data-action="feed-planilla"]'));
  eq("«Próximos»: el archivo lo dice", /^actividades-proximas-\d{4}-\d{2}-\d{2}\.csv$/.test(pr.nombre), true);
  eq("«Próximos»: una fila por cada una", pr.filas.length - 1, proximas);
  eq("«Próximos»: figuran como planificadas, y lo cancelado como cancelado", [...new Set(pr.filas.slice(1).map(x => x[8]))].sort(), ["Cancelada", "Planificada"]);
  await p.close();
}

/* ---- Administración: todo el año ---- */
{
  const esperado = new Set(datos().posts
    .filter(x => x.start_date <= `${anio}-12-31` && (x.end_date || x.start_date) >= `${anio}-01-01`)
    .map(x => x.title.startsWith("=") ? "'" + x.title : x.title));
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await irAdmin(p); await admin(p, "preferencias", "copia");
  eq("el admin ve «Bajar todo <año>»", await p.$eval('[data-action="anio-planilla"]', e => e.textContent.trim()), `⬇ Bajar todo ${anio}`);
  const r = await bajar(p, () => p.click('[data-action="anio-planilla"]'));
  eq("el archivo lleva el año", r.nombre, `registro-${anio}.csv`);
  const titulos = new Set(r.filas.slice(1).map(f => f[3]));
  eq("están las actividades del año y solo ésas", [...titulos].sort(), [...esperado].sort());
  eq("las filas van de la más vieja a la más nueva", r.filas.slice(1).map(f => f[0]).every((d, i, l) => i === 0 || l[i - 1] <= d), true);
  const fechas = r.filas.slice(1).map(f => f[0]);
  eq("ninguna empieza en otro año salvo que cruce el límite", fechas.every(d => d.slice(0, 4) === anio || d.slice(0, 4) === String(Number(anio) - 1)), true);
  await p.close();
}
// Un integrante que no es admin no tiene el botón, y la acción no hace nada.
{
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { viewport: vp, lang: "es", base: datos() });
  eq("un integrante no baja el año", await noBaja(p, "anio-planilla"), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
