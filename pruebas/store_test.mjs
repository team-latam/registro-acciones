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

/* ---------------------------------------------------------------
   PARTE 1 — la implementación de Firebase habla bien con Firestore
   --------------------------------------------------------------- */
const llamadas = [];
const docsFalsos = [
  { id:"julia@x.com", data:()=>({ name:"Julia", nickname:"julia" }) },
  { id:"sofia@x.com", data:()=>({ name:"Sofia", nickname:"sofia" }) },
];
let alCambiarGuardado = null;
const ctxFb = { fb:{
  collection: (db,n)=>({ col:n }),
  doc: (db,c,id)=>({ col:c, id }),
  serverTimestamp: ()=>"HORA_DEL_SERVIDOR",
  onSnapshot: (ref, ok, err)=>{ alCambiarGuardado = ok; llamadas.push(["onSnapshot", ref.col]); return ()=>llamadas.push(["cortar"]); },
  getDocs: async ref=>{ llamadas.push(["getDocs", ref.col]); return { docs: docsFalsos }; },
  setDoc: async (ref, d, opciones)=>{ llamadas.push(["setDoc", ref.col, ref.id, d, opciones]); },
  deleteDoc: async ref=>{ llamadas.push(["deleteDoc", ref.col, ref.id]); },
}};
const fbStore = new Function("ctx", `const fb = ctx.fb; const db = {};
  ${grab("tsToMillis")}
  ${grab("LIMITES_FIREBASE")}
  ${grab("firebaseStore")}
  return firebaseStore;`)(ctxFb);

const cortar = fbStore.formerMembers.subscribe(lista=>{ ctxFb.__ultima = lista; });
eq("suscribe a la colección correcta", llamadas[0], ["onSnapshot","formerMembers"]);
alCambiarGuardado({ docs: docsFalsos });
eq("entrega la lista entera, con el id adentro como email",
   ctxFb.__ultima, [{ email:"julia@x.com", name:"Julia", nickname:"julia" },
                    { email:"sofia@x.com", name:"Sofia", nickname:"sofia" }]);
cortar();
eq("devuelve una función para cortar", llamadas[llamadas.length-1], ["cortar"]);

eq("all() devuelve la misma forma que subscribe", await fbStore.formerMembers.all(),
   [{ email:"julia@x.com", name:"Julia", nickname:"julia" },
    { email:"sofia@x.com", name:"Sofia", nickname:"sofia" }]);

llamadas.length = 0;
await fbStore.formerMembers.save("julia@x.com", { name:"Julia", nickname:"julia" });
eq("save escribe en el documento del email", llamadas[0].slice(0,3), ["setDoc","formerMembers","julia@x.com"]);
eq("y la fecha la pone el servidor, no el reloj de quien escribe",
   llamadas[0][3].revokedAt, "HORA_DEL_SERVIDOR");
eq("sin pisar lo que le pasaron", llamadas[0][3].nickname, "julia");

llamadas.length = 0;
await fbStore.formerMembers.remove("sofia@x.com");
eq("remove borra ese documento", llamadas[0], ["deleteDoc","formerMembers","sofia@x.com"]);

/* ---------------------------------------------------------------
   PARTE 2 — LO QUE IMPORTA: la app anda con OTRA implementación.
   Es el ensayo de la migración: si el código de la app funciona
   contra un store que no tiene NADA de Firestore adentro, el día que
   exista el de Supabase va a funcionar igual.
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
eq("la app se llenó desde un store que no es Firebase",
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
   PARTE 2b — solicitudes de acceso y auditoría, contra Firestore
   --------------------------------------------------------------- */
