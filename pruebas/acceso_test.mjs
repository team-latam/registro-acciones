import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
import { hacerGrab } from "./grab.mjs";
const grab = hacerGrab(src);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const tic = ()=>new Promise(r=>setTimeout(r,0));

/* ------------------------------------------------------------------
   El escenario: una persona que NO es el admin fijo inicia sesión.
   La app se suscribe a dos cosas a la vez — su ficha en el padrón
   (allowlist/members) y su propia solicitud de acceso — y cada una
   contesta cuando quiere. Acá se controla ese orden a mano.
------------------------------------------------------------------ */
function armar(){
  const reg = { guardados:[], borrados:[], auditoria:[], suscripciones:[], pantallas:[], fatal:null, relojes:[] };
  let avisarPadron = null, fallarPadron = null, avisarSolicitud = null, fallarSolicitud = null;
  const store = {
    roster: {
      watchOwn(email, alCambiar, alFallar){ avisarPadron = alCambiar; fallarPadron = alFallar; return ()=>{ reg.cortoPadron = true; }; },
    },
    accessRequests: {
      watchOwn(email, alCambiar, alFallar){ avisarSolicitud = alCambiar; fallarSolicitud = alFallar; return ()=>{ reg.cortoSolicitud = true; }; },
      async save(email, datos){ reg.guardados.push({ email, status:datos.status }); },
    },
  };
  const sandbox = new Function("ctx", `
    "use strict";
    const { store, reg } = ctx;
    const ADMIN_EMAIL = "benny@team-latam.com";
    const DEFAULT_PREFS = {};
    let fatalError = null;
    let relojPadron = null;
    // El reloj de los 12 segundos, controlado a mano: la prueba tarda 0 ms
    // y no depende del tiempo real ni de un sleep.
    const setTimeout = (fn, ms) => { reg.relojes.push({ fn, ms, vivo:true }); return reg.relojes.length; };
    const clearTimeout = id => { if(id && reg.relojes[id-1]) reg.relojes[id-1].vivo = false; };
    let unsubscribeData=null, unsubscribeRequests=null, unsubAllowlist=null, unsubOwnRequest=null,
        unsubAuditLog=null, unsubRoster=null, unsubTerritoryConfig=null, unsubPreferences=null,
        unsubUserPrefs=null, unsubFormerMembers=null;
    let auditLoginLoggedThisSession = false;
    let composerDraft=null, rutinaDraft=null, zonasDraft=null, tiposDraft=null, calendarDraft=null, adjuntosDraft=null;
    const replyDrafts = {}, nestedReplyDrafts = {};
    const openReplyForms = new Set(), openThreads = new Set(), openNestedReplyForms = new Set();
    const docsAbiertos = new Map();
    let userMenuOpen=false, mentionsMenuOpen=false;
    const postModalOverlay = { hidden:true };
    const state = { auth:{ status:"loading", user:null }, posts:[], repliesByPost:{}, loaded:false,
      accessRequests:[], auditLog:[], roster:[], formerMembers:[], prefs:{}, filters:null,
      preferenciasSection:"zonas", view:"feed" };
    const newComposerDraft = ()=>({}), newRutinaDraft = ()=>({});
    const stopCalendarAutoSync = ()=>{};
    const t = es => es;
    const render = ()=>{ reg.pantallas.push(state.auth.status); };
    const renderFatalError = m => { reg.fatal = m; };
    const logAudit = tipo => { reg.auditoria.push(tipo); };
    const ensureAdminInRoster = ()=>{};
    const anotar = n => ()=>{ reg.suscripciones.push(n); return ()=>{}; };
    const subscribeData = anotar("posts"), subscribeAccessRequests = anotar("solicitudes"),
          subscribeAuditLog = anotar("auditoria"), subscribeRoster = anotar("padron"),
          subscribeTerritoryConfig = anotar("config"), subscribePreferences = anotar("preferencias"),
          subscribeUserPrefs = anotar("mis-preferencias"), subscribeFormerMembers = anotar("ex");
    ${grab("recomputeAuthStatus")}
    ${grab("onAuthChanged")}
    return { onAuthChanged, state };
  `)({ store, reg });
  return {
    reg, state: sandbox.state,
    entrar: u => sandbox.onAuthChanged(u),
    padron: v => avisarPadron(v),
    padronFalla: e => fallarPadron(e),
    solicitud: v => avisarSolicitud(v),
    solicitudFalla: e => fallarSolicitud(e),
    // Hace sonar los relojes que todavía estén vivos.
    pasarElTiempo: ()=>{ reg.relojes.forEach(r=>{ if(r && r.vivo){ r.vivo = false; r.fn(); } }); },
  };
}

