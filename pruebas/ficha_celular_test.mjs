/* ======================================================================
   La ficha de un lugar en el celular (8/10/2026)

   El costado (Proyectos, Ciudades, Ritmo, Quiénes trabajaron acá,
   Documentos) iba debajo de «Lo que pasó», que se carga de a 30 y suma 30
   más al llegar abajo: en un lugar con mucha actividad no se llegaba nunca
   (captura del usuario). Eligió la opción B: en el celular el costado va
   arriba de la historia, cada tarjeta plegada en un renglón con su resumen,
   que se abre ahí mismo y queda abierta en ese aparato. En la compu y en el
   papel, como siempre.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, tab, ADMIN, BASE, post, ciudad } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Argentina con mucha actividad: 40 rutinas más en Buenos Aires, así «Lo
// que pasó» pasa de una tanda (30) y el costado de antes quedaba lejísimos.
const conMucha = () => {
  const base = BASE();
  for(let i = 0; i < 40; i++) base.posts.push(post({ id: "bsas" + i, d: 6 + i * 7, a: i % 3 === 0 ? 4 : 0, type: "rutina",
    title: "", content: "Rutina con los jóvenes de Buenos Aires " + i, scopes: [ciudad("Argentina", "Buenos Aires (CABA)")] }));
  return base;
};
async function aArgentina(p){
  await tab(p, "paises");
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector(".fl-grid");
  await p.waitForTimeout(200);
}
const lados = p => p.$$eval(".fl-lado > .fl-card", l => l.map(c => (c.querySelector(".fl-pliegue") || { dataset: {} }).dataset.que || null));
const visible = (p, sel) => p.$$eval(sel, l => l.length > 0 && l.every(e => !!e.offsetParent && getComputedStyle(e).display !== "none"));
const resumen = (p, k) => p.$eval(`.fl-pliegue[data-que="${k}"] .r`, e => e.textContent.trim()).catch(() => null);
const quieto = async p => { let a = -1; for(let i = 0; i < 20; i++){ const y = await p.evaluate(() => scrollY); if(y === a) return; a = y; await p.waitForTimeout(120); } };
const abiertas = p => p.$$eval(".fl-lado > .fl-plegable.abierta", l => l.map(c => (c.querySelector(".fl-pliegue") || { dataset: {} }).dataset.que || null));

const b = await abrirNavegador();

// ---------- En el celular ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, base: conMucha() });
  await aArgentina(p);
  eq("celular: la historia arranca con una tanda (lo que se prueba)", await p.$$eval(".fl-it", l => l.length), 30);
  eq("celular: la botonera debajo del título y el selector después, como siempre", await p.evaluate(() => {
    const a = document.querySelector(".fl-acciones").getBoundingClientRect(), s = document.querySelector(".fl-seg").getBoundingClientRect();
    return a.bottom <= s.top + 1 && Math.abs(a.width - s.width) < 2; }), true);
  // Los contactos de la Agenda van adentro de «Ciudades» (9/10/2026): son cinco.
  eq("celular: están las cinco tarjetas del costado", await lados(p), ["proy", "hijos", "ritmo", "quienes", "docs"]);
  eq("celular: el costado va arriba de «Lo que pasó», después de «Lo que sigue»", await p.evaluate(() => {
    const top = e => e.getBoundingClientRect().top;
    if(!document.querySelector(".fl-sigue") || !document.querySelector(".fl-historia")) return false;
    const sigue = top(document.querySelector(".fl-sigue")), historia = top(document.querySelector(".fl-historia"));
    return [...document.querySelectorAll(".fl-lado > .fl-card")].every(c => top(c) > sigue && top(c) < historia);
  }), true);
  eq("celular: de entrada, todas plegadas", await abiertas(p), []);
  eq("celular: plegadas, no se ve lo de adentro", await p.$$eval(".fl-lado > .fl-card", l => l.every(c =>
    [...c.children].filter(x => x.tagName !== "H3").every(x => getComputedStyle(x).display === "none"))), true);
  eq("celular: el título de la compu no se ve; el renglón sí", [await visible(p, ".fl-lado .fl-lado-t"), await visible(p, ".fl-lado .fl-pliegue")], [false, true]);
  eq("celular: «Lo que sigue» y «Lo que pasó» no se pliegan", await p.$$eval(".fl-sigue .fl-pliegue, .fl-historia .fl-pliegue", l => l.length), 0);
  eq("celular: cada renglón trae un resumen", await p.$$eval(".fl-lado .fl-pliegue .r", l => l.every(e => e.textContent.trim().length > 0 && !!e.offsetParent)), true);
  eq("celular: Ritmo cuenta los registros del año", /^\d+ registros en 12 meses$/.test(await resumen(p, "ritmo")), true);
  eq("celular: Proyectos dice cuántos abiertos y los hitos vencidos", await resumen(p, "proy"), "1 abierto · 1 hito vencido");
  eq("celular: todo entra a lo ancho, nada se corta", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  // Sin los renglones (el código de antes), lo que sigue no se puede probar.
  if(!(await p.$(".fl-pliegue"))){ fail++; console.log("✗ celular: no hay renglones para abrir y plegar; el resto no se puede probar"); }
  else {
  // Abrir «Quiénes trabajaron acá»: se ve ahí mismo, sin moverse.
  // (La página se desplaza suave: se espera a que quede quieta. Y el toque
  // va desde la página, porque el clic de Playwright en el celular primero
  // la mueve por su cuenta.)
  await p.$eval('.fl-pliegue[data-que="quienes"]', e => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await quieto(p);
  const y = await p.evaluate(() => scrollY);
  await p.$eval('.fl-pliegue[data-que="quienes"]', e => e.click());
  await p.waitForTimeout(250);
  eq("abrir: queda abierta solo esa", await abiertas(p), ["quienes"]);
  eq("abrir: se ve la gente", await visible(p, ".fl-plegable.abierta .fl-gente"), true);
  eq("abrir: dice que está abierta", await p.$eval('.fl-pliegue[data-que="quienes"]', e => e.getAttribute("aria-expanded")), "true");
  eq("abrir: abierta, el resumen no se repite", await visible(p, '.fl-pliegue[data-que="quienes"] .r'), false);
  eq("abrir: la pantalla no salta", Math.abs(await p.evaluate(() => scrollY) - y) <= 2, true);
  eq("abrir: el foco sigue en el mismo renglón", await p.evaluate(() => document.activeElement && document.activeElement.dataset.que), "quienes");
  const nombres = await p.$$eval(".fl-gente .nm", l => l.map(e => e.textContent.trim()));
  await p.click('.fl-pliegue[data-que="quienes"]'); await p.waitForTimeout(200);
  eq("resumen de Quiénes: los dos que más y cuántos más", await resumen(p, "quienes"),
     nombres.length > 2 ? `${nombres[0]}, ${nombres[1]} y ${nombres.length - 2} más` : nombres.join(" y "));
  eq("plegar: vuelve a quedar plegada", await abiertas(p), []);
  // Ciudades: abierta, muestra las ciudades; el resumen nombra las primeras.
  await p.click('.fl-pliegue[data-que="hijos"]'); await p.waitForTimeout(200);
  // Solo los de la tarjeta Ciudades.
  const ciudades = await p.$$eval('.fl-card:has(.fl-pliegue[data-que="hijos"]) .fl-hijos .fl-hijo b', l => l.map(e => e.textContent.trim()));
  eq("Ciudades: abierta, se ven las ciudades", ciudades.length > 0 && await visible(p, '.fl-card:has(.fl-pliegue[data-que="hijos"]) .fl-hijos'), true);
  await p.click('.fl-pliegue[data-que="hijos"]'); await p.waitForTimeout(200);
  // …y después cuántos contactos hay en la Agenda (« · 4 contactos»).
  eq("Ciudades: el resumen nombra las primeras", (await resumen(p, "hijos")).split(" · ")[0],
     ciudades.length > 2 ? `${ciudades[0]}, ${ciudades[1]} y ${ciudades.length - 2} más` : ciudades.join(" y "));

  // Lo abierto queda abierto en ese aparato: en otra ficha y al volver a entrar.
  await p.click('.fl-pliegue[data-que="quienes"]'); await p.waitForTimeout(200);
  await p.click('.fl-pliegue[data-que="hijos"]'); await p.waitForTimeout(200);
  await p.click('.fl-hijo[data-city="Rosario"]'); await p.waitForSelector(".fl-historia"); await p.waitForTimeout(200);
  eq("otra ficha (Rosario): Quiénes sigue abierta", await abiertas(p).then(a => a.includes("quienes")), true);
  await p.reload(); await p.waitForTimeout(1200);
  await aArgentina(p);
  eq("al volver a entrar: siguen abiertas las mismas", (await abiertas(p)).sort(), ["hijos", "quienes"]);
  await p.click('.fl-pliegue[data-que="hijos"]'); await p.waitForTimeout(200);
  eq("al plegarla, se acuerda también", await p.evaluate(() => JSON.parse(localStorage.getItem("ra_ficha_abiertas"))), ["quienes"]);

  // En el papel («Reporte del lugar»), desde el celular: todo desplegado.
  await p.emulateMedia({ media: "print" });
  eq("papel: se ve lo de adentro de todas las tarjetas", await p.$$eval(".fl-lado > .fl-card", l => l.every(c =>
    [...c.children].filter(x => x.tagName !== "H3").some(x => getComputedStyle(x).display !== "none"))), true);
  eq("papel: con el título de siempre, sin el renglón", [await p.$$eval(".fl-lado .fl-pliegue", l => l.every(e => getComputedStyle(e).display === "none")),
     await p.$$eval(".fl-lado .fl-lado-t", l => l.every(e => getComputedStyle(e).display !== "none"))], [true, true]);
  await p.emulateMedia({ media: "screen" });
  }
  eq("celular: sin errores", errores, []);
  await p.close();
}

// ---------- Ciudades desplegada: una sola barra (9/10/2026) ----------
// La tarjeta desplegada llevaba una barra propia (380 px de alto) adentro de la
// de la página: dos barras, una adentro de la otra (captura del usuario).
// «Contactos en …» nunca la tuvo. Ahora la lista crece con la página.
{
  const OTRAS = ["Bahía Blanca", "Bariloche", "Córdoba", "Mendoza", "Salta", "Tucumán", "Neuquén", "Mar del Plata"];
  const base = conMucha();
  OTRAS.forEach((c, i) => base.posts.push(post({ id: "otra" + i, d: 10 + i * 5, a: 0, type: "rutina", title: "", content: "Rutina en " + c, scopes: [ciudad("Argentina", c)] })));
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, base });
  await aArgentina(p);
  const tarjeta = '.fl-card:has(.fl-pliegue[data-que="hijos"])';
  await p.click('.fl-pliegue[data-que="hijos"]'); await p.waitForTimeout(200);
  eq("Ciudades en el celular: más de cinco, ofrece «Ver más»", await p.$eval(`${tarjeta} .fl-mas`, e => e.textContent.trim()), "Ver más");
  await p.$eval(`${tarjeta} .fl-mas`, e => e.click()); await p.waitForTimeout(200);
  eq("Ciudades desplegada: se ven más que las cinco de antes", await p.$$eval(`${tarjeta} .fl-hijo`, l => l.length > 5), true);
  eq("Ciudades desplegada: la lista no tiene barra propia", await p.$eval(`${tarjeta} .fl-hijos`, e => ({ scroll: getComputedStyle(e).overflowY, hayMas: e.scrollHeight > e.clientHeight + 1 })), { scroll: "visible", hayMas: false });
  eq("Ciudades desplegada: nada de adentro de la tarjeta se desplaza por su cuenta", await p.$eval(tarjeta, c =>
    [c, ...c.querySelectorAll("*")].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).length), 0);
  eq("Ciudades desplegada: la tarjeta crece con la lista (más que los 380 px de antes)", await p.$eval(tarjeta, c => c.getBoundingClientRect().height > 600), true);
  eq("Ciudades desplegada: la última se alcanza con la página", await p.evaluate(sel => { const u = document.querySelector(sel + " .fl-hijos").lastElementChild; u.scrollIntoView({ block: "end", behavior: "instant" }); const r = u.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }, tarjeta), true);
  eq("Ciudades desplegada: todo entra a lo ancho", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  eq("Ciudades desplegada: sin errores", errores, []);
  await p.close();
}

// ---------- En hebreo (de derecha a izquierda) ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, base: conMucha(), lang: "he" });
  await aArgentina(p);
  eq("hebreo: el resumen va traducido", /רישומים/.test(await resumen(p, "ritmo") || ""), true);
  eq("hebreo: la flechita apunta hacia el lado de lectura", await p.$eval('.fl-pliegue[data-que="ritmo"] .chev', e => e.textContent).catch(() => null), "‹");
  eq("hebreo: sin errores", errores, []);
  await p.close();
}

// ---------- En la compu: como siempre ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conMucha() });
  await p.evaluate(() => localStorage.setItem("ra_ficha_abiertas", "[]"));
  await aArgentina(p);
  eq("compu: el costado sigue a la derecha de la historia", await p.evaluate(() =>
    document.querySelector(".fl-lado").getBoundingClientRect().left >= document.querySelector(".fl-historia").getBoundingClientRect().right), true);
  eq("compu: las tarjetas, enteras (aunque en el celular estén plegadas)", await p.$$eval(".fl-lado > .fl-card", l => l.every(c =>
    [...c.children].filter(x => x.tagName !== "H3").some(x => getComputedStyle(x).display !== "none"))), true);
  eq("compu: el título de siempre, sin el renglón", [await visible(p, ".fl-lado .fl-lado-t"), await p.$$eval(".fl-lado .fl-pliegue", l => l.every(e => getComputedStyle(e).display === "none"))], [true, true]);
  // La botonera al nivel del selector «qué incluir», a la derecha (pedido del usuario, 9/10/2026).
  eq("compu: «Reporte del lugar / + Cargar algo acá» en la fila de «Solo … / + Región …», a la derecha", await p.evaluate(() => {
    const s = document.querySelector(".fl-seg").getBoundingClientRect(), a = document.querySelector(".fl-acciones").getBoundingClientRect();
    return [Math.abs((s.top + s.bottom) / 2 - (a.top + a.bottom) / 2) < 6, a.left > s.right]; }), [true, true]);
  eq("compu: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
