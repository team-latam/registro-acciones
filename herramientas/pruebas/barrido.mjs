/* ======================================================================
   Un solo recorrido de la app para varias revisiones (24/11/2026)

   Antes, cinco pruebas recorrían cada una por su cuenta TODAS las pantallas y
   ventanas de la app (recorrerApp: unas 60 paradas): recortes_test (nada
   cortado), selectores_test (abrir y cerrar cada selector), letra_minima_test
   (letra de 11 px o más), arbol_accesibilidad_test (todo control tiene nombre
   para el lector de pantalla) y hebreo_titulos_test (los rótulos en hebreo se
   leen). Doce recorridos en total, y cada uno paga lo mismo: entrar, abrir
   cada ventana, esperar a que se dibuje.

   Ahora se recorre una vez por tamaño e idioma y en cada parada se corren, una
   detrás de otra, las revisiones que corresponden (las que solo miran, y al
   final la que toca cosas: abrir y elegir en los selectores). Cada revisión es
   una fábrica: recibe la página y el nombre de la configuración, y devuelve
   `{ paso(p, parada), fin(eq) }`: lo que hace en cada parada y lo que afirma al
   terminar. Ninguna comprobación se perdió: son las mismas, con los mismos
   nombres y los mismos pisos; lo que cambió es cuántas veces se entra a la app.

   Las pruebas que lo usan: barrido_compu_test.mjs, barrido_celular_test.mjs y
   barrido_variantes_test.mjs (en tres para que corran a la vez).
   ====================================================================== */
import { entrar, ADMIN, click, cerrar, recorrerApp, revisarRecortes } from "./app_de_mentira.mjs";

// ---------- Nada se corta (pedido del usuario, 6/10/2026) ----------
// Mide todo botón, campo, enlace y chip, y el anillo de foco de cada uno (como cuando se usa el
// teclado). Falla si algo queda cortado por el borde de una zona que lo recorta (salvo un carrusel
// que se desplaza a propósito), si se sale de la pantalla, o si la página entera se corre de costado.
export const recortes = (p, tam) => {
  const todas = [];
  return {
    paso: async (p, n) => { todas.push(...await revisarRecortes(p, tam + " · " + n)); },
    fin: eq => {
      // Una línea por problema distinto (el mismo en varios estados, junto).
      const grupos = new Map();
      for(const f of todas){ const k = f.tipo + " | " + (f.el || "") + " | " + (f.por || ""); if(!grupos.has(k)) grupos.set(k, { ...f, donde: [] }); grupos.get(k).donde.push(f.estado); }
      eq(`${tam}: nada cortado ni fuera de la pantalla, en ninguna vista ni ventana`, [...grupos].map(([k, g]) => k + " (" + g.donde.length + ": " + g.donde.slice(0, 2).join(" / ") + ")"), []);
    },
  };
};

// ---------- Todo control tiene nombre en el árbol de accesibilidad (auditoría del 28/10/2026, T7) ----------
// Mide lo que ve un lector de pantalla: el árbol de accesibilidad de Chrome (Accessibility.getFullAXTree).
// Un botón, un enlace o un campo sin nombre se anuncia solo como «cuadro de texto» o «número».
// Los campos que toman su nombre del placeholder (el cuadro de publicar) cuentan: Chrome los nombra con él.
const ROLES = new Set(["button", "link", "textbox", "searchbox", "spinbutton", "combobox", "checkbox", "radio", "switch", "tab", "menuitem", "slider", "listbox"]);
export const arbol = async (p, tam) => {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Accessibility.enable"); await cdp.send("DOM.enable");
  const sinNombre = new Map(); let vistas = 0, medidos = 0;
  return {
    paso: async (p, vista) => {
      vistas++;
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      for(const n of nodes){
        if(n.ignored || !n.role || !ROLES.has(n.role.value)) continue;
        medidos++;
        if(((n.name && n.name.value) || "").trim()) continue;
        let quien = n.role.value;
        try {
          const d = await cdp.send("DOM.describeNode", { backendNodeId: n.backendDOMNodeId });
          const at = {}; (d.node.attributes || []).forEach((v, i, l) => { if(i % 2 === 0) at[v] = l[i + 1]; });
          quien = `${n.role.value} <${d.node.localName}${at.id ? "#" + at.id : ""}${at.class ? "." + String(at.class).split(" ")[0] : ""}${at["data-action"] ? " [" + at["data-action"] + "]" : ""}${at["data-pref"] ? " [pref " + at["data-pref"] + "]" : ""}>`;
        } catch(e) { /* el nodo ya no está */ }
        const clave = quien + " · " + vista;
        sinNombre.set(clave, (sinNombre.get(clave) || 0) + 1);
      }
    },
    fin: eq => {
      eq(`[${tam}] la prueba midió algo (más de 40 pantallas y 1.500 controles)`, vistas > 40 && medidos > 1500, true);
      eq(`[${tam}] ningún control queda sin nombre para el lector de pantalla`, [...sinNombre.keys()].slice(0, 20), []);
    },
  };
};

