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
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
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
async function entrar(email, nombre, { viewport, lang } = {}){
  const p = await b.newPage({ viewport: viewport || { width: 1280, height: 900 }, ...(viewport && viewport.width < 800 ? { hasTouch: true, isMobile: true } : {}) });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(u.includes("/functions/v1/")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ enviado: false, estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion, lang]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
    try{ if(lang) localStorage.setItem("ra_lang", lang); }catch(e){}
  }, [BASE(), { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }, lang || ""]);
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
  eq("persona: de qué lista vino", /De «Directorio Chabad LatAm»/.test(await texto(p, ".ag-pie small")), true);
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

  // La ficha de Rosario: «Contactos en Rosario» y «Ver en la Agenda».
  await irARosario(p);
  eq("ficha: la tarjeta de contactos con su resumen", await texto(p, '.fl-pliegue[data-que="contactos"] .r'), "Beit Chabad Rosario · Shlomo Tawil");
  eq("ficha: la gente de la institución", await p.$$eval('.fl-ag-inst [data-action="agenda-ver-persona"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())).then(l => l.some(x => /Shlomo Tawil/.test(x))), true);
  await p.click('.fl-ag-pie [data-action="agenda-abrir"]');
  await p.waitForSelector("#agendaBuscar");
  eq("«Ver en la Agenda»: abre filtrada en Rosario", [await cuantos(p, ".ag-fila"), /Rosario/.test(await texto(p, '[data-action="agenda-sin-ciudad"]'))], [1, true]);
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

/* ---------- 2. Alguien del equipo: suma y corrige; no borra ---------- */
{
  const { p, errores } = await entrar("ana@x.com", "Ana Pérez");
  await irARosario(p);
  eq("ficha: quien carga eventos ve «+ Sumar»", await cuantos(p, '.fl-plegable [data-action="agenda-sumar"][data-inst="i_ros"]') > 0, true);
  await p.click('.fl-plegable [data-action="agenda-sumar"][data-inst="i_ros"]');
  await p.waitForSelector("#agFNombre");
  eq("sumar: la institución ya viene elegida", await p.inputValue("#agFInst"), "i_ros");
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

  // Alguien nuevo, con un teléfono mal escrito primero.
  await p.click('.fl-plegable [data-action="agenda-sumar"][data-inst="i_ros"]');
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
  eq("alguien nuevo: su ficha con el teléfono, y el contacto en Rosario", await p.evaluate(() => {
    const x = window.__sb.tablas.personas.find(y => y.name === "Daniel Kohan"), c = window.__sb.tablas.contactos.find(y => y.persona === x.id);
    return [x.telefonos, c.institucion, c.cargo, c.orden]; }), [[{ n: "+54 9 341 777-8888", wa: true }], "i_ros", "Presidente", 2]);

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
  eq("«Ver en la Agenda»: solo lo de esa lista", [await cuantos(p, ".ag-fila"), await p.inputValue("#agendaLista").then(v => !!v)], [3, true]);
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

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
