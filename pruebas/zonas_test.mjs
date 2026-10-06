import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Las fechas y las horas, con el equipo entre Argentina e Israel

   (docs/AUDITORIA.md, I5) Tres cosas que dependían de la zona horaria:
   - El día y el mes de un instante (un login, un posteo cargado) salían
     de toISOString(), que da UTC: en Buenos Aires después de las 21:00 lo
     de hoy caía en mañana; en Jerusalén antes de las 03:00, en ayer.
   - Un evento con hora se creaba en Calendar con la zona del navegador de
     quien lo cargaba, y la sincronización lo «corregía» a la del calendario.
   - (Las excepciones de una serie: ver supabase/sync-calendar/pruebas.)
   Corre el código del index.html de verdad con la hora de cada ciudad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };

let api = {};
try{
  api = new Function(`${grab("isoLocalDe")}\n${grab("mesLocalDe")}\n${grab("horaLocalDe")}\n${grab("todayISO")}
    return { isoLocalDe, mesLocalDe, horaLocalDe, todayISO };`)();
}catch(e){}
const llamar = (f, ...x) => { try{ return api[f](...x); }catch(e){ return "no existe " + f; } };

// 01:30 UTC del 6/10 son las 22:30 del 5/10 en Buenos Aires y las 04:30 del 6/10 en Jerusalén.
const NOCHE = Date.parse("2026-10-06T01:30:00Z");
// 31/10 23:30 en Buenos Aires = 1/11 02:30 UTC: mes que viene en UTC.
const FIN_DE_MES = Date.parse("2026-11-01T02:30:00Z");
// 1/10 01:00 en Jerusalén = 30/9 22:00 UTC: mes anterior en UTC.
const PRINCIPIO = Date.parse("2026-09-30T22:00:00Z");

process.env.TZ = "America/Argentina/Buenos_Aires";
eq("Buenos Aires 22:30: el día es el de acá, no el de mañana en UTC", llamar("isoLocalDe", NOCHE), "2026-10-05");
eq("Buenos Aires 31/10 23:30: el mes es octubre", llamar("mesLocalDe", FIN_DE_MES), "2026-10");
eq("Buenos Aires: día y hora para la planilla", llamar("horaLocalDe", NOCHE), "2026-10-05 22:30");
process.env.TZ = "Asia/Jerusalem";
eq("Jerusalén 04:30: el día es el de allá", llamar("isoLocalDe", NOCHE), "2026-10-06");
eq("Jerusalén 1/10 01:00: el mes es octubre, no septiembre", llamar("mesLocalDe", PRINCIPIO), "2026-10");
eq("todayISO usa la misma regla", llamar("todayISO") === llamar("isoLocalDe", Date.now()), true);
process.env.TZ = "UTC";

// Ninguno de los lugares que se arreglaron vuelve a sacar el día de toISOString.
const lugares = ["postsPorMesDe", "renderAuditoriaView", "renderAdminResumen", "csvDelRegistro", "csvDePersonas"]
  .map(n => [n, grab(n)]).filter(([, c]) => c);
eq("en los lugares arreglados no queda ningún día o mes sacado en UTC",
   lugares.filter(([, c]) => /new Date\(\w+\)\.toISOString\(\)\.slice/.test(c)).map(([n]) => n), []);
eq("en todo el archivo tampoco (solo quedan los dos que operan sobre Date.UTC)",
   (src.match(/toISOString\(\)\.slice\(0, ?(7|10|16)\)/g) || []).length, 2);

// El evento con hora se crea en la zona del calendario.
{
  const b = new Function("zona", `
    const t = (es) => es; const scopeLabel = sc => sc.country || ""; const prefs = () => ({});
    ${grab("addDaysISO")} ${grab("esCorreoValido")} ${grab("calendarSummary")} ${grab("participantsLabel")}
    let calendarTimeZone = zona;
    ${grab("zonaDelCalendario")}
    ${grab("buildCalendarEvent")}
    return buildCalendarEvent;`);
  let ev;
  try{ ev = b("America/Argentina/Buenos_Aires")({ title:"Reunión", activityType:"virtual", startDate:"2026-10-07", endDate:"2026-10-07",
    startTime:"15:00", endTime:"16:00", scopes:[], authorName:"Ana", participants:[] }, "p1"); }catch(e){ ev = { error: e.message }; }
  process.env.TZ = "Asia/Jerusalem";
  eq("un evento cargado desde Israel va en la zona del calendario, no en la del navegador",
     ev && ev.start && [ev.start.dateTime, ev.start.timeZone], ["2026-10-07T15:00:00", "America/Argentina/Buenos_Aires"]);
  process.env.TZ = "UTC";
  eq("y la zona del calendario sale de lo que contesta Google", /calendarTimeZone = body\.timeZone/.test(grab("fetchCalendarChanges")), true);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
