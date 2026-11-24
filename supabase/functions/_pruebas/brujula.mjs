/* ======================================================================
   La función `brujula` (supabase/functions/_compartido/brujula.mjs): leer Drive y
   las planillas con la cuenta de servicio, solo para un admin, solo lo del
   catálogo y solo leyendo. Todo contra un Google y un Supabase de mentira, con
   gente inventada (@example.org) y una llave RSA armada en el momento.
   ====================================================================== */
import { generateKeyPairSync } from "node:crypto";
import { idDeLink, comprobarLink, combinar, leerTodo, atender, ALCANCE_LECTURA, ALCANCE_ESCRITURA } from "../_compartido/brujula.mjs";
import { correoBrujula } from "../_compartido/correos.mjs";
import { olvidarPermisos } from "../_compartido/google.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const CUENTA = JSON.stringify({ type: "service_account", client_email: "brujula@proyecto.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.googleapis.com/token" });
const de64 = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/* ---------- El link ---------- */
const A = "1AbCdEfGhIjKlMnOpQrStUvWxYz";
eq("link: de «Compartir»", idDeLink(`https://drive.google.com/drive/folders/${A}?usp=sharing`), A);
eq("link: con el número de cuenta (/u/0/)", idDeLink(`https://drive.google.com/drive/u/0/folders/${A}`), A);
eq("link: de un archivo o un acceso directo (/file/d/…)", idDeLink(`https://drive.google.com/file/d/${A}/view?usp=drivesdk`), A);
eq("link: de un documento (docs.google.com)", idDeLink(`https://docs.google.com/document/d/${A}/edit`), A);
eq("link: el viejo open?id=", idDeLink(`https://drive.google.com/open?id=${A}`), A);
eq("link: con espacios alrededor", idDeLink(`  https://drive.google.com/drive/folders/${A}  `), A);
eq("link: de otro sitio, no", idDeLink(`https://example.org/drive/folders/${A}`), null);
eq("link: sin https, no", idDeLink(`http://drive.google.com/drive/folders/${A}`), null);
eq("link: un host que solo parece de Google, no", idDeLink(`https://drive.google.com.example.org/drive/folders/${A}`), null);
eq("link: un texto cualquiera, no", idDeLink("la carpeta de congresos"), null);
eq("link: un ID suelto (sin link), no", idDeLink(A), null);
eq("link: un ID demasiado corto, no", idDeLink("https://drive.google.com/drive/folders/abc"), null);
eq("link: vacío o ausente, no", [idDeLink(""), idDeLink(null), idDeLink(undefined)], [null, null, null]);
eq("link: enorme, no", idDeLink("https://drive.google.com/drive/folders/" + "a".repeat(3000)), null);

/* ---------- Un Google y una base de mentira ---------- */
const ID_CAR1 = "CarpetaUnoAbCdEf", ID_CAR2 = "CarpetaDosGhIjKl", ID_CAR3 = "CarpetaTresMnOpQr";
const ID_PLA1 = "PlanillaUnoAbCdEf", ID_PLA2 = "PlanillaDosGhIjKl";
const CATALOGO = [
  { id: ID_CAR1, nombre: "Brújula Cloud", orden: 1, activa: true, planillas: [ID_PLA1] },
  { id: ID_CAR2, nombre: "CARE", orden: 2, activa: true, planillas: [ID_PLA1, ID_PLA2] },
  { id: ID_CAR3, nombre: "Una que Toldot no ve", orden: 3, activa: false, planillas: [] },
];
const PLANILLAS = [{ id: ID_PLA1, nombre: "Users grande", orden: 1 }, { id: ID_PLA2, nombre: "Users CARE", orden: 2 }];
const usuarios = n => Array.from({ length: n }, (_, i) => ({ id: "p" + i, type: "user", role: "reader", emailAddress: `u${i + 1}@example.org`, displayName: `Persona ${i + 1}` }));
const PERMISOS = {
  [ID_CAR1]: [
    // Drive da de a 100: la primera página trae 100 y avisa que hay más.
    { pagina: 1, permisos: usuarios(100), siguiente: "pag2" },
    { pagina: 2, permisos: [
      { id: "q1", type: "user", role: "reader", emailAddress: "Ana@Example.org", displayName: "Ana Dos" },
      { id: "q2", type: "user", role: "writer", emailAddress: "equipo@example.org", displayName: "Equipo" },
      { id: "q3", type: "group", role: "reader", emailAddress: "grupo@example.org" },
      { id: "q4", type: "anyone", role: "reader" },
      { id: "q5", type: "user", role: "owner", emailAddress: "duena@example.org" },
    ] },
  ],
  [ID_CAR2]: [{ pagina: 1, permisos: [
    { id: "r1", type: "user", role: "reader", emailAddress: "u1@example.org", displayName: "Persona 1" },
    { id: "r2", type: "user", role: "commenter", emailAddress: "solo.care@example.org", displayName: "Solo CARE" },
  ] }],
};
const FILAS_1 = [
  ["Valeria Montes", "valeria@example.org", "Buenos Aires", "Español", "Enviado"],
  ["⁠Hannah Cole", "Hannah@Example.org ", "Otro", "Inglés", ""],
  ["Ana Dos", "ana@example.org", "Chile", "Español", "", "Error: no se pudo compartir"],
  ["sin correo", "", "", "", ""],
  ["con basura", "esto no es un correo", "", "", ""],
  ["Persona 1 (otra vez)", "u1@example.org", "Rosario", "Portugués", "Enviado"],
];
const FILAS_2 = [["Solo Care Uno", "solo.care@example.org", "Chile", "Español", "Enviado"]];
// Los permisos que se pueden pedir de a uno (para quitar): uno de lector, uno de editor, uno heredado.
const PERM = {
  [ID_CAR1 + "/pv1"]: { id: "pv1", type: "user", role: "reader", emailAddress: "valeria@example.org" },
  [ID_CAR1 + "/pe1"]: { id: "pe1", type: "user", role: "writer", emailAddress: "equipo@example.org" },
  [ID_CAR1 + "/ph1"]: { id: "ph1", type: "user", role: "reader", emailAddress: "otra@example.org" },
};

