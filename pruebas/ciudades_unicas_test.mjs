/* ======================================================================
   Una ciudad escrita de dos maneras es una sola entrada (auditoría del
   10/10/2026, R21)

   «Cordoba» y «Córdoba» son la misma ciudad para la app (nivelDeAlcance las
   junta con normalize), pero «Buscar en todo» y el panel de Lugar de los
   filtros usaban «país|ciudad» sin normalizar: salían dos entradas que se
   ven idénticas. Ahora una sola, con el nombre bien escrito, que al elegirla
   trae lo cargado con las dos escrituras.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const base = BASE();
// Córdoba ya está en los datos de siempre (con tilde); se suma lo cargado con la escritura de la lista de ciudades, sin tilde,
// y una ciudad de otro país con el mismo nombre normalizado, que NO tiene que juntarse.
base.posts = base.posts.concat([
  post({ id: "cba_sin_tilde", title: "Visita a Cordoba sin tilde", d: 12, a: 1, type: "visita", scopes: [ciudad("Argentina", "Cordoba")], content: "Escrita sin tilde." }),
  post({ id: "cba_mx", title: "Reunión en Córdoba de México", d: 14, a: 1, type: "visita", scopes: [ciudad("México", "Cordoba")], content: "Otro país." }),
]);
const b = await abrirNavegador();
for(const lang of ["", "he"]){
  const idioma = lang || "es";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, lang, base });

  // ---- «Buscar en todo» ----
  await p.click("#globalSearchInput"); await p.fill("#globalSearchInput", "cordoba"); await p.waitForTimeout(350);
  const ciudades = await p.$$eval('#globalResults [data-action="gs-city"]', l => l.map(e => ({ pais: e.dataset.country, ciudad: e.dataset.city, texto: e.querySelector("b").textContent.trim() })));
  const arg = ciudades.filter(c => c.pais === "Argentina");
  eq(`[${idioma}] buscar en todo: «cordoba» da una sola Córdoba de Argentina (antes, dos)`, arg.length, 1);
  eq(`[${idioma}] y la de otro país con el mismo nombre queda aparte`, ciudades.filter(c => c.pais === "México").length, 1);
  if(!lang) eq("buscar en todo: con el nombre bien escrito", arg.map(c => c.texto), ["Córdoba"]);

  // Elegirla trae lo cargado con las dos escrituras.
  await p.evaluate(() => { document.querySelector('#globalResults [data-action="gs-city"][data-country="Argentina"]').click(); });
  await p.waitForTimeout(600);
  const titulos = await p.$$eval(".post .post-titulo, .post .post-content", l => l.map(e => e.textContent.trim()));
  eq(`[${idioma}] y el Inicio filtrado trae los posteos de las dos escrituras`, [titulos.some(x => /Visita a Cordoba sin tilde/.test(x)), titulos.some(x => /Curso de primeros auxilios/.test(x)), titulos.some(x => /Córdoba de México/.test(x))], [true, true, false]);

  // ---- El panel de Lugar de los filtros ----
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.reload(); await p.waitForTimeout(1200);
  await click(p, "#fbFiltros"); await p.waitForTimeout(300);
  await click(p, '.fp-item[data-cat="lugar"]'); await p.waitForTimeout(300);
  await p.fill("#fpLugarQ", "cord"); await p.waitForTimeout(300);
  const ops = await p.$$eval('.fp-sugs [data-action="fp-lugar"][data-city]', l => l.map(e => ({ pais: e.dataset.country, ciudad: e.dataset.city, texto: e.querySelector("span").textContent.trim() })));
  eq(`[${idioma}] panel de Lugar: «cord» da una sola Córdoba de Argentina`, ops.filter(o => o.pais === "Argentina").length, 1);
  eq(`[${idioma}] y la de México aparte`, ops.filter(o => o.pais === "México").length, 1);
  if(!lang) eq("panel de Lugar: con el nombre bien escrito", ops.filter(o => o.pais === "Argentina").map(o => o.texto), ["📍 Córdoba"]);
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
