/* ======================================================================
   «Lugares sin actividad»: el correo del primer lunes de cada mes,
   contra un Supabase y un Resend de mentira (13/10/2026, propuesta 2-A).

   Qué lugares cuentan, a quién le toca y cuándo, y que no se repita:
   - los países cuya última actividad HECHA es de hace más que el plazo; no
     lo planificado, no lo cancelado, no un alcance que no es país o ciudad,
     no un país que nunca tuvo nada; las series que se repiten cuentan hasta
     su última fecha;
   - el primer lunes del mes EN LA ZONA de cada admin, a partir de SU hora, y
     hasta el jueves; una sola vez por mes (la marca va primero);
   - no a quien apagó el aviso o los correos, ni a quien no puede recibirlos;
   - si Resend falla, se borra la marca y se reintenta a la hora siguiente;
   - si no hay ningún lugar, no llega nada.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
const { main, mesQueLeToca, configDeLugares, lugaresSinActividad, paisesDeLaApp, ultimaVez, expandirRepeticion, PLAZOS } = await import("../lugares.mjs");
const { textosDeLugares, correoLugares } = await import("../../functions/_compartido/correos.mjs");

/* ---------- El primer lunes del mes ---------- */
const reloj = (fecha, dia, hora = 9) => ({ fecha, dia, hora, min: 0 });
// Noviembre de 2026: el 1 es domingo, el primer lunes es el 2.
eq("el lunes 2/11 antes de su hora: todavía no", mesQueLeToca(reloj("2026-11-02", 1, 8), 9), null);
eq("el lunes 2/11 a su hora: sí", mesQueLeToca(reloj("2026-11-02", 1, 9), 9), "2026-11");
eq("el jueves 5/11 todavía vale (si la corrida del lunes falló)", mesQueLeToca(reloj("2026-11-05", 4, 3), 9), "2026-11");
eq("el viernes 6/11 ya no", mesQueLeToca(reloj("2026-11-06", 5), 9), null);
eq("el domingo 1/11, tampoco", mesQueLeToca(reloj("2026-11-01", 7), 9), null);
eq("el segundo lunes, no", mesQueLeToca(reloj("2026-11-09", 1), 9), null);
// Octubre de 2026: el 1 es jueves, el primer lunes es el 5.
eq("octubre: el 5 es el primer lunes", mesQueLeToca(reloj("2026-10-05", 1), 9), "2026-10");
eq("octubre: el domingo 4, no", mesQueLeToca(reloj("2026-10-04", 7), 9), null);
// Junio de 2026: el 1 es lunes.
eq("junio: el primer lunes es el día 1", mesQueLeToca(reloj("2026-06-01", 1), 9), "2026-06");
eq("junio: el jueves 4 vale y el viernes 5 no", [mesQueLeToca(reloj("2026-06-04", 4), 9), mesQueLeToca(reloj("2026-06-05", 5), 9)], ["2026-06", null]);
// Diciembre de 2026: el 1 es martes, el primer lunes es el 7.
eq("diciembre: el 7 es el primer lunes, el 1 no", [mesQueLeToca(reloj("2026-12-07", 1), 9), mesQueLeToca(reloj("2026-12-01", 2), 9)], ["2026-12", null]);

/* ---------- Lo que se guardó en Administración ---------- */
eq("sin nada guardado: prendido y 6 meses", configDeLugares(null), { on: true, meses: 6 });
eq("guardado: 12 meses", configDeLugares({ correos: { quienes: "admin", lugares: { on: true, meses: 12 } } }), { on: true, meses: 12 });
eq("apagado", configDeLugares({ correos: { lugares: { on: false, meses: 3 } } }), { on: false, meses: 3 });
eq("un plazo que no es 3, 6 ni 12 (guardado por la API) vale 6", configDeLugares({ correos: { lugares: { on: true, meses: 7 } } }).meses, 6);
eq("un «on» que no es sí/no vale prendido", configDeLugares({ correos: { lugares: { on: "no" } } }).on, true);
eq("los plazos que ofrece la pantalla", PLAZOS, [3, 6, 12]);

