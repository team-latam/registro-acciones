/* ======================================================================
   Al cerrar «¿Borrar…?», el foco vuelve al botón «⋯» (auditoría del 28/10/2026, T8)

   Elegir «Borrar…» en el menú «⋯» de un posteo cierra el menú ANTES de que corra la
   acción (así se hace con todos los menús), y con el menú desaparece el botón que
   tenía el foco. Al cancelar el cartel «¿Borrar "…" del todo?» (con el botón o con
   Escape), el foco caía en el cuerpo de la página: quien usa el teclado volvía al
   principio de todo. Ahora vuelve al «⋯» de ese mismo posteo.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const foco = p => p.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, accion: a.getAttribute("data-action"), post: a.getAttribute("data-post-id") } : null; });
const abrirBorrar = async p => {
  await p.focus('.post[data-post-id="p1"] [data-action="toggle-post-menu"]');
  await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  for(let i = 0; i < 14; i++){ if((await foco(p)).accion === "delete-post") break; await p.keyboard.press("Tab"); await p.waitForTimeout(50); }
  eq("el teclado llega a «Borrar…» del menú", (await foco(p)).accion, "delete-post");
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  eq("se abre el cartel de confirmar, con el foco en «Cancelar»", await p.evaluate(() => [!document.getElementById("confirmOverlay").hidden, document.activeElement.id]), [true, "confirmCancel"]);
};

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
const hayP1 = () => p.evaluate(() => !!document.querySelector('.post[data-post-id="p1"]'));

// 1. Escape
await abrirBorrar(p);
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
eq("con Escape, el foco vuelve al ⋯ de ese posteo", await foco(p), { tag: "BUTTON", accion: "toggle-post-menu", post: "p1" });
eq("y el posteo sigue ahí", await hayP1(), true);

// 2. El botón «Cancelar»
await abrirBorrar(p);
await p.click("#confirmCancel"); await p.waitForTimeout(300);
eq("con «Cancelar», también", await foco(p), { tag: "BUTTON", accion: "toggle-post-menu", post: "p1" });

// 3. Otro cartel que NO sale de un menú (el de salir de una ventana con datos) no hereda ese botón
await p.click("#fabMain"); await p.click('[data-action="new-evento"]'); await p.waitForSelector("#cTitle");
await p.fill("#cTitle", "Algo a medias"); await p.evaluate(() => document.activeElement.blur());
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
const hayCartel = await p.evaluate(() => !document.getElementById("confirmOverlay").hidden);
if(hayCartel){ await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
const f = await foco(p);
eq("un cartel que no salió de un menú no manda el foco al «⋯» del posteo", f.accion === "toggle-post-menu" && f.post === "p1", false);

eq("sin errores en la página", errores, []);
await p.close(); await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
