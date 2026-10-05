import fs from "node:fs";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
const grab = hacerGrab(src);
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const tic = ()=>new Promise(r=>setTimeout(r,0));

function armar(opts={}){
  const reg = { escrituras:[], avisos:[], confirmado: opts.confirmar !== false };
  const api = new Function("ctx", `
    "use strict";
    const reg = ctx.reg;
    const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g,
      (todo, k) => (vars && k in vars) ? vars[k] : todo);
    const appAlert = async m => { reg.avisos.push(m); };
    const appConfirm = async m => { reg.confirmaciones = (reg.confirmaciones||[]).concat([m]); return reg.confirmado; };
    const render = ()=>{};
    const esc = s => String(s ?? "");
    const state = { auth:{ user:{ email:"ana@x.com", displayName:"Ana" } }, posts: ctx.posts };
    const store = { horaDelServidor: ()=> "HORA" };
    const getPostById = id => state.posts.find(p=>p.id===id);
    const canEditPost = ()=> ctx.puedeEditar !== false;
    // Un archivo de prueba puede traer su contenido ya leído (para probar
    // el peso); si no, uno mínimo.
    const readFileAsDataUrl = async f => f.contenido || ("data:" + (f.type || "application/pdf") + ";base64,QQ==");
    const updatePostDoc = async (id, parche)=>{ reg.escrituras.push({ id, parche }); };
    const maxArchivos = ()=> ctx.maxArchivos || 10;
    const maxBytesPorArchivo = ()=> ctx.maxBytes || 10 * 1024 * 1024;
    const safeFileDataUrl = u => String(u||"").startsWith("data:") ? u : "";
    const sePuedeVer = ()=> true;
    // fmtDate respeta el formato elegido en Configuración; acá se fija en
    // dmy para que la prueba no dependa de la configuración de nadie.
    const pad2 = n => String(n).padStart(2, "0");
    const dateFormatPref = () => "dmy";
    const dateLocale = () => "es";
    const docsAbiertos = new Map();
    ${["TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo","claseDe","topeLegible",
       "DOCS_POR_TIPO","docsEsperados","docDeArchivo","archivosDelDoc","docsDesplegados","archivoDelDoc","archivosSueltos","cuantosDocsHay",
       "sinRanura","fechaDeArchivo","fmtDate",
       "adjuntarDocumento","quitarDocumento","quitarAdjunto","esWordDeViaje",
       "ACTIVITY_TYPES","EVENTO_TYPES","CALENDAR_SYNC_TYPES","ACTIVITY_BY_KEY",
       "DEFAULT_ACTIVITY_LABELS","applyActivityTypesConfig"].map(grab).join("\n")}
    const currentLang = ()=> "es";
    const refreshActivityTypeLabels = ()=>{};
    return { DOCS_POR_TIPO, docsEsperados, docDeArchivo, archivoDelDoc, archivosSueltos,
             cuantosDocsHay, sinRanura, fechaDeArchivo,
             adjuntarDocumento, quitarDocumento, quitarAdjunto,
             applyActivityTypesConfig, state };
  `)({ reg, posts: opts.posts || [], puedeEditar: opts.puedeEditar, maxArchivos: opts.maxArchivos, maxBytes: opts.maxBytes });
  return { reg, api };
}
const ponerDocs = (api, mapa) => {
  Object.keys(api.DOCS_POR_TIPO).forEach(k=>delete api.DOCS_POR_TIPO[k]);
  Object.entries(mapa).forEach(([k,v])=>{ api.DOCS_POR_TIPO[k] = v; });
};
const VISITA = [{id:"plan",label:"Plan de viaje"},{id:"reporte",label:"Reporte"}];
const archivo = (extra={}) => ({ name:"a.pdf", kind:"pdf", dataUrl:"data:application/pdf;base64,QQ==", ...extra });

/* ---------- Qué espera cada tipo ---------- */
{
  const { api } = armar();
  ponerDocs(api, { visita: VISITA });
  eq("una visita espera dos documentos", api.docsEsperados("visita").map(d=>d.id), ["plan","reporte"]);
  eq("un tipo sin configurar no espera ninguno", api.docsEsperados("curso"), []);
  eq("ni uno que no existe", api.docsEsperados("inventado"), []);
}

