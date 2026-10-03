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

const bloques = await p.$$eval(".rep-bloque h3", els => els.map(e=>e.textContent.trim()));
eq("los seis bloques", bloques,
   ["Mes a mes","Por zona","Por país","Por tipo","Quién cargó","Quién participó"]);

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
  .filter(e => !/^\d+$/.test(e.textContent.trim())).length);
eq("todos los números son números", vacias, 0);

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
const sigueElSelector = await p.$$eval(".rep-chips button", els => els.length > 0);
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

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
