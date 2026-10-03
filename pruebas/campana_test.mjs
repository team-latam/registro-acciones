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
const ctx = { state:{ auth:{ user:{ email:"benny@team-latam.com" } } }, localStorage:nuevoStorage(false),
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
  function upcomingEvents(){ return ctx.__upcoming; }
  function myCalendarInviteTs(){ return ctx.__inviteTs; }
  function hasActiveCalendarInviteNotice(){ return ctx.__inviteActivo; }
  ${code}
  return { getUnseenUpcomingCount, markUpcomingSeen, hasUnseenCalendarInvite, markCalendarInviteSeen, getPerUserIds };
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
ctx.__upcoming = [{ id:"x" }];
ctx.state.auth.user.email = "otra@team-latam.com";
eq("otra cuenta arranca sin nada visto", api.getUnseenUpcomingCount(), 1);
api.markUpcomingSeen();
eq("y la marca es suya", api.getUnseenUpcomingCount(), 0);
ctx.state.auth.user.email = "benny@team-latam.com";
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
eq("y marcar no tira error", api.getUnseenUpcomingCount(), 1);
ctx.localStorage = nuevoStorage(false);

// ---- basura guardada a mano no rompe ----
ctx.localStorage.setItem("upcomingSeenIds:benny@team-latam.com", "{no es json");
eq("un valor corrupto se ignora", api.getUnseenUpcomingCount(), 1);
ctx.localStorage.setItem("upcomingSeenIds:benny@team-latam.com", '{"a":1}');
eq("un json que no es lista, también", api.getUnseenUpcomingCount(), 1);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