/* ---------- Qué archivo ocupa cada ranura ---------- */
{
  const { api } = armar();
  ponerDocs(api, { visita: VISITA });
  const post = { id:"p1", activityType:"visita", files:[
    archivo({ name:"plan.pdf", doc:"plan" }),
    archivo({ name:"suelto.pdf" }),
  ]};
  eq("encuentra el del plan", api.archivoDelDoc(post,"plan").name, "plan.pdf");
  eq("y dice que no hay reporte", api.archivoDelDoc(post,"reporte"), null);
  eq("los sueltos son los que no ocupan ninguna ranura",
     api.archivosSueltos(post.files, "visita").map(f=>f.name), ["suelto.pdf"]);
  eq("la cuenta", api.cuantosDocsHay(post), { hay:1, total:2 });
}
{
  const { api } = armar();
  ponerDocs(api, { visita: VISITA });
  // Un archivo etiquetado con una ranura que el admin BORRÓ del tipo: no
  // desaparece, vuelve a la lista de sueltos.
  const files = [archivo({ name:"viejo.pdf", doc:"gastos" })];
  eq("un documento de una ranura que ya no existe no se pierde",
     api.archivosSueltos(files, "visita").map(f=>f.name), ["viejo.pdf"]);
  eq("y no ocupa ninguna de las actuales", api.cuantosDocsHay({ activityType:"visita", files }), { hay:0, total:2 });
}
{
  const { api } = armar();
  ponerDocs(api, {});
  eq("sin documentos esperados, todos los archivos son sueltos",
     api.archivosSueltos([archivo({doc:"plan"}), archivo()], "visita").length, 2);
  eq("y la cuenta es cero de cero", api.cuantosDocsHay({ activityType:"visita", files:[] }), { hay:0, total:0 });
}
{
  const { api } = armar();
  eq("un posteo sin archivos no rompe nada", api.archivosSueltos(undefined, "visita"), []);
  eq("un doc que no es texto se ignora", api.docDeArchivo({ doc: 42 }), null);
}

/* ---------- Adjuntar ---------- */
{
  const post = { id:"p1", activityType:"visita", files:[] };
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"Plan.docx", size: 2*1024*1024, type:"" });
  eq("se escribe una vez", reg.escrituras.length, 1);
  const f = reg.escrituras[0].parche.files[0];
  eq("el archivo queda atado a su ranura", f.doc, "plan");
  eq("con su nombre", f.name, "Plan.docx");
  eq("y su clase, deducida de la extensión porque el navegador no la dijo", f.kind, "doc");
  eq("queda firmado como una edición", reg.escrituras[0].parche.lastEditedBy, "Ana");
}
{
  // Sumar (desde el 6/10/2026): el de antes se queda y el nuevo va al final.
  const post = { id:"p1", activityType:"visita", files:[
    archivo({ name:"viejo.pdf", doc:"plan" }), archivo({ name:"reporte.pdf", doc:"reporte" })]};
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"nuevo.pdf", size: 1000, type:"application/pdf" });
  const files = reg.escrituras[0].parche.files;
  eq("quedan los dos en el mismo documento, el nuevo al final", files.filter(f=>f.doc==="plan").map(f=>f.name), ["viejo.pdf","nuevo.pdf"]);
  eq("sin tocar los otros", files.find(f=>f.doc==="reporte").name, "reporte.pdf");
}
{
  const post = { id:"p1", activityType:"visita", files:[] };
  const { api, reg } = armar({ posts:[post], maxBytes: 150*1024 });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"gordo.pdf", size: 5*1024*1024, type:"application/pdf" });
  eq("un archivo más grande que el tope no se escribe", reg.escrituras.length, 0);
  eq("y se avisa con los dos pesos en palabras",
     /5 MB/.test(reg.avisos[0]) && /150 KB/.test(reg.avisos[0]), true);
}
{
  const post = { id:"p1", activityType:"visita", files:[archivo({name:"1.pdf"}), archivo({name:"2.pdf"})] };
  const { api, reg } = armar({ posts:[post], maxArchivos: 2 });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"3.pdf", size: 1000, type:"application/pdf" });
  eq("pasado el tope de cantidad, no entra", reg.escrituras.length, 0);
  eq("y se explica qué hacer", /máximo/.test(reg.avisos[0]), true);
}
/* ---------- No hay techo para el posteo entero ----------
   Hubo uno mientras la base fue Firestore, que guardaba el archivo
   adentro del posteo y no admitía más de 1 MiB por documento. Ahora cada
   archivo va al bucket y en el posteo queda su ruta. */
