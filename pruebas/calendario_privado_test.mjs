/* ======================================================================
   El calendario del equipo, leído sin que sea público (docs/AUDITORIA.md, U5)

   La app le pide los cambios a la función `calendario` de Supabase, con
   la sesión de quien la usa, y la función lee con la cuenta de servicio.
   El calendario se cerró el 6/10/2026: la clave de API ya no lo lee, y la
   app no la vuelve a intentar para el calendario del equipo.
   Con la app de verdad y el Supabase de mentira de app_dom_test.mjs.
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
const PAGINA = "file://" + (process.env.INDEX || RAIZ + "index.html");
// La librería de Supabase se carga como script con huella (UMD, ver SUPABASE_CDN
// en index.html): acá se sirve la de mentira como script clásico que deja `supabase`.
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
const FALSO_UMD = () => FALSO.replace("export function createClient", "function createClient") + "\nvar supabase = { createClient };";
const ADMIN = "benny@team-latam.com";
const hoy = new Date().toISOString().slice(0, 10);
const evento = id => ({ id, status: "confirmed", summary: `Visita a Córdoba ${id}`, start: { date: hoy }, end: { date: hoy } });
const BASE = () => ({
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z", calendar_shared: true }],
  posts: [], replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [],
});

const b = await chromium.launch();
// `funcion`: lo que contesta la función de Supabase (null = no está).
async function entrar({ funcion, conToken = true }){
  const p = await b.newPage();
  const pedidos = [];
  const errores = [], consola = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => consola.push(m.text()));
  await p.route(/^https?:\/\//, ruta => {
    const req = ruta.request(), u = req.url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO_UMD() });
    if(u.includes("/functions/v1/calendario")){
      pedidos.push({ a: "funcion", auth: req.headers()["authorization"], apikey: req.headers()["apikey"], cuerpo: JSON.parse(req.postData() || "null") });
      if(!funcion) return ruta.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Requested function was not found" }) });
      return ruta.fulfill({ contentType: "application/json", body: JSON.stringify(funcion) });
    }
    if(/^https:\/\/www\.googleapis\.com\/calendar\//.test(u)){
      pedidos.push({ a: "google", url: u });
      return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [evento("evclave")], nextSyncToken: "tok-clave" }) });
    }
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
  }, [BASE(), { access_token: conToken ? "sesion-de-benny" : undefined, user: { id: "uuid-benny", email: ADMIN, user_metadata: { full_name: "Benny" } } }]);
  await p.goto(PAGINA);
  const traido = id => p.waitForFunction(id => (window.__sb.tablas.posts || []).some(x => x.calendar_event_id === id), id, { timeout: 8000 }).then(() => true, () => false);
  return { p, pedidos, errores, traido, consola };
}

{
  const { p, pedidos, errores, traido } = await entrar({ funcion: { estado: 200, cuerpo: { items: [evento("evfuncion")], nextSyncToken: "tok-funcion", timeZone: "America/Argentina/Buenos_Aires" } } });
  eq("con la función: el evento de Calendar entra al Registro", await traido("evfuncion"), true);
  const f = pedidos.find(x => x.a === "funcion");
  eq("con la función: le pide los cambios con la sesión de la persona y la llave pública",
     [f && f.cuerpo.accion, f && f.auth, f && /^sb_publishable_/.test(f.apikey)], ["cambios", "Bearer sesion-de-benny", true]);
  eq("con la función: no le pide nada a Google con la clave de API", pedidos.filter(x => x.a === "google").length, 0);
  eq("con la función: guarda el token que vino por ella",
     await p.waitForFunction(() => ((window.__sb.tablas.app_config || []).find(c => c.key === "calendarSync") || {}).value?.syncToken === "tok-funcion", null, { timeout: 5000 }).then(() => true, () => false), true);
  eq("con la función: sin errores", errores, []);
  await p.close();
}
{
  const { p, pedidos, errores, traido } = await entrar({ funcion: { estado: 410, cuerpo: { error: { message: "gone" } } } });
  await p.waitForTimeout(1500);
  eq("token vencido por la función: no trae nada roto ni cae a la clave de API",
     [pedidos.filter(x => x.a === "google").length, (await p.evaluate(() => window.__sb.tablas.posts.length))], [0, 0]);
  eq("token vencido: sin errores", errores, []);
  await p.close();
}
{
  const { p, pedidos, errores, traido } = await entrar({ funcion: null });
  eq("si la función no atiende: no cae a la clave de API para el calendario del equipo",
     [await traido("evclave"), pedidos.some(x => x.a === "funcion"), pedidos.filter(x => x.a === "google").length], [false, true, 0]);
  eq("si la función no atiende: la app no se rompe", errores, []);
  await p.close();
}

{
  // Un admin cambió el ID del calendario sin compartírselo a la cuenta de
  // la app: Google contesta 404 «Not Found», que no le dice nada a nadie.
  const { p, consola } = await entrar({ funcion: { estado: 404, cuerpo: { error: { code: 404, message: "Not Found" } } } });
  await p.waitForTimeout(1500);
  eq("calendario sin compartir con la cuenta de la app: el error lo dice con palabras",
     consola.some(x => /no puede leer este calendario/.test(x)), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
