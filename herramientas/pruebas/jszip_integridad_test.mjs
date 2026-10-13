import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   JSZip: la huella es la del archivo de esa versión, y la librería anda
   (docs/AUDITORIA.md, R26)

   JSZip arma el .zip de la copia de seguridad y de «Descargar todo», y lee
   los .docx/.zip que se suben. Se carga a demanda con su huella (SRI), igual
   que la de la sesión (supabase_integridad_test.mjs). Subir la versión es
   cambiar dos constantes a la vez; si queda una sola, el navegador frena la
   librería y el botón no hace nada. Acá se baja el paquete de npm, se
   comprueba que la huella de index.html sea la de ese archivo y se usa la
   librería de verdad en un Chromium: arma un zip, lo lee de nuevo desde
   un ArrayBuffer y desde un Blob (los dos casos que cambiaron en la 3.10.2).
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const constante = n => (src.match(new RegExp(`const ${n} = "([^"]+)"`)) || [])[1] || "";
const CDN = constante("JSZIP_CDN"), SRI = constante("JSZIP_SRI");
const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@(\d+\.\d+\.\d+)\/dist\/jszip\.min\.js$/.exec(CDN);
eq("la dirección es el archivo jszip.min.js del paquete, con versión fija, de jsDelivr", !!m, true);
eq("la huella es sha384", /^sha384-[A-Za-z0-9+/]{64}$/.test(SRI), true);

if(m){
  const tmp = fs.mkdtempSync(os.tmpdir() + "/jszip-");
  let bytes = null;
  try{
    const tgz = execFileSync("npm", ["pack", `jszip@${m[1]}`, "--silent"], { cwd: tmp, timeout: 120000, encoding: "utf8" }).trim().split("\n").pop();
    bytes = execFileSync("tar", ["-xzOf", `${tmp}/${tgz}`, "package/dist/jszip.min.js"], { maxBuffer: 20 * 1024 * 1024 });
  }catch(e){ console.log("✗ no se pudo bajar el paquete de npm para comprobar la huella:", String(e.message).slice(0, 200)); fail++; }
  fs.rmSync(tmp, { recursive: true, force: true });
  if(bytes){
    eq("la huella de index.html es la del archivo de esa versión", "sha384-" + crypto.createHash("sha384").update(bytes).digest("base64"), SRI);

    const b = await chromium.launch();
    const p = await b.newPage();
    const errores = [];
    p.on("pageerror", e => errores.push(String(e)));
    await p.setContent("<!doctype html><title>jszip</title>");
    await p.addScriptTag({ content: bytes.toString("utf8") });
    const r = await p.evaluate(async () => {
      const zip = new window.JSZip();
      zip.file("copia/posts.json", JSON.stringify([{ id: "a", título: "Visita a Córdoba ñandú" }]));
      zip.file("copia/foto.png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), { binary: true });
      zip.file("copia/desde-blob.txt", new Blob(["hola desde un Blob"], { type: "text/plain" }));
      const buffer = await zip.generateAsync({ type: "arraybuffer" });
      const deBuffer = await window.JSZip.loadAsync(buffer);
      const deBlob = await window.JSZip.loadAsync(new Blob([buffer]));
      const leer = async z => ({
        nombres: Object.keys(z.files).filter(n => !z.files[n].dir).sort(),
        json: await z.file("copia/posts.json").async("string"),
        png: [...(await z.file("copia/foto.png").async("uint8array"))],
        blob: await z.file("copia/desde-blob.txt").async("string"),
      });
      return { version: window.JSZip.version, buffer: await leer(deBuffer), blob: await leer(deBlob), bytes: buffer.byteLength > 100 };
    });
    eq("la versión que corre es la de index.html", r.version, m[1]);
    const esperado = { nombres: ["copia/desde-blob.txt", "copia/foto.png", "copia/posts.json"], json: '[{"id":"a","título":"Visita a Córdoba ñandú"}]', png: [137, 80, 78, 71, 13, 10, 26, 10], blob: "hola desde un Blob" };
    eq("arma un zip y lo lee de nuevo desde un ArrayBuffer (acentos, binario y un Blob adentro)", r.buffer, esperado);
    eq("y desde un Blob (lo que devuelve un <input type=file>)", r.blob, esperado);
    eq("sin errores de página", errores, []);
    await b.close();
  }
}
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
