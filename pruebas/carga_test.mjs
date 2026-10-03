import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   La página entera, de verdad, en las dos bases. Es la comprobación que
   pide CLAUDE.md antes de cada commit, y hasta ahora vivía suelta, sin
   formato de prueba y fuera del repo.

   No inicia sesión (no hay con qué), así que cubre la carga: que el
   módulo entero se evalúe sin un solo error propio, que el arranque elija
   bien la base, y que la pestaña de Supabase avise que lo es. Los errores
   de red se descuentan: en el sandbox Firebase y los CDN de Google no son
   alcanzables, y eso no dice nada del código.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const deRed = t => /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|Failed to load resource|net::ERR_|Failed to fetch dynamically imported module|Failed to fetch/.test(t);

const pagina = "file://" + (process.env.INDEX || RAIZ + "index.html");
const b = await chromium.launch();
// Desde el 3 de octubre de 2026, sin nada en la dirección es Supabase; la
// pestaña de Firebase es la que avisa que mira la base vieja.
for(const [modo, extra, conCartel] of [["Supabase", "", false], ["Supabase (enlace de la prueba)", "?base=supabase", false],
                                       ["Firebase", "?base=firebase", true]]){
  const p = await b.newPage();
  const errores = [], consola = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error") consola.push(m.text()); });
  await p.goto(pagina + extra);
  await p.waitForTimeout(2500);
  eq(`${modo}: ni un error de página propio`, errores.filter(e => !deRed(e)), []);
  eq(`${modo}: ni un error de consola propio`, consola.filter(t => !deRed(t)), []);
  eq(`${modo}: ${conCartel ? "avisa" : "no avisa"} que está mirando otra base`, !!(await p.$("#avisoBase")), conCartel);
  eq(`${modo}: dibujó la pantalla (no quedó en blanco)`, (await p.evaluate(() => document.body.innerText.trim().length)) > 0, true);
  await p.close();
}
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