// ---------- La letra no baja de un piso (crítica de diseño del 28/10/2026) ----------
// El texto de verdad, en las pantallas (la regla del CSS la lee barrido_compu_test aparte, una sola vez).
const chicos = p => p.evaluate(() => {
  const res = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n = w.currentNode; if(!n.textContent.trim()) continue;
    const el = n.parentElement; if(!el || (!el.offsetParent && getComputedStyle(el).position !== "fixed")) continue;
    const r = el.getBoundingClientRect(); if(r.width < 2 || r.height < 2) continue;
    if(el.closest(".solo-lector, .skip-link, .occ-chev, .filter-dropdown-chevron, .mention-avatar-fallback, .fl-doc i, .rep-plan-n")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if(fs < 11) res.push(`${fs}px .${String(el.className || el.tagName).slice(0, 28)} «${n.textContent.trim().slice(0, 18)}»`);
  }
  return res;
});
export const letra = (p, tam, ancho) => {
  const hallados = new Map();
  return {
    paso: async (p, nombre) => { for(const x of await chicos(p)) if(!hallados.has(x)) hallados.set(x, nombre); },
    fin: eq => eq(`${ancho} px: ningún texto de las pantallas mide menos de 11 px`, [...hallados].slice(0, 6).map(([x, v]) => `${x} (${v})`), []),
  };
};

// ---------- En hebreo, los rótulos chicos se leen (docs/AUDITORIA.md, V4; el usuario, 24/11/2026) ----------
// Mide TODO texto en hebreo: ninguno con letras separadas ni en mayúsculas, ninguno de menos de 12 px.
const sondaHebreo = p => p.evaluate(() => {
  const mal = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n = w.currentNode, tx = n.textContent.trim(); if(!tx || !/[֐-׿]/.test(tx)) continue;
    const el = n.parentElement; if(!el || (!el.offsetParent && getComputedStyle(el).position !== "fixed")) continue;
    const cs = getComputedStyle(el), ls = parseFloat(cs.letterSpacing) || 0, fs = parseFloat(cs.fontSize);
    const quien = (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase()) + " «" + tx.slice(0, 12) + "»";
    if(ls > 0) mal.push(`letras separadas (${ls}px): ${quien}`);
    if(cs.textTransform === "uppercase") mal.push(`mayúsculas: ${quien}`);
    if(fs < 12) mal.push(`${fs}px (en hebreo, nada de menos de 12 px): ${quien}`);
  }
  return mal;
});
export const hebreo = (p, tam, ancho) => {
  const halladas = new Map();
  const ver = async (p, n) => { for(const x of await sondaHebreo(p)) if(!halladas.has(x)) halladas.set(x, n); };
  return {
    paso: ver, ver,
    fin: eq => eq(`hebreo ${ancho}: ningún texto con letras separadas, en mayúsculas ni de menos de 12 px`, [...halladas].slice(0, 8).map(([x, n]) => x + " — " + n), []),
  };
};

