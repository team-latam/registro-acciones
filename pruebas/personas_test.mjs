/* ======================================================================
   Personas sin cuenta (18-personas.sql), en la app de verdad (7/10/2026)

   Gente que participa pero no tiene cuenta (un voluntario, alguien de
   otra institución): se la suma desde cualquier evento, tiene su ficha
   (nombre, correo si se sabe, una nota), cuenta en la ficha de cada
   lugar y en los reportes, se unen los duplicados, y cuando entra a la
   app su historial pasa a su cuenta.
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
const evento = (id, titulo, pais, ciudad, participants, dias) => ({
  id, title: titulo, content: "", date: dia(dias), start_date: dia(dias), end_date: dia(dias), activity_type: "visita",
  author_name: "Benny", author_email: ADMIN, scopes: [{ type: ciudad ? "ciudad" : "pais", country: pais, city: ciudad }],
  images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants,
  recurrence_skip: [], recurrence_moves: {}, created_at: hace(dias) });
const BASE = () => ({
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z" },
            { email: "ana@x.com", name: "Ana Pérez", nickname: "ana", role: "member", approved_at: "2025-03-01T12:00:00Z" }],
  // «Darío» y «Dario» son la misma persona cargada dos veces; Guypo va a
  // pedir entrar a la app.
  personas: [{ id: "per_dario", name: "Darío", email: null, note: null, created_by: ADMIN, created_at: hace(30) },
             { id: "per_dario2", name: "Dario", email: "dario@x.com", note: "Swimmers", created_by: "ana@x.com", created_at: hace(20) },
             { id: "per_guypo", name: "Guypo", email: null, note: null, created_by: ADMIN, created_at: hace(20) }],
  posts: [evento("p_chile", "Swimmers Online", "Chile", "Santiago", [{ email: "ana@x.com", name: "ana" }, { persona: "per_dario", name: "Darío" }], 3),
          evento("p_arg", "Visita al club", "Argentina", "Buenos Aires", [{ persona: "per_dario2", name: "Dario" }, { persona: "per_guypo", name: "Guypo" }], 10)],
  replies: [], access_requests: [{ email: "guypo@x.com", name: "Guypo Levi", status: "pending", requested_at: hace(1) }],
  former_members: [], audit_log: [], app_config: [], user_prefs: [],
});

const b = await chromium.launch();
async function entrar(email, nombre, retocar = x => x){
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(u.includes("/functions/v1/")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ enviado: false, estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
  }, [retocar(BASE()), { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }]);
  await p.goto("file://" + RUTA);
  await p.waitForSelector('[data-action="toggle-user-menu"]', { timeout: 8000 });
  return { p, errores };
}
const hasta = async (p, fn, ms = 4000) => { try{ await p.waitForFunction(fn, null, { timeout: ms }); return true; }catch(e){ return false; } };
const base = p => p.evaluate(() => window.__sb.tablas);
// El texto de una sugerencia o de un chip, sin su avatar (la letra, el ✉️ o el +).
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => [...e.childNodes]
  .filter(n => !(n.classList && (n.classList.contains("mention-avatar") || n.classList.contains("participant-chip-sc") || n.classList.contains("participant-chip-avatar"))))
  .map(n => n.textContent).join("").replace(/\s+/g, " ").trim()));
async function irASinCuenta(p){
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="solicitudes"][data-key="usuarios"]');
  await p.click('[data-action="acceso-section"][data-key="sincuenta"]');
  await p.waitForSelector(".sc-lead");
}
const confirmar = async p => { await p.waitForSelector("#confirmOk", { state: "visible" }); await p.click("#confirmOk"); };

/* ---------- 1. Sumar desde un evento ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  eq("feed: un participante sin cuenta se ve con su nombre, marcado como sin cuenta",
     await p.$$eval('[data-post-id="p_chile"] .person-sin-cuenta, .post-card:has([data-post-id="p_chile"]) .person-sin-cuenta', l => l.map(e => [e.textContent.trim(), e.title])).then(l => l.slice(0, 1)),
     [["Darío", "Sin cuenta en la app"]]);
  await p.click('[data-action="toggle-fab"]');
  await p.click('.fab-action[data-action="new-evento"]');
  await p.waitForSelector("#cParticipantQuery");
  await p.fill("#cParticipantQuery", "Dar");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  eq("participantes: al escribir «Dar» se sugieren las fichas que ya existen (con cuántas actividades) y sumarlo como persona nueva",
     await textos(p, '#postForm [data-action="pick-participant"]'),
     ["Dario sin cuenta · 1 actividad", "Darío sin cuenta · 1 actividad", "Sumar «Dar» como persona nueva (sin cuenta)"]);
  await p.fill("#cParticipantQuery", "an");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  eq("participantes: alguien del equipo sale primero, y el nombre a medias también se puede sumar como persona",
     await textos(p, '#postForm [data-action="pick-participant"]'), ["ana ana@x.com", "Sumar «an» como persona nueva (sin cuenta)"]);
  await p.fill("#cParticipantQuery", "zeka@x.com");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  eq("participantes: un correo sigue siendo un invitado de Calendar, no una persona sin cuenta",
     await textos(p, '#postForm [data-action="pick-participant"]'), ['Sumar "zeka@x.com" como invitado']);
  await p.fill("#cParticipantQuery", "Zeka Cohen");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  await p.click('#postForm [data-action="pick-participant"]');
  eq("participantes: la persona nueva queda como chip, marcada «nueva» (todavía no tiene ficha)",
     await textos(p, "#postForm .participant-chip"), ["Zeka Cohen nueva✕"]);
  await p.fill("#cParticipantQuery", "zeka cohen");
  eq("participantes: y no se ofrece sumarla otra vez", await p.waitForTimeout(150).then(() => textos(p, '#postForm [data-action="pick-participant"]')), []);
  await p.fill("#cParticipantQuery", "Darío");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  await p.click('#postForm [data-action="pick-participant"]:has-text("Darío")');
  eq("participantes: la ficha existente se suma tal cual", await textos(p, "#postForm .participant-chip"), ["Zeka Cohen nueva✕", "Darío✕"]);
  await p.fill("#cTitle", "Charla en la escuela");
  await p.fill("#cPlaceQuery", "Uruguay");
  await p.waitForSelector('#postForm [data-action="pick-place"]');
  await p.click('#postForm [data-action="pick-place"]');
  await p.check("#cSinCalendar");
  await p.click('#postForm button[type="submit"]');
  eq("publicar: la persona nueva pasa a tener ficha (creada por quien publicó) y el evento la nombra por su ficha",
     await hasta(p, () => (window.__sb.tablas.posts || []).some(x => x.title === "Charla en la escuela")).then(async () => {
       const t = await base(p); const f = (t.personas || []).find(x => x.name === "Zeka Cohen");
       return [!!f, f && f.created_by, t.posts.find(x => x.title === "Charla en la escuela").participants.map(x => x.persona === (f || {}).id ? "ficha nueva" : x.persona)];
     }), [true, ADMIN, ["ficha nueva", "per_dario"]]);
  eq("publicar: en el feed se ve con su nombre", await hasta(p, () => [...document.querySelectorAll(".person-sin-cuenta")].some(e => e.textContent.trim() === "Zeka Cohen")), true);

  /* ---------- 2. Cuenta en la ficha del lugar y en los reportes ---------- */
  await p.click('nav.tabs button[data-view="paises"]');
  await p.waitForSelector('[data-action="drill-country"][data-country="Chile"]');
  await p.click('[data-action="drill-country"][data-country="Chile"]');
  await p.waitForSelector(".fl-gente");
  eq("ficha de lugar: «Quiénes trabajaron acá» cuenta a la persona sin cuenta (sin botón de perfil, porque no lo tiene)",
     await p.$$eval(".fl-gente > div", l => l.map(e => [e.querySelector(".nm").textContent.trim(), !!e.querySelector(".fl-persona"), !!e.querySelector(".sin-cuenta")])),
     [["Ana Pérez", true, false], ["Darío", false, true]]);
  await p.click('nav.tabs button[data-view="reportes"]');
  await p.waitForSelector('[data-action="reporte-filtros"]');
  await p.click('[data-action="reporte-filtros"]');
  await p.waitForSelector("#repFPersona");
  eq("reportes: el filtro por persona ofrece a las que no tienen cuenta, marcadas",
     await p.$$eval("#repFPersona option", l => l.map(e => e.textContent.trim()).filter(x => /sin cuenta/.test(x))),
     ["Dario · sin cuenta", "Darío · sin cuenta", "Guypo · sin cuenta", "Zeka Cohen · sin cuenta"]);

  /* ---------- 3. Administración → Personas → Sin cuenta ---------- */
  await irASinCuenta(p);
  eq("sin cuenta: la solapa dice cuántas hay", await p.$eval('[data-action="acceso-section"][data-key="sincuenta"]', e => e.textContent.replace(/\s+/g, " ").trim()), "Sin cuenta (4)");
  eq("sin cuenta: la lista, con más actividades primero, y el correo o «sin correo»",
     await p.$$eval('.lp-row[data-action="persona-abrir"] .lp-who', l => l.map(e => [...e.children].map(c => c.textContent.trim()).join(" "))),
     ["Darío 2 actividades · sin correo", "Dario 1 actividad · dario@x.com", "Guypo 1 actividad · sin correo", "Zeka Cohen 1 actividad · sin correo"]);
  await p.click('.lp-row[data-action="persona-abrir"][data-id="per_dario"]');
  await p.waitForSelector('[data-persona-campo="name"]');
  eq("ficha: nombre, correo y nota, y dónde estuvo",
     [await p.$eval('[data-persona-campo="name"]', e => e.value), await p.$eval('[data-persona-campo="email"]', e => e.value),
      await p.$$eval('.lp-panel [data-action="goto-mention"]', l => l.map(e => e.textContent.replace(/\s+/g, " ").trim().replace(/ · .*$/, "")))],
     ["Darío", "", ["🧳 Charla en la escuela", "🧳 Swimmers Online"]]);
  await p.fill('[data-persona-campo="name"]', "Darío Levi");
  await p.dispatchEvent('[data-persona-campo="name"]', "change");
  eq("ficha: corregir el nombre lo cambia en todos sus eventos (el nombre vive en la ficha)",
     await hasta(p, () => (window.__sb.tablas.personas || []).some(x => x.id === "per_dario" && x.name === "Darío Levi")).then(() => hasta(p, () => document.querySelector('.lp-row[data-id="per_dario"] b').textContent === "Darío Levi")), true);
  await p.fill('[data-persona-campo="email"]', "no es un correo");
  await p.dispatchEvent('[data-persona-campo="email"]', "change");
  await p.waitForSelector("#alertOk, #confirmOk", { state: "visible" }).catch(() => {});
  eq("ficha: un correo mal escrito no se guarda", (await base(p)).personas.find(x => x.id === "per_dario").email, null);
  await p.click("#alertOk, #confirmOk").catch(() => {});
  // Unir: «Dario» (la copia) es «Darío Levi».
  await p.click('.lp-row[data-action="persona-abrir"][data-id="per_dario2"]');
  await p.waitForSelector(".sc-unir");
  eq("unir: el selector ofrece a las demás fichas, no a esta",
     await p.$$eval(".sc-unir option", l => l.map(e => e.textContent.trim())), ["— es la misma persona que… —", "Darío Levi", "Guypo", "Zeka Cohen"]);
  await p.selectOption(".sc-unir", "per_dario");
  await p.click('[data-action="persona-unir"]');
  await p.waitForSelector("#confirmOk", { state: "visible" });
  eq("unir: pregunta antes, diciendo qué pasa", await p.$eval("#confirmMessage", e => e.textContent), "¿«Dario» y «Darío Levi» son la misma persona? Los eventos de «Dario» pasan a «Darío Levi», y la ficha de «Dario» se va.");
  await p.click("#confirmOk");
  eq("unir: la copia se va, sus eventos pasan a la que queda, y el correo que tenía la copia se conserva",
     await hasta(p, () => !(window.__sb.tablas.personas || []).some(x => x.id === "per_dario2")).then(async () => {
       const t = await base(p);
       return [t.posts.find(x => x.id === "p_arg").participants, t.personas.find(x => x.id === "per_dario").email, t.personas.length];
     }), [[{ persona: "per_dario", name: "Darío Levi" }, { persona: "per_guypo", name: "Guypo" }], "dario@x.com", 3]);
  eq("unir: la ficha que queda se abre, con sus 3 actividades",
     await hasta(p, () => /3 actividades/.test((document.querySelector('.lp-row[data-id="per_dario"]') || {}).textContent || "")), true);
  // Sumar a mano, desde acá, y borrar una ficha vacía.
  await p.click('[data-action="persona-nueva"]');
  await p.fill("#personaNuevaNombre", "Rabino Cohen");
  await p.click('[data-action="persona-crear"]');
  eq("sumar persona: la ficha nueva queda creada y abierta, sin actividades",
     await hasta(p, () => (window.__sb.tablas.personas || []).some(x => x.name === "Rabino Cohen")).then(() => hasta(p, () => !!document.querySelector('[data-action="persona-borrar"]'))), true);
  await p.click('[data-action="persona-nueva"]');
  await p.fill("#personaNuevaNombre", "dario levi");
  await p.click('[data-action="persona-crear"]');
  eq("sumar persona: un nombre que ya está (sin importar tildes ni mayúsculas) no se duplica: abre esa ficha",
     await hasta(p, () => (document.querySelector('.lp-row.on') || {}).dataset?.id === "per_dario").then(async () => (await base(p)).personas.length), 4);
  await p.click('.lp-row[data-action="persona-abrir"][data-id="per_dario"]');
  await p.click(`.lp-row[data-action="persona-abrir"][data-id="${(await base(p)).personas.find(x => x.name === "Rabino Cohen").id}"]`);
  await p.waitForSelector('[data-action="persona-borrar"]');
  await p.click('[data-action="persona-borrar"]');
  await confirmar(p);
  eq("borrar: solo una ficha sin actividades se puede borrar, y pregunta antes",
     await hasta(p, () => !(window.__sb.tablas.personas || []).some(x => x.name === "Rabino Cohen")), true);
  eq("borrar: una ficha con actividades no tiene el botón", await p.click('.lp-row[data-action="persona-abrir"][data-id="per_dario"]').then(() => p.waitForSelector(".sc-unir")).then(() => p.$$eval('[data-action="persona-borrar"]', l => l.length)), 0);

  /* ---------- 4. Cuando pide entrar a la app ---------- */
  await p.click('[data-action="acceso-section"][data-key="pendientes"]');
  await p.waitForSelector(".parece-persona");
  eq("solicitudes: si quien pide entrar se parece a una persona sin cuenta, se le pregunta al admin",
     await p.$eval(".parece-persona", e => [e.querySelector("b").textContent, /Aparece en 1 actividad \(la última: Visita al club\)/.test(e.textContent)]),
     ["¿Es «Guypo», que figura sin cuenta?", true]);
  await p.click('[data-action="aprobar-y-vincular"]');
  eq("solicitudes: «Sí» aprueba, pasa su historial a la cuenta nueva y la ficha se va",
     await hasta(p, () => (window.__sb.tablas.members || []).some(m => m.email === "guypo@x.com") && !(window.__sb.tablas.personas || []).some(x => x.id === "per_guypo")).then(async () => {
       const t = await base(p);
       return [t.posts.find(x => x.id === "p_arg").participants, t.personas.length];
     }), [[{ persona: "per_dario", name: "Darío Levi" }, { email: "guypo@x.com", name: "Guypo Levi" }], 2]);
  eq("sin errores en la página", errores, []);
  await p.close();
}

