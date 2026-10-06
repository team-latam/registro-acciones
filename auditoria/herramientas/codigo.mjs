/* ======================================================================
   Código: lo que sobra, lo que falta y el tamaño

   - Funciones y constantes que nadie usa.
   - Botones con data-action que ninguna rama del despachador atiende, y
     ramas que ningún botón emite (las dos son errores silenciosos: el
     botón no hace nada, o el código quedó muerto).
   - Clases de CSS que ningún HTML ni JS usa (con cuidado con las que se
     arman con ${}: t-${tipo}, cols-${n}).
   - Cuántos puntos de quiebre (@media) distintos hay.
   - El tamaño del archivo (crudo y comprimido) y las funciones más largas.
   ====================================================================== */
import zlib from "node:zlib";
import { html, js, css, lineaDeJs, recorrer, hacerGrab, hallazgo, entregar } from "./comun.mjs";

const out = [];

/* --- Declaraciones de primer nivel y sus usos --- */
let codigo = ""; const pos = [];
for(const [i, c, prof] of recorrer(js)){ if(prof === 0){ codigo += c; pos.push(i); } }
const decl = [];
const reD = /(?:^|[;\n}])\s*(?:async\s+)?(function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
let m;
while((m = reD.exec(codigo))){ decl.push({ tipo: m[1], nombre: m[2], linea: lineaDeJs(pos[m.index + m[0].indexOf(m[2])]) }); }
const vistos = new Set();
const sinSpread = html.replace(/\.\.\./g, "   ");   // "...fn()" es un uso
for(const d of decl){
  if(vistos.has(d.nombre)) continue; vistos.add(d.nombre);
  const n = (sinSpread.match(new RegExp("(?<![\\w$.])" + d.nombre.replace(/\$/g, "\\$") + "(?![\\w$])", "g")) || []).length;
  if(n <= 1) out.push(hallazgo("código", "bajo", `«${d.nombre}» no lo usa nadie`, `index.html:${d.linea}`, d.tipo));
}

/* --- data-action contra el despachador --- */
const emitidas = new Set([...html.matchAll(/data-action="([a-z0-9-]+)"/g)].map(x => x[1]));
const dinamicas = [...html.matchAll(/data-action="([a-z0-9-]*)\$\{/g)].map(x => x[1]);   // "rm-scope-${...}"
const ramas = new Set([...js.matchAll(/^\s{4}"([a-z0-9-]+)":\s*async/gm)].map(x => x[1]));
const otras = new Set([...js.matchAll(/action\s*===\s*"([a-z0-9-]+)"|dataset\.action\s*===\s*"([a-z0-9-]+)"/g)].map(x => x[1] || x[2]));
for(const a of emitidas){
  if(!ramas.has(a) && !otras.has(a)) out.push(hallazgo("código", "medio", `El botón «${a}» no tiene quién lo atienda`, "", "data-action sin rama en el despachador ni en los listeners de change/input"));
}
for(const r of ramas){
  if(!emitidas.has(r) && !dinamicas.some(pre => pre && r.startsWith(pre)) && !new RegExp(`["'\`]${r}["'\`]`).test(js.replace(new RegExp(`"${r}":\\s*async`), "")))
    out.push(hallazgo("código", "bajo", `La rama «${r}» del despachador no la emite ningún botón`));
}

/* --- Clases de CSS sin uso --- */
// Sin comentarios (ahí aparecen ejemplos como ".xxx") ni lo de librerías
// que arman sus propias clases (docx-preview, Leaflet).
const cssSinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
const DE_LIBRERIAS = /^(docx|leaflet|marker-cluster)/;
const clases = new Set([...cssSinComentarios.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(x => x[1]).filter(c => !/^\d/.test(c) && !DE_LIBRERIAS.test(c)));
const fuera = html.replace(css, "");
// Las que se arman con ${}: "t-${tipo}", "l${nivel}" (prefijo pegado a ${).
const prefijosDinamicos = [...fuera.matchAll(/[\s"'`]([a-z][\w-]*)\$\{/g)].map(x => x[1]);
for(const c of clases){
  const usada = new RegExp(`(?<![\\w-])${c.replace(/[-]/g, "\\-")}(?![\\w-])`).test(fuera) || prefijosDinamicos.some(p => c.startsWith(p));
  if(!usada) out.push(hallazgo("código", "bajo", `La clase .${c} no la usa nada`));
}

/* --- Puntos de quiebre --- */
const medias = {};
[...css.matchAll(/@media\s*\(([^)]*)\)/g)].forEach(x => { const k = x[1].replace(/\s+/g, ""); medias[k] = (medias[k] || 0) + 1; });
const anchos = Object.keys(medias).filter(k => /width/.test(k));
if(anchos.length > 6) out.push(hallazgo("diseño", "bajo", `Hay ${anchos.length} puntos de quiebre distintos`, "", anchos.map(k => `${k}×${medias[k]}`).join(", ")));
out.push(hallazgo("código", "dato", "Puntos de quiebre", "", Object.entries(medias).map(([k, v]) => `${k}×${v}`).join(", ")));

/* --- Tamaño --- */
const kb = n => Math.round(n / 1024);
out.push(hallazgo("rendimiento", "dato", `index.html: ${kb(Buffer.byteLength(html))} KB, ${kb(zlib.gzipSync(html).length)} KB comprimido`, "", `${html.split("\n").length} líneas`));
if(zlib.gzipSync(html).length > 500 * 1024) out.push(hallazgo("rendimiento", "medio", "index.html pasa los 500 KB comprimido", "", "cada visita lo baja entero"));
const grab = hacerGrab(html);
const largas = [...vistos].map(n => { try{ const c = grab(n); return [n, c.split("\n").length]; }catch(e){ return [n, 0]; } })
  .filter(([, l]) => l > 120).sort((a, b) => b[1] - a[1]);
largas.slice(0, 10).forEach(([n, l]) => out.push(hallazgo("código", l > 300 ? "bajo" : "dato", `«${n}» tiene ${l} líneas`)));
entregar("codigo", out);
