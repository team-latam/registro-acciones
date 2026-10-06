import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   La app entera, con la sesión iniciada, en un navegador de verdad

   carga_test.mjs carga la página sin entrar. Esta entra, con un Supabase
   de mentira en lugar del de la CDN (guarda todo en memoria y anota cada
   pedido), y la usa como la usa el equipo: el admin recorre todas las
   solapas, cambia una preferencia, publica una rutina, le da me gusta y
   sale; un integrante común ve lo suyo y nada de lo del admin; alguien
   nuevo queda esperando aprobación, con su pedido anotado.

   Sin un solo error de página en todo el camino. Es lo que no ve ninguna
   prueba de una función suelta: una variable que ya no existe, o que vale
   una cosa en una base y otra en la otra, se descubre recién cuando
   alguien toca el botón. Así pasó con las preferencias, que en Supabase
   no se guardaban (ver preferencias_test.mjs).
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const deRed = t => /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|ERR_FAILED|ERR_ABORTED|Failed to load resource|net::ERR_|Failed to fetch dynamically imported module|Failed to fetch/.test(t);

const PAGINA = "file://" + (process.env.INDEX || RAIZ + "index.html");
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

// El Supabase de mentira. Lo que hay en la base vive en window.__sb, que
// la prueba arma antes de cargar la página y mira después.
const FALSO = `
const estado = window.__sb;
const MARCA = "1970-01-01T00:00:00.000Z";
const claveDe = t => ({ members:"email", former_members:"email", access_requests:"email",
                        user_prefs:"email", app_config:"key" }[t] || "id");
const copia = x => x == null ? x : JSON.parse(JSON.stringify(x));
const quien = () => estado.sesion && estado.sesion.user.email;
// La hora la pone la base, como los disparadores de verdad.
const conHora = (tabla, f, nueva) => {
  const o = { ...f };
  Object.keys(o).forEach(k => { if(o[k] === MARCA) o[k] = new Date().toISOString(); });
  if(nueva && ["posts","replies","audit_log"].includes(tabla) && !o.created_at) o.created_at = new Date().toISOString();
  if(nueva && tabla === "access_requests" && !o.requested_at) o.requested_at = new Date().toISOString();
  return o;
};
function ejecutar(q){
  const t = estado.tablas[q.tabla] = estado.tablas[q.tabla] || [];
  const k = claveDe(q.tabla);
  const cumple = f => q.filtros.every(([c, v]) => String(f[c]) === String(v));
  if(q.op === "select"){
    let r = t.filter(cumple);
    q.orden.forEach(() => {});
    r = [...r].sort((a, b) => {
      for(const [c, o] of q.orden){
        const x = String(a[c] ?? ""), y = String(b[c] ?? "");
        if(x !== y) return (o.ascending === false ? -1 : 1) * (x < y ? -1 : 1);
      }
      return 0;
    });
    const total = r.length;
    if(q.rango) r = r.slice(q.rango[0], q.rango[1] + 1);
    if(q.tope) r = r.slice(0, q.tope);
    return { data: q.uno ? copia(r[0] || null) : copia(r), error: null, count: q.contar ? total : null };
  }
  estado.escrituras.push([q.op, q.tabla, copia(q.datos), copia(q.filtros)]);
  if(q.op === "insert"){
    for(const f of [].concat(q.datos)){
      if(t.some(x => String(x[k]) === String(f[k])))
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      t.push(conHora(q.tabla, f, true));
    }
    return { data: null, error: null };
  }
  if(q.op === "upsert"){
    for(const f of [].concat(q.datos)){
      const i = t.findIndex(x => String(x[k]) === String(f[k]));
      if(i < 0) t.push(conHora(q.tabla, f, true));
      else if(!(q.opciones && q.opciones.ignoreDuplicates)) t[i] = { ...t[i], ...conHora(q.tabla, f, false) };
    }
    return { data: null, error: null };
  }
  if(q.op === "update"){
    t.forEach((f, i) => { if(cumple(f)) t[i] = { ...f, ...conHora(q.tabla, q.datos, false) }; });
    return { data: null, error: null };
  }
  if(q.op === "delete"){
    const quedan = t.filter(f => !cumple(f));
    if(q.tabla === "posts"){
      const idos = t.filter(cumple).map(f => f.id);
      estado.tablas.replies = (estado.tablas.replies || []).filter(r => !idos.includes(r.post_id));
    }
    estado.tablas[q.tabla] = quedan;
    return { data: null, error: null };
  }
  return { data: null, error: { message: "operación desconocida " + q.op } };
}
function consulta(tabla){
  const q = { tabla, op: "select", filtros: [], orden: [], rango: null, tope: null, uno: false, contar: false };
  const b = {
    select(cols, op){ if(q.op === "select") q.contar = !!(op && op.count); return b; },
    eq(c, v){ q.filtros.push([c, v]); return b; },
    order(c, o){ q.orden.push([c, o || {}]); return b; },
    range(d, h){ q.rango = [d, h]; return b; },
    limit(n){ q.tope = n; return b; },
    maybeSingle(){ q.uno = true; return b; },
    single(){ q.uno = true; return b; },
    insert(f){ q.op = "insert"; q.datos = f; return b; },
    update(f){ q.op = "update"; q.datos = f; return b; },
    upsert(f, o){ q.op = "upsert"; q.datos = f; q.opciones = o || {}; return b; },
    delete(){ q.op = "delete"; return b; },
    then(ok, mal){ if(q.op === "select") (estado.consultas = estado.consultas || []).push(q.tabla);
      return new Promise(r => setTimeout(r, 0)).then(() => ejecutar(q)).then(ok, mal); },
  };
  return b;
}
const conMeGusta = (tabla, id, puesto) => {
  const f = (estado.tablas[tabla] || []).find(x => x.id === id);
  if(!f) return { data: null, error: { code: "P0002", message: "no existe" } };
  const yo = quien(), l = (f.liked_by || []).filter(e => e !== yo);
  f.liked_by = puesto ? l.concat([yo]) : l;
  return { data: null, error: null };
};
export function createClient(url, clave){
  estado.cliente = [url, clave];
  return {
    auth: {
      getSession: async () => ({ data: { session: copia(estado.sesion) } }),
      onAuthStateChange(fn){ estado.oyentes.push(fn); return { data: { subscription: { unsubscribe(){} } } }; },
      signInWithOAuth: async o => { estado.logins.push(copia(o)); return { error: null }; },
      signOut: async () => { estado.sesion = null; estado.oyentes.forEach(f => f("SIGNED_OUT", null)); return { error: null }; },
    },
    from: consulta,
    async rpc(nombre, args){
      estado.rpc.push([nombre, copia(args)]);
      await new Promise(r => setTimeout(r, 0));
      if(nombre === "me_gusta_posteo") return conMeGusta("posts", args.p_id, args.p_puesto);
      if(nombre === "me_gusta_comentario") return conMeGusta("replies", args.p_id, args.p_puesto);
      if(nombre === "guardar_preferencias"){
        const t = estado.tablas.user_prefs = estado.tablas.user_prefs || [];
        const f = t.find(x => x.email === quien());
        if(f) f.prefs = { ...f.prefs, ...args.p_parche }; else t.push({ email: quien(), prefs: { ...args.p_parche } });
        return { data: null, error: null };
      }
      if(nombre === "guardar_config"){
        const t = estado.tablas.app_config = estado.tablas.app_config || [];
        const f = t.find(x => x.key === args.p_clave);
        if(f) f.value = { ...f.value, ...args.p_parche }; else t.push({ key: args.p_clave, value: { ...args.p_parche } });
        return { data: null, error: null };
      }
      // Revisar lo de Calendar (12-revisar-calendar.sql): solo lo que vino
      // de Calendar, y sin tocar la fecha de edición.
      const importado = f => f && f.author_name === "Google Calendar" && !f.author_email && f.calendar_event_id;
      if(nombre === "clasificar_importados"){
        let n = 0;
        for(const c of args.p_cambios){
          const f = (estado.tablas.posts || []).find(x => x.id === c.id);
          if(!importado(f)) continue;
          ["activity_type", "scopes", "participants", "location"].forEach(k => { if(k in c) f[k] = copia(c[k]); });
          n++;
        }
        return { data: n, error: null };
      }
      if(nombre === "sacar_del_registro"){
        const idos = (estado.tablas.posts || []).filter(f => args.p_ids.includes(f.id) && importado(f));
        const t = estado.tablas.calendar_sacados = estado.tablas.calendar_sacados || [];
        idos.forEach(f => t.push({ evento: f.calendar_event_id, titulo: f.title, sacado_por: quien(), sacado_el: new Date().toISOString(), fila: copia(f) }));
        estado.tablas.posts = estado.tablas.posts.filter(f => !idos.includes(f));
        return { data: idos.length, error: null };
      }
      if(nombre === "devolver_al_registro"){
        const t = estado.tablas.calendar_sacados = estado.tablas.calendar_sacados || [];
        let devueltos = 0; const aTraer = [];
        t.filter(x => args.p_eventos.includes(x.evento)).forEach(x => {
          if(x.fila){ estado.tablas.posts.push(copia(x.fila)); devueltos++; } else aTraer.push(x.evento);
        });
        estado.tablas.calendar_sacados = t.filter(x => !args.p_eventos.includes(x.evento));
        return { data: { devueltos, aTraer }, error: null };
      }
      if(nombre === "tamano_del_bucket") return { data: estado.tamano || { archivos: 3, bytes: 3 * 1024 * 1024 }, error: null };
      if(nombre === "unificar_cuentas"){
        const viejo = String(args.p_viejo).toLowerCase(), nuevo = args.p_nuevo;
        const m = (estado.tablas.members || []).find(x => x.email === nuevo);
        let cargados = 0, comentarios = 0;
        (estado.tablas.posts || []).forEach(f => {
          if(String(f.author_email || "").toLowerCase() === viejo){ f.author_email = nuevo; f.author_name = m.name; cargados++; }
          f.liked_by = [...new Set((f.liked_by || []).map(x => x.toLowerCase() === viejo ? nuevo : x))];
        });
        (estado.tablas.replies || []).forEach(f => {
          if(String(f.author_email || "").toLowerCase() === viejo){ f.author_email = nuevo; f.author_name = m.name; comentarios++; }
        });
        return { data: { cargados, comentarios }, error: null };
      }
      return { data: null, error: { code: "PGRST202", message: "no existe la función " + nombre } };
    },
    storage: { from(){ return {
      createSignedUrls: async rutas => ({ error: null, data: rutas.map(r => ({ path: r, error: null,
        signedUrl: url + "/storage/v1/object/sign/adjuntos/" + r + "?token=prueba" })) }),
      upload: async (ruta, blob) => { estado.subidas.push([ruta, blob.type]); return { error: null }; },
      remove: async rutas => { estado.borradas.push(...rutas); return { error: null }; },
      list: async () => ({ data: [], error: null }),
      download: async ruta => { estado.descargas = (estado.descargas || 0) + 1; return /rota/.test(ruta) ? { data: null, error: { message: "Object not found" } } : { data: new Blob(["contenido de " + ruta]), error: null }; },
    }; } },
    channel(nombre){
      estado.canales++;
      const c = { on(){ return c; }, subscribe(fn){ setTimeout(() => fn && fn("SUBSCRIBED"), 0); return c; } };
      return c;
    },
    removeChannel(){ estado.canales--; },
  };
}`;