// ---------- Los selectores de la app: abrir, ver, elegir y cerrar (7/10/2026) ----------
// Abre CADA selector de cada pantalla y comprueba que se abre con un toque y no lo tapa nada, que la lista
// abierta entra en la pantalla, que el cerrado no se sale, que Escape lo cierra y el foco queda en él, y que en
// los de Mis preferencias elegir otra opción la cierra y se guarda. Esta revisión TOCA cosas: va última en cada parada.
export const selectores = (p, tam) => {
  const vistos = new Set(), problemas = [];
  let probados = 0, guardados = 0;
  async function revisar(p, pantalla){
    // Por su clave y no por una marca: cada elección redibuja la pantalla
    // y los selectores son elementos nuevos.
    const claveDe = "s => s.dataset.pref || s.id || s.className || s.getAttribute('aria-label') || '?'";
    const claves = await p.evaluate(f => { const clave = eval(f); return [...new Set([...document.querySelectorAll("select")]
      .filter(s => s.offsetParent && !s.disabled && s.options.length > 1).map(clave))]; }, claveDe);
    for(const clave of claves){
      if(vistos.has(clave)) continue;
      vistos.add(clave);
      const donde = `${pantalla} › ${clave}`;
      // Marca el primero visible con esa clave, cada vez que hace falta.
      const marcar = () => p.evaluate(([f, c]) => { const clave = eval(f);
        const s = [...document.querySelectorAll("select")].find(s => s.offsetParent && clave(s) === c);
        document.querySelectorAll("[data-prueba-sel]").forEach(x => x.removeAttribute("data-prueba-sel"));
        if(s) s.dataset.pruebaSel = "1"; return !!s; }, [claveDe, clave]);
      const sel = `[data-prueba-sel="1"]`;
      await marcar();
      const antes = await p.evaluate(sel => { const s = document.querySelector(sel); if(!s) return null;
        s.scrollIntoView({ block: "center", behavior: "instant" }); const r = s.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
        return { x, y, tapado: !(e === s || s.contains(e)), por: e ? (String(e.className || "") || e.tagName) : `nada en ${Math.round(x)},${Math.round(y)} (pantalla ${innerWidth}x${innerHeight})`, fuera: r.left < -1 || r.right > innerWidth + 1, valor: s.value }; }, sel);
      if(!antes){ problemas.push(`${donde}: desapareció`); continue; }
      if(antes.fuera) problemas.push(`${donde}: cerrado, se sale de la pantalla`);
      if(antes.tapado){ problemas.push(`${donde}: lo tapa ${antes.por}`); continue; }
      await p.mouse.click(antes.x, antes.y);
      await p.waitForTimeout(200);
      // Las listas largas de Gastos (select.gx-elige, 17/11/2026), en la compu, se abren en la ventanita con buscador
      // de la app (en una pantalla táctil, la del teléfono, como las demás): lo mismo se pide de ella (que se abra
      // entera en la pantalla, con la elegida a la vista, y que Escape la cierre y deje el foco en el selector).
      if(await p.evaluate(sel => !!document.querySelector(sel)?.classList.contains("gx-elige") && !matchMedia("(pointer: coarse)").matches, sel)){
        const pop = await p.evaluate(() => { const el = document.getElementById("selPop"); if(!el || !el.matches(":popover-open")) return null;
          const b = el.getBoundingClientRect(), o = el.querySelector(".rp-op.actual") || el.querySelector(".rp-op"), r = o.getBoundingClientRect();
          const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { dentro: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, visible: e === o || o.contains(e) }; });
        probados++;
        if(!pop){ problemas.push(`${donde}: no se abrió`); continue; }
        if(!pop.dentro) problemas.push(`${donde}: la lista abierta no entra en la pantalla`);
        if(!pop.visible) problemas.push(`${donde}: la opción elegida queda tapada`);
        await p.keyboard.press("Escape");
        await p.waitForTimeout(150);
        const cerrado = await p.evaluate(sel => ({ open: document.getElementById("selPop").matches(":popover-open"), foco: document.activeElement === document.querySelector(sel) }), sel);
        if(cerrado.open) problemas.push(`${donde}: Escape no la cerró`);
        if(!cerrado.foco) problemas.push(`${donde}: al cerrar, el foco no quedó en el selector`);
        continue;
      }
      const abierto = await p.evaluate(sel => { const s = document.querySelector(sel); if(!s) return null;
        const o = s.selectedOptions[0] || s.options[0], r = o.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { open: s.matches(":open"), dentro: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height > 0,
                 visible: e === o || o.contains(e) }; }, sel);
      probados++;
      if(!abierto || !abierto.open){ problemas.push(`${donde}: no se abrió`); continue; }
      if(!abierto.dentro) problemas.push(`${donde}: la lista abierta no entra en la pantalla`);
      if(!abierto.visible) problemas.push(`${donde}: la opción elegida queda tapada`);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(150);
      const cerrado = await p.evaluate(sel => { const s = document.querySelector(sel); return s ? { open: s.matches(":open"), foco: document.activeElement === s } : null; }, sel);
      if(cerrado && cerrado.open) problemas.push(`${donde}: Escape no la cerró`);
      if(cerrado && !cerrado.foco) problemas.push(`${donde}: al cerrar, el foco no quedó en el selector`);
      // Mis preferencias: elegir otra opción la cierra y se guarda.
      if(await p.evaluate(sel => !!document.querySelector(sel)?.dataset.pref, sel)){
        await marcar();
        const otra = await p.evaluate(sel => { const s = document.querySelector(sel); s.scrollIntoView({ block: "center", behavior: "instant" }); const r = s.getBoundingClientRect();
          return { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 }; }, sel);
        await p.mouse.click(otra.x, otra.y);
        await p.waitForTimeout(200);
        const elegida = await p.evaluate(sel => { const s = document.querySelector(sel); const o = [...s.options].find(o => !o.selected && !o.disabled);
          const r = o.getBoundingClientRect(); return { valor: o.value, x: r.left + r.width / 2, y: r.top + r.height / 2, pref: s.dataset.pref }; }, sel);
        await p.mouse.click(elegida.x, elegida.y);
        await p.waitForTimeout(300);
        const guardado = await p.evaluate(([pref, valor]) => {
          const f = (window.__sb.tablas.user_prefs || []).find(x => x.email === "benny@team-latam.com");
          const s = document.querySelector(`select[data-pref="${pref}"]`);
          return { abierto: !!s && s.matches(":open"), guardado: !!f && String(f.prefs[pref]) === String(valor) }; }, [elegida.pref, elegida.valor]);
        if(guardado.abierto) problemas.push(`${donde}: al elegir, no se cerró`);
        if(!guardado.guardado) problemas.push(`${donde}: lo elegido no se guardó`);
        else guardados++;
      }
    }
  }
  return {
    paso: revisar, revisar, vistos,
    // Lo que el recorrido no abre: las tres secciones de Mis preferencias, el calendario chiquito de una fecha, el
    // rol de una persona (su ficha en Administración) y editar un evento. Se vuelve primero a Mis preferencias:
    // el recorrido termina en Gastos y desde ahí esos botones no existen.
    extras: async p => {
      await click(p, '[data-action="toggle-user-menu"]');
      await p.evaluate(() => { const b = document.querySelector('.user-menu [data-view="configuracion"]'); b && b.click(); }); await p.waitForTimeout(400);
      for(const k of ["calendario", "notificaciones", "capas"]){
        await p.evaluate(k => { const b = document.querySelector(`[data-action="config-section"][data-key="${k}"]`); b && b.click(); }, k);
        await p.waitForTimeout(300); await revisar(p, "Mis preferencias " + k);
      }
      await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(400);
      if(await click(p, '.date-trigger[data-action="date-open"]')){ await p.waitForTimeout(250); await revisar(p, "Calendario de una fecha"); }
      await cerrar(p); await cerrar(p);

      // El rol de una persona del equipo (Administración → Personas → su ficha).
      await click(p, '[data-action="toggle-user-menu"]');
      await p.evaluate(() => { const b = document.querySelector('.user-menu [data-action="goto-view"][data-view="admin"]'); b && b.click(); });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('[data-action="admin-go"][data-view="solicitudes"]'); b && b.click(); });
      await p.waitForTimeout(300);
      await p.evaluate(() => { const b = document.querySelector('.lp-row[data-action="usuario-abrir"][data-email="ana@team-latam.com"]'); b && b.click(); });
      await p.waitForTimeout(300); await revisar(p, "Ficha de Ana");
      await cerrar(p);

      // Editar un evento ya no dice «Editás como … (el posteo original sigue
      // figurando de …)»: el usuario lo pidió sacar el 7/10/2026.
      await p.evaluate(() => { const b = document.querySelector('.tabs [data-view="feed"], .bn-item[data-view="feed"]'); b && b.click(); });
      await p.waitForTimeout(300);
      await click(p, '.post[data-post-id="p1"] [data-action="toggle-post-menu"]');
      await click(p, '.post[data-post-id="p1"] .post-menu [data-action="edit-post"], .post-menu [data-action="edit-post"]');
      await p.waitForTimeout(400);
      return p.evaluate(() => { const f = document.getElementById("postForm"); return !!f && f.textContent.length > 0 && !/Editás como|sigue figurando/.test(f.textContent); });
    },
    fin: (eq, sinEditas) => {
      eq(`${tam}: el navegador de las pruebas dibuja la lista con la cara de la app`, sinEditas.base, true);
      eq(`${tam}: editar un evento no muestra «Editás como…»`, sinEditas.editar, true);
      eq(`${tam}: se probaron los selectores de toda la app`, probados >= 12, true);
      eq(`${tam}: también el rol de una persona`, vistos.has("role-select lp-sel"), true);
      eq(`${tam}: los de Mis preferencias guardan lo elegido`, guardados >= 5, true);
      eq(`${tam}: ningún problema al abrir, ver, elegir y cerrar`, problemas, []);
      console.log(`  (${tam}: ${probados} selectores probados, ${guardados} guardados: ${[...vistos].join(", ")})`);
    },
  };
};

