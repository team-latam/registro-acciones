/* ======================================================================
   Avisos por correo (17-avisos-por-correo.sql), en la app de verdad

   - Mis preferencias → Notificaciones: la tarjeta «Avisos por correo»
     aparece solo para quien puede recibir correos (de fábrica, el admin
     fijo), y guarda prendido/apagado, cuándo y de qué.
   - Administración → Correos: quién puede recibirlos.
   - Publicar con una @mención le pide el aviso a la función `avisar`.
   - El enlace de un correo (?post=…) abre ese posteo.
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
const hoy = new Date().toISOString().slice(0, 10);
const BASE = (prefsEquipo = {}) => ({
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z" },
            { email: "ana@x.com", name: "Ana Pérez", nickname: "ana", role: "member", approved_at: "2025-03-01T12:00:00Z" }],
  posts: [{ id: "p_ana", title: "Visita a Rosario", content: "Hola", date: hoy, start_date: hoy, end_date: hoy, activity_type: "visita",
            author_name: "Ana Pérez", author_email: "ana@x.com", scopes: [], images: [], files: [], links: [], mentions: [], liked_by: [],
            milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {}, created_at: new Date().toISOString() }],
  replies: [], access_requests: [], former_members: [], audit_log: [],
  app_config: [{ key: "preferences", value: { ...prefsEquipo } }], user_prefs: [],
});

const b = await chromium.launch();
async function entrar(email, nombre, { prefsEquipo, query = "" } = {}){
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const avisos = [], errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const req = ruta.request(), u = req.url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(u.includes("/functions/v1/avisar")){
      avisos.push(JSON.parse(req.postData() || "{}"));
      return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ enviado: true }) });
    }
    if(u.includes("/functions/v1/calendario")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
  }, [BASE(prefsEquipo), { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }]);
  await p.goto("file://" + RUTA + query);
  await p.waitForSelector('[data-action="toggle-user-menu"]', { timeout: 8000 });
  return { p, avisos, errores };
}
async function irANotificaciones(p){
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  await p.click('[data-action="config-section"][data-key="notificaciones"]');
  await p.waitForTimeout(200);
}
const misPrefs = (p, email) => p.evaluate(e => ((window.__sb.tablas.user_prefs || []).find(f => f.email === e) || {}).prefs || {}, email);

{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await irANotificaciones(p);
  eq("el admin ve «Avisos por correo», prendido, una vez por día, con menciones, respuestas y pedidos",
     await p.evaluate(() => { const c = document.querySelector(".avisos-correo"); return c && [
       c.querySelector('input[data-pref="emailOn"]').checked,
       c.querySelector('[data-action="correo-cuando"].active').dataset.key,
       [...c.querySelectorAll('[data-action="correo-tema"].active')].map(x => x.dataset.key)]; }),
     [true, "daily", ["menciones", "respuestas", "pedidos"]]);
  await p.click('[data-action="correo-cuando"][data-key="instant"]');
  await p.click('[data-action="correo-tema"][data-key="nuevos"]');
  await p.waitForTimeout(300);
  eq("cambiar cuándo y de qué se guarda en sus preferencias",
     await misPrefs(p, ADMIN).then(x => [x.emailWhen, x.emailWhat]), ["instant", ["menciones", "respuestas", "pedidos", "nuevos"]]);
  await p.click('.avisos-correo .pref-switch');
  await p.waitForTimeout(300);
  eq("apagado: se guarda y quedan escondidas las opciones",
     [await misPrefs(p, ADMIN).then(x => x.emailOn), await p.$$eval('.avisos-correo [data-action="correo-cuando"]', l => l.length)], [false, 0]);
  eq("sin errores", errores, []);
  await p.close();
}
{
  const { p } = await entrar("ana@x.com", "Ana Pérez");
  await irANotificaciones(p);
  eq("de fábrica, a una integrante no le aparece (solo el admin recibe correos)", await p.$(".avisos-correo"), null);
  await p.close();
}
{
  const { p } = await entrar("ana@x.com", "Ana Pérez", { prefsEquipo: { correos: { quienes: "elegidos", elegidos: ["ana@x.com"] } } });
  await irANotificaciones(p);
  eq("si el admin la eligió, le aparece, sin «pedidos de acceso»",
     await p.$$eval('.avisos-correo [data-action="correo-tema"]', l => l.map(x => x.dataset.key)), ["menciones", "respuestas", "nuevos", "proximos"]);
  await p.close();
}
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="correos"]');
  eq("Administración → Correos: de fábrica, «Solo yo»",
     await p.$eval('[data-action="correos-quienes"][aria-checked="true"]', e => e.dataset.key), "admin");
  await p.click('[data-action="correos-quienes"][data-key="elegidos"]');
  await p.click('[data-action="correos-elegir"][data-email="ana@x.com"]');
  await p.waitForTimeout(300);
  eq("elegir personas se guarda en la configuración del equipo",
     await p.evaluate(() => ((window.__sb.tablas.app_config || []).find(c => c.key === "preferences") || {}).value.correos),
     { quienes: "elegidos", elegidos: ["ana@x.com"] });
  eq("sin errores", errores, []);
  await p.close();
}
{
  const { p, avisos } = await entrar(ADMIN, "Benny");
  await p.click('[data-action="toggle-reply"][data-post-id="p_ana"]');
  await p.fill("#replyContent-p_ana", "Gracias @ana");
  await p.click('[data-action="submit-reply"][data-post-id="p_ana"]');
  await p.waitForFunction(() => (window.__sb.tablas.replies || []).length > 0, null, { timeout: 5000 });
  await p.waitForTimeout(300);
  eq("publicar un comentario con mención le pide el aviso a la función, con ese comentario",
     avisos, [{ tipo: "respuesta", id: await p.evaluate(() => window.__sb.tablas.replies[0].id) }]);
  await p.close();
}
{
  const { p } = await entrar(ADMIN, "Benny", { query: "?post=p_ana" });
  const salto = await p.waitForFunction(() => { const c = document.querySelector('.post[data-post-id="p_ana"]'); return c && c.classList.contains("flash") || location.search === ""; }, null, { timeout: 5000 }).then(() => true, () => false);
  eq("el enlace de un correo (?post=…) lleva a ese posteo y se limpia la dirección",
     [salto, await p.evaluate(() => location.search)], [true, ""]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
