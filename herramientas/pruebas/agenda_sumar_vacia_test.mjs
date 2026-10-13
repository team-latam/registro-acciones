/* ======================================================================
   «+ Sumar» con la Agenda vacía (auditoría del 10/10/2026, R21)

   Con la Agenda vacía, «+ Sumar» abría siempre «Nueva institución», aunque
   la persona se sumara a un país, una región o una ciudad: ahí no hace falta
   crear una institución antes. Solo cuando la persona va a una institución
   (desde la lista de la Agenda) se pide primero la institución.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const vacia = () => { const base = BASE(); base.instituciones = []; base.contactos = []; return base; };
const b = await abrirNavegador();
const formulario = p => p.evaluate(() => {
  const o = document.getElementById("agendaOverlay");
  if(o.hidden) return { abierta: false };
  const sumar = document.getElementById("agendaForm"), inst = document.getElementById("agendaFormInst");
  const nivel = document.querySelector('#agendaBody [data-action="agenda-form-nivel"].on, #agendaBody [data-action="agenda-form-nivel"][aria-checked="true"], #agendaBody [data-action="agenda-form-nivel"][aria-pressed="true"]');
  return { abierta: true, persona: !!sumar, institucion: !!inst, nivel: nivel ? nivel.dataset.k : null, titulo: (document.getElementById("agendaTitulo") || {}).textContent };
});
const abrir = async (p, cuerpo) => { await p.evaluate(cuerpo); await p.waitForTimeout(600); };
const sumarEn = async p => { await p.evaluate(() => { const x = [...document.querySelectorAll('[data-action="agenda-sumar"]')].find(e => !e.closest("#agendaOverlay") && e.offsetParent !== null); x && x.click(); }); await p.waitForTimeout(500); };
const cerrar = async p => { await p.keyboard.press("Escape"); await p.waitForTimeout(250); await p.keyboard.press("Escape"); await p.waitForTimeout(250); };

const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: vacia() });
await tab(p, "paises"); await p.waitForTimeout(300);
eq("la Agenda está vacía (la prueba mide algo)", await p.evaluate(() => [window.__sb.tablas.instituciones.length, window.__sb.tablas.contactos.length]), [0, 0]);

// ---- Un país ----
await abrir(p, () => document.querySelector('[data-action="drill-country"][data-country="Argentina"]').click());
await sumarEn(p);
let f = await formulario(p);
eq("ficha de un país, Agenda vacía: «+ Sumar» abre «Sumar a alguien» (no «Nueva institución»)", [f.abierta, f.persona, f.institucion], [true, true, false]);
eq("y viene con «País» elegido", f.nivel, "pais");
await cerrar(p);

// ---- Una ciudad ----
await abrir(p, () => document.querySelector('[data-action="drill-city"][data-city="Rosario"]').click());
await sumarEn(p);
f = await formulario(p);
eq("ficha de una ciudad, Agenda vacía: «+ Sumar» abre «Sumar a alguien»", [f.abierta, f.persona, f.institucion], [true, true, false]);
eq("y viene con «Ciudad» elegido", f.nivel, "ciudad");
await cerrar(p);

// ---- Una región ----
await tab(p, "paises"); await p.waitForTimeout(300);
await abrir(p, () => { const x = document.querySelector('[data-action="drill-zone"]'); x && x.click(); });
const hayRegion = await p.evaluate(() => !!document.querySelector(".ficha-lugar") && !document.querySelector(".fl-migas [data-action=\"drill-country\"]"));
await sumarEn(p);
f = await formulario(p);
eq("ficha de una región, Agenda vacía: «+ Sumar» abre «Sumar a alguien»", [hayRegion, f.abierta, f.persona, f.institucion], [true, true, true, false]);
eq("y viene con «Región» elegido", f.nivel, "region");
await cerrar(p);

// ---- La lista de la Agenda: una persona de una institución necesita primero la institución ----
await tab(p, "paises"); await p.waitForTimeout(300);
await click(p, ".paises-agenda"); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#agendaOverlay [data-action="agenda-sumar"]').click()); await p.waitForTimeout(500);
f = await formulario(p);
eq("desde la lista de la Agenda vacía, «+ Sumar» sigue pidiendo primero la institución", [f.abierta, f.institucion, f.persona], [true, true, false]);
eq("sin errores en la página", errores, []);
await p.close();
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
