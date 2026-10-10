/* ======================================================================
   La Agenda abierta desde una región sale filtrada por esa región
   (10/10/2026, auditoría R21; el usuario eligió la opción A)

   Desde una ciudad ya salía filtrada, con un chip «📍 Rosario ✕» para
   sacar el filtro. Desde una región (su ficha en Países: «Ver Agenda» y
   la fila de la gente de la región) se abría entera. Ahora la región
   filtra igual: sus países y su propia gente, con su chip. Los dos chips
   dicen por su nombre qué sacan.
   Con el Supabase de mentira de app_dom_test.mjs.
   ====================================================================== */
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
import fs from "node:fs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "pruebas/app_dom_test.mjs", "utf8");
const FALSO = src.slice(src.indexOf("const FALSO = `") + "const FALSO = `".length, src.indexOf("}`;\n\nconst ADMIN") + 1);
const RUTA = process.env.INDEX || RAIZ + "index.html";
// La librería de Supabase se carga como script con huella (UMD, ver SUPABASE_CDN
// en index.html): acá se sirve la de mentira como script clásico que deja `supabase`.
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
const FALSO_UMD = () => FALSO.replace("export function createClient", "function createClient") + "\nvar supabase = { createClient };";
const ADMIN = "benny@team-latam.com";
const hace = dias => new Date(Date.now() - dias * 86400000).toISOString();
const dia = dias => hace(dias).slice(0, 10);
const BASE = () => ({
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z" }],
  posts: [], replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [],
  agenda_listas: [{ id: "l1", name: "Directorio Chabad LatAm", created_by: ADMIN, created_at: hace(5) }],
  instituciones: [
    { id: "i_ros", name: "Beit Chabad Rosario", country: "Argentina", city: "Rosario", address: null, tipo: "Centro Comunitario", estado: "activa", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "i_mvd", name: "Beit Jabad Uruguay", country: "Uruguay", city: "Montevideo", address: null, tipo: "Sinagoga", estado: "activa", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "i_mex", name: "Chabad México", country: "México", city: "Ciudad de México", address: null, tipo: "Sinagoga", estado: "activa", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
  ],
  personas: [
    { id: "per_a", name: "Shlomo Tawil", email: null, note: null, telefonos: [{ n: "+54 9 341 555 1234", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_b", name: "Tzvi Grumblat", email: null, note: null, telefonos: [{ n: "+598 99 555 123", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_c", name: "Moshe Levi", email: null, note: null, telefonos: [{ n: "+52 55 5555 0101", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_d", name: "Dana Bergman", email: null, note: null, telefonos: [{ n: "+56 9 5555 0101", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_e", name: "Julia Lerner", email: null, note: null, telefonos: [{ n: "+55 11 5555 1099", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
  ],
  contactos: [
    { id: "c1", institucion: "i_ros", persona: "per_a", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    { id: "c2", institucion: "i_mvd", persona: "per_b", cargo: "Director", orden: 0, created_at: hace(5) },
    { id: "c3", institucion: "i_mex", persona: "per_c", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    // Los de un lugar: la región Sur y toda LatAm.
    { id: "c4", institucion: null, nivel: "region", zona: "sur", persona: "per_d", cargo: "Coordinadora", orden: 0, created_at: hace(5) },
    { id: "c5", institucion: null, nivel: "latam", persona: "per_e", cargo: "Directora", orden: 0, created_at: hace(5) },
  ],
});

const b = await chromium.launch();
async function entrar(email, nombre, { viewport, lang, retocar = x => x } = {}){
  const p = await b.newPage({ viewport: viewport || { width: 1280, height: 900 }, ...(viewport && viewport.width < 800 ? { hasTouch: true, isMobile: true } : {}) });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO_UMD() });
    if(u.includes("/functions/v1/")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ enviado: false, estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion, lang]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
    try{ if(lang) localStorage.setItem("ra_lang", lang); }catch(e){}
  }, [retocar(BASE()), { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }, lang || ""]);
  await p.goto("file://" + RUTA);
  await p.waitForSelector('[data-action="toggle-user-menu"]', { timeout: 8000 });
  return { p, errores };
}
const hasta = async (p, fn, ms = 4000) => { try{ await p.waitForFunction(fn, null, { timeout: ms }); return true; }catch(e){ return false; } };
const texto = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const cuantos = (p, sel) => p.$$eval(sel, l => l.length);
const vista = p => p.$eval("#agendaBody", e => e.dataset.vista).catch(() => null);
const abierta = p => p.$eval("#agendaOverlay", e => !e.hidden);
async function irAPaises(p){
  await p.click('nav.tabs button[data-view="paises"]');
  await p.waitForSelector(".paises-agenda");
}
async function irARosario(p){
  await irAPaises(p);
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector('[data-action="drill-city"][data-city="Rosario"]');
  await p.click('[data-action="drill-city"][data-city="Rosario"]');
  // En la compu el pliegue está escondido (solo se pliega en el celular).
  await p.waitForSelector('.fl-pliegue[data-que="contactos"]', { state: "attached" });
}
const escribir = async (p, sel, valor) => { await p.fill(sel, valor); await p.waitForTimeout(120); };

const encabezados = p => p.$$eval(".ag-pais-h b", l => l.map(e => e.textContent.trim()));
const chip = (p, accion) => p.$eval(`[data-action="${accion}"]`, e => ({ texto: e.textContent.replace(/\s+/g, " ").trim(), nombre: e.getAttribute("aria-label") })).catch(() => null);

/* ---------- La Agenda abierta desde una región sale filtrada, con su chip (10/10/2026) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click('[data-action="drill-zone"][data-zona="sur"]');
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-abrir"]');
  eq("ficha de la región: todo lo que abre la Agenda lo hace con la región", await p.$$eval('[data-action="agenda-abrir"]', l => l.map(e => e.dataset.zona || "(sin región)")).then(l => [...new Set(l)]), ["sur"]);
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("«Ver Agenda» de la región: el chip con su nombre", await chip(p, "agenda-sin-zona"), { texto: "📍 Región Sur ✕", nombre: "Sacar el filtro: Región Sur" });
  eq("solo la región y sus países: sin México ni toda LatAm", await encabezados(p), ["Región Sur", "Argentina", "Uruguay"]);
  eq("el resumen cuenta solo lo de la región", await texto(p, ".ag-resumen span"), "2 instituciones y 3 contactos en 2 ciudades de 2 países");
  eq("con un filtro puesto aparece «Limpiar»", await cuantos(p, '[data-action="agenda-limpiar"]'), 1);
  eq("el país no se toca: el filtro de países sigue en «Todos»", await p.inputValue("#agendaPais"), "");

  // Sacar el chip: la Agenda entera.
  await p.click('[data-action="agenda-sin-zona"]');
  eq("sacar el chip: vuelve todo (México y toda LatAm incluidos)", await encabezados(p), ["Toda LatAm", "Región Sur", "Argentina", "México", "Uruguay"]);
  eq("sin chip ni «Limpiar»", [await cuantos(p, '[data-action="agenda-sin-zona"]'), await cuantos(p, '[data-action="agenda-limpiar"]')], [0, 0]);
  await p.click('[data-action="agenda-cerrar"]');

  // La gente de la región («Contactos de la región») también la abre filtrada.
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-abrir"]');
  const fila = await p.$('.fl-hijos [data-action="agenda-abrir"][data-zona="sur"]');
  if(fila){ await fila.click(); await p.waitForSelector("#agendaBuscar");
    eq("la fila de la región: abre con su chip", await texto(p, '[data-action="agenda-sin-zona"]'), "📍 Región Sur ✕");
    await p.click('[data-action="agenda-cerrar"]'); }
  else eq("la fila de la región existe en su ficha", false, true);

  // «Limpiar» saca todo, el chip también.
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  await p.click('[data-action="agenda-limpiar"]');
  eq("«Limpiar» saca también la región", [await encabezados(p), await cuantos(p, '[data-action="agenda-sin-zona"]')], [["Toda LatAm", "Región Sur", "Argentina", "México", "Uruguay"], 0]);
  await p.click('[data-action="agenda-cerrar"]');

  // Elegir un país es ser más preciso: la región se va.
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  await p.selectOption("#agendaPais", "Uruguay"); await p.waitForTimeout(120);
  eq("elegir un país reemplaza a la región", [await encabezados(p), await cuantos(p, '[data-action="agenda-sin-zona"]')], [["Uruguay"], 0]);
  await p.click('[data-action="agenda-cerrar"]');

  // Un país sigue como antes: filtra por el país y no pone chip de región.
  await p.click('[data-action="goto-view"][data-view="paises"], nav.tabs button[data-view="paises"]');
  await p.waitForSelector('.paises-zona');
  await p.click('[data-action="drill-zone"][data-zona="sur"]');
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("«Ver Agenda» de un país: filtra el país, sin chip de región", [await p.inputValue("#agendaPais"), await cuantos(p, '[data-action="agenda-sin-zona"]'), await encabezados(p)], ["Argentina", 0, ["Argentina"]]);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- El botón «📇 Agenda» de Países respeta las zonas marcadas arriba (captura del usuario) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  const chips = () => p.$$eval('[data-action="agenda-sin-zona"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  const abrir = async () => { await p.click(".paises-agenda"); await p.waitForSelector("#agendaBuscar"); };
  const cerrar = () => p.click('[data-action="agenda-cerrar"]');
  const zona = k => p.click(`[data-action="toggle-paises-zone"][data-key="${k}"]`);

  await abrir();
  eq("Países sin zonas marcadas: la Agenda entera, sin chips", [await encabezados(p), await chips()], [["Toda LatAm", "Región Sur", "Argentina", "México", "Uruguay"], []]);
  await cerrar();

  await zona("norte"); await abrir();
  eq("con «Norte» marcada: solo lo de Norte, con su chip", [await encabezados(p), await chips()], [["México"], ["📍 Región Norte ✕"]]);
  await cerrar();

  await zona("sur"); await abrir();
  eq("con «Sur» y «Norte»: las dos, cada una con su chip (en el orden de las zonas)", [await encabezados(p), await chips()], [["Región Sur", "Argentina", "México", "Uruguay"], ["📍 Región Sur ✕", "📍 Región Norte ✕"]]);
  await p.click('[data-action="agenda-sin-zona"][data-zona="sur"]');
  eq("sacar un chip deja el otro", [await encabezados(p), await chips()], [["México"], ["📍 Región Norte ✕"]]);
  await cerrar();

  await zona("sur"); await zona("norte"); await abrir();
  eq("sin zonas marcadas otra vez: entera (se lee al tocar, no se queda con la vez anterior)", [await encabezados(p), await chips()], [["Toda LatAm", "Región Sur", "Argentina", "México", "Uruguay"], []]);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- El chip de una ciudad también se anuncia por su nombre ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click('[data-action="drill-zone"][data-zona="sur"]');
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.click('[data-action="drill-city"][data-city="Rosario"]');
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("el chip de la ciudad: su nombre dice qué saca", await chip(p, "agenda-sin-ciudad"), { texto: "📍 Rosario ✕", nombre: "Sacar el filtro: Rosario" });
  await p.close();
}

/* ---------- En inglés ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", { lang: "en" });
  await irAPaises(p);
  await p.click('[data-action="drill-zone"][data-zona="sur"]');
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("en inglés: el chip y su nombre", await chip(p, "agenda-sin-zona"), { texto: "📍 South region ✕", nombre: "Remove filter: South region" });
  eq("en inglés: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
