import { chromium } from "playwright";

import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:900, height:700 } });
const errores = [];
page.on("pageerror", e => errores.push("pageerror: " + e.message));
page.on("console", m => { if(m.type() === "error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/harness.html");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if(g === w) pass++; else { fail++; console.log(`✗ ${name}\n   esperado: ${w}\n   obtenido: ${g}`); }
};

const SEMANAL = { id:"p1", startDate:"2026-09-07", recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO"] };

// ---- un posteo que NO se repite: nada cambia ----
await page.evaluate(()=> window.setPost({ id:"p0", startDate:"2026-09-07" }));
eq("simple: no aparece el chip", await page.locator(".occ-chip").count(), 0);
eq("simple: la fecha queda como estaba", (await page.locator("#dateLine").innerText()).trim(), "lun 14 sep");

// ---- el chip aparece en uno que se repite ----
await page.evaluate(p => { window.state.repliesByPost.p1 = [
  { id:"r1", occ:"2026-09-14" }, { id:"r2", occ:"2026-09-14" }, { id:"r3" },
]; window.setPost(p); }, SEMANAL);
eq("repetido: aparece el chip", await page.locator(".occ-chip").count(), 1);
eq("el chip dice cada cuánto", (await page.locator(".occ-chip").innerText()).includes("se repite todas las semanas"), true);
eq("arranca en la fecha más cercana a hoy", await page.evaluate(()=>window.__occ), "2026-09-14");

// ---- abrir ----
eq("el popup arranca cerrado", await page.locator(".occ-pop").isVisible(), false);
eq("cerrado no arma la lista (78 botones por tarjeta)", await page.locator(".occ-date").count(), 0);
await page.locator(".occ-chip").click();
eq("se abre al tocarlo", await page.locator(".occ-pop").isVisible(), true);
eq("y recién ahí arma la lista", (await page.locator(".occ-date").count()) > 10, true);
eq("aria-expanded pasa a true", await page.locator(".occ-chip").getAttribute("aria-expanded"), "true");

// ---- el popup NO queda recortado por la tarjeta (el motivo de usar fixed) ----
const caja = await page.locator(".occ-pop").boundingBox();
const tarjeta = await page.locator(".card").boundingBox();
eq("el popup pasa el borde de abajo de la tarjeta", caja.y + caja.height > tarjeta.y + tarjeta.height, true);
eq("y se ve igual (no lo recorta el overflow)", await page.locator(".occ-pop").isVisible(), true);
eq("entra en la pantalla a lo ancho", caja.x >= 0 && caja.x + caja.width <= 900, true);

// ---- la lista ----
const fechas = await page.locator(".occ-date").evaluateAll(els => els.map(e=>e.dataset.occ));
eq("están todos los lunes en orden", fechas.slice(0,3), ["2026-09-07","2026-09-14","2026-09-21"]);
eq("la actual viene marcada", await page.locator(".occ-date.current").getAttribute("data-occ"), "2026-09-14");
eq("una sola marcada", await page.locator(".occ-date.current").count(), 1);
eq("cuenta los comentarios de esa fecha", (await page.locator('.occ-date[data-occ="2026-09-14"]').innerText()).includes("💬 2"), true);
eq("no cuenta el de la serie en otra fecha", (await page.locator('.occ-date[data-occ="2026-09-21"]').innerText()).includes("💬"), false);
eq("separador de hoy, una sola vez", await page.locator(".occ-today-sep").count(), 1);
eq("las pasadas quedan atenuadas", await page.locator('.occ-date[data-occ="2026-09-07"]').evaluate(e=>e.classList.contains("past")), true);
eq("las futuras no", await page.locator('.occ-date[data-occ="2026-09-21"]').evaluate(e=>e.classList.contains("past")), false);

// ---- elegir otra fecha ----
await page.locator('.occ-date[data-occ="2026-10-05"]').click();
eq("la tarjeta se para en la elegida", await page.evaluate(()=>window.__occ), "2026-10-05");
eq("el popup queda abierto (elegir es el paso previo a hacerle algo)", await page.locator(".occ-pop").isVisible(), true);
eq("y la marcada pasa a ser la nueva", await page.locator(".occ-date.current").getAttribute("data-occ"), "2026-10-05");
eq("una sola marcada después de elegir", await page.locator(".occ-date.current").count(), 1);

// ---- cerrar de las tres formas ----
await page.keyboard.press("Escape");
eq("Escape cierra", await page.locator(".occ-pop").isVisible(), false);
await page.locator(".occ-chip").click();
await page.mouse.click(880, 680);
eq("tocar afuera cierra", await page.locator(".occ-pop").isVisible(), false);
await page.locator(".occ-chip").click();
eq("el mismo chip de nuevo cierra (interruptor)", await page.locator(".occ-chip").click().then(()=>page.locator(".occ-pop").isVisible()), false);

// ---- sobrevive a un re-render con el popup abierto ----
await page.locator(".occ-chip").click();
eq("abierto antes del render", await page.locator(".occ-pop").isVisible(), true);
const antes = await page.locator(".occ-pop").boundingBox();
await page.evaluate(()=> window.render());
eq("sigue abierto después del render", await page.locator(".occ-pop").isVisible(), true);
const despues = await page.locator(".occ-pop").boundingBox();
eq("y en el mismo lugar", Math.abs(antes.x - despues.x) < 2 && Math.abs(antes.y - despues.y) < 2, true);

// ---- una regla que no sabemos expandir: texto, sin botón ----
await page.evaluate(()=> window.setPost({ id:"p9", startDate:"2026-09-07", recurrence:["RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU"] }));
eq("regla rara: sin chip apretable", await page.locator(".occ-chip").count(), 0);
eq("regla rara: pero no se pierde el 🔁", (await page.locator("#dateLine").innerText()).includes("🔁"), true);

// ---- una serie con COUNT=1: una sola fecha, sigue siendo elegible ----
await page.evaluate(()=> window.setPost({ id:"p8", startDate:"2026-09-07", recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=1"] }));
eq("COUNT=1: una sola fecha en la lista", await page.locator(".occ-chip").count(), 1);
await page.locator(".occ-chip").click();
eq("y es la del arranque", await page.locator(".occ-date").evaluateAll(e=>e.map(x=>x.dataset.occ)), ["2026-09-07"]);

// ---- el popup cerca del borde de abajo se da vuelta ----
await page.evaluate(()=>{ document.body.style.paddingTop = "600px"; });
await page.evaluate(p => window.setPost(p), SEMANAL);
await page.locator(".occ-chip").click();
const chipCaja = await page.locator(".occ-chip").boundingBox();
const popCaja = await page.locator(".occ-pop").boundingBox();
eq("abre hacia arriba si abajo no entra", popCaja.y < chipCaja.y, true);
eq("y entra entero en la pantalla", popCaja.y >= 0 && popCaja.y + popCaja.height <= 700, true);

eq("sin errores de página", errores, []);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await b.close();
process.exit(fail ? 1 : 0);
