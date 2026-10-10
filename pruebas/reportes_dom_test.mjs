import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await chromium.launch();
const p = await b.newPage();
const errores = [];
p.on("pageerror", e => errores.push(String(e)));
p.on("console", m => { if(m.type()==="error") errores.push(m.text()); });
await p.goto("file://" + process.cwd() + "/reportes.html");
await p.waitForTimeout(400);

eq("la pantalla se dibuja sin un solo error", errores, []);

const bloques = await p.$$eval(".rep-grilla > .rep-bloque h3", els => els.map(e=>e.textContent.trim()));
eq("los cuatro bloques de «Cuándo y dónde»", bloques,
   ["Mes a mes","Por zona","Por país","Por tipo"]);

const total = await p.$eval(".rep-total-num", e => Number(e.textContent));
eq("el total es un número mayor que cero", total > 0, true);

// El bloque "Mes a mes" de un año entero tiene que traer los 12 meses,
// incluidos los vacíos.
const mesesN = await p.$$eval(".rep-bloque", els => {
  const bloque = els.find(e => e.querySelector("h3").textContent.trim() === "Mes a mes");
  return bloque.querySelectorAll(".rep-fila").length;
});
eq("un año entero muestra los 12 meses, aunque alguno esté en cero", mesesN, 12);

// Los números de cada bloque tienen que ser legibles y las barras, no
// pasarse del riel.
const desbordes = await p.evaluate(()=> [...document.querySelectorAll(".rep-barra")]
  .filter(b => b.getBoundingClientRect().width > b.parentElement.getBoundingClientRect().width + 1).length);
eq("ninguna barra se sale de su riel", desbordes, 0);

const vacias = await p.evaluate(()=> [...document.querySelectorAll(".rep-num")]
  .filter(e => { const x = e.textContent.trim(); return !x || !/^(\d+)?(\+\d+)?$/.test(x); }).length);
// Un mes con algo planificado suma «+n» al lado (AUDITORIA I2).
eq("todos los números son números (con «+n» si hay algo planificado)", vacias, 0);

// Cambiar de período tiene que cambiar el total.
const totalAnio = total;
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:1 }));
await p.waitForTimeout(150);
const totalT1 = await p.$eval(".rep-total-num", e => Number(e.textContent));
eq("un trimestre trae menos que el año entero", totalT1 < totalAnio, true);
const mesesT1 = await p.$$eval(".rep-bloque", els => {
  const bloque = els.find(e => e.querySelector("h3").textContent.trim() === "Mes a mes");
  return [...bloque.querySelectorAll(".rep-etiqueta")].map(e=>e.textContent.trim());
});
eq("y muestra sus tres meses", mesesT1.length, 3);

// Un período sin nada: el estado vacío, no una pantalla rota.
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2019", trimestre:0 }));
await p.waitForTimeout(150);
const vacio = await p.$(".empty-state");
eq("un período sin nada muestra el cartel de vacío", !!vacio, true);
const sigueElSelector = await p.$$eval(".rep-barra-control select", els => els.length > 0);
eq("y el selector sigue ahí para poder salir de ahí", sigueElSelector, true);

// La comparación con el período anterior.
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0 }));
await p.waitForTimeout(150);
const comp = await p.$(".rep-comparacion");
eq("con datos del año anterior, se compara", !!comp, true);

await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2025", trimestre:0 }));
await p.waitForTimeout(150);
const compSin = await p.$(".rep-comparacion");
eq("sin período anterior con datos, no se inventa un porcentaje", !!compSin, false);

// En un teléfono.
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0 }));
await p.setViewportSize({ width: 380, height: 900 });
await p.waitForTimeout(200);
const desborde = await p.evaluate(()=> document.documentElement.scrollWidth > window.innerWidth + 1);
eq("a 380px no se va de la pantalla", desborde, false);
await p.screenshot({ path:"reportes_angosto.png", fullPage:true });
await p.setViewportSize({ width: 1100, height: 1400 });
await p.waitForTimeout(200);
await p.screenshot({ path:"reportes_ancho.png", fullPage:true });

// La comparación, escrita como se lee.
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0 }));
await p.waitForTimeout(150);
const texto = await p.$eval(".rep-comparacion", e => e.textContent.trim());
eq("no dice 'respecto de el'", /de el |a o /.test(texto), false);
eq("con un año anterior de una sola actividad, la diferencia va en número, no en 14400%",
   /%/.test(texto), false);
eq("y dice contra qué se compara", /año anterior/.test(texto), true);

await p.evaluate(()=> {
  // Dos años parejos: ahí el porcentaje sí significa algo.
  const base = [];
  for(let i=0;i<20;i++) base.push({ id:"a"+i, activityType:"curso", authorEmail:"ana@x.com",
    date:"2025-0"+((i%9)+1)+"-05", startDate:"2025-0"+((i%9)+1)+"-05", endDate:"2025-0"+((i%9)+1)+"-05",
    scopes:[{type:"pais",country:"Perú"}] });
  for(let i=0;i<25;i++) base.push({ id:"b"+i, activityType:"curso", authorEmail:"ana@x.com",
    date:"2026-0"+((i%9)+1)+"-05", startDate:"2026-0"+((i%9)+1)+"-05", endDate:"2026-0"+((i%9)+1)+"-05",
    scopes:[{type:"pais",country:"Perú"}] });
  window.__pintar(base, { anio:"2026", trimestre:0 });
});
await p.waitForTimeout(150);
const texto2 = await p.$eval(".rep-comparacion", e => e.textContent.trim());
eq("de 20 a 25 sí es 25% más", /▲ 25% más/.test(texto2), true);

