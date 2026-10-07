/* ======================================================================
   Restaurar una copia de seguridad
   ======================================================================
   El camino de vuelta de respaldar.mjs (docs/AUDITORIA.md, I7): la copia
   existía, pero nadie había hecho nunca el camino de regreso y no había
   herramienta para volver a subir las fotos. Esto:

   - Vuelve a cargar las tablas desde datos/<tabla>.json (la copia del
     domingo) o desde datos.json (la que baja el botón de Administración ›
     Copia de seguridad, una vez descomprimida). Fila que ya existe, se
     pisa con la de la copia; fila que no está en la copia, NO se toca:
     esto nunca borra nada.
   - Vuelve a subir las fotos y adjuntos de archivos/ al bucket. Lo que ya
     está en el bucket se deja como está.
   - Con SOLO, trae de vuelta filas sueltas (un posteo borrado, por
     ejemplo) en vez de todo.

   La base entera de una vez también se puede volver con el volcado
   (base/registro.sql.gz), ver docs/RESTAURAR.md. Esto sirve para lo que el
   volcado no trae (los archivos) y para lo puntual.

   Variables:
     ORIGEN                     la carpeta de la copia (descomprimida)
     SUPABASE_URL               adónde restaurar. Obligatoria: nunca se
                                saca de index.html, para no pisar el
                                proyecto de verdad por olvido
     SUPABASE_SERVICE_ROLE_KEY  la llave de servicio de ESE proyecto
     QUE                        "todo" (por omisión), "tablas" o "archivos"
     SOLO                       opcional: "posts:id1,id2;replies:id3"
     ES_PRODUCCION              "si", si SUPABASE_URL es la de la app: sin
                                eso se niega (ahí está lo de verdad)
     SIN_ESCRIBIR               "si": solo cuenta lo que haría

   Como respaldar.mjs, el registro dice cantidades y nunca un dato.
   ====================================================================== */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { TABLAS } from "./respaldar.mjs";

// En este orden: los comentarios (replies) apuntan a su posteo, que tiene
// que estar antes. El resto no depende de nada.
export const ORDEN = ["members", "former_members", "access_requests", "app_config", "user_prefs", "personas",
  "posts", "replies", "audit_log", "calendar_sugerencias", "calendar_sacados"];
const BUCKET = "adjuntos";
const LOTE = 500;

const cfg = { origen: "", url: "", llave: "", que: "todo", solo: null, simular: false };

function urlDeLaApp(){
  try{
    const app = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    return (/(?:const|let) SUPABASE_URL\s*=\s*["']([^"']+)["']/.exec(app) || [])[1] || "";
  }catch(e){ return ""; }
}

// "posts:a,b;replies:c" → { posts: Set(a,b), replies: Set(c) }
export function leerSolo(texto){
  if(!texto || !String(texto).trim()) return null;
  const solo = {};
  for(const parte of String(texto).split(";").map(s => s.trim()).filter(Boolean)){
    const [tabla, ids] = parte.split(":");
    if(!TABLAS[tabla]) throw new Error(`SOLO: no hay ninguna tabla «${tabla}»`);
    const lista = String(ids || "").split(",").map(s => s.trim()).filter(Boolean);
    if(!lista.length) throw new Error(`SOLO: falta qué filas de ${tabla}`);
    solo[tabla] = new Set([...(solo[tabla] || []), ...lista]);
  }
  return solo;
}

