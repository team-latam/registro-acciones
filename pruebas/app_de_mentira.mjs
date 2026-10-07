/* ======================================================================
   La app con un Supabase de mentira y datos parecidos a los reales

   Lo comparten las pruebas (recortes_test.mjs) y la auditoría
   (auditoria/herramientas/): entrar con alguien, en el tamaño y el idioma
   que se pida, recorrer todas las pantallas, y medir lo que queda cortado.
   El Supabase de mentira es el mismo de app_dom_test.mjs (se saca de ahí
   en cada corrida, no se copia); la página es el index.html de verdad, o
   la que diga INDEX.
   ====================================================================== */
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
import fs from "node:fs";

const RAIZ = __aRuta(new URL("..", import.meta.url));



const src = fs.readFileSync(RAIZ + "pruebas/app_dom_test.mjs", "utf8");
const FALSO = src.slice(src.indexOf("const FALSO = `") + "const FALSO = `".length, src.indexOf("}`;\n\nconst ADMIN") + 1);
const PAGINA = "file://" + (process.env.INDEX || RAIZ + "index.html");
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
// Una foto de 480x320 (JPEG gris con un rectángulo) para que las tarjetas tengan imagen real.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export const ADMIN = "benny@team-latam.com";
export const hace = d => new Date(Date.now() - d * 86400000).toISOString();
export const dia = d => hace(d).slice(0, 10);
export const PERS = [
  { email: ADMIN, name: "Benny Rosenthal", nickname: "benny", role: "admin" },
  { email: "ana@team-latam.com", name: "Ana Pérez", nickname: "ana", role: "member" },
  { email: "diego@team-latam.com", name: "Diego Martínez", nickname: "diego", role: "member" },
  { email: "lucia@team-latam.com", name: "Lucía Fernández Goldberg", nickname: "lucia", role: "member" },
  { email: "moshe@team-latam.com", name: "Moshe Levi", nickname: "moshe", role: "member" },
];
const per = i => ({ email: PERS[i].email, name: PERS[i].name });
const vacio = { images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {} };
let n = 0;
export const post = (o) => {
  n++;
  const id = o.id || "p" + n;
  const sd = o.start || dia(o.d ?? 0), ed = o.end || sd;
  return { id, date: sd, start_date: sd, end_date: ed, author_name: PERS[o.a ?? 0].name, author_email: PERS[o.a ?? 0].email,
    activity_type: o.type || "visita", title: o.title, content: o.content || "", created_at: o.created || hace(o.d ?? 0),
    scopes: o.scopes || [], ...vacio, ...o.extra };
};
export const ciudad = (country, city) => ({ type: "ciudad", country, city });
export const pais = country => ({ type: "pais", country });
const POSTS = [
  post({ title: "Visita a la comunidad de Rosario", d: 2, a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")],
    content: "Reunión con la comisión directiva, recorrida por la sede y el colegio. Se acordó un plan de trabajo para el verano.\n\nQuedó pendiente la charla con los padres.",
    extra: { start_time: "09:00:00", end_time: "17:00:00", images: ["posts/p1/img0_1.jpg", "posts/p1/img1_2.jpg"], liked_by: [ADMIN, PERS[2].email, PERS[3].email],
      participants: [per(2), per(3)], files: [{ path: "posts/p1/plan-rosario.docx", name: "Plan de viaje Rosario 2026.docx", doc: "plan", uploaded_at: hace(5) },
        { path: "posts/p1/cierre-rosario.docx", name: "Formulario de Cierre Rosario.docx", doc: "reporte", uploaded_at: hace(1) }],
      resumen: { v: 2, partes: [{ tipo: "cierre", fuente: { name: "Formulario de Cierre Rosario.docx", subidoEl: hace(1) }, lugar: "Rosario, Argentina", duracion: "",
        ejecutivo: "La visita permitió retomar el vínculo con la comisión y relevar el estado de la sede. El equipo local está motivado.",
        objetivos: [{ t: "Relevar la sede y el colegio", logrado: "si" }, { t: "Acordar el plan de verano", logrado: "si" }, { t: "Charla con los padres", logrado: "no" }],
        pasos: [{ id: "x1", t: "Mandar el plan de verano por escrito a la comisión", estado: "pendiente" }, { id: "x2", t: "Coordinar la charla con los padres para marzo", estado: "pendiente" }, { id: "x3", t: "Enviar el informe de la sede", estado: "hecho" }] }] } } }),
  post({ title: "Curso de Team Leader", d: -12, start: dia(-12), end: dia(-16), a: 0, type: "curso", scopes: [ciudad("Uruguay", "Montevideo")],
    content: "Cuarta edición del curso. Inscriptos: 18.", extra: { start_time: "09:00:00", end_time: "18:00:00", participants: [per(1), per(4)], calendar_event_id: "abc123" } }),
  post({ title: "Seminario regional de seguridad comunitaria para instituciones del Cono Sur y Brasil", d: -40, start: dia(-40), end: dia(-42), a: 2, type: "seminario",
    scopes: [{ type: "region", region: "Cono Sur" }], content: "Convocatoria abierta.", extra: { location: "Hotel Panamericano, Buenos Aires", participants: [per(0), per(1), per(2), per(3), per(4)] } }),
  post({ title: "Congreso Latinoamericano", d: -90, start: dia(-90), end: dia(-93), a: 0, type: "congreso", scopes: [{ type: "todo" }], content: "", extra: { location: "Panamá" } }),
  post({ title: "Reunión virtual con Lima", d: 5, a: 3, type: "virtual", scopes: [ciudad("Perú", "Lima")], content: "Seguimiento del plan de emergencia.", extra: { start_time: "15:00:00", end_time: "16:00:00", liked_by: [ADMIN] } }),
  post({ title: "Visita a San Pablo", d: 20, start: dia(20), end: dia(17), a: 0, type: "visita", scopes: [ciudad("Brasil", "São Paulo")], content: "Recorrida por tres instituciones. Faltó una.",
    extra: { images: ["posts/p6/img0_1.jpg"], files: [{ path: "posts/p6/plan.docx", name: "Plan de viaje SP.docx", doc: "plan", uploaded_at: hace(25) }], participants: [per(2)], last_edited_by: PERS[1].name, last_edited_by_email: PERS[1].email, last_edited_at: hace(3) } }),
  post({ title: "Visita a Santiago", d: 60, start: dia(60), end: dia(58), a: 1, type: "visita", scopes: [ciudad("Chile", "Santiago")], content: "Primera visita del año.", extra: { images: ["posts/p7/img0_1.jpg"], participants: [{ persona: "per_guypo", name: "Guypo" }] } }),
  post({ title: "Curso de primeros auxilios", d: 75, start: dia(75), end: dia(75), a: 2, type: "curso", scopes: [ciudad("Argentina", "Córdoba")], content: "", extra: { participants: [per(1)] } }),
  post({ title: "Visita a Montevideo", d: 130, start: dia(130), end: dia(128), a: 0, type: "visita", scopes: [ciudad("Uruguay", "Montevideo")], content: "Reunión con los directores.", extra: { images: ["posts/p9/img0_1.jpg"] } }),
  post({ title: "Visita a Ciudad de México", d: 200, start: dia(200), end: dia(196), a: 3, type: "visita", scopes: [ciudad("México", "Ciudad de México")], content: "Cuatro instituciones en tres días.", extra: { participants: [per(0)] } }),
  post({ title: "Shiur semanal", d: 1, a: 4, type: "rutina", scopes: [], content: "Clase de los martes, 12 personas. Hablamos del plan para las fiestas." }),
  post({ title: "Llamado con la comisión de Córdoba", d: 3, a: 1, type: "rutina", scopes: [ciudad("Argentina", "Córdoba")], content: "Llamado de 40 minutos. Piden una visita en noviembre." }),
  post({ title: "Reunión de equipo", d: 4, a: 0, type: "rutina", scopes: [], content: "Repaso de la agenda de octubre y noviembre. @ana se ocupa de Rosario.", extra: { mentions: ["ana@team-latam.com"] } }),
  post({ title: "Capacitación anual – Instituciones de Bolivia", d: -70, start: dia(-70), end: dia(-72), a: 2, type: "curso", scopes: [ciudad("Bolivia", "Santa Cruz")], content: "" }),
  post({ title: "Visita cancelada a Asunción", d: -8, start: dia(-8), end: dia(-9), a: 1, type: "visita", scopes: [ciudad("Paraguay", "Asunción")], content: "Se posterga por paro de aerolíneas.", extra: { cancelled: true, cancelled_at: hace(1), cancelled_by: ADMIN } }),
  post({ title: "Charla en Bariloche", d: 15, a: 0, type: "otro", scopes: [ciudad("Argentina", "Bariloche")], content: "Charla con jóvenes.", extra: { author_name: "Google Calendar", author_email: null, calendar_event_id: "gc_1" } }),
  post({ title: "Reunión con Diego", d: 30, a: 0, type: "otro", scopes: [], content: "", extra: { author_name: "Google Calendar", author_email: null, calendar_event_id: "gc_2" } }),
  post({ title: "Viaje Caribe 2025", d: 400, start: dia(400), end: dia(396), a: 0, type: "visita", scopes: [ciudad("Panamá", "Ciudad de Panamá"), ciudad("Costa Rica", "San José")], content: "Gira por Centroamérica." }),
  post({ title: "Visita a Rosario 2025", d: 380, start: dia(380), end: dia(378), a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "Visita del año pasado." }),
  post({ title: "Curso de Team Leader 2025", d: 350, start: dia(350), end: dia(346), a: 0, type: "curso", scopes: [ciudad("Uruguay", "Montevideo")], content: "Tercera edición." }),
  post({ title: "Visita a Quito", d: 500, start: dia(500), end: dia(498), a: 3, type: "visita", scopes: [ciudad("Ecuador", "Quito")], content: "" }),
  post({ title: "Visita a Caracas", d: 800, start: dia(800), end: dia(797), a: 0, type: "visita", scopes: [ciudad("Venezuela", "Caracas")], content: "" }),
  // Proyectos
  post({ id: "proj1", title: "Plan de cámaras Rosario", d: 30, start: dia(30), end: dia(-60), a: 0, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "Instalación de cámaras en la sede y el colegio.",
    extra: { is_project: true, project_status: "open", milestones: [{ id: "h1", label: "Presupuesto aprobado", date: dia(20), done: true, owners: [] }, { id: "h2", label: "Compra de equipos", date: dia(5), done: false, owners: [PERS[1].email] }, { id: "h3", label: "Instalación", date: dia(-20), done: false, owners: [] }, { id: "h4", label: "Capacitación de guardias", date: dia(-50), done: false, owners: [] }] } }),
  post({ id: "proj2", title: "Programa de becas 2026", d: 120, start: dia(120), end: dia(-120), a: 1, type: "curso", scopes: [{ type: "todo" }], content: "Becas para formación de Team Leaders.",
    extra: { is_project: true, project_status: "open", milestones: [{ id: "h5", label: "Convocatoria", date: dia(100), done: true, owners: [] }, { id: "h6", label: "Selección", date: dia(40), done: true, owners: [] }, { id: "h7", label: "Primera cohorte", date: dia(-30), done: false, owners: [] }] } }),
  post({ id: "proj3", title: "Manual de procedimientos", d: 300, start: dia(300), end: dia(150), a: 2, type: "otro", scopes: [], content: "Hecho.",
    extra: { is_project: true, project_status: "done", milestones: [{ id: "h8", label: "Borrador", date: dia(250), done: true, owners: [] }, { id: "h9", label: "Publicación", date: dia(150), done: true, owners: [] }] } }),
];
const REPLIES = [
  { id: "r1", post_id: "p1", content: "¡Excelente! ¿Pudieron ver el tema del portón?", author_name: PERS[0].name, author_email: ADMIN, created_at: hace(1) },
  { id: "r2", post_id: "p1", content: "Sí, quedó para el presupuesto de noviembre.", author_name: PERS[1].name, author_email: PERS[1].email, created_at: hace(0.9), parent_id: "r1" },
  { id: "r3", post_id: "p1", content: "Me sumo a la charla con los padres si es en marzo.", author_name: PERS[2].name, author_email: PERS[2].email, created_at: hace(0.5), liked_by: [ADMIN] },
  { id: "r4", post_id: "p6", content: "Faltó la de Campinas, la reprogramamos.", author_name: PERS[0].name, author_email: ADMIN, created_at: hace(18) },
  { id: "r5", post_id: "p2", content: "Benny Rosenthal cambió la fecha de fin.", author_name: "Sistema", author_email: ADMIN, created_at: hace(2), system: true },
].map(r => ({ scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [], system: false, ...r }));

