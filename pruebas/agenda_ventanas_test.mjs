/* ======================================================================
   La Agenda: el teclado y las ventanas (revisión del 9/10/2026)

   El usuario la probó en el celular: al abrirla se abría el teclado solo, y
   la ventana cambiaba de tamaño con cada paso. Esto cuida lo que se arregló
   (docs/auditoria/2026-10-09-agenda.md, A1 a A10). Lo demás de la Agenda,
   en agenda_test.mjs; los datos y entrar() son los mismos (separado para
   que cada archivo entre en los 5 minutos del corredor).
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
async function entrar(email, nombre, { viewport, lang, retocar = x => x } = {}){
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

/* ---------- 6. La revisión del 9/10/2026: el teclado, las ventanas, la Agenda vacía ----------
   El usuario la probó en el celular: al abrirla se abría el teclado solo, y
   la ventana cambiaba de tamaño con cada paso (la lista ocupaba la pantalla
   y una ficha era una tarjeta flotando). */
const rect = p => p.$eval(".agenda-modal", e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
// En el medio de la pantalla, como las demás ventanas (9/10/2026): la misma distancia al borde de arriba que al de abajo.
const centrada = p => p.$eval(".agenda-modal", e => { const r = e.getBoundingClientRect(); return Math.abs(r.top - (innerHeight - r.bottom)) <= 2; });
const enCampo = p => p.evaluate(() => { const a = document.activeElement; return !!a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !/^(checkbox|radio|button|submit)$/i.test(a.type))); });
// Espera a que la ventana muestre esa vista (hasta 4 segundos).
const vistaEs = async (p, re) => { try{ await p.waitForFunction(src => new RegExp(src).test(document.getElementById("agendaBody").dataset.vista || ""), re.source, { timeout: 4000 }); return true; }catch(e){ return false; } };
const tocar = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if(e) e.click(); return !!e; }, sel);
// «+ Sumar» de la lista: arriba; si no está ahí (el código de antes), el de la barra, para seguir midiendo lo demás.
const sumarDeLaLista = async p => { if(!await tocar(p, '.ag-cab [data-action="agenda-sumar"]')) await tocar(p, '#agendaBody [data-action="agenda-sumar"]'); await p.waitForSelector("#agFInst"); };
{
  const { p, errores } = await entrar(ADMIN, "Benny", { viewport: { width: 390, height: 844 } });
  eq("celular táctil: lo que se prueba", await p.evaluate(() => matchMedia("(hover: none) and (pointer: coarse)").matches), true);
  await tocar(p, '.bn-item[data-view="paises"]');
  await p.waitForSelector(".paises-agenda");
  await tocar(p, ".paises-agenda");
  await p.waitForSelector(".ag-fila");
  eq("celular: al abrir la Agenda no se abre el teclado (el foco no cae en el buscador)", await enCampo(p), false);
  eq("celular: pero el foco igual entra a la ventana", await p.evaluate(() => document.getElementById("agendaOverlay").contains(document.activeElement)), true);
  const lista = await rect(p);
  eq("celular: la lista ocupa la pantalla", lista[3] >= 844 - 30 && lista[1] >= 0, true);
  await tocar(p, '.ag-fila [data-action="agenda-ver-persona"]');
  await vistaEs(p, /^persona/);
  eq("celular: la ficha de una persona ocupa lo mismo que la lista (antes, una tarjeta flotando)", await rect(p), lista);
  await tocar(p, '[data-action="agenda-ver-inst"]');
  await vistaEs(p, /^inst/);
  eq("celular: la de una institución, también", await rect(p), lista);
  await tocar(p, '[data-action="agenda-volver"]'); await tocar(p, '[data-action="agenda-volver"]');
  await vistaEs(p, /^lista$/);
  await p.fill("#agendaBuscar", "rosario"); await p.waitForTimeout(150);
  await p.evaluate(() => document.activeElement.blur());
  await tocar(p, '[data-action="agenda-limpiar"]'); await p.waitForTimeout(150);
  eq("celular: «Limpiar» no abre el teclado", await enCampo(p), false);
  eq("celular: «+ Sumar» arriba, al lado del título", await cuantos(p, '.ag-cab [data-action="agenda-sumar"]'), 1);
  await sumarDeLaLista(p);
  eq("celular: el formulario no abre el teclado", await enCampo(p), false);
  eq("celular: y es del mismo tamaño", await rect(p), lista);
  await tocar(p, '[data-action="agenda-inst-nueva"]');
  await p.waitForSelector("#agINombre");
  eq("celular: «Otra institución» tampoco abre el teclado", await enCampo(p), false);
  for(let i = 0; i < 3; i++){ await p.keyboard.press("Escape"); await p.waitForTimeout(120); }
  // Desde la ficha de Rosario (la tarjeta viene plegada en el celular).
  await tocar(p, '[data-action="drill-country"][data-country="Argentina"]'); await p.waitForSelector(".fl-grid");
  await tocar(p, '[data-action="drill-city"][data-city="Rosario"]'); await p.waitForSelector('.fl-pliegue[data-que="contactos"]', { state: "attached" });
  await tocar(p, '.fl-ag-inst [data-action="agenda-ver-persona"]');
  await vistaEs(p, /^persona/);
  eq("celular: abierta desde la ficha de un lugar, también ocupa la pantalla", await rect(p), lista);
  eq("sin errores (celular, revisión)", errores, []);
  await p.close();
}
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector(".ag-fila");
  eq("compu: el foco sí va al buscador (con teclado físico no molesta)", await p.evaluate(() => document.activeElement.id), "agendaBuscar");
  // Pedido del 9/10/2026: una raya arriba de cada institución, también de la primera de cada ciudad.
  eq("compu: todas las instituciones con su raya arriba (antes, la primera de cada ciudad no)", await p.$$eval(".ag-fila", l => l.every(e => getComputedStyle(e).borderTopStyle === "solid")), true);
  eq("compu: «+ Sumar» arriba y no en la barra", [await cuantos(p, '.ag-cab [data-action="agenda-sumar"]'), await cuantos(p, '.ag-barra [data-action="agenda-sumar"]')], [1, 0]);
  eq("compu: la planilla, al final de la lista", await texto(p, '.ag-lista .ag-planilla [data-action="agenda-planilla"]'), "⬇ Bajar en planilla (3 instituciones)");
  eq("compu: arriba ya no se repite «3 instituciones · 2 contactos»", await cuantos(p, ".ag-cab small"), 0);
  const grande = await rect(p);
  // La C de las tres opciones (9/10/2026): 620 de ancho y la lista alta; en el medio de la pantalla
  // (pedido del usuario esa misma noche: no pegada arriba, como la ventana del Calendario).
  eq("compu: la Agenda, chica: 620 de ancho y alta", [grande[2], grande[3] >= 600], [620, true]);
  eq("compu: la Agenda, en el medio de la pantalla y no pegada arriba", await centrada(p), true);
  const mismoLugar = (r, g) => [r[0], r[2], r[3] <= g[3]];   // mismo lado y ancho; no más alta (el centro queda; cambia el alto)
  await p.click('.ag-fila [data-action="agenda-ver-persona"][data-id="per_grum"]');
  await vistaEs(p, /^persona/);
  eq("compu: la ficha de una persona, en el medio, del mismo ancho y con el alto a medida", [mismoLugar(await rect(p), grande), await centrada(p)], [[grande[0], grande[2], true], true]);
  eq("compu: la ficha, en una columna", await p.$eval(".ag-ficha", e => getComputedStyle(e).gridTemplateColumns), "none");
  eq("compu: «Copiar», corto, y el número en el título", [await texto(p, '[data-action="agenda-copiar"]'), await p.$eval('[data-action="agenda-copiar"]', e => e.title)], ["⧉ Copiar", "Copiar número"]);
  await p.click('#agendaBody [data-action="agenda-ver-inst"]');
  await vistaEs(p, /^inst/);
  eq("compu: la de una institución, igual", [mismoLugar(await rect(p), grande), await centrada(p)], [[grande[0], grande[2], true], true]);
  await p.click('[data-action="agenda-volver"]'); await p.click('[data-action="agenda-volver"]');
  await vistaEs(p, /^lista$/);
  // «+ Sumar» con varias instituciones a la vista: se elige, no viene elegida la primera.
  await sumarDeLaLista(p);
  eq("compu: el formulario, en el medio y del mismo ancho", [mismoLugar(await rect(p), grande), await centrada(p)], [[grande[0], grande[2], true], true]);
  // Sin blanco a los costados: los campos van de borde a borde, en una columna.
  eq("compu: el formulario ocupa todo el ancho", await p.evaluate(() => { const m = document.querySelector(".agenda-modal").getBoundingClientRect(), c = document.getElementById("agFInst").getBoundingClientRect(); return [c.left - m.left < 40, m.right - c.right < 40]; }), [true, true]);
  eq("compu: en una columna", await p.$eval(".ag-form", e => getComputedStyle(e).gridTemplateColumns), "none");
  eq("sumar desde toda la lista: la institución no viene elegida sola", await p.inputValue("#agFInst"), "");
  eq("y dice que hay que elegirla", await p.$eval("#agFInst", e => e.options[e.selectedIndex].textContent), "Elegí la institución…");
  await p.fill("#agFNombre", "Alguien Nuevo");
  const antes = await p.evaluate(() => window.__sb.escrituras.length);
  await p.click('[data-action="agenda-guardar"]'); await p.waitForTimeout(200);
  eq("sin elegir la institución no se guarda", [await cuantos(p, "#agendaBody .ag-error"), await p.evaluate(() => window.__sb.escrituras.length) === antes], [1, true]);
  await tocar(p, '.ag-pie [data-action="agenda-volver"]');
  await vistaEs(p, /^lista$/);
  await p.fill("#agendaBuscar", "rosario"); await p.waitForTimeout(150);
  await sumarDeLaLista(p);
  eq("con una sola a la vista, viene elegida esa", await p.inputValue("#agFInst"), "i_ros");
  await p.click('[data-action="agenda-cerrar"]');
  // Abierta desde la ficha de un lugar: del mismo ancho que la Agenda y en el medio, y no cambia de lado ni de ancho al ir a la institución.
  await irARosario(p);
  eq("ficha: «Lectura rápida» sin la línea de la Agenda (ya la dice su tarjeta)", await p.$$eval(".fl-lectura li", l => l.some(e => /En la Agenda/.test(e.textContent))), false);
  eq("ficha: el botón dice «Ver Agenda»", await texto(p, '.fl-ag-pie [data-action="agenda-abrir"]'), "Ver Agenda");
  // Al pie de «Contactos en …», en un mismo renglón: «+ Sumar» y «Ver Agenda». Ya no hay un
  // «+ Sumar a alguien más» en cada institución ni un «+ Sumar» en el título (pedido del 9/10/2026).
  eq("ficha: al pie, «+ Sumar» y «Ver Agenda» en un mismo renglón", await p.$$eval(".fl-ag-pie > button", l => { const r = l.map(e => e.getBoundingClientRect()); return [l.map(e => e.textContent.trim()), r.length === 2 && Math.abs(r[0].top - r[1].top) < 1 && r[0].right <= r[1].left]; }), [["+ Sumar", "Ver Agenda"], true]);
  eq("ficha: ninguna institución con su «+ Sumar a alguien más», ni «+ Sumar» en el título", [await cuantos(p, '.fl-ag-inst [data-action="agenda-sumar"]'), await cuantos(p, '.fl-card:has(.fl-pliegue[data-que="contactos"]) h3 [data-action="agenda-sumar"]')], [0, 0]);
  // El WhatsApp chico tiene forma de botón: su anillo de foco va hacia adentro, como el de los
  // botones; hacia afuera, la lista se lo cortaba al pie (en GitHub, recortes_test, 9/10/2026).
  await p.keyboard.press("Tab");
  eq("el WhatsApp chico: anillo de foco hacia adentro", await p.$eval(".fl-ag .ag-wa.chico", e => { e.focus(); return [e.matches(":focus-visible"), getComputedStyle(e).outlineOffset]; }), [true, "-2px"]);
  eq("ficha: en la tarjeta angosta, el teléfono en su renglón, sin un «·» colgando", await p.$eval('.fl-ag .ag-fila-p small', e => [[...e.querySelectorAll(".ag-sep")].every(s => getComputedStyle(s).display === "none"), getComputedStyle(e.querySelector(".ag-tel")).display]), [true, "block"]);
  await p.click('.fl-ag-inst [data-action="agenda-ver-persona"][data-id="per_tawil"]');
  await vistaEs(p, /^persona/);
  const desdeLugar = await rect(p);
  // Del mismo tamaño que la Agenda, se abra de donde se abra (pedido del usuario, 9/10/2026).
  eq("compu: desde la ficha de un lugar, el mismo ancho que la Agenda y en el medio", [mismoLugar(desdeLugar, grande), await centrada(p)], [[grande[0], grande[2], true], true]);
  await p.click('#agendaBody [data-action="agenda-ver-inst"]');
  await vistaEs(p, /^inst/);
  const enInst = await rect(p);
  eq("compu: y al pasar a la institución sigue en el medio y del mismo ancho", [enInst[0], enInst[2], await centrada(p)], [desdeLugar[0], desdeLugar[2], true]);
  await p.click('[data-action="agenda-cerrar"]');
  // Desde «Buscar en todo»: al cerrar, el foco vuelve al buscador.
  await p.fill("#globalSearchInput", "rosario"); await p.waitForTimeout(250);
  await p.click('[data-action="gs-institucion"]');
  await vistaEs(p, /^inst/);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  eq("buscar en todo: al cerrar la ficha, el foco vuelve al buscador", await p.evaluate(() => document.activeElement.id), "globalSearchInput");
  eq("sin errores (compu, revisión)", errores, []);
  await p.close();
}
// La Agenda vacía: qué es y cómo se empieza, sin buscador ni «0 instituciones en 0 ciudades».
const vacia = base => { base.instituciones = []; base.contactos = []; base.agenda_listas = []; return base; };
for(const [quien, nombre, botones] of [[ADMIN, "Benny", ["agenda-a-administracion", "agenda-sumar"]], ["obs@x.com", "Olga Obs", []]]){
  const { p, errores } = await entrar(quien, nombre, { retocar: vacia });
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector(".ag-vacia, .empty-state");
  eq(`vacía (${nombre}): sin buscador, filtros ni resumen`, [await cuantos(p, "#agendaBuscar"), await cuantos(p, "#agendaPais"), await cuantos(p, ".ag-resumen")], [0, 0, 0]);
  eq(`vacía (${nombre}): dice qué es`, /Todavía no hay nadie en la Agenda/.test(await texto(p, ".ag-vacia")), true);
  eq(`vacía (${nombre}): cómo se empieza, según quién`, await p.$$eval(".ag-vacia [data-action]", l => l.map(e => e.dataset.action)), botones);
  eq(`sin errores (vacía, ${nombre})`, errores, []);
  await p.close();
}
// Hebreo en el celular: una ciudad de una sola palabra larguísima no corre la página, y la raya de lo vacío va del lado de la página.
{
  const larga = base => { base.instituciones.push({ id: "i_larga", name: "Jabad", country: "Argentina", city: "Superlargapalabrasinespaciosquenoterminanuncayrompelasfilas", address: null, tipo: null, estado: "activa", nota: null, lista: null, created_by: ADMIN, created_at: hace(1) }); return base; };
  const { p, errores } = await entrar(ADMIN, "Benny", { viewport: { width: 390, height: 844 }, lang: "he", retocar: larga });
  await tocar(p, '.bn-item[data-view="paises"]');
  await p.waitForSelector(".paises-agenda");
  await tocar(p, ".paises-agenda");
  await p.waitForSelector(".ag-fila");
  eq("hebreo: una ciudad larguísima no se sale de la pantalla", await p.evaluate(() => [...document.querySelectorAll("#agendaBody *")].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map(e => e.className || e.tagName).slice(0, 3)), []);
  await tocar(p, '.ag-fila [data-action="agenda-ver-persona"][data-id="per_tawil"]');
  await vistaEs(p, /^persona/);
  eq("hebreo: lo vacío (—) sin dir=auto, del mismo lado que lo demás", await p.$$eval(".ag-dl dd", l => l.filter(d => d.querySelector(".ag-vacio") && d.hasAttribute("dir")).length), 0);
  eq("sin errores (hebreo largo)", errores, []);
  await p.close();
}
{
  const { p } = await entrar(ADMIN, "Benny", { lang: "en" });
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector(".ag-fila");
  await sumarDeLaLista(p);
  eq("inglés: el ejemplo de correo, en inglés", await p.$eval('[data-ag-campo="correo"]', e => e.placeholder), "name@example.org");
  await p.close();
}