function leerConfiguracion(){
  cfg.origen = process.env.ORIGEN || "";
  cfg.url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  cfg.llave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  cfg.que = process.env.QUE || "todo";
  cfg.solo = leerSolo(process.env.SOLO);
  cfg.simular = process.env.SIN_ESCRIBIR === "si";
  if(!cfg.origen || !existsSync(cfg.origen)) throw new Error("Falta ORIGEN (la carpeta de la copia, descomprimida).");
  if(!cfg.url) throw new Error("Falta SUPABASE_URL: adónde restaurar. No se toma de index.html a propósito.");
  if(!cfg.llave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY del proyecto adonde se restaura.");
  if(!["todo", "tablas", "archivos"].includes(cfg.que)) throw new Error(`QUE tiene que ser todo, tablas o archivos (no «${cfg.que}»).`);
  if(cfg.solo && cfg.que === "archivos") throw new Error("SOLO elige filas: va con QUE=tablas o QUE=todo.");
  const deLaApp = urlDeLaApp().replace(/\/+$/, "");
  if(deLaApp && cfg.url === deLaApp && process.env.ES_PRODUCCION !== "si"){
    throw new Error("Esa es la dirección de la app de verdad. Para restaurar ahí, ES_PRODUCCION=si (ver docs/RESTAURAR.md).");
  }
}

// Las tablas de la copia, sea cual sea su forma.
export function leerTablas(origen){
  const tablas = {};
  const carpeta = join(origen, "datos");
  if(existsSync(carpeta) && statSync(carpeta).isDirectory()){
    for(const tabla of Object.keys(TABLAS)){
      const archivo = join(carpeta, `${tabla}.json`);
      if(existsSync(archivo)) tablas[tabla] = JSON.parse(readFileSync(archivo, "utf8"));
    }
    return tablas;
  }
  const uno = join(origen, "datos.json");
  if(existsSync(uno)){
    const datos = JSON.parse(readFileSync(uno, "utf8"));
    const fuente = datos && typeof datos.tablas === "object" ? datos.tablas : {};
    for(const tabla of Object.keys(TABLAS)) if(Array.isArray(fuente[tabla])) tablas[tabla] = fuente[tabla];
    return tablas;
  }
  throw new Error("En ORIGEN no hay ni datos/ (la copia del domingo) ni datos.json (la del botón de la app).");
}

// Todos los archivos de archivos/, con su ruta en el bucket.
export function listarArchivos(origen){
  const raiz = join(origen, "archivos");
  if(!existsSync(raiz)) return [];
  const salida = [];
  const recorrer = dir => {
    for(const nombre of readdirSync(dir).sort()){
      const camino = join(dir, nombre);
      if(statSync(camino).isDirectory()) recorrer(camino);
      else salida.push(relative(raiz, camino).split(sep).join("/"));
    }
  };
  recorrer(raiz);
  // Lo de la papelera no vuelve: la copia no lo guarda, y si alguien lo
  // dejó ahí a mano, no corresponde subirlo como si fuera de un posteo.
  return salida.filter(r => !r.startsWith("papelera/"));
}

const TIPOS = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", gif:"image/gif", webp:"image/webp",
  pdf:"application/pdf", txt:"text/plain", md:"text/markdown", csv:"text/csv", tsv:"text/tab-separated-values",
  rtf:"application/rtf", odt:"application/vnd.oasis.opendocument.text", ods:"application/vnd.oasis.opendocument.spreadsheet",
  odp:"application/vnd.oasis.opendocument.presentation", mp3:"audio/mpeg", m4a:"audio/mp4", aac:"audio/aac",
  ogg:"audio/ogg", oga:"audio/ogg", opus:"audio/ogg", wav:"audio/wav", weba:"audio/webm", webm:"audio/webm", "3gp":"audio/3gpp",
  doc:"application/msword", docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:"application/vnd.ms-excel", xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt:"application/vnd.ms-powerpoint", pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation" };
// Una miniatura .min.jpg puede ser un WebP por dentro (desde el 6/10/2026):
// el tipo se mira en los primeros bytes, no en el nombre.
export function tipoDe(ruta, datos){
  if(datos && datos.length >= 12 && datos.toString("ascii", 0, 4) === "RIFF" && datos.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  const ext = (ruta.split(".").pop() || "").toLowerCase();
  return TIPOS[ext] || "application/octet-stream";
}

// Las fotos y adjuntos que nombran unas filas (con su miniatura al lado):
// al traer un posteo borrado con SOLO, vuelven sus archivos y nada más.
export function rutasDeFilas(filas){
  const rutas = new Set();
  const esRuta = v => typeof v === "string" && v && !v.startsWith("data:") && !/^https?:/.test(v);
  for(const f of filas || []){
    for(const img of Array.isArray(f.images) ? f.images : []){
      if(esRuta(img)){ rutas.add(img); rutas.add(img.replace(/\.[A-Za-z0-9]+$/, "") + ".min.jpg"); }
    }
    for(const a of Array.isArray(f.files) ? f.files : []) if(a && esRuta(a.path)) rutas.add(a.path);
  }
  return rutas;
}

const encabezados = extra => ({ apikey: cfg.llave, Authorization: `Bearer ${cfg.llave}`, ...extra });

async function cargarLote(tabla, filas){
  const res = await fetch(`${cfg.url}/rest/v1/${tabla}?on_conflict=${TABLAS[tabla]}`, {
    method: "POST",
    headers: encabezados({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(filas),
  });
  // Sin el texto de la respuesta: podría repetir un dato.
  if(!res.ok) throw new Error(`Supabase ${res.status}`);
}

async function subirArchivo(ruta, datos){
  const camino = ruta.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${camino}`, {
    method: "POST",
    headers: encabezados({ "Content-Type": tipoDe(ruta, datos), "x-upsert": "false", "cache-control": "max-age=31536000" }),
    body: datos,
  });
  if(res.ok) return "subido";
  // Ya estaba (la app nunca reescribe una ruta: si está, es la misma).
  if(res.status === 409) return "estaba";
  let cuerpo = null;
  try{ cuerpo = await res.json(); }catch(e){}
  if(cuerpo && (String(cuerpo.statusCode) === "409" || /exists|Duplicate/i.test(String(cuerpo.error || "")))) return "estaba";
  throw new Error(`Supabase ${res.status}`);
}

export async function main(){
  leerConfiguracion();
  const fallas = [];
  const resumen = { filas: 0, porTabla: [], subidos: 0, estaban: 0, archivos: 0 };
  console.log(`## Restaurar una copia${cfg.simular ? " (sin escribir: solo cuenta)" : ""}\n`);

  let pedidas = null;   // con SOLO: las rutas de lo que se trajo
  if(cfg.que !== "archivos"){
    const tablas = leerTablas(cfg.origen);
    for(const tabla of ORDEN){
      let filas = tablas[tabla];
      if(!Array.isArray(filas)) continue;
      if(cfg.solo){
        if(!cfg.solo[tabla]) continue;
        const clave = TABLAS[tabla];
        filas = filas.filter(f => cfg.solo[tabla].has(String(f[clave])));
        const faltan = cfg.solo[tabla].size - filas.length;
        if(faltan) fallas.push(`${tabla}: ${faltan} de las pedidas no están en esta copia`);
        pedidas = pedidas || new Set();
        rutasDeFilas(filas).forEach(r => pedidas.add(r));
      }
      let hechas = 0;
      for(let i = 0; i < filas.length; i += LOTE){
        const lote = filas.slice(i, i + LOTE);
        try{ if(!cfg.simular) await cargarLote(tabla, lote); hechas += lote.length; }
        catch(err){ fallas.push(`${tabla}, filas ${i + 1} a ${i + lote.length}: ${err.message}`); }
      }
      resumen.filas += hechas;
      resumen.porTabla.push(`${tabla} ${hechas}`);
    }
    console.log(`- Tablas: ${resumen.filas} filas ${cfg.simular ? "para cargar" : "cargadas"} (${resumen.porTabla.join(", ") || "ninguna"})`);
  }

  if(cfg.que !== "tablas"){
    const rutas = listarArchivos(cfg.origen).filter(r => !pedidas || pedidas.has(r));
    resumen.archivos = rutas.length;
    for(const ruta of rutas){
      try{
        if(cfg.simular){ resumen.subidos++; continue; }
        const r = await subirArchivo(ruta, readFileSync(join(cfg.origen, "archivos", ...ruta.split("/"))));
        if(r === "subido") resumen.subidos++; else resumen.estaban++;
      }catch(err){ fallas.push(`archivo nº ${resumen.subidos + resumen.estaban + 1}: ${err.message}`); }
    }
    console.log(`- Archivos en la copia: ${rutas.length}; ${cfg.simular ? "para subir" : "subidos"}: ${resumen.subidos}; ya estaban: ${resumen.estaban}`);
  }

  if(fallas.length){
    console.log(`\n### ⚠️ Quedaron ${fallas.length} cosas sin restaurar\n`);
    console.log(fallas.slice(0, 20).map(f => `- ${f}`).join("\n"));
    process.exitCode = 1;
  }else{
    console.log(`\n✅ ${cfg.simular ? "Listo para restaurar." : "Restaurado."}`);
  }
  return { ...resumen, fallas };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.log(`\n### ⛔ No se pudo restaurar\n\n${err.message}`); process.exitCode = 1; });
}
