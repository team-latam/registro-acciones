/* ======================================================================
   «Buscar en todo» en el celular (crítica de diseño del 28/10/2026)

   Con 900 px o menos el buscador general se escondía y no había otro
   lugar: en el teléfono no se podía buscar personas, lugares, proyectos ni
   instituciones desde cualquier pestaña. Ahora la barra de arriba tiene un
   botón 🔍; al tocarlo, el campo ocupa esa barra (sin cambiarle el alto),
   el teclado se abre solo y los resultados bajan de borde a borde.

   - En la compu no cambia: el campo sigue a la vista y no hay botón.
   - Abre con el foco en el campo, busca, y los resultados entran en la
     pantalla (también en hebreo y a 320 px), sin correr la página.
   - Escape y la ✕ cierran, vacían el campo y devuelven el foco al 🔍.
   - Elegir un resultado cierra la barra; tocar afuera con el campo vacío,
     también.
   - Sin acceso (cuenta esperando aprobación) no hay botón.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };

const estado = p => p.evaluate(() => {
  const vis = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && getComputedStyle(e).visibility !== "hidden"); };
  const r = id => { const e = document.getElementById(id); if(!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
  return {
    boton: vis("globalSearchToggle"), campo: vis("globalSearchInput"), botonR: r("globalSearchToggle"),
    foco: document.activeElement && document.activeElement.id, valor: document.getElementById("globalSearchInput").value,
    buscando: document.querySelector(".topbar-inner").classList.contains("buscando"),
    panelVisible: !document.getElementById("globalResults").hidden, panelR: r("globalResults"),
    resultados: document.querySelectorAll("#globalResults .gs-item").length,
    expandido: (document.getElementById("globalSearchToggle") || document.body).getAttribute("aria-expanded"),
    altoBarra: Math.round(document.querySelector("header.topbar").getBoundingClientRect().height),
    ancho: document.documentElement.scrollWidth, ventana: innerWidth,
  };
});
const abrir = async p => { await p.evaluate(() => { const b = document.getElementById("globalSearchToggle"); if(b) b.click(); }); await p.waitForTimeout(250); };
const escribir = async (p, q) => { await p.keyboard.type(q); await p.waitForTimeout(450); };

const b = await abrirNavegador();

// La compu: el campo a la vista y sin botón.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  const e = await estado(p);
  ok("compu: el campo «Buscar en todo» está a la vista", e.campo, JSON.stringify(e));
  ok("compu: no hay botón 🔍", !e.boton, JSON.stringify(e));
  await p.close();
}

// Sin acceso: ni campo ni botón.
{
  const { p } = await entrar(b, "nuevo@x.com", "Nuevo Usuario", { viewport: { width: 390, height: 844 } });
  const e = await estado(p);
  ok("celular, cuenta esperando aprobación: no hay botón 🔍", !e.boton, JSON.stringify(e));
  await p.close();
}

// Tableta: también hay botón.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 768, height: 900 } });
  const e = await estado(p);
  ok("tableta (768 px): hay botón 🔍 y el campo no está a la vista", e.boton && !e.campo, JSON.stringify(e));
  await p.close();
}

for(const [lang, vw, vh, q] of [["", 390, 844, "Ros"], ["", 320, 640, "Ros"], ["en", 390, 844, "Ros"], ["pt", 390, 844, "Ros"], ["he", 390, 844, "Rosario"]]){
  const donde = `celular ${vw} px, ${lang || "es"}`;
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: vw, height: vh }, lang });
  const cerrado = await estado(p);
  ok(`${donde}: hay botón 🔍 de 36 px o más y el campo no está a la vista`, cerrado.boton && !cerrado.campo && cerrado.botonR.w >= 36 && cerrado.botonR.h >= 36, JSON.stringify(cerrado));
  eq(`${donde}: el botón anuncia que está cerrado (aria-expanded)`, cerrado.expandido, "false");
  const nombre = await p.evaluate(() => { const e = document.getElementById("globalSearchToggle"); return e ? e.getAttribute("aria-label") || "" : ""; });
  ok(`${donde}: el botón tiene nombre para el lector de pantalla`, nombre.length > 3, JSON.stringify(nombre));

  await abrir(p);
  let e = await estado(p);
  ok(`${donde}: al tocarlo, el campo aparece y tiene el foco`, e.campo && e.foco === "globalSearchInput" && e.buscando, JSON.stringify(e));
  eq(`${donde}: al abrir, el botón anuncia aria-expanded=true`, e.expandido, "true");
  eq(`${donde}: abrir la búsqueda no cambia el alto de la barra`, e.altoBarra, cerrado.altoBarra);
  ok(`${donde}: hay una ✕ para cerrar`, await p.evaluate(() => { const c = document.querySelector(".gs-cerrar"); return !!c && c.offsetParent !== null && c.getBoundingClientRect().width >= 36 && !!c.getAttribute("aria-label"); }));

  await escribir(p, q);
  e = await estado(p);
  ok(`${donde}: escribir muestra resultados`, e.panelVisible && e.resultados >= 1, JSON.stringify(e));
  ok(`${donde}: el panel entra en la pantalla`, e.panelR && e.panelR.l >= 0 && e.panelR.r <= e.ventana, JSON.stringify(e.panelR));
  ok(`${donde}: la página no se corre de costado`, e.ancho <= e.ventana, `${e.ancho} > ${e.ventana}`);
  eq(`${donde}: sin errores de la página`, errores, []);

  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  e = await estado(p);
  ok(`${donde}: Escape cierra el panel y la barra, vacía el campo y devuelve el foco al 🔍`, !e.buscando && !e.panelVisible && e.valor === "" && e.foco === "globalSearchToggle", JSON.stringify(e));

  await abrir(p);
  await p.evaluate(() => { const c = document.querySelector(".gs-cerrar"); if(c) c.click(); }); await p.waitForTimeout(200);
  e = await estado(p);
  ok(`${donde}: la ✕ cierra y devuelve el foco al 🔍`, !e.buscando && e.foco === "globalSearchToggle" && e.expandido === "false", JSON.stringify(e));
  await p.close();
}

// Elegir un resultado, y tocar afuera.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await abrir(p); await escribir(p, "Rosario");
  await p.evaluate(() => { const r = document.querySelector('#globalResults .gs-item[data-action="gs-city"], #globalResults .gs-item[data-action="gs-post"]'); if(r) r.click(); });
  await p.waitForTimeout(500);
  let e = await estado(p);
  ok("celular: elegir un resultado cierra la barra, el panel y vacía el campo", !e.buscando && !e.panelVisible && e.valor === "", JSON.stringify(e));
  ok("celular: después de elegir, el 🔍 vuelve a estar a la vista", e.boton, JSON.stringify(e));

  await abrir(p);
  await p.mouse.click(195, 600); await p.waitForTimeout(250);
  e = await estado(p);
  ok("celular: tocar afuera con el campo vacío cierra la barra", !e.buscando, JSON.stringify(e));

  await abrir(p); await escribir(p, "Ros");
  await p.mouse.click(195, 750); await p.waitForTimeout(250);
  e = await estado(p);
  ok("celular: tocar afuera con algo escrito cierra el panel pero deja la barra y lo escrito", e.buscando && !e.panelVisible && e.valor === "Ros", JSON.stringify(e));
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