export const BASE = () => ({
  members: PERS.map((p, i) => ({ ...p, approved_at: "2025-01-10T12:00:00Z", calendar_shared: i < 3, last_seen_at: hace(i * 9) })),
  posts: POSTS, replies: REPLIES,
  access_requests: [{ email: "nueva@gmail.com", name: "Nueva Persona", status: "pending", requested_at: hace(1) }, { email: "otra@team-latam.com", name: "Otra Más", status: "pending", requested_at: hace(3) }],
  former_members: [],
  audit_log: [
    { id: "a1", type: "login", actor_email: PERS[1].email, actor_name: PERS[1].name, created_at: hace(0.2) },
    { id: "a2", type: "post_created", actor_email: PERS[1].email, actor_name: PERS[1].name, created_at: hace(2), details: { title: "Visita a la comunidad de Rosario", activity_type: "visita" } },
    { id: "a3", type: "login", actor_email: ADMIN, actor_name: PERS[0].name, created_at: hace(1) },
    { id: "a4", type: "post_edited", actor_email: PERS[1].email, actor_name: PERS[1].name, created_at: hace(3), details: { title: "Visita a San Pablo" } },
    { id: "a5", type: "login", actor_email: PERS[2].email, actor_name: PERS[2].name, created_at: hace(1.5) },
  ],
  app_config: [{ key: "preferences", value: { activityTypes: [
    { key: "visita", label: "Visita", icon: "🧳", calendarSync: true, docs: [{ id: "plan", label: "Plan de viaje" }, { id: "reporte", label: "Reporte" }, { id: "memoria", label: "Memoria" }, { id: "otro", label: "Otro", opcional: true }] },
    { key: "curso", label: "Curso", icon: "📘", calendarSync: true, docs: [{ id: "programa", label: "Programa" }, { id: "lista", label: "Lista de asistentes" }] },
    { key: "seminario", label: "Seminario", icon: "🎤", calendarSync: true, docs: [{ id: "programa", label: "Programa" }] },
    { key: "congreso", label: "Congreso", icon: "🏛️", calendarSync: true, docs: [] },
    { key: "virtual", label: "Virtual", icon: "💻", calendarSync: true, docs: [] },
    { key: "otro", label: "Otro", icon: "✨", calendarSync: true, docs: [] },
  ] } }],
  user_prefs: [],
  // Personas sin cuenta (18-personas.sql): una en un evento y una sola.
  personas: [{ id: "per_guypo", name: "Guypo", email: null, note: "Coordinador local en Santiago", created_by: ADMIN, created_at: hace(30) },
    { id: "per_dario", name: "Darío", email: "dario@x.com", note: null, created_by: PERS[1].email, created_at: hace(8) }],
});

