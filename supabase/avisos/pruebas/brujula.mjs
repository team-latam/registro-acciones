/* ======================================================================
   Brújula: el aviso a los admin cuando hay personas nuevas esperando acceso
   (supabase/avisos/brujula.mjs), contra un Supabase, un Google y un Resend de
   mentira, con gente inventada (@example.org).

   - viene apagado: sin la preferencia prendida no se lee ni una planilla;
   - solo cuenta a quien está cargado en una planilla y todavía no dice «Enviado»;
   - una sola vez por persona y por admin; después, solo las nuevas;
   - no a quien no puede recibir correos o apagó los suyos;
   - si Resend falla, se borran las marcas y se reintenta;
   - el correo en cada idioma, sin HTML colado y sin huecos.
   ====================================================================== */
import { generateKeyPairSync } from "node:crypto";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
process.env.GOOGLE_CUENTA_BRUJULA = JSON.stringify({ type: "service_account", client_email: "brujula@proyecto.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "https://oauth2.googleapis.com/token" });
const { main, configDeBrujula } = await import("../brujula.mjs");
const { correoPendientesBrujula, textos } = await import("../../functions/_compartido/correos.mjs");
const { olvidarPermisos } = await import("../../functions/_compartido/google.mjs");

/* ---------- Cuándo está prendido ---------- */
eq("sin nada guardado: apagado", configDeBrujula(null), { on: false });
eq("con las preferencias de siempre pero sin lo de Brújula: apagado", configDeBrujula({ correos: { quienes: "todos" } }), { on: false });
eq("prendido solo con un «true» de verdad", [configDeBrujula({ correos: { brujula: { on: true } } }).on, configDeBrujula({ correos: { brujula: { on: "si" } } }).on, configDeBrujula({ correos: { brujula: { on: false } } }).on], [true, false, false]);

/* ---------- El correo ---------- */
{
  const claves = l => Object.keys(textos(l)).filter(k => k.startsWith("bp")).sort().join();
  eq("los cuatro idiomas tienen los mismos textos del aviso", ["en", "pt", "he"].map(l => claves(l) === claves("es")), [true, true, true]);
  for(const l of ["es", "en", "pt", "he"]){
    const c = correoPendientesBrujula({ nombres: ["Ana Pérez", "<b>Luis</b>", "Mía"], total: 14, lang: l });
    eq(`${l}: sin {huecos}, sin HTML colado, con «y N más» y el botón a Toldot`, [!/\{[a-z]+\}/.test(c.html + c.text + c.subject), c.html.includes("<b>Luis</b>"), /11/.test(c.text), c.html.includes("https://team-latam.github.io/registro-acciones/"), /dir="rtl"/.test(c.html)], [true, false, true, true, l === "he"]);
  }
  eq("singular y plural en el asunto", [correoPendientesBrujula({ nombres: ["Ana"], total: 1, lang: "es" }).subject, correoPendientesBrujula({ nombres: ["Ana", "Luis"], total: 2, lang: "es" }).subject],
     ["Hay 1 persona esperando acceso a Brújula", "Hay 2 personas esperando acceso a Brújula"]);
}

/* ---------- La corrida ---------- */
const FILAS = [
  ["Ana Pérez", "ana@example.org", "Chile", "Español", ""],
  ["Luis <b>Sosa</b>", "luis@example.org", "Chile", "Español", "", "Error: no se pudo compartir"],
  ["Ya Procesada", "ya@example.org", "Chile", "Español", "Enviado"],
  ["sin correo", "", "", "", ""],
];
function mundo({ preferencias = { correos: { quienes: "todos", brujula: { on: true } } }, filas = FILAS, admins = ["otra@x.com"], puede = null, prefs = {}, resendFalla = [], marcas = [], planillas = [{ id: "PlanillaUnoAbCdEf" }], tokenNiega = false } = {}){
  const reg = { correos: [], marcas: [...marcas], borradas: [], google: 0, lecturas: [] };
  const todos = ["benny@team-latam.com", "otra@x.com"];
  const deFabrica = { on: true, when: "daily", hour: 9, day: 1, lang: "es", tz: "America/Argentina/Buenos_Aires" };
  olvidarPermisos();
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url);
    const ok = d => new Response(d === null ? "" : JSON.stringify(d));
    if(u === "https://oauth2.googleapis.com/token"){
      reg.google++;
      if(tokenNiega) return new Response("{}", { status: 400 });
      reg.scope = JSON.parse(Buffer.from(new URLSearchParams(op.body).get("assertion").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64")).scope;
      return ok({ access_token: "permiso", expires_in: 3600 });
    }
    if(u.includes("sheets.googleapis.com")){ reg.google++; reg.lecturas.push(u); return ok({ values: typeof filas === "function" ? filas() : filas }); }
    if(u === "https://api.resend.com/emails"){
      const c = JSON.parse(op.body);
      if(resendFalla.includes(c.to[0])) return new Response("{}", { status: 500 });
      reg.correos.push(c); return new Response("{}");
    }
    if(u.includes("/rpc/puede_recibir_correos")){ const e = JSON.parse(op.body).p_email; return ok(puede ? !!puede[e] : todos.includes(e)); }
    if(u.includes("/rpc/prefs_de_correo")) return ok({ ...deFabrica, ...(prefs[JSON.parse(op.body).p_email] || {}) });
    if(u.includes("/rest/v1/app_config")) return ok(preferencias ? [{ value: preferencias }] : []);
    if(u.includes("/rest/v1/brujula_planillas")) return ok(planillas);
    if(u.includes("/rest/v1/members")) return ok(admins.map(email => ({ email })));
    if(u.includes("/rest/v1/avisos_enviados")){
      const q = new URL(u).searchParams;
      if(op.method === "DELETE"){ reg.borradas.push(Object.fromEntries(q)); const obj = q.get("objeto").slice(3), em = q.get("email").slice(3); reg.marcas = reg.marcas.filter(m => !(m.objeto === obj && m.email === em)); return ok(null); }
      if(op.method === "POST"){
        const nuevas = JSON.parse(op.body).filter(f => !reg.marcas.some(m => m.objeto === f.objeto && m.email === f.email && m.tipo === f.tipo));
        reg.marcas.push(...nuevas); return ok(nuevas);
      }
      return ok(reg.marcas.filter(m => m.tipo === q.get("tipo").slice(3) && m.email === q.get("email").slice(3)).map(m => ({ objeto: m.objeto })));
    }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log, e = console.error; console.log = () => {}; console.error = () => {};
  try{ return await fn(); } finally { console.log = l; console.error = e; } };

{
  const reg = mundo({ preferencias: { correos: { quienes: "todos", brujula: { on: false } } } });
  const r = await callado(() => main());
  eq("apagado (de fábrica): no se lee Google, no se manda nada", [r.enviados, reg.google, reg.correos.length], [0, 0, 0]);
}
{
  const reg = mundo({ preferencias: null });
  const r = await callado(() => main());
  eq("sin preferencias guardadas: también apagado", [r.enviados, reg.google], [0, 0]);
}
{
  const reg = mundo();
  const r = await callado(() => main());
  eq("prendido: un correo a cada admin que puede recibir (el fijo y el de rol)", [r.enviados, reg.correos.map(c => c.to[0]).sort()], [2, ["benny@team-latam.com", "otra@x.com"]]);
  eq("cuenta a los que esperan: cargados y sin «Enviado» (no a quien ya está, ni a una fila sin correo)", r.pendientes, 2);
  eq("lee la planilla con un permiso de solo lectura", reg.scope, "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly");
  const c = reg.correos[0];
  eq("asunto en español, con los dos nombres y el nombre con HTML sin colarse", [c.subject, c.text.includes("• Ana Pérez"), c.html.includes("<b>Sosa</b>"), c.text.includes("Ya Procesada")], ["Hay 2 personas esperando acceso a Brújula", true, false, false]);
  eq("sale de Toldot, con el botón a la app", [/^Toldot/.test(c.from), c.html.includes("https://team-latam.github.io/registro-acciones/")], [true, true]);
  eq("una marca por persona y por admin", reg.marcas.map(m => [m.tipo, m.objeto, m.email]).sort(), [["brujula", "ana@example.org", "benny@team-latam.com"], ["brujula", "ana@example.org", "otra@x.com"], ["brujula", "luis@example.org", "benny@team-latam.com"], ["brujula", "luis@example.org", "otra@x.com"]]);
  const r2 = await callado(() => main());
  eq("la corrida de la hora siguiente no lo repite", [r2.enviados, reg.correos.length], [0, 2]);
}
{
  // Aparece alguien nuevo: el correo es solo de esa persona, y el total sigue contando a todos.
  let filas = FILAS;
  const reg = mundo({ filas: () => filas, admins: [] });
  await callado(() => main());
  filas = [...FILAS, ["Nuevo Ingreso", "nuevo@example.org", "Chile", "Inglés", ""]];
  const r = await callado(() => main());
  const c = reg.correos.at(-1);
  eq("después, solo la persona nueva, pero el asunto cuenta a todos los que esperan", [r.enviados, c.subject, c.text.includes("• Nuevo Ingreso"), c.text.includes("• Ana Pérez")], [1, "Hay 3 personas esperando acceso a Brújula", true, false]);
  filas = FILAS.map(f => f[1] === "ana@example.org" ? [f[0], f[1], f[2], f[3], "Enviado"] : f);
  const r2 = await callado(() => main());
  eq("quien ya recibió acceso deja de contar y no genera otro aviso", [r2.enviados, r2.pendientes], [0, 1]);
}
{
  const reg = mundo({ puede: { "benny@team-latam.com": true, "otra@x.com": false } });
  await callado(() => main());
  eq("no le llega a quien no puede recibir correos", reg.correos.map(c => c.to[0]), ["benny@team-latam.com"]);
}
{
  const reg = mundo({ prefs: { "otra@x.com": { on: false } } });
  await callado(() => main());
  eq("ni a quien apagó todos sus correos", reg.correos.map(c => c.to[0]), ["benny@team-latam.com"]);
}
{
  const reg = mundo({ prefs: { "benny@team-latam.com": { lang: "he" } }, admins: [] });
  await callado(() => main());
  eq("en el idioma de cada admin (hebreo, de derecha a izquierda)", [reg.correos[0].subject, /dir="rtl"/.test(reg.correos[0].html)], ["ממתינים 2 אנשים לגישה ל-Brújula", true]);
}
{
  const reg = mundo({ resendFalla: ["otra@x.com"] });
  const r = await callado(() => main());
  eq("si Resend falla con uno, el otro lo recibe y la corrida lo cuenta", [r.enviados, r.fallados, reg.correos.map(c => c.to[0])], [1, 1, ["benny@team-latam.com"]]);
  eq("al que falló se le borran las marcas (así se reintenta a la hora siguiente), al otro no", reg.marcas.map(m => m.email).sort(), ["benny@team-latam.com", "benny@team-latam.com"]);
  process.exitCode = 0;
}
{
  const reg = mundo({ planillas: [] });
  const r = await callado(() => main());
  eq("sin planillas en el catálogo: no hace nada", [r.enviados, reg.google], [0, 0]);
}
{
  const reg = mundo({ filas: [["Ya", "ya@example.org", "", "", "Enviado"]] });
  const r = await callado(() => main());
  eq("si nadie espera, no llega nada", [r.enviados, r.pendientes, reg.correos.length], [0, 0, 0]);
}
{
  delete process.env.GOOGLE_CUENTA_BRUJULA;
  const reg = mundo();
  const r = await callado(() => main());
  eq("sin la llave de Google no hace nada (y no rompe)", [r.enviados, reg.google], [0, 0]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