const ADMIN = "benny@team-latam.com";
// Y uno de otra ciudad de Uruguay.
const CIERRE_PDE_XML = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`
  + ["Formulario de Cierre de Viaje", "Lugar: Punta del Este, Uruguay", "Objetivos:"].map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join("")
  + `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Objetivo</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Logrado</w:t></w:r></w:p></w:tc></w:tr>`
  + `<w:tr><w:tc><w:p><w:r><w:t>Conocer el club</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sí</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`
  + ["Resumen Ejecutivo:", "En Punta del Este, todo listo.", "Conclusiones:", "Mandar el contrato."].map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join("")
  + `</w:body></w:document>`;
// Otro Cierre inventado, del mismo viaje pero de otro país.
const CIERRE_AR_XML = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`
  + ["Formulario de Cierre de Viaje", "Lugar: Buenos Aires, Argentina", "Objetivos:"].map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join("")
  + `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Objetivo</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Logrado</w:t></w:r></w:p></w:tc></w:tr>`
  + `<w:tr><w:tc><w:p><w:r><w:t>Ver el templo</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Sí</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`
  + ["Resumen Ejecutivo:", "En Buenos Aires todo en orden.", "Conclusiones:", "Volver en marzo."].map(t => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join("")
  + `</w:body></w:document>`;
// Un Formulario de Cierre inventado (el repo es público: nada real).
const CIERRE_XML = (() => {
  const p = t => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const fila = c => `<w:tr>${c.map(x => `<w:tc>${p(x)}</w:tc>`).join("")}</w:tr>`;
  return `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`
    + p("Formulario de Cierre de Viaje") + p("Lugar: Montevideo, Uruguay") + p("Objetivos:")
    + `<w:tbl>${fila(["Objetivo","Logrado"])}${fila(["1. Conocer la sede","Sí"])}${fila(["2. Revisar el acceso","Parcial"])}</w:tbl>`
    + p("Resumen Ejecutivo:") + p("La visita a la sede salió bien.") + p("Conclusiones:")
    + p("Mandar el plan de cámaras al rabino.") + p("Capacitar a los guardias.") + p("Revisar la iluminación.") + p("Sumar un segundo turno.")
    + `</w:body></w:document>`;
})();
const hace = dias => new Date(Date.now() - dias * 86400000).toISOString();
const dia = dias => hace(dias).slice(0, 10);
const BASE = () => ({
  members: [
    { email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z", calendar_shared: true },
    { email: "ana@x.com", name: "Ana Pérez", nickname: "ana", role: "member", approved_at: "2025-03-01T12:00:00Z", calendar_shared: true },
  ],
  posts: [
    { id: "p_reunion", title: "Reunión con la comunidad", content: "Charla abierta en el centro comunitario.",
      date: dia(2), start_date: dia(2), end_date: dia(2), start_time: "18:00:00", end_time: "20:00:00",
      activity_type: "visita", author_name: "Ana Pérez", author_email: "ana@x.com",
      scopes: [{ type: "ciudad", country: "Argentina", city: "Buenos Aires" }],
      images: ["posts/p_reunion/img0_1.jpg"], files: [], links: [], mentions: [], liked_by: [],
      milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(2) },
    { id: "p_proyecto", title: "Programa de becas", content: "Seguimiento del programa.",
      date: dia(10), start_date: dia(10), end_date: dia(40), activity_type: "visita",
      author_name: "Benny", author_email: ADMIN, is_project: true, project_status: "en_curso",
      milestones: [{ id: "h1", title: "Primera entrega", date: dia(-5), done: false }],
      scopes: [], images: [], files: [], links: [], mentions: [], liked_by: [ "ana@x.com" ],
      editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(10) },
  ],
  replies: [
    { id: "r_1", post_id: "p_reunion", content: "¡Qué bueno que se hizo!", author_name: "Benny",
      author_email: ADMIN, scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [],
      system: false, created_at: hace(1) },
  ],
  access_requests: [
    { email: "nueva@x.com", name: "Nueva Persona", status: "pending", requested_at: hace(1) },
  ],
  former_members: [],
  audit_log: [
    { id: "a_1", type: "login", actor_email: "ana@x.com", actor_name: "Ana Pérez", created_at: hace(1) },
  ],
  app_config: [],
  user_prefs: [],
});

const b = await chromium.launch();

// Entra con quien se le diga y devuelve la página, sus errores y la base.
// `mod` retoca la base de mentira antes de cargar (para sumar algo que
// solo necesita una sección, sin tocar lo que las demás esperan);
// `viewport` abre la página con otro tamaño (un celular).
async function entrar(email, nombre, mod, viewport, pedidos){
  const base = BASE(); if(mod) mod(base);
  const p = await b.newPage(viewport ? { viewport } : {});
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error" && !deRed(m.text())) errores.push(m.text()); });
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(pedidos) pedidos.push(u);
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    // La herramienta del .zip, de mentira: el "zip" es la lista de lo que
    // se le metió, para poder mirarla.
    // La herramienta que dibuja los Word, de mentira: escribe cuántos bytes le llegaron.
    // Lo que lee planillas, de mentira: una tabla con una celda.
    // Con un enlace javascript: y una imagen con onerror, como podría traer
    // una planilla armada a propósito: el visor los tiene que sacar.
    if(/xlsx\.full\.min\.js/.test(u)) return ruta.fulfill({ contentType: "application/javascript", body: `window.XLSX = { read: () => ({ SheetNames: ["Gastos"], Sheets: { Gastos: {} } }), utils: { sheet_to_html: () => '<table><tr><td>Planilla de mentira <a id="enlaceMalo" href="javascript:window.__xss=1">x</a><a id="enlaceBueno" href="https://ejemplo.org/a">y</a><img src="nada.png" onerror="window.__xss=2"></td></tr></table>' } };` });
    if(/docx-preview/.test(u)) return ruta.fulfill({ contentType: "application/javascript", body: `window.docx = { renderAsync: async (blob, el) => { el.innerHTML = '<section class="docx">Word de ' + blob.size + ' bytes <a id="wordMalo" href="javascript:void 0">l</a><iframe id="wordMarco"></iframe></section>'; } };` });
    // Y para leer un Word (el resumen de una visita): el "docx" de las
    // pruebas es directamente su document.xml.
    if(/jszip\.min\.js/.test(u)) return ruta.fulfill({ contentType: "application/javascript", body: `window.JSZip = class { constructor(){ this.n = []; }
      file(nombre){ this.n.push(nombre); return this; } async generateAsync(){ return new Blob([JSON.stringify(this.n.sort())]); }
      static async loadAsync(buf){ const xml = new TextDecoder().decode(buf); return { file: n => n === "word/document.xml" ? { async: async () => xml } : null }; } };` });
    if(/\/storage\/v1\/object\/sign\/.*\.docx/.test(u)) return ruta.fulfill({ contentType: "application/octet-stream", body: /cierre-ar/i.test(u) ? CIERRE_AR_XML : /cierre-pde/i.test(u) ? CIERRE_PDE_XML : /cierre/i.test(u) ? CIERRE_XML : "<nada/>" });
    if(/\/storage\/v1\/object\/sign\//.test(u)) return ruta.fulfill({ contentType: "image/png", body: PNG });
    if(/^https:\/\/www\.googleapis\.com\/calendar\//.test(u))
      return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [],
                    logins: [], canales: 0 };
    // Las librerías de mentira no tienen la huella de las de verdad.
    window.__pruebasSinIntegridad = true;
  }, [base, { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }]);
  await p.goto(PAGINA);
  return { p, errores, base: () => p.evaluate(() => JSON.parse(JSON.stringify(window.__sb.tablas))),
           rpc: () => p.evaluate(() => window.__sb.rpc) };
}
const visible = async (p, sel) => !!(await p.$(sel)) && await p.isVisible(sel);
const esperarTexto = async (p, texto, ms = 8000) => {
  try{ await p.waitForFunction(x => document.body.innerText.includes(x), texto, { timeout: ms }); return true; }
  catch(e){ return false; }
};
const hasta = async (p, fn, arg, ms = 5000) => {
  try{ await p.waitForFunction(fn, arg, { timeout: ms }); return true; }catch(e){ return false; }
};

/* ---------- El admin ---------- */
{
  const { p, errores, base, rpc } = await entrar(ADMIN, "Benny");
  eq("admin: entra y ve los posteos del equipo", await esperarTexto(p, "Reunión con la comunidad"), true);
  await p.click('button[data-action="toggle-thread"][data-post-id="p_reunion"]');
  eq("admin: con el comentario adentro", await esperarTexto(p, "¡Qué bueno que se hizo!", 3000), true);
  // La tarjeta nueva (6/10/2026): nombre y cuándo arriba, la ciudad sola,
  // la documentación como pastilla después de los comentarios.
  {
    const tarjeta = await p.evaluate(() => {
      const c = document.querySelector('.post[data-post-id="p_reunion"]');
      const acc = [...c.querySelectorAll(".post-actions > *")].map(e => e.dataset.action || e.className.split(" ")[0]);
      const chip = c.querySelector(".post-chips .scope-chip");
      return { titulo: c.querySelector(".post-top .post-titulo").textContent.trim(), cuando: c.querySelector(".post-cuando").textContent.trim(),
        chip: chip.textContent.replace(/\s+/g, " ").trim(), chipTitle: chip.title, acc,
        proyecto: document.querySelector('.post[data-post-id="p_proyecto"] .post-cuando').textContent.trim() };
    });
    eq("tarjeta: el nombre arriba", tarjeta.titulo, "Reunión con la comunidad");
    eq("tarjeta: con hora, el día de la semana y el horario", /^\S+ \d{1,2} \S+( \d{4})? · 18:00–20:00$/.test(tarjeta.cuando), true);
    eq("tarjeta: sin hora, sin día de la semana y con el año", /^\d{1,2} \S+ \d{4}$/.test(tarjeta.proyecto), true);
    eq("tarjeta: la ciudad sola, con el país al pasar el mouse", [/📍 Buenos Aires$/.test(tarjeta.chip.replace(", Argentina", "")), tarjeta.chipTitle], [true, "Buenos Aires, Argentina"]);
    await p.click('.post[data-post-id="p_reunion"] .post-chips .scope-chip');
    eq("tarjeta: al tocar la ciudad se ve el país", await p.$eval('.post[data-post-id="p_reunion"] .post-chips .scope-chip', e => e.classList.contains("completo") && getComputedStyle(e.querySelector(".sc-resto")).display !== "none"), true);
  }
  // Las pestañas de arriba son cinco, las de todos los días. Lo de admin
  // (Administración) y lo personal (Mis preferencias) se llegan desde el
  // menú del avatar.
  await p.click('[data-action="toggle-user-menu"]');
  eq("admin: el menú del avatar ofrece Administración", !!(await p.$('.user-menu [data-action="goto-view"][data-view="admin"]')), true);
  await p.click('[data-action="toggle-user-menu"]');

  // Todas las solapas, una por una: cada una se dibuja y ninguna rompe.
  const vistas = await p.$$eval("nav.tabs button[data-view]", bs => bs.filter(x => !x.hidden).map(x => x.dataset.view));
  eq("admin: están las cinco solapas", vistas, ["feed","calendario","paises","proyectos","reportes"]);
  const vacias = [];
  for(const v of vistas){
    await p.click(`nav.tabs button[data-view="${v}"]`);
    await p.waitForTimeout(250);
    const largo = await p.evaluate(() => document.getElementById("viewRoot").innerText.trim().length);
    if(largo < 20) vacias.push(v);
  }
  eq("admin: cada solapa dibuja algo", vacias, []);
  // Calendario → "Ir a una fecha" (5/10/2026): el título del mes abre
  // una ventanita para escribir la fecha o elegir año y mes, en vez de ir
  // mes por mes con ‹ › hasta 2024.
  {
    await p.click('nav.tabs button[data-view="calendario"]');
    await p.waitForSelector('[data-action="cal-ir-abrir"]');
    const titulo = () => p.$eval(".cal-title", e => e.textContent.trim().toLowerCase());
    const foco = () => p.evaluate(() => document.activeElement.id || document.activeElement.dataset.action || "");
    await p.click('[data-action="cal-ir-abrir"]');
    eq("ir a fecha: se abre como diálogo, con el foco en el campo", [!!(await p.$('.cal-ir[role="dialog"]')), await foco()], [true, "calIrFecha"]);
    eq("y trae los doce meses", await p.$$eval('[data-action="cal-ir-mes"]', l => l.length), 12);
    await p.fill("#calIrFecha", "1/1/2024"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    eq("escribir 1/1/2024 + Enter lleva a enero de 2024, cierra y marca el día", [await titulo(), !!(await p.$(".cal-ir")), await p.$$eval(".cal-destino", l => l.map(e => e.dataset.date)), await foco()],
       ["enero de 2024", false, ["2024-01-01"], "cal-ir-abrir"]);
    await p.click('[data-action="cal-ir-abrir"]');
    await p.click('[data-action="cal-ir-anio"][data-key="2025"]');
    eq("elegir un año deja la ventanita abierta y cambia los meses", [!!(await p.$(".cal-ir")), await p.$eval('[data-action="cal-ir-mes"]', e => e.dataset.key)], [true, "2025-01"]);
    await p.click('[data-action="cal-ir-mes"][data-key="2025-03"]'); await p.waitForTimeout(100);
    eq("y un mes lleva ahí", await titulo(), "marzo de 2025");
    await p.click('[data-action="cal-ir-abrir"]');
    await p.fill("#calIrFecha", "31/2/2024"); await p.click('[data-action="cal-ir-fecha"]'); await p.waitForTimeout(100);
    eq("una fecha que no existe: avisa y no se mueve", [await p.$eval("#calIrAyuda", e => e.classList.contains("error")), await titulo()], [true, "marzo de 2025"]);
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    eq("Escape cierra y devuelve el foco al título", [!!(await p.$(".cal-ir")), await foco()], [false, "cal-ir-abrir"]);
    const irA = async x => { await p.click('[data-action="cal-ir-abrir"]'); await p.fill("#calIrFecha", x); await p.keyboard.press("Enter"); await p.waitForTimeout(80);
      const r = (await p.$(".cal-ir")) ? "error" : await titulo(); if(r === "error") await p.keyboard.press("Escape"); return r; };
    const leidas = [];
    for(const x of ["01-01-24", "1.1.2024", "2024-02-01", "3/2024", "29/2/2023", "hola"]) leidas.push(await irA(x));
    eq("las fechas escritas, día primero (y las que no existen avisan)", leidas, ["enero de 2024", "enero de 2024", "febrero de 2024", "marzo de 2024", "error", "error"]);
    await p.click('[data-action="cal-ir-abrir"]'); await p.fill("#calIrFecha", "2024"); await p.keyboard.press("Enter"); await p.waitForTimeout(80);
    eq("un año solo pasa a la vista Año", await titulo(), "2024");
    await p.click('[data-action="cal-subview"][data-key="mes"]').catch(async () => { await p.click('[data-action="toggle-cal-view"]'); await p.click('[data-action="cal-subview"][data-key="mes"]'); });
    await p.click('[data-action="cal-today"]');
  }
  // Administración → Copia de seguridad (6/10/2026): baja una copia en el
  // momento, solo datos (.json) o con fotos y archivos (.zip).
  {
    await p.click('[data-action="toggle-user-menu"]');
    await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
    await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="copia"]');
    await p.waitForSelector('[data-action="copia-datos"]');
    eq("copia: la sección está en el menú de Administración, con su título", await p.$eval(".admin-h2", e => e.textContent.trim()), "Copia de seguridad");
    const [bajada] = await Promise.all([p.waitForEvent("download"), p.click('[data-action="copia-datos"]')]);
    const fs = await import("node:fs");
    const datos = JSON.parse(fs.readFileSync(await bajada.path(), "utf8"));
    eq("copia: solo los datos baja un .json con fecha", /^registro-copia-\d{4}-\d{2}-\d{2}\.json$/.test(bajada.suggestedFilename()), true);
    eq("copia: con cada tabla, tal como está en la base", [Object.keys(datos.tablas).includes("posts"), datos.tablas.posts.length === (await base()).posts.length, datos.tablas.posts[0].author_email !== undefined, datos.por],
       [true, true, true, ADMIN]);
    eq("copia: y lo dice", await hasta(p, () => /Listo: \d+ filas/.test(document.querySelector(".copia-estado").textContent)), true);
    await p.evaluate(() => { const f = window.__sb.tablas.posts.find(x => x.id === "p_reunion"); f.files = [{ path: "posts/p_reunion/acta.pdf", name: "acta.pdf" }, { path: "posts/p_reunion/rota.pdf", name: "rota.pdf" }]; });
    await p.evaluate(() => document.querySelector('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="copia"]').click());
    const [zip] = await Promise.all([p.waitForEvent("download"), p.click('[data-action="copia-completa"]')]);
    const adentro = JSON.parse(fs.readFileSync(await zip.path(), "utf8"));
    eq("copia completa: un .zip con los datos y las fotos y adjuntos que nombran los posteos", [/\.zip$/.test(zip.suggestedFilename()), adentro],
       [true, ["archivos/posts/p_reunion/acta.pdf", "archivos/posts/p_reunion/img0_1.jpg", "datos.json"]]);
    eq("copia completa: el que no se pudo bajar no corta el resto, y se avisa", await hasta(p, () => /1 no se pudieron bajar/.test(document.querySelector(".copia-estado").textContent)), true);
  }
  // Países (4/10/2026): en la tarjeta, el número no se monta sobre el
  // nombre, y todas llevan la serie de 12 meses (aunque esté vacía), así
  // la grilla queda pareja.
  await p.evaluate(() => document.querySelector('nav.tabs button[data-view="paises"]').click());
  await p.waitForSelector(".country-card");
  eq("países: el número va debajo del nombre, sin pisarlo, y cada tarjeta tiene su serie",
    await p.$$eval(".country-card", cs => cs.every(c => {
      const n = c.querySelector(".name").getBoundingClientRect(), k = c.querySelector(".count").getBoundingClientRect();
      return k.top >= n.bottom - 1 && !!c.querySelector(".country-serie");
    })), true);
  await p.evaluate(() => document.querySelector('nav.tabs button[data-view="feed"]').click());

  // Administración: el Resumen muestra el pedido de acceso pendiente, y
  // cada sección del menú de al lado se dibuja.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  eq("admin: el Resumen de Administración muestra el pedido pendiente", await esperarTexto(p, "Nueva Persona", 3000), true);
  const secciones = await p.$$eval('.admin-menu [data-action="admin-go"]', bs => bs.map(b => b.dataset.view + (b.dataset.key ? ":" + b.dataset.key : "")));
  eq("admin: el menú de Administración tiene todas las secciones", secciones,
     ["admin","revisarcal","solicitudes:usuarios","auditoria","preferencias:zonas","preferencias:tipos","preferencias:lugares","preferencias:adjuntos","preferencias:calendar","preferencias:copia"]);
  for(const s of secciones){
    const [v, k] = s.split(":");
    await p.click(`.admin-menu [data-action="admin-go"][data-view="${v}"]${k ? `[data-key="${k}"]` : ""}`);
    await p.waitForTimeout(200);
    const largo = await p.evaluate(() => document.querySelector(".admin-body").innerText.trim().length);
    if(largo < 20) vacias.push(s);
  }
  eq("admin: cada sección de Administración dibuja algo", vacias, []);
  await p.click('.admin-menu [data-action="admin-go"][data-view="solicitudes"]');
  eq("admin: en Personas está el equipo", await esperarTexto(p, "Ana Pérez", 3000), true);
  // Tanda 16, teclado: ↓ pasa a la fila siguiente, Enter abre la ficha y
  // lleva el foco adentro, Escape la cierra y devuelve el foco a la fila.
  const filasPersonas = await p.$$eval('.lp-row[data-action="usuario-abrir"]', es => es.map(e => e.dataset.email));
  await p.focus(`.lp-row[data-action="usuario-abrir"][data-email="${filasPersonas[0]}"]`);
  await p.keyboard.press("ArrowDown");
  eq("teclado: ↓ pasa el foco a la fila siguiente", await p.evaluate(() => document.activeElement.dataset.email), filasPersonas[1]);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(150);
  eq("teclado: Enter abre la ficha y el foco entra en ella",
    await p.evaluate(() => [!!document.querySelector(".lp-panel"), !!document.activeElement.closest(".lp-panel")]), [true, true]);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  eq("teclado: Escape cierra la ficha y el foco vuelve a la fila",
    await p.evaluate(() => [!!document.querySelector(".lp-panel"), document.activeElement.dataset.email]), [false, filasPersonas[1]]);
  // Unificar cuentas (5/10/2026): desde la ficha, todo lo de Ana pasa a
  // Benny, después de confirmar.
  await p.click('.lp-row[data-action="usuario-abrir"][data-email="ana@x.com"]');
  await p.waitForSelector("#unificarDestino");
  eq("unificar: el botón espera a que se elija la cuenta", await p.$eval('[data-action="unificar-cuentas"]', e => e.disabled), true);
  await p.selectOption("#unificarDestino", ADMIN);
  await p.click('[data-action="unificar-cuentas"]');
  await p.waitForSelector("#confirmOk", { state: "visible" });
  await p.click("#confirmOk");
  eq("unificar: lo que cargó Ana queda a nombre de Benny", await hasta(p, () =>
    (window.__sb.tablas.posts || []).find(x => x.id === "p_reunion").author_email === "benny@team-latam.com"), true);
  eq("unificar: y se llama a la base con los dos correos", (await rpc()).some(([n, a]) => n === "unificar_cuentas" && a.p_viejo === "ana@x.com" && a.p_nuevo === ADMIN), true);
  eq("unificar: avisa cuánto pasó", await esperarTexto(p, "pasaron de Ana Pérez a Benny", 3000), true);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  await p.click('[data-action="toggle-mentions-menu"]');
  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  eq("teclado: Escape cierra la campanita y el foco vuelve a su botón",
    await p.evaluate(() => [!!document.querySelector(".mentions-menu"), document.activeElement.dataset.action]), [false, "toggle-mentions-menu"]);
  eq("accesibilidad: la campanita dice si está abierta, la sección activa se marca y hay un enlace para saltar al contenido",
    await p.evaluate(() => [document.querySelector('[data-action="toggle-mentions-menu"]').getAttribute("aria-expanded"),
      document.querySelector('.admin-menu .admin-item.active').getAttribute("aria-current"), !!document.querySelector('a.skip-link[href="#viewRoot"]')]), ["false", "page", true]);
  await p.click('button[data-action="acceso-section"][data-key="pendientes"]');
  eq("admin: y en Solicitudes, el pedido pendiente", await esperarTexto(p, "Nueva Persona", 3000), true);
  await p.click('.admin-menu [data-action="admin-go"][data-view="auditoria"]');
  eq("admin: en el registro de actividad aparece lo registrado", await esperarTexto(p, "Ana Pérez", 3000), true);
  eq("admin: los títulos de columna del registro van adentro de la tarjeta, no flotando arriba",
    await p.$eval(".audit-list", e => !!e.firstElementChild && e.firstElementChild.classList.contains("audit-columns-header")), true);
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="lugares"]');
  eq("admin: Lugares usa la misma lista que Personas y Tipos", await p.$$eval('.lp-rows .lp-row [data-action="lugares-promote"]', es => es.length), 1);
  // Lo que está en el Registro pero no en el Calendar (5/10/2026): se
  // lista, y el botón intenta pasarlo (acá no hay Google, así que avisa
  // que no pudo, y no vincula nada).
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="calendar"]');
  await p.waitForSelector(".cal-faltantes");
  eq("calendar: lista los eventos del Registro que no están en el Calendar",
    await p.$$eval(".cal-faltantes-lista li b", l => l.map(e => e.textContent)), ["Programa de becas", "Reunión con la comunidad"]);
  await p.click('[data-action="calendar-faltantes"]');
  eq("calendar: sin acceso a Google, avisa que no pudo y no vincula nada",
    await hasta(p, () => /No se pudieron pasar 2/.test((document.querySelector(".cal-faltantes-ok") || {}).textContent || "")
      && (window.__sb.tablas.posts || []).every(x => !x.calendar_event_id)), true);
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="lugares"]');
  eq("admin: la ciudad escrita a mano figura en «Sin ubicación propia en el mapa», para pasar la lista y cargarle la coordenada",
    await p.evaluate(() => {
      const ciudad = document.querySelector('.lp-rows [data-action="lugares-promote"]').dataset.city;
      return [...document.querySelectorAll(".lugares-sin-ubicar li")].some(li => li.textContent.includes(ciudad));
    }), true);

  // Una preferencia personal, desde el menú del avatar: se ve y queda
  // guardada (ver preferencias_test).
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  await p.waitForTimeout(200);
  const hayControl = !!(await p.$('select[data-pref="weekStart"]'));
  eq("admin: Configuración tiene el control del primer día de la semana", hayControl, true);
  // Mis preferencias se arma como Administración: menú al costado y
  // cabecera con título, línea y "¿Cómo funciona?" por sección.
  eq("prefs: Mis preferencias tiene menú al costado y cabecera como Administración",
    [await p.$$eval('.preferencias-view .admin-menu [data-action="config-section"]', bs => bs.map(b => b.dataset.key)),
     await p.$eval(".preferencias-view .admin-cabecera .admin-h2", e => e.textContent.trim())],
    [["calendario","notificaciones","capas"], "Calendario"]);
  await p.click('.preferencias-view .admin-menu [data-action="config-section"][data-key="notificaciones"]');
  await p.waitForTimeout(150);
  eq("prefs: cada sección trae su título y su explicación plegada",
    [await p.$eval(".admin-cabecera .admin-h2", e => e.textContent.trim()), !!(await p.$(".admin-cabecera .admin-ayuda")), !!(await p.$(".settings-card"))],
    ["Notificaciones", true, true]);
  // El perfil de una persona (tocar un nombre en el Inicio) se arma como
  // la ficha de Personas: nombre solo (sin el "·" suelto), @usuario ·
  // email, datos en grilla y "Ver todo lo que cargó".
  await p.click('#tabs button[data-view="feed"]');
  await p.waitForTimeout(200);
  await p.click('[data-action="show-user-profile"]');
  await p.waitForTimeout(200);
  eq("perfil: el cuadro se arma como la ficha, sin el punto suelto después del nombre",
    await p.evaluate(() => { const o = document.getElementById("userProfileOverlay"); const n = document.getElementById("userProfileNameLabel");
      return [!o.hidden, n ? n.textContent.includes("·") : null, !!o.querySelector(".up-kv"), !!o.querySelector(".up-sub .up-nick"), !!o.querySelector('[data-action="ver-posteos-de"]')]; }),
    [true, false, true, true, true]);
  eq("perfil: abierto desde el Inicio no tiene «‹»: no hay adónde volver", await p.$eval("#userProfileBack", e => e.hidden), true);
  await p.click('#userProfileOverlay [data-action="ver-posteos-de"]');
  await p.waitForTimeout(200);
  eq("perfil: 'Ver todo lo que cargó' cierra el cuadro y deja el Inicio filtrado por esa persona",
    await p.evaluate(() => [document.getElementById("userProfileOverlay").hidden, !!document.querySelector('[data-action="clear-author"]')]), [true, true]);
  await p.click('[data-action="clear-author"]');
  await p.waitForTimeout(150);
  // De vuelta a Mis preferencias › Calendario, que es donde sigue la prueba.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  await p.click('.preferencias-view .admin-menu [data-action="config-section"][data-key="calendario"]');
  await p.waitForTimeout(150);
  if(hayControl){
    await p.selectOption('select[data-pref="weekStart"]', "1");
    await hasta(p, () => (window.__sb.tablas.user_prefs || []).length > 0);
    const prefs = (await base()).user_prefs.find(f => f.email === ADMIN);
    eq("admin: la preferencia queda guardada en la base", prefs && prefs.prefs.weekStart, 1);
    eq("admin: por la función de la base, sin decir de quién (sale de la sesión)",
       (await rpc()).filter(r => r[0] === "guardar_preferencias" && "weekStart" in r[1].p_parche).map(r => Object.keys(r[1])), [["p_parche"]]);
  }

  // Publicar una rutina, como se hace todos los días.
  await p.click('nav.tabs button[data-view="feed"]');
  await p.waitForSelector("#rutinaContent");
  await p.fill("#rutinaContent", "Visita a la escuela del barrio");
  await p.click("#rutinaPublish");
  const publicada = await hasta(p, () => (window.__sb.tablas.posts || []).some(x => x.content === "Visita a la escuela del barrio"));
  eq("admin: la rutina se guarda en la base", publicada, true);
  const fila = (await base()).posts.find(x => x.content === "Visita a la escuela del barrio") || {};
  eq("admin: como rutina, a su nombre", [fila.activity_type, fila.author_email], ["rutina", ADMIN]);
  eq("admin: y aparece en el Feed sin recargar", await esperarTexto(p, "Visita a la escuela del barrio", 3000), true);
  // Quién la cargó lo anota la base sola (registrar_posteo, probado en
  // supabase/pruebas/97-registro-de-posteos.sql): la app ya no escribe
  // esa entrada, ni podría (la base se la rechaza).
  await new Promise(r => setTimeout(r, 300));
  eq("admin: la app no anota a mano la carga en el registro (lo hace la base)",
    ((await base()).audit_log || []).filter(a => /^post_/.test(a.type)).length, 0);

  // Me gusta en un posteo de otro.
  const boton = await p.$('button[data-action="toggle-like"][data-post-id="p_reunion"]:not([data-reply-id])');
  eq("admin: puede darle me gusta a un posteo", !!boton, true);
  if(boton){
    await boton.click();
    const conMeGusta = await hasta(p, () => ((window.__sb.tablas.posts.find(x => x.id === "p_reunion") || {}).liked_by || []).length === 1);
    eq("admin: el me gusta queda guardado", conMeGusta, true);
    eq("admin: y se ve en el botón", await hasta(p,
       () => /\(1\)/.test((document.querySelector('.post[data-post-id="p_reunion"] .post-actions .gusta') || {}).textContent || "")), true);
  }

  // El menú ⋯ de la tarjeta: Editar, Repetir, Convertir en proyecto,
  // Cancelar y Borrar viven ahí (a la vista quedan Me gusta, Responder y
  // los comentarios). "Repetir este evento" abre el composer como evento
  // NUEVO con los datos del otro: mismo título, sin editingPost.
  await p.click('[data-action="toggle-post-menu"][data-post-id="p_reunion"]');
  const enMenu = await p.evaluate(() => [...document.querySelectorAll(".post-menu .post-menu-item")].map(b => b.dataset.action));
  eq("admin: el menú ⋯ ofrece editar, repetir y borrar", ["edit-post","duplicate-post","delete-post"].every(a => enMenu.includes(a)), true);
  eq("admin: y Borrar va último", enMenu[enMenu.length - 1], "delete-post");
  await p.click('.post-menu [data-action="duplicate-post"]');
  eq("admin: Repetir abre el composer con el mismo título", await hasta(p, () => (document.getElementById("cTitle") || {}).value === "Reunión con la comunidad"), true);
  eq("admin: como evento nuevo, no como edición", await p.evaluate(() => document.getElementById("postModalTitle").textContent.includes("otro")), true);
  eq("admin: y el menú ⋯ quedó cerrado", await p.evaluate(() => !document.querySelector(".post-menu")), true);
  await p.click('[data-action="cancel-composer"]');
  await hasta(p, () => document.getElementById("postModalOverlay").hidden);

  eq("con sesión, la barra de la app vuelve", await p.evaluate(() =>
     [document.body.classList.contains("en-portada"), getComputedStyle(document.querySelector("header.topbar")).display !== "none"]), [false, true]);
  eq("admin: el login quedó anotado en Actividad", (await base()).audit_log.some(a => a.type === "login" && a.actor_email === ADMIN), true);

  // Salir.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="sign-out"]');
  const salio = await hasta(p, () => !document.body.innerText.includes("Reunión con la comunidad"));
  if(!salio) console.log("   (en pantalla: " + JSON.stringify((await p.evaluate(() => document.body.innerText)).slice(0, 400)) + ")");
  eq("admin: al salir vuelve a la pantalla de entrada", salio, true);
  // La portada no adelanta cómo es la app por dentro: sin la barra de
  // arriba ni el pie (tanda 18).
  eq("portada: sin la barra de la app ni su pie, con la frase",
     await hasta(p, () => getComputedStyle(document.querySelector("header.topbar")).display === "none"
       && getComputedStyle(document.querySelector("footer.appfoot")).display === "none"
       && !!document.querySelector(".gate-portada .gate-frase")), true);
  eq("admin: y las solapas de admin ya no se ven", [await visible(p, "#tabAuditoria"), await visible(p, "#tabSolicitudes"),
     await visible(p, "#tabPreferencias")], [false, false, false]);
  eq("admin: y no quedan firmas de adjuntos guardadas en el navegador",
     await p.evaluate(() => localStorage.getItem("registro.firmas.v1")), null);

  eq("admin: sin un solo error en todo el camino", errores, []);
  await p.close();
}