// Abre el navegador (uno para toda la corrida).
export const abrirNavegador = () => chromium.launch();
// Entra a la app con quien se le diga. `base` reemplaza los datos (por
// ejemplo, los variados de auditoria/herramientas/datos.mjs).
export async function entrar(b, email, nombre, { viewport, dark, lang, sinSesion, base: otra } = {}) {
  const base = otra || BASE();
  const p = await b.newPage({ viewport: viewport || { width: 1440, height: 900 }, colorScheme: dark ? "dark" : "light", deviceScaleFactor: 1, hasTouch: !!(viewport && viewport.width < 800), isMobile: !!(viewport && viewport.width < 800) });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  p.on("console", m => { if(m.type() === "error" && !/ERR_|Failed to load resource|Failed to fetch/.test(m.text())) errores.push(m.text()); });
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if (u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if (/\/storage\/v1\/object\/sign\//.test(u)) return ruta.fulfill({ contentType: "image/png", body: PNG });
    if (u.includes("/functions/v1/calendario")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ estado: 200, cuerpo: { items: [] } }) });
    if (/googleapis\.com\/calendar\//.test(u)) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ items: [] }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion, lang, dark]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    try { if (lang) localStorage.setItem("ra_lang", lang); if (dark) localStorage.setItem("ra_theme", "dark"); } catch (e) {}
  }, [base, sinSesion ? null : { user: { id: "uuid-" + email, email, user_metadata: { full_name: nombre } } }, lang || "", !!dark]);
  await p.goto(PAGINA);
  await p.waitForTimeout(1200);
  return { p, errores };
}

