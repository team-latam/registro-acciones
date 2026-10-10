/* ======================================================================
   La Agenda (19-agenda.sql), en la app de verdad (8/10/2026)

   Los contactos de cada lugar: instituciones y su gente, con teléfono y
   WhatsApp. Se abre con «📇 Agenda» en Países, desde la ficha de cada
   lugar («Contactos en …») y desde «Buscar en todo». La ve todo el
   equipo (también quien observa); la completa quien puede cargar
   eventos; borrar una institución y traer una lista entera es de un admin
   (Administración › Agenda).
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
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z" },
            { email: "ana@x.com", name: "Ana Pérez", nickname: "ana", role: "member", approved_at: "2025-03-01T12:00:00Z" },
            { email: "obs@x.com", name: "Olga Obs", nickname: "olga", role: "observer", approved_at: "2025-03-01T12:00:00Z" }],
  posts: [{ id: "p_ros", title: "Visita a Rosario", content: "", date: dia(3), start_date: dia(3), end_date: dia(3), activity_type: "visita",
    author_name: "Benny", author_email: ADMIN, scopes: [{ type: "ciudad", country: "Argentina", city: "Rosario" }],
    images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [],
    participants: [{ persona: "per_tawil", name: "Shlomo Tawil" }], recurrence_skip: [], recurrence_moves: {}, created_at: hace(3) }],
  replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [],
  agenda_listas: [{ id: "l1", name: "Directorio Chabad LatAm", created_by: ADMIN, created_at: hace(5) }],
  instituciones: [
    { id: "i_ros", name: "Beit Chabad Rosario", country: "Argentina", city: "Rosario", address: "Paraguay 1234", tipo: "Centro Comunitario", estado: "activa", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "i_cen", name: "Chabad Central", country: "Argentina", city: "Buenos Aires", address: "Agüero 1164", tipo: "Centro Comunitario", estado: "activa", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "i_mvd", name: "Beit Jabad Uruguay", country: "Uruguay", city: "Montevideo", address: null, tipo: "Sinagoga", estado: "temporada", nota: null, lista: "l1", created_by: ADMIN, created_at: hace(5) },
  ],
  personas: [
    { id: "per_tawil", name: "Shlomo Tawil", email: null, note: null, telefonos: [{ n: "+54 9 341 555 1234", wa: true }], idiomas: [], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    { id: "per_grum", name: "Tzvi Grumblat", email: null, note: null, telefonos: [{ n: "+54 9 11 5316 1698", wa: true }, { n: "+54 11 4444 5555", wa: false }], idiomas: ["es", "he"], lista: "l1", created_by: ADMIN, created_at: hace(5) },
    // Una persona sin cuenta que todavía no está en la Agenda.
    { id: "per_guypo", name: "Guypo", email: null, note: null, telefonos: [], idiomas: [], lista: null, created_by: ADMIN, created_at: hace(20) },
  ],
  contactos: [
    { id: "c1", institucion: "i_ros", persona: "per_tawil", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    { id: "c2", institucion: "i_cen", persona: "per_grum", cargo: "Rab a cargo", orden: 0, created_at: hace(5) },
    { id: "c3", institucion: "i_mvd", persona: "per_grum", cargo: "Director", orden: 0, created_at: hace(5) },
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

/* ---------- 1. Un admin, en la compu: abrir, buscar, la ficha de alguien ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  eq("países: el botón dice «📇 Agenda»", await texto(p, ".paises-agenda"), "📇 Agenda");
  eq("países: va al lado de Lista y Mapa", await p.$eval(".paises-agenda", e => !!e.closest(".paises-izq")), true);
  await p.click(".paises-agenda");
  await p.waitForSelector("#agendaBuscar");
  eq("se abre como ventana accesible", await p.$eval("#agendaOverlay .agenda-modal", e => [e.getAttribute("role"), e.getAttribute("aria-modal"), e.getAttribute("aria-labelledby")]), ["dialog", "true", "agendaTitulo"]);
  eq("el foco entra al buscador", await p.evaluate(() => document.activeElement.id), "agendaBuscar");
  eq("el resumen cuenta instituciones, gente, ciudades y países", await texto(p, ".ag-resumen"), "3 instituciones y 2 contactos en 3 ciudades de 2 países");
  eq("una fila por institución", await cuantos(p, ".ag-fila"), 3);
  eq("cada país con su encabezado", await p.$$eval(".ag-pais-h b", l => l.map(e => e.textContent)), ["Argentina", "Uruguay"]);
  eq("la de temporada lo dice", await p.$$eval(".ag-fila", l => l.filter(e => /De temporada/.test(e.textContent)).map(e => e.querySelector(".ag-inst b").textContent.trim())), ["Beit Jabad Uruguay De temporada"]);

  await escribir(p, "#agendaBuscar", "grumb");
  eq("buscar por nombre: la misma persona en sus dos instituciones", await cuantos(p, ".ag-fila"), 2);
  eq("buscar: el foco sigue en el buscador", await p.evaluate(() => document.activeElement.id), "agendaBuscar");
  await escribir(p, "#agendaBuscar", "5316");
  eq("buscar por teléfono (los números, con o sin espacios): las dos instituciones de quien lo tiene", await cuantos(p, ".ag-fila"), 2);
  await escribir(p, "#agendaBuscar", "4444 5555");
  eq("buscar por el segundo teléfono, con espacios", await cuantos(p, ".ag-fila"), 2);
  await escribir(p, "#agendaBuscar", "341555");
  eq("buscar por teléfono escrito sin espacios", await p.$$eval(".ag-fila .ag-inst b", l => l.map(e => e.textContent.trim())), ["Beit Chabad Rosario"]);
  await escribir(p, "#agendaBuscar", "rosario");
  eq("buscar por lugar", await p.$$eval(".ag-fila .ag-inst b", l => l.map(e => e.textContent.trim())), ["Beit Chabad Rosario"]);
  await escribir(p, "#agendaBuscar", "");
  await p.selectOption("#agendaPais", "Uruguay"); await p.waitForTimeout(120);
  eq("filtrar por país", await cuantos(p, ".ag-fila"), 1);
  await p.click('[data-action="agenda-limpiar"]'); await p.waitForTimeout(120);
  eq("«Limpiar» vuelve a todas", await cuantos(p, ".ag-fila"), 3);
  eq("con una sola lista no se ofrece elegir lista", await cuantos(p, "#agendaLista"), 0);

  // La ficha de una persona: sus teléfonos, WhatsApp solo donde lo tiene, sus instituciones y lo que pasó.
  await escribir(p, "#agendaBuscar", "grumb");
  await p.click('.ag-fila [data-action="agenda-ver-persona"][data-id="per_grum"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "personaper_grum");
  eq("persona: el título es su nombre", await texto(p, "#agendaTitulo"), "Tzvi Grumblat");
  eq("persona: WhatsApp solo en el número que lo tiene", await p.$$eval('#agendaBody a[href^="https://wa.me/"]', l => [...new Set(l.map(a => a.getAttribute("href")))]), ["https://wa.me/5491153161698"]);
  eq("persona: el enlace a WhatsApp abre aparte y sin referencia", await p.$eval('#agendaBody a[href^="https://wa.me/"]', a => [a.target, /noopener/.test(a.rel)]), ["_blank", true]);
  eq("persona: los dos teléfonos", await p.$$eval('#agendaBody a[href^="tel:"]', l => [...new Set(l.map(a => a.getAttribute("href")))]), ["tel:+5491153161698", "tel:+541144445555"]);
  eq("persona: dónde está", await p.$$eval('#agendaBody [data-action="agenda-ver-inst"] b', l => l.map(e => e.textContent.trim()).sort()), ["Beit Jabad Uruguay De temporada", "Chabad Central"]);
  eq("persona: al pie no dice de qué lista vino ni quién la sumó (lo pidió el usuario, 9/10/2026)", await texto(p, ".ag-pie small"), "");
  await p.click('[data-action="agenda-volver"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "lista");
  eq("volver: la lista con la búsqueda como estaba", await p.inputValue("#agendaBuscar"), "grumb");

  // Una institución: el admin la puede borrar.
  await p.click('.ag-fila [data-action="agenda-ver-inst"]');
  await hasta(p, () => /^inst/.test(document.getElementById("agendaBody").dataset.vista));
  eq("institución: un admin ve «Borrar» y «Editar»", [await cuantos(p, '[data-action="agenda-inst-borrar"]'), await cuantos(p, '[data-action="agenda-inst-editar"]')], [1, 1]);
  await p.keyboard.press("Escape");
  eq("Escape vuelve un paso (de la institución a la lista)", await vista(p), "lista");
  await p.keyboard.press("Escape");
  eq("Escape otra vez la cierra", await abierta(p), false);
  eq("el foco vuelve al botón de la Agenda", await p.evaluate(() => document.activeElement.classList.contains("paises-agenda")), true);

  // La ficha de Rosario: «Contactos en Rosario» y «Ver Agenda».
  await irARosario(p);
  eq("ficha: la tarjeta de contactos con su resumen", await texto(p, '.fl-pliegue[data-que="contactos"] .r'), "Beit Chabad Rosario · Shlomo Tawil");
  eq("ficha de una ciudad: sin «Ciudades» (su gente va en «Contactos en …»)", await cuantos(p, '.fl-pliegue[data-que="hijos"]'), 0);
  eq("ficha: la gente de la institución", await p.$$eval('.fl-ag-inst [data-action="agenda-ver-persona"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())).then(l => l.some(x => /Shlomo Tawil/.test(x))), true);
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("«Ver Agenda»: abre filtrada en Rosario", [await cuantos(p, ".ag-fila"), /Rosario/.test(await texto(p, '[data-action="agenda-sin-ciudad"]'))], [1, true]);
  await p.click('[data-action="agenda-cerrar"]');

  // Buscar en todo: contactos e instituciones.
  await p.waitForSelector("#globalSearchInput", { state: "visible" });
  await p.fill("#globalSearchInput", "tawil"); await p.waitForTimeout(250);
  eq("buscar en todo: encuentra al contacto", await cuantos(p, '[data-action="gs-contacto"][data-id="per_tawil"]'), 1);
  await p.click('[data-action="gs-contacto"][data-id="per_tawil"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "personaper_tawil");
  eq("buscar en todo: abre su ficha en la Agenda", await texto(p, "#agendaTitulo"), "Shlomo Tawil");
  eq("persona: lo que pasó con él, de los eventos", await p.$$eval('#agendaBody [data-action="agenda-ver-post"]', l => l.map(e => e.dataset.postId)), ["p_ros"]);
  await p.click('[data-action="agenda-cerrar"]');
  eq("sin errores (admin)", errores, []);
  await p.close();
}

/* ---------- 1b. Un país y una región: «Ciudades» / «Países» con su gente (9/10/2026) ----------
   Eran dos tarjetas que nombraban las mismas ciudades; el usuario pidió
   que fuera una. Primero las que tienen actividad; al final, en gris, las
   que solo tienen contactos. */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector('.fl-pliegue[data-que="hijos"]', { state: "attached" });
  const tarjeta = '.fl-card:has(.fl-pliegue[data-que="hijos"])';
  eq("país: una sola tarjeta (sin «Contactos en Argentina» aparte)", await cuantos(p, '.fl-pliegue[data-que="contactos"]'), 0);
  eq("país: las ciudades, primero la que tiene actividad", await p.$$eval(`${tarjeta} .fl-hijo b`, l => l.map(e => e.textContent.trim())), ["Rosario", "Buenos Aires"]);
  eq("país: cada una con su gente", await p.$$eval(`${tarjeta} .fl-hijo .fl-hijo-ag`, l => l.map(e => e.textContent.trim())), ["📇 Beit Chabad Rosario · Shlomo Tawil", "📇 Chabad Central · Tzvi Grumblat"]);
  eq("país: la que solo tiene contactos, en gris y dice que no hubo actividad", await p.$$eval(`${tarjeta} .fl-hijo.sin-act`, l => l.map(e => [e.querySelector("b").textContent.trim(), e.querySelector("small").textContent.trim()])), [["Buenos Aires", "Sin actividad todavía"]]);
  eq("país: el resumen, las ciudades y cuántos contactos", await texto(p, '.fl-pliegue[data-que="hijos"] .r'), "Rosario y Buenos Aires · 2 contactos");
  await p.click(`${tarjeta} .fl-ag-pie [data-action="agenda-abrir"]`);
  await p.waitForSelector(".ag-fila");
  eq("país: «Ver Agenda» la abre en ese país", await cuantos(p, ".ag-fila"), 2);
  await p.click('[data-action="agenda-cerrar"]');
  await p.click(`${tarjeta} .fl-hijo.sin-act`);
  await p.waitForSelector('.fl-pliegue[data-que="contactos"]', { state: "attached" });
  eq("una ciudad sin actividad lleva a su ficha, con «Contactos en …»", await texto(p, '.fl-pliegue[data-que="contactos"] .r'), "Chabad Central · Tzvi Grumblat");
  // Una región: «Países», igual.
  await irAPaises(p);
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector('.fl-migas [data-action="drill-zone"]');
  await p.click('.fl-migas [data-action="drill-zone"]');
  await p.waitForSelector('.fl-pliegue[data-que="hijos"]', { state: "attached" });
  eq("región: los países, cada uno con su gente; Uruguay solo con contactos", await p.$$eval(`${tarjeta} .fl-hijo`, l => l.map(e => [e.querySelector("b").textContent.trim(), e.classList.contains("sin-act"), (e.querySelector(".fl-hijo-ag") || {}).textContent || ""])),
    [["Argentina", false, "📇 2 instituciones · 2 contactos"], ["Uruguay", true, "📇 Beit Jabad Uruguay · Tzvi Grumblat"]]);
  eq("región: sin «Contactos en …» aparte", await cuantos(p, '.fl-pliegue[data-que="contactos"]'), 0);
  eq("sin errores (país y región)", errores, []);
  await p.close();
}

