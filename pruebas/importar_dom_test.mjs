import { chromium } from "playwright";
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   La importación final, de punta a punta, en un navegador de verdad

   imp_test.mjs prueba cada pieza del importador por separado. Esta lo usa
   como lo va a usar el admin el día de la mudanza: elige el archivo, mira
   la comparación, elige la importación final, revisa la lista de lo que
   se saca, confirma y aprieta el botón. Es una página que se usa una sola
   vez, y en el peor momento para descubrir que un botón no se habilita.

   Supabase no se alcanza desde acá: la página se carga con un Supabase de
   mentira en lugar del de la CDN, que guarda todo en memoria y anota cada
   pedido. Las miniaturas, en cambio, las arma el canvas de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const PAGINA = fs.readFileSync(process.env.IMPORTAR || RAIZ + "supabase/importar.html", "utf8");
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";

// El Supabase de mentira. Lo que hay en la base vive en window.__sb, que
// la prueba arma antes de cargar la página y mira después.
const FALSO = `
const estado = window.__sb;
const claveDe = t => ({ members:"email", former_members:"email", access_requests:"email",
                        user_prefs:"email", app_config:"key" }[t] || "id");
const copia = x => JSON.parse(JSON.stringify(x));
export function createClient(){
  return {
    auth: {
      getSession: async () => ({ data: { session: estado.sesion } }),
      onAuthStateChange: fn => { estado.alCambiar = fn; return { data: { subscription: { unsubscribe(){} } } }; },
      signOut: async () => { estado.sesion = null; if(estado.alCambiar) estado.alCambiar("SIGNED_OUT", null); },
      signInWithOAuth: async () => ({ error: null }),
    },
    from(tabla){
      const q = { contar: false };
      const api = {
        select(cols, op){ q.contar = !!(op && op.count); return api; },
        order(){ return api; },
        range(desde, hasta){
          const k = claveDe(tabla);
          const todas = copia(estado.tablas[tabla] || []).sort((a, b) => String(a[k]) < String(b[k]) ? -1 : 1);
          return Promise.resolve({ data: todas.slice(desde, hasta + 1), error: null, count: q.contar ? todas.length : null });
        },
      };
      return api;
    },
    async rpc(nombre, args){
      estado.rpc.push([nombre, copia(args)]);
      if(nombre === "importar"){
        const t = estado.tablas[args.p_tabla] = estado.tablas[args.p_tabla] || [];
        const k = claveDe(args.p_tabla);
        // Como la de verdad: una fila que la base no acepta tira la tanda entera.
        if(args.p_filas.some(f => f.post_id === "no_existe"))
          return { data: null, error: { code: "23503", message: "insert or update on table replies violates foreign key constraint" } };
        let n = 0;
        args.p_filas.forEach(f => {
          const i = t.findIndex(x => String(x[k]) === String(f[k]));
          if(i < 0){ t.push(copia(f)); n++; }
          else if(args.p_reemplazar && JSON.stringify(t[i]) !== JSON.stringify(f)){ t[i] = copia(f); n++; }
        });
        return { data: n, error: null };
      }
      if(nombre === "importar_quitar"){
        const k = claveDe(args.p_tabla), t = estado.tablas[args.p_tabla] || [];
        const antes = t.length;
        estado.tablas[args.p_tabla] = t.filter(f => !args.p_claves.includes(f[k]));
        if(args.p_tabla === "posts")
          estado.tablas.replies = (estado.tablas.replies || []).filter(r => !args.p_claves.includes(r.post_id));
        return { data: antes - estado.tablas[args.p_tabla].length, error: null };
      }
      if(nombre === "cuantas_filas")
        return { data: Object.keys(estado.tablas).map(t => ({ tabla: t, filas: estado.tablas[t].length })), error: null };
      return { data: null, error: { message: "no existe " + nombre } };
    },
    storage: { from(){ return {
      list: async dir => ({ data: copia(estado.objetos[dir] || []), error: null }),
      upload: async (ruta, blob, op) => {
        const corte = ruta.lastIndexOf("/"), dir = ruta.slice(0, corte), nombre = ruta.slice(corte + 1);
        if((estado.objetos[dir] || []).some(o => o.name === nombre))
          return { error: { statusCode: "409", message: "The resource already exists" } };
        (estado.objetos[dir] = estado.objetos[dir] || []).push({ name: nombre, metadata: {} });
        estado.subidas.push({ ruta, tipo: blob.type, tam: blob.size, upsert: !!op.upsert });
        return { error: null };
      } }; } },
  };
}`;