/* ---------- Revisar lo de Calendar (tanda 19) ---------- */
{
  const importado = (id, titulo, fecha) => ({ id: "cal_" + id, title: titulo, content: "", date: fecha, start_date: fecha, end_date: fecha,
    activity_type: "otro", author_name: "Google Calendar", author_email: "", calendar_event_id: id, scopes: [], images: [], files: [],
    links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(30) });
  const { p, errores, base, rpc } = await entrar(ADMIN, "Benny", base => {
    base.posts.push(importado("ev1", "Visita Tucumán - Ana", "2025-02-04"), importado("ev2", "CB Mendoza (7 personas)", "2022-12-14"),
      importado("ev3", "Glämsta", "2025-08-15"), importado("ev4", "Reunión semanal", "2025-03-03"));
    base.calendar_sugerencias = [
      { evento: "ev1", grupo: "actividad", tipo: "visita", lugares: [{ type: "ciudad", country: "Argentina", city: "Tucuman" }], personas: ["Ana", "Zeka"], confianza: "alta" },
      { evento: "ev2", grupo: "actividad", tipo: "curso", lugares: [{ type: "ciudad", country: "Argentina", city: "Mendoza" }], personas: [], confianza: "alta" },
      { evento: "ev3", grupo: "actividad", tipo: "otro", lugares: [], personas: [], confianza: "baja" },
      { evento: "ev4", grupo: "reunion", tipo: null, lugares: [], personas: [], confianza: "alta" },
    ];
  });
  await esperarTexto(p, "Reunión con la comunidad");
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.waitForSelector('.admin-item[data-view="revisarcal"]');
  eq("revisar: en el menú de Administración, con cuántos faltan ordenar",
     await p.$eval('.admin-item[data-view="revisarcal"]', e => [...e.children].map(c => c.textContent.trim())), ["Revisar lo de Calendar", "4"]);
  await p.click('.admin-item[data-view="revisarcal"]');
  await p.waitForSelector(".rv-row [data-action='rv-editar']");
  const filas = () => p.$$eval(".admin-body > .lp-rows .rv-row:not(.rv-todos) .rv-tit b", l => l.map(e => e.textContent));
  eq("revisar: la pestaña «Sacados» se ve siempre, aunque no se haya sacado nada",
     await p.$eval('[data-action="rv-grupo"][data-key="sacados"]', e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null), "Sacados0");
  eq("revisar: arranca en Actividades, lo más nuevo primero", await filas(), ["Glämsta", "Visita Tucumán - Ana", "CB Mendoza (7 personas)"]);
  eq("revisar: cada fila con lo sugerido (tipo, lugar, personas)",
     await p.$eval('.rv-row:has([data-post-id="cal_ev1"]) .rv-sug', e => [...e.children].map(c => c.textContent.trim())), ["Sugerido:", "🧳 Visita", "📍 Tucuman, Argentina", "👥 Ana, Zeka"]);
  await p.click('[data-action="rv-seguros"]');
  eq("revisar: «Solo los seguros» deja los de punto verde", await filas(), ["Visita Tucumán - Ana", "CB Mendoza (7 personas)"]);
  await p.click('[data-action="rv-todos"]');
  eq("revisar: «Elegir todos» elige la lista entera y aparece la barra",
     await p.$eval(".rv-barra b", e => e.textContent), "2 elegidos");
  await p.click('[data-action="rv-sugerido"]');
  await hasta(p, () => !document.querySelector(".rv-barra"));
  const llamada = (await rpc()).find(r => r[0] === "clasificar_importados");
  eq("revisar: «Usar lo sugerido» manda tipo, lugar y personas en un solo pedido",
     llamada && llamada[1].p_cambios.map(c => [c.id, c.activity_type, (c.scopes || []).length, (c.participants || []).map(x => x.email || x.name)]),
     [["cal_ev1", "visita", 1, ["ana@x.com", "Zeka"]], ["cal_ev2", "curso", 1, []]]);
  const posts = (await base()).posts;
  eq("revisar: quedan ordenados en la base, sin fecha de edición (nadie recibe «Cambios en tus eventos»)",
     ["cal_ev1", "cal_ev2"].map(id => { const f = posts.find(x => x.id === id); return [f.activity_type, f.last_edited_at || null]; }),
     [["visita", null], ["curso", null]]);
  eq("revisar: el que no está en el equipo queda como nombre suelto, y el del equipo vinculado",
     posts.find(x => x.id === "cal_ev1").participants, [{ email: "ana@x.com", name: "Ana Pérez" }, { name: "Zeka" }]);
  await hasta(p, () => document.querySelector('.admin-item[data-view="revisarcal"]').textContent.includes("2"));
  eq("revisar: lo guardado se queda en su lugar, marcado «✓ Guardado» y con lo que quedó (no lo sugerido)",
     await p.$eval('.rv-row:has([data-post-id="cal_ev1"]) .rv-sug', e => [...e.children].map(c => c.textContent.trim())),
     ["✓ Guardado", "🧳 Visita", "📍 Tucuman, Argentina", "👥 Ana Pérez, Zeka"]);
  eq("revisar: la barra y el panel flotan abajo de la pantalla (acompañan al recorrer la lista)",
     await p.evaluate(() => { document.querySelector('[data-action="rv-elegir"][data-post-id="cal_ev2"]').click(); return true; })
       .then(() => p.waitForSelector(".rv-flota .rv-barra")).then(() => p.$eval(".rv-flota", e => getComputedStyle(e).position)), "fixed");
  await p.click('[data-action="rv-ninguno"]');
  // Varias cosas a la vez y sin borrar lo que ya tenían.
  await p.click('[data-action="rv-elegir"][data-post-id="cal_ev1"]');
  await p.click('[data-action="rv-elegir"][data-post-id="cal_ev2"]');
  await p.click('[data-action="rv-abrir"][data-key="cambiar"]');
  await p.waitForSelector(".rv-panel #rvTipo");
  await p.selectOption("#rvTipo", "seminario");
  await p.selectOption("#rvPais", "Uruguay");
  await p.click('[data-action="rv-alcance-sumar"]');
  await p.selectOption("#rvPais", "Chile");
  await p.click('[data-action="rv-alcance-sumar"]');
  // Israel: fuera de LatAm, pero se puede elegir como alcance.
  await p.selectOption("#rvPais", "Israel");
  await p.click('[data-action="rv-alcance-sumar"]');
  eq("revisar: en un mismo panel se arman tipo y varios alcances (Israel incluido), sin que se borren al seguir eligiendo",
     [await p.$eval("#rvTipo", e => e.value), await p.$$eval('[data-action="rv-alcance-quitar"]', l => l.length)], ["seminario", 3]);
  await p.click('[data-action="rv-panel-aplicar"]');
  await hasta(p, () => !document.querySelector(".rv-panel"));
  const juntos = (await base()).posts.filter(x => ["cal_ev1", "cal_ev2"].includes(x.id)).map(x => [x.id, x.activity_type, x.scopes.map(sc => sc.city || sc.country)]);
  eq("revisar: se aplica todo junto, y el alcance se SUMA al que ya tenían",
     juntos, [["cal_ev1", "seminario", ["Tucuman", "Uruguay", "Chile", "Israel"]], ["cal_ev2", "seminario", ["Mendoza", "Uruguay", "Chile", "Israel"]]]);
  eq("revisar: y los elegidos siguen elegidos, para seguir cambiándoles otra cosa",
     await p.$eval(".rv-flota .rv-barra b", e => e.textContent), "2 elegidos");
  await p.click('[data-action="rv-ninguno"]');
  // Los nombres sueltos se vinculan cuando la persona entra al equipo.
  eq("revisar: «Nombres sueltos» muestra a Zeka", await p.$$eval(".rv-sueltos .rv-tit b", l => l.map(e => e.textContent)), ["Zeka"]);
  await p.selectOption('.rv-vincular[data-nombre="Zeka"]', "ana@x.com");
  await p.click('[data-action="rv-vincular"][data-nombre="Zeka"]');
  await hasta(p, () => !document.querySelector(".rv-sueltos"));
  eq("revisar: vincular un nombre suelto lo pasa a la persona (sin duplicarla)",
     (await base()).posts.find(x => x.id === "cal_ev1").participants, [{ email: "ana@x.com", name: "Ana Pérez" }]);
  // Editar uno solo, a mano.
  await p.click('[data-action="rv-seguros"]');
  await p.click('[data-action="rv-editar"][data-post-id="cal_ev3"]');
  await p.waitForSelector(".rv-panel #rvTipo");
  eq("revisar: mientras se edita una fila no se ve la barra (ahí estaba «Sacar del Registro»)",
     await p.evaluate(() => !!document.querySelector(".rv-barra")), false);
  await p.selectOption("#rvTipo", "seminario");
  await p.selectOption("#rvPais", "Chile");
  await p.fill("#rvDonde", "Online");
  await p.click('[data-action="rv-panel-aplicar"]');
  await hasta(p, () => !document.querySelector(".rv-panel"));
  const ev3 = (await base()).posts.find(x => x.id === "cal_ev3");
  eq("revisar: «Editar» guarda tipo, a quién alcanza y, aparte, dónde fue",
     [ev3.activity_type, ev3.scopes, ev3.location], ["seminario", [{ type: "pais", country: "Chile" }], "Online"]);
  // Sacar del Registro: pregunta antes, y no vuelve.
  await p.click('[data-action="rv-grupo"][data-key="reunion"]');
  await p.click('[data-action="rv-elegir"][data-post-id="cal_ev4"]');
  await p.click('[data-action="rv-sacar"]');
  await p.waitForSelector("#confirmOk", { state: "visible" });
  eq("revisar: «Sacar del Registro» pregunta antes, aclara que no es para marcar como listo y que en Calendar sigue",
     await p.$eval("#confirmMessage, .confirm-message, [role=alertdialog] p, #confirmOverlay", e => /NO es para marcarlos como listos/.test(e.textContent) && /Siguen en Google Calendar/.test(e.textContent)).catch(() => null), true);
  await p.click("#confirmOk");
  await hasta(p, () => !(window.__sb.tablas.posts || []).some(x => x.id === "cal_ev4"));
  eq("revisar: se va de la base y queda anotado como sacado",
     [(await base()).posts.some(x => x.id === "cal_ev4"), ((await base()).calendar_sacados || []).map(x => x.evento)], [false, ["ev4"]]);
  // Y se puede deshacer: "Sacados" › Devolver al Registro.
  await p.waitForSelector('[data-action="rv-grupo"][data-key="sacados"]');
  await p.click('[data-action="rv-grupo"][data-key="sacados"]');
  await p.waitForSelector('.rv-row [data-action="rv-elegir"][data-post-id="ev4"]');
  eq("revisar: «Sacados» lista lo que se sacó, con quién lo sacó",
     await p.$eval('.rv-row:has([data-post-id="ev4"]) .rv-tit', e => [...e.children].map(c => c.textContent.trim())), ["Reunión semanal", "Lo sacó benny"]);
  await p.click('[data-action="rv-elegir"][data-post-id="ev4"]');
  await p.click('[data-action="rv-devolver"]');
  await hasta(p, () => (window.__sb.tablas.posts || []).some(x => x.id === "cal_ev4"));
  eq("revisar: «Devolver al Registro» lo trae de vuelta y deja de estar sacado",
     [(await base()).posts.some(x => x.id === "cal_ev4"), ((await base()).calendar_sacados || []).length], [true, 0]);
  eq("revisar: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Un integrante común ---------- */
{
  // El admin editó la Reunión de Ana hace unas horas (tanda 17).
  const { p, errores, base } = await entrar("ana@x.com", "Ana Pérez", base => {
    base.posts[0].last_edited_at = hace(0.2); base.posts[0].last_edited_by = "Benny"; base.posts[0].last_edited_by_email = ADMIN;
  });
  eq("integrante: entra y ve los posteos", await esperarTexto(p, "Programa de becas"), true);
  // Tanda 17: editar está abierto a todo el equipo; cancelar, solo para el
  // autor, los participantes, los editores y los admins. Ana puede editar
  // el proyecto del admin pero no cancelarlo; el suyo, las dos cosas.
  const menuDe = async id => {
    await p.click(`.post[data-post-id="${id}"] [data-action="toggle-post-menu"]`);
    await p.waitForTimeout(150);
    const acciones = await p.evaluate(id => [...document.querySelectorAll(`.post[data-post-id="${id}"] .post-menu [data-action]`)].map(b => b.dataset.action), id);
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    return acciones;
  };
  const menuAjeno = await menuDe("p_proyecto"), menuPropio = await menuDe("p_reunion");
  eq("integrante: puede editar el evento de otro, pero no cancelarlo", [menuAjeno.includes("edit-post"), menuAjeno.includes("cancel-post")], [true, false]);
  eq("integrante: el suyo lo edita y lo cancela", [menuPropio.includes("edit-post"), menuPropio.includes("cancel-post")], [true, true]);
  eq("tarjeta: dice quién la editó por última vez y cuándo",
    await p.$eval('.post[data-post-id="p_reunion"] .post-editado', e => e.textContent.includes("editado") && e.title.startsWith("Editado por Benny")), true);
  await p.click('[data-action="toggle-mentions-menu"]');
  await p.waitForTimeout(150);
  eq("campanita: avisa los cambios que otros hicieron en tus eventos",
    await p.evaluate(() => [[...document.querySelectorAll(".mentions-menu .bell-section")].map(e => e.textContent).includes("Cambios en tus eventos"),
      /Editó/.test(document.querySelector(".mentions-menu").textContent), !!document.querySelector('.bell-filtros [data-key="cambios"]')]), [true, true, true]);
  await p.click('[data-action="toggle-mentions-menu"]');
  // Lo visto queda en su cuenta, no solo en este navegador: así en el
  // celular tampoco le aparece como nuevo.
  await hasta(p, () => (window.__sb.tablas.user_prefs || []).some(f => f.email === "ana@x.com" && f.prefs.visto_changesSeenAt));
  const vistos = ((await base()).user_prefs.find(f => f.email === "ana@x.com") || {}).prefs || {};
  eq("campanita: lo visto se guarda en la cuenta (vale en todos sus aparatos)",
    ["visto_mentionsSeenAt", "visto_repliesSeenAt", "visto_changesSeenAt", "visto_upcomingSeenIds"].every(k => k in vistos), true);
  await p.click('[data-action="toggle-user-menu"]');
  eq("integrante: el menú del avatar no ofrece Administración", !!(await p.$('.user-menu [data-action="goto-view"][data-view="admin"]')), false);
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  eq("integrante: llega a Mis preferencias", await hasta(p, () => !!document.querySelector('select[data-pref="weekStart"]')), true);
  const vistas = await p.$$eval("nav.tabs button[data-view]", bs => bs.filter(x => !x.hidden).map(x => x.dataset.view));
  for(const v of vistas){ await p.click(`nav.tabs button[data-view="${v}"]`); await p.waitForTimeout(200); }
  eq("integrante: recorre sus solapas", vistas, ["feed","calendario","paises","proyectos","reportes"]);
  eq("integrante: sin un solo error", errores, []);
  await p.close();
}

/* ---------- La campanita ---------- */
{
  // Un evento cerca (con el aviso de 7 días prendido), una respuesta de
  // Ana a un proyecto del admin y una mención al admin en el posteo de Ana.
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.user_prefs.push({ email: ADMIN, prefs: { notifyLead: 7 * 24 * 60 } });
    base.replies.push({ id: "r_2", post_id: "p_proyecto", content: "Avance: 30 postulantes.", author_name: "Ana Pérez",
      author_email: "ana@x.com", scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [],
      system: false, created_at: hace(0.1) });
    base.posts[0].mentions = [ADMIN]; base.posts[0].content += " @benny";
  });
  await esperarTexto(p, "Reunión con la comunidad");
  const secciones = () => p.$$eval(".mentions-menu .bell-section", es => es.map(e => e.textContent));
  const nuevos = () => p.$$eval(".mentions-menu .mention-item.nuevo", es => es.length);
  await p.click('[data-action="toggle-mentions-menu"]');
  eq("campanita: las tres secciones, los eventos primero", await secciones(), ["Próximos eventos", "Respuestas a tus posteos", "Menciones"]);
  // Nunca se había abierto: la respuesta y la mención llevan "Nuevo"; el
  // evento no, que no es algo que alguien le haya dicho.
  eq("campanita: lo que no se vio lleva la marca Nuevo", await nuevos(), 2);
  await p.click('.bell-filtros [data-action="bell-filtro"][data-key="respuestas"]');
  eq("campanita: el filtro deja solo las respuestas", await secciones(), ["Respuestas a tus posteos"]);
  eq("campanita: y el panel sigue abierto", await visible(p, ".mentions-menu"), true);
  await p.click('.bell-filtros [data-action="bell-filtro"][data-key="todo"]');
  await p.click('[data-action="toggle-mentions-menu"]');
  eq("campanita: se cierra con el mismo botón", await visible(p, ".mentions-menu"), false);
  await p.click('[data-action="toggle-mentions-menu"]');
  eq("campanita: al reabrir, lo de antes ya no es nuevo", await nuevos(), 0);
  eq("campanita: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Administración: la sugerencia del Caribe, el menú ⋯ de los tipos, acceso por adelantado ---------- */
{
  const { p, errores, base } = await entrar(ADMIN, "Benny");
  await esperarTexto(p, "Reunión con la comunidad");
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="zonas"]');
  eq("zonas: con las islas mezcladas en el Norte, aparece la sugerencia de separar el Caribe", await visible(p, ".sugerencia-caribe"), true);
  await p.click('[data-action="zonas-caribe"]');
  const caribe = await p.$$eval('.zone-chips[data-zone-key="caribe"] .zc-chip', es => es.length);
  const norte = await p.$$eval('.zone-chips[data-zone-key="norte"] .zc-chip', es => es.length);
  // El Norte de fábrica tiene 40 países: 25 islas y 15 del continente.
  eq("zonas: armarla pasa las 25 islas a una zona Caribe nueva y el Norte queda con el resto", [caribe, norte], [25, 15]);
  eq("zonas: queda a la vista como cambios sin guardar, y la sugerencia ya no se muestra",
    [await p.$eval(".zonas-cambios", e => /25 cambios sin guardar/.test(e.textContent)), await visible(p, ".sugerencia-caribe")], [true, false]);
  await p.click('[data-action="zonas-reset"]');
  eq("zonas: descartar los cambios la vuelve a mostrar", await visible(p, ".sugerencia-caribe"), true);
  await p.click('[data-action="zonas-caribe-no"]');
  eq("zonas: 'Ahora no' la esconde", await visible(p, ".sugerencia-caribe"), false);
  // Dar acceso por adelantado (tanda 11): el correo queda en el equipo
  // antes de que la persona entre por primera vez.
  await p.click('.admin-menu [data-action="admin-go"][data-view="solicitudes"]');
  await p.click('[data-action="acceso-section"][data-key="pendientes"]');
  await p.fill("#preEmail", "Nuevo@x.com");
  await p.fill("#preName", "Nuevo Integrante");
  await p.click('[data-action="preaprobar"]');
  eq("acceso: el correo cargado queda en el equipo (en minúsculas)", await hasta(p, () => (window.__sb.tablas.members || []).some(m => m.email === "nuevo@x.com")), true);
  const nuevo = (await base()).members.find(m => m.email === "nuevo@x.com") || {};
  eq("acceso: con su nombre, como integrante y con @nickname", [nuevo.name, nuevo.role, nuevo.nickname], ["Nuevo Integrante", "member", "nuevo"]);
  eq("acceso: y la pantalla lo confirma", await hasta(p, () => /nuevo@x.com ya tiene acceso/.test((document.querySelector(".preaprobar-ok") || {}).textContent || "")), true);
  eq("acceso: queda anotado en el registro de actividad", await hasta(p, admin => (window.__sb.tablas.audit_log || []).some(a => a.type === "access_approved" && a.target_email === "nuevo@x.com" && a.actor_email === admin), ADMIN), true);
  await p.fill("#preEmail", "nuevo@x.com");
  await p.click('[data-action="preaprobar"]');
  eq("acceso: cargarlo de nuevo avisa que ya está", await hasta(p, () => /ya está en el equipo/.test((document.querySelector(".preaprobar .form-error") || {}).textContent || "")), true);
  // Tipos: una lista con lo mínimo y, al tocar un tipo, su ficha al
  // costado con todo (nombre, ícono, Calendar, documentos, orden,
  // archivar; eliminar solo si no se usa).
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="tipos"]');
  const orden = () => p.$$eval('.lp-row[data-action="tipo-abrir"] .lp-who b', es => es.map(e => e.textContent));
  eq("tipos: arrancan en el orden de fábrica", (await orden()).slice(0, 2), ["Visita", "Curso"]);
  eq("tipos: sin ficha abierta hasta tocar un tipo", await visible(p, ".lp-panel"), false);
  eq("tipos: '+ Agregar tipo' va en la cabecera, a la altura del título, sin un renglón propio",
    [!!(await p.$('.admin-cabecera [data-action="tipo-nuevo"]')), !!(await p.$(".tipos-top"))], [true, false]);
  await p.click('.lp-row[data-action="tipo-abrir"][data-key="visita"]');
  eq("tipos: tocar Visita abre su ficha, con su nombre para editar", await p.$eval('.lp-panel [data-action="tipos-label"][data-key="visita"]', e => e.value), "Visita");
  // Al tocar con el mouse, el foco vuelve por programa a la fila recién
  // dibujada; el navegador le pintaría el anillo de teclado (y la esquina
  // redondeada de la lista lo recortaba con picos blancos). No va.
  eq("tipos: la fila tocada con el mouse recupera el foco pero sin el anillo del navegador",
    await p.evaluate(() => { const a = document.activeElement; return [a.dataset.action, a.dataset.key, a.classList.contains("sin-anillo"), getComputedStyle(a).outlineStyle]; }),
    ["tipo-abrir", "visita", true, "none"]);
  eq("tipos: la ficha no ofrece eliminarla (hay posteos) y dice por qué",
    [!!(await p.$('.lp-panel [data-action="tipos-remove"]')), await p.$eval(".lp-pf", e => /No se puede eliminar: hay 2 posteos con este tipo/.test(e.textContent))],
    [false, true]);
  await p.click('.lp-panel [data-action="tipos-move"][data-key="visita"][data-dir="1"]');
  eq("tipos: 'Bajar' la pone segunda y la ficha sigue abierta", [(await orden()).slice(0, 2), await visible(p, ".lp-panel")], [["Curso", "Visita"], true]);
  eq("tipos: y abajo avisa que hay cambios sin guardar", await p.$eval(".tipos-acciones", e => /Cambios sin guardar/.test(e.textContent)), true);
  // Archivar (tanda 11): Congreso no tiene posteos; archivado deja de
  // ofrecerse al cargar un evento, pero sigue en la lista para desarchivar.
  await p.click('.lp-row[data-action="tipo-abrir"][data-key="congreso"]');
  eq("tipos: un tipo sin posteos sí se puede eliminar desde su ficha", !!(await p.$('.lp-panel [data-action="tipos-remove"][data-key="congreso"]')), true);
  await p.click('.lp-panel [data-action="tipos-archive"][data-key="congreso"]');
  eq("tipos: archivar marca la fila", await p.$$eval(".lp-row.archivado .lp-who b", es => es.map(e => e.textContent)), ["Congreso"]);
  await p.click('[data-action="tipos-save"]');
  eq("tipos: al guardar, la base recibe archived:true en ese tipo", await hasta(p, () => {
    const c = (window.__sb.tablas.app_config || []).find(x => x.key === "preferences");
    return !!(c && c.value && Array.isArray(c.value.activityTypes) && c.value.activityTypes.some(t => t.key === "congreso" && t.archived === true));
  }), true);
  const tiposGuardados = ((await base()).app_config.find(x => x.key === "preferences") || { value: {} }).value.activityTypes || [];
  eq("tipos: los demás se guardan con la forma de siempre, sin la marca", tiposGuardados.filter(t => "archived" in t).map(t => t.key), ["congreso"]);
  await p.click('[data-action="toggle-fab"]');
  await p.click('.fab-action[data-action="new-evento"]');
  eq("tipos: el formulario de evento nuevo ya no ofrece Congreso", await hasta(p, () => {
    const ops = [...document.querySelectorAll(".type-picker .type-opt")].map(e => e.textContent.trim());
    return ops.length > 0 && !ops.some(x => /Congreso/.test(x)) && ops.some(x => /Visita/.test(x));
  }), true);
  // "No pasarlo a Google Calendar" (4/10/2026): queda solo en el Registro,
  // sin crear el evento en el Calendar compartido.
  eq("evento: la casilla «No pasarlo a Google Calendar» está, sin marcar", await p.$eval("#cSinCalendar", e => e.checked).catch(() => null), false);
  await p.fill("#cTitle", "Evento viejo sin Calendar");
  await p.fill("#cPlaceQuery", "Uruguay");
  await p.waitForSelector('#postForm [data-action="pick-place"]');
  await p.click('#postForm [data-action="pick-place"]');
  await p.check("#cSinCalendar");
  const avisoAntes = await p.evaluate(() => [...document.querySelectorAll(".calendar-notice")].map(e => e.textContent).join("|"));
  await p.click('#postForm button[type="submit"]');
  eq("evento: se guarda marcado sin Calendar", await hasta(p, () =>
    (window.__sb.tablas.posts || []).some(x => x.title === "Evento viejo sin Calendar" && x.sin_calendar === true)), true);
  await p.waitForTimeout(1200);
  eq("evento: y no intenta pasarlo al Calendar (no hay aviso de Calendar)",
    await p.evaluate(a => [...document.querySelectorAll(".calendar-notice")].map(e => e.textContent).join("|"), avisoAntes).then(t => t === avisoAntes || !/Calendar/.test(t)), true);
  await p.click('[data-action="toggle-fab"]');
  await p.click('.fab-action[data-action="new-evento"]');
  await p.waitForSelector("#cTitle");
  // Comentarios es opcional (4/10/2026): con título, fecha y lugar alcanza.
  eq("evento: el campo de comentarios dice que es opcional",
    await p.$$eval("#postForm label", ls => ls.some(l => l.textContent.trim() === "Comentarios (opcional)")), true);
  // Los botones de abajo quedan pegados al borde mientras el formulario
  // scrollea, y el cuadro de comentarios (con z-index por el resaltado de
  // las @menciones) se les pasaba por encima (5/10/2026).
  eq("evento: el cuadro de comentarios no tapa la franja de Cancelar / Publicar", await p.evaluate(() => {
    const form = document.getElementById("postForm");
    const ta = form.querySelector("textarea.mention-input");
    const pie = form.querySelector(".modal-actions");
    ta.style.height = "900px";
    let vista = false, tapa = false;
    for(let y = 0; y <= form.scrollHeight; y += 20){
      form.scrollTop = y;
      const a = ta.getBoundingClientRect(), b = pie.getBoundingClientRect();
      if(a.top < b.top + 4 && a.bottom > b.bottom - 4){
        vista = true;
        for(const x of [b.left + 4, b.left + b.width / 2, b.right - 4]){
          const el = document.elementFromPoint(x, b.top + b.height / 2);
          if(!el || !el.closest(".modal-actions")) tapa = true;
        }
      }
    }
    ta.style.height = ""; form.scrollTop = 0;
    return vista && !tapa;
  }), true);
  await p.fill("#cTitle", "Evento sin comentarios");
  await p.fill("#cPlaceQuery", "Uruguay");
  await p.waitForSelector('#postForm [data-action="pick-place"]');
  await p.click('#postForm [data-action="pick-place"]');
  await p.click('#postForm button[type="submit"]');
  eq("evento: se publica sin comentarios, con el contenido vacío", await hasta(p, () =>
    (window.__sb.tablas.posts || []).some(x => x.title === "Evento sin comentarios" && x.content === "")), true);
  await p.keyboard.press("Escape");
  eq("admin: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Un comentario huérfano y a quién le gusta (5/10/2026) ---------- */
// Una rutina con "Ver 1 comentario" abría el hilo vacío: el comentario
// respondía a otro que ya se había borrado y no se dibujaba en ningún lado.
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.posts.push({ id: "p_rutina", title: "", content: "Rutina con un comentario suelto",
      date: dia(1), start_date: dia(1), end_date: dia(1), activity_type: "rutina",
      author_name: "Benny", author_email: ADMIN, scopes: [], images: [], files: [], links: [], mentions: [],
      liked_by: ["ana@x.com"], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(1) });
    base.replies.push({ id: "r_huerfano", post_id: "p_rutina", reply_to_id: "r_borrado", content: "Respuesta a uno que ya no está",
      author_name: "Ana Pérez", author_email: "ana@x.com", scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [],
      system: false, created_at: hace(1) });
  });
  await esperarTexto(p, "Rutina con un comentario suelto");
  await p.click('button[data-action="toggle-thread"][data-post-id="p_rutina"]');
  eq("hilo: el comentario cuyo padre se borró igual se ve", await esperarTexto(p, "Respuesta a uno que ya no está", 3000), true);
  // El número al lado de «Me gusta» (5/10/2026): al pasar el mouse, los
  // primeros tres, uno por renglón; al apretarlo, la lista entera, sin
  // dar me gusta; y desde la lista, el perfil de cada uno.
  const gustan = '.post[data-post-id="p_rutina"] .post-actions .gustan';
  await p.hover(gustan);
  eq("me gusta: al pasar por el número, una burbuja con quiénes",
    await p.$eval(gustan + " .gustan-tip", e => getComputedStyle(e).display !== "none" ? [...e.children].map(c => c.textContent) : null), ["Ana Pérez"]);
  await p.click(gustan);
  eq("me gusta: apretar el número abre la lista", await hasta(p, () => !document.getElementById("likesOverlay").hidden), true);
  eq("me gusta: con cada uno, su nombre y su @apodo",
    await p.$$eval("#likesOverlay .lk-row", rs => rs.map(r => r.querySelector(".lk-txt").innerText.replace(/\s+/g, " ").trim())), ["Ana Pérez @ana"]);
  eq("me gusta: y no da me gusta", ((await p.evaluate(() => window.__sb.tablas.posts.find(x => x.id === "p_rutina").liked_by))), ["ana@x.com"]);
  await p.keyboard.press("Escape");
  eq("me gusta: Escape la cierra y el foco vuelve al número",
    await p.evaluate(s => document.getElementById("likesOverlay").hidden && document.activeElement === document.querySelector(s), gustan), true);
  await p.click(gustan);
  await p.click('#likesOverlay .lk-row[data-email="ana@x.com"]');
  eq("me gusta: tocar a alguien abre su perfil", await hasta(p, () =>
    document.getElementById("likesOverlay").hidden && !document.getElementById("userProfileOverlay").hidden &&
    /Ana Pérez/.test(document.getElementById("userProfileBody").textContent)), true);
  // El «‹» del perfil (6/10/2026): vuelve a la lista; Escape también; la ✕
  // cierra todo.
  eq("perfil: desde la lista de Me gusta tiene «‹» para volver", await p.$eval("#userProfileBack", e => !e.hidden && getComputedStyle(e).display !== "none"), true);
  await p.click("#userProfileBack");
  eq("perfil: «‹» vuelve a la lista de Me gusta", await p.evaluate(() =>
    document.getElementById("userProfileOverlay").hidden && !document.getElementById("likesOverlay").hidden), true);
  await p.click('#likesOverlay .lk-row[data-email="ana@x.com"]');
  await p.keyboard.press("Escape");
  eq("perfil: Escape también vuelve un paso", await p.evaluate(() =>
    document.getElementById("userProfileOverlay").hidden && !document.getElementById("likesOverlay").hidden), true);
  await p.click('#likesOverlay .lk-row[data-email="ana@x.com"]');
  await p.click("#userProfileClose");
  eq("perfil: la ✕ cierra todo", await p.evaluate(() =>
    document.getElementById("userProfileOverlay").hidden && document.getElementById("likesOverlay").hidden), true);
  eq("hilo: sin un solo error", errores, []);
  await p.close();
}

