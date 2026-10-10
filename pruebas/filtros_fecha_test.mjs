/* ======================================================================
   El panel de Fecha ofrece solo los trimestres que ya empezaron
   (auditoría del 10/10/2026, R21)

   Ofrecía los cuatro trimestres del año en curso aunque faltaran meses:
   «3.er trimestre 2026 · hasta hoy» con una lista vacía. Ahora ofrece solo
   los que ya empezaron (un año que ya pasó, los cuatro), y siempre deja
   elegible el que ya está elegido, aunque haya quedado en el futuro.
   Con la fecha del navegador fijada (page.clock.setFixedTime).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();
const HOY = new Date().toISOString().slice(0, 4);   // el año de verdad: los datos de prueba se arman con la fecha de hoy
const abrirPanel = async p => { await p.evaluate(() => window.scrollTo(0, 0)); await click(p, "#fbFiltros"); await p.waitForSelector(".fp-panel"); await p.waitForTimeout(250); };
const irAFecha = async p => { await click(p, '.fp-item[data-cat="fecha"]'); await p.waitForTimeout(250); };
const trimestres = p => p.$$eval(".fp-tris .chip-toggle", l => l.map(e => ({ texto: e.textContent.trim(), activo: e.classList.contains("active"), tri: e.dataset.tri })));

/* ---------- 1) Los trimestres que ya empezaron ---------- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  const con = async (fecha, anio) => {
    await p.clock.setFixedTime(new Date(fecha));
    await abrirPanel(p); await irAFecha(p);
    await click(p, `[data-action="fp-fecha"][data-key="${anio}"]`); await p.waitForTimeout(250);
    return (await trimestres(p)).map(x => x.tri);
  };
  eq("a mitad de mayo: el año en curso ofrece el año entero y los dos primeros trimestres", await con(`${HOY}-05-15T12:00:00`, HOY), ["0", "1", "2"]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("el 30 de junio, el 3.º todavía no empezó", await con(`${HOY}-06-30T12:00:00`, HOY), ["0", "1", "2"]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("el 1.º de julio, sí", await con(`${HOY}-07-01T12:00:00`, HOY), ["0", "1", "2", "3"]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("en enero, solo el año entero y el 1.º", await con(`${HOY}-01-20T12:00:00`, HOY), ["0", "1"]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("un año que ya pasó ofrece los cuatro", await con(`${HOY}-05-15T12:00:00`, String(Number(HOY) - 1)), ["0", "1", "2", "3", "4"]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);

  // El elegido siempre queda: se elige el 4.º con la fecha de verdad (octubre) y se vuelve a abrir «en mayo».
  await p.clock.setFixedTime(new Date());
  await abrirPanel(p); await irAFecha(p);
  await click(p, `[data-action="fp-fecha"][data-key="${HOY}"]`); await p.waitForTimeout(200);
  const hoyReal = (await trimestres(p)).map(x => x.tri);
  eq("con la fecha de hoy (octubre) se ofrecen los cuatro trimestres", hoyReal, ["0", "1", "2", "3", "4"]);
  await click(p, '[data-action="fp-tri"][data-tri="4"]'); await p.waitForTimeout(200);
  await click(p, ".fp-ver"); await p.waitForTimeout(400);
  await p.clock.setFixedTime(new Date(`${HOY}-05-15T12:00:00`));
  await click(p, '.fb-ficha-abrir[data-cat="fecha"]'); await p.waitForSelector(".fp-panel"); await p.waitForTimeout(300);
  const mayo = await trimestres(p);
  eq("con el 4.º ya elegido y la fecha en mayo: queda el 4.º (activo) junto a los que empezaron, sin el 3.º", mayo.map(x => x.tri), ["0", "1", "2", "4"]);
  eq("y es el que está activo", mayo.filter(x => x.activo).map(x => x.tri), ["4"]);
  eq("sin errores en la página", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