/* ---------- 5. «No es»: se descarta la pregunta; y por correo se vincula sola ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", t => { t.personas.find(x => x.id === "per_dario2").email = "guypo@x.com"; return t; });
  await irASinCuenta(p);
  await p.click('[data-action="acceso-section"][data-key="pendientes"]');
  await p.waitForSelector(".parece-persona");
  eq("solicitudes: el correo de la ficha manda sobre el nombre", await p.$eval(".parece-persona b", e => e.textContent), "¿Es «Dario», que figura sin cuenta?");
  await p.click('[data-action="parecido-no"]');
  eq("solicitudes: «No es» saca la pregunta y deja los botones de siempre",
     [await p.$$eval(".parece-persona", l => l.length), await p.$$eval('[data-action="approve-request"]', l => l.length)], [0, 1]);
  await p.click('[data-action="approve-request"]');
  eq("solicitudes: aun aprobando «de la forma normal», la ficha que tenía ese correo se vincula sola",
     await hasta(p, () => !(window.__sb.tablas.personas || []).some(x => x.id === "per_dario2")).then(async () => (await base(p)).posts.find(x => x.id === "p_arg").participants[0]), { email: "guypo@x.com", name: "Guypo Levi" });
  eq("sin errores en la página", errores, []);
  await p.close();
}

/* ---------- 6. Alguien del equipo (no admin) suma, pero no une ni vincula ---------- */
{
  const { p, errores } = await entrar("ana@x.com", "Ana Pérez");
  await p.click('[data-action="toggle-fab"]');
  await p.click('.fab-action[data-action="new-evento"]');
  await p.waitForSelector("#cParticipantQuery");
  await p.fill("#cParticipantQuery", "Moshe");
  await p.waitForSelector('#postForm [data-action="pick-participant"]');
  eq("equipo: cualquiera que carga eventos puede sumar una persona nueva",
     await textos(p, '#postForm [data-action="pick-participant"]'), ["Sumar «Moshe» como persona nueva (sin cuenta)"]);
  eq("equipo: Administración no está para quien no es admin", await p.evaluate(() => { const m = document.querySelector('.user-menu [data-view="admin"]'); return !!m; }), false);
  eq("sin errores en la página", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
