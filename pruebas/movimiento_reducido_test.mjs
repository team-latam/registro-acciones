/* ======================================================================
   Quien pidió menos movimiento no ve desplazamientos suaves (auditoría del
   10/10/2026, R22)

   El CSS global (scroll-behavior:auto bajo prefers-reduced-motion) no
   alcanza a los desplazamientos que se piden desde el código, y tres
   scrollIntoView({ behavior:"smooth" }) no miraban la preferencia: abrir un
   hito de un proyecto, ir a un posteo desde «Buscar en todo» o la campanita
   (gotoMention) y «Nueva rutina». comportamientoDeScroll() devuelve "auto"
   con prefers-reduced-motion: reduce y "smooth" si no.

   Se espía Element.prototype.scrollIntoView y se pide cada desplazamiento
   con la preferencia puesta y sin ella.
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");
const b = await abrirNavegador();

// Ningún scroll suave del JS queda sin pasar por la preferencia: todo «smooth» entre comillas del código está adentro del ayudante.
const literales = [...html.matchAll(/["']smooth["']/g)].length;
const enAyudante = /function comportamientoDeScroll\(\)\{[^}]*"smooth"/.test(html) ? 1 : 0;
eq("el único «smooth» escrito en el código es el del ayudante", [literales, enAyudante], [1, 1]);

for(const [reducido, esperado] of [[true, "auto"], [false, "smooth"]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await p.emulateMedia({ reducedMotion: reducido ? "reduce" : "no-preference" });
  await p.evaluate(() => {
    window.__scroll = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function(a){ window.__scroll.push({ quien: this.id || (this.dataset && (this.dataset.msId || this.dataset.postId)) || this.className, behavior: a && a.behavior }); return original.apply(this, arguments); };
  });
  const pedidos = () => p.evaluate(() => { const l = window.__scroll; window.__scroll = []; return l; });
  const con = reducido ? "con menos movimiento" : "sin pedir menos movimiento";

  // 1) Abrir un hito de un proyecto (desde el Calendario o la campanita).
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "cal-open"; x.dataset.postId = "proj1#m:h2"; document.body.appendChild(x); x.click(); x.remove(); });
  await p.waitForTimeout(600);
  const hito = (await pedidos()).filter(x => x.quien === "h2");
  eq(`${con}: abrir un hito pide un desplazamiento (la prueba mide algo)`, hito.length, 1);
  eq(`${con}: abrir un hito de un proyecto → «${esperado}»`, hito.map(x => x.behavior), [esperado]);

  // 2) Ir a un posteo desde «Buscar en todo».
  await tab(p, "feed"); await p.waitForTimeout(300);
  await p.click("#globalSearchInput"); await p.fill("#globalSearchInput", "Lima"); await p.waitForTimeout(350);
  await click(p, '#globalResults [data-action="gs-post"]'); await p.waitForTimeout(600);
  const posteo = (await pedidos()).filter(x => x.quien === "p5");
  eq(`${con}: ir a un posteo pide un desplazamiento (la prueba mide algo)`, posteo.length, 1);
  eq(`${con}: ir a un posteo (gotoMention) → «${esperado}»`, posteo.map(x => x.behavior), [esperado]);

  // 3) Nueva rutina.
  await tab(p, "calendario"); await p.waitForTimeout(300);
  await click(p, "#fabMain"); await click(p, '[data-action="new-rutina"]'); await p.waitForTimeout(600);
  const rutina = (await pedidos()).filter(x => x.quien === "rutinaContent");
  eq(`${con}: «Nueva rutina» pide un desplazamiento (la prueba mide algo)`, rutina.length, 1);
  eq(`${con}: «Nueva rutina» → «${esperado}»`, rutina.map(x => x.behavior), [esperado]);

  // Y el ayudante mismo, que también usa «subir» (scrollToTop).
  eq(`${con}: el ayudante contesta «${esperado}»`, await p.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"), esperado);
  eq(`${con}: sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
