/* Datos de DEMOSTRACIÓN para el video: gente, lugares y eventos inventados (nada de la base real).
   Se usan con el Supabase de mentira de pruebas/app_de_mentira.mjs. Fecha fija: 12/10/2026, mediodía. */
import { BASE, post, ciudad, pais } from "../pruebas/app_de_mentira.mjs";

export const HOY = new Date("2026-10-12T12:00:00");
const dmas = n => { const d = new Date(HOY.getTime() + n * 86400000); return d.toISOString().slice(0, 10); };
const stamp = (n, h = 10) => new Date(HOY.getTime() + n * 86400000 - (12 - h) * 3600000).toISOString();

export const YO = "daniel.rosen@team-demo.org";
export const EQUIPO = [
  { email: YO, name: "Daniel Rosen", nickname: "daniel", role: "member" },
  { email: "sofia.alvarez@team-demo.org", name: "Sofía Alvarez", nickname: "sofia", role: "member" },
  { email: "lucas.ferreira@team-demo.org", name: "Lucas Ferreira", nickname: "lucas", role: "member" },
  { email: "camila.torres@team-demo.org", name: "Camila Torres", nickname: "camila", role: "member" },
  { email: "noah.weiss@team-demo.org", name: "Noah Weiss", nickname: "noah", role: "member" },
  { email: "rachel.stern@team-demo.org", name: "Rachel Stern", nickname: "rachel", role: "admin" },
];
const P = i => ({ email: EQUIPO[i].email, name: EQUIPO[i].name });

// Lugares (con el nombre como lo guarda la app: el de la lista de ciudades)
const L = {
  ba: ["Argentina", "Buenos Aires (CABA)"], cor: ["Argentina", "Cordoba"], bar: ["Argentina", "Bariloche"],
  scl: ["Chile", "Santiago"], vlp: ["Chile", "Valparaíso"], mvd: ["Uruguay", "Montevideo"], lim: ["Perú", "Lima"],
  bog: ["Colombia", "Bogota"], med: ["Colombia", "Medellin"], cdmx: ["México", "Ciudad de México"], gdl: ["México", "Guadalajara"],
  sp: ["Brasil", "Sao Paulo"], rio: ["Brasil", "Rio De Janeiro"], poa: ["Brasil", "Porto Alegre"], pty: ["Panamá", "Ciudad de Panamá"],
};
const nombreLugar = {
  "Buenos Aires (CABA)": "Buenos Aires", Cordoba: "Córdoba", Bogota: "Bogotá", Medellin: "Medellín", "Sao Paulo": "São Paulo",
  "Rio De Janeiro": "Rio de Janeiro", "Ciudad de México": "Mexico City", "Ciudad de Panamá": "Panama City", Lima: "Lima",
};
const bonito = c => nombreLugar[c] || c;

// Un generador repetible (siempre sale lo mismo)
let semilla = 20261012;
const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };
const elegir = a => a[Math.floor(azar() * a.length)];

const PLANTILLAS = {
  visita: c => elegir([`Community visit – ${c}`, `Site visit – ${c}`, `Leadership meeting – ${c}`, `Visit to the ${c} community`]),
  curso: c => elegir([`Team Leader course – ${c}`, `First aid workshop – ${c}`, `Volunteer training – ${c}`]),
  seminario: c => elegir([`Regional safety seminar – ${c}`, `Educators seminar – ${c}`]),
  virtual: c => elegir([`Planning call with ${c}`, `Follow-up call – ${c}`, `Board meeting with ${c}`]),
  congreso: c => `Annual congress – ${c}`,
};
const TEXTOS = [
  "Great turnout and a very good conversation with the local board. Next steps agreed.",
  "Walked through the facilities and met the new volunteers. Everyone is motivated.",
  "Full day of sessions. Photos and the attendance list are attached.",
  "Productive follow-up. We agreed on a calendar for the next three months.",
  "Excellent energy in the room. The community asked for a second edition.",
];
// Cuántas actividades hubo en cada mes (la tendencia sube, así el gráfico cuenta algo)
const POR_MES = { "2025-01": 2, "2025-02": 3, "2025-03": 4, "2025-04": 4, "2025-05": 5, "2025-06": 5, "2025-07": 4, "2025-08": 6, "2025-09": 6, "2025-10": 6, "2025-11": 4, "2025-12": 3, "2026-01": 5, "2026-02": 6, "2026-03": 8, "2026-04": 9, "2026-05": 10, "2026-06": 11, "2026-07": 10, "2026-08": 12, "2026-09": 14 };
const TIPOS_PESO = ["visita", "visita", "visita", "curso", "curso", "virtual", "virtual", "seminario", "congreso"];

