/* ======================================================================
   Las horas de un evento dicen de qué zona son (auditoría del 20/11/2026, Y4; D22-A)

   Todo evento con hora se crea en Google Calendar con la zona del calendario compartido del equipo
   (hoy, Buenos Aires), sea cual sea el lugar, y la pantalla mostraba «09:00–17:00» sin más: para
   alguien en Ciudad de México o en Israel, «15:00» era ambiguo. Ahora el formulario dice, junto a
   las horas, «🕘 Hora de Buenos Aires, la del Calendar del equipo» (la zona va según el calendario), y la hora de cada tarjeta lo
   dice al pasar el dedo. Un evento de todo el día no trae la nota (no tiene hora).
   No se cambió qué zona usa Calendar: solo se la nombra.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const b = await abrirNavegador();
const nota = p => p.evaluate(() => { const e = document.getElementById("cZonaHoraria"); return e && e.offsetParent ? e.textContent.replace(/\s+/g, " ").trim() : null; });
// Un evento nuevo arranca como «Todo el día»: las horas (y la nota de su zona) aparecen al destildarlo.
const abrirNuevoEvento = async (p, conHoras = true) => { await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(600);
  if(conHoras && await p.$eval("#cAllDay", e => e.checked)){ await p.click("#cAllDay"); await p.waitForTimeout(400); } };

// 1) Español: la nota junto a las horas, y desaparece con «Todo el día».
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es" });
  await p.waitForTimeout(500);
  await abrirNuevoEvento(p);
  const texto = await nota(p);
  ok("el formulario nombra la zona de las horas, en español", /^🕘 Hora de .+, la del Calendar del equipo\.$/.test(texto || ""), String(texto));
  // La zona es la que usa la app para crear el evento en Calendar (la del calendario del equipo; si todavía no se leyó, la del aparato).
  // Con el Supabase de mentira no hay calendario leído: es la del aparato, y es la MISMA que nombra la nota.
  const zonaDelAparato = await p.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop().replace(/_/g, " "));
  ok("y nombra la zona con la que se crea el evento en Calendar", (texto || "").includes(`Hora de ${zonaDelAparato},`), `${texto} (zona: ${zonaDelAparato})`);
  // Una nota que se mide como las demás: dentro de la ventana y sin recortarse.
  eq("la nota entra en su renglón (no se corta)", await p.evaluate(() => { const e = document.getElementById("cZonaHoraria"); return !!e && e.scrollWidth <= e.clientWidth + 1; }), true);
  // «Todo el día»: sin horas, sin nota.
  await p.click("#cAllDay"); await p.waitForTimeout(400);
  eq("con «Todo el día» no hay horas ni nota", await nota(p), null);
  await p.close(); }
// 2) Las otras lenguas: el mismo dato, en su idioma.
for(const [lang, patron] of [["en", /^🕘 Time in .+, the team Calendar's\.$/], ["pt", /^🕘 Horário de .+, o do Calendar da equipe\.$/]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang });
  await p.waitForTimeout(500);
  await abrirNuevoEvento(p);
  const texto = await nota(p);
  ok(`${lang}: la nota está en su idioma`, patron.test(texto || ""), String(texto));
  await p.close(); }
// 3) La hora de una tarjeta dice la zona al pasar el dedo.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es" });
  await p.waitForTimeout(600);
  const horas = await p.$$eval(".post .hora", es => es.map(e => ({ texto: e.textContent.trim(), titulo: e.getAttribute("title") })));
  ok("hay actividades con hora en el Inicio", horas.length > 0);
  ok("cada hora trae su zona en el title", horas.length > 0 && horas.every(h => /^Hora de .+, la del Calendar del equipo\.$/.test(h.titulo || "")), JSON.stringify(horas.slice(0, 2)));
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
