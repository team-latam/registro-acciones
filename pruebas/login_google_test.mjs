/* ======================================================================
   Entrar con el botón de Google de la página (pedido del 6/10/2026)

   Antes la pantalla de Google decía «Prosseguir para
   benonmzlgdjkhzauamrz.supabase.co». Ahora la página le pide la identidad
   a Google (Google Identity Services) y se la pasa a Supabase
   (signInWithIdToken), con un nonce: a Google su huella, a Supabase el
   original. Si Google no carga, o Supabase rechaza la identidad, queda el
   camino de siempre (signInWithOAuth). Con la app de verdad, el Supabase
   de mentira de app_dom_test.mjs y un Google de mentira.
   ====================================================================== */
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
import { createHash } from "node:crypto";
import fs from "node:fs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "pruebas/app_dom_test.mjs", "utf8");
const FALSO = src.slice(src.indexOf("const FALSO = `") + "const FALSO = `".length, src.indexOf("}`;\n\nconst ADMIN") + 1);
const PAGINA = "file://" + (process.env.INDEX || RAIZ + "index.html");
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
// Google Identity Services, de mentira: guarda con qué se lo inicializó y
// dibuja un botón que, al tocarlo, devuelve una identidad.
const GIS = `window.google = { accounts: {
  oauth2: { initTokenClient(){ return { requestAccessToken(){} }; } },
  id: {
    initialize(cfg){ window.__gis = cfg; window.__gisInits = (window.__gisInits || 0) + 1; },
    renderButton(el, op){ window.__gisOp = op; const b = document.createElement("button"); b.id = "botonGoogle";
      b.textContent = "Iniciar sesión con Google"; b.onclick = () => window.__gis.callback({ credential: "jwt-de-google" }); el.appendChild(b); },
    disableAutoSelect(){ window.__gisSalio = true; },
  } } };`;
const BASE = () => ({
  members: [{ email: "ana@x.com", name: "Ana Pérez", nickname: "ana", role: "member", approved_at: "2025-03-01T12:00:00Z" }],
  posts: [], replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [],
});

const b = await chromium.launch();
async function portada({ sinGoogle = false, rechazar = false } = {}){
  const p = await b.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(u.startsWith("https://accounts.google.com/gsi/client") && !sinGoogle) return ruta.fulfill({ contentType: "application/javascript", body: GIS });
    if(u.includes("/functions/v1/calendario")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, rechazar]) => {
    window.__sb = { tablas: base, sesion: null, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0, rechazarToken: rechazar };
    window.__pruebasSinIntegridad = true;
    window.__pruebasBotonGoogle = true;
  }, [BASE(), rechazar]);
  await p.goto(PAGINA);
  await p.waitForSelector(".gate-tarjeta", { timeout: 8000 });
  return { p, errores };
}

{
  const { p, errores } = await portada();
  const listo = await p.waitForSelector("#gisBoton #botonGoogle", { timeout: 5000 }).then(() => true, () => false);
  eq("se dibuja el botón de Google en la portada", listo, true);
  eq("y el nuestro queda escondido (de repuesto)", await p.$eval(".gate-tarjeta .btn-google", e => getComputedStyle(e).display), "none");
  const cfg = await p.evaluate(() => ({ cliente: window.__gis.client_id, nonce: window.__gis.nonce, modo: window.__gis.ux_mode, idioma: window.__gisOp.locale }));
  eq("con el cliente de la app, en una ventanita, en el idioma de la página, y con la huella de un nonce",
     [/^40280679854-.*\.apps\.googleusercontent\.com$/.test(cfg.cliente), cfg.modo, cfg.idioma, /^[0-9a-f]{64}$/.test(cfg.nonce)], [true, "popup", "es", true]);
  await p.click("#botonGoogle");
  await p.waitForFunction(() => window.__sb.logins.length > 0, null, { timeout: 5000 });
  const login = await p.evaluate(() => window.__sb.logins[0]);
  eq("al elegir la cuenta, la identidad de Google va a Supabase, no por la redirección",
     [login.conToken && login.conToken.provider, login.conToken && login.conToken.token, !!login.redirectTo], ["google", "jwt-de-google", false]);
  eq("con el nonce original, cuya huella es la que vio Google",
     createHash("sha256").update(login.conToken.nonce).digest("hex"), cfg.nonce);
  eq("y entra a la app", await p.waitForSelector(".gate-tarjeta", { state: "detached", timeout: 8000 }).then(() => true, () => false), true);
  eq("la portada con Google: sin errores", errores, []);
  await p.close();
}
{
  const { p, errores } = await portada({ rechazar: true });
  await p.waitForSelector("#gisBoton #botonGoogle", { timeout: 5000 });
  await p.click("#botonGoogle");
  await p.waitForFunction(() => window.__sb.logins.length > 1, null, { timeout: 5000 }).catch(() => {});
  const logins = await p.evaluate(() => window.__sb.logins);
  eq("si Supabase rechaza la identidad, sigue por el camino de siempre (no deja a nadie afuera)",
     [!!logins[0].conToken, logins[1] && logins[1].provider, !!(logins[1] && logins[1].options && logins[1].options.redirectTo)], [true, "google", true]);
  eq("rechazada: sin errores", errores, []);
  await p.close();
}
{
  // Fuera de la dirección del sitio (acá, file://) no se intenta: Google
  // contestaría «origin not allowed» en la consola.
  const p = await b.newPage();
  const pedidos = [];
  await p.route(/^https?:\/\//, ruta => { const u = ruta.request().url(); pedidos.push(u);
    return u === CDN ? ruta.fulfill({ contentType: "application/javascript", body: FALSO }) : ruta.fulfill({ contentType: "application/javascript", body: GIS }); });
  await p.addInitScript(base => { window.__sb = { tablas: base, sesion: null, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 }; window.__pruebasSinIntegridad = true; }, BASE());
  await p.goto(PAGINA);
  await p.waitForSelector(".gate-tarjeta", { timeout: 8000 });
  await p.waitForTimeout(800);
  eq("en otra dirección que no es la del sitio, ni se pide el script de Google (queda nuestro botón)",
     [pedidos.some(u => u.includes("accounts.google.com/gsi")), await p.$eval("#gisBoton", e => e.childElementCount)], [false, 0]);
  await p.close();
}
{
  const { p, errores } = await portada({ sinGoogle: true });
  await p.waitForTimeout(1200);
  eq("si Google no carga, queda nuestro botón, a la vista",
     [await p.$eval(".gate-tarjeta .btn-google", e => getComputedStyle(e).display !== "none"), await p.$eval("#gisBoton", e => e.childElementCount)], [true, 0]);
  await p.click(".gate-tarjeta .btn-google");
  await p.waitForFunction(() => window.__sb.logins.length > 0, null, { timeout: 5000 });
  eq("y entra por Supabase como antes", await p.evaluate(() => window.__sb.logins[0].provider), "google");
  eq("sin Google: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
