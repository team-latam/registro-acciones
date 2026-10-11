/* ======================================================================
   El buscador de «País o ciudad» del panel de filtros no redibuja el
   Inicio por cada letra (auditoría del 10/10/2026, R21)

   Antes cada tecla reconstruía el Inicio entero (con 1.500 posteos, una
   vez por letra). Ahora espera 150 ms, como el buscador de texto, y Enter
   dibuja ya lo último escrito antes de elegir la primera sugerencia (si
   no, elegiría una de lo que se había escrito 150 ms antes).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await abrirNavegador();
async function abrirLugar(p){
  await click(p, "#fbFiltros"); await p.waitForTimeout(300);
  await click(p, '.fp-item[data-cat="lugar"]'); await p.waitForTimeout(300);
}
const contarRenders = p => p.evaluate(() => { window.__r = 0; new MutationObserver(m => { window.__r += m.length; }).observe(document.getElementById("viewRoot"), { childList: true }); });

// 1. Tecleando de corrido, no se redibuja una vez por letra
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: BASE() });
  await abrirLugar(p);
  await contarRenders(p);
  await p.type("#fpLugarQ", "cordoba", { delay: 25 });
  await p.waitForTimeout(400);
  const veces = await p.evaluate(() => window.__r);
  eq(`siete letras seguidas: el Inicio se redibuja una o dos veces, no siete (fueron ${veces})`, veces >= 1 && veces <= 2, true);
  eq("y las sugerencias son las de lo escrito entero", await p.$$eval('.fp-sugs [data-action="fp-lugar"]', l => l.length > 0), true);
  eq("el campo sigue con lo escrito y con el foco", [await p.inputValue("#fpLugarQ"), await p.evaluate(() => document.activeElement.id)], ["cordoba", "fpLugarQ"]);
  eq("sin errores", errores, []);
  await p.close();
}

// 2. Enter enseguida elige la primera de lo último escrito, no de lo anterior
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: BASE() });
  await abrirLugar(p);
  await p.type("#fpLugarQ", "cord", { delay: 10 });
  await p.keyboard.press("Enter");   // sin esperar los 150 ms
  await p.waitForTimeout(400);
  const elegido = await p.$eval('.fp-item[data-cat="lugar"] .fp-item-valor', e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "(nada)");
  eq("Enter enseguida elige la primera sugerencia de lo escrito entero («cord»): Córdoba", elegido, "Córdoba, Argentina");
  eq("sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
