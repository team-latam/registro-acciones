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
  "aniosConDatos","ventanaDelReporte","ventanaAnterior","armarReporte"].map(grab).join("\n");

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
    ${codigo}
    return { vecesEnVentana, fechasEnVentana, aniosConDatos, ventanaDelReporte,
             ventanaAnterior, armarReporte, state };
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
  eq("solo los años con algo cargado, más el de hoy, del más nuevo al más viejo",
     api.aniosConDatos(), ["2026","2024"]);
}
{
  const api = armar([post({ startDate:"2025-12-28", endDate:"2026-01-04" })]);
  eq("uno que cruza el año aparece en los dos", api.aniosConDatos(), ["2026","2025"]);
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

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
