/* ======================================================================
   La función `avisar` (el correo al admin cuando alguien pide entrar),
   contra una base y un Resend de mentira.
   ====================================================================== */
import { atenderAviso, armarCorreo, APP, DESDE, DESDE_DE_PRUEBA } from "../_compartido/avisos.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const URL_SB = "https://proyecto.supabase.co";
const entorno = (cambios = {}) => { const e = { SUPABASE_URL: URL_SB, RESEND_API_KEY: "re_de_mentira", ...cambios }; return k => e[k]; };
function mundo({ datos = { para: ["benny@team-latam.com"], nombre: "Ana Pérez", correo: "ana@x.com" }, sesionVencida = false, resendRechaza = [], dominioSinVerificar = false, otros = {} } = {}){
  const reg = { rpc: [], correos: [], cuerpos: [] };
  const traer = async (url, op = {}) => {
    const u = String(url);
    if(u.startsWith(`${URL_SB}/rest/v1/rpc/`)){
      reg.rpc.push({ nombre: u.split("/").pop(), auth: op.headers.Authorization });
      reg.cuerpos.push(JSON.parse(op.body || "{}"));
      if(sesionVencida) return new Response("{}", { status: 401 });
      if(otros[u.split("/").pop()] !== undefined) return new Response(JSON.stringify(otros[u.split("/").pop()]));
      if(u.endsWith("pedir_aviso_al_admin")) return new Response(JSON.stringify(datos));
      return new Response("true");
    }
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      reg.correos.push({ ...c, llave: op.headers.Authorization });
      if(dominioSinVerificar && !c.from.includes("resend.dev")) return new Response('{"message":"The team-latam.com domain is not verified"}', { status: 403 });
      return new Response("{}", { status: resendRechaza.includes(c.to[0]) ? 403 : 200 });
    }
    throw new Error("pedido inesperado: " + u);
  };
  return { reg, traer };
}
const pedir = ({ auth = "Bearer sesion-de-ana", metodo = "POST", origen = "https://team-latam.github.io", cuerpo = {} } = {}) =>
  new Request(`${URL_SB}/functions/v1/avisar`, { method: metodo, headers: { origin: origen, apikey: "sb_publishable_x", ...(auth ? { authorization: auth } : {}) }, body: metodo === "POST" ? JSON.stringify(cuerpo) : undefined });
const leer = async r => [r.status, await r.json()];