/* ---------- El resumen de una visita (6/10/2026) ---------- */
// La app lee el Formulario de Cierre en Word y arma el resumen de la
// visita (resumen ejecutivo, objetivos, lo que sigue) y el del país.
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.posts.push({ id: "p_visita", title: "Visita a la sede", content: "x",
      date: dia(20), start_date: dia(20), end_date: dia(18), activity_type: "visita",
      author_name: "Ana Pérez", author_email: "ana@x.com", scopes: [{ type: "ciudad", country: "Uruguay", city: "Montevideo" }],
      images: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      files: [{ name: "Formulario de Cierre - Montevideo.docx", kind: "doc", path: "posts/p_visita/cierre.docx", subidoEl: hace(17) },
              { name: "Memoria Completa - Montevideo.docx", kind: "doc", path: "posts/p_visita/memoria.docx", subidoEl: hace(16) }],
      created_at: hace(25) });
  });
  await esperarTexto(p, "Visita a la sede");
  const tarjeta = '.post[data-post-id="p_visita"]';
  eq("resumen: sin leer todavía, la tarjeta no muestra ninguno", !!(await p.$(tarjeta + " .rs-pill")), false);
  await p.click(tarjeta + ' [data-action="toggle-post-menu"]');
  await p.click(tarjeta + ' [data-action="leer-resumen"]');
  eq("resumen: «Leer el resumen de los documentos» lo guarda en la base", await hasta(p, () => {
    const r = (window.__sb.tablas.posts.find(x => x.id === "p_visita") || {}).resumen;
    const x = r && r.partes && r.partes[0];
    return !!x && r.partes.length === 1 && x.tipo === "cierre" && x.objetivos.length === 2 && x.pasos.length === 4;
  }), true);
  eq("resumen: el de la Memoria no se usa (manda el Cierre)", (await p.evaluate(() => window.__sb.tablas.posts.find(x => x.id === "p_visita").resumen.partes[0].fuente.name)), "Formulario de Cierre - Montevideo.docx");
  eq("resumen: la tarjeta lo ofrece con cuántos objetivos se lograron", await hasta(p, s => /Resumen · 1\/2/.test((document.querySelector(s + " .rs-pill") || {}).textContent || ""), tarjeta), true);
  eq("resumen: queda abierto después de leerlo", await p.$$eval(tarjeta + " .rs-panel .rs-obj li", ls => ls.map(l => l.innerText.replace(/\s+/g, " ").trim())), ["Sí Conocer la sede", "Parcial Revisar el acceso"]);
  eq("resumen: con el resumen ejecutivo", await p.$eval(tarjeta + " .rs-txt", e => e.textContent.trim()), "La visita a la sede salió bien.");
  eq("resumen: «lo que sigue» muestra tres y el resto en «+1 más»",
    [await p.$$eval(tarjeta + " .rs-pasos li", ls => ls.length), await p.$eval(tarjeta + ' [data-action="resumen-todos-pasos"]', e => e.textContent.trim())], [3, "+1 más"]);
  eq("resumen: y un enlace para abrir la Memoria completa", !!(await p.$(tarjeta + ' .rs-pie [data-action="resumen-abrir"][data-pos="1"]')), true);
  await p.click(tarjeta + ' .rs-pasos li:first-child input[data-action="resumen-paso"]');
  eq("resumen: tildar un paso lo guarda como hecho, con quién", await hasta(p, () => {
    const x = window.__sb.tablas.posts.find(y => y.id === "p_visita").resumen.partes[0].pasos[0];
    return x.estado === "hecho" && x.por === "benny@team-latam.com";
  }), true);
  eq("resumen: y no cuenta como edición del evento", (await p.evaluate(() => window.__sb.tablas.posts.find(y => y.id === "p_visita").last_edited_by || null)), null);
  await p.click(tarjeta + ' .rs-pasos li:first-child [data-action="resumen-no-tarea"]');
  eq("resumen: «No es tarea» lo saca de los pendientes", await hasta(p, () =>
    window.__sb.tablas.posts.find(y => y.id === "p_visita").resumen.partes[0].pasos[1].estado === "no"), true);
  // El resumen del país: Países → Uruguay.
  await p.click('nav.tabs button[data-view="paises"]');
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "paises-subview"; x.dataset.key = "lista"; document.body.appendChild(x); x.click(); x.remove(); });
  await p.click('[data-action="drill-country"][data-country="Uruguay"]');
  // La ficha del país (6/10/2026): todo sin salir de Países.
  eq("ficha: el país tiene su ficha", await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Uruguay"), true);
  eq("ficha: visitas, objetivos y lo que sigue", await p.$$eval(".fl-stat b", bs => bs.map(x => x.textContent.trim())).then(v => [v[0], v[2], v[3]]), ["1", "1 de 2", "2"]);
  eq("ficha: la lectura rápida cuenta los objetivos de la última visita",
    await p.$$eval(".fl-lectura li", ls => ls.some(l => /1 de 2 objetivos/.test(l.textContent))), true);
  eq("ficha: lo que sigue dice de qué visita salió", await p.$$eval(".fl-main .rs-pasos li small", s => s.length === 2 && s.every(x => /Visita a la sede/.test(x.textContent))), true);
  eq("ficha: en la línea de tiempo, la visita con su resumen y su 1/2",
    await p.$eval('.fl-it[data-post-id="p_visita"]', e => [e.querySelector(".tt").textContent.trim(), e.querySelector(".rs").textContent.trim(), e.querySelector(".rs-ok").textContent.trim()]),
    ["Visita a la sede", "La visita a la sede salió bien.", "1/2"]);
  await p.click('.fl-it[data-post-id="p_visita"]');
  eq("ficha: tocar un ítem lo abre ahí mismo, sin ir al Inicio", await hasta(p, () =>
    !document.getElementById("fichaPostOverlay").hidden && !!document.querySelector('#fichaPostBody .post[data-post-id="p_visita"]') && !!document.querySelector(".ficha-lugar")), true);
  // La ventana (6/10/2026): la tarjeta entera, sin barra propia, con la
  // cabecera que dice de dónde se vino, y el menú ⋯ sin cortar.
  eq("ventana: sin alto tope ni barra propia, y dice de qué ficha se vino", await p.evaluate(() => [
    getComputedStyle(document.querySelector(".ficha-post-modal")).maxHeight, getComputedStyle(document.getElementById("fichaPostBody")).overflowY,
    (document.getElementById("fichaPostDesde") || {}).textContent || null]), ["none", "visible", "De la ficha de Uruguay"]);
  await p.click('#fichaPostBody [data-action="toggle-post-menu"]');
  eq("ventana: el menú ⋯ se ve entero", await p.evaluate(() => {
    const it = document.querySelector('#fichaPostBody .post-menu-item[data-action="edit-post"]');
    if(!it) return "sin menú";
    const r = it.getBoundingClientRect();
    const abajo = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2);
    return abajo && abajo.closest(".post-menu-item") === it;
  }), true);
  await p.keyboard.press("Escape");
  await hasta(p, () => !document.querySelector("#fichaPostBody .post-menu"));
  if(!(await p.evaluate(() => document.getElementById("fichaPostOverlay").hidden))) await p.keyboard.press("Escape");
  eq("ficha: Escape lo cierra", await p.evaluate(() => document.getElementById("fichaPostOverlay").hidden), true);
  // Una rutina en Uruguay: la app pregunta si cumple algo pendiente.
  await p.click('nav.tabs button[data-view="feed"]');
  await p.waitForSelector("#rutinaContent");
  await p.fill("#rutinaContent", "Se envió el plan de cámaras al rabino");
  await p.fill("#rutinaPlaceQuery", "Montevideo");
  await p.waitForSelector('[data-action="pick-place"]');
  await p.click('[data-action="pick-place"]');
  await p.click("#rutinaPublish");
  eq("cumple: después de la rutina pregunta si cumple algo pendiente en Uruguay", await hasta(p, () => !document.getElementById("cumpleOverlay").hidden), true);
  eq("cumple: con los pendientes de sus visitas (no los hechos ni los que no son tarea)",
    await p.$$eval("#cumpleOverlay .cp-fila .t", ts => ts.map(x => x.textContent.trim())), ["Revisar la iluminación.", "Sumar un segundo turno."]);
  await p.click('#cumpleOverlay .cp-fila:nth-child(2)');
  eq("cumple: elegir uno lo marca hecho, con la rutina al lado", await hasta(p, () => {
    const posts = window.__sb.tablas.posts;
    const rutina = posts.find(x => x.content === "Se envió el plan de cámaras al rabino");
    const x = posts.find(y => y.id === "p_visita").resumen.partes[0].pasos[3];
    return !!rutina && x.estado === "hecho" && x.rutina === rutina.id;
  }), true);
  eq("cumple: y se cierra", await p.evaluate(() => document.getElementById("cumpleOverlay").hidden), true);
  eq("resumen: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Un viaje por dos países: un Cierre por cada uno ---------- */
// Pedido del usuario (6/10/2026): un evento por Santo Domingo, Kingston y
// Montego Bay tenía un Cierre por lugar, y la app se quedaba con uno solo.
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.posts.push({ id: "p_viaje", title: "Montevideo y Buenos Aires", content: "x",
      date: dia(40), start_date: dia(40), end_date: dia(35), activity_type: "visita",
      author_name: "Benny", author_email: ADMIN,
      scopes: [{ type: "ciudad", country: "Uruguay", city: "Montevideo" }, { type: "ciudad", country: "Argentina", city: "Buenos Aires" }],
      images: [], links: [], mentions: [], liked_by: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      milestones: [{ id: "h1", label: "Mandar el presupuesto", date: dia(10), done: false }, { id: "h2", label: "Pedir la autorización", date: dia(50), done: true }],
      files: [{ name: "Formulario de Cierre - Montevideo, Uruguay.docx", kind: "doc", path: "posts/p_viaje/cierre-uy.docx", subidoEl: hace(34) },
              { name: "Formulario de Cierre - Buenos Aires, Argentina.docx", kind: "doc", path: "posts/p_viaje/cierre-ar.docx", subidoEl: hace(33) }],
      is_project: true, project_status: "open",
      created_at: hace(45) });
    // Algo de todo el equipo, que en una ciudad solo entra si se pide.
    base.posts.push({ id: "p_latam", title: "Reunión regional de todo el equipo", content: "x",
      date: dia(5), start_date: dia(5), end_date: dia(5), activity_type: "otro", author_name: "Benny", author_email: ADMIN,
      scopes: [{ type: "todo" }], images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(6) });
    // Y otra visita, a Punta del Este, ya leída.
    base.posts.push({ id: "p_pde", title: "Punta del Este", content: "x",
      date: dia(10), start_date: dia(10), end_date: dia(9), activity_type: "visita", author_name: "Benny", author_email: ADMIN,
      scopes: [{ type: "ciudad", country: "Uruguay", city: "Punta Del Este" }],
      images: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      files: [{ name: "Formulario de Cierre - Punta del Este.docx", kind: "doc", path: "posts/p_pde/cierre-pde.docx", subidoEl: hace(8) }],
      created_at: hace(12) });
    // Y otro proyecto en Montevideo, con un hito que todavía no llegó.
    base.posts.push({ id: "p_proy2", title: "Plan de cámaras de Montevideo", content: "x",
      date: dia(30), start_date: dia(30), end_date: dia(30), activity_type: "otro", author_name: "Benny", author_email: ADMIN,
      scopes: [{ type: "ciudad", country: "Uruguay", city: "Montevideo" }], is_project: true, project_status: "open",
      milestones: [{ id: "h3", label: "Instalar las cámaras", date: dia(-20), done: false, owners: [ADMIN] }],
      images: [], files: [], links: [], mentions: [], liked_by: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(31) });
  });
  await esperarTexto(p, "Montevideo y Buenos Aires");
  await p.click('nav.tabs button[data-view="paises"]');
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "paises-subview"; x.dataset.key = "lista"; document.body.appendChild(x); x.click(); x.remove(); });
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Argentina");
  const stats = () => p.$$eval(".fl-stat b", bs => bs.map(x => x.textContent.trim()));
  eq("viaje: sin leer, la visita dice «sin Cierre»", await p.$eval('.fl-it[data-post-id="p_viaje"] .rs-ok', e => e.textContent.trim()), "sin Cierre");
  await p.click('.fl-it[data-post-id="p_viaje"]');
  await p.click('#fichaPostBody [data-action="toggle-post-menu"]');
  await p.click('#fichaPostBody [data-action="leer-resumen"]');
  eq("viaje: leerlo desde la ventana guarda los dos Cierres", await hasta(p, () => {
    const r = window.__sb.tablas.posts.find(x => x.id === "p_viaje").resumen;
    return !!r && r.partes.length === 2;
  }), true);
  await p.keyboard.press("Escape");
  eq("viaje: Argentina cuenta solo su Cierre", await hasta(p, () => {
    const v = [...document.querySelectorAll(".fl-stat b")].map(x => x.textContent.trim());
    return v[2] === "1 de 1" && v[3] === "1";
  }), true);
  eq("viaje: con su resumen en la línea de tiempo y su marca",
    await p.$eval('.fl-it[data-post-id="p_viaje"]', e => [e.querySelector(".rs").textContent.trim(), e.querySelector(".rs-ok").textContent.trim()]), ["En Buenos Aires todo en orden.", "1/1"]);
  await p.click('.fl-migas [data-action="drill-clear"]');
  await p.click('[data-action="drill-country"][data-country="Uruguay"]');
  eq("viaje: y Uruguay, solo el suyo (Punta del Este todavía sin leer)", await hasta(p, () => {
    const v = [...document.querySelectorAll(".fl-stat b")].map(x => x.textContent.trim());
    return v[0] === "2" && v[2] === "1 de 2" && v[3] === "4";
  }), true);
  await p.click('.fl-it[data-post-id="p_pde"]');
  await p.click('#fichaPostBody [data-action="toggle-post-menu"]');
  await p.click('#fichaPostBody [data-action="leer-resumen"]');
  await p.keyboard.press("Escape");
  eq("ciudades: Uruguay junta las dos ciudades", await hasta(p, () => {
    const v = [...document.querySelectorAll(".fl-stat b")].map(x => x.textContent.trim());
    return v[2] === "2 de 3" && v[3] === "5";
  }), true);
  eq("ciudades: la ficha del país lista sus ciudades", await p.$$eval('.fl-hijo[data-action="drill-city"]', es => es.map(e => e.dataset.city).sort()), ["Montevideo", "Punta Del Este"]);
  await p.click('.fl-hijo[data-city="Punta Del Este"]');
  eq("ciudades: al entrar a Punta del Este, su ficha (sin ir al Inicio)", await hasta(p, () =>
    (document.querySelector(".ficha-lugar h1") || {}).textContent === "Punta Del Este" && /Uruguay/.test(document.querySelector(".fl-migas").textContent)), true);
  eq("ciudades: solo con lo suyo", await stats().then(v => [v[0], v[2], v[3]]), ["1", "1 de 1", "1"]);
  await p.click('.fl-migas [data-action="drill-country"]');
  await p.click('.fl-hijo[data-city="Montevideo"]');
  eq("ciudades: Montevideo, solo el Cierre que la nombra", await hasta(p, () => {
    const v = [...document.querySelectorAll(".fl-stat b")].map(x => x.textContent.trim());
    return (document.querySelector(".ficha-lugar h1") || {}).textContent === "Montevideo" && v[2] === "1 de 2";
  }), true);
  // Los proyectos y sus hitos en «Lo que pasó» (pedido del usuario,
  // 6/10/2026): rombos con su estado, un filtro por proyecto que atenúa al
  // resto (eligió «atenuado», no ocultar) y la tarjeta del costado.
  eq("hitos: los hitos de los proyectos entran en la línea, cada uno con su estado",
    await p.$$eval(".fl-it.t-hito", es => es.map(e => [e.dataset.proyecto, e.querySelector(".tt").textContent.trim(), e.querySelector(".fl-hito-estado").textContent.trim()])),
    [["p_proy2", "Instalar las cámaras", "Pendiente"], ["p_viaje", "Mandar el presupuesto", "Vencido"], ["p_viaje", "Pedir la autorización", "✓ Cumplido"]]);
  eq("hitos: con la clase de cada estado (vencido en rojo, hecho relleno)", await p.$$eval(".fl-it.t-hito", es => es.map(e => e.className.replace("fl-it t-hito ", ""))), ["pendiente", "vencido", "hecho"]);
  eq("hitos: cada hito dice de qué proyecto es y quién lo tiene a cargo", await p.$eval('.fl-it.t-hito[data-proyecto="p_proy2"] .mt', e => e.textContent.replace(/\s+/g, " ").trim()), "◆ Hito · de Plan de cámaras de Montevideo · Benny");
  eq("hitos: el posteo del proyecto dice cuántos hitos lleva", await p.$eval('.fl-it[data-post-id="p_viaje"] .mt', e => /📋 Proyecto · 1\/2 hitos/.test(e.textContent)), true);
  eq("hitos: la lectura rápida los cuenta", await p.$eval(".fl-lectura", e => /2 proyectos abiertos con 2 hitos pendientes, 1 de ellos vencido \(Mandar el presupuesto\)\./.test(e.textContent.replace(/\s+/g, " "))), true);
  eq("hitos: la fila de proyectos: «Todos los hitos», uno por proyecto y «Sin hitos»",
    await p.$$eval(".fl-proy .fl-chip", es => es.map(e => [e.dataset.id, e.textContent.trim(), e.classList.contains("on")])),
    [["", "📋 Todos los hitos · 3", true], ["p_proy2", "Plan de cámaras de Montevideo · 0/1", false], ["p_viaje", "Montevideo y Buenos Aires · 1/2", false], ["ninguno", "Sin hitos", false]]);
  eq("hitos: al costado, cada proyecto con su avance, sus vencidos y el próximo hito",
    await p.$$eval(".fl-pj-item", es => es.map(e => [e.dataset.id, e.querySelector(".fl-pj-bar i").style.width, e.querySelector("small").textContent.replace(/\s+/g, " ").trim()])).then(v => [v[0][0], v[0][1], /^0\/1 hitos · próximo: Instalar las cámaras, \d{1,2} \S+$/.test(v[0][2]), v[1]]),
    ["p_proy2", "0%", true, ["p_viaje", "50%", "1/2 hitos · 1 vencido"]]);
  eq("hitos: la tarjeta dice cuántos siguen abiertos", await p.$eval(".fl-pj", e => { const h = e.closest(".fl-card").querySelector("h3"); return [h.firstChild.textContent.trim(), h.querySelector(".fl-h3-nota").textContent.trim()]; }), ["Proyectos en Montevideo", "2 abiertos"]);
  await p.click('.fl-proy .fl-chip[data-id="p_viaje"]');
  eq("hitos: elegir un proyecto deja sus hitos y atenúa a los demás proyectos y sus hitos", await hasta(p, () =>
    document.querySelector('.fl-it.t-hito[data-proyecto="p_proy2"]').classList.contains("apagado")
    && document.querySelector('.fl-it[data-post-id="p_proy2"]').classList.contains("apagado")
    && !document.querySelector('.fl-it.t-hito[data-proyecto="p_viaje"]').classList.contains("apagado")
    && !document.querySelector('.fl-it[data-post-id="p_viaje"]').classList.contains("apagado")
    && document.querySelector('.fl-pj-item[data-id="p_viaje"]').classList.contains("on")), true);
  eq("hitos: con la nota de qué se está mostrando", await p.$eval(".fl-nota", e => e.textContent.replace(/\s+/g, " ").trim()), "Mostrando solo los hitos de Montevideo y Buenos Aires; los demás proyectos quedan atenuados. Ver todos");
  await p.click('.fl-nota [data-action="ficha-proyecto"]');
  eq("hitos: «Ver todos» vuelve a todos", await hasta(p, () => !document.querySelector(".fl-it.apagado") && !document.querySelector(".fl-nota")), true);
  await p.click('.fl-pj-item[data-id="p_proy2"]');
  eq("hitos: desde la tarjeta del costado se elige igual", await hasta(p, () =>
    document.querySelector('.fl-pj-item[data-id="p_proy2"]').classList.contains("on") && document.querySelector('.fl-it[data-post-id="p_viaje"]').classList.contains("apagado")), true);
  await p.click('.fl-pj-item[data-id="p_proy2"]');
  eq("hitos: tocar el mismo otra vez vuelve a todos", await hasta(p, () => !document.querySelector(".fl-it.apagado")), true);
  await p.click('.fl-proy .fl-chip[data-id="ninguno"]');
  eq("hitos: «Sin hitos» los saca de la línea", await hasta(p, () => !document.querySelector(".fl-it.t-hito") && document.querySelectorAll(".fl-it").length === 2), true);
  await p.click('.fl-proy .fl-chip[data-id=""]');
  await hasta(p, () => document.querySelectorAll(".fl-it.t-hito").length === 3);
  await p.click('.fl-it.t-hito[data-proyecto="p_viaje"]');
  eq("hitos: tocar un hito abre la ventana del proyecto con sus hitos a la vista", await hasta(p, () =>
    !document.getElementById("fichaPostOverlay").hidden && !!document.querySelector('#fichaPostBody [data-action="project-manage"]')
    && /Mandar el presupuesto/.test(document.getElementById("fichaPostBody").textContent)), true);
  // La cabecera de la ventana queda pegada al borde al scrollear (captura
  // del usuario, 6/10/2026: quedaba 24px abajo y por la franja asomaba lo
  // que ya había pasado).
  await p.setViewportSize({ width: 1280, height: 420 });
  eq("ventana: al scrollear, la cabecera queda pegada al borde de arriba", await p.evaluate(() => {
    const o = document.getElementById("fichaPostOverlay"); o.scrollTop = 150;
    const c = o.querySelector(".fp-cabeza");
    return o.scrollTop > 0 && Math.round(c.getBoundingClientRect().top) === Math.round(o.getBoundingClientRect().top); }), true);
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.keyboard.press("Escape");
  // Excluir (pedido del usuario): lo regional no entra si no se pide, y
  // un tipo se oculta con un toque.
  eq("excluir: por defecto, solo lo de acá", await p.$eval('.fl-seg [aria-checked="true"]', e => e.dataset.nivel), "0");
  await p.click('.fl-seg [data-nivel="3"]');
  eq("excluir: «+ Toda LatAm» suma lo de todo el equipo", await hasta(p, () => document.querySelectorAll(".fl-it").length > 1 && !!document.querySelector(".fl-it.amplio")), true);
  eq("excluir: lo de todo el equipo se ve atenuado y con su etiqueta", await p.$eval('.fl-it[data-post-id="p_latam"] .fl-amplio', e => e.textContent.trim()), "Toda LatAm");
  await p.click('.fl-chip[data-tipo="visita"]');
  eq("excluir: ocultar Visitas las saca de la línea de tiempo", await hasta(p, () =>
    !document.querySelector('.fl-it.t-visita') && document.querySelector('.fl-chip[data-tipo="visita"]').classList.contains("fuera")), true);
  await p.click('.fl-chip-todo');
  await p.click('.fl-seg [data-nivel="0"]');
  await p.click('[data-action="ficha-cargar"]');
  eq("ficha: «Cargar algo acá» abre el formulario con el lugar ya puesto", await hasta(p, () =>
    !!document.getElementById("postForm") && /Montevideo/.test(document.getElementById("postForm").textContent)), true);
  await p.keyboard.press("Escape");
  // La ficha de una zona (segunda parte, 6/10/2026): desde las migas de
  // un país, o desde la fila de zonas de la lista.
  await p.click('.fl-migas [data-action="drill-zone"]');
  eq("zona: desde las migas del país se llega a la ficha de la región", await hasta(p, () =>
    (document.querySelector(".ficha-lugar h1") || {}).textContent === "Región Sur"), true);
  // En esta sesión hay dos visitas con Cierre: la de dos países (1/2 en
  // Montevideo + 1/1 en Buenos Aires) y la de Punta del Este (1/1).
  eq("zona: junta los Cierres de todos sus países", await stats().then(v => [v[2], v[3]]), ["3 de 4", "6"]);
  eq("zona: al costado, sus países, cada uno con su ficha", await p.$$eval('.fl-hijo[data-action="drill-country"]', es => es.map(e => e.dataset.country).sort()), ["Argentina", "Uruguay"]);
  await p.click('.fl-main [data-action="ficha-desplegar"][data-que="pasos"]');
  // El Cierre de Buenos Aires no nombra ninguna ciudad conocida: la ciudad
  // sale del lugar de la visita.
  eq("zona: los pendientes dicen de qué país y ciudad son",
    await p.$$eval(".fl-main .rs-pasos li small", ss => ss.some(x => /^Uruguay · Montevideo/.test(x.textContent.trim())) && ss.some(x => /^Argentina · Buenos Aires/.test(x.textContent.trim()))), true);
  await p.click('.fl-main [data-action="ficha-desplegar"][data-que="pasos"]');
  eq("zona: «Mostrar menos» vuelve a los cuatro primeros", await p.$$eval(".fl-main .rs-pasos li", ls => ls.length), 4);
  eq("zona: qué incluir es solo la región o también toda LatAm", await p.$$eval(".fl-seg .place-seg-btn span", ss => ss.map(x => x.textContent.trim())), ["Solo Región Sur", "+ Toda LatAm"]);
  await p.click('.fl-hijo[data-country="Argentina"]');
  eq("zona: tocar un país abre su ficha, con la región en las migas", await hasta(p, () =>
    (document.querySelector(".ficha-lugar h1") || {}).textContent === "Argentina" && !!document.querySelector('.fl-migas [data-action="drill-zone"][data-zona="sur"]')), true);
  await p.click('.fl-migas [data-action="drill-clear"]');
  eq("zona: la lista de Países arranca con las tres zonas", await p.$$eval(".paises-zona", es => es.map(e => e.dataset.zona)), ["sur", "central", "norte"]);
  eq("zona: con cuántos registros tiene cada una", await p.$eval('.paises-zona[data-zona="sur"] small', e => /^\d+ registros$/.test(e.textContent.trim())), true);
  await p.click('.paises-zona[data-zona="sur"]');
  eq("zona: y cada una lleva a su ficha", await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Región Sur"), true);
  // «Reporte del lugar»: se imprime con todo desplegado y sin botones.
  await p.evaluate(() => { window.print = () => { window.__impreso = { pasos: document.querySelectorAll(".fl-main .rs-pasos li").length, botones: !!document.querySelector(".fl-mas") }; }; });
  const antesDeImprimir = await p.$$eval(".fl-main .rs-pasos li", ls => ls.length);
  await p.click('[data-action="ficha-imprimir"]');
  eq("reporte: al imprimir se despliegan todos los pendientes y hechos", await hasta(p, n => window.__impreso && window.__impreso.pasos > n, antesDeImprimir), true);
  eq("reporte: y después vuelve a lo de antes", await hasta(p, n => document.querySelectorAll(".fl-main .rs-pasos li").length === n && !!document.querySelector(".fl-mas"), antesDeImprimir), true);
  await p.emulateMedia({ media: "print" });
  eq("reporte: en papel, sin botones ni selectores, a una columna y con el encabezado", await p.evaluate(() => {
    const oculto = s => [...document.querySelectorAll(s)].every(e => getComputedStyle(e).display === "none");
    return { sinBotones: oculto(".fl-acciones, .fl-seg, .fl-chips, .fl-mas, .fl-migas, .topbar, .bottom-nav"),
      unaColumna: getComputedStyle(document.querySelector(".fl-grid")).display === "block",
      incluye: getComputedStyle(document.querySelector(".fl-incluye-print")).display === "block" && /^Incluye: Solo Región Sur/.test(document.querySelector(".fl-incluye-print").textContent),
      cabecera: getComputedStyle(document.querySelector(".rep-print-title")).display === "flex" && /Ficha de Región Sur/.test(document.querySelector(".rep-print-title").textContent) };
  }), { sinBotones: true, unaColumna: true, incluye: true, cabecera: true });
  await p.emulateMedia({ media: "screen" });
  await p.click('nav.tabs button[data-view="feed"]');
  // Ya quedó abierto al leerlo (como cuando se lee desde la tarjeta).
  if(await p.$eval('.post[data-post-id="p_viaje"] .rs-pill', e => e.getAttribute("aria-expanded")) !== "true") await p.click('.post[data-post-id="p_viaje"] .rs-pill');
  eq("viaje: en la tarjeta, cada Cierre con su lugar", await p.$$eval('.post[data-post-id="p_viaje"] .rs-lugar', ls => ls.map(l => l.textContent.trim())),
    ["📍 Montevideo, Uruguay", "📍 Buenos Aires, Argentina"]);
  eq("viaje: y la cuenta de la tarjeta suma los dos", await p.$eval('.post[data-post-id="p_viaje"] .rs-pill', e => e.textContent.trim()), "📋 Resumen · 2/3");
  // «Convertir en proyecto» desde la ventana (el usuario, 6/10/2026): se
  // guarda, la ventana se cierra sola y se llega al proyecto, con el
  // camino de vuelta a la ficha.
  await p.click('nav.tabs button[data-view="paises"]');
  await p.click('[data-action="drill-country"][data-country="Uruguay"]');
  await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Uruguay");
  await p.click('.fl-it[data-post-id="p_pde"]');
  await p.click('#fichaPostBody [data-action="toggle-post-menu"]');
  await p.click('#fichaPostBody [data-action="project-create"]');
  eq("ventana: «Convertir en proyecto» cierra la ventana y lleva al proyecto", await hasta(p, () =>
    document.getElementById("fichaPostOverlay").hidden && !!document.querySelector('nav.tabs button[data-view="proyectos"].active')
    && /Punta del Este/.test((document.querySelector(".project-detail") || {}).textContent || "")), true);
  eq("ventana: y deja el camino de vuelta", await p.$eval(".volver-ficha", e => e.textContent.trim()), "← Volver a la ficha de Uruguay");
  await p.click(".volver-ficha");
  eq("ventana: «Volver» abre de nuevo la ficha de Uruguay, y el camino se va", await hasta(p, () =>
    (document.querySelector(".ficha-lugar h1") || {}).textContent === "Uruguay" && !document.querySelector(".volver-ficha")), true);
  // «Gestionar proyecto» desde la ventana: lo mismo, aunque Proyectos ya
  // fuera la sección de abajo.
  await p.click('nav.tabs button[data-view="paises"]');
  await p.click('[data-action="drill-country"][data-country="Uruguay"]');
  await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Uruguay");
  await p.click('.fl-it[data-post-id="p_viaje"]');
  if(!(await p.$('#fichaPostBody [data-action="project-manage"]'))) await p.click('#fichaPostBody [data-action="toggle-project"]');
  await p.click('#fichaPostBody [data-action="project-manage"]');
  eq("ventana: «Gestionar proyecto» cierra la ventana y abre Proyectos", await hasta(p, () =>
    document.getElementById("fichaPostOverlay").hidden && !!document.querySelector('nav.tabs button[data-view="proyectos"].active')), true);
  eq("viaje: sin un solo error", errores, []);
  await p.close();
}

