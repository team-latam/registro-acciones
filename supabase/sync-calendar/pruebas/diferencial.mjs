/* ======================================================================
   La prueba que hace sostenible tener la lógica de Calendar dos veces.

   Corre LAS DOS implementaciones —applyCalendarEventToPosts() de
   index.html y decidir() de supabase/sync-calendar/decidir.mjs— contra los
   mismos eventos, con el mismo idioma, el mismo reloj y la misma
   configuración, y compara las escrituras que pide cada una.

   Si alguien toca una sola de las dos, esto se cae. Es el único motivo por
   el que la copia del servidor es aceptable.
   ====================================================================== */
import fs from "node:fs";
import { decidir } from "../decidir.mjs";

const src = fs.readFileSync(process.env.INDEX || new URL("../../../index.html", import.meta.url).pathname,"utf8");
function balanceada(txt){
  let d = 0, comilla = null;
  for(let i = 0; i < txt.length; i++){
    const c = txt[i];
    if(comilla){ if(c === "\\"){ i++; continue; } if(c === comilla) comilla = null; continue; }
    if(c === '"' || c === "'" || c === "`"){ comilla = c; continue; }
    if(c === "/" && txt[i+1] === "/") break;
    if("([{".includes(c)) d++;
    else if(")]}".includes(c)) d--;
  }
  return d === 0;
}
function grab(name){
  const m = new RegExp(`\\n(?:function|async function|const|let) ${name}\\s*[=(]`).exec(src);
  if(!m) throw new Error("no se encontró " + name);
  const desde = m.index + m[0].length - 1;
  const finLinea = src.indexOf("\n", desde);
  // Una declaración que empieza y TERMINA en la misma línea se toma
  // entera. Sin esto, buscar el primer { o [ y balancear desde ahí se come
  // el cierre de `new Set([...])` o de `Object.fromEntries(x.map(...))` y
  // devuelve código cortado, que después revienta en otro lado y hace
  // parecer que el problema está en la página. Ya pasó tres veces.
  if(balanceada(src.slice(desde, finLinea + 1))) return src.slice(m.index + 1, finLinea + 1);
  const iLl = src.indexOf("{", desde), iCor = src.indexOf("[", desde);
  const primero = iCor >= 0 && (iLl < 0 || iCor < iLl) ? iCor : iLl;
  if(primero < 0 || primero > finLinea) return src.slice(m.index + 1, finLinea + 1);
  let depth = 0, inStr = null;
  const abre = src[primero], cierra = abre === "[" ? "]" : "}";
  for(let j = primero; j < src.length; j++){
    const c = src[j];
    if(inStr){ if(c === "\\"){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '"' || c === "'" || c === "`"){ inStr = c; continue; }
    if(c === "/" && src[j+1] === "/"){ j = src.indexOf("\n", j); continue; }
    if(c === abre) depth++;
    else if(c === cierra){ depth--; if(depth === 0) return src.slice(m.index + 1, j + 1); }
  }
  throw new Error("no cerró " + name);
}
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   app:      ${x}\n   servidor: ${a}`); } };

const HORA = "HORA_DEL_SERVIDOR";
const codigo = ["addDaysISO","isoDate","isoDow","addMonthsISO","RRULE_MAX_STEPS","RRULE_DOW","isISODate",
  "parseRecurrence","recurrenceLabel","recurrenceMoves","rruleDateToISO","calendarEventDates",
  "originalOccurrenceISO","extractTitleFromSummary","importedTypeAndTitle","summaryMatchesPost",
  "activityLabelVariants","importedPostDocId","createImportedPost","MAX_OCC_MOVES",
  "CALENDAR_SYNC_TYPES","ACTIVITY_TYPES","ACTIVITY_BY_KEY","DEFAULT_ACTIVITY_LABELS",
  "applyCalendarEventToPosts"].map(grab).join("\n");

// La app, con las escrituras interceptadas en vez de hechas.
const laApp = new Function("ctx", `
  "use strict";
  const state = ctx.state, reg = ctx.reg;
  const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g,
    (todo, k) => (vars && k in vars) ? vars[k] : todo);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const fmtDate = d => "<" + String(d).slice(0,10) + ">";
  const store = { horaDelServidor: ()=> "${HORA}",
                  posts: { createOnce: async (id, datos)=>{ reg.push({ tipo:"crear", id, datos }); } } };
  const updatePostDoc = async (id, patch)=>{ reg.push({ tipo:"actualizar", id, patch }); };
  const createReply = async (postId, datos)=>{ reg.push({ tipo:"comentar", postId, datos }); };
  ${codigo}
  return { applyCalendarEventToPosts, ACTIVITY_BY_KEY, ACTIVITY_TYPES,
           DEFAULT_ACTIVITY_LABELS, recurrenceLabel };
