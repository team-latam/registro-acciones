/* ======================================================================
   Volver de una ficha de la Agenda deja el foco en la fila que se abrió
   (auditoría del 10/10/2026, R22)

   «‹ Volver» (o Escape) sacaba la ficha de la pila y llevaba el foco al
   buscador (en la compu) o a «Volver»/✕ (en el celular), no a la fila que se
   había tocado: quien navega con el teclado tenía que recorrer la lista
   desde el principio. Ahora la vista de abajo se acuerda de qué se tocó (la
   acción, el id y cuál de las filas iguales: una persona figura en varias
   instituciones) y al volver el foco cae ahí. En una pantalla táctil sigue
   yendo a «Volver»/✕, para no abrir el teclado.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();
// Dónde está el foco: la fila (acción, id y cuál de las iguales) o el id del control.
const foco = p => p.evaluate(() => {
  const a = document.activeElement;
  if(!a || !a.dataset || !a.dataset.action) return { accion: null, id: a && a.id, clase: a && a.className };
  const iguales = [...document.querySelectorAll(`#agendaBody [data-action="${a.dataset.action}"][data-id="${a.dataset.id}"]`)];
  return { accion: a.dataset.action, id: a.dataset.id, n: iguales.indexOf(a), de: iguales.length, anillo: a.matches(":focus-visible"), sinAnillo: a.classList.contains("sin-anillo") };
});
const abrirAgenda = async p => { await tab(p, "paises"); await p.waitForTimeout(300); await click(p, ".paises-agenda"); await p.waitForSelector("#agendaBody .ag-p"); await p.waitForTimeout(300); };

// ---- La compu, con el teclado ----
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await abrirAgenda(p);
  // Una persona que figura en dos instituciones: se abre desde la SEGUNDA fila.
  const dos = await p.$$('#agendaBody .ag-p[data-id="per_rab2"]');
  eq("la persona figura en dos filas (la prueba mide algo)", dos.length, 2);
  await dos[1].focus();
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  eq("se abrió la ficha de la persona", await p.evaluate(() => !!document.querySelector("#agendaBody .ag-volver") && /Tzvi/.test(document.getElementById("agendaTitulo").textContent)), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  const f = await foco(p);
  eq("Escape vuelve a la lista con el foco en la fila que se abrió (la segunda), no en el buscador", [f.accion, f.id, f.n, f.de], ["agenda-ver-persona", "per_rab2", 1, 2]);
  eq("y con el teclado, el anillo de foco se ve", [f.anillo, f.sinAnillo], [true, false]);

  // Una institución, con el mouse y «‹ Volver».
  await p.click('#agendaBody .ag-inst[data-id="ins_mvd"]'); await p.waitForTimeout(300);
  eq("se abrió la ficha de la institución", await p.evaluate(() => /Jabad Uruguay/.test(document.getElementById("agendaTitulo").textContent)), true);
  await p.click("#agendaBody .ag-volver"); await p.waitForTimeout(300);
  const g = await foco(p);
  eq("«Volver» con el mouse deja el foco en la fila de la institución", [g.accion, g.id], ["agenda-ver-inst", "ins_mvd"]);
  eq("y con el mouse no se pinta el anillo", g.sinAnillo, true);

  // Dos fichas encadenadas (de la persona a la institución y de vuelta): cada «Volver» al lugar de donde salió.
  await p.click('#agendaBody .ag-p[data-id="per_rab3"]'); await p.waitForTimeout(300);
  const aInst = await p.$('#agendaBody [data-action="agenda-ver-inst"]');
  eq("desde la ficha de la persona hay un renglón que lleva a su institución", !!aInst, true);
  if(aInst){
    const idInst = await aInst.getAttribute("data-id");
    await aInst.click(); await p.waitForTimeout(300);
    await p.click("#agendaBody .ag-volver"); await p.waitForTimeout(300);
    const h = await foco(p);
    eq("volver de la institución a la persona deja el foco en el renglón de la institución", [h.accion, h.id], ["agenda-ver-inst", idInst]);
    await p.click("#agendaBody .ag-volver"); await p.waitForTimeout(300);
    const i = await foco(p);
    eq("y volver de la persona a la lista, en la fila de la persona", [i.accion, i.id], ["agenda-ver-persona", "per_rab3"]);
  }

  // Un formulario de corrección: «Cancelar» vuelve al botón «Editar».
  await p.click('#agendaBody .ag-p[data-id="per_rab1"]'); await p.waitForTimeout(300);
  await p.click('#agendaBody [data-action="agenda-editar"]'); await p.waitForTimeout(300);
  eq("se abrió el formulario de corrección", await p.evaluate(() => !!document.getElementById("agendaForm") || !!document.querySelector("#agendaBody form")), true);
  await p.click('#agendaBody [data-action="agenda-volver"]'); await p.waitForTimeout(300);
  const j = await foco(p);
  eq("Cancelar el formulario deja el foco en «Editar» de la ficha", [j.accion, j.id], ["agenda-editar", "per_rab1"]);

  // Cerrar la Agenda no se toca: el foco vuelve a donde estaba antes de abrirla.
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  eq("cerrar la Agenda por completo sigue devolviendo el foco al botón que la abrió", await p.evaluate(() => [document.getElementById("agendaOverlay").hidden, document.activeElement.classList.contains("paises-agenda")]), [true, true]);
  eq("sin errores en la página", errores, []);
  await p.close();
}

// ---- El celular: el foco sigue yendo a «Volver»/✕ (no abre el teclado) ----
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 661 } });
  await abrirAgenda(p);
  await p.tap('#agendaBody .ag-p[data-id="per_rab2"]'); await p.waitForTimeout(300);
  await p.tap("#agendaBody .ag-volver"); await p.waitForTimeout(300);
  eq("en el celular, volver lleva el foco a «Volver»/✕ de la lista (no a la fila, no al buscador)",
    await p.evaluate(() => [document.activeElement.classList.contains("close") || document.activeElement.classList.contains("ag-volver"), document.activeElement.id === "agendaBuscar", document.activeElement.classList.contains("ag-p")]), [true, false, false]);
  eq("sin errores en la página", errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
