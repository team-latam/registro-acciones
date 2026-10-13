/* ======================================================================
   Los filtros del Inicio: la B2 (pedido del usuario, 8/10/2026)

   Eligió, entre tres propuestas que se podían tocar, una barra con el
   buscador y «⚙ Filtros», una ficha por filtro puesto y un panel con los
   filtros a la izquierda y las opciones a la derecha (en angosto, una hoja
   que sube desde abajo: la lista y después las opciones). Pidió dos cosas
   más, que esta prueba cuida:
   - Que al pasar de un filtro a otro no «se vuelva a cargar»: el panel se
     dibujaba entero en cada toque y repetía la animación de abrir. Acá se
     cuentan las animaciones que arrancan al tocar ADENTRO del panel ya
     abierto: la de abrir no puede aparecer ninguna vez.
   - Elegir todo primero y aplicar al final: lo de adentro es un borrador;
     el Inicio no cambia hasta «Ver N posteos» o Enter, y Cancelar, Escape
     o tocar afuera lo dejan como estaba.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, tab, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const hoy = new Date().toISOString().slice(0, 10), anio = hoy.slice(0, 4), anterior = String(Number(anio) - 1);
const DE_ABRIR = ["fpEntra", "fpSube", "fpVelo"];

// Lo que se ve: las fichas de la barra, las tarjetas y las cuentas de las solapas.
const fichas = p => p.$$eval(".fb-ficha-abrir", l => l.map(e => e.textContent.trim()));
const tarjetas = p => p.$$eval("#viewRoot article.post[data-post-id]", l => l.map(e => e.dataset.postId));
const solapas = p => p.$$eval(".feed-solapas .fs-n", l => l.reduce((s, e) => s + Number(e.textContent), 0));
const abierto = p => p.evaluate(() => !!document.querySelector(".fp-panel"));
const focoAdentro = p => p.evaluate(() => !!document.activeElement && !!document.activeElement.closest(".fp-panel"));
// Cuenta las animaciones que arrancan desde ahora.
const contarAnimaciones = p => p.evaluate(() => { window.__anim = []; document.addEventListener("animationstart", e => window.__anim.push(e.animationName), true); });
const animaciones = p => p.evaluate(() => window.__anim || []);
const ver = p => p.$eval(".fp-ver", e => e.textContent.trim());

const b = await abrirNavegador();

/* ---------- 1) En la compu, llegando desde Reportes ---------- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await tab(p, "reportes"); await p.waitForTimeout(300);
  await p.selectOption("#repAnio", anio); await p.waitForTimeout(200);
  await p.click('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]'); await p.waitForTimeout(400);
  eq("desde Reportes: una ficha por filtro, que se toca para cambiarlo", await fichas(p), ["📍 Argentina", `📅 ${anio} · hasta hoy`]);
  eq("desde Reportes: «Volver a Reportes» con el año", await p.$eval('[data-action="fp-volver"]', e => e.textContent.trim()), `← Volver a Reportes · ${anio}`);
  eq("desde Reportes: «⚙ Filtros» dice cuántos hay", await p.$eval("#fbFiltros .fb-cuenta", e => e.textContent), "2");
  const antes = await tarjetas(p), antesN = await solapas(p);

  // Tocar la ficha del año abre el panel en Fecha, con el foco adentro.
  await p.click('.fb-ficha-abrir[data-cat="fecha"]'); await p.waitForTimeout(300);
  eq("la ficha abre el panel en su filtro", await p.$eval(".fp-item.sel", e => e.dataset.cat), "fecha");
  eq("el foco entra al panel", await focoAdentro(p), true);
  eq("el panel es un diálogo con nombre", await p.$eval(".fp-panel", e => [e.getAttribute("role"), e.getAttribute("aria-modal"), !!document.getElementById(e.getAttribute("aria-labelledby"))]), ["dialog", "true", true]);
  eq("en la compu cuelga de la barra (no tapa la pantalla)", await p.$eval(".fp-panel", e => getComputedStyle(e).position), "absolute");
  const alto = await p.$eval(".fp-panel", e => Math.round(e.getBoundingClientRect().height));

  // Tocar adentro: nunca se repite la animación de abrir.
  await contarAnimaciones(p);
  await p.click('.fp-item[data-cat="lugar"]'); await p.waitForTimeout(250);
  await p.click('.fp-item[data-cat="persona"]'); await p.waitForTimeout(250);
  eq("mide siempre lo mismo al cambiar de filtro", await p.$eval(".fp-panel", e => Math.round(e.getBoundingClientRect().height)), alto);
  await p.click('[data-action="fp-persona"][data-key="autor"][data-email="ana@team-latam.com"]'); await p.waitForTimeout(250);
  await p.click('.fp-item[data-cat="fecha"]'); await p.waitForTimeout(250);
  await p.click(`[data-action="fp-fecha"][data-key="${anterior}"]`); await p.waitForTimeout(250);
  const anims = await animaciones(p);
  eq("tocar adentro no repite la animación de abrir (antes: una por toque)", anims.filter(a => DE_ABRIR.includes(a)), []);
  eq("al cambiar de filtro se mueve solo la columna de las opciones", anims.length > 0 && anims.every(a => a === "fpFundido"), true);

  // El borrador: el Inicio de atrás no cambió.
  eq("borrador: las tarjetas de atrás no cambian", await tarjetas(p), antes);
  eq("borrador: las fichas tampoco", await fichas(p), ["📍 Argentina", `📅 ${anio} · hasta hoy`]);
  eq("borrador: avisa cuántos cambios hay", await p.$$eval(".fp-pend", l => l.map(e => e.textContent.trim())), ["· 2 cambios"]);
  eq("borrador: un punto en cada filtro cambiado", await p.$$eval(".fp-item .fp-punto", l => l.map(e => e.closest(".fp-item").dataset.cat)), ["fecha", "persona"]);
  eq("borrador: «Cerrar» pasa a decir «Cancelar»", await p.$eval(".fp-cancelar", e => e.textContent.trim()), "Cancelar");
  const prometido = await ver(p);

  // Escape: no cambia nada y el foco vuelve a la ficha.
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("Escape cierra", await abierto(p), false);
  eq("Escape no aplica nada", [await tarjetas(p), await fichas(p)], [antes, ["📍 Argentina", `📅 ${anio} · hasta hoy`]]);
  eq("el foco vuelve a la ficha que lo abrió", await p.evaluate(() => document.activeElement && document.activeElement.dataset.cat), "fecha");

  // «Ver N posteos» aplica, y N es lo que queda.
  await p.click("#fbFiltros"); await p.waitForTimeout(250);
  eq("al reabrir, el borrador empieza de nuevo", await p.$$eval(".fp-pend", l => l.length), 0);
  await p.click('.fp-item[data-cat="fecha"]'); await p.click(`[data-action="fp-fecha"][data-key="${anterior}"]`);
  await p.click('.fp-item[data-cat="persona"]'); await p.click('[data-action="fp-persona"][data-key="autor"][data-email="ana@team-latam.com"]');
  eq("el botón dice lo mismo que antes con lo mismo elegido", await ver(p), prometido);
  await p.click(".fp-ver"); await p.waitForTimeout(300);
  eq("«Ver N posteos» aplica", await fichas(p), ["📍 Argentina", `📅 ${anterior}`, "👤 Ana Pérez"]);
  eq("y cierra", await abierto(p), false);
  const n = await solapas(p);
  eq("y quedan los posteos que prometía", `Ver ${n} ${n === 1 ? "posteo" : "posteos"}`, prometido);
  eq("la barra cuenta tres filtros", await p.$eval("#fbFiltros .fb-cuenta", e => e.textContent), "3");

  // Enter aplica (después de tocar con el mouse, sin anillo de teclado).
  await p.click('.fb-ficha-abrir[data-cat="fecha"]'); await p.waitForTimeout(200);
  await p.click(`[data-action="fp-fecha"][data-key="${anio}"]`); await p.waitForTimeout(150);
  await p.click('[data-action="fp-tri"][data-tri="0"]'); await p.waitForTimeout(150);
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  eq("Enter aplica lo elegido", [await abierto(p), (await fichas(p))[1]], [false, `📅 ${anio} · hasta hoy`]);

  // Tocar afuera: no aplica.
  await p.click("#fbFiltros"); await p.waitForTimeout(200);
  await p.click('.fp-item[data-cat="actividad"]'); await p.click('[data-action="fp-tipo"][data-key="curso"]');
  const conCurso = await ver(p);
  await p.click(".feed-solapas"); await p.waitForTimeout(250);
  eq("tocar afuera cierra sin aplicar", [await abierto(p), (await fichas(p)).length], [false, 3]);

  // El ✕ de una ficha la saca al toque.
  await p.click('.fb-ficha-x[data-cat="persona"]'); await p.waitForTimeout(250);
  eq("el ✕ de la ficha saca ese filtro", await fichas(p), ["📍 Argentina", `📅 ${anio} · hasta hoy`]);
  eq("y el número del botón lo sigue", await solapas(p), antesN);
  void conCurso;

  // Los atajos se combinan (antes era uno solo a la vez).
  await p.click("#fbFiltros"); await p.waitForTimeout(200);
  await p.click('.fp-atajos [data-key="mine"]'); await p.click('.fp-atajos [data-key="mes"]'); await p.waitForTimeout(150);
  await p.click(".fp-ver"); await p.waitForTimeout(300);
  eq("Mis posteos y Este mes, juntos", await fichas(p), ["📍 Argentina", "📅 Este mes", "👤 Mis posteos"]);
  eq("la columna de la derecha marca los dos", await p.$$eval(".feed-side .fs-link.active", l => l.map(e => e.dataset.key)), ["mine", "mes"]);

  // «Qué incluir» vive adentro de Lugar, con los números de lo demás puesto.
  await p.click('.fb-ficha-abrir[data-cat="lugar"]'); await p.waitForTimeout(200);
  eq("«Qué incluir» en Lugar: tres niveles", await p.$$eval(".fp-nivel span:not(.dot)", l => l.map(e => e.textContent.trim())), ["Solo acá", "+ Región Sur", "+ Toda LatAm"]);
  await p.click('[data-action="fp-nivel"][data-level="2"]'); await p.waitForTimeout(150);
  eq("elegir un nivel también es borrador", await fichas(p).then(f => f[0]), "📍 Argentina");
  await p.click(".fp-ver"); await p.waitForTimeout(300);
  eq("y al aplicarlo la ficha lo dice", (await fichas(p))[0], "📍 Argentina + LatAm");

  // Guardar lo elegido, desde el panel.
  await p.click("#fbFiltros"); await p.waitForTimeout(200);
  await p.click('.fp-item[data-cat="guardados"]'); await p.waitForTimeout(150);
  await p.click('[data-action="fp-guardar-empezar"]'); await p.waitForTimeout(150);
  await p.type("#fpGuardarNombre", "Lo mío de este mes");
  await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  eq("guardar lo elegido lo suma a Guardados, sin cerrar el panel", [await abierto(p), await p.$$eval('[data-action="fp-guardado"]', l => l.map(e => e.textContent.trim()))], [true, ["💾 Lo mío de este mes"]]);
  const guardado = await p.evaluate(email => ((window.__sb.tablas.user_prefs || []).find(u => u.email === email) || { prefs: {} }).prefs.savedFilters, ADMIN);
  eq("y queda en las preferencias, con cada atajo en su filtro", guardado && guardado.map(g => [g.name, g.quien, g.mes, g.place && g.place.country]), [["Lo mío de este mes", "mine", true, "Argentina"]]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);

  // Limpiar y Volver.
  await p.click('[data-action="clear-filters"]'); await p.waitForTimeout(250);
  eq("«Limpiar» saca todo, también el «Volver»", [await fichas(p), await p.$$eval('[data-action="fp-volver"]', l => l.length)], [[], 0]);
  await tab(p, "reportes"); await p.waitForTimeout(300);
  await p.click('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]'); await p.waitForTimeout(300);
  await p.click('[data-action="fp-volver"]'); await p.waitForTimeout(300);
  eq("«Volver a Reportes» vuelve a Reportes", await p.$eval("nav.tabs button.active", e => e.dataset.view), "reportes");
  eq("compu: sin un solo error", errores, []);
  await p.close();
}

/* ---------- 2) En el celular: la hoja que sube ---------- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.click("#fbFiltros"); await p.waitForTimeout(350);
  eq("celular: abre la lista de filtros", await p.$eval(".fp-panel", e => e.dataset.paso), "lista");
  eq("celular: es una hoja fija abajo, sobre la barra de abajo", await p.$eval(".fp-panel", e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [cs.position, Math.round(r.bottom) === innerHeight, r.top > 0, Number(cs.zIndex) > Number(getComputedStyle(document.getElementById("bottomNav")).zIndex)]; }), ["fixed", true, true, true]);
  eq("celular: la página de atrás no se mueve", await p.evaluate(() => document.documentElement.classList.contains("fp-abierto") && getComputedStyle(document.documentElement).overflow === "hidden"), true);
  eq("celular: la lista, con lo elegido en cada filtro", await p.$$eval(".fp-item", l => l.map(e => [e.dataset.cat, e.querySelector(".fp-item-valor").textContent.trim()])),
    [["actividad", "Todas"], ["lugar", "Toda LatAm"], ["fecha", "Cualquier fecha"], ["persona", "Todo el equipo"], ["guardados", "Ninguno"]]);
  eq("celular: las opciones no se ven todavía", await p.$eval(".fp-opts", e => getComputedStyle(e).display), "none");
  await contarAnimaciones(p);
  await p.click('.fp-item[data-cat="fecha"]'); await p.waitForTimeout(300);
  eq("celular: tocar un filtro pasa a sus opciones, con «← Filtros»", [await p.$eval(".fp-panel", e => e.dataset.paso), await p.$eval(".fp-atras", e => getComputedStyle(e).display !== "none")], ["opciones", true]);
  eq("celular: el foco pasa a las opciones", await p.evaluate(() => !!document.activeElement.closest(".fp-opts")), true);
  await p.click(`[data-action="fp-fecha"][data-key="${anterior}"]`); await p.waitForTimeout(250);
  await p.click(".fp-atras"); await p.waitForTimeout(300);
  eq("celular: «← Filtros» vuelve a la lista, con el foco en Fecha", [await p.$eval(".fp-panel", e => e.dataset.paso), await p.evaluate(() => document.activeElement.dataset.cat)], ["lista", "fecha"]);
  const anims = await animaciones(p);
  eq("celular: la hoja no vuelve a subir en cada toque", anims.filter(a => DE_ABRIR.includes(a)), []);
  eq("celular: las opciones entran de costado", anims.includes("fpDeCostado"), true);
  eq("celular: la lista ya dice lo elegido (sin aplicar)", [await p.$eval('.fp-item[data-cat="fecha"] .fp-item-valor', e => e.textContent.trim()), await fichas(p)], [anterior, []]);
  // El velo es «afuera»: cierra sin aplicar.
  await p.mouse.click(195, 40); await p.waitForTimeout(250);
  eq("celular: tocar arriba de la hoja cierra sin aplicar", [await abierto(p), await fichas(p), await p.evaluate(() => document.documentElement.classList.contains("fp-abierto"))], [false, [], false]);
  eq("celular: sin un solo error", errores, []);
  await p.close();
}

/* ---------- 3) En hebreo, y un filtro guardado con el formato viejo ---------- */
{
  const base = BASE();
  // Antes del 8/10/2026 un guardado traía un solo acceso directo («quick»).
  base.user_prefs = [{ email: ADMIN, prefs: { savedFilters: [{ name: "Viejo", text: "", types: [], zones: [], place: null, quick: "mine", periodo: null }] } }];
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, lang: "he", base });
  await p.click("#fbFiltros"); await p.waitForTimeout(300);
  await p.click('.fp-item[data-cat="guardados"]'); await p.waitForTimeout(250);
  eq("hebreo: la hoja no corre la página de costado", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  eq("hebreo: «← Filtros» espejado", await p.$eval(".fp-atras", e => e.textContent.trim().startsWith("→")), true);
  await p.click('[data-action="fp-guardado"]'); await p.waitForTimeout(300);
  eq("un guardado viejo («quick») vuelve como Mis posteos", [await abierto(p), await p.evaluate(() => [...document.querySelectorAll(".fb-ficha-abrir")].map(e => e.dataset.cat))], [false, ["persona"]]);
  eq("hebreo: sin un solo error", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