// ---------- En oscuro, lo elegido se distingue de lo no elegido (docs/AUDITORIA.md, H5; decisión D29, 24/11/2026) ----------
// En cada grupo de botones (aria-pressed / aria-checked / aria-selected) el elegido tiene que verse distinto del que no: su relleno o su
// borde, contra el del no elegido, a 3 a 1 como mínimo (WCAG 1.4.11). Antes del 24/11/2026 el petróleo del elegido casi no se distinguía del fondo
// de la tarjeta en oscuro (de 1,4 a 2,1 a 1). Un grupo nuevo que no lo cumpla hace fallar esto: se arregla en el CSS del modo oscuro (el bloque
// «Modo oscuro: lo elegido…» de index.html) o, si el elegido se marca de otra manera, se anota acá con el motivo.
const EXCEPCIONES_DE_SELECCION = {
  "toggle-like": "«Me gusta»: el corazón cambia de dibujo (vacío / lleno) y la cuenta, no el relleno",
  "fp-cat": "la lista de categorías del panel de filtros: la elegida se marca con la tarjeta y una sombra, como una fila de lista",
  "cal-ir-anio": "los años de «Ir a una fecha»: el elegido lleva un anillo celeste hacia adentro (box-shadow inset) y fondo propio",
  "gastos-lista-vista": "el selector de vista de la lista de Gastos: la fila elegida se marca con la tarjeta clara sobre un riel",
};
const luminancia = c => { const m = String(c).match(/[\d.]+/g).map(Number); if(m.length > 3 && m[3] === 0) return null;
  const [r, g, b2] = m.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b2; };
