/* ======================================================================
   El Inicio en dos solapas: «Lo que pasó» y «Próximos» (docs/AUDITORIA.md,
   M4; elegido por el usuario el 6/10/2026, opción B)

   Antes la primera pantalla del Inicio eran los eventos de los meses que
   vienen y lo hecho esta semana quedaba abajo, con tres filas de botones
   antes de la primera tarjeta. Ahora arranca en lo que ya pasó, lo más
   reciente arriba; lo que viene está en su solapa, lo más cercano
   primero; un solo chip ⇅ da vuelta el orden de la solapa que se mira; y
   «Actualizar» (que traía de Google Calendar) vive solo en el Calendario,
   con ese nombre.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const base = BASE();
const fecha = Object.fromEntries(base.posts.map(p => [p.id, p.start_date || p.date]));
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { base, viewport: { width: 1280, height: 900 } });
const hoy = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const vistos = () => p.$$eval("#viewRoot article.post[data-post-id]", es => es.map(e => e.dataset.postId));
const fechas = async () => (await vistos()).map(id => fecha[id]);
const ordenada = (xs, asc) => xs.every((x, i) => i === 0 || (asc ? xs[i - 1] <= x : xs[i - 1] >= x));
const toca = async sel => { await p.click(sel); await p.waitForTimeout(250); };

// Arranca en «Lo que pasó».
eq("arranca en «Lo que pasó»", await p.$eval('.feed-solapas [aria-pressed="true"]', e => e.dataset.key), "pasado");
const f0 = await fechas();
eq("ahí no hay nada que todavía no empezó", f0.filter(f => f > hoy), []);
eq("lo más reciente arriba", ordenada(f0, false), true);
const cuentas = await p.$$eval(".feed-solapas .fs-n", es => es.map(e => Number(e.textContent)));
eq("cada solapa dice cuántos tiene, y entre las dos están todos", cuentas[0] > 0 && cuentas[1] > 0, true);

// «Próximos»
await toca('[data-action="feed-solapa"][data-key="futuro"]');
const f1 = await fechas();
eq("«Próximos»: solo lo que todavía no empezó", [f1.length > 0, f1.every(f => f > hoy)], [true, true]);
eq("y lo más cercano primero", ordenada(f1, true), true);
eq("la cuenta de la solapa coincide con lo que muestra", f1.length, cuentas[1]);
eq("el chip dice el orden de esta solapa", await p.$eval('[data-action="feed-order"]', e => e.getAttribute("aria-label")), "Más cercanos primero");

// El chip da vuelta el orden de la solapa que se mira, y lo recuerda aparte.
await toca('[data-action="feed-order"]');
eq("⇅ en «Próximos»: lo más lejano primero", ordenada(await fechas(), false), true);
eq("y queda guardado como preferencia de la persona", await p.evaluate(e => ((window.__sb.tablas.user_prefs || []).find(u => u.email === e) || { prefs: {} }).prefs.feedOrderProx, ADMIN), "desc");
await toca('[data-action="feed-solapa"][data-key="pasado"]');
eq("«Lo que pasó» conserva su orden (no lo tocó el de la otra solapa)", ordenada(await fechas(), false), true);
await toca('[data-action="feed-order"]');
eq("⇅ en «Lo que pasó»: lo más antiguo primero", [ordenada(await fechas(), true), await p.$eval('[data-action="feed-order"]', e => e.getAttribute("aria-label"))], [true, "Más antiguos primero"]);
await toca('[data-action="feed-order"]');

// Ir a un evento que viene (desde «Próximos eventos» de la columna) pasa de
// solapa. Desde el 8/10/2026 el renglón abre la tarjeta del evento y la
// historia se abre con su «Ver historia» (proximos_tarjeta_test.mjs).
const prox = await p.$eval('.feed-side .fs-item[data-action="proximo-abrir"]', e => e.dataset.postId);
await toca(`.feed-side .fs-item[data-post-id="${prox}"]`);
await toca('#eventCardBody [data-action="event-card-goto"]');
eq("abrir un evento que viene cambia a «Próximos» y lo muestra", [await p.$eval('.feed-solapas [aria-pressed="true"]', e => e.dataset.key), (await vistos()).includes(prox)], ["futuro", true]);

// «Actualizar» se fue del Inicio y vive en el Calendario, con su nombre.
eq("en el Inicio ya no está «Actualizar»", await p.$$eval('#viewRoot [data-action="sync-calendar"]', es => es.length), 0);
await tab(p, "calendario");
eq("en el Calendario dice «Traer de Google Calendar»", await p.$eval('#viewRoot [data-action="sync-calendar"]', e => e.getAttribute("aria-label")), "Traer de Google Calendar");
await p.close();

// En el celular, las solapas y el chip entran en una sola fila, sin
// salirse de la pantalla.
const cel = await entrar(b, ADMIN, "Benny Rosenthal", { base: BASE(), viewport: { width: 360, height: 760 } });
const fila = await cel.p.evaluate(() => {
  const s = document.querySelector(".feed-solapas").getBoundingClientRect(), c = document.querySelector('.feed-solapas-fila [data-action="feed-order"]').getBoundingClientRect();
  return { mismaFila: Math.abs(s.top + s.height / 2 - (c.top + c.height / 2)) < 4, adentro: c.right <= innerWidth && s.left >= 0, ancho: document.documentElement.scrollWidth <= innerWidth };
});
eq("celular: solapas y ⇅ en una fila, todo adentro de la pantalla", fila, { mismaFila: true, adentro: true, ancho: true });
await cel.p.close();
eq("sin un solo error en la página", [...errores, ...cel.errores], []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