const LAURA = { uid:"u1", email:"laura@x.com", displayName:"Laura", photoURL:"" };
const FICHA = { email:"laura@x.com", name:"Laura" };

/* ---------- El error que reportó: aprobada, y vuelve a la cola ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.solicitud({ email:LAURA.email, status:"approved" });   // contesta PRIMERO la solicitud
  await tic();
  eq("solicitud aprobada primero: no se crea ningún pedido", a.reg.guardados, []);
  eq("y mientras no contestó el padrón, la pantalla espera (no dice 'pendiente')",
     a.state.auth.status, "loading");
  a.padron(FICHA);                                          // recién ahora el padrón
  await tic();
  eq("cuando llega el padrón, sigue sin crearse ningún pedido", a.reg.guardados, []);
  eq("y entra como aprobada", a.state.auth.status, "approved");
  eq("tampoco se registró un 'pidió acceso' falso en la auditoría",
     a.reg.auditoria.filter(x=>x==="access_requested"), []);
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(FICHA);                                          // el orden de siempre
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq("con el padrón primero, igual: nada que pedir", a.reg.guardados, []);
  eq("y entra como aprobada", a.state.auth.status, "approved");
}

/* ---------- Alta directa: el admin la agregó sin que hubiera pedido ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(FICHA);
  a.solicitud(null);      // nunca pidió acceso: la agregaron a mano
  await tic();
  eq("a quien ya es integrante no se le inventa una solicitud", a.reg.guardados, []);
  eq("entra igual", a.state.auth.status, "approved");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.solicitud(null);      // y al revés, con la solicitud contestando primero
  await tic();
  eq("sin saber del padrón todavía, no se apura a pedir", a.reg.guardados, []);
  a.padron(FICHA);
  await tic();
  eq("y cuando llega el padrón tampoco", a.reg.guardados, []);
}

/* ---------- Quien entra por primera vez SÍ tiene que pedir ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(null);
  a.solicitud(null);
  await tic();
  eq("alguien de afuera pide acceso solo", a.reg.guardados, [{ email:"laura@x.com", status:"pending" }]);
  eq("y queda registrado", a.reg.auditoria.filter(x=>x==="access_requested"), ["access_requested"]);
  a.solicitud({ email:LAURA.email, status:"pending" });   // el propio guardado avisa de vuelta
  await tic();
  eq("el aviso del propio pedido no dispara otro (nada de bucle)", a.reg.guardados.length, 1);
  eq("y la pantalla dice que está pendiente", a.state.auth.status, "pending");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.solicitud(null);      // orden invertido
  a.padron(null);
  await tic();
  eq("el orden no cambia nada: igual pide", a.reg.guardados, [{ email:"laura@x.com", status:"pending" }]);
}

/* ---------- Un pedido en curso no se toca ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(null);
  a.solicitud({ email:LAURA.email, status:"pending" });
  await tic();
  eq("con el pedido ya hecho, no se rehace", a.reg.guardados, []);
  eq("y la pantalla lo dice", a.state.auth.status, "pending");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(null);
  a.solicitud({ email:LAURA.email, status:"rejected" });
  await tic();
  eq("a quien rechazaron NO se le vuelve a pedir solo", a.reg.guardados, []);
  eq("ve la pantalla de rechazo", a.state.auth.status, "rejected");
}

/* ---------- El limbo: aprobada en la solicitud, sin ficha en el padrón ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(null);
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq("una aprobación a medias se repara volviendo a pedir",
     a.reg.guardados, [{ email:"laura@x.com", status:"pending" }]);
}

/* ---------- Revocación con la sesión abierta ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(FICHA);
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq("estando adentro, nada", a.reg.guardados, []);
  a.padron(null);          // le sacan la ficha
  await tic();
  eq("al revocarla vuelve a la cola del admin",
     a.reg.guardados, [{ email:"laura@x.com", status:"pending" }]);
  eq("y deja de ver el Registro", a.state.auth.status, "pending");
}

/* ---------- Los roles siguen saliendo del padrón ---------- */
for(const [role, esperado] of [[undefined,"approved"],["member","approved"],["observer","observer"],["admin","admin"]]){
  const a = armar();
  await a.entrar(LAURA);
  a.padron(role ? { ...FICHA, role } : FICHA);
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq(`rol ${role || "(sin rol)"} → ${esperado}`, a.state.auth.status, esperado);
}

