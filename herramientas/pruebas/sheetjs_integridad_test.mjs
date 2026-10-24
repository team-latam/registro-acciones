import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   SheetJS: se carga con su huella, y la huella es la del archivo de esa
   versión (24/10/2026, docs/AUDITORIA.md, S1)

   SheetJS abre las planillas: el visor de adjuntos (cualquiera que toque
   un .xlsx) y «Traer una lista» de la Agenda (un admin, con su sesión).
   Hasta hoy entraba SIN huella: el 6/10 se decidió así porque SheetJS no
   está en npm (U3), y la huella de las demás librerías se calcula del
   paquete de npm (jszip_integridad_test). Pero su servidor sirve cada
   versión como un archivo fijo, y la huella se puede calcular de ese
   archivo. Sin ella, si cdn.sheetjs.com sirviera otra cosa, correría con
   la sesión de quien abre la planilla.

   Desde el sandbox de Claude Code no se llega a cdn.sheetjs.com: ahí se
   comprueba solo que index.html pase la huella, y la comparación con el
   archivo la hace GitHub (CI=true), que sí llega. En GitHub, no poder
   bajarlo es una falla: es la única comprobación de verdad.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const constante = n => (src.match(new RegExp(`const ${n} = "([^"]+)"`)) || [])[1] || "";
const CDN = constante("SHEETJS_CDN"), SRI = constante("SHEETJS_SRI");
const m = /^https:\/\/cdn\.sheetjs\.com\/xlsx-(\d+\.\d+\.\d+)\/package\/dist\/xlsx\.full\.min\.js$/.exec(CDN);
eq("la dirección es el xlsx.full.min.js de una versión fija de cdn.sheetjs.com", !!m, true);
eq("la huella es sha384", /^sha384-[A-Za-z0-9+/]{64}$/.test(SRI), true);
const llamadas = [...src.matchAll(/cargarScript\(\s*SHEETJS_CDN\s*(,\s*SHEETJS_SRI\s*)?\)/g)];
eq("cada vez que se carga, va con su huella", [llamadas.length > 0, llamadas.every(x => !!x[1])], [true, true]);
// Y la CSP nombra el archivo, no el servidor entero.
const csp = (src.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [, ""])[1];
eq("la CSP nombra ese archivo", csp.includes(CDN), true);

let bytes = null;
try{
  const r = await fetch(CDN, { signal: AbortSignal.timeout(30000) });
  if(r.ok) bytes = Buffer.from(await r.arrayBuffer());
  else console.log(`(cdn.sheetjs.com contestó ${r.status})`);
}catch(e){ /* sin red */ }

if(!bytes){
  if(process.env.CI === "true"){ console.log("✗ en GitHub no se pudo bajar SheetJS para comprobar la huella"); fail++; }
  else console.log("(sin llegar a cdn.sheetjs.com desde acá: la huella contra el archivo la comprueba GitHub)");
}else{
  const calculada = "sha384-" + crypto.createHash("sha384").update(bytes).digest("base64");
  eq("la huella de index.html es la del archivo de esa versión", calculada, SRI);
  const b = await chromium.launch();
  const p = await b.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.setContent("<!doctype html><title>sheetjs</title>");
  await p.addScriptTag({ content: bytes.toString("utf8") });
  const r = await p.evaluate(() => {
    const libro = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(libro, window.XLSX.utils.aoa_to_sheet([["País", "Ciudad"], ["Argentina", "Córdoba"]]), "Agenda");
    const leido = window.XLSX.read(window.XLSX.write(libro, { type: "array", bookType: "xlsx" }), { type: "array" });
    return { version: window.XLSX.version, filas: window.XLSX.utils.sheet_to_json(leido.Sheets.Agenda, { defval: "" }),
             html: /<td[^>]*>Córdoba<\/td>/.test(window.XLSX.utils.sheet_to_html(leido.Sheets.Agenda)) };
  });
  eq("la versión que corre es la de index.html", r.version, m && m[1]);
  eq("arma una planilla y la lee de nuevo (lo que hace «Traer una lista»)", r.filas, [{ "País": "Argentina", "Ciudad": "Córdoba" }]);
  eq("y la muestra como tabla (lo que hace el visor)", r.html, true);
  eq("sin errores de página", errores, []);
  await b.close();
}
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
