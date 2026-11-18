import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El armador de los PDF de Gastos es el de su versión (18/11/2026)

   pdf-lib se sirve desde el mismo sitio y no de afuera, como el lector:
   herramientas/publicar/pdf/README.md anota el archivo con su paquete de
   npm y su huella. Acá se comprueba que el archivo guardado tenga esa
   huella, que sea exactamente el del paquete publicado (se baja de npm),
   que no cree código al vuelo (la CSP no deja), que la app lo pida con ese
   nombre y que «Publicar el sitio» lo copie al lado de la página.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const CARPETA = RAIZ + "herramientas/publicar/pdf/";
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const leeme = fs.readFileSync(CARPETA + "README.md", "utf8");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");

const filas = [...leeme.matchAll(/^\| `([^`]+)` \| `(@?[^`@]+)@(\d[^`]*)`(?:, `([^`]*)`)? \| `([0-9a-f]{64})` \|$/gm)]
  .map(m => ({ archivo: m[1], paquete: m[2], version: m[3], dentro: m[4] || "", huella: m[5] }));
eq("el README anota el archivo, con paquete, versión y huella", filas.map(f => f.archivo), ["pdf-lib.min.js"]);
for(const f of filas){
  let b = null;
  try{ b = fs.readFileSync(CARPETA + f.archivo); }catch(e){}
  eq(`${f.archivo}: está y tiene la huella anotada`, b ? sha(b) : "falta", f.huella);
  eq(`${f.archivo}: no crea código al vuelo (eval / new Function), que la CSP no deja`, b ? /\beval\(|new Function\(/.test(b.toString("utf8")) : "falta", false);
}
eq("la licencia está al lado", fs.existsSync(CARPETA + "LICENSE-pdf-lib.md"), true);

// La app la pide con ese nombre, en la carpeta que se publica.
const pdf = (src.match(/const ARMADOR_PDF = \{([^}]*)\}/) || [])[1] || "";
const nombres = [...pdf.matchAll(/(\w+): "([^"]+)"/g)].reduce((o, m) => (o[m[1]] = m[2], o), {});
eq("la app busca el armador en pdf/, al lado de la página", nombres.carpeta, "pdf/");
eq("y pide el archivo que está guardado", !!nombres.programa && fs.existsSync(CARPETA + nombres.programa), true);
const pages = fs.readFileSync(RAIZ + ".github/workflows/pages.yml", "utf8");
eq("«Publicar el sitio» copia la carpeta entera a pdf/", /cp herramientas\/publicar\/pdf\/\* _sitio\/pdf\//.test(pages), true);
eq("la página no necesita permisos nuevos (sin 'unsafe-eval')", /unsafe-eval/.test((src.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || "unsafe-eval"), false);

// Y es exactamente el del paquete publicado en npm.
const tmp = fs.mkdtempSync(os.tmpdir() + "/pdf-");
try{
  for(const pq of [...new Set(filas.map(f => `${f.paquete}@${f.version}`))]){
    let tgz = "";
    try{ tgz = execFileSync("npm", ["pack", pq, "--silent"], { cwd: tmp, timeout: 180000, encoding: "utf8" }).trim().split("\n").pop(); }
    catch(e){ console.log(`✗ no se pudo bajar ${pq} de npm:`, String(e.message).slice(0, 200)); fail++; continue; }
    for(const f of filas.filter(x => `${x.paquete}@${x.version}` === pq)){
      const ruta = "package/" + (f.dentro ? f.dentro.replace(/\/?$/, "/") : "") + f.archivo;
      let b = null;
      try{ b = execFileSync("tar", ["-xzOf", `${tmp}/${tgz}`, ruta], { maxBuffer: 64 * 1024 * 1024 }); }catch(e){}
      eq(`${f.archivo}: es el mismo que publica ${pq}`, b ? sha(b) : "no está en el paquete", f.huella);
    }
  }
}finally{ fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
