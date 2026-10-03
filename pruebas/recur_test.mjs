import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:760, height:740 } });
const errores = [];
page.on("pageerror", e => errores.push("pageerror: " + e.message));
page.on("console", m => { if(m.type()==="error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/recur.html");

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const reset = async () => page.evaluate(()=>{ window.setDraft({ activityType:"evento", recur:{ key:"none", byDay:[1], until:"" } }); });
// El botón es un interruptor: si ya está abierto, tocarlo lo cierra.
const abrir = async () => { if(!(await page.locator(".recur-pop").isVisible())) await page.locator(".recur-trigger").click(); };

// ---- lo que se ve cerrado: UNA línea ----
eq("cerrado: un solo botón", await page.locator(".recur-trigger").count(), 1);
eq("dice que no se repite", (await page.locator(".recur-trigger").innerText()).includes("No se repite"), true);
eq("sin repetición, el botón va apagado", await page.locator(".recur-trigger").evaluate(e=>e.classList.contains("on")), false);
eq("cerrado no arma el contenido", await page.locator(".recur-opt").count(), 0);

// ---- una rutina no se repite ----
await page.evaluate(()=>window.setDraft({ activityType:"rutina" }));
eq("en una rutina el control no aparece", await page.locator(".recur-trigger").count(), 0);
await page.evaluate(()=>window.setDraft({ activityType:"evento" }));

// ---- abrir ----
await page.locator(".recur-trigger").click();
eq("se abre", await page.locator(".recur-pop").isVisible(), true);
eq("están las 6 opciones", await page.locator(".recur-opt").count(), 6);
eq("arranca en 'No se repite'", await page.locator(".recur-opt.sel").innerText(), "No se repite");
eq("sin repetición no pregunta días", await page.locator(".recur-dow").count(), 0);
eq("ni hasta cuándo", await page.locator('[data-df-kind="recur-until"]').count(), 0);

// ---- elegir semanal ----
await page.locator('[data-key="weekly"]').click();
eq("semanal: aparecen los 7 días", await page.locator(".recur-dow").count(), 7);
eq("con el día de la fecha ya marcado", await page.locator(".recur-dow.sel").count(), 1);
eq("y es el lunes", await page.locator(".recur-dow.sel").getAttribute("data-dow"), "1");
eq("aparece 'hasta cuándo'", await page.locator('[data-df-kind="recur-until"]').count(), 1);
eq("que arranca en 'siempre'", (await page.locator('[data-df-kind="recur-until"]').innerText()).includes("siempre"), true);
eq("el botón ahora se lee encendido", await page.locator(".recur-trigger").evaluate(e=>e.classList.contains("on")), true);
eq("y resume la regla", (await page.locator(".recur-trigger").innerText()).includes("Cada semana, los lunes"), true);
eq("la regla generada", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=MO"]);

// ---- sumar y sacar días ----
await page.locator('.recur-dow[data-dow="3"]').click();
eq("se suma el miércoles", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]);
eq("el resumen los nombra", (await page.locator(".recur-trigger").innerText()).includes("lunes y miércoles"), true);
await page.locator('.recur-dow[data-dow="1"]').click();
eq("se saca el lunes", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=WE"]);
await page.locator('.recur-dow[data-dow="3"]').click();
eq("no se puede quedar sin ningún día", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=WE"]);
eq("y el día queda marcado", await page.locator(".recur-dow.sel").count(), 1);

// ---- quincenal ----
await page.locator('[data-key="biweekly"]').click();
eq("quincenal conserva los días elegidos", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE"]);
eq("y sigue preguntando los días", await page.locator(".recur-dow").count(), 7);

// ---- mensual: no pregunta días ----
await page.locator('[data-key="monthly"]').click();
eq("mensual no pregunta días", await page.locator(".recur-dow").count(), 0);
eq("la regla mensual", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=MONTHLY"]);
eq("pero sí hasta cuándo", await page.locator('[data-df-kind="recur-until"]').count(), 1);

// ---- volver a "no se repite" ----
await page.locator('[data-key="none"]').click();
eq("vuelve a no repetirse", await page.evaluate(()=>window.lineas()), null);
eq("y el botón se apaga", await page.locator(".recur-trigger").evaluate(e=>e.classList.contains("on")), false);
eq("y desaparecen días y corte", (await page.locator(".recur-dow").count()) + (await page.locator('[data-df-kind="recur-until"]').count()), 0);

// ---- el orden de los días sigue el arranque de semana de cada uno ----
await page.evaluate(()=>window.setDraft({ recur:{ key:"weekly", byDay:[1], until:"" } }));
await abrir();
eq("semana que arranca en domingo", await page.locator(".recur-dow").evaluateAll(e=>e.map(x=>x.dataset.dow)), ["0","1","2","3","4","5","6"]);
await page.evaluate(()=>window.setWeekStart(1));
eq("semana que arranca en lunes", await page.locator(".recur-dow").evaluateAll(e=>e.map(x=>x.dataset.dow)), ["1","2","3","4","5","6","0"]);
await page.evaluate(()=>window.setWeekStart(0));

// ---- una regla armada en Google que no sabemos representar ----
await page.evaluate(()=>window.setDraft({ recurrence:["RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU"],
  recur:{ key:"otra", byDay:[1], until:"" } }));
await abrir();
eq("se avisa que vino de Google", (await page.locator(".recur-pop").innerText()).includes("Google Calendar"), true);
eq("y que tocar una opción la reemplaza", (await page.locator(".recur-pop").innerText()).includes("se reemplaza"), true);
eq("no se ofrece 'hasta cuándo' sobre algo que no entendemos", await page.locator('[data-df-kind="recur-until"]').count(), 0);
eq("ninguna opción aparece elegida", await page.locator(".recur-opt.sel").count(), 0);

// ---- cerrar ----
await page.keyboard.press("Escape");
eq("Escape cierra", await page.locator(".recur-pop").isVisible(), false);
await page.locator(".recur-trigger").click();
await page.mouse.click(740, 720);
eq("tocar afuera cierra", await page.locator(".recur-pop").isVisible(), false);
await page.locator(".recur-trigger").click();
await page.locator(".recur-trigger").click();
eq("el mismo botón cierra", await page.locator(".recur-pop").isVisible(), false);

// ---- sobrevive a un re-render ----
await reset();
await abrir();
const antes = await page.locator(".recur-pop").boundingBox();
await page.evaluate(()=>window.render());
eq("sigue abierto después del render", await page.locator(".recur-pop").isVisible(), true);
const desp = await page.locator(".recur-pop").boundingBox();
eq("y en el mismo lugar", Math.abs(antes.x-desp.x) < 2 && Math.abs(antes.y-desp.y) < 2, true);

// ---- entra en la pantalla ----
const caja = await page.locator(".recur-pop").boundingBox();
eq("no se sale por los costados", caja.x >= 0 && caja.x + caja.width <= 760, true);
eq("ni por abajo", caja.y + caja.height <= 740, true);

// ---- el día sigue a la fecha del evento hasta que alguien lo toca ----
await page.evaluate(()=>window.setDraft({ startDate:"2026-09-14", recur:{ key:"weekly", byDay:[1], byDayAuto:true, until:"" } }));
await abrir();
eq("arranca en lunes", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
// Lo mismo que hace el selector de fecha de inicio del composer
await page.evaluate(()=>{
  const d = window.getDraft();
  d.startDate = "2026-09-16"; // miércoles
  if(d.recur && d.recur.byDayAuto) d.recur = { ...d.recur, byDay:[3] };
  window.render();
});
eq("al mover el evento al miércoles, la regla lo sigue", await page.evaluate(()=>window.lineas()), ["RRULE:FREQ=WEEKLY;BYDAY=WE"]);
await abrir();
await page.locator('.recur-dow[data-dow="5"]').click(); // toca los días a mano
eq("tocar un día lo saca de automático", await page.evaluate(()=>window.getDraft().recur.byDayAuto), false);

eq("sin errores de página", errores, []);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await b.close();
process.exit(fail ? 1 : 0);
