/* ======================================================================
   Los resúmenes por correo, diarios y semanales (17-avisos-por-correo.sql)
   ======================================================================
   Corre cada hora (workflow «Resúmenes por correo») con la llave de
   servicio. A cada persona que puede recibir correos y los tiene
   prendidos, le manda su resumen cuando es SU hora (hora de Argentina) y
   SU día si es semanal: lo que pasó desde el último. Quien eligió «al
   momento» recibe acá solo lo que no tiene momento (actividades nuevas,
   eventos que empiezan pronto), una vez por día. Si no pasó nada, no le
   llega nada. Quién puede y qué eligió lo decide la base, con las mismas
   funciones que usa la app (puede_recibir_correos, prefs_de_correo).
   ====================================================================== */
import { readFileSync } from "node:fs";
import { correoResumen } from "../functions/_compartido/correos.mjs";
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

// La hora, el día de la semana (1 = lunes) y la fecha, en Argentina.
export function relojArgentino(ms){
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short" })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { hora: Number(p.hour) % 24, dia: dias[p.weekday], fecha: `${p.year}-${p.month}-${p.day}` };
}
const masDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ¿Le toca ahora? Devuelve el período, o null.
export function leToca(pr, reloj, ultimo, ahora){
  if(!pr.on) return null;
  const periodo = pr.when === "weekly" ? "weekly" : "daily";
  if(reloj.hora !== pr.hour) return null;
  if(periodo === "weekly" && reloj.dia !== pr.day) return null;
  // Una vez por período aunque el trabajo corra dos veces en la misma hora.
  const minimo = periodo === "weekly" ? 6 * 86400000 : 20 * 3600000;
  if(ultimo && ahora - Date.parse(ultimo) < minimo) return null;
  return periodo;
}

const lugarDe = p => p.location || (Array.isArray(p.scopes) && p.scopes[0] && (p.scopes[0].city || p.scopes[0].country)) || "";

// Lo que va en el resumen de una persona, con los posteos y comentarios
// de la ventana ya leídos (se leen una vez para todos).
export function armarResumen({ email, pr, periodo, desde, hasta, posts, replies, postsPorId, proximos }){
  const temas = new Set(pr.what || []);
  const alMomento = pr.when === "instant";
  const mencionaA = m => (m || []).includes(email) || (m || []).includes("all");
  const enVentana = x => x.created_at > desde && x.created_at <= hasta && x.author_email !== email;
  const d = { periodo: alMomento ? "daily" : periodo, desde, hasta, menciones: [], respuestas: [], nuevos: [], proximos: [] };
  if(temas.has("menciones") && !alMomento){
    for(const p of posts) if(enVentana(p) && mencionaA(p.mentions)) d.menciones.push({ autor: p.author_name, titulo: p.title, texto: p.content, post: p.id, en: "posteo" });
    for(const r of replies) if(enVentana(r) && !r.system && mencionaA(r.mentions)){
      const p = postsPorId.get(r.post_id); if(p) d.menciones.push({ autor: r.author_name, titulo: p.title, texto: r.content, post: p.id, id: r.id, en: "respuesta" });
    }
  }
  if(temas.has("respuestas") && !alMomento){
    const porPost = new Map();
    for(const r of replies){
      const p = postsPorId.get(r.post_id);
      if(!p || p.author_email !== email || !enVentana(r) || r.system || mencionaA(r.mentions)) continue;
      const g = porPost.get(p.id) || { titulo: p.title, post: p.id, autores: [], n: 0 };
      g.n++; if(!g.autores.includes(r.author_name)) g.autores.push(r.author_name);
      porPost.set(p.id, g);
    }
    d.respuestas = [...porPost.values()];
  }
  if(temas.has("nuevos"))
    d.nuevos = posts.filter(p => enVentana(p) && p.activity_type !== "rutina" && !p.cancelled)
      .map(p => ({ titulo: p.title, tipo: p.activity_type, autor: p.author_name, start: p.start_date, end: p.end_date, lugar: lugarDe(p), post: p.id }));
  if(temas.has("proximos"))
    d.proximos = proximos.map(p => ({ titulo: p.title, tipo: p.activity_type, start: p.start_date, end: p.end_date, lugar: lugarDe(p), post: p.id }));
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
    const periodo = leToca(pr, reloj, ultimos.get(email), ahora);
    if(periodo) tocan.push({ email, pr, periodo });
  }
  console.log(`Hora de Argentina: ${reloj.hora}:00. Les toca a ${tocan.length}.`);
  if(!tocan.length) return { enviados: 0 };

  // Lo de la ventana más larga, una sola vez.
  const hasta = new Date(ahora).toISOString();
  const masViejo = new Date(ahora - 8 * 86400000).toISOString();
  const cols = "id,title,content,author_email,author_name,mentions,created_at,activity_type,start_date,end_date,location,scopes,cancelled";
  const posts = await rest(`posts?select=${cols}&created_at=gt.${encodeURIComponent(masViejo)}`);
  const replies = await rest(`replies?select=id,post_id,content,author_email,author_name,mentions,created_at,system&created_at=gt.${encodeURIComponent(masViejo)}`);
  const ids = [...new Set(replies.map(r => r.post_id))].filter(id => !posts.some(p => p.id === id));
  const otros = ids.length ? await rest(`posts?select=${cols}&id=in.(${ids.map(encodeURIComponent).join(",")})`) : [];
  const postsPorId = new Map([...posts, ...otros].map(p => [p.id, p]));
  const proximosHasta = d => masDias(reloj.fecha, d === "weekly" ? 6 : 1);
  const prox = {};
  for(const periodo of ["daily", "weekly"])
    prox[periodo] = await rest(`posts?select=${cols}&start_date=gte.${reloj.fecha}&start_date=lte.${proximosHasta(periodo)}&activity_type=neq.rutina&order=start_date`)
      .then(l => l.filter(p => !p.cancelled));

  let enviados = 0, fallados = 0;
  for(const { email, pr, periodo } of tocan){
    const desde = ultimos.get(email) || new Date(ahora - (periodo === "weekly" ? 7 : 1) * 86400000).toISOString();
    const d = armarResumen({ email, pr, periodo, desde, hasta, posts, replies, postsPorId, proximos: prox[pr.when === "weekly" ? "weekly" : "daily"] });
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
