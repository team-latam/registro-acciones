/* ======================================================================
   El diseño de los correos (aprobado por el usuario el 7/10/2026)
   ======================================================================
   Los usan la función `avisar` (al momento) y el trabajo de los
   resúmenes (supabase/avisos/resumen.mjs). Tablas y estilos en línea: es
   lo único que respetan Gmail, Outlook y el celular. Todo lo que viene de
   la base pasa por esc(): un nombre o un comentario no pueden ser código
   en el correo de nadie.
   ====================================================================== */
export const APP = "https://team-latam.github.io/registro-acciones/";
const C = { petroleo:"#0d3b3e", celeste:"#4fc7e0", celesteOsc:"#1a9fb8", fondo:"#f4f8f8", texto:"#0d2a2c", gris:"#4f6c6e", borde:"#e1edee", suave:"#eef6f6" };
const FUENTE = "Montserrat, 'Segoe UI', Arial, sans-serif";
const PIE_PREFS = "Para cambiar qué te llega y cuándo: <b>Mis preferencias → Notificaciones</b>.";
const ICONOS = { visita:"🧳", curso:"📘", seminario:"🎤", congreso:"🏛️", virtual:"💻", rutina:"📝", otro:"✨" };
const COLORES = ["#1a9fb8", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0d3b3e"];
const ZONA = "America/Argentina/Buenos_Aires";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const iniciales = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase() || "?";
const colorDe = n => COLORES[[...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
export const enlaceAPosteo = (post, respuesta) => `${APP}?post=${encodeURIComponent(post)}${respuesta ? `&r=${encodeURIComponent(respuesta)}` : ""}`;
export const fechaLarga = iso => {
  const t = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fechaCorta = iso => new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");
// Las @menciones resaltadas, sobre el texto ya escapado.
const resaltar = texto => esc(texto).replace(/(^|[^\w@])@(\w+)/g, (_, a, n) => `${a}<span style="color:${C.celesteOsc};font-weight:700;">@${n}</span>`);
const recortar = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

function marco({ pre, etiqueta, titulo, cuerpo, pie }){
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${C.fondo};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fondo};"><tr><td align="center" style="padding:28px 12px;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FUENTE};color:${C.texto};">
  <tr><td style="background:${C.petroleo};border-radius:18px 18px 0 0;padding:22px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="font-size:26px;padding-right:12px;">🗺️</td>
      <td><div style="font-size:17px;font-weight:800;color:#fff;">Registro de Acciones</div>
          <div style="font-size:11px;font-weight:700;color:${C.celeste};letter-spacing:2.5px;text-transform:uppercase;margin-top:2px;">Team LatAm</div></td></tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:30px 28px 26px;border-left:1px solid ${C.borde};border-right:1px solid ${C.borde};">
    <div style="font-size:12px;font-weight:700;color:${C.celesteOsc};letter-spacing:1.5px;text-transform:uppercase;">${etiqueta}</div>
    <h1 style="margin:8px 0 18px;font-size:22px;line-height:1.3;font-weight:800;color:${C.petroleo};">${titulo}</h1>
    ${cuerpo}
  </td></tr>
  <tr><td style="background:#fff;border:1px solid ${C.borde};border-top:none;border-radius:0 0 18px 18px;padding:0 28px 24px;">
    <div style="border-top:1px solid ${C.borde};padding-top:16px;font-size:12px;line-height:1.6;color:${C.gris};">${pie}</div>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;font-size:11px;color:${C.gris};">Registro de Acciones · Team LatAm</td></tr>
 </table></td></tr></table></body></html>`;
}
const boton = (texto, url) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td style="background:${C.petroleo};border-radius:999px;">
  <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:14px;font-weight:700;color:#fff;text-decoration:none;">${texto} →</a></td></tr></table>`;
const avatar = nombre => `<td style="width:44px;vertical-align:top;"><div style="width:44px;height:44px;line-height:44px;border-radius:22px;background:${colorDe(nombre)};color:#fff;font-weight:800;font-size:15px;text-align:center;font-family:${FUENTE};">${esc(iniciales(nombre))}</div></td>`;

// El asunto lleva un nombre o un título que escribió alguien: sin saltos
// de línea (en un encabezado de correo, un salto empieza otro encabezado)
// y de un largo razonable.
export const asunto = s => String(s).replace(/[\r\n\t\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

/* ---------- Pedido de acceso ---------- */
export function correoPedido({ nombre, correo, pedido_el }){
  const quien = nombre || correo;
  return {
    subject: asunto(`Nuevo pedido de acceso: ${quien}`),
    text: `${quien} (${correo}) pidió entrar al Registro de Acciones.\n\nMientras no lo apruebes, no ve nada del Registro. Para aprobarlo o rechazarlo: entrá a la app → Administración → Solicitudes.\n${APP}\n`,
    html: marco({
      pre: `${quien} pidió entrar al Registro.`,
      etiqueta: "Pedido de acceso", titulo: "Alguien quiere sumarse al Registro",
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.suave};border-radius:14px;"><tr><td style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>${avatar(quien)}
          <td style="padding-left:14px;"><div style="font-size:16px;font-weight:700;">${esc(quien)}</div>
          <div style="font-size:13px;color:${C.gris};margin-top:2px;">${esc(correo)}</div>
          ${pedido_el ? `<div style="font-size:12px;color:${C.gris};margin-top:6px;">${esc(fechaLarga(pedido_el))}</div>` : ""}</td></tr></table>
      </td></tr></table>
      <p style="font-size:15px;line-height:1.6;margin:18px 0 0;">Mientras no lo apruebes, no ve nada del Registro. Podés aprobarlo, con el rol que corresponda, o rechazarlo.</p>
      ${boton("Revisar el pedido", APP)}
      <p style="font-size:12px;color:${C.gris};margin:10px 0 0;">En la app: Administración → Solicitudes.</p>`,
      pie: `Te llega porque sos administrador del Registro. ${PIE_PREFS}`,
    }),
  };
}

/* ---------- Mención o respuesta, al momento ---------- */
export function correoAviso({ autor, titulo, tipo, texto, post, en, id, motivo }){
  const icono = ICONOS[tipo] || "📌";
  const donde = en === "respuesta" ? "un comentario" : "un posteo";
  const encabezado = motivo === "respuestas" ? `${esc(autor)} comentó en tu posteo` : `${esc(autor)} te nombró en ${donde}`;
  const linea = asunto(motivo === "respuestas" ? `${autor} comentó en «${titulo}»` : `${autor} te mencionó en «${titulo}»`);
  const url = enlaceAPosteo(post, en === "respuesta" ? id : null);
  return {
    subject: linea,
    text: `${linea}:\n\n${recortar(texto, 600)}\n\nVer y responder: ${url}\n`,
    html: marco({
      pre: `${linea}.`,
      etiqueta: motivo === "respuestas" ? "Respuesta a tu posteo" : "Te mencionaron",
      titulo: encabezado,
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>${avatar(autor)}
        <td style="padding-left:14px;"><div style="font-size:15px;font-weight:700;">${esc(autor)}</div>
        <div style="font-size:12px;color:${C.gris};margin-top:2px;">en <b style="color:${C.texto};">${icono} ${esc(titulo)}</b></div></td></tr></table>
      <div style="margin:16px 0 0;padding:14px 18px;border-left:4px solid ${C.celeste};background:${C.suave};border-radius:0 12px 12px 0;font-size:15px;line-height:1.6;">${resaltar(recortar(texto, 600))}</div>
      ${boton("Ver y responder", url)}`,
      pie: `Te llega porque ${motivo === "respuestas" ? "alguien comentó en un posteo tuyo" : "alguien te mencionó con @"}. ${PIE_PREFS}`,
    }),
  };
}

/* ---------- Correo de prueba ---------- */
export function correoPrueba({ nombre }){
  return {
    subject: "Así se ven los avisos del Registro",
    text: `Hola${nombre ? " " + nombre : ""}: este es un correo de prueba. Los avisos te van a llegar así.\n${APP}\n`,
    html: marco({
      pre: "Correo de prueba: así te van a llegar los avisos.",
      etiqueta: "Correo de prueba", titulo: `Hola${nombre ? " " + esc(String(nombre).split(" ")[0]) : ""}, así te llegan los avisos`,
      cuerpo: `<p style="font-size:15px;line-height:1.6;margin:0;">Si estás leyendo esto, los avisos por correo del Registro te llegan bien. Revisá que no haya ido a Spam; si fue, marcalo como «No es spam» y los próximos van a llegar a la bandeja de entrada.</p>
      ${boton("Abrir el Registro", APP)}`,
      pie: `Te llega porque lo pediste desde Mis preferencias. ${PIE_PREFS}`,
    }),
  };
}

/* ---------- Resumen (diario o semanal) ---------- */
// datos: { periodo:'daily'|'weekly', desde, hasta (ISO), menciones:[{autor,titulo,texto,post,id,en}],
//          respuestas:[{titulo,post,autores:[...],n}], nuevos:[{titulo,tipo,autor,start,end,lugar,post}],
//          proximos:[{titulo,tipo,start,end,lugar,post}] }
export function correoResumen(d){
  const semanal = d.periodo === "weekly";
  const fila = (icono, titulo, sub, url) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.borde};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="width:34px;font-size:20px;vertical-align:top;">${icono}</td>
    <td><a href="${esc(url)}" style="font-size:14px;font-weight:700;color:${C.texto};text-decoration:none;">${titulo}</a>${sub ? `<div style="font-size:12px;color:${C.gris};margin-top:3px;line-height:1.5;">${sub}</div>` : ""}</td></tr></table></td></tr>`;
  const seccion = (t, filas, max = 5) => !filas.length ? "" : `<div style="margin:24px 0 4px;font-size:12px;font-weight:800;color:${C.petroleo};letter-spacing:1.2px;text-transform:uppercase;">${t}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${filas.slice(0, max).join("")}${filas.length > max ? fila("✨", `y ${filas.length - max} más`, "", APP) : ""}</table>`;
  const rango = (s, e) => !s ? "" : (e && e !== s ? `${fechaCorta(s)} al ${fechaCorta(e)}` : fechaCorta(s));
  const m = d.menciones || [], r = d.respuestas || [], n = d.nuevos || [], p = d.proximos || [];
  const cuenta = (k, uno, varios) => [k, k === 1 ? uno : varios];
  const numeros = [cuenta(m.length, "mención", "menciones"), cuenta(r.reduce((a, x) => a + (x.n || 1), 0), "respuesta", "respuestas"),
    cuenta(n.length, "actividad nueva", "actividades nuevas"), cuenta(p.length, "evento próximo", "eventos próximos")].filter(([k]) => k > 0);
  const titulo = semanal ? `Lo que pasó del ${fechaCorta(d.desde.slice(0, 10))} al ${fechaCorta(d.hasta.slice(0, 10))}` : "Lo que pasó desde ayer";
  const partes = numeros.map(([k, l]) => `${k} ${l}`);
  return {
    subject: `${semanal ? "Tu resumen de la semana" : "Tu resumen del día"}: ${partes.join(", ")}`,
    text: `${titulo}\n\n${partes.join("\n")}\n\n${APP}\n`,
    html: marco({
      pre: partes.join(", ") + ".",
      etiqueta: semanal ? "Tu resumen de la semana" : "Tu resumen del día", titulo,
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        ${numeros.map(([k, l]) => `<td align="center" style="background:${C.suave};border-radius:12px;padding:12px 4px;"><div style="font-size:22px;font-weight:800;color:${C.petroleo};">${k}</div><div style="font-size:11px;color:${C.gris};">${l}</div></td><td style="width:8px;"></td>`).join("")}
      </tr></table>
      ${seccion("Te mencionaron", m.map(x => fila("💬", `${esc(x.autor)} · ${esc(x.titulo)}`, `«${resaltar(recortar(x.texto, 120))}»`, enlaceAPosteo(x.post, x.en === "respuesta" ? x.id : null))))}
      ${seccion("Respuestas a tus posteos", r.map(x => fila("↩️", `${x.n} ${x.n === 1 ? "respuesta" : "respuestas"} en «${esc(x.titulo)}»`, esc((x.autores || []).join(", ")), enlaceAPosteo(x.post))))}
      ${seccion("Nuevo en el Registro", n.map(x => fila(ICONOS[x.tipo] || "📌", esc(x.titulo), [esc(x.autor), rango(x.start, x.end), esc(x.lugar)].filter(Boolean).join(" · "), enlaceAPosteo(x.post))))}
      ${seccion("Empiezan pronto", p.map(x => fila("⏰", esc(x.titulo), [rango(x.start, x.end), esc(x.lugar)].filter(Boolean).join(" · "), enlaceAPosteo(x.post))))}
      ${boton("Abrir el Registro", APP)}`,
      pie: `Te llega porque elegiste un resumen ${semanal ? "semanal" : "diario"}. Si no pasó nada, no llega. ${PIE_PREFS}`,
    }),
  };
}
