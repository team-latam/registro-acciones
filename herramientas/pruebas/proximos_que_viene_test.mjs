/* ======================================================================
   «Próximos eventos» lista lo que viene, también si se repite; y «Ver
   calendario» marca el día en cualquier vista (10/10/2026: R2 y R16)

   Una rutina semanal cuya última repetición fue anteayer tiene la próxima
   en cinco días: tiene que estar en la columna (antes se tomaba la
   repetición MÁS CERCANA, la de anteayer, y se descartaba por pasada: la
   rutina desaparecía de martes a jueves). Y desde la tarjeta, «Ver
   calendario» marca el día aunque el Calendario esté en Año o en Semana.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, dia, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const base = BASE();
base.posts = base.posts.concat([
  post({ id: "lunes", d: 2, a: 0, type: "virtual", title: "Reunión de los lunes", content: "Semanal.", extra: { start_time: "10:00:00", end_time: "11:00:00", recurrence: ["RRULE:FREQ=WEEKLY"] } }),
]);
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
const proximos = () => p.$$eval('.feed-side [data-action="proximo-abrir"]', l => l.map(e => [e.dataset.postId, e.dataset.occ || null, e.querySelector(".fs-when").textContent.trim()]));
const lista = await proximos();
const fila = lista.find(x => x[0] === "lunes");
eq("la rutina semanal con la última repetición anteayer está en «Próximos eventos»", !!fila, true);
eq("y apunta a la repetición que viene (en 5 días), no a la de anteayer", fila ? fila[1] : null, dia(-5));
eq("no hay repeticiones pasadas en la columna", lista.every(x => !x[1] || x[1] >= dia(0)), true);

// R16: «Ver calendario» desde la tarjeta, con el Calendario en Año: pasa a Mes y marca el día.
await tab(p, "calendario"); await click(p, '[data-action="toggle-cal-view"]'); await click(p, '[data-action="cal-subview"][data-key="anio"]'); await p.waitForTimeout(300);
await tab(p, "feed"); await p.waitForTimeout(300);
await p.click('.feed-side [data-action="proximo-abrir"][data-post-id="lunes"]'); await p.waitForTimeout(250);
await p.click('#eventCardBody [data-action="event-card-calendario"]'); await p.waitForTimeout(400);
eq("desde Año, «Ver calendario» pasa a Mes y marca el día", await p.evaluate(d => [!!document.querySelector(".cal-cell"), document.querySelector(".cal-destino")?.dataset.date || null], dia(-5)), [true, dia(-5)]);

// Con el Calendario en Semana: se queda en Semana y marca la columna del día.
await click(p, '[data-action="toggle-cal-view"]'); await click(p, '[data-action="cal-subview"][data-key="semana"]'); await p.waitForTimeout(300);
await tab(p, "feed"); await p.waitForTimeout(300);
await p.click('.feed-side [data-action="proximo-abrir"][data-post-id="lunes"]'); await p.waitForTimeout(250);
await p.click('#eventCardBody [data-action="event-card-calendario"]'); await p.waitForTimeout(400);
eq("desde Semana, se queda en Semana y marca el día", await p.evaluate(d => [!!document.querySelector(".cal-grid"), document.querySelector(".cal-gcol-head.cal-destino")?.dataset.date || null], dia(-5)), [true, dia(-5)]);
eq("sin errores en la página", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
