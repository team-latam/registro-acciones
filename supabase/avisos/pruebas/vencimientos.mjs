/* ======================================================================
   «Hoy vence»: el recordatorio de un paso de «Lo que sigue», contra un
   Supabase y un Resend de mentira (13/10/2026, propuesta 1-B).

   A quién le toca, qué lleva y que no se repita:
   - solo los pasos pendientes, con responsable y fecha, de posteos en pie;
   - el día que vence EN LA ZONA de cada persona, a partir de SU hora;
   - no el que le dieron hoy mismo, ni si apagó «El día que vence» o los
     correos, ni si no puede recibirlos;
   - una sola vez (la marca va primero) y, si Resend falla, se borra la marca
     para reintentar a la hora siguiente;
   - como mucho cinco por persona y por corrida.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
const { main, pasosConFecha, TOPE_POR_PERSONA } = await import("../vencimientos.mjs");

// Jueves 15/10/2026, 9:30 en Argentina (12:30 UTC).
const AHORA = Date.parse("2026-10-15T12:30:00Z");
const HOY = "2026-10-15";
const ANTES = "2026-10-14T20:00:00Z";    // asignado ayer
const paso = (id, extra = {}) => ({ id, t: "Paso " + id, estado: "pendiente", resp: "diego@x.com", para: HOY, asigPor: "ana@x.com", asigEl: ANTES, ...extra });
const posteo = (id, pasos, extra = {}) => ({ id, title: "Visita " + id, activity_type: "visita", cancelled: false, resumen: { v: 2, partes: [{ tipo: "cierre", pasos }] }, ...extra });

function mundo({ posts, prefs = {}, puede = { "diego@x.com": true, "ana@x.com": true, "moshe@x.com": true }, resendFalla = [], marcas = [] } = {}){
  const reg = { correos: [], marcas: [...marcas], borradas: [], consultas: [] };
  const deFabrica = { on: true, when: "daily", hour: 9, day: 1, lang: "es", tz: "America/Argentina/Buenos_Aires", pasos: true, vence: true, what: [] };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    const ok = d => new Response(d === null ? "" : JSON.stringify(d));
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      if(resendFalla.includes(c.to[0])) return new Response("{}", { status: 500 });
      reg.correos.push(c); return new Response("{}");
    }
    if(u.includes("/rpc/puede_recibir_correos")) return ok(!!puede[JSON.parse(op.body).p_email]);
    if(u.includes("/rpc/prefs_de_correo")) return ok({ ...deFabrica, ...(prefs[JSON.parse(op.body).p_email] || {}) });
    if(u.includes("/rest/v1/posts")){ reg.consultas.push(u.split("/rest/v1/")[1]); return ok(posts); }
    if(u.includes("/rest/v1/avisos_enviados")){
      if(op.method === "DELETE"){ reg.borradas.push(Object.fromEntries(new URL(u).searchParams)); const k = decodeURIComponent(new URL(u).searchParams.get("objeto")); reg.marcas = reg.marcas.filter(m => !k.endsWith(m.objeto.slice(-5)) && true); return ok(null); }
      const f = JSON.parse(op.body);
      if(reg.marcas.some(m => m.objeto === f.objeto && m.email === f.email)) return ok([]);   // ya estaba: la base no devuelve nada
      reg.marcas.push(f); return ok([f]);
    }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try{ return await fn(); } finally { console.log = l; console.error = e; } };

// Qué pasos cuenta.
eq("solo los pendientes, con responsable y fecha, de posteos en pie",
  pasosConFecha([
    posteo("p1", [paso("a"), paso("b", { estado: "hecho" }), paso("c", { estado: "no" }), paso("d", { resp: "" }), paso("e", { para: "" }), paso("f", { para: "mañana" }), paso("g", { resp: "Diego@X.com" })]),
    posteo("p2", [paso("h")], { cancelled: true }),
    posteo("p3", [paso("i")], { resumen: null }),
    posteo("p4", [paso("j")], { resumen: { v: 1 } }),
  ]).map(x => x.post + "#" + x.paso + ":" + x.resp),
  ["p1#a:diego@x.com", "p1#g:diego@x.com"]);

// A su hora de fábrica (las 9, hora argentina), un recordatorio por paso que vence hoy.
{
  const reg = mundo({ posts: [posteo("p1", [paso("a"), paso("b", { para: "2026-10-16" }), paso("c", { para: "2026-10-14" })])] });
  const r = await callado(() => main(AHORA));
  eq("a su hora, el que vence hoy: un correo; el de mañana y el de ayer, no", [r.enviados, reg.correos.length, reg.correos[0].to, reg.correos[0].subject], [1, 1, ["diego@x.com"], "Hoy vence: Paso a"]);
  eq("anotado como enviado, una sola marca", reg.marcas.map(m => [m.tipo, m.objeto, m.email]), [["paso-vence", "p1#a@2026-10-15", "diego@x.com"]]);
  eq("en español, con el enlace al posteo", [/lang="es"/.test(reg.correos[0].html), reg.correos[0].text.includes("?post=p1")], [true, true]);
  // La corrida de la hora siguiente no lo repite.
  const r2 = await callado(() => main(AHORA + 3600000));
  eq("la corrida siguiente no lo repite", [r2.enviados, reg.correos.length], [0, 1]);
}
// Antes de su hora, todavía no; con otra hora, esa.
{
  const reg = mundo({ posts: [posteo("p1", [paso("a")])], prefs: { "diego@x.com": { hour: 13 } } });
  await callado(() => main(AHORA));
  eq("antes de su hora (las 13), todavía no", reg.correos.length, 0);
  await callado(() => main(AHORA + 4 * 3600000));
  eq("a las 13:30, sí", reg.correos.length, 1);
}
// La zona de cada uno: en Israel ya es otro día.
{
  const reg = mundo({ posts: [posteo("p1", [paso("a", { para: "2026-10-16" })])], prefs: { "diego@x.com": { tz: "Asia/Jerusalem", hour: 9, lang: "he" } } });
  // 15/10 22:30 UTC = 16/10 01:30 en Jerusalén (UTC+3): ya es el 16, pero todavía no son las 9.
  await callado(() => main(Date.parse("2026-10-15T22:30:00Z")));
  eq("en Israel ya es el 16 pero no son las 9: todavía no", reg.correos.length, 0);
  await callado(() => main(Date.parse("2026-10-16T06:30:00Z")));
  eq("a las 9:30 en Israel (16/10), le llega, en hebreo y de derecha a izquierda", [reg.correos.length, /lang="he"/.test(reg.correos[0].html), /dir="rtl"/.test(reg.correos[0].html)], [1, true, true]);
}
// Cuándo no.
{
  const dado = async (cambios, posts) => { const reg = mundo({ posts: posts || [posteo("p1", [paso("a")])], ...cambios }); await callado(() => main(AHORA)); return reg.correos.length; };
  eq("si apagó «El día que vence», no", await dado({ prefs: { "diego@x.com": { vence: false } } }), 0);
  eq("si apagó todos los correos, no", await dado({ prefs: { "diego@x.com": { on: false } } }), 0);
  eq("si no puede recibir correos (Administración → Correos), no", await dado({ puede: { "ana@x.com": true } }), 0);
  eq("el que le dieron hoy mismo, no: se acaba de enterar", await dado({}, [posteo("p1", [paso("a", { asigEl: "2026-10-15T11:00:00Z" })])]), 0);
  eq("el que le dieron ayer, sí", await dado({}, [posteo("p1", [paso("a", { asigEl: "2026-10-14T11:00:00Z" })])]), 1);
  eq("un posteo cancelado, no", await dado({}, [posteo("p1", [paso("a")], { cancelled: true })]), 0);
}
// Si Resend falla, se borra la marca para reintentar; y las demás personas reciben igual.
{
  const reg = mundo({ posts: [posteo("p1", [paso("a"), paso("b", { resp: "moshe@x.com" })])], resendFalla: ["diego@x.com"] });
  const r = await callado(() => main(AHORA));
  eq("Resend falla con uno: se cuenta, se borra su marca y el otro lo recibe igual", [r.fallados, r.enviados, reg.correos.map(c => c.to[0]), reg.borradas.length, reg.marcas.map(m => m.email)], [1, 1, ["moshe@x.com"], 1, ["moshe@x.com"]]);
  eq("la corrida termina con código de error, para que se note", process.exitCode, 1);
  process.exitCode = 0;
}
// El tope por persona.
{
  const muchos = Array.from({ length: 8 }, (_, i) => paso("s" + i));
  const reg = mundo({ posts: [posteo("p1", muchos)] });
  await callado(() => main(AHORA));
  eq(`como mucho ${TOPE_POR_PERSONA} por persona y por corrida`, reg.correos.length, TOPE_POR_PERSONA);
}
// Lo que se lee: solo posteos con resumen, y el registro público no lleva nada personal.
{
  const reg = mundo({ posts: [posteo("p1", [paso("a")])] });
  const salida = []; const l = console.log; console.log = x => salida.push(String(x));
  await main(AHORA); console.log = l;
  eq("solo se leen los posteos con resumen", reg.consultas.every(c => /resumen=not\.is\.null/.test(c)), true);
  eq("el registro de la corrida lleva cantidades y ningún correo ni título", [salida.length, /@|Visita p1|Paso a/.test(salida.join(" "))], [1, false]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