/* ---------- La ficha, de a tandas; el costado que acompaña; quiénes; el mapa ---------- */
// Pedidos del usuario (6/10/2026): «Lo que pasó» se carga como el Inicio,
// la columna de la derecha acompaña el scroll, «Google Calendar» no es
// una persona en «Quiénes trabajaron acá», y el mapa llega hasta abajo.
{
  const MVD = [{ type: "ciudad", country: "Uruguay", city: "Montevideo" }];
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    for(let i = 0; i < 35; i++) base.posts.push({ id: "p_r" + i, title: "", content: "Rutina vieja " + i,
      date: dia(400 + i), start_date: dia(400 + i), end_date: dia(400 + i), activity_type: "rutina", author_name: "Ana Pérez", author_email: "ana@x.com",
      scopes: MVD, images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(400 + i) });
    // Dos eventos traídos de Google Calendar: el organizador de uno es
    // alguien del equipo; el del otro es el calendario mismo.
    base.posts.push({ id: "p_gcal", title: "Reunión traída del calendario", content: "", date: dia(3), start_date: dia(3), end_date: dia(3), activity_type: "otro",
      author_name: "Google Calendar", author_email: "", organizer: "Ana Pérez", calendar_event_id: "ev1", scopes: MVD,
      participants: [{ email: ADMIN, name: "Benny" }, { email: "", name: "Invitado de afuera" }],
      images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(3) });
    base.posts.push({ id: "p_gcal2", title: "Otra traída del calendario", content: "", date: dia(4), start_date: dia(4), end_date: dia(4), activity_type: "otro",
      author_name: "Google Calendar", author_email: "", organizer: "LatAm", calendar_event_id: "ev2", scopes: MVD,
      participants: [], images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(4) });
  });
  await esperarTexto(p, "Reunión traída del calendario");
  await p.click('nav.tabs button[data-view="paises"]');
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "drill-city"; x.dataset.country = "Uruguay"; x.dataset.city = "Montevideo"; document.body.appendChild(x); x.click(); x.remove(); });
  await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Montevideo");
  eq("tandas: arranca con 30 filas y el botón «Ver más»", await p.evaluate(() => [document.querySelectorAll(".fl-it").length, !!document.querySelector('.fl-main [data-action="ficha-ver-mas"]')]), [30, true]);
  await p.evaluate(() => document.querySelector('[data-action="ficha-ver-mas"]').scrollIntoView());
  eq("tandas: al bajar hasta el botón se liberan solas las que faltan", await hasta(p, () => document.querySelectorAll(".fl-it").length === 37 && !document.querySelector('[data-action="ficha-ver-mas"]')), true);
  eq("quiénes: Google Calendar no es una persona; cuenta el organizador si es del equipo, y los participantes con cuenta",
    await p.$$eval(".fl-gente > div", es => es.map(e => [e.querySelector(".nm").textContent.trim(), e.querySelector(".cn").textContent.trim()])), [["Ana Pérez", "36"], ["Benny", "1"]]);
  eq("quiénes: en la línea, lo del calendario dice quién lo organizó solo si es del equipo", await p.evaluate(() => [
    document.querySelector('.fl-it[data-post-id="p_gcal"] .mt').textContent.replace(/\s+/g, " ").trim(), document.querySelector('.fl-it[data-post-id="p_gcal2"] .mt').textContent.replace(/\s+/g, " ").trim()]),
    ["✨ Otro · Ana Pérez", "✨ Otro"]);
  eq("costado: la columna de la derecha acompaña el scroll", await p.$eval(".fl-lado", e => getComputedStyle(e).position), "sticky");
  await p.emulateMedia({ media: "print" });
  eq("costado: en papel, no", await p.$eval(".fl-lado", e => getComputedStyle(e).position), "static");
  await p.emulateMedia({ media: "screen" });
  // Países › Mapa llega hasta el borde de abajo. Leaflet no llega al
  // sandbox: uno de mentira, con lo justo para que el mapa se dibuje.
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.evaluate(() => {
    const mapa = { llamadas: [], setView(){ return this; }, addLayer(){ return this; }, invalidateSize(){ this.llamadas.push("invalidateSize"); return this; }, fitBounds(){ return this; }, on(){ return this; } };
    window.__mapa = mapa;
    window.L = { map: () => mapa, tileLayer: () => ({ addTo(){ return this; } }), divIcon: o => o, marker: () => ({ bindPopup(){ return this; } }),
      markerClusterGroup: () => ({ clearLayers(){}, addLayer(){} }) };
  });
  await p.click('.fl-migas [data-action="drill-clear"]');
  await p.click('[data-action="paises-subview"][data-key="mapa"]');
  eq("mapa: ocupa hasta el borde de abajo de la pantalla, y se le avisa a Leaflet", await hasta(p, () => {
    const el = document.getElementById("map"); if(!el) return false;
    const r = el.getBoundingClientRect();
    const abajo = parseFloat(getComputedStyle(document.querySelector("main")).paddingBottom);
    return window.scrollY === 0 && Math.abs(r.bottom + abajo - window.innerHeight) <= 1 && window.__mapa.llamadas.includes("invalidateSize");
  }), true);
  await p.setViewportSize({ width: 1280, height: 760 });
  eq("mapa: y se acomoda si cambia el tamaño de la ventana", await hasta(p, () => {
    const r = document.getElementById("map").getBoundingClientRect();
    return Math.abs(r.bottom + parseFloat(getComputedStyle(document.querySelector("main")).paddingBottom) - window.innerHeight) <= 1;
  }), true);
  eq("tandas: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Documentos opcionales (6/10/2026) ---------- */
// «Otro» estaba en casi todos los tipos "por si alguien quiere subir algo
// más" y contaba como faltante. Ahora un documento puede ser opcional:
// queda en la lista, pero no cuenta ni falta.
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.app_config.push({ key: "preferences", value: { activityTypes: [
      { key: "visita", label: "Visita", icon: "🧳", docs: [{ id: "plan", label: "Plan de viaje" }, { id: "reporte", label: "Reporte" }, { id: "otro", label: "Otro" }] },
      { key: "otro", label: "Otro", icon: "✨", docs: [{ id: "otro", label: "Otro" }] } ] } });
    base.posts.push({ id: "p_otro", title: "Charla informal", content: "x", date: dia(3), start_date: dia(3), end_date: dia(3), activity_type: "otro",
      author_name: "Benny", author_email: ADMIN, scopes: [], images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(3) });
  });
  await esperarTexto(p, "Reunión con la comunidad");
  const pill = sel => p.$eval(sel + " .doc-linea", e => ({ txt: e.textContent.replace(/\s+/g, " ").trim(), tarde: e.classList.contains("tarde"), title: e.title }));
  eq("opcional: «Otro» no cuenta para la cuenta ni como faltante", await pill('.post[data-post-id="p_reunion"]'),
    { txt: "📄 0/2 documentos · faltan", tarde: true, title: "Documentación: ○ Plan de viaje · ○ Reporte · ○ Otro (opcional)" });
  await p.click('.post[data-post-id="p_reunion"] .doc-linea');
  eq("opcional: en la lista está igual, marcado y con su «Adjuntar»", await hasta(p, () => {
    const d = document.querySelector('.post[data-post-id="p_reunion"] .doc-abierto'); if(!d) return false;
    const filas = [...d.querySelectorAll(".doc-fila")];
    return filas.length === 3 && d.querySelector(".doc-panel-tit").textContent.trim() === "📄 Documentación · 0/2"
      && (filas[2].querySelector(".doc-tag") || {}).textContent === "opcional" && !!filas[2].querySelector(".doc-adjuntar") && !filas[0].querySelector(".doc-tag"); }), true);
  eq("opcional: un tipo con solo documentos opcionales no muestra fracción ni le falta nada", await pill('.post[data-post-id="p_otro"]'),
    { txt: "📄 documentos", tarde: false, title: "Documentación: ○ Otro (opcional)" });
  // Administración › Tipos de actividad: la casilla.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu button:has-text("Tipos")');
  eq("opcional: la lista de tipos lo dice", await p.$eval('.lp-row[data-key="visita"] .lp-who span', e => e.textContent.trim()), "Plan de viaje · Reporte · Otro (opcional)");
  await p.click('.lp-row[data-key="visita"]');
  eq("opcional: en la ficha del tipo, una casilla por documento, con «Otro» ya marcado", await p.$$eval('.lp-panel [data-action="tipo-doc-opcional"]', es => es.map(e => e.checked)), [false, false, true]);
  await p.uncheck('.lp-panel [data-action="tipo-doc-opcional"][data-idx="2"]');
  eq("opcional: destildarla queda como cambio sin guardar", await hasta(p, () => !!document.querySelector(".zonas-cambios")), true);
  await p.fill('.lp-panel .doc-nuevo-input', "Otros");
  await p.click('.lp-panel [data-action="tipo-doc-add"]');
  eq("opcional: un documento nuevo llamado «Otros» arranca opcional", await hasta(p, () => {
    const cs = [...document.querySelectorAll('.lp-panel [data-action="tipo-doc-opcional"]')]; return cs.length === 4 && cs[3].checked && !cs[2].checked; }), true);
  await p.click('[data-action="tipos-save"]');
  eq("opcional: se guarda tal cual en la configuración", await hasta(p, () => {
    const c = (window.__sb.tablas.app_config || []).find(x => x.key === "preferences"); const d = c && c.value.activityTypes[0].docs;
    return !!d && d.length === 4 && d[0].opcional === false && d[2].opcional === false && d[3].opcional === true; }), true);
  await p.click('nav.tabs button[data-view="feed"]');
  eq("opcional: y la tarjeta cuenta como se dejó", await hasta(p, () => {
    const e = document.querySelector('.post[data-post-id="p_reunion"] .doc-linea'); return !!e && e.textContent.replace(/\s+/g, " ").trim() === "📄 0/3 documentos · faltan"; }), true);
  eq("opcional: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Ciudades al costado: hasta cinco y «Ver más» (6/10/2026) ---------- */
{
  const CIUDADES = ["Avellaneda", "Bahia Blanca", "Bariloche", "Basavilbaso", "Catamarca", "Cipolletti", "Concepción del Uruguay", "Concordia", "Cordoba"];
  const { p, errores } = await entrar(ADMIN, "Benny", base => CIUDADES.forEach((c, i) => base.posts.push({ id: "p_c" + i, title: "", content: "Rutina en " + c,
    date: dia(5 + i), start_date: dia(5 + i), end_date: dia(5 + i), activity_type: "rutina", author_name: "Benny", author_email: ADMIN,
    scopes: [{ type: "ciudad", country: "Argentina", city: c }], images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {}, created_at: hace(5 + i) })));
  await esperarTexto(p, "Rutina en Avellaneda");
  await p.click('nav.tabs button[data-view="paises"]');
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "drill-country"; x.dataset.country = "Argentina"; document.body.appendChild(x); x.click(); x.remove(); });
  await hasta(p, () => (document.querySelector(".ficha-lugar h1") || {}).textContent === "Argentina");
  eq("ciudades: hasta cinco a la vista, y «Ver más»", [await p.$$eval(".fl-hijos .fl-hijo", es => es.map(e => e.dataset.city)), await p.$eval('.fl-mas[data-que="hijos"]', e => e.textContent.trim())], [CIUDADES.slice(0, 5), "Ver más"]);
  await p.click('.fl-mas[data-que="hijos"]');
  eq("ciudades: «Ver más» muestra todas, y ofrece «Ver menos»", await hasta(p, () => document.querySelectorAll(".fl-hijos .fl-hijo").length === 9 && document.querySelector('.fl-mas[data-que="hijos"]').textContent.trim() === "Ver menos"), true);
  // Desplegada, la lista se desplaza adentro de la tarjeta, no la columna.
  eq("ciudades: desplegada, se desplaza adentro de la tarjeta con su propia barra", await p.$eval(".fl-hijos", e => ({ scroll: getComputedStyle(e).overflowY, hayMas: e.scrollHeight > e.clientHeight, alto: e.clientHeight < 400 })), { scroll: "auto", hayMas: true, alto: true });
  await p.evaluate(() => { document.querySelector(".fl-hijos").scrollTop = 500; });
  eq("ciudades: y al final de la lista se llega a la última", await hasta(p, () => { const e = document.querySelector(".fl-hijos"); const u = e.lastElementChild.getBoundingClientRect(); const r = e.getBoundingClientRect(); return u.bottom <= r.bottom + 1 && u.top >= r.top; }), true);
  await p.click('.fl-mas[data-que="hijos"]');
  eq("ciudades: «Ver menos» vuelve a cinco, sin barra", await hasta(p, () => document.querySelectorAll(".fl-hijos .fl-hijo").length === 5 && getComputedStyle(document.querySelector(".fl-hijos")).overflowY === "visible"), true);
  eq("ciudades: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Correos que ya no están en el equipo (6/10/2026) ---------- */
// Una cuenta borrada a mano dejó una rutina que nadie podía editar: no
// estaba en Personas ni entre los ex integrantes, así que no había desde
// dónde pasar lo suyo a otra cuenta.
{
  const { p, errores, rpc } = await entrar(ADMIN, "Benny", base => {
    base.posts.push({ id: "p_borrado", title: "", content: "Rutina de una cuenta borrada",
      date: dia(3), start_date: dia(3), end_date: dia(3), activity_type: "rutina",
      author_name: "Borrado", author_email: "borrado@x.com", scopes: [], images: [], files: [], links: [], mentions: [],
      liked_by: ["borrado@x.com"], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {},
      created_at: hace(3) });
  });
  await esperarTexto(p, "Rutina de una cuenta borrada");
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="solicitudes"][data-key="usuarios"]');
  eq("sin cuenta: Personas muestra el correo que no es de nadie", await esperarTexto(p, "Correos que ya no están en el equipo", 3000), true);
  eq("sin cuenta: con cuántas veces aparece (su rutina y su me gusta)",
    await p.$$eval(".sin-cuenta-fila .lp-who", es => es.map(e => e.innerText.replace(/\s+/g, " ").trim())), ["borrado@x.com aparece 2 veces"]);
  eq("sin cuenta: los del equipo no aparecen ahí", await p.$$eval(".sin-cuenta-fila", es => es.some(e => /ana@x\.com|benny@/.test(e.textContent.split("Pasar")[0]))), false);
  await p.selectOption('.sin-cuenta .unificar-destino[data-email="borrado@x.com"]', ADMIN);
  await p.click('.sin-cuenta [data-action="unificar-cuentas"][data-email="borrado@x.com"]');
  await p.waitForSelector("#confirmOk", { state: "visible" });
  await p.click("#confirmOk");
  eq("sin cuenta: su rutina pasa a la cuenta elegida", await hasta(p, () =>
    (window.__sb.tablas.posts || []).find(x => x.id === "p_borrado").author_email === "benny@team-latam.com"), true);
  eq("sin cuenta: se llama a la base con ese correo", (await rpc()).some(([n, a]) => n === "unificar_cuentas" && a.p_viejo === "borrado@x.com" && a.p_nuevo === ADMIN), true);
  eq("sin cuenta: sin un solo error", errores, []);
  await p.close();
}

