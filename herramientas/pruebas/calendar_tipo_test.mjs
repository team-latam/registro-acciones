import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
import { hacerGrab } from "./grab.mjs";
const grab = hacerGrab(src);

/* ------------------------------------------------------------------
   Qué tipo le toca a un evento que se escribió directo en Google
   Calendar (guessCalendarType / importedTypeAndTitle). Antes entraba
   siempre como «Otro»; ahora se deduce del título y de los posteos que
   ya están. La regla de oro de lo que se prueba: ante la duda, «Otro».

   Los títulos y las personas de acá son inventados: el repo es público.
   La copia del servidor (decidir.mjs) hace lo mismo y la compara con esta
   la prueba diferencial de supabase/sync-calendar/pruebas/.
------------------------------------------------------------------ */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const codigo = ["hasOwn","CALENDAR_SYNC_TYPES","ACTIVITY_TYPES","ACTIVITY_BY_KEY","DEFAULT_ACTIVITY_LABELS",
  "activityLabelVariants","extractTitleFromSummary","CAL_PRIORIDAD","CAL_PALABRAS","CAL_VIDEOLLAMADA","CAL_SETS","CAL_CONECTORES",
  "calWords","calNoParens","calWordIs","calKnowledgeCache","calendarKnowledge","calendarTypeFrom",
  "guessCalendarType","importedTypeAndTitle"].map(grab).join("\n");

function armar(posts){
  return new Function("ctx", `
    const state = ctx.state;
    const currentLang = () => "es";
    ${codigo}
    return { importedTypeAndTitle, guessCalendarType, calendarKnowledge, ACTIVITY_BY_KEY };
  `)({ state:{ posts } });
}
const tipo = (api, titulo, extra) => api.importedTypeAndTitle({ summary:titulo, ...(extra || {}) }).activityType;

// Una pila de posteos de un mismo título (o de títulos distintos) del mismo tipo.
const posteos = (titulos, activityType, extra) => titulos.map((title, i) => ({ id:`${activityType}${i}${title.length}`, title, activityType, ...(extra || {}) }));

/* ---------- Sin nada cargado: solo las palabras ---------- */
{
  const a = armar([]);
  eq("curso", tipo(a, "Curso de Soldadura"), "curso");
  eq("cursos, en plural y con mayúsculas", tipo(a, "CURSOS DE VERANO"), "curso");
  eq("seminario", tipo(a, "Seminario de Liderazgo"), "seminario");
  eq("congreso", tipo(a, "Congreso Anual"), "congreso");
  eq("visita", tipo(a, "Visita a Lima"), "visita");
  eq("un viaje es una visita", tipo(a, "Viaje a Lima"), "visita");
  eq("online es virtual", tipo(a, "Clase de Cocina Online"), "virtual");
  eq("webinar es virtual", tipo(a, "Webinar de prueba"), "virtual");
  eq("en inglés: course", tipo(a, "Basic training course"), "curso");
  eq("en inglés: congress", tipo(a, "Annual Congress"), "congreso");
  eq("en portugués: viagem", tipo(a, "Viagem a Lima"), "visita");
  eq("sin tildes ni mayúsculas: Capacitación", tipo(a, "CAPACITACIÓN DE GUARDIAS"), "curso");
  eq("en hebreo: seminario", tipo(a, "סמינר מדריכים"), "seminario");
  eq("en hebreo: «en el seminario» (la ב se pega)", tipo(a, "בסמינר מדריכים"), "seminario");
  eq("en hebreo: curso", tipo(a, "קורס מדריכים"), "curso");
  eq("con dos palabras de tipos distintos gana la más específica", tipo(a, "Seminario online de cocina"), "seminario");
  eq("«cursor» no es «curso»", tipo(a, "Mover el cursor"), "otro");
  eq("lo que va entre paréntesis no cuenta", tipo(a, "Salida del grupo (curso de prueba)"), "otro");
  eq("ni lo que va entre corchetes", tipo(a, "Salida del grupo [seminario]"), "otro");
  eq("una reunión sin nada aprendido queda en «Otro»", tipo(a, "Reunión con Ana"), "otro");
  eq("una reunión de seminario es una reunión, no un seminario", tipo(a, "Reunión de seminario"), "otro");
  eq("las cosas de la vida de cada día son «Otro», con o sin palabra de tipo", tipo(a, "Cena del curso"), "otro");
  eq("un título sin ninguna pista queda en «Otro»", tipo(a, "Taglit"), "otro");
  eq("un título vacío, también", tipo(a, ""), "otro");
  eq("un lugar sin nada cargado no se reconoce todavía", tipo(a, "Mendoza"), "otro");
}

