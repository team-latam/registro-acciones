/* ======================================================================
   «Lugares sin actividad»: el correo del primer lunes de cada mes
   (13/10/2026, propuesta 2-A del usuario)
   ======================================================================
   A los administradores les llega la lista de los países donde la última
   actividad HECHA es de hace más que el plazo (3, 6 o 12 meses, se elige
   en Administración → Correos). Corre cada hora junto con los resúmenes
   (workflow «Resúmenes por correo»), con la llave de servicio, y manda como
   mucho uno por persona y por mes:
   - le toca el primer lunes del mes EN SU zona horaria, a partir de SU hora
     (la de sus resúmenes; de fábrica, las 9), y hasta el jueves de esa
     semana, por si GitHub atrasó o falló la corrida del lunes;
   - la marca va primero (avisos_enviados, «lugares», «2026-11»): dos
     corridas que se pisan mandan uno solo; si Resend falla, se borra la
     marca y la corrida de la hora siguiente reintenta;
   - quién puede recibir correos y si apagó el aviso («emailLugares») o
     todos sus correos lo decide la base, con las mismas funciones que usa
     la app (puede_recibir_correos, prefs_de_correo);
   - si no hay ningún país en esa situación, no llega nada.
   La lista sale de los mismos criterios que «Última actividad por país» de
   Reportes: cuenta lo que ya pasó (no lo planificado), con el país o una
   ciudad suya como alcance, y solo los países que alguna vez tuvieron
   actividad. Las series que se repiten se miran con las mismas reglas que
   la app (el código de expandir repeticiones está copiado de index.html y
   una prueba lo compara con el de verdad). El registro de esta corrida es
   público: solo cantidades.
   ====================================================================== */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { correoLugares, idioma } from "../functions/_compartido/correos.mjs";
import { cfg, leerConfiguracion, rest, rpc, mandar, relojDe } from "./resumen.mjs";

export const PLAZOS = [3, 6, 12];
export const PLAZO_DE_FABRICA = 6;
export const DIAS_DE_MARGEN = 3;            // del lunes al jueves

/* ---------- Fechas (todo en UTC, como la app) ---------- */
const isoDate = iso => new Date(`${iso}T12:00:00Z`);
const masDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const diaSemana = iso => isoDate(iso).getUTCDay();            // 0 = domingo
function masMeses(iso, n){
  const d = isoDate(iso), dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}
const entreDias = (a, b) => Math.round((isoDate(b) - isoDate(a)) / 86400000);
const entreMeses = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

/* ---------- Repeticiones: lo mismo que parseRecurrence y expandRecurrence de la app ---------- */
const RRULE_DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const RRULE_MAX_STEPS = 4000;
const fechaDeRrule = s => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(s || "").trim()); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

