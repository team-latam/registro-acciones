/* ======================================================================
   «Sugerencias» de Reportes no manda a planificar meses de antes de usar el sistema
   (auditoría del 20/11/2026, Y6)

   Con un equipo que empezó a cargar en octubre, «Sugerencias para 2027» decía «No hubo actividad
   en enero, febrero, … agosto y septiembre: conviene planificar algo para esos meses»: meses que
   ya pasaron y en los que el sistema todavía no existía. Ahora los meses vacíos se cuentan desde
   el primer mes con algo cargado. Y «Solo el 0% de las actividades tiene participantes» pasa a
   «Ninguna actividad tiene participantes cargados».

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, hace, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const VACIO = { images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {} };
const fila = (id, d, extra = {}) => ({ id, date: d, start_date: d, end_date: d, activity_type: "visita", title: "Visita " + id, content: "", author_name: "Ana Pérez", author_email: "ana@team-latam.com",
  created_at: d + "T12:00:00Z", scopes: [{ type: "ciudad", country: "Chile", city: "Santiago" }], ...VACIO, ...extra });
const sinGastos = b => { for(const k of Object.keys(b)) if(k === "gastos" || k.startsWith("gastos_")) b[k] = []; return b; };
const equipo = fechas => { const b = sinGastos(BASE()); b.posts = fechas.map((d, i) => fila("s" + i, d)); b.replies = []; return b; };
const sugerencias = async (b, base) => { const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await p.waitForTimeout(300); await tab(p, "reportes"); await p.waitForTimeout(500);
  const t = await p.evaluate(() => (document.getElementById("viewRoot") || document.body).innerText);
  await p.close(); return t; };

const hoy = new Date(), anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
const b = await abrirNavegador();
// 1) Un equipo que empezó hace poco: nada de «no hubo actividad» para los meses de antes.
if(mes >= 4){
  const reciente = [dia(40), dia(35), dia(20), dia(10), dia(5), dia(3)].filter(d => d.startsWith(String(anio)));
  const txt = await sugerencias(b, equipo(reciente));
  const primero = reciente.map(d => d.slice(5, 7)).sort()[0];
  ok("equipo que empezó hace poco: no se manda a planificar los meses de antes de su primera actividad", !/No hubo actividad en [^:]*enero/i.test(txt), txt.match(/No hubo actividad en [^:]+/)?.[0] || "(sin la frase)");
  ok("…ni la sección «Sugerencias» dice «conviene planificar» por esos meses", !(primero !== "01" && /conviene planificar algo para esos meses/.test(txt) && /enero/.test(txt)));
}
// 2) Un equipo con datos desde enero y un hueco en el medio: ese mes sí se nombra.
if(mes >= 5){
  const fechas = [`${anio}-01-15`, `${anio}-02-10`, `${anio}-03-12`, `${anio}-05-08`, dia(2)].filter(d => d <= dia(0));
  const txt = await sugerencias(b, equipo(fechas));
  ok("con datos desde enero, el mes vacío del medio sí se nombra (abril)", /No hubo actividad en abril/i.test(txt), txt.match(/No hubo actividad en [^:]+/)?.[0] || "(sin la frase)");
}
// 3) Sin ningún participante cargado: «Ninguna…», no «Solo el 0%».
{ const txt = await sugerencias(b, equipo([dia(30), dia(25), dia(20), dia(15), dia(10), dia(5)]));
  ok("sin participantes cargados dice «Ninguna actividad tiene participantes cargados»", /Ninguna actividad tiene participantes cargados/.test(txt), txt.match(/(Solo el|Ninguna)[^.]*participantes[^.]*\./)?.[0] || "(sin la frase)");
  ok("y no dice «Solo el 0%»", !/Solo el 0%/.test(txt)); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
