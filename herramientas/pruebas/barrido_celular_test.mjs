/* ======================================================================
   Barrido de pantallas en el celular (24/11/2026)

   Un solo recorrido de un celular común en español (oscuro, como lo recorría selectores_test) con
   las revisiones que antes eran pruebas separadas (barrido.mjs explica cómo y por qué): nada se
   corta, todo control tiene nombre, la letra no baja de su piso, cada selector se abre y se cierra
   bien, y la Vista Año con los números y los días legibles. El celular chico y el hebreo están en
   barrido_variantes_test.mjs (aparte para que corran a la vez).
   Eran: recortes_test, selectores_test, arbol_accesibilidad_test, letra_minima_test y hebreo_titulos_test.
   ====================================================================== */
import { abrirNavegador } from "./app_de_mentira.mjs";
import { barrer } from "./barrido.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };

const b = await abrirNavegador();

await barrer(b, { nombre: "celular", vp: { width: 390, height: 844 }, dark: true, revisiones: ["alcanzable", "arbol", "letra", "seleccion", "recortes", "selectores"],
  // La Vista Año del celular: números y días legibles.
  despues: async p => {
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
  } }, eq);

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
