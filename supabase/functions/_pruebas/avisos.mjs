/* ======================================================================
   La función `avisar` (el correo al admin cuando alguien pide entrar),
   contra una base y un Resend de mentira.
   ====================================================================== */
import { atenderAviso, armarCorreo, APP } from "../_compartido/avisos.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const URL_SB = "https://proyecto.supabase.co";
const entorno = (cambios = {}) => { const e = { SUPABASE_URL: URL_SB, RESEND_API_KEY: "re_de_mentira", ...cambios }; return k => e[k]; };
function mundo({ datos = { para: ["benny@team-latam.com"], nombre: "Ana Pérez", correo: "ana@x.com" }, sesionVencida = false, resendRechaza = [] } = {}){
  const reg = { rpc: [], correos: [] };
  const traer = async (url, op = {}) => {
    const u = String(url);
    if(u.startsWith(`${URL_SB}/rest/v1/rpc/`)){
      reg.rpc.push({ nombre: u.split("/").pop(), auth: op.headers.Authorization });
      if(sesionVencida) return new Response("{}", { status: 401 });
      if(u.endsWith("pedir_aviso_al_admin")) return new Response(JSON.stringify(datos));
      return new Response("true");
    }
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      reg.correos.push({ ...c, llave: op.headers.Authorization });
      return new Response("{}", { status: resendRechaza.includes(c.to[0]) ? 403 : 200 });
    }
    throw new Error("pedido inesperado: " + u);
  };
  return { reg, traer };
}
const pedir = ({ auth = "Bearer sesion-de-ana", metodo = "POST", origen = "https://team-latam.github.io" } = {}) =>
  new Request(`${URL_SB}/functions/v1/avisar`, { method: metodo, headers: { origin: origen, apikey: "sb_publishable_x", ...(auth ? { authorization: auth } : {}) }, body: metodo === "POST" ? "{}" : undefined });
const leer = async r => [r.status, await r.json()];

{
  const m = mundo();
  const r = await leer(await atenderAviso(pedir(), { env: entorno(), fetch: m.traer }));
  eq("corresponde: sale el correo y se anota", [r, m.reg.rpc.map(x => x.nombre)], [[200, { enviado: true }], ["pedir_aviso_al_admin", "aviso_al_admin_enviado"]]);
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
     [r[1].enviado, m.reg.correos.map(c => c.to[0])], [true, ["benny@team-latam.com", "otra.admin@x.com"]]);
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
eq("el correo sin nombre usa la dirección", armarCorreo({ nombre: "", correo: "x@y.com" }).subject, "Nuevo pedido de acceso: x@y.com");

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
