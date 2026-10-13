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
    yMas:"y {n} más", respEn:"{n} {r} en «{t}»", rango:"{a} al {b}", rePieSem:"Te llega porque elegiste un resumen semanal. Si no pasó nada, no llega.", rePieDia:"Te llega porque elegiste un resumen diario. Si no pasó nada, no llega.",
    pasAsunto:"{a} te asignó un pendiente en «{t}»", pasEtiqueta:"Pendiente asignado", pasTitulo:"{a} te asignó un pendiente", pasPara:"Para el {f}", pasBoton:"Ver el pendiente",
    pasPie:"Te llega porque alguien te asignó un paso de «Lo que sigue».", venAsunto:"Hoy vence: {p}", venEtiqueta:"Vence hoy", venTitulo:"Un pendiente tuyo vence hoy", venPie:"Te llega porque tenés un pendiente con fecha de hoy.", cadaPaso:"Lo que sigue" },
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
    yMas:"and {n} more", respEn:"{n} {r} on “{t}”", rango:"{a} to {b}", rePieSem:"You're getting this because you chose a weekly summary. If nothing happened, none is sent.", rePieDia:"You're getting this because you chose a daily summary. If nothing happened, none is sent.",
    pasAsunto:"{a} assigned you a to-do on “{t}”", pasEtiqueta:"Assigned to-do", pasTitulo:"{a} assigned you a to-do", pasPara:"Due {f}", pasBoton:"View the to-do",
    pasPie:"You're getting this because someone assigned you a step from “What's next”.", venAsunto:"Due today: {p}", venEtiqueta:"Due today", venTitulo:"One of your to-dos is due today", venPie:"You're getting this because you have a to-do dated today.", cadaPaso:"What's next" },
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
    yMas:"e mais {n}", respEn:"{n} {r} em «{t}»", rango:"{a} a {b}", rePieSem:"Chega porque você escolheu um resumo semanal. Se nada aconteceu, não chega.", rePieDia:"Chega porque você escolheu um resumo diário. Se nada aconteceu, não chega.",
    pasAsunto:"{a} atribuiu uma pendência a você em «{t}»", pasEtiqueta:"Pendência atribuída", pasTitulo:"{a} atribuiu uma pendência a você", pasPara:"Para {f}", pasBoton:"Ver a pendência",
    pasPie:"Chega porque alguém atribuiu a você um passo de «O que segue».", venAsunto:"Vence hoje: {p}", venEtiqueta:"Vence hoje", venTitulo:"Uma pendência sua vence hoje", venPie:"Chega porque você tem uma pendência com data de hoje.", cadaPaso:"O que segue" },
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
    yMas:"ועוד {n}", respEn:"{n} {r} ב«{t}»", rango:"{a} עד {b}", rePieSem:"זה מגיע אליך כי בחרת בסיכום שבועי. אם לא קרה כלום, לא נשלח מייל.", rePieDia:"זה מגיע אליך כי בחרת בסיכום יומי. אם לא קרה כלום, לא נשלח מייל.",
    pasAsunto:"{a} שייך/ת לך משימה ב«{t}»", pasEtiqueta:"משימה שהוקצתה", pasTitulo:"{a} שייך/ת לך משימה", pasPara:"עד {f}", pasBoton:"לצפייה במשימה",
    pasPie:"זה מגיע אליך כי מישהו/י שייך/ת לך שלב מתוך «מה הלאה».", venAsunto:"מועד היעד היום: {p}", venEtiqueta:"מסתיים היום", venTitulo:"משימה שלך מסתיימת היום", venPie:"זה מגיע אליך כי יש לך משימה עם תאריך של היום.", cadaPaso:"מה הלאה" },
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

