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
     accesibles»);
   - y en el celular, que al abrirla el foco no caiga en un campo de texto:
     eso abre el teclado solo y tapa media ventana (lo mostró el usuario en
     la Agenda, 9/10/2026; la regla de la app es la ✕, ver focusIntoComposer).
   - y que, si entra en la pantalla, quede en el medio y no pegada arriba
     (lo pidió el usuario con dos capturas, 9/10/2026: la del Calendario
     sí, la Agenda y la ficha de un posteo no).
   - y, en el celular, que una ventana con poco adentro no crezca con la
     pantalla (al esconderse la barra del navegador): dejaba un blanco
     abajo (capturas del iPhone del usuario, 9/10/2026).
   AUDITORIA_PANTALLAS limita las combinaciones ("1280x800:es,390x844:he").
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, revisarRecortes, recorrerApp, tab, click, cerrar } from "../../pruebas/app_de_mentira.mjs";
import { hallazgo, entregar } from "./comun.mjs";

// «ancha»: con una letra más ancha que la de acá (la de GitHub es otra, y
// dos veces algo que entraba justo acá se cortó allá: RECURRENTES).
const TODAS = "1440x900:es,1024x768:es,768x1024:es,390x844:es,320x640:es,1280x800:en,390x844:en,1280x800:pt,390x844:pt,1280x800:he,390x844:he,390x844:es:oscuro,390x844:es:ancha";
const COMBOS = (process.env.AUDITORIA_PANTALLAS || TODAS).split(",").map(x => { const [tam, lang, modo] = x.split(":"); const [w, h] = tam.split("x").map(Number); return { vp: { width: w, height: h }, lang, oscuro: modo === "oscuro", ancha: modo === "ancha", nombre: x }; });
const LETRA_ANCHA = `*{ font-family:"DejaVu Sans", Verdana, monospace !important; }`;
const BASURA = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\{(n|x|d|m|a|b|p|f|e|z|l|msg|email|v|t)\}/;

