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

const api = new Function(`
  const SUPABASE_URL = "https://benonmzlgdjkhzauamrz.supabase.co";
  ${["TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo","claseDe",
     "ACEPTA_ARCHIVOS","FILE_DATA_URL_RE","esUrlDelBucket","safeFileDataUrl"].map(grab).join("\n")}
  return { TIPOS_DE_ARCHIVO, claseDeArchivo, claseDe, ACEPTA_ARCHIVOS, FILE_DATA_URL_RE, safeFileDataUrl };
`)();
const clase = (mime, nombre) => api.claseDeArchivo(mime, nombre).clase;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/* ---------- Cada archivo, en su clase ---------- */
eq("un PDF", clase("application/pdf","plan.pdf"), "pdf");
eq("un Word nuevo", clase(DOCX,"reporte.docx"), "doc");
eq("un Word viejo", clase("application/msword","reporte.doc"), "doc");
eq("un Writer de LibreOffice", clase("application/vnd.oasis.opendocument.text","r.odt"), "doc");
eq("un Excel", clase(XLSX,"gastos.xlsx"), "planilla");
eq("un PowerPoint", clase(PPTX,"charla.pptx"), "presentacion");
eq("un texto plano", clase("text/plain","notas.txt"), "texto");
eq("un csv", clase("text/csv","lista.csv"), "texto");
eq("un audio", clase("audio/mp4","nota.m4a"), "audio");
eq("cualquier audio, por raro que sea el tipo", clase("audio/x-lo-que-sea","a.xyz"), "audio");
eq("algo que no conocemos entra como 'otro'", clase("application/x-rar","cosa.rar"), "otro");

/* ---------- Cuando el navegador no dice qué es ---------- */
// Es lo normal, no la excepción: un .md suele llegar sin tipo, y en
// Android casi todo llega como octet-stream.
eq("un docx sin tipo se reconoce por la extensión", clase("","reporte.docx"), "doc");
eq("un docx como octet-stream, igual", clase("application/octet-stream","reporte.docx"), "doc");
eq("un markdown sin tipo", clase("","LEEME.md"), "texto");
eq("un xlsx sin tipo", clase("","gastos.xlsx"), "planilla");
eq("un mp3 sin tipo", clase("","cancion.mp3"), "audio");
eq("sin tipo Y sin extensión, 'otro'", clase("","archivo"), "otro");
eq("la extensión no distingue mayúsculas", clase("","REPORTE.DOCX"), "doc");
eq("un nombre con puntos mira la última parte", clase("","informe.final.v2.docx"), "doc");
eq("el tipo le gana a una extensión mentirosa", clase("application/pdf","cosa.docx"), "pdf");

/* ---------- Qué se puede ver sin bajarlo ---------- */
const seVe = (mime, nombre) => !!api.claseDeArchivo(mime, nombre).seVe;
eq("un PDF se ve en el visor", seVe("application/pdf","a.pdf"), true);
eq("un texto también", seVe("text/plain","a.txt"), true);
eq("un Word NO: el navegador no lo sabe mostrar", seVe(DOCX,"a.docx"), false);
eq("un Excel tampoco", seVe(XLSX,"a.xlsx"), false);
eq("un PowerPoint tampoco", seVe(PPTX,"a.pptx"), false);
eq("un audio tampoco (tiene su reproductor)", seVe("audio/mpeg","a.mp3"), false);
eq("ni uno desconocido", seVe("","x.rar"), false);
eq("claseDe() lee el kind ya guardado en el posteo", api.claseDe({ kind:"planilla" }).clase, "planilla");
eq("y si el posteo es viejo y no tiene kind, no se rompe", api.claseDe({}).clase, "otro");
eq("ni si viene nulo", api.claseDe(null).clase, "otro");

/* ---------- Lo que acepta el selector del sistema ---------- */
eq("ofrece los tipos de oficina", [DOCX, XLSX, PPTX].every(m=>api.ACEPTA_ARCHIVOS.includes(m)), true);
eq("y también las extensiones, porque hay sistemas que sin eso los tachan",
   [".docx",".xlsx",".pptx",".txt",".md",".csv"].every(e=>api.ACEPTA_ARCHIVOS.split(",").includes(e)), true);
eq("y cualquier audio", api.ACEPTA_ARCHIVOS.split(",").includes("audio/*"), true);

/* ---------- Lo que la app deja entrar a un enlace ---------- */
const d = m => `data:${m};base64,QQ==`;
for(const [etiqueta, mime] of [["PDF","application/pdf"],["Word",DOCX],["Excel",XLSX],
    ["PowerPoint",PPTX],["texto","text/plain"],["csv","text/csv"],
    ["OpenDocument","application/vnd.oasis.opendocument.text"],["audio","audio/mpeg"],
    ["uno sin tipo","application/octet-stream"]]){
  eq(`se acepta un ${etiqueta}`, api.safeFileDataUrl(d(mime)), d(mime));
}
// Esto es lo que de verdad protege: lo que se deja entrar a un href/src.
for(const [etiqueta, mime] of [["HTML","text/html"],["JavaScript","text/javascript"],
    ["otro JavaScript","application/javascript"],["SVG","image/svg+xml"],
    ["XHTML","application/xhtml+xml"],["PHP","application/x-httpd-php"],
    ["un zip","application/zip"],["video","video/mp4"]]){
  eq(`se rechaza un ${etiqueta}`, api.safeFileDataUrl(d(mime)), "");
}
eq("un javascript: pelado, ni ahí", api.safeFileDataUrl("javascript:alert(1)"), "");
eq("ni un data: con el tipo escondido", api.safeFileDataUrl("data:text/html;base64,PHNjcmlwdD4="), "");
eq("ni algo que ni siquiera es texto", api.safeFileDataUrl({}), "");
eq("una URL firmada del bucket sí",
   api.safeFileDataUrl("https://benonmzlgdjkhzauamrz.supabase.co/storage/v1/object/sign/adjuntos/x.docx?token=a")
     .includes("x.docx"), true);
eq("pero no una de otro lado",
   api.safeFileDataUrl("https://otro-sitio.com/storage/v1/object/sign/adjuntos/x.docx"), "");

/* ---------- Las dos capas dicen lo mismo ---------- */
// Si una se queda atrás, el archivo entra en el navegador y lo rechaza la
// base — un error opaco justo al publicar. (Eran tres hasta el 3 de octubre
// de 2026: las reglas de Firestore también lo decidían. Firebase se cerró, y
// sus reglas ya no dejan entrar nada.)
const sql = fs.readFileSync(RAIZ + "supabase/01-tablas.sql","utf8");
const delCodigo = api.TIPOS_DE_ARCHIVO.flatMap(x=>x.mimes);
eq("el bucket de Supabase acepta todos los que acepta el código",
   delCodigo.filter(m => !sql.includes(m)), []);
const reglas = fs.readFileSync(RAIZ + "firestore.rules","utf8");
eq("y Firestore, cerrado: sus reglas no dejan leer ni escribir nada",
   /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/.test(reglas)
     && !/allow [a-z, ]+: if (?!false)/.test(reglas), true);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
