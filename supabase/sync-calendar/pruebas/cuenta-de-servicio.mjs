/* ======================================================================
   La cuenta de servicio (docs/AUDITORIA.md, U5): la firma que se le manda
   a Google, la función `calendario` de Supabase que usa la app, y el
   trabajo nocturno leyendo con ella en vez de con la clave de API.
   Todo contra un Google y un Supabase de mentira, con una llave RSA
   armada en el momento.
   ====================================================================== */
import { generateKeyPairSync, createVerify } from "node:crypto";
import { leerCuenta, permisoDeGoogle, olvidarPermisos, urlDelPedido, atender, ALCANCE } from "../../functions/_compartido/google.mjs";

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" });
const CUENTA_JSON = JSON.stringify({ type: "service_account", client_email: "registro@proyecto.iam.gserviceaccount.com",
  private_key: PEM, token_uri: "https://oauth2.googleapis.com/token" }, null, 2);
const de64 = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/* ---------- La llave ---------- */
eq("la llave: lee correo y llave del JSON de Google", (({ correo, tokenUri }) => [correo, tokenUri])(leerCuenta(CUENTA_JSON)),
   ["registro@proyecto.iam.gserviceaccount.com", "https://oauth2.googleapis.com/token"]);
const error = fn => { try{ fn(); return null; }catch(e){ return e.message; } };
eq("la llave: si se pegó otra cosa, lo dice con palabras",
   [/no es un JSON/.test(error(() => leerCuenta("AIzaSy-una-clave"))), /client_email y private_key/.test(error(() => leerCuenta('{"installed":{}}')))], [true, true]);

/* ---------- El permiso de Google ---------- */
function googleDeMentira(reg, { niega } = {}){
  return async (url, op = {}) => {
    const u = String(url);
    reg.push({ url: u, auth: op.headers && op.headers.Authorization || null });
    if(u === "https://oauth2.googleapis.com/token"){
      if(niega) return new Response(JSON.stringify({ error: "invalid_grant", error_description: "registro@proyecto…" }), { status: 400 });
      const assertion = new URLSearchParams(op.body).get("assertion");
      const [enc, datos, firma] = assertion.split(".");
      const v = createVerify("RSA-SHA256"); v.update(`${enc}.${datos}`);
      reg.firmaValida = v.verify(publicKey, de64(firma));
      reg.encabezado = JSON.parse(de64(enc)); reg.datos = JSON.parse(de64(datos));
      reg.tokens = (reg.tokens || 0) + 1;
      return new Response(JSON.stringify({ access_token: "permiso-" + reg.tokens, expires_in: 3600 }));
    }
    if(u.startsWith("https://www.googleapis.com/calendar/v3/")){
      if(op.headers?.Authorization !== "Bearer permiso-" + reg.tokens) return new Response(JSON.stringify({ error: { message: "sin permiso" } }), { status: 401 });
      if(u.includes("syncToken=viejo")) return new Response(JSON.stringify({ error: { message: "gone" } }), { status: 410 });
      return new Response(JSON.stringify({ items: [{ id: "ev1", summary: "Visita" }], nextSyncToken: "tok-2", timeZone: "America/Argentina/Buenos_Aires" }));
    }
    throw new Error("pedido inesperado: " + u);
  };
}
{
  olvidarPermisos();
  const reg = [];
  const cuenta = leerCuenta(CUENTA_JSON);
  const t0 = Date.parse("2026-10-06T12:00:00Z");
  const p1 = await permisoDeGoogle(cuenta, { fetch: googleDeMentira(reg), ahora: t0 });
  eq("permiso: la firma la verifica la llave pública (RS256 de verdad)", [reg.firmaValida, reg.encabezado], [true, { alg: "RS256", typ: "JWT" }]);
  eq("permiso: pide solo leer calendarios, a nombre de la cuenta, por una hora",
     [reg.datos.scope, reg.datos.iss, reg.datos.aud, reg.datos.exp - reg.datos.iat], [ALCANCE, "registro@proyecto.iam.gserviceaccount.com", "https://oauth2.googleapis.com/token", 3600]);
  eq("permiso: el alcance es de solo lectura", ALCANCE, "https://www.googleapis.com/auth/calendar.readonly");
  const p2 = await permisoDeGoogle(cuenta, { fetch: googleDeMentira(reg), ahora: t0 + 30 * 60_000 });
  eq("permiso: dentro de la hora se reusa (un solo pedido a Google)", [p1, p2, reg.tokens], ["permiso-1", "permiso-1", 1]);
  const p3 = await permisoDeGoogle(cuenta, { fetch: googleDeMentira(reg), ahora: t0 + 59.5 * 60_000 });
  eq("permiso: faltando menos de un minuto, pide otro", [p3, reg.tokens], ["permiso-2", 2]);
  olvidarPermisos();
  let msg = null;
  try{ await permisoDeGoogle(cuenta, { fetch: googleDeMentira([], { niega: true }), ahora: t0 }); }catch(e){ msg = e.message; }
  eq("permiso: si Google lo niega, el error no repite lo que dijo Google (el registro es público)",
     [/400: invalid_grant/.test(msg), /registro@/.test(msg)], [true, false]);
}

