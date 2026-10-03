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
    then(ok, mal){ return new Promise(r => setTimeout(r, 0)).then(() => ejecutar(q)).then(ok, mal); },
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
      return { data: null, error: { code: "PGRST202", message: "no existe la función " + nombre } };
    },
    storage: { from(){ return {
      createSignedUrls: async rutas => ({ error: null, data: rutas.map(r => ({ path: r, error: null,
        signedUrl: url + "/storage/v1/object/sign/adjuntos/" + r + "?token=prueba" })) }),
      upload: async (ruta, blob) => { estado.subidas.push([ruta, blob.type]); return { error: null }; },
      remove: async rutas => { estado.borradas.push(...rutas); return { error: null }; },
      list: async () => ({ data: [], error: null }),
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
async function entrar(email, nombre, mod, viewport){
  const base = BASE(); if(mod) mod(base);
  const p = await b.newPage(viewport ? { viewport } : {});
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error" && !deRed(m.text())) errores.push(m.text()); });
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(/\/storage\/v1\/object\/sign\//.test(u)) return ruta.fulfill({ contentType: "image/png", body: PNG });
    if(/^https:\/\/www\.googleapis\.com\/calendar\//.test(u))
      return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [],
                    logins: [], canales: 0 };
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

  // Administración: el Resumen muestra el pedido de acceso pendiente, y
  // cada sección del menú de al lado se dibuja.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="admin"]');
  eq("admin: el Resumen de Administración muestra el pedido pendiente", await esperarTexto(p, "Nueva Persona", 3000), true);
  const secciones = await p.$$eval('.admin-menu [data-action="admin-go"]', bs => bs.map(b => b.dataset.view + (b.dataset.key ? ":" + b.dataset.key : "")));
  eq("admin: el menú de Administración tiene todas las secciones", secciones,
     ["admin","solicitudes:usuarios","auditoria","preferencias:zonas","preferencias:tipos","preferencias:lugares","preferencias:adjuntos","preferencias:calendar"]);
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
  await p.click('button[data-action="acceso-section"][data-key="pendientes"]');
  eq("admin: y en Solicitudes, el pedido pendiente", await esperarTexto(p, "Nueva Persona", 3000), true);
  await p.click('.admin-menu [data-action="admin-go"][data-view="auditoria"]');
  eq("admin: en el registro de actividad aparece lo registrado", await esperarTexto(p, "Ana Pérez", 3000), true);

  // Una preferencia personal, desde el menú del avatar: se ve y queda
  // guardada (ver preferencias_test).
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  await p.waitForTimeout(200);
  const hayControl = !!(await p.$('select[data-pref="weekStart"]'));
  eq("admin: Configuración tiene el control del primer día de la semana", hayControl, true);
  if(hayControl){
    await p.selectOption('select[data-pref="weekStart"]', "1");
    await hasta(p, () => (window.__sb.tablas.user_prefs || []).length > 0);
    const prefs = (await base()).user_prefs.find(f => f.email === ADMIN);
    eq("admin: la preferencia queda guardada en la base", prefs && prefs.prefs.weekStart, 1);
    eq("admin: por la función de la base, sin decir de quién (sale de la sesión)",
       (await rpc()).filter(r => r[0] === "guardar_preferencias").map(r => Object.keys(r[1])), [["p_parche"]]);
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
  // Y queda en el registro de actividad quién la cargó (tanda 11).
  await hasta(p, () => (window.__sb.tablas.audit_log || []).some(a => a.type === "post_created"));
  const anotada = (await base()).audit_log.find(a => a.type === "post_created") || {};
  eq("admin: el registro de actividad anota que la cargó, con su título y tipo",
    [anotada.actor_email, anotada.detail], [ADMIN, "«Visita a la escuela del barrio» (Rutina)"]);

  // Me gusta en un posteo de otro.
  const boton = await p.$('button[data-action="toggle-like"][data-post-id="p_reunion"]:not([data-reply-id])');
  eq("admin: puede darle me gusta a un posteo", !!boton, true);
  if(boton){
    await boton.click();
    const conMeGusta = await hasta(p, () => ((window.__sb.tablas.posts.find(x => x.id === "p_reunion") || {}).liked_by || []).length === 1);
    eq("admin: el me gusta queda guardado", conMeGusta, true);
    eq("admin: y se ve en el botón", await hasta(p,
       () => /\(1\)/.test((document.querySelector('button[data-action="toggle-like"][data-post-id="p_reunion"]:not([data-reply-id])') || {}).textContent || "")), true);
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

  eq("admin: el login quedó anotado en Actividad", (await base()).audit_log.some(a => a.type === "login" && a.actor_email === ADMIN), true);

  // Salir.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="sign-out"]');
  const salio = await hasta(p, () => !document.body.innerText.includes("Reunión con la comunidad"));
  if(!salio) console.log("   (en pantalla: " + JSON.stringify((await p.evaluate(() => document.body.innerText)).slice(0, 400)) + ")");
  eq("admin: al salir vuelve a la pantalla de entrada", salio, true);
  eq("admin: y las solapas de admin ya no se ven", [await visible(p, "#tabAuditoria"), await visible(p, "#tabSolicitudes"),
     await visible(p, "#tabPreferencias")], [false, false, false]);
  eq("admin: y no quedan firmas de adjuntos guardadas en el navegador",
     await p.evaluate(() => localStorage.getItem("registro.firmas.v1")), null);

  eq("admin: sin un solo error en todo el camino", errores, []);
  await p.close();
}

/* ---------- Un integrante común ---------- */
{
  const { p, errores } = await entrar("ana@x.com", "Ana Pérez");
  eq("integrante: entra y ve los posteos", await esperarTexto(p, "Programa de becas"), true);
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
  await p.keyboard.press("Escape");
  eq("admin: sin un solo error", errores, []);
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

/* ---------- En un celular ---------- */
{
  const ANCHO = 390;
  const { p, errores } = await entrar(ADMIN, "Benny", null, { width: ANCHO, height: 844 });
  await esperarTexto(p, "Reunión con la comunidad");
  eq("celular: las pestañas de arriba se esconden y aparece la barra de abajo",
    [await visible(p, "nav.tabs"), await visible(p, ".bottom-nav")], [false, true]);
  eq("celular: la barra trae Inicio, Calendario, Países y Más, con el hueco del + en el medio",
    await p.$$eval(".bottom-nav > *", es => es.map(e => e.classList.contains("bn-gap") ? "+" : e.dataset.view || e.dataset.action)),
    ["feed", "calendario", "+", "paises", "toggle-more-menu"]);
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
