/* ======================================================================
   «Caribe» como lugar: un grupo de países que no es una zona (20/10/2026)

   El usuario pidió poder poner «Caribe» en el alcance de un posteo, aunque
   no sea una división zonal: cada país sigue en su zona (casi todos en
   Norte) y además está en el grupo. Lo que se comprueba:
   - las reglas (nivelDeAlcance): lo cargado para el Caribe es «de la
     región» para cada uno de sus países (no suma 1 a cada uno de los 28),
     y el Caribe como lugar junta lo propio de todos ellos;
   - el formulario lo ofrece (también en inglés, «Caribbean») y lo guarda
     como { type:"grupo", grupo:"caribe" };
   - en Países, un país del Caribe dice «+1 del Caribe» y no «+1 de Región
     Norte»; el filtro de lugar ofrece «🌴 Caribe» y junta a los países;
   - Reportes lo cuenta como una zona y la fila lleva a la misma lista.
   Corre el código del index.html de verdad.
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
import { abrirNavegador, entrar, ADMIN, tab, BASE, post, ciudad, pais, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

/* ---------- Las reglas ---------- */
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };
let api = {};
try{
  api = new Function(`${["hasOwn","normalize","ZONES","COUNTRIES","ZONE_COUNTRIES","COUNTRY_BY_NAME","zoneOfCountry","GRUPOS","grupoExiste","grupoPaises","gruposDe","nivelDeAlcance"].map(grab).join("\n")}
    COUNTRIES.forEach(c=>ZONE_COUNTRIES[c.zone].push(c.name));
    return { COUNTRIES, grupoPaises, gruposDe, nivelDeAlcance };`)();
}catch(e){ console.log("no se pudo armar:", e.message); }
const llamar = (f, ...x) => { try{ return api[f](...x); }catch(e){ return "no existe " + f; } };

const caribe = { type: "grupo", grupo: "caribe" };
const miembros = llamar("grupoPaises", "caribe");
eq("el Caribe son 28 países, todos de la app",
   [Array.isArray(miembros) && miembros.length, Array.isArray(miembros) && miembros.every(n => (api.COUNTRIES || []).some(c => c.name === n))], [28, true]);
eq("están las islas, los que tienen costa de continente pero cultura caribeña, y Bermudas",
   ["Cuba", "Jamaica", "Curazao", "Belice", "Guyana", "Surinam", "Bermudas", "Turcas y Caicos"].map(n => Array.isArray(miembros) && miembros.includes(n)), Array(8).fill(true));
eq("no están los países de la costa del continente ni el resto de LatAm",
   ["Colombia", "Venezuela", "Honduras", "Nicaragua", "México", "Panamá", "Costa Rica", "Argentina", "Brasil"].map(n => Array.isArray(miembros) && miembros.includes(n)), Array(9).fill(false));
eq("un país sigue en su zona y además está en el grupo", [llamar("gruposDe", "Jamaica"), llamar("gruposDe", "Colombia")], [["caribe"], []]);

eq("para un país del Caribe, lo cargado para el Caribe es de la región (no pasó ahí)",
   [llamar("nivelDeAlcance", caribe, { country: "Jamaica" }), llamar("nivelDeAlcance", caribe, { country: "Jamaica", city: "Kingston" })], ["region", "region"]);
eq("y para un país que no es del Caribe, nada", [llamar("nivelDeAlcance", caribe, { country: "Colombia" }), llamar("nivelDeAlcance", caribe, { country: "Argentina" })], [null, null]);
eq("la zona que tiene a sus países lo siente como propio; otra zona, no",
   [llamar("nivelDeAlcance", caribe, { zona: "norte" }), llamar("nivelDeAlcance", caribe, { zona: "sur" })], ["own", null]);
eq("un grupo que ya no existe (quedó en un posteo viejo) no toca a nadie",
   llamar("nivelDeAlcance", { type: "grupo", grupo: "viejo" }, { country: "Jamaica" }), null);
eq("el Caribe como lugar: lo suyo es lo cargado para el Caribe y lo de cada uno de sus países",
   [caribe, pais("Jamaica"), ciudad("Cuba", "La Habana"), pais("Argentina"), { type: "region", region: "norte" }, { type: "region", region: "sur" }, { type: "todo" }]
     .map(sc => llamar("nivelDeAlcance", sc, { grupo: "caribe" })),
   ["own", "own", "own", null, "region", null, "latam"]);

/* ---------- La app ---------- */
const base = BASE();
base.posts = base.posts.concat([
  post({ id: "g_caribe", title: "Seminario para todo el Caribe", d: 5, a: 0, type: "seminario", scopes: [caribe], content: "Para toda la zona." }),
  post({ id: "g_jamaica", title: "Visita a Kingston", d: 6, a: 0, type: "visita", scopes: [pais("Jamaica")], content: "En Jamaica." }),
  post({ id: "g_rosario", title: "Visita a Rosario norte", d: 7, a: 0, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "En Argentina." }),
  post({ id: "g_norte", title: "Encuentro de la región Norte", d: 8, a: 0, type: "seminario", scopes: [{ type: "region", region: "norte" }], content: "De toda la región." }),
]);
const visibles = p => p.$$eval("#viewRoot .post[data-post-id]", l => l.map(e => e.dataset.postId));
const anio = dia(0).slice(0, 4);