/* ---------- Qué se le puede pedir ---------- */
const CAL = "cal@group.calendar.google.com";
const BASEC = "https://www.googleapis.com/calendar/v3/calendars/cal%40group.calendar.google.com";
eq("pedido: cambios con syncToken", urlDelPedido(CAL, { accion: "cambios", syncToken: "abc" }), `${BASEC}/events?maxResults=250&showDeleted=true&syncToken=abc`);
eq("pedido: completo desde una fecha, con página", urlDelPedido(CAL, { accion: "cambios", timeMin: "2024-01-01T00:00:00Z", pageToken: "p2" }),
   `${BASEC}/events?maxResults=250&showDeleted=true&timeMin=2024-01-01T00%3A00%3A00Z&pageToken=p2`);
eq("pedido: un evento suelto (también una instancia de una serie)", urlDelPedido(CAL, { accion: "evento", id: "abc_20261006T120000Z" }), `${BASEC}/events/abc_20261006T120000Z`);
eq("pedido: nada fuera de eso (otra acción, un id con barras, un timeMin con otra forma, parámetros de más)",
   [urlDelPedido(CAL, { accion: "acl" }), urlDelPedido(CAL, { accion: "evento", id: "../acl" }), urlDelPedido(CAL, { accion: "evento" }),
    urlDelPedido(CAL, { accion: "cambios", timeMin: "2024-01-01&q=x" }), urlDelPedido(CAL, { accion: "cambios", q: "secreto", calendarId: "otro" })],
   [null, null, null, `${BASEC}/events?maxResults=250&showDeleted=true`, `${BASEC}/events?maxResults=250&showDeleted=true`]);