/* ---------- El Inicio en escritorio: columna lateral y buscador ---------- */
{
  // Un evento de Ana pasado mañana (lo de la base es de hace dos días) y
  // el hito del proyecto con su etiqueta como la guarda la app (label).
  const { p, errores, base } = await entrar(ADMIN, "Benny", base => {
    base.posts.push({ ...base.posts[0], id: "p_taller", title: "Taller de pasado mañana", images: [],
      date: dia(-2), start_date: dia(-2), end_date: dia(-2), created_at: hace(0.5) });
    base.posts[1].milestones = [{ id: "h1", label: "Primera entrega", date: dia(-5), done: false }];
  });
  await esperarTexto(p, "Reunión con la comunidad");
  const cuantas = () => p.$$eval("#viewRoot article.post", es => es.length);
  eq("escritorio: la columna lateral está a la vista, con sus tres cajas",
    await p.$$eval(".feed-side .fs-box h4:not(.fs-sub)", es => es.map(e => e.textContent.replace(/^\S+\s/, ""))),
    ["Próximos eventos", "Hitos por vencer", "Accesos directos"]);
  eq("escritorio: lo que se viene lista el taller de pasado mañana y el hito por vencer", await p.$$eval(".feed-side .fs-item .fs-what", es => es.map(e => e.textContent.trim())),
    ["🧳 Taller de pasado mañana", "Primera entrega"]);
  // Acceso directo "Mis posteos": del admin es solo el proyecto.
  await p.click('.feed-side [data-action="feed-quick"][data-key="mine"]');
  eq("escritorio: 'Mis posteos' deja solo lo del admin, con su chip en la barra de filtros",
    [await cuantas(), await p.$eval('[data-action="clear-quick"]', e => e.textContent.trim())], [1, "⚡ Mis posteos ✕"]);
  // Guardar ese filtro con nombre: queda en la columna y en las preferencias.
  await p.click('[data-action="feed-saved-start"]');
  await p.type("#savedFilterName", "Lo mío");
  await p.keyboard.press("Enter");
  eq("escritorio: el filtro guardado aparece en la columna", await hasta(p, () => [...document.querySelectorAll(".fs-saved .fs-link")].some(e => e.textContent.trim() === "Lo mío")), true);
  // La escritura a la base es asincrónica: se espera a que llegue, no se
  // mira la foto de inmediato (con la máquina cargada llegaba después).
  await hasta(p, email => (window.__sb.tablas.user_prefs || []).some(u => u.email === email && u.prefs && Array.isArray(u.prefs.savedFilters) && u.prefs.savedFilters.length), ADMIN);
  const guardado = ((await base()).user_prefs.find(u => u.email === ADMIN) || { prefs: {} }).prefs.savedFilters;
  eq("escritorio: y en las preferencias de la persona, con el acceso directo adentro", guardado && guardado.map(g => [g.name, g.quick]), [["Lo mío", "mine"]]);
  await p.click('[data-action="clear-filters"]');
  eq("escritorio: limpiar filtros apaga también el acceso directo", await cuantas(), 3);
  await p.click('.fs-saved [data-action="feed-saved-apply"]');
  eq("escritorio: aplicar el guardado vuelve a dejar una tarjeta", await cuantas(), 1);
  await p.click('[data-action="clear-filters"]');
  // El buscador general: proyectos y países desde la barra de arriba.
  await p.click("#globalSearchInput");
  await p.type("#globalSearchInput", "becas");
  eq("buscador: con 'becas' ofrece el proyecto", await hasta(p, () => [...document.querySelectorAll("#globalResults .gs-item b")].some(b => b.textContent === "Programa de becas")), true);
  eq("buscador: agrupado como Proyectos", await p.$$eval("#globalResults .gs-group", es => es.map(e => e.textContent)), ["Proyectos"]);
  await p.click('#globalResults [data-action="gs-project"]');
  eq("buscador: elegirlo abre el proyecto y cierra el panel",
    [await p.$eval("nav.tabs button.active", e => e.dataset.view), await p.$eval("#globalResults", e => e.hidden), await p.$eval("#globalSearchInput", e => e.value)],
    ["proyectos", true, ""]);
  await p.click("#globalSearchInput");
  await p.type("#globalSearchInput", "argent");
  eq("buscador: con 'argent' ofrece el país", await hasta(p, () => !!document.querySelector('#globalResults [data-action="gs-country"][data-country="Argentina"]')), true);
  await p.click('#globalResults [data-action="gs-country"]');
  eq("buscador: elegir el país abre el Feed filtrado por Argentina",
    [await p.$eval("nav.tabs button.active", e => e.dataset.view), await p.$eval('[data-action="clear-place"]', e => e.textContent.trim())], ["feed", "📍 Argentina ✕"]);
  eq("escritorio: sin un solo error", errores, []);
  await p.close();
}