/* ---------- Un paso de «Lo que sigue»: asignado, y el día que vence ---------- */
// datos: { autor (quien lo asignó), titulo (del posteo), tipo, texto (el paso), post, cuando (YYYY-MM-DD o vacío), lang }
const tarjetaDePaso = ({ L, x, autor, titulo, tipo, texto, cuando, vence }) => {
  const T = TX[L], icono = ICONOS[tipo] || "📌";
  const fecha = cuando ? `<div style="font-size:13px;font-weight:700;color:${vence ? C.petroleo : C.gris};margin-top:10px;">📅 ${esc(conVars(T.pasPara, { f: fechaCorta(cuando, L) }))}</div>` : "";
  return `${autor ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" dir="${x.dir}" style="margin:0 0 14px;"><tr>${avatar(autor)}
      <td style="padding-${x.ini}:14px;"><div style="font-size:15px;font-weight:700;">${suyo(esc(autor))}</div>
      <div style="font-size:12px;color:${C.gris};margin-top:2px;">${T.cadaPaso} · <b style="color:${C.texto};">${icono} ${suyo(esc(titulo))}</b></div></td></tr></table>` : `<div style="font-size:12px;color:${C.gris};margin:0 0 10px;">${T.cadaPaso} · <b style="color:${C.texto};">${icono} ${suyo(esc(titulo))}</b></div>`}
    <div dir="auto" style="margin:0;padding:14px 18px;border-${x.ini}:4px solid ${C.celeste};background:${C.suave};border-radius:${x.dir === "rtl" ? "12px 0 0 12px" : "0 12px 12px 0"};font-size:15px;line-height:1.6;">${suyo(esc(recortar(texto, 300)))}${fecha}</div>`;
};
export function correoPaso({ autor, titulo, tipo, texto, post, cuando, lang }){
  const L = idioma(lang), T = TX[L], x = lado(L);
  const linea = asunto(conVars(T.pasAsunto, { a: autor, t: titulo }));
  const url = enlaceAPosteo(post);
  return {
    subject: linea,
    text: `${linea}:\n\n${recortar(texto, 300)}${cuando ? `\n${conVars(T.pasPara, { f: fechaCorta(cuando, L) })}` : ""}\n\n${T.pasBoton}: ${url}\n`,
    html: marco({ lang: L,
      pre: `${linea}.`, etiqueta: T.pasEtiqueta, titulo: conVars(T.pasTitulo, { a: suyo(esc(autor)) }),
      cuerpo: `${tarjetaDePaso({ L, x, autor, titulo, tipo, texto, cuando })}
      ${boton(T.pasBoton, url, L)}`,
      pie: `${T.pasPie} ${T.prefs}`,
    }),
  };
}
// El recordatorio del día en que vence (lo manda supabase/avisos/vencimientos.mjs).
export function correoVence({ titulo, tipo, texto, post, cuando, lang }){
  const L = idioma(lang), T = TX[L], x = lado(L);
  const linea = asunto(conVars(T.venAsunto, { p: recortar(texto, 100) }));
  const url = enlaceAPosteo(post);
  return {
    subject: linea,
    text: `${linea}\n\n${T.cadaPaso}: ${titulo}\n${recortar(texto, 300)}\n\n${T.pasBoton}: ${url}\n`,
    html: marco({ lang: L,
      pre: `${linea}.`, etiqueta: T.venEtiqueta, titulo: T.venTitulo,
      cuerpo: `${tarjetaDePaso({ L, x, autor: "", titulo, tipo, texto, cuando, vence: true })}
      ${boton(T.pasBoton, url, L)}`,
      pie: `${T.venPie} ${T.prefs}`,
    }),
  };
}

/* ---------- Lugares sin actividad (el primer lunes de cada mes, a los admin) ---------- */
// datos: { lugares: [{ pais (ya en el idioma), ultima (YYYY-MM-DD), hace (meses enteros), plan (YYYY-MM-DD o "") }], meses (el plazo), lang }
// Los textos con singular y plural van de a dos: [uno, varios].
const LU = {
  es: { asunto:["Lugares sin actividad: 1 país lleva {m} meses o más sin nada hecho", "Lugares sin actividad: {n} países llevan {m} meses o más sin nada hecho"],
    etiqueta:"Lugares sin actividad", titulo:["Hay 1 país sin actividad desde hace {m} meses o más", "Hay {n} países sin actividad desde hace {m} meses o más"],
    intro:"Es el aviso del primer lunes de cada mes. Cuenta como actividad una ya hecha (no una planificada) en el país o en una ciudad suya.",
    ultima:"Última actividad: {f} (hace {n} meses)", planeado:"Ya hay algo planeado: {f}", boton:"Ver los reportes",
    pie:"Te llega porque sos administrador del Registro. El plazo ({m} meses) se elige en <b>Administración → Correos</b>." },
  en: { asunto:["Places with no activity: 1 country has had nothing done for {m} months or more", "Places with no activity: {n} countries have had nothing done for {m} months or more"],
    etiqueta:"Places with no activity", titulo:["1 country has had no activity for {m} months or more", "{n} countries have had no activity for {m} months or more"],
    intro:"This is the notice of the first Monday of each month. An activity counts if it was already done (not just planned) in the country or in one of its cities.",
    ultima:"Last activity: {f} ({n} months ago)", planeado:"Something is already planned: {f}", boton:"See the reports",
    pie:"You're getting this because you're an administrator of the Log. The period ({m} months) is set in <b>Administration → Emails</b>." },
  pt: { asunto:["Lugares sem atividade: 1 país está há {m} meses ou mais sem nada feito", "Lugares sem atividade: {n} países estão há {m} meses ou mais sem nada feito"],
    etiqueta:"Lugares sem atividade", titulo:["1 país está sem atividade há {m} meses ou mais", "{n} países estão sem atividade há {m} meses ou mais"],
    intro:"É o aviso da primeira segunda-feira de cada mês. Conta como atividade uma já realizada (não uma planejada) no país ou em uma cidade dele.",
    ultima:"Última atividade: {f} (há {n} meses)", planeado:"Já há algo planejado: {f}", boton:"Ver os relatórios",
    pie:"Chega porque você é administrador do Registro. O prazo ({m} meses) é escolhido em <b>Administração → E-mails</b>." },
  he: { asunto:["מקומות ללא פעילות: מדינה אחת בלי שום פעילות כבר {m} חודשים או יותר", "מקומות ללא פעילות: {n} מדינות בלי שום פעילות כבר {m} חודשים או יותר"],
    etiqueta:"מקומות ללא פעילות", titulo:["מדינה אחת ללא פעילות כבר {m} חודשים או יותר", "{n} מדינות ללא פעילות כבר {m} חודשים או יותר"],
    intro:"זו ההתראה של יום שני הראשון בכל חודש. נחשבת פעילות כזו שכבר התבצעה (לא רק מתוכננת) במדינה או באחת מעריה.",
    ultima:"פעילות אחרונה: {f} (לפני {n} חודשים)", planeado:"כבר מתוכנן משהו: {f}", boton:"לצפייה בדוחות",
    pie:"זה מגיע אליך כי את/ה מנהל/ת של הרישום. התקופה ({m} חודשים) נקבעת ב<b>ניהול → מיילים</b>." },
};
export const textosDeLugares = lang => LU[idioma(lang)];
const mesYAnio = (iso, lang = "es") => new Intl.DateTimeFormat(LOCALE[idioma(lang)], { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));
export function correoLugares({ lugares, meses, lang, url = `${APP}?ir=reportes` }){
  const L = idioma(lang), T = LU[L], x = lado(L), M = TX[L];
  const n = lugares.length, i = n === 1 ? 0 : 1;
  const linea = asunto(conVars(T.asunto[i], { n, m: meses }));
  const titulo = conVars(T.titulo[i], { n, m: meses });
  const filas = lugares.map(l => ({ pais: String(l.pais), ult: conVars(T.ultima, { f: mesYAnio(l.ultima, L), n: l.hace }), plan: l.plan ? conVars(T.planeado, { f: fechaCorta(l.plan, L) }) : "" }));
  return {
    subject: linea,
    text: `${linea}\n\n${T.intro}\n\n${filas.map(f => `• ${f.pais}: ${f.ult}${f.plan ? `. ${f.plan}` : ""}`).join("\n")}\n\n${T.boton}: ${url}\n`,
    html: marco({ lang: L,
      pre: `${linea}.`, etiqueta: T.etiqueta, titulo,
      cuerpo: `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:${C.gris};">${esc(T.intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" dir="${x.dir}">${filas.map(f => `<tr><td style="padding:12px 16px;margin:0;border-${x.ini}:4px solid ${C.celeste};background:${C.suave};">
        <div style="font-size:16px;font-weight:800;color:${C.petroleo};">🌎 ${suyo(esc(f.pais))}</div>
        <div style="font-size:13px;color:${C.texto};margin-top:3px;">${esc(f.ult)}</div>
        ${f.plan ? `<div style="font-size:13px;font-weight:700;color:${C.celesteOsc};margin-top:3px;">📅 ${esc(f.plan)}</div>` : ""}</td></tr><tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`).join("")}</table>
      ${boton(T.boton, url, L)}`,
      pie: `${conVars(T.pie, { m: meses })} ${M.prefs}`,
    }),
  };
}

/* ---------- El informe mensual (el día 1, a quienes eligió un admin) ---------- */
// datos: { mes ("2026-10"), vence (cuándo deja de andar el enlace, un instante), lang, zona, prueba }
// A propósito NO lleva ningún número: el informe se abre dentro del Registro, con la cuenta del equipo,
// y el enlace vence a las 48 horas (23-informe-mensual.sql). Lo que queda en la casilla es el aviso.
const INF = {
  es: { asunto:"Ya está el informe de {m}", etiqueta:"Informe mensual", titulo:"El informe de {m} ya está listo",
    parrafo:"Se abre dentro del Registro de Acciones: hace falta entrar con tu cuenta del equipo. Desde ahí lo podés ver como presentación, imprimir, guardar como PDF o bajar la planilla.",
    vence:"Este enlace deja de funcionar el {f} (48 horas después de enviado este correo).", despues:"Después de ese momento el correo ya no abre el informe: por seguridad, los números no viajan dentro del correo.",
    prueba:"Es un correo de prueba, para que veas cómo llega.", boton:"Abrir el informe", pie:"Te llega porque un administrador te sumó al informe mensual." },
  en: { asunto:"The {m} report is ready", etiqueta:"Monthly report", titulo:"The {m} report is ready",
    parrafo:"It opens inside the Action Log: you need to sign in with your team account. From there you can view it as a presentation, print it, save it as a PDF or download the spreadsheet.",
    vence:"This link stops working on {f} (48 hours after this email was sent).", despues:"After that, this email no longer opens the report: for security, the numbers don't travel inside the email.",
    prueba:"This is a test email, so you can see how it arrives.", boton:"Open the report", pie:"You're getting this because an administrator added you to the monthly report." },
  pt: { asunto:"O relatório de {m} está pronto", etiqueta:"Relatório mensal", titulo:"O relatório de {m} está pronto",
    parrafo:"Abre dentro do Registro de Ações: é preciso entrar com a sua conta da equipe. De lá você pode ver como apresentação, imprimir, salvar como PDF ou baixar a planilha.",
    vence:"Este link deixa de funcionar em {f} (48 horas depois do envio deste e-mail).", despues:"Depois disso, o e-mail não abre mais o relatório: por segurança, os números não viajam dentro do e-mail.",
    prueba:"É um e-mail de teste, para você ver como chega.", boton:"Abrir o relatório", pie:"Chega porque um administrador incluiu você no relatório mensal." },
  he: { asunto:"הדוח של {m} מוכן", etiqueta:"דוח חודשי", titulo:"הדוח של {m} מוכן",
    parrafo:"הוא נפתח בתוך יומן הפעולות: צריך להתחבר עם חשבון הצוות. משם אפשר לראות אותו כמצגת, להדפיס, לשמור כ-PDF או להוריד את הגיליון.",
    vence:"הקישור הזה יפסיק לעבוד ב{f} (48 שעות אחרי שליחת המייל).", despues:"אחרי הזמן הזה המייל כבר לא פותח את הדוח: מטעמי אבטחה, המספרים לא מועברים בתוך המייל.",
    prueba:"זה מייל ניסיון, כדי שתראו איך זה מגיע.", boton:"פתיחת הדוח", pie:"זה מגיע אליך כי מנהל/ת הוסיף/ה אותך לדוח החודשי." },
};
export const textosDelInforme = lang => INF[idioma(lang)];
export const enlaceAlInforme = mes => `${APP}?informe=${encodeURIComponent(mes)}`;
export function correoInforme({ mes, vence, lang, zona, prueba = false }){
  const L = idioma(lang), T = INF[L], x = lado(L);
  const m = mesYAnio(`${mes}-01`, L), url = enlaceAlInforme(mes);
  // «el martes, 3 de noviembre, 09:30»: fechaLarga empieza con mayúscula, que en una frase en
  // español o portugués sobra.
  const larga = fechaLarga(vence, L, zona), hasta = L === "es" || L === "pt" ? larga.charAt(0).toLowerCase() + larga.slice(1) : larga;
  const linea = asunto(conVars(T.asunto, { m }));
  const aviso = conVars(T.vence, { f: hasta });
  return {
    subject: linea,
    text: `${linea}\n\n${T.parrafo}\n\n⏳ ${aviso}\n${T.despues}\n${prueba ? `\n${T.prueba}\n` : ""}\n${T.boton}: ${url}\n`,
    html: marco({ lang: L,
      pre: `${linea}. ${aviso}`, etiqueta: T.etiqueta, titulo: conVars(T.titulo, { m }),
      cuerpo: `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">${esc(T.parrafo)}</p>
      <div style="margin:0 0 6px;padding:14px 18px;border-${x.ini}:4px solid ${C.celesteOsc};background:${C.suave};border-radius:${x.dir === "rtl" ? "12px 0 0 12px" : "0 12px 12px 0"};font-size:14px;line-height:1.6;">
        <b style="color:${C.petroleo};">⏳ ${esc(aviso)}</b><br><span style="color:${C.gris};">${esc(T.despues)}</span></div>
      ${prueba ? `<p style="font-size:13px;line-height:1.6;margin:12px 0 0;color:${C.gris};">🧪 ${esc(T.prueba)}</p>` : ""}
      ${boton(T.boton, url, L)}`,
      pie: `${T.pie} ${TX[L].prefs}`,
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