llamadas.length = 0;
const consultas = [];
ctxFb.fb.query = (ref, ...partes)=>{ consultas.push([ref.col, ...partes]); return { col:ref.col, partes }; };
ctxFb.fb.orderBy = (campo, dir)=>`orderBy:${campo}:${dir}`;
ctxFb.fb.limit = n=>`limit:${n}`;
ctxFb.fb.getDoc = async ref=>({ id:ref.id, exists:()=>ctxFb.__existe !== false, data:()=>({ name:"Nuevo", status:"pending" }) });
ctxFb.fb.updateDoc = async (ref, d)=>{ llamadas.push(["updateDoc", ref.col, ref.id, d]); };
ctxFb.fb.addDoc = async (ref, d)=>{ llamadas.push(["addDoc", ref.col, d]); return { id: ctxFb.__idNuevo || "id_nuevo" }; };
ctxFb.fb.collectionGroup = (db, n)=>({ col:n, grupo:true });
ctxFb.fb.arrayUnion = e=>({ __suma:e });
ctxFb.fb.arrayRemove = e=>({ __saca:e });
ctxFb.fb.runTransaction = async (db, fn)=>{
  llamadas.push(["transaccion"]);
  await fn({ get: async ref=>({ exists: ()=> ctxFb.__yaExiste === true }),
             set: (ref, d)=> llamadas.push(["tx.set", ref.col, ref.id, d]) });
};
// Las subcolecciones llevan más de dos tramos: posts/<id>/replies/<id>.
ctxFb.fb.collection = (db, ...tramos)=>({ col: tramos.join("/") });
ctxFb.fb.doc = (db, ...tramos)=>({ col: tramos.slice(0, -1).join("/"), id: tramos[tramos.length-1] });
const fbStore2 = new Function("ctx", `const fb = ctx.fb; const db = {};
  ${grab("tsToMillis")}
  ${grab("LIMITES_FIREBASE")}
  ${grab("firebaseStore")}
  return firebaseStore;`)(ctxFb);

fbStore2.accessRequests.subscribe(()=>{});
eq("la cola del admin viene ordenada por fecha, la más nueva primero",
   consultas[0], ["accessRequests", "orderBy:requestedAt:desc"]);

alCambiarGuardado = null;
fbStore2.accessRequests.watchOwn("nuevo@x.com", r=>{ ctxFb.__propia = r; });
alCambiarGuardado({ id:"nuevo@x.com", exists:()=>true, data:()=>({ status:"pending" }) });
eq("la propia solicitud llega como objeto plano", ctxFb.__propia, { id:"nuevo@x.com", status:"pending" });
alCambiarGuardado({ exists:()=>false });
eq("y si no existe todavía, llega null (no un snapshot vacío)", ctxFb.__propia, null);

eq("get() devuelve el objeto, no un snapshot", await fbStore2.accessRequests.get("nuevo@x.com"),
   { id:"nuevo@x.com", name:"Nuevo", status:"pending" });
ctxFb.__existe = false;
eq("y null si no hay solicitud", await fbStore2.accessRequests.get("otro@x.com"), null);
ctxFb.__existe = true;

llamadas.length = 0;
await fbStore2.accessRequests.save("nuevo@x.com", { email:"nuevo@x.com", status:"pending" });
eq("guardar una solicitud escribe en su documento", llamadas[0].slice(0,3), ["setDoc","accessRequests","nuevo@x.com"]);
eq("y la hora la pone el servidor", llamadas[0][3].requestedAt, "HORA_DEL_SERVIDOR");

llamadas.length = 0;
await fbStore2.accessRequests.setStatus("nuevo@x.com", "approved");
eq("cambiar el estado toca SOLO ese campo", llamadas[0], ["updateDoc","accessRequests","nuevo@x.com",{ status:"approved" }]);

llamadas.length = 0;
await fbStore2.accessRequests.remove("nuevo@x.com");
eq("y borrar un pedido lo saca del todo (no es lo mismo que rechazarlo)",
   llamadas[0], ["deleteDoc","accessRequests","nuevo@x.com"]);

consultas.length = 0;
fbStore2.auditLog.subscribeRecent(1000, ()=>{});
eq("la auditoría viene con tope, no entera",
   consultas[0], ["auditLog", "orderBy:createdAt:desc", "limit:1000"]);

llamadas.length = 0;
await fbStore2.auditLog.add({ type:"access_approved" });
eq("una acción real entra con id propio", llamadas[0], ["addDoc","auditLog",{ type:"access_approved" }]);
await fbStore2.auditLog.addOnce("benny_login_2026-09-15", { type:"login" });
eq("un login entra con id fijo del día, para no repetirse",
   llamadas[1].slice(0,3), ["setDoc","auditLog","benny_login_2026-09-15"]);

/* ---------------------------------------------------------------
   PARTE 2c — el equipo (roster), contra Firestore
   --------------------------------------------------------------- */
llamadas.length = 0;
alCambiarGuardado = null;
fbStore2.roster.subscribe(lista=>{ ctxFb.__equipo = lista; });
eq("el equipo sale de la colección allowlist", llamadas[0], ["onSnapshot","allowlist"]);
alCambiarGuardado({ docs: docsFalsos });
eq("y llega como lista plana, con el email adentro",
   ctxFb.__equipo, [{ email:"julia@x.com", name:"Julia", nickname:"julia" },
                    { email:"sofia@x.com", name:"Sofia", nickname:"sofia" }]);

