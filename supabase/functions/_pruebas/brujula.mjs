/* ======================================================================
   La función `brujula` (supabase/functions/_compartido/brujula.mjs): leer Drive y
   las planillas con la cuenta de servicio, solo para un admin, solo lo del
   catálogo y solo leyendo. Todo contra un Google y un Supabase de mentira, con
   gente inventada (@example.org) y una llave RSA armada en el momento.
   ====================================================================== */
import { generateKeyPairSync } from "node:crypto";
import { idDeLink, comprobarLink, combinar, leerTodo, atender, ALCANCE_LECTURA } from "../_compartido/brujula.mjs";
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
};
const DESTINOS = { DestinoRealAbCdEfG: { id: "DestinoRealAbCdEfG", name: "Hadraja · Enseñanza", mimeType: "application/vnd.google-apps.folder", capabilities: { canShare: true } } };

function mundo({ admin = true, rpc = null, drive = null, tokenNiega = false } = {}){
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
    // Todo lo que sigue es de Google: tiene que llevar el permiso.
    reg.google.push(u);
    if(op.headers?.Authorization !== "Bearer permiso-" + reg.tokens) return new Response("{}", { status: 401 });
    let m;
    if((m = /\/drive\/v3\/files\/([^/?]+)\/permissions\?(.*)$/.exec(u))){
      const id = decodeURIComponent(m[1]), q = new URLSearchParams(m[2]);
      reg.drive.push(id);
      const paginas = PERMISOS[id];
      if(!paginas) return new Response(JSON.stringify({ error: { message: "File not found" } }), { status: 404 });
      const n = q.get("pageToken") ? 2 : 1;
      const p = paginas.find(x => x.pagina === n);
      return new Response(JSON.stringify({ permissions: p.permisos, ...(p.siguiente ? { nextPageToken: p.siguiente } : {}) }));
    }
    if((m = /\/drive\/v3\/files\/([^/?]+)\?/.exec(u))){
      const id = decodeURIComponent(m[1]);
      reg.drive.push(id);
      if(drive === 500) return new Response("{}", { status: 500 });
      if(DESTINOS[id]) return new Response(JSON.stringify(DESTINOS[id]));
      if(drive && drive !== "oculto" && id === A) return new Response(JSON.stringify(DRIVE[drive]));
      return new Response(JSON.stringify({ error: { message: "File not found" } }), { status: 404 });
    }
    if((m = /\/spreadsheets\/([^/]+)\/values\//.exec(u))){
      const id = decodeURIComponent(m[1]);
      reg.hojas = (reg.hojas || []).concat(id);
      if(id === ID_PLA1) return new Response(JSON.stringify({ values: FILAS_1 }));
      if(id === ID_PLA2) return new Response(JSON.stringify({ values: FILAS_2 }));
      return new Response("{}", { status: 404 });
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

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
