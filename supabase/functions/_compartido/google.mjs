/* ======================================================================
   Leer el Google Calendar del equipo con la cuenta de servicio
   ======================================================================
   Hasta el 6/10/2026 el calendario LatAm estaba «Compartido de forma
   pública – Ver los detalles de todos los eventos», y la app y el trabajo
   nocturno lo leían con una clave de API, sin cuenta. Eso dejaba los
   eventos desde 2019 (títulos con nombres, lugares, viajes) a la vista de
   cualquiera que tuviera el id, que está en la página
   (docs/AUDITORIA.md, U5).

   Ahora lo lee una CUENTA DE SERVICIO: una cuenta de Google que es de la
   app y no de una persona, con el calendario compartido a su correo, solo
   para ver. Su llave (un JSON) vive en dos secretos —el de GitHub y el de
   la función de Supabase— y nunca llega al navegador.

   Este archivo lo usan los dos: la función `calendario` de Supabase (que
   es la que consulta la app) y supabase/sync-calendar/sincronizar.mjs (el
   trabajo de la madrugada). Por eso es JavaScript sin nada de Node ni de
   Deno: `fetch`, `crypto.subtle`, `Request` y `Response` existen en los dos.
   ====================================================================== */

export const ALCANCE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3/calendars/";

/* ---------- La llave ---------- */
// El JSON que baja Google Cloud al crear la llave. Solo hacen falta dos
// campos; si falta alguno el error lo dice con palabras, porque lo más
// probable es que se haya pegado otra cosa en el secreto.
export function leerCuenta(texto){
  let c;
  try{ c = typeof texto === "string" ? JSON.parse(texto) : texto; }
  catch(e){ throw new Error("La llave de la cuenta de servicio no es un JSON válido (¿se pegó entero el archivo?)."); }
  if(!c || typeof c.client_email !== "string" || typeof c.private_key !== "string" || !/BEGIN PRIVATE KEY/.test(c.private_key))
    throw new Error("La llave de la cuenta de servicio no tiene client_email y private_key (¿es el JSON de la cuenta de servicio?).");
  return { correo: c.client_email, llave: c.private_key, tokenUri: c.token_uri || "https://oauth2.googleapis.com/token" };
}