/* ---------- Lo que ya dice el evento manda sobre lo deducido ---------- */
{
  const a = armar(posteos(["Reunión uno","Reunión dos","Reunión tres","Reunión cuatro","Reunión cinco"], "virtual"));
  eq("la marca de la app gana", a.importedTypeAndTitle({ summary:"Seminario de Liderazgo", extendedProperties:{ private:{ raActivityType:"curso" } } }).activityType, "curso");
  eq("el prefijo «Tipo: » gana y se saca del título",
    a.importedTypeAndTitle({ summary:"Curso: Reunión de padres" }), { activityType:"curso", title:"Reunión de padres" });
  eq("«Actividad: » se saca y el resto se deduce",
    a.importedTypeAndTitle({ summary:"Actividad: Congreso Anual" }), { activityType:"congreso", title:"Congreso Anual" });
  eq("el título queda tal cual lo escribieron",
    a.importedTypeAndTitle({ summary:"visita a LIMA" }), { activityType:"visita", title:"visita a LIMA" });
}

/* ---------- Las reuniones: lo que el equipo les puso ---------- */
{
  const seis = posteos(["Reunión con Ana","Reunión con Beto","Reunión de equipo","Reunión semanal","Reunión de cierre","Reunión de planes"], "virtual");
  eq("la mayoría de las reuniones cargadas son Virtual → esta también",
    tipo(armar([...seis, ...posteos(["Reunión en persona"], "otro")]), "Reunión con Marta"), "virtual");
  eq("cinco reuniones alcanzan", tipo(armar(seis.slice(0, 5)), "Reunión con Marta"), "virtual");
  eq("cuatro todavía no", tipo(armar(seis.slice(0, 4)), "Reunión con Marta"), "otro");
  eq("si las reuniones están mitad y mitad, no se arriesga",
    tipo(armar([...seis.slice(0, 3), ...posteos(["Reunión x","Reunión y","Reunión z"], "otro")]), "Reunión con Marta"), "otro");
  eq("si lo que más tienen es «Otro», «Otro»",
    tipo(armar([...seis.slice(0, 2), ...posteos(["Reunión x","Reunión y","Reunión z","Reunión w"], "otro")]), "Reunión con Marta"), "otro");
  eq("«Meeting» y «reunião» cuentan como reunión (otro idioma, mismo equipo)",
    tipo(armar(seis), "Weekly meeting"), "virtual");
  eq("pero una cena sigue siendo «Otro» aunque las reuniones sean Virtual", tipo(armar(seis), "Cena con Ana"), "otro");
  eq("y «Reunión de seminario» es reunión → Virtual, no seminario", tipo(armar(seis), "Reunión de seminario"), "virtual");
  eq("lo que llama a una reunión se ve aunque esté en hebreo", tipo(armar(seis), "פגישה שבועית"), "virtual");
}

