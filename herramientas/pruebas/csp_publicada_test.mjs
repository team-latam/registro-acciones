import fs from "node:fs";
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
import { conHuellas, scriptsEscritos } from "../publicar/csp.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("../..", import.meta.url));

/* ======================================================================
   La página tal como la publica «Publicar el sitio»: la CSP con las
   huellas de sus dos scripts (24/10/2026, docs/AUDITORIA.md, S2;
   herramientas/publicar/csp.mjs)

   Las demás pruebas usan el fuente, que dice 'unsafe-inline'. Esta usa lo
   que de verdad llega a la gente y comprueba las dos cosas que importan:
   que la app arranca igual (sus dos scripts tienen la huella justa: si no,
   la página quedaría en blanco para todos), y que un script que se colara
   en la página ya no corre.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const fuente = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const publicada = conHuellas(fuente);
const csp = h => (h.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [, ""])[1];
eq("lo único que cambia es la CSP", publicada.replace(csp(publicada), ""), fuente.replace(csp(fuente), ""));
eq("una huella por cada script escrito en la página", (csp(publicada).match(/'sha256-/g) || []).length, scriptsEscritos(fuente).length);

const APP = "https://team-latam.github.io/registro-acciones/";
const b = await chromium.launch();
async function abrir(html){
  const ctx = await b.newContext();
  // Lo de afuera no llega (como en el sandbox): solo interesa la página.
  await ctx.route("**/*", ruta => ruta.request().url().startsWith(APP)
    ? ruta.fulfill({ contentType: "text/html; charset=utf-8", body: html }) : ruta.abort());
  const p = await ctx.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  // Lo que la CSP frena lo cuenta el propio navegador.
  await p.addInitScript(() => { window.__frenados = []; document.addEventListener("securitypolicyviolation", e => window.__frenados.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await p.addInitScript(() => { try{ localStorage.setItem("ra_lang", "he"); }catch(e){} });
  await p.goto(APP);
  await p.waitForTimeout(2500);
  const colar = () => p.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.__colado = 1"; document.head.appendChild(s); return new Promise(r => setTimeout(() => r(window.__colado === 1), 100)); });
  return { p, ctx, errores, colar };
}

// 1. La publicada arranca: los dos scripts corren y nada propio queda frenado.
{
  const { p, ctx, errores, colar } = await abrir(publicada);
  const estado = await p.evaluate(() => ({ dir: document.documentElement.dir, texto: /[\u0590-\u05FF]/.test(document.body.innerText), frenados: window.__frenados.filter(x => /^script-src/.test(x) && /inline/.test(x)) }));
  eq("publicada: el primer script corrió (el hebreo se aplicó antes de pintar)", estado.dir, "rtl");
  // El cascarón fijo de la página está en castellano: si sale en hebreo, lo
  // tradujo el módulo, o sea que el módulo corrió (sin él, igual hay texto).
  eq("publicada: el módulo de la app corrió (tradujo la pantalla al hebreo)", estado.texto, true);
  eq("publicada: la CSP no frenó ningún script propio", estado.frenados, []);
  eq("publicada: sin errores de página propios", errores.filter(e => !/Failed to fetch|no cargó|NetworkError|ERR_/.test(e)), []);
  eq("publicada: un script que se cuela en la página NO corre", await colar(), false);
  await ctx.close();
}

// 2. Y la prueba distingue: con el fuente ('unsafe-inline' solo), el mismo script sí corre.
{
  const { ctx, colar } = await abrir(fuente);
  eq("fuente: con 'unsafe-inline' solo, el script colado sí corre (por eso se publica con huellas)", await colar(), true);
  await ctx.close();
}

// 3. Si la CSP ya no dijera 'unsafe-inline', el armado lo avisa en vez de publicar otra cosa.
{
  let error = "";
  try{ conHuellas(fuente.replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")); }catch(e){ error = e.message; }
  eq("sin 'unsafe-inline' que reemplazar, el armado se frena con un motivo", /unsafe-inline/.test(error), true);
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