// Un archivo/carpeta de Drive para `comprobar`.
const DRIVE = {
  ok:        { id: A, name: "Material 2027", mimeType: "application/vnd.google-apps.folder", capabilities: { canShare: true } },
  noPuede:   { id: A, name: "Solo lectura", mimeType: "application/vnd.google-apps.folder", capabilities: { canShare: false } },
  doc:       { id: A, name: "Plan", mimeType: "application/vnd.google-apps.document", capabilities: { canShare: true } },
  unidad:    { id: A, name: "De la unidad", mimeType: "application/vnd.google-apps.folder", driveId: "0AUnidad", capabilities: { canShare: true } },
  papelera:  { id: A, name: "Vieja", mimeType: "application/vnd.google-apps.folder", trashed: true, capabilities: { canShare: true } },
  atajoOk:   { id: A, name: "Hadraja (atajo)", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "DestinoRealAbCdEfG", targetMimeType: "application/vnd.google-apps.folder" } },
  atajoDoc:  { id: A, name: "Un doc (atajo)", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "DestinoDocAbCdEfGh", targetMimeType: "application/vnd.google-apps.document" } },
  atajoOculto: { id: A, name: "Atajo a lo que no veo", mimeType: "application/vnd.google-apps.shortcut", shortcutDetails: { targetId: "DestinoOcultoAbCdEf", targetMimeType: "application/vnd.google-apps.folder" } },
  hoja:        { id: A, name: "Users", mimeType: "application/vnd.google-apps.spreadsheet", capabilities: { canEdit: true } },
  hojaLectura: { id: A, name: "Users", mimeType: "application/vnd.google-apps.spreadsheet", capabilities: { canEdit: false } },
};
const DESTINOS = { DestinoRealAbCdEfG: { id: "DestinoRealAbCdEfG", name: "Hadraja · Enseñanza", mimeType: "application/vnd.google-apps.folder", capabilities: { canShare: true } } };

