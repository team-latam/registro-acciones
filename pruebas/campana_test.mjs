import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
function grab(name){
  const m = new RegExp(`\\n(?:function|const|let) ${name}\\s*[=(]`).exec(src);
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
const code = ["UPCOMING_SEEN_KEY","CALENDAR_INVITE_SEEN_KEY","perUserStorageKey",
  "marcaVista","vistosPorGuardar","guardarVisto","MAX_IDS_VISTOS",
  "markPerUserTs","getPerUserTs","markPerUserIds","getPerUserIds",
  "getUnseenUpcomingCount","markUpcomingSeen","hasUnseenCalendarInvite","markCalendarInviteSeen"].map(grab).join("\n");

// localStorage de mentira, para poder simular también que falla (modo
// incógnito, almacenamiento lleno): el código real envuelve todo en
// try/catch y esto lo comprueba.
function nuevoStorage(rompe){
  const m = new Map();
  return {
    getItem: k => { if(rompe) throw new Error("denegado"); return m.has(k) ? m.get(k) : null; },
    setItem: (k,v) => { if(rompe) throw new Error("denegado"); m.set(k, String(v)); },
    _map: m,
  };
}
// Las marcas van también a las preferencias de la cuenta (state.prefs, que
// en la app llegan de la base a todos los aparatos de la persona). `store`
// anota lo que se mandó a guardar.
const guardados = [];
const ctx = { state:{ auth:{ user:{ email:"benny@team-latam.com" } }, prefs:{} }, localStorage:nuevoStorage(false),
  store:{ userPrefs:{ merge: async (email, parche) => { guardados.push([email, parche]); } } },
  __upcoming: [], __inviteTs: 0, __inviteActivo: false };
const api = new Function("ctx", `
  const state = ctx.state;
  // Delegado, no una copia: el test intercambia ctx.localStorage en
  // caliente (para simular incógnito), y con "const localStorage =
  // ctx.localStorage" las funciones se quedaban con el primero para
  // siempre — los casos de fallo pasaban sin probar nada.
  const localStorage = {
    getItem: k => ctx.localStorage.getItem(k),
    setItem: (k,v) => ctx.localStorage.setItem(k,v),
  };
  function prefs(){ return ctx.state.prefs; }
  const store = ctx.store;
  function upcomingEvents(){ return ctx.__upcoming; }
  function myCalendarInviteTs(){ return ctx.__inviteTs; }
  function hasActiveCalendarInviteNotice(){ return ctx.__inviteActivo; }
  ${code}
  return { getUnseenUpcomingCount, markUpcomingSeen, hasUnseenCalendarInvite, markCalendarInviteSeen, getPerUserIds,
           getPerUserTs, markPerUserTs };
`)(ctx);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// ---- lo que se viene ----
ctx.__upcoming = [{ id:"a" }, { id:"b" }];
eq("sin abrir, cuentan los dos", api.getUnseenUpcomingCount(), 2);
api.markUpcomingSeen();
eq("abrir la campanita los saca del globito", api.getUnseenUpcomingCount(), 0);
eq("pero siguen estando adentro del menú", ctx.__upcoming.length, 2);

ctx.__upcoming = [{ id:"a" }, { id:"b" }, { id:"c" }];
eq("uno nuevo vuelve a levantar el globito", api.getUnseenUpcomingCount(), 1);
api.markUpcomingSeen();
eq("y al abrir de nuevo baja", api.getUnseenUpcomingCount(), 0);

// El evento "a" ya pasó: sale de la lista, y la próxima marca lo olvida.
ctx.__upcoming = [{ id:"b" }, { id:"c" }];
eq("lo que ya pasó no cuenta", api.getUnseenUpcomingCount(), 0);
api.markUpcomingSeen();
eq("la lista guardada se poda sola", [...api.getPerUserIds("upcomingSeenIds")].sort(), ["b","c"]);

// Si vuelve a aparecer un id viejo (un evento que se editó a futuro), cuenta.
ctx.__upcoming = [{ id:"b" }, { id:"c" }, { id:"a" }];
eq("un id que había salido y vuelve, cuenta de nuevo", api.getUnseenUpcomingCount(), 1);

// ---- la invitación al Calendar ----
ctx.__inviteActivo = true; ctx.__inviteTs = 1000;
eq("una invitación nueva suma", api.hasUnseenCalendarInvite(), true);
api.markCalendarInviteSeen();
eq("abrir la campanita la saca del globito", api.hasUnseenCalendarInvite(), false);
eq("pero el aviso sigue activo adentro", ctx.__inviteActivo, true);
ctx.__inviteTs = 2000;
eq("una invitación MÁS NUEVA vuelve a sumar", api.hasUnseenCalendarInvite(), true);
api.markCalendarInviteSeen();
eq("y se vuelve a apagar", api.hasUnseenCalendarInvite(), false);
ctx.__inviteActivo = false;
eq("si ya no hay invitación, no suma", api.hasUnseenCalendarInvite(), false);

// ---- cada cuenta tiene su propia marca en el mismo navegador ----
// (Las preferencias son de cada cuenta: al entrar otra, llegan las suyas.)
ctx.__upcoming = [{ id:"x" }];
const prefsDeBenny = ctx.state.prefs;
ctx.state.auth.user.email = "otra@team-latam.com"; ctx.state.prefs = {};
eq("otra cuenta arranca sin nada visto", api.getUnseenUpcomingCount(), 1);
api.markUpcomingSeen();
eq("y la marca es suya", api.getUnseenUpcomingCount(), 0);
ctx.state.auth.user.email = "benny@team-latam.com"; ctx.state.prefs = prefsDeBenny;
eq("no le pisa la marca a la primera", api.getUnseenUpcomingCount(), 1);

// ---- sin sesión no se guarda nada ----
ctx.state.auth.user = null;
eq("sin sesión no explota al leer", api.getUnseenUpcomingCount(), 1);
api.markUpcomingSeen();
eq("ni al escribir", api.getUnseenUpcomingCount(), 1);
ctx.state.auth.user = { email:"benny@team-latam.com" };

// ---- localStorage bloqueado (incógnito): no rompe nada ----
ctx.localStorage = nuevoStorage(true);
eq("con el almacenamiento bloqueado, cuenta todo como no visto", api.getUnseenUpcomingCount(), 1);
api.markUpcomingSeen();
eq("y marcar no tira error, y queda en la cuenta igual", api.getUnseenUpcomingCount(), 0);
ctx.localStorage = nuevoStorage(false);
ctx.state.prefs = {};

// ---- basura guardada a mano no rompe ----
ctx.localStorage.setItem("upcomingSeenIds:benny@team-latam.com", "{no es json");
eq("un valor corrupto se ignora", api.getUnseenUpcomingCount(), 1);
ctx.localStorage.setItem("upcomingSeenIds:benny@team-latam.com", '{"a":1}');
eq("un json que no es lista, también", api.getUnseenUpcomingCount(), 1);

// ---- lo visto en un aparato vale en los demás ----
// Con Firebase las marcas vivían solo en el localStorage de cada
// navegador: lo leído en la compu seguía como nuevo en el celular.
await new Promise(r => setTimeout(r, 0));
guardados.length = 0;
ctx.state.prefs = {}; ctx.localStorage = nuevoStorage(false);
ctx.__upcoming = [{ id:"m" }, { id:"n" }];
api.markUpcomingSeen();
ctx.__inviteActivo = true; ctx.__inviteTs = 5000;
api.markCalendarInviteSeen();
await new Promise(r => setTimeout(r, 0));
eq("las marcas de un mismo momento van a la cuenta en una sola escritura", guardados.length, 1);
eq("cada una con su clave, para no pisar a las otras", guardados[0] && guardados[0][0] === "benny@team-latam.com" && guardados[0][1],
   { visto_upcomingSeenIds:["m","n"], visto_calendarInviteBellSeenAt:5000 });
// El celular: otro localStorage, vacío, pero con las preferencias de la cuenta.
ctx.localStorage = nuevoStorage(false);
ctx.state.prefs = { ...guardados[0][1] };
eq("en otro aparato, lo que se viene ya visto no suma", api.getUnseenUpcomingCount(), 0);
eq("ni la invitación", api.hasUnseenCalendarInvite(), false);
guardados.length = 0;
api.markUpcomingSeen();
await new Promise(r => setTimeout(r, 0));
eq("marcar lo mismo otra vez no vuelve a escribir", guardados.length, 0);

// Las marcas de antes del cambio (solo locales) siguen valiendo.
ctx.state.prefs = {};
ctx.localStorage.setItem("mentionsSeenAt:benny@team-latam.com", "7000");
eq("una marca vieja del navegador cuenta", api.getPerUserTs("mentionsSeenAt"), 7000);
ctx.state.prefs = { visto_mentionsSeenAt: 9000 };
eq("si la cuenta tiene una más nueva, manda esa", api.getPerUserTs("mentionsSeenAt"), 9000);
// Un aparato con los datos menos al día no le devuelve "nuevo" al resto.
guardados.length = 0;
api.markPerUserTs("mentionsSeenAt", 8000);
await new Promise(r => setTimeout(r, 0));
eq("una marca nunca va para atrás", [api.getPerUserTs("mentionsSeenAt"), guardados.length], [9000, 0]);
api.markPerUserTs("mentionsSeenAt", 9500);
await new Promise(r => setTimeout(r, 0));
eq("y una más nueva sí se guarda", guardados.map(g => g[1]), [{ visto_mentionsSeenAt:9500 }]);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
