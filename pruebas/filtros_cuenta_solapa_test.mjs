/* ======================================================================
   «Ver N posteos» del panel de filtros cuenta lo que se va a ver
   (auditoría del 10/10/2026, R21)

   El botón sumaba las dos solapas del Inicio (lo que pasó y lo que viene)
   pero el Inicio muestra una por vez: «Ver 9 posteos» y aparecían 5. Ahora
   cuenta lo que el Inicio va a mostrar en la solapa en que está la persona.
   (El selector «Solo acá N / + Región / + Toda LatAm» cuenta las dos solapas
   a propósito: lo cuida otra prueba y no se toca.)
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();

for(const [lang, patron] of [["", /^Ver (\d+) posteos?$/], ["en", /^See (\d+) posts?$/]]){
  const idioma = lang || "es";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang });
  const cuentas = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".feed-solapas button[data-key]")].map(e => [e.dataset.key, Number(e.querySelector(".fs-n").textContent)])));
  const botonN = async () => { const m = patron.exec(await p.$eval(".fp-ver", e => e.textContent.trim())); return m ? Number(m[1]) : null; };
  const abrirPanel = async () => { await p.evaluate(() => window.scrollTo(0, 0)); await click(p, "#fbFiltros"); await p.waitForSelector(".fp-panel"); await p.waitForTimeout(250); };
  const solapa = async k => { await click(p, `.feed-solapas button[data-key="${k}"]`); await p.waitForTimeout(300); };

  const c = await cuentas();
  eq(`[${idioma}] las dos solapas tienen posteos (la prueba mide algo)`, c.pasado > 0 && c.futuro > 0, true);

  // Sin tocar nada: cada solapa, su número.
  for(const k of ["pasado", "futuro"]){
    await solapa(k); await abrirPanel();
    eq(`[${idioma}] en «${k === "pasado" ? "Lo que pasó" : "Próximos"}», el botón cuenta los de esa solapa (${c[k]}), no la suma (${c.pasado + c.futuro})`, await botonN(), c[k]);
    await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  }

  // Con un filtro elegido en el borrador: el número del botón es el que queda al aplicar.
  for(const k of ["pasado", "futuro"]){
    await solapa(k); await abrirPanel();
    await click(p, '.fp-item[data-cat="actividad"]'); await p.waitForTimeout(200);
    await click(p, '[data-action="fp-tipo"][data-key="curso"]'); await p.waitForTimeout(250);
    const prometido = await botonN();
    await click(p, ".fp-ver"); await p.waitForTimeout(400);
    const despues = await cuentas();
    const tarjetas = await p.$$eval("#viewRoot article.post[data-post-id]", l => l.length);
    eq(`[${idioma}] «${k === "pasado" ? "Lo que pasó" : "Próximos"}» con solo cursos: el botón prometía lo que queda en la solapa`, [prometido, despues[k]], [despues[k], despues[k]]);
    eq(`[${idioma}] y las tarjetas que se ven son esas`, tarjetas, Math.min(despues[k], 15));
    eq(`[${idioma}] y no era la suma de las dos solapas`, prometido !== despues.pasado + despues.futuro || despues[k === "pasado" ? "futuro" : "pasado"] === 0, true);
    // Sacar el filtro para la vuelta siguiente.
    await click(p, '[data-action="fp-quitar"][data-cat="actividad"]'); await p.waitForTimeout(300);
  }
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
