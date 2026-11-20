import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawn } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
import { achicar } from "../publicar/achicar.mjs";
import { conHuellas, scriptsEscritos } from "../publicar/csp.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("../..", import.meta.url));

/* ======================================================================
   La página achicada es la misma app (auditoría del 20/11/2026, D21-A)

   «Publicar el sitio» saca espacios, saltos de línea y comentarios del JavaScript y del CSS de la
   página (herramientas/publicar/achicar.mjs), y recién ahí le pone las huellas de la CSP. Esta
   prueba arma esa página y comprueba tres cosas:
   - que achica de verdad (un tercio menos por la red) y que lo de afuera de los scripts y estilos
     no se toca;
   - que sigue siendo publicable (las huellas de la CSP se arman igual);
   - que es la MISMA app: recorre todas las pantallas y ventanas (compu en español, celular en hebreo
     de derecha a izquierda) con el fuente y con la achicada, y compara, pantalla por pantalla, el
     texto y cómo está dibujado cada elemento (color, tamaño, espacios…). Sin una sola diferencia.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const fuente = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const chica = achicar(fuente);

// 1) Achica, y no toca lo de afuera.
const gz = s => zlib.gzipSync(s, { level: 9 }).length;
ok("la página achicada pesa menos de 75 % del fuente", chica.length < fuente.length * 0.75, `${chica.length} de ${fuente.length}`);
ok("y por la red (comprimida), menos de 75 %", gz(chica) < gz(fuente) * 0.75, `${gz(chica)} de ${gz(fuente)}`);
const sinCodigo = h => h.replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>/g, "<script$1></script>").replace(/<style(\s[^>]*)?>[\s\S]*?<\/style>/g, "<style$1></style>");
eq("lo que hay afuera de los scripts y los estilos queda igual, byte por byte", sinCodigo(chica) === sinCodigo(fuente), true);
eq("los mismos scripts y estilos que antes", [scriptsEscritos(chica).length, (chica.match(/<style[\s>]/g) || []).length], [scriptsEscritos(fuente).length, (fuente.match(/<style[\s>]/g) || []).length]);
ok("los textos entre comillas no se tocan: un texto largo de la app sigue ahí tal cual", chica.includes("Mientras editabas, otra persona cambió {c}. Si guardás, lo tuyo reemplaza lo de ella. ¿Guardar igual?") && chica.includes("תולדות"));
ok("sin comentarios de lo que se escribió para quien edita", !/\/\* ====+\s*\n/.test(scriptsEscritos(chica).join("\n")));
// 2) Sigue siendo publicable: las huellas de la CSP se arman sobre lo achicado.
const publicada = conHuellas(chica);
eq("las huellas de la CSP se arman: una por script", (publicada.match(/'sha256-/g) || []).length, scriptsEscritos(chica).length);
// Un fuente con un error de sintaxis frena la publicación (no sale una página a medias).
let freno = null; try{ achicar("<style>a{}</style><script type=\"module\">const = ;</script>"); }catch(e){ freno = e.message; }
ok("un script con un error de sintaxis frena el armado, con un mensaje claro", /No se pudo achicar un script de la página/.test(freno || ""), String(freno));

// 3) Es la misma app: el recorrido completo, con el fuente y con la achicada.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "achicar-"));
const archivoChico = path.join(dir, "index.html");
fs.writeFileSync(archivoChico, chica);
const AHORA = String(Date.now());   // los dos recorridos arman sus datos con el mismo «ahora» (ver AHORA_FIJO en app_de_mentira.mjs)
const recorrer = (index, ancho, alto, lang) => new Promise((resolve, reject) => {
  const h = spawn(process.execPath, ["achicar_vistas.mjs", ancho, alto, lang], { env: { ...process.env, INDEX: index, AHORA_FIJO: AHORA }, stdio: ["ignore", "pipe", "pipe"] });
  let salida = "", err = "";
  h.stdout.setEncoding("utf8"); h.stderr.setEncoding("utf8");   // sin esto, un carácter de varios bytes (hebreo, emoji) partido entre dos pedazos sale como «�»
  h.stdout.on("data", d => salida += d); h.stderr.on("data", d => err += d);
  h.on("close", codigo => { try{ resolve(JSON.parse(salida)); }catch(e){ reject(new Error(`el recorrido (${ancho}x${alto} ${lang}) no dio un resultado (código ${codigo}): ${err.slice(-600)}`)); } });
});
const fuenteAbs = process.env.INDEX || RAIZ + "index.html";
for(const [ancho, alto, lang, que] of [[1280, 900, "es", "compu, español"], [390, 844, "he", "celular, hebreo"]]){
  const [a, b] = await Promise.all([recorrer(fuenteAbs, ancho, alto, lang), recorrer(archivoChico, ancho, alto, lang)]);
  ok(`${que}: el recorrido llegó a muchas pantallas`, a.pasos.length >= 30 && a.pasos.length === b.pasos.length, `${a.pasos.length} y ${b.pasos.length}`);
  eq(`${que}: sin errores en la página, ni con el fuente ni con la achicada`, [a.errores, b.errores], [[], []]);
  eq(`${que}: las mismas pantallas, en el mismo orden`, b.pasos.map(x => x.nombre), a.pasos.map(x => x.nombre));
  const difTexto = a.pasos.map((x, i) => { const y = (b.pasos[i] || {}).texto || ""; if(x.texto === y) return null;
    const t1 = x.texto.split(" "), t2 = y.split(" "); let k = 0; while(k < t1.length && t1[k] === t2[k]) k++;
    return `${x.nombre}: «${t1.slice(Math.max(0, k - 3), k + 5).join(" ")}» ≠ «${t2.slice(Math.max(0, k - 3), k + 5).join(" ")}»`; }).filter(Boolean);
  eq(`${que}: el texto de cada pantalla es idéntico`, difTexto, []);
  const difEstilo = [];
  a.pasos.forEach((x, i) => { const y = b.pasos[i] || { elementos: [] };
    const n = Math.max(x.elementos.length, y.elementos.length); let d = 0, ej = "";
    for(let k = 0; k < n; k++) if(x.elementos[k] !== y.elementos[k]){ d++; if(!ej) ej = `${x.elementos[k]}  ≠  ${y.elementos[k]}`; }
    if(d) difEstilo.push(`${x.nombre}: ${d} elementos, p. ej. ${ej.slice(0, 300)}`); });
  eq(`${que}: cada elemento de cada pantalla se dibuja igual (color, tamaño, espacios…)`, difEstilo.slice(0, 5), []);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
