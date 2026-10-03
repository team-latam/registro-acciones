import fs from "node:fs";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
// El extractor de verdad (ver grab.mjs): la capa de datos tiene plantillas
// y expresiones regulares adentro, y uno simple se pierde a mitad.
const grab = hacerGrab(src);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

/* ---------------------------------------------------------------
   PARTE 1 — la app no sabe de qué base viene lo que recibe

   Contra un store de mentira, que no tiene NADA de Supabase adentro:
   si la app anda igual, es que de verdad solo habla con la capa.
   (sb_test.mjs prueba la capa misma, contra un Supabase de mentira.)
   --------------------------------------------------------------- */
function storeDeMentira(inicial){
  const datos = new Map(inicial.map(u=>[u.email, u]));
  const oyentes = new Set();
  const avisar = ()=> oyentes.forEach(f=>f([...datos.values()]));
  return {
    formerMembers: {
      subscribe(alCambiar){ oyentes.add(alCambiar); alCambiar([...datos.values()]); return ()=>oyentes.delete(alCambiar); },
      async all(){ return [...datos.values()]; },
      async save(email, d){ datos.set(email, { ...d, email, revokedAt: 12345 }); avisar(); },
      async remove(email){ datos.delete(email); avisar(); },
    },
  };
}

const ctxApp = {
  state: { formerMembers: [], auth:{ user:{ email:"benny@x.com" } } },
  __renders: 0,
  store: storeDeMentira([{ email:"julia@x.com", name:"Julia", nickname:"julia" }]),
};
const app = new Function("ctx", `
  const state = ctx.state;
  let store = ctx.store;
  let unsubFormerMembers = null;
  function render(){ ctx.__renders++; }
  ${grab("subscribeFormerMembers")}
  return { subscribeFormerMembers, cortar: ()=>unsubFormerMembers && unsubFormerMembers() };
`)(ctxApp);

app.subscribeFormerMembers();
eq("la app se llenó desde un store cualquiera",
   ctxApp.state.formerMembers.map(u=>u.email), ["julia@x.com"]);
eq("y redibujó", ctxApp.__renders > 0, true);

await ctxApp.store.formerMembers.save("sofia@x.com", { name:"Sofia", nickname:"sofia" });
eq("un alta llega sola a la app, sin que nadie recargue",
   ctxApp.state.formerMembers.map(u=>u.email).sort(), ["julia@x.com","sofia@x.com"]);

await ctxApp.store.formerMembers.remove("julia@x.com");
eq("una baja también", ctxApp.state.formerMembers.map(u=>u.email), ["sofia@x.com"]);

const rendersAntes = ctxApp.__renders;
app.cortar();
await ctxApp.store.formerMembers.save("otra@x.com", { name:"Otra", nickname:"otra" });
eq("después de cortar, la app deja de recibir", ctxApp.__renders, rendersAntes);

/* ---------------------------------------------------------------
   PARTE 2 — el equipo, contra un store de mentira
   --------------------------------------------------------------- */
function rosterDeMentira(inicial){
  const datos = new Map(inicial.map(u=>[u.email, u]));
  const oyentes = new Set();
  const avisar = ()=> oyentes.forEach(f=>f([...datos.values()]));
  return {
    roster: {
      subscribe(alCambiar){ oyentes.add(alCambiar); alCambiar([...datos.values()]); return ()=>oyentes.delete(alCambiar); },
      async all(){ return [...datos.values()]; },
      async get(email){ return datos.get(email) || null; },
      async add(email, d){ datos.set(email, { ...d, email, approvedAt: 9000 }); avisar(); },
      async setRole(email, role){ datos.set(email, { ...datos.get(email), role }); avisar(); },
      async remove(email){ datos.delete(email); avisar(); },
    },
  };
}