/* ---------- La documentación en la tarjeta (6/10/2026) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => base.app_config.push({ key: "preferences", value: { activityTypes: [
    { key: "visita", label: "Visita", icon: "🧳", docs: [{ id: "plan", label: "Plan de viaje" }, { id: "reporte", label: "Reporte" }] }] } }));
  await esperarTexto(p, "Reunión con la comunidad");
  const acc = await p.$$eval('.post[data-post-id="p_reunion"] .post-actions > *', l => l.map(e => e.dataset.action || e.className.split(" ")[0]));
  eq("documentación: una pastilla en las acciones, después de los comentarios", acc.indexOf("toggle-docs") > acc.indexOf("toggle-thread") && acc.indexOf("toggle-thread") >= 0, true);
  eq("documentación: el evento ya pasó y falta todo, así que va en amarillo y dice que faltan",
    await p.$eval('.post[data-post-id="p_reunion"] .doc-linea', e => [e.classList.contains("tarde"), e.textContent.replace(/\s+/g, " ").trim()]), [true, "📄 0/2 documentos · faltan"]);
  eq("documentación: cerrada, no ocupa la tarjeta", await p.$('.post[data-post-id="p_reunion"] .doc-abierto'), null);
  await p.click('.post[data-post-id="p_reunion"] .doc-linea');
  eq("documentación: al tocarla, la lista se abre debajo de las acciones",
    await hasta(p, () => { const c = document.querySelector('.post[data-post-id="p_reunion"]'); const d = c.querySelector(".doc-abierto"); return !!d && d.previousElementSibling.classList.contains("post-actions") && d.querySelectorAll(".doc-fila").length === 2; }), true);
  // Varios archivos por documento y el visor (6/10/2026).
  await p.close();
  {
    const { p: q, errores: err2 } = await entrar(ADMIN, "Benny", base => { base.app_config.push({ key: "preferences", value: { activityTypes: [
      { key: "visita", label: "Visita", icon: "🧳", docs: [{ id: "plan", label: "Plan de viaje" }, { id: "reporte", label: "Reporte" }] }] } });
      base.posts.find(x => x.id === "p_reunion").files = [
        { name: "Plan viejo.pdf", kind: "pdf", doc: "plan", path: "posts/p_reunion/plan1.pdf" },
        { name: "Plan de viaje definitivo con un nombre muy largo.docx", kind: "doc", doc: "plan", path: "posts/p_reunion/plan2.docx" },
        { name: "Reporte.pdf", kind: "pdf", doc: "reporte", path: "posts/p_reunion/rep.pdf" },
        { name: "Planilla de gastos de octubre.xlsx", kind: "planilla", path: "posts/p_reunion/x7f3a9.xlsx" },
        { name: "Presentación del curso.pptx", kind: "presentacion", path: "posts/p_reunion/pres.pptx" } ]; });
    await esperarTexto(q, "Reunión con la comunidad");
    // Lo que se baja conserva el nombre con que se cargó, no el del bucket.
    // Y todo archivo abre el visor (6/10/2026): una planilla se ve como tabla.
    await q.click(`.post[data-post-id="p_reunion"] .post-file-link`);
    eq("una planilla adjunta abre el visor y se ve como tabla",
      await hasta(q, () => !document.getElementById("filePreviewOverlay").hidden && /Planilla de mentira/.test(document.getElementById("filePreviewWord").textContent)), true);
    await q.waitForTimeout(150);
    eq("planilla armada: el enlace javascript: pierde su destino, el de verdad queda y abre aparte, y la imagen no ejecuta nada",
      await q.evaluate(() => [document.getElementById("enlaceMalo")?.hasAttribute("href"), document.getElementById("enlaceBueno")?.getAttribute("href"),
        document.getElementById("enlaceBueno")?.getAttribute("target"), window.__xss === undefined, !!document.querySelector("#filePreviewWord img[onerror]")]),
      [false, "https://ejemplo.org/a", "_blank", true, false]);
    const [bajada] = await Promise.all([q.waitForEvent("download"), q.click("#filePreviewDownload")]);
    eq("bajar un archivo conserva el nombre con que se cargó", bajada.suggestedFilename(), "Planilla de gastos de octubre.xlsx");
    // Deslizar con el dedo pasa al siguiente: de la planilla al PowerPoint,
    // que no se puede mostrar y avisa cómo bajarlo.
    const deslizar = (dx) => q.evaluate(dx => { const o = document.getElementById("filePreviewOverlay"); const t = o.querySelector(".visor-hoja");
      const toque = x => new Touch({ identifier: 1, target: t, clientX: x, clientY: 300 });
      t.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [toque(200)], changedTouches: [toque(200)] }));
      t.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [], changedTouches: [toque(200 + dx)] })); }, dx);
    await deslizar(-120);
    eq("deslizar el dedo hacia la izquierda pasa al siguiente archivo", await q.evaluate(() => [document.getElementById("filePreviewTitle").textContent, document.getElementById("filePreviewCounter").textContent]), ["Presentación del curso.pptx", "2 / 2"]);
    eq("un PowerPoint abre el visor igual, con el aviso y la forma de bajarlo", await q.evaluate(() => [!!document.querySelector(".visor-nada"), /no se puede mostrar/.test(document.getElementById("filePreviewWord").textContent)]), [true, true]);
    await deslizar(120);
    eq("y hacia la derecha vuelve al anterior", await q.evaluate(() => document.getElementById("filePreviewTitle").textContent), "Planilla de gastos de octubre.xlsx");
    await deslizar(-20);
    eq("un toque corto no cambia nada", await q.evaluate(() => document.getElementById("filePreviewTitle").textContent), "Planilla de gastos de octubre.xlsx");
    eq("el contador va siempre de izquierda a derecha (en hebreo salía «2/1»)", await q.evaluate(() => getComputedStyle(document.getElementById("filePreviewCounter")).direction), "ltr");
    await q.keyboard.press("Escape");
    const tarjeta = '.post[data-post-id="p_reunion"]';
    await q.click(`${tarjeta} .doc-linea`);
    await q.waitForSelector(`${tarjeta} .doc-abierto`);
    const fila = () => q.$$eval(`${tarjeta} .doc-fila`, l => l.map(e => ({ archivo: (e.querySelector(".doc-archivo") || {}).textContent?.trim(), mas: (e.querySelector(".doc-mas") || {}).textContent?.trim() || null, agregar: !!e.querySelector(".doc-agregar") })));
    eq("varios por documento: se ve el último subido, «+1 más» y el + para sumar otro", (await fila())[0],
       { archivo: "📘 Plan de viaje definitivo con un nombre muy largo.docx", mas: "+1 más ▾", agregar: true });
    eq("con uno solo no hay «más»", (await fila())[1].mas, null);
    await q.click(`${tarjeta} .doc-mas`);
    eq("«+1 más» despliega el anterior", await q.$$eval(`${tarjeta} .doc-anteriores .doc-archivo`, l => l.map(e => e.textContent.trim())), ["📄 Plan viejo.pdf"]);
    await q.click(`${tarjeta} .doc-fila .doc-archivo`);
    eq("tocar un Word abre el visor oscuro (como las fotos) y lo dibuja",
      await hasta(q, () => { const o = document.getElementById("filePreviewOverlay"); return !o.hidden && /Word de \d+ bytes/.test(document.getElementById("filePreviewWord").textContent); }), true);
    eq("Word armado: el enlace javascript: pierde su destino y el marco embebido se va",
      await q.evaluate(() => [document.getElementById("wordMalo")?.hasAttribute("href"), !!document.getElementById("wordMarco")]), [false, false]);
    eq("visor: el nombre, y el contador entre los documentos del evento",
      await q.evaluate(() => [document.getElementById("filePreviewTitle").textContent, document.getElementById("filePreviewCounter").textContent]),
      ["Plan de viaje definitivo con un nombre muy largo.docx", "1 / 3"]);
    const zoom = () => q.evaluate(() => Number(document.querySelector("#filePreviewWord section.docx").style.zoom || 1));
    const antes = await zoom();
    await q.click("#filePreviewMas"); await q.click("#filePreviewMas");
    const despues = await zoom();
    await q.click("#filePreviewMenos");
    eq("visor: con un Word aparecen − % + y cambian el tamaño", [await q.evaluate(() => !document.getElementById("filePreviewZoom").hidden), despues > antes, (await zoom()) < despues], [true, true, true]);
    eq("visor: el porcentaje dice el tamaño", await q.evaluate(() => document.getElementById("filePreviewPct").textContent), Math.round((await zoom()) * 100) + "%");
    await q.click("#filePreviewPct");
    eq("visor: tocar el porcentaje vuelve al tamaño inicial", await zoom(), antes);
    eq("visor: el iPhone no agranda la letra por su cuenta", await q.evaluate(() => { const c = getComputedStyle(document.getElementById("filePreviewWord")); return c.webkitTextSizeAdjust || c.textSizeAdjust; }), "100%");
    await q.keyboard.press("ArrowRight");
    eq("visor: la flecha → pasa al siguiente (un PDF, en el marco)", await q.evaluate(() => [document.getElementById("filePreviewTitle").textContent, document.getElementById("filePreviewFrame").hidden, document.getElementById("filePreviewCounter").textContent]),
      ["Plan viejo.pdf", false, "2 / 3"]);
    eq("visor: en un PDF no hay A− / A+ (el navegador ya trae lo suyo)", await q.evaluate(() => document.getElementById("filePreviewZoom").hidden), true);
    await q.keyboard.press("Escape");
    eq("visor: Esc cierra y el foco vuelve a lo que se tocó", await q.evaluate(() => [document.getElementById("filePreviewOverlay").hidden, document.activeElement.classList.contains("doc-archivo")]), [true, true]);
    // Ventana flotante (opción B): sin fondo negro, la página atrás bloqueada.
    await q.click(`${tarjeta} .doc-fila .doc-archivo`);
    eq("visor: ventana blanca sobre la página apenas atenuada (sin fondo negro)",
      await hasta(q, () => { const o = document.getElementById("filePreviewOverlay"); if(o.hidden) return false; const a = Number((getComputedStyle(o).backgroundColor.match(/[\d.]+\)$/) || ["1)"])[0].replace(")", "")); return a < 0.3 && !!o.querySelector(".visor-ventana .visor-barra"); }), true);
    eq("visor: la página de atrás no se puede tocar mientras está abierto",
      await q.evaluate(() => { const r = document.querySelector(".post-actions").getBoundingClientRect(); const e = document.elementFromPoint(r.left + 5, r.top + 5); return !!e && !!e.closest("#filePreviewOverlay"); }), true);
    await q.mouse.click(5, 300);
    eq("visor: tocar la página de atrás lo cierra", await q.evaluate(() => document.getElementById("filePreviewOverlay").hidden), true);
    // Las fotos, con la misma ventana.
    await q.click(`${tarjeta} img[data-action="open-lightbox"]`);
    eq("fotos: la misma ventana, con su barra y sin fondo negro",
      await hasta(q, () => { const l = document.getElementById("lightbox"); if(!l.classList.contains("show")) return false; const a = Number((getComputedStyle(l).backgroundColor.match(/[\d.]+\)$/) || ["1)"])[0].replace(")", "")); return a < 0.3 && document.getElementById("lightboxTitle").textContent === "Foto"; }), true);
    await q.click("#lightboxImg");
    eq("fotos: tocar la foto no la cierra", await q.evaluate(() => document.getElementById("lightbox").classList.contains("show")), true);
    await q.keyboard.press("Escape");
    eq("fotos: Esc la cierra", await q.evaluate(() => document.getElementById("lightbox").classList.contains("show")), false);
    await q.click(`${tarjeta} img[data-action="open-lightbox"]`);
    await q.click("#lightboxClose");
    eq("fotos: la ✕ también", await q.evaluate(() => document.getElementById("lightbox").classList.contains("show")), false);
    eq("varios por documento y visor: sin un solo error", err2, []);
    await q.close();
  }
  eq("documentación: sin un solo error", errores, []);
}

/* ---------- En un celular ---------- */
{
  const ANCHO = 390;
  const { p, errores } = await entrar(ADMIN, "Benny", null, { width: ANCHO, height: 844 });
  await esperarTexto(p, "Reunión con la comunidad");
  eq("celular: en la tarjeta la fecha va arriba del nombre, y abajo solo los íconos con su número",
    await p.evaluate(() => { const c = document.querySelector('.post[data-post-id="p_reunion"]');
      const arriba = c.querySelector(".post-cuando").getBoundingClientRect().top < c.querySelector(".post-titulo").getBoundingClientRect().top;
      const nombres = [...c.querySelectorAll(".post-actions .pa-l")].every(e => getComputedStyle(e).display === "none");
      const hilo = [...c.querySelector('[data-action="toggle-thread"]').children].find(e => getComputedStyle(e).display !== "none").textContent.trim();
      return [arriba, nombres, hilo]; }), [true, true, "💬 1"]);
  eq("celular: las pestañas de arriba se esconden y aparece la barra de abajo",
    [await visible(p, "nav.tabs"), await visible(p, ".bottom-nav")], [false, true]);
  eq("celular: la barra trae Inicio, Calendario, Países y Más, con el hueco del + en el medio",
    await p.$$eval(".bottom-nav > *", es => es.map(e => e.classList.contains("bn-gap") ? "+" : e.dataset.view || e.dataset.action)),
    ["feed", "calendario", "+", "paises", "toggle-more-menu"]);
  // 6/10/2026: píldora de vidrio que flota, solo íconos (los nombres
  // quedan para los lectores de pantalla).
  eq("celular: la barra flota separada de los bordes, con vidrio, y muestra solo los íconos",
    await p.evaluate(() => { const n = document.querySelector(".bottom-nav"), r = n.getBoundingClientRect(), c = getComputedStyle(n);
      const txt = document.querySelector('.bn-item[data-view="feed"] .bn-txt'), rt = txt.getBoundingClientRect();
      return [r.left >= 8, innerHeight - r.bottom >= 8, c.backdropFilter !== "none", rt.width <= 1, txt.textContent.trim()]; }),
    [true, true, true, true, "Inicio"]);
  // El + tiene que caer en el medio exacto de la pantalla, sobre el hueco
  // de la barra, y no corrido (pisaba "Países": la caja que lo envuelve es
  // tan ancha como las acciones que despliega, y se centraba el + dentro
  // de esa caja en vez de la caja en la pantalla).
  const fab = await p.$eval(".fab-main", e => { const r = e.getBoundingClientRect(); return { centro: r.left + r.width / 2, abajo: r.bottom }; });
  const hueco = await p.$eval(".bottom-nav .bn-gap", e => { const r = e.getBoundingClientRect(); return { izq: r.left, der: r.right }; });
  eq("celular: el + está centrado en la pantalla", Math.abs(fab.centro - ANCHO / 2) <= 2, true);
  eq("celular: y sobre el hueco de la barra", fab.centro > hueco.izq && fab.centro < hueco.der, true);
  await p.click(".fab-main");
  eq("celular: al abrirlo, las acciones aparecen", await hasta(p, () => !!document.querySelector(".fab-wrap.open .fab-action")), true);
  // Tanda 15: el panel de la campanita entra entero en la pantalla (colgado
  // del botón se salía 16px por un costado; en hebreo, por el otro), y un
  // @usuario va aislado como texto LTR (en hebreo la @ se iba al final:
  // "diego@").
  await p.click('[data-action="toggle-mentions-menu"]');
  await p.waitForSelector(".mentions-menu", { timeout: 3000 });
  const panelCampana = await p.evaluate(() => { const r = document.querySelector(".mentions-menu").getBoundingClientRect(); return { izq: Math.round(r.left), der: Math.round(r.right) }; });
  eq("celular: el panel de la campanita entra entero en la pantalla", panelCampana.izq >= 0 && panelCampana.der <= ANCHO, true);
  await p.click('[data-action="toggle-mentions-menu"]');
  // (El @ del autor ya no está en la tarjeta: la regla se prueba sobre uno puesto a mano.)
  eq("celular: un @usuario va aislado como texto de izquierda a derecha",
    await p.evaluate(() => { const m = document.createElement("span"); m.className = "mention-tag"; m.textContent = "@diego"; document.getElementById("viewRoot").append(m); const cs = getComputedStyle(m); const r = [cs.direction, cs.unicodeBidi]; m.remove(); return r; }), ["ltr", "isolate"]);
  // Tanda 21: con el teclado abierto queda media pantalla, y es para el
  // campo. Al escribir se esconden la barra de abajo y el +, y el header
  // deja de quedar pegado arriba; al salir del campo, todo vuelve.
  await p.click(".fab-main");
  await p.evaluate(() => scrollTo(0, 0));
  await p.focus("#rutinaContent");
  eq("celular: al escribir, se esconden la barra de abajo y el + y el header se va con la página",
    await p.evaluate(() => [document.documentElement.classList.contains("teclado"), getComputedStyle(document.querySelector(".bottom-nav")).display,
      getComputedStyle(document.querySelector(".fab-wrap")).display, getComputedStyle(document.querySelector("header.topbar")).position]),
    [true, "none", "none", "static"]);
  await p.setViewportSize({ width: ANCHO, height: 420 });
  eq("celular: --vvh sigue el alto que de verdad se ve",
    await hasta(p, () => getComputedStyle(document.documentElement).getPropertyValue("--vvh").trim() === "420px"), true);
  await p.evaluate(() => document.activeElement.blur());
  await p.setViewportSize({ width: ANCHO, height: 844 });
  eq("celular: al salir del campo, la barra y el header vuelven",
    await hasta(p, () => !document.documentElement.classList.contains("teclado") && getComputedStyle(document.querySelector(".bottom-nav")).display === "flex"
      && getComputedStyle(document.querySelector("header.topbar")).position === "sticky"), true);
  eq("celular: un casillero no cuenta como escribir (no saca la barra)",
    await p.evaluate(() => { const c = document.createElement("input"); c.type = "checkbox"; document.getElementById("viewRoot").append(c); c.focus(); const r = document.documentElement.classList.contains("teclado"); c.remove(); return r; }), false);
  await p.click('[data-action="goto-view"][data-view="calendario"]').catch(() => {});
  await p.click('[data-action="toggle-more-menu"]');
  await p.click('.bn-sheet [data-view="proyectos"]');
  eq("celular: Proyectos arranca en Tarjetas (la línea de tiempo no entra)",
    await hasta(p, () => document.querySelector('[data-action="proyectos-vista"][data-key="tarjetas"].active') !== null), true);
  eq("celular: sin un solo error", errores, []);
  await p.close();
}

