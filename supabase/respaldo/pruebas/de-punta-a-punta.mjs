/* ======================================================================
   La copia semanal entera, contra un Supabase de mentira: que lea cada
   tabla de a páginas, que baje solo los archivos nuevos (y nunca los de
   la papelera), que no escriba fuera de su carpeta, que avise lo que no
   pudo copiar, y que en el registro no aparezca ningún dato.
   ====================================================================== */
import { readFileSync, readdirSync, mkdtempSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = new URL("../../../", import.meta.url);
const URL_DE_LA_APP = (/const SUPABASE_URL\s*=\s*"([^"]+)"/.exec(readFileSync(new URL("index.html", RAIZ), "utf8")) || [])[1];
const { main, TABLAS } = await import("../respaldar.mjs");

// Toda tabla de supabase/*.sql tiene que estar en TABLAS, o la copia la
// dejaría afuera sin avisar.
const enElSql = readdirSync(new URL("supabase/", RAIZ)).filter(f => /^\d\d-.*\.sql$/.test(f))
  .flatMap(f => [...readFileSync(new URL("supabase/" + f, RAIZ), "utf8").matchAll(/create table if not exists public\.(\w+)/g)].map(m => m[1]));
eq("la copia conoce todas las tablas del esquema", [...new Set(enElSql)].sort(), Object.keys(TABLAS).sort());
// Y el botón de la app (Administración › Copia de seguridad) copia las mismas.
const enLaApp = (/const TABLAS_DE_LA_COPIA = \{([^}]+)\}/.exec(readFileSync(new URL("index.html", RAIZ), "utf8")) || [])[1] || "";
eq("el botón de la app copia las mismas tablas, con las mismas claves", Object.fromEntries([...enLaApp.matchAll(/(\w+): "(\w+)"/g)].map(m => [m[1], m[2]])), TABLAS);

const SECRETO = "dato-privado-que-no-va-al-registro";
function baseDeMentira({ posts = 2500, bucket, falla } = {}){
  const reg = { pedidos: [] };
  const filas = t => t === "posts" ? Array.from({ length: posts }, (_, i) => ({ id: "p" + String(i).padStart(5, "0"), title: SECRETO })) : [{ x: t }];
  globalThis.fetch = async (url, op = {}) => {
    const u = new URL(String(url)), cuerpo = op.body ? JSON.parse(op.body) : null;
    reg.pedidos.push({ url: String(url), metodo: op.method || "GET", cuerpo, headers: op.headers });
    const json = (d, s = 200) => ({ ok: s < 400, status: s, text: async () => JSON.stringify(d), arrayBuffer: async () => new ArrayBuffer(0) });
    const m = u.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if(m){
      const desde = Number(u.searchParams.get("offset")), hasta = desde + Number(u.searchParams.get("limit"));
      if(falla === m[1]) return json({ message: SECRETO }, 500);
      return json(filas(m[1]).slice(desde, hasta));
    }
    if(u.pathname === "/storage/v1/object/list/adjuntos"){
      const nivel = bucket[cuerpo.prefix] || [];
      return json(nivel.slice(cuerpo.offset, cuerpo.offset + cuerpo.limit));
    }
    const a = u.pathname.match(/^\/storage\/v1\/object\/adjuntos\/(.+)$/);
    if(a){
      const ruta = decodeURIComponent(a[1]);
      if(ruta.includes("rota")) return { ok: false, status: 404, text: async () => "", arrayBuffer: async () => new ArrayBuffer(0) };
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("contenido de " + ruta).buffer };
    }
    throw new Error("pedido inesperado: " + url);
  };
  return reg;
}
async function correr(destino, guion){
  for(const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DESTINO"]) delete process.env[k];
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: "llave-de-mentira", DESTINO: destino });
  const reg = baseDeMentira(guion);
  const log = console.log, salida = [];
  console.log = (...x) => salida.push(x.join(" "));
  process.exitCode = 0;
  let resultado = null, error = null;
  try{ resultado = await main(); }catch(e){ error = e.message; } finally{ console.log = log; }
  const codigo = process.exitCode; process.exitCode = 0;
  return { reg, resultado, error, codigo, texto: salida.join("\n"),
    bajadas: reg.pedidos.filter(p => p.url.includes("/storage/v1/object/adjuntos/")).map(p => decodeURIComponent(p.url.split("/object/adjuntos/")[1])) };
}
const BUCKET = {
  "": [{ name: "posts", id: null }, { name: "papelera", id: null }, { name: "suelto.pdf", id: "1" }],
  "posts": [{ name: "p1", id: null }, { name: "p 2", id: null }],
  "posts/p1": [{ name: "img0_1.jpg", id: "2" }, { name: "img0_1.min.jpg", id: "3" }],
  "posts/p 2": [{ name: "acta ñ.pdf", id: "4" }],
  "papelera": [{ name: "2026-09-01", id: null }],
  "papelera/2026-09-01": [{ name: "viejo.jpg", id: "5" }],
};