/* ---------- Todos los años, Comparar y "Ver solo" (5/10/2026) ---------- */
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"todos", trimestre:0, modo:"periodo", filtro:{} }));
await p.waitForTimeout(150);
eq("todos los años: los bloques de la historia", await p.$$eval(".rep-grilla > .rep-bloque h3", els => els.map(e => e.textContent.trim())),
   ["Año por año", "Evolución por país", "Evolución por tipo"]);
eq("y una barra por año con datos (2025 y 2026)", await p.$$eval(".rep-grilla > .rep-bloque:first-child .rep-fila", l => l.length), 2);
eq("la tabla de evolución tiene una columna por año (y la primera dice qué es, para el lector de pantalla)", await p.$eval(".rep-evolucion", tb => [...tb.querySelectorAll("thead th")].map(e => e.textContent)), ["Evolución por país", "2025", "2026"]);
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0, modo:"comparar", compA:"2025", compB:"2026", compTri:0, filtro:{} }));
await p.waitForTimeout(150);
eq("comparar: 2025 contra 2026, con el total de cada uno", await p.$eval(".rep-kpi .rep-kpi-num", e => /^\d+ → \d+$/.test(e.textContent.trim())), true);
eq("y las tablas lado a lado, con la diferencia", await p.$$eval(".rep-tabla thead tr:first-child", l => l[0] && [...l[0].children].map(e => e.textContent)), ["Por tipo", "2025", "2026", "Diferencia"]);
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0, modo:"periodo", filtro:{ pais:"Perú" } }));
await p.waitForTimeout(150);
eq("ver solo un país: la columna por país tiene solo ese", await p.$$eval(".rep-grilla > .rep-bloque:nth-child(3) .rep-etiqueta", l => l.map(e => e.textContent.trim())), ["Perú"]);
eq("el filtro puesto se ve en el título y se saca con su ✕", await p.$eval('.rep-cabeza [data-action="reporte-quitar-filtro"][data-key="pais"]', e => e.textContent.trim()).catch(() => null), "Perú ✕");
eq("y el botón Filtros dice cuántos hay", await p.$eval('[data-action="reporte-filtros"] .rep-cuenta', e => e.textContent).catch(() => null), "1");
await p.evaluate(()=> window.__pintar(window.__datos, { anio:"2026", trimestre:0, modo:"periodo", filtro:{} }));
await p.waitForTimeout(150);
eq("un período trae sugerencias, cobertura y equipo", [!!(await p.$(".rep-sugerencias li")), !!(await p.$(".rep-cobertura li")), !!(await p.$(".rep-equipo tbody tr"))], [true, true, true]);
// Con las personas sin cuenta la tabla del equipo se hacía larguísima
// (7/10/2026): misma altura que la lista de países de al lado, con barra
// y el encabezado pegado arriba.
eq("«Por persona del equipo» mide como «Última actividad por país» y se desplaza adentro, con el encabezado pegado",
   await p.evaluate(() => { const e = getComputedStyle(document.querySelector(".rep-equipo .rep-tabla-envoltorio")), l = getComputedStyle(document.querySelector(".rep-cobertura .rep-lista"));
     return [e.maxHeight === l.maxHeight, e.overflowY, getComputedStyle(document.querySelector(".rep-equipo thead th")).position]; }), [true, "auto", "sticky"]);
await p.setViewportSize({ width: 380, height: 800 });
for(const modo of [{ anio:"todos" }, { modo:"comparar", compA:"2025", compB:"2026" }]){
  await p.evaluate(m => window.__pintar(window.__datos, { anio:"2026", trimestre:0, modo:"periodo", filtro:{}, ...m }), modo);
  await p.waitForTimeout(100);
  eq("a 380px, " + (modo.modo || "todos los años") + " no se va de la pantalla", await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
// Impreso / PDF (5/10/2026): en papel no hay scroll ni "gráficos de fondo".
await p.setViewportSize({ width: 760, height: 1000 });
await p.emulateMedia({ media: "print" });
for(const modo of [{}, { anio:"todos" }, { modo:"comparar", compA:"2025", compB:"2026" }]){
  await p.evaluate(m => window.__pintar(window.__datos, { anio:"2026", trimestre:0, modo:"periodo", filtro:{}, ...m }), modo);
  await p.waitForTimeout(100);
  const impreso = await p.evaluate(() => {
    const cs = s => [...document.querySelectorAll(s)].map(e => getComputedStyle(e));
    return {
      // Chrome por defecto no imprime fondos: sin esto las barras salen en blanco.
      barras: cs(".rep-barra, .rep-col-barra, .rep-evolucion td").every(c => c.printColorAdjust === "exact"),
      sinScroll: cs(".rep-lista, .rep-tabla-envoltorio").every(c => c.maxHeight === "none" && c.overflowX === "visible" && c.overflowY === "visible"),
      sinCortar: [...document.querySelectorAll(".rep-bloque, .rep-tabla")].every(e => e.scrollWidth <= e.clientWidth + 1),
      seccionesSeParten: cs(".rep-seccion").every(c => c.breakInside !== "avoid"),
      nombresEnteros: cs(".rep-fila:not(.rep-col) .rep-etiqueta").every(c => c.textOverflow !== "ellipsis"),
      sinBarra: !document.querySelector(".rep-barra-control") || getComputedStyle(document.querySelector(".rep-barra-control")).display === "none",
    };
  });
  eq("impreso, " + (modo.modo || modo.anio || "un período") + ": barras con color, sin scroll, sin cortes, sin la barra de control", impreso,
     { barras:true, sinScroll:true, sinCortar:true, seccionesSeParten:true, nombresEnteros:true, sinBarra:true });
}
await p.emulateMedia({ media: "screen" });
eq("y en todo el recorrido, sin un solo error", errores, []);

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
