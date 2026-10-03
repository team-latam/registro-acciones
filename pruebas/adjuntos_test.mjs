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

const codigo = ["TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo","claseDe",
  "LIMITES_FIREBASE","LIMITES_SUPABASE","limitesElegidos","maxImagenes","maxArchivos",
  "maxBytesPorArchivo","topeLegible","unidadAdjuntos","applyAttachmentLimitsConfig",
  "handleImageFiles","handleFileAttachments","newAdjuntosDraft"].map(grab).join("\n");

function armar(cual){
  const reg = { avisos:[], comprimidas:[], renders:0 };
  const api = new Function("ctx", `
    "use strict";
    const { reg } = ctx;
    const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g,
      (todo, k) => (vars && k in vars) ? vars[k] : todo);
    const render = ()=>{ reg.renders++; };
    const appAlert = async m => { reg.avisos.push(m); };
    const compressImage = async (file, lado, calidad)=>{
      reg.comprimidas.push({ nombre:file.name, lado, calidad });
      return "data:image/jpeg;base64,xxx";
    };
    const readFileAsDataUrl = async file => "data:" + file.type + ";base64,yyy";
    ${codigo}
    let store = { limites: ${cual} };
    return { store, limitesElegidos, maxImagenes, maxArchivos, maxBytesPorArchivo, topeLegible,
             unidadAdjuntos, applyAttachmentLimitsConfig, handleImageFiles, handleFileAttachments,
             newAdjuntosDraft, cambiarBase: l => { store.limites = l; },
             LIMITES_FIREBASE, LIMITES_SUPABASE };
  `)({ reg });
  return { reg, api };
}
const archivo = (nombre, bytes, tipo="application/pdf")=>({ name:nombre, size:bytes, type:tipo });
const KB = 1024, MB = 1024*1024;

/* ---------- Cada base dice cuánto aguanta ---------- */
{
  const { api } = armar("LIMITES_FIREBASE");
  eq("con Firebase: 6 imágenes", api.maxImagenes(), 6);
  eq("con Firebase: 2 archivos", api.maxArchivos(), 2);
  eq("con Firebase: 150 KB por archivo", api.maxBytesPorArchivo(), 150*KB);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  eq("con Supabase: 20 imágenes", api.maxImagenes(), 20);
  eq("con Supabase: 10 archivos", api.maxArchivos(), 10);
  eq("con Supabase: 10 MB por archivo", api.maxBytesPorArchivo(), 10*MB);
}