alCambiarGuardado = null;
fbStore2.roster.watchOwn("julia@x.com", m=>{ ctxFb.__mia = m; });
alCambiarGuardado({ id:"julia@x.com", exists:()=>true, data:()=>({ role:"admin" }) });
eq("la propia membresía llega como objeto plano", ctxFb.__mia, { email:"julia@x.com", role:"admin" });
alCambiarGuardado({ exists:()=>false });
eq("y null cuando esa persona NO está en el equipo (es lo que corta el acceso)", ctxFb.__mia, null);

eq("all() devuelve la lista, no snapshots", (await fbStore2.roster.all()).map(u=>u.email),
   ["julia@x.com","sofia@x.com"]);

llamadas.length = 0;
await fbStore2.roster.add("nuevo@x.com", { email:"nuevo@x.com", name:"Nuevo", role:"member" });
eq("aprobar escribe el documento de esa persona", llamadas[0].slice(0,3), ["setDoc","allowlist","nuevo@x.com"]);
eq("y la fecha de alta la pone el servidor", llamadas[0][3].approvedAt, "HORA_DEL_SERVIDOR");

llamadas.length = 0;
await fbStore2.roster.ensure("benny@x.com", { email:"benny@x.com", nickname:"benny", approvedAt:null });
eq("ensure() no pisa: escribe fusionando", llamadas[0][4], { merge:true });
eq("y si no tenía fecha de alta, se la pone el servidor", llamadas[0][3].approvedAt, "HORA_DEL_SERVIDOR");
llamadas.length = 0;
await fbStore2.roster.ensure("benny@x.com", { email:"benny@x.com", approvedAt:"ALTA_VIEJA" });
eq("pero si YA tenía fecha de alta, se respeta la vieja", llamadas[0][3].approvedAt, "ALTA_VIEJA");

llamadas.length = 0;
await fbStore2.roster.setRole("julia@x.com", "observer");
eq("cambiar el rol toca SOLO el rol", llamadas[0], ["updateDoc","allowlist","julia@x.com",{ role:"observer" }]);

llamadas.length = 0;
await fbStore2.roster.setNickname("julia@x.com", "juli");
eq("cambiar el @nickname no toca el nombre",
   llamadas[0], ["updateDoc","allowlist","julia@x.com",{ nickname:"juli" }]);
await fbStore2.roster.setNickname("vieja@x.com", "vieja", "Persona Vieja");
eq("salvo cuando se está completando un acceso viejo, que van los dos",
   llamadas[1], ["updateDoc","allowlist","vieja@x.com",{ nickname:"vieja", name:"Persona Vieja" }]);

llamadas.length = 0;
await fbStore2.roster.setCalendarShared("julia@x.com", true);
eq("al compartir el Calendar se anota también CUÁNDO (es lo que dispara el aviso)",
   llamadas[0][3], { calendarShared:true, calendarInviteSentAt:"HORA_DEL_SERVIDOR" });
await fbStore2.roster.setCalendarShared("julia@x.com", false);
eq("al sacar, solo el estado — no se pisa la hora del último envío",
   llamadas[1][3], { calendarShared:false });

llamadas.length = 0;
await fbStore2.roster.markTourSeen("julia@x.com");
eq("el tour se marca en la cuenta, con la hora del servidor",
   llamadas[0], ["updateDoc","allowlist","julia@x.com",{ tourSeenAt:"HORA_DEL_SERVIDOR" }]);

llamadas.length = 0;
await fbStore2.roster.remove("julia@x.com");
eq("revocar borra su documento", llamadas[0], ["deleteDoc","allowlist","julia@x.com"]);

/* ---------------------------------------------------------------
   PARTE 2d — el ensayo de verdad: el equipo, contra un store que
   no tiene NADA de Firestore adentro.
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
   PARTE 2e — configuración del equipo y preferencias de cada uno
   --------------------------------------------------------------- */
llamadas.length = 0; alCambiarGuardado = null;
fbStore2.config.watch("preferences", v=>{ ctxFb.__cfg = v; });
eq("la configuración se lee del documento que le pidan", llamadas[0], ["onSnapshot","meta"]);
alCambiarGuardado({ exists:()=>true, data:()=>({ activityTypes:["evento"] }) });
eq("y llega el contenido pelado, no un snapshot", ctxFb.__cfg, { activityTypes:["evento"] });
alCambiarGuardado({ exists:()=>false });
eq("si nunca se guardó nada, llega null y no un objeto vacío", ctxFb.__cfg, null);

