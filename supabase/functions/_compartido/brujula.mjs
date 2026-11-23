/* ======================================================================
   Brújula: leer Google Drive y las planillas con la cuenta de servicio
   ======================================================================
   Brújula son carpetas de Drive que se comparten, en modo lectura, con gente
   de las comunidades (docs/brujula/README.md). Esta función le da a la pantalla
   Administración › Brújula lo que Toldot no guarda: quién tiene acceso a qué
   (se LEE de Drive cada vez, porque las planillas y el Script de los lunes
   también lo cambian) y quién está cargado en las planillas.

   ETAPA 1: solo LEE. No comparte, no quita y no escribe en ninguna planilla
   (los alcances que pide son de solo lectura). Lo que escribe viene después.

   Dos pedidos, los dos solo para un admin:
     { accion: "comprobar", link }  ¿ese link es de una carpeta que Toldot puede gestionar?
     { accion: "leer" }             las carpetas del catálogo con quién tiene cada una, y las planillas

   Quién puede: no lo decide esta función: le pregunta a la base con la sesión de
   quien llama (puede_gestionar_brujula(): admin fijo o de rol). Una sesión falsa
   o de alguien que no es admin la rechaza la base, no este código, y antes de
   hablar con Google. Las carpetas que se leen salen del catálogo (con la sesión
   de quien llama), nunca de lo que mande el navegador: la cuenta de servicio no
   se puede usar para mirar cualquier cosa de Drive.

   Es JavaScript sin nada de Node ni de Deno (como google.mjs): se prueba con un
   Google y una base de mentira en supabase/functions/_pruebas/brujula.mjs.
   ====================================================================== */
import { encabezados } from "./web.mjs";
import { leerCuenta, permisoDeGoogle } from "./google.mjs";

// Solo leer. La etapa 2 suma lo de escribir cuando haga falta, y no antes.
export const ALCANCE_LECTURA = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly";
const DRIVE = "https://www.googleapis.com/drive/v3/files/";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets/";
const CARPETA = "application/vnd.google-apps.folder";
const ATAJO = "application/vnd.google-apps.shortcut";
const ID = /^[A-Za-z0-9_-]{10,100}$/;
// Lo máximo que se lee: un catálogo razonable y planillas de miles de filas, no el mundo.
const MAX_CARPETAS = 40, MAX_PLANILLAS = 6, MAX_PAGINAS = 50, MAX_FILAS = 5000;

/* ---------- El link ---------- */
// De un link de Drive saca el ID: /drive/folders/ID, /drive/u/0/folders/ID,
// /file/d/ID/view, /document/d/ID/edit, open?id=ID. Cualquier otra cosa (otro sitio,
// un texto que no es un link) es null. No decide si es una carpeta: eso lo dice Drive.
export function idDeLink(texto){
  const t = String(texto ?? "").trim();
  if(!t || t.length > 2048) return null;
  let u;
  try{ u = new URL(t); }catch(e){ return null; }
  if(u.protocol !== "https:" || !/^(drive|docs)\.google\.com$/.test(u.hostname)) return null;
  const m = /\/folders\/([A-Za-z0-9_-]+)/.exec(u.pathname) || /\/d\/([A-Za-z0-9_-]+)/.exec(u.pathname);
  const id = m ? m[1] : (u.searchParams.get("id") || "");
  return ID.test(id) ? id : null;
}

/* ---------- Hablar con Google ---------- */
async function google(traer, token, url){
  const r = await traer(url, { headers: { Authorization: `Bearer ${token}` } });
  const cuerpo = await r.json().catch(() => ({}));
  return { estado: r.status, cuerpo };
}
const CAMPOS_DE_UNA_CARPETA = "id,name,mimeType,trashed,driveId,capabilities(canShare),shortcutDetails(targetId,targetMimeType)";
const datosDe = (traer, token, id) =>
  google(traer, token, `${DRIVE}${encodeURIComponent(id)}?${new URLSearchParams({ supportsAllDrives: "true", fields: CAMPOS_DE_UNA_CARPETA })}`);
const noSeVe = r => r.estado === 404 || r.estado === 403;

