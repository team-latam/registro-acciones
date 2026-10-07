/* ======================================================================
   Los avisos por correo: la función `avisar` de Supabase
   ======================================================================
   El pedido de acceso al administrador (I10), las menciones y respuestas
   al momento, y el correo de prueba (17-avisos-por-correo.sql). La llama
   la app de quien hizo algo (pidió entrar, publicó), con SU sesión. Quién
   recibe el correo y si corresponde mandarlo NO lo decide esta función:
   se lo pregunta a la base con esa sesión (pedir_aviso_al_admin(),
   preparar_aviso(), preparar_prueba()), que controla quién es, que sea
   lo suyo, un intento por vez y los topes. La base guarda lo que hay que
   mandar y le contesta solo un número de turno; con ese turno, esta
   función lo lee con la llave de servicio (tomar_aviso()). Así quien
   llama a la base directo no ve a quién le llegan los avisos (hasta el
   7/10/2026 veía los correos de los admins).
   El correo sale por Resend (3.000 por mes gratis). Si a alguien no le
   sale, su marca de «enviado» se borra: lo recibe en su resumen
   (supabase/avisos/resumen.mjs). El pedido de acceso que salió se anota
   (aviso_al_admin_enviado()): eso es lo que muestra el ✓ en la pantalla
   de espera.
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

// Resend atiende hasta 2 pedidos por segundo: entre uno y otro, una pausa;
// y si contesta 429 (demasiados), se espera y se reintenta una vez.
export const PAUSA_MS = 600;
const dormir = ms => new Promise(r => setTimeout(r, ms));

export async function atenderAviso(req, { env, fetch: traer = fetch, esperar = dormir } = {}){
  const h = encabezados(req.headers.get("origin"));
  const responder = (datos, estado = 200) => new Response(JSON.stringify(datos), { status: estado, headers: h });
  if(req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if(req.method !== "POST") return responder({ error: "metodo" }, 405);

  const autorizacion = req.headers.get("authorization") || "";
  const apikey = req.headers.get("apikey") || "";
  if(!/^Bearer \S+$/.test(autorizacion) || !apikey) return responder({ error: "sin-sesion" }, 401);
  const url = env("SUPABASE_URL"), llave = env("RESEND_API_KEY");
  // La llave de servicio: la que carga funciones.yml (la misma de las
  // copias y los resúmenes) o, si no está, la que Supabase da sola.
  const servicio = env("LLAVE_DE_SERVICIO") || env("SUPABASE_SERVICE_ROLE_KEY");
  if(!url || !llave || !servicio) return responder({ error: "sin-configurar" }, 503);

  let pedido = {};
  try{ pedido = await req.json(); }catch(e){ /* sin cuerpo = el pedido de acceso */ }
  const tipo = TIPOS[(pedido && pedido.tipo) || "pedido"];
  if(!tipo) return responder({ error: "pedido" }, 400);

  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  const conLlave = { apikey: servicio, Authorization: `Bearer ${servicio}`, "Content-Type": "application/json" };
  const rpc = (nombre, cuerpo = {}, headers = conSesion) => traer(`${url}/rest/v1/rpc/${nombre}`, { method: "POST", headers, body: JSON.stringify(cuerpo) });

  let datos;
  try{
    // 1. Con la sesión de quien llama: ¿corresponde? La base contesta un turno.
    const r = await rpc(tipo.rpc, tipo.cuerpo(pedido));
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    if(!r.ok) return responder({ error: "base" }, 502);
    const turno = await r.json();
    if(!turno || typeof turno.ticket !== "string") return responder({ enviado: false, motivo: "no-corresponde" });
    // 2. Con la llave de servicio: qué mandar y a quién.
    const t = await rpc("tomar_aviso", { p_ticket: turno.ticket }, conLlave);
    if(!t.ok) return responder({ error: "base" }, 502);
    datos = await t.json();
  }catch(e){ return responder({ error: "base" }, 502); }
  if(!datos || !Array.isArray(datos.para) || !datos.para.length) return responder({ enviado: false, motivo: "no-corresponde" });
  if(tipo === TIPOS.respuesta && !datos.id) datos.id = String(pedido.id);

  const mandar = (from, para, correo) => traer("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], reply_to: env("AVISOS_RESPONDER_A") || RESPONDER_A, ...correo }),
  });
  // Si a alguien no le salió, se borra su marca de «enviado»: así lo
  // recibe en su resumen en vez de perderse (hasta el 7/10/2026 la marca
  // quedaba y el aviso no llegaba nunca).
  const desmarcar = para => (tipo === TIPOS.posteo || tipo === TIPOS.respuesta)
    ? traer(`${url}/rest/v1/avisos_enviados?${new URLSearchParams({ tipo: `eq.${pedido.tipo}`, objeto: `eq.${String(pedido.id)}`, email: `eq.${para}` })}`,
        { method: "DELETE", headers: conLlave }).catch(() => {})
    : null;
  let enviados = 0, primero = true;
  // De a uno: si Resend no le puede mandar a uno, los demás reciben igual.
  for(const para of tipo.para(datos)){
    const correo = tipo.correo(datos, para);
    if(!primero) await esperar(PAUSA_MS);
    primero = false;
    let ok = false;
    try{
      const desde = env("AVISOS_DESDE") || DESDE;
      let r = await mandar(desde, para, correo);
      if(r.status === 429){ await esperar(1500); r = await mandar(desde, para, correo); }
      // 403 = Resend no acepta ese remitente (dominio sin verificar): se
      // prueba con el de prueba.
      if(r.status === 403) r = await mandar(DESDE_DE_PRUEBA, para, correo);
      ok = r.ok;
      if(!ok) console.error(`Resend no mandó un aviso (${r.status})`);
    }catch(e){ console.error("Resend no contestó:", e.message); }
    if(ok) enviados++; else await desmarcar(para);
  }
  if(!enviados) return responder({ enviado: false, motivo: "resend" }, 502);
  if(tipo.anotar){ try{ await rpc(tipo.anotar); }catch(e){ /* el correo ya salió */ } }
  return responder({ enviado: true, enviados });
}