llamadas.length = 0;
await fbStore2.config.replace("territoryConfig", { zones:{}, countryZones:{} });
eq("las zonas se guardan REEMPLAZANDO todo (un país que se sacó tiene que desaparecer)",
   llamadas[0][4], undefined);
await fbStore2.config.merge("preferences", { calendarId:"x" });
eq("pero las preferencias se guardan por partes (cuatro secciones en un documento)",
   llamadas[1][4], { merge:true });
eq("y solo con lo que cambió", llamadas[1][3], { calendarId:"x" });

llamadas.length = 0;
await fbStore2.config.mergeCalendarSync({ syncToken:"abc" });
eq("la sincronización anota también cuándo, con la hora del servidor",
   llamadas[0][3], { syncToken:"abc", lastSyncedAt:"HORA_DEL_SERVIDOR" });
eq("y por partes, para no borrar el token al anotar la hora", llamadas[0][4], { merge:true });

llamadas.length = 0; alCambiarGuardado = null;
fbStore2.userPrefs.watchOwn("juan@x.com", v=>{ ctxFb.__prefs = v; });
eq("las preferencias propias se ESCUCHAN (cambiar algo en la compu se ve en el celular)",
   llamadas[0], ["onSnapshot","userPrefs"]);
alCambiarGuardado({ exists:()=>true, data:()=>({ weekStart:1 }) });
eq("y llegan solas", ctxFb.__prefs, { weekStart:1 });
llamadas.length = 0;
await fbStore2.userPrefs.merge("juan@x.com", { dimPast:true });
eq("se guardan siempre por partes: son ~25 opciones y cada control guarda la suya",
   llamadas[0], ["setDoc","userPrefs","juan@x.com",{ dimPast:true },{ merge:true }]);

/* ---------------------------------------------------------------
   PARTE 2f — posteos y comentarios, que es el corazón de la app
   --------------------------------------------------------------- */
llamadas.length = 0; alCambiarGuardado = null;
fbStore2.posts.subscribe(l=>{ ctxFb.__posts = l; });
eq("los posteos se escuchan enteros", llamadas[0], ["onSnapshot","posts"]);
alCambiarGuardado({ docs:[
  { id:"p1", data:()=>({ title:"Uno", date:"2026-09-01" }) },
  { id:"p2", data:()=>({ title:"Dos", date:"2026-09-05" }) }] });
eq("y llegan como lista plana con el id adentro",
   ctxFb.__posts, [{ id:"p1", title:"Uno", date:"2026-09-01" },
                   { id:"p2", title:"Dos", date:"2026-09-05" }]);
eq("SIN ordenar: el orden lo decide la app, no la base",
   ctxFb.__posts.map(p=>p.id), ["p1","p2"]);

llamadas.length = 0;
ctxFb.__idNuevo = "p_recien_creado";
eq("crear devuelve el id nuevo (hace falta para enlazar el evento de Calendar)",
   await fbStore2.posts.create({ title:"T" }), "p_recien_creado");
eq("y la hora de creación la pone el servidor", llamadas[0][2].createdAt, "HORA_DEL_SERVIDOR");

llamadas.length = 0; ctxFb.__yaExiste = false;
await fbStore2.posts.createOnce("cal_evento1", { title:"Del Calendar" });
eq("importar de Calendar usa un id elegido y va en una transacción",
   llamadas.map(l=>l[0]), ["transaccion","tx.set"]);
llamadas.length = 0; ctxFb.__yaExiste = true;
await fbStore2.posts.createOnce("cal_evento1", { title:"Del Calendar otra vez" });
eq("si ese evento YA se importó, no lo vuelve a crear (dos navegadores no lo duplican)",
   llamadas.map(l=>l[0]), ["transaccion"]);

llamadas.length = 0;
await fbStore2.posts.setLike("p1", "juan@x.com", true);
eq("poner me gusta SUMA el propio correo, sin traerse ni pisar la lista",
   llamadas[0][3], { likedBy:{ __suma:"juan@x.com" } });
await fbStore2.posts.setLike("p1", "juan@x.com", false);
eq("y sacarlo, lo saca", llamadas[1][3], { likedBy:{ __saca:"juan@x.com" } });

llamadas.length = 0;
await fbStore2.posts.remove("p1");
eq("borrar de verdad borra el documento", llamadas[0], ["deleteDoc","posts","p1"]);

