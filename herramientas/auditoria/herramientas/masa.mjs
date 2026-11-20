/* ======================================================================
   Masa crítica: lo que solo se nota con poca o con mucha gente

   Quien arma el sistema lo usa con datos de a poco y siempre solo: así no
   se ven las cosas que dependen de CUÁNTOS son y de que haya OTROS. Esto
   las mide, con la app de mentira (nunca la base de verdad):

   1. Tres escalas — un equipo recién creado (nada cargado), uno chico
      (3 personas, 9 actividades) y uno grande (45 personas, 3.000
      actividades): errores de página, texto roto, página corrida de costado.
   2. Poco volumen — con ~24 actividades puestas al AZAR (sin ninguna
      tendencia real), ¿«Tendencias» igual muestra que algo «subió» o «se
      apagó»? Y en Reportes, ¿«Sugerencias» manda a planificar meses de antes
      de que el equipo usara el sistema?
   3. Varias personas — dos que editan el mismo evento (¿se pisan?), el
      registro de actividad lleno (¿«Nunca entró» para alguien que entró?).
   4. Uso en el celular — el botón «Atrás», un texto a medio escribir
      cuando se recarga la página, buscar algo que se habló en un hilo.

   No aprueba ni desaprueba: devuelve hallazgos para verificar (ver
   METODO.md). Con AUDITORIA_RAPIDO=1 se saltea la escala grande.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, hace, dia, tab, click, irAdmin } from "../../pruebas/app_de_mentira.mjs";
import { hallazgo, entregar } from "./comun.mjs";

const out = [];
const RAPIDO = process.env.AUDITORIA_RAPIDO === "1" || process.env.RAPIDO === "1";
// Un azar que se repite (mulberry32), con la semilla que se le pase.
const azarCon = semilla => { let s = semilla >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const VACIO = { images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {} };
const miembro = (email, name, nickname, role = "member") => ({ email, name, nickname, role, approved_at: "2025-01-10T12:00:00Z", calendar_shared: true, last_seen_at: hace(3) });
const sinGastos = b => { for(const k of Object.keys(b)) if(k === "gastos" || k.startsWith("gastos_")) b[k] = []; return b; };
const post = (id, type, title, d, autor, scopes, extra = {}) => ({ id, date: dia(d), start_date: dia(d), end_date: dia(d), activity_type: type, title, content: "", author_name: autor.name, author_email: autor.email, created_at: hace(Math.max(0, d)), scopes, ...VACIO, ...extra });
const ciudad = (country, city) => ({ type: "ciudad", country, city });

function equipoVacio(){
  const b = BASE();
  b.members = [miembro(ADMIN, "Benny Rosenthal", "benny", "admin")];
  for(const k of ["posts", "replies", "access_requests", "audit_log", "personas", "instituciones", "contactos", "agenda_listas", "user_prefs", "former_members"]) b[k] = [];
  return sinGastos(b);
}
function equipoChico(){
  const b = equipoVacio();
  b.members.push(miembro("ana@team-latam.com", "Ana Pérez", "ana"), miembro("diego@team-latam.com", "Diego Martínez", "diego"));
  const L = [["rutina", "Rutina de la semana", 1, 0, []], ["rutina", "Llamado con Rosario", 3, 1, [ciudad("Argentina", "Rosario")]], ["visita", "Visita a Montevideo", 9, 0, [ciudad("Uruguay", "Montevideo")]],
    ["curso", "Curso de líderes", -6, 2, [ciudad("Argentina", "Córdoba")]], ["virtual", "Reunión virtual", 20, 2, [{ type: "todo" }]], ["visita", "Visita a Santiago", 14, 0, [ciudad("Chile", "Santiago")]],
    ["visita", "Visita a Lima", 27, 0, [ciudad("Perú", "Lima")]]];
  L.forEach(([type, title, d, a, scopes], i) => b.posts.push(post("c" + i, type, title, d, b.members[a], scopes)));
  return b;
}
const LUGARES = [["Argentina", "Buenos Aires"], ["Argentina", "Buenos Aires"], ["Argentina", "Rosario"], ["Uruguay", "Montevideo"], ["Uruguay", "Montevideo"], ["Brasil", "São Paulo"], ["Chile", "Santiago"], ["México", "Ciudad de México"], ["Perú", "Lima"], ["Panamá", "Ciudad de Panamá"]];
const TIPOS = ["visita", "visita", "curso", "seminario", "virtual", "otro", "rutina", "rutina"];
// n actividades en los últimos 180 días, puestas al azar: por construcción no hay NINGUNA tendencia.
function equipoAlAzar(n, semilla){
  const azar = azarCon(semilla), uno = l => l[Math.floor(azar() * l.length)];
  const b = equipoChico(); b.posts = [];
  for(let i = 0; i < n; i++){ const [pais, c] = uno(LUGARES), type = uno(TIPOS); b.posts.push(post("t" + i, type, type === "rutina" ? "Rutina " + i : `${type} en ${c}`, Math.floor(azar() * 180) + 1, b.members[1], [ciudad(pais, c)])); }
  return b;
}
function equipoGrande(miembros = 45, posts = 3000){
  const azar = azarCon(99), uno = l => l[Math.floor(azar() * l.length)], entre = (a, z) => a + Math.floor(azar() * (z - a + 1));
  const b = equipoVacio(), usados = new Set(["benny"]);
  const NOM = ["Ana", "Diego", "Lucía", "Moshe", "Daniel", "Sara", "Yosef", "Débora", "Martín", "Valeria", "Ariel", "Noa"], APE = ["Pérez", "Martínez", "Fernández", "Levi", "Goldberg", "Cohen", "Silva", "Gómez"];
  for(let i = 1; i < miembros; i++){ const n = uno(NOM); let nick = n.toLowerCase().normalize("NFD").replace(/[^a-z]/g, ""), k = 1; const base = nick; while(usados.has(nick)) nick = base + (++k); usados.add(nick);
    b.members.push(miembro(`${nick}@team-latam.com`, `${n} ${uno(APE)}`, nick, i % 9 === 0 ? "observer" : "member")); }
  const autores = b.members.filter(m => m.role !== "observer");
  for(let i = 0; i < posts; i++){ const [pais, c] = uno(LUGARES), type = uno(TIPOS), a = uno(autores);
    b.posts.push(post("g" + i, type, type === "rutina" ? "Rutina " + i : `${type} en ${c} ${i}`, entre(-120, 1000), a, [azar() < 0.1 ? { type: "todo" } : ciudad(pais, c)], { content: "Notas de la actividad en " + c + "." })); }
  for(let i = 0; i < posts * 0.8; i++){ const a = uno(autores); b.replies.push({ id: "gr" + i, post_id: "g" + entre(0, posts - 1), content: "Respuesta " + i, author_name: a.name, author_email: a.email, scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [], system: false, created_at: hace(entre(0, 200)) }); }
  for(let i = 0; i < 12; i++) b.access_requests.push({ email: `pide${i}@gmail.com`, name: `Pide ${i}`, status: "pending", requested_at: hace(i) });
  return b;
}

const b = await abrirNavegador();
const BASURA = /\bNaN\b|Infinity|\bundefined\b|\[object|\{[a-z]+\}|\+∞|NaN%/;

/* ---------- 1. Tres escalas ---------- */
const ESCALAS = [["equipo recién creado", equipoVacio], ["equipo chico (3 personas, 7 actividades)", equipoChico]];
if(!RAPIDO) ESCALAS.push(["equipo grande (45 personas, 3.000 actividades)", () => equipoGrande()]);
for(const [nombre, armar] of ESCALAS){
  for(const [vp, tam] of [[{ width: 1440, height: 900 }, "compu"], [{ width: 390, height: 844 }, "celular"]]){
    const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base: armar() });
    await p.waitForTimeout(500);
    const rotos = new Set(), corridas = new Set();
    for(const v of ["feed", "paises", "calendario", "proyectos", "reportes", "gastos"]){
      await tab(p, v); await p.waitForTimeout(250);
      const r = await p.evaluate(() => { const x = document.getElementById("viewRoot") || document.body; return { txt: x.innerText, corrida: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
      const m = BASURA.exec(r.txt); if(m) rotos.add(`${v}: «${r.txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, " ")}»`);
      if(r.corrida) corridas.add(v);
    }
    rotos.forEach(x => out.push(hallazgo("datos", "medio", "En pantalla sale texto roto", `${nombre} · ${tam}`, x)));
    corridas.forEach(v => out.push(hallazgo("diseño", "medio", "La página se corre de costado", `${nombre} · ${tam}`, v)));
    [...new Set(errores)].slice(0, 5).forEach(e => out.push(hallazgo("errores", "importante", "Error en la página", `${nombre} · ${tam}`, e)));
    await p.close();
  }
}

/* ---------- 2. Poco volumen ---------- */
{ // 2a. «Tendencias» con actividades puestas al azar.
  const N = 24, SEMILLAS = 12; let con = 0, ejemplo = "";
  for(let s = 1; s <= SEMILLAS; s++){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: equipoAlAzar(N, s * 977 + N) });
    await p.waitForTimeout(250);
    const txt = await p.evaluate(() => { const e = [...document.querySelectorAll("aside")].map(x => x.innerText).join("\n"); const i = e.indexOf("TENDENCIAS"); const j = e.indexOf("ACCESOS DIRECTOS"); return i < 0 ? "" : e.slice(i, j < 0 ? i + 500 : j); });
    if(txt){ con++; if(!ejemplo) ejemplo = txt.replace(/\s+/g, " ").replace(/\s*↗\s*/g, " ").slice(0, 150); }
    await p.close();
  }
  if(con >= SEMILLAS / 2) out.push(hallazgo("datos", "medio", "«Tendencias» muestra cambios aunque no haya ninguna (puro azar)", `${N} actividades al azar en 180 días`, `aparece en ${con} de ${SEMILLAS} equipos; ej.: ${ejemplo}`));
  // 2b. «Sugerencias» de Reportes en un equipo que empezó hace poco.
  const base = equipoChico();
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await p.waitForTimeout(400); await tab(p, "reportes"); await p.waitForTimeout(400);
  const txt = await p.evaluate(() => (document.getElementById("viewRoot") || document.body).innerText);
  const m = /No hubo actividad en ([^:]+): conviene planificar/.exec(txt);
  const primero = Math.min(...base.posts.map(x => Number(x.start_date.slice(5, 7))));
  if(m && /enero/i.test(m[1]) && primero > 1) out.push(hallazgo("uso", "medio", "Reportes manda a planificar meses de antes de que el equipo empezara a cargar", "Reportes › Sugerencias", `«No hubo actividad en ${m[1]}…» (la primera actividad es de ${dia(0).slice(0, 4)}-${String(primero).padStart(2, "0")})`));
  await p.close();
}

