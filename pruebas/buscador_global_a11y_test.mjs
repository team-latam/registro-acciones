/* ======================================================================
   «Buscar en todo» para quien usa teclado o lector de pantalla (auditoría
   del 10/10/2026, R22)

   - El campo es un combobox: aria-expanded dice si el panel está abierto y
     aria-controls apunta a él; el panel es una lista (listbox) con grupos y
     cada resultado es una opción. Siguen siendo botones: el rol «option» es
     uno de los permitidos en un <button>, y el aspecto no cambia.
   - Flecha abajo, desde el campo, baja al primer resultado; arriba y abajo
     recorren (Inicio / Fin van a los extremos); arriba en el primero vuelve
     al campo.
   - Escape cierra y deja el foco en el campo (antes hacía blur() y el foco
     caía al <body>). Elegir un resultado, en cambio, suelta el campo.
   - Una línea oculta (role=status) cuenta los resultados.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();
const estado = p => p.evaluate(() => {
  const i = document.getElementById("globalSearchInput"), l = document.getElementById("globalResults"), a = document.activeElement;
  return { expandido: i.getAttribute("aria-expanded"), abierto: !l.hidden, valor: i.value,
    foco: a === i ? "campo" : a === document.body ? "body" : a.closest("#globalResults") ? "resultado:" + (a.dataset.action || "") + ":" + [...document.querySelectorAll("#globalResults .gs-item")].indexOf(a) : a.tagName + "#" + a.id };
});
const buscar = async (p, q) => { await p.click("#globalSearchInput"); await p.fill("#globalSearchInput", q); await p.waitForTimeout(350); };

for(const [lang, sinResultados, unoOVarios] of [["", "Sin resultados", n => `${n} resultados`], ["en", "No results", n => `${n} results`]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, lang });
  const idioma = lang || "es";

  // ---- El cableado ARIA ----
  const base = await p.evaluate(() => {
    const i = document.getElementById("globalSearchInput"), l = document.getElementById("globalResults");
    return { rol: i.getAttribute("role"), controla: i.getAttribute("aria-controls"), existe: !!document.getElementById(i.getAttribute("aria-controls")), expandido: i.getAttribute("aria-expanded"),
      popup: i.getAttribute("aria-haspopup"), lista: l.getAttribute("role"), nombreLista: l.getAttribute("aria-label"), estadoRol: document.getElementById("globalStatus")?.getAttribute("role") };
  });
  eq(`[${idioma}] el campo es un combobox que controla al panel, cerrado al empezar`, [base.rol, base.controla, base.existe, base.expandido, base.popup], ["combobox", "globalResults", true, "false", "listbox"]);
  eq(`[${idioma}] el panel es una lista con nombre, y hay una línea de estado`, [base.lista, !!base.nombreLista, base.estadoRol], ["listbox", true, "status"]);

  await buscar(p, "ro");
  const abierto = await p.evaluate(() => {
    const items = [...document.querySelectorAll("#globalResults .gs-item")];
    return { expandido: document.getElementById("globalSearchInput").getAttribute("aria-expanded"), n: items.length,
      roles: [...new Set(items.map(x => x.getAttribute("role")))], botones: items.every(x => x.tagName === "BUTTON"),
      grupos: [...document.querySelectorAll("#globalResults [role=group]")].map(g => [g.getAttribute("aria-label"), g.querySelector(".gs-group")?.textContent]),
      estado: (document.getElementById("globalStatus") || {}).textContent, sinOpcion: document.querySelectorAll('#globalResults button:not([role=option])').length,
      resultados: document.querySelectorAll("#globalResults .gs-item:not(.gs-all)").length };
  });
  eq(`[${idioma}] con resultados: aria-expanded=true`, abierto.expandido, "true");
  eq(`[${idioma}] hay resultados (la prueba mide algo)`, abierto.n > 2 && abierto.resultados > 0, true);
  eq(`[${idioma}] cada resultado es una opción y sigue siendo un botón`, [abierto.roles, abierto.botones, abierto.sinOpcion], [["option"], true, 0]);
  eq(`[${idioma}] cada grupo lleva su nombre (el del encabezado)`, abierto.grupos.length > 0 && abierto.grupos.every(([a, c]) => a && a === c), true);
  eq(`[${idioma}] la línea oculta cuenta los resultados`, abierto.estado, unoOVarios(abierto.resultados).replace(/^1 resultados$/, "1 resultado").replace(/^1 results$/, "1 result"));
  eq(`[${idioma}] y es invisible (no ocupa lugar)`, await p.evaluate(() => { const e = document.getElementById("globalStatus"); if(!e) return [false, false]; const r = e.getBoundingClientRect(); return [r.width <= 1, r.height <= 1]; }), [true, true]);

  // ---- Las flechas ----
  await p.focus("#globalSearchInput");
  await p.keyboard.press("ArrowDown");
  eq(`[${idioma}] flecha abajo desde el campo baja al primer resultado`, (await estado(p)).foco.endsWith(":0"), true);
  await p.keyboard.press("ArrowDown");
  eq(`[${idioma}] otra vez, al segundo`, (await estado(p)).foco.endsWith(":1"), true);
  await p.keyboard.press("ArrowUp");
  eq(`[${idioma}] flecha arriba, al primero`, (await estado(p)).foco.endsWith(":0"), true);
  await p.keyboard.press("End");
  eq(`[${idioma}] Fin va al último`, (await estado(p)).foco.endsWith(":" + (abierto.n - 1)), true);
  await p.keyboard.press("ArrowDown");
  eq(`[${idioma}] y abajo del último no se pasa`, (await estado(p)).foco.endsWith(":" + (abierto.n - 1)), true);
  await p.keyboard.press("Home");
  eq(`[${idioma}] Inicio va al primero`, (await estado(p)).foco.endsWith(":0"), true);
  await p.keyboard.press("ArrowUp");
  const arriba = await estado(p);
  eq(`[${idioma}] arriba en el primero vuelve al campo, con el panel abierto`, [arriba.foco, arriba.abierto, arriba.expandido], ["campo", true, "true"]);

  // ---- Escape ----
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  const e1 = await estado(p);
  eq(`[${idioma}] Escape desde un resultado: cierra, limpia y deja el foco en el campo`, [e1.abierto, e1.expandido, e1.valor, e1.foco], [false, "false", "", "campo"]);
  eq(`[${idioma}] y la línea de estado se vacía`, await p.evaluate(() => (document.getElementById("globalStatus") || {}).textContent), "");
  await buscar(p, "ro");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  const e2 = await estado(p);
  eq(`[${idioma}] Escape desde el campo: cierra, limpia y el foco sigue en el campo`, [e2.abierto, e2.expandido, e2.valor, e2.foco], [false, "false", "", "campo"]);
  // Con el panel ya cerrado y algo escrito de una sola letra, Escape también limpia y no suelta el foco.
  await p.fill("#globalSearchInput", "r"); await p.waitForTimeout(250);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  const e3 = await estado(p);
  eq(`[${idioma}] Escape con el panel ya cerrado: limpia y deja el foco en el campo`, [e3.valor, e3.foco], ["", "campo"]);

  // ---- Sin resultados ----
  await buscar(p, "zzqx");
  eq(`[${idioma}] sin resultados lo dice la línea de estado`, await p.evaluate(() => (document.getElementById("globalStatus") || {}).textContent), sinResultados);

  // ---- Clic afuera: cierra ----
  await buscar(p, "ro");
  await p.mouse.click(700, 500); await p.waitForTimeout(200);
  const af = await estado(p);
  eq(`[${idioma}] un clic afuera cierra el panel y aria-expanded=false`, [af.abierto, af.expandido], [false, "false"]);

  // ---- Elegir un resultado suelta el campo (como siempre) ----
  await buscar(p, "argent");
  await p.keyboard.press("ArrowDown");
  const elegido = (await estado(p)).foco;
  await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  const e4 = await estado(p);
  eq(`[${idioma}] elegir un resultado con el teclado (${elegido.split(":")[1]}) cierra el panel y no deja el foco en el campo`, [e4.abierto, e4.foco !== "campo", e4.valor], [false, true, ""]);
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
