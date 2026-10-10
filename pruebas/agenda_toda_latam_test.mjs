/* ======================================================================
   «Dónde está» de una persona con «Toda LatAm» (auditoría del 10/10/2026, R21)

   El renglón de «Toda LatAm» llevaba la flecha «›» y se podía tocar, pero no
   tiene ficha: agendaIrAlLugar() recibía país, ciudad y zona vacíos y mandaba
   a la lista de Países sin nada abierto. Ahora el renglón no se toca ni lleva
   flecha (como el título «Toda LatAm» de la lista); los demás lugares siguen
   igual.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();
for(const [lang, latam, vista] of [["", "Toda LatAm", { width: 1280, height: 900 }], ["en", "All of LatAm", { width: 390, height: 661 }], ["he", "כל LatAm", { width: 1280, height: 900 }]]){
  const idioma = lang || "es";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vista, lang });
  await tab(p, "paises"); await p.waitForTimeout(300);
  await click(p, ".paises-agenda"); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#agendaBody .ag-p[data-id="per_julia"]').click()); await p.waitForTimeout(500);
  // Los renglones de «Dónde está» de Julia: Brasil (un país) y toda LatAm.
  const filas = await p.$$eval("#agendaBody .ag-items .ag-item", l => l.map(e => ({ etiqueta: e.tagName, accion: e.dataset.action || null, flecha: !!e.querySelector("[aria-hidden]"), texto: e.querySelector("b").textContent.trim(), foco: e.tabIndex >= 0 && e.tagName === "BUTTON" })));
  const lat = filas.find(f => f.texto === latam), pais = filas.find(f => f.texto !== latam);
  eq(`[${idioma}] hay dos renglones: un país y toda LatAm (la prueba mide algo)`, [filas.length, !!lat, !!pais], [2, true, true]);
  eq(`[${idioma}] el de toda LatAm no es un botón, no tiene acción y no lleva flecha`, [lat.etiqueta, lat.accion, lat.flecha], ["DIV", null, false]);
  eq(`[${idioma}] el del país sigue siendo un botón que lleva a su ficha, con su flecha`, [pais.etiqueta, pais.accion, pais.flecha], ["BUTTON", "agenda-ir-lugar", true]);
  // Tocarlo no hace nada: la Agenda sigue en la ficha de la persona.
  await p.evaluate(latam => { [...document.querySelectorAll("#agendaBody .ag-items .ag-item")].find(e => e.querySelector("b").textContent.trim() === latam).click(); }, latam);
  await p.waitForTimeout(400);
  eq(`[${idioma}] tocar el renglón de toda LatAm no cierra la Agenda ni cambia de pantalla`, await p.evaluate(() => [!document.getElementById("agendaOverlay").hidden, (document.getElementById("agendaTitulo") || { textContent: "" }).textContent.trim(), document.querySelector(".tabs button.active, nav.tabs .active")?.dataset.view || null]), [true, "Julia Lerner", "paises"]);
  // El renglón del país no pierde nada: mismo alto y mismo ancho que antes de tocar.
  eq(`[${idioma}] y a la vista, el renglón de toda LatAm tiene el mismo alto que el del país`, await p.evaluate(latam => { const l = [...document.querySelectorAll("#agendaBody .ag-items .ag-item")]; const h = e => Math.round(e.getBoundingClientRect().height); const a = l.find(e => e.querySelector("b").textContent.trim() === latam), c = l.find(e => e !== a); return [h(a), h(c), Math.round(a.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().width)]; }, latam).then(([a, c, wa, wc]) => [a === c, wa === wc]), [true, true]);
  // Y el país lleva a su ficha.
  await p.evaluate(latam => { [...document.querySelectorAll("#agendaBody .ag-items .ag-item")].find(e => e.querySelector("b").textContent.trim() !== latam).click(); }, latam);
  await p.waitForTimeout(600);
  eq(`[${idioma}] tocar el del país cierra la Agenda y abre la ficha de ese país`, await p.evaluate(() => [document.getElementById("agendaOverlay").hidden, !!document.querySelector(".ficha-lugar")]), [true, true]);
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