const posts = [];
let n = 0;
for (const [mes, cuantos] of Object.entries(POR_MES)) {
  const [y, m] = mes.split("-").map(Number);
  const diasMes = new Date(y, m, 0).getDate();
  for (let i = 0; i < cuantos; i++) {
    const tipo = elegir(TIPOS_PESO), lugar = elegir(Object.values(L)), dia = 1 + Math.floor(azar() * (diasMes - 3));
    const ini = `${mes}-${String(dia).padStart(2, "0")}`, fin = tipo === "visita" || tipo === "congreso" || tipo === "seminario" ? `${mes}-${String(dia + Math.floor(azar() * 3)).padStart(2, "0")}` : ini;
    n++;
    const id = "d" + n, a = Math.floor(azar() * 5);
    posts.push(post({ id, title: PLANTILLAS[tipo](bonito(lugar[1])), start: ini, end: fin, a: 0, type: tipo, scopes: [ciudad(lugar[0], lugar[1])],
      content: elegir(TEXTOS), created: ini + "T14:00:00.000Z",
      extra: { author_name: EQUIPO[a].name, author_email: EQUIPO[a].email, start_time: "09:00:00", end_time: "17:00:00",
        images: (tipo === "visita" || tipo === "curso") && azar() < 0.45 ? [`posts/${id}/img0_1.jpg`] : [],
        participants: [P((a + 1) % 5), P((a + 2) % 5)].slice(0, 1 + Math.floor(azar() * 2)), liked_by: azar() < .5 ? [EQUIPO[(a + 1) % 5].email] : [] } }));
  }
}
// Octubre: lo que ya pasó y lo que viene (así el Inicio separa «Lo que pasó» y «Próximos»)
const oct = [
  ["o1", -1, -1, "visita", L.sp, "Community visit – São Paulo", 1, "Met three institutions in one day. The team is already planning a follow-up for December.", ["posts/o1/img0_1.jpg", "posts/o1/img1_2.jpg"]],
  ["o2", -3, -3, "curso", L.bog, "Team Leader course – Bogotá", 2, "Twenty-two participants completed the course. Certificates sent today.", ["posts/o2/img0_1.jpg"]],
  ["o3", -6, -5, "seminario", L.scl, "Regional safety seminar – Santiago", 3, "Two days of sessions with leaders from five countries.", ["posts/o3/img0_1.jpg"]],
  ["o4", -9, -9, "virtual", L.lim, "Planning call with Lima", 0, "Agreed the schedule for the first quarter.", []],
  ["o5", 4, 4, "virtual", L.mvd, "Follow-up call – Montevideo", 1, "", []],
  ["o6", 9, 11, "curso", L.med, "First aid workshop – Medellín", 2, "Registration is open. 14 places left.", []],
  ["o7", 16, 18, "seminario", L.pty, "Educators seminar – Panama City", 0, "Speakers confirmed. Venue booked.", []],
  ["o8", 24, 24, "visita", L.cdmx, "Community visit – Mexico City", 3, "", []],
];
for (const [id, d1, d2, tipo, lugar, titulo, a, texto, imgs] of oct) {
  posts.push(post({ id, title: titulo, start: dmas(d1), end: dmas(d2), a: 0, type: tipo, scopes: [ciudad(lugar[0], lugar[1])], content: texto, created: stamp(Math.min(d1, -1) - 1),
    extra: { author_name: EQUIPO[a].name, author_email: EQUIPO[a].email, start_time: "09:00:00", end_time: "17:00:00", images: imgs,
      participants: [P((a + 1) % 5), P((a + 3) % 5)], liked_by: d1 < 0 ? [EQUIPO[(a + 1) % 5].email, EQUIPO[(a + 2) % 5].email] : [], calendar_event_id: "gc_" + id } }));
}
// Rutinas de la semana
const rutinas = [
  ["r1", 0, 5, "Weekly team check-in", "Reviewed the October agenda. @daniel prepares the Lima call, @sofia takes the Montevideo follow-up and @lucas the Panama seminar.", [YO, "sofia.alvarez@team-demo.org", "lucas.ferreira@team-demo.org"], []],
  ["r2", -1, 2, "Call with the Córdoba board", "40-minute call. They asked for a visit in November.", [], [ciudad(...L.cor)]],
  ["r3", -2, 3, "Volunteers orientation", "Welcome session for the nine new volunteers.", [], []],
];
for (const [id, d, a, titulo, texto, ment, sc] of rutinas)
  posts.push(post({ id, title: titulo, start: dmas(d), end: dmas(d), a: 0, type: "rutina", scopes: sc, content: texto, created: stamp(d, 9),
    extra: { author_name: EQUIPO[a].name, author_email: EQUIPO[a].email, mentions: ment, liked_by: [EQUIPO[(a + 1) % 5].email] } }));