/* ---------- ¿Es una carpeta que Toldot puede gestionar? ---------- */
// Contesta { caso }, con caso:
//   ok                 una carpeta de «Mi unidad» que Toldot puede compartir (+ id, nombre)
//   sinpermiso         Drive dice que no existe o Toldot no la ve / no la puede compartir
//   atajo              es un acceso directo a una carpeta que sí se puede (+ destino: { id, nombre })
//   nocarpeta          es otra cosa (un documento, una hoja…)
//   unidad-compartida  vive en una unidad compartida (otro modelo de permisos: todavía no)
//   papelera           está en la papelera
//   link               no es un link de Drive
//   google             Google contestó otra cosa (la función contesta 502)
function deUnaCarpeta(d){
  if(d.trashed) return { caso: "papelera" };
  if(d.mimeType !== CARPETA) return { caso: "nocarpeta" };
  if(d.driveId) return { caso: "unidad-compartida" };
  if(!(d.capabilities && d.capabilities.canShare === true)) return { caso: "sinpermiso" };
  return { caso: "ok", id: String(d.id), nombre: String(d.name ?? "").slice(0, 300) };
}
export async function comprobarLink(traer, token, link){
  const id = idDeLink(link);
  if(!id) return { caso: "link" };
  const uno = await datosDe(traer, token, id);
  if(noSeVe(uno)) return { caso: "sinpermiso" };
  if(uno.estado !== 200) return { caso: "google" };
  const d = uno.cuerpo;
  if(d.mimeType !== ATAJO || d.trashed) return deUnaCarpeta(d);
  // Un acceso directo (la entrada de Brújula está hecha de accesos directos): se mira adónde apunta.
  const a = d.shortcutDetails || {};
  if(a.targetMimeType !== CARPETA || !ID.test(a.targetId || "")) return { caso: "nocarpeta" };
  const dos = await datosDe(traer, token, a.targetId);
  if(noSeVe(dos)) return { caso: "sinpermiso" };
  if(dos.estado !== 200) return { caso: "google" };
  const real = deUnaCarpeta(dos.cuerpo);
  return real.caso === "ok" ? { caso: "atajo", destino: { id: real.id, nombre: real.nombre } } : real;
}

/* ---------- Leer quién tiene cada carpeta ---------- */
// Los permisos de una carpeta, de a 100 (Drive no da más por página: el Script de
// los lunes se quedaba con la primera). Cuenta de a un usuario; los grupos y los
// «cualquiera con el link» no son personas y no se cuentan.
async function permisosDe(traer, token, id){
  const permisos = [];
  let pagina = "";
  for(let i = 0; i < MAX_PAGINAS; i++){
    const q = new URLSearchParams({ pageSize: "100", supportsAllDrives: "true", fields: "nextPageToken,permissions(id,type,role,emailAddress,displayName)" });
    if(pagina) q.set("pageToken", pagina);
    const r = await google(traer, token, `${DRIVE}${encodeURIComponent(id)}/permissions?${q}`);
    if(noSeVe(r)) return { error: "sinpermiso" };
    if(r.estado !== 200) return { error: "google" };
    for(const p of r.cuerpo.permissions || []) permisos.push(p);
    pagina = r.cuerpo.nextPageToken || "";
    if(!pagina) return { permisos };
  }
  return { error: "demasiado" };
}

/* ---------- Leer las planillas ---------- */
// Quita lo invisible que se cuela al copiar de WhatsApp (el espacio de ancho cero, la marca de
// derecha a izquierda…) y los espacios de las puntas.
const limpio = (v, max = 200) => String(v ?? "").replace(/[​-‏⁠﻿]/g, "").trim().slice(0, max);
// Las filas de una planilla «Users»: nombre, correo, comunidad, idioma, «Enviado» y, si el Script falló, el error.
// Sin nombre de pestaña: es la primera, se llame como se llame.
async function filasDe(traer, token, id){
  const r = await google(traer, token, `${SHEETS}${encodeURIComponent(id)}/values/${encodeURIComponent(`A2:H${MAX_FILAS}`)}?majorDimension=ROWS`);
  if(noSeVe(r)) return { error: "sinpermiso" };
  if(r.estado !== 200) return { error: "google" };
  const filas = [];
  (r.cuerpo.values || []).forEach((f, i) => {
    const correo = limpio(f[1]).toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;
    filas.push({ fila: i + 2, nombre: limpio(f[0]), correo, comunidad: limpio(f[2]), idioma: limpio(f[3], 30),
      enviado: limpio(f[4], 30).toLowerCase() === "enviado", error: limpio(f[5], 300) });
  });
  return { filas };
}

/* ---------- Juntar todo ---------- */
const COMO_LECTOR = new Set(["reader", "commenter"]);
export function combinar(carpetas, permisosPorCarpeta, filasPorPlanilla){
  const mapa = new Map();
  const de = correo => {
    let p = mapa.get(correo);
    if(!p) mapa.set(correo, p = { correo, nombre: "", idioma: "", comunidad: "", carpetas: {}, editor: false, planillas: [], pendiente: false, error: "" });
    return p;
  };
  for(const c of carpetas){
    for(const p of (permisosPorCarpeta[c.id] || [])){
      if(p.type !== "user" || !p.emailAddress) continue;
      const persona = de(String(p.emailAddress).toLowerCase());
      persona.carpetas[c.id] = p.role;
      if(!COMO_LECTOR.has(p.role)) persona.editor = true;
      if(!persona.nombre && p.displayName) persona.nombre = limpio(p.displayName);
    }
  }
  for(const [planilla, filas] of Object.entries(filasPorPlanilla)){
    for(const f of filas){
      const persona = de(f.correo);
      // Si está más de una vez, vale lo último que se escribió.
      if(f.nombre) persona.nombre = f.nombre;
      if(f.idioma) persona.idioma = f.idioma;
      if(f.comunidad) persona.comunidad = f.comunidad;
      persona.planillas.push({ planilla, fila: f.fila, enviado: f.enviado });
      if(!f.enviado){ persona.pendiente = true; if(f.error) persona.error = f.error; }
    }
  }
  return [...mapa.values()].sort((a, b) => (a.nombre || a.correo).localeCompare(b.nombre || b.correo, "es"));
}

