import fs from "node:fs";
import { hacerGrab, recorrer } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
const grab = hacerGrab(src);

/* ======================================================================
   El peso del posteo ENTERO.

   En Firestore el posteo va en un solo documento, con las fotos y los
   archivos adentro en base64, y el documento no puede pasar de 1 MiB. Los
   topes por archivo dejaban pasar dos de 500 KB, que juntos pesan 1,3 MB:
   eso se descubría al guardar, con el error de Firestore en inglés, y al
   editar con la ventana ya cerrada — la edición se perdía.

   Lo que se prueba:
   1. que la medida nunca quede POR DEBAJO de lo que cuenta Firestore
      (si no, el control deja pasar algo que la base rechaza);
   2. que las tres funciones por donde pasa toda escritura frenen lo que
      no entra, y dejen pasar lo que sí;
   3. que un posteo que ya está al límite se pueda seguir tocando;
   4. que el formulario avise ANTES de cerrarse;
   5. que en Supabase no se frene nada (ahí el archivo va al bucket).
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const KB = 1024, MB = 1024 * 1024;
// Un archivo de `crudos` bytes, como queda adentro del posteo: en base64.
const base64De = crudos => 4 * Math.ceil(crudos / 3);
const archivo = (crudos, extra = {}) => ({ name:"a.pdf", mime:"application/pdf", kind:"pdf",
  dataUrl: "data:application/pdf;base64," + "A".repeat(base64De(crudos)), ...extra });
const foto = crudos => "data:image/jpeg;base64," + "B".repeat(base64De(crudos));
const SERVIDOR = { _methodName:"serverTimestamp" };   // lo que devuelve fb.serverTimestamp()

// El cuerpo de un listener que no tiene nombre: desde la { hasta la que
// la cierra, con el mismo recorrido que usa grab().
function cuerpoDe(cabeza){
  const i = src.indexOf(cabeza);
  if(i < 0) throw new Error("no se encontró " + cabeza);
  const abre = i + cabeza.length - 1;
  for(const [j, c, prof] of recorrer(src, abre)) if(c === "}" && prof === 0) return src.slice(abre + 1, j);
  throw new Error("no cerró " + cabeza);
}

function armar(opts = {}){
  const reg = { creados:[], respuestas:[], actualizados:[], cerrado:0, ediciones:[], avisos:[] };
  const api = new Function("ctx", `
    "use strict";
    const reg = ctx.reg;
    const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g,
      (todo, k) => (vars && k in vars) ? vars[k] : todo);
    const render = ()=>{};
    ${grab("LIMITES_FIREBASE")}
    ${grab("LIMITES_SUPABASE")}
    const store = {
      limites: ctx.base === "supabase" ? LIMITES_SUPABASE : LIMITES_FIREBASE,
      horaDelServidor: ()=> ({ _methodName:"serverTimestamp" }),
      posts: {
        create: async d => { reg.creados.push(d); return "nuevo"; },
        update: async (id, p) => { reg.actualizados.push({ id, p }); },
      },
      replies: { create: async (id, d) => { reg.respuestas.push({ id, d }); } },
    };
    const state = { auth:{ user:{ email:"ana@x.com", displayName:"Ana" } }, posts: ctx.posts };
    ${["getPostById","topeLegible","MARGEN_DEL_POSTEO","pesoDelPosteo","excesoDePeso","excesoLegible",
       "mensajeDePeso","frenarSiNoEntra","createPost","createReply","updatePostDoc","parcheDeEdicion"]
      .map(grab).join("\n")}

    // El submit del formulario de posteos, tal cual está en index.html.
    let composerDraft = ctx.borrador;
    const safeUrl = u => u;
    const extractMentionsFromContent = ()=> [];
    const MAX_MENTIONS = 20;
    const tooManyMentionsMsg = ()=> "demasiadas menciones";
    const recurLinesFrom = ()=> null;
    const closeComposer = ()=>{ reg.cerrado++; };
    const updatePostAndSync = async (...a)=>{ reg.ediciones.push(a); return { ok:true }; };
    const showCalendarNotice = ()=>{};
    const CALENDAR_SYNC_TYPES = new Set();
    const syncToCalendar = async ()=> ({ ok:true });
    const enviar = async e => {${cuerpoDe('postForm.addEventListener("submit", async e=>{')}};

    return { store, MARGEN_DEL_POSTEO, pesoDelPosteo, excesoDePeso, excesoLegible, mensajeDePeso,
             createPost, createReply, updatePostDoc, parcheDeEdicion,
             enviar: ()=> enviar({ preventDefault(){} }) };
  `)({ reg, posts: opts.posts || [], base: opts.base, borrador: opts.borrador });
  return { reg, api };
}
const fallaCon = async promesa => { try{ await promesa; return null; } catch(err){ return err.message; } };

/* ---------- 1. La medida nunca queda por debajo de la de Firestore ----------
   El cálculo de Firestore, como lo publica su documentación ("Storage size
   calculations"): texto = bytes UTF-8 + 1; número, fecha = 8; booleano y
   null = 1; un array suma sus elementos; un mapa, como un documento, suma
   nombre + valor de cada campo; el documento además lleva su nombre
   (cada tramo de la ruta + 1, más 16) y 32 bytes fijos. */
