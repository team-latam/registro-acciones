import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as fb from "firebase/firestore";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab, hacerCuerpoClick, cuerpoDeListener } from "../grab.mjs";

/* ======================================================================
   firestore.rules contra el emulador de Firestore — el motor de reglas
   de verdad, no una lectura del archivo.

   Las reglas son la ÚNICA autorización del lado del servidor, y hasta acá
   no las corría nadie: cada cambio se publicaba a mano y se probaba en el
   simulador de la consola, de a un caso.

   Lo que escribe cada prueba sale del código de la app: el adaptador
   firebaseStore, el formulario de posteos, las respuestas y las acciones
   de Configuración, sacados de index.html en cada corrida. Así, si la app
   cambia la forma de lo que guarda y la regla no acompaña, esto se cae
   ANTES de que se caiga en producción. Lo único escrito a mano son los
   ataques: lo que la app nunca mandaría.

   Uso:  ./pruebas/reglas/correr.sh   (levanta el emulador y corre esto)
   Para comprobar que una prueba sirve: REGLAS=/otra/copia.rules o
   INDEX=/otra/copia/index.html.
   ====================================================================== */
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const reglas = fs.readFileSync(process.env.REGLAS || RAIZ + "firestore.rules", "utf8");
const grab = hacerGrab(src), cuerpoClick = hacerCuerpoClick(src);

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const primeraLinea = e => String(e && (e.message || e)).split("\n")[0].slice(0, 300);
async function acepta(nombre, hacer){
  try{ await hacer(); pass++; }
  catch(e){ fail++; console.log(`✗ ${nombre}\n   la base lo rechazó: ${e.code || ""} ${primeraLinea(e)}`); }
}
async function rechaza(nombre, hacer){
  try{ await hacer(); fail++; console.log(`✗ ${nombre}\n   la base lo dejó pasar`); }
  catch(e){
    if(e.code === "permission-denied") pass++;
    else { fail++; console.log(`✗ ${nombre}\n   falló, pero no por permiso: ${e.code || ""} ${primeraLinea(e)}`); }
  }
}

/* ---------- Quiénes ---------- */
const ADMIN = (/\nconst ADMIN_EMAIL = "([^"]+)";/.exec(src) || [])[1];
const ANA = "ana@ejemplo.com", OBS = "obs@ejemplo.com", JEFA = "jefa@ejemplo.com", NADIE = "nadie@ejemplo.com";

const env = await initializeTestEnvironment({ projectId: "demo-registro", firestore: { rules: reglas } });
fb.setLogLevel("silent");
// Una cuenta de Google con el mail verificado, que es lo único que la app
// usa. `extra` cambia lo que haga falta para probar las otras.
let cuentas = 0;
const dbDe = (email, extra = {}) => env.authenticatedContext("u" + (++cuentas),
  { email, email_verified: true, firebase: { sign_in_provider: "google.com", identities: {} }, ...extra }).firestore();
const crearStore = new Function("fb", "db",
  `${grab("tsToMillis")}\n${grab("LIMITES_FIREBASE")}\n${grab("firebaseStore")}\nreturn firebaseStore;`);
const storeDe = (email, extra) => crearStore(fb, dbDe(email, extra));

async function sembrar(){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    const alta = (email, extra = {}) => fb.setDoc(fb.doc(db, "allowlist", email),
      { email, name: email.split("@")[0], nickname: email.split("@")[0], ...extra });
    await alta(ANA); await alta(OBS, { role: "observer" }); await alta(JEFA, { role: "admin" });
    await alta(ADMIN, { role: "admin" });
  });
}
const leer = async (ruta) => {
  let datos = null;
  await env.withSecurityRulesDisabled(async ctx => {
    const snap = await fb.getDoc(fb.doc(ctx.firestore(), ...ruta.split("/")));
    datos = snap.exists() ? snap.data() : null;
  });
  return datos;
};

/* ---------- La app, para una persona ----------
   El código de verdad, con el adaptador de verdad apuntando al emulador.
   Lo único de mentira es lo que dibuja (render) y el Calendar. */
