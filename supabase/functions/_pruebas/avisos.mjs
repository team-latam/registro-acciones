/* ======================================================================
   La función `avisar` (el correo al admin cuando alguien pide entrar),
   contra una base y un Resend de mentira.
   ====================================================================== */
import { atenderAviso, armarCorreo, APP, DESDE, DESDE_DE_PRUEBA } from "../_compartido/avisos.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const URL_SB = "https://proyecto.supabase.co";
const entorno = (cambios = {}) => { const e = { SUPABASE_URL: URL_SB, RESEND_API_KEY: "re_de_mentira", LLAVE_DE_SERVICIO: "llave-de-servicio", ...cambios }; return k => e[k]; };
// La base de mentira: las funciones que llama la sesión de la persona
// contestan un turno (o null); lo que hay que mandar lo da tomar_aviso,
// solo con la llave de servicio.
function mundo({ datos = { para: ["benny@team-latam.com"], nombre: "Ana Pérez", correo: "ana@x.com" }, sesionVencida = false, resendRechaza = [], resendSatura = [], dominioSinVerificar = false, otros = {} } = {}){
  const reg = { rpc: [], correos: [], cuerpos: [], desmarcados: [], pausas: [] };
  let guardado = null;
  const traer = async (url, op = {}) => {
    const u = String(url);
    if(u.startsWith(`${URL_SB}/rest/v1/rpc/`)){
      const nombre = u.split("/").pop();
      reg.rpc.push({ nombre, auth: op.headers.Authorization });
      reg.cuerpos.push(JSON.parse(op.body || "{}"));
      if(nombre === "tomar_aviso"){
        if(op.headers.Authorization !== "Bearer llave-de-servicio") return new Response('{"message":"permission denied"}', { status: 403 });
        const d = guardado; guardado = null; return new Response(JSON.stringify(d));
      }
      if(sesionVencida) return new Response("{}", { status: 401 });
      const d = otros[nombre] !== undefined ? otros[nombre] : nombre === "pedir_aviso_al_admin" ? datos : undefined;
      if(d !== undefined){ guardado = d; return new Response(JSON.stringify(d ? { ticket: "turno-1" } : null)); }
      return new Response("true");
    }
    if(u.startsWith(`${URL_SB}/rest/v1/avisos_enviados?`) && op.method === "DELETE"){
      reg.desmarcados.push(Object.fromEntries(new URL(u).searchParams)); return new Response("", { status: 204 });
    }
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      reg.correos.push({ ...c, llave: op.headers.Authorization });
      if(dominioSinVerificar && !c.from.includes("resend.dev")) return new Response('{"message":"The team-latam.com domain is not verified"}', { status: 403 });
      if(resendSatura.includes(c.to[0]) && !reg.correos.slice(0, -1).some(x => x.to[0] === c.to[0])) return new Response("{}", { status: 429 });
      return new Response("{}", { status: resendRechaza.includes(c.to[0]) ? 403 : 200 });
    }
    throw new Error("pedido inesperado: " + u);
  };
  const esperar = async ms => { reg.pausas.push(ms); };
  return { reg, traer, esperar };
}
const pedir = ({ auth = "Bearer sesion-de-ana", metodo = "POST", origen = "https://team-latam.github.io", cuerpo = {} } = {}) =>
  new Request(`${URL_SB}/functions/v1/avisar`, { method: metodo, headers: { origin: origen, apikey: "sb_publishable_x", ...(auth ? { authorization: auth } : {}) }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
const leer = async r => [r.status, await r.json()];

{
  const m = mundo();
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("corresponde: sale el correo y se anota", [r, m.reg.rpc.map(x => x.nombre)], [[200, { enviado: true, enviados: 1 }], ["pedir_aviso_al_admin", "tomar_aviso", "aviso_al_admin_enviado"]]);
  eq("a la base le pregunta con la sesión de quien pidió entrar; lo que hay que mandar lo lee con la llave de servicio, por su turno",
     [m.reg.rpc[0].auth, m.reg.rpc[1].auth, m.reg.cuerpos[1]], ["Bearer sesion-de-ana", "Bearer llave-de-servicio", { p_ticket: "turno-1" }]);
  const c = m.reg.correos[0];
  eq("el correo: al admin, con la llave de Resend, con el nombre en el asunto y el enlace a la app",
     [c.to, c.llave, c.subject, c.html.includes(APP), c.text.includes("ana@x.com")], [["benny@team-latam.com"], "Bearer re_de_mentira", "Nuevo pedido de acceso: Ana Pérez", true, true]);
}
{
  const m = mundo({ datos: { para: ["benny@team-latam.com"], nombre: '<img src=x onerror=alert(1)>', correo: "malo@x.com" } });
  await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar });
  eq("un nombre con HTML llega escapado (no es código en el correo del admin)", /<img/.test(m.reg.correos[0].html), false);
}
{
  const m = mundo({ datos: null });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("si la base dice que no corresponde (ya avisado, o hace menos de una hora), no sale nada (ni se pide nada con la llave)",
     [r, m.reg.correos.length, m.reg.rpc.length], [[200, { enviado: false, motivo: "no-corresponde" }], 0, 1]);
}
{
  const m = mundo({ datos: { para: ["benny@team-latam.com", "otra.admin@x.com"], nombre: "Ana", correo: "ana@x.com" }, resendRechaza: ["otra.admin@x.com"] });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("de a uno: si Resend no le manda a uno, el otro recibe igual y cuenta como avisado",
     [r[1].enviado, m.reg.correos.map(c => c.to[0])], [true, ["benny@team-latam.com", "otra.admin@x.com", "otra.admin@x.com"]]); // el rechazado se reintenta una vez con la dirección de prueba
}
{
  const m = mundo({ resendRechaza: ["benny@team-latam.com"] });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("si no salió ninguno, NO se anota (la pantalla no muestra un ✓ falso)",
     [r[0], m.reg.rpc.map(x => x.nombre)], [502, ["pedir_aviso_al_admin", "tomar_aviso"]]);
}
{
  const m = mundo();
  eq("sin sesión, nada", [await leer(await atenderAviso(pedir({ auth: null }), { env: entorno(), fetch: m.traer, esperar: m.esperar })), m.reg.rpc.length], [[401, { error: "sin-sesion" }], 0]);
  const v = mundo({ sesionVencida: true });
  eq("con una sesión que la base no acepta, tampoco", (await atenderAviso(pedir(), { env: entorno(), fetch: v.traer, esperar: v.esperar })).status, 401);
  eq("sin la llave de Resend todavía, lo dice", await leer(await atenderAviso(pedir(), { env: entorno({ RESEND_API_KEY: undefined }), fetch: m.traer })), [503, { error: "sin-configurar" }]);
  eq("sin la llave de servicio (ni la cargada ni la de Supabase), también",
     await leer(await atenderAviso(pedir(), { env: entorno({ LLAVE_DE_SERVICIO: undefined }), fetch: m.traer })), [503, { error: "sin-configurar" }]);
  const s = mundo();
  await atenderAviso(pedir(), { env: entorno({ LLAVE_DE_SERVICIO: undefined, SUPABASE_SERVICE_ROLE_KEY: "llave-de-servicio" }), fetch: s.traer, esperar: s.esperar });
  eq("si no se cargó la propia, usa la que Supabase da sola", s.reg.correos.length, 1);
  const o = await atenderAviso(pedir({ metodo: "OPTIONS" }), { env: entorno(), fetch: m.traer, esperar: m.esperar });
  eq("la app lo puede llamar (CORS), otra página no",
     [o.status, o.headers.get("access-control-allow-origin"), (await atenderAviso(pedir({ metodo: "OPTIONS", origen: "https://otro.io" }), { env: entorno(), fetch: m.traer, esperar: m.esperar })).headers.get("access-control-allow-origin")],
     [204, "https://team-latam.github.io", null]);
}
{
  const m = mundo();
  await atenderAviso(pedir(), { env: entorno(), fetch: m.traer, esperar: m.esperar });
  eq("sale de info@team-latam.com, y las respuestas van al admin",
     [m.reg.correos[0].from, m.reg.correos[0].reply_to], ["Registro de Acciones <info@team-latam.com>", "benny@team-latam.com"]);
  const v = mundo({ dominioSinVerificar: true });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: v.traer, esperar: v.esperar }));
  eq("con el dominio todavía sin verificar, sale igual desde la dirección de prueba de Resend",
     [r[1].enviado, v.reg.correos.map(c => c.from)], [true, [DESDE, DESDE_DE_PRUEBA]]);
}
/* ---------- Menciones y respuestas, al momento ---------- */
{
  const aviso = { para: [{ email: "benny@team-latam.com", motivo: "menciones", nombre: "Benny" }, { email: "juan@x.com", motivo: "respuestas", nombre: "Juan" }],
                  autor: "Ana Pérez", titulo: "Visita a Rosario", tipo: "visita", texto: "Hola @benny, ¿mandás el plan? <b>", post: "p1", en: "respuesta" };
  const m = mundo({ otros: { preparar_aviso: aviso } });
  const r = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "respuesta", id: "r9" } }), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("un comentario: le pregunta a la base por ESE comentario", [m.reg.rpc[0].nombre, m.reg.cuerpos[0]], ["preparar_aviso", { p_tipo: "respuesta", p_id: "r9" }]);
  eq("entre un correo y otro, una pausa (Resend atiende 2 por segundo)", m.reg.pausas, [600]);
  eq("y le escribe a cada uno, con su motivo", [r, m.reg.correos.map(c => [c.to[0], c.subject])],
     [[200, { enviado: true, enviados: 2 }], [["benny@team-latam.com", "Ana Pérez te mencionó en «Visita a Rosario»"], ["juan@x.com", "Ana Pérez comentó en «Visita a Rosario»"]]]);
  const html = m.reg.correos[0].html;
  eq("el enlace lleva al posteo y al comentario, la mención resaltada y el texto escapado",
     [html.includes("?post=p1&amp;r=r9") || html.includes("?post=p1&r=r9"), /color:#1a9fb8;font-weight:700;">@benny</.test(html), html.includes("plan? <b>"), html.includes("plan? &lt;b&gt;")], [true, true, false, true]);
  eq("no se anota nada del pedido de acceso", m.reg.rpc.map(x => x.nombre), ["preparar_aviso", "tomar_aviso"]);
}
{
  const m = mundo({ otros: { preparar_prueba: { para: [{ email: "benny@team-latam.com", nombre: "Benny Rosenthal" }] } } });
  const r = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "prueba" } }), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("el correo de prueba, a quien lo pidió", [r[1].enviado, m.reg.correos[0].to, m.reg.correos[0].subject], [true, ["benny@team-latam.com"], "Así se ven los avisos del Registro"]);
  const n = mundo();
  eq("un tipo que no existe, no", await leer(await atenderAviso(pedir({ cuerpo: { tipo: "spam" } }), { env: entorno(), fetch: n.traer, esperar: n.esperar })), [400, { error: "pedido" }]);
}
eq("el correo sin nombre usa la dirección", armarCorreo({ nombre: "", correo: "x@y.com" }).subject, "Nuevo pedido de acceso: x@y.com");
/* ---------- Lo de la auditoría del 7/10/2026 ---------- */
{
  const aviso = { para: [{ email: "benny@team-latam.com", motivo: "menciones", nombre: "Benny" }, { email: "juan@x.com", motivo: "menciones", nombre: "Juan" }],
                  autor: "Ana", titulo: "Visita", tipo: "visita", texto: "@benny @juan", post: "p1", en: "posteo", id: "p1" };
  const m = mundo({ otros: { preparar_aviso: aviso }, resendRechaza: ["juan@x.com"] });
  const r = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "posteo", id: "p1" } }), { env: entorno(), fetch: m.traer, esperar: m.esperar }));
  eq("si a uno no le sale, se borra su marca de «enviado» (le llega en el resumen); al otro le llega igual",
     [r[1].enviados, m.reg.desmarcados], [1, [{ tipo: "eq.posteo", objeto: "eq.p1", email: "eq.juan@x.com" }]]);
  const z = mundo({ otros: { preparar_aviso: aviso }, resendSatura: ["benny@team-latam.com"] });
  const rz = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "posteo", id: "p1" } }), { env: entorno(), fetch: z.traer, esperar: z.esperar }));
  eq("si Resend dice «demasiados» (429), espera y lo reintenta una vez", [rz[1].enviados, z.reg.correos.map(c => c.to[0]), z.reg.pausas], [2, ["benny@team-latam.com", "benny@team-latam.com", "juan@x.com"], [1500, 600]]);
  const c = armarCorreo({ nombre: "Juan\r\nBcc: otro@x.com", correo: "juan@x.com" });
  eq("un nombre con saltos de línea no parte el asunto en dos encabezados", /[\r\n]/.test(c.subject), false);
}

