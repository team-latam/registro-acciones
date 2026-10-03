import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:760, height:640 } });
const errores = [];
page.on("pageerror", e=>errores.push("pageerror: " + e.message));
page.on("console", m=>{ if(m.type()==="error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/hol.html");

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// 21/9/2026 es lunes: Yom Kipur (judío) + un feriado de país el mismo día
await page.evaluate(()=>window.setHolidays({
  "2026-09-21": [{ name:"Yom Kipur", key:"en.judaism" }, { name:"Día de la Primavera", key:"es.ar" }],
  "2026-05-01": [{ name:"Día del Trabajador", key:"es.ar" }],
}));

// ---- la barra del feriado ahora es un botón ----
await page.evaluate(()=>window.pintarBarras("2026-09-21"));
eq("las barras de feriado son botones", await page.locator("button.cal-bar.holiday").count(), 2);
eq("y saben qué feriado son", await page.locator("button.cal-bar.holiday").evaluateAll(e=>e.map(x=>[x.dataset.date, x.dataset.hi])),
   [["2026-09-21","0"],["2026-09-21","1"]]);
eq("se puede tocar (cursor)", await page.locator("button.cal-bar.holiday").first().evaluate(e=>getComputedStyle(e).cursor), "pointer");

// ---- tocarla abre la tarjeta ----
eq("la tarjeta arranca cerrada", await page.locator("#eventCardOverlay").isVisible(), false);
await page.locator('button.cal-bar.holiday[data-hi="0"]').click();
eq("se abre", await page.locator("#eventCardOverlay").isVisible(), true);
eq("con el nombre del feriado", await page.locator("#eventCardTitle").innerText(), "Yom Kipur");
const cuando = await page.locator(".ev-when").innerText();
eq("y el día con nombre, como en Google", /lunes, 21 de septiembre/i.test(cuando), true);
eq("arrancando en mayúscula", cuando.startsWith("Lunes"), true);
const cuerpo = await page.locator("#eventCardBody").innerText();
eq("dice de qué calendario sale", cuerpo.includes("Festividades judías"), true);
eq("y avisa que es de solo lectura", cuerpo.includes("Solo lectura"), true);
// Una festividad judía no es un feriado del país: la chapita lo dice.
eq("chapita de festividad para el judío", (await page.locator(".ev-badges").innerText()).includes("Festividad"), true);
eq("y el texto de la chapita contrasta con su color",
   await page.locator(".ev-badges .type-badge").evaluate(e=>getComputedStyle(e).color), "rgb(255, 255, 255)");

// ---- lo que NO se puede hacer: no hay editar, cancelar, historia ni proyecto ----
for(const acc of ["event-card-edit","event-card-goto","event-card-project"]){
  eq(`no ofrece ${acc}`, await page.locator(`[data-action="${acc}"]`).count(), 0);
}

// ---- lo que SÍ: cargar un evento ese día ----
eq("ofrece cargar un evento ese día", await page.locator('[data-action="holiday-new-event"]').count(), 1);
eq("y el atajo a Configuración", await page.locator('[data-action="goto-config-capas"]').count(), 1);
// Los dos botones: mismo tamaño, misma altura, y Configuración primero.
const botones = await page.locator(".ev-actions button").evaluateAll(els=>els.map(e=>{
  const r = e.getBoundingClientRect();
  return { txt:e.innerText.trim(), w:Math.round(r.width), h:Math.round(r.height), y:Math.round(r.top) };
}));
eq("son dos", botones.length, 2);
eq("Configuración va primero", botones[0].txt, "⚙️ Ver Configuración");
eq("y Cargar evento segundo", botones[1].txt, "➕ Cargar evento");
eq("mismo ancho", botones[0].w, botones[1].w);
eq("mismo alto", botones[0].h, botones[1].h);
eq("a la misma altura (una sola fila)", botones[0].y, botones[1].y);

// ---- los otros feriados del mismo día ----
eq("nombra el otro feriado del día", cuerpo.includes("Día de la Primavera"), true);
await page.locator('.ev-holiday-link').click();
eq("y saltar a él cambia la tarjeta", await page.locator("#eventCardTitle").innerText(), "Día de la Primavera");
eq("con su propio origen", (await page.locator("#eventCardBody").innerText()).includes("Feriados de Argentina"), true);
eq("y su chapita dice feriado, no festividad", (await page.locator(".ev-badges").innerText()).includes("Feriado"), true);
eq("y ahora el otro es el que figura al pie", (await page.locator("#eventCardBody").innerText()).includes("Yom Kipur"), true);

// ---- un día con un solo feriado no muestra la fila de "también" ----
await page.evaluate(()=>window.abrir("2026-05-01", 0));
eq("un solo feriado: sin fila de 'ese día también'", await page.locator(".ev-holiday-link").count(), 0);
eq("y el color sale de la preferencia del país", await page.locator(".ev-dot").evaluate(e=>getComputedStyle(e).backgroundColor), "rgb(192, 57, 43)");
await page.evaluate(()=>window.abrir("2026-09-21", 0));
eq("el judío usa su propio color", await page.locator(".ev-dot").evaluate(e=>getComputedStyle(e).backgroundColor), "rgb(107, 79, 187)");

// ---- cargar un evento ese día ----
await page.evaluate(()=>{ window.__composer = []; });
await page.locator('[data-action="holiday-new-event"]').click();
eq("abre el composer en esa fecha", await page.evaluate(()=>window.__composer), ["2026-09-21"]);
eq("y cierra la tarjeta antes", await page.locator("#eventCardOverlay").isVisible(), false);

// ---- quien no puede escribir no ve el botón de cargar ----
await page.evaluate(()=>{ window.setPuedeEscribir(false); window.abrir("2026-09-21", 0); });
eq("observador: sin 'cargar un evento'", await page.locator('[data-action="holiday-new-event"]').count(), 0);
eq("y el de Configuración se queda con la fila entera",
   await page.locator(".ev-actions button").evaluate(e=>e.getBoundingClientRect().width > e.parentElement.getBoundingClientRect().width * 0.9), true);
eq("pero sí ve la tarjeta", await page.locator("#eventCardTitle").innerText(), "Yom Kipur");
await page.evaluate(()=>window.setPuedeEscribir(true));

// ---- apagar la capa con la tarjeta abierta la cierra sola ----
await page.evaluate(()=>window.abrir("2026-09-21", 0));
eq("abierta", await page.locator("#eventCardOverlay").isVisible(), true);
await page.evaluate(()=>{ window.setPrefs({ calendarShowHolidaysJewish:false, calendarShowHolidaysLocal:false }); window.render(); });
eq("apagar los feriados la cierra en vez de dejarla en blanco", await page.locator("#eventCardOverlay").isVisible(), false);
await page.evaluate(()=>window.setPrefs({ calendarShowHolidaysJewish:true, calendarShowHolidaysLocal:true }));

// ---- no se abre sobre un feriado que no existe ----
await page.evaluate(()=>window.abrir("2026-09-21", 9));
eq("índice inexistente: no abre nada", await page.locator("#eventCardOverlay").isVisible(), false);
await page.evaluate(()=>window.abrir("2026-01-01", 0));
eq("fecha sin feriados: tampoco", await page.locator("#eventCardOverlay").isVisible(), false);

// ---- "Ver Configuración" lleva Y cierra ----
await page.evaluate(()=>window.abrir("2026-09-21", 0));
eq("la tarjeta está abierta", await page.locator("#eventCardOverlay").isVisible(), true);
await page.evaluate(()=>{ window.__scrolls = 0; });
await page.locator('[data-action="goto-config-capas"]').click();
eq("lleva a Configuración > Feriados", await page.evaluate(()=>window.getVista()),
   { view:"configuracion", configSection:"capas" });
eq("y la tarjeta se cierra, para poder operar ahí", await page.locator("#eventCardOverlay").isVisible(), false);
eq("sube al principio de la sección", await page.evaluate(()=>window.__scrolls), 1);
eq("el foco no se queda en la tarjeta que se cerró",
   await page.evaluate(()=>document.activeElement.closest("#eventCardOverlay") === null), true);

// Desde la barra del Calendario (sin tarjeta abierta) sigue funcionando.
await page.evaluate(()=>{ window.setVistaCalendario(); });
eq("sin tarjeta: cerrada de entrada", await page.locator("#eventCardOverlay").isVisible(), false);
await page.evaluate(()=>{
  // Arriba de todo y por encima: las barras de feriado que quedaron
  // pintadas en el harness se superponen a lo que se agregue al final.
  const b = document.createElement("button");
  b.dataset.action = "goto-config-capas"; b.id = "desdeBarra"; b.textContent = "x";
  b.style.cssText = "position:relative;z-index:500;";
  document.body.prepend(b);
});
await page.locator("#desdeBarra").click();
eq("igual navega", await page.evaluate(()=>window.getVista()), { view:"configuracion", configSection:"capas" });
eq("y no rompe nada", errores.length, 0);

eq("sin errores de página", errores, []);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await b.close();
process.exit(fail ? 1 : 0);