/* ---------- Qué se suscribe y cuándo ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq("sin respuesta del padrón no se lee nada del Registro", a.reg.suscripciones, []);
  a.padron(FICHA);
  await tic();
  eq("recién con la ficha se abren los datos",
     a.reg.suscripciones, ["posts","padron","config","preferencias","mis-preferencias","ex"]);
  eq("y como no es admin, ni solicitudes ni auditoría",
     a.reg.suscripciones.filter(x=>x==="solicitudes"||x==="auditoria"), []);
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron({ ...FICHA, role:"admin" });
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  eq("un admin por rol sí ve solicitudes y auditoría",
     a.reg.suscripciones.filter(x=>x==="solicitudes"||x==="auditoria"), ["solicitudes","auditoria"]);
}

/* ---------- Si algo falla, no se inventa nada ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(null);
  a.solicitudFalla(new Error("permiso denegado"));
  await tic();
  eq("si no se pudo leer la solicitud, no se crea una a ciegas", a.reg.guardados, []);
  eq("y la pantalla se queda en 'pendiente', que es lo que menos promete",
     a.state.auth.status, "pending");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.solicitud({ email:LAURA.email, status:"approved" });
  a.padronFalla(new Error("permiso denegado"));
  await tic();
  eq("si no se pudo leer el padrón, tampoco", a.reg.guardados, []);
  eq("y se avisa en pantalla", typeof a.reg.fatal, "string");
}

/* ---------- El admin fijo no pasa por nada de esto ---------- */
{
  const a = armar();
  await a.entrar({ uid:"u0", email:"benny@team-latam.com", displayName:"Benny", photoURL:"" });
  await tic();
  eq("el admin fijo entra derecho", a.state.auth.status, "admin");
  eq("sin crear ninguna solicitud", a.reg.guardados, []);
}

/* ---------- Cerrar sesión ---------- */
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(FICHA);
  a.solicitud({ email:LAURA.email, status:"approved" });
  await tic();
  await a.entrar(null);
  eq("al cerrar sesión se cortan las dos suscripciones",
     [a.reg.cortoPadron, a.reg.cortoSolicitud], [true, true]);
  eq("y queda afuera", a.state.auth.status, "signedOut");
}