const base64url = bytes => {
  let s = "";
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for(let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const texto64 = s => base64url(new TextEncoder().encode(s));

async function firmar(pem, datos){
  const cuerpo = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cuerpo), c => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", llave, new TextEncoder().encode(datos)));
}

/* ---------- El permiso de un rato ---------- */
// Con la llave se firma un pedido y Google devuelve un permiso que dura
// una hora. Se guarda hasta un minuto antes de que venza: la función de
// Supabase atiende muchos pedidos seguidos con el mismo.
const guardados = new Map();
export async function permisoDeGoogle(cuenta, { fetch: traer = fetch, ahora = Date.now() } = {}){
  const g = guardados.get(cuenta.correo);
  if(g && g.vence - 60_000 > ahora) return g.token;
  const iat = Math.floor(ahora / 1000);
  const encabezado = texto64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const datos = texto64(JSON.stringify({ iss: cuenta.correo, scope: ALCANCE, aud: cuenta.tokenUri, iat, exp: iat + 3600 }));
  const firmado = `${encabezado}.${datos}`;
  const assertion = `${firmado}.${await firmar(cuenta.llave, firmado)}`;
  const res = await traer(cuenta.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const cuerpo = await res.json().catch(() => ({}));
  // Sin el detalle de Google: puede repetir el correo de la cuenta, y el
  // registro del trabajo nocturno es público.
  if(!res.ok || !cuerpo.access_token) throw new Error(`Google no dio permiso a la cuenta de servicio (${res.status}${cuerpo.error ? ": " + cuerpo.error : ""}).`);
  guardados.set(cuenta.correo, { token: cuerpo.access_token, vence: ahora + (Number(cuerpo.expires_in) || 3600) * 1000 });
  return cuerpo.access_token;
}
export const olvidarPermisos = () => guardados.clear();

/* ---------- Qué se le puede pedir ---------- */
// Lo mismo que pedían la app (fetchCalendarChanges, fetchCalendarEvent) y
// el trabajo nocturno (traerCambios), y nada más: una página de cambios
// o un evento suelto, siempre del calendario del equipo.
const ID_DE_EVENTO = /^[A-Za-z0-9_@.\-]{1,1024}$/;
export function urlDelPedido(calendarId, pedido){
  const cal = API + encodeURIComponent(calendarId);
  if(pedido && pedido.accion === "evento"){
    if(typeof pedido.id !== "string" || !ID_DE_EVENTO.test(pedido.id)) return null;
    return `${cal}/events/${encodeURIComponent(pedido.id)}`;
  }
  if(pedido && pedido.accion === "cambios"){
    const p = new URLSearchParams({ maxResults: "250", showDeleted: "true" });
    const texto = v => typeof v === "string" && v.length > 0 && v.length <= 4096;
    if(texto(pedido.syncToken)) p.set("syncToken", pedido.syncToken);
    else if(typeof pedido.timeMin === "string" && /^\d{4}-\d{2}-\d{2}T00:00:00Z$/.test(pedido.timeMin)) p.set("timeMin", pedido.timeMin);
    if(texto(pedido.pageToken)) p.set("pageToken", pedido.pageToken);
    return `${cal}/events?${p}`;
  }
  return null;
}

/* ======================================================================
   La función `calendario` de Supabase
   ======================================================================
   La app le manda { accion: "cambios", syncToken?, pageToken?, timeMin? }
   o { accion: "evento", id }, con la sesión de la persona. Contesta
   { estado, cuerpo }: el estado y el cuerpo TAL CUAL los devolvió Google,
   para que la app siga tratando el 410 (token vencido) como siempre.

   Quién puede: solo un integrante aprobado. No lo decide esta función: le
   pregunta a la base con la sesión de quien llama (esta_aprobado(), la
   misma regla que protege cada tabla). Una sesión falsa o vencida la
   rechaza la base, no este código.
   ====================================================================== */
const ORIGENES = [/^https:\/\/team-latam\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
function encabezados(origen){
  const h = { "Content-Type": "application/json", "Vary": "Origin" };
  if(origen && ORIGENES.some(r => r.test(origen))){
    h["Access-Control-Allow-Origin"] = origen;
    h["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Max-Age"] = "3600";
  }
  return h;
}

export async function atender(req, { env, fetch: traer = fetch, ahora = Date.now } = {}){
  const h = encabezados(req.headers.get("origin"));
  const responder = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: h });
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if(req.method !== "POST") return responder({ error: "metodo" }, 405);

  const autorizacion = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if(!/^Bearer \S+$/.test(autorizacion) || !apikey) return responder({ error: "sin-sesion" }, 401);

  const url = env("SUPABASE_URL");
  const cuentaTexto = env("GOOGLE_CUENTA_DE_SERVICIO");
  if(!url || !cuentaTexto) return responder({ error: "sin-configurar" }, 503);

  let pedido;
  try{ pedido = await req.json(); }catch(e){ return responder({ error: "pedido" }, 400); }

  // ¿Es un integrante aprobado? Con SU sesión: la base decide.
  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  let aprobado;
  try{
    const r = await traer(`${url}/rest/v1/rpc/esta_aprobado`, { method: "POST", headers: conSesion, body: "{}" });
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    aprobado = r.ok && (await r.json()) === true;
  }catch(e){ return responder({ error: "base" }, 502); }
  if(!aprobado) return responder({ error: "no-aprobado" }, 403);

  // El calendario: el que eligió un admin en Configuración, o el de
  // siempre (el mismo orden que applyCalendarIdConfig en la app).
  let calendarId = env("CALENDAR_ID") || "";
  try{
    const r = await traer(`${url}/rest/v1/app_config?select=value&key=eq.preferences`, { headers: conSesion });
    const filas = r.ok ? await r.json() : [];
    const elegido = filas && filas[0] && filas[0].value && filas[0].value.calendarId;
    if(typeof elegido === "string" && elegido) calendarId = elegido;
  }catch(e){ /* sigue con el de siempre */ }
  if(!calendarId) return responder({ error: "sin-configurar" }, 503);

  const destino = urlDelPedido(calendarId, pedido);
  if(!destino) return responder({ error: "pedido" }, 400);

  let token;
  try{ token = await permisoDeGoogle(leerCuenta(cuentaTexto), { fetch: traer, ahora: ahora() }); }
  catch(e){ console.error(e.message); return responder({ error: "google-permiso" }, 502); }
  try{
    const r = await traer(destino, { headers: { Authorization: `Bearer ${token}` } });
    const cuerpo = await r.json().catch(() => ({}));
    return responder({ estado: r.status, cuerpo });
  }catch(e){ return responder({ error: "google" }, 502); }
}
