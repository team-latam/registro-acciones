/* ======================================================================
   Brújula: leer Google Drive y las planillas con la cuenta de servicio
   ======================================================================
   Brújula son carpetas de Drive que se comparten, en modo lectura, con gente
   de las comunidades (docs/brujula/README.md). Esta función le da a la pantalla
   Administración › Brújula lo que Toldot no guarda: quién tiene acceso a qué
   (se LEE de Drive cada vez, porque las planillas y el Script de los lunes
   también lo cambian) y quién está cargado en las planillas.

   Pedidos, todos solo para un admin:
     { accion: "comprobar", link }           ¿ese link es de una carpeta que Toldot puede gestionar?
     { accion: "comprobar-planilla", link }  ¿ese link es de una planilla que Toldot puede leer y escribir?
     { accion: "leer" }                      las carpetas del catálogo con quién tiene cada una, y las planillas
     { accion: "dar", persona, carpetas, … } da acceso de lectura, manda el mail de bienvenida y anota en la planilla
     { accion: "quitar", correo, … }         le saca el acceso a una persona de algunas carpetas y lo anota
     { accion: "sacar-todos", carpeta, … }   le saca el acceso a todos los lectores de una carpeta
   «Leer» y «comprobar» piden a Google un permiso de SOLO LECTURA; lo demás, el de escribir.

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
import { correoBrujula } from "./correos.mjs";
import { DESDE, RESPONDER_A } from "./avisos.mjs";

// Leer (mirar y comprobar) usa un permiso de solo lectura. Compartir, quitar y escribir en las planillas piden otro, y solo
// cuando alguien lo pide.
export const ALCANCE_LECTURA = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly";
export const ALCANCE_ESCRITURA = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets";
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
const CAMPOS_DE_UNA_CARPETA = "id,name,mimeType,trashed,driveId,capabilities(canShare,canEdit),shortcutDetails(targetId,targetMimeType)";
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

// ¿Ese link es de una planilla de Google que Toldot puede leer y escribir? Mismos casos que las carpetas
// (ok, sinpermiso, nocarpeta → «noplanilla», link, papelera, google).
const PLANILLA = "application/vnd.google-apps.spreadsheet";
export async function comprobarPlanilla(traer, token, link){
  const id = idDeLink(link);
  if(!id) return { caso: "link" };
  const r = await datosDe(traer, token, id);
  if(noSeVe(r)) return { caso: "sinpermiso" };
  if(r.estado !== 200) return { caso: "google" };
  const d = r.cuerpo;
  if(d.trashed) return { caso: "papelera" };
  if(d.mimeType !== PLANILLA) return { caso: "noplanilla" };
  if(!(d.capabilities && d.capabilities.canEdit === true)) return { caso: "sinpermiso" };
  return { caso: "ok", id: String(d.id), nombre: String(d.name ?? "").slice(0, 300) };
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
export async function filasDe(traer, token, id){
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
    if(!p) mapa.set(correo, p = { correo, nombre: "", idioma: "", comunidad: "", carpetas: {}, permisos: {}, editor: false, planillas: [], pendiente: false, error: "" });
    return p;
  };
  for(const c of carpetas){
    for(const p of (permisosPorCarpeta[c.id] || [])){
      if(p.type !== "user" || !p.emailAddress) continue;
      const persona = de(String(p.emailAddress).toLowerCase());
      persona.carpetas[c.id] = p.role;
      persona.permisos[c.id] = String(p.id || "");
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

/* ---------- Escribir: dar y quitar acceso, y anotar en las planillas ---------- */
export const idiomaDe = v => {
  const t = String(v ?? "").toLowerCase();
  return /ingl|^en/.test(t) ? "en" : /port|^pt/.test(t) ? "pt" : /hebr|עבר|^he/.test(t) ? "he" : "es";
};
const NOMBRE_DEL_IDIOMA = { es: "Español", en: "Inglés", pt: "Portugués", he: "Hebreo" };
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERMISO_ID = /^[A-Za-z0-9_-]{1,200}$/;