/* ---------- Palabras que casi siempre van con un tipo ---------- */
{
  const zk = ["ZK Anual - Lima","ZK Anual - Quito","Repaso ZK","ZK especial"];
  eq("una sigla que siempre va con Curso (4 posteos)", tipo(armar(posteos(zk, "curso")), "ZK - Bogotá"), "curso");
  eq("con 3 posteos alcanza", tipo(armar(posteos(zk.slice(0, 3), "curso")), "ZK - Bogotá"), "curso");
  eq("con 2 todavía no", tipo(armar(posteos(zk.slice(0, 2), "curso")), "ZK - Bogotá"), "otro");
  eq("si la sigla también aparece en otro tipo (3 de 4 = 75 %), no alcanza",
    tipo(armar([...posteos(zk.slice(0, 3), "curso"), ...posteos(["ZK paseo"], "visita")]), "ZK - Bogotá"), "otro");
  eq("si aparece 17 veces de 20 (85 %), sí",
    tipo(armar([...posteos(Array.from({ length:17 }, (_, i) => `ZK clase ${i}`), "curso"), ...posteos(["ZK a","ZK b","ZK c"], "visita")]), "ZK - Bogotá"), "curso");
  eq("las mayúsculas y las tildes no importan", tipo(armar(posteos(zk, "curso")), "zk – bogotá"), "curso");
  eq("la sigla de una reunión no le enseña nada al resto (es Otro por la reunión)",
    tipo(armar(posteos(["Reunión QZ uno","Reunión QZ dos","Reunión QZ tres","Reunión QZ cuatro"], "otro")), "QZ"), "otro");
  eq("los posteos de Rutina no enseñan", tipo(armar(posteos(zk, "rutina")), "ZK - Bogotá"), "otro");
  eq("ni los de un tipo que creó el admin", tipo(armar(posteos(zk, "capacitacion")), "ZK - Bogotá"), "otro");
  const dos = [...posteos(zk, "curso"), ...posteos(["QY uno","QY dos","QY tres"], "visita")];
  eq("dos siglas de tipos distintos: gana la que tiene el doble de apoyo o más",
    tipo(armar(dos), "ZK QY"), "otro");
  eq("…y si una duplica a la otra, gana", tipo(armar([...posteos(zk, "curso"), ...posteos(["QY uno","QY dos"], "visita")]), "ZK QY"), "curso");
  eq("una palabra que dice el tipo gana sobre las aprendidas", tipo(armar(dos), "Seminario QY"), "seminario");
}

/* ---------- Un título que ya está ---------- */
{
  eq("el mismo título que un posteo ya cargado", tipo(armar(posteos(["Tertulia de los jueves"], "seminario")), "Tertulia de los jueves"), "seminario");
  eq("sin importar mayúsculas, tildes ni paréntesis",
    tipo(armar(posteos(["Tertulia de los jueves (Ana)"], "seminario")), "TERTULIA de los jueves"), "seminario");
  eq("si el mismo título tiene dos tipos a partes iguales, no se sabe",
    tipo(armar([...posteos(["Tertulia"], "seminario"), ...posteos(["Tertulia"], "visita")].map((p, i) => ({ ...p, id:"t" + i }))), "Tertulia"), "otro");
  eq("si 3 de 4 son del mismo tipo, sí",
    tipo(armar(posteos(["Tertulia","Tertulia","Tertulia"], "seminario").concat(posteos(["Tertulia"], "visita")).map((p, i) => ({ ...p, id:"u" + i }))), "Tertulia"), "seminario");
  eq("un título igual que es «Otro» queda «Otro» aunque diga «curso»",
    tipo(armar(posteos(["Ponerse al día con el curso"], "otro")), "Ponerse al día con el curso"), "otro");
  eq("el mismo título gana sobre las palabras: «Cena de curso» era Visita",
    tipo(armar(posteos(["Cena de curso"], "visita")), "Cena de curso"), "visita");
}

/* ---------- Un título que es solo un lugar ---------- */
{
  const lugares = [{ id:"l1", title:"Algo", activityType:"visita",
    scopes:[{ type:"pais", country:"Chile" }, { type:"ciudad", country:"Argentina", city:"Salta" }, { type:"ciudad", country:"Perú", city:"Cuzco" }],
    participants:[{ name:"Pedro Gómez" }, { name:"Marta" }] }];
  const a = armar(lugares);
  eq("un país", tipo(a, "Chile"), "visita");
  eq("una ciudad", tipo(a, "Salta"), "visita");
  eq("sin tildes ni mayúsculas", tipo(a, "PERU"), "visita");
  eq("varios lugares", tipo(a, "Chile y Salta"), "visita");
  eq("lugares con coma", tipo(a, "Cuzco, Chile"), "visita");
  eq("un lugar y una persona", tipo(a, "Pedro en Salta"), "visita");
  eq("las personas entre paréntesis no cuentan", tipo(a, "Salta (Beto y Ana)"), "visita");
  eq("con un guion", tipo(a, "Salta - Pedro"), "visita");
  eq("con un emoji", tipo(a, "🦆 Salta 🦆"), "visita");
  eq("una palabra que no es lugar ni persona lo frena", tipo(a, "Kilo Salta"), "otro");
  eq("un lugar que no conocemos lo frena", tipo(a, "Salta y Jujuy"), "otro");
  eq("un título largo no es solo un lugar", tipo(a, "Salta Salta Salta Chile Chile Chile Chile"), "otro");
  eq("una reunión en un lugar no es una visita", tipo(a, "Reunión en Salta"), "otro");
  eq("la palabra que dice el tipo gana sobre el lugar", tipo(a, "Seminario Salta"), "seminario");
  eq("solo personas, sin lugar, no es una visita", tipo(a, "Pedro y Marta"), "otro");
  eq("la ubicación en texto libre de los posteos no se usa para reconocer lugares",
    tipo(armar([{ id:"l2", title:"Otro", activityType:"visita", location:"https://zoom.us/j/123 Hotel Central" }]), "Hotel Central"), "otro");
}