const contraste = (a, b2) => { const x = luminancia(a), y = luminancia(b2); return x === null || y === null ? null : (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const seleccion = (p, tam) => {
  const grupos = new Map();
  return {
    paso: async (p, pantalla) => {
      const r = await p.evaluate(() => { const out = [];
        for(const e of document.querySelectorAll('[aria-pressed], [role=radio][aria-checked], [role=tab][aria-selected]')){
          if(!e.offsetParent || e.closest("select")) continue;
          const on = e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-checked") === "true" || e.getAttribute("aria-selected") === "true";
          const c = getComputedStyle(e);
          // Un botón sin relleno (transparente) se ve con el fondo de lo que tiene detrás: el del primer ancestro que tenga.
          let f = e, fondo = c.backgroundColor; while(/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(fondo) && f.parentElement){ f = f.parentElement; fondo = getComputedStyle(f).backgroundColor; }
          out.push({ g: (e.dataset.action || String(e.className).split(" ")[0] || e.tagName) + " (" + (e.parentElement ? String(e.parentElement.className).split(" ")[0] : "") + ")", k: e.dataset.action || "", on, bg: fondo, bo: c.borderTopColor });
        } return out; });
      for(const x of r){ const g = grupos.get(x.g) || { pantalla, k: x.k }; const lado = x.on ? "on" : "off"; if(!g[lado]) g[lado] = x; grupos.set(x.g, g); }
    },
    fin: eq => {
      const flojos = [];
      for(const [k, g] of grupos){
        if(!g.on || !g.off || EXCEPCIONES_DE_SELECCION[g.k]) continue;
        const fondo = contraste(g.on.bg, g.off.bg), borde = contraste(g.on.bo, g.off.bo);
        if((fondo === null || fondo < 3) && (borde === null || borde < 3)) flojos.push(`${k} — relleno ${fondo === null ? "sin" : fondo.toFixed(2)}, borde ${borde === null ? "sin" : borde.toFixed(2)} (${g.pantalla})`);
      }
      eq(`${tam}: en oscuro, lo elegido se distingue de lo no elegido en cada grupo de botones (relleno o borde, 3 a 1)`, flojos, []);
      eq(`${tam}: se midieron grupos de botones elegido/no elegido (más de 12)`, [...grupos.values()].filter(g => g.on && g.off).length > 12, true);
    },
  };
};

// ---------- Lo que el mouse toca, el teclado lo alcanza (24/11/2026, docs/AUDITORIA.md, H10) ----------
// Un elemento con data-action (o un rol de botón, enlace, solapa…) que no es un botón, un enlace ni un campo y no tiene tabindex solo se puede usar con el mouse.
// La auditoría del 24/11 los buscó en toda la app: quedaron tres comportamientos de mouse con su equivalente de teclado, anotados acá con el porqué. Un control nuevo
// de ese tipo hace fallar esto: se hace un <button> (lo normal), o se anota acá con cómo lo hace el teclado.
const SOLO_MOUSE_CONOCIDO = {
  "cal-new": "tocar un hueco del calendario para crear un evento ahí es un atajo del mouse; con el teclado se crea desde el «+» y se escribe la fecha",
  "fp-cerrar": "el velo oscuro del panel de filtros (tocar afuera lo cierra); con el teclado están el botón de cerrar y Escape",
};
export const alcanzable = (p, tam) => {
  const solo = new Map();
  return {
    paso: async (p, pantalla) => {
      const r = await p.evaluate(() => { const out = [];
        const foco = e => e.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable=""], [contenteditable="true"]');
        for(const e of document.querySelectorAll('[data-action], [role=button], [role=link], [role=tab], [role=menuitem], [role=option], [onclick]')){
          if(!e.offsetParent && getComputedStyle(e).position !== "fixed") continue;
          if(e.closest("[inert], [aria-hidden=true]") || foco(e)) continue;
          if(e.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')) continue;   // el contenedor de un control que sí se alcanza
          const r = e.getBoundingClientRect(); if(r.width < 2 || r.height < 2) continue;
          out.push({ accion: e.dataset.action || e.getAttribute("role") || "onclick", quien: e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/)[0] : "") });
        } return out; });
      for(const x of r){ const k = x.accion + " <" + x.quien + ">"; if(!solo.has(k)) solo.set(k, { pantalla, accion: x.accion }); }
    },
    fin: eq => eq(`${tam}: todo lo que el mouse toca, el teclado lo alcanza (salvo lo anotado con su porqué)`,
      [...solo].filter(([, v]) => !SOLO_MOUSE_CONOCIDO[v.accion]).map(([k, v]) => `${k} — ${v.pantalla}`), []),
  };
};