function mundo({ admin = true, rpc = null, drive = null, tokenNiega = false, rechazar = [], resend = "ok" } = {}){
  const reg = { google: [], drive: [], base: [], tokens: 0 };
  const traer = async (url, op = {}) => {
    const u = String(url);
    if(u === "https://oauth2.googleapis.com/token"){
      if(tokenNiega) return new Response(JSON.stringify({ error: "invalid_grant", error_description: "brujula@proyecto…" }), { status: 400 });
      const [, datos] = new URLSearchParams(op.body).get("assertion").split(".");
      reg.scope = JSON.parse(de64(datos)).scope; reg.tokens++;
      return new Response(JSON.stringify({ access_token: "permiso-" + reg.tokens, expires_in: 3600 }));
    }
    if(u.includes("/rest/v1/")){
      reg.base.push({ u, auth: op.headers && op.headers.Authorization });
      if(u.endsWith("/rpc/puede_gestionar_brujula")){
        if(rpc === "caida") throw new Error("sin red");
        if(rpc === 401) return new Response("{}", { status: 401 });
        return new Response(JSON.stringify(admin));
      }
      if(u.includes("/brujula_carpetas")) return new Response(JSON.stringify(CATALOGO));
      if(u.includes("/brujula_planillas")) return new Response(JSON.stringify(PLANILLAS));
      throw new Error("tabla inesperada: " + u);
    }
    if(u === "https://api.resend.com/emails"){
      reg.correos = (reg.correos || []).concat([JSON.parse(op.body)]); reg.resendAuth = op.headers.Authorization;
      return new Response("{}", { status: resend === "falla" ? 500 : 200 });
    }
    // Todo lo que sigue es de Google: tiene que llevar el permiso.
    reg.google.push(u);
    if(op.headers?.Authorization !== "Bearer permiso-" + reg.tokens) return new Response("{}", { status: 401 });
    let m;
    if((m = /\/drive\/v3\/files\/([^/?]+)\/permissions\?(.*)$/.exec(u))){
      const id = decodeURIComponent(m[1]), q = new URLSearchParams(m[2]);
      reg.drive.push(id);
      if(op.method === "POST"){
        const cuerpo = JSON.parse(op.body);
        reg.creados = (reg.creados || []).concat([{ carpeta: id, q: Object.fromEntries(q), cuerpo }]);
        if(rechazar.includes(cuerpo.emailAddress)) return new Response(JSON.stringify({ error: { message: "El administrador de ejemplo.org inhabilitó la recepción de elementos ajenos a su organización." } }), { status: 400 });
        return new Response(JSON.stringify({ id: "nuevo" + reg.creados.length, role: "reader" }));
      }
      const paginas = PERMISOS[id];
      if(!paginas) return new Response(JSON.stringify({ error: { message: "File not found" } }), { status: 404 });
      const n = q.get("pageToken") ? 2 : 1;
      const p = paginas.find(x => x.pagina === n);
      return new Response(JSON.stringify({ permissions: p.permisos, ...(p.siguiente ? { nextPageToken: p.siguiente } : {}) }));
    }
    if((m = /\/drive\/v3\/files\/([^/?]+)\/permissions\/([^/?]+)\?/.exec(u))){
      const clave = `${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
      reg.drive.push(decodeURIComponent(m[1]));
      if(op.method === "DELETE"){
        reg.borrados = (reg.borrados || []).concat([clave]);
        if(m[2] === "ph1") return new Response(JSON.stringify({ error: { message: "The permission is inherited and cannot be deleted." } }), { status: 403 });
        return new Response(null, { status: 204 });
      }
      return PERM[clave] ? new Response(JSON.stringify(PERM[clave])) : new Response("{}", { status: 404 });
    }
    if((m = /\/drive\/v3\/files\/([^/?]+)\?/.exec(u))){
      const id = decodeURIComponent(m[1]);
      reg.drive.push(id);
      if(drive === 500) return new Response("{}", { status: 500 });
      if(DESTINOS[id]) return new Response(JSON.stringify(DESTINOS[id]));
      if(drive && drive !== "oculto" && id === A) return new Response(JSON.stringify(DRIVE[drive]));
      return new Response(JSON.stringify({ error: { message: "File not found" } }), { status: 404 });
    }
    if((m = /\/spreadsheets\/([^/]+)\/values(?:\/|:)/.exec(u))){
      const id = decodeURIComponent(m[1]);
      reg.hojas = (reg.hojas || []).concat(id);
      reg.hojaFilas ||= { [ID_PLA1]: structuredClone(FILAS_1), [ID_PLA2]: structuredClone(FILAS_2) };
      reg.titulos ||= {};
      const filas = reg.hojaFilas[id];
      if(!filas) return new Response("{}", { status: 404 });
      const rango = decodeURIComponent((/\/values\/([^?]+)/.exec(u) || [])[1] || "");
      const metodo = op.method || "GET";
      if(metodo !== "GET") reg.entradas = (reg.entradas || []).concat([u.includes("values:batchUpdate") ? JSON.parse(op.body).valueInputOption : new URL(u).searchParams.get("valueInputOption")]);
      if(metodo === "POST" && rango.endsWith(":append")){ filas.push(JSON.parse(op.body).values[0]); return new Response("{}"); }
      if(metodo === "POST" && u.includes("values:batchUpdate")){
        for(const d of JSON.parse(op.body).data){ const n = Number(/^E(\d+):H\d+$/.exec(d.range)[1]); const fila = (filas[n - 2] ||= []); d.values[0].forEach((v, k) => { fila[4 + k] = v; }); }
        return new Response("{}");
      }
      if(metodo === "PUT"){
        const v = JSON.parse(op.body).values[0];
        if(rango === "G1:H1") reg.titulos[id] = v;
        else { const n = Number(/^H(\d+)$/.exec(rango)[1]); (filas[n - 2] ||= [])[7] = v[0]; }
        return new Response("{}");
      }
      if(rango === "G1:H1") return new Response(JSON.stringify(reg.titulos[id] ? { values: [reg.titulos[id]] } : {}));
      const fila = /^A(\d+):H\1$/.exec(rango);
      if(fila) return new Response(JSON.stringify({ values: [filas[Number(fila[1]) - 2] || []] }));
      return new Response(JSON.stringify({ values: filas }));
    }
    throw new Error("pedido inesperado: " + u);
  };
  return { traer, reg };
}

/* ---------- ¿Es una carpeta que Toldot puede gestionar? ---------- */
{
  // El token de mentira tiene que coincidir con el de `mundo`: se pide uno.
  const comprobarConPermiso = async (clave, link = `https://drive.google.com/drive/folders/${A}`) => {
    const m = mundo({ drive: clave });
    m.reg.tokens = 7; // el permiso «permiso-7»
    return comprobarLink(m.traer, "permiso-7", link);
  };
  eq("comprobar: una carpeta de «Mi unidad» que se puede compartir", await comprobarConPermiso("ok"), { caso: "ok", id: A, nombre: "Material 2027" });
  eq("comprobar: una carpeta que Toldot no puede compartir (solo lectura)", await comprobarConPermiso("noPuede"), { caso: "sinpermiso" });
  eq("comprobar: una carpeta que no está compartida con Toldot (Drive dice 404)", await comprobarConPermiso("oculto"), { caso: "sinpermiso" });
  eq("comprobar: un documento no es una carpeta", await comprobarConPermiso("doc"), { caso: "nocarpeta" });
  eq("comprobar: una carpeta de una unidad compartida todavía no", await comprobarConPermiso("unidad"), { caso: "unidad-compartida" });
  eq("comprobar: una carpeta en la papelera", await comprobarConPermiso("papelera"), { caso: "papelera" });
  eq("comprobar: un acceso directo a una carpeta propone la de verdad", await comprobarConPermiso("atajoOk"),
     { caso: "atajo", destino: { id: "DestinoRealAbCdEfG", nombre: "Hadraja · Enseñanza" } });
  eq("comprobar: un acceso directo a un documento no es una carpeta", await comprobarConPermiso("atajoDoc"), { caso: "nocarpeta" });
  eq("comprobar: un acceso directo a algo que Toldot no ve", await comprobarConPermiso("atajoOculto"), { caso: "sinpermiso" });
  eq("comprobar: un texto que no es un link de Drive", await comprobarConPermiso("ok", "mi carpeta"), { caso: "link" });
  eq("comprobar: si Google contesta cualquier otra cosa, no lo da por bueno", await comprobarConPermiso(500), { caso: "google" });
}

/* ---------- Juntar lo que hay en Drive con lo de las planillas ---------- */
{
  const permisos = {
    [ID_CAR1]: PERMISOS[ID_CAR1].flatMap(p => p.permisos),
    [ID_CAR2]: PERMISOS[ID_CAR2][0].permisos,
  };
  const filas = { [ID_PLA1]: [], [ID_PLA2]: [] };
  const personas = combinar(CATALOGO.slice(0, 2), permisos, filas);
  const por = c => personas.find(p => p.correo === c);
  eq("combinar: solo cuenta personas (ni grupos ni «cualquiera con el link»)", personas.length, 100 + 1 + 1 + 1 + 1);
  eq("combinar: los correos van en minúscula", por("ana@example.org").carpetas, { [ID_CAR1]: "reader" });
  eq("combinar: quien está en dos carpetas figura una vez, con las dos", por("u1@example.org").carpetas, { [ID_CAR1]: "reader", [ID_CAR2]: "reader" });
  eq("combinar: quien puede editar se marca (no se le puede quitar desde Toldot)", [por("equipo@example.org").editor, por("duena@example.org").editor, por("ana@example.org").editor], [true, true, false]);
  eq("combinar: quien solo comenta cuenta como lector", por("solo.care@example.org").editor, false);
  eq("combinar: el nombre sale de Drive si no hay planilla", por("ana@example.org").nombre, "Ana Dos");
}
{
  const { traer, reg } = mundo();
  reg.tokens = 7;
  const r = await leerTodo(traer, "permiso-7", { carpetas: CATALOGO, planillas: PLANILLAS }, Date.parse("2026-11-23T12:00:00Z"));
  const por = c => r.personas.find(p => p.correo === c);
  eq("leer: la hora a la que se leyó", r.leido, "2026-11-23T12:00:00.000Z");
  eq("leer: lee TODAS las páginas de permisos (Drive da de a 100)", r.carpetas.find(c => c.id === ID_CAR1).personas, 100 + 1 + 1 + 1);
  eq("leer: una carpeta que Toldot no ve se marca, y las demás siguen",
     r.carpetas.map(c => [c.nombre, c.estado]), [["Brújula Cloud", "ok"], ["CARE", "ok"], ["Una que Toldot no ve", "sinpermiso"]]);
  eq("leer: la carpeta trae si se ofrece y a qué planillas pertenece", r.carpetas.map(c => [c.activa, c.planillas.length]), [[true, 1], [true, 2], [false, 0]]);
  eq("leer: las planillas con sus filas y sus pendientes (sin contar filas sin correo)",
     r.planillas.map(p => [p.nombre, p.estado, p.filas, p.pendientes]), [["Users grande", "ok", 4, 2], ["Users CARE", "ok", 1, 0]]);
  eq("leer: quien está en la planilla y todavía no tiene acceso, aparece pendiente",
     [por("hannah@example.org").pendiente, por("hannah@example.org").carpetas, por("hannah@example.org").nombre], [true, {}, "Hannah Cole"]);
  eq("leer: lo invisible que se cuela al copiar de WhatsApp se saca del nombre", por("hannah@example.org").nombre.includes("⁠"), false);
  eq("leer: quien ya fue procesado por el Script no está pendiente", [por("valeria@example.org").pendiente, por("solo.care@example.org").pendiente], [false, false]);
  eq("leer: la planilla le suma idioma y comunidad a quien ya tiene acceso", [por("u1@example.org").idioma, por("u1@example.org").comunidad], ["Portugués", "Rosario"]);
  eq("leer: el error que dejó el Script se ve", por("ana@example.org").error, "Error: no se pudo compartir");
  eq("leer: una fila con algo que no es un correo se ignora", r.personas.some(p => p.nombre === "con basura"), false);
  eq("leer: de a una persona, sin repetir", new Set(r.personas.map(p => p.correo)).size, r.personas.length);
  eq("leer: nada se pidió fuera del catálogo",
     [...new Set(reg.drive)].sort(), [ID_CAR1, ID_CAR2, ID_CAR3].sort());
  eq("leer: pidió las dos páginas de la primera carpeta", reg.google.filter(u => u.includes(ID_CAR1) && u.includes("pageToken=pag2")).length, 1);
  eq("leer: las páginas se piden de a 100 (el tope de Drive)", reg.google.filter(u => u.includes("/permissions?")).every(u => u.includes("pageSize=100")), true);
}

/* ---------- La función ---------- */
const ORIGEN = "https://team-latam.github.io";
const pedir = (cuerpo, { metodo = "POST", auth = "Bearer sesion", apikey = "clave", origen = ORIGEN } = {}) => new Request("https://x.supabase.co/functions/v1/brujula", {
  method: metodo,
  headers: { ...(auth ? { authorization: auth } : {}), ...(apikey ? { apikey } : {}), origin: origen, "content-type": "application/json" },
  body: metodo === "POST" ? (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)) : undefined,
});
const ENV = { SUPABASE_URL: "https://x.supabase.co", GOOGLE_CUENTA_BRUJULA: CUENTA };
const entorno = (extra = {}) => k => ({ ...ENV, ...extra })[k];
const leerRes = async r => ({ estado: r.status, cuerpo: await r.json().catch(() => null) });
const correr = async (req, m, env = entorno()) => { olvidarPermisos(); return leerRes(await atender(req, { env, fetch: m.traer, ahora: () => Date.parse("2026-11-23T12:00:00Z") })); };

