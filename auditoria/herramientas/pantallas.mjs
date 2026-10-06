/* ======================================================================
   Pantallas, idiomas y ventanas

   La app entera (con los datos de siempre) en cinco tamaños, los cuatro
   idiomas y el modo oscuro, y en cada vista:
   - lo que queda cortado, se sale de la pantalla o corre la página de
     costado (la misma medición que pruebas/recortes_test.mjs, pero en
     todas las combinaciones, que en cada corrida de las pruebas no entran);
   - texto roto en pantalla ("undefined", "NaN", "{n}" sin reemplazar...);
   - errores de la página.
   Y cada ventana (formularios, fichas, perfiles, el visor):
   - que se anuncie como ventana (role="dialog" y aria-modal);
   - que el foco entre al abrirla, que Tab no se escape, que Escape la
     cierre y que el foco vuelva al botón que la abrió (CLAUDE.md, «Modales
     accesibles»).
   AUDITORIA_PANTALLAS limita las combinaciones ("1280x800:es,390x844:he").
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, revisarRecortes, recorrerApp, tab, click, cerrar } from "../../pruebas/app_de_mentira.mjs";
import { hallazgo, entregar } from "./comun.mjs";

const TODAS = "1440x900:es,1024x768:es,768x1024:es,390x844:es,320x640:es,1280x800:en,390x844:en,1280x800:pt,390x844:pt,1280x800:he,390x844:he,390x844:es:oscuro";
const COMBOS = (process.env.AUDITORIA_PANTALLAS || TODAS).split(",").map(x => { const [tam, lang, modo] = x.split(":"); const [w, h] = tam.split("x").map(Number); return { vp: { width: w, height: h }, lang, oscuro: modo === "oscuro", nombre: x }; });
const BASURA = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\{(n|x|d|m|a|b|p|f|e|z|l|msg|email|v|t)\}/;

const out = [];
const b = await abrirNavegador();
for(const c of COMBOS){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: c.vp, lang: c.lang === "es" ? "" : c.lang, dark: c.oscuro });
  const recortes = [];
  await recorrerApp(p, async (p, n) => {
    recortes.push(...await revisarRecortes(p, c.nombre + " · " + n));
    const txt = await p.evaluate(() => document.body.innerText);
    const x = BASURA.exec(txt);
    if(x) out.push(hallazgo("textos", "medio", "Texto roto en pantalla", c.nombre + " · " + n, "«" + txt.slice(Math.max(0, x.index - 40), x.index + 30).replace(/\s+/g, " ") + "»"));
  });
  const grupos = new Map(); recortes.forEach(r => { const k = r.tipo + " | " + (r.el || "") + " | " + (r.por || ""); if(!grupos.has(k)) grupos.set(k, r); });
  grupos.forEach((r, k) => out.push(hallazgo("diseño", "medio", "Algo queda cortado o fuera de la pantalla", r.estado, k)));
  [...new Set(errores)].slice(0, 10).forEach(e => out.push(hallazgo("errores", "importante", "Error en la página", c.nombre, e)));
  await p.close();
}

/* --- Las ventanas, una por una (en escritorio y en celular) --- */
const VENTANAS = [
  ["Nuevo evento", async p => { await click(p, "#fabMain"); return '[data-action="new-evento"]'; }],
  ["Perfil de una persona", async p => '.post [data-action="show-user-profile"]'],
  ["Quiénes dieron me gusta", async p => '[data-action="ver-me-gusta"]'],
  ["Foto", async p => '[data-action="open-lightbox"]'],
  // Un archivo suelto (sin ranura de documento) es el que se abre en el visor.
  ["Archivo en el visor", async p => '[data-action="open-file-preview"]',
    () => { const base = BASE(); base.posts[0].files = (base.posts[0].files || []).concat([{ name: "Nota suelta.pdf", path: `posts/${base.posts[0].id}/nota.pdf` }]); return base; }],
  ["Evento del Calendario", async p => { await tab(p, "calendario"); await p.waitForTimeout(300); return '[data-action="cal-open"]'; }],
  ["Ficha de un posteo (desde un lugar)", async p => { await tab(p, "paises"); await click(p, '[data-action="drill-country"]'); await p.waitForTimeout(400); return '[data-action="ficha-abrir"]'; }],
];
for(const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]){
  for(const [nombre, preparar, datos] of VENTANAS){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base: datos ? datos() : undefined });
    const donde = `${nombre} (${vp.width})`;
    const sel = await preparar(p);
    const boton = await p.$(sel);
    if(!boton){ out.push(hallazgo("ventanas", "dato", "No se pudo abrir para revisar", donde, sel)); await p.close(); continue; }
    await boton.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const seVe = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const d = [...document.querySelectorAll('[role="dialog"], .modal-overlay:not([hidden]), #lightbox.show, .visor-doc:not([hidden])')].filter(seVe).pop();
      if(!d) return null;
      const dlg = d.matches('[role="dialog"]') ? d : d.querySelector('[role="dialog"]') || d;
      return { rol: dlg.getAttribute("role"), modal: dlg.getAttribute("aria-modal"), nombre: !!(dlg.getAttribute("aria-label") || dlg.getAttribute("aria-labelledby")), foco: dlg.contains(document.activeElement) };
    });
    if(!r){ out.push(hallazgo("ventanas", "medio", "Con Enter no se abre", donde, sel)); await p.close(); continue; }
    if(r.rol !== "dialog") out.push(hallazgo("ventanas", "medio", "No se anuncia como ventana (role=dialog)", donde));
    if(r.modal !== "true") out.push(hallazgo("ventanas", "bajo", "Le falta aria-modal", donde));
    if(!r.nombre) out.push(hallazgo("ventanas", "bajo", "La ventana no tiene nombre para lectores de pantalla", donde));
    if(!r.foco) out.push(hallazgo("ventanas", "medio", "Al abrir, el foco no entra a la ventana", donde));
    // Tab 25 veces: el foco no se tiene que ir afuera.
    let escapo = false;
    for(let i = 0; i < 25 && !escapo; i++){
      await p.keyboard.press("Tab");
      escapo = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].filter(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden").pop(); return !!d && !d.contains(document.activeElement); });
    }
    if(escapo) out.push(hallazgo("ventanas", "medio", "Con Tab, el foco se escapa de la ventana", donde));
    await p.keyboard.press("Escape"); await p.waitForTimeout(350);
    const despues = await p.evaluate(sel => ({ abierta: [...document.querySelectorAll('[role="dialog"]')].some(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"),
      volvio: !!document.activeElement && (document.activeElement.matches(sel) || !!document.activeElement.closest(sel.split(",")[0])) }), sel);
    if(despues.abierta) out.push(hallazgo("ventanas", "medio", "Escape no la cierra", donde));
    else if(!despues.volvio) out.push(hallazgo("ventanas", "bajo", "Al cerrar, el foco no vuelve al botón que la abrió", donde));
    await p.close();
  }
}
await b.close();
entregar("pantallas", out);