const ACCIONES = ["tipos-add", "tipo-doc-add", "tipos-save", "zonas-add-zone", "zonas-save"];
function appDe(email, nombre, extra){
  const store = storeDe(email, extra);
  const ctx = { pendientes: [], cerrado: 0, email, nombre };
  // Las acciones de Configuración y la edición mandan la escritura y
  // siguen sin esperarla (la pantalla se actualiza sola): se anota la
  // promesa para poder esperarla acá.
  const anotar = p => { ctx.pendientes.push(p); return p; };
  ctx.store = { ...store, config: { ...store.config,
    merge: (...a) => anotar(store.config.merge(...a)),
    replace: (...a) => anotar(store.config.replace(...a)) } };
  ctx.anotar = anotar;
  const app = new Function("ctx", `
    "use strict";
    const store = ctx.store;
    const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g,
      (todo, k) => (vars && k in vars) ? vars[k] : todo);
    const render = ()=>{};
    const appAlert = async m => { ctx.avisos = (ctx.avisos || []).concat([m]); };
    const currentLang = ()=> "es";
    const state = { auth:{ user:{ email: ctx.email, displayName: ctx.nombre } }, posts: [], repliesByPost: {} };
    ${["normalize","slugifyKey","todayISO","isoDate","isoDow",
       "ACTIVITY_TYPES","EVENTO_TYPES","ACTIVITY_BY_KEY","CALENDAR_SYNC_TYPES","DEFAULT_ACTIVITY_LABELS",
       "DOCS_POR_TIPO","docsEsperados","newTiposDraft","tiposDraft","getTiposDraft",
       "ZONES","COUNTRIES","newZonasDraft","zonasDraft","getZonasDraft","saveTerritoryConfig",
       "getPostById","topeLegible","MARGEN_DEL_POSTEO","pesoDelPosteo","excesoDePeso","excesoLegible",
       "mensajeDePeso","frenarSiNoEntra","createPost","createReply","updatePostDoc","parcheDeEdicion",
       "TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo",
       "limitesElegidos","maxImagenes","maxArchivos","maxBytesPorArchivo",
       "handleImageFiles","handleFileAttachments","newComposerDraft",
       "safeUrl","newScopeDraft","replyDrafts","openReplyForms","newReplyDraft","getReplyDraft",
       "resetReplyDraft","submitReply","newRutinaDraft","rutinaDraft","submitRutina"].map(grab).join("\n")}
    // Leer y achicar un archivo es cosa del navegador: acá el archivo de
    // prueba ya trae su contenido.
    const readFileAsDataUrl = async f => f.contenido;
    const compressImage = async f => f.contenido;
    const extractMentionsFromContent = ()=> [];
    const MAX_MENTIONS = 20;
    const tooManyMentionsMsg = ()=> "demasiadas menciones";
    const recurLinesFrom = ()=> null;
    const occurrenceOf = ()=> null;
    let composerDraft = null;
    const closeComposer = ()=>{ ctx.cerrado++; };
    const updatePostAndSync = (postId, original, newData)=> ctx.anotar(
      updatePostDoc(postId, parcheDeEdicion(original, newData)).then(()=>({ ok:true })));
    const showCalendarNotice = ()=>{};
    const syncToCalendar = async ()=> ({ ok:true });
    const enviar = async e => {${cuerpoDeListener(src, 'postForm.addEventListener("submit", async e=>{')}};
    const accion = {
      ${ACCIONES.map(a => `"${a}": async (el, e, action, postId) => {\n${cuerpoClick(a)}\n}`).join(",\n")}
    };
    return { state, accion, getTiposDraft, getZonasDraft, newComposerDraft, getReplyDraft, submitReply,
             rutina: ()=> rutinaDraft, submitRutina,
             // Lo que el admin eligió en Configuración > Adjuntos.
             elegirLimites: l => Object.assign(limitesElegidos, l),
             handleImageFiles, handleFileAttachments, createPost, updatePostDoc, parcheDeEdicion,
             publicar: async borrador => { composerDraft = borrador; await enviar({ preventDefault(){} }); return borrador; } };
  `)(ctx);
  app.store = store;
  app.ctx = ctx;
  // Esperar lo que quedó en vuelo, y una vuelta más para los .then().
  app.esperar = async () => { await Promise.allSettled(ctx.pendientes.splice(0)); await new Promise(r => setTimeout(r, 0)); };
  // Lo que la app tiene cargado: es contra eso que mide el peso al editar.
  app.cargar = async () => {
    const snap = await fb.getDocs(fb.collection(dbDe(ADMIN), "posts"));
    app.state.posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };
  return app;
}
const el = (data = {}) => ({ dataset: data });

