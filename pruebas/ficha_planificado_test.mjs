/* ======================================================================
   La ficha de un lugar cuenta solo lo que ya pasó (10/10/2026, R1)

   Con una visita a Rosario planificada para mañana: «Última visita» sigue
   siendo la de hace dos días, «visitas en los últimos 12 meses» no la
   suma, el Ritmo y su «N registros en 12 meses» tampoco, y en la ficha de
   Argentina la fila de Rosario no dice «último: hace 0 días». Tercera vez
   que vuelve esta falla (auditoria/RECURRENTES.md).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const conFutura = (si) => {
  const base = BASE();
  if(si) base.posts = base.posts.concat([post({ id: "manana", title: "Visita a Rosario de mañana", d: -1, a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "Todavía no pasó." })]);
  return base;
};
const b = await abrirNavegador();
async function ficha(base){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await tab(p, "paises"); await p.evaluate(() => document.querySelector('[data-action="drill-country"][data-country="Argentina"]').click()); await p.waitForTimeout(400);
  const filaRosario = await p.evaluate(() => { const f = [...document.querySelectorAll('[data-action="drill-city"][data-city="Rosario"]')].map(e => e.closest(".fl-hijo") || e.parentElement); return f.length ? f[0].innerText.replace(/\s+/g, " ").trim() : null; });
  await p.evaluate(() => document.querySelector('[data-action="drill-city"][data-city="Rosario"]').click()); await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    lectura: document.querySelector(".fl-lectura")?.innerText.replace(/\s+/g, " ").trim() || "",
    ritmo: document.querySelector('.fl-pliegue[data-que="ritmo"] .r, .fl-card:has(.fl-ritmo) .fl-lado-t + *')?.textContent.trim() || document.querySelector(".fl-card:has(.fl-ritmo)")?.innerText.replace(/\s+/g, " ").trim() || "",
    barras: [...document.querySelectorAll(".fl-ritmo i")].map(i => i.title),
    kpiUltima: [...document.querySelectorAll(".fl-kpi, .fl-kpis > *")].map(e => e.innerText.replace(/\s+/g, " ").trim()).find(t => /Última|Latest/i.test(t)) || "",
  }));
  await p.close();
  return { ...r, filaRosario };
}
const sin = await ficha(conFutura(false)), con = await ficha(conFutura(true));
eq("«Última visita» no cambia por una visita de mañana", con.lectura.split(".")[0], sin.lectura.split(".")[0]);
eq("«visitas en los últimos 12 meses» no la cuenta", /Fue la única|única de los últimos 12 meses/.test(con.lectura), /Fue la única|única de los últimos 12 meses/.test(sin.lectura));
eq("el Ritmo («N registros en 12 meses») no la cuenta", con.ritmo.match(/\d+ registro/)?.[0] || con.ritmo, sin.ritmo.match(/\d+ registro/)?.[0] || sin.ritmo);
eq("la barra del mes en curso no la cuenta", con.barras.at(-1), sin.barras.at(-1));
eq("en Argentina, la fila de Rosario sigue diciendo «último: hace 2 días»", (con.filaRosario || "").includes("hace 2 días"), true);
eq("la cifra de «Última» de la ficha no cambia", con.kpiUltima, sin.kpiUltima);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