// Un posteo escrito en español (como se escribe en el equipo), para mostrar la traducción
export const ES_TEXTO = "Hoy terminamos el curso de primeros auxilios en Medellín. ¡Participaron 22 personas y todas aprobaron!";
export const TRADUCCIONES = { [ES_TEXTO]: "היום סיימנו את קורס העזרה הראשונה במדיין. השתתפו 22 אנשים וכולם עברו!" };
posts.push(post({ id: "rs1", title: "Curso de primeros auxilios", start: dmas(0), end: dmas(0), a: 0, type: "rutina", scopes: [ciudad(...L.med)], content: ES_TEXTO, created: stamp(0, 11),
  extra: { author_name: EQUIPO[1].name, author_email: EQUIPO[1].email, liked_by: [EQUIPO[3].email] } }));
// Proyectos
const hito = (id, label, d, done, owners = []) => ({ id, label, date: dmas(d), done, owners });
posts.push(
  post({ id: "pj1", title: "Community safety program", start: dmas(-70), end: dmas(60), a: 0, type: "otro", scopes: [pais("Argentina"), pais("Chile"), pais("Uruguay")],
    content: "Camera and access-control upgrades for partner institutions across the Southern Cone.", created: stamp(-70),
    extra: { author_name: EQUIPO[1].name, author_email: EQUIPO[1].email, is_project: true, project_status: "open",
      milestones: [hito("m1", "Budget approved", -50, true), hito("m2", "Equipment purchase", -12, true, [EQUIPO[2].email]), hito("m3", "First installations", 14, false, [EQUIPO[1].email]), hito("m4", "Final review", 55, false)] } }),
  post({ id: "pj2", title: "Leadership scholarship 2026", start: dmas(-150), end: dmas(90), a: 0, type: "curso", scopes: [{ type: "todo" }],
    content: "Scholarships for the next generation of Team Leaders.", created: stamp(-150),
    extra: { author_name: EQUIPO[3].name, author_email: EQUIPO[3].email, is_project: true, project_status: "open",
      milestones: [hito("m5", "Call for applications", -120, true), hito("m6", "Selection", -60, true), hito("m7", "First cohort starts", 20, false, [EQUIPO[3].email]), hito("m8", "Mid-year report", 80, false)] } }),
  post({ id: "pj3", title: "Regional training hub", start: dmas(-30), end: dmas(150), a: 0, type: "seminario", scopes: [ciudad(...L.bog)],
    content: "A permanent training space in Bogotá.", created: stamp(-30),
    extra: { author_name: EQUIPO[4].name, author_email: EQUIPO[4].email, is_project: true, project_status: "open",
      milestones: [hito("m9", "Site chosen", -10, true), hito("m10", "Agreement signed", 30, false), hito("m11", "Opening", 140, false)] } }),
);

