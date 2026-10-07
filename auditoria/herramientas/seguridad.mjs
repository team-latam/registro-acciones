/* ======================================================================
   Seguridad y datos personales

   - Lo que se mete en el HTML sin escapar: cada ${...} de una plantilla
     que no pasa por esc() (ni es un número, una traducción o otra pieza ya
     armada). Es la puerta de un XSS: un título con <img onerror=...>.
   - Librerías de afuera sin «integridad» (SRI): si el CDN se compromete,
     corre código ajeno con la sesión de quien mira.
   - A qué servicios de afuera habla la app (una lista para mirar: uno
     nuevo, o uno que recibe datos, se discute).
   - Datos personales y llaves en el repo, que es PÚBLICO: correos,
     teléfonos, llaves de servicio.
   - Los workflows: permisos mínimos, y que los trabajos con llaves solo
     corran con el código de main.
   - La política de contenido (CSP) de la página.
   ====================================================================== */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { RAIZ, html, js, lineaDeJs, hallazgo, entregar } from "./comun.mjs";

const out = [];

/* --- ${} sin escapar dentro de plantillas que arman HTML --- */
const SEGURO = /===|!==|^\s*(nl2br|highlightMentions|crossLine|esc|escAttr|t|fmt\w*|safeColor|safeImageSrc|safeFileDataUrl|fotoSegura|cityLabel|countryLabel|String\(Number|Number|Math\.\w+|encodeURIComponent)\(|^\s*(render\w*|\w+Html|html\w*|\w+Chip|\w+Pill|avatar\w*|iconoDe\w*|svg\w*|chevron\w*|\w+Btn|\w+Menu|\w+Block|\w+Row|\w+Section|grafico\w*|bloque\w*|seccion\w*|tira\w*|kpi|delta\w*|cabeza\w*)\b|^\s*[\w.]+\.(length|size)\s*$|^\s*-?\d|^\s*(i|j|n|idx|i \+ 1|total|count|cnt|pct)\s*$|\?\s*["'`]|^\s*["'`]|^\s*[\w.]+\.(includes|some|every|has|startsWith|endsWith)\([^()]*\)\s*$|^\s*[\w.]+\s*\?\s*esc\(.*:\s*esc\(/;
const reExp = /\$\{/g;
let m, revisar = 0;
while((m = reExp.exec(js))){
  // Solo plantillas que arman HTML: hay un "<" en los 300 caracteres de antes en la misma plantilla.
  const antes = js.slice(Math.max(0, m.index - 300), m.index);
  const ultimoBacktick = antes.lastIndexOf("`");
  if(ultimoBacktick < 0 || !/<[a-z]/i.test(antes.slice(ultimoBacktick))) continue;
  let prof = 1, j = m.index + 2;
  while(j < js.length && prof){ if(js[j] === "{") prof++; else if(js[j] === "}") prof--; j++; }
  const expr = js.slice(m.index + 2, j - 1).trim();
  if(SEGURO.test(expr) || expr.length > 160 || (/\.map\(/.test(expr) && /esc\(/.test(expr))) continue;
  // Solo lo que viene escrito por alguien: un título, un nombre, una
  // ciudad... Una variable con HTML ya armado es otra cosa (eso lo prueba
  // datos.mjs con la app andando, metiendo HTML en cada campo).
  if(!/\.(title|content|name|nickname|email|city|country|label|location|summary|description|texto|text|motivo|organizer|detail|fileName|titulo|nombre)\b/.test(expr)) continue;
  revisar++;
  if(revisar <= 60) out.push(hallazgo("seguridad", "medio", "Un dato escrito por alguien entra al HTML sin esc()", `index.html:${lineaDeJs(m.index)}`, "${" + expr + "}"));
}
if(revisar > 60) out.push(hallazgo("seguridad", "dato", `Y ${revisar - 60} más para revisar a mano`));

/* --- innerHTML --- */
out.push(hallazgo("seguridad", "dato", `Asignaciones a innerHTML: ${(js.match(/\.innerHTML\s*=/g) || []).length}`));

/* --- Librerías de afuera --- */
[...html.matchAll(/<script[^>]*\ssrc="(https?:[^"]+)"[^>]*>/g)].forEach(x => {
  if(!/integrity=/.test(x[0])) out.push(hallazgo("seguridad", "importante", "Script de afuera sin integridad (SRI)", x[1]));
});
[...js.matchAll(/cargarScript\(\s*([\w.]+)\s*(?:,\s*([\w.]+))?\s*\)/g)].forEach(x => {
  if(!x[2]) out.push(hallazgo("seguridad", "medio", "Librería que se carga sin integridad", x[1], "cargarScript sin el segundo argumento"));
});

/* --- Servicios de afuera --- */
const hosts = new Set([...html.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map(x => x[1].toLowerCase()));
const CONOCIDOS = /(supabase\.co|googleapis\.com|google\.com|gstatic\.com|jsdelivr\.net|unpkg\.com|sheetjs\.com|openstreetmap\.org|cartocdn\.com|mymemory\.translated\.net|github\.(io|com)|githubusercontent\.com|googleusercontent\.com|w3\.org|apple\.com|whatsapp\.com|wa\.me|cloudflare\.com|fonts\.)/;
const nuevos = [...hosts].filter(h => !CONOCIDOS.test(h));
out.push(hallazgo("seguridad", "dato", `Servicios de afuera nombrados: ${hosts.size}`, "", [...hosts].sort().join(", ")));
nuevos.forEach(h => out.push(hallazgo("seguridad", "bajo", "Un servicio de afuera que no está en la lista conocida", h, "¿qué datos recibe?")));

/* --- CSP --- */
const csp = (/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i.exec(html) || [])[1];
if(!csp) out.push(hallazgo("seguridad", "medio", "La página no tiene política de contenido (CSP)"));
else { if(!/object-src 'none'/.test(csp)) out.push(hallazgo("seguridad", "bajo", "La CSP no prohíbe object-src")); if(!/base-uri/.test(csp)) out.push(hallazgo("seguridad", "bajo", "La CSP no fija base-uri")); }

/* --- Datos personales y llaves en el repo (es público) --- */
const archivos = execSync("git ls-files", { cwd: RAIZ, encoding: "utf8" }).split("\n").filter(f => f && !/\.(png|jpg|gz|zip|docx?|xlsx?|pdf)$/.test(f));
const CORREO_OK = /ciudad@gmail\.com|@adentro\.com|^atacante@|@(x\.com|example\.(com|org)|ejemplo\.|users\.noreply\.github\.com|noreply\.|anthropic\.com|group\.calendar\.google\.com|group\.v\.calendar\.google\.com|dominio\.com|pedro\.com|github\.com|y\.com|proyecto\.iam\.gserviceaccount\.com|resend\.dev)|^benny@team-latam\.com$|^-?info@team-latam\.com$|^(nueva|otra|ana|diego|lucia|moshe|juan|obs|nombre|name|nome|largo|veneno|pide|nadie)@/i;
const vistosCorreo = new Map();
for(const f of archivos){
  let txt; try{ txt = fs.readFileSync(RAIZ + f, "utf8"); }catch(e){ continue; }
  for(const c of txt.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)){
    if(CORREO_OK.test(c[0]) || /\.(png|js|css|mjs)$/.test(c[0])) continue;
    if(!vistosCorreo.has(c[0])) vistosCorreo.set(c[0], f);
  }
  // «sk_(?:live)_» y no la palabra junta: si no, esta misma línea se marcaba
  // como llave (7/10/2026).
  if(/service_role["']?\s*[:=]\s*["']ey|sk_(?:live)_|-----BEGIN [A-Z ]*PRIVATE KEY/.test(txt)) out.push(hallazgo("seguridad", "urgente", "Parece una llave secreta en el repo", f));
  for(const t of txt.matchAll(/(?<![\d.])\+?\d{2,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]\d{3,4}(?![\d.])/g))
    if(!/\d{4}-\d{2}-\d{2}/.test(t[0])) { out.push(hallazgo("datos personales", "bajo", "Parece un teléfono", f, t[0])); break; }
}
vistosCorreo.forEach((f, c) => out.push(hallazgo("datos personales", "bajo", "Un correo en el repo público", f, c)));

/* --- Workflows --- */
const flujos = archivos.filter(f => f.startsWith(".github/workflows/"));
for(const f of flujos){
  const y = fs.readFileSync(RAIZ + f, "utf8");
  if(!/^permissions:/m.test(y) && !/^\s+permissions:/m.test(y)) out.push(hallazgo("seguridad", "medio", "Workflow sin permisos declarados (hereda los de más)", f));
  // Cada trabajo que usa una llave tiene que correr solo con el código de main.
  const trabajos = y.split(/\n  (?=[a-z][\w-]*:\n)/).slice(1);
  for(const tr of trabajos){
    const nombre = tr.split(":")[0];
    if(/secrets\.(?!GITHUB_TOKEN)/.test(tr) && !/refs\/heads\/main/.test(tr) && !/^on:\s*\n\s+(schedule|workflow_dispatch)/m.test(y))
      out.push(hallazgo("seguridad", "importante", "Un trabajo con llaves que podría correr con código de otra rama", `${f} › ${nombre}`));
  }
}
entregar("seguridad", out);