/* ---------- 3. Varias personas ---------- */
{ // 3a. A abre «Editar»; B cambia la fecha, el lugar y suma un archivo; A corrige el título y guarda.
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  await p.waitForTimeout(400);
  const fila = () => p.evaluate(() => { const r = window.__sb.tablas.posts.find(x => x.id === "p6"); return { start: r.start_date, lugar: r.location || null, archivos: (r.files || []).length }; });
  const antes = await fila();
  await click(p, '.post[data-post-id="p6"] [data-action="toggle-post-menu"]'); await click(p, '.post[data-post-id="p6"] [data-action="edit-post"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { const r = window.__sb.tablas.posts.find(x => x.id === "p6"); const d = new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10);
    r.start_date = d; r.end_date = d; r.date = d; r.location = "Hotel Ibis, Av. Paulista 100"; r.files = r.files.concat([{ path: "posts/p6/otro.docx", name: "Otro.docx", doc: "reporte", uploaded_at: new Date().toISOString() }]); });
  const deB = await fila();
  await p.fill("#cTitle", "Visita a San Pablo (corregido)"); await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(1000);
  const final = await fila();
  const perdio = [];
  if(final.start !== deB.start) perdio.push("la fecha");
  if(final.lugar !== deB.lugar) perdio.push("el lugar");
  if(final.archivos < deB.archivos) perdio.push("el archivo que subió");
  if(perdio.length) out.push(hallazgo("errores", "importante", "Dos personas editando el mismo evento: la última pisa los cambios de la otra, sin avisar", "editar un evento (parcheDeEdicion)", `A solo cambió el título y se perdió lo de B: ${perdio.join(", ")} (el formulario guarda todos los campos con lo que tenía al abrirse)`));
  void antes; await p.close();
}
{ // 3b. El registro de actividad lleno: ¿«Nunca entró» para alguien que entró hace 12 días?
  const base = BASE(); base.audit_log = [{ id: "a-ana", type: "login", actor_email: "ana@team-latam.com", actor_name: "Ana Pérez", created_at: hace(12) }];
  for(let i = 0; i < 1500; i++) base.audit_log.push({ id: "e" + i, type: i % 3 ? "post_edited" : "login", actor_email: "diego@team-latam.com", actor_name: "Diego Martínez", created_at: hace((i % 1000) / 90), details: { title: "algo" } });
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base });
  await p.waitForTimeout(500); await irAdmin(p);
  await p.evaluate(() => { const x = document.querySelector('[data-action="admin-go"][data-view="solicitudes"][data-key="usuarios"]'); x && x.click(); }); await p.waitForTimeout(400);
  const fila = await p.evaluate(() => { const r = [...document.querySelectorAll(".lp-row")].find(x => /ana@team-latam/.test(x.innerText)); return r ? r.innerText.replace(/\s+/g, " ") : ""; });
  if(/Nunca entr/i.test(fila)) out.push(hallazgo("errores", "medio", "Administración › Personas dice «Nunca entró» de alguien que entró hace 12 días (el registro de actividad que se carga es solo el de las últimas 1.000 acciones)", "renderUsuariosSection / lastLoginByEmail", "con 1.500 acciones más nuevas que su entrada"));
  await p.close();
}

