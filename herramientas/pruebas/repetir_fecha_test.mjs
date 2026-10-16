/* ======================================================================
   «Repetir» propone la fecha del año que viene (13/10/2026, segunda
   vuelta de propuestas, opción 2-A)

   «Repetir este evento» ya existía: copia tipo, lugar, gente y texto y abre
   el evento nuevo fechado hoy. Para los eventos de todos los años (el curso,
   el congreso) el usuario pidió que, si el original es de hace más de 6
   meses, proponga la próxima vez que cae ese día, con la misma duración, y
   lo diga en una línea; uno más reciente sigue arrancando hoy. Si la persona
   cambia la fecha, la línea sobra y se va.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const hoy = new Date().toISOString().slice(0, 10);
const bisiesto = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
// La próxima vez que cae ese día, contada acá por separado de la app.
function proximaVez(original){
  const md = original.slice(5);
  const cae = a => md === "02-29" && !bisiesto(a) ? `${a}-02-28` : `${a}-${md}`;
  let a = Number(hoy.slice(0, 4));
  if(cae(a) < hoy) a++;
  return cae(a);
}
const suma = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const comoSeVe = iso => `📅${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const lugar = [ciudad("Uruguay", "Montevideo")];
const datos = () => {
  const base = BASE();
  base.posts = base.posts.concat([
    post({ id: "pviejo", title: "Congreso anual", start: dia(400), end: dia(397), type: "congreso", scopes: lugar }),      // el del año pasado, 4 días
    post({ id: "pmedio", title: "Curso de verano", start: dia(200), end: dia(200), type: "curso", scopes: lugar }),          // hace más de 6 meses
    post({ id: "preciente", title: "Taller reciente", start: dia(150), end: dia(148), type: "curso", scopes: lugar }),       // hace menos de 6 meses
    post({ id: "pmuyviejo", title: "Seminario histórico", start: dia(1000), end: dia(999), type: "seminario", scopes: lugar }),
  ]);
  return base;
};

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos() });

// Abre «Repetir» desde el menú ⋯ de la tarjeta y lee lo que propone el formulario.
async function repetir(id, titulo){
  await p.fill("#feedSearch", titulo); await p.waitForTimeout(600);
  await p.click(`[data-action="toggle-post-menu"][data-post-id="${id}"]`);
  await p.click('.post-menu [data-action="duplicate-post"]'); await p.waitForTimeout(400);
  return {
    fechas: await p.$$eval(".date-trigger", l => l.map(e => e.textContent.trim())),
    aviso: await p.$eval("#cFechaPropuesta", e => e.textContent).catch(() => null),
  };
}
const cerrar = async () => { await p.click('[data-action="cancel-composer"]'); await p.waitForTimeout(300); if(await p.waitForSelector("#confirmOk", { state: "visible", timeout: 700 }).then(() => true, () => false)) await p.click("#confirmOk"); await p.fill("#feedSearch", ""); };

// Del año pasado: propone la próxima vez que cae ese día, con los mismos 3 días de duración.
{
  const orig = dia(400), prox = proximaVez(orig);
  const r = await repetir("pviejo", "Congreso anual");
  eq("el del año pasado: propone la próxima vez que cae ese día", r.fechas, [comoSeVe(prox), comoSeVe(suma(prox, 3))]);
  eq("…y no es hoy ni una fecha ya pasada", prox >= hoy && prox !== hoy, true);
  eq("…y lo dice en una línea, con la fecha del original", r.aviso && r.aviso.includes(comoSeVe(orig).slice(2)), true);
  // Si la persona cambia la fecha, la línea se va.
  await p.click('[data-df-kind="composer-start"]'); await p.waitForTimeout(300);
  const dias = await p.$$('.date-pop:not([hidden]) .dp-day:not(.out):not([disabled])');
  // Un día distinto del propuesto, sea cual sea el de hoy (con «dias[10]» fijo, el 11 de cada mes daba justo la fecha propuesta y la prueba fallaba ese día).
  if(dias.length){ await dias[(Number(prox.slice(8)) - 1 + 5) % 25].click(); await p.waitForTimeout(300); }
  eq("al elegir otra fecha, la línea se va", dias.length > 0 && await p.$("#cFechaPropuesta") === null, true);
  eq("…y la fecha cambió", (await p.$$eval(".date-trigger", l => l.map(e => e.textContent.trim())))[0] !== comoSeVe(prox), true);
  await p.click('[data-action="cancel-composer"]'); await p.waitForTimeout(300);
  // Hay cambios sin guardar: pregunta, y se descartan.
  if(await p.waitForSelector("#confirmOk", { state: "visible", timeout: 1500 }).then(() => true, () => false)) await p.click("#confirmOk");
  await p.waitForTimeout(300);
  await p.fill("#feedSearch", "");
}
// Una fecha que ya pasó este año cae el año que viene; una que todavía no, este año.
{
  const orig = dia(200), prox = proximaVez(orig);
  const r = await repetir("pmedio", "Curso de verano");
  eq("hace más de 6 meses: propone esa fecha", r.fechas, [comoSeVe(prox), comoSeVe(prox)]);
  eq("…con la línea", !!r.aviso, true);
  await cerrar();
}
// Uno de hace dos años o más: nunca una fecha ya pasada.
{
  const orig = dia(1000), prox = proximaVez(orig);
  const r = await repetir("pmuyviejo", "Seminario histórico");
  eq("hace casi tres años: igual propone una fecha futura", [r.fechas[0], prox >= hoy], [comoSeVe(prox), true]);
  await cerrar();
}
// Reciente (menos de 6 meses): como siempre, desde hoy y sin línea.
{
  const r = await repetir("preciente", "Taller reciente");
  eq("hace menos de 6 meses: arranca hoy con la misma duración", r.fechas, [comoSeVe(hoy), comoSeVe(suma(hoy, 2))]);
  eq("…y sin línea", r.aviso, null);
  await cerrar();
}
eq("sin errores en la consola", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
