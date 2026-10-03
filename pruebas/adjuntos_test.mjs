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
  "LIMITES_DE_LA_BASE","limitesElegidos","maxImagenes","maxArchivos",
  "maxBytesPorArchivo","topeLegible","unidadAdjuntos","applyAttachmentLimitsConfig",
  "handleImageFiles","handleFileAttachments","newAdjuntosDraft"].map(grab).join("\n");

function armar(){
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
    return { limitesElegidos, maxImagenes, maxArchivos, maxBytesPorArchivo, topeLegible,
             unidadAdjuntos, applyAttachmentLimitsConfig, handleImageFiles, handleFileAttachments,
             newAdjuntosDraft };
  `)({ reg });
  return { reg, api };
}
const archivo = (nombre, bytes, tipo="application/pdf")=>({ name:nombre, size:bytes, type:tipo });
const KB = 1024, MB = 1024*1024;

/* ---------- Cuánto aguanta la base ---------- */
{
  const { api } = armar();
  eq("20 imágenes", api.maxImagenes(), 20);
  eq("10 archivos", api.maxArchivos(), 10);
  eq("10 MB por archivo, para empezar", api.maxBytesPorArchivo(), 10*MB);
}

/* ---------- Lo que elige el admin nunca pasa el techo de la base ---------- */
{
  const { api } = armar();
  api.applyAttachmentLimitsConfig({ maxImages: 12, maxAttachmentFiles: 4, maxAttachmentFileBytes: 5*MB });
  eq("elegir menos que el techo se respeta", [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [12, 4, 5*MB]);
}
{
  const { api } = armar();
  api.applyAttachmentLimitsConfig({ maxImages: 99, maxAttachmentFiles: 99, maxAttachmentFileBytes: 99*MB });
  eq("elegir MÁS que el techo no agranda nada",
     [api.maxImagenes(), api.maxArchivos(), api.maxBytesPorArchivo()], [20, 10, 25*MB]);
}
{
  const { api } = armar();
  api.applyAttachmentLimitsConfig(null);
  api.applyAttachmentLimitsConfig({});
  eq("sin nada configurado, manda la base", [api.maxImagenes(), api.maxArchivos()], [20, 10]);
  eq("y el tamaño arranca en lo sugerido, no en el techo", api.maxBytesPorArchivo(), 10*MB);
}
{
  const { api } = armar();
  api.applyAttachmentLimitsConfig({ maxImages: 0, maxAttachmentFiles: -3, maxAttachmentFileBytes: 1 });
  eq("un 0 guardado se ignora y manda la base (0 no es una elección)", api.maxImagenes(), 20);
  eq("un negativo se recorta a 1: nunca deja un posteo sin poder adjuntar nada", api.maxArchivos(), 1);
  eq("y el tamaño nunca baja de 1 KB", api.maxBytesPorArchivo(), 1024);
}

/* ---------- Cuánto se achica una foto lo decide la base ---------- */
{
  const { api, reg } = armar();
  const destino = [];
  await api.handleImageFiles([archivo("foto.jpg", 3*MB, "image/jpeg")], destino);
  eq("se achica a 2560 y casi no se comprime: va al bucket, no adentro del posteo",
     [reg.comprimidas[0].lado, reg.comprimidas[0].calidad], [2560, 0.85]);
  eq("y la imagen quedó adjuntada", destino.length, 1);
}

/* ---------- Cuántas entran ---------- */
{
  const { api } = armar();
  const destino = [];
  await api.handleImageFiles(Array.from({length:30}, (_,i)=>archivo(`f${i}.jpg`, 100*KB, "image/jpeg")), destino);
  eq("entran 20 y el resto se descarta", destino.length, 20);
}
{
  const { api } = armar();
  const destino = Array.from({length:18}, (_,i)=>"ya"+i);
  await api.handleImageFiles(Array.from({length:10}, (_,i)=>archivo(`f${i}.jpg`, 100*KB, "image/jpeg")), destino);
  eq("y si ya había 18, entran 2 más (no 20 más)", destino.length, 20);
}

/* ---------- Los PDF/audio ---------- */
{
  const { api, reg } = armar();
  const destino = [];
  await api.handleFileAttachments([archivo("grande.pdf", 8*MB)], destino);
  eq("8 MB entra sin chistar", destino.length, 1);
  eq("sin avisos", reg.avisos, []);
}
{
  const { api, reg } = armar();
  const destino = [];
  await api.handleFileAttachments([archivo("enorme.pdf", 12*MB)], destino);
  eq("12 MB no (el sugerido es 10)", destino.length, 0);
  eq("y el aviso habla en MB", /12 MB/.test(reg.avisos[0]) && /10 MB/.test(reg.avisos[0]), true);
}
{
  const { api } = armar();
  const destino = [];
  await api.handleFileAttachments(Array.from({length:15}, (_,i)=>archivo(`x${i}.pdf`, 1*MB)), destino);
  eq("entran 10 archivos", destino.length, 10);
}
{
  const { api } = armar();
  const destino = [];
  await api.handleFileAttachments([archivo("nota.m4a", 2*MB, "audio/mp4")], destino);
  eq("una nota de voz entra como audio", destino[0].kind, "audio");
  eq("con su tipo", destino[0].mime, "audio/mp4");
}

/* ---------- Cómo se escribe un tope ---------- */
{
  const { api } = armar();
  eq("150 KB", api.topeLegible(150*KB), "150 KB");
  eq("500 KB", api.topeLegible(500*KB), "500 KB");
  eq("10 MB, sin el .0 de más", api.topeLegible(10*MB), "10 MB");
  eq("25 MB", api.topeLegible(25*MB), "25 MB");
  eq("1.5 MB sí lleva decimal", api.topeLegible(1.5*MB), "1.5 MB");
}

/* ---------- La unidad del campo de Configuración ---------- */
{
  const { api } = armar();
  const u = api.unidadAdjuntos();
  eq("el campo va en MB (escribir 10240 sería ilegible)", u.nombre, "MB");
  eq("y arranca mostrando 10", api.newAdjuntosDraft().maxFileSize, 10);
  const d = api.newAdjuntosDraft();
  eq("con el resto del borrador al día", [d.maxImages, d.maxFiles], [20, 10]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