async function escribir(traer, token, metodo, url, cuerpo){
  const r = await traer(url, { method: metodo, headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { estado: r.status, cuerpo: await r.json().catch(() => ({})) };
}
// Por qué no se pudo, en una palabra que la pantalla explica (nunca lo que dijo Google: puede traer correos).
function motivoDe(r){
  const m = String(r.cuerpo && r.cuerpo.error && r.cuerpo.error.message || "");
  if(r.estado === 404) return "carpeta";
  if(/inherit/i.test(m)) return "heredado";
  if(r.estado === 429 || /rate|quota/i.test(m)) return "limite";
  if(r.estado === 400) return "rechazado";
  if(r.estado === 403) return "permiso";
  return "google";
}
const fechaDe = ahora => new Date(ahora).toISOString().slice(0, 10);
const hoja = (id, rango) => `${SHEETS}${encodeURIComponent(id)}/values/${encodeURIComponent(rango)}`;

// Las dos columnas que Toldot suma al final de una planilla («Desde» y «Nota de Toldot»): se ponen los títulos si faltan.
async function titulosDeToldot(traer, token, id){
  const r = await google(traer, token, hoja(id, "G1:H1"));
  const v = (r.cuerpo.values || [[]])[0] || [];
  if(!v[0] || !v[1]) await escribir(traer, token, "PUT", `${hoja(id, "G1:H1")}?valueInputOption=RAW`, { values: [[v[0] || "Desde", v[1] || "Nota de Toldot"]] });
}
// RAW: lo que se escribe queda como texto (un «=algo» no se vuelve fórmula).
async function anotarEnPlanilla(traer, token, id, { fila, correo, nombre, comunidad, idioma, nota }){
  try{
    await titulosDeToldot(traer, token, id);
    if(Number.isInteger(fila) && fila >= 2 && fila <= MAX_FILAS + 1){
      // Una fila que ya estaba: se comprueba que siga siendo de esa persona antes de tocarla.
      const a = await google(traer, token, hoja(id, `A${fila}:H${fila}`));
      const f = (a.cuerpo.values || [[]])[0] || [];
      if(a.estado !== 200 || limpio(f[1]).toLowerCase() !== correo) return "fila-cambio";
      const r = await escribir(traer, token, "POST", `${SHEETS}${encodeURIComponent(id)}/values:batchUpdate`,
        { valueInputOption: "RAW", data: [{ range: `E${fila}:H${fila}`, values: [["Enviado", "", "Toldot", nota]] }] });
      return r.estado === 200 ? "actualizada" : "error";
    }
    const r = await escribir(traer, token, "POST", `${hoja(id, "A1")}:append?${new URLSearchParams({ valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" })}`,
      { values: [[nombre, correo, comunidad, idioma, "Enviado", "", "Toldot", nota]] });
    return r.estado === 200 ? "agregada" : "error";
  }catch(e){ return "error"; }
}
async function notaDeQuitado(traer, token, id, { fila, correo, nota }){
  try{
    if(!(Number.isInteger(fila) && fila >= 2 && fila <= MAX_FILAS + 1)) return "no";
    await titulosDeToldot(traer, token, id);
    const a = await google(traer, token, hoja(id, `A${fila}:H${fila}`));
    const f = (a.cuerpo.values || [[]])[0] || [];
    if(a.estado !== 200 || limpio(f[1]).toLowerCase() !== correo) return "fila-cambio";
    const r = await escribir(traer, token, "PUT", `${hoja(id, `H${fila}`)}?valueInputOption=RAW`, { values: [[nota]] });
    return r.estado === 200 ? "escrita" : "error";
  }catch(e){ return "error"; }
}

// Da acceso de lectura a unas carpetas del catálogo, sin el aviso de Drive; manda el mail de Toldot y anota en la planilla.
// De a una carpeta (Drive pide no escribir permisos en paralelo).
export async function darAcceso(traer, token, ctx, p, { env, ahora }){
  const correo = String(p.correo || "").trim().toLowerCase();
  if(!CORREO.test(correo) || correo.length > 200) return { error: "correo" };
  const ids = [...new Set((Array.isArray(p.carpetas) ? p.carpetas : []).map(String))];
  if(!ids.length || ids.length > MAX_CARPETAS || !ids.every(id => ctx.carpetas.some(c => c.id === id))) return { error: "carpetas" };
  const carpetas = [];
  for(const id of ids){
    const r = await escribir(traer, token, "POST", `${DRIVE}${encodeURIComponent(id)}/permissions?${new URLSearchParams({ supportsAllDrives: "true", sendNotificationEmail: "false", fields: "id,role" })}`,
      { type: "user", role: "reader", emailAddress: correo });
    carpetas.push(r.estado === 200 ? { id, ok: true } : { id, ok: false, error: motivoDe(r) });
  }
  const primera = carpetas.find(c => c.ok);
  let mail = "no";
  if(p.mail && primera){
    const llave = env("RESEND_API_KEY");
    if(!llave) mail = "sin-configurar";
    else{
      const c = correoBrujula({ nombre: limpio(p.nombre), lang: idiomaDe(p.idioma), enlace: `https://drive.google.com/drive/folders/${primera.id}` });
      try{
        const r = await traer("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: DESDE, to: [correo], reply_to: env("AVISOS_RESPONDER_A") || RESPONDER_A, ...c }) });
        mail = r.ok ? "enviado" : "error";
      }catch(e){ mail = "error"; }
    }
  }
  let planilla = "no";
  const pl = primera && p.planilla ? ctx.planillas.find(x => x.id === p.planilla) : null;
  if(pl) planilla = await anotarEnPlanilla(traer, token, pl.id, { fila: p.fila, correo, nombre: limpio(p.nombre), comunidad: limpio(p.comunidad),
    idioma: NOMBRE_DEL_IDIOMA[idiomaDe(p.idioma)], nota: `Compartido desde Toldot (${fechaDe(ahora())})` });
  return { carpetas, mail, planilla };
}

// Le saca a una persona el acceso de LECTURA a unas carpetas. Antes de borrar se comprueba, con Drive, que ese permiso sea de
// esa persona y de lector: lo que mande el navegador no alcanza para quitarle nada a nadie más ni a un editor.
export async function quitarAcceso(traer, token, ctx, p, { ahora }){
  const correo = String(p.correo || "").trim().toLowerCase();
  if(!CORREO.test(correo)) return { error: "correo" };
  const ids = [...new Set((Array.isArray(p.carpetas) ? p.carpetas : []).map(String))];
  if(!ids.length || ids.length > MAX_CARPETAS || !ids.every(id => ctx.carpetas.some(c => c.id === id))) return { error: "carpetas" };
  const carpetas = [];
  for(const id of ids){
    const pid = p.permisos && p.permisos[id];
    if(!PERMISO_ID.test(String(pid || ""))){ carpetas.push({ id, ok: false, error: "sin-dato" }); continue; }
    const url = `${DRIVE}${encodeURIComponent(id)}/permissions/${encodeURIComponent(pid)}`;
    const g = await google(traer, token, `${url}?${new URLSearchParams({ supportsAllDrives: "true", fields: "id,type,role,emailAddress" })}`);
    if(g.estado === 404){ carpetas.push({ id, ok: true, ya: true }); continue; }
    if(g.estado !== 200){ carpetas.push({ id, ok: false, error: motivoDe(g) }); continue; }
    const d = g.cuerpo;
    if(d.type !== "user" || String(d.emailAddress || "").toLowerCase() !== correo){ carpetas.push({ id, ok: false, error: "no-coincide" }); continue; }
    if(d.role !== "reader" && d.role !== "commenter"){ carpetas.push({ id, ok: false, error: "editor" }); continue; }
    const r = await escribir(traer, token, "DELETE", `${url}?supportsAllDrives=true`);
    carpetas.push(r.estado === 204 || r.estado === 200 ? { id, ok: true } : { id, ok: false, error: motivoDe(r) });
  }
  // Una nota en cada fila de planilla de esa persona (solo si se quitó algo).
  const quitadas = carpetas.filter(c => c.ok && !c.ya).map(c => ctx.carpetas.find(x => x.id === c.id).nombre);
  let planilla = "no";
  if(quitadas.length && Array.isArray(p.filas)){
    const nota = `Quitado de ${quitadas.join(", ").slice(0, 400)} (${fechaDe(ahora())})`;
    const res = [];
    for(const f of p.filas.slice(0, MAX_PLANILLAS * 3)){
      const pl = ctx.planillas.find(x => x.id === f.planilla);
      if(pl) res.push(await notaDeQuitado(traer, token, pl.id, { fila: Number(f.fila), correo, nota }));
    }
    planilla = res.includes("escrita") ? "escrita" : (res.includes("error") ? "error" : "no");
  }
  return { carpetas, planilla };
}

// «Sacar de la lista»: cierra las filas de planilla que esperan acceso (las que el Script no pudo dar y dejó con un error, o
// las que todavía no se atendieron). La fila NO se borra: se le pone «Enviado» —lo único que el Script de los lunes respeta
// como «ya está» (cualquier otra palabra la vuelve a procesar)— y una nota que dice qué pasó. Solo toca filas que siguen
// siendo de esa persona y que todavía no dicen «Enviado»; una fila de una planilla fuera del catálogo se ignora.
export async function descartarFilas(traer, token, ctx, p, { ahora }){
  const correo = String(p.correo || "").trim().toLowerCase();
  if(!CORREO.test(correo)) return { error: "correo" };
  const filas = Array.isArray(p.filas) ? p.filas.slice(0, MAX_PLANILLAS * 3) : [];
  const nota = `Sacado de la lista desde Toldot (${fechaDe(ahora())})`;
  const res = [];
  for(const f of filas){
    const pl = ctx.planillas.find(x => x.id === String(f && f.planilla));
    const fila = Number(f && f.fila);
    if(!pl || !Number.isInteger(fila) || fila < 2 || fila > MAX_FILAS + 1){ res.push({ planilla: String(f && f.planilla || ""), fila, estado: "ignorada" }); continue; }
    try{
      await titulosDeToldot(traer, token, pl.id);
      const a = await google(traer, token, hoja(pl.id, `A${fila}:H${fila}`));
      const v = (a.cuerpo.values || [[]])[0] || [];
      if(a.estado !== 200 || limpio(v[1]).toLowerCase() !== correo){ res.push({ planilla: pl.id, fila, estado: "fila-cambio" }); continue; }
      if(limpio(v[4], 30).toLowerCase() === "enviado"){ res.push({ planilla: pl.id, fila, estado: "ya" }); continue; }
      const r = await escribir(traer, token, "POST", `${SHEETS}${encodeURIComponent(pl.id)}/values:batchUpdate`,
        { valueInputOption: "RAW", data: [{ range: `E${fila}:H${fila}`, values: [["Enviado", "", "Toldot", nota]] }] });
      res.push({ planilla: pl.id, fila, estado: r.estado === 200 ? "cerrada" : "error" });
    }catch(e){ res.push({ planilla: pl.id, fila, estado: "error" }); }
  }
  return { filas: res };
}

// Le saca el acceso a TODOS los lectores de una carpeta. Pide el nombre de la carpeta escrito (lo comprueba acá, no solo en la
// pantalla). A los editores no los toca.
export async function sacarATodos(traer, token, ctx, p){
  const c = ctx.carpetas.find(x => x.id === String(p.carpeta));
  if(!c) return { error: "carpetas" };
  if(String(p.confirmar || "").trim() !== String(c.nombre).trim()) return { error: "confirmar" };
  const l = await permisosDe(traer, token, c.id);
  if(l.error) return { error: l.error };
  const personas = l.permisos.filter(x => x.type === "user" && x.emailAddress);
  const lectores = personas.filter(x => x.role === "reader" || x.role === "commenter");
  let quitados = 0, heredados = 0, errores = 0;
  for(let i = 0; i < lectores.length; i += 5){
    await Promise.all(lectores.slice(i, i + 5).map(async x => {
      const r = await escribir(traer, token, "DELETE", `${DRIVE}${encodeURIComponent(c.id)}/permissions/${encodeURIComponent(x.id)}?supportsAllDrives=true`);
      if(r.estado === 204 || r.estado === 200) quitados++; else if(motivoDe(r) === "heredado") heredados++; else errores++;
    }));
  }
  return { quitados, heredados, errores, editores: personas.length - lectores.length };
}

/* ======================================================================
   La función `brujula` de Supabase
   ====================================================================== */
const ACCIONES_DE_LECTURA = ["comprobar", "comprobar-planilla", "leer"];
const ACCIONES_DE_ESCRITURA = ["dar", "quitar", "sacar-todos", "descartar"];
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
  const accion = pedido && pedido.accion;
  const escribe = ACCIONES_DE_ESCRITURA.includes(accion);
  if(!escribe && !ACCIONES_DE_LECTURA.includes(accion)) return responder({ error: "pedido" }, 400);

  // ¿Es admin? Con SU sesión: la base decide, y antes de hablar con Google.
  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  try{
    const r = await traer(`${url}/rest/v1/rpc/puede_gestionar_brujula`, { method: "POST", headers: conSesion, body: "{}" });
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    if(!(r.ok && (await r.json()) === true)) return responder({ error: "no-admin" }, 403);
  }catch(e){ return responder({ error: "base" }, 502); }

  let token;
  try{ token = await permisoDeGoogle(leerCuenta(cuentaTexto), { fetch: traer, ahora: ahora(), alcance: escribe ? ALCANCE_ESCRITURA : ALCANCE_LECTURA }); }
  catch(e){ console.error(e.message); return responder({ error: "google-permiso" }, 502); }

  try{
    if(accion === "comprobar" || accion === "comprobar-planilla"){
      const r = accion === "comprobar" ? await comprobarLink(traer, token, pedido.link) : await comprobarPlanilla(traer, token, pedido.link);
      return r.caso === "google" ? responder({ error: "google" }, 502) : responder(r);
    }
    // El catálogo sale de la base, con la sesión del admin: lo único que se puede leer o tocar.
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
    if(accion === "leer") return responder(await leerTodo(traer, token, { carpetas, planillas }, ahora()));
    const ctx = { carpetas, planillas };
    const r = accion === "dar" ? await darAcceso(traer, token, ctx, { ...(pedido.persona || {}), carpetas: pedido.carpetas, mail: pedido.mail, planilla: pedido.planilla, fila: pedido.fila }, { env, ahora })
      : accion === "quitar" ? await quitarAcceso(traer, token, ctx, pedido, { ahora })
      : accion === "descartar" ? await descartarFilas(traer, token, ctx, pedido, { ahora })
      : await sacarATodos(traer, token, ctx, pedido);
    return r.error ? responder(r, 400) : responder(r);
  }catch(e){ console.error(e.message); return responder({ error: "google" }, 502); }
}