{
  let m = mundo();
  let r = await correr(pedir({ accion: "leer" }), m);
  eq("función: un admin lee y recibe carpetas, planillas y personas", [r.estado, Object.keys(r.cuerpo).sort()], [200, ["carpetas", "leido", "personas", "planillas"]]);
  eq("función: pide solo leer: ni compartir ni escribir en las planillas",
     [m.reg.scope === ALCANCE_LECTURA, /auth\/drive(\s|$)/.test(m.reg.scope), /auth\/spreadsheets(\s|$)/.test(m.reg.scope)], [true, false, false]);
  eq("función: el catálogo se lee con la sesión de quien llama, no con una llave de servicio",
     m.reg.base.every(b => b.auth === "Bearer sesion"), true);
  eq("función: nada de lo que mande el navegador cambia qué carpetas se leen",
     (await (async () => { const mm = mundo(); await correr(pedir({ accion: "leer", carpetas: ["OtraCarpetaAbCdEfGh"], id: "OtraCarpetaAbCdEfGh" }), mm); return [...new Set(mm.reg.drive)].sort(); })()),
     [ID_CAR1, ID_CAR2, ID_CAR3].sort());

  m = mundo({ drive: "ok" });
  r = await correr(pedir({ accion: "comprobar", link: `https://drive.google.com/drive/folders/${A}` }), m);
  eq("función: un admin comprueba un link", [r.estado, r.cuerpo], [200, { caso: "ok", id: A, nombre: "Material 2027" }]);

  m = mundo({ admin: false });
  r = await correr(pedir({ accion: "leer" }), m);
  eq("función: quien no es admin recibe 403, y ni se habla con Google", [r.estado, r.cuerpo, m.reg.google.length, m.reg.tokens], [403, { error: "no-admin" }, 0, 0]);
  m = mundo({ admin: false });
  r = await correr(pedir({ accion: "comprobar", link: `https://drive.google.com/drive/folders/${A}` }), m);
  eq("función: tampoco puede comprobar un link", [r.estado, m.reg.google.length], [403, 0]);

  m = mundo({ rpc: 401 });
  r = await correr(pedir({ accion: "leer" }), m);
  eq("función: una sesión vencida (la base dice 401) es «sin-sesion»", [r.estado, r.cuerpo], [401, { error: "sin-sesion" }]);
  m = mundo({ rpc: "caida" });
  r = await correr(pedir({ accion: "leer" }), m);
  eq("función: si la base no contesta, 502 y no se sigue", [r.estado, r.cuerpo, m.reg.google.length], [502, { error: "base" }, 0]);

  r = await correr(pedir({ accion: "leer" }, { auth: "" }), mundo());
  eq("función: sin sesión, 401", [r.estado, r.cuerpo], [401, { error: "sin-sesion" }]);
  r = await correr(pedir({ accion: "leer" }, { apikey: "" }), mundo());
  eq("función: sin la clave de la app, 401", r.estado, 401);
  r = await correr(pedir({ accion: "leer" }), mundo(), entorno({ GOOGLE_CUENTA_BRUJULA: "" }));
  eq("función: sin la llave de la cuenta, «sin-configurar» (503)", [r.estado, r.cuerpo], [503, { error: "sin-configurar" }]);
  r = await correr(pedir("esto no es json"), mundo());
  eq("función: un pedido que no es JSON, 400", [r.estado, r.cuerpo], [400, { error: "pedido" }]);
  r = await correr(pedir({ accion: "compartir" }), mundo());
  eq("función: una acción que no existe (por ejemplo, compartir: todavía no) se rechaza", [r.estado, r.cuerpo], [400, { error: "pedido" }]);
  r = await correr(pedir(null, { metodo: "GET" }), mundo());
  eq("función: solo POST", r.estado, 405);
  const opciones = await atender(pedir(null, { metodo: "OPTIONS" }), { env: entorno(), fetch: mundo().traer });
  eq("función: contesta el CORS a la página del equipo", [opciones.status, opciones.headers.get("access-control-allow-origin")], [204, ORIGEN]);
  const ajeno = await atender(pedir({ accion: "leer" }, { origen: "https://sitio-ajeno.example" }), { env: entorno(), fetch: mundo().traer });
  eq("función: a una página ajena no le da el permiso de CORS", ajeno.headers.get("access-control-allow-origin"), null);

  m = mundo({ tokenNiega: true });
  r = await correr(pedir({ accion: "leer" }), m);
  eq("función: si Google niega el permiso, 502 y el error no repite lo que dijo Google ni el correo de la cuenta",
     [r.estado, r.cuerpo, JSON.stringify(r.cuerpo).includes("brujula@")], [502, { error: "google-permiso" }, false]);

  m = mundo({ drive: 500 });
  r = await correr(pedir({ accion: "comprobar", link: `https://drive.google.com/drive/folders/${A}` }), m);
  eq("función: si Google falla al comprobar, 502 (y no dice «ok»)", [r.estado, r.cuerpo], [502, { error: "google" }]);
}