const utf8 = s => Buffer.byteLength(s, "utf8");
function tamValor(v){
  if(v === null || typeof v === "boolean") return 1;
  if(typeof v === "number") return 8;
  if(typeof v === "string") return utf8(v) + 1;
  if(Array.isArray(v)) return v.reduce((a, x) => a + tamValor(x), 0);
  if(v._methodName === "serverTimestamp") return 8;
  return Object.entries(v).reduce((a, [k, x]) => a + utf8(k) + 1 + tamValor(x), 0);
}
const tamFirestore = (ruta, campos) => ruta.split("/").reduce((a, p) => a + utf8(p) + 1, 0) + 16 + tamValor(campos) + 32;

const ID = "Xk3pQ9aZbT7mN2vL8rWc";   // como los que genera Firestore
const posteoCompleto = {
  title:"Visita a Belice — reunión con el ministerio", content:"Llegamos el martes. ".repeat(200),
  startDate:"2026-09-28", endDate:"2026-10-02", date:"2026-09-28", startTime:"09:00", endTime:"18:30",
  participants:["ana@x.com","benny@team-latam.com","carla@x.com"], location:"Belmopán",
  activityType:"visita", scopes:[{ type:"country", country:"BZ" },{ type:"region", region:"centroamerica" }],
  images:[foto(180*KB), foto(150*KB)], links:[{ url:"https://drive.google.com/x", label:"Fotos" }],
  files:[archivo(200*KB, { doc:"plan", subidoEl:"2026-09-20T12:00:00.000Z" })],
  mentions:["carla"], recurrence:null, authorName:"Ana", authorEmail:"ana@x.com",
  createdAt:SERVIDOR, lastEditedAt:SERVIDOR, lastEditedBy:"Ana", cancelled:false, isProject:true,
  milestones:[{ id:"m1", label:"Pasajes", date:"2026-09-01", done:true },{ id:"m2", label:"Informe", date:null, done:false }],
  editors:["carla@x.com"], likedBy:["carla@x.com"], recurrenceSkip:["2026-10-05"], recurrenceMoves:{ "2026-10-12":"2026-10-13" },
  calendarEventId:"abc123def456", projectStatus:"open", projectDoneBy:null, projectDoneAt:null,
};
const respuestaCompleta = { authorName:"Ana", authorEmail:"ana@x.com", content:"שלום! ¿Cómo va? ".repeat(50),
  scopes:[], images:[foto(90*KB)], links:[], files:[], mentions:[], occ:"2026-10-05", replyToId:"r1",
  system:false, createdAt:SERVIDOR };
{
  const { api } = armar();
  const casos = [
    ["un posteo con todos los campos que escribe la app", "posts/" + ID, posteoCompleto],
    ["un posteo mínimo, sin adjuntos", "posts/" + ID, { title:"a", content:"b", date:"2026-01-01", images:[], files:[], cancelled:true }],
    ["una respuesta en hebreo (texto de varios bytes)", `posts/${ID}/replies/${ID}`, respuestaCompleta],
  ];
  for(const [nombre, ruta, doc] of casos){
    const medido = api.pesoDelPosteo(doc), real = tamFirestore(ruta, doc);
    eq(`${nombre}: con el margen, la medida no queda por debajo de Firestore`,
       medido + api.MARGEN_DEL_POSTEO >= real, true);
    // Y tampoco se pasa de largo: medir de más es frenar un posteo que
    // entraba.
    eq(`${nombre}: ni frena más de 2 KB antes de tiempo`, medido - real < 2 * KB, true);
  }
  eq("cuenta bytes, no letras: «ש» son dos bytes", api.pesoDelPosteo("ש") - api.pesoDelPosteo("a"), 1);
}