/* ------------------------------------------------------------------
   Aprobar a alguien que YA está en el equipo (la cola quedó con un
   pedido viejo): tiene que limpiar la cola sin tocarle la ficha.
------------------------------------------------------------------ */
function armarAprobacion(fichaExistente){
  const reg = { altas:[], estados:[], borradosEx:[], auditoria:[] };
  const store = {
    roster: {
      async get(email){ return fichaExistente; },
      async add(email, datos){ reg.altas.push({ email, ...datos }); },
    },
    accessRequests: {
      async get(email){ return { email, name:"Laura Pérez", photoURL:"foto.jpg", status:"pending" }; },
      async setStatus(email, status){ reg.estados.push({ email, status }); },
    },
    formerMembers: { async remove(email){ reg.borradosEx.push(email); } },
  };
  const sandbox = new Function("ctx", `
    "use strict";
    const { store, reg } = ctx;
    const ADMIN_EMAIL = "benny@team-latam.com";
    const state = { auth:{ user:{ email:"benny@team-latam.com" } }, formerMembers:[], roster:[] };
    const logAudit = tipo => { reg.auditoria.push(tipo); };
    const takenNicknames = async ()=> new Set();
    const makeNickname = (nombre)=> "laura";
    ${grab("approveRequest")}
    return { approveRequest };
  `)({ store, reg });
  return { reg, aprobar: sandbox.approveRequest };
}
{
  const a = armarAprobacion({ email:"laura@x.com", nickname:"lau", role:"observer", calendarShared:true });
  await a.aprobar("laura@x.com");
  eq("a quien ya es integrante no se le rehace la ficha", a.reg.altas, []);
  eq("solo se saca el pedido de la cola", a.reg.estados, [{ email:"laura@x.com", status:"approved" }]);
  eq("y queda registrado igual", a.reg.auditoria, ["access_approved"]);
}
{
  const a = armarAprobacion(null);
  await a.aprobar("laura@x.com");
  eq("a alguien de afuera sí se le da de alta", a.reg.altas.length, 1);
  eq("con su @nickname", a.reg.altas[0].nickname, "laura");
  eq("como integrante", a.reg.altas[0].role, "member");
  eq("y el pedido queda aprobado", a.reg.estados, [{ email:"laura@x.com", status:"approved" }]);
}

/* ------------------------------------------------------------------
   Quién aparece en la cola del admin. Una sola definición para la
   lista, el número del sub-menú y el globo del encabezado.
------------------------------------------------------------------ */
const cola = (roster, solicitudes) => new Function("ctx", `
  "use strict";
  const state = ctx.state;
  ${grab("solicitudesPendientes")}
  return solicitudesPendientes().map(r => r.email);
`)({ state: { roster, accessRequests: solicitudes } });

const PIDIO  = { email:"nuevo@x.com", status:"pending" };
const BENNY  = { email:"integrante.real@x.com", status:"pending" };
const LIMBO  = { email:"limbo@x.com", status:"approved" };
const FUERA  = { email:"rechazado@x.com", status:"rejected" };
const EQUIPO = [{ email:"integrante.real@x.com" }, { email:"otro@x.com" }];

eq("quien pidió y no está en el equipo, espera", cola([], [PIDIO]), ["nuevo@x.com"]);
eq("quien YA está en el equipo no espera nada, aunque su pedido diga pending",
   cola(EQUIPO, [BENNY]), []);
eq("y eso no tapa a los demás", cola(EQUIPO, [BENNY, PIDIO]), ["nuevo@x.com"]);
eq("el limbo (aprobado pero sin ficha) sí tiene que aparecer",
   cola([], [LIMBO]), ["limbo@x.com"]);
eq("pero si tiene ficha, no", cola([{ email:"limbo@x.com" }], [LIMBO]), []);
eq("a quien se rechazó no se le vuelve a preguntar", cola([], [FUERA]), []);
eq("ni aunque además esté en el equipo", cola([{ email:"rechazado@x.com" }], [FUERA]), []);
eq("sin solicitudes, nadie", cola(EQUIPO, []), []);
eq("con el padrón todavía vacío no se esconde a nadie (mejor de más que de menos)",
   cola([], [BENNY, PIDIO, LIMBO]).sort(),
   ["integrante.real@x.com","limbo@x.com","nuevo@x.com"]);
