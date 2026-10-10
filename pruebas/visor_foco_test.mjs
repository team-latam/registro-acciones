/* ======================================================================
   El visor de archivos y el foco (auditoría del 10/10/2026, R23)

   trapTabWithin() solo oye los Tab que pasan por la página. Si el foco entra
   al PDF del marco (un clic adentro), el Tab siguiente sale de la ventana y
   el foco se va al fondo. Arreglo: mientras el visor de archivos está
   abierto, un foco que cae en un elemento de la página que no está adentro
   del visor vuelve al primer control del visor; al cerrarlo, el oyente se
   saca (no queda pegando el foco).

   Sin teclado real: se abre el visor y se le da foco desde la página a un
   botón de afuera.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const conPdf = () => {
  const base = BASE();
  base.posts.find(x => x.id === "p1").files = [
    { name: "Plan viejo.pdf", kind: "pdf", path: "posts/p1/plan1.pdf" },
    { name: "Reporte.pdf", kind: "pdf", path: "posts/p1/rep.pdf" }];
  return base;
};
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conPdf() });
const donde = () => p.evaluate(() => {
  const a = document.activeElement;
  return { enVisor: !!a && !!a.closest("#filePreviewOverlay"), id: a && a.id, etiqueta: a && a.tagName };
});
// Un botón de la página, de afuera del visor, al que se le da foco desde el código.
const enfocarAfuera = () => p.evaluate(() => {
  const el = document.querySelector('.post[data-post-id="p1"] [data-action="toggle-thread"]') || document.querySelector("nav.tabs button");
  el.focus(); return el.tagName + (el.dataset.action ? "[" + el.dataset.action + "]" : "");
});

await click(p, '.post[data-post-id="p1"] .post-file-link');
await p.waitForSelector("#filePreviewOverlay:not([hidden])");
await p.waitForTimeout(300);
eq("el visor se abre con el foco adentro", (await donde()).enVisor, true);

// 1) Un foco que cae afuera mientras el visor está abierto vuelve adentro.
const afuera = await enfocarAfuera();
eq("el botón de afuera existe (la prueba mide algo)", /^BUTTON/.test(afuera), true);
const d1 = await donde();
eq("el foco que cae en la página de atrás vuelve adentro del visor", d1.enVisor, true);
eq("y va al primer control del visor (no a cualquiera)", d1.id, await p.evaluate(() => {
  const o = document.getElementById("filePreviewOverlay");
  return [...o.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(e => !e.disabled && !e.hidden && e.offsetParent !== null)[0].id;
}));

// 2) Lo que está adentro del visor sigue pudiendo recibir foco (no se pelea con él).
await p.evaluate(() => document.getElementById("filePreviewClose").focus());
eq("un control del visor conserva el foco", (await donde()).id, "filePreviewClose");
await p.evaluate(() => document.getElementById("filePreviewFrame").focus());
eq("el marco del PDF también (ahí es donde se entra con un clic)", await p.evaluate(() => document.activeElement.id), "filePreviewFrame");
// Y desde el marco, el Tab que sale hacia la página vuelve adentro (el foco cae en el primer enfocable de la página).
await p.evaluate(() => document.querySelector(".skip-link, nav.tabs button, button").focus());
eq("saliendo del marco hacia la página, el foco vuelve al visor", (await donde()).enVisor, true);

// 3) Cerrar: el oyente se saca y el foco vuelve a donde estaba.
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
eq("Escape cierra el visor", await p.evaluate(() => document.getElementById("filePreviewOverlay").hidden), true);
eq("y el foco vuelve a lo que se tocó para abrirlo", await p.evaluate(() => document.activeElement.classList.contains("post-file-link")), true);
const afuera2 = await enfocarAfuera();
const d2 = await donde();
eq("cerrado, el foco en la página se queda donde se lo puso (el oyente no queda pegando)", [d2.enVisor, d2.etiqueta], [false, afuera2.split("[")[0]]);

// 4) Reabrir lo vuelve a armar, y cerrar con la ✕ lo vuelve a sacar.
await click(p, '.post[data-post-id="p1"] .post-file-link');
await p.waitForSelector("#filePreviewOverlay:not([hidden])");
await p.waitForTimeout(200);
await enfocarAfuera();
eq("al reabrirlo, vuelve a traer el foco", (await donde()).enVisor, true);
await click(p, "#filePreviewClose");
await p.waitForTimeout(200);
await enfocarAfuera();
eq("cerrado con la ✕, tampoco queda pegando", (await donde()).enVisor, false);

// 5) Un aviso propio (confirm/alert) encima del visor puede tomar el foco.
await click(p, '.post[data-post-id="p1"] .post-file-link');
await p.waitForSelector("#filePreviewOverlay:not([hidden])");
await p.waitForTimeout(200);
await p.evaluate(() => { document.getElementById("confirmOverlay").hidden = false; document.getElementById("confirmOk").focus(); });
eq("un aviso propio encima del visor conserva su foco", await p.evaluate(() => !!document.activeElement.closest("#confirmOverlay")), true);
await p.evaluate(() => { document.getElementById("confirmOverlay").hidden = true; });
await p.keyboard.press("Escape");
await p.waitForTimeout(200);

eq("sin errores en la página", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