/* ---------- La primera copia ---------- */
const dir = mkdtempSync(join(tmpdir(), "respaldo-"));
{
  const r = await correr(dir, { bucket: BUCKET });
  eq("termina bien", [r.error, r.codigo], [null, 0]);
  eq("la dirección sale de index.html y va con la llave de servicio", [r.reg.pedidos[0].url.startsWith(URL_DE_LA_APP + "/rest/v1/"), r.reg.pedidos[0].headers.apikey], [true, "llave-de-mentira"]);
  const posts = JSON.parse(readFileSync(join(dir, "datos/posts.json"), "utf8"));
  eq("una tabla de más de mil filas sale entera (leída de a páginas, en orden)", [posts.length, posts[0].id, posts[2499].id], [2500, "p00000", "p02499"]);
  eq("y de a mil, ordenada por su clave", r.reg.pedidos.filter(p => p.url.includes("/rest/v1/posts")).map(p => new URL(p.url).search),
     ["?select=*&order=id.asc&limit=1000&offset=0", "?select=*&order=id.asc&limit=1000&offset=1000", "?select=*&order=id.asc&limit=1000&offset=2000"]);
  eq("cada tabla tiene su archivo", readdirSync(join(dir, "datos")).sort(), Object.keys(TABLAS).map(t => t + ".json").sort());
  eq("baja todos los archivos, recorriendo carpetas, y nunca la papelera", r.bajadas.sort(), ["posts/p 2/acta ñ.pdf", "posts/p1/img0_1.jpg", "posts/p1/img0_1.min.jpg", "suelto.pdf"]);
  eq("con su ruta y su contenido", readFileSync(join(dir, "archivos/posts/p 2/acta ñ.pdf"), "utf8"), "contenido de posts/p 2/acta ñ.pdf");
  eq("deja el LEEME", existsSync(join(dir, "LEEME.md")), true);
  eq("en el registro, cantidades y ningún dato", [r.texto.includes("2500"), r.texto.includes(SECRETO), r.texto.includes("acta")], [true, false, false]);
}
/* ---------- La semana siguiente ---------- */
{
  const r = await correr(dir, { bucket: { ...BUCKET, "posts/p1": [...BUCKET["posts/p1"], { name: "img1_1.jpg", id: "6" }] } });
  eq("la semana siguiente solo baja lo nuevo", r.bajadas, ["posts/p1/img1_1.jpg"]);
  eq("y lo cuenta", r.texto.includes("nuevos desde la copia anterior: 1"), true);
}
{
  const r = await correr(dir, { bucket: { "": [{ name: "suelto.pdf", id: "1" }] } });
  eq("lo que se borró del bucket se queda en la copia", existsSync(join(dir, "archivos/posts/p1/img0_1.jpg")), true);
}
/* ---------- Lo que sale mal ---------- */
{
  const d2 = mkdtempSync(join(tmpdir(), "respaldo-"));
  const r = await correr(d2, { posts: 3, falla: "replies", bucket: { "": [{ name: "rota.jpg", id: "1" }, { name: "bien.jpg", id: "2" }] } });
  eq("si una tabla o un archivo fallan, sigue con el resto", [existsSync(join(d2, "datos/posts.json")), existsSync(join(d2, "archivos/bien.jpg"))], [true, true]);
  eq("pero la corrida queda en rojo y lo dice", [r.codigo, r.resultado.fallas.length, r.texto.includes("Quedaron 2 cosas sin copiar")], [1, 2, true]);
  eq("sin repetir en el registro lo que contestó Supabase", r.texto.includes(SECRETO), false);
}
{
  const d3 = mkdtempSync(join(tmpdir(), "respaldo-"));
  const r = await correr(d3, { bucket: { "": [{ name: "..", id: null }], "..": [{ name: "fuera.txt", id: "1" }] } });
  eq("una ruta con .. no escribe fuera de archivos/", [existsSync(join(d3, "fuera.txt")), r.codigo], [false, 1]);
}
{
  delete process.env.DESTINO;
  const r = await correr("", { bucket: {} });
  eq("sin carpeta de destino, no arranca", /DESTINO/.test(r.error || ""), true);
}
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
