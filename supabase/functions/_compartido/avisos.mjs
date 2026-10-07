/* ======================================================================
   El aviso al administrador cuando alguien pide entrar (I10)
   ======================================================================
   La función `avisar` de Supabase. La llama la app de quien acaba de
   pedir acceso, con SU sesión. Quién recibe el correo y si corresponde
   mandarlo NO lo decide esta función: se lo pregunta a la base
   (pedir_aviso_al_admin(), 16-aviso-al-admin.sql), que da uno por pedido
   y un intento por hora. Así nadie puede usar esto para llenarle la
   casilla al admin. El correo sale por Resend (3.000 por mes gratis), y si
   salió se anota (aviso_al_admin_enviado()): eso es lo que muestra el ✓
   en la pantalla de espera.
   ====================================================================== */
import { encabezados } from "./web.mjs";

export const APP = "https://team-latam.github.io/registro-acciones/";
// Sin un dominio propio verificado en Resend, el remitente de prueba de
// Resend; y en ese modo Resend solo entrega a la dirección de la cuenta.
// Con un dominio verificado, AVISOS_DESDE lo cambia sin tocar código.
const DESDE = "Registro de Acciones <onboarding@resend.dev>";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);

export function armarCorreo({ nombre, correo }){
  const quien = nombre && nombre !== correo ? `${nombre} (${correo})` : correo;
  return {
    subject: `Nuevo pedido de acceso: ${nombre || correo}`,
    text: `${quien} pidió entrar al Registro de Acciones.\n\nPara aprobarlo o rechazarlo: entrá a la app → Administración → Solicitudes.\n${APP}\n`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d2b2b">
<p><b>${esc(nombre || correo)}</b> pidió entrar al Registro de Acciones.</p>
<p style="color:#55706f">${esc(correo)}</p>
<p>Para aprobarlo o rechazarlo: entrá a la app → <b>Administración → Solicitudes</b>.</p>
<p><a href="${APP}" style="display:inline-block;background:#0f4c4c;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Abrir el Registro</a></p>
</div>`,
  };
}

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

  const conSesion = { apikey, Authorization: autorizacion, "Content-Type": "application/json" };
  const rpc = nombre => traer(`${url}/rest/v1/rpc/${nombre}`, { method: "POST", headers: conSesion, body: "{}" });

  let datos;
  try{
    const r = await rpc("pedir_aviso_al_admin");
    if(r.status === 401) return responder({ error: "sin-sesion" }, 401);
    if(!r.ok) return responder({ error: "base" }, 502);
    datos = await r.json();
  }catch(e){ return responder({ error: "base" }, 502); }
  if(!datos || !Array.isArray(datos.para) || !datos.para.length) return responder({ enviado: false, motivo: "no-corresponde" });

  const correo = armarCorreo(datos);
  let enviados = 0;
  // De a uno: si Resend no le puede mandar a uno (en modo prueba solo
  // entrega a la dirección de la cuenta), los demás reciben igual.
  for(const para of datos.para){
    try{
      const r = await traer("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("AVISOS_DESDE") || DESDE, to: [para], ...correo }),
      });
      if(r.ok) enviados++;
      else console.error(`Resend no mandó un aviso (${r.status})`);
    }catch(e){ console.error("Resend no contestó:", e.message); }
  }
  if(!enviados) return responder({ enviado: false, motivo: "resend" }, 502);
  try{ await rpc("aviso_al_admin_enviado"); }catch(e){ /* el correo ya salió */ }
  return responder({ enviado: true });
}