export const click = async (p, sel) => { try { await p.click(sel, { timeout: 2500 }); return true; } catch (e) { return false; } };
export const tab = async (p, v) => {
  const ok = await p.evaluate(v => { const b = document.querySelector(`nav.tabs button[data-view="${v}"]`); if (b && b.offsetParent) { b.click(); return true; }
    const m = document.querySelector(`.bn-item[data-view="${v}"]`); if (m && m.offsetParent) { m.click(); return true; }
    const mas = document.querySelector('.bn-item[data-action="toggle-more-menu"]'); if (mas) { mas.click(); } return false; }, v);
  if (!ok) { await p.waitForTimeout(250); await p.evaluate(v => { const h = document.querySelector(`.bn-sheet-item[data-view="${v}"]`); h && h.click(); }, v); }
  await p.waitForTimeout(350);
};
export const admin = async (p, view, key) => {
  await p.evaluate(([view, key]) => { const b = document.querySelector(`.admin-menu [data-action="admin-go"][data-view="${view}"]${key ? `[data-key="${key}"]` : ""}`); b && b.click(); }, [view, key || ""]);
  await p.waitForTimeout(400);
};
export const irAdmin = async p => { await click(p, '[data-action="toggle-user-menu"]'); await click(p, '.user-menu [data-action="goto-view"][data-view="admin"]'); await p.waitForTimeout(400); };