/* ---------- 4. Uso en el celular ---------- */
{ // 4a. «Atrás»
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(400); await p.evaluate(() => { window.__adentro = true; });
  await tab(p, "paises"); await p.evaluate(() => { const x = document.querySelector('[data-action="drill-country"]'); x && x.click(); }); await p.waitForTimeout(400);
  await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500);
  const sigue = await p.evaluate(() => !!window.__adentro).catch(() => false);
  if(!sigue) out.push(hallazgo("uso", "medio", "El botón «Atrás» del celular saca de la app (la app no usa el historial del navegador)", "navegación", "de la ficha de un país, «Atrás» deja la página en vez de volver a Países"));
  await p.close();
}
{ // 4b. Un texto a medio escribir cuando se recarga la página
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(400); await p.fill("#rutinaContent", "Llamado largo con la comisión: quedaron en mandar el presupuesto el lunes");
  await p.reload(); await p.waitForTimeout(1200);
  const quedo = await p.evaluate(() => (document.querySelector("#rutinaContent") || {}).value || "");
  if(!quedo) out.push(hallazgo("uso", "medio", "Un texto a medio escribir se pierde al recargar la página (en el celular, el navegador recarga solo al volver de otra app)", "composer de rutina, evento y respuestas", "no hay borrador guardado"));
  await p.close();
}
{ // 4c. Buscar algo que se habló en un hilo, o que dice el resumen de un Cierre
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  await p.waitForTimeout(500);
  for(const [q, donde] of [["portón", "una respuesta del hilo"], ["motivado", "el resumen de un Cierre"], ["Presupuesto aprobado", "un hito de un proyecto"]]){
    await p.fill("#globalSearch input", ""); await p.fill("#globalSearch input", q); await p.waitForTimeout(400);
    const sin = await p.evaluate(() => /Sin resultados/i.test(document.getElementById("globalResults")?.innerText || ""));
    if(sin) out.push(hallazgo("uso", "medio", `El buscador no encuentra lo que dice ${donde}`, "matchesTextFilter", `buscar «${q}» da «Sin resultados»`));
  }
  await p.close();
}
/* ---------- 6. El celular con un dedo (toque simulado, no clic de mouse) ---------- */
{ // 6a. Nuevo evento: título, lugar y «Publicar». Con un campo de texto con el foco, ¿el primer toque en Publicar llega?
  for(const alto of [844, 661]){
    const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: alto } });
    await p.waitForTimeout(400);
    await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(400);
    await p.fill("#cTitle", "Visita a Salta"); await p.fill("#cPlaceQuery", "Salta"); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('[data-action="pick-place"]').click()); await p.waitForTimeout(300);
    await p.focus("#cPlaceQuery"); await p.waitForTimeout(300);
    const c = await p.evaluate(() => { const r = document.querySelector('#postForm button[type="submit"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(1200);
    const publicado = await p.evaluate(() => window.__sb.tablas.posts.some(x => /Salta/.test(x.title)));
    if(!publicado) out.push(hallazgo("uso", "importante", "En el celular el primer toque en «Publicar» (Nuevo evento) no hace nada: el botón se corre cuando el campo pierde el foco", `390×${alto}`, "con un toque simulado; el botón sube entre 29 y 46 px al soltar el foco y el toque cae en otra parte (T10 del 28/10, hoy en cualquier alto)"));
    await p.close();
  }
}
{ // 6b. Tamaño de los controles en el Inicio del celular: WCAG 2.2 pide 24×24 como mínimo (y 44 es lo recomendado).
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(500);
  const chicos = await p.evaluate(() => {
    const m = new Map();
    for(const e of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, [role=button], [data-action]')){
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      if(!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || e.closest("[hidden]") || e.classList.contains("skip-link")) continue;
      if(e.tagName === "DIV" && e.querySelector("button, a, input")) continue;
      if(Math.min(r.width, r.height) >= 24) continue;
      const k = (e.dataset.action || e.className || e.tagName).toString().slice(0, 30), o = m.get(k) || { n: 0, w: Math.round(r.width), h: Math.round(r.height) }; o.n++; m.set(k, o);
    }
    return [...m.entries()].sort((a, z) => z[1].n - a[1].n).map(([k, v]) => `${k} ${v.w}×${v.h} (×${v.n})`);
  });
  if(chicos.length) out.push(hallazgo("accesibilidad", "medio", `Controles de menos de 24×24 px en el Inicio del celular: ${chicos.length} tipos`, "Inicio · 390px", chicos.slice(0, 5).join("; ")));
  await p.close();
}

/* ---------- 5. Títulos largos de verdad (no palabras de 60 letras: un título como los del equipo) ---------- */
{ // Un evento con un título de ~80 letras en los próximos 30 días: ¿la columna del costado del Inicio sigue de 276 px, o estira y aprieta el Feed?
  const base = BASE();
  base.posts.push({ id: "largo", date: dia(-5), start_date: dia(-5), end_date: dia(-5), activity_type: "visita", title: "Visita a la comunidad judía de Ciudad de México y Cuernavaca con las comisiones", content: "", author_name: "Benny Rosenthal", author_email: ADMIN, created_at: hace(1), scopes: [ciudad("México", "Ciudad de México")], ...VACIO });
  for(const ancho of [1024, 1440]){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 800 }, base });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => { const s = document.querySelector(".feed-side"), m = document.querySelector(".feed-main"); return s && m ? { lateral: Math.round(s.getBoundingClientRect().width), feed: Math.round(m.getBoundingClientRect().width) } : null; });
    if(r && r.lateral > 300) out.push(hallazgo("diseño", "importante", "Un título largo en «Próximos eventos» estira la columna del costado y aprieta el Feed", `Inicio · ${ancho}px`, `la columna pasa de 276 a ${r.lateral} px y el Feed queda en ${r.feed} px (.feed-side sin min-width:0 y con texto nowrap)`));
    await p.close();
  }
}
await b.close();
entregar("masa", out);
