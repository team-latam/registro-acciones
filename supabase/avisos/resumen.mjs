/* ======================================================================
   Los resúmenes por correo, diarios y semanales (17-avisos-por-correo.sql)
   ======================================================================
   Corre cada hora (workflow «Resúmenes por correo») con la llave de
   servicio. A cada persona que puede recibir correos y los tiene
   prendidos, le manda su resumen cuando es SU hora (en su zona horaria,
   emailTz; de fábrica, la de Argentina) y SU día si es semanal, en SU
   idioma (emailLang); las dos cosas, decisión del usuario del 7/10/2026: lo que pasó desde el último. Quien eligió «al
   momento» recibe acá lo que no tiene momento (actividades nuevas,
   eventos que empiezan pronto), una vez por día, y las menciones y
   respuestas que NO le llegaron al momento (Resend falló, se pasó el tope
   por persona, la pestaña se cerró antes de avisar): las que no tienen su
   marca en avisos_enviados. Si no pasó nada, no le llega nada. Quién puede y qué eligió lo decide la base, con las mismas
   funciones que usa la app (puede_recibir_correos, prefs_de_correo).
   ====================================================================== */
import { readFileSync } from "node:fs";
import { correoResumen, zonaValida } from "../functions/_compartido/correos.mjs";
import { DESDE, DESDE_DE_PRUEBA, RESPONDER_A } from "../functions/_compartido/avisos.mjs";

const ZONA = "America/Argentina/Buenos_Aires";
const cfg = { url: "", llave: "", resend: "", admin: "", seco: false };

function leerConfiguracion(){
  const app = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const sacar = n => (new RegExp(`const ${n}\\s*=\\s*["']([^"']+)["']`).exec(app) || [])[1] || "";
  cfg.url = process.env.SUPABASE_URL || sacar("SUPABASE_URL");
  cfg.admin = sacar("ADMIN_EMAIL");
  cfg.llave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  cfg.resend = process.env.RESEND_API_KEY || "";
  cfg.seco = process.env.EN_SECO === "1";
  for(const [n, v] of [["SUPABASE_URL", cfg.url], ["SUPABASE_SERVICE_ROLE_KEY", cfg.llave], ["RESEND_API_KEY", cfg.resend], ["ADMIN_EMAIL", cfg.admin]])
    if(!v) throw new Error(`Falta ${n}.`);
}

async function rest(camino, op = {}){
  const res = await fetch(`${cfg.url}/rest/v1/${camino}`, { ...op,
    headers: { apikey: cfg.llave, Authorization: `Bearer ${cfg.llave}`, "Content-Type": "application/json", ...(op.headers || {}) } });
  const texto = await res.text();
  // El registro de esta corrida es público: sin el cuerpo de la respuesta.
  if(!res.ok) throw new Error(`Supabase contestó ${res.status} en ${String(camino).split("?")[0]}`);
  return texto ? JSON.parse(texto) : null;
}
const rpc = (n, args) => rest(`rpc/${n}`, { method: "POST", body: JSON.stringify(args) });

// La hora, el minuto, el día de la semana (1 = lunes) y la fecha, en una
// zona (la de cada persona; una que no existe cuenta como Argentina).
export function relojDe(ms, zona = ZONA){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zonaValida(zona) ? zona : ZONA, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { hora: Number(p.hour) % 24, min: Number(p.minute), dia: dias[p.weekday], fecha: `${p.year}-${p.month}-${p.day}` };
}
export const relojArgentino = ms => relojDe(ms, ZONA);
const masDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ¿Le toca ahora? Devuelve el período, o null.
// Hasta el 7/10/2026 tocaba solo si la corrida caía justo en SU hora: si
// GitHub la atrasaba a la hora siguiente (pasa con los trabajos que corren
// solos) o fallaba, ese día —o esa semana— no llegaba nada. Ahora toca si
// su hora (o su día y hora) ya pasó hace menos del margen y desde entonces
// no salió ninguno: la primera corrida que llega después lo manda.
export const MARGEN_HORAS = { daily: 12, weekly: 48 };
export function leToca(pr, reloj, ultimo, ahora){
  if(!pr.on) return null;
  const periodo = pr.when === "weekly" ? "weekly" : "daily";
  // Horas desde su última cita: su hora de hoy o de ayer; en el semanal,
  // su día y hora de esta semana o de la anterior.
  const vuelta = periodo === "weekly" ? 168 : 24;
  let horas = reloj.hora - pr.hour + (periodo === "weekly" ? 24 * (reloj.dia - pr.day) : 0);
  horas = ((horas % vuelta) + vuelta) % vuelta;
  if(horas >= MARGEN_HORAS[periodo]) return null;
  const cita = ahora - (horas * 60 + (reloj.min || 0)) * 60000;
  if(ultimo && Date.parse(ultimo) >= cita) return null;   // el de esta cita ya salió
  // Y nunca dos muy seguidos (alguien que cambia la hora después de recibirlo).
  const minimo = periodo === "weekly" ? 4 * 86400000 : 12 * 3600000;
  if(ultimo && ahora - Date.parse(ultimo) < minimo) return null;
  return periodo;
}

