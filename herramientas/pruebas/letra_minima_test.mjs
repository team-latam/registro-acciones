/* ======================================================================
   La letra no baja de un piso (crítica de diseño del 28/10/2026)

   El CSS tenía 202 tamaños por debajo de 12 px (8, 8,5, 9, 9,5, 10…): en
   cada pantalla había entre 20 y 60 textos de 11 a 11,5 px, y la Vista Año
   del celular llegaba a 9 y 8,5. Desde la tanda 103 hay dos pisos:

   - el texto que se lee (fechas, notas, pistas, listas): 12 px o más;
   - las etiquetas en MAYÚSCULAS, las píldoras y los números dentro de un
     círculo, una celda o una barra: 11 px o más;
   - la excepción: los dibujos hechos con letra (la flechita de un menú, la
     inicial de un avatar), que no se leen como texto.
   Lo impreso (@media print, @page) tiene sus propias medidas.

   Esta prueba lee el CSS entero y falla si una regla nueva baja de su piso,
   y mide el texto de verdad en las pantallas de la app (compu y celular).
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN, recorrerApp } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// Números y letras sueltas dentro de un círculo, una celda o una barra.
const MICRO = new Set([".year-dows span", ".ymd", ".rep-plan-n", ".cal-mdot-more", ".avatar-pending", ".pending-count", ".cal-gutter"]);
// Dibujos hechos con letra: no se leen como texto.
const GLIFOS = new Set([".filter-dropdown-chevron", ".occ-chip .occ-chev", ".mention-avatar.mention-avatar-fallback", ".fl-doc i"]);

// Cada regla de pantalla con su selector, su cuerpo y si va en @media print / @page.
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const reglas = [];
{ const pila = []; let ultimo = 0;
  for(const m of css.matchAll(/[{}]/g)){
    if(m[0] === "{"){ pila.push(css.slice(ultimo, m.index).split("}").pop().trim()); ultimo = m.index + 1; }
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
    const px = Number(m[1]), piso = micro ? 11 : 12;
    if(px < piso) bajos.push(`${r.sel.split("\n").pop().trim().slice(0, 50)} {${px}px, piso ${piso}}`);
  }
}
ok("ninguna regla de CSS baja de su piso (texto 12 px, etiquetas y píldoras 11 px)", bajos.length === 0, `${bajos.length} reglas, por ejemplo: ${bajos.slice(0, 6).join(" || ")}`);

// El texto de verdad, en las pantallas.
const chicos = p => p.evaluate(() => {
  const res = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n = w.currentNode; if(!n.textContent.trim()) continue;
    const el = n.parentElement; if(!el || (!el.offsetParent && getComputedStyle(el).position !== "fixed")) continue;
    const r = el.getBoundingClientRect(); if(r.width < 2 || r.height < 2) continue;
    if(el.closest(".solo-lector, .skip-link, .occ-chev, .filter-dropdown-chevron, .mention-avatar-fallback, .fl-doc i")) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if(fs < 11) res.push(`${fs}px .${String(el.className || el.tagName).slice(0, 28)} «${n.textContent.trim().slice(0, 18)}»`);
  }
  return res;
});

const b = await abrirNavegador();
for(const [vw, vh] of [[1440, 900], [390, 844]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: vw, height: vh } });
  const hallados = new Map();
  await recorrerApp(p, async (p, nombre) => { for(const x of await chicos(p)) if(!hallados.has(x)) hallados.set(x, nombre); });
  ok(`${vw} px: ningún texto de las pantallas mide menos de 11 px`, hallados.size === 0, `${hallados.size}: ` + [...hallados].slice(0, 6).map(([x, v]) => `${x} (${v})`).join(" || "));
  await p.close();
}
// La Vista Año del celular: números y días legibles.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.evaluate(() => document.querySelector('.bn-item[data-view="calendario"]').click()); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-action="toggle-cal-view"]').click());
  await p.evaluate(() => document.querySelector('[data-action="cal-subview"][data-key="anio"]').click()); await p.waitForTimeout(600);
  const a = await p.evaluate(() => { const d = document.querySelector(".ymd[data-action]"), w = document.querySelector(".year-dows span"), r = d.getBoundingClientRect();
    return { dia: parseFloat(getComputedStyle(d).fontSize), semana: parseFloat(getComputedStyle(w).fontSize), ancho: Math.round(r.width * 10) / 10, columnas: getComputedStyle(document.querySelector(".cal-year")).gridTemplateColumns.split(" ").length, sobra: document.documentElement.scrollWidth > innerWidth }; });
  ok("celular, Año: los números de cada día miden 11 px o más", a.dia >= 11, JSON.stringify(a));
  ok("celular, Año: las letras de los días de la semana miden 11 px o más", a.semana >= 11, JSON.stringify(a));
  ok("celular, Año: cada día mide 23 px o más de ancho", a.ancho >= 23, JSON.stringify(a));
  ok("celular, Año: siguen siendo dos meses por fila (decisión anterior)", a.columnas === 2, JSON.stringify(a));
  ok("celular, Año: la página no se corre de costado", !a.sobra, JSON.stringify(a));
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
