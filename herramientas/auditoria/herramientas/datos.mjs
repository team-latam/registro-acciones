/* ======================================================================
   Datos variados (y envenenados)

   La app con datos que no son los de todos los días, armados al azar con
   una semilla (AUDITORIA_SEMILLA; la misma semilla, los mismos datos):
   - títulos de una palabra y de 140 letras, una palabra de 60 letras sin
     espacios, emojis, texto en hebreo, nombres larguísimos, campos vacíos;
   - lugares e hitos con forma rara (como vienen a veces de la base);
   - y en CADA campo que escribe alguien (título, texto, lugar, nombres,
     archivos, links, ciudades, tipos, hitos, comentarios) un pedazo de
     HTML que, si se colara, ejecutaría código.
   Recorre la app en escritorio, celular y celular en hebreo, y mide:
   - si algo se ejecutó o se coló al HTML (un XSS);
   - si en pantalla aparece "undefined", "NaN", "[object Object]",
     "Invalid Date" o un {marcador} sin reemplazar;
   - si algo queda cortado o se sale de la pantalla;
   - los errores de la página;
   - y cuánto tarda en dibujar el Inicio con mucho cargado (AUDITORIA_VOLUMEN
     posteos, 1500 por omisión).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, revisarRecortes, recorrerApp } from "../../pruebas/app_de_mentira.mjs";
import { datos, semilla, VOLUMEN } from "./datos_variados.mjs";
import { hallazgo, entregar } from "./comun.mjs";

const out = [];
const b = await abrirNavegador();
const BASURA = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\{(n|x|d|m|a|b|p|f|e|z|l|msg|email)\}/;
for(const [vp, lang] of [[{ width: 1280, height: 800 }, ""], [{ width: 390, height: 844 }, ""], [{ width: 390, height: 844 }, "he"]]){
  const tam = vp.width + (lang ? " " + lang : "");
  const base = datos();
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang, base });
  await p.waitForTimeout(800);
  // Cuánto tarda en dibujar el Inicio con todo esto cargado.
  const ms = await p.evaluate(() => { const t0 = performance.now(); const b = document.querySelector('nav.tabs button[data-view="feed"], .bn-item[data-view="feed"]'); b && b.click(); return Math.round(performance.now() - t0); });
  out.push(hallazgo("rendimiento", ms > 300 ? "medio" : "dato", `Dibujar el Inicio con ${VOLUMEN} posteos: ${ms} ms (${tam})`));
  const recortes = [], basura = new Set();
  await recorrerApp(p, async (p, n) => {
    recortes.push(...await revisarRecortes(p, n));
    const txt = await p.evaluate(() => document.body.innerText);
    const x = BASURA.exec(txt); if(x) basura.add(n + ": «" + txt.slice(Math.max(0, x.index - 30), x.index + 30).replace(/\s+/g, " ") + "»");
  });
  const xss = await p.evaluate(() => ({ corrio: window.__xss || 0,
    colado: document.querySelectorAll('img[src="x"], svg[onload], [onerror], [onload], a[href^="javascript:"]').length }));
  if(xss.corrio) out.push(hallazgo("seguridad", "urgente", `Se ejecutó código metido en un dato (${xss.corrio} veces)`, tam, "un XSS: ver qué campo"));
  if(xss.colado) out.push(hallazgo("seguridad", "urgente", `Se coló HTML de un dato a la página (${xss.colado} elementos)`, tam));
  basura.forEach(x => out.push(hallazgo("datos", "medio", "En pantalla sale texto roto", tam, x)));
  const grupos = new Map(); recortes.forEach(r => { const k = r.tipo + " | " + (r.el || ""); if(!grupos.has(k)) grupos.set(k, r); });
  grupos.forEach((r, k) => out.push(hallazgo("diseño", "medio", "Con datos variados, algo queda cortado", tam + " · " + r.estado, k)));
  [...new Set(errores)].slice(0, 15).forEach(e => out.push(hallazgo("errores", "importante", "Error en la página con datos variados", tam, e)));
  await p.close();
}
await b.close();
out.push(hallazgo("datos", "dato", `Semilla ${semilla}, ${VOLUMEN} posteos (para repetir: AUDITORIA_SEMILLA=${semilla})`));
entregar("datos", out);