/* ---------- Lo que elige el admin nunca pasa el techo de la base ---------- */
{
  const { api } = armar("LIMITES_SUPABASE");
  api.applyAttachmentLimitsConfig({ maxImages: 12, maxAttachmentFiles: 4, maxAttachmentFileBytes: 5*MB });
  eq("elegir menos que el techo se respeta", [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [12, 4, 5*MB]);
  api.cambiarBase(api.LIMITES_FIREBASE);
  eq("con la misma elección pero en Firebase, se recorta al techo de Firebase",
     [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [6, 2, 500*KB]);
  api.cambiarBase(api.LIMITES_SUPABASE);
  eq("y al volver, la elección sigue entera (no se perdió al recortarse)",
     [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [12, 4, 5*MB]);
}
{
  const { api } = armar("LIMITES_FIREBASE");
  api.applyAttachmentLimitsConfig({ maxImages: 99, maxAttachmentFiles: 99, maxAttachmentFileBytes: 99*MB });
  eq("elegir MÁS que el techo no agranda nada",
     [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [6, 2, 500*KB]);
  api.cambiarBase(api.LIMITES_SUPABASE);
  eq("y en Supabase ese mismo número se recorta al suyo",
     [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [20, 10, 25*MB]);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  api.applyAttachmentLimitsConfig(null);
  api.applyAttachmentLimitsConfig({});
  eq("sin nada configurado, manda la base", [api.maxImagenes(), api.maxArchivos()], [20, 10]);
  eq("y el tamaño arranca en lo sugerido, no en el techo", api.maxBytesPorArchivo(), 10*MB);
}
{
  const { api } = armar("LIMITES_FIREBASE");
  api.applyAttachmentLimitsConfig({ maxImages: 0, maxAttachmentFiles: -3, maxAttachmentFileBytes: 1 });
  eq("un 0 guardado se ignora y manda la base (0 no es una elección)", api.maxImagenes(), 6);
  eq("un negativo se recorta a 1: nunca deja un posteo sin poder adjuntar nada", api.maxArchivos(), 1);
  eq("y el tamaño nunca baja de 1 KB", api.maxBytesPorArchivo(), 1024);
}

/* ---------- Cuánto se achica una foto lo decide la base ---------- */
{
  const { api, reg } = armar("LIMITES_FIREBASE");
  const destino = [];
  await api.handleImageFiles([archivo("foto.jpg", 3*MB, "image/jpeg")], destino);
  eq("con Firebase se achica a 1280 y se comprime fuerte",
     [reg.comprimidas[0].lado, reg.comprimidas[0].calidad], [1280, 0.72]);
}
{
  const { api, reg } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleImageFiles([archivo("foto.jpg", 3*MB, "image/jpeg")], destino);
  eq("con Supabase se achica a 2560 y casi no se comprime",
     [reg.comprimidas[0].lado, reg.comprimidas[0].calidad], [2560, 0.85]);
  eq("y la imagen quedó adjuntada", destino.length, 1);
}

/* ---------- Cuántas entran ---------- */
{
  const { api } = armar("LIMITES_FIREBASE");
  const destino = [];
  await api.handleImageFiles(Array.from({length:10}, (_,i)=>archivo(`f${i}.jpg`, 100*KB, "image/jpeg")), destino);
  eq("con Firebase entran 6 y el resto se descarta", destino.length, 6);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleImageFiles(Array.from({length:30}, (_,i)=>archivo(`f${i}.jpg`, 100*KB, "image/jpeg")), destino);
  eq("con Supabase entran 20", destino.length, 20);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  const destino = Array.from({length:18}, (_,i)=>"ya"+i);
  await api.handleImageFiles(Array.from({length:10}, (_,i)=>archivo(`f${i}.jpg`, 100*KB, "image/jpeg")), destino);
  eq("y si ya había 18, entran 2 más (no 20 más)", destino.length, 20);
}

/* ---------- Los PDF/audio ---------- */
{
  const { api, reg } = armar("LIMITES_FIREBASE");
  const destino = [];
  await api.handleFileAttachments([archivo("chico.pdf", 100*KB), archivo("grande.pdf", 400*KB)], destino);
  eq("con Firebase, 400 KB no entra", destino.length, 1);
  eq("y se avisa con el peso en palabras, no en bytes", /400 KB/.test(reg.avisos[0]) && /150 KB/.test(reg.avisos[0]), true);
}
{
  const { api, reg } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleFileAttachments([archivo("grande.pdf", 8*MB)], destino);
  eq("con Supabase, 8 MB entra sin chistar", destino.length, 1);
  eq("sin avisos", reg.avisos, []);
}
{
  const { api, reg } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleFileAttachments([archivo("enorme.pdf", 12*MB)], destino);
  eq("12 MB no (el sugerido es 10)", destino.length, 0);
  eq("y el aviso habla en MB", /12 MB/.test(reg.avisos[0]) && /10 MB/.test(reg.avisos[0]), true);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleFileAttachments(Array.from({length:15}, (_,i)=>archivo(`x${i}.pdf`, 1*MB)), destino);
  eq("entran 10 archivos", destino.length, 10);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  const destino = [];
  await api.handleFileAttachments([archivo("nota.m4a", 2*MB, "audio/mp4")], destino);
  eq("una nota de voz entra como audio", destino[0].kind, "audio");
  eq("con su tipo", destino[0].mime, "audio/mp4");
}

/* ---------- Cómo se escribe un tope ---------- */
{
  const { api } = armar("LIMITES_SUPABASE");
  eq("150 KB", api.topeLegible(150*KB), "150 KB");
  eq("500 KB", api.topeLegible(500*KB), "500 KB");
  eq("10 MB, sin el .0 de más", api.topeLegible(10*MB), "10 MB");
  eq("25 MB", api.topeLegible(25*MB), "25 MB");
  eq("1.5 MB sí lleva decimal", api.topeLegible(1.5*MB), "1.5 MB");
}

/* ---------- La unidad del campo de Configuración ---------- */
{
  const { api } = armar("LIMITES_FIREBASE");
  const u = api.unidadAdjuntos();
  eq("con Firebase el campo va en KB", [u.nombre, u.min], ["KB", 50]);
  eq("y arranca mostrando 150", api.newAdjuntosDraft().maxFileSize, 150);
}
{
  const { api } = armar("LIMITES_SUPABASE");
  const u = api.unidadAdjuntos();
  eq("con Supabase va en MB (escribir 10240 sería ilegible)", u.nombre, "MB");
  eq("y arranca mostrando 10", api.newAdjuntosDraft().maxFileSize, 10);
  const d = api.newAdjuntosDraft();
  eq("con el resto del borrador al día", [d.maxImages, d.maxFiles], [20, 10]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
