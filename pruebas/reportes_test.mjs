import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
function grab(name){
  const m = new RegExp(`\\n(?:function|async function|const|let) ${name}\\s*[=(]`).exec(src);
  if(!m) throw new Error("no se encontró " + name);
  const desde = m.index + m[0].length - 1;
  const finLinea = src.indexOf("\n", desde);
  const iLl = src.indexOf("{", desde), iCor = src.indexOf("[", desde);
  const primero = iCor >= 0 && (iLl < 0 || iCor < iLl) ? iCor : iLl;
  if(primero < 0 || primero > finLinea) return src.slice(m.index + 1, finLinea + 1);
  let depth = 0, inStr = null;
  const abre = src[primero], cierra = abre === "[" ? "]" : "}";
  for(let j = primero; j < src.length; j++){
    const c = src[j];
    if(inStr){ if(c === "\\"){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '"' || c === "'" || c === "`"){ inStr = c; continue; }
    if(c === "/" && src[j+1] === "/"){ j = src.indexOf("\n", j); continue; }
    if(c === abre) depth++;
    else if(c === cierra){ depth--; if(depth === 0) return src.slice(m.index + 1, j + 1); }
  }
  throw new Error("no cerró " + name);
}
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const codigo = ["addDaysISO","isoDate","isoDow","addMonthsISO","RRULE_MAX_STEPS","RRULE_DOW","isISODate","parseRecurrence",
  "expandRecurrence","recurrenceSkipDates","recurrenceMoves","vecesEnVentana","fechasEnVentana",
  "aniosConDatos","ventanaDe","ventanaDelReporte","ventanaAnterior","normalize","pasaFiltroDelReporte","calcularReporte","armarReporte","actividadPorPais",
  "ultimaActividadPorPais","haceCuanto","sugerenciasDelReporte"].map(grab).join("\n");

// Los 43 países de verdad no hacen falta: alcanza con unos pocos, y así
// la prueba dice qué espera sin depender de la tabla entera.
const PAISES = {
  "Perú":      { name:"Perú",      zone:"sur" },
  "Chile":     { name:"Chile",     zone:"sur" },
  "México":    { name:"México",    zone:"norte" },
  "Costa Rica":{ name:"Costa Rica",zone:"central" },
};

function armar(posts, hoy="2026-09-17"){
  const api = new Function("ctx", `
    "use strict";
    const state = ctx.state;
    const COUNTRY_BY_NAME = ctx.paises;
    const todayISO = ()=> ctx.hoy;
    const t = (es, en, pt, he, v) => { let x = String(es); for(const k in (v || {})) x = x.split("{" + k + "}").join(v[k]); return x; };
    const countryLabel = n => n;
    const ZONES = { sur:{ key:"sur", label:"Sur" }, central:{ key:"central", label:"Central" }, norte:{ key:"norte", label:"Norte" } };
    const ACTIVITY_BY_KEY = { visita:{ label:"Visita" }, curso:{ label:"Curso" } };
    const fmtISO = (iso, o) => new Date(iso + "T00:00:00Z").toLocaleDateString("es-AR", { ...o, timeZone:"UTC" });
    ${codigo}
    return { vecesEnVentana, fechasEnVentana, aniosConDatos, ventanaDelReporte,
             ventanaAnterior, armarReporte, actividadPorPais, ultimaActividadPorPais, sugerenciasDelReporte, ventanaDe, state };
  `)({ state: { posts, reportes:{ anio:"", trimestre:0 } }, paises: PAISES, hoy });
  return api;
}
const post = (extra={}) => ({
  id: extra.id || "p" + Math.random().toString(36).slice(2),
  activityType: "visita", authorEmail: "ana@x.com", scopes: [{ type:"pais", country:"Perú" }],
  date: "2026-05-10", startDate: "2026-05-10", endDate: "2026-05-10", ...extra,
});

/* ---------- Cuántas veces pasó algo ---------- */
{
  const api = armar([]);
  const v = api.vecesEnVentana;
  eq("un día suelto adentro del período cuenta una vez",
     v(post(), "2026-01-01", "2026-12-31"), 1);
  eq("afuera, ninguna", v(post(), "2027-01-01", "2027-12-31"), 0);
  eq("un congreso de tres días es UN congreso, no tres",
     v(post({ startDate:"2026-05-10", endDate:"2026-05-12" }), "2026-01-01", "2026-12-31"), 1);
  eq("y cuenta aunque solo le entre la cola en el período",
     v(post({ startDate:"2026-04-28", endDate:"2026-05-02" }), "2026-05-01", "2026-05-31"), 1);
  eq("uno cancelado no cuenta", v(post({ cancelled:true }), "2026-01-01", "2026-12-31"), 0);
  eq("uno sin fecha tampoco", v(post({ date:"", startDate:"", endDate:"" }), "2026-01-01", "2026-12-31"), 0);
}

/* ---------- Lo que se repite ---------- */
const SEMANAL = { recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO"], startDate:"2026-01-05", endDate:"2026-01-05", date:"2026-01-05" };
{
  const api = armar([]);
  const v = api.vecesEnVentana;
  // Enero 2026: lunes 5, 12, 19, 26.
  eq("una reunión semanal en enero son cuatro reuniones",
     v(post(SEMANAL), "2026-01-01", "2026-01-31"), 4);
  eq("en un trimestre, todas las de esos tres meses",
     v(post(SEMANAL), "2026-01-01", "2026-03-31"), 13);
  eq("una fecha suspendida no cuenta",
     v(post({ ...SEMANAL, recurrenceSkip:["2026-01-12"] }), "2026-01-01", "2026-01-31"), 3);
  eq("una corrida DENTRO del mes sigue contando",
     v(post({ ...SEMANAL, recurrenceMoves:{ "2026-01-12":"2026-01-14" } }), "2026-01-01", "2026-01-31"), 4);
  eq("una corrida al mes siguiente cuenta allá, no acá",
     v(post({ ...SEMANAL, recurrenceMoves:{ "2026-01-26":"2026-02-02" } }), "2026-01-01", "2026-01-31"), 3);
  eq("y aparece en febrero",
     v(post({ ...SEMANAL, recurrenceMoves:{ "2026-01-26":"2026-02-02" } }), "2026-02-01", "2026-02-28"), 5);
  eq("antes de que empezara la serie, ninguna",
     v(post(SEMANAL), "2025-01-01", "2025-12-31"), 0);
}

/* ---------- En qué mes cae cada una ---------- */
{
  const api = armar([]);
  eq("una suelta aporta su fecha", api.fechasEnVentana(post(), "2026-01-01", "2026-12-31"), ["2026-05-10"]);
  eq("una que empezó antes del período se cuenta al principio del período",
     api.fechasEnVentana(post({ startDate:"2025-12-28", endDate:"2026-01-05" }), "2026-01-01", "2026-01-31"),
     ["2026-01-01"]);
  eq("una semanal aporta una por lunes",
     api.fechasEnVentana(post(SEMANAL), "2026-01-01", "2026-01-31"),
     ["2026-01-05","2026-01-12","2026-01-19","2026-01-26"]);
}

/* ---------- El período ---------- */
{
  const api = armar([]);
  api.state.reportes = { anio:"2026", trimestre:0 };
  eq("el año entero", [api.ventanaDelReporte().desde, api.ventanaDelReporte().hasta], ["2026-01-01","2026-12-31"]);
  api.state.reportes = { anio:"2026", trimestre:1 };
  eq("primer trimestre", [api.ventanaDelReporte().desde, api.ventanaDelReporte().hasta], ["2026-01-01","2026-03-31"]);
  api.state.reportes = { anio:"2026", trimestre:2 };
  eq("segundo, que termina un 30", [api.ventanaDelReporte().desde, api.ventanaDelReporte().hasta], ["2026-04-01","2026-06-30"]);
  api.state.reportes = { anio:"2026", trimestre:4 };
  eq("cuarto", [api.ventanaDelReporte().desde, api.ventanaDelReporte().hasta], ["2026-10-01","2026-12-31"]);
  api.state.reportes = { anio:"2024", trimestre:1 };
  eq("un primer trimestre bisiesto llega hasta el 31 de marzo igual",
     [api.ventanaDelReporte().desde, api.ventanaDelReporte().hasta], ["2024-01-01","2024-03-31"]);
  api.state.reportes = { anio:"", trimestre:0 };
  eq("sin año elegido, el de hoy", api.ventanaDelReporte().anio, "2026");
  // R21: ventanaDelReporte no repite la cuenta de ventanaDe: da lo mismo para todo año y trimestre
  // (también con el trimestre como texto, que es como lo deja el selector), y la llama.
  const iguales = [];
  for(const anio of ["2023", "2024", "2025", "2026", "2100"]) for(const tri of [0, 1, 2, 3, 4, "0", "2", "4", undefined, null]){
    api.state.reportes = { anio, trimestre:tri };
    const a = JSON.stringify(api.ventanaDelReporte()), b = JSON.stringify(api.ventanaDe(anio, tri));
    if(a !== b) iguales.push([anio, tri, a, b]);
  }
  eq("ventanaDelReporte da lo mismo que ventanaDe(año, trimestre) del estado, para todo año y trimestre", iguales, []);
  const cuerpo = grab("ventanaDelReporte");
  eq("y la cuenta de los meses vive en un solo lugar: ventanaDelReporte llama a ventanaDe y no la repite",
     [/ventanaDe\(/.test(cuerpo), /padStart|Date\.UTC/.test(cuerpo), /padStart/.test(grab("ventanaDe"))], [true, false, true]);
}
{
  const api = armar([]);
  const ant = v => api.ventanaAnterior(v);
  eq("antes del año entero, el año anterior",
     [ant({anio:"2026",tri:0}).desde, ant({anio:"2026",tri:0}).hasta], ["2025-01-01","2025-12-31"]);
  eq("antes del segundo trimestre, el primero",
     [ant({anio:"2026",tri:2}).desde, ant({anio:"2026",tri:2}).hasta], ["2026-01-01","2026-03-31"]);
  eq("antes del primero, el cuarto del año pasado",
     [ant({anio:"2026",tri:1}).desde, ant({anio:"2026",tri:1}).hasta], ["2025-10-01","2025-12-31"]);
}

/* ---------- Los años que se ofrecen ---------- */
{
  const api = armar([post({ startDate:"2024-03-01", endDate:"2024-03-01" }), post({ startDate:"2026-01-01", endDate:"2026-01-01" })]);
  // En orden cronológico: los chips se leen de izquierda a derecha como
  // una línea de tiempo (y el reporte arranca en el año actual igual).
  eq("solo los años con algo cargado, más el de hoy, en orden",
     api.aniosConDatos(), ["2024","2026"]);
}
{
  const api = armar([post({ startDate:"2025-12-28", endDate:"2026-01-04" })]);
  eq("uno que cruza el año aparece en los dos", api.aniosConDatos(), ["2025","2026"]);
}

/* ---------- El reporte entero ---------- */
{
  const api = armar([
    post({ id:"a", scopes:[{type:"pais",country:"Perú"}], activityType:"visita", authorEmail:"ana@x.com",
           participants:[{email:"ana@x.com"},{email:"beto@x.com"}] }),
    post({ id:"b", scopes:[{type:"pais",country:"Chile"}], activityType:"curso", authorEmail:"ana@x.com",
           startDate:"2026-07-01", endDate:"2026-07-01", date:"2026-07-01" }),
    post({ id:"c", scopes:[{type:"pais",country:"México"}], activityType:"curso", authorEmail:"beto@x.com",
           startDate:"2026-07-02", endDate:"2026-07-02", date:"2026-07-02" }),
  ]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("el total", r.total, 3);
  eq("por tipo", r.porTipo, { visita:1, curso:2 });
  eq("por país", r.porPais, { "Perú":1, "Chile":1, "México":1 });
  eq("por zona: Perú y Chile son Sur", r.porZona, { sur:2, norte:1 });
  eq("por mes", r.porMes, { "2026-05":1, "2026-07":2 });
  eq("quién cargó", r.porPersona, { "ana@x.com":2, "beto@x.com":1 });
  eq("quién participó", r.participantes, { "ana@x.com":1, "beto@x.com":1 });
  eq("cuántas tienen participantes cargados", r.conParticipantes, 1);
}

/* ---------- Los alcances grandes no se desarman ---------- */
{
  const api = armar([
    post({ id:"z", scopes:[{type:"region",region:"sur"}] }),
    post({ id:"t", scopes:[{type:"todo"}] }),
  ]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("'toda la zona Sur' suma a la zona…", r.porZona, { sur:1 });
  eq("…y a ningún país en particular", r.porPais, {});
  eq("'Toda LatAm' tiene su propia cuenta", r.latam, 1);
  eq("y no se reparte por zonas", r.porZona.norte || 0, 0);
  eq("el total sigue siendo dos", r.total, 2);
}
{
  const api = armar([post({ scopes:[] })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("una sin lugar se cuenta aparte", r.sinLugar, 1);
  eq("pero suma al total igual", r.total, 1);
}
{
  const api = armar([post({ scopes:[{type:"pais",country:"Perú"},{type:"pais",country:"Chile"}] })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("una actividad en dos países suma en los dos", r.porPais, { "Perú":1, "Chile":1 });
  eq("pero el total es uno solo", r.total, 1);
  eq("y en su zona, una sola vez (los dos son Sur)", r.porZona, { sur:1 });
}
{
  const api = armar([post({ scopes:[{type:"ciudad",country:"Perú",city:"Lima"}] })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("una ciudad suma a su país", r.porPais, { "Perú":1 });
}
{
  const api = armar([post({ scopes:[{type:"pais",country:"Atlantis"}] })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("un país que no existe no inventa una fila", r.porPais, {});
  eq("y se cuenta como sin lugar", r.sinLugar, 1);
}
{
  const api = armar([post({ ...SEMANAL, scopes:[{type:"pais",country:"Perú"}] })]);
  const r = api.armarReporte("2026-01-01","2026-03-31");
  eq("una semanal suma sus 13 veces al país", r.porPais, { "Perú":13 });
  eq("y al total", r.total, 13);
  eq("repartidas mes a mes", r.porMes, { "2026-01":4, "2026-02":4, "2026-03":5 });
}
{
  const api = armar([post({ participants:[{email:"ana@x.com"},{email:"ana@x.com"}] })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("la misma persona dos veces en un posteo cuenta una", r.participantes, { "ana@x.com":1 });
}
{
  const api = armar([post({ cancelled:true })]);
  const r = api.armarReporte("2026-01-01","2026-12-31");
  eq("lo cancelado no entra en ningún lado", [r.total, Object.keys(r.porPais).length], [0, 0]);
}

/* ---------- Lo último y lo próximo de cada país (actividadPorPais) ----------
   Es lo que dice la tarjeta de cada país en Vistas, y la mini-serie de
   los últimos 12 meses. Hoy es 2026-09-17: la serie va de oct 2025 a
   sept 2026. */
{
  const api = armar([
    post({ id:"a", title:"Visita vieja", startDate:"2026-03-10", endDate:"2026-03-10" }),
    post({ id:"b", title:"Visita reciente", startDate:"2026-09-01", endDate:"2026-09-02",
           scopes:[{ type:"ciudad", country:"Perú", city:"Lima" }, { type:"pais", country:"Chile" }] }),
    post({ id:"c", title:"Próxima", startDate:"2026-10-20", endDate:"2026-10-20" }),
    post({ id:"d", title:"Más lejos", startDate:"2026-12-01", endDate:"2026-12-01" }),
  ]);
  const a = api.actividadPorPais();
  eq("la última es la más reciente que ya pasó", a["Perú"].ultima.id, "b");
  eq("la próxima es la más cercana que viene", a["Perú"].proxima.id, "c");
  eq("un posteo cuenta en cada país de sus alcances (ciudad incluida)", a["Chile"].ultima.id, "b");
  eq("sin nada, el país no aparece", a["México"], undefined);
  eq("la serie de 12 meses: marzo y septiembre tienen algo, lo futuro no", a["Perú"].meses, [0,0,0,0,0,1,0,0,0,0,0,1]);
}

/* ---------- "Ver solo", ciudades y países por persona (5/10/2026) ---------- */
{
  const api = armar([
    post({ id:"a", scopes:[{ type:"ciudad", country:"Perú", city:"Lima" }] }),
    post({ id:"b", activityType:"curso", authorEmail:"beto@x.com", scopes:[{ type:"pais", country:"México" }], participants:[{ email:"ana@x.com" }] }),
    post({ id:"c", scopes:[{ type:"region", region:"central" }] }),
    post({ id:"d", scopes:[{ type:"ciudad", country:"Perú", city:"lima" }, { type:"ciudad", country:"Chile", city:"Santiago" }], participants:[{ persona:"p1", name:"Darío" }] }),
  ]);
  const A = "2026-01-01", B = "2026-12-31";
  eq("por tipo", api.armarReporte(A, B, { tipo:"curso" }).total, 1);
  eq("por país (una ciudad de ese país cuenta)", api.armarReporte(A, B, { pais:"Perú" }).total, 2);
  eq("por zona: los países de la zona y lo cargado a la región", api.armarReporte(A, B, { zona:"central" }).total, 1);
  eq("por zona Sur: Perú y Chile", api.armarReporte(A, B, { zona:"sur" }).total, 2);
  eq("por persona: lo que cargó y donde participó", api.armarReporte(A, B, { persona:"ana@x.com" }).total, 4);
  eq("por persona sin cuenta: donde participó (hasta el 7/10/2026 daba vacío)", api.armarReporte(A, B, { persona:"persona:p1" }).total, 1);
  eq("sin filtro, todo", api.armarReporte(A, B, { zona:"", pais:"", tipo:"", persona:"" }).total, 4);
  const r = api.armarReporte(A, B);
  eq("las ciudades distintas no se cuentan dos veces por mayúsculas", r.ciudades.size, 2);
  // Los países de cada uno: lo que cargó y donde participó (7/10/2026; antes
  // solo lo cargado, y quien solo participa quedaba en 0).
  eq("en cuántos países estuvo cada uno: lo que cargó y donde participó, también una persona sin cuenta",
     [[...r.paisesDePersona["ana@x.com"]].sort(), [...(r.paisesDePersona["persona:p1"] || [])].sort()], [["Chile", "México", "Perú"], ["Chile", "Perú"]]);
}
{
  // Comparar: el mismo trimestre de dos años.
  const api = armar([]);
  eq("el 2.º trimestre de 2025", api.ventanaDe("2025", 2), { desde:"2025-04-01", hasta:"2025-06-30", anio:"2025", tri:2 });
}
/* ---------- Cobertura y sugerencias ---------- */
{
  const api = armar([
    post({ id:"v1", startDate:"2024-06-01", endDate:"2024-06-01", date:"2024-06-01", scopes:[{ type:"pais", country:"México" }] }),
    post({ id:"v2", startDate:"2025-03-01", endDate:"2025-03-01", date:"2025-03-01", scopes:[{ type:"pais", country:"Chile" }] }),
    post({ id:"v3", startDate:"2025-04-01", endDate:"2025-04-01", date:"2025-04-01", scopes:[{ type:"pais", country:"Chile" }] }),
    post({ id:"v4", startDate:"2025-05-01", endDate:"2025-05-01", date:"2025-05-01", scopes:[{ type:"pais", country:"Chile" }] }),
    post({ id:"n1", startDate:"2026-02-01", endDate:"2026-02-01", date:"2026-02-01" }),
    post({ id:"fut", startDate:"2026-12-01", endDate:"2026-12-01", date:"2026-12-01", scopes:[{ type:"pais", country:"Costa Rica" }] }),
    post({ id:"reg", startDate:"2026-03-01", endDate:"2026-03-01", date:"2026-03-01", scopes:[{ type:"region", region:"norte" }] }),
  ]);
  const u = api.ultimaActividadPorPais({});
  eq("la última actividad propia de cada país, sin lo que todavía no pasó ni lo regional", u, { "México":"2024-06-01", "Chile":"2025-05-01", "Perú":"2026-02-01" });
  const v = api.ventanaDe("2026", 0);
  const r = api.armarReporte(v.desde, v.hasta, {}), ra = api.armarReporte("2025-01-01", "2025-12-31", {});
  const sug = api.sugerenciasDelReporte(v, r, ra, {}).map(x => x.txt);
  eq("sugiere retomar el país donde se dejó de ir", sug.some(x => /Retomar Chile/.test(x)), true);
  eq("y avisa lo que lleva más de un año sin actividad", sug.some(x => /más de un año.*México/.test(x)), true);
  eq("y los meses que ya pasaron sin nada (no los que vienen)", sug.some(x => /enero/.test(x) && !/noviembre/.test(x)), true);
}

/* ---------- Lo planificado, aparte (AUDITORIA I2) ---------- */
{
  // Hoy es 17/9/2026: lo de octubre y noviembre todavía no pasó.
  const api = armar([
    post({ id:"a", startDate:"2026-05-10", endDate:"2026-05-10" }),
    post({ id:"b", startDate:"2026-09-15", endDate:"2026-09-20" }),           // empezó y sigue: ya cuenta
    post({ id:"c", startDate:"2026-10-02", endDate:"2026-10-02", scopes:[{ type:"pais", country:"Chile" }] }),
    post({ id:"d", startDate:"2026-11-20", endDate:"2026-11-22", authorEmail:"juan@x.com" }),
    post({ id:"e", startDate:"2026-12-01", endDate:"2026-12-01", cancelled:true }),
  ]);
  const r = api.armarReporte("2026-01-01", "2026-12-31", {});
  eq("lo hecho corta en hoy; lo que ya empezó, cuenta", r.total, 2);
  eq("lo que viene se cuenta aparte (sin los cancelados)", r.planificadas, 2);
  eq("y por mes, aparte también", [r.porMes["2026-10"] || 0, r.porMesPlan["2026-10"], r.porMesPlan["2026-11"], r.porMes["2026-09"]], [0, 1, 1, 1]);
  eq("lo planificado no infla ningún otro número", [Object.keys(r.porPais), Object.keys(r.porPersona)], [["Perú"], ["ana@x.com"]]);
  const pasado = api.armarReporte("2025-01-01", "2025-12-31", {});
  eq("un período que ya pasó no tiene nada planificado", pasado.planificadas, 0);
  const futuro = api.armarReporte("2026-10-01", "2026-12-31", {});
  eq("uno que todavía no empezó, todo planificado", [futuro.total, futuro.planificadas], [0, 2]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
