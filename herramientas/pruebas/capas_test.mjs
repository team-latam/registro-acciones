import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:820, height:900 } });
const errores = [];
page.on("pageerror", e=>errores.push("pageerror: " + e.message));
page.on("console", m=>{ if(m.type()==="error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/capas.html");
if(errores.length) console.log("ERRORES DE CARGA:", errores);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// ---- la solapa se llama Capas ----
eq("las tres solapas", await page.evaluate(()=>window.secciones().map(s=>s.label)),
   ["Calendario","Notificaciones","Capas"]);
eq("la clave también", await page.evaluate(()=>window.secciones()[2].key), "capas");

// ---- tres bloques, con título y en orden ----
// textContent y no innerText: innerText devuelve el texto YA pasado por
// el text-transform del CSS, y lo que se quiere probar acá es el texto
// que escribe el código.
eq("títulos de bloque, en orden",
   await page.locator(".settings-card-title").evaluateAll(e=>e.map(x=>x.textContent.trim())),
   ["◆ Hitos", "🎌 Feriados", "🌎 De qué países"]);
eq("y se dibujan en mayúsculas, como el título de la barra del Calendario",
   await page.locator(".settings-card-title").first().evaluate(e=>getComputedStyle(e).textTransform), "uppercase");
eq("un bloque por título", await page.locator(".settings-card").count(), 3);

// ---- el bloque de Hitos ----
const hitos = page.locator(".settings-card").nth(0);
eq("Hitos tiene 3 filas", await hitos.locator(".setting-row").count(), 3);
eq("el orden: mostrar → filtrar → cómo se marca",
   await hitos.locator(".setting-label").evaluateAll(e=>e.map(x=>x.innerText.trim())),
   ["Mostrarlos en el Calendario", "Esconder los ya cumplidos", "Avisar “Por vencer” con"]);
eq("el interruptor es el mismo de la píldora del Calendario",
   await hitos.locator('input[data-pref="calendarShowMilestones"]').count(), 1);
eq("y viene prendido", await hitos.locator('input[data-pref="calendarShowMilestones"]').isChecked(), true);
eq("esconder cumplidos, apagado de fábrica",
   await hitos.locator('input[data-pref="calendarHideDoneMilestones"]').isChecked(), false);
eq("el select de días guarda número",
   await hitos.locator('select[data-pref="milestoneDueSoonDays"]').getAttribute("data-pref-num"), "1");
eq("con las cinco opciones",
   await hitos.locator('select[data-pref="milestoneDueSoonDays"] option').evaluateAll(e=>e.map(x=>x.value)),
   ["1","3","5","7","15"]);
eq("y 5 elegido", await hitos.locator('select[data-pref="milestoneDueSoonDays"]').inputValue(), "5");
eq("1 día va en singular",
   await hitos.locator('select[data-pref="milestoneDueSoonDays"] option[value="1"]').innerText(), "1 día antes");
eq("avisa que también vale en Proyectos",
   (await hitos.locator(".setting-sub").nth(2).innerText()).includes("Proyectos"), true);

// ---- el bloque de Feriados, con el mismo orden ----
const fer = page.locator(".settings-card").nth(1);
eq("Feriados tiene 4 filas", await fer.locator(".setting-row").count(), 4);
eq("mismo orden: mostrar → qué → cómo se ve",
   await fer.locator(".setting-label").evaluateAll(e=>e.map(x=>x.innerText.trim())),
   ["Cómo mostrarlos", "Sumar las festividades judías",
    "Color de los feriados de país", "Color de las festividades judías"]);
eq("el switch de judías va ANTES de su color (antes estaba al revés)",
   await fer.locator(".setting-row").evaluateAll(rows=>{
     const i = rows.findIndex(r=>r.querySelector('input[data-pref="holidayJewish"]'));
     const j = rows.findIndex(r=>r.querySelector('input[data-pref="holidayJewishColor"]'));
     return i < j;
   }), true);

// ---- el bloque de países ----
const paises = page.locator(".settings-card").nth(2);
eq("los países son chips", await paises.locator('[data-pref-chip="holidayCountries"], .chip-toggle').count() > 0, true);
eq("aclara que las judías no dependen de esto",
   (await paises.innerText()).includes("no dependen de esto"), true);
eq("y que salen de los calendarios de Google",
   (await paises.innerText()).includes("calendarios públicos de Google"), true);

// ---- la explicación de la sección dice qué es una capa ----
// Desde la tanda 14 va en la cabecera de Mis preferencias ("¿Cómo
// funciona?"), que arma renderConfiguracionView con prefsSeccionTextos.
const textos = await page.evaluate(()=>window.textosCapas());
eq("la cabecera dice para qué sirve la sección", textos.lead.length > 10, true);
eq("explica qué es una capa", textos.ayuda.includes("además de los eventos"), true);
eq("y que son opciones personales", textos.ayuda.includes("no cambian lo que ven los demás"), true);

// ---- el número de días cambia de verdad el estado de un hito ----
// Hoy es 2026-09-15. Un hito el 2026-09-22 está a 7 días.
const hito7 = { date:"2026-09-22", done:false };
await page.evaluate(()=>window.setPrefs({ ...window.__p = {}, milestoneDueSoonDays:5 }));
eq("con 5 días, uno a 7 días sigue Pendiente", await page.evaluate(m=>window.estado(m), hito7), "upcoming");
await page.evaluate(()=>window.setPrefs({ milestoneDueSoonDays:7 }));
eq("con 7 días, pasa a Por vencer", await page.evaluate(m=>window.estado(m), hito7), "soon");
await page.evaluate(()=>window.setPrefs({ milestoneDueSoonDays:1 }));
eq("con 1 día, vuelve a Pendiente", await page.evaluate(m=>window.estado(m), hito7), "upcoming");
eq("y uno de mañana sí es Por vencer", await page.evaluate(()=>window.estado({ date:"2026-09-16", done:false })), "soon");

// ---- un valor raro cae en el de fábrica ----
for(const [v, esperado] of [[99, 5], [0, 5], ["siete", 5], [null, 5], [3, 3]]){
  await page.evaluate(x=>window.setPrefs({ milestoneDueSoonDays:x }), v);
  eq(`milestoneDueSoonDays=${JSON.stringify(v)} → ${esperado}`, await page.evaluate(()=>window.dias()), esperado);
}

eq("sin errores de página", errores, []);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await b.close();
process.exit(fail ? 1 : 0);
