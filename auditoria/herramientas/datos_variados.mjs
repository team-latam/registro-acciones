/* ======================================================================
   El generador de datos variados (lo usa datos.mjs; se puede importar
   para mirar un caso a mano). Con la misma AUDITORIA_SEMILLA, los mismos
   datos: un problema que aparece se puede volver a ver.
   ====================================================================== */
import { BASE, PERS, hace, dia } from "../../pruebas/app_de_mentira.mjs";
export const semilla = Number(process.env.AUDITORIA_SEMILLA || new Date().toISOString().slice(0, 10).replace(/-/g, ""));
export const VOLUMEN = Number(process.env.AUDITORIA_VOLUMEN || 1500);
// Un azar que se puede repetir (mulberry32).
let s = semilla >>> 0;
const azar = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const uno = l => l[Math.floor(azar() * l.length)];
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));

const VENENO = [
  `<img src=x onerror="window.__xss=(window.__xss||0)+1">`,
  `"><svg onload="window.__xss=(window.__xss||0)+1">`,
  `'><script>window.__xss=(window.__xss||0)+1</script>`,
  `<b>negrita</b> &amp; &lt; &quot;comillas&quot;`,
];
const PALABRAS = ["visita", "reunión", "comunidad", "seminario", "Montevideo", "kehilá", "שלום", "תוכנית", "curso", "😀🎉", "plan", "seguridad", "líderes", "Ñandú", "Panamá", "x"];
const texto = (min, max) => Array.from({ length: entre(min, max) }, () => uno(PALABRAS)).join(" ");
const raro = () => uno([
  "", "a", texto(1, 3), texto(15, 25).slice(0, 140), "Superlargapalabrasinespaciosquenoterminanuncayrompelasfilas" + "x".repeat(10),
  "תכנית ביקור בקהילה", "🎉🎉🎉", uno(VENENO), texto(2, 6) + " " + uno(VENENO),
]);
const PAISES = ["Argentina", "Uruguay", "Chile", "Brasil", "México", "Perú", "Colombia", "Panamá", "Costa Rica", "Bolivia"];
const TIPOS = ["visita", "curso", "seminario", "congreso", "virtual", "otro", "rutina"];

