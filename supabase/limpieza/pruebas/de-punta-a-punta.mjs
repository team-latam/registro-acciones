/* ======================================================================
   La limpieza entera, contra un Supabase de mentira: qué pide, qué mueve,
   qué borra, y sobre todo cuándo NO toca nada. Es el mismo archivo que
   corre GitHub cada semana.
   ====================================================================== */
import { readFileSync } from "node:fs";
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const URL_DE_LA_APP = (/const SUPABASE_URL\s*=\s*"([^"]+)"/.exec(readFileSync(new URL("../../../index.html", import.meta.url), "utf8")) || [])[1];

// El Supabase de mentira: contesta la función con lo que diga el guion y
// anota cada pedido.
function baseDeMentira(guion){
  const reg = { pedidos: [] };
  globalThis.fetch = async (url, op = {}) => {
    const u = String(url), cuerpo = op.body ? JSON.parse(op.body) : null;
    reg.pedidos.push({ url: u, metodo: op.method || "GET", cuerpo, headers: op.headers });
    const responder = (datos, estado = 200) => ({ ok: estado < 400, status: estado,
      text: async () => datos === null ? "" : JSON.stringify(datos) });
    if(u.endsWith("/rest/v1/rpc/limpieza_del_bucket")) return responder(guion.estado);
    if(u.endsWith("/storage/v1/object/move")){
      if(guion.falla && guion.falla.test(cuerpo.sourceKey)) return responder({ message: "Object not found" }, 400);
      return responder({ message: "Successfully moved" });
    }
    if(u.endsWith("/storage/v1/object/adjuntos") && op.method === "DELETE")
      return responder(cuerpo.prefixes.map(name => ({ name })));
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}

const { main } = await import("../limpiar.mjs");
// Cada corrida con su propia configuración, callada, y con el código de
// salida limpio: el trabajo lo usa para quedar en rojo.
async function correr(env, guion){
  for(const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "EN_SECO", "SIN_TOPE", "RESTAURAR"]) delete process.env[k];
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "llave-de-mentira" }, env);
  const reg = baseDeMentira(guion || { estado: { total: 0, huerfanos: [], vencidos: [], restaurar: [] } });
  const log = console.log, salida = [];
  console.log = (...a) => salida.push(a.join(" "));
  process.exitCode = 0;
  let resultado = null, error = null;
  try{ resultado = await main(); }catch(e){ error = e.message; }
  finally{ console.log = log; }
  const codigo = process.exitCode; process.exitCode = 0;
  return { reg, resultado, error, codigo, texto: salida.join("\n"),
           movidas: reg.pedidos.filter(p => p.url.endsWith("/object/move")).map(p => [p.cuerpo.sourceKey, p.cuerpo.destinationKey]),
           borradas: reg.pedidos.filter(p => p.metodo === "DELETE").map(p => p.cuerpo.prefixes) };
}
const HOY = new Date().toISOString().slice(0, 10);
const estado = (extra = {}) => ({ estado: { total: 120, huerfanos: ["posts/p1/img1_1.jpg", "posts/p1/img1_1.min.jpg"],
  vencidos: ["papelera/2026-08-01/posts/x/a.jpg"], restaurar: [], ...extra } });

/* ---------- Lo de siempre ---------- */
{
  const r = await correr({}, estado());
  eq("la dirección del proyecto sale de index.html", r.reg.pedidos[0].url, URL_DE_LA_APP + "/rest/v1/rpc/limpieza_del_bucket");
  eq("con la llave de servicio", [r.reg.pedidos[0].headers.apikey, r.reg.pedidos[0].headers.Authorization], ["llave-de-mentira", "Bearer llave-de-mentira"]);
  eq("y dos días de gracia, treinta de papelera", r.reg.pedidos[0].cuerpo, { p_gracia: 2, p_papelera: 30, p_restaurar: null });
  eq("lo que sobra se MUEVE a la papelera de hoy, no se borra",
     r.movidas, [["posts/p1/img1_1.jpg", `papelera/${HOY}/posts/p1/img1_1.jpg`], ["posts/p1/img1_1.min.jpg", `papelera/${HOY}/posts/p1/img1_1.min.jpg`]]);
  eq("lo que lleva más de un mes en la papelera, sí se borra", r.borradas, [["papelera/2026-08-01/posts/x/a.jpg"]]);
  eq("y la corrida termina bien", [r.error, r.codigo, r.resultado.movidos, r.resultado.borrados], [null, 0, 2, 1]);
  eq("dice cómo devolver lo movido", r.texto.includes(`restaurar ${HOY}`), true);
}
{
  const r = await correr({}, { estado: { total: 50, huerfanos: [], vencidos: [], restaurar: [] } });
  eq("sin nada que limpiar, no mueve ni borra nada", [r.movidas, r.borradas, r.codigo], [[], [], 0]);
  eq("y lo dice", r.texto.includes("No había nada que limpiar"), true);
}

