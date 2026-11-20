/* ======================================================================
   Achicar la página al publicar (auditoría del 20/11/2026, D21-A)
   ======================================================================
   index.html es una sola página con la app entera adentro: ~34.000
   líneas, ~2,5 MB, ~755 KB por la red. En un celular con datos eso es lo
   primero que se siente: el teléfono baja y lee todo antes de mostrar
   algo. Un tercio de eso (con esto, ~515 KB por la red) son espacios,
   sangrías y comentarios que solo le sirven a quien edita el archivo.

   Acá se sacan AL PUBLICAR, igual que las huellas de csp.mjs: el fuente no
   cambia (se sigue editando y probando tal cual), y «Publicar el sitio»
   (.github/workflows/pages.yml) pasa index.html por acá y después por csp.mjs.

   Qué se hace, y qué NO (a propósito):
   - Se sacan espacios, saltos de línea y comentarios, y se simplifican
     expresiones (true → !0, if(a){b} → a&&b…) del JavaScript y del CSS
     escritos en la página.
   - NO se cambian los nombres de nada (minifyIdentifiers apagado): la app
     busca cosas por su nombre y el dispatcher delegado usa textos de
     `data-action`; cambiarlos ahorraría ~10 % más, y no vale el riesgo.
   - NO se baja a un JavaScript más viejo (target esnext): la app ya
     pide un navegador moderno (popover, :has, dialog).
   - El HTML de alrededor no se toca: lo que hay entre las etiquetas, con
     sus textos, queda como está.
   - Los textos entre comillas y las plantillas `…` NO cambian (esbuild
     no toca el contenido de un texto): lo que se ve en pantalla es igual.

   Uso:  node herramientas/publicar/achicar.mjs index.html > salida.html
   Lo prueba herramientas/pruebas/achicar_test.mjs.
   ====================================================================== */
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const COMUN = { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false, legalComments: "none", charset: "utf8", logLevel: "silent" };

function achicarCodigo(codigo, loader, donde){
  try{
    const r = transformSync(codigo, { ...COMUN, loader, ...(loader === "js" ? { format: "esm", target: "esnext" } : { target: "esnext" }) });
    return r.code.replace(/\n+$/, "");
  }catch(e){
    // Un error acá es un error de verdad en el fuente: se frena la publicación antes que subir algo a medias.
    throw new Error(`No se pudo achicar ${donde}: ${e.errors ? e.errors.map(x => `${x.text} (línea ${x.location && x.location.line})`).join("; ") : e.message}`);
  }
}

export function achicar(html){
  let scripts = 0, estilos = 0;
  // Los scripts escritos en la página (sin src), solo los de JavaScript: el módulo de la app y el del tema/idioma.
  let salida = html.replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, (todo, atributos = "", codigo) => {
    if(/\ssrc\s*=/.test(atributos)) return todo;
    const tipo = (atributos.match(/\stype\s*=\s*["']?([^"'\s>]+)/) || [, ""])[1].toLowerCase();
    if(tipo && tipo !== "module" && tipo !== "text/javascript") return todo;
    scripts++;
    return `<script${atributos}>${achicarCodigo(codigo, "js", "un script de la página")}</script>`;
  });
  salida = salida.replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/g, (todo, atributos = "", css) => {
    estilos++;
    return `<style${atributos}>${achicarCodigo(css, "css", "los estilos de la página")}</style>`;
  });
  if(!scripts) throw new Error("No encontré ningún script escrito en la página.");
  if(!estilos) throw new Error("No encontré ningún <style> en la página.");
  return salida;
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  const archivo = process.argv[2];
  if(!archivo){ console.error("Uso: node herramientas/publicar/achicar.mjs index.html > salida.html"); process.exit(2); }
  process.stdout.write(achicar(fs.readFileSync(archivo, "utf8")));
}