export function leerRepeticion(lineas){
  if(!Array.isArray(lineas) || !lineas.length) return null;
  let regla = null;
  const exdates = [];
  for(const cruda of lineas){
    const linea = String(cruda || "").trim();
    if(/^RRULE[:;]/i.test(linea)){
      const partes = {};
      linea.replace(/^RRULE:/i, "").split(";").forEach(kv => { const [k, v] = kv.split("="); if(k && v) partes[k.toUpperCase().trim()] = v.trim(); });
      const freq = String(partes.FREQ || "").toUpperCase();
      if(!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
      if(partes.BYSETPOS || partes.BYMONTHDAY || partes.BYMONTH || partes.BYYEARDAY || partes.BYWEEKNO) return null;
      const interval = Math.max(1, Math.min(999, Number(partes.INTERVAL || 1) || 1));
      const dias = String(partes.BYDAY || "").split(",").map(d => d.trim().toUpperCase()).filter(Boolean);
      if(dias.some(d => !(d in RRULE_DOW))) return null;
      regla = { freq, interval, byDay: dias.map(d => RRULE_DOW[d]), count: partes.COUNT ? Number(partes.COUNT) : null, until: partes.UNTIL ? fechaDeRrule(partes.UNTIL) : null };
    }else if(/^EXDATE/i.test(linea)){
      linea.slice(linea.indexOf(":") + 1).split(",").forEach(v => { const iso = fechaDeRrule(v); if(iso) exdates.push(iso); });
    }
  }
  return regla ? { regla, exdates } : null;
}

// Las fechas de la serie entre `desde` y `hasta`, sin las salteadas.
export function expandirRepeticion(inicio, lineas, desde, hasta){
  const leida = leerRepeticion(lineas);
  if(!leida) return null;
  const { freq, interval, byDay, count, until } = leida.regla;
  const saltear = new Set(leida.exdates);
  const salida = [];
  let emitidas = 0;
  const sumar = iso => { if(iso > hasta) return false; if(iso >= desde && !saltear.has(iso)) salida.push(iso); return true; };
  const enesima = n => freq === "DAILY" ? masDias(inicio, n * interval) : freq === "WEEKLY" ? masDias(inicio, n * 7 * interval)
    : freq === "MONTHLY" ? masMeses(inicio, n * interval) : masMeses(inicio, n * 12 * interval);
  if(freq === "WEEKLY" && byDay.length){
    const dias = byDay.slice().sort((a, b) => a - b);
    const primeraSemana = masDias(inicio, -diaSemana(inicio));
    let w = 0;
    if(!count && desde > primeraSemana) w = Math.max(0, Math.floor(entreDias(primeraSemana, desde) / (7 * interval)));
    for(let i = 0; i < RRULE_MAX_STEPS; i++, w++){
      const semana = masDias(primeraSemana, w * 7 * interval);
      if(semana > hasta) break;
      for(const d of dias){
        const iso = masDias(semana, d);
        if(iso < inicio) continue;
        if(until && iso > until) return salida;
        if(count && emitidas >= count) return salida;
        emitidas++;
        if(!sumar(iso)) return salida;
      }
    }
    return salida;
  }
  let n = 0;
  if(!count && desde > inicio){
    const crudo = freq === "DAILY" ? entreDias(inicio, desde) / interval : freq === "WEEKLY" ? entreDias(inicio, desde) / (7 * interval)
      : freq === "MONTHLY" ? entreMeses(inicio, desde) / interval : entreMeses(inicio, desde) / (12 * interval);
    n = Math.max(0, Math.floor(crudo));
  }
  for(let i = 0; i < RRULE_MAX_STEPS; i++, n++){
    const iso = enesima(n);
    if(until && iso > until) break;
    if(count && emitidas >= count) break;
    emitidas++;
    if(!sumar(iso)) break;
  }
  return salida;
}

// La última vez que fue un posteo, hasta `hoy`: la de su inicio si no se
// repite (o si la repetición no se sabe expandir, como en la app), y la
// última fecha de la serie si se repite. "" si todavía no fue. Salteadas: las de
// Google (recurrence_skip) y las EXDATE; las excepciones sueltas y las
// corridas de fecha no se miran (la tarjeta de cada una cuenta aparte).
export const DIAS_DE_SERIE = 3700;
export function ultimaVez(post, hoy){
  const inicio = String(post.start_date || post.date || "");
  if(!inicio) return "";
  const lineas = Array.isArray(post.recurrence) ? post.recurrence : null;
  if(lineas && lineas.length){
    const todas = expandirRepeticion(inicio, lineas, masDias(hoy, -DIAS_DE_SERIE), hoy);
    if(todas){
      const saltear = new Set(Array.isArray(post.recurrence_skip) ? post.recurrence_skip : []);
      const fechas = todas.filter(f => !saltear.has(f));
      return fechas.length ? fechas.reduce((a, b) => a > b ? a : b, "") : "";
    }
  }
  return inicio <= hoy ? inicio : "";
}

/* ---------- Los países, desde index.html (los mismos que usa la app) ---------- */
function literal(app, nombre){
  const m = new RegExp(`\\nconst ${nombre} = ([\\[{][\\s\\S]*?\\n[\\]}]);`).exec(app);
  if(!m) throw new Error(`No encontré ${nombre} en index.html.`);
  return new Function(`return (${m[1]});`)();
}
export function paisesDeLaApp(app = readFileSync(new URL("../../index.html", import.meta.url), "utf8")){
  const nombres = new Set(literal(app, "COUNTRIES").map(c => c.name));
  return { nombres, etiquetas: literal(app, "DEFAULT_COUNTRY_LABELS") };
}

/* ---------- Qué lugares están sin actividad ---------- */
// posts: filas de `posts` con start_date, recurrence, recurrence_skip, cancelled, scopes.
// Devuelve [{ pais, ultima, hace (meses enteros), plan }], los de hace más tiempo primero.
export function lugaresSinActividad(posts, { hoy, meses, paises }){
  const limite = masMeses(hoy, -meses);
  const ultima = new Map(), plan = new Map();
  for(const p of posts){
    if(p.cancelled) continue;
    const alcances = new Set((Array.isArray(p.scopes) ? p.scopes : [])
      .filter(sc => sc && typeof sc.country === "string" && paises.has(sc.country) && (sc.type === "pais" || sc.type === "ciudad")).map(sc => sc.country));
    if(!alcances.size) continue;
    const fecha = ultimaVez(p, hoy);
    const inicio = String(p.start_date || p.date || "");
    for(const n of alcances){
      if(fecha && (!ultima.has(n) || ultima.get(n) < fecha)) ultima.set(n, fecha);
      if(inicio > hoy && (!plan.has(n) || plan.get(n) > inicio)) plan.set(n, inicio);
    }
  }
  return [...ultima].filter(([, f]) => f < limite).sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
    .map(([pais, f]) => ({ pais, ultima: f, hace: Math.max(0, Math.floor(entreDias(f, hoy) / 30.44)), plan: plan.get(pais) || "" }));
}

/* ---------- Cuándo le toca a alguien ---------- */
// reloj: el de SU zona ({ fecha, hora, dia (1 = lunes) }). Devuelve el mes
// («2026-11») si hoy está entre el primer lunes y su jueves, y ya pasó SU hora
// el primer día; si no, null.
export function mesQueLeToca(reloj, hora){
  const dom = Number(reloj.fecha.slice(8, 10));
  // El día de la semana del 1 del mes (0 = lunes) y, de ahí, el primer lunes.
  const del1 = (((reloj.dia - 1) - (dom - 1)) % 7 + 7) % 7;
  const lunes = 1 + ((7 - del1) % 7);
  if(dom < lunes || dom > lunes + DIAS_DE_MARGEN) return null;
  if(dom === lunes && reloj.hora < hora) return null;
  return reloj.fecha.slice(0, 7);
}

// El plazo y si está prendido para todos, de lo que guardó el admin
// (app_config 'preferences' → correos.lugares): lo que no tenga la forma, vale lo de fábrica.
export function configDeLugares(valor){
  const l = valor && valor.correos && valor.correos.lugares;
  return { on: !(l && l.on === false), meses: l && PLAZOS.includes(l.meses) ? l.meses : PLAZO_DE_FABRICA };
}

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const filas = await rest("app_config?select=value&key=eq.preferences");
  const { on, meses } = configDeLugares(Array.isArray(filas) && filas[0] ? filas[0].value : null);
  if(!on){ console.log("El aviso de lugares sin actividad está apagado en Administración → Correos."); return { enviados: 0, fallados: 0, saltados: 0 }; }
  const miembros = await rest("members?select=email&role=eq.admin");
  const admins = [...new Set([cfg.admin, ...miembros.map(m => String(m.email).toLowerCase())])].filter(Boolean);

  // A quién le toca ahora.
  const tocan = [];
  let saltados = 0;
  for(const email of admins){
    try{
      if(!(await rpc("puede_recibir_correos", { p_email: email }))){ saltados++; continue; }
      const pr = await rpc("prefs_de_correo", { p_email: email });
      if(!pr || !pr.on || pr.lugares === false){ saltados++; continue; }
      const mes = mesQueLeToca(relojDe(ahora, pr.tz), pr.hour);
      if(mes) tocan.push({ email, pr, mes });
    }catch(err){ console.error(`  ✗ ${err.message}`); saltados++; }
  }
  if(!tocan.length){ console.log(`Ningún admin está en su primer lunes del mes. Saltados: ${saltados}.`); return { enviados: 0, fallados: 0, saltados }; }

  const paises = paisesDeLaApp();
  const posts = await rest("posts?select=id,start_date,date,recurrence,recurrence_skip,cancelled,scopes&cancelled=eq.false");
  let enviados = 0, fallados = 0, sinNada = 0;
  for(const { email, pr, mes } of tocan){
    try{
      // La marca primero: si dos corridas se pisan, solo una la consigue.
      const hecha = await rest("avisos_enviados", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ tipo: "lugares", objeto: mes, email, autor: null }) });
      if(!Array.isArray(hecha) || !hecha.length) continue;
      // «Hoy» es el de SU zona (en Israel ya puede ser otro día).
      const hoy = relojDe(ahora, pr.tz).fecha;
      const lang = idioma(pr.lang);
      const lugares = lugaresSinActividad(posts, { hoy, meses, paises: paises.nombres })
        .map(l => ({ ...l, pais: (paises.etiquetas[l.pais] || {})[lang] || l.pais }));
      if(!lugares.length){ sinNada++; continue; }
      try{ await mandar(email, correoLugares({ lugares, meses, lang })); enviados++; }
      catch(err){
        fallados++; console.error(`  ✗ ${err.message}`);
        await rest(`avisos_enviados?${new URLSearchParams({ tipo: "eq.lugares", objeto: `eq.${mes}`, email: `eq.${email}` })}`, { method: "DELETE" }).catch(() => {});
      }
    }catch(err){ fallados++; console.error(`  ✗ ${err.message}`); }
  }
  console.log(`Admins en su primer lunes: ${tocan.length}. Correos enviados: ${enviados}. Sin lugares para avisar: ${sinNada}. Saltados: ${saltados}. Fallados: ${fallados}.`);
  if(fallados) process.exitCode = 1;
  return { enviados, fallados, saltados };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
