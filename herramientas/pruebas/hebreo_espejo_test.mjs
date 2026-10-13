/* ======================================================================
   En hebreo, lo direccional se espeja (auditoría del 10/10/2026, R22)

   - «Ver en el mapa ↗»: en hebreo la flecha apunta hacia el otro lado (↖).
   - El interruptor «Se suma al Google Calendar» (Administración › Tipos):
     la perilla arrancaba pegada a la izquierda y se corría a la derecha
     también en hebreo; en un idioma de derecha a izquierda arranca de la
     derecha y se corre a la izquierda, como ya hacía .pref-switch.
   Español, inglés y portugués no cambian.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, click, irAdmin, admin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();

for(const [lang, rtl] of [["", false], ["en", false], ["pt", false], ["he", true]]){
  const idioma = lang || "es";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang });

  // ---- La flecha de «Ver en el mapa» ----
  await tab(p, "paises"); await p.waitForTimeout(300); await click(p, ".paises-agenda"); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('[data-action="agenda-ver-inst"][data-id="ins_ros"]').click()); await p.waitForTimeout(500);
  const flecha = await p.$eval('#agendaBody a.ag-link[href*="maps"], #agendaBody dd a.ag-link', e => e.textContent.trim().slice(-1)).catch(() => null);
  eq(`[${idioma}] la flecha de «Ver en el mapa»`, flecha, rtl ? "↖" : "↗");
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(300);

  // ---- La perilla del interruptor ----
  await irAdmin(p); await admin(p, "preferencias", "tipos"); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-action="tipo-abrir"]').click()); await p.waitForTimeout(500);
  // Dónde está la perilla dentro de su pista: lo que mide el borde de adentro (left + el corrimiento).
  const perilla = () => p.evaluate(() => {
    const sw = document.querySelector(".lp-switch .lp-sw"), cs = getComputedStyle(sw, "::after"), pista = sw.getBoundingClientRect();
    const tx = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform).m41;
    return { desdeLaIzquierda: Math.round(parseFloat(cs.left) + tx), ancho: Math.round(pista.width), marcado: sw.previousElementSibling.checked };
  });
  await p.waitForTimeout(300);
  const a = await perilla();
  await p.evaluate(() => document.querySelector('[data-action="tipos-sync"]').click()); await p.waitForTimeout(500);
  const c = await perilla();
  const [apagado, encendido] = a.marcado ? [c, a] : [a, c];
  eq(`[${idioma}] hay un interruptor con sus dos estados (la prueba mide algo)`, [a.marcado !== c.marcado, a.ancho], [true, 38]);
  // Pista de 38, perilla de 16, margen de 3: en LTR apagado = 3 y encendido = 19; en RTL, al revés.
  eq(`[${idioma}] la perilla apagada arranca del lado donde empieza la lectura (${rtl ? "derecha" : "izquierda"})`, apagado.desdeLaIzquierda, rtl ? 19 : 3);
  eq(`[${idioma}] y encendida se corre hacia el final (${rtl ? "izquierda" : "derecha"})`, encendido.desdeLaIzquierda, rtl ? 3 : 19);
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
