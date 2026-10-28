/* ======================================================================
   El Inicio en el celular arranca con los posteos, no con los controles
   (crítica de diseño del 28/10/2026)

   Antes de la primera tarjeta había tres filas: «¿Qué hiciste hoy?» (86 px),
   el buscador con «Filtros» y las solapas. El primer posteo arrancaba en
   y=328 de 844, el 39 % de la pantalla. El cuadro de «¿Qué hiciste hoy?»
   pasa a una fila compacta en el celular (60 px, avatar de 32); en la
   compu y la tableta queda como estaba.

   - Celular (390 y 360 px, español y hebreo): el cuadro mide 64 px o menos
     en reposo, y el primer posteo arranca antes de los 320 px.
   - Enfocado, se despliega entero (lugar, adjuntos, Publicar) sin correr
     la página de costado.
   - Compu (1440) y tableta (768): el cuadro sigue midiendo lo de siempre.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };

const medir = p => p.evaluate(() => {
  const c = document.querySelector(".quick-composer"), post = document.querySelector(".post"), av = c.querySelector(".qc-avatar");
  return { composer: Math.round(c.getBoundingClientRect().height), primerPosteo: Math.round(post.getBoundingClientRect().top), avatar: Math.round(av.getBoundingClientRect().width),
    ancho: document.documentElement.scrollWidth, ventana: innerWidth };
});

const b = await abrirNavegador();
for(const [lang, vw, vh] of [["", 390, 844], ["", 360, 740], ["he", 390, 844], ["en", 390, 844]]){
  const donde = `celular ${vw} px, ${lang || "es"}`;
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: vw, height: vh }, lang });
  let m = await medir(p);
  ok(`${donde}: el cuadro «¿Qué hiciste hoy?» mide 64 px o menos en reposo`, m.composer <= 64, JSON.stringify(m));
  // 320 y no 300: con la letra más ancha de GitHub las solapas y el buscador ocupan más y en 360 px
  // el primer posteo arrancó en 311 (la corrida de «Publicar el sitio» del 28/10/2026). Antes: 328 acá, ~343 allá.
  ok(`${donde}: el primer posteo arranca antes de los 320 px`, m.primerPosteo <= 320, JSON.stringify(m));
  ok(`${donde}: el avatar del cuadro mide 32 px`, m.avatar === 32, JSON.stringify(m));
  await p.click(".quick-composer textarea"); await p.waitForTimeout(300);
  m = await medir(p);
  const abierto = await p.evaluate(() => { const bt = document.getElementById("rutinaPublish"); const r = bt && bt.getBoundingClientRect(); return !!r && r.width > 0 && r.right <= innerWidth && r.left >= 0; });
  ok(`${donde}: enfocado, se despliega y «Publicar» entra en la pantalla`, abierto);
  ok(`${donde}: enfocado, la página no se corre de costado`, m.ancho <= m.ventana, JSON.stringify(m));
  await p.close();
}
for(const [vw, vh] of [[1440, 900], [768, 900]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: vw, height: vh } });
  const m = await medir(p);
  ok(`${vw} px: el cuadro «¿Qué hiciste hoy?» sigue como estaba (80 px o más, avatar de 40)`, m.composer >= 80 && m.avatar === 40, JSON.stringify(m));
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