// Los retoques del 9/10/2026 a la noche: «Sumar a alguien» entra sin barra también en una
// pantalla más baja; la tarjeta de contactos dice «Ver más»; al pie de una ficha, nada.
{
  const { p, errores } = await entrar(ADMIN, "Benny", { viewport: { width: 1280, height: 800 } });
  await irAPaises(p);
  await p.click(".paises-agenda");
  await p.waitForSelector(".ag-fila");
  await sumarDeLaLista(p);
  eq("compu baja (800): «Sumar a alguien» entra entero, sin barra", await p.evaluate(() => { const f = document.querySelector(".ag-form"); return [f.scrollHeight <= f.clientHeight + 1, innerHeight]; }), [true, 800]);
  eq("compu: Nombre | Cargo y Correo | Idiomas van de a dos", await p.$$eval(".ag-form .ag-dos", l => l.map(d => [...d.querySelectorAll(":scope > .ag-campo > span, :scope > .ag-celda > .ag-campo > span")].map(e => e.textContent.trim().split(" ")[0]))), [["Nombre", "Cargo"], ["Correo", "Idiomas"]]);
  await p.click('[data-action="agenda-cerrar"]');
  const base = await p.evaluate(() => window.__sb.tablas);
  await p.evaluate(() => { const b = document.querySelector(".paises-agenda"); b.click(); });
  await p.waitForSelector(".ag-fila");
  await p.click('.ag-fila [data-action="agenda-ver-persona"][data-id="per_grum"]');
  await vistaEs(p, /^persona/);
  eq("persona traída de una lista: al pie, nada (ni «De qué lista» ni «Sumado por»)", [await texto(p, ".ag-pie small"), base.personas.find(x => x.id === "per_grum").lista], ["", "l1"]);
  await p.click('[data-action="agenda-cerrar"]');
  eq("sin errores (retoques)", errores, []);
  await p.close();
}
{
  // Con más de cinco instituciones en la ciudad, la tarjeta de contactos ofrece «Ver más» (decía «Ver los 11»).
  const seis = base => { for(let i = 0; i < 6; i++) base.instituciones.push({ id: "extra" + i, name: "Institución " + i, country: "Argentina", city: "Rosario", address: null, tipo: null, estado: "activa", nota: null, lista: null, created_by: ADMIN, created_at: hace(1) }); return base; };
  const { p, errores } = await entrar(ADMIN, "Benny", { retocar: seis });
  await irARosario(p);
  eq("ficha: la tarjeta de contactos dice «Ver más», como las demás", await texto(p, '.fl-card:has(.fl-pliegue[data-que="contactos"]) .fl-mas'), "Ver más");
  await p.click('.fl-card:has(.fl-pliegue[data-que="contactos"]) .fl-mas');
  eq("y abierta, «Ver menos»", await texto(p, '.fl-card:has(.fl-pliegue[data-que="contactos"]) .fl-mas'), "Ver menos");
  eq("y abierta, sin barra propia: crece con la página, como «Ciudades»", await p.$eval('.fl-card:has(.fl-pliegue[data-que="contactos"])', c =>
    [c, ...c.querySelectorAll("*")].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1).length), 0);
  eq("sin errores (ver más)", errores, []);
  await p.close();
}

