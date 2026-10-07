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
const ICONOS = { visita:"🧳", curso:"📘", seminario:"🎤", congreso:"🏛️", virtual:"💻", rutina:"📝", otro:"✨" };
const COLORES = ["#1a9fb8", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0d3b3e"];
export const ZONA = "America/Argentina/Buenos_Aires";

/* ---------- Idiomas (decisión del usuario del 7/10/2026) ----------
   Cada correo sale en el idioma que la persona eligió en la app
   (emailLang en sus preferencias; 17-avisos-por-correo.sql), con las
   mismas palabras que usa la app en ese idioma, y el hebreo de derecha a
   izquierda. Las fechas, en su idioma y en SU hora (emailTz). */
export const IDIOMAS = ["es", "en", "pt", "he"];
export const idioma = l => IDIOMAS.includes(l) ? l : "es";
const LOCALE = { es:"es-AR", en:"en-GB", pt:"pt-BR", he:"he-IL" };
// Una zona que no existe (un dato viejo, una mano) no rompe el correo: va la de Argentina.
export const zonaValida = z => { try{ new Intl.DateTimeFormat("en", { timeZone: z }); return !!z; }catch(e){ return false; } };
const conVars = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);
const TX = {
  es: { marca:"Registro de Acciones", prefs:"Para cambiar qué te llega y cuándo: <b>Mis preferencias → Notificaciones</b>.",
    pedAsunto:"Nuevo pedido de acceso: {q}", pedTexto:"{q} ({c}) pidió entrar al Registro de Acciones.\n\nMientras no lo apruebes, no ve nada del Registro. Para aprobarlo o rechazarlo: entrá a la app → Administración → Solicitudes.",
    pedPre:"{q} pidió entrar al Registro.", pedEtiqueta:"Pedido de acceso", pedTitulo:"Alguien quiere sumarse al Registro",
    pedParrafo:"Mientras no lo apruebes, no ve nada del Registro. Podés aprobarlo, con el rol que corresponda, o rechazarlo.",
    pedBoton:"Revisar el pedido", pedDonde:"En la app: Administración → Solicitudes.", pedPie:"Te llega porque sos administrador del Registro.",
    avComento:"{a} comentó en tu posteo", avNombro:"{a} te nombró en {d}", unComentario:"un comentario", unPosteo:"un posteo",
    avAsuntoResp:"{a} comentó en «{t}»", avAsuntoMenc:"{a} te mencionó en «{t}»", avEtqResp:"Respuesta a tu posteo", avEtqMenc:"Te mencionaron",
    en:"en", avBoton:"Ver y responder", avPieResp:"Te llega porque alguien comentó en un posteo tuyo.", avPieMenc:"Te llega porque alguien te mencionó con @.",
    prAsunto:"Así se ven los avisos del Registro", prTexto:"Hola{n}: este es un correo de prueba. Los avisos te van a llegar así.",
    prPre:"Correo de prueba: así te van a llegar los avisos.", prEtiqueta:"Correo de prueba", prTitulo:"Hola{n}, así te llegan los avisos",
    prParrafo:"Si estás leyendo esto, los avisos por correo del Registro te llegan bien. Revisá que no haya ido a Spam; si fue, marcalo como «No es spam» y los próximos van a llegar a la bandeja de entrada.",
    abrir:"Abrir el Registro", prPie:"Te llega porque lo pediste desde Mis preferencias.",
    mencion:["mención","menciones"], respuesta:["respuesta","respuestas"], nueva:["actividad nueva","actividades nuevas"], proximo:["evento próximo","eventos próximos"],
    reTituloSem:"Lo que pasó del {a} al {b}", reTituloDia:"Lo que pasó desde ayer", reSem:"Tu resumen de la semana", reDia:"Tu resumen del día",
    reMenc:"Te mencionaron", reResp:"Respuestas a tus posteos", reNuevo:"Nuevo en el Registro", reProx:"Empiezan pronto",
    yMas:"y {n} más", respEn:"{n} {r} en «{t}»", rango:"{a} al {b}", rePieSem:"Te llega porque elegiste un resumen semanal. Si no pasó nada, no llega.", rePieDia:"Te llega porque elegiste un resumen diario. Si no pasó nada, no llega." },
  en: { marca:"Action Log", prefs:"To change what you get and when: <b>My preferences → Notifications</b>.",
    pedAsunto:"New access request: {q}", pedTexto:"{q} ({c}) asked to join the Action Log.\n\nUntil you approve them, they can't see anything in the Log. To approve or reject: open the app → Administration → Requests.",
    pedPre:"{q} asked to join the Log.", pedEtiqueta:"Access request", pedTitulo:"Someone wants to join the Log",
    pedParrafo:"Until you approve them, they can't see anything in the Log. You can approve them, with the right role, or reject them.",
    pedBoton:"Review the request", pedDonde:"In the app: Administration → Requests.", pedPie:"You're getting this because you're an administrator of the Log.",
    avComento:"{a} commented on your post", avNombro:"{a} mentioned you in {d}", unComentario:"a comment", unPosteo:"a post",
    avAsuntoResp:"{a} commented on “{t}”", avAsuntoMenc:"{a} mentioned you in “{t}”", avEtqResp:"Reply to your post", avEtqMenc:"You were mentioned",
    en:"in", avBoton:"View and reply", avPieResp:"You're getting this because someone commented on a post of yours.", avPieMenc:"You're getting this because someone mentioned you with @.",
    prAsunto:"This is what the Log's notifications look like", prTexto:"Hi{n}: this is a test email. Notifications will reach you like this.",
    prPre:"Test email: this is how notifications will reach you.", prEtiqueta:"Test email", prTitulo:"Hi{n}, this is how notifications reach you",
    prParrafo:"If you're reading this, the Log's email notifications reach you fine. Check it didn't land in Spam; if it did, mark it as “Not spam” and the next ones will reach your inbox.",
    abrir:"Open the Log", prPie:"You're getting this because you asked for it in My preferences.",
    mencion:["mention","mentions"], respuesta:["reply","replies"], nueva:["new activity","new activities"], proximo:["upcoming event","upcoming events"],
    reTituloSem:"What happened from {a} to {b}", reTituloDia:"What happened since yesterday", reSem:"Your weekly summary", reDia:"Your daily summary",
    reMenc:"You were mentioned", reResp:"Replies to your posts", reNuevo:"New in the Log", reProx:"Starting soon",
    yMas:"and {n} more", respEn:"{n} {r} on “{t}”", rango:"{a} to {b}", rePieSem:"You're getting this because you chose a weekly summary. If nothing happened, none is sent.", rePieDia:"You're getting this because you chose a daily summary. If nothing happened, none is sent." },
  pt: { marca:"Registro de Ações", prefs:"Para mudar o que chega e quando: <b>Minhas preferências → Notificações</b>.",
    pedAsunto:"Novo pedido de acesso: {q}", pedTexto:"{q} ({c}) pediu para entrar no Registro de Ações.\n\nEnquanto você não aprovar, não vê nada do Registro. Para aprovar ou rejeitar: entre no app → Administração → Solicitações.",
    pedPre:"{q} pediu para entrar no Registro.", pedEtiqueta:"Pedido de acesso", pedTitulo:"Alguém quer entrar no Registro",
    pedParrafo:"Enquanto você não aprovar, não vê nada do Registro. Você pode aprovar, com o papel que corresponder, ou rejeitar.",
    pedBoton:"Revisar o pedido", pedDonde:"No app: Administração → Solicitações.", pedPie:"Chega porque você é administrador do Registro.",
    avComento:"{a} comentou na sua postagem", avNombro:"{a} mencionou você em {d}", unComentario:"um comentário", unPosteo:"uma postagem",
    avAsuntoResp:"{a} comentou em «{t}»", avAsuntoMenc:"{a} mencionou você em «{t}»", avEtqResp:"Resposta à sua postagem", avEtqMenc:"Mencionaram você",
    en:"em", avBoton:"Ver e responder", avPieResp:"Chega porque alguém comentou numa postagem sua.", avPieMenc:"Chega porque alguém mencionou você com @.",
    prAsunto:"Assim são os avisos do Registro", prTexto:"Olá{n}: este é um e-mail de teste. Os avisos vão chegar assim.",
    prPre:"E-mail de teste: assim vão chegar os avisos.", prEtiqueta:"E-mail de teste", prTitulo:"Olá{n}, assim chegam os avisos",
    prParrafo:"Se você está lendo isto, os avisos por e-mail do Registro chegam bem. Confira se não foi para o Spam; se foi, marque como «Não é spam» e os próximos vão chegar na caixa de entrada.",
    abrir:"Abrir o Registro", prPie:"Chega porque você pediu em Minhas preferências.",
    mencion:["menção","menções"], respuesta:["resposta","respostas"], nueva:["atividade nova","atividades novas"], proximo:["evento próximo","eventos próximos"],
    reTituloSem:"O que aconteceu de {a} a {b}", reTituloDia:"O que aconteceu desde ontem", reSem:"Seu resumo da semana", reDia:"Seu resumo do dia",
    reMenc:"Mencionaram você", reResp:"Respostas às suas postagens", reNuevo:"Novo no Registro", reProx:"Começam em breve",
    yMas:"e mais {n}", respEn:"{n} {r} em «{t}»", rango:"{a} a {b}", rePieSem:"Chega porque você escolheu um resumo semanal. Se nada aconteceu, não chega.", rePieDia:"Chega porque você escolheu um resumo diário. Se nada aconteceu, não chega." },
  he: { marca:"יומן הפעילויות", prefs:"כדי לשנות מה מגיע ומתי: <b>ההעדפות שלי ← התראות</b>.",
    pedAsunto:"בקשת גישה חדשה: {q}", pedTexto:"{q} ({c}) ביקש/ה להצטרף ליומן הפעילויות.\n\nכל עוד לא תאשר/י, אין לו/ה גישה לשום דבר ביומן. לאישור או לדחייה: באפליקציה ← ניהול ← בקשות.",
    pedPre:"{q} ביקש/ה להצטרף ליומן.", pedEtiqueta:"בקשת גישה", pedTitulo:"מישהו/י רוצה להצטרף ליומן",
    pedParrafo:"כל עוד לא תאשר/י, אין לו/ה גישה לשום דבר ביומן. אפשר לאשר, עם התפקיד המתאים, או לדחות.",
    pedBoton:"לבדיקת הבקשה", pedDonde:"באפליקציה: ניהול ← בקשות.", pedPie:"זה מגיע אליך כי את/ה מנהל/ת ביומן.",
    avComento:"{a} הגיב/ה לפוסט שלך", avNombro:"{a} הזכיר/ה אותך ב{d}", unComentario:"תגובה", unPosteo:"פוסט",
    avAsuntoResp:"{a} הגיב/ה על «{t}»", avAsuntoMenc:"{a} הזכיר/ה אותך ב«{t}»", avEtqResp:"תגובה לפוסט שלך", avEtqMenc:"הזכירו אותך",
    en:"ב־", avBoton:"לצפייה ולתגובה", avPieResp:"זה מגיע אליך כי מישהו/י הגיב/ה לפוסט שלך.", avPieMenc:"זה מגיע אליך כי מישהו/י הזכיר/ה אותך עם @.",
    prAsunto:"כך נראות ההתראות של היומן", prTexto:"שלום{n}: זה מייל ניסיון. ההתראות יגיעו אליך כך.",
    prPre:"מייל ניסיון: כך יגיעו אליך ההתראות.", prEtiqueta:"מייל ניסיון", prTitulo:"שלום{n}, כך מגיעות ההתראות",
    prParrafo:"אם את/ה קורא/ת את זה, ההתראות במייל מהיומן מגיעות אליך כמו שצריך. כדאי לבדוק שזה לא הגיע לספאם; אם כן, סמנו «לא ספאם» והבאות יגיעו לתיבת הדואר הנכנס.",
    abrir:"לפתיחת היומן", prPie:"זה מגיע אליך כי ביקשת את זה מההעדפות שלי.",
    mencion:["אזכור","אזכורים"], respuesta:["תגובה","תגובות"], nueva:["פעילות חדשה","פעילויות חדשות"], proximo:["אירוע קרוב","אירועים קרובים"],
    reTituloSem:"מה קרה בין {a} ל־{b}", reTituloDia:"מה קרה מאתמול", reSem:"הסיכום השבועי שלך", reDia:"הסיכום היומי שלך",
    reMenc:"הזכירו אותך", reResp:"תגובות לפוסטים שלך", reNuevo:"חדש ביומן", reProx:"מתחילים בקרוב",
    yMas:"ועוד {n}", respEn:"{n} {r} ב«{t}»", rango:"{a} עד {b}", rePieSem:"זה מגיע אליך כי בחרת בסיכום שבועי. אם לא קרה כלום, לא נשלח מייל.", rePieDia:"זה מגיע אליך כי בחרת בסיכום יומי. אם לא קרה כלום, לא נשלח מייל." },
};
export const textos = lang => TX[idioma(lang)];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
const iniciales = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(p => p[0] || "").join("").toUpperCase() || "?";
const colorDe = n => COLORES[[...String(n || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORES.length];
export const enlaceAPosteo = (post, respuesta) => `${APP}?post=${encodeURIComponent(post)}${respuesta ? `&r=${encodeURIComponent(respuesta)}` : ""}`;
export const fechaLarga = (iso, lang = "es", zona = ZONA) => {
  const t = new Intl.DateTimeFormat(LOCALE[idioma(lang)], { timeZone: zonaValida(zona) ? zona : ZONA, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fechaCorta = (iso, lang = "es") => new Intl.DateTimeFormat(LOCALE[idioma(lang)], { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");
// Las @menciones resaltadas, sobre el texto ya escapado.
const resaltar = texto => esc(texto).replace(/(^|[^\w@])@(\w+)/g, (_, a, n) => `${a}<span style="color:${C.celesteOsc};font-weight:700;">@${n}</span>`);
const recortar = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
// Lo que escribió alguien va con dir="auto": un comentario en hebreo dentro
// de un correo en español (o al revés) se ordena solo.
const suyo = html => `<span dir="auto">${html}</span>`;

// De qué lado van las cosas: en hebreo, todo espejado.
const lado = lang => idioma(lang) === "he"
  ? { dir:"rtl", ini:"right", fin:"left", flecha:"←" }
  : { dir:"ltr", ini:"left", fin:"right", flecha:"→" };

function marco({ lang, pre, etiqueta, titulo, cuerpo, pie }){
  const L = idioma(lang), x = lado(L), T = TX[L];
  return `<!doctype html><html lang="${L}" dir="${x.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${C.fondo};">
<div style="display:none;max-height:0;overflow:hidden;">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${x.dir}" style="background:${C.fondo};"><tr><td align="center" style="padding:28px 12px;">
 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${x.dir}" style="max-width:560px;font-family:${FUENTE};color:${C.texto};text-align:${x.ini};">
  <tr><td style="background:${C.petroleo};border-radius:18px 18px 0 0;padding:22px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" dir="${x.dir}"><tr><td style="font-size:26px;padding-${x.fin}:12px;">🗺️</td>
      <td><div style="font-size:17px;font-weight:800;color:#fff;">${T.marca}</div>
          <div style="font-size:11px;font-weight:700;color:${C.celeste};letter-spacing:2.5px;text-transform:uppercase;margin-top:2px;">Team LatAm</div></td></tr></table>
  </td></tr>
  <tr><td style="background:#fff;padding:30px 28px 26px;border-left:1px solid ${C.borde};border-right:1px solid ${C.borde};">
    <div style="font-size:12px;font-weight:700;color:${C.celesteOsc};letter-spacing:${L === "he" ? "0" : "1.5px"};text-transform:uppercase;">${etiqueta}</div>
    <h1 style="margin:8px 0 18px;font-size:22px;line-height:1.3;font-weight:800;color:${C.petroleo};">${titulo}</h1>
    ${cuerpo}
  </td></tr>
  <tr><td style="background:#fff;border:1px solid ${C.borde};border-top:none;border-radius:0 0 18px 18px;padding:0 28px 24px;">
    <div style="border-top:1px solid ${C.borde};padding-top:16px;font-size:12px;line-height:1.6;color:${C.gris};">${pie}</div>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;font-size:11px;color:${C.gris};">${T.marca} · Team LatAm</td></tr>
 </table></td></tr></table></body></html>`;
}
const boton = (texto, url, lang) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td style="background:${C.petroleo};border-radius:999px;">
  <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:14px;font-weight:700;color:#fff;text-decoration:none;">${texto} ${lado(lang).flecha}</a></td></tr></table>`;
const avatar = nombre => `<td style="width:44px;vertical-align:top;"><div style="width:44px;height:44px;line-height:44px;border-radius:22px;background:${colorDe(nombre)};color:#fff;font-weight:800;font-size:15px;text-align:center;font-family:${FUENTE};">${esc(iniciales(nombre))}</div></td>`;

// El asunto lleva un nombre o un título que escribió alguien: sin saltos
// de línea (en un encabezado de correo, un salto empieza otro encabezado)
// y de un largo razonable.
export const asunto = s => String(s).replace(/[\r\n\t\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150);

/* ---------- Pedido de acceso ---------- */
export function correoPedido({ nombre, correo, pedido_el, lang, zona }){
  const L = idioma(lang), T = TX[L], x = lado(L);
  const quien = nombre || correo;
  return {
    subject: asunto(conVars(T.pedAsunto, { q: quien })),
    text: `${conVars(T.pedTexto, { q: quien, c: correo })}\n${APP}\n`,
    html: marco({ lang: L,
      pre: conVars(T.pedPre, { q: quien }),
      etiqueta: T.pedEtiqueta, titulo: T.pedTitulo,
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${C.suave};border-radius:14px;"><tr><td style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" dir="${x.dir}"><tr>${avatar(quien)}
          <td style="padding-${x.ini}:14px;"><div style="font-size:16px;font-weight:700;">${suyo(esc(quien))}</div>
          <div style="font-size:13px;color:${C.gris};margin-top:2px;" dir="ltr">${esc(correo)}</div>
          ${pedido_el ? `<div style="font-size:12px;color:${C.gris};margin-top:6px;">${esc(fechaLarga(pedido_el, L, zona))}</div>` : ""}</td></tr></table>
      </td></tr></table>
      <p style="font-size:15px;line-height:1.6;margin:18px 0 0;">${T.pedParrafo}</p>
      ${boton(T.pedBoton, APP, L)}
      <p style="font-size:12px;color:${C.gris};margin:10px 0 0;">${T.pedDonde}</p>`,
      pie: `${T.pedPie} ${T.prefs}`,
    }),
  };
}

/* ---------- Mención o respuesta, al momento ---------- */
export function correoAviso({ autor, titulo, tipo, texto, post, en, id, motivo, lang }){
  const L = idioma(lang), T = TX[L], x = lado(L);
  const icono = ICONOS[tipo] || "📌";
  const donde = en === "respuesta" ? T.unComentario : T.unPosteo;
  const encabezado = motivo === "respuestas" ? conVars(T.avComento, { a: suyo(esc(autor)) }) : conVars(T.avNombro, { a: suyo(esc(autor)), d: donde });
  const linea = asunto(conVars(motivo === "respuestas" ? T.avAsuntoResp : T.avAsuntoMenc, { a: autor, t: titulo }));
  const url = enlaceAPosteo(post, en === "respuesta" ? id : null);
  return {
    subject: linea,
    text: `${linea}:\n\n${recortar(texto, 600)}\n\n${T.avBoton}: ${url}\n`,
    html: marco({ lang: L,
      pre: `${linea}.`,
      etiqueta: motivo === "respuestas" ? T.avEtqResp : T.avEtqMenc,
      titulo: encabezado,
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" dir="${x.dir}"><tr>${avatar(autor)}
        <td style="padding-${x.ini}:14px;"><div style="font-size:15px;font-weight:700;">${suyo(esc(autor))}</div>
        <div style="font-size:12px;color:${C.gris};margin-top:2px;">${T.en} <b style="color:${C.texto};">${icono} ${suyo(esc(titulo))}</b></div></td></tr></table>
      <div dir="auto" style="margin:16px 0 0;padding:14px 18px;border-${x.ini}:4px solid ${C.celeste};background:${C.suave};border-radius:${x.dir === "rtl" ? "12px 0 0 12px" : "0 12px 12px 0"};font-size:15px;line-height:1.6;">${resaltar(recortar(texto, 600))}</div>
      ${boton(T.avBoton, url, L)}`,
      pie: `${motivo === "respuestas" ? T.avPieResp : T.avPieMenc} ${T.prefs}`,
    }),
  };
}

/* ---------- Correo de prueba ---------- */
export function correoPrueba({ nombre, lang }){
  const L = idioma(lang), T = TX[L];
  const primero = nombre ? " " + String(nombre).split(" ")[0] : "";
  return {
    subject: T.prAsunto,
    text: `${conVars(T.prTexto, { n: nombre ? " " + nombre : "" })}\n${APP}\n`,
    html: marco({ lang: L,
      pre: T.prPre,
      etiqueta: T.prEtiqueta, titulo: conVars(T.prTitulo, { n: primero ? suyo(esc(primero.trim())).replace(/^/, " ") : "" }),
      cuerpo: `<p style="font-size:15px;line-height:1.6;margin:0;">${T.prParrafo}</p>
      ${boton(T.abrir, APP, L)}`,
      pie: `${T.prPie} ${T.prefs}`,
    }),
  };
}

/* ---------- Resumen (diario o semanal) ---------- */
// datos: { periodo:'daily'|'weekly', desde, hasta (ISO), lang, menciones:[{autor,titulo,texto,post,id,en}],
//          respuestas:[{titulo,post,autores:[...],n}], nuevos:[{titulo,tipo,autor,start,end,lugar,post}],
//          proximos:[{titulo,tipo,start,end,lugar,post}] }
export function correoResumen(d){
  const L = idioma(d.lang), T = TX[L], x = lado(L);
  const semanal = d.periodo === "weekly";
  const fila = (icono, titulo, sub, url) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.borde};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" dir="${x.dir}"><tr><td style="width:34px;font-size:20px;vertical-align:top;">${icono}</td>
    <td><a href="${esc(url)}" style="font-size:14px;font-weight:700;color:${C.texto};text-decoration:none;">${titulo}</a>${sub ? `<div style="font-size:12px;color:${C.gris};margin-top:3px;line-height:1.5;">${sub}</div>` : ""}</td></tr></table></td></tr>`;
  const seccion = (t, filas, max = 5) => !filas.length ? "" : `<div style="margin:24px 0 4px;font-size:12px;font-weight:800;color:${C.petroleo};letter-spacing:1.2px;text-transform:uppercase;">${t}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${filas.slice(0, max).join("")}${filas.length > max ? fila("✨", conVars(T.yMas, { n: filas.length - max }), "", APP) : ""}</table>`;
  const rango = (s, e) => !s ? "" : (e && e !== s ? conVars(T.rango, { a: fechaCorta(s, L), b: fechaCorta(e, L) }) : fechaCorta(s, L));
  const m = d.menciones || [], r = d.respuestas || [], n = d.nuevos || [], p = d.proximos || [];
  const cuenta = (k, [uno, varios]) => [k, k === 1 ? uno : varios];
  const numeros = [cuenta(m.length, T.mencion), cuenta(r.reduce((a, y) => a + (y.n || 1), 0), T.respuesta),
    cuenta(n.length, T.nueva), cuenta(p.length, T.proximo)].filter(([k]) => k > 0);
  const titulo = semanal ? conVars(T.reTituloSem, { a: fechaCorta(d.desde.slice(0, 10), L), b: fechaCorta(d.hasta.slice(0, 10), L) }) : T.reTituloDia;
  const partes = numeros.map(([k, l]) => `${k} ${l}`);
  return {
    subject: `${semanal ? T.reSem : T.reDia}: ${partes.join(", ")}`,
    text: `${titulo}\n\n${partes.join("\n")}\n\n${APP}\n`,
    html: marco({ lang: L,
      pre: partes.join(", ") + ".",
      etiqueta: semanal ? T.reSem : T.reDia, titulo,
      cuerpo: `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" dir="${x.dir}"><tr>
        ${numeros.map(([k, l]) => `<td align="center" style="background:${C.suave};border-radius:12px;padding:12px 4px;"><div style="font-size:22px;font-weight:800;color:${C.petroleo};">${k}</div><div style="font-size:11px;color:${C.gris};">${l}</div></td><td style="width:8px;"></td>`).join("")}
      </tr></table>
      ${seccion(T.reMenc, m.map(y => fila("💬", `${suyo(esc(y.autor))} · ${suyo(esc(y.titulo))}`, `«${suyo(resaltar(recortar(y.texto, 120)))}»`, enlaceAPosteo(y.post, y.en === "respuesta" ? y.id : null))))}
      ${seccion(T.reResp, r.map(y => fila("↩️", conVars(T.respEn, { n: y.n, r: y.n === 1 ? T.respuesta[0] : T.respuesta[1], t: suyo(esc(y.titulo)) }), suyo(esc((y.autores || []).join(", "))), enlaceAPosteo(y.post))))}
      ${seccion(T.reNuevo, n.map(y => fila(ICONOS[y.tipo] || "📌", suyo(esc(y.titulo)), [suyo(esc(y.autor)), rango(y.start, y.end), suyo(esc(y.lugar))].filter(z => z && z !== '<span dir="auto"></span>').join(" · "), enlaceAPosteo(y.post))))}
      ${seccion(T.reProx, p.map(y => fila("⏰", suyo(esc(y.titulo)), [rango(y.start, y.end), suyo(esc(y.lugar))].filter(z => z && z !== '<span dir="auto"></span>').join(" · "), enlaceAPosteo(y.post))))}
      ${boton(T.abrir, APP, L)}`,
      pie: `${semanal ? T.rePieSem : T.rePieDia} ${T.prefs}`,
    }),
  };
}