// Lo que ya había en Supabase: lo de la primera importación, más lo que se
// probó acá, más lo que después se borró en Firebase.
const EN_SUPABASE = {
  posts: [
    { id: "p_igual", title: "Igual", start_date: "2026-09-01" },
    { id: "p_cambia", title: "Antes", start_date: "2026-09-02" },
    { id: "p_borrado", title: "Borrado en Firebase", start_date: "2026-09-03" },
    { id: "cal_x1", title: "Reunión de prueba", start_date: "2026-09-04" },
  ],
  replies: [
    { id: "r_del_borrado", post_id: "p_borrado", content: "un comentario del posteo borrado" },
    { id: "r_suelto", post_id: "p_igual", content: "probando en Supabase", system: false },
  ],
  members: [{ email: "benny@team-latam.com", name: "Benny" }, { email: "se.fue@x.com", name: "Se Fue" }],
  former_members: [],
  access_requests: [{ email: "vieja@x.com", name: "Vieja", status: "pending" }],
  audit_log: [{ id: "a_de_supabase" }],
  app_config: [{ key: "preferences" }],
  user_prefs: [],
};

const b = await chromium.launch();

// Una foto de verdad, armada con un canvas: la miniatura se arma de ella.
const pFoto = await b.newPage();
const FOTO = await pFoto.evaluate(() => {
  const c = document.createElement("canvas"); c.width = 1600; c.height = 1200;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 1600, 1200); g.addColorStop(0, "#0e7490"); g.addColorStop(1, "#facc15");
  x.fillStyle = g; x.fillRect(0, 0, 1600, 1200);
  return c.toDataURL("image/jpeg", 0.85);
});
await pFoto.close();
const DOCX = "data:application/octet-stream;base64," + Buffer.from("PK un word").toString("base64");

const respaldo = (generado = new Date().toISOString()) => ({
  formato: 1, origen: "firestore", conAdjuntos: true, generado,
  posts: [
    { id: "p_igual", title: "Igual", content: "C", date: "2026-09-01", startDate: "2026-09-01", endDate: "2026-09-01", activityType: "visita", authorName: "Ana" },
    { id: "p_cambia", title: "Después", content: "C", date: "2026-09-02", startDate: "2026-09-02", endDate: "2026-09-02", activityType: "visita", authorName: "Ana" },
    { id: "p_nuevo", title: "Nuevo con todo", content: "C", date: "2026-09-05", startDate: "2026-09-05", endDate: "2026-09-05", activityType: "visita", authorName: "Ana",
      images: [FOTO],
      files: [{ name: "Reporte.docx", dataUrl: DOCX, doc: "reporte", kind: "doc", subidoEl: "2026-09-05T10:00:00.000Z" }] },
  ],
  replies: [{ id: "r_nuevo", postId: "p_nuevo", content: "¡Qué bueno!", authorName: "Juan" }],
  allowlist: [{ id: "benny@team-latam.com", email: "benny@team-latam.com", name: "Benny" }],
  formerMembers: [{ id: "se.fue@x.com", email: "se.fue@x.com", name: "Se Fue" }],
  accessRequests: [],
  auditLog: [{ id: "a1", type: "login", actorEmail: "ana@x.com" }],
  meta: { preferences: { calendarId: "equipo@group.calendar.google.com", maxImages: 6, maxAttachmentFileBytes: 153600 },
          calendarSync: { syncToken: "token-de-firebase" } },
  userPrefs: {},
});

