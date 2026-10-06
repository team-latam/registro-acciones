import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El sondeo de Google Calendar no escribe en la base si no hace falta

   Antes cada pestaña con permiso de escribir guardaba el token de Google
   en app_config cada 30 s, con o sin cambios, y como app_config se escucha
   en vivo cada escritura le llegaba a todas las demás pestañas: la cuota de
   mensajes del plan gratis de Supabase era la primera en agotarse
   (docs/AUDITORIA.md, U4). Esto prueba la regla que decide cuándo guardar
   (debeGuardarSyncToken) y que el sondeo va cada 2 minutos y no corre con
   la pestaña escondida, sacando el código del index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const grabReal = hacerGrab(src);
// Con el código viejo algunas de estas no existen: que la prueba falle
// diciendo qué, en vez de caerse.
const grab = n => { try{ return grabReal(n); }catch(e){ return ""; } };

let debe;
try{ if(!grab("debeGuardarSyncToken")) throw 0; debe = new Function(`${grab("SYNC_TOKEN_REFRESCO_MS")}\n${grab("debeGuardarSyncToken")}\nreturn debeGuardarSyncToken;`)(); }
catch(e){ debe = () => "no existe debeGuardarSyncToken"; }

const AHORA = Date.parse("2026-10-06T12:00:00Z");
const hace = h => new Date(AHORA - h * 3600 * 1000).toISOString();
const meta = (tok, h) => ({ syncToken: tok, lastSyncedAt: hace(h) });
const res = (tok, n) => ({ nextSyncToken: tok, events: Array.from({ length: n }, (_, i) => ({ id: "e" + i })) });

eq("sin cambios y el token de hace 10 minutos: NO se guarda (era lo de cada 30 s)", debe(meta("A", 0.2), res("B", 0), false, AHORA), false);
eq("vinieron eventos: se guarda", debe(meta("A", 0.2), res("B", 2), false, AHORA), true);
eq("relectura completa: se guarda aunque no haya eventos", debe(meta("A", 0.2), res("B", 0), true, AHORA), true);
eq("no había token guardado: se guarda", debe(null, res("B", 0), false, AHORA), true);
eq("tampoco había en la fila: se guarda", debe({}, res("B", 0), false, AHORA), true);
eq("el guardado tiene más de 6 horas: se refresca", debe(meta("A", 7), res("B", 0), false, AHORA), true);
eq("Google devolvió el mismo token: nada que guardar", debe(meta("A", 9), res("A", 3), false, AHORA), false);
eq("sin token en la respuesta: no", debe(meta("A", 9), { events: [] }, false, AHORA), false);
eq("fecha del último guardado ilegible: se refresca", debe({ syncToken: "A", lastSyncedAt: "?" }, res("B", 0), false, AHORA), true);

// El intervalo y la pestaña escondida, leídos del código.
const arranque = grab("startCalendarAutoSync");
eq("el sondeo va cada 2 minutos, no cada 30 s", [/setInterval\([^;]*CALENDAR_SYNC_CADA_MS\)/.test(arranque), /30000/.test(arranque), /2 \* 60 \* 1000/.test(grab("CALENDAR_SYNC_CADA_MS"))], [true, false, true]);
eq("y vuelve a mirar al volver a la pestaña o a la red", [/visibilitychange/.test(arranque), /"online"/.test(arranque)], [true, true]);
eq("al cerrar sesión se sacan esos oyentes", /removeEventListener\("visibilitychange"/.test(grab("stopCalendarAutoSync")), true);

// sincronizarSiTocaCalendar: con la pestaña escondida no hace nada.
{
  let llamadas = 0;
  const f = new Function("ctx", `let calendarSyncInterval = 1, calendarSyncUltimoMs = 0;
    const document = ctx.document; const syncFromCalendar = () => { ctx.n++; };
    ${grab("sincronizarSiTocaCalendar")}
    return { f: sincronizarSiTocaCalendar, reset(){ calendarSyncUltimoMs = 0; } };`);
  const ctx = { n: 0, document: { hidden: true } };
  let s;
  try{ s = f(ctx); if(typeof s.f !== "function") throw 0; }catch(e){ s = { f(){ ctx.n = -1; } }; }
  s.f(0); llamadas = ctx.n;
  eq("con la pestaña escondida no sincroniza", llamadas, 0);
  ctx.document.hidden = false; s.f(0);
  eq("a la vista, sí", ctx.n, 1);
  s.f(60 * 1000);
  eq("y no dos veces seguidas dentro del minuto", ctx.n, 1);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