/* ---------- Dar acceso, quitar y sacar a todos ---------- */
const hacer = (cuerpo, m, env = entorno({ RESEND_API_KEY: "re_prueba" })) => correr(pedir(cuerpo), m, env);
const ELENA = { correo: "Elena@Example.org ", nombre: "Elena <b>Ríos", idioma: "Hebreo", comunidad: "Chile" };
{
  let m = mundo();
  let r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1, ID_CAR2], mail: true, planilla: ID_PLA1 }, m);
  eq("dar: un permiso de lector por carpeta, sin el aviso de Drive, al correo en minúscula",
     m.reg.creados.map(c => [c.carpeta, c.cuerpo, c.q.sendNotificationEmail]),
     [[ID_CAR1, { type: "user", role: "reader", emailAddress: "elena@example.org" }, "false"], [ID_CAR2, { type: "user", role: "reader", emailAddress: "elena@example.org" }, "false"]]);
  eq("dar: pide el permiso de escribir (no el de leer)", m.reg.scope, ALCANCE_ESCRITURA);
  eq("dar: contesta qué salió con cada cosa", [r.estado, r.cuerpo], [200, { carpetas: [{ id: ID_CAR1, ok: true }, { id: ID_CAR2, ok: true }], mail: "enviado", planilla: "agregada" }]);
  const c = m.reg.correos[0];
  eq("dar: un solo mail, al correo de la persona, desde Toldot y con la llave de Resend",
     [m.reg.correos.length, c.to, c.from.startsWith("Toldot <"), m.reg.resendAuth], [1, ["elena@example.org"], true, "Bearer re_prueba"]);
  eq("dar: el mail va en hebreo, de derecha a izquierda, con el link a la primera carpeta y el nombre sin HTML",
     [c.subject, /dir="rtl"/.test(c.html), c.html.includes(ID_CAR1), c.html.includes("<b>Ríos")], ["ברוכים הבאים ל-Brújula", true, true, false]);
  eq("dar: la planilla recibe una fila nueva ya marcada «Enviado» (así el Script no la repite), de Toldot y con una nota",
     m.reg.hojaFilas[ID_PLA1].at(-1), ["Elena <b>Ríos", "elena@example.org", "Chile", "Hebreo", "Enviado", "", "Toldot", "Compartido desde Toldot (2026-11-23)"]);
  eq("dar: pone los títulos de las dos columnas nuevas", m.reg.titulos[ID_PLA1], ["Desde", "Nota de Toldot"]);
  eq("dar: todo lo que escribe en la planilla va como texto (RAW): un «=algo» no se vuelve fórmula", [m.reg.entradas.length > 0, m.reg.entradas.every(x => x === "RAW")], [true, true]);

  m = mundo();
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1], mail: false, planilla: ID_PLA2 }, m);
  eq("dar: sin mail no sale ninguno", [r.cuerpo.mail, m.reg.correos], ["no", undefined]);
  eq("dar: anota en la planilla que se le dijo", [r.cuerpo.planilla, m.reg.hojaFilas[ID_PLA2].length], ["agregada", 2]);

  m = mundo();
  r = await hacer({ accion: "dar", persona: { correo: "hannah@example.org", nombre: "Hannah Cole", idioma: "Inglés" }, carpetas: [ID_CAR1], mail: false, planilla: ID_PLA1, fila: 3 }, m);
  eq("dar: a alguien que estaba pendiente en la planilla le marca esa fila «Enviado» y limpia el error",
     [r.cuerpo.planilla, m.reg.hojaFilas[ID_PLA1][1].slice(4), m.reg.hojaFilas[ID_PLA1].length], ["actualizada", ["Enviado", "", "Toldot", "Compartido desde Toldot (2026-11-23)"], 6]);
  eq("dar: lo mismo al actualizar una fila: como texto (RAW)", [m.reg.entradas.length > 0, m.reg.entradas.every(x => x === "RAW")], [true, true]);
  m = mundo();
  r = await hacer({ accion: "dar", persona: { correo: "hannah@example.org", nombre: "Hannah Cole" }, carpetas: [ID_CAR1], mail: false, planilla: ID_PLA1, fila: 2 }, m);
  eq("dar: si esa fila ya es de otra persona (alguien la cambió), no la toca", [r.cuerpo.planilla, m.reg.hojaFilas[ID_PLA1][0][6]], ["fila-cambio", undefined]);

  m = mundo();
  r = await hacer({ accion: "dar", persona: { correo: "no-es-un-correo" }, carpetas: [ID_CAR1] }, m);
  eq("dar: un correo que no lo es, 400 y no se crea nada", [r.estado, r.cuerpo, m.reg.creados], [400, { error: "correo" }, undefined]);
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1, "OtraCarpetaAbCdEfGh"] }, m);
  eq("dar: una carpeta que no está en el catálogo, 400 y no se crea nada (ni en las otras)", [r.estado, r.cuerpo, m.reg.creados], [400, { error: "carpetas" }, undefined]);
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [] }, m);
  eq("dar: sin carpetas, 400", [r.estado, r.cuerpo], [400, { error: "carpetas" }]);

  m = mundo({ rechazar: ["rechazada@example.org"] });
  r = await hacer({ accion: "dar", persona: { correo: "rechazada@example.org", nombre: "X" }, carpetas: [ID_CAR1], mail: true, planilla: ID_PLA1 }, m);
  eq("dar: si Google no deja compartir con ese correo, se dice en una palabra y no se manda mail ni se anota",
     [r.cuerpo, m.reg.correos, m.reg.hojaFilas], [{ carpetas: [{ id: ID_CAR1, ok: false, error: "rechazado" }], mail: "no", planilla: "no" }, undefined, undefined]);
  eq("dar: lo que dijo Google no viaja a la pantalla (puede traer correos)", JSON.stringify(r.cuerpo).includes("ejemplo.org"), false);

  m = mundo();
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1], mail: true }, m, entorno({ RESEND_API_KEY: "" }));
  eq("dar: sin la llave de Resend comparte igual y lo dice", [r.cuerpo.carpetas[0].ok, r.cuerpo.mail], [true, "sin-configurar"]);
  m = mundo({ resend: "falla" });
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1], mail: true }, m);
  eq("dar: si el mail no sale, comparte igual y lo dice", [r.cuerpo.carpetas[0].ok, r.cuerpo.mail], [true, "error"]);
  m = mundo({ admin: false });
  r = await hacer({ accion: "dar", persona: ELENA, carpetas: [ID_CAR1] }, m);
  eq("dar: quien no es admin, 403 y no se crea nada", [r.estado, m.reg.creados], [403, undefined]);

  // Quitar
  m = mundo();
  r = await hacer({ accion: "quitar", correo: "valeria@example.org", carpetas: [ID_CAR1], permisos: { [ID_CAR1]: "pv1" }, filas: [{ planilla: ID_PLA1, fila: 2 }] }, m);
  eq("quitar: comprueba con Drive que el permiso es de esa persona y de lector, y lo borra", [r.cuerpo.carpetas, m.reg.borrados], [[{ id: ID_CAR1, ok: true }], [ID_CAR1 + "/pv1"]]);
  eq("quitar: deja una nota en su fila de la planilla", [r.cuerpo.planilla, m.reg.hojaFilas[ID_PLA1][0][7]], ["escrita", "Quitado de Brújula Cloud (2026-11-23)"]);
  eq("quitar: pide el permiso de escribir", m.reg.scope, ALCANCE_ESCRITURA);
  eq("quitar: la nota también va como texto (RAW)", [m.reg.entradas.length > 0, m.reg.entradas.every(x => x === "RAW")], [true, true]);
  m = mundo();
  r = await hacer({ accion: "quitar", correo: "equipo@example.org", carpetas: [ID_CAR1], permisos: { [ID_CAR1]: "pe1" } }, m);
  eq("quitar: a un editor no se lo saca", [r.cuerpo.carpetas, m.reg.borrados], [[{ id: ID_CAR1, ok: false, error: "editor" }], undefined]);
  m = mundo();
  r = await hacer({ accion: "quitar", correo: "otra.persona@example.org", carpetas: [ID_CAR1], permisos: { [ID_CAR1]: "pv1" } }, m);
  eq("quitar: si el permiso que mandó el navegador es de otra persona, no se borra", [r.cuerpo.carpetas, m.reg.borrados], [[{ id: ID_CAR1, ok: false, error: "no-coincide" }], undefined]);
  m = mundo();
  r = await hacer({ accion: "quitar", correo: "otra@example.org", carpetas: [ID_CAR1], permisos: { [ID_CAR1]: "ph1" } }, m);
  eq("quitar: un acceso heredado de una carpeta madre se avisa (no se puede quitar desde la hija)", r.cuerpo.carpetas, [{ id: ID_CAR1, ok: false, error: "heredado" }]);
  eq("quitar: y no se anota nada en la planilla si no se quitó nada", r.cuerpo.planilla, "no");
  m = mundo();
  r = await hacer({ accion: "quitar", correo: "ya.no@example.org", carpetas: [ID_CAR1], permisos: { [ID_CAR1]: "yaborrado" } }, m);
  eq("quitar: si ya no lo tenía, queda como hecho", r.cuerpo.carpetas, [{ id: ID_CAR1, ok: true, ya: true }]);
  r = await hacer({ accion: "quitar", correo: "valeria@example.org", carpetas: [ID_CAR1] }, m);
  eq("quitar: sin el dato del permiso no se arriesga", r.cuerpo.carpetas, [{ id: ID_CAR1, ok: false, error: "sin-dato" }]);
  r = await hacer({ accion: "quitar", correo: "valeria@example.org", carpetas: ["OtraCarpetaAbCdEfGh"], permisos: {} }, m);
  eq("quitar: una carpeta fuera del catálogo, 400", [r.estado, r.cuerpo], [400, { error: "carpetas" }]);

  // Sacar a todos
  m = mundo();
  r = await hacer({ accion: "sacar-todos", carpeta: ID_CAR1, confirmar: "otro nombre" }, m);
  eq("sacar a todos: sin el nombre exacto de la carpeta no hace nada", [r.estado, r.cuerpo, m.reg.borrados], [400, { error: "confirmar" }, undefined]);
  r = await hacer({ accion: "sacar-todos", carpeta: ID_CAR1, confirmar: "  Brújula Cloud " }, m);
  eq("sacar a todos: quita a los lectores y cuenta a los editores sin tocarlos", r.cuerpo, { quitados: 101, heredados: 0, errores: 0, editores: 2 });
  eq("sacar a todos: no borró al editor, a la dueña, al grupo ni al «cualquiera con el link»", m.reg.borrados.some(k => /\/(q2|q3|q4|q5)$/.test(k)), false);
  r = await hacer({ accion: "sacar-todos", carpeta: "OtraCarpetaAbCdEfGh", confirmar: "x" }, mundo());
  eq("sacar a todos: una carpeta fuera del catálogo, 400", [r.estado, r.cuerpo], [400, { error: "carpetas" }]);

  // Sacar de la lista (23/11/2026): una persona a la que el Script no pudo darle acceso queda con la fila en error y sin
  // nada en Drive; no hay nada que «quitar», pero tiene que poder salir de la lista.
  m = mundo();
  r = await hacer({ accion: "descartar", correo: "Ana@Example.org ", filas: [{ planilla: ID_PLA1, fila: 4 }] }, m);
  eq("descartar: cierra la fila que esperaba (la del error)", [r.estado, r.cuerpo], [200, { filas: [{ planilla: ID_PLA1, fila: 4, estado: "cerrada" }] }]);
  eq("descartar: la fila queda «Enviado» (el Script no la repite), sin el error, de Toldot y con una nota",
     m.reg.hojaFilas[ID_PLA1][2], ["Ana Dos", "ana@example.org", "Chile", "Español", "Enviado", "", "Toldot", "Sacado de la lista desde Toldot (2026-11-23)"]);
  eq("descartar: pide el permiso de escribir y escribe como texto (RAW)", [m.reg.scope, m.reg.entradas.length > 0, m.reg.entradas.every(x => x === "RAW")], [ALCANCE_ESCRITURA, true, true]);
  eq("descartar: la fila no se borra (la planilla sigue con todas sus filas)", m.reg.hojaFilas[ID_PLA1].length, FILAS_1.length);
  m = mundo();
  r = await hacer({ accion: "descartar", correo: "valeria@example.org", filas: [{ planilla: ID_PLA1, fila: 2 }] }, m);
  eq("descartar: una fila que ya dice «Enviado» no se toca", [r.cuerpo.filas[0].estado, m.reg.hojaFilas[ID_PLA1][0].length], ["ya", 5]);
  r = await hacer({ accion: "descartar", correo: "ana@example.org", filas: [{ planilla: ID_PLA1, fila: 3 }] }, m);
  eq("descartar: si la fila ya es de otra persona (la planilla cambió), no se toca", [r.cuerpo.filas[0].estado, m.reg.hojaFilas[ID_PLA1][1][4]], ["fila-cambio", ""]);
  r = await hacer({ accion: "descartar", correo: "ana@example.org", filas: [{ planilla: "OtraPlanillaAbCdEfGh", fila: 4 }, { planilla: ID_PLA1, fila: 1 }, { planilla: ID_PLA1, fila: "x" }, { planilla: ID_PLA1, fila: 99999 }] }, m);
  eq("descartar: una planilla fuera del catálogo o una fila que no es una fila de datos se ignora", r.cuerpo.filas.map(f => f.estado), ["ignorada", "ignorada", "ignorada", "ignorada"]);
  eq("descartar: y no escribió nada en la planilla de la fila 4", m.reg.hojaFilas[ID_PLA1][2].length, 6);
  r = await hacer({ accion: "descartar", correo: "esto no es un correo", filas: [{ planilla: ID_PLA1, fila: 4 }] }, mundo());
  eq("descartar: un correo que no es un correo, 400", [r.estado, r.cuerpo], [400, { error: "correo" }]);
  m = mundo({ admin: false });
  r = await hacer({ accion: "descartar", correo: "ana@example.org", filas: [{ planilla: ID_PLA1, fila: 4 }] }, m);
  eq("descartar: quien no es admin no puede (403) y ni se habla con Google", [r.estado, r.cuerpo, m.reg.tokens], [403, { error: "no-admin" }, 0]);

  // Comprobar una planilla
  const planilla = async (clave, link = `https://docs.google.com/spreadsheets/d/${A}/edit`) => (await hacer({ accion: "comprobar-planilla", link }, mundo({ drive: clave }))).cuerpo;
  eq("planilla: una que Toldot puede leer y escribir", await planilla("hoja"), { caso: "ok", id: A, nombre: "Users" });
  eq("planilla: una que Toldot solo puede mirar, no", await planilla("hojaLectura"), { caso: "sinpermiso" });
  eq("planilla: un documento no es una planilla", await planilla("doc"), { caso: "noplanilla" });
  eq("planilla: algo que no es un link", await planilla("hoja", "mi planilla"), { caso: "link" });
}
eq("planilla: comprobar usa el permiso de solo lectura", await (async () => { const mm = mundo({ drive: "hoja" }); await hacer({ accion: "comprobar-planilla", link: `https://docs.google.com/spreadsheets/d/${A}/edit` }, mm); return mm.reg.scope; })(), ALCANCE_LECTURA);

/* ---------- El mail de bienvenida ---------- */
for(const [l, asunto] of [["es", "Te damos la bienvenida a Brújula"], ["en", "Welcome to Brújula"], ["pt", "Boas-vindas à Brújula"], ["he", "ברוכים הבאים ל-Brújula"]]){
  const c = correoBrujula({ nombre: "Elena <b>Ríos", lang: l, enlace: "https://drive.google.com/drive/folders/" + A });
  eq(`mail (${l}): asunto en su idioma, el nombre sin HTML y el botón a la carpeta`, [c.subject, c.html.includes("<b>Ríos"), c.html.includes("drive.google.com/drive/folders/" + A), /dir="rtl"/.test(c.html)], [asunto, false, true, l === "he"]);
}
eq("mail: un enlace que no es de Drive no se usa (cae en Toldot)", /evil\.example/.test(correoBrujula({ nombre: "E", lang: "es", enlace: "https://evil.example/x" }).html), false);

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