const REPLIES = [
  { id: "rp1", post_id: "o1", content: "Great news — can you share the photos with the board?", author_name: EQUIPO[1].name, author_email: EQUIPO[1].email, created_at: stamp(-1, 15) },
  { id: "rp2", post_id: "o1", content: "Done! They are in the post now.", author_name: EQUIPO[1 + 0].name, author_email: EQUIPO[1].email, created_at: stamp(-1, 16), parent_id: "rp1" },
  { id: "rp4", post_id: "o4", content: "Thanks Daniel! The notes are in the shared folder.", author_name: EQUIPO[1].name, author_email: EQUIPO[1].email, created_at: stamp(-1, 10) },
  { id: "rp3", post_id: "o2", content: "Congratulations to the whole team on a full house.", author_name: EQUIPO[4].name, author_email: EQUIPO[4].email, created_at: stamp(-2, 11), liked_by: [YO] },
].map(r => ({ scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [], system: false, ...r }));

export function baseDemo() {
  const b = BASE();
  b.members = EQUIPO.map((p, i) => ({ ...p, approved_at: "2025-01-10T12:00:00Z", calendar_shared: i < 4, last_seen_at: stamp(-i, 9) }));
  b.posts = posts; b.replies = REPLIES;
  b.access_requests = []; b.audit_log = [];
  // La Agenda: gente e instituciones inventadas, con teléfonos de mentira (el prefijo 555 no existe en la vida real).
  const per = (id, name, tel, wa, idiomas, email, note) => ({ id, name, email: email || null, note: note || null, telefonos: tel ? [{ n: tel, wa }] : [], idiomas, lista: null, created_by: YO, created_at: stamp(-20) });
  b.personas = [
    per("pe_marcos", "Marcos Oliveira", "+55 11 5555 0142", true, ["pt", "es"]),
    per("pe_valentina", "Valentina Rojas", "+56 9 5555 0188", true, ["es", "en"], "vrojas@example.org", "Best reached in the mornings"),
    per("pe_ana", "Ana Beltrán", "+54 9 341 555 0123", true, ["es"]),
    per("pe_diego", "Diego Salazar", "+57 1 555 0177", false, ["es", "en"], "dsalazar@example.org"),
    per("pe_camila", "Camila Quintero", "+51 1 555 0199", true, ["es"]),
    per("pe_rafael", "Rafael Duarte", "+55 21 5555 0166", true, ["pt", "en"]),
    per("pe_lucia", "Lucía Montes", "+598 2 555 0133", true, ["es"]),
    per("pe_tomas", "Tomás Herrera", "+52 55 5555 0155", true, ["es", "en"], null, "Speaks English and Spanish"),
    per("pe_elena", "Elena Vargas", "+507 555 0144", true, ["es", "en"]),
    per("pe_joaquin", "Joaquín Pérez", "+54 11 5555 0111", false, ["es"]),
  ];
  b.agenda_listas = [];
  const ins = (id, name, c, city, dir, tipo, estado = "activa", nota = null) => ({ id, name, country: c, city, address: dir, tipo, estado, nota, lista: null, created_by: YO, created_at: stamp(-20) });
  b.instituciones = [
    ins("i_ros", "Rosario Community Center", "Argentina", "Rosario", "Av. Pellegrini 1200", "Community Center"),
    ins("i_ba", "Buenos Aires Youth Center", "Argentina", "Buenos Aires (CABA)", "Calle Tucumán 800", "Youth Center"),
    ins("i_bar", "Bariloche Seasonal Center", "Argentina", "Bariloche", "Calle del Lago 9", "Community Center", "temporada", "Open from December to March"),
    ins("i_sp", "São Paulo Community Center", "Brasil", "Sao Paulo", "Rua das Flores 120", "Community Center"),
    ins("i_rio", "Rio Learning Hub", "Brasil", "Rio De Janeiro", "Av. Atlântica 400", "Training Hub"),
    ins("i_scl", "Santiago North Institute", "Chile", "Santiago", "Av. Providencia 2200", "Youth Center"),
    ins("i_bog", "Bogotá Training Hub", "Colombia", "Bogota", "Carrera 7 #71-21", "Training Hub"),
    ins("i_lim", "Lima Cultural Center", "Perú", "Lima", "Av. Larco 1301", "Community Center"),
    ins("i_cdmx", "Mexico City Community House", "México", "Ciudad de México", "Av. Reforma 250", "Community Center"),
    ins("i_mvd", "Montevideo Education Center", "Uruguay", "Montevideo", "Rambla 100", "Education Center"),
    ins("i_pty", "Panama Regional Center", "Panamá", "Ciudad de Panamá", "Calle 50", "Training Hub"),
  ];
  const con = (id, institucion, persona, cargo, orden = 0) => ({ id, institucion, persona, cargo, orden, created_at: stamp(-20) });
  b.contactos = [
    con("c_ros1", "i_ros", "pe_ana", "Director"), con("c_ros2", "i_ros", "pe_joaquin", "Treasurer", 1),
    con("c_ba", "i_ba", "pe_joaquin", "Coordinator"), con("c_bar", "i_bar", "pe_ana", "Season coordinator"),
    con("c_sp", "i_sp", "pe_marcos", "Director"), con("c_rio", "i_rio", "pe_rafael", "Program lead"),
    con("c_scl", "i_scl", "pe_valentina", "Coordinator"), con("c_bog", "i_bog", "pe_diego", "Director"),
    con("c_lim", "i_lim", "pe_camila", "Director"), con("c_cdmx", "i_cdmx", "pe_tomas", "Director"),
    con("c_mvd", "i_mvd", "pe_lucia", "Coordinator"), con("c_pty", "i_pty", "pe_elena", "Regional lead"),
    { id: "c_br", institucion: null, nivel: "pais", country: "Brasil", city: null, zona: null, persona: "pe_rafael", cargo: "Country lead", orden: 0, created_at: stamp(-20) },
  ];
  // Los tipos de actividad: sus documentos, en inglés (los nombres de los tipos los traduce la app sola)
  b.app_config = [{ key: "preferences", value: { activityTypes: [
    { key: "visita", label: "Visita", icon: "🧳", calendarSync: true, docs: [{ id: "plan", label: "Travel plan" }, { id: "reporte", label: "Report" }, { id: "otro", label: "Other", opcional: true }] },
    { key: "curso", label: "Curso", icon: "📘", calendarSync: true, docs: [{ id: "programa", label: "Program" }, { id: "lista", label: "Attendance list" }] },
    { key: "seminario", label: "Seminario", icon: "🎤", calendarSync: true, docs: [{ id: "programa", label: "Program" }] },
    { key: "congreso", label: "Congreso", icon: "🏛️", calendarSync: true, docs: [] },
    { key: "virtual", label: "Virtual", icon: "💻", calendarSync: true, docs: [] },
    { key: "otro", label: "Otro", icon: "✨", calendarSync: true, docs: [] },
  ] } }];
  return b;
}

