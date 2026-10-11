/* ======================================================================
   Las tiras de los niveles de arriba en la Agenda (10/10/2026)

   Con un filtro de lugar (región, país o ciudad), las personas de los
   niveles de arriba (toda LatAm, la región, el país) no entran en la lista,
   que es la del nivel en el que se entró. Van en una tira por nivel, todas
   cerradas al empezar y cada una por su cuenta (a pedido del usuario, que
   eligió esto sobre «siempre arriba», «solo regiones» y «un aviso»).
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
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
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
    { id: "per_a", name: "Shlomo Ejemplar", email: null, note: null, telefonos: [{ n: "+54 9 341 555 1234", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_b", name: "Tzvi Ficticio", email: null, note: null, telefonos: [{ n: "+598 99 555 123", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_c", name: "Moshe Levi", email: null, note: null, telefonos: [{ n: "+52 55 5555 0101", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_d", name: "Dana Bergman", email: null, note: null, telefonos: [{ n: "+56 9 5555 0101", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_f", name: "Ariel Katz", email: null, note: null, telefonos: [{ n: "+54 9 11 5555 0202", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_e", name: "Julia Ficción", email: null, note: null, telefonos: [{ n: "+55 11 5555 1099", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
  ],
  contactos: [
    { id: "c1", institucion: "i_ros", persona: "per_a", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    { id: "c2", institucion: "i_mvd", persona: "per_b", cargo: "Director", orden: 0, created_at: hace(5) },
    { id: "c3", institucion: "i_mex", persona: "per_c", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    // Los de un lugar: la región Sur y toda LatAm.
    { id: "c4", institucion: null, nivel: "region", zona: "sur", persona: "per_d", cargo: "Coordinadora", orden: 0, created_at: hace(5) },
    { id: "c5", institucion: null, nivel: "latam", persona: "per_e", cargo: "Directora", orden: 0, created_at: hace(5) },
    { id: "c6", institucion: null, nivel: "pais", country: "Argentina", persona: "per_f", cargo: "Presidente", orden: 0, created_at: hace(5) },
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

const tiras = p => p.$$eval(".ag-tira-h", l => l.map(e => [e.querySelector("b").textContent.trim(), e.querySelector("small").textContent.trim(), e.getAttribute("aria-expanded")]));
const abrirPaises = async p => { await p.click('nav.tabs button[data-view="paises"]'); await p.waitForSelector(".paises-agenda"); };
const abrirAgenda = async p => { await p.click(".paises-agenda"); await p.waitForSelector("#agendaBuscar"); };

/* ---------- Sin filtro de lugar: no hay tiras ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p); await abrirAgenda(p);
  eq("sin filtro de lugar: ninguna tira, todo en la lista", [await tiras(p), await encabezados(p)], [[], ["Toda LatAm", "Región Sur", "Argentina", "México", "Uruguay"]]);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- Con una región: solo «Toda LatAm», cerrada ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click('[data-action="toggle-paises-zone"][data-key="sur"]'); await abrirAgenda(p);
  eq("con la región Sur: una tira, cerrada; la lista es la del nivel (sin toda LatAm)", [await tiras(p), await encabezados(p)], [[["Toda LatAm", "1 contacto", "false"]], ["Región Sur", "Argentina", "Uruguay"]]);
  eq("cerrada: sin las personas a la vista", await cuantos(p, ".ag-tira-cuerpo"), 0);
  await p.click('.ag-tira-h[data-k="latam"]');
  eq("abrirla muestra a sus personas, y queda abierta", [await tiras(p), await p.$$eval(".ag-tira-cuerpo .ag-p b", l => l.map(e => e.textContent))], [[["Toda LatAm", "1 contacto", "true"]], ["Julia Ficción"]]);
  eq("el foco se queda en la tira que se tocó", await p.evaluate(() => document.activeElement.dataset.k), "latam");
  eq("abierta: apunta a lo que abre (aria-controls)", await p.$eval('.ag-tira-h[data-k="latam"]', e => !!document.getElementById(e.getAttribute("aria-controls"))), true);
  await p.click('.ag-tira-h[data-k="latam"]');
  eq("tocarla otra vez la cierra", [await tiras(p), await cuantos(p, ".ag-tira-cuerpo")], [[["Toda LatAm", "1 contacto", "false"]], 0]);
  await p.close();
}

/* ---------- Con un país: toda LatAm y la región, una por su cuenta ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p); await abrirAgenda(p);
  await p.selectOption("#agendaPais", "Uruguay"); await p.waitForTimeout(150);
  eq("con un país: dos tiras (toda LatAm y su región), cerradas; la lista es la del país", [await tiras(p), await encabezados(p)],
     [[["Toda LatAm", "1 contacto", "false"], ["Región Sur", "1 contacto", "false"]], ["Uruguay"]]);
  await p.click('.ag-tira-h[data-k="region:sur"]');
  eq("abrir una no abre la otra", await tiras(p), [["Toda LatAm", "1 contacto", "false"], ["Región Sur", "1 contacto", "true"]]);
  eq("abierta: las personas de esa región", await p.$$eval(".ag-tira-cuerpo .ag-p b", l => l.map(e => e.textContent)), ["Dana Bergman"]);
  await p.click('.ag-tira-h[data-k="latam"]');
  eq("las dos pueden estar abiertas a la vez", (await tiras(p)).map(t => t[2]), ["true", "true"]);
  // La separación entre tiras es chica (menos de 6 px).
  const sep = await p.$$eval(".ag-tira", l => l.length > 1 ? Math.round(l[1].getBoundingClientRect().top - l[0].getBoundingClientRect().bottom) : null);
  eq("las tiras están juntas (≤ 5 px entre una y otra)", sep !== null && sep <= 5 && sep >= 0, true);
  // Buscar: las tiras siguen a lo que se escribe.
  await escribir(p, "#agendaBuscar", "dana");
  eq("al buscar «dana»: solo queda la tira donde está", await tiras(p), [["Región Sur", "1 contacto", "true"]]);
  await escribir(p, "#agendaBuscar", "zzzz");
  eq("si no coincide nadie, no hay tiras", await tiras(p), []);
  await escribir(p, "#agendaBuscar", "");
  // Tipo: es de las instituciones; la gente de un lugar no entra.
  await p.selectOption("#agendaTipo", "Sinagoga"); await p.waitForTimeout(150);
  eq("con un tipo elegido no hay tiras (el tipo es de las instituciones)", await tiras(p), []);
  await p.selectOption("#agendaTipo", ""); await p.waitForTimeout(150);
  // «Limpiar»: sin filtro no hay tiras, y al volver a filtrar arrancan cerradas.
  await p.click('[data-action="agenda-limpiar"]');
  eq("«Limpiar»: sin tiras", await tiras(p), []);
  await p.selectOption("#agendaPais", "Uruguay"); await p.waitForTimeout(150);
  eq("al volver a filtrar, empiezan cerradas otra vez", (await tiras(p)).map(t => t[2]), ["false", "false"]);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- Con una ciudad: toda LatAm, la región y el país ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click('[data-action="drill-zone"][data-zona="sur"]');
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.click('[data-action="drill-city"][data-city="Rosario"]');
  await p.waitForSelector('.fl-ag-pie [data-action="agenda-ver"], .fl-ag-pie [data-action="agenda-abrir"]');
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("con una ciudad: tres tiras de arriba hacia abajo, cerradas", await tiras(p), [["Toda LatAm", "1 contacto", "false"], ["Región Sur", "1 contacto", "false"], ["Argentina", "1 contacto", "false"]]);
  await p.click('.ag-tira-h[data-k="pais:Argentina"]');
  eq("la tira del país muestra a su gente", await p.$$eval(".ag-tira-cuerpo .ag-p b", l => l.map(e => e.textContent)), ["Ariel Katz"]);
  eq("la lista de abajo sigue siendo la de la ciudad", await p.$$eval(".ag-lista > section.ag-pais .ag-fila .ag-inst b", l => l.map(e => e.textContent.trim())), ["Beit Chabad Rosario"]);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- En hebreo: la flecha mira al otro lado ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", { lang: "he" });
  await irAPaises(p);
  await p.click('[data-action="toggle-paises-zone"][data-key="sur"]'); await abrirAgenda(p);
  eq("hebreo: la tira cerrada lleva la flecha espejada", await p.$eval(".ag-tira-fl", e => e.textContent), "◂");
  eq("hebreo: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