const b = await abrirNavegador();

/* El formulario: «Caribe» se ofrece, se elige y se guarda como grupo. */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: BASE() });
  await p.click('nav.tabs button[data-view="feed"]');
  await p.waitForSelector("#rutinaContent");
  eq("el campo de alcance nombra al Caribe entre sus ejemplos", /Caribe/.test(await p.getAttribute("#rutinaPlaceQuery", "placeholder")), true);
  await p.fill("#rutinaContent", "Se armó la agenda del año con las comunidades del Caribe");
  await p.fill("#rutinaPlaceQuery", "carib");
  await p.waitForSelector('[data-action="pick-place"]');
  eq("al escribir «carib» se ofrece 🌴 Caribe", await p.$$eval('[data-action="pick-place"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["🌴 Caribe"]);
  await p.click('[data-action="pick-place"]');
  eq("elegido, queda como chip del alcance", await p.$$eval("#viewRoot .scope-chip", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())).then(l => l.filter(x => /Caribe/.test(x))), ["🌴 Caribe ✕"]);
  await p.click("#rutinaPublish");
  const guardado = await p.waitForFunction(() => (window.__sb.tablas.posts.find(x => x.content === "Se armó la agenda del año con las comunidades del Caribe") || {}).scopes, null, { timeout: 4000 }).then(h => h.jsonValue()).catch(() => null);
  eq("se guarda como { type: grupo, grupo: caribe }", guardado, [caribe]);
  eq("sin errores (formulario)", errores, []);
  await p.close();
}
/* En inglés se encuentra escribiendo «Caribbean», y también «caribe». */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "en", base: BASE() });
  await p.click('nav.tabs button[data-view="feed"]');
  await p.waitForSelector("#rutinaContent");
  await p.fill("#rutinaContent", "Agenda con las comunidades");
  const ofrecidos = [];
  for(const q of ["Caribbean", "caribe"]){
    await p.fill("#rutinaPlaceQuery", q);
    await p.waitForSelector('[data-action="pick-place"]');
    ofrecidos.push(await p.$$eval('[data-action="pick-place"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())));
  }
  eq("en inglés: «Caribbean» y «caribe» ofrecen 🌴 Caribbean", ofrecidos, [["🌴 Caribbean"], ["🌴 Caribbean"]]);
  eq("sin errores (inglés)", errores, []);
  await p.close();
}

/* Países: lo del Caribe en un país del Caribe, «del Caribe», no «de Región Norte». */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await tab(p, "paises"); await p.waitForTimeout(400);
  const jamaica = await p.$eval('.country-card[data-country="Jamaica"]', e => ({ propios: e.querySelector(".count").textContent.replace(/\s+/g, " ").trim(), cruces: [...e.querySelectorAll(".cross-line span")].map(x => x.textContent.trim()) }));
  eq("Jamaica: lo suyo es 1 (lo del Caribe no cuenta como pasado ahí)", jamaica.propios, "1 registro");
  eq("Jamaica: «+1 de Región Norte» y «+1 del Caribe», cada uno por su lado", jamaica.cruces, ["+1 de Región Norte", "+1 del Caribe"]);
  eq("sin errores (Países)", errores, []);
  await p.close();
}

/* El filtro de lugar junta a los países del Caribe. */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await p.click("#fbFiltros"); await p.waitForTimeout(300);
  await p.click('.fp-item[data-cat="lugar"]'); await p.waitForTimeout(250);
  eq("el filtro ofrece 🌴 Caribe", await p.$$eval('.fp-chips [data-kind="grupo"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["🌴 Caribe"]);
  await p.click('.fp-chips [data-kind="grupo"]');
  await p.waitForTimeout(300);
  await p.click('[data-action="fp-aplicar"]'); await p.waitForTimeout(400);
  const lista = await visibles(p);
  eq("filtrado por Caribe: lo del Caribe y lo de Jamaica; no Argentina ni la región Norte", [lista.includes("g_caribe"), lista.includes("g_jamaica"), lista.includes("g_rosario"), lista.includes("g_norte")], [true, true, false, false]);
  eq("la barra dice qué se está mirando", (await p.$eval('.fb-ficha-abrir[data-cat="lugar"]', e => e.textContent.trim())), "📍 Caribe");
  eq("sin errores (filtro)", errores, []);
  await p.close();
}

/* Reportes: «🌴 Caribe» se cuenta como una zona y su fila lleva a la misma lista. */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await tab(p, "reportes"); await p.waitForTimeout(300);
  await p.selectOption("#repAnio", anio).catch(() => {}); await p.waitForTimeout(200);
  const fila = '[data-action="reporte-ir"][data-kind="grupo"][data-key="caribe"]';
  const n = await p.evaluate(sel => { const f = document.querySelector(sel); return f ? Number(f.querySelector(".rep-num").textContent) : null; }, fila);
  eq("la fila Caribe cuenta lo del Caribe y lo cargado para sus países (2: el seminario y Jamaica)", n, 2);
  await p.click(fila); await p.waitForTimeout(400);
  const lista = await visibles(p);
  eq("la lista a la que lleva da el mismo número que la fila", lista.length, n);
  eq("y son los dos posteos del Caribe", [lista.includes("g_caribe"), lista.includes("g_jamaica")], [true, true]);
  eq("sin errores (Reportes)", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