// Lo que la pantalla muestra: el catálogo con su estado y cuántas personas tiene cada carpeta, las planillas con
// sus pendientes, y la lista de personas. `carpetas` y `planillas` salen de la base (con la sesión del admin).
export async function leerTodo(traer, token, { carpetas, planillas }, ahora = Date.now()){
  const cs = carpetas.slice(0, MAX_CARPETAS), ps = planillas.slice(0, MAX_PLANILLAS);
  const [deCarpetas, dePlanillas] = await Promise.all([
    Promise.all(cs.map(c => permisosDe(traer, token, c.id))),
    Promise.all(ps.map(p => filasDe(traer, token, p.id))),
  ]);
  const permisos = {}, filas = {};
  cs.forEach((c, i) => { if(deCarpetas[i].permisos) permisos[c.id] = deCarpetas[i].permisos; });
  ps.forEach((p, i) => { if(dePlanillas[i].filas) filas[p.id] = dePlanillas[i].filas; });
  const personas = combinar(cs, permisos, filas);
  return {
    leido: new Date(ahora).toISOString(),
    carpetas: cs.map((c, i) => ({
      id: c.id, nombre: c.nombre, orden: c.orden, activa: c.activa, planillas: c.planillas || [],
      estado: deCarpetas[i].error || "ok",
      personas: (permisos[c.id] || []).filter(p => p.type === "user" && p.emailAddress).length,
    })),
    planillas: ps.map((p, i) => ({
      id: p.id, nombre: p.nombre, orden: p.orden,
      estado: dePlanillas[i].error || "ok",
      filas: (filas[p.id] || []).length,
      pendientes: (filas[p.id] || []).filter(f => !f.enviado).length,
    })),
    personas,
  };
}

/* ======================================================================
   La función `brujula` de Supabase
   ====================================================================== */
export async function atender(req, { env, fetch: traer = fetch, ahora = Date.now } = {}){
  const h = encabezados(req.headers.get("origin"));
  const responder = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: h });
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if(req.method !== "POST") return responder({ error: "metodo" }, 405);

  const autorizacion = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if(!/^Bearer \S+$/.test(autorizacion) || !apikey) return responder({ error: "sin-sesion" }, 401);

  const url = env("SUPABASE_URL");
  const cuentaTexto = env("GOOGLE_CUENTA_BRUJULA");
  if(!url || !cuentaTexto) return responder({ error: "sin-configurar" }, 503);

  let pedido;
  try{ pedido = await req.json(); }catch(e){ return responder({ error: "pedido" }, 400); }
  if(!pedido || (pedido.accion !== "comprobar" && pedido.accion !== "leer")) return responder({ error: "pedido" }, 400);

  // ¿Es admin? Con SU sesión: la base decide, y antes de hablar con Google.
  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  try{
    const r = await traer(`${url}/rest/v1/rpc/puede_gestionar_brujula`, { method: "POST", headers: conSesion, body: "{}" });
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    if(!(r.ok && (await r.json()) === true)) return responder({ error: "no-admin" }, 403);
  }catch(e){ return responder({ error: "base" }, 502); }

  let token;
  try{ token = await permisoDeGoogle(leerCuenta(cuentaTexto), { fetch: traer, ahora: ahora(), alcance: ALCANCE_LECTURA }); }
  catch(e){ console.error(e.message); return responder({ error: "google-permiso" }, 502); }

  try{
    if(pedido.accion === "comprobar"){
      const r = await comprobarLink(traer, token, pedido.link);
      return r.caso === "google" ? responder({ error: "google" }, 502) : responder(r);
    }
    // leer: el catálogo sale de la base, con la sesión del admin.
    const pedir = async tabla => {
      const r = await traer(`${url}/rest/v1/${tabla}`, { headers: conSesion });
      if(!r.ok) throw new Error(`base ${r.status}`);
      return r.json();
    };
    let carpetas, planillas;
    try{
      [carpetas, planillas] = await Promise.all([
        pedir("brujula_carpetas?select=id,nombre,orden,activa,planillas&order=orden.asc,nombre.asc&limit=100"),
        pedir("brujula_planillas?select=id,nombre,orden&order=orden.asc,nombre.asc&limit=20"),
      ]);
    }catch(e){ return responder({ error: "base" }, 502); }
    return responder(await leerTodo(traer, token, { carpetas, planillas }, ahora()));
  }catch(e){ console.error(e.message); return responder({ error: "google" }, 502); }
}
