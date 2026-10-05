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
      download: async ruta => /rota/.test(ruta) ? { data: null, error: { message: "Object not found" } } : { data: new Blob(["contenido de " + ruta]), error: null },
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
    // La herramienta del .zip, de mentira: el "zip" es la lista de lo que
    // se le metió, para poder mirarla.
    // La herramienta que dibuja los Word, de mentira: escribe cuántos bytes le llegaron.
    if(/docx-preview/.test(u)) return ruta.fulfill({ contentType: "application/javascript", body: `window.docx = { renderAsync: async (blob, el) => { el.innerHTML = '<section class="docx">Word de ' + blob.size + ' bytes</section>'; } };` });
    if(/\/jszip\//.test(u)) return ruta.fulfill({ contentType: "application/javascript", body: `window.JSZip = class { constructor(){ this.n = []; }
      file(nombre){ this.n.push(nombre); return this; } async generateAsync(){ return new Blob([JSON.stringify(this.n.sort())]); } };` });
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
        { name: "Planilla de gastos de octubre.xlsx", kind: "planilla", path: "posts/p_reunion/x7f3a9.xlsx" } ]; });
    await esperarTexto(q, "Reunión con la comunidad");
    // Lo que se baja conserva el nombre con que se cargó, no el del bucket.
    const [bajada] = await Promise.all([q.waitForEvent("download"), q.click(`.post[data-post-id="p_reunion"] a.post-file-link[download]`)]);
    eq("bajar un archivo conserva el nombre con que se cargó", bajada.suggestedFilename(), "Planilla de gastos de octubre.xlsx");
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
    eq("visor: el nombre, y el contador entre los documentos del evento",
      await q.evaluate(() => [document.getElementById("filePreviewTitle").textContent, document.getElementById("filePreviewCounter").textContent]),
      ["Plan de viaje definitivo con un nombre muy largo.docx", "1 / 3"]);
    await q.keyboard.press("ArrowRight");
    eq("visor: la flecha → pasa al siguiente (un PDF, en el marco)", await q.evaluate(() => [document.getElementById("filePreviewTitle").textContent, document.getElementById("filePreviewFrame").hidden, document.getElementById("filePreviewCounter").textContent]),
      ["Plan viejo.pdf", false, "2 / 3"]);
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
