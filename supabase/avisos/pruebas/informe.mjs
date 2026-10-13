/* ======================================================================
   El informe mensual por correo, contra un Supabase y un Resend de mentira
   (13/10/2026, propuesta 3-A).

   A quién le toca y cuándo, qué lleva el correo y que no se repita:
   - el día 1 del mes en SU zona (hasta el 3), a partir de SU hora, el del mes que
     terminó (en enero, el de diciembre del año anterior);
   - solo a quienes eligió el admin, si siguen en el equipo y no apagaron los
     correos; apagado o sin nadie elegido, no se manda ni se lee nada más;
   - una sola vez por mes (la marca va primero) y, si Resend falla, se borra
     la marca para reintentar a la hora siguiente;
   - el correo lleva el enlace al informe y cuándo vence (48 horas después de la
     hora de la marca), en su idioma y en su hora, y ningún número.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
const { main, mesQueLeToca, configDelInforme } = await import("../informe.mjs");
const { correoInforme, textosDelInforme, enlaceAlInforme } = await import("../../functions/_compartido/correos.mjs");

/* ---------- Cuándo le toca ---------- */
const reloj = (fecha, hora = 9) => ({ fecha, hora, min: 0, dia: 1 });
eq("el día 1 antes de su hora: todavía no", mesQueLeToca(reloj("2026-11-01", 8), 9), null);
eq("el día 1 a su hora: el informe de octubre", mesQueLeToca(reloj("2026-11-01", 9), 9), "2026-10");
eq("el día 3 todavía vale (si la corrida del 1 falló)", mesQueLeToca(reloj("2026-11-03", 2), 9), "2026-10");
eq("el día 4 ya no: el enlace llegaría tarde", mesQueLeToca(reloj("2026-11-04", 12), 9), null);
eq("a mitad de mes, no", mesQueLeToca(reloj("2026-11-15", 12), 9), null);
eq("el 1 de enero es el informe de diciembre del año anterior", mesQueLeToca(reloj("2027-01-01", 9), 9), "2026-12");
eq("el 1 de marzo es el de febrero", mesQueLeToca(reloj("2026-03-01", 9), 9), "2026-02");

/* ---------- Lo que se guardó en Administración ---------- */
eq("sin nada guardado: apagado y sin nadie", configDelInforme(null), { on: false, para: [] });
eq("prendido con personas, en minúsculas y sin repetir", configDelInforme({ correos: { informe: { on: true, para: ["Jefe@X.com", "jefe@x.com", "ana@x.com"] } } }), { on: true, para: ["jefe@x.com", "ana@x.com"] });
eq("lo que no es un correo (guardado por la API) se descarta", configDelInforme({ correos: { informe: { on: true, para: ["jefe@x.com", 7, "", "sin arroba", null, { a: 1 }] } } }).para, ["jefe@x.com"]);
eq("un «on» que no es true vale apagado", configDelInforme({ correos: { informe: { on: "si", para: ["a@x.com"] } } }).on, false);
eq("como mucho 100 personas", configDelInforme({ correos: { informe: { on: true, para: Array.from({ length: 150 }, (_, i) => `p${i}@x.com`) } } }).para.length, 100);

