/* ======================================================================
   Los ejemplos de los correos nuevos (supabase/avisos/ejemplos.mjs), contra
   un Supabase y un Resend de mentira (13/10/2026).

   - Mandan DOS correos y solo al administrador fijo: «Lugares sin actividad»
     (marcado como ejemplo) y el «Informe mensual» del último mes completo
     (marcado como prueba), en su idioma y su hora;
   - la lista de lugares es la de verdad de hoy; si no hay con el plazo, con 3
     meses; y si tampoco, una inventada;
   - el informe deja la marca «informe-prueba» (para que el botón abra el informe
     48 horas) y dice cuándo vence;
   - no se lee a nadie más, y el registro de la corrida lleva cantidades.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.RESEND_API_KEY = "re_de_mentira";
const { main } = await import("../ejemplos.mjs");

const AHORA = Date.parse("2026-10-13T12:30:00Z");
const ps = n => [{ type: "pais", country: n }];
const post = (id, pais, inicio) => ({ id, start_date: inicio, date: inicio, cancelled: false, recurrence: null, recurrence_skip: [], scopes: ps(pais) });
function mundo({ posts, preferencias = { correos: { lugares: { on: true, meses: 6 } } }, pr = {} } = {}){
  const reg = { correos: [], marcas: [], consultas: [], rpc: [] };
  const deFabrica = { on: true, hour: 9, lang: "es", tz: "America/Argentina/Buenos_Aires" };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url); const ok = d => new Response(JSON.stringify(d));
    if(u === "https://api.resend.com/emails"){ reg.correos.push(JSON.parse(op.body)); return new Response("{}"); }
    if(u.includes("/rpc/")){ const n = u.split("/rpc/")[1]; reg.rpc.push([n, JSON.parse(op.body).p_email]); if(n === "prefs_de_correo") return ok({ ...deFabrica, ...pr }); }
    if(u.includes("/rest/v1/app_config")) return ok([{ value: preferencias }]);
    if(u.includes("/rest/v1/posts")){ reg.consultas.push("posts"); return ok(posts); }
    if(u.includes("/rest/v1/avisos_enviados")){ const f = JSON.parse(op.body); const fila = { ...f }; reg.marcas.push({ ...f, prefer: op.headers.Prefer }); return ok([fila]); }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}
const callado = async fn => { const l = console.log; console.log = () => {}; try{ return await fn(); } finally { console.log = l; } };

// Con lugares de verdad.
{
  const reg = mundo({ posts: [post("a", "Chile", "2026-02-10"), post("b", "Perú", "2025-09-03"), post("c", "Argentina", "2026-10-01")] });
  const r = await callado(() => main(AHORA));
  eq("manda dos correos, los dos al administrador fijo", [r.enviados, reg.correos.map(c => c.to)], [2, [["benny@team-latam.com"], ["benny@team-latam.com"]]]);
  eq("el primero: lugares sin actividad, de verdad (Chile y Perú; Argentina no), y marcado como ejemplo", [reg.correos[0].subject, reg.correos[0].text.includes("• Perú"), reg.correos[0].text.includes("• Chile"), reg.correos[0].text.includes("• Argentina"), /correo de ejemplo/.test(reg.correos[0].text), r.deVerdad], ["[Ejemplo] Lugares sin actividad: 2 países llevan 6 meses o más sin nada hecho", true, true, false, true, true]);
  eq("el segundo: el informe del último mes completo, con el enlace y marcado como prueba", [reg.correos[1].subject, reg.correos[1].text.includes("?informe=2026-09"), /correo de prueba/.test(reg.correos[1].text)], ["Ya está el informe de septiembre de 2026", true, true]);
  eq("deja la marca de prueba para que el enlace abra el informe, con el mes y el administrador", reg.marcas.map(m => [m.tipo, m.objeto, m.email, m.enviado_el]), [["informe-prueba", "2026-09", "benny@team-latam.com", "2026-10-13T12:30:00.000Z"]]);
  eq("y dice cuándo vence: 48 horas después, en su hora (jueves 15/10, 9:30)", /el jueves, 15 de octubre, 09:30/.test(reg.correos[1].text), true);
  eq("solo le preguntó a la base por las preferencias del administrador", reg.rpc, [["prefs_de_correo", "benny@team-latam.com"]]);
}
// Sin nada con el plazo guardado (12 meses): prueba con 3.
{
  const reg = mundo({ preferencias: { correos: { lugares: { on: true, meses: 12 } } }, posts: [post("a", "Chile", "2026-06-10")] });
  const r = await callado(() => main(AHORA));
  eq("con 12 meses no hay nada; con 3 sí: Chile", [r.meses, r.deVerdad, reg.correos[0].text.includes("• Chile")], [3, true, true]);
}
// Sin nada de nada: una lista inventada, y el correo sigue diciendo que es un ejemplo.
{
  const reg = mundo({ posts: [post("a", "Chile", "2026-10-01")] });
  const r = await callado(() => main(AHORA));
  eq("si hoy no hay ningún país sin actividad, un ejemplo inventado", [r.deVerdad, r.lugares, /correo de ejemplo/.test(reg.correos[0].text)], [false, 3, true]);
}
// El idioma y la zona del administrador.
{
  const reg = mundo({ posts: [post("a", "Chile", "2026-02-10")], pr: { lang: "he", tz: "Asia/Jerusalem" } });
  await callado(() => main(AHORA));
  eq("en hebreo, de derecha a izquierda, y con el país en hebreo", [/lang="he"/.test(reg.correos[0].html), /dir="rtl"/.test(reg.correos[1].html), reg.correos[0].text.includes("צ'ילה")], [true, true, true]);
}
// El registro público.
{
  mundo({ posts: [post("a", "Chile", "2026-02-10")] });
  const salida = []; const l = console.log; console.log = x => salida.push(String(x));
  await main(AHORA); console.log = l;
  eq("el registro de la corrida lleva cantidades y ningún correo ni país", [salida.length, /@|Chile/.test(salida.join(" "))], [1, false]);
}

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