/* ---------- 2. Alguien del equipo: suma y corrige; no borra ---------- */
{
  const { p, errores } = await entrar("ana@x.com", "Ana Pérez");
  await irARosario(p);
  // «+ Sumar» al pie de la tarjeta, al lado de «Ver Agenda» (9/10/2026); ya no uno por institución.
  eq("ficha: quien carga eventos ve un «+ Sumar» al pie, y ninguno en cada institución", [await cuantos(p, '.fl-ag-pie [data-action="agenda-sumar"]'), await cuantos(p, '.fl-ag-inst [data-action="agenda-sumar"]')], [1, 0]);
  await p.click('.fl-ag-pie [data-action="agenda-sumar"]');
  await p.waitForSelector("#agFNombre");
  // Desde la ficha de una ciudad, «Dónde está» viene en «Ciudad» con esa ciudad (10/10/2026).
  eq("sumar desde Rosario: «Dónde está» viene en Ciudad · Rosario", [await p.$eval('[data-action="agenda-form-nivel"].on', e => e.dataset.k), await p.inputValue("#agFPais"), await p.inputValue("#agFCiudad")], ["ciudad", "Argentina", "Rosario"]);
  eq("sumar: las cinco opciones de dónde", await p.$$eval('[data-action="agenda-form-nivel"]', l => l.map(e => e.textContent.trim())), ["Institución", "Ciudad", "País", "Región", "Toda LatAm"]);
  await p.click('[data-action="agenda-form-nivel"][data-k="institucion"]');
  await p.waitForSelector("#agFInst");
  eq("sumar: al pasar a Institución, la de la ciudad ya viene elegida", await p.inputValue("#agFInst"), "i_ros");
  // Las instituciones de la ciudad van primero, en su grupo, y no se repiten más abajo (9/10/2026).
  const grupos = await p.$$eval("#agFInst optgroup", l => l.map(g => [g.label, [...g.querySelectorAll("option")].map(o => o.value)]));
  eq("sumar: el primer grupo es el de Rosario, con su institución", [/Rosario/.test(grupos[0][0]), grupos[0][1].includes("i_ros")], [true, true]);
  const todas = grupos.flatMap(g => g[1]);
  eq("sumar: ninguna institución aparece dos veces", todas.length, new Set(todas).size);
  // Alguien que ya está en la app: se ofrece, para no duplicarlo.
  await p.fill("#agFNombre", "Guyp"); await p.waitForTimeout(200);
  eq("sumar: ofrece a la persona sin cuenta que ya está", await cuantos(p, '[data-action="agenda-form-usar"][data-id="per_guypo"]'), 1);
  await p.click('[data-action="agenda-form-usar"][data-id="per_guypo"]');
  await p.fill("#agFCargo", "Seguridad");
  await p.click('[data-action="agenda-guardar"]');
  await hasta(p, () => (window.__sb.tablas.contactos || []).some(c => c.persona === "per_guypo"));
  eq("sumar a alguien que ya estaba: solo el contacto, sin ficha nueva", await p.evaluate(() => [window.__sb.tablas.contactos.filter(c => c.persona === "per_guypo").map(c => [c.institucion, c.cargo, c.created_by]),
    window.__sb.tablas.personas.filter(x => x.name === "Guypo").length]), [[["i_ros", "Seguridad", "ana@x.com"]], 1]);
  eq("y la tarjeta de Rosario ya lo muestra", await hasta(p, () => [...document.querySelectorAll('.fl-ag-inst [data-action="agenda-ver-persona"]')].some(e => /Guypo/.test(e.textContent))), true);
  eq("con dos, el resumen de la tarjeta los cuenta", await texto(p, '.fl-pliegue[data-que="contactos"] .r'), "Beit Chabad Rosario · 2 contactos");

  // Alguien nuevo, de la ciudad (sin institución), con un teléfono mal escrito primero.
  await p.click('.fl-ag-pie [data-action="agenda-sumar"]');
  await p.waitForSelector("#agFNombre");
  await p.fill("#agFNombre", "Daniel Kohan");
  await p.fill("#agFCargo", "Presidente");
  await p.fill("#agFTel-0", "llamar al portero");
  const antes = await p.evaluate(() => window.__sb.escrituras.length);
  await p.click('[data-action="agenda-guardar"]'); await p.waitForTimeout(200);
  eq("teléfono sin números: avisa y no guarda", [await cuantos(p, "#agendaBody .ag-error"), await p.evaluate(() => window.__sb.escrituras.length) === antes], [1, true]);
  await p.fill("#agFTel-0", "+54 9 341 777-8888");
  await p.click('[data-action="agenda-guardar"]');
  await hasta(p, () => (window.__sb.tablas.personas || []).some(x => x.name === "Daniel Kohan") && (window.__sb.tablas.contactos || []).length === 5);
  eq("alguien nuevo: su ficha con el teléfono, y el contacto de la ciudad de Rosario, sin institución", await p.evaluate(() => {
    const x = window.__sb.tablas.personas.find(y => y.name === "Daniel Kohan"), c = window.__sb.tablas.contactos.find(y => y.persona === x.id);
    return [x.telefonos, c.institucion, c.nivel, c.country, c.city, c.zona, c.cargo, c.orden]; }), [[{ n: "+54 9 341 777-8888", wa: true }], null, "ciudad", "Argentina", "Rosario", null, "Presidente", 0]);
  eq("y en la tarjeta de Rosario, su gente va primero, antes de la institución", await hasta(p, () => { const l = [...document.querySelectorAll(".fl-ag-inst")]; return l.length === 2 && /Rosario[\s\S]*Contactos de la ciudad[\s\S]*Daniel Kohan/.test(l[0].textContent) && /Beit Chabad Rosario/.test(l[1].textContent); }), true);
  eq("la tarjeta cuenta la institución y los tres", await texto(p, '.fl-pliegue[data-que="contactos"] .r'), "1 institución · 3 contactos");

  // Corregir: el teléfono de Shlomo; queda quién lo tocó.
  await p.click('.fl-ag-inst [data-action="agenda-ver-persona"][data-id="per_tawil"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "personaper_tawil");
  eq("persona: sin «Borrar» para quien no es admin", await cuantos(p, '#agendaBody [data-action*="borrar"]'), 0);
  await p.click('[data-action="agenda-editar"][data-id="per_tawil"]');
  await p.waitForSelector("#agFTel-0");
  await p.fill("#agFTel-0", "+54 9 341 555 4321");
  await p.click('[data-action="agenda-guardar"]');
  await hasta(p, () => window.__sb.tablas.personas.find(x => x.id === "per_tawil").telefonos[0].n === "+54 9 341 555 4321");
  eq("corregir: se guarda y queda quién fue", await p.evaluate(() => window.__sb.tablas.personas.find(x => x.id === "per_tawil").tocado_por), "ana@x.com");
  eq("corregir: la ficha lo dice al pie", await hasta(p, () => /Corregido por Ana Pérez/.test((document.querySelector("#agendaBody .ag-pie small") || {}).textContent || "")), true);
  await p.click('[data-action="agenda-cerrar"]');
  // La institución: «Editar» sí, «Borrar» no.
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector(".ag-fila");
  await p.click('.ag-fila [data-action="agenda-ver-inst"][data-id="i_ros"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "insti_ros");
  eq("institución: quien no es admin corrige pero no borra", [await cuantos(p, '[data-action="agenda-inst-editar"]'), await cuantos(p, '[data-action="agenda-inst-borrar"]')], [1, 0]);
  eq("sin errores (equipo)", errores, []);
  await p.close();
}

/* ---------- 3. Quien observa: ve los teléfonos, no cambia nada ---------- */
{
  const { p, errores } = await entrar("obs@x.com", "Olga Obs");
  await irARosario(p);
  eq("observador: la tarjeta de contactos está", await cuantos(p, '.fl-pliegue[data-que="contactos"]'), 1);
  eq("observador: sin «+ Sumar» en la ficha", await cuantos(p, '.fl-plegable [data-action="agenda-sumar"]'), 0);
  eq("observador: al pie de la tarjeta, solo «Ver Agenda»", await p.$$eval(".fl-ag-pie > button", l => l.map(e => e.textContent.trim())), ["Ver Agenda"]);
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector(".ag-fila");
  eq("observador: ve el WhatsApp (decisión del 8/10: todos ven los teléfonos)", await cuantos(p, '#agendaBody a[href^="https://wa.me/"]') > 0, true);
  eq("observador: sin «+ Sumar» en la Agenda", await cuantos(p, '#agendaBody [data-action="agenda-sumar"]'), 0);
  await p.click('.ag-fila [data-action="agenda-ver-persona"]');
  await hasta(p, () => /^persona/.test(document.getElementById("agendaBody").dataset.vista));
  eq("observador: sin «Editar»", await cuantos(p, '#agendaBody [data-action="agenda-editar"]'), 0);
  eq("sin errores (observador)", errores, []);
  await p.close();
}

/* ---------- 4. Administración › Agenda: traer una lista ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="agenda"]');
  await p.waitForSelector("#agendaArchivo", { state: "attached" });
  eq("admin: la lista que ya se trajo, con cuántas instituciones", /Directorio Chabad LatAm.*3 instituciones/.test(await texto(p, ".ag-admin")), true);
  // Como el HTML del Directorio: los datos adentro, en SEED_DATA.
  const filas = [
    { institution: "Beit Chabad Rosario", city_display: "Rosario", country_display: "Argentina", rab: "Shlomo Tawil", phone: "54 9 341 555 1234", type: "Centro Comunitario", status: "activo" },
    { institution: "Chabad Santo Domingo", city_display: "Santo Domingo", country_display: "Rep. Dominicana", rab: "Rabbi Shimon Pelman", phone: "1 809 555 0101‬", type: "Centro Juvenil", status: "en_temporada" },
    { institution: "Chabad Punta Cana", city_display: "Punta Cana", country_display: "Rep. Dominicana", rab: "Shimon Pelman", phone: "1 809 555 0101", type: "Centro de Jóvenes", status: "activo" },
    { institution: "Beit Chabad Funes", city_display: "Funes", country_display: "Argentina", rab: "Rab Shlomo Tawil", phone: "54 9 341 555 9999", type: "Sinagoga", status: "inactivo" },
  ];
  const html = `<!doctype html><title>Directorio de prueba</title><script>const SEED_DATA = ${JSON.stringify(filas)};\nrender();</script>`;
  await p.setInputFiles("#agendaArchivo", { name: "directorio.html", mimeType: "text/html", buffer: Buffer.from(html) });
  await p.waitForSelector(".ag-checks");
  const checks = await p.$$eval(".ag-checks li", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
  const hay = re => checks.some(x => re.test(x));
  eq("previa: cuántas y dónde", hay(/^✓3 instituciones en 3 ciudades de 2 países\.$/), true);
  eq("previa: la que ya está no se vuelve a traer", hay(/Una ya está en la Agenda/), true);
  eq("previa: el país con el nombre de la app", hay(/«Rep\. Dominicana» → República Dominicana/), true);
  eq("previa: la misma persona en dos lugares, una sola ficha; y la que ya estaba en la app", hay(/2 personas: una está en más de una institución.*Shimon Pelman \(2\).*Una ya estaba en la app/), true);
  eq("previa: «Rabbi»/«Rab» fuera del nombre", hay(/2 nombres empiezan con «Rabbi» o «Rab»/), true);
  eq("previa: el teléfono con un carácter invisible", hay(/Un teléfono traía caracteres invisibles/), true);
  eq("previa: temporada y cerradas", hay(/1 de temporada y 1 cerradas/), true);
  eq("previa: dos tipos que parecen el mismo, con la pregunta", [hay(/Dos tipos parecen el mismo: «Centro Juvenil» \(1\) y «Centro de Jóvenes» \(1\)/), await cuantos(p, '[data-action="agenda-import-unir"]')], [true, 2]);
  eq("previa: el nombre de la lista sale del título", await p.inputValue("#agendaNombreLista"), "Directorio de prueba");
  eq("previa: el botón dice qué va a traer", await texto(p, '[data-action="agenda-import-traer"]'), "Traer 3 instituciones y 2 contactos");
  eq("previa: nada guardado todavía", await p.evaluate(() => window.__sb.rpc.filter(r => r[0] === "agenda_traer").length), 0);
  await p.click('[data-action="agenda-import-unir"][data-k="0"]');
  eq("«Dejar los dos» queda elegido", await p.$eval('[data-action="agenda-import-unir"][data-k="0"]', e => e.classList.contains("on")), true);
  await p.click('[data-action="agenda-import-unir"][data-k="1"]');
  await p.fill("#agendaNombreLista", "Directorio del Caribe");
  await p.click('[data-action="agenda-import-traer"]');
  await p.waitForSelector(".ag-listo");
  const llamada = await p.evaluate(() => window.__sb.rpc.find(r => r[0] === "agenda_traer")[1]);
  eq("traer: con el nombre elegido", llamada.p_nombre, "Directorio del Caribe");
  eq("traer: lo que se manda, limpio", llamada.p_instituciones.map(x => [x.name, x.country, x.city, x.tipo, x.estado, x.gente.map(g => [g.name, g.cargo, g.telefonos])]), [
    ["Chabad Santo Domingo", "República Dominicana", "Santo Domingo", "Centro Juvenil", "temporada", [["Shimon Pelman", "Rab a cargo", [{ n: "+1 809 555 0101", wa: true }]]]],
    ["Chabad Punta Cana", "República Dominicana", "Punta Cana", "Centro Juvenil", "activa", [["Shimon Pelman", "Rab a cargo", [{ n: "+1 809 555 0101", wa: true }]]]],
    ["Beit Chabad Funes", "Argentina", "Funes", "Sinagoga", "cerrada", [["Shlomo Tawil", "Rab a cargo", [{ n: "+54 9 341 555 9999", wa: true }]]]],
  ]);
  eq("traer: el resultado", await texto(p, ".ag-listo p"), "✓ Listo: se trajeron 3 instituciones de «Directorio del Caribe», con 2 contactos. Una ya estaba en la app y se usó su ficha.");
  eq("traer: a quien ya estaba se le suma el teléfono nuevo", await p.evaluate(() => window.__sb.tablas.personas.find(x => x.id === "per_tawil").telefonos.map(t => t.n)), ["+54 9 341 555 1234", "+54 9 341 555 9999"]);
  eq("traer: ahora hay dos listas", /Directorio del Caribe/.test(await texto(p, ".ag-admin")), true);
  await p.click('.ag-listo [data-action="agenda-abrir"]');
  await p.waitForSelector(".ag-fila");
  eq("«Ver Agenda»: solo lo de esa lista", [await cuantos(p, ".ag-fila"), await p.inputValue("#agendaLista").then(v => !!v)], [3, true]);
  await p.selectOption("#agendaLista", ""); await p.waitForTimeout(120);
  eq("todas las listas: 6 instituciones", await cuantos(p, ".ag-fila"), 6);
  eq("sin errores (traer)", errores, []);
  await p.close();
}

/* ---------- 5. En el celular y en hebreo ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", { viewport: { width: 390, height: 844 } });
  await p.evaluate(() => { const b = document.querySelector('.bn-item[data-view="paises"]'); b && b.click(); });
  await p.waitForSelector(".paises-agenda");
  await p.evaluate(() => document.querySelector(".paises-agenda").click());
  await p.waitForSelector(".ag-fila");
  eq("celular: la ventana entra en la pantalla", await p.$eval(".agenda-modal", e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.height <= innerHeight; }), true);
  eq("celular: nada se sale de costado", await p.$eval(".ag-cuerpo", e => e.scrollWidth <= e.clientWidth + 1), true);
  await p.evaluate(() => document.querySelector('.ag-fila [data-action="agenda-ver-persona"]').click());
  await hasta(p, () => /^persona/.test(document.getElementById("agendaBody").dataset.vista));
  eq("celular: la ficha de una persona", await cuantos(p, '#agendaBody a[href^="https://wa.me/"]') > 0, true);
  eq("sin errores (celular)", errores, []);
  await p.close();
}
{
  const { p, errores } = await entrar(ADMIN, "Benny", { lang: "he" });
  await irAPaises(p);
  eq("hebreo: el botón traducido", await texto(p, ".paises-agenda"), "📇 ספר טלפונים");
  await p.click(".paises-agenda");
  await p.waitForSelector(".ag-fila");
  eq("hebreo: la página de derecha a izquierda", await p.evaluate(() => document.documentElement.dir), "rtl");
  eq("hebreo: el resumen traducido", /מוסדות/.test(await texto(p, ".ag-resumen")), true);
  eq("sin errores (hebreo)", errores, []);
  await p.close();
}


/* ---------- 6. Contactos por lugar: una ciudad, un país, una región o toda LatAm (10/10/2026) ----------
   El usuario mostró su planilla: hay gente que no va con una institución
   (el presidente de la comunidad, quien cubre Brasil, quien cubre toda
   LatAm). Cada lugar con su gente, con la misma forma que una institución. */
{
  const conLugares = base => ({ ...base,
    personas: [...base.personas,
      { id: "per_julia", name: "Julia Lerner", email: null, note: null, telefonos: [{ n: "+55 11 99478 1099", wa: true }], idiomas: ["pt"], lista: null, created_by: ADMIN, created_at: hace(1) },
      { id: "per_dobkin", name: "Gabriel Dobkin", email: null, note: null, telefonos: [{ n: "+54 9 341 368 9150", wa: true }], idiomas: [], lista: null, created_by: ADMIN, created_at: hace(1) },
      { id: "per_dana", name: "Dana Bergman", email: null, note: null, telefonos: [{ n: "+56 9 9874 0101", wa: true }], idiomas: [], lista: null, created_by: ADMIN, created_at: hace(1) }],
    contactos: [...base.contactos,
      { id: "c_bra", institucion: null, nivel: "pais", country: "Brasil", city: null, zona: null, persona: "per_julia", cargo: "R Hadraja", orden: 0, created_at: hace(1) },
      { id: "c_lat", institucion: null, nivel: "latam", country: null, city: null, zona: null, persona: "per_julia", cargo: "Directora", orden: 0, created_at: hace(1) },
      { id: "c_arg", institucion: null, nivel: "pais", country: "Argentina", city: null, zona: null, persona: "per_dana", cargo: "RM", orden: 0, created_at: hace(1) },
      { id: "c_sur", institucion: null, nivel: "region", country: null, city: null, zona: "sur", persona: "per_dana", cargo: "R KM", orden: 0, created_at: hace(1) },
      { id: "c_ros", institucion: null, nivel: "ciudad", country: "Argentina", city: "Rosario", persona: "per_dobkin", cargo: "Presidente", orden: 0, created_at: hace(1) }] });
  const { p, errores } = await entrar(ADMIN, "Benny", { retocar: conLugares });
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector("#agendaBuscar");
  eq("lista: el resumen cuenta solo las instituciones como instituciones, y a toda la gente", await texto(p, ".ag-resumen"), "3 instituciones y 5 contactos en 3 ciudades de 3 países");
  eq("lista: toda LatAm, la región y después los países (Brasil solo con su gente)", await p.$$eval(".ag-pais-h b", l => l.map(e => e.textContent)), ["Toda LatAm", "Región Sur", "Argentina", "Brasil", "Uruguay"]);
  eq("lista: LatAm y la región dicen cuánta gente; un país, sus instituciones o su gente", await p.$$eval(".ag-pais-h small", l => l.map(e => e.textContent)), ["1 contacto", "1 contacto", "2 instituciones", "1 contacto", "1 institución"]);
  eq("lista: toda LatAm no lleva a ninguna ficha; la región y los países sí", await p.$$eval(".ag-pais-h", l => l.map(e => e.tagName + ":" + (e.dataset.zona || e.dataset.country || ""))), ["DIV:", "BUTTON:sur", "BUTTON:Argentina", "BUTTON:Brasil", "BUTTON:Uruguay"]);
  eq("lista: en Argentina, la gente del país va antes de las ciudades, y la de Rosario antes de su institución", await p.$$eval(".ag-pais:nth-of-type(3) .ag-fila, .ag-pais:nth-of-type(3) .ag-ciudad", l => l.map(e => e.classList.contains("ag-ciudad") ? "· " + e.textContent.trim() : e.querySelector(".ag-inst").textContent.replace(/\s+/g, " ").trim())),
    ["ArgentinaContactos del país", "· Buenos Aires", "Chabad Central Centro Comunitario · Agüero 1164", "· Rosario", "RosarioContactos de la ciudad", "Beit Chabad Rosario Centro Comunitario · Paraguay 1234"]);
  eq("lista: la gente de un lugar no es un botón (no hay ficha de institución que abrir)", await p.$$eval(".ag-lugar", l => l.map(e => e.tagName)), ["DIV", "DIV", "DIV", "DIV", "DIV"]);
  eq("lista: en LatAm y la región no se repite el título (ya está en el encabezado)", await p.$$eval(".ag-pais:nth-of-type(-n+2) .ag-lugar", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["Contactos de toda LatAm", "Contactos de la región"]);
  await escribir(p, "#agendaBuscar", "hadraja");
  eq("buscar por cargo encuentra a la gente de un lugar", await p.$$eval(".ag-fila .ag-lugar b", l => l.map(e => e.textContent.trim())), ["Brasil"]);
  await escribir(p, "#agendaBuscar", "");
  await p.selectOption("#agendaPais", "Argentina"); await p.waitForTimeout(120);
  eq("filtrar por país: su gente y la de sus ciudades; LatAm y la región no", await p.$$eval(".ag-pais-h b", l => l.map(e => e.textContent)), ["Argentina"]);
  await p.selectOption("#agendaPais", ""); await p.selectOption("#agendaTipo", "Sinagoga"); await p.waitForTimeout(120);
  eq("filtrar por tipo: solo instituciones (la gente de un lugar no tiene tipo)", await cuantos(p, ".ag-lugar"), 0);
  await p.click('[data-action="agenda-limpiar"]'); await p.waitForTimeout(120);
  // La ficha de una persona que está en dos lugares.
  await p.click('.ag-fila [data-action="agenda-ver-persona"][data-id="per_dana"]');
  await hasta(p, () => document.getElementById("agendaBody").dataset.vista === "personaper_dana");
  eq("persona: el subtítulo cuenta lugares, no instituciones", await texto(p, ".ag-cab-txt > small"), "RM · R KM · 2 lugares");
  eq("persona: «Dónde está», cada lugar con su cargo y qué es", await p.$$eval('#agendaBody .ag-items [data-action="agenda-ir-lugar"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["ArgentinaRM · País›", "Región SurR KM · Región›"]);
  await p.click('#agendaBody .ag-items [data-action="agenda-ir-lugar"][data-zona="sur"]');
  await p.waitForSelector('.fl-pliegue[data-que="hijos"]', { state: "attached" });
  eq("tocar la región lleva a su ficha, y se cierra la Agenda", [await abierta(p), await texto(p, ".fl-head h1")], [false, "Región Sur"]);
  const tarjeta = '.fl-card:has(.fl-pliegue[data-que="hijos"])';
  eq("región: su propia gente va primero en «Países», y después cada país", await p.$$eval(`${tarjeta} .fl-hijo`, l => l.map(e => [e.querySelector("b").textContent.trim(), e.querySelector("small").textContent.trim(), (e.querySelector(".fl-hijo-ag") || {}).textContent || ""])),
    [["Región Sur", "Contactos de la región", "📇 Dana Bergman"], ["Argentina", "último: hace 3 días", "📇 2 instituciones · 4 contactos"], ["Uruguay", "Sin actividad todavía", "📇 Beit Jabad Uruguay · Tzvi Grumblat"]]);
  // Sumar desde la ficha de una región: viene en «Región».
  await p.click(`${tarjeta} .fl-ag-pie [data-action="agenda-sumar"]`);
  await p.waitForSelector("#agFNombre");
  eq("sumar desde una región: «Dónde está» viene en Región · Sur", [await p.$eval('[data-action="agenda-form-nivel"].on', e => e.dataset.k), await p.inputValue("#agFZona")], ["region", "sur"]);
  await p.click('[data-action="agenda-form-nivel"][data-k="latam"]');
  await p.fill("#agFNombre", "Marcos Kohan"); await p.fill("#agFCargo", "Director General");
  await p.click('[data-action="agenda-guardar"]');
  await hasta(p, () => (window.__sb.tablas.contactos || []).some(c => c.nivel === "latam" && c.cargo === "Director General"));
  eq("sumar a toda LatAm: el contacto sin institución ni lugar", await p.evaluate(() => { const c = window.__sb.tablas.contactos.find(c => c.cargo === "Director General"); return [c.institucion, c.nivel, c.country, c.city, c.zona, c.orden]; }), [null, "latam", null, null, null, 1]);
  // La ficha de Argentina: su gente primero en «Ciudades».
  await irAPaises(p);
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector('.fl-pliegue[data-que="hijos"]', { state: "attached" });
  eq("país: su propia gente va primero en «Ciudades», con lo que es", await p.$$eval(`${tarjeta} .fl-hijo`, l => l.slice(0, 2).map(e => [e.querySelector("b").textContent.trim(), e.querySelector("small").textContent.trim()])), [["Argentina", "Contactos del país"], ["Rosario", "último: hace 3 días"]]);
  eq("país: Rosario cuenta su institución y sus dos", await p.$$eval(`${tarjeta} .fl-hijo .fl-hijo-ag`, l => l.map(e => e.textContent.trim())).then(l => l[1]), "📇 1 institución · 2 contactos");
  await p.click(`${tarjeta} .fl-ag-pie [data-action="agenda-sumar"]`);
  await p.waitForSelector("#agFNombre");
  eq("sumar desde un país: viene en País · Argentina", [await p.$eval('[data-action="agenda-form-nivel"].on', e => e.dataset.k), await p.inputValue("#agFPais")], ["pais", "Argentina"]);
  await p.click('[data-action="agenda-form-nivel"][data-k="ciudad"]');
  eq("al pasar a Ciudad, el país queda y falta la ciudad", [await p.inputValue("#agFPais"), await p.inputValue("#agFCiudad")], ["Argentina", ""]);
  await p.fill("#agFNombre", "Alguien");
  await p.click('[data-action="agenda-guardar"]'); await p.waitForTimeout(200);
  eq("sin ciudad no guarda: avisa", await p.$$eval("#agendaBody .ag-error", l => l.map(e => e.textContent)), ["Elegí el país y la ciudad."]);
  await p.click('[data-action="agenda-cerrar"]');
  // La planilla dice dónde está cada uno.
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector("#agendaBuscar");
  const csv = await p.evaluate(() => { const l = []; const orig = URL.createObjectURL; URL.createObjectURL = b => { l.push(b); return "blob:x"; }; document.querySelector('[data-action="agenda-planilla"]').click(); URL.createObjectURL = orig; return l[0] ? l[0].text() : ""; });
  eq("planilla: la columna «Dónde» y una fila por contacto de lugar", [csv.split("\r\n")[0].replace(/^\uFEFF/, "").replace(/"/g, "").split(";").slice(0, 4).join("|"), csv.split("\r\n").map(f => f.replace(/"/g, "")).filter(f => /^;;Toda LatAm|^Brasil;;País/.test(f)).length], ["País|Ciudad|Dónde|Institución", 3]);
  eq("sin errores (por lugar)", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
