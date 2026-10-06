import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Lo que se carga de afuera, con versión fija y huella (docs/AUDITORIA.md, I3)

   Un script de un CDN corre con la sesión del equipo adentro. Con la huella
   de integridad, si el CDN sirviera otra cosa el navegador no la corre.
   Las pruebas de la app sirven librerías de mentira en esas direcciones (y
   por eso apagan la huella), así que esto mira el index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const cabeza = src.slice(0, src.indexOf('<script type="module">'));

// Cada <script src> y <link rel=stylesheet> de un CDN: versión fija y huella.
const etiquetas = [...cabeza.matchAll(/<(script|link)\b[^>]*(?:src|href)="(https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com)[^"]+)"[^>]*>/g)];
eq("hay librerías de CDN en la página (si no, esta prueba no mira nada)", etiquetas.length >= 4, true);
eq("todas con huella de integridad sha256/384", etiquetas.filter(m => !/integrity="sha(256|384)-[A-Za-z0-9+/=]+"/.test(m[0])).map(m => m[2]), []);
eq("todas con versión fija (@x.y.z)", etiquetas.filter(m => !/@\d+\.\d+\.\d+\//.test(m[2])).map(m => m[2]), []);

// Las que se cargan a demanda.
const constante = n => (src.match(new RegExp(`const ${n} = "([^"]+)"`)) || [])[1] || "";
eq("JSZip, de jsDelivr con versión fija", /^https:\/\/cdn\.jsdelivr\.net\/npm\/jszip@\d+\.\d+\.\d+\//.test(constante("JSZIP_CDN")), true);
eq("y con su huella", /^sha384-/.test(constante("JSZIP_SRI")), true);
eq("docx-preview con su huella", /^sha384-/.test(constante("DOCX_PREVIEW_SRI")), true);
eq("se cargan pasando la huella", [/cargarScript\(JSZIP_CDN, JSZIP_SRI\)/.test(src), /cargarScript\(DOCX_PREVIEW_CDN, DOCX_PREVIEW_SRI\)/.test(src), /cargarScript\(JSZIP_CDN\)/.test(src)], [true, true, false]);
const sheet = constante("SHEETJS_CDN");
const v = (sheet.match(/xlsx-(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
eq("SheetJS en una versión con los arreglos de seguridad (0.19.3 o más)", v.length === 3 && (v[0] > 0 || v[1] > 19 || (v[1] === 19 && v[2] >= 3)), true);

// La política de seguridad mínima.
eq("hay CSP con object-src y base-uri cerrados", /http-equiv="Content-Security-Policy" content="[^"]*object-src 'none'[^"]*base-uri 'none'/.test(cabeza), true);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
