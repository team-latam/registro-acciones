import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   La página entera, de verdad. Es la comprobación que pide CLAUDE.md
   antes de cada commit.

   No inicia sesión (eso lo hace app_dom_test.mjs), así que cubre la
   carga: que el módulo entero se evalúe sin un solo error propio, con
   cualquiera de los enlaces que el equipo tiene guardados. Los errores de
   red se descuentan: en el sandbox los CDN de Google no son alcanzables,
   y eso no dice nada del código.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const deRed = t => /no cargó https?:|ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|Failed to load resource|net::ERR_|Failed to fetch dynamically imported module|Failed to fetch/.test(t);

const pagina = "file://" + (process.env.INDEX || RAIZ + "index.html");
const b = await chromium.launch();
// La base es Supabase, y Firebase ya no está en el código: un enlace viejo
// —el de la prueba, con ?base=supabase, o el de la base vieja, con
// ?base=firebase— abre lo mismo que el de siempre.
for(const [modo, extra] of [["el enlace de siempre", ""], ["el de la prueba", "?base=supabase"],
                            ["el viejo de Firebase", "?base=firebase"]]){
  const p = await b.newPage();
  const errores = [], consola = [], pedidos = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error") consola.push(m.text()); });
  p.on("request", r => pedidos.push(r.url()));
  await p.goto(pagina + extra);
  await p.waitForTimeout(2500);
  eq(`${modo}: ni un error de página propio`, errores.filter(e => !deRed(e)), []);
  eq(`${modo}: ni un error de consola propio`, consola.filter(t => !deRed(t)), []);
  eq(`${modo}: ningún cartel de otra base`, !!(await p.$("#avisoBase")), false);
  eq(`${modo}: no le pide nada a Firebase`, pedidos.filter(u => /^https?:/.test(u) && /firebase/i.test(u)), []);
  eq(`${modo}: y sí carga Supabase`, pedidos.some(u => u.includes("@supabase/supabase-js")), true);
  eq(`${modo}: dibujó la pantalla (no quedó en blanco)`, (await p.evaluate(() => document.body.innerText.trim().length)) > 0, true);
  await p.close();
}
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