/* ---------- 2. Lo que se lee en el aviso ---------- */
{
  const { api } = armar();
  eq("lo que sobra se redondea para arriba", api.excesoLegible(1025), "2 KB");
  eq("nunca dice que sobran 0 KB", api.excesoLegible(10), "1 KB");
  eq("y en MB, también para arriba", api.excesoLegible(1.21 * MB), "1.3 MB");
  const m = api.mensajeDePeso(300 * KB);
  eq("el aviso dice cuánto sobra y cuál es el máximo",
     [m.includes("300 KB"), m.includes("1 MB")], [true, true]);
  eq("y qué hacer", /Sacá alguna foto o algún archivo/.test(m), true);
}

/* ---------- 3. Publicar y responder ---------- */
{
  const { api, reg } = armar();
  const dos = { title:"a", content:"b", images:[], files:[archivo(500*KB), archivo(500*KB)] };
  const error = await fallaCon(api.createPost(dos));
  eq("dos archivos de 500 KB no se mandan: cada uno entra, juntos no", reg.creados.length, 0);
  eq("y el error dice cuánto sacar, no el de Firestore en inglés", /se pasa por \d+ KB del máximo de 1 MB/.test(error || ""), true);
  await fallaCon(api.createPost({ title:"a", content:"b", images:[], files:[archivo(500*KB)] }));
  eq("uno solo sí", reg.creados.length, 1);
  const seis = { title:"a", content:"b", files:[], images:Array.from({ length:6 }, ()=> foto(200*KB)) };
  eq("seis fotos pesadas tampoco entran, aunque sean el máximo de fotos", !!(await fallaCon(api.createPost(seis))), true);
}
{
  const { api, reg } = armar();
  const error = await fallaCon(api.createReply("p1", { content:"x", images:[foto(400*KB)], files:[archivo(400*KB)] }));
  eq("una respuesta tiene el mismo techo (es otro documento, con el suyo)", [reg.respuestas.length, !!error], [0, true]);
  await fallaCon(api.createReply("p1", { content:"x", images:[foto(300*KB)], files:[] }));
  eq("y la que entra se manda", reg.respuestas.length, 1);
}

/* ---------- 4. Editar algo que ya está guardado ---------- */
{
  const post = { id:"p1", title:"a", content:"b", images:[foto(300*KB)], files:[archivo(400*KB)] };
  const { api, reg } = armar({ posts:[post] });
  const error = await fallaCon(api.updatePostDoc("p1", { files:[archivo(400*KB), archivo(400*KB)] }));
  eq("sumarle un archivo que no entra se frena", [reg.actualizados.length, !!error], [0, true]);
  await fallaCon(api.updatePostDoc("p1", { files:[] }));
  eq("sacarle uno, se manda", reg.actualizados.length, 1);
}
{
  // Un posteo que la base aceptó pero que quedó adentro del margen: más
  // pesado que lo que hoy dejaría publicar el control. Tiene que poder
  // seguir tocándose — cancelarlo, vincularlo al Calendar, sacarle algo.
  const { api: medir } = armar();
  const base = { id:"p1", title:"a", content:"b", images:[], files:[] };
  const relleno = 1024 * 1024 - 300 - medir.pesoDelPosteo({ ...base, images:[""] });
  const post = { ...base, images:[ "C".repeat(relleno) ] };
  const { api, reg } = armar({ posts:[post] });
  eq("(el posteo de prueba está adentro del margen)", api.excesoDePeso(post) > 0, true);
  eq("cancelarlo desde el Calendar no se frena",
     await fallaCon(api.updatePostDoc("p1", { cancelled:true, lastEditedAt:SERVIDOR, lastEditedBy:"Google Calendar" })), null);
  eq("guardarle el vínculo con el evento tampoco", await fallaCon(api.updatePostDoc("p1", { calendarEventId:"abc123" })), null);
  eq("ni sacarle la foto", await fallaCon(api.updatePostDoc("p1", { images:[] })), null);
  eq("(las tres llegaron a la base)", reg.actualizados.length, 3);
  const error = await fallaCon(api.updatePostDoc("p1", { files:[archivo(20*KB)] }));
  eq("pero sumarle un archivo, sí", [reg.actualizados.length, !!error], [3, true]);
}
{
  const { api, reg } = armar({ posts:[] });
  await fallaCon(api.updatePostDoc("otro", { files:[archivo(500*KB), archivo(500*KB)] }));
  eq("un posteo que no está cargado no se adivina: decide la base", reg.actualizados.length, 1);
}

