/* ======================================================================
   «Ver más» suma tarjetas, no rehace el Inicio (docs/AUDITORIA.md, M7)

   Con 2.000 posteos, cada «Ver más» rehacía la lista entera (356 ms; en
   el celular, el triple). Ahora suma las tarjetas nuevas al final: las
   que ya estaban son los MISMOS elementos (no se vuelven a crear), en el
   orden de siempre. Si lo dibujado no coincide con lo que tocaría (algo
   cambió sin dibujarse), se dibuja todo como antes.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const base = BASE();
for(let i = 0; i < 60; i++) base.posts.push(post({ id: "vm" + i, title: "Visita número " + i, d: 30 + i * 3, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "Texto " + i }));
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { base, viewport: { width: 1280, height: 800 } });

const estado = () => p.evaluate(() => {
  const arts = [...document.querySelectorAll("#viewRoot article.post")];
  return { n: arts.length, ids: arts.map(a => a.dataset.postId), marcadas: arts.filter(a => a.__marca).length, boton: !!document.querySelector('[data-action="feed-load-more"]') };
});
const marcar = () => p.evaluate(() => document.querySelectorAll("#viewRoot article.post").forEach(a => { a.__marca = 1; }));
const verMas = () => p.evaluate(() => document.querySelector('[data-action="feed-load-more"]').click());

const e0 = await estado();
eq("arranca con una tanda y el botón «Ver más»", [e0.n > 0, e0.n < base.posts.length, e0.boton], [true, true, true]);
await marcar();
await verMas(); await p.waitForTimeout(300);
const e1 = await estado();
eq("«Ver más» suma 15 tarjetas", e1.n - e0.n, 15);
eq("las que ya estaban siguen siendo las mismas (no se rehizo la lista)", e1.marcadas, e0.n);
eq("y las de antes quedan en su lugar, en el mismo orden", e1.ids.slice(0, e0.n), e0.ids);
eq("sin repetidas", new Set(e1.ids).size, e1.n);
eq("el foco va a la primera tarjeta nueva", await p.evaluate(n => document.activeElement === document.querySelectorAll("#viewRoot article.post")[n], e0.n), true);

// Lo mismo que daría dibujar todo de cero: se fuerza el camino de antes
// sacando una tarjeta a mano (lo dibujado ya no coincide).
await marcar();
await p.evaluate(() => { const a = document.querySelectorAll("#viewRoot article.post"); a[a.length - 1].remove(); });
await verMas(); await p.waitForTimeout(300);
const e2 = await estado();
eq("si lo dibujado no coincide, se dibuja todo de nuevo (ninguna marcada)", e2.marcadas, 0);
eq("y con la cuenta bien: 15 más que antes", e2.n, e1.n + 15);
eq("en el mismo orden que la suma", e2.ids.slice(0, e1.n), e1.ids);

// Hasta el final: el botón desaparece cuando no queda nada.
for(let i = 0; i < 10 && (await estado()).boton; i++){ await verMas(); await p.waitForTimeout(150); }
const e3 = await estado();
eq("al final no queda botón y están todas", [e3.boton, e3.n === new Set(e3.ids).size], [false, true]);
eq("sin un solo error en la página", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