const ctxRos = {
  state: { roster: [], auth:{ status:"admin", user:{ email:"benny@x.com" } } },
  __renders: 0, __backfill: null,
  store: rosterDeMentira([
    { email:"tarde@x.com",    name:"Tarde",    nickname:"tarde", approvedAt: 2000, role:"member" },
    { email:"temprano@x.com", name:"Temprano", nickname:"temp",  approvedAt: 1000, role:"observer" },
    { email:"sinnick@x.com",  name:"Sin Nick",                   approvedAt: 3000, role:"inventado" },
  ]),
};
const appRos = new Function("ctx", `
  const state = ctx.state;
  let store = ctx.store;
  let unsubRoster = null;
  function render(){ ctx.__renders++; }
  function backfillNicknames(emails){ ctx.__backfill = emails; }
  ${grab("ROLES")}
  ${grab("isAdmin")}
  ${grab("tsToMillis")}
  ${grab("firstWordFrom")}
  ${grab("nicknameFallback")}
  ${grab("subscribeRoster")}
  return { subscribeRoster, cortar: ()=>unsubRoster && unsubRoster() };
`)(ctxRos);

appRos.subscribeRoster();
eq("el equipo llega ordenado por antigüedad, no en el orden de la base",
   ctxRos.state.roster.map(u=>u.email), ["temprano@x.com","tarde@x.com","sinnick@x.com"]);
eq("a quien no tiene @nickname guardado se le arma uno, para poder etiquetarlo igual",
   ctxRos.state.roster.find(u=>u.email==="sinnick@x.com").nickname, "sinnick");
eq("y el admin se entera de que hay que completárselo de verdad",
   ctxRos.__backfill, ["sinnick@x.com"]);
eq("un rol que no existe se lee como 'member', nunca como admin",
   ctxRos.state.roster.find(u=>u.email==="sinnick@x.com").role, "member");
eq("y el rol guardado se respeta",
   ctxRos.state.roster.find(u=>u.email==="temprano@x.com").role, "observer");

await ctxRos.store.roster.setRole("tarde@x.com", "admin");
eq("un cambio de rol llega solo a la app, sin recargar",
   ctxRos.state.roster.find(u=>u.email==="tarde@x.com").role, "admin");
await ctxRos.store.roster.remove("tarde@x.com");
eq("y una revocación también",
   ctxRos.state.roster.map(u=>u.email), ["temprano@x.com","sinnick@x.com"]);

ctxRos.__backfill = null;
ctxRos.state.auth.status = "approved";
await ctxRos.store.roster.add("otro@x.com", { name:"Otro" });
eq("quien no es admin no intenta completar nicknames (las reglas se lo rechazarían)",
   ctxRos.__backfill, null);

const rendersAntesRos = ctxRos.__renders;
appRos.cortar();
await ctxRos.store.roster.add("nadie@x.com", { name:"Nadie", nickname:"nadie" });
eq("después de cortar, el equipo deja de llegar", ctxRos.__renders, rendersAntesRos);

/* ---------------------------------------------------------------
   PARTE 3 — nadie le habla a la base por afuera de la capa

   Toda lectura y escritura pasa por crearSupabaseStore, y el login por
   crearSupabaseSesion. Una consulta suelta en otro lado se saltea lo
   que la capa resuelve (los nombres, la hora del servidor, los adjuntos
   en el bucket, refrescar la lista después de escribir) y anda… hasta
   que no.
   --------------------------------------------------------------- */
const tramos = ["crearSupabaseStore", "crearSupabaseSesion"].map(n => {
  const desde = src.indexOf(`\nfunction ${n}(`);
  return [desde, desde + grab(n).length];
});
const adentro = i => tramos.some(([a, b]) => i >= a && i <= b);
const sueltas = [];
const RE_BASE = /\bsb\.(from|rpc|storage|channel|removeChannel|auth)\b/g;
for(let m; (m = RE_BASE.exec(src)); ){
  if(!adentro(m.index)) sueltas.push(src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index)).trim());
}
eq("la capa y la sesión existen (si no, esta prueba no prueba nada)", tramos.every(([a]) => a > 0), true);
eq("ninguna consulta, escritura o canal de Supabase por fuera de la capa", sueltas, []);
eq("y el cliente de Supabase se crea en un solo lugar", (src.match(/createClient\(/g) || []).length, 1);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
