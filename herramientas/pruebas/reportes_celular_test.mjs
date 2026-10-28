/* ======================================================================
   Reportes en el celular: los selectores de la barra no recortan lo que
   muestran (crítica de diseño del 28/10/2026)

   «Período» quedaba con 57 px y mostraba «Todo el añ» (en español, inglés
   y portugués; en 360 px, el año se llevaba 224 y el período 76). Ahora
   cada selector mide lo que mide su opción más larga y, si no entran todos
   en el renglón, el que sobra baja al siguiente.

   Cómo se mide: cada selector se compara con una copia suya sin límites
   (width:auto, sin max-width ni flex): si el de verdad mide menos que la
   copia, está recortando su opción más larga. En «Un período» y en
   «Comparar», en tres anchos de celular y los cuatro idiomas; y que la
   página no se corra de costado.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };

const medir = () => ({
  selectores: [...document.querySelectorAll(".rep-barra-control select")].filter(s => s.offsetParent).map(s => {
    const copia = s.cloneNode(true); copia.removeAttribute("id");
    copia.style.cssText = "position:absolute;visibility:hidden;width:auto;max-width:none;min-width:0;flex:none;left:0;top:0";
    s.parentElement.appendChild(copia);
    const natural = copia.getBoundingClientRect().width; copia.remove();
    return { id: s.id, real: Math.round(s.getBoundingClientRect().width), natural: Math.round(natural) };
  }),
  ancho: document.documentElement.scrollWidth, ventana: innerWidth,
});

const b = await abrirNavegador();
for(const lang of ["", "en", "pt", "he"]){
  for(const vw of [390, 360, 320]){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: vw, height: 800 }, lang });
    await tab(p, "reportes"); await p.waitForTimeout(500);
    for(const modo of ["un período", "comparar"]){
      if(modo === "comparar"){ await p.evaluate(() => document.querySelector('[data-action="reporte-modo"][data-key="comparar"]')?.click()); await p.waitForTimeout(400); }
      const m = await p.evaluate(medir);
      const donde = `${lang || "es"} ${vw} px, ${modo}`;
      ok(`${donde}: hay selectores para medir`, m.selectores.length >= 2, JSON.stringify(m));
      for(const s of m.selectores) ok(`${donde}: «${s.id}» no recorta su opción más larga`, s.real >= s.natural - 1, `mide ${s.real} px y necesita ${s.natural}`);
      ok(`${donde}: la página no se corre de costado`, m.ancho <= m.ventana, `${m.ancho} > ${m.ventana}`);
    }
    await p.close();
  }
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