{
  // Una ciudad con actividad y sin nadie en la Agenda: quien carga eventos tiene «+ Sumar» al pie (y
  // solo ese); a quien observa no le sirve y no ve la tarjeta.
  const sinGente = base => { base.posts.push({ ...base.posts[0], id: "p_men", title: "Visita a Mendoza", scopes: [{ type: "ciudad", country: "Argentina", city: "Mendoza" }] }); return base; };
  for(const [quien, nombre, pie] of [[ADMIN, "Benny", ["+ Sumar"]], ["obs@x.com", "Olga Obs", null]]){
    const { p, errores } = await entrar(quien, nombre, { retocar: sinGente });
    await irAPaises(p);
    await p.click('[data-action="drill-country"][data-country="Argentina"]');
    await p.waitForSelector('[data-action="drill-city"][data-city="Mendoza"]');
    await p.click('[data-action="drill-city"][data-city="Mendoza"]');
    await p.waitForSelector(".fl-historia");
    await p.waitForTimeout(250);
    const t = '.fl-card:has(.fl-pliegue[data-que="contactos"])';
    if(pie){
      eq(`sin nadie en la ciudad (${nombre}): lo dice y deja «+ Sumar» al pie, solo`, [await texto(p, `${t} .fl-nada`), await p.$$eval(`${t} .fl-ag-pie > button`, l => l.map(e => e.textContent.trim()))], ["Todavía no hay nadie en la Agenda de Mendoza.", pie]);
      eq(`sin nadie en la ciudad (${nombre}): y ninguno en el título`, await cuantos(p, `${t} h3 [data-action="agenda-sumar"]`), 0);
    } else eq(`sin nadie en la ciudad (${nombre}): no hay tarjeta de contactos`, await cuantos(p, ".fl-pliegue[data-que=\"contactos\"]"), 0);
    eq(`sin errores (${nombre}, ciudad sin gente)`, errores, []);
    await p.close();
  }
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
