/* ======================================================================
   Barrido de pantallas en la compu (24/11/2026)

   Un solo recorrido de la app (compu, 1280x800) en el que corren a la vez las revisiones
   que antes eran cinco pruebas: nada se corta (recortes), todo control tiene nombre para
   el lector de pantalla (árbol de accesibilidad), la letra no baja de su piso, y cada
   selector se abre, se ve y se cierra bien. Más lo de hebreo en la compu (los rótulos
   chicos se leen, docs/AUDITORIA.md V4) y lo de la letra que se lee del CSS. Cómo y por
   qué: barrido.mjs. Con INDEX=/ruta/a/index-roto.html corre contra otra copia (para ver
   que falla).

   Eran: recortes_test, selectores_test, arbol_accesibilidad_test, letra_minima_test y
   hebreo_titulos_test (esta última, en parte: lo del celular está en barrido_celular_test).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN, irAdmin, admin } from "./app_de_mentira.mjs";
import { barrer } from "./barrido.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };

// ---------- La letra, en el CSS ----------
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// Números y letras sueltas dentro de un círculo, una celda o una barra.
const MICRO = new Set([".year-dows span", ".ymd", ".cal-mdot-more", ".avatar-pending", ".pending-count", ".cal-gutter"]);
// Un número de dos cifras dentro de una barra de 10 px de ancho (Reportes › Mes a mes, en 360 px): 10 px es lo que entra con una letra ancha.
const DENTRO_DE_BARRA = new Set([".rep-plan-n"]);
// Dibujos hechos con letra: no se leen como texto.
const GLIFOS = new Set([".filter-dropdown-chevron", ".occ-chip .occ-chev", ".mention-avatar.mention-avatar-fallback", ".fl-doc i"]);

// Cada regla de pantalla con su selector, su cuerpo y si va en @media print / @page.
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const reglas = [];
{ const pila = []; let ultimo = 0;
  for(const m of css.matchAll(/[{}]/g)){
    if(m[0] === "{"){ pila.push(css.slice(ultimo, m.index).split("}").pop().replace(/\/\*[\s\S]*?\*\//g, "").trim()); ultimo = m.index + 1; }   // sin los comentarios que van antes de la regla
    else { const cuerpo = css.slice(ultimo, m.index), sel = pila[pila.length - 1];
      reglas.push({ sel, cuerpo, impresa: pila.slice(0, -1).some(c => c.startsWith("@media print") || c.startsWith("@page")) || /print/i.test(sel) || sel.startsWith("@") });
      pila.pop(); ultimo = m.index + 1; } } }

const bajos = [];
for(const r of reglas){
  if(r.impresa) continue;
  const selectores = r.sel.split(",").map(x => x.trim());
  if(selectores.every(x => GLIFOS.has(x))) continue;
  const micro = /text-transform\s*:\s*uppercase/.test(r.cuerpo) || /border-radius\s*:\s*(999px|50%)/.test(r.cuerpo) || selectores.some(x => MICRO.has(x));
  for(const m of r.cuerpo.matchAll(/font-size\s*:\s*([0-9.]+)px/g)){
    const px = Number(m[1]), piso = selectores.some(x => DENTRO_DE_BARRA.has(x)) ? 10 : micro ? 11 : 12;
    if(px < piso) bajos.push(`${r.sel.split("\n").pop().trim().slice(0, 50)} {${px}px, piso ${piso}}`);
  }
}
ok("ninguna regla de CSS baja de su piso (texto 12 px, etiquetas y píldoras 11 px)", bajos.length === 0, `${bajos.length} reglas, por ejemplo: ${bajos.slice(0, 6).join(" || ")}`);


const b = await abrirNavegador();

// ---------- La compu, en español ----------
await barrer(b, { nombre: "compu", vp: { width: 1280, height: 800 }, revisiones: ["arbol", "letra", "recortes", "selectores"],
  // En español no cambia nada con lo de hebreo: ahí los rótulos siguen en mayúsculas, chicos y con las letras separadas, como se pensaron.
  despues: async p => {
    await irAdmin(p);
    const m = await p.evaluate(() => { const g = document.querySelector(".admin-menu .admin-grupo"), cs = getComputedStyle(g); return { may: cs.textTransform, ls: parseFloat(cs.letterSpacing) > 0, fs: parseFloat(cs.fontSize), peso: Number(cs.fontWeight) }; });
    eq("en español el rótulo de grupo sigue como se pensó (mayúsculas, letras separadas, 11 px, negrita fuerte)", m, { may: "uppercase", ls: true, fs: 11, peso: 800 });
  } }, eq);

// ---------- La compu, en hebreo ----------
await barrer(b, { nombre: "compu he", vp: { width: 1360, height: 900 }, lang: "he", revisiones: ["hebreo"],
  despues: async (p, r) => {
    await irAdmin(p);
    for(const [v, k] of [["resumen"], ["personas"], ["preferencias", "brujula"], ["preferencias", "tipos"], ["preferencias", "correos"], ["preferencias", "gastos"]]){ await admin(p, v, k); await p.waitForTimeout(250); await r.hebreo.ver(p, "Administración " + (k || v)); }
    // El menú de Administración, en hebreo: los rótulos de grupo casi del tamaño de los ítems y el título sin negrita fuerte.
    await irAdmin(p);
    const m = await p.evaluate(() => { const g = document.querySelector(".admin-menu .admin-grupo"), i = document.querySelector(".admin-menu .admin-item"), t = document.querySelector(".admin-titulo");
      const c = (e, k) => parseFloat(getComputedStyle(e)[k]);
      return { grupo: c(g, "fontSize"), item: c(i, "fontSize"), pesoGrupo: Number(getComputedStyle(g).fontWeight), pesoTitulo: Number(getComputedStyle(t).fontWeight), may: getComputedStyle(g).textTransform, ls: c(g, "letterSpacing") || 0 }; });
    eq("menú de Administración en hebreo: el rótulo de grupo mide 13 px o más (y no más que el ítem)", [m.grupo >= 13, m.grupo <= m.item], [true, true]);
    eq("menú de Administración en hebreo: rótulo y título en negrita común, sin mayúsculas ni letras separadas", [m.pesoGrupo <= 700, m.pesoTitulo <= 700, m.may, m.ls], [true, true, "none", 0]);
  } }, eq);

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