const pesado = kb => "data:application/pdf;base64," + "A".repeat(4 * Math.ceil(kb * 1024 / 3));
{
  const post = { id:"p1", activityType:"visita", images:[], files:[archivo({ name:"viejo.pdf", dataUrl: pesado(900) })] };
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"Plan.pdf", size: 900*1024, type:"application/pdf", contenido: pesado(900) });
  eq("un archivo pesado entra aunque el evento ya tenga otros pesados", reg.escrituras.length, 1);
  eq("sin avisos", reg.avisos, []);
}
{
  // Desde el 6/10/2026 un documento puede tener varios archivos: subir
  // otro SUMA, no pisa al anterior.
  const post = { id:"p1", activityType:"visita", files:[archivo({name:"1.pdf", doc:"plan"}), archivo({name:"2.pdf"})] };
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"3.pdf", size: 1000, type:"application/pdf" });
  eq("un segundo archivo para el mismo documento se suma", reg.escrituras[0].parche.files.map(f => [f.name, f.doc || null]),
     [["1.pdf","plan"], ["2.pdf",null], ["3.pdf","plan"]]);
}
{
  // Y por eso, estando en el tope, ya no entra (antes pisaba y no sumaba).
  const post = { id:"p1", activityType:"visita", files:[archivo({name:"1.pdf", doc:"plan"}), archivo({name:"2.pdf"})] };
  const { api, reg } = armar({ posts:[post], maxArchivos: 2 });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"3.pdf", size: 1000, type:"application/pdf" });
  eq("en el tope, otro archivo para el mismo documento tampoco entra", [reg.escrituras.length, /máximo/.test(reg.avisos[0])], [0, true]);
}
{
  const post = { id:"p1", activityType:"visita", files:[] };
  const { api, reg } = armar({ posts:[post], puedeEditar:false });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"a.pdf", size: 1000, type:"application/pdf" });
  eq("quien no puede editar el posteo, no adjunta", reg.escrituras.length, 0);
  eq("y no se le muestra un error de más", reg.avisos.length, 0);
}
{
  const { api, reg } = armar({ posts:[] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("noexiste", "plan", { name:"a.pdf", size: 1, type:"" });
  eq("sobre un posteo que no está, no hace nada", reg.escrituras.length, 0);
}

/* ---------- El ✕ de una ranura: pregunta y quita, como el otro ----------
   Lo probé sacando de la ranura sin borrar, para que una asignación mal
   hecha no costara el archivo. No sirvió: quedaban dos ✕ idénticos
   haciendo cosas distintas, que es peor que el riesgo que evitaba. */
{
  const post = { id:"p1", activityType:"visita", files:[
    archivo({ name:"plan.pdf", doc:"plan" }), archivo({ name:"suelto.pdf" })]};
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.quitarDocumento("p1", 0);
  eq("pregunta antes, porque no se deshace", (reg.confirmaciones||[]).length, 1);
  eq("y nombra el archivo", /plan\.pdf/.test(reg.confirmaciones[0]), true);
  eq("saca ese y deja el suelto", reg.escrituras[0].parche.files.map(f=>f.name), ["suelto.pdf"]);
}
{
  const post = { id:"p1", activityType:"visita", files:[
    archivo({ name:"plan-v1.pdf", doc:"plan" }), archivo({ name:"plan-v2.pdf", doc:"plan" })]};
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.quitarDocumento("p1", 1);
  eq("con varios archivos en un documento, el ✕ saca solo ése", reg.escrituras[0].parche.files.map(f=>f.name), ["plan-v1.pdf"]);
}
{
  const post = { id:"p1", activityType:"visita", files:[archivo({ name:"suelto.pdf" })]};
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.quitarDocumento("p1", 0);
  eq("el ✕ de un documento no saca un adjunto suelto", reg.escrituras.length, 0);
}
{
  const post = { id:"p1", activityType:"visita", files:[archivo({ name:"plan.pdf", doc:"plan" })]};
  const { api, reg } = armar({ posts:[post], confirmar:false });
  ponerDocs(api, { visita: VISITA });
  await api.quitarDocumento("p1", 0);
  eq("si se dice que no, no se toca nada", reg.escrituras.length, 0);
}

/* ---------- Quitar un adjunto DEL EVENTO: eso sí borra ---------- */
{
  const post = { id:"p1", activityType:"visita", files:[
    archivo({ name:"uno.pdf" }), archivo({ name:"dos.pdf" }), archivo({ name:"tres.pdf" })]};
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.quitarAdjunto("p1", 1);
  eq("pregunta antes, porque esto no se deshace", (reg.confirmaciones||[]).length, 1);
  eq("y nombra el archivo", /dos\.pdf/.test(reg.confirmaciones[0]), true);
  eq("saca el que se pidió y ninguno más", reg.escrituras[0].parche.files.map(f=>f.name), ["uno.pdf","tres.pdf"]);
}
{
  const post = { id:"p1", activityType:"visita", files:[archivo({ name:"uno.pdf" })]};
  const { api, reg } = armar({ posts:[post], confirmar:false });
  ponerDocs(api, { visita: VISITA });
  await api.quitarAdjunto("p1", 0);
  eq("si se dice que no, no se borra nada", reg.escrituras.length, 0);
}
{
  const post = { id:"p1", activityType:"visita", files:[archivo({ name:"uno.pdf" })]};
  const { api, reg } = armar({ posts:[post], puedeEditar:false });
  ponerDocs(api, { visita: VISITA });
  await api.quitarAdjunto("p1", 0);
  eq("quien no puede editar no borra nada", reg.escrituras.length, 0);
}

/* ---------- La fecha de subida ---------- */
{
  const { api } = armar({ posts:[] });
  eq("sinRanura saca el doc y deja el resto", api.sinRanura({ name:"a.pdf", kind:"pdf", doc:"plan" }),
     { name:"a.pdf", kind:"pdf" });
  eq("y no rompe si no tenía", api.sinRanura({ name:"a.pdf" }), { name:"a.pdf" });

  // Los archivos de antes no la traen: no se inventa nada.
  eq("sin fecha, no se dibuja nada", api.fechaDeArchivo({ name:"a.pdf" }), "");
  eq("con una fecha rota, tampoco", api.fechaDeArchivo({ name:"a.pdf", subidoEl:"cualquier cosa" }), "");
  eq("si no es texto, tampoco", api.fechaDeArchivo({ name:"a.pdf", subidoEl: 1759400000000 }), "");
  eq("y con una buena, sale en el formato elegido",
     api.fechaDeArchivo({ name:"a.pdf", subidoEl:"2026-10-02T15:30:00.000Z" }), "02/10/2026");
  eq("un archivo que no existe no rompe", api.fechaDeArchivo(null), "");
}
{
  // Adjuntar deja la marca de cuándo fue.
  const post = { id:"p1", activityType:"visita", files:[] };
  const { api, reg } = armar({ posts:[post] });
  ponerDocs(api, { visita: VISITA });
  await api.adjuntarDocumento("p1", "plan", { name:"nuevo.pdf", type:"application/pdf", size:10 });
  const guardado = reg.escrituras[0].parche.files[0];
  eq("el archivo queda en su ranura", [guardado.name, guardado.doc], ["nuevo.pdf", "plan"]);
  eq("con la fecha de subida puesta", typeof guardado.subidoEl === "string" && guardado.subidoEl.length > 10, true);
  eq("y se puede leer", /^\d{2}\/\d{2}\/\d{4}$/.test(api.fechaDeArchivo(guardado)), true);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
