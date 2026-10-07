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
const { main, leToca, relojArgentino, armarResumen } = await import("../resumen.mjs");

// Miércoles 7/10/2026, 8:30 en Argentina (11:30 UTC).
const AHORA = Date.parse("2026-10-07T11:30:00Z");
const hace = h => new Date(AHORA - h * 3600000).toISOString();
const BENNY = "benny@team-latam.com";

function mundo({ prefs = {}, puede = { [BENNY]: true }, ultimos = [], resendFalla = false } = {}){
  const reg = { correos: [], ultimos: [] };
  const posts = [
    { id: "p1", title: "Visita a Rosario", content: "Hola @benny", author_email: "ana@x.com", author_name: "Ana", mentions: [BENNY], created_at: hace(3), activity_type: "visita", start_date: "2026-10-20", end_date: "2026-10-20", scopes: [{ city: "Rosario" }], cancelled: false },
    { id: "p2", title: "Programa de becas", content: "De Benny", author_email: BENNY, author_name: "Benny", mentions: [], created_at: hace(100), activity_type: "visita", start_date: "2026-10-08", end_date: "2026-10-08", scopes: [], cancelled: false },
    { id: "p3", title: "Viejo", content: "@benny de hace mucho", author_email: "ana@x.com", author_name: "Ana", mentions: [BENNY], created_at: hace(60), activity_type: "curso", start_date: "2026-11-01", end_date: "2026-11-01", scopes: [], cancelled: false },
  ];
  const replies = [
    { id: "r1", post_id: "p2", content: "Buenísimo", author_email: "juan@x.com", author_name: "Juan", mentions: [], created_at: hace(2), system: false },
    { id: "r2", post_id: "p2", content: "📅 Calendar", author_email: "", author_name: "Google Calendar", mentions: [], created_at: hace(2), system: true },
  ];
  const deFabrica = { on: true, when: "daily", hour: 8, day: 1, what: ["menciones", "respuestas"] };
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

eq("el reloj es el de Argentina", relojArgentino(AHORA), { hora: 8, dia: 3, fecha: "2026-10-07" });
const pr = { on: true, when: "daily", hour: 8, day: 1, what: [] };
eq("le toca a su hora; a otra hora no; apagado no; semanal solo su día",
   [leToca(pr, { hora: 8, dia: 3 }, null, AHORA), leToca(pr, { hora: 9, dia: 3 }, null, AHORA), leToca({ ...pr, on: false }, { hora: 8, dia: 3 }, null, AHORA),
    leToca({ ...pr, when: "weekly" }, { hora: 8, dia: 3 }, null, AHORA), leToca({ ...pr, when: "weekly", day: 3 }, { hora: 8, dia: 3 }, null, AHORA)],
   ["daily", null, null, null, "weekly"]);
eq("si ya salió hace un rato (el trabajo corrió dos veces), no otra vez", leToca(pr, { hora: 8, dia: 3 }, hace(1), AHORA), null);

{
  const reg = mundo();
  const r = await callado(() => main(AHORA));
  const c = reg.correos[0] || {};
  eq("a Benny, a las 8, su resumen del día", [r.enviados, c.to, c.from, c.reply_to], [1, [BENNY], "Registro de Acciones <info@team-latam.com>", BENNY]);
  eq("con la mención de las últimas 24 horas y la respuesta a su posteo (no la vieja, no la del sistema)",
     [c.subject, c.html.includes("Visita a Rosario"), c.html.includes("Viejo"), c.html.includes("1 respuesta en «Programa de becas»"), c.html.includes("Google Calendar")],
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
  const reg = mundo({ prefs: { [BENNY]: { when: "instant", what: ["menciones", "respuestas", "proximos"] } } });
  await callado(() => main(AHORA));
  const c = reg.correos[0] || {};
  eq("«al momento»: lo de momento ya le llegó; acá solo lo que empieza pronto",
     [c.html && c.html.includes("Visita a Rosario"), c.html && c.html.includes("Empiezan pronto"), c.html && c.html.includes("Programa de becas")], [false, true, true]);
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
  const reg = mundo({ prefs: { [BENNY]: { hour: 9 } } });
  eq("a las 8 no, si eligió las 9", (await callado(() => main(AHORA))).enviados, 0);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