eq("un status raro se muestra igual: que decida una persona",
   cola([], [{ email:"raro@x.com", status:"loquesea" }]), ["raro@x.com"]);
eq("si le revocan el acceso, su pedido vuelve a la cola solo",
   cola([], [BENNY]), ["integrante.real@x.com"]);

/* ================================================================
   "Cargando…" no puede ser para siempre.

   El callback de ERROR del padrón ya avisaba (pega el cartel rojo).
   Lo que dejaba la pantalla muerta era el otro caso: que el padrón NO
   CONTESTE NUNCA y nadie llame a ningún callback — la base pausada, el
   teléfono sin señal, una consulta colgada. Ahí la pantalla se quedaba
   con el reloj de arena, sin mensaje y sin un botón para salir, y desde
   afuera eso es "no me deja entrar" sin un solo dato para saber por qué.
================================================================ */
{
  const a = armar();
  await a.entrar(LAURA);
  eq("al entrar se arma un reloj", a.reg.relojes.filter(r=>r&&r.vivo).length, 1);
  eq("de 12 segundos", a.reg.relojes[a.reg.relojes.length-1].ms, 12000);
  eq("y arranca sin avisar nada (todavía es razonable esperar)", a.state.auth.demorado, false);

  a.pasarElTiempo();
  eq("si nadie contestó, la pantalla deja de prometer", a.state.auth.demorado, true);
  eq("pero sigue en loading: NO se la manda a 'pendiente' (sería mentira)", a.state.auth.status, "loading");
  eq("y se redibuja para que se vea", a.reg.pantallas[a.reg.pantallas.length-1], "loading");
  eq("sin inventar ninguna solicitud", a.reg.guardados, []);
  eq("y sin pegar el cartel fatal, que es para un error de verdad", a.reg.fatal, null);
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.padron(FICHA);                      // el padrón contesta a tiempo
  a.solicitud(null);
  await tic();
  eq("si el padrón contesta, entra", a.state.auth.status, "approved");
  eq("y el reloj se apaga", a.reg.relojes.filter(r=>r&&r.vivo).length, 0);
  a.pasarElTiempo();
  eq("así que ya no puede ensuciar una pantalla que anda", a.state.auth.demorado, false);
  eq("ni sacarla de su estado", a.state.auth.status, "approved");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.pasarElTiempo();
  eq("tardó y lo dijo", a.state.auth.demorado, true);
  a.padron(FICHA);                      // llega tarde, pero llega
  a.solicitud(null);
  await tic();
  eq("cuando por fin contesta, entra igual", a.state.auth.status, "approved");
  eq("y se borra el aviso de demora", a.state.auth.demorado, false);
}
{
  const a = armar();
  await a.entrar(LAURA);
  await a.entrar(null);                 // cierra sesión mientras esperaba
  eq("al cerrar sesión no queda ningún reloj corriendo", a.reg.relojes.filter(r=>r&&r.vivo).length, 0);
  a.pasarElTiempo();
  eq("y la pantalla de inicio no se ensucia", a.state.auth.status, "signedOut");
}
{
  const a = armar();
  await a.entrar(LAURA);
  a.padronFalla(new Error("permission-denied"));
  await tic();
  eq("un error de verdad sigue pegando el cartel, no el aviso de demora", a.reg.fatal !== null, true);
  a.pasarElTiempo();
  eq("y el reloj ya no tiene nada que decir encima", a.state.auth.demorado, false);
}
{
  const a = armar();
  await a.entrar({ uid:"u0", email:"benny@team-latam.com", displayName:"Benny", photoURL:"" });
  eq("el admin fijo entra derecho, sin reloj ni espera", a.state.auth.status, "admin");
  eq("así que no se le arma ninguno", a.reg.relojes.filter(r=>r&&r.vivo).length, 0);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