/* ---------- El correo ---------- */
{
  const claves = l => Object.keys(textosDelInforme(l)).sort().join();
  eq("los cuatro idiomas tienen las mismas claves", ["en", "pt", "he"].map(l => claves(l) === claves("es")), [true, true, true]);
  const c = correoInforme({ mes: "2026-10", vence: "2026-11-03T12:30:00Z", lang: "es", zona: "America/Argentina/Buenos_Aires" });
  eq("en español: asunto, enlace al informe y cuándo vence (en su hora)", [c.subject, c.text.includes("https://team-latam.github.io/registro-acciones/?informe=2026-10"), c.text.includes("el martes, 3 de noviembre, 09:30")],
    ["Ya está el informe de octubre de 2026", true, true]);
  eq("avisa que a las 48 horas deja de andar y que los números no viajan en el correo", [/48 horas/.test(c.text), /no viajan dentro del correo/.test(c.text)], [true, true]);
  eq("la fecha de vencimiento va en la zona de cada uno", correoInforme({ mes: "2026-10", vence: "2026-11-03T12:30:00Z", lang: "es", zona: "Asia/Jerusalem" }).text.includes("14:30"), true);
  const sinHuecos = ["es", "en", "pt", "he"].every(l => { const x = correoInforme({ mes: "2026-10", vence: "2026-11-03T12:30:00Z", lang: l, zona: "America/Argentina/Buenos_Aires", prueba: true }); return !/\{[a-z]+\}/.test(x.html + x.text + x.subject); });
  eq("ningún {hueco} sin llenar en ningún idioma", sinHuecos, true);
  eq("en hebreo, de derecha a izquierda", /dir="rtl"/.test(correoInforme({ mes: "2026-10", vence: "2026-11-03T12:30:00Z", lang: "he" }).html), true);
  eq("la prueba lo dice; el de verdad, no", [/correo de prueba/.test(correoInforme({ mes: "2026-10", vence: "2026-11-03T12:30:00Z", lang: "es", prueba: true }).text), /correo de prueba/.test(c.text)], [true, false]);
  eq("el enlace, con el mes escapado", enlaceAlInforme("2026-10&x=1"), "https://team-latam.github.io/registro-acciones/?informe=2026-10%26x%3D1");
}

/* ---------- La corrida ---------- */
// Domingo 1/11/2026, 9:30 en Argentina (12:30 UTC).
const DIA1 = Date.parse("2026-11-01T12:30:00Z");
const config = (informe = { on: true, para: ["jefe@x.com", "ana@x.com"] }) => ({ correos: { quienes: "admin", informe } });
function mundo({ preferencias = config(), miembros = ["jefe@x.com", "ana@x.com", "benny@team-latam.com"], prefs = {}, resendFalla = [], marcas = [], ahora = () => DIA1 } = {}){
  const reg = { correos: [], marcas: [...marcas], borradas: [], consultas: [] };
  const deFabrica = { on: true, when: "daily", hour: 9, day: 1, lang: "es", tz: "America/Argentina/Buenos_Aires", pasos: true, vence: true, lugares: true, what: [] };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    const ok = d => new Response(d === null ? "" : JSON.stringify(d));
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      if(resendFalla.includes(c.to[0])) return new Response("{}", { status: 500 });
      reg.correos.push(c); return new Response("{}");
    }
    if(u.includes("/rpc/prefs_de_correo")){ reg.consultas.push("prefs"); return ok({ ...deFabrica, ...(prefs[JSON.parse(op.body).p_email] || {}) }); }
    if(u.includes("/rest/v1/app_config")){ reg.consultas.push("app_config"); return ok(preferencias ? [{ value: preferencias }] : []); }
    if(u.includes("/rest/v1/members")){ reg.consultas.push("members"); return ok(miembros.map(email => ({ email }))); }
    if(u.includes("/rest/v1/avisos_enviados")){
      if(op.method === "DELETE"){ const q = new URL(u).searchParams; reg.borradas.push(Object.fromEntries(q));
        const obj = q.get("objeto").slice(3), em = q.get("email").slice(3); reg.marcas = reg.marcas.filter(m => !(m.objeto === obj && m.email === em)); return ok(null); }
      const f = JSON.parse(op.body);
      if(reg.marcas.some(m => m.objeto === f.objeto && m.email === f.email && m.tipo === f.tipo)) return ok([]);
      const fila = { ...f, enviado_el: new Date(ahora()).toISOString() }; reg.marcas.push(fila); return ok([fila]);
    }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try{ return await fn(); } finally { console.log = l; console.error = e; } };