/* ---------- La función de Supabase ---------- */
const URL_SB = "https://proyecto.supabase.co";
function entorno(cambios = {}){
  const e = { SUPABASE_URL: URL_SB, GOOGLE_CUENTA_DE_SERVICIO: CUENTA_JSON, CALENDAR_ID: CAL, ...cambios };
  return k => e[k];
}
function mundo({ aprobado = true, sesionVencida = false, calendarIdConfig = null } = {}){
  const reg = [];
  const google = googleDeMentira(reg);
  const traer = async (url, op = {}) => {
    const u = String(url);
    if(u.startsWith(URL_SB)){
      reg.push({ url: u, auth: op.headers?.Authorization, apikey: op.headers?.apikey });
      if(sesionVencida) return new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 });
      if(u.endsWith("/rest/v1/rpc/esta_aprobado")) return new Response(JSON.stringify(aprobado));
      if(u.includes("/rest/v1/app_config")) return new Response(JSON.stringify(calendarIdConfig ? [{ value: { calendarId: calendarIdConfig } }] : [{ value: {} }]));
    }
    return google(url, op);
  };
  return { reg, traer };
}
const pedir = (cuerpo, { origen = "https://team-latam.github.io", auth = "Bearer sesion-de-ana", apikey = "sb_publishable_x", metodo = "POST" } = {}) =>
  new Request(`${URL_SB}/functions/v1/calendario`, { method: metodo,
    headers: { ...(origen ? { origin: origen } : {}), ...(auth ? { authorization: auth } : {}), ...(apikey ? { apikey } : {}), "content-type": "application/json" },
    body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
const leer = async r => [r.status, await r.json()];

{
  olvidarPermisos();
  const m = mundo();
  const r = await atender(pedir(null, { metodo: "OPTIONS" }), { env: entorno(), fetch: m.traer });
  eq("función: el navegador pregunta antes (CORS) y la app tiene permiso",
     [r.status, r.headers.get("access-control-allow-origin"), /authorization/.test(r.headers.get("access-control-allow-headers"))], [204, "https://team-latam.github.io", true]);
  const otro = await atender(pedir(null, { metodo: "OPTIONS", origen: "https://otro.github.io" }), { env: entorno(), fetch: m.traer });
  eq("función: otra página no (ni otra de github.io)", otro.headers.get("access-control-allow-origin"), null);
}
{
  const m = mundo();
  eq("función: sin sesión, nada (y no le pregunta nada a Google)", [await leer(await atender(pedir({ accion: "cambios" }, { auth: null }), { env: entorno(), fetch: m.traer })), m.reg.length], [[401, { error: "sin-sesion" }], 0]);
}
{
  const m = mundo({ sesionVencida: true });
  eq("función: una sesión que la base no acepta, tampoco", (await leer(await atender(pedir({ accion: "cambios" }), { env: entorno(), fetch: m.traer })))[0], 401);
}
{
  const m = mundo({ aprobado: false });
  const r = await leer(await atender(pedir({ accion: "cambios" }), { env: entorno(), fetch: m.traer }));
  eq("función: con sesión pero sin aprobar, no (lo decide la base con SU sesión)",
     [r, m.reg.filter(x => x.url.includes("googleapis")).length, m.reg[0].auth, m.reg[0].apikey], [[403, { error: "no-aprobado" }], 0, "Bearer sesion-de-ana", "sb_publishable_x"]);
}
{
  const m = mundo();
  eq("función: si todavía no se cargó la llave, lo dice (y la app sigue con la clave de API)",
     await leer(await atender(pedir({ accion: "cambios" }), { env: entorno({ GOOGLE_CUENTA_DE_SERVICIO: undefined }), fetch: m.traer })), [503, { error: "sin-configurar" }]);
}
{
  olvidarPermisos();
  const m = mundo();
  const [estado, cuerpo] = await leer(await atender(pedir({ accion: "cambios", syncToken: "tok-1" }), { env: entorno(), fetch: m.traer }));
  const aGoogle = m.reg.filter(x => x.url.includes("googleapis.com/calendar"));
  eq("función: aprobada, trae la página de Google tal cual", [estado, cuerpo.estado, cuerpo.cuerpo.nextSyncToken, cuerpo.cuerpo.items.length], [200, 200, "tok-2", 1]);
  eq("función: a Google le pide con la cuenta, sin clave de API", [aGoogle.length, aGoogle[0].auth, /key=/.test(aGoogle[0].url), /syncToken=tok-1/.test(aGoogle[0].url)], [1, "Bearer permiso-1", false, true]);
  eq("función: el permiso de Google nunca vuelve a la app", JSON.stringify(cuerpo).includes("permiso-"), false);
  const [, viejo] = await leer(await atender(pedir({ accion: "cambios", syncToken: "viejo" }), { env: entorno(), fetch: m.traer }));
  eq("función: el 410 (token vencido) llega como 410, para releer todo como siempre", viejo.estado, 410);
  eq("función: un pedido que no es de los dos permitidos, no", await leer(await atender(pedir({ accion: "acl" }), { env: entorno(), fetch: m.traer })), [400, { error: "pedido" }]);
}
{
  olvidarPermisos();
  const m = mundo({ calendarIdConfig: "otro@group.calendar.google.com" });
  await atender(pedir({ accion: "evento", id: "ev1" }), { env: entorno(), fetch: m.traer });
  eq("función: si un admin eligió otro calendario en Configuración, ese manda",
     m.reg.filter(x => x.url.includes("googleapis.com/calendar")).map(x => x.url), ["https://www.googleapis.com/calendar/v3/calendars/otro%40group.calendar.google.com/events/ev1"]);
}

/* ---------- El trabajo nocturno con la cuenta ---------- */
{
  olvidarPermisos();
  process.env.SUPABASE_URL = "https://falso.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
  process.env.CALENDAR_ID = CAL;
  process.env.CALENDAR_API_KEY = "clave-de-mentira";
  process.env.GOOGLE_CUENTA_DE_SERVICIO = CUENTA_JSON;
  const reg = [];
  const google = googleDeMentira(reg);
  const config = { calendarSync: { syncToken: "tok-1" }, preferences: {} };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    if(u.includes("googleapis.com")){
      if(u.includes("/events?")) return new Response(JSON.stringify({ items: [], nextSyncToken: "tok-2" }), { status: op.headers?.Authorization === "Bearer permiso-" + reg.tokens ? 200 : 401 });
      return google(url, op);
    }
    if(u.includes("/rest/v1/app_config")){
      if(op.method === "POST"){ const c = JSON.parse(op.body); config[c.key] = c.value; return new Response(""); }
      const clave = decodeURIComponent((u.match(/key=eq\.([^&]+)/) || [])[1] || "");
      return new Response(JSON.stringify(config[clave] === undefined ? [] : [{ value: config[clave] }]));
    }
    throw new Error("pedido inesperado: " + u);
  };
  reg.length = 0;
  const pedidos = [];
  const f = globalThis.fetch;
  globalThis.fetch = (url, op) => { pedidos.push({ url: String(url), auth: op?.headers?.Authorization }); return f(url, op); };
  const { main } = await import("../sincronizar.mjs");
  const log = console.log; console.log = () => {};
  try{ await main(); } finally { console.log = log; }
  const aCal = pedidos.filter(p => p.url.includes("googleapis.com/calendar"));
  eq("nocturno: con la cuenta cargada, lee con ella y sin la clave de API",
     [aCal.length, aCal[0] && aCal[0].auth, aCal.some(p => /key=/.test(p.url)), config.calendarSync.syncToken], [1, "Bearer permiso-1", false, "tok-2"]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
