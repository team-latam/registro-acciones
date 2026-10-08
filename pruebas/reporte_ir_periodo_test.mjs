/* ======================================================================
   Tocar una fila de Reportes lleva al Inicio filtrado por ESE período
   (pedido del usuario, 8/10/2026)

   Tocar «Argentina» en el reporte de 2026 abría el Inicio con Argentina
   de todos los años. Ahora también filtra por el período del reporte, con
   la regla del reporte: lo hecho en ese año o trimestre (hasta hoy si
   está en curso), sin lo cancelado. Una ficha «📅 2026 · hasta hoy» lo
   muestra (y abre Fecha para cambiarlo); su ✕ lo saca.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, tab, BASE, post, ciudad, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const hoy = new Date().toISOString().slice(0, 10), anio = hoy.slice(0, 4), anterior = String(Number(anio) - 1);
// Los datos de siempre, más Argentina en el año anterior, una de este año
// que todavía no pasó y una cancelada de este año.
const base = BASE();
base.posts = base.posts.concat([
  post({ id: "ar_antes", title: "Visita a Córdoba del año pasado", start: `${anterior}-05-10`, a: 1, type: "visita", scopes: [ciudad("Argentina", "Córdoba")] }),
  post({ id: "ar_futura", title: "Visita a Mendoza que viene", start: dia(-20), a: 1, type: "visita", scopes: [ciudad("Argentina", "Mendoza")] }),
  post({ id: "ar_cancelada", title: "Visita a Salta cancelada", start: dia(5), a: 1, type: "visita", scopes: [ciudad("Argentina", "Salta")], extra: { cancelled: true, cancelled_at: dia(6), cancelled_by: ADMIN } }),
]);

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
// Las tarjetas del Inicio, por su identificador (una rutina no tiene título).
const enElInicio = () => p.evaluate(() => [...document.querySelectorAll(".post[data-post-id]")].map(c => c.dataset.postId));
const chip = () => p.evaluate(() => { const c = document.querySelector('.fb-ficha-abrir[data-cat="fecha"]'); return c ? c.textContent.replace(/\s+/g, " ").trim() : null; });
const fila = async (kind, key) => {
  const n = await p.evaluate(([kind, key]) => { const f = document.querySelector(`[data-action="reporte-ir"][data-kind="${kind}"][data-key="${key}"]`); return f ? Number(f.querySelector(".rep-num").textContent) : null; }, [kind, key]);
  await p.click(`[data-action="reporte-ir"][data-kind="${kind}"][data-key="${key}"]`); await p.waitForTimeout(300);
  return n;
};
const solapa = () => p.evaluate(() => document.querySelector('[data-action="feed-solapa"].on')?.dataset.key);

// 1) El año en curso: Argentina.
await tab(p, "reportes"); await p.waitForTimeout(300);
await p.selectOption("#repAnio", anio); await p.waitForTimeout(200);
const nAr = await fila("pais", "Argentina");
eq("lleva al Inicio", await p.evaluate(() => !!document.querySelector(".feed-layout")), true);
eq("con la ficha del año en curso", await chip(), `📅 ${anio} · hasta hoy`);
eq("en la solapa de lo hecho", await solapa(), "pasado");
let vistos = await enElInicio();
eq("no trae lo de Argentina del año anterior", vistos.includes("ar_antes"), false);
eq("ni lo que todavía no pasó", vistos.includes("ar_futura"), false);
eq("ni lo cancelado (el reporte tampoco lo cuenta)", vistos.includes("ar_cancelada"), false);
eq("trae lo de Argentina de este año", vistos.includes("p1"), true);
eq("y son tantas como dice la fila del reporte", vistos.length, nAr);
// «Solo acá · + Región · + Toda LatAm» (adentro de Lugar, en el panel de
// filtros) cuenta con el período: «Solo acá» es lo que suman las solapas.
await p.click('.fb-ficha-abrir[data-cat="lugar"]'); await p.waitForTimeout(250);
const cuentas = await p.evaluate(() => ({ soloAca: Number(document.querySelector('.fp-nivel[data-level="0"] b').textContent),
  solapas: [...document.querySelectorAll('[data-action="feed-solapa"] .fs-n')].reduce((s, e) => s + Number(e.textContent), 0) }));
eq("«Solo acá» cuenta lo mismo que las solapas (con el período)", cuentas.soloAca, cuentas.solapas);

await p.keyboard.press("Escape"); await p.waitForTimeout(200);

// 2) Sacar la ficha: vuelve todo Argentina.
await p.click('.fb-ficha-x[data-cat="fecha"]'); await p.waitForTimeout(250);
eq("sin la ficha del período", await chip(), null);
vistos = await enElInicio();
eq("sin período, vuelve lo de Argentina del año anterior", vistos.includes("ar_antes"), true);

// 3) El año anterior, desde una fila de tipo.
await tab(p, "reportes"); await p.waitForTimeout(300);
await p.selectOption("#repAnio", anterior); await p.waitForTimeout(250);
const nVis = await fila("tipo", "visita");
eq("el año anterior: la ficha sin «hasta hoy»", await chip(), `📅 ${anterior}`);
vistos = await enElInicio();
eq("trae las visitas de ese año", vistos.includes("ar_antes"), true);
eq("y no las de este año", vistos.includes("p1"), false);
eq("tantas como dice la fila", vistos.length, nVis);

// 4) Un trimestre: el chip lo dice.
await tab(p, "reportes"); await p.waitForTimeout(300);
await p.selectOption("#repTri", "2"); await p.waitForTimeout(250);
await fila("pais", "Argentina");
eq("un trimestre: la ficha dice cuál", await chip(), `📅 2.º trimestre ${anterior}`);
eq("en ese trimestre está la visita de mayo", (await enElInicio()).includes("ar_antes"), true);

// 5) Guardar el filtro con nombre lo guarda con su período.
await p.click('[data-action="feed-saved-start"]'); await p.fill("#savedFilterName", "Argentina T2"); await p.click('[data-action="feed-saved-save"]'); await p.waitForTimeout(250);
await p.click('.fb-ficha-x[data-cat="fecha"]'); await p.waitForTimeout(200);
await p.click('[data-action="feed-saved-apply"][data-idx="0"]'); await p.waitForTimeout(250);
eq("un filtro guardado vuelve con su período", await chip(), `📅 2.º trimestre ${anterior}`);

eq("sin un solo error en la página", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
