/* ======================================================================
   La carga en un celular lento

   Cuánto tarda en verse el primer posteo con el procesador 1, 4 y 6 veces más
   lento (4 = un celular medio, 6 = uno barato), en un celular de 390 px, con
   el Supabase de mentira: mide la app, no la red. Mediana de 3 corridas. Más:
   las tareas largas (lo que traba el dedo) y cuánto baja la página con 4G
   lento y con 3G.

   Marca como hallazgo lo que pasa de 4 s en el celular barato o de 2,5 s en el
   medio; lo demás son datos para seguir. El 28/10/2026: 0,4 s, 1,8 s y 2,9 s.
   ====================================================================== */
import fs from "node:fs";
import zlib from "node:zlib";
import { abrirNavegador, entrar, ADMIN } from "../../pruebas/app_de_mentira.mjs";
import { hallazgo, entregar, RUTA_INDEX } from "./comun.mjs";

const out = [];
const b = await abrirNavegador();
// Desde el primer instante: cuándo aparece el primer posteo y las tareas largas.
const iniciar = `window.__largas = []; window.__primerPost = null;
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__largas.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch (e) {}
  new MutationObserver((_, o) => { if (document.querySelector(".post")) { window.__primerPost = Math.round(performance.now()); o.disconnect(); } }).observe(document, { childList: true, subtree: true });`;
const mediana = l => [...l].sort((x, y) => x - y)[Math.floor(l.length / 2)];
for(const [rate, nombre, tope] of [[1, "este equipo", 0], [4, "un celular medio (4× más lento)", 2500], [6, "un celular barato (6× más lento)", 4000]]){
  const veces = [], largas = [];
  for(let i = 0; i < 3; i++){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, cpu: rate, iniciar });
    await p.waitForFunction(() => window.__primerPost, null, { timeout: 60000 }).catch(() => {});
    const r = await p.evaluate(() => ({ t: window.__primerPost, largas: window.__largas.slice().sort((a, c) => c - a).slice(0, 3) }));
    if(r.t) veces.push(r.t); largas.push(...r.largas);
    await p.close();
  }
  if(!veces.length){ out.push(hallazgo("rendimiento", "importante", `En ${nombre} no apareció ningún posteo`)); continue; }
  const ms = mediana(veces);
  out.push(hallazgo("rendimiento", tope && ms > tope ? "medio" : "dato", `Primer posteo visible en ${nombre}: ${ms} ms (medianas de 3: ${veces.join("/")}); tareas largas: ${largas.sort((a, c) => c - a).slice(0, 3).join(", ")} ms`));
}
await b.close();
const gz = zlib.gzipSync(fs.readFileSync(RUTA_INDEX), { level: 9 }).length;
out.push(hallazgo("rendimiento", "dato", `La página baja en ${(gz * 8 / 1.6e6).toFixed(1)} s con 4G lento (1,6 Mbps) y en ${(gz * 8 / 0.4e6).toFixed(0)} s con 3G (0,4 Mbps): ${(gz / 1024).toFixed(0)} KB comprimidos, sin las librerías`));
entregar("carga", out);