/* ---------- Cada uno en su idioma (decisión del usuario del 7/10/2026) ---------- */
{
  const aviso = { para: [{ email: "benny@team-latam.com", motivo: "menciones", nombre: "Benny", lang: "es" }, { email: "moshe@x.com", motivo: "menciones", nombre: "Moshe", lang: "he" }],
                  autor: "Ana", titulo: "Visita", tipo: "visita", texto: "@benny @moshe", post: "p1", en: "posteo", id: "p1" };
  const m = mundo({ otros: { preparar_aviso: aviso } });
  await atenderAviso(pedir({ cuerpo: { tipo: "posteo", id: "p1" } }), { env: entorno(), fetch: m.traer, esperar: m.esperar });
  eq("una mención: a cada uno en su idioma (y en hebreo, de derecha a izquierda)",
     m.reg.correos.map(c => [c.to[0], c.subject, /dir="rtl"/.test(c.html)]),
     [["benny@team-latam.com", "Ana te mencionó en «Visita»", false], ["moshe@x.com", "Ana הזכיר/ה אותך ב«Visita»", true]]);
  const p = mundo({ datos: { para: ["benny@team-latam.com", "otra.admin@x.com"], nombre: "Nuevo", correo: "nuevo@x.com", pedido_el: "2026-10-07T12:00:00Z",
    idiomas: { "benny@team-latam.com": "es", "otra.admin@x.com": "pt" }, zonas: { "otra.admin@x.com": "Asia/Jerusalem" } } });
  await atenderAviso(pedir(), { env: entorno(), fetch: p.traer, esperar: p.esperar });
  eq("el pedido de acceso, a cada admin en su idioma y con la hora en su zona",
     [p.reg.correos.map(c => c.subject), p.reg.correos[0].html.includes("09:00"), p.reg.correos[1].html.includes("15:00")],
     [["Nuevo pedido de acceso: Nuevo", "Novo pedido de acesso: Nuevo"], true, true]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