// Desde cuándo cuenta su resumen: el último que salió, pero no más atrás
// que una ventana razonable (alguien que lo tuvo apagado meses).
export function desdeDe(ultimo, periodo, ahora){
  const base = periodo === "weekly" ? 7 : 1;
  const tope = ahora - (base + 7) * 86400000;
  const d = ultimo ? Date.parse(ultimo) : ahora - base * 86400000;
  return new Date(Math.max(d, tope)).toISOString();
}

const lugarDe = p => p.location || (Array.isArray(p.scopes) && p.scopes[0] && (p.scopes[0].city || p.scopes[0].country)) || "";

// Lo que va en el resumen de una persona, con los posteos y comentarios
// de la ventana ya leídos (se leen una vez para todos). `enviados`: las
// marcas de lo que ya salió al momento ("posteo|p1|correo"); sin ellas
// (no se pudieron leer), a quien eligió «al momento» no se le repite nada.
export const DEMORA_AL_MOMENTO_MS = 15 * 60000;
export function armarResumen({ email, pr, periodo, desde, hasta, posts, replies, postsPorId, proximos, enviados = null, fecha = null }){
  const temas = new Set(pr.what || []);
  const alMomento = pr.when === "instant";
  const mencionaA = m => (m || []).includes(email) || (m || []).includes("all");
  const enVentana = x => x.created_at > desde && x.created_at <= hasta && x.author_email !== email;
  // Al momento: lo de hace más de 15 minutos (los avisos al momento salen
  // en esos 15; antes, todavía puede estar saliendo) y que no salió.
  const corrido = iso => new Date(Date.parse(iso) - DEMORA_AL_MOMENTO_MS).toISOString();
  const [desdeAM, hastaAM] = [corrido(desde), corrido(hasta)];
  const pendiente = (tipo, x) => x.created_at > desdeAM && x.created_at <= hastaAM && x.author_email !== email
    && !enviados.has(`${tipo}|${x.id}|${email}`);
  const toca = (tipo, x) => alMomento ? (enviados ? pendiente(tipo, x) : false) : enVentana(x);
  const d = { periodo: alMomento ? "daily" : periodo, desde, hasta, lang: pr.lang, menciones: [], respuestas: [], nuevos: [], proximos: [] };
  if(temas.has("menciones")){
    for(const p of posts) if(toca("posteo", p) && mencionaA(p.mentions)) d.menciones.push({ autor: p.author_name, titulo: p.title, texto: p.content, post: p.id, en: "posteo" });
    for(const r of replies) if(toca("respuesta", r) && !r.system && mencionaA(r.mentions)){
      const p = postsPorId.get(r.post_id); if(p) d.menciones.push({ autor: r.author_name, titulo: p.title, texto: r.content, post: p.id, id: r.id, en: "respuesta" });
    }
  }
  if(temas.has("respuestas")){
    const porPost = new Map();
    for(const r of replies){
      const p = postsPorId.get(r.post_id);
      if(!p || p.author_email !== email || !toca("respuesta", r) || r.system || mencionaA(r.mentions)) continue;
      const g = porPost.get(p.id) || { titulo: p.title, post: p.id, autores: [], n: 0 };
      g.n++; if(!g.autores.includes(r.author_name)) g.autores.push(r.author_name);
      porPost.set(p.id, g);
    }
    d.respuestas = [...porPost.values()];
  }
  if(temas.has("nuevos"))
    d.nuevos = posts.filter(p => enVentana(p) && p.activity_type !== "rutina" && !p.cancelled)
      .map(p => ({ titulo: p.title, tipo: p.activity_type, autor: p.author_name, start: p.start_date, end: p.end_date, lugar: lugarDe(p), post: p.id }));
  // Los próximos, desde SU hoy (en Israel ya puede ser mañana).
  const hasta2 = fecha && masDias(fecha, (pr.when === "weekly" ? 6 : 1));
  if(temas.has("proximos"))
    d.proximos = proximos.filter(p => !fecha || (p.start_date >= fecha && p.start_date <= hasta2)).map(p => ({ titulo: p.title, tipo: p.activity_type, start: p.start_date, end: p.end_date, lugar: lugarDe(p), post: p.id }));
  const vacio = !d.menciones.length && !d.respuestas.length && !d.nuevos.length && !d.proximos.length;
  return vacio ? null : d;
}

