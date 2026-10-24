import { chromium } from "playwright";
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("../..", import.meta.url));

/* ======================================================================
   Que otra página no pueda meter la app adentro de la suya (24/10/2026,
   docs/AUDITORIA.md, S3).

   GitHub Pages no deja mandar el encabezado que lo prohíbe
   (X-Frame-Options, o frame-ancestors en la CSP; en un <meta> el
   navegador lo ignora). Sin eso, una página cualquiera puede mostrar el
   Registro dentro de un marco invisible y hacer que alguien con la sesión
   abierta toque, sin saberlo, un botón de verdad («Aprobar», «Borrar»).
   El arreglo va en el primer script de la página: si está adentro de un
   marco de otro sitio, no se muestra nada.

   Se sirven dos sitios de mentira con Playwright: el de la app y uno de
   afuera que la mete en un <iframe>. Sin red, sin servidor.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const html = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const APP = "https://team-latam.github.io/registro-acciones/";
const AFUERA = "https://otro-sitio.example/";

const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.route("**/*", ruta => {
  const u = ruta.request().url();
  if(u === APP || u.startsWith(APP + "?")) return ruta.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  if(u === AFUERA) return ruta.fulfill({ contentType: "text/html", body: `<!doctype html><title>Afuera</title><iframe id="m" src="${APP}" style="width:900px;height:700px"></iframe>` });
  return ruta.abort();
});

// 1. Sola, como siempre: se ve.
{
  const p = await ctx.newPage();
  await p.goto(APP);
  await p.waitForTimeout(800);
  eq("sola: la página se ve", await p.evaluate(() => getComputedStyle(document.documentElement).display !== "none"), true);
  eq("sola: dibujó algo", (await p.evaluate(() => document.body.innerText.trim().length)) > 0, true);
  await p.close();
}

// 2. Adentro de un marco de otro sitio: no se ve nada.
{
  const p = await ctx.newPage();
  await p.goto(AFUERA);
  const marco = await (await p.waitForSelector("#m")).contentFrame();
  await marco.waitForLoadState("domcontentloaded");
  await p.waitForTimeout(800);
  eq("en un marco de otro sitio: la página queda oculta", await marco.evaluate(() => getComputedStyle(document.documentElement).display), "none");
  eq("en un marco de otro sitio: no hay botones que se puedan tocar", await marco.evaluate(() => [...document.querySelectorAll("button")].some(x => x.getClientRects().length > 0)), false);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