// Las «fotos»: ilustraciones suaves (un horizonte de ciudad con degradado), distintas según el archivo.
const PALETAS = [["#f6d365", "#fda085", "#7a4e6d"], ["#a1c4fd", "#c2e9fb", "#365b7a"], ["#84fab0", "#8fd3f4", "#2f6d63"], ["#fbc2eb", "#a6c1ee", "#5a4a7a"], ["#ffecd2", "#fcb69f", "#8a4b3a"], ["#cfd9df", "#e2ebf0", "#3c4d63"]];
export function fotoSvg(clave) {
  let h = 0; for (const ch of clave) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b, c] = PALETAS[h % PALETAS.length];
  let edificios = "", x = 0, k = h;
  while (x < 640) { k = (k * 1103515245 + 12345) >>> 0; const w = 30 + (k % 50), alto = 60 + ((k >> 8) % 130); edificios += `<rect x="${x}" y="${420 - alto}" width="${w}" height="${alto}" fill="${c}" opacity="${0.55 + ((k >> 16) % 40) / 100}"/>`; x += w + 4; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="420" fill="url(#g)"/><circle cx="${120 + (h % 300)}" cy="110" r="46" fill="#fff" opacity=".55"/>${edificios}<rect y="400" width="640" height="20" fill="${c}"/></svg>`;
}
