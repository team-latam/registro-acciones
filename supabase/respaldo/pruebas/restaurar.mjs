/* ======================================================================
   Restaurar una copia, contra un Supabase de mentira (docs/AUDITORIA.md,
   I7): que cargue las tablas en orden y de a lotes, pisando y sin borrar;
   que lea las dos formas de copia (la del domingo y la del botón de la
   app); que traiga filas sueltas con SOLO; que suba los archivos sin
   pisar los que están y nunca los de la papelera; que se niegue a tocar
   el proyecto de verdad por olvido; y que en el registro no haya datos.
   ====================================================================== */
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = new URL("../../../", import.meta.url);
const URL_DE_LA_APP = (/const SUPABASE_URL\s*=\s*"([^"]+)"/.exec(readFileSync(new URL("index.html", RAIZ), "utf8")) || [])[1];
const { main, ORDEN, leerSolo, tipoDe } = await import("../restaurar.mjs");
const { TABLAS } = await import("../respaldar.mjs");
const PRUEBA = "https://proyecto-de-prueba.supabase.co";
const SECRETO = "dato-privado-que-no-va-al-registro";

eq("restaura todas las tablas que copia la copia", [...ORDEN].sort(), Object.keys(TABLAS).sort());
eq("los comentarios, después de sus posteos", ORDEN.indexOf("posts") < ORDEN.indexOf("replies"), true);

// Una copia en disco: { "datos/posts.json": [...], "archivos/x": Buffer }
function copia(contenido){
  const dir = mkdtempSync(join(tmpdir(), "restaurar-"));
  for(const [ruta, valor] of Object.entries(contenido)){
    mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    writeFileSync(join(dir, ruta), Buffer.isBuffer(valor) ? valor : typeof valor === "string" ? valor : JSON.stringify(valor));
  }
  return dir;
}
function supabaseDeMentira({ yaEstan = [], falla } = {}){
  const reg = { pedidos: [], cargas: [], subidas: [] };
  globalThis.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    reg.pedidos.push({ url: String(url), metodo: op.method || "GET", headers: op.headers });
    const resp = (s, d) => ({ ok: s < 400, status: s, json: async () => d, text: async () => JSON.stringify(d) });
    const m = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if(m){
      if(falla === m[1]) return resp(500, { message: SECRETO });
      reg.cargas.push({ tabla: m[1], conflicto: u.searchParams.get("on_conflict"), prefer: op.headers.Prefer, filas: JSON.parse(op.body) });
      return resp(201, null);
    }
    const a = u.pathname.match(/^\/storage\/v1\/object\/adjuntos\/(.+)$/);
    if(a){
      const ruta = a[1].split("/").map(decodeURIComponent).join("/");
      // Supabase contesta «ya existe» con un 400 que adentro dice 409.
      if(yaEstan.includes(ruta)) return resp(400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
      reg.subidas.push({ ruta, tipo: op.headers["Content-Type"], upsert: op.headers["x-upsert"], bytes: op.body.length });
      return resp(200, { Key: ruta });
    }
    throw new Error("pedido inesperado: " + url);
  };
  return reg;
}
async function correr(env, guion = {}){
  for(const k of ["ORIGEN","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","QUE","SOLO","ES_PRODUCCION","SIN_ESCRIBIR"]) delete process.env[k];
  Object.assign(process.env, { SUPABASE_URL: PRUEBA, SUPABASE_SERVICE_ROLE_KEY: "llave-de-prueba" }, env);
  const reg = supabaseDeMentira(guion);
  const log = console.log, salida = [];
  console.log = (...x) => salida.push(x.join(" "));
  process.exitCode = 0;
  let resultado = null, error = null;
  try{ resultado = await main(); }catch(e){ error = e.message; } finally{ console.log = log; }
  const codigo = process.exitCode; process.exitCode = 0;
  return { reg, resultado, error, codigo, texto: salida.join("\n") };
}

const posts = Array.from({ length: 1200 }, (_, i) => ({ id: "p" + String(i).padStart(4, "0"), title: SECRETO }));
posts[1].images = ["posts/p0001/img0_1.jpg"];
posts[2].files = [{ name: "acta ñ.pdf", path: "posts/p 2/acta ñ.pdf" }];
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const DOMINGO = copia({
  "datos/posts.json": posts,
  "datos/replies.json": [{ id: "r1", post_id: "p0001", content: SECRETO }],
  "datos/members.json": [{ email: "ana@x.com", name: "Ana" }],
  "datos/app_config.json": [{ key: "preferences", value: {} }],
  "archivos/posts/p0001/img0_1.jpg": Buffer.from("jpeg"),
  "archivos/posts/p0001/img0_1.min.jpg": WEBP,
  "archivos/posts/p 2/acta ñ.pdf": Buffer.from("pdf"),
  "archivos/papelera/2026-09-01/viejo.jpg": Buffer.from("viejo"),
});

