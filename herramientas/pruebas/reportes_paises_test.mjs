/* ======================================================================
   Reportes: «Por país» no estira a los otros dos (13/10/2026)

   El usuario vio «Por zona», «Por país» y «Por tipo» lado a lado: el de países
   tenía 25 filas y los otros dos, 4 y 7, quedaban con la mitad de la tarjeta
   vacía. Pidió que «Por país» llegue hasta la altura de «Congreso» incluido,
   es decir 7 filas. Lo que esta prueba cuida:
   - «Por país» muestra 7 filas, las de más actividades, y «Ver los N países»
     (arriba a la derecha, en el renglón del título, para que la tarjeta corte
     justo a la altura de «Por tipo») despliega el resto; «Mostrar menos» lo vuelve a plegar; lo desplegado se
     acuerda aunque el reporte se vuelva a dibujar;
   - con 7 países o menos no hay botón; «Por zona» y «Por tipo» no cambian;
   - al imprimir salen todos, sin el botón, y la planilla del reporte (CSV)
     lleva siempre todos los países;
   - en inglés y en hebreo, y en el celular.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import fs from "node:fs";
import { abrirNavegador, entrar, ADMIN, BASE, post, pais, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Doce países, cada uno con una actividad más que el siguiente: el orden es claro. Y los siete tipos.
const PAISES = ["Argentina", "Brasil", "Chile", "Uruguay", "Paraguay", "Perú", "Bolivia", "Colombia", "México", "Panamá", "Cuba", "Venezuela"];
const TIPOS = ["visita", "curso", "seminario", "congreso", "virtual", "rutina", "otro"];
const datos = (cuantos = 12) => {
  const base = BASE(); base.replies = []; base.posts = [];
  PAISES.slice(0, cuantos).forEach((p, i) => {
    const veces = cuantos - i;
    for(let k = 0; k < veces; k++) base.posts.push(post({ id: `${i}_${k}`, title: `Actividad ${p} ${k}`, start: dia(1 + (k % 20)), a: 1, type: TIPOS[(i + k) % TIPOS.length], scopes: [pais(p)] }));
  });
  return base;
};
const vp = { width: 1280, height: 900 };
const b = await abrirNavegador();

// El bloque «Por país»: sus filas (todas, y las que se ven), el botón y las etiquetas.
const bloque = (p, titulo = "Por país") => p.evaluate(t => {
  const bl = [...document.querySelectorAll(".rep-bloque")].find(e => (e.querySelector("h3") || {}).textContent.trim() === t);
  if(!bl) return null;
  const filas = [...bl.querySelectorAll(".rep-fila")], boton = bl.querySelector(".rep-ver-todo");
  return { filas: filas.length, vistas: filas.filter(e => e.offsetParent !== null).length, etiquetas: filas.filter(e => e.offsetParent !== null).map(e => e.querySelector(".rep-etiqueta").textContent.trim()),
    boton: boton ? [boton.textContent.trim(), boton.getAttribute("aria-expanded"), boton.offsetParent !== null] : null, alto: Math.round(bl.getBoundingClientRect().height) };
}, titulo);
const abrir = async p => { await tab(p, "reportes"); await p.waitForSelector(".rep-total-num"); };

/* ---- Doce países ---- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await abrir(p);
  const a = await bloque(p);
  eq("«Por país»: 12 filas en la página, 7 a la vista, las de más actividades primero", [a.filas, a.vistas, a.etiquetas], [12, 7, ["Argentina", "Brasil", "Chile", "Uruguay", "Paraguay", "Perú", "Bolivia"]]);
  eq("…y el botón «Ver los 12 países», plegado", a.boton, ["Ver los 12 países", "false", true]);
  const tipo = await bloque(p, "Por tipo"), zona = await bloque(p, "Por zona");
  eq("«Por tipo» tiene sus 7 filas y «Por zona» las suyas, sin botón", [tipo.filas, tipo.vistas, tipo.boton, zona.boton], [7, 7, null, null]);
  eq("«Por país» corta justo a la altura de «Por tipo»: la misma altura, porque el botón va en el renglón del título y no suma una fila", Math.abs(a.alto - tipo.alto) <= 2, true);
  eq("el botón está arriba, a la derecha del título, y no debajo de las filas", await p.evaluate(() => { const bl = [...document.querySelectorAll(".rep-bloque")].find(e => (e.querySelector("h3") || {}).textContent.trim() === "Por país"); const b = bl.querySelector(".rep-ver-todo").getBoundingClientRect(), h = bl.querySelector("h3").getBoundingClientRect(), f = bl.querySelector(".rep-fila").getBoundingClientRect(); return [Math.abs(b.top - h.top) < 12, b.bottom <= f.top + 1, b.left > h.right]; }), [true, true, true]);

  await p.click('.rep-ver-todo[data-id="paises"]'); await p.waitForTimeout(150);
  const d = await bloque(p);
  eq("«Ver los 12 países» los muestra todos y el botón pasa a «Mostrar menos»", [d.vistas, d.boton, d.alto > a.alto], [12, ["Mostrar menos", "true", true], true]);
  // Se acuerda aunque el reporte se vuelva a dibujar.
  await p.click('[data-action="reporte-filtros"]'); await p.waitForTimeout(250); await p.click('.rep-filtros-pie [data-action="reporte-filtros"]'); await p.waitForTimeout(250);
  eq("lo desplegado se acuerda cuando el reporte se vuelve a dibujar", (await bloque(p)).vistas, 12);
  await p.click('.rep-ver-todo[data-id="paises"]'); await p.waitForTimeout(150);
  eq("«Mostrar menos» lo vuelve a plegar", [(await bloque(p)).vistas, (await bloque(p)).boton[0]], [7, "Ver los 12 países"]);

  // La planilla del reporte lleva todos los países, plegado o no.
  const [bajada] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), p.click('[data-action="reporte-csv"]')]);
  const csv = fs.readFileSync(await bajada.path(), "utf8");
  eq("la planilla del reporte (CSV) trae los 12 países aunque se vean 7", PAISES.every(x => csv.includes(x)), true);

  // Al imprimir salen todos y no el botón.
  await p.emulateMedia({ media: "print" }); await p.waitForTimeout(150);
  const im = await bloque(p);
  eq("al imprimir: los 12 países y sin el botón", [im.vistas, im.boton && im.boton[2]], [12, false]);
  await p.emulateMedia({ media: "screen" });
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Siete países o menos: sin botón ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos(7) });
  await abrir(p);
  const a = await bloque(p);
  eq("con 7 países no hay botón y se ven los 7", [a.filas, a.vistas, a.boton], [7, 7, null]);
  await p.close();
}

/* ---- En inglés y en hebreo ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "en", base: datos() });
  await abrir(p);
  const a = await bloque(p, "By country");
  eq("en inglés: «See all 12 countries»", a && a.boton[0], "See all 12 countries");
  await p.click('.rep-ver-todo[data-id="paises"]'); await p.waitForTimeout(150);
  eq("…y «Show less»", (await bloque(p, "By country")).boton[0], "Show less");
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "he", base: datos() });
  await abrir(p);
  eq("en hebreo el botón está traducido", (await p.$eval(".rep-ver-todo", e => e.textContent.trim())).includes("12"), true);
  await p.close();
}

/* ---- En el celular ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 800 }, lang: "es", base: datos() });
  await p.click('[data-action="toggle-more-menu"]'); await p.click('.bn-sheet [data-view="reportes"]'); await p.waitForSelector(".rep-total-num");
  const a = await bloque(p);
  eq("en el celular: 7 a la vista y el botón; la página no se corre de costado", [a.vistas, a.boton && a.boton[0], await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)], [7, "Ver los 12 países", true]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