llamadas.length = 0; alCambiarGuardado = null;
const doc = (id, padre, data)=>({ id, ref:{ parent:{ parent:{ id:padre } } }, data:()=>data });
fbStore2.replies.subscribeAll(x=>{ ctxFb.__reps = x; });
eq("los comentarios se traen TODOS de una (un listener por posteo no escala)",
   llamadas[0], ["onSnapshot","replies"]);
alCambiarGuardado({ docs:[
  doc("r2","p1",{ content:"segunda", createdAt:2000 }),
  doc("r1","p1",{ content:"primera", createdAt:1000 }),
  doc("r3","p2",{ content:"de otro posteo", createdAt:500 })] });
eq("llegan agrupados por posteo", Object.keys(ctxFb.__reps).sort(), ["p1","p2"]);
eq("y ordenados del más viejo al más nuevo, aunque la base los mande al revés",
   ctxFb.__reps.p1.map(r=>r.id), ["r1","r2"]);
eq("cada uno sabe de qué posteo es", ctxFb.__reps.p1[0].postId, "p1");

llamadas.length = 0; consultas.length = 0;
fbStore2.replies.subscribeOf("p1", ()=>{});
eq("el respaldo por posteo sí pide el orden a la base",
   consultas[0], ["posts/p1/replies", "orderBy:createdAt:asc"]);

llamadas.length = 0;
await fbStore2.replies.create("p1", { content:"hola" });
eq("un comentario entra colgado de su posteo", llamadas[0][1], "posts/p1/replies");
eq("con la hora del servidor", llamadas[0][2].createdAt, "HORA_DEL_SERVIDOR");
await fbStore2.replies.setLike("p1", "r1", "ana@x.com", true);
eq("y el me gusta de un comentario también suma solo el propio correo",
   llamadas[1][3], { likedBy:{ __suma:"ana@x.com" } });

/* ---------------------------------------------------------------
   PARTE 2g — las dos cosas que la app pregunta sin saber de Firestore
   --------------------------------------------------------------- */
eq("la app pide 'la hora del servidor' sin saber cómo se escribe",
   fbStore2.horaDelServidor(), "HORA_DEL_SERVIDOR");
eq("y pregunta si un error es de permisos, en vez de mirar el código",
   fbStore2.esErrorDePermiso({ code:"permission-denied" }), true);
eq("un error de red NO es de permisos", fbStore2.esErrorDePermiso({ code:"unavailable" }), false);
eq("y sin error, tampoco", fbStore2.esErrorDePermiso(null), false);

/* ---------------------------------------------------------------
   PARTE 3 — nadie le habla a Firestore por afuera de la capa
   --------------------------------------------------------------- */
const iniCapa = src.indexOf("const firebaseStore = {");
const finCapa = src.indexOf("\nlet store = firebaseStore;");
const lineaDe = i => src.slice(0, i).split("\n").length - 1;
const desdeL = lineaDe(iniCapa), hastaL = lineaDe(finCapa);
const fuera = src.split("\n")
  .map((l, i) => ({ l, i }))
  .filter(({ l, i }) => /\bfb\.[a-zA-Z]/.test(l) && (i < desdeL || i > hastaL))
  .map(({ l }) => l.trim());

// Lo que de verdad importa: que no quede NINGUNA escritura suelta.
const escrituras = fuera.filter(l =>
  /fb\.(setDoc|addDoc|updateDoc|deleteDoc|runTransaction|onSnapshot|serverTimestamp|arrayUnion|arrayRemove)\b/.test(l));
eq("ninguna escritura a Firestore por fuera de la capa", escrituras, []);

// Y que las lecturas que quedan sean SOLO las del respaldo, que es a
// propósito: es la red de la marcha atrás y tiene que seguir mirando
// Firebase aunque la app ya escriba en otro lado.
eq("las únicas lecturas sueltas son las de la copia de seguridad",
   fuera.every(l => /fb\.(getDocs|getDoc|collection|collectionGroup|doc)\b/.test(l)), true);
eq("y son exactamente cuatro", fuera.length, 4);

// Las ocho colecciones, una por una.
for(const col of ["posts","replies","allowlist","formerMembers","accessRequests",
                  "auditLog","userPrefs","meta"]){
  const sueltas = src.split("\n")
    .map((l, i) => ({ l, i }))
    .filter(({ l, i }) => l.includes(`"${col}"`) && /\bfb\.[a-zA-Z]/.test(l)
                          && (i < desdeL || i > hastaL))
    .filter(({ l }) => !/fb\.(getDocs|getDoc)\b/.test(l))   // el respaldo
    .map(({ l }) => l.trim());
  eq(`ninguna escritura suelta sobre ${col}`, sueltas, []);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