// ---------- Todo el menú de Administración tiene su parada (24/11/2026) ----------
// La regla «una pantalla nueva se suma a recorrerApp» (README de las pruebas) no se cumplió con Brújula el 23/11: ningún recorrido la visitaba y nadie lo notó hasta
// el 24/11 (docs/AUDITORIA.md, H9). Acá se compara el menú de Administración con las paradas: cada sección del menú tiene que tener la suya («Admin <clave>»).
export const cobertura = (p, tam) => {
  const vistas = new Set();
  return {
    paso: async (p, n) => { vistas.add(n); },
    fin: async eq => {
      await p.evaluate(() => { const b = document.querySelector('[data-action="toggle-user-menu"]'); b && b.click(); });
      await p.evaluate(() => { const b = document.querySelector('.user-menu [data-action="goto-view"][data-view="admin"]'); b && b.click(); });
      await p.waitForTimeout(400);
      const menu = await p.$$eval('.admin-menu [data-action="admin-go"]', l => l.map(e => ({ nombre: e.dataset.key || e.dataset.view, view: e.dataset.view })));
      eq(`${tam}: el menú de Administración tiene secciones (la prueba mira algo)`, menu.length >= 10, true);
      eq(`${tam}: cada sección del menú de Administración tiene su parada en el recorrido`, menu.filter(m => !vistas.has("Admin " + m.nombre)).map(m => m.nombre), []);
    },
  };
};