async function abrir(){
  const p = await b.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error") errores.push(m.text()); });
  await p.route("**/*", ruta => {
    const url = ruta.request().url();
    if(url === CDN) return ruta.fulfill({ status: 200, contentType: "application/javascript",
      headers: { "access-control-allow-origin": "*" }, body: FALSO });
    if(url === "https://prueba.local/importar.html") return ruta.fulfill({ status: 200, contentType: "text/html", body: PAGINA });
    return ruta.abort();
  });
  await p.addInitScript(tablas => {
    window.__sb = { tablas, rpc: [], subidas: [], objetos: {}, sesion: { user: { email: "benny@team-latam.com" } } };
  }, JSON.parse(JSON.stringify(EN_SUPABASE)));
  await p.goto("https://prueba.local/importar.html");
  await p.waitForSelector("#btnSalir");
  return { p, errores };
}
const elegir = (p, datos) => p.setInputFiles("#archivo",
  { name: "registro-acciones-respaldo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(datos)) });
const fila = (p, tabla) => p.evaluate(t => {
  const tr = [...document.querySelectorAll("#zonaArchivo tr")].find(x => x.textContent.trim().startsWith(t + " ") || (x.cells[0] && x.cells[0].textContent === t));
  return tr ? [...tr.cells].slice(1).map(c => c.textContent) : null;
}, tabla);

/* ---------- La importación final ---------- */
{
  const { p, errores } = await abrir();
  eq("entra con la sesión del admin y habilita el archivo", await p.isDisabled("#archivo"), false);
  await elegir(p, respaldo());
  await p.waitForFunction(() => !document.querySelector("#zonaArchivo").textContent.includes("Comparando"));
  eq("compara con lo que hay: posteos en el archivo, nuevos, que ya estaban y solo en Supabase",
     await fila(p, "posts"), ["3", "1", "2", "2"]);
  eq("y lo mismo con el equipo", await fila(p, "members"), ["1", "0", "1", "1"]);
  eq("de la configuración no se saca nada: ahí la columna no aplica", await fila(p, "app_config"), ["2", "1", "1", "—"]);

  await p.check("#modoFinal");
  const listas = await p.$$eval("#zonaModo details", ds => ds.map(d => [d.querySelector("summary").textContent,
    [...d.querySelectorAll("li")].map(li => li.textContent)]));
  eq("muestra, tabla por tabla, lo que se va a sacar", listas, [
    ["posts: 2", ["Reunión de prueba — 2026-09-04 · de Google Calendar", "Borrado en Firebase — 2026-09-03 · con 1 comentario"]],
    ["replies: 1 (y 1 más que se va con su posteo)", ["«probando en Supabase» — en «Igual»"]],
    ["members: 1", ["Se Fue <se.fue@x.com>"]],
    ["access_requests: 1", ["vieja@x.com (pending)"]],
  ]);
  eq("el botón dice lo que hace", (await p.textContent("#btnImportar")).trim(), "Hacer la importación final");
  eq("y no se habilita hasta confirmar que se revisó la lista", await p.isDisabled("#btnImportar"), true);
  await p.check("#confirmo");
  eq("confirmado, sí", await p.isDisabled("#btnImportar"), false);

  // Que se pueda leer en una pantalla chica, sin irse de costado.
  await p.setViewportSize({ width: 380, height: 900 });
  await p.waitForTimeout(100);
  eq("a 380 px de ancho no se va de la pantalla",
     await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  await p.screenshot({ path: "importar_angosto.png", fullPage: true });
  await p.setViewportSize({ width: 900, height: 1000 });
  await p.screenshot({ path: "importar_ancho.png", fullPage: true });

  await p.click("#btnImportar");
  await p.waitForFunction(() => /Listo|Se cortó/.test(document.querySelector("#zonaImportar").textContent), null, { timeout: 30000 });
  const resultado = await p.textContent("#zonaImportar");
  const sb = await p.evaluate(() => JSON.parse(JSON.stringify({ rpc: window.__sb.rpc, subidas: window.__sb.subidas, tablas: window.__sb.tablas })));

  eq("termina diciendo que Supabase quedó igual que Firebase", /Supabase quedó igual que Firebase/.test(resultado), true);
  const imports = sb.rpc.filter(([n]) => n === "importar");
  eq("todas las tablas se traen reemplazando", imports.every(([, a]) => a.p_reemplazar === true) && imports.length >= 6, true);
  eq("y en el orden que hace falta (los comentarios después de los posteos)",
     imports.map(([, a]) => a.p_tabla).filter((t, i, l) => l.indexOf(t) === i),
     ["members", "former_members", "posts", "replies", "audit_log", "app_config"]);
  const nuevo = sb.tablas.posts.find(x => x.id === "p_nuevo") || { images: [], files: [{}] };
  eq("la foto queda como ruta con huella", /^posts\/p_nuevo\/img0_[0-9a-f]{12}\.jpg$/.test(nuevo.images[0] || ""), true);
  eq("el Word conserva su ranura y su fecha, con su ruta y sin el contenido",
     [nuevo.files[0].doc, nuevo.files[0].subidoEl, /\.docx$/.test(nuevo.files[0].path || ""), "dataUrl" in nuevo.files[0]],
     ["reporte", "2026-09-05T10:00:00.000Z", true, false]);
  const foto = sb.subidas.find(s => s.ruta === nuevo.images[0]) || {};
  const mini = sb.subidas.find(s => s.ruta === String(nuevo.images[0]).replace(/\.jpg$/, ".min.jpg")) || {};
  eq("sube la foto y, al lado, su miniatura armada con el canvas", [foto.tipo, mini.tipo], ["image/jpeg", "image/jpeg"]);
  eq("que es mucho más liviana", mini.tam > 0 && mini.tam * 5 < foto.tam, true);
  eq("el Word sube como Word", (sb.subidas.find(s => s.ruta.endsWith(".docx")) || {}).tipo,
     "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  eq("nada sube con upsert", sb.subidas.some(s => s.upsert), false);
  eq("se saca exactamente lo de la lista",
     sb.rpc.filter(([n]) => n === "importar_quitar").map(([, a]) => [a.p_tabla, a.p_claves]),
     [["replies", ["r_suelto"]], ["posts", ["cal_x1", "p_borrado"]], ["members", ["se.fue@x.com"]], ["access_requests", ["vieja@x.com"]]]);
  eq("los posteos quedan como en Firebase", sb.tablas.posts.map(x => x.id).sort(), ["p_cambia", "p_igual", "p_nuevo"]);
  eq("con lo editado allá", (sb.tablas.posts.find(x => x.id === "p_cambia") || {}).title, "Después");
  eq("los comentarios del posteo sacado se fueron con él", sb.tablas.replies.map(x => x.id).sort(), ["r_nuevo"]);
  eq("quien perdió el acceso en Firebase ya no está en el equipo", sb.tablas.members.map(x => x.email), ["benny@team-latam.com"]);
  const prefs = (sb.tablas.app_config.find(x => x.key === "preferences") || {}).value || {};
  eq("las preferencias llegan sin los topes de adjuntos de Firebase", [prefs.calendarId, "maxImages" in prefs, "maxAttachmentFileBytes" in prefs],
     ["equipo@group.calendar.google.com", false, false]);
  eq("la sincronización de Calendar sigue desde donde estaba Firebase",
     ((sb.tablas.app_config.find(x => x.key === "calendarSync") || {}).value || {}).syncToken, "token-de-firebase");
  eq("el registro de auditoría de Supabase no se toca", sb.tablas.audit_log.map(x => x.id).sort(), ["a1", "a_de_supabase"]);

  // Después, la comparación se vuelve a hacer: ya no queda nada que sacar.
  await p.waitForFunction(() => /No hay nada en Supabase que no esté en Firebase/.test(document.querySelector("#zonaModo").textContent), null, { timeout: 10000 }).catch(() => {});
  eq("después, la comparación se rehace y ya no hay nada que sacar",
     /No hay nada en Supabase que no esté en Firebase/.test(await p.textContent("#zonaModo")), true);
  eq("sin un solo error en la página", errores, []);
  await p.close();
}

/* ---------- Completar lo que falta: no toca ni saca nada ---------- */
{
  const { p, errores } = await abrir();
  await elegir(p, respaldo());
  await p.waitForFunction(() => !document.querySelector("#zonaArchivo").textContent.includes("Comparando"));
  eq("el modo de siempre viene elegido", await p.isChecked("#modoCompletar"), true);
  eq("y se puede traer sin confirmar nada", await p.isDisabled("#btnImportar"), false);
  await p.click("#btnImportar");
  await p.waitForFunction(() => /Listo|Se cortó/.test(document.querySelector("#zonaImportar").textContent), null, { timeout: 30000 });
  const sb = await p.evaluate(() => JSON.parse(JSON.stringify({ rpc: window.__sb.rpc, tablas: window.__sb.tablas })));
  eq("no reemplaza", sb.rpc.filter(([n]) => n === "importar").some(([, a]) => a.p_reemplazar), false);
  eq("ni saca nada", sb.rpc.some(([n]) => n === "importar_quitar"), false);
  eq("lo que ya estaba queda como estaba", (sb.tablas.posts.find(x => x.id === "p_cambia") || {}).title, "Antes");
  eq("y lo nuevo entra", sb.tablas.posts.some(x => x.id === "p_nuevo"), true);
  eq("sin errores", errores, []);
  await p.close();
}

/* ---------- Lo que frena la importación final ---------- */
{
  const { p } = await abrir();
  const vieja = respaldo(new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString());
  await elegir(p, vieja);
  await p.waitForFunction(() => !document.querySelector("#zonaArchivo").textContent.includes("Comparando"));
  await p.check("#modoFinal");
  eq("una copia de hace días avisa que lo de después no viene", /Esta copia es de hace 3 día/.test(await p.textContent("#zonaModo")), true);
  await p.close();
}
{
  // Una copia que trae mucho menos de lo que hay: con esa, la final
  // sacaría media base.
  const { p } = await abrir();
  await p.evaluate(() => { for(let i = 0; i < 40; i++) window.__sb.tablas.posts.push({ id: "p_extra" + i, title: "x" }); });
  await elegir(p, respaldo());
  await p.waitForFunction(() => !document.querySelector("#zonaArchivo").textContent.includes("Comparando"));
  await p.check("#modoFinal");
  eq("una copia que trae mucho menos de lo que hay frena la final", /¿Es la copia completa/.test(await p.textContent("#zonaModo")), true);
  eq("y el botón no se habilita", await p.isDisabled("#btnImportar"), true);
  await p.close();
}
{
  // Un comentario cuyo posteo no existe: no entra, y lo demás sí.
  const { p, errores } = await abrir();
  const datos = respaldo();
  datos.replies.push({ id: "r_huerfano", postId: "no_existe", content: "huérfano", authorName: "X" });
  await elegir(p, datos);
  await p.waitForFunction(() => !document.querySelector("#zonaArchivo").textContent.includes("Comparando"));
  await p.click("#btnImportar");
  await p.waitForFunction(() => /Listo|Se cortó|no entraron/.test(document.querySelector("#zonaImportar").textContent), null, { timeout: 30000 });
  const texto = await p.textContent("#zonaImportar");
  eq("una fila que la base no acepta queda en la lista, con su motivo", /replies r_huerfano: .*foreign key/.test(texto), true);
  eq("y las demás entran igual", await p.evaluate(() => window.__sb.tablas.replies.some(r => r.id === "r_nuevo")), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