// El día 1, a su hora: a cada persona elegida, uno.
{
  const reg = mundo();
  const r = await callado(() => main(DIA1));
  eq("a cada persona elegida, uno", [r.enviados, reg.correos.map(c => c.to[0]).sort()], [2, ["ana@x.com", "jefe@x.com"]]);
  eq("anotado como enviado, una marca por persona, del mes que terminó", reg.marcas.map(m => [m.tipo, m.objeto, m.email]).sort(), [["informe", "2026-10", "ana@x.com"], ["informe", "2026-10", "jefe@x.com"]]);
  const c = reg.correos[0];
  eq("el correo trae el enlace al informe y vence 48 horas después de la marca (martes 3/11, 9:30)",
    [c.subject, c.text.includes("?informe=2026-10"), c.text.includes("el martes, 3 de noviembre, 09:30"), /^Registro de Acciones/.test(c.from)],
    ["Ya está el informe de octubre de 2026", true, true, true]);
  const r2 = await callado(() => main(DIA1 + 3600000));
  eq("la corrida de la hora siguiente no lo repite", [r2.enviados, reg.correos.length], [0, 2]);
  const r3 = await callado(() => main(DIA1 + 2 * 86400000));
  eq("ni el día 3", [r3.enviados, reg.correos.length], [0, 2]);
}
// Cuándo no.
{
  const dado = async (cambios, ahora = DIA1) => { const reg = mundo(cambios); await callado(() => main(ahora)); return reg; };
  eq("antes de su hora (8:30), no", (await dado({}, DIA1 - 3600000)).correos.length, 0);
  eq("el día 4, no", (await dado({}, Date.parse("2026-11-04T12:30:00Z"))).correos.length, 0);
  eq("el día 3, si no salió el 1, sí (la corrida atrasada)", (await dado({}, Date.parse("2026-11-03T12:30:00Z"))).correos.length, 2);
  eq("apagado: no manda ni lee los miembros", await dado({ preferencias: config({ on: false, para: ["jefe@x.com"] }) }).then(r => [r.correos.length, r.consultas.includes("members")]), [0, false]);
  eq("prendido pero sin nadie elegido, no", (await dado({ preferencias: config({ on: true, para: [] }) })).correos.length, 0);
  eq("sin nada guardado, no (de fábrica está apagado)", (await dado({ preferencias: null })).correos.length, 0);
  eq("una persona elegida que ya no es del equipo, no", (await dado({ miembros: ["ana@x.com"] })).correos.map(c => c.to[0]), ["ana@x.com"]);
  eq("si apagó todos sus correos, no", (await dado({ prefs: { "jefe@x.com": { on: false } } })).correos.map(c => c.to[0]), ["ana@x.com"]);
  eq("el 1 de enero llega el informe de diciembre", (await dado({}, Date.parse("2027-01-01T12:30:00Z"))).marcas.map(m => m.objeto), ["2026-12", "2026-12"]);
}
// La zona y el idioma de cada uno.
{
  const reg = mundo({ prefs: { "jefe@x.com": { tz: "Asia/Jerusalem", hour: 9, lang: "he" } } });
  // 31/10 22:30 UTC = 1/11 00:30 en Jerusalén (UTC+2): ya es día 1, pero todavía no son las 9.
  await callado(() => main(Date.parse("2026-10-31T22:30:00Z")));
  eq("en Israel ya es 1/11 pero no son las 9: todavía no (y a la otra persona, en Argentina, tampoco)", reg.correos.length, 0);
  await callado(() => main(Date.parse("2026-11-01T07:30:00Z")));
  eq("a las 9:30 de allá, le llega, en hebreo y de derecha a izquierda; a la de Argentina todavía no", [reg.correos.map(c => c.to[0]), /lang="he"/.test(reg.correos[0].html), /dir="rtl"/.test(reg.correos[0].html)], [["jefe@x.com"], true, true]);
}
// Si Resend falla, se borra la marca para reintentar; la otra persona lo recibe igual.
{
  const reg = mundo({ resendFalla: ["jefe@x.com"] });
  const r = await callado(() => main(DIA1));
  eq("Resend falla con uno: se cuenta, se borra su marca y el otro lo recibe igual", [r.fallados, r.enviados, reg.correos.map(c => c.to[0]), reg.borradas.length, reg.marcas.map(m => m.email)], [1, 1, ["ana@x.com"], 1, ["ana@x.com"]]);
  eq("la corrida termina con código de error, para que se note", process.exitCode, 1);
  process.exitCode = 0;
  const reg2 = mundo({ marcas: reg.marcas });
  const r2 = await callado(() => main(DIA1 + 3600000));
  eq("a la hora siguiente reintenta solo el que faltó", [r2.enviados, reg2.correos.map(c => c.to[0])], [1, ["jefe@x.com"]]);
}
// El registro público: cantidades y nada más.
{
  mundo();
  const salida = []; const l = console.log; console.log = x => salida.push(String(x));
  await main(DIA1); console.log = l;
  eq("el registro de la corrida lleva cantidades y ningún correo", [salida.length, /@/.test(salida.join(" "))], [1, false]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