async function mandar(para, correo){
  const enviar = from => fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: `Bearer ${cfg.resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [para], reply_to: RESPONDER_A, ...correo }) });
  let r = await enviar(DESDE);
  if(r.status === 403) r = await enviar(DESDE_DE_PRUEBA);
  if(!r.ok) throw new Error(`Resend contestó ${r.status}`);
}

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const reloj = relojArgentino(ahora);
  const miembros = await rest("members?select=email,name");
  const correos = [...new Set([cfg.admin, ...miembros.map(m => m.email)])];
  const ultimos = new Map((await rest("resumenes_enviados?select=email,ultimo")).map(x => [x.email, x.ultimo]));

  // A quién le toca ahora.
  const tocan = [];
  for(const email of correos){
    if(!(await rpc("puede_recibir_correos", { p_email: email }))) continue;
    const pr = await rpc("prefs_de_correo", { p_email: email });
    const suyo = relojDe(ahora, pr.tz);
    const periodo = leToca(pr, suyo, ultimos.get(email), ahora);
    if(periodo) tocan.push({ email, pr, periodo, fecha: suyo.fecha, desde: desdeDe(ultimos.get(email), periodo, ahora) });
  }
  console.log(`Hora de Argentina: ${reloj.hora}:${String(reloj.min).padStart(2, "0")}. Les toca a ${tocan.length}.`);
  // Una vez por día (a las 4 de Argentina), lo viejo de los avisos: las
  // marcas de lo enviado sirven unos días (para no repetir y para el
  // resumen de quien eligió «al momento»), no para siempre.
  if(reloj.hora === 4 && !cfg.seco){
    try{
      await rest(`avisos_enviados?enviado_el=lt.${encodeURIComponent(new Date(ahora - 30 * 86400000).toISOString())}`, { method: "DELETE" });
      await rest(`avisos_listos?creado=lt.${encodeURIComponent(new Date(ahora - 86400000).toISOString())}`, { method: "DELETE" });
      console.log("· Limpias las marcas de avisos de hace más de 30 días.");
    }catch(err){ console.error(`  ✗ ${err.message}`); }
  }
  if(!tocan.length) return { enviados: 0 };

  // Lo de la ventana más larga, una sola vez.
  const hasta = new Date(ahora).toISOString();
  const masViejo = new Date(Date.parse(tocan.map(x => x.desde).sort()[0]) - DEMORA_AL_MOMENTO_MS).toISOString();
  const cols = "id,title,content,author_email,author_name,mentions,created_at,activity_type,start_date,end_date,location,scopes,cancelled";
  const posts = await rest(`posts?select=${cols}&created_at=gt.${encodeURIComponent(masViejo)}`);
  const replies = await rest(`replies?select=id,post_id,content,author_email,author_name,mentions,created_at,system&created_at=gt.${encodeURIComponent(masViejo)}`);
  const ids = [...new Set(replies.map(r => r.post_id))].filter(id => !posts.some(p => p.id === id));
  const otros = ids.length ? await rest(`posts?select=${cols}&id=in.(${ids.map(encodeURIComponent).join(",")})`) : [];
  const postsPorId = new Map([...posts, ...otros].map(p => [p.id, p]));
  // Lo que ya salió al momento, para no repetirlo (solo si a alguien que
  // le toca lo eligió).
  let yaSalieron = null;
  if(tocan.some(x => x.pr.when === "instant")){
    try{
      const marcas = await rest(`avisos_enviados?select=tipo,objeto,email&enviado_el=gt.${encodeURIComponent(masViejo)}`);
      yaSalieron = new Set(marcas.map(m => `${m.tipo}|${m.objeto}|${m.email}`));
    }catch(err){ console.error(`  ✗ ${err.message}`); }
  }
  // Los próximos de la semana que viene, desde ayer en Argentina (cada uno
  // los recorta desde SU hoy: en Israel ya puede ser mañana).
  const proximos = await rest(`posts?select=${cols}&start_date=gte.${masDias(reloj.fecha, -1)}&start_date=lte.${masDias(reloj.fecha, 8)}&activity_type=neq.rutina&order=start_date`)
    .then(l => l.filter(p => !p.cancelled));

  let enviados = 0, fallados = 0;
  for(const { email, pr, periodo, desde, fecha } of tocan){
    const d = armarResumen({ email, pr, periodo, desde, hasta, posts, replies, postsPorId, proximos, enviados: yaSalieron, fecha });
    try{
      if(d && !cfg.seco){ await mandar(email, correoResumen(d)); enviados++; }
      if(!cfg.seco) await rest("resumenes_enviados", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ email, ultimo: hasta }) });
      // Solo cantidades: el registro de esta corrida es público.
      console.log(`  ${d ? "✓ resumen enviado" : "· nada que contar"}`);
    }catch(err){ fallados++; console.error(`  ✗ ${err.message}`); }
  }
  console.log(`Enviados: ${enviados}. Fallados: ${fallados}.`);
  if(fallados) process.exitCode = 1;
  return { enviados, fallados };
}

import { pathToFileURL } from "node:url";
if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