// ---------- El recorrido ----------
// cfg: { nombre, vp, lang, dark, revisiones: [nombre de revisión...], despues?(p, r) }.
// Las revisiones corren en cada parada en este orden: las que solo miran, después recortes (que pasa
// el foco por cada control) y al final selectores (que abre y elige). `despues(p, r)` es lo que una
// configuración hace a mano al terminar el recorrido (Año del celular, secciones de hebreo, etc.).
const ORDEN = ["cobertura", "alcanzable", "arbol", "letra", "hebreo", "seleccion", "recortes", "selectores"];
const FABRICAS = { cobertura, alcanzable, arbol, letra, hebreo, seleccion, recortes, selectores };
export async function barrer(b, cfg, eq){
  const { nombre, vp, lang = "", dark = false, ancha = false, revisiones, despues } = cfg;
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang, dark });
  // «ancha»: con una letra más ancha que la de este sandbox (la de GitHub y la de un celular de verdad es otra: Inter, más ancha). Lo que entra justo acá y
  // no entra allá se ve así (RECURRENTES: «Lo que entra justo acá y en GitHub no»; el 24/11/2026 las solapas de Administración › Problemas, en 320 px).
  if(ancha) await p.addStyleTag({ content: `*{ font-family:"DejaVu Sans", Verdana, monospace !important; }` });
  const r = {};
  for(const k of ORDEN) if(revisiones.includes(k)) r[k] = await FABRICAS[k](p, nombre, vp.width);
  let baseSelect = true;
  if(r.selectores) baseSelect = await p.evaluate(() => CSS.supports("appearance", "base-select"));
  await recorrerApp(p, async (p, n) => { for(const k of ORDEN) if(r[k]) await r[k].paso(p, n); });
  if(despues) await despues(p, r, eq);
  let editar = true;
  if(r.selectores) editar = await r.selectores.extras(p);
  for(const k of ORDEN) if(r[k]) k === "selectores" ? r[k].fin(eq, { base: baseSelect, editar }) : await r[k].fin(eq);
  eq(`${nombre}: sin un solo error en la página`, errores, []);
  await p.close();
}