const out = [];
const b = await abrirNavegador();
for(const c of COMBOS){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: c.vp, lang: c.lang === "es" ? "" : c.lang, dark: c.oscuro });
  const recortes = [];
  if(c.ancha) await p.addStyleTag({ content: LETRA_ANCHA });
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
  // La Agenda (8/10/2026): la ventana, y lo que se abre desde la ficha de un lugar.
  ["Agenda", async p => { await tab(p, "paises"); await p.waitForTimeout(300); return ".paises-agenda"; }],
  ["Agenda: una persona (desde la ficha de un lugar)", async p => { await rosario(p); return '.fl-ag-inst [data-action="agenda-ver-persona"]'; }],
  ["Agenda: sumar a alguien (desde la ficha de un lugar)", async p => { await rosario(p); return '.fl-ag-pie [data-action="agenda-sumar"]'; }],
  // «Buscar en todo» no está en pantallas angostas (menos de 900 px): ahí no se revisa.
  ["Agenda: una institución (desde Buscar en todo)", async p => { if(!await p.isVisible("#globalSearchInput")) return null; await p.fill("#globalSearchInput", "Rosario"); await p.waitForTimeout(300); return '[data-action="gs-institucion"]'; }],
];
// La ficha de Rosario, con la tarjeta de contactos abierta (en el celular viene plegada).
async function rosario(p){
  await tab(p, "paises"); await click(p, '[data-action="drill-country"][data-country="Argentina"]'); await p.waitForTimeout(400);
  // Con un clic de la página: en el celular la tarjeta «Ciudades» viene plegada.
  await p.evaluate(() => { const b = document.querySelector('[data-action="drill-city"][data-city="Rosario"]'); b && b.click(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = document.querySelector('.fl-pliegue[data-que="contactos"][aria-expanded="false"]'); if(b && b.offsetParent) b.click(); }); await p.waitForTimeout(200);
}
// 1440×1000 además de 1280×800: en la más alta entran ventanas (la ficha de un posteo, de unos 830 px) que en la baja no, y así se mide si quedan en el medio.
for(const vp of [{ width: 1280, height: 800 }, { width: 1440, height: 1000 }, { width: 390, height: 844 }]){
  for(const [nombre, preparar, datos] of VENTANAS){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base: datos ? datos() : undefined });
    const donde = `${nombre} (${vp.width})`;
    const sel = await preparar(p);
    if(sel === null){ await p.close(); continue; }   // no aplica en este tamaño
    const boton = await p.$(sel);
    if(!boton){ out.push(hallazgo("ventanas", "dato", "No se pudo abrir para revisar", donde, sel)); await p.close(); continue; }
    await boton.evaluate(e => e.setAttribute("data-auditoria-abre", "1"));
    await boton.focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const seVe = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const d = [...document.querySelectorAll('[role="dialog"], .modal-overlay:not([hidden]), #lightbox.show, .visor-doc:not([hidden])')].filter(seVe).pop();
      if(!d) return null;
      const dlg = d.matches('[role="dialog"]') ? d : d.querySelector('[role="dialog"]') || d;
      const a = document.activeElement;
      const deTexto = !!a && (a.isContentEditable || a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|file|range|color|hidden)$/i.test(a.type)));
      const rc = dlg.getBoundingClientRect();
      return { rol: dlg.getAttribute("role"), modal: dlg.getAttribute("aria-modal"), nombre: !!(dlg.getAttribute("aria-label") || dlg.getAttribute("aria-labelledby")), foco: dlg.contains(a), deTexto,
        tactil: matchMedia("(hover: none) and (pointer: coarse)").matches,
        arriba: Math.round(rc.top), abajo: Math.round(innerHeight - rc.bottom), alto: Math.round(rc.height), pantalla: innerHeight };
    });
    if(!r){ out.push(hallazgo("ventanas", "medio", "Con Enter no se abre", donde, sel)); await p.close(); continue; }
    if(r.rol !== "dialog") out.push(hallazgo("ventanas", "medio", "No se anuncia como ventana (role=dialog)", donde));
    if(r.modal !== "true") out.push(hallazgo("ventanas", "bajo", "Le falta aria-modal", donde));
    if(!r.nombre) out.push(hallazgo("ventanas", "bajo", "La ventana no tiene nombre para lectores de pantalla", donde));
    if(!r.foco) out.push(hallazgo("ventanas", "medio", "Al abrir, el foco no entra a la ventana", donde));
    if(r.tactil && r.deTexto) out.push(hallazgo("ventanas", "importante", "En el celular, al abrirla se abre el teclado solo (el foco cae en un campo de texto)", donde));
    // En el medio de la pantalla (pedido del usuario, 9/10/2026: la Agenda y la ficha de un posteo
    // abrían pegadas arriba): si entra con su respiro de 24 px, queda a la misma distancia de los dos bordes.
    if(r.alto + 48 <= r.pantalla && Math.abs(r.arriba - r.abajo) > 4) out.push(hallazgo("ventanas", "medio", `La ventana no queda en el medio de la pantalla (${r.arriba} px del borde de arriba y ${r.abajo} del de abajo)`, donde));
    // En el celular, con poco adentro, la ventana no tiene que crecer con la pantalla: al esconderse la
    // barra del navegador crece lo visible, y una ventana a pantalla completa deja un blanco abajo que
    // se agranda (captura del usuario, 9/10/2026). Se mide con 100 px más de alto; si algo adentro sigue
    // desplazándose (una lista larga), que crezca es lo esperado. El visor y la foto ocupan todo a propósito.
    if(vp.width < 800){
      const medida = () => p.evaluate(() => {
        const seVe = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
        const d = [...document.querySelectorAll('[role="dialog"], .modal-overlay:not([hidden]), #lightbox.show, .visor-doc:not([hidden])')].filter(seVe).pop();
        if(!d || d.matches("#lightbox, .visor-doc")) return null;
        const dlg = d.matches('[role="dialog"]') ? d : d.querySelector('[role="dialog"]') || d;
        return { alto: Math.round(dlg.getBoundingClientRect().height), desplaza: [dlg, ...dlg.querySelectorAll("*")].some(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1) };
      });
      const antes = await medida();
      await p.setViewportSize({ width: vp.width, height: vp.height + 100 }); await p.waitForTimeout(400);
      const despues = await medida();
      await p.setViewportSize(vp); await p.waitForTimeout(300);
      if(antes && despues && despues.alto > antes.alto + 20 && !despues.desplaza) out.push(hallazgo("ventanas", "medio", `La ventana crece con la pantalla y deja un blanco abajo (${antes.alto} px de alto; ${despues.alto} con 100 px más de pantalla)`, donde));
    }
    // Tab 25 veces: el foco no se tiene que ir afuera.
    let escapo = false;
    for(let i = 0; i < 25 && !escapo; i++){
      await p.keyboard.press("Tab");
      escapo = await p.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].filter(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden").pop(); return !!d && !d.contains(document.activeElement); });
    }
    if(escapo) out.push(hallazgo("ventanas", "medio", "Con Tab, el foco se escapa de la ventana", donde));
    await p.keyboard.press("Escape"); await p.waitForTimeout(350);
    const despues = await p.evaluate(sel => ({ abierta: [...document.querySelectorAll('[role="dialog"]')].some(e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"),
      // Si el botón que la abrió ya no existe (un resultado de «Buscar en
      // todo», que se cierra al elegir), alcanza con que el foco no se pierda.
      volvio: !!document.activeElement && (document.querySelector("[data-auditoria-abre]")
        ? (document.activeElement.matches(sel) || !!document.activeElement.closest(sel.split(",")[0]))
        : document.activeElement !== document.body) }), sel);
    if(despues.abierta) out.push(hallazgo("ventanas", "medio", "Escape no la cierra", donde));
    else if(!despues.volvio) out.push(hallazgo("ventanas", "bajo", "Al cerrar, el foco no vuelve al botón que la abrió", donde));
    await p.close();
  }
}
await b.close();
entregar("pantallas", out);
