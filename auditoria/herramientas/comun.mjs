/* ======================================================================
   Lo que comparten las herramientas de la auditoría

   Cada herramienta mira una cosa y devuelve HALLAZGOS: no aprueba ni
   desaprueba (para eso están las pruebas). Un hallazgo es
     { area, nivel, que, donde, detalle }
   con `nivel` sugerido: "urgente" | "importante" | "medio" | "bajo" |
   "opcional" | "dato" (un número para seguir, no un problema). Quien
   audita decide el nivel final al escribir docs/AUDITORIA.md.

   Siempre sobre el index.html de verdad (o el que diga INDEX).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { recorrer, hacerGrab } from "../../pruebas/grab.mjs";
export { recorrer, hacerGrab };

export const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
export const RUTA_INDEX = process.env.INDEX || RAIZ + "index.html";
export const html = fs.readFileSync(RUTA_INDEX, "utf8");
export const lineas = html.split("\n");

// El módulo de JS (sin el HTML ni el CSS) y en qué línea del archivo empieza.
const iniJs = lineas.findIndex(l => l.startsWith('<script type="module">'));
const finJs = lineas.length - 1 - [...lineas].reverse().findIndex(l => l.startsWith("</script>"));
export const js = lineas.slice(iniJs + 1, finJs).join("\n");
export const lineaDeJs = pos => js.slice(0, pos).split("\n").length + iniJs + 1;
// El CSS del <style> principal.
export const css = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
export const lineaDeHtml = pos => html.slice(0, pos).split("\n").length;

export function hallazgo(area, nivel, que, donde = "", detalle = ""){
  return { area, nivel, que, donde, detalle: String(detalle).slice(0, 300) };
}
// Lo ya revisado y aceptado (auditoria/conocidos.json): un hallazgo que
// se miró y se decidió dejar como está, con el porqué. Se muestra aparte,
// para que cada auditoría no lo vuelva a contar como nuevo. Se reconoce
// por el texto de "que" y, si está, un pedazo de "detalle" o "donde".
const CONOCIDOS = (() => { try{ return JSON.parse(fs.readFileSync(RAIZ + "auditoria/conocidos.json", "utf8")); }catch(e){ return []; } })();
export function yaConocido(h){
  return CONOCIDOS.find(c => h.que === c.que && (!c.contiene || (h.detalle + " " + h.donde).includes(c.contiene))) || null;
}
// Lo escribe en SALIDA (la carpeta de esta corrida) como <nombre>.json y
// lo resume en pantalla.
export function entregar(nombre, todos){
  const conocidos = todos.filter(yaConocido).map(h => ({ ...h, conocido: yaConocido(h).porque }));
  const hallazgos = todos.filter(h => !yaConocido(h));
  const salida = process.env.SALIDA;
  if(salida){ fs.mkdirSync(salida, { recursive: true }); fs.writeFileSync(`${salida}/${nombre}.json`, JSON.stringify({ hallazgos, conocidos }, null, 1)); }
  const porNivel = {};
  hallazgos.forEach(h => { porNivel[h.nivel] = (porNivel[h.nivel] || 0) + 1; });
  console.log(`${nombre}: ${hallazgos.length} hallazgos ${JSON.stringify(porNivel)}${conocidos.length ? ` (+${conocidos.length} ya revisados)` : ""}`);
  if(!salida) hallazgos.slice(0, 40).forEach(h => console.log(`  [${h.nivel}] ${h.que}${h.donde ? " — " + h.donde : ""}${h.detalle ? " · " + h.detalle : ""}`));
}
