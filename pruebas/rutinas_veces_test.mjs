/* ======================================================================
   Las rutinas que se repiten, en Reportes y en el Inicio (auditoría del
   10/10/2026, R7; el usuario eligió y ajustó la opción A)

   Reportes cuenta cada vez que ocurre una reunión semanal (15 en lo que va
   del año); el Inicio la muestra en una sola tarjeta. Tocás «Argentina 17»
   y la lista tiene 3 posteos. Al venir de Reportes con un período, una línea
   lo explica («17 actividades en 3 posteos…») y cuántas veces fue cada serie
   se ve recién al tocar «se repite…» en su tarjeta.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, pais, ciudad, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const AR = [pais("Argentina")];
const base = BASE();
base.posts = [
  post({ id: "lunes", start: dia(100), a: 0, type: "virtual", title: "Reunión semanal con Rosario", content: "Se repite todos los lunes.", scopes: AR,
         extra: { start_time: "10:00:00", end_time: "11:00:00", recurrence: ["RRULE:FREQ=WEEKLY"] } }),
  post({ id: "v1", d: 20, a: 1, type: "visita", title: "Visita a Córdoba", scopes: [ciudad("Argentina", "Córdoba")] }),
  post({ id: "v2", d: 45, a: 2, type: "visita", title: "Visita a Mendoza", scopes: AR }),
];
base.replies = [];

const b = await abrirNavegador();
const texto = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const cuantos = (p, sel) => p.$$eval(sel, l => l.length);
const numeroDe = async (p, sel) => parseInt((await texto(p, sel)).match(/\d+/)[0], 10);

for(const lang of ["", "en"]){
  const idioma = lang || "es";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang, base });
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  const total = await numeroDe(p, ".rep-total-num");
  const virtual = await numeroDe(p, '[data-action="reporte-ir"][data-kind="tipo"][data-key="virtual"]');
  const visitas = await numeroDe(p, '[data-action="reporte-ir"][data-kind="tipo"][data-key="visita"]');
  eq(`[${idioma}] la reunión semanal cuenta varias veces en Reportes`, virtual > 2 && total === virtual + visitas, true);

  // Argentina: la fila cuenta todas las veces; el Inicio lista los posteos
  await p.click('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]');
  await p.waitForSelector(".fb-volver");
  const posteos = await numeroDe(p, '.feed-solapas button[data-key="pasado"] .fs-n');
  eq(`[${idioma}] el Inicio lista los 3 posteos`, posteos, 3);
  eq(`[${idioma}] y una línea explica la diferencia`, await texto(p, ".fb-nota"),
     idioma === "es" ? `${total} actividades en 3 posteos. Lo que se repite cuenta cada vez: tocá «se repite…» en su tarjeta para ver cuántas.`
                     : `${total} activities in 3 posts. Anything that repeats counts every time: tap “repeats…” on its card to see how many.`);
  eq(`[${idioma}] cuántas veces es cada serie NO se ve hasta tocar «se repite…»`, await cuantos(p, ".occ-pop-veces"), 0);
  await p.click('.occ-chip[data-post-id="lunes"]');
  await p.waitForSelector(".occ-pop-veces");
  const veces = await texto(p, ".occ-pop-veces");
  eq(`[${idioma}] al tocarlo, cuántas veces fue en el período (lo que cuenta Reportes): «${veces}»`,
     new RegExp(idioma === "es" ? `^${virtual} veces en \\d{4} · hasta hoy$` : `^${virtual} times in \\d{4} · so far$`).test(veces), true);
  eq(`[${idioma}] y la lista de fechas sigue ahí`, await cuantos(p, ".occ-pop .occ-date") > 3, true);
  await p.keyboard.press("Escape");

  // Si no hay nada que explicar (2 actividades en 2 posteos), la línea no está
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  await p.click('[data-action="reporte-ir"][data-kind="tipo"][data-key="visita"]');
  await p.waitForSelector(".fb-volver");
  eq(`[${idioma}] sin repeticiones en la lista no hay línea`, await cuantos(p, ".fb-nota"), 0);

  // Sin período (el Inicio de siempre): ni línea ni cuenta en el desplegable
  await p.click('[data-action="clear-filters"]'); await p.waitForTimeout(300);
  await tab(p, "feed").catch(() => {});
  await p.evaluate(() => document.querySelector('nav.tabs button[data-view="feed"], .bn-item[data-view="feed"]')?.click()); await p.waitForTimeout(400);
  eq(`[${idioma}] el Inicio sin período: sin línea`, await cuantos(p, ".fb-nota"), 0);
  await p.click('.occ-chip[data-post-id="lunes"]'); await p.waitForSelector(".occ-pop .occ-date");
  eq(`[${idioma}] y el desplegable sin la cuenta del período`, await cuantos(p, ".occ-pop-veces"), 0);
  eq(`[${idioma}] sin errores`, errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