/* ---------- Un enlace de videollamada ---------- */
{
  const a = armar([{ id:"l1", title:"Algo", activityType:"visita", scopes:[{ type:"pais", country:"Chile" }] }]);
  const con = (titulo, ev) => a.importedTypeAndTitle({ summary:titulo, ...ev }).activityType;
  eq("un enlace de Zoom en el lugar → Virtual", con("Presentación de resultados", { location:"https://us06web.zoom.us/j/89794409714?pwd=abc" }), "virtual");
  eq("uno de Meet en la descripción", con("Presentación de resultados", { description:"Para entrar: https://meet.google.com/abc-defg-hij" }), "virtual");
  eq("uno de Teams", con("Presentación de resultados", { description:"https://teams.microsoft.com/l/meetup-join/123" }), "virtual");
  eq("uno de Webex", con("Presentación de resultados", { location:"https://latam.webex.com/meet/sala" }), "virtual");
  eq("sin enlace, el mismo título es «Otro»", con("Presentación de resultados", {}), "otro");
  eq("la palabra «zoom» en la descripción no alcanza (tiene que ser un enlace)", con("Presentación de resultados", { description:"Hacemos un zoom por la tarde" }), "otro");
  eq("la palabra que dice el tipo gana sobre el enlace", con("Curso de Soldadura", { location:"https://us06web.zoom.us/j/1" }), "curso");
  eq("un título que es un lugar, con enlace, es Virtual", con("Chile", { location:"https://us06web.zoom.us/j/1" }), "virtual");
  eq("y sin enlace, Visita", con("Chile", {}), "visita");
  eq("una cena con enlace sigue siendo «Otro»", con("Cena de fin de año", { location:"https://us06web.zoom.us/j/1" }), "otro");
  eq("el enlace de un tipo archivado no se asigna", (() => { const b = armar([]); b.ACTIVITY_BY_KEY.virtual.archived = true;
    return b.importedTypeAndTitle({ summary:"Presentación", location:"https://us06web.zoom.us/j/1" }).activityType; })(), "otro");
}

/* ---------- Un tipo que el admin archivó o borró no se asigna ---------- */
{
  const a = armar([]);
  a.ACTIVITY_BY_KEY.curso.archived = true;
  eq("archivado: «Curso de Soldadura» queda en «Otro»", tipo(a, "Curso de Soldadura"), "otro");
  eq("los demás siguen", tipo(a, "Seminario de Liderazgo"), "seminario");
  const b = armar([]);
  delete b.ACTIVITY_BY_KEY.congreso;
  eq("borrado: tampoco", tipo(b, "Congreso Anual"), "otro");
}

/* ---------- La lista de posteos cambia: lo aprendido se rehace ---------- */
{
  const zk = posteos(["ZK Anual - Lima","ZK Anual - Quito","Repaso ZK"], "curso");
  const estado = { posts: [] };
  const api = new Function("ctx", `
    const state = ctx.state; const currentLang = () => "es";
    ${codigo}
    return { importedTypeAndTitle };
  `)({ state: estado });
  eq("antes de que haya posteos", api.importedTypeAndTitle({ summary:"ZK - Bogotá" }).activityType, "otro");
  estado.posts = zk;
  eq("la lista se reemplazó: ahora lo sabe", api.importedTypeAndTitle({ summary:"ZK - Bogotá" }).activityType, "curso");
  estado.posts = zk.concat(posteos(["ZK paseo uno","ZK paseo dos","ZK paseo tres","ZK paseo cuatro"], "visita"));
  eq("y si cambia de nuevo, también", api.importedTypeAndTitle({ summary:"ZK - Bogotá" }).activityType, "otro");
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
