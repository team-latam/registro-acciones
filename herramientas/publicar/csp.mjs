/* ======================================================================
   La CSP del sitio publicado, con las huellas de los scripts de la página
   (24/10/2026, docs/AUDITORIA.md, S2)
   ======================================================================
   index.html trae dos scripts escritos adentro (el del tema y el idioma, y
   el módulo con la app entera). Para que corran, su CSP dice
   'unsafe-inline': cualquier script escrito en la página corre. Eso incluye
   uno que lograra colarse por un XSS, y entonces la CSP no traba nada.

   La CSP admite, en lugar de eso, la huella (sha256) de cada script: corre
   el que coincide, byte por byte, y ningún otro. Escribir la huella en el
   fuente obligaría a recalcularla en cada cambio de la app; por eso se pone
   AL PUBLICAR: «Publicar el sitio» (.github/workflows/pages.yml) pasa
   index.html por acá y publica lo que sale. El fuente no cambia, y las
   pruebas (que corren con el fuente) siguen igual;
   herramientas/pruebas/csp_publicada_test.mjs prueba lo que sale de acá.

   Con las huellas, el navegador ignora 'unsafe-inline' (así lo dice la
   norma, CSP nivel 2): se deja escrito para un navegador viejísimo que no
   entienda huellas, que igual andaría como hoy.

   Uso:  node herramientas/publicar/csp.mjs index.html > _sitio/index.html
   ====================================================================== */
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

// Los scripts escritos en la página, sin src: lo que hay entre <script …> y
// </script>, tal cual (la huella es de esos bytes exactos).
export function scriptsEscritos(html){
  return [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(m => !/\ssrc\s*=/.test(m[1] || ""))
    .map(m => m[2]);
}
export const huella = codigo => `'sha256-${crypto.createHash("sha256").update(codigo, "utf8").digest("base64")}'`;

export function conHuellas(html){
  const meta = /(<meta http-equiv="Content-Security-Policy" content=")([^"]+)(")/;
  const m = meta.exec(html);
  if(!m) throw new Error("index.html no tiene la CSP en un <meta>: no hay dónde poner las huellas.");
  const huellas = scriptsEscritos(html).map(huella);
  if(!huellas.length) throw new Error("No encontré ningún script escrito en la página.");
  const directivas = m[2].split(";").map(x => x.trim()).filter(Boolean);
  const i = directivas.findIndex(d => /^script-src\s/.test(d));
  if(i < 0) throw new Error("La CSP no tiene script-src.");
  if(!/'unsafe-inline'/.test(directivas[i])) throw new Error("script-src ya no dice 'unsafe-inline': ¿se cambió la CSP a mano?");
  directivas[i] = directivas[i].replace("'unsafe-inline'", `'unsafe-inline' ${huellas.join(" ")}`);
  return html.replace(meta, `$1${directivas.join("; ")}$3`);
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  const archivo = process.argv[2];
  if(!archivo){ console.error("Uso: node herramientas/publicar/csp.mjs index.html > salida.html"); process.exit(2); }
  process.stdout.write(conHuellas(fs.readFileSync(archivo, "utf8")));
}