/* ---------- 5. El formulario avisa ANTES de cerrarse ---------- */
const borrador = (extra = {}) => ({ title:"Visita", content:"Contenido", scopes:[{ type:"latam" }],
  startDate:"2026-10-01", endDate:"2026-10-01", allDay:true, startTime:"", endTime:"",
  links:[], participants:[], location:"", activityType:"visita", images:[], files:[],
  recur:null, recurrence:null, editingPost:null, submitting:false, error:"", ...extra });
{
  const d = borrador({ files:[archivo(500*KB), archivo(500*KB)] });
  const { api, reg } = armar({ borrador:d });
  await api.enviar();
  eq("publicar algo que no entra: no se manda", reg.creados.length, 0);
  eq("la ventana queda abierta, con todo lo escrito", [reg.cerrado, d.title, d.files.length], [0, "Visita", 2]);
  eq("con el aviso en el formulario", /^No se pudo publicar: con lo adjunto se pasa por/.test(d.error), true);
  eq("y el botón vuelve a estar disponible", d.submitting, false);
}
{
  const d = borrador({ files:[archivo(500*KB)] });
  const { api, reg } = armar({ borrador:d });
  await api.enviar();
  eq("lo que entra se publica y la ventana se cierra", [reg.creados.length, reg.cerrado, d.error], [1, 1, ""]);
}
{
  // Al editar, la ventana se cerraba ANTES de guardar: un error de la
  // base se llevaba la edición entera.
  const original = { id:"p1", title:"Visita", content:"Contenido", images:[], files:[archivo(500*KB)], activityType:"visita" };
  const d = borrador({ editingPost:original, files:[archivo(500*KB), archivo(500*KB)] });
  const { api, reg } = armar({ posts:[original], borrador:d });
  await api.enviar();
  eq("editar sumando lo que no entra: la ventana NO se cierra", reg.cerrado, 0);
  eq("no se intenta guardar", reg.ediciones.length, 0);
  eq("y el aviso dice que no se pudo guardar", /^No se pudo guardar: con lo adjunto se pasa por/.test(d.error), true);
}
{
  const original = { id:"p1", title:"Visita", content:"Contenido", images:[], files:[archivo(500*KB)], activityType:"visita" };
  const d = borrador({ editingPost:original, title:"Visita a Belice", files:[archivo(500*KB)] });
  const { api, reg } = armar({ posts:[original], borrador:d });
  await api.enviar();
  eq("editar algo que entra se guarda como siempre", [reg.cerrado, reg.ediciones.length, d.error], [1, 1, ""]);
}

/* ---------- 6. En Supabase no hay techo ---------- */
{
  const { api, reg } = armar({ base:"supabase" });
  eq("Supabase no frena por peso: los archivos van al bucket",
     await fallaCon(api.createPost({ title:"a", content:"b", images:[], files:[archivo(500*KB), archivo(500*KB), archivo(500*KB)] })), null);
  eq("(y llegó a la base)", reg.creados.length, 1);
  const d = borrador({ files:[archivo(500*KB), archivo(500*KB)] });
  const { api: api2, reg: reg2 } = armar({ base:"supabase", borrador:d });
  await api2.enviar();
  eq("ni el formulario", [reg2.creados.length, d.error], [1, ""]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