`);

const base = laApp({ state:{ posts:[] }, reg:[] });
const TIPOS = { porClave: base.ACTIVITY_BY_KEY, deFabrica: base.DEFAULT_ACTIVITY_LABELS };
const CTX_SERVIDOR = {
  tipos: TIPOS,
  t: (plantilla, vars) => String(plantilla).replace(/\{(\w+)\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo),
  fmtDate: d => "<" + String(d).slice(0,10) + ">",
  hora: ()=> HORA,
  etiquetaDeRepeticion: base.recurrenceLabel,
};

async function comparar(nombre, ev, posts){
  const reg = [];
  const api = laApp({ state:{ posts: JSON.parse(JSON.stringify(posts)) }, reg });
  await api.applyCalendarEventToPosts(ev);
  const delServidor = decidir(ev, JSON.parse(JSON.stringify(posts)), CTX_SERVIDOR);
  eq(nombre, delServidor, reg);
}

/* ---------- Los posteos de prueba ---------- */
const P_SIMPLE = { id:"p1", calendarEventId:"ev1", title:"Reunión", activityType:"visita",
  startDate:"2026-05-10", endDate:"2026-05-10", date:"2026-05-10", startTime:null, endTime:null, location:"" };
const P_SERIE = { id:"p2", calendarEventId:"evSerie", title:"Semanal", activityType:"virtual",
  startDate:"2026-01-05", endDate:"2026-01-05", date:"2026-01-05",
  recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO"], recurrenceSkip:[], recurrenceMoves:{} };
const P_HUERFANO = { id:"p3", title:"Congreso anual", activityType:"congreso",
  startDate:"2026-08-01", endDate:"2026-08-01", date:"2026-08-01" };

const dia = (id, f, extra={}) => ({ id, status:"confirmed", summary:"Reunión",
  start:{ date:f }, end:{ date: (d=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10);})(f) }, ...extra });

/* ---------- Cancelaciones ---------- */
await comparar("cancelado, con posteo vivo",
  { id:"ev1", status:"cancelled" }, [P_SIMPLE]);
await comparar("cancelado, con el posteo ya cancelado",
  { id:"ev1", status:"cancelled" }, [{ ...P_SIMPLE, cancelled:true }]);
await comparar("cancelado, sin posteo ni serie",
  { id:"otro", status:"cancelled" }, [P_SIMPLE]);
await comparar("una fecha de la serie cancelada en Calendar",
  { id:"evSerie_20260112T000000Z", status:"cancelled", recurringEventId:"evSerie" }, [P_SERIE]);
await comparar("la misma, ya salteada",
  { id:"evSerie_20260112T000000Z", status:"cancelled", recurringEventId:"evSerie" },
  [{ ...P_SERIE, recurrenceSkip:["2026-01-12"] }]);
await comparar("una fecha cancelada de una serie que no tiene molde acá",
  { id:"nada_20260112T000000Z", status:"cancelled", recurringEventId:"nada" }, [P_SERIE]);
await comparar("una excepción cancelada sin fecha reconocible en el id",
  { id:"evSerie-raro", status:"cancelled", recurringEventId:"evSerie" }, [P_SERIE]);

/* ---------- Actualizaciones ---------- */
await comparar("nada cambió", dia("ev1","2026-05-10"), [P_SIMPLE]);
await comparar("cambió el título",
  dia("ev1","2026-05-10",{ summary:"Reunión nueva" }), [P_SIMPLE]);
await comparar("cambió la fecha", dia("ev1","2026-05-20"), [P_SIMPLE]);
await comparar("pasó a durar tres días",
  { id:"ev1", status:"confirmed", summary:"Reunión", start:{date:"2026-05-10"}, end:{date:"2026-05-13"} }, [P_SIMPLE]);
await comparar("le pusieron hora",
  { id:"ev1", status:"confirmed", summary:"Reunión",
    start:{dateTime:"2026-05-10T15:00:00-03:00"}, end:{dateTime:"2026-05-10T17:00:00-03:00"} }, [P_SIMPLE]);
await comparar("le pusieron lugar",
  dia("ev1","2026-05-10",{ location:"Lima, Perú" }), [P_SIMPLE]);
await comparar("le sacaron el lugar",
  dia("ev1","2026-05-10"), [{ ...P_SIMPLE, location:"Lima, Perú" }]);
await comparar("el título traía el prefijo del tipo",
  dia("ev1","2026-05-10",{ summary:"Visita: Reunión" }), [P_SIMPLE]);
await comparar("el prefijo en otro idioma también se saca",
  dia("ev1","2026-05-10",{ summary:"Visit: Reunión" }), [P_SIMPLE]);
await comparar("un título más largo que el tope se recorta",
  dia("ev1","2026-05-10",{ summary:"R".repeat(300) }), [P_SIMPLE]);
await comparar("un lugar más largo que el tope, igual",
  dia("ev1","2026-05-10",{ location:"L".repeat(400) }), [P_SIMPLE]);
await comparar("un título vacío NO borra el que había",
  dia("ev1","2026-05-10",{ summary:"" }), [P_SIMPLE]);
await comparar("cambió la regla de repetición",
  dia("evSerie","2026-01-05",{ summary:"Semanal", recurrence:["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"] }),
  [{ ...P_SERIE, recurrenceSkip:["2026-01-19"] }]);
await comparar("dejó de repetirse",
  dia("evSerie","2026-01-05",{ summary:"Semanal" }), [P_SERIE]);
await comparar("empezó a repetirse",
  dia("ev1","2026-05-10",{ recurrence:["RRULE:FREQ=MONTHLY"] }), [P_SIMPLE]);
await comparar("una regla que no sabemos expandir igual se guarda",
  dia("evSerie","2026-01-05",{ summary:"Semanal", recurrence:["RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU"] }), [P_SERIE]);
await comparar("más de diez líneas de repetición se recortan",
  dia("ev1","2026-05-10",{ recurrence: Array.from({length:15},(_,i)=>`EXDATE;VALUE=DATE:2026010${i%9+1}`) }), [P_SIMPLE]);

/* ---------- Fechas corridas ---------- */
await comparar("una fecha de la serie se corrió de día",
  dia("evSerie_20260112T000000Z","2026-01-14",{ summary:"Semanal", recurringEventId:"evSerie" }), [P_SERIE]);
await comparar("y vuelve a su día de siempre",
  dia("evSerie_20260112T000000Z","2026-01-12",{ summary:"Semanal", recurringEventId:"evSerie" }),
  [{ ...P_SERIE, recurrenceMoves:{ "2026-01-12":"2026-01-14" } }]);
await comparar("ya está donde dice Calendar",
  dia("evSerie_20260112T000000Z","2026-01-14",{ summary:"Semanal", recurringEventId:"evSerie" }),
  [{ ...P_SERIE, recurrenceMoves:{ "2026-01-12":"2026-01-14" } }]);
{
  const muchas = {};
  for(let i=1;i<=60;i++) muchas[`2026-0${(i%9)+1}-${String(i%28+1).padStart(2,"0")}`] = "2026-12-01";
  await comparar("pasado el tope de fechas corridas, no se agrega otra",
    dia("evSerie_20260112T000000Z","2026-01-14",{ summary:"Semanal", recurringEventId:"evSerie" }),
    [{ ...P_SERIE, recurrenceMoves: muchas }]);
}
await comparar("una excepción cuyo molde no está: sigue de largo",
  dia("nada_20260112T000000Z","2026-01-14",{ summary:"Otra", recurringEventId:"nada" }), [P_SERIE]);

/* ---------- Vínculos perdidos ---------- */
await comparar("se reencuentra por el id que la app le pegó al evento",
  dia("evNuevo","2026-08-01",{ summary:"Cualquier cosa",
    extendedProperties:{ private:{ raPostId:"p3" } } }), [P_HUERFANO]);
await comparar("se reencuentra por título + fecha + tipo",
  dia("evNuevo","2026-08-01",{ summary:"Congreso anual" }), [P_HUERFANO]);
await comparar("y con el prefijo del tipo adelante, también",
  dia("evNuevo","2026-08-01",{ summary:"Congreso: Congreso anual" }), [P_HUERFANO]);
await comparar("un posteo cancelado no se reencuentra",
  dia("evNuevo","2026-08-01",{ summary:"Congreso anual" }), [{ ...P_HUERFANO, cancelled:true }]);
await comparar("ni uno cuya fecha no coincide",
  dia("evNuevo","2026-08-05",{ summary:"Congreso anual" }), [P_HUERFANO]);
await comparar("ni uno de un tipo que no sincroniza",
  dia("evNuevo","2026-08-01",{ summary:"Congreso anual" }),
  [{ ...P_HUERFANO, activityType:"rutina" }]);

/* ---------- Eventos nuevos ---------- */
await comparar("uno nuevo de todo el día", dia("evX","2026-09-01",{ summary:"Charla abierta" }), []);
await comparar("uno nuevo con hora",
  { id:"evY", status:"confirmed", summary:"Charla",
    start:{dateTime:"2026-09-01T10:00:00-03:00"}, end:{dateTime:"2026-09-01T12:00:00-03:00"} }, []);
await comparar("uno nuevo con el tipo pegado por la app",
  dia("evZ","2026-09-01",{ summary:"Curso: Kashrut",
    extendedProperties:{ private:{ raActivityType:"curso" } } }), []);
await comparar("uno nuevo cuyo título dice el tipo",
  dia("evW","2026-09-01",{ summary:"Seminario: Talmud" }), []);
await comparar("uno nuevo con el fallback genérico adelante",
  dia("evV","2026-09-01",{ summary:"Actividad: Algo" }), []);
await comparar("uno nuevo sin título", dia("evU","2026-09-01",{ summary:"" }), []);
await comparar("uno nuevo con descripción, lugar y organizador",
  dia("evT","2026-09-01",{ summary:"Visita: Córdoba", description:"D".repeat(6000),
    location:"Córdoba", organizer:{ displayName:"Ana", email:"ana@x.com" } }), []);
await comparar("uno nuevo con organizador sin nombre",
  dia("evS","2026-09-01",{ organizer:{ email:"sin-nombre@x.com" } }), []);
await comparar("uno nuevo que se repite",
  dia("evR","2026-09-07",{ summary:"Reunión", recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO"] }), []);
await comparar("uno nuevo con un id lleno de caracteres raros",
  dia("ev/con:cosas@raras#y-mucho-texto-de-mas-para-pasarse-del-largo-permitido","2026-09-01"), []);
await comparar("uno sin fecha de inicio no hace nada",
  { id:"evSinFecha", status:"confirmed", summary:"Sin fecha" }, []);
await comparar("un tipo raro pegado por la app se ignora y queda 'otro'",
  dia("evQ","2026-09-01",{ summary:"Cosa", extendedProperties:{ private:{ raActivityType:"inventado" } } }), []);
await comparar("una excepción de una serie desconocida nace como posteo propio",
  dia("desconocida_20260112T000000Z","2026-01-14",{ summary:"Suelta", recurringEventId:"desconocida" }), []);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