/* ---------- Cuándo no toca nada ---------- */
{
  const r = await correr({ EN_SECO: "1" }, estado());
  eq("en seco, dice qué haría sin mover ni borrar", [r.movidas, r.borradas], [[], []]);
  eq("y lo que haría, lo lista", r.texto.includes("posts/p1/img1_1.jpg") && r.texto.includes("papelera/2026-08-01"), true);
}
{
  // 41 de 120: más de un cuarto (y del mínimo de 40). Una cuenta así es
  // una cuenta que salió mal.
  const muchos = Array.from({ length: 41 }, (_, i) => `posts/p${i}/img0.jpg`);
  const r = await correr({}, estado({ huerfanos: muchos }));
  eq("si habría que mover demasiado, no se toca NADA", [r.movidas, r.borradas], [[], []]);
  eq("y la corrida queda en rojo para que alguien mire", [r.codigo, r.resultado.frenado], [1, true]);
  eq("diciendo por qué", r.texto.includes("No se tocó nada"), true);

  const s = await correr({ SIN_TOPE: "1" }, estado({ huerfanos: muchos }));
  eq("pedido a mano, sin tope, se mueve", s.movidas.length, 41);
}
{
  const r = await correr({}, estado({ total: 10, huerfanos: Array.from({ length: 8 }, (_, i) => `posts/p${i}/img0.jpg`) }));
  eq("en un bucket chico, el tope no frena una limpieza normal", r.movidas.length, 8);
  const grande = await correr({}, estado({ total: 1000, huerfanos: Array.from({ length: 200 }, (_, i) => `posts/p${i}/img0.jpg`) }));
  eq("y en uno grande, un quinto pasa", grande.movidas.length, 200);
}
{
  const r = await correr({ SUPABASE_SERVICE_ROLE_KEY: "" });
  eq("sin la llave, no arranca", r.error, "Falta SUPABASE_SERVICE_ROLE_KEY.");
  eq("ni le pide nada a nadie", r.reg.pedidos.length, 0);
}

/* ---------- Cuando algo falla ---------- */
{
  const r = await correr({}, { ...estado(), falla: /img1_1\.jpg$/ });
  eq("un archivo que no se puede mover no frena a los demás", r.movidas.length, 2);
  eq("pero queda dicho", [r.resultado.fallas.length, r.texto.includes("No se pudieron hacer 1")], [1, true]);
  eq("y la corrida queda en rojo", r.codigo, 1);
}
{
  const vencidos = Array.from({ length: 2300 }, (_, i) => `papelera/2026-08-01/posts/p${i}/a.jpg`);
  const r = await correr({}, estado({ huerfanos: [], vencidos }));
  eq("la papelera se vacía de a mil por pedido", r.borradas.map(t => t.length), [1000, 1000, 300]);
}

/* ---------- Devolver lo movido ---------- */
{
  const r = await correr({ RESTAURAR: "2026-09-20" }, estado({ restaurar: ["papelera/2026-09-20/posts/p1/img0.jpg", "papelera/2026-09-20/replies/r1/arch0.pdf"] }));
  eq("se le pregunta a la base qué se movió ese día", r.reg.pedidos[0].cuerpo.p_restaurar, "2026-09-20");
  eq("y cada archivo vuelve a su lugar", r.movidas, [["papelera/2026-09-20/posts/p1/img0.jpg", "posts/p1/img0.jpg"],
                                                    ["papelera/2026-09-20/replies/r1/arch0.pdf", "replies/r1/arch0.pdf"]]);
  eq("sin limpiar nada esa vez", r.borradas, []);
  const mal = await correr({ RESTAURAR: "ayer" });
  eq("una fecha mal escrita se rechaza antes de tocar nada", [mal.error, mal.reg.pedidos.length],
     ["RESTAURAR tiene que ser una fecha AAAA-MM-DD, no «ayer».", 0]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