// Una foto y un PDF como los deja la app después de leerlos.
const foto = kb => ({ name: "foto.jpg", type: "image/jpeg", size: kb * 1024,
  contenido: "data:image/jpeg;base64,/9j/" + "A".repeat(Math.max(0, Math.ceil(kb * 1024 * 4 / 3) - 4)) });
const pdf = (kb, nombre = "plan.pdf") => ({ name: nombre, type: "application/pdf", size: kb * 1024,
  contenido: "data:application/pdf;base64,JVBERi0" + "A".repeat(Math.max(0, Math.ceil(kb * 1024 * 4 / 3) - 7)) });
// Un evento listo para publicar, armado por el formulario de verdad.
async function borradorDe(app, cambios = {}, adjuntos = {}){
  const d = { ...app.newComposerDraft(), title: "Visita a Belice", content: "Reunión con la comunidad.",
    scopes: [{ type: "country", country: "Belice" }], ...cambios };
  if(adjuntos.fotos) await app.handleImageFiles(adjuntos.fotos, d.images);
  if(adjuntos.archivos) await app.handleFileAttachments(adjuntos.archivos, d.files);
  return d;
}

/* ===================== 1. Una sola fuente del admin ===================== */
{
  eq("hay ADMIN_EMAIL en index.html", !!ADMIN, true);
  eq("las reglas dan el admin al MISMO mail que index.html",
     reglas.includes(`request.auth.token.email == "${ADMIN}"`), true);
  eq("y nadie más figura como admin fijo en las reglas",
     [...reglas.matchAll(/request\.auth\.token\.email == "([^"]+)"/g)].map(m => m[1]).filter(m => m !== ADMIN), []);
  const sql = fs.readFileSync(RAIZ + "supabase/02-politicas.sql", "utf8");
  eq("y admin_fijo() de Supabase también", sql.includes(`'${ADMIN}'`), true);
}

/* ===================== 2. Quién entra ===================== */
await sembrar();
{
  const posts = db => fb.getDocs(fb.collection(db, "posts"));
  await rechaza("sin sesión no se lee nada", () => posts(env.unauthenticatedContext().firestore()));
  await rechaza("con Google pero sin aprobar, tampoco", () => posts(dbDe(NADIE)));
  await acepta("una persona aprobada lee los posteos", () => posts(dbDe(ANA)));
  await acepta("el observador también lee", () => posts(dbDe(OBS)));
  await acepta("el admin fijo, sin documento en la lista, también", () => posts(dbDe(ADMIN)));
  await rechaza("el mail del admin SIN verificar no alcanza", () => posts(dbDe(ADMIN, { email_verified: false })));
  await rechaza("ni con usuario y contraseña en vez de Google",
    () => posts(dbDe(ADMIN, { firebase: { sign_in_provider: "password", identities: {} } })));
  await acepta("sin aprobar, sí puede pedir acceso (su propia solicitud)",
    () => storeDe(NADIE).accessRequests.save(NADIE, { email: NADIE, name: "Nadie", photoURL: null, status: "pending" }));
  await rechaza("pero no la de otra persona",
    () => storeDe(NADIE).accessRequests.save("otra@ejemplo.com", { email: "otra@ejemplo.com", name: "Otra", photoURL: null, status: "pending" }));
}

/* ===================== 3. Posteos, con el formulario de verdad ===================== */
await sembrar();
let postDeAna = null;
{
  const ana = appDe(ANA, "Ana");
  const d = await borradorDe(ana, {}, { fotos: [foto(40)], archivos: [pdf(60)] });
  eq("(el formulario armó el adjunto, con su forma de verdad)", [d.images.length, d.files.length, d.files[0].kind], [1, 1, "pdf"]);
  await ana.publicar(d);
  eq("una persona aprobada publica un evento con foto y PDF", [d.error, ana.ctx.cerrado], ["", 1]);
  await ana.cargar();
  postDeAna = ana.state.posts.find(p => p.title === "Visita a Belice");
  eq("y quedó guardado, firmado por ella", postDeAna && postDeAna.authorEmail, ANA);

  const obs = appDe(OBS, "Obs");
  const d2 = await borradorDe(obs);
  await obs.publicar(d2);
  eq("el observador no publica (y el formulario lo dice)", /No se pudo publicar/.test(d2.error), true);

  const datos = { title: "Falso", content: "x", startDate: "2026-10-01", endDate: "2026-10-01", date: "2026-10-01",
    activityType: "visita", scopes: [], images: [], links: [], files: [], mentions: [], participants: [],
    authorName: "Jefa", authorEmail: JEFA };
  await rechaza("nadie publica firmando como otra persona", () => ana.store.posts.create(datos));
  await rechaza("ni con un adjunto que es una página web disfrazada",
    () => ana.store.posts.create({ ...datos, authorName: "Ana", authorEmail: ANA,
      files: [{ name: "x.html", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" }] }));
}
{
  // Editar con el formulario de verdad: lo que sale de parcheDeEdicion().
  const jefa = appDe(JEFA, "Jefa");
  await jefa.cargar();
  const original = jefa.state.posts.find(p => p.id === postDeAna.id);
  const d = { ...jefa.newComposerDraft(), title: original.title + " (editado)", content: original.content,
    startDate: original.startDate, endDate: original.endDate, activityType: original.activityType,
    scopes: original.scopes, images: original.images, files: original.files, links: original.links,
    participants: original.participants || [], editingPost: original };
  await jefa.publicar(d);
  await jefa.esperar();
  eq("otra persona del equipo edita un evento (los eventos son de todos)", d.error, "");
  eq("y la edición quedó", (await leer("posts/" + postDeAna.id)).title, "Visita a Belice (editado)");
  eq("firmada por quien editó", (await leer("posts/" + postDeAna.id)).lastEditedBy, "Jefa");
}
{
  const ana = appDe(ANA, "Ana");
  const jefa = appDe(JEFA, "Jefa");
  await acepta("dar «me gusta» con el botón de la app", () => jefa.store.posts.setLike(postDeAna.id, JEFA, true));
  await acepta("y sacarlo", () => jefa.store.posts.setLike(postDeAna.id, JEFA, false));
  await rechaza("pero no poner el «me gusta» de otra persona", () => jefa.store.posts.setLike(postDeAna.id, ANA, true));
  await rechaza("ni reescribir la lista entera",
    () => fb.updateDoc(fb.doc(dbDe(JEFA), "posts", postDeAna.id), { likedBy: [JEFA, "otro@ejemplo.com"] }));
  await rechaza("el observador no da «me gusta»", () => appDe(OBS, "Obs").store.posts.setLike(postDeAna.id, OBS, true));
  await rechaza("borrar un posteo: ni la autora", () => ana.store.posts.remove(postDeAna.id));
  await rechaza("ni una admin por rol", () => jefa.store.posts.remove(postDeAna.id));
  await rechaza("cambiar de quién es un posteo",
    () => ana.store.posts.update(postDeAna.id, { authorEmail: JEFA, authorName: "Jefa" }));
}
{
  // Una Rutina es de quien la escribe: los demás no la tocan.
  const ana = appDe(ANA, "Ana");
  const d = ana.rutina();
  d.content = "Rutina del lunes";
  await ana.submitRutina();
  eq("una persona publica su rutina, con el formulario de rutinas", d.error, "");
  await ana.cargar();
  const rutina = ana.state.posts.find(p => p.title === "Rutina del lunes");
  await rechaza("otra persona no la edita, aunque sea admin por rol",
    () => appDe(JEFA, "Jefa").updatePostDoc(rutina.id, { title: "Cambiada" }));
  await acepta("la autora sí", () => ana.updatePostDoc(rutina.id, { title: "Rutina del martes" }));
}

/* ===================== 4. El techo de 1 MiB, contra la base ===================== */
{
  // Lo que el control de peso deja pasar, Firestore lo tiene que aceptar:
  // si no, el margen está mal y el error de la base vuelve a aparecer.
  const ana = appDe(ANA, "Ana");
  ana.elegirLimites({ bytesPorArchivo: 500 * 1024 });   // el techo de la base
  const d = await borradorDe(ana, { title: "Al límite" }, { archivos: [pdf(382, "a.pdf"), pdf(382, "b.pdf")] });
  eq("(los dos archivos entraron al formulario)", d.files.length, 2);
  const medida = new Function("store", `${grab("MARGEN_DEL_POSTEO")}\n${grab("pesoDelPosteo")}\nreturn { MARGEN_DEL_POSTEO, pesoDelPosteo };`)(ana.store);
  // Se completa con texto hasta quedar justo debajo de lo que el control
  // deja pasar.
  const base = { title: d.title, content: "", startDate: d.startDate, endDate: d.endDate, date: d.startDate,
    startTime: null, endTime: null, participants: [], location: null, activityType: d.activityType, scopes: d.scopes,
    images: d.images, links: [], files: d.files, mentions: [], recurrence: null, authorName: "Ana", authorEmail: ANA };
  const libre = 1024 * 1024 - medida.MARGEN_DEL_POSTEO - medida.pesoDelPosteo(base) - 30;
  eq("(el caso de prueba entra en el contenido permitido)", libre > 0 && libre <= 5000, true);
  d.content = "x".repeat(libre);
  await ana.publicar(d);
  eq("lo que el control deja pasar, Firestore lo acepta", d.error, "");
}

/* ===================== 5. Respuestas ===================== */
{
  const ana = appDe(ANA, "Ana");
  await ana.cargar();
  const r = ana.getReplyDraft(postDeAna.id);
  r.content = "¡Qué buen viaje!";
  await ana.submitReply(postDeAna.id);
  eq("una persona aprobada responde con el formulario de verdad", r.scopeError || "", "");
  const obs = appDe(OBS, "Obs");
  await obs.cargar();
  const r2 = obs.getReplyDraft(postDeAna.id);
  r2.content = "Yo también";
  await obs.submitReply(postDeAna.id);
  eq("el observador no responde (y se le dice)", /No se pudo publicar la respuesta/.test(r2.scopeError || ""), true);
  await rechaza("nadie responde firmando como otra persona",
    () => ana.store.replies.create(postDeAna.id, { authorName: "Jefa", authorEmail: JEFA, content: "hola" }));
}

/* ===================== 6. El equipo ===================== */
{
  const jefa = appDe(JEFA, "Jefa"), ana = appDe(ANA, "Ana");
  await rechaza("una admin por rol no se cambia su propio rol", () => jefa.store.roster.setRole(JEFA, "member"));
  await rechaza("ni toca al admin fijo", () => jefa.store.roster.setRole(ADMIN, "member"));
  await acepta("pero sí el rol de otra persona", () => jefa.store.roster.setRole(OBS, "member"));
  await rechaza("un integrante no cambia roles", () => ana.store.roster.setRole(OBS, "admin"));
  await acepta("cada uno cambia su @nickname", () => ana.store.roster.setNickname(ANA, "anita"));
  await rechaza("pero no el de otra persona", () => ana.store.roster.setNickname(JEFA, "jefecita"));
  await rechaza("y con forma de nickname, nada de HTML", () => ana.store.roster.setNickname(ANA, "<b>ana</b>"));
  await acepta("cada uno guarda su configuración personal", () => ana.store.userPrefs.merge(ANA, { weekStart: 1 }));
  await rechaza("pero no la de otra persona", () => ana.store.userPrefs.merge(JEFA, { weekStart: 1 }));
  await rechaza("ni campos que no existen", () => ana.store.userPrefs.merge(ANA, { cualquierCosa: "x".repeat(1000) }));
}

/* ===================== 7. Tipos de actividad, con la pantalla de verdad ===================== */
await sembrar();
async function guardarTipos(app, armar){
  const d = app.getTiposDraft();
  await armar(d);
  await app.accion["tipos-save"](el());
  await app.esperar();
  return d;
}
async function sumarTipo(app, d, nombre, icono, docs = []){
  d.newLabel = nombre; d.newIcon = icono;
  await app.accion["tipos-add"](el());
  const key = d.types[d.types.length - 1].key;
  for(const doc of docs){ d.nuevoDoc[key] = doc; await app.accion["tipo-doc-add"](el({ key })); }
  return key;
}
{
  const admin = appDe(ADMIN, "Benny");
  const d = await guardarTipos(admin, async d => {
    await sumarTipo(admin, d, "Visita pastoral", "🕍", ["Plan de viaje", "Reporte de cierre"]);
    d.nuevoDoc.visita = "Plan de viaje";
    await admin.accion["tipo-doc-add"](el({ key: "visita" }));
  });
  eq("el admin fijo guarda los tipos con un tipo nuevo y sus documentos", d.error, "");
  const guardado = (await leer("meta/preferences")).activityTypes;
  eq("y quedan los seis de fábrica más el nuevo", guardado.length, 7);
  eq("con sus documentos esperados", guardado.find(t => t.key === "visitapastoral").docs.map(x => x.label),
     ["Plan de viaje", "Reporte de cierre"]);
}
{
  // El peor caso que permite la pantalla: el tope de tipos, cada uno con
  // el nombre más largo y el tope de documentos con el nombre más largo.
  // Lo guarda una admin por rol, que es el camino de la regla que más
  // cuesta (se evalúa el admin fijo, que da no, y después su rol).
  const jefa = appDe(JEFA, "Jefa");
  const d = await guardarTipos(jefa, async d => {
    for(let i = d.types.length; i < 20; i++){
      await sumarTipo(jefa, d, ("Tipo de actividad número " + i).padEnd(30, "x").slice(0, 30), "🏛️",
        Array.from({ length: 10 }, (_, j) => ("Documento esperado número " + j).padEnd(60, "y")));
    }
  });
  eq("(son 20 tipos con 10 documentos cada uno)", [d.types.length, d.types[19].docs.length], [20, 10]);
  eq("una admin por rol guarda el tope de tipos sin pasar el límite de la base", d.error, "");
}
{
  const ana = appDe(ANA, "Ana");
  const d = await guardarTipos(ana, async d => { await sumarTipo(ana, d, "Taller", "🛠️"); });
  eq("un integrante no puede guardar los tipos (y la pantalla lo dice)", /No se pudo guardar/.test(d.error), true);
}
{
  // Ataques: lo que la pantalla no deja hacer, pero alguien podría
  // mandar directo a la base con las credenciales de un admin.
  const admin = storeDe(ADMIN);
  const actuales = (await leer("meta/preferences")).activityTypes;
  const con = (cambio) => admin.config.merge("preferences", { activityTypes: cambio(actuales.map(t => ({ ...t }))) });
  await rechaza("un tipo 21", () => con(l => l.concat([{ key: "otro21", label: "Otro", icon: "✨", calendarSync: true }])));
  await rechaza("un nombre de 5.000 caracteres", () => con(l => { l[0].label = "x".repeat(5000); return l; }));
  await rechaza("un ícono de 1 KB", () => con(l => { l[0].icon = "x".repeat(1024); return l; }));
  await rechaza("una clave con HTML", () => con(l => { l[0].key = "<img src=x>"; return l; }));
  await rechaza("un campo que la app no escribe", () => con(l => { l[0].html = "<script>"; return l; }));
  await rechaza("once documentos esperados", () => con(l => { l[0].docs = Array.from({ length: 11 }, (_, i) => ({ id: "d" + i, label: "D" })); return l; }));
  await rechaza("calendarSync que no es sí o no", () => con(l => { l[0].calendarSync = "x".repeat(500); return l; }));
  await rechaza("algo que no es una lista", () => admin.config.merge("preferences", { activityTypes: { a: 1 } }));
  await acepta("y lo de siempre sigue entrando (control del control)", () => con(l => l));
}
{
  // Las otras secciones de Preferencias guardan con merge sobre el MISMO
  // documento: la regla mira el documento entero, tipos incluidos.
  const admin = appDe(ADMIN, "Benny");
  await acepta("guardar el Calendar con los tipos ya guardados", () => admin.store.config.merge("preferences", { calendarId: "equipo@group.calendar.google.com" }));
  await acepta("y los topes de adjuntos", () => admin.store.config.merge("preferences", { maxImages: 4, maxAttachmentFiles: 2, maxAttachmentFileBytes: 300 * 1024 }));
  await rechaza("pero no un tope de archivo más grande que el de la base",
    () => admin.store.config.merge("preferences", { maxAttachmentFileBytes: 900 * 1024 }));
}

/* ===================== 8. Zonas, con la pantalla de verdad ===================== */
await sembrar();
async function guardarZonas(app, armar){
  const d = app.getZonasDraft();
  await armar(d);
  await app.accion["zonas-save"](el());
  await app.esperar();
  return d;
}
async function sumarZona(app, d, nombre){
  d.newZoneLabel = nombre;
  await app.accion["zonas-add-zone"](el());
  return d.zoneOrder[d.zoneOrder.length - 1];
}
{
  const admin = appDe(ADMIN, "Benny");
  const d = await guardarZonas(admin, async d => {
    const caribe = await sumarZona(admin, d, "Caribe");
    d.countryZones["Cuba"] = caribe;
    d.zones[caribe].color = "#0ea5e9";
  });
  eq("el admin suma una zona y le pasa un país", d.error, "");
  const guardado = await leer("meta/territoryConfig");
  eq("y queda guardado", [Object.keys(guardado.zones).length, guardado.countryZones["Cuba"]], [4, "caribe"]);
}
{
  const jefa = appDe(JEFA, "Jefa");
  const d = await guardarZonas(jefa, async d => {
    while(d.zoneOrder.length < 20) await sumarZona(jefa, d, ("Zona número " + d.zoneOrder.length).padEnd(30, "z"));
  });
  eq("una admin por rol guarda el tope de zonas sin pasar el límite de la base", [d.zoneOrder.length, d.error], [20, ""]);
}
{
  const ana = appDe(ANA, "Ana");
  const d = await guardarZonas(ana, async d => { await sumarZona(ana, d, "Andina"); });
  eq("un integrante no puede guardar zonas (y la pantalla lo dice)", /No se pudo guardar/.test(d.error), true);
}
{
  const admin = storeDe(ADMIN);
  const actual = await leer("meta/territoryConfig");
  const con = cambio => { const c = JSON.parse(JSON.stringify(actual)); cambio(c); return admin.config.replace("territoryConfig", c); };
  await rechaza("una zona 21", () => con(c => { c.zones.extra = { label: "Extra", color: "#000000" }; }));
  await rechaza("un color que no es un color (va adentro de un style=)",
    () => con(c => { c.zones.sur.color = "red;background:url(https://x)"; }));
  await rechaza("un nombre de zona de 5.000 caracteres", () => con(c => { c.zones.sur.label = "x".repeat(5000); }));
  await rechaza("un campo de más en una zona", () => con(c => { c.zones.sur.html = "<b>"; }));
  await rechaza("un país en una zona que no existe", () => con(c => { c.countryZones["Chile"] = "inventada"; }));
  await rechaza("un valor de país gigante", () => con(c => { c.countryZones["Chile"] = "x".repeat(5000); }));
  await rechaza("61 países", () => con(c => { for(let i = 0; i < 20; i++) c.countryZones["País " + i] = "sur"; }));
  await rechaza("un campo de más en el documento", () => con(c => { c.extra = "x"; }));
  await rechaza("sin zonas", () => con(c => { c.zones = {}; c.countryZones = {}; }));
  await acepta("y lo de siempre sigue entrando (control del control)", () => con(() => {}));
}

await env.cleanup();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