// Mide, en el estado actual, todo lo que queda cortado.
export async function revisarRecortes(p, estado){
  await p.keyboard.press("Shift");
  return p.evaluate(async (estado) => {
    const vw = document.documentElement.clientWidth;
    const fallas = [];
    const visible = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const nombre = e => (e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.classList.length ? "." + [...e.classList].slice(0, 2).join(".") : "") + (e.dataset.action ? "[" + e.dataset.action + "]" : "")).slice(0, 70);
    // Los ancestros que recortan, y si es un carrusel a propósito.
    const recortes = e => {
      const out = [];
      for(let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement){
        const cs = getComputedStyle(a);
        if(cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.contain.includes("paint") || cs.clipPath !== "none"){
          // Un carrusel a propósito: se desliza de costado. Las filas de arriba
          // de la semana del Calendario (.cal-grid-row) no tienen barra, pero
          // se mueven junto con la grilla: lo de los días de más allá está
          // corrido, no cortado.
          const carruselX = (/auto|scroll/.test(cs.overflowX) || a.classList.contains("cal-grid-row")) && a.scrollWidth > a.clientWidth + 1;
          const scrollY = /auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1;
          out.push({ a, r: a.getBoundingClientRect(), cs, carruselX, scrollY, bl: parseFloat(cs.borderLeftWidth) || 0, br: parseFloat(cs.borderRightWidth) || 0, bt: parseFloat(cs.borderTopWidth) || 0, bb: parseFloat(cs.borderBottomWidth) || 0 });
          if(carruselX) break;
        }
        if(cs.position === "fixed") break;
      }
      return out;
    };
    const controles = [...document.querySelectorAll("input:not([type=hidden]), select, textarea, button, [role=button], a[href], summary, .scope-chip, .chip")].filter(visible);
    for(const e of controles){
      const r = e.getBoundingClientRect();
      // 1) El control mismo, cortado a lo ancho (por un recorte que no es un carrusel) o fuera de la pantalla.
      for(const c of recortes(e)){
        if(c.carruselX) continue;
        const izq = c.r.left + c.bl, der = c.r.right - c.br;
        if(r.left < izq - 1 || r.right > der + 1){ fallas.push({ tipo: "control cortado a lo ancho", el: nombre(e), por: nombre(c.a), px: Math.round(Math.max(izq - r.left, r.right - der)) }); break; }
      }
      if(document.documentElement.scrollWidth <= vw + 1 && !recortes(e).some(c => c.carruselX) && getComputedStyle(e).position !== "fixed" && (r.right > vw + 1 || r.left < -1)) fallas.push({ tipo: "fuera de la pantalla", el: nombre(e), px: Math.round(Math.max(r.right - vw, -r.left)) });
    }
    // 2) El anillo de foco de cada campo de texto y de cada select.
    const campos = [...document.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea, button, a[href], summary, [tabindex='0']")].filter(visible).filter(e => !e.disabled);
    for(const e of campos){
      const r0 = e.getBoundingClientRect();
      e.focus({ preventScroll: true });
      if(!e.matches(":focus-visible")){ e.blur(); continue; }
      const cs = getComputedStyle(e);
      let ext = 0;
      if(cs.outlineStyle !== "none") ext = Math.max(ext, (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0));
      const bs = cs.boxShadow;
      if(bs && bs !== "none"){ const m = [...bs.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?![^,]*inset)/g)]; m.forEach(x => { ext = Math.max(ext, Math.abs(+x[1]) + (+x[3]) + (+x[4])); }); }
      e.blur();
      if(ext <= 0) continue;
      for(const c of recortes(e)){
        if(c.carruselX) continue;
        const izq = c.r.left + c.bl, der = c.r.right - c.br, arr = c.r.top + c.bt, aba = c.r.bottom - c.bb;
        const cortaX = r0.left - ext < izq - 0.5 || r0.right + ext > der + 0.5;
        // A lo alto solo si el campo entero se ve (si está a medio desplazar, es normal).
        const enteroY = r0.top >= arr && r0.bottom <= aba;
        const cortaY = enteroY && (r0.top - ext < arr - 0.5 || r0.bottom + ext > aba + 0.5);
        if(cortaX || cortaY){ fallas.push({ tipo: "anillo de foco cortado" + (cortaX ? " (costado)" : " (arriba/abajo)"), el: nombre(e), por: nombre(c.a), ext }); break; }
      }
    }
    if(document.documentElement.scrollWidth > vw + 1){
      // Quién la estira: lo que asoma por fuera del contenido (#viewRoot),
      // a la izquierda o a la derecha, sin contar lo fijo ni lo que está
      // dentro de un carrusel. Se nombra lo más chico (las hojas).
      const vr = (document.getElementById("viewRoot") || document.body).getBoundingClientRect();
      const fijo = e => { for(let a = e; a && a !== document.body; a = a.parentElement){ if(getComputedStyle(a).position === "fixed") return true; } return false; };
      const asoman = [...document.querySelectorAll("body *")].filter(e => {
        const r = e.getBoundingClientRect();
        return r.width && (r.left < vr.left - 2 || r.right > vr.right + 2) && !fijo(e) && !e.closest(".skip-link") && !recortes(e).some(c => c.carruselX);
      });
      const hojas = asoman.filter(e => !asoman.some(o => o !== e && e.contains(o)));
      fallas.push({ tipo: "la página entera se corre de costado", px: document.documentElement.scrollWidth - vw,
        el: hojas.slice(0, 3).map(e => nombre(e) + " «" + (e.textContent || "").trim().slice(0, 40) + "»").join(" ; ") });
    }
    return fallas.map(f => ({ estado, ...f }));
  }, estado);
}
// Recorre la app entera: el Inicio, las dos ventanas de cargar, editar
// un evento, responder, los filtros, cada vista del Calendario, Países y
// la ficha de un país, Proyectos, Reportes (y sus filtros y Comparar), cada
// sección de Administración, las fichas y Mis preferencias. En cada
// parada llama a `paso(p, nombre)`: ahí se mide lo que se quiera.
export const cerrar = async p => { for(let i = 0; i < 3; i++){ await p.keyboard.press("Escape"); await p.waitForTimeout(120); } };
export async function recorrerApp(p, paso){
  await paso(p, ("Inicio"));
  for(const [n, sel, sub] of [["Nuevo evento", '#fabMain', '[data-action="new-evento"]'], ["Nueva rutina", '#fabMain', '[data-action="new-rutina"]']]){
    await click(p, sel); await click(p, sub); await p.waitForTimeout(500);
    await paso(p, (n));
    // desplazar el formulario hasta abajo, por si lo de abajo se corta
    await p.evaluate(() => document.querySelectorAll(".modal, .modal-body, [role=dialog]").forEach(m => { m.scrollTop = m.scrollHeight; }));
    await p.waitForTimeout(150); await paso(p, (n + " (abajo)"));
    await cerrar(p);
  }
  if(await click(p, '.post[data-post-id="p1"] [data-action="toggle-post-menu"]')){ await click(p, '.post[data-post-id="p1"] [data-action="edit-post"]'); await p.waitForTimeout(600); await paso(p, ("Editar evento")); await cerrar(p); }
  if(await click(p, '.post[data-post-id="p1"] [data-action="toggle-reply"], .post[data-post-id="p1"] [data-action="toggle-thread"]')){ await p.waitForTimeout(300); await paso(p, ("Responder")); }
  await click(p, '[data-action="toggle-type-filter"]'); await p.waitForTimeout(200); await paso(p, ("Filtro tipos")); await cerrar(p);
  await tab(p, "calendario"); await p.waitForTimeout(400); await paso(p, ("Calendario mes"));
  for(const v of ["semana", "agenda", "anio", "dia"]){
    if(await click(p, '[data-action="toggle-cal-view"]')){ await click(p, `[data-action="cal-subview"][data-key="${v}"]`); await p.waitForTimeout(300); await paso(p, ("Calendario " + v)); }
  }
  if(await click(p, '[data-action="cal-ir-abrir"]')){ await p.waitForTimeout(200); await paso(p, ("Ir a una fecha")); await cerrar(p); }
  await tab(p, "paises"); await p.waitForTimeout(400); await paso(p, ("Países"));
  if(await click(p, '[data-action="drill-country"]')){ await p.waitForTimeout(500); await paso(p, ("Ficha país")); }
  await tab(p, "proyectos"); await p.waitForTimeout(400); await paso(p, ("Proyectos"));
  if(await click(p, '[data-action="project-open"]')){ await p.waitForTimeout(400); await paso(p, ("Proyecto abierto")); await cerrar(p); }
  await tab(p, "reportes"); await p.waitForTimeout(500); await paso(p, ("Reportes"));
  if(await click(p, '[data-action="reporte-filtros"]')){ await p.waitForTimeout(200); await paso(p, ("Reportes filtros")); await cerrar(p); }
  if(await click(p, '[data-action="reporte-modo"][data-key="comparar"]')){ await p.waitForTimeout(300); await paso(p, ("Reportes comparar")); }
  await irAdmin(p);
  for(const [v, k] of [["admin"], ["revisarcal"], ["solicitudes", "usuarios"], ["auditoria"], ["preferencias", "tipos"], ["preferencias", "avanzado"], ["preferencias", "zonas"], ["preferencias", "lugares"], ["preferencias", "adjuntos"], ["preferencias", "calendar"], ["preferencias", "copia"], ["preferencias", "correos"]]){
    await p.evaluate(([v, k]) => { const b = document.querySelector(`[data-action="admin-go"][data-view="${v}"]${k ? `[data-key="${k}"]` : ""}`); b && b.click(); }, [v, k || ""]);
    await p.waitForTimeout(350); await paso(p, ("Admin " + (k || v)));
  }
  // Volver a Personas: el recorrido de arriba termina en otra sección, y sin
  // esto la «ficha persona» (hasta el 7/10/2026) era la copia de seguridad.
  const personas = () => p.evaluate(() => { const b = document.querySelector('[data-action="admin-go"][data-view="solicitudes"][data-key="usuarios"]'); b && b.click(); }).then(() => p.waitForTimeout(350));
  await personas();
  await p.evaluate(() => { const b = document.querySelector('.lp-row[data-action="usuario-abrir"]'); b && b.click(); }); await p.waitForTimeout(300); await paso(p, ("Admin ficha persona"));
  await personas();
  await p.evaluate(() => { const b = document.querySelector('[data-action="acceso-section"][data-key="sincuenta"]'); b && b.click(); }); await p.waitForTimeout(300); await paso(p, ("Admin sin cuenta"));
  await p.evaluate(() => { const b = document.querySelector('.lp-row[data-action="persona-abrir"]'); b && b.click(); }); await p.waitForTimeout(300); await paso(p, ("Admin ficha sin cuenta"));
  await p.evaluate(() => { const b = document.querySelector('[data-action="admin-go"][data-view="preferencias"][data-key="tipos"]'); b && b.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('[data-action="tipo-abrir"], .lp-row'); b && b.click(); }); await p.waitForTimeout(300); await paso(p, ("Admin ficha tipo"));
  await p.evaluate(() => { const b = document.querySelector('.user-menu [data-action="goto-view"][data-view="configuracion"], [data-action="goto-view"][data-view="configuracion"]'); b && b.click(); });
  await click(p, '[data-action="toggle-user-menu"]'); await p.evaluate(() => { const b = document.querySelector('.user-menu [data-view="configuracion"]'); b && b.click(); }); await p.waitForTimeout(400); await paso(p, ("Mis preferencias"));
}