{
  const m = mundo();
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer }));
  eq("corresponde: sale el correo y se anota", [r, m.reg.rpc.map(x => x.nombre)], [[200, { enviado: true, enviados: 1 }], ["pedir_aviso_al_admin", "aviso_al_admin_enviado"]]);
  eq("a la base le pregunta con la sesión de quien pidió entrar", m.reg.rpc[0].auth, "Bearer sesion-de-ana");
  const c = m.reg.correos[0];
  eq("el correo: al admin, con la llave de Resend, con el nombre en el asunto y el enlace a la app",
     [c.to, c.llave, c.subject, c.html.includes(APP), c.text.includes("ana@x.com")], [["benny@team-latam.com"], "Bearer re_de_mentira", "Nuevo pedido de acceso: Ana Pérez", true, true]);
}
{
  const m = mundo({ datos: { para: ["benny@team-latam.com"], nombre: '<img src=x onerror=alert(1)>', correo: "malo@x.com" } });
  await atenderAviso(pedir(), { env: entorno(), fetch: m.traer });
  eq("un nombre con HTML llega escapado (no es código en el correo del admin)", /<img/.test(m.reg.correos[0].html), false);
}
{
  const m = mundo({ datos: null });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer }));
  eq("si la base dice que no corresponde (ya avisado, o hace menos de una hora), no sale nada",
     [r, m.reg.correos.length, m.reg.rpc.length], [[200, { enviado: false, motivo: "no-corresponde" }], 0, 1]);
}
{
  const m = mundo({ datos: { para: ["benny@team-latam.com", "otra.admin@x.com"], nombre: "Ana", correo: "ana@x.com" }, resendRechaza: ["otra.admin@x.com"] });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer }));
  eq("de a uno: si Resend no le manda a uno, el otro recibe igual y cuenta como avisado",
     [r[1].enviado, m.reg.correos.map(c => c.to[0])], [true, ["benny@team-latam.com", "otra.admin@x.com", "otra.admin@x.com"]]); // el rechazado se reintenta una vez con la dirección de prueba
}
{
  const m = mundo({ resendRechaza: ["benny@team-latam.com"] });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer }));
  eq("si no salió ninguno, NO se anota (la pantalla no muestra un ✓ falso)",
     [r[0], m.reg.rpc.map(x => x.nombre)], [502, ["pedir_aviso_al_admin"]]);
}
{
  const m = mundo();
  eq("sin sesión, nada", [await leer(await atenderAviso(pedir({ auth: null }), { env: entorno(), fetch: m.traer })), m.reg.rpc.length], [[401, { error: "sin-sesion" }], 0]);
  const v = mundo({ sesionVencida: true });
  eq("con una sesión que la base no acepta, tampoco", (await atenderAviso(pedir(), { env: entorno(), fetch: v.traer })).status, 401);
  eq("sin la llave de Resend todavía, lo dice", await leer(await atenderAviso(pedir(), { env: entorno({ RESEND_API_KEY: undefined }), fetch: m.traer })), [503, { error: "sin-configurar" }]);
  const o = await atenderAviso(pedir({ metodo: "OPTIONS" }), { env: entorno(), fetch: m.traer });
  eq("la app lo puede llamar (CORS), otra página no",
     [o.status, o.headers.get("access-control-allow-origin"), (await atenderAviso(pedir({ metodo: "OPTIONS", origen: "https://otro.io" }), { env: entorno(), fetch: m.traer })).headers.get("access-control-allow-origin")],
     [204, "https://team-latam.github.io", null]);
}
{
  const m = mundo();
  await atenderAviso(pedir(), { env: entorno(), fetch: m.traer });
  eq("sale de info@team-latam.com, y las respuestas van al admin",
     [m.reg.correos[0].from, m.reg.correos[0].reply_to], ["Registro de Acciones <info@team-latam.com>", "benny@team-latam.com"]);
  const v = mundo({ dominioSinVerificar: true });
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: v.traer }));
  eq("con el dominio todavía sin verificar, sale igual desde la dirección de prueba de Resend",
     [r[1].enviado, v.reg.correos.map(c => c.from)], [true, [DESDE, DESDE_DE_PRUEBA]]);
}
/* ---------- Menciones y respuestas, al momento ---------- */
{
  const aviso = { para: [{ email: "benny@team-latam.com", motivo: "menciones", nombre: "Benny" }, { email: "juan@x.com", motivo: "respuestas", nombre: "Juan" }],
                  autor: "Ana Pérez", titulo: "Visita a Rosario", tipo: "visita", texto: "Hola @benny, ¿mandás el plan? <b>", post: "p1", en: "respuesta" };
  const m = mundo({ otros: { preparar_aviso: aviso } });
  const r = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "respuesta", id: "r9" } }), { env: entorno(), fetch: m.traer }));
  eq("un comentario: le pregunta a la base por ESE comentario", [m.reg.rpc[0].nombre, m.reg.cuerpos[0]], ["preparar_aviso", { p_tipo: "respuesta", p_id: "r9" }]);
  eq("y le escribe a cada uno, con su motivo", [r, m.reg.correos.map(c => [c.to[0], c.subject])],
     [[200, { enviado: true, enviados: 2 }], [["benny@team-latam.com", "Ana Pérez te mencionó en «Visita a Rosario»"], ["juan@x.com", "Ana Pérez comentó en «Visita a Rosario»"]]]);
  const html = m.reg.correos[0].html;
  eq("el enlace lleva al posteo y al comentario, la mención resaltada y el texto escapado",
     [html.includes("?post=p1&amp;r=r9") || html.includes("?post=p1&r=r9"), /color:#1a9fb8;font-weight:700;">@benny</.test(html), html.includes("plan? <b>"), html.includes("plan? &lt;b&gt;")], [true, true, false, true]);
  eq("no se anota nada del pedido de acceso", m.reg.rpc.map(x => x.nombre), ["preparar_aviso"]);
}
{
  const m = mundo({ otros: { preparar_prueba: { para: [{ email: "benny@team-latam.com", nombre: "Benny Rosenthal" }] } } });
  const r = await leer(await atenderAviso(pedir({ cuerpo: { tipo: "prueba" } }), { env: entorno(), fetch: m.traer }));
  eq("el correo de prueba, a quien lo pidió", [r[1].enviado, m.reg.correos[0].to, m.reg.correos[0].subject], [true, ["benny@team-latam.com"], "Así se ven los avisos del Registro"]);
  const n = mundo();
  eq("un tipo que no existe, no", await leer(await atenderAviso(pedir({ cuerpo: { tipo: "spam" } }), { env: entorno(), fetch: n.traer })), [400, { error: "pedido" }]);
}
eq("el correo sin nombre usa la dirección", armarCorreo({ nombre: "", correo: "x@y.com" }).subject, "Nuevo pedido de acceso: x@y.com");

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