/* ---------- Qué lugares cuentan ---------- */
const HOY = "2026-10-15";
const { nombres, etiquetas } = paisesDeLaApp();
eq("los países de la app: LatAm sí, Israel no", [nombres.has("Chile"), nombres.has("Brasil"), nombres.has("Israel")], [true, true, false]);
eq("y sus nombres en los cuatro idiomas", [etiquetas.Brasil.en, etiquetas.Brasil.pt, etiquetas.Chile.he], ["Brazil", "Brasil", "צ'ילה"]);
const ps = (n, tipo = "pais") => [{ type: tipo, country: n }];
const post = (id, pais, inicio, extra = {}) => ({ id, start_date: inicio, date: inicio, cancelled: false, recurrence: null, recurrence_skip: [], scopes: ps(pais), ...extra });
const POSTS = [
  post("a", "Chile", "2026-02-10", { scopes: ps("Chile", "ciudad") }),
  post("a2", "Chile", "2026-11-20"),                               // y algo planeado
  post("b", "Perú", "2025-09-03"),
  post("c", "Argentina", "2026-09-01"),
  post("d", "Uruguay", "2026-12-01"),                              // solo planeado: nunca tuvo nada
  post("e", "Bolivia", "2025-03-01", { cancelled: true }),
  post("f", "Brasil", "2026-01-05", { recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=20260228T000000Z"] }),
  post("g", "Colombia", "2026-01-05", { recurrence: ["RRULE:FREQ=WEEKLY"] }),
  post("h", "Ecuador", "2025-01-01", { scopes: ps("Ecuador", "zona") }),
  post("i", "Israel", "2025-01-01"),
  post("j", "Paraguay", "2025-01-01", { recurrence: ["RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU"] }),
  post("k", "México", "2026-04-06", { recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=20260427T000000Z"], recurrence_skip: ["2026-04-27", "2026-04-20"] }),
  post("l", "Chile", "2025-12-01", { scopes: [{ type: "pais", country: "Chile" }, { type: "pais", country: "Venezuela" }] }),   // un posteo con dos países
];
const lista = lugaresSinActividad(POSTS, { hoy: HOY, meses: 6, paises: nombres });
eq("con 6 meses: Perú, Paraguay, Brasil, México, Venezuela y Chile, los de hace más primero",
  lista.map(l => `${l.pais} ${l.ultima}`),
  ["Paraguay 2025-01-01", "Perú 2025-09-03", "Venezuela 2025-12-01", "Chile 2026-02-10", "Brasil 2026-02-23", "México 2026-04-13"]);
eq("Chile: hace 8 meses, y con algo planeado el 20/11", lista.filter(l => l.pais === "Chile").map(l => [l.hace, l.plan]), [[8, "2026-11-20"]]);
eq("los demás no traen nada planeado", lista.filter(l => l.pais !== "Chile").map(l => l.plan), ["", "", "", "", ""]);
eq("no cuentan: lo cancelado, lo que no es país ni ciudad, lo de afuera de LatAm, lo que solo está planeado, lo reciente",
  ["Bolivia", "Ecuador", "Israel", "Uruguay", "Argentina", "Colombia"].filter(n => lista.some(l => l.pais === n)), []);
eq("con 3 meses es la misma lista: nadie tuvo actividad entre abril y julio",
  lugaresSinActividad(POSTS, { hoy: HOY, meses: 3, paises: nombres }).map(l => l.pais), ["Paraguay", "Perú", "Venezuela", "Chile", "Brasil", "México"]);
eq("con 12 meses, solo los de hace más de un año: Paraguay y Perú", lugaresSinActividad(POSTS, { hoy: HOY, meses: 12, paises: nombres }).map(l => l.pais), ["Paraguay", "Perú"]);
eq("sin posteos, no hay nada", lugaresSinActividad([], { hoy: HOY, meses: 6, paises: nombres }), []);
eq("una serie sin fin cuenta hasta hoy", ultimaVez(POSTS.find(p => p.id === "g"), HOY), "2026-10-12");
eq("una serie con fin, hasta el fin (el sábado 28/2 no hubo: el último lunes fue el 23)", ultimaVez(POSTS.find(p => p.id === "f"), HOY), "2026-02-23");
eq("una repetición que no se sabe expandir cuenta una sola vez, la del inicio", ultimaVez(POSTS.find(p => p.id === "j"), HOY), "2025-01-01");
eq("lo que todavía no pasó: nada", ultimaVez(POSTS.find(p => p.id === "d"), HOY), "");
eq("la serie empieza en el futuro: nada", ultimaVez(post("z", "Chile", "2027-01-04", { recurrence: ["RRULE:FREQ=WEEKLY"] }), HOY), "");
eq("expandir: semanal con COUNT", expandirRepeticion("2026-01-05", ["RRULE:FREQ=WEEKLY;COUNT=3"], "2026-01-01", "2026-12-31"), ["2026-01-05", "2026-01-12", "2026-01-19"]);
eq("expandir: una regla que no entiende, null", expandirRepeticion("2026-01-05", ["RRULE:FREQ=HOURLY"], "2026-01-01", "2026-12-31"), null);

/* ---------- Los textos del correo, en los cuatro idiomas ---------- */
{
  const claves = l => Object.keys(textosDeLugares(l)).sort().join();
  eq("los cuatro idiomas tienen las mismas claves", ["en", "pt", "he"].map(l => claves(l) === claves("es")), [true, true, true]);
  const sinHuecos = ["es", "en", "pt", "he"].every(l => {
    const c = correoLugares({ lugares: [{ pais: "Chile", ultima: "2026-02-10", hace: 8, plan: "2026-11-20" }, { pais: "Perú", ultima: "2025-09-03", hace: 13, plan: "" }], meses: 6, lang: l });
    return !/\{[a-z]+\}/.test(c.html + c.text + c.subject);
  });
  eq("ningún {hueco} sin llenar en ningún idioma", sinHuecos, true);
  const uno = correoLugares({ lugares: [{ pais: "Chile", ultima: "2026-02-10", hace: 8, plan: "" }], meses: 6, lang: "es" });
  const varios = correoLugares({ lugares: [{ pais: "Chile", ultima: "2026-02-10", hace: 8, plan: "" }, { pais: "Perú", ultima: "2025-09-03", hace: 13, plan: "" }], meses: 12, lang: "es" });
  eq("singular y plural en el asunto", [uno.subject, varios.subject], ["Lugares sin actividad: 1 país lleva 6 meses o más sin nada hecho", "Lugares sin actividad: 2 países llevan 12 meses o más sin nada hecho"]);
  eq("en hebreo, de derecha a izquierda", /dir="rtl"/.test(correoLugares({ lugares: [{ pais: "צ'ילה", ultima: "2026-02-10", hace: 8, plan: "" }], meses: 6, lang: "he" }).html), true);
  eq("un nombre con HTML no se cuela", correoLugares({ lugares: [{ pais: "<b>x</b>", ultima: "2026-02-10", hace: 8, plan: "" }], meses: 6, lang: "es" }).html.includes("<b>x</b>"), false);
}

/* ---------- La corrida, con una base y un Resend de mentira ---------- */
// Lunes 2/11/2026, 9:30 en Argentina (12:30 UTC).
const LUNES = Date.parse("2026-11-02T12:30:00Z");
function mundo({ preferencias = { correos: { quienes: "todos" } }, admins = ["otra@x.com"], prefs = {}, puede = null, resendFalla = [], marcas = [], posts = POSTS } = {}){
  const reg = { correos: [], marcas: [...marcas], borradas: [], consultas: [] };
  const deFabrica = { on: true, when: "daily", hour: 9, day: 1, lang: "es", tz: "America/Argentina/Buenos_Aires", pasos: true, vence: true, lugares: true, what: [] };
  const todos = ["benny@team-latam.com", "otra@x.com", "ana@x.com"];
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    const ok = d => new Response(d === null ? "" : JSON.stringify(d));
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      if(resendFalla.includes(c.to[0])) return new Response("{}", { status: 500 });
      reg.correos.push(c); return new Response("{}");
    }
    if(u.includes("/rpc/puede_recibir_correos")){ const e = JSON.parse(op.body).p_email; return ok(puede ? !!puede[e] : todos.includes(e)); }
    if(u.includes("/rpc/prefs_de_correo")) return ok({ ...deFabrica, ...(prefs[JSON.parse(op.body).p_email] || {}) });
    if(u.includes("/rest/v1/app_config")){ reg.consultas.push("app_config"); return ok(preferencias ? [{ value: preferencias }] : []); }
    if(u.includes("/rest/v1/members")){ if(!/role=eq\.admin/.test(u)) throw new Error("pidió todos los miembros"); return ok(admins.map(email => ({ email }))); }
    if(u.includes("/rest/v1/posts")){ reg.consultas.push("posts"); return ok(posts); }
    if(u.includes("/rest/v1/avisos_enviados")){
      if(op.method === "DELETE"){ const q = new URL(u).searchParams; reg.borradas.push(Object.fromEntries(q));
        const obj = q.get("objeto").slice(3), em = q.get("email").slice(3); reg.marcas = reg.marcas.filter(m => !(m.objeto === obj && m.email === em)); return ok(null); }
      const f = JSON.parse(op.body);
      if(reg.marcas.some(m => m.objeto === f.objeto && m.email === f.email && m.tipo === f.tipo)) return ok([]);
      reg.marcas.push(f); return ok([f]);
    }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try{ return await fn(); } finally { console.log = l; console.error = e; } };

// El primer lunes, a su hora: un correo a cada admin (el fijo y el de rol), no al integrante común.
{
  const reg = mundo();
  const r = await callado(() => main(LUNES));
  eq("a cada admin, uno: el fijo y el de rol; no a un integrante común", [r.enviados, reg.correos.map(c => c.to[0]).sort()], [2, ["benny@team-latam.com", "otra@x.com"]]);
  eq("anotado como enviado, una marca por persona y mes", reg.marcas.map(m => [m.tipo, m.objeto, m.email]).sort(), [["lugares", "2026-11", "benny@team-latam.com"], ["lugares", "2026-11", "otra@x.com"]]);
  const c = reg.correos[0];
  eq("en español, con la lista y el plazo de 6 meses", [c.subject, /lang="es"/.test(c.html), c.text.includes("• Paraguay"), c.text.includes("• Chile"), c.text.includes("• Argentina")],
    ["Lugares sin actividad: 6 países llevan 6 meses o más sin nada hecho", true, true, true, false]);
  eq("sale de info@, con el botón a la app", [/^Registro de Acciones/.test(c.from), c.html.includes("https://team-latam.github.io/registro-acciones/")], [true, true]);
  const r2 = await callado(() => main(LUNES + 3600000));
  eq("la corrida de la hora siguiente no lo repite", [r2.enviados, reg.correos.length], [0, 2]);
  const r3 = await callado(() => main(LUNES + 3 * 86400000));
  eq("ni el jueves de esa semana", [r3.enviados, reg.correos.length], [0, 2]);
}
// Cuándo no.
{
  const dado = async (cambios, ahora = LUNES) => { const reg = mundo(cambios); await callado(() => main(ahora)); return reg; };
  eq("antes de su hora (8:30), no", (await dado({}, LUNES - 3600000)).correos.length, 0);
  eq("el segundo lunes, no", (await dado({}, Date.parse("2026-11-09T12:30:00Z"))).correos.length, 0);
  eq("el jueves, si no salió el lunes, sí (la corrida atrasada)", (await dado({}, Date.parse("2026-11-05T12:30:00Z"))).correos.length, 2);
  eq("apagado en Administración → Correos, no, y ni siquiera lee los posteos", await dado({ preferencias: { correos: { lugares: { on: false, meses: 6 } } } }).then(r => [r.correos.length, r.consultas.includes("posts")]), [0, false]);
  eq("si apagó el aviso («lugares»), no le llega; al otro sí", (await dado({ prefs: { "benny@team-latam.com": { lugares: false } } })).correos.map(c => c.to[0]), ["otra@x.com"]);
  eq("si apagó todos los correos, no", (await dado({ prefs: { "benny@team-latam.com": { on: false }, "otra@x.com": { on: false } } })).correos.length, 0);
  eq("si no puede recibir correos (Administración → Correos), no", (await dado({ puede: { "benny@team-latam.com": true } })).correos.map(c => c.to[0]), ["benny@team-latam.com"]);
  eq("sin nada guardado en las preferencias, vale lo de fábrica: llega, con 6 meses", (await dado({ preferencias: null })).correos.length, 2);
  eq("con 12 meses, la lista cambia", (await dado({ preferencias: { correos: { lugares: { on: true, meses: 12 } } } })).correos[0].subject, "Lugares sin actividad: 2 países llevan 12 meses o más sin nada hecho");
}
// La zona de cada uno: a las 9:30 de Argentina todavía es de madrugada en Israel? No: allá son las 15:30. Pero el 1/11 en Israel ya es lunes 2.
{
  const reg = mundo({ prefs: { "otra@x.com": { tz: "Asia/Jerusalem", hour: 9, lang: "he" } }, puede: { "otra@x.com": true } });
  // 1/11 22:30 UTC = 2/11 00:30 en Jerusalén (UTC+2 en noviembre): ya es lunes, pero todavía no son las 9.
  await callado(() => main(Date.parse("2026-11-01T22:30:00Z")));
  eq("en Israel ya es lunes 2/11 pero no son las 9: todavía no", reg.correos.length, 0);
  await callado(() => main(Date.parse("2026-11-02T07:30:00Z")));
  eq("a las 9:30 de allá, le llega, en hebreo y con el país en hebreo", [reg.correos.length, /lang="he"/.test(reg.correos[0].html), reg.correos[0].text.includes("צ'ילה"), reg.correos[0].text.includes("• Chile")], [1, true, true, false]);
}
// Sin ningún lugar para avisar: no llega nada, y la marca queda (no se vuelve a calcular cada hora).
{
  const reg = mundo({ posts: [post("c", "Argentina", "2026-10-20")] });
  const r = await callado(() => main(LUNES));
  eq("sin lugares en esa situación, no llega nada", [r.enviados, reg.correos.length, reg.marcas.length], [0, 0, 2]);
}
// Si Resend falla, se borra la marca para reintentar; el otro admin lo recibe igual.
{
  const reg = mundo({ resendFalla: ["benny@team-latam.com"] });
  const r = await callado(() => main(LUNES));
  eq("Resend falla con uno: se cuenta, se borra su marca y el otro lo recibe igual", [r.fallados, r.enviados, reg.correos.map(c => c.to[0]), reg.borradas.length, reg.marcas.map(m => m.email)], [1, 1, ["otra@x.com"], 1, ["otra@x.com"]]);
  eq("la corrida termina con código de error, para que se note", process.exitCode, 1);
  process.exitCode = 0;
  const reg2 = mundo({ marcas: reg.marcas });
  const r2 = await callado(() => main(LUNES + 3600000));
  eq("a la hora siguiente reintenta solo el que faltó", [r2.enviados, reg2.correos.map(c => c.to[0])], [1, ["benny@team-latam.com"]]);
}
// El registro público: cantidades y nada más.
{
  mundo();
  const salida = []; const l = console.log; console.log = x => salida.push(String(x));
  await main(LUNES); console.log = l;
  eq("el registro de la corrida lleva cantidades y ningún correo ni país", [salida.length, /@|Chile|Perú|Paraguay/.test(salida.join(" "))], [1, false]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
