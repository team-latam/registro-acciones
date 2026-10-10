/* ======================================================================
   Reportes → Inicio lista exactamente lo que la fila contó (10/10/2026, R7)

   La fila «Argentina N» cuenta solo lo propio del país y solo por el
   alcance del posteo. El Inicio, al llegar desde esa fila, tiene que dar N
   aunque la preferencia «Qué incluir» de la persona esté en «+ Región» (un
   posteo de la región Sur no entra) y aunque un comentario de otro posteo
   lleve alcance Argentina (tampoco entra).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, BASE, post, ciudad, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const anio = dia(0).slice(0, 4);
const base = BASE();
base.user_prefs = [{ email: ADMIN, prefs: { placeLevel: 1 } }];   // «+ lo de su región»
base.posts = base.posts.concat([
  post({ id: "region_sur", title: "Encuentro de la región Sur", d: 10, a: 0, type: "seminario", scopes: [{ type: "region", region: "sur" }], content: "De toda la región." }),
  post({ id: "chile_coment", title: "Visita a Valparaíso", d: 12, a: 2, type: "visita", scopes: [ciudad("Chile", "Valparaíso")], content: "Con un comentario que habla de Argentina." }),
]);
base.replies = base.replies.concat([{ id: "r_ar", post_id: "chile_coment", content: "Lo mismo para Argentina.", author_name: "Benny Rosenthal", author_email: ADMIN, created_at: dia(11), scopes: [ciudad("Argentina", "Rosario")], links: [], images: [], files: [], mentions: [], liked_by: [], system: false }]);

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
const enElInicio = () => p.evaluate(() => [...document.querySelectorAll(".post[data-post-id]")].map(c => c.dataset.postId));
await tab(p, "reportes"); await p.waitForTimeout(300);
await p.selectOption("#repAnio", anio).catch(() => {}); await p.waitForTimeout(200);
const n = await p.evaluate(() => { const f = document.querySelector('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]'); return f ? Number(f.querySelector(".rep-num").textContent) : null; });
await p.click('[data-action="reporte-ir"][data-kind="pais"][data-key="Argentina"]'); await p.waitForTimeout(400);
const lista = await enElInicio();
eq("la lista del Inicio da el mismo número que la fila, con la preferencia en «+ Región»", lista.length, n);
eq("el posteo de la región Sur no entra", lista.includes("region_sur"), false);
eq("el posteo de Chile con un comentario de Argentina no entra", lista.includes("chile_coment"), false);
// Al cambiar «Qué incluir» en el panel, lo elegido le gana a lo que fijó la fila.
await p.click("#fbFiltros"); await p.waitForTimeout(300);
await p.click('.fp-item[data-cat="lugar"]'); await p.waitForTimeout(250);
const niveles = await p.$$eval(".fp-nivel", l => l.map(e => [e.dataset.nivel || e.dataset.key || e.textContent.trim().slice(0, 12), e.classList.contains("on")]));
eq("el panel muestra «Solo acá» como lo aplicado (lo que fijó la fila), no la preferencia", niveles.length ? niveles[0][1] : null, true);
eq("sin errores en la página", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