export function datos(){
  const base = BASE();
  base.members = base.members.concat([
    { email: "largo@team-latam.com", name: "María de los Ángeles Fernández Goldberg de la Santísima Trinidad", nickname: "mariadelosangeles", role: "member", approved_at: "2025-02-01T12:00:00Z" },
    { email: "veneno@team-latam.com", name: VENENO[0], nickname: "veneno", role: "member", approved_at: "2025-02-01T12:00:00Z" },
  ]);
  base.access_requests.push({ email: "pide@gmail.com", name: VENENO[1], status: "pending", requested_at: hace(0.5) });
  const tipos = base.app_config[0].value.activityTypes;
  tipos.push({ key: "veneno", label: VENENO[0], icon: "🧪", calendarSync: false, docs: [{ id: "d1", label: VENENO[1] }] });
  for(let i = 0; i < VOLUMEN; i++){
    const d = entre(-200, 900), largo = azar() < 0.3 ? entre(0, 12) : 0;
    const pais = uno(PAISES);
    const alcances = [
      () => [{ type: "ciudad", country: pais, city: uno(["Rosario", "Córdoba", raro(), "Ciudad " + uno(VENENO)]) }],
      () => [{ type: "pais", country: pais }],
      () => [{ type: "todo" }],
      () => [{ type: "region", region: uno(["sur", "norte", "central", "zona-borrada"]) }],
      () => [{ type: "barrio" }, null, "texto suelto"],   // forma rara
      () => [],
    ];
    base.posts.push({
      id: "v" + i, date: dia(d), start_date: dia(d), end_date: dia(d - largo),
      activity_type: uno(TIPOS.concat(["veneno", "tipo-que-no-existe"])),
      title: raro(), content: azar() < 0.2 ? "" : texto(0, 80) + (azar() < 0.2 ? "\n\n" + uno(VENENO) : ""),
      author_name: uno(PERS).name, author_email: uno(PERS.map(p => p.email).concat(["nadie@otro.com", "LARGO@TEAM-LATAM.COM"])),
      created_at: hace(Math.max(0, d)), scopes: uno(alcances)(),
      location: azar() < 0.3 ? raro() : "", cancelled: azar() < 0.05,
      start_time: azar() < 0.4 ? uno(["09:00:00", "23:30:00", "00:00:00"]) : null, end_time: null,
      images: [], links: azar() < 0.2 ? [{ url: uno(["https://ejemplo.org/" + "a".repeat(80), "javascript:window.__xss=1"]), title: raro() }] : [],
      files: azar() < 0.15 ? [{ name: raro() + ".pdf", path: `posts/v${i}/a.pdf`, doc: uno(["plan", "reporte", "d1", "que-no-existe"]) }] : [],
      mentions: [], liked_by: azar() < 0.3 ? PERS.slice(0, entre(1, 5)).map(p => p.email) : [],
      milestones: azar() < 0.05 ? [{ id: "h" + i, label: raro(), date: dia(d - 3) }, { id: "h2" + i }, null] : [],
      is_project: azar() < 0.05, editors: [], participants: azar() < 0.3 ? [{ name: raro() }, { email: uno(PERS).email, name: uno(PERS).name }] : [],
      recurrence_skip: [], recurrence_moves: {}, recurrence: azar() < 0.03 ? "RRULE:FREQ=WEEKLY;COUNT=5" : null,
    });
  }
  for(let i = 0; i < Math.min(300, VOLUMEN / 5); i++){
    base.replies.push({ id: "vr" + i, post_id: "v" + entre(0, VOLUMEN - 1), content: raro() + " " + texto(0, 30), author_name: uno(PERS).name,
      author_email: uno(PERS).email, scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [], system: false, created_at: hace(entre(0, 100)) });
  }
  // La Agenda (8/10/2026): instituciones y gente con nombres raros y HTML
  // metido en cada campo. Los teléfonos, con la forma que deja la base
  // (telefonos_ok): solo números, +, espacios, guiones, puntos, paréntesis.
  const nInst = Math.min(400, Math.round(VOLUMEN / 4)), nGente = Math.round(nInst * 0.8);
  for(let i = 0; i < nGente; i++){
    base.personas.push({ id: "vp" + i, name: (raro() || "Nadie").slice(0, 120), email: azar() < 0.2 ? "p" + i + "@ejemplo.org" : null, note: azar() < 0.2 ? raro() : null,
      telefonos: Array.from({ length: entre(0, 3) }, () => ({ n: uno(["+54 9 11 ", "+972-52-", "(598) 99 ", "+1.305."]) + entre(1000000, 9999999), wa: azar() < 0.7 })),
      idiomas: azar() < 0.3 ? ["es", uno(["he", "pt", "en"])] : [], lista: azar() < 0.6 ? "lista1" : null, created_by: uno(PERS).email, created_at: hace(entre(0, 60)),
      tocado_por: azar() < 0.2 ? uno(PERS).email : null, tocado_el: azar() < 0.2 ? hace(entre(0, 30)) : null });
  }
  for(let i = 0; i < nInst; i++){
    base.instituciones.push({ id: "vi" + i, name: (raro() || "Sin nombre").slice(0, 160), country: uno(PAISES.concat(["País " + uno(VENENO)])),
      city: uno(["Rosario", "Córdoba", "Montevideo", raro(), null]), address: azar() < 0.5 ? raro() : null,
      tipo: azar() < 0.8 ? uno(["Centro Comunitario", "Sinagoga", raro().slice(0, 60)]) : null, estado: uno(["activa", "activa", "temporada", "cerrada"]),
      nota: azar() < 0.2 ? raro() : null, lista: azar() < 0.7 ? "lista1" : null, created_by: uno(PERS).email, created_at: hace(entre(0, 60)) });
    const vistos = new Set();
    for(let k = entre(0, 3); k > 0; k--){
      const per = "vp" + entre(0, nGente - 1);
      if(vistos.has(per)) continue; vistos.add(per);
      base.contactos.push({ id: "vc" + i + "_" + k, institucion: "vi" + i, persona: per, cargo: azar() < 0.7 ? raro().slice(0, 60) : null, orden: k, created_at: hace(1) });
    }
  }
  base.agenda_listas.push({ id: "lista2", name: raro() || "Lista", created_by: PERS[0].email, created_at: hace(1) });
  // Gente de un lugar, sin institución (20-contactos-por-lugar.sql): de una
  // ciudad, un país, una región y toda LatAm, con cargos raros.
  const niveles = [["ciudad", { country: "Argentina", city: "Rosario" }], ["pais", { country: "Brasil" }], ["region", { zona: "sur" }], ["latam", {}]];
  for(let i = 0; i < Math.min(12, nGente); i++){
    const [nivel, donde] = niveles[i % niveles.length];
    base.contactos.push({ id: "vl" + i, institucion: null, nivel, country: null, city: null, zona: null, ...donde, persona: "vp" + i, cargo: azar() < 0.7 ? raro().slice(0, 60) : null, orden: i, created_at: hace(1) });
  }
  return base;
}

