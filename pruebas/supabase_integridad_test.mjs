/* ======================================================================
   La librería que maneja la sesión entra con versión fija y con su huella
   (auditoría del 10/10/2026, R15)

   supabase-js era lo único que entraba sin huella (SRI): se pedía con un
   import() a la dirección «+esm» de jsDelivr, que arma su servidor al
   pedirla y no admite integrity. Ahora se carga el archivo UMD del paquete
   de npm, con versión fija y huella, como JSZip y docx-preview. Esta prueba:
   1. baja de npm el paquete de ESA versión y comprueba que la huella que
      lleva index.html es la de su archivo (así, subir la versión sin cambiar
      la huella la hace fallar, y al revés);
   2. con la librería de verdad, el navegador la acepta y la app llega a la
      portada de entrada;
   3. con el mismo archivo adulterado en un byte, el navegador la frena y la
      app muestra su cartel de «no se pudo conectar»: la huella se hace
      cumplir de verdad, no es un adorno.
   No usa la puerta de las otras pruebas (__pruebasSinIntegridad).
   Necesita llegar al registro de npm (como `npm ci` en GitHub).
   ====================================================================== */
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const RUTA = process.env.INDEX || RAIZ + "index.html";
const src = fs.readFileSync(RUTA, "utf8");

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const constante = n => (src.match(new RegExp(`const ${n} = "([^"]+)"`)) || [])[1] || "";

const CDN = constante("SUPABASE_CDN"), SRI = constante("SUPABASE_SRI");
const m = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@(\d+\.\d+\.\d+)\/dist\/umd\/supabase\.js$/.exec(CDN);
eq("la dirección es el archivo UMD del paquete, con versión fija (@x.y.z), de jsDelivr", !!m, true);
eq("la huella es sha384", /^sha384-[A-Za-z0-9+/]{64}$/.test(SRI), true);
eq("la página no vuelve a pedir una librería con import() a una dirección de afuera", [...src.matchAll(/\bimport\(\s*["']https?:/g)].length, 0);
eq("se carga con su huella (cargarScript(SUPABASE_CDN, SUPABASE_SRI))", /cargarScript\(SUPABASE_CDN, SUPABASE_SRI\)/.test(src), true);
if(!m){ console.log(`\n${pass} pasaron, ${fail} fallaron`); process.exit(fail ? 1 : 0); }

// 1) El archivo de ESA versión, del registro de npm: jsDelivr sirve los archivos de /npm/ tal cual.
const tmp = fs.mkdtempSync(os.tmpdir() + "/supabase-js-");
let bytes = null;
try{
  const tgz = execFileSync("npm", ["pack", `@supabase/supabase-js@${m[1]}`, "--silent"], { cwd: tmp, timeout: 120000, encoding: "utf8" }).trim().split("\n").pop();
  bytes = execFileSync("tar", ["-xzOf", `${tmp}/${tgz}`, "package/dist/umd/supabase.js"], { maxBuffer: 20 * 1024 * 1024 });
}catch(e){ console.log("✗ no se pudo bajar el paquete de npm para comprobar la huella:", String(e.message).slice(0, 200)); fail++; }
if(bytes){
  eq("la huella de index.html es la del archivo de esa versión", "sha384-" + crypto.createHash("sha384").update(bytes).digest("base64"), SRI);

  // 2 y 3) En el navegador, con el archivo de verdad y con uno adulterado.
  const b = await chromium.launch();
  async function cargar(cuerpo){
    const p = await b.newPage();
    const consola = [];
    p.on("console", x => { if(x.type() === "error") consola.push(x.text()); });
    await p.route(/^https?:\/\//, ruta => ruta.request().url() === CDN ? ruta.fulfill({ contentType: "application/javascript", headers: { "access-control-allow-origin": "*" }, body: cuerpo }) : ruta.abort());
    await p.goto("file://" + RUTA);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ lib: typeof (window.supabase && window.supabase.createClient), portada: document.body.classList.contains("en-portada"), texto: document.body.innerText.replace(/\s+/g, " ").slice(0, 300) }));
    await p.close();
    return { ...r, consola };
  }
  const bien = await cargar(bytes);
  eq("con el archivo de verdad, el navegador lo acepta (hay createClient)", bien.lib, "function");
  eq("y la app llega a la portada de entrada, sin el cartel de «no se pudo conectar»", [bien.portada, /No se pudo conectar con la base de datos/.test(bien.texto)], [true, false]);
  const malo = await cargar(Buffer.concat([bytes, Buffer.from("\n/* adulterado */")]));
  eq("con un byte de más, el navegador lo frena (no hay createClient)", malo.lib, "undefined");
  eq("y la app avisa que no pudo conectar, en vez de seguir sin saber", /No se pudo conectar con la base de datos/.test(malo.texto), true);
  await b.close();
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} pasaron, ${fail} fallaron`);
