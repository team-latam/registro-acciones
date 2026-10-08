/* ======================================================================
   «Próximos eventos» abre la tarjeta del evento (8/10/2026)

   Tocar un evento de la columna del Inicio llevaba directo a su tarjeta
   en el Feed. El usuario pidió que se abra la tarjetita del Calendario,
   con lo básico a la vista: «Ver historia», «Ver calendario», «Editar» y
   un ⋯ con el resto (Repetir, proyecto, Cancelar, Borrar). La tarjeta que
   se abre desde el Calendario queda como estaba.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Más una reunión semanal que arrancó hace 5 días: la que se viene es en 2.
const conSemanal = () => {
  const base = BASE();
  base.members = base.members.concat([{ email: "obs@team-latam.com", name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  base.posts = base.posts.concat([
    post({ id: "semanal", d: 5, a: 0, type: "virtual", title: "Reunión semanal del equipo", content: "Repaso de la semana.",
      extra: { start_time: "10:00:00", end_time: "11:00:00", recurrence: ["RRULE:FREQ=WEEKLY"] } }),
  ]);
  return base;
};
const CURSO = "Curso de Team Leader";
const abierta = p => p.$eval("#eventCardOverlay", e => !e.hidden);
const vista = p => p.$eval("nav.tabs button.active", e => e.dataset.view);
const botones = p => p.$$eval("#eventCardBody .ev-actions > button, #eventCardBody .ev-actions > .ev-mas > button", l => l.map(e => e.dataset.action));
const opciones = p => p.$$eval("#eventCardBody .ev-mas .post-menu-item", l => l.map(e => e.dataset.action));
const enfocado = p => p.evaluate(() => document.activeElement && document.activeElement.dataset.action);
async function abrir(p, texto){
  await p.click(`.feed-side [data-action="proximo-abrir"]:has-text("${texto}")`);
  await p.waitForTimeout(250);
}

const b = await abrirNavegador();
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conSemanal() });
  const curso = await p.evaluate(t => window.__sb.tablas.posts.find(x => x.title === t), CURSO);

  await abrir(p, CURSO);
  eq("tocar un próximo abre su tarjeta y no se va del Inicio", [await abierta(p), await vista(p)], [true, "feed"]);
  eq("la tarjeta es la de ese evento", await p.$eval("#eventCardTitle", e => e.textContent.trim()), CURSO);
  eq("a la vista: Ver historia, Ver calendario, Editar y ⋯", await botones(p),
     ["event-card-goto", "event-card-calendario", "event-card-edit", "event-card-mas"]);
  eq("el ⋯ arranca cerrado", await p.$$eval("#eventCardBody .ev-mas .post-menu", l => l.length), 0);

  await p.click('#eventCardBody [data-action="event-card-mas"]');
  await p.waitForTimeout(150);
  eq("el ⋯ trae Repetir, Convertir en proyecto, Cancelar y Borrar (admin)", await opciones(p),
     ["event-card-repetir", "event-card-project", "event-card-cancelar", "event-card-borrar"]);
  eq("el foco pasa a la primera opción", await enfocado(p), "event-card-repetir");
  eq("el menú entra en la tarjeta (se abre hacia arriba)", await p.evaluate(() => {
    const m = document.querySelector("#eventCardBody .ev-mas .post-menu").getBoundingClientRect();
    const c = document.querySelector("#eventCardOverlay .event-card").getBoundingClientRect();
    return m.top >= c.top && m.bottom <= c.bottom && m.left >= c.left && m.right <= c.right;
  }), true);
  eq("las opciones del ⋯ no son píldoras con borde", await p.$eval("#eventCardBody .ev-mas .post-menu-item", e => getComputedStyle(e).borderTopWidth), "0px");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  eq("Escape cierra primero el ⋯, la tarjeta sigue, y el foco vuelve al ⋯",
     [await p.$$eval("#eventCardBody .ev-mas .post-menu", l => l.length), await abierta(p), await enfocado(p)], [0, true, "event-card-mas"]);
  await p.click('#eventCardBody [data-action="event-card-mas"]');
  await p.click("#eventCardBody .ev-title");
  await p.waitForTimeout(150);
  eq("un clic afuera del ⋯ lo cierra (la tarjeta sigue)", [await p.$$eval("#eventCardBody .ev-mas .post-menu", l => l.length), await abierta(p)], [0, true]);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  eq("el segundo Escape cierra la tarjeta", await abierta(p), false);

  // Ver calendario: al día del evento, con el día marcado.
  await abrir(p, CURSO);
  await p.click('#eventCardBody [data-action="event-card-calendario"]');
  await p.waitForTimeout(500);
  eq("Ver calendario: cierra la tarjeta y abre el Calendario", [await abierta(p), await vista(p)], [false, "calendario"]);
  eq("…parado en el día del evento, marcado", await p.$$eval(".cal-cell.cal-destino", l => l.map(e => e.dataset.date)), [curso.start_date]);

  // Ver historia: la tarjeta del Feed, como antes hacía el clic directo.
  await p.click('nav.tabs button[data-view="feed"]');
  await p.waitForTimeout(400);
  await abrir(p, CURSO);
  await p.click('#eventCardBody [data-action="event-card-goto"]');
  await p.waitForTimeout(600);
  eq("Ver historia: cierra la tarjeta y muestra el posteo en el Feed",
     [await abierta(p), await vista(p), await p.$$eval(`#viewRoot .post[data-post-id="${curso.id}"]`, l => l.length)], [false, "feed", 1]);

  // Una opción del ⋯ cierra la tarjeta antes de abrir lo suyo.
  await abrir(p, CURSO);
  await p.click('#eventCardBody [data-action="event-card-mas"]');
  await p.click('#eventCardBody [data-action="event-card-repetir"]');
  await p.waitForTimeout(400);
  eq("Repetir: la tarjeta se cierra y abre el formulario", [await abierta(p), await p.$eval("#postModalOverlay", e => !e.hidden)], [false, true]);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  if(await p.$eval("#postModalOverlay", e => !e.hidden)){ await p.click('[data-action="confirm-ok"]').catch(() => {}); await p.waitForTimeout(300); }

  // Un evento que se repite: la tarjeta y el Calendario van a la repetición
  // que se veía en la lista, no al primer día de la serie.
  await abrir(p, "Reunión semanal del equipo");
  eq("repetición: la tarjeta dice el día de la que se viene",
     await p.$eval("#eventCardBody .ev-when", e => e.textContent.includes("🔁")), true);
  await p.click('#eventCardBody [data-action="event-card-calendario"]');
  await p.waitForTimeout(500);
  eq("repetición: Ver calendario va a esa fecha (en 2 días), no al arranque (hace 5)",
     await p.$$eval(".cal-cell.cal-destino", l => l.map(e => e.dataset.date)), [dia(-2)]);

  // Desde el Calendario la tarjeta sigue como estaba (sin «Ver calendario»).
  await p.locator('[data-action="cal-open"][data-post-id="semanal"]').first().click();
  await p.waitForTimeout(250);
  eq("desde el Calendario: los botones de siempre",
     await botones(p), ["event-card-goto", "event-card-project", "event-card-edit"]);
  await p.keyboard.press("Escape");
  eq("sin errores", errores, []);
  await p.close();
}
{
  // Un observador ve Ver historia y Ver calendario; ni Editar ni ⋯.
  const { p, errores } = await entrar(b, "obs@team-latam.com", "Olga Observa", { viewport: { width: 1280, height: 900 }, base: conSemanal() });
  await abrir(p, CURSO);
  eq("observador: solo Ver historia y Ver calendario", await botones(p), ["event-card-goto", "event-card-calendario"]);
  eq("observador: sin errores", errores, []);
  await p.close();
}
{
  // En hebreo: los textos traducidos y el ⋯ dentro de la tarjeta.
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conSemanal(), lang: "he" });
  await abrir(p, CURSO);
  eq("hebreo: Ver calendario traducido", await p.$eval('#eventCardBody [data-action="event-card-calendario"]', e => e.textContent.trim()), "📅 הצגת היומן");
  await p.click('#eventCardBody [data-action="event-card-mas"]');
  await p.waitForTimeout(150);
  eq("hebreo: el menú entra en la tarjeta", await p.evaluate(() => {
    const m = document.querySelector("#eventCardBody .ev-mas .post-menu").getBoundingClientRect();
    const c = document.querySelector("#eventCardOverlay .event-card").getBoundingClientRect();
    return m.top >= c.top && m.bottom <= c.bottom && m.left >= c.left && m.right <= c.right;
  }), true);
  eq("hebreo: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
