import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Las piezas del lector de comprobantes son las de su versión (15/11/2026)

   El lector (Gastos) se sirve desde el mismo sitio y no de afuera, justo
   para que nadie pueda cambiarlo: herramientas/publicar/lector/README.md
   anota cada archivo con su paquete de npm y su huella. Acá se comprueba
   que los archivos guardados tengan esa huella, que sean exactamente los
   del paquete publicado (se baja de npm), que la app pida esos mismos
   nombres y que «Publicar el sitio» los copie al lado de la página.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const CARPETA = RAIZ + "herramientas/publicar/lector/";
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const leeme = fs.readFileSync(CARPETA + "README.md", "utf8");
const sha = b => crypto.createHash("sha256").update(b).digest("hex");

// | `archivo` | `paquete@versión`, `carpeta/` | `huella` |
const filas = [...leeme.matchAll(/^\| `([^`]+)` \| `(@?[^`@]+)@(\d[^`]*)`(?:, `([^`]*)`)? \| `([0-9a-f]{64})` \|$/gm)]
  .map(m => ({ archivo: m[1], paquete: m[2], version: m[3], dentro: m[4] || "", huella: m[5] }));
eq("el README anota los cuatro archivos, con paquete, versión y huella", filas.map(f => f.archivo).sort(),
  ["spa.traineddata.gz", "tesseract-core-simd-lstm.wasm.js", "tesseract.min.js", "worker.min.js"]);
for(const f of filas){
  let b = null;
  try{ b = fs.readFileSync(CARPETA + f.archivo); }catch(e){}
  eq(`${f.archivo}: está y tiene la huella anotada`, b ? sha(b) : "falta", f.huella);
}

// La app pide esos mismos nombres, en la carpeta que se publica.
const lector = (src.match(/const LECTOR = \{([^}]*)\}/) || [])[1] || "";
const nombres = [...lector.matchAll(/(\w+): "([^"]+)"/g)].reduce((o, m) => (o[m[1]] = m[2], o), {});
eq("la app busca el lector en lector/, al lado de la página", nombres.carpeta, "lector/");
eq("y pide los archivos que están guardados", [nombres.programa, nombres.trabajador, nombres.motor].every(n => n && fs.existsSync(CARPETA + n)), true);
eq("el español, con el nombre que espera el lector", fs.existsSync(CARPETA + "spa.traineddata.gz") && /createWorker\("spa"/.test(src), true);
const pages = fs.readFileSync(RAIZ + ".github/workflows/pages.yml", "utf8");
eq("«Publicar el sitio» copia la carpeta entera a lector/", /cp herramientas\/publicar\/lector\/\* _sitio\/lector\//.test(pages), true);
eq("la página no necesita permisos nuevos para el lector (sin 'wasm-unsafe-eval')", /wasm-unsafe-eval|unsafe-eval/.test((src.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || ""), false);

// Y son exactamente los del paquete publicado en npm.
const tmp = fs.mkdtempSync(os.tmpdir() + "/lector-");
try{
  const paquetes = [...new Set(filas.map(f => `${f.paquete}@${f.version}`))];
  for(const pq of paquetes){
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
