/* ======================================================================
   Aplicar un período desde «Próximos» (auditoría del 10/10/2026, R21)

   Aplicar un período desde el panel de filtros estando en «Próximos» dejaba
   «Nada de lo que viene coincide» con los posteos del período escondidos en
   «Lo que pasó» (un período es siempre de lo que ya pasó). Ahora, si se
   miraba «Próximos» y el período elegido tiene posteos pero ninguno de lo
   que viene, el Inicio pasa a «Lo que pasó», como ya hace «Ver esto en el
   Inicio» de Reportes; y el botón «Ver N posteos» cuenta lo que se va a ver
   ahí. Lo demás (un filtro sin período, «Este mes», un período sin nada)
   no cambia de solapa.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();
const HOY = new Date().toISOString().slice(0, 4);   // el año de verdad: los datos de prueba se arman con la fecha de hoy
const abrirPanel = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await click(p, "#fbFiltros"); await p.waitForSelector(".fp-panel"); await p.waitForTimeout(250); };
const irAFecha = async p => { await click(p, '.fp-item[data-cat="fecha"]'); await p.waitForTimeout(250); };
const trimestres = p => p.$$eval(".fp-tris .chip-toggle", l => l.map(e => ({ texto: e.textContent.trim(), activo: e.classList.contains("active"), tri: e.dataset.tri })));

/* ---------- 2) Aplicar un período desde «Próximos» ---------- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  const cuentas = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".feed-solapas button[data-key]")].map(e => [e.dataset.key, Number(e.querySelector(".fs-n").textContent)])));
  const solapaActual = () => p.$eval('.feed-solapas button.on', e => e.dataset.key);
  const vacio = () => p.$eval("#viewRoot .empty-state", e => e.textContent.trim().replace(/\s+/g, " ")).catch(() => null);
  const solapa = async k => { await click(p, `.feed-solapas button[data-key="${k}"]`); await p.waitForTimeout(300); };
  const botonN = async () => Number(/(\d+)/.exec(await p.$eval(".fp-ver", e => e.textContent))[1]);
  const quitarTodo = async () => { await click(p, '[data-action="fp-quitar"][data-cat="fecha"]'); await click(p, '[data-action="fp-quitar"][data-cat="actividad"]'); await p.waitForTimeout(300); };
  const sin = await cuentas();

  // Un año con posteos, estando en «Próximos»: pasa a «Lo que pasó» con los posteos del período.
  await solapa("futuro");
  await abrirPanel(p); await irAFecha(p);
  await click(p, `[data-action="fp-fecha"][data-key="${HOY}"]`); await p.waitForTimeout(250);
  const prometido = await botonN();
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  const despues = await cuentas();
  eq("desde «Próximos», aplicar un año con posteos deja el Inicio en «Lo que pasó»", await solapaActual(), "pasado");
  eq("y se ven los posteos del período (no «Nada de lo que viene coincide»)", [despues.pasado > 0, /Nada de lo que viene/.test(await vacio() || "")], [true, false]);
  eq("«Ver N posteos» prometía justo lo que se ve ahí", prometido, despues.pasado);
  await quitarTodo();

  // Estando en «Lo que pasó»: se queda.
  await solapa("pasado");
  await abrirPanel(p); await irAFecha(p);
  await click(p, `[data-action="fp-fecha"][data-key="${HOY}"]`); await p.waitForTimeout(250);
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  eq("desde «Lo que pasó», sigue en «Lo que pasó»", await solapaActual(), "pasado");
  await quitarTodo();

  // Un filtro que no es un período, desde «Próximos»: se queda en «Próximos».
  await solapa("futuro");
  await abrirPanel(p); await click(p, '.fp-item[data-cat="actividad"]'); await p.waitForTimeout(200);
  await click(p, '[data-action="fp-tipo"][data-key="curso"]'); await p.waitForTimeout(250);
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  eq("desde «Próximos», un filtro de tipo (sin período) no cambia de solapa", await solapaActual(), "futuro");
  await quitarTodo();

  // «Este mes» no es un período de los que pasaron: puede tener lo que viene.
  await solapa("futuro");
  await abrirPanel(p); await irAFecha(p);
  await click(p, '[data-action="fp-fecha"][data-key="mes"]'); await p.waitForTimeout(250);
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  eq("desde «Próximos», «Este mes» no cambia de solapa", await solapaActual(), "futuro");
  await quitarTodo();

  // Un período donde no hay nada (ni pasado ni lo que viene): no hay a dónde ir, se queda.
  await solapa("futuro");
  await abrirPanel(p); await click(p, '.fp-item[data-cat="actividad"]'); await p.waitForTimeout(200);
  await click(p, '[data-action="fp-tipo"][data-key="virtual"]'); await p.waitForTimeout(250);
  await click(p, '.fp-item[data-cat="fecha"]'); await p.waitForTimeout(250);
  await click(p, `[data-action="fp-fecha"][data-key="${Number(HOY) - 1}"]`); await p.waitForTimeout(250);
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  const c3 = await cuentas();
  eq("un período sin ningún posteo (tipo virtual en el año pasado): no hay nada, y se queda en «Próximos»", [c3.pasado, c3.futuro, await solapaActual()], [0, 0, "futuro"]);
  eq("sin errores en la página", errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
