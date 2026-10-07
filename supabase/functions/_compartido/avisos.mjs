/* ======================================================================
   Los avisos por correo: la función `avisar` de Supabase
   ======================================================================
   El pedido de acceso al administrador (I10), las menciones y respuestas
   al momento, y el correo de prueba (17-avisos-por-correo.sql). La llama
   la app de quien hizo algo (pidió entrar, publicó), con SU sesión. Quién recibe el correo y si corresponde
   mandarlo NO lo decide esta función: se lo pregunta a la base
   (pedir_aviso_al_admin(), 16-aviso-al-admin.sql), que da uno por pedido
   y un intento por hora. Así nadie puede usar esto para llenarle la
   casilla al admin. El correo sale por Resend (3.000 por mes gratis), y si
   salió se anota (aviso_al_admin_enviado()): eso es lo que muestra el ✓
   en la pantalla de espera.
   ====================================================================== */
import { encabezados } from "./web.mjs";
import { correoPedido, correoAviso, correoPrueba } from "./correos.mjs";
export { APP } from "./correos.mjs";

// El remitente: info@team-latam.com (pedido del usuario el 7/10/2026),
// con el dominio verificado en Resend (registros en Squarespace,
// docs/QUE-GUARDAR.md). Si Resend todavía no lo acepta —la verificación
// tarda, o un día se cae— el aviso sale igual desde la dirección de
// prueba de Resend, que solo entrega a la cuenta de Resend: mejor eso que
// ningún aviso. Las respuestas van al admin: info@ no es una casilla.
export const DESDE = "Registro de Acciones <info@team-latam.com>";
export const DESDE_DE_PRUEBA = "Registro de Acciones <onboarding@resend.dev>";
export const RESPONDER_A = "benny@team-latam.com";

// Lo que arma cada tipo de aviso. El cuerpo del pedido dice cuál:
//   (nada) o {tipo:"pedido"}              el pedido de acceso de quien llama
//   {tipo:"posteo"|"respuesta", id}       menciones y respuestas, al momento
//   {tipo:"prueba"}                       «Mandarme un correo de prueba»
// A quién y si corresponde lo decide SIEMPRE la base (16 y 17-*.sql).
export const armarCorreo = correoPedido;
const TIPOS = {
  pedido:    { rpc: "pedir_aviso_al_admin", cuerpo: () => ({}), para: d => d.para, correo: d => correoPedido(d), anotar: "aviso_al_admin_enviado" },
  posteo:    { rpc: "preparar_aviso", cuerpo: p => ({ p_tipo: "posteo", p_id: String(p.id || "") }), para: d => d.para.map(x => x.email), correo: (d, para) => correoAviso({ ...d, id: d.id, motivo: d.para.find(x => x.email === para).motivo }) },
  respuesta: { rpc: "preparar_aviso", cuerpo: p => ({ p_tipo: "respuesta", p_id: String(p.id || "") }), para: d => d.para.map(x => x.email), correo: (d, para) => correoAviso({ ...d, motivo: d.para.find(x => x.email === para).motivo }) },
  prueba:    { rpc: "preparar_prueba", cuerpo: () => ({}), para: d => d.para.map(x => x.email), correo: d => correoPrueba({ nombre: d.para[0].nombre }) },
};

export async function atenderAviso(req, { env, fetch: traer = fetch } = {}){
  const h = encabezados(req.headers.get("origin"));
  const responder = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: h });
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if(req.method !== "POST") return responder({ error: "metodo" }, 405);

  const autorizacion = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if(!/^Bearer \S+$/.test(autorizacion) || !apikey) return responder({ error: "sin-sesion" }, 401);
  const url = env("SUPABASE_URL"), llave = env("RESEND_API_KEY");
  if(!url || !llave) return responder({ error: "sin-configurar" }, 503);

  let pedido = {};
  try{ pedido = await req.json(); }catch(e){ /* sin cuerpo = el pedido de acceso */ }
  const tipo = TIPOS[(pedido && pedido.tipo) || "pedido"];
  if(!tipo) return responder({ error: "pedido" }, 400);

  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  const rpc = (nombre, cuerpo = {}) => traer(`${url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: conSesion, body: JSON.stringify(cuerpo) });

  let datos;
  try{
    const r = await rpc(tipo.rpc, tipo.cuerpo(pedido));
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    if(!r.ok) return responder({ error: "base" }, 502);
    datos = await r.json();
  }catch(e){ return responder({ error: "base" }, 502); }
  if(!datos || !Array.isArray(datos.para) || !datos.para.length) return responder({ enviado: false, motivo: "no-corresponde" });
  if(tipo === TIPOS.respuesta) datos.id = String(pedido.id);

  const mandar = (from, para, correo) => traer("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], reply_to: env("AVISOS_RESPONDER_A") || RESPONDER_A, ...correo }),
  });
  let enviados = 0;
  // De a uno: si Resend no le puede mandar a uno, los demás reciben igual.
  for(const para of tipo.para(datos)){
    const correo = tipo.correo(datos, para);
    try{
      let r = await mandar(env("AVISOS_DESDE") || DESDE, para, correo);
      // 403 = Resend no acepta ese remitente (dominio sin verificar): se
      // prueba con el de prueba.
      if(r.status === 403) r = await mandar(DESDE_DE_PRUEBA, para, correo);
      if(r.ok) enviados++;
      else console.error(`Resend no mandó un aviso (${r.status})`);
    }catch(e){ console.error("Resend no contestó:", e.message); }
  }
  if(!enviados) return responder({ enviado: false, motivo: "resend" }, 502);
  if(tipo.anotar){ try{ await rpc(tipo.anotar); }catch(e){ /* el correo ya salió */ } }
  return responder({ enviado: true, enviados });
}