/* ---------- El Feed carga solo al acercarse al final ---------- */
{
  // 22 posteos: entran 15, y al bajar hasta el final tienen que aparecer
  // los otros 7 sin tocar "Ver más".
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    for(let i = 0; i < 20; i++) base.posts.push({ ...base.posts[0], id: "p_relleno_" + i, title: "Posteo de relleno " + i,
      images: [], date: dia(20 + i), start_date: dia(20 + i), end_date: dia(20 + i), created_at: hace(20 + i) });
  });
  await esperarTexto(p, "Reunión con la comunidad");
  const cuantas = () => p.$$eval("#viewRoot article.post", es => es.length);
  const hayVerMas = async () => !!(await p.$('[data-action="feed-load-more"]'));
  eq("feed: arranca con 15 tarjetas y el botón Ver más de respaldo", [await cuantas(), await hayVerMas()], [15, true]);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  eq("feed: al llegar al final carga solo las que faltan, sin tocar nada",
    await hasta(p, () => document.querySelectorAll("#viewRoot article.post").length === 22), true);
  eq("feed: y cuando no queda nada por cargar, el botón desaparece", await hayVerMas(), false);
  // Después de la última tarjeta viene el pie casi enseguida: un respiro
  // estándar (24px de main + el margen de la tarjeta), no el cuarto de
  // pantalla vacío que había antes.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const hueco = await p.evaluate(() => {
    const arts = document.querySelectorAll("#viewRoot article.post");
    return Math.round(document.querySelector("footer.appfoot").getBoundingClientRect().top - arts[arts.length - 1].getBoundingClientRect().bottom);
  });
  eq("feed: entre la última tarjeta y el pie hay un respiro chico (≤ 48px)", hueco <= 48 && hueco >= 16, true);
  eq("feed: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Un id armado no mete nada en la pantalla (docs/AUDITORIA.md, U3) ----------
   El id lo elige quien escribe, y la app lo pone en decenas de atributos
   de cada tarjeta. Sin escaparlo, un id con comillas cerraba el atributo y
   sumaba los suyos. La base ahora rechaza esa forma (03-validacion.sql,
   posts_id_forma); la app lo escapa igual, por si alguna fila vieja la tiene. */
{
  const raro = 'p_raro"><b id="inyectado">x</b><i x="';
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    const molde = base.posts.find(x => x.id === "p_reunion");
    base.posts.push({ ...JSON.parse(JSON.stringify(molde)), id: raro, title: "Posteo con id raro", images: [] });
    base.replies.push({ ...base.replies[0], id: 'r_raro"><u id="inyectado2">', post_id: raro, content: "Comentario con id raro" });
  });
  eq("id raro: el posteo aparece", await esperarTexto(p, "Posteo con id raro"), true);
  await p.evaluate(raro => document.querySelector(`button[data-action="toggle-thread"][data-post-id="${CSS.escape(raro)}"]`)?.click(), raro);
  await esperarTexto(p, "Comentario con id raro", 3000);
  eq("id raro: no aparece ningún elemento inyectado", await p.evaluate(() => [!!document.getElementById("inyectado"), !!document.getElementById("inyectado2")]), [false, false]);
  eq("id raro: la tarjeta guarda el id entero en su atributo", await p.evaluate(raro => [...document.querySelectorAll("article.post")].some(a => a.dataset.postId === raro), raro), true);
  eq("id raro: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Volver arriba, el cuadro que no tapa, la tabla que entra (docs/AUDITORIA.md, I1 e I9) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    for(let i = 0; i < 25; i++) base.posts.push({ ...JSON.parse(JSON.stringify(base.posts[0])), id: "p_relleno" + i, title: "Relleno " + i, images: [], created_at: hace(30 + i) });
  });
  await esperarTexto(p, "Relleno 3");
  await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(150);
  eq("escritorio: el cuadro «¿Qué hiciste hoy?» ya no queda fijo arriba", await p.$eval(".quick-composer", e => getComputedStyle(e).position), "static");
  await p.click('nav.tabs button[data-view="calendario"]');
  eq("escritorio: una pestaña de arriba lleva al principio de la vista", await hasta(p, () => scrollY === 0, null, 3000), true);
  eq("sin un solo error", errores, []);
  await p.close();
}
{
  const { p, errores } = await entrar(ADMIN, "Benny", base => {
    base.members.push({ email: "lucia@x.com", name: "Lucía Fernández Goldberg de la Torre", nickname: "lucia", role: "member", approved_at: "2025-03-01T12:00:00Z" });
    base.posts[0].author_email = "lucia@x.com"; base.posts[0].author_name = "Lucía Fernández Goldberg de la Torre";
  }, { width: 390, height: 844 });
  await esperarTexto(p, "Reunión con la comunidad");
  await p.evaluate(() => { document.querySelector('.bn-item[data-action="toggle-more-menu"]').click(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="reportes"]').click());
  await p.waitForSelector(".rep-equipo table", { timeout: 5000 }).catch(() => {});
  eq("celular: «Por persona del equipo» entra entera en la pantalla", await p.evaluate(() => { const t = document.querySelector(".rep-equipo table"); return !!t && t.getBoundingClientRect().right <= document.documentElement.clientWidth; }), true);
  eq("celular: sin un solo error", errores, []);
  await p.close();
}

/* ---------- Un arranque más liviano (docs/AUDITORIA.md, I8) ---------- */
{
  const pedidos = [];
  const { p, errores } = await entrar(ADMIN, "Benny", null, null, pedidos);
  await esperarTexto(p, "Reunión con la comunidad");
  eq("al entrar no se baja nada del mapa (antes, cinco pedidos a unpkg en cada visita)", pedidos.filter(u => /unpkg\.com\/leaflet/.test(u)), []);
  const consultas = await p.evaluate(() => window.__sb.consultas || []);
  const iPosts = consultas.indexOf("posts"), iReplies = consultas.indexOf("replies");
  eq("los comentarios se piden a la par de los posteos, no después", iReplies >= 0 && iPosts >= 0 && Math.abs(iReplies - iPosts) <= 3, true);
  await p.click('nav.tabs button[data-view="paises"]');
  await p.click('[data-action="paises-subview"][data-key="mapa"]');
  await p.waitForTimeout(800);
  eq("al abrir el mapa recién ahí se pide Leaflet", pedidos.some(u => /unpkg\.com\/leaflet@[\d.]+\/dist\/leaflet\.js/.test(u)), true);
  eq("y como desde acá no llegan, avisa que el mapa no se pudo cargar", await esperarTexto(p, "El mapa no se pudo cargar", 5000), true);
  eq("sin un solo error", errores, []);
  await p.close();
}

/* ---------- Cuánto hay guardado, y avisar antes de bajarlo todo (docs/AUDITORIA.md, M8) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await esperarTexto(p, "Reunión con la comunidad");
  await p.evaluate(() => { window.__sb.tamano = { archivos: 812, bytes: 640 * 1024 * 1024 }; });
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  await p.click('.admin-menu [data-action="admin-go"][data-view="preferencias"][data-key="copia"]');
  eq("copia: dice cuánto hay guardado contra el GB del plan gratis", await esperarTexto(p, "812 · 640 MB de 1 GB", 4000), true);
  await p.click('[data-action="copia-completa"]');
  eq("copia completa: con más de 200 MB pregunta antes, con cuánto va a bajar", await hasta(p, () => /812 fotos y archivos, unos 640 MB/.test(document.body.innerText), null, 4000), true);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  eq("y si no se confirma, no baja nada", await p.evaluate(() => window.__sb.descargas || 0), 0);
  eq("sin un solo error", errores, []);
  await p.close();
}

/* ---------- Teclado y lectores de pantalla (docs/AUDITORIA.md, M5) ---------- */
{
  const { p, errores } = await entrar(ADMIN, "Benny");
  await esperarTexto(p, "Reunión con la comunidad");
  const sinRol = await p.evaluate(() => [...document.querySelectorAll("#viewRoot [data-action]")]
    .filter(e => !["BUTTON","A","INPUT","SELECT","TEXTAREA","LABEL","OPTION"].includes(e.tagName) && !/^(button|link|checkbox|radio|option|tab|menuitem|switch)$/.test(e.getAttribute("role") || ""))
    .map(e => e.tagName.toLowerCase() + "." + e.dataset.action));
  eq("en el Inicio, todo lo que se toca es un botón o se anuncia como tal", [...new Set(sinRol)], []);
  await p.focus('.post[data-post-id="p_reunion"] .post-chips .scope-chip');
  await p.keyboard.press("Enter");
  eq("una ciudad de la tarjeta se abre con Enter, como con un clic", await p.$eval('.post[data-post-id="p_reunion"] .post-chips .scope-chip', e => e.classList.contains("completo")), true);
  await p.focus('.post[data-post-id="p_reunion"] img[data-action="open-lightbox"]');
  await p.keyboard.press(" ");
  eq("y una foto con Espacio", await hasta(p, () => document.getElementById("lightbox").classList.contains("show"), null, 3000), true);
  eq("los ✕ dicen qué hacen", await p.evaluate(() => [...document.querySelectorAll(".rm")].filter(b => !b.getAttribute("aria-label") && !b.getAttribute("title")).length), 0);
  eq("sin un solo error", errores, []);
  await p.close();
}

/* ---------- Alguien que entra por primera vez ---------- */
{
  const { p, errores, base } = await entrar("pedro@x.com", "Pedro Gómez");
  const pidio = await hasta(p, () => (window.__sb.tablas.access_requests || []).some(r => r.email === "pedro@x.com"));
  eq("alguien nuevo: queda anotado su pedido de acceso", pidio, true);
  const pedido = (await base()).access_requests.find(r => r.email === "pedro@x.com") || {};
  eq("alguien nuevo: pendiente, con su nombre", [pedido.status, pedido.name], ["pending", "Pedro Gómez"]);
  eq("alguien nuevo: no ve ningún posteo", await p.evaluate(() => document.body.innerText.includes("Reunión con la comunidad")), false);
  eq("alguien nuevo: sin un solo error", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
