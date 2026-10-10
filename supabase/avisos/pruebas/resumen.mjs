/* ======================================================================
   Los resúmenes por correo, de punta a punta, contra un Supabase y un
   Resend de mentira: a quién le toca, qué lleva, y que no se repita.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
const { main, leToca, desdeDe, relojArgentino, relojDe, armarResumen } = await import("../resumen.mjs");

// Miércoles 7/10/2026, 9:30 en Argentina (12:30 UTC): la hora de fábrica.
const AHORA = Date.parse("2026-10-07T12:30:00Z");
const hace = h => new Date(AHORA - h * 3600000).toISOString();
const BENNY = "benny@team-latam.com";

function mundo({ prefs = {}, puede = { [BENNY]: true }, ultimos = [], resendFalla = false, mas = [], marcas = [] } = {}){
  const reg = { correos: [], ultimos: [], borrados: [] };
  const posts = [
    { id: "p1", title: "Visita a Rosario", content: "Hola @benny", author_email: "ana@x.com", author_name: "Ana", mentions: [BENNY], created_at: hace(3), activity_type: "visita", start_date: "2026-10-20", end_date: "2026-10-20", scopes: [{ city: "Rosario" }], cancelled: false },
    { id: "p2", title: "Programa de becas", content: "De Benny", author_email: BENNY, author_name: "Benny", mentions: [], created_at: hace(100), activity_type: "visita", start_date: "2026-10-08", end_date: "2026-10-08", scopes: [], cancelled: false },
    { id: "p3", title: "Viejo", content: "@benny de hace mucho", author_email: "ana@x.com", author_name: "Ana", mentions: [BENNY], created_at: hace(60), activity_type: "curso", start_date: "2026-11-01", end_date: "2026-11-01", scopes: [], cancelled: false },
    ...mas,
  ];
  const replies = [
    { id: "r1", post_id: "p2", content: "Buenísimo", author_email: "juan@x.com", author_name: "Juan", mentions: [], created_at: hace(2), system: false },
    { id: "r2", post_id: "p2", content: "📅 Calendar", author_email: "", author_name: "Google Calendar", mentions: [], created_at: hace(2), system: true },
  ];
  const deFabrica = { on: true, when: "daily", hour: 9, day: 1, what: ["menciones", "respuestas"] };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url), q = new URL(u).searchParams;
    const ok = d => new Response(d === null ? "" : JSON.stringify(d));
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body); reg.correos.push(c);
      return new Response("{}", { status: resendFalla ? 500 : 200 });
    }
    if(u.includes("/rpc/puede_recibir_correos")) return ok(!!puede[JSON.parse(op.body).p_email]);
    if(u.includes("/rpc/prefs_de_correo")) return ok({ ...deFabrica, ...(prefs[JSON.parse(op.body).p_email] || {}) });
    if(u.includes("/members")) return ok([{ email: BENNY, name: "Benny" }, { email: "ana@x.com", name: "Ana" }]);
    if(u.includes("/avisos_enviados") || u.includes("/avisos_listos")){
      if(op.method === "DELETE"){ reg.borrados.push(u.split("/rest/v1/")[1].split("?")[0] + "?" + decodeURIComponent(u.split("?")[1]).slice(0, 16)); return ok(null); }
      return ok(marcas);
    }
    if(u.includes("/resumenes_enviados")){
      if(op.method === "POST"){ reg.ultimos.push(JSON.parse(op.body)); return ok(null); }
      return ok(ultimos);
    }
    if(u.includes("/posts")){
      if(q.get("start_date")) return ok(posts.filter(p => p.start_date >= q.get("start_date").slice(4) && p.start_date <= q.getAll("start_date")[1].slice(4)));
      if(q.get("id")) return ok(posts.filter(p => q.get("id").slice(4, -1).split(",").includes(p.id)));
      return ok(posts.filter(p => p.created_at > decodeURIComponent(q.get("created_at").slice(3))));
    }
    if(u.includes("/replies")) return ok(replies);
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try{ return await fn(); } finally { console.log = l; console.error = e; } };

eq("el reloj es el de Argentina", relojArgentino(AHORA), { hora: 9, min: 30, dia: 3, fecha: "2026-10-07" });
const pr = { on: true, when: "daily", hour: 8, day: 1, what: [] };
eq("le toca a su hora; antes no; apagado no; semanal solo su día",
   [leToca(pr, { hora: 8, dia: 3 }, null, AHORA), leToca(pr, { hora: 7, dia: 3 }, null, AHORA), leToca({ ...pr, on: false }, { hora: 8, dia: 3 }, null, AHORA),
    leToca({ ...pr, when: "weekly" }, { hora: 8, dia: 3 }, null, AHORA), leToca({ ...pr, when: "weekly", day: 3 }, { hora: 8, dia: 3 }, null, AHORA)],
   ["daily", null, null, null, "weekly"]);
eq("si ya salió hace un rato (el trabajo corrió dos veces), no otra vez", leToca(pr, { hora: 8, dia: 3 }, hace(1), AHORA), null);
// GitHub atrasa o se saltea los trabajos que corren solos: hasta el
// 7/10/2026, una corrida a las 10 en vez de las 9 dejaba a la persona sin
// resumen ese día (o esa semana entera).
eq("corrida atrasada: una hora después de su hora le llega igual; 12 horas después ya no",
   [leToca(pr, { hora: 9, min: 50, dia: 3 }, hace(25), AHORA), leToca(pr, { hora: 20, dia: 3 }, hace(36), AHORA)], ["daily", null]);
eq("pero si el de hoy ya salió a las 8:07, a las 9:07 no otra vez",
   leToca(pr, { hora: 9, min: 7, dia: 3 }, new Date(AHORA - 60 * 60000).toISOString(), AHORA), null);
eq("semanal: un día tarde le llega; tres días tarde, espera a la semana que viene",
   [leToca({ ...pr, when: "weekly", day: 2 }, { hora: 8, dia: 3 }, hace(7 * 24 + 24), AHORA), leToca({ ...pr, when: "weekly", day: 7 }, { hora: 8, dia: 3 }, hace(10 * 24), AHORA)],
   ["weekly", null]);
eq("desde el último que salió, pero no más atrás que su período más una semana",
   [desdeDe(hace(9 * 24), "weekly", AHORA), desdeDe(hace(40 * 24), "daily", AHORA), desdeDe(null, "daily", AHORA)],
   [hace(9 * 24), hace(8 * 24), hace(24)]);

{
  const reg = mundo();
  const r = await callado(() => main(AHORA));
  const c = reg.correos[0] || {};
  eq("a Benny, a las 9, su resumen del día", [r.enviados, c.to, c.from, c.reply_to], [1, [BENNY], "Registro de Acciones <info@team-latam.com>", BENNY]);
  eq("con la mención de las últimas 24 horas y la respuesta a su posteo (no la vieja, no la del sistema)",
     [c.subject, c.html.includes("Visita a Rosario"), c.html.includes("Viejo"), c.html.replace(/<[^>]+>/g, "").includes("1 respuesta en «Programa de becas»"), c.html.includes("Google Calendar")],
     ["Tu resumen del día: 1 mención, 1 respuesta", true, false, true, false]);
  eq("y queda anotado cuándo", reg.ultimos.map(x => x.email), [BENNY]);
}
{
  const reg = mundo({ ultimos: [{ email: BENNY, ultimo: hace(70) }] });
  await callado(() => main(AHORA));
  eq("desde el último resumen: si fue hace 70 horas, entra también la de hace 60", reg.correos[0].html.includes("Viejo"), true);
}
{
  const reg = mundo({ puede: {} });
  eq("a quien no puede recibir correos, nada", [(await callado(() => main(AHORA))).enviados, reg.correos.length], [0, 0]);
}
{
  const reg = mundo({ prefs: { [BENNY]: { when: "instant", what: ["menciones", "respuestas", "proximos"] } },
    marcas: [{ tipo: "posteo", objeto: "p1", email: BENNY }, { tipo: "respuesta", objeto: "r1", email: BENNY }] });
  await callado(() => main(AHORA));
  const c = reg.correos[0] || {};
  eq("«al momento»: lo de momento ya le llegó; acá solo lo que empieza pronto",
     [c.html && c.html.includes("Visita a Rosario"), c.html && c.html.includes("Empiezan pronto"), c.html && c.html.includes("Programa de becas")], [false, true, true]);
}
{
  // Lo que no llegó al momento (Resend falló, el tope, la pestaña se
  // cerró): sin su marca de enviado, va al resumen (7/10/2026).
  const reg = mundo({ prefs: { [BENNY]: { when: "instant" } } });
  await callado(() => main(AHORA));
  eq("«al momento»: la mención que no le llegó (sin marca de enviado) le llega en el resumen",
     !!(reg.correos[0] && reg.correos[0].html.includes("Visita a Rosario")), true);
  const otro = mundo({ prefs: { [BENNY]: { when: "instant" } }, marcas: [{ tipo: "posteo", objeto: "p1", email: BENNY }, { tipo: "respuesta", objeto: "r1", email: BENNY }] });
  const r = await callado(() => main(AHORA));
  eq("«al momento»: la que ya le llegó no se repite", [otro.correos.length], [0]);
}
{
  // Hasta el 10/10/2026 las marcas viejas se limpiaban solo si la corrida
  // caía a las 4 de Argentina, y GitHub (que atrasa horas los trabajos
  // programados) nunca la dejó caer ahí (docs/AUDITORIA.md, R10).
  const tarde = mundo();
  await callado(() => main(Date.parse("2026-10-07T18:00:00Z")));   // 15:00 en Argentina
  eq("en cada corrida (a las 15 también) se limpian las marcas viejas de avisos", tarde.borrados.map(x => x.split("?")[0]), ["avisos_enviados", "avisos_listos"]);
  const reg = mundo();
  await callado(() => main(Date.parse("2026-10-07T07:20:00Z")));   // 4:20 en Argentina
  eq("y a las 4, como antes", reg.borrados.map(x => x.split("?")[0]), ["avisos_enviados", "avisos_listos"]);
  process.env.EN_SECO = "1";
  const seco = mundo();
  await callado(() => main(AHORA));
  delete process.env.EN_SECO;
  eq("en seco, no se borra nada", seco.borrados.length, 0);
}
{
  const reg = mundo({ prefs: { [BENNY]: { what: ["nuevos"] } } });
  await callado(() => main(AHORA));
  eq("«actividades nuevas»: las de otros, no las propias", [reg.correos[0].html.includes("Visita a Rosario"), reg.correos[0].html.includes("Nuevo en el Registro")], [true, true]);
}
{
  const reg = mundo({ prefs: { [BENNY]: { what: [] } } });
  const r = await callado(() => main(AHORA));
  eq("si no hay nada que contar, no llega correo (pero se anota)", [r.enviados, reg.correos.length, reg.ultimos.length], [0, 0, 1]);
}
{
  const reg = mundo({ resendFalla: true });
  const r = await callado(() => main(AHORA));
  eq("si Resend falla, queda en rojo y NO se anota (la próxima vuelta lo reintenta)", [r.fallados, reg.ultimos.length], [1, 0]);
  process.exitCode = 0;
}
{
  const reg = mundo({ prefs: { [BENNY]: { hour: 18 } } });
  eq("a las 9 no, si eligió las 18", (await callado(() => main(AHORA))).enviados, 0);
}
{
  // Un semanal que se salteó (lo de hace 9 días quedaba afuera: se leía
  // solo lo de los últimos 8).
  const reg = mundo({ prefs: { [BENNY]: { when: "weekly", day: 2 } }, ultimos: [{ email: BENNY, ultimo: hace(9 * 24 + 1) }],
    mas: [{ id: "p9", title: "Charla en Lima", content: "@benny mirá esto", author_email: "ana@x.com", author_name: "Ana", mentions: [BENNY], created_at: hace(9 * 24 - 2), activity_type: "visita", start_date: "2026-09-28", end_date: "2026-09-28", scopes: [], cancelled: false }] });
  const r = await callado(() => main(AHORA));
  const c = reg.correos[0] || { subject: "", html: "" };
  eq("semanal atrasado un día: llega, y con lo de hace 9 días", [r.enviados, c.subject.startsWith("Tu resumen de la semana"), c.html.includes("Charla en Lima")], [1, true, true]);
}

/* ---------- Cada uno en su hora y en su idioma (decisión del 7/10/2026) ---------- */
eq("el reloj de Israel: a las 9:30 de Argentina son las 15:30 en Jerusalén; una zona que no existe cuenta como Argentina",
   [relojDe(AHORA, "Asia/Jerusalem").hora, relojDe(AHORA, "Marte/Olympus").hora], [15, 9]);
{
  const israel = mundo({ prefs: { [BENNY]: { hour: 15, tz: "Asia/Jerusalem" } } });
  const ri = await callado(() => main(AHORA));
  const arg = mundo({ prefs: { [BENNY]: { hour: 15 } } });
  const ra = await callado(() => main(AHORA));
  eq("quien eligió las 15 en Israel lo recibe a las 15 de Israel (9 de Argentina); en Argentina, todavía no", [ri.enviados, ra.enviados], [1, 0]);
}
{
  const reg = mundo({ prefs: { [BENNY]: { lang: "he" } } });
  await callado(() => main(AHORA));
  const c = reg.correos[0] || { subject: "", html: "" };
  eq("en hebreo: el asunto en hebreo y el correo de derecha a izquierda", [c.subject.startsWith("הסיכום היומי שלך"), /<html lang="he" dir="rtl">/.test(c.html)], [true, true]);
  const en = mundo({ prefs: { [BENNY]: { lang: "en" } } });
  await callado(() => main(AHORA));
  eq("en inglés", (en.correos[0] || {}).subject, "Your daily summary: 1 mention, 1 reply");
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