/* ---------- La copia del domingo, entera ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO });
  eq("termina bien", [r.error, r.codigo], [null, 0]);
  eq("va al proyecto que se le dice, con su llave", [r.reg.pedidos[0].url.startsWith(PRUEBA + "/"), r.reg.pedidos[0].headers.apikey], [true, "llave-de-prueba"]);
  eq("las tablas en orden: personas, configuración, posteos y después comentarios",
    [...new Set(r.reg.cargas.map(c => c.tabla))], ["members", "app_config", "posts", "replies"]);
  eq("de a 500 filas", r.reg.cargas.filter(c => c.tabla === "posts").map(c => c.filas.length), [500, 500, 200]);
  eq("todas, tal cual estaban", r.reg.cargas.filter(c => c.tabla === "posts").flatMap(c => c.filas).map(f => f.id), posts.map(p => p.id));
  eq("pisando la que ya existe por su clave, sin borrar ninguna",
    [r.reg.cargas[0].conflicto, r.reg.cargas.find(c => c.tabla === "app_config").conflicto, r.reg.cargas[0].prefer, r.reg.pedidos.some(p => p.metodo === "DELETE")],
    ["email", "key", "resolution=merge-duplicates,return=minimal", false]);
  eq("sube los archivos con su ruta, y nunca la papelera", r.reg.subidas.map(s => s.ruta).sort(),
    ["posts/p 2/acta ñ.pdf", "posts/p0001/img0_1.jpg", "posts/p0001/img0_1.min.jpg"]);
  eq("sin pisar ninguno", r.reg.subidas.every(s => s.upsert === "false"), true);
  eq("con su tipo; la miniatura que es WebP por dentro, como WebP",
    r.reg.subidas.map(s => [s.ruta, s.tipo]).sort(),
    [["posts/p 2/acta ñ.pdf", "application/pdf"], ["posts/p0001/img0_1.jpg", "image/jpeg"], ["posts/p0001/img0_1.min.jpg", "image/webp"]]);
  eq("en el registro, cantidades y ningún dato", [r.texto.includes("1203 filas"), r.texto.includes(SECRETO), r.texto.includes("acta")], [true, false, false]);
}
/* ---------- Lo que ya estaba en el bucket ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO, QUE: "archivos" }, { yaEstan: ["posts/p0001/img0_1.jpg"] });
  eq("solo archivos: no toca las tablas", r.reg.cargas.length, 0);
  eq("lo que ya está, se deja y se cuenta", [r.resultado.subidos, r.resultado.estaban, r.codigo], [2, 1, 0]);
}
/* ---------- La copia del botón de la app ---------- */
{
  const dir = copia({ "datos.json": { generada: "2026-10-06", tablas: { posts: posts.slice(0, 3), audit_log: [{ id: "a1" }], otra_cosa: [{ x: 1 }] } } });
  const r = await correr({ ORIGEN: dir, QUE: "tablas" });
  eq("lee datos.json de la copia que baja la app", r.reg.cargas.map(c => [c.tabla, c.filas.length]), [["posts", 3], ["audit_log", 1]]);
}
/* ---------- Filas sueltas ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO, SOLO: "posts:p0001,p9999;replies:r1" });
  eq("SOLO: trae solo esas filas", r.reg.cargas.map(c => [c.tabla, c.filas.map(f => f.id)]), [["posts", ["p0001"]], ["replies", ["r1"]]]);
  eq("SOLO: y solo los archivos de lo que trajo (la foto y su miniatura)", r.reg.subidas.map(s => s.ruta).sort(), ["posts/p0001/img0_1.jpg", "posts/p0001/img0_1.min.jpg"]);
  eq("avisa la que no está en la copia, sin nombrarla", [r.codigo, r.texto.includes("1 de las pedidas no están"), r.texto.includes("p9999")], [1, true, false]);
  eq("SOLO con una tabla que no existe, no arranca", (await correr({ ORIGEN: DOMINGO, SOLO: "postz:p1" })).error.includes("postz"), true);
  eq("leerSolo junta y separa bien", Object.fromEntries(Object.entries(leerSolo(" posts:a, b ; posts:c;replies:r")).map(([k, v]) => [k, [...v]])), { posts: ["a", "b", "c"], replies: ["r"] });
}
/* ---------- Sin escribir ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO, SIN_ESCRIBIR: "si" });
  eq("SIN_ESCRIBIR: no manda nada", r.reg.pedidos.length, 0);
  eq("pero cuenta lo que haría", [r.resultado.filas, r.resultado.subidos], [1203, 3]);
}
/* ---------- Lo que sale mal ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO, QUE: "tablas" }, { falla: "posts" });
  eq("si una tabla falla, sigue con las demás", r.reg.cargas.map(c => c.tabla), ["members", "app_config", "replies"]);
  eq("pero queda en rojo, sin repetir lo que contestó Supabase", [r.codigo, r.texto.includes("Quedaron 3 cosas"), r.texto.includes(SECRETO)], [1, true, false]);
}
/* ---------- Los frenos ---------- */
{
  const r = await correr({ ORIGEN: DOMINGO, SUPABASE_URL: URL_DE_LA_APP });
  eq("se niega a tocar el proyecto de la app sin ES_PRODUCCION=si", [/ES_PRODUCCION/.test(r.error || ""), r.reg.pedidos.length], [true, 0]);
  const r2 = await correr({ ORIGEN: DOMINGO, SUPABASE_URL: URL_DE_LA_APP + "/", QUE: "tablas", SOLO: "posts:p0001", ES_PRODUCCION: "si" });
  eq("con ES_PRODUCCION=si, sí (para traer de vuelta algo borrado)", [r2.error, r2.reg.cargas.length], [null, 1]);
  delete process.env.SUPABASE_URL;
  const r3 = await correr({ ORIGEN: DOMINGO, SUPABASE_URL: "" });
  eq("sin SUPABASE_URL no arranca (nunca la saca de index.html)", [/SUPABASE_URL/.test(r3.error || ""), r3.reg.pedidos.length], [true, 0]);
  const r4 = await correr({ ORIGEN: copia({ "otra.txt": "x" }) });
  eq("una carpeta que no es una copia, lo dice", /datos/.test(r4.error || ""), true);
}
eq("el tipo de un archivo sin extensión conocida", [tipoDe("a.docx"), tipoDe("nota.weba"), tipoDe("raro.xyz")],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "audio/webm", "application/octet-stream"]);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
