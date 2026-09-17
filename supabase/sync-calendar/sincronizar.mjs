#!/usr/bin/env node
/* ======================================================================
   Traer los cambios de Google Calendar, sin que nadie tenga la app abierta

   Lo corre GitHub cada madrugada (.github/workflows/calendario.yml) y se
   puede correr a mano. Hace exactamente lo que hace la app cuando alguien
   la tiene abierta, pero sin nadie adelante.

   Lo único que necesita que le den es la LLAVE DE SERVICIO de Supabase
   (SUPABASE_SERVICE_ROLE_KEY, un secreto de GitHub). Todo lo demás —a qué
   proyecto, qué calendario, con qué clave leerlo— lo saca de index.html,
   que es donde ya vive y donde se cambia. Repetirlo acá sería otra copia
   que mantener, y ya hay una de más en este archivo.

   Y el calendario, además, lo puede haber cambiado el admin desde
   Configuración: si hay uno guardado en la base, ese gana, igual que en
   la app.

   Leer Calendar NO necesita el login de nadie: el calendario está
   configurado como público para lectura y alcanza con la clave de API.
   Por eso esto no necesita ninguna credencial nueva de Google.

   La decisión de qué hacer con cada evento NO vive acá: vive en
   decidir.mjs, que es puro y se compara contra la app en la prueba
   diferencial. Acá solo se ejecuta lo que esa función pidió.
   ====================================================================== */
import { readFileSync } from "node:fs";
import { decidir } from "./decidir.mjs";

// Se lee al arrancar el trabajo y no al cargar el archivo: así una prueba
// puede correr el mismo programa varias veces con configuraciones
// distintas, que es la única forma de comprobar qué hace cuando falta algo
// o cuando se le pide que no escriba.
const cfg = { url:"", llave:"", calId:"", calKey:"", seco:false };

// Las constantes de index.html, leídas del archivo. No son secretas: ya
// viajan al navegador de cualquiera que abra la página. Lo que se gana
// leyéndolas de ahí es que hay UN solo lugar donde cambiarlas.
export function constantesDeLaApp(texto){
  const sacar = nombre => {
    const m = new RegExp(`(?:const|let) ${nombre}\\s*=\\s*["']([^"']+)["']`).exec(texto);
    return m ? m[1] : "";
  };
  return { url: sacar("SUPABASE_URL"), calId: sacar("CALENDAR_ID"), calKey: sacar("CALENDAR_API_KEY") };
}

function leerConfiguracion(){
  let deLaApp = { url:"", calId:"", calKey:"" };
  try{
    deLaApp = constantesDeLaApp(readFileSync(new URL("../../index.html", import.meta.url), "utf8"));
  }catch(err){
    throw new Error("No pude leer index.html para sacar la configuración: " + err.message);
  }
  // Una variable de entorno gana, por si alguna vez hace falta apuntar
  // esto a otro lado sin tocar la app.
  cfg.url    = process.env.SUPABASE_URL || deLaApp.url;
  cfg.calId  = process.env.CALENDAR_ID || deLaApp.calId;
  cfg.calKey = process.env.CALENDAR_API_KEY || deLaApp.calKey;
  cfg.llave  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  cfg.seco   = process.env.EN_SECO === "1"; // decide pero no escribe
  for(const [nombre, valor] of [["SUPABASE_URL", cfg.url], ["SUPABASE_SERVICE_ROLE_KEY", cfg.llave],
                                ["CALENDAR_ID", cfg.calId], ["CALENDAR_API_KEY", cfg.calKey]]){
    if(!valor) throw new Error(`Falta ${nombre}.`);
  }
}

// La misma marca que usa la app: una fecha imposible que la base
// reemplaza por su reloj al escribir (ver 04-funciones.sql).
const MARCA_HORA = "1970-01-01T00:00:00.000Z";

const A_SNAKE = { photoURL: "photo_url" };
const A_CAMEL = { photo_url: "photoURL" };
const aSnake = k => A_SNAKE[k] || k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
const aCamel = k => A_CAMEL[k] || k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const aFila   = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [aSnake(k), v]));
const aObjeto = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [aCamel(k), v]));

/* ---------- Hablarle a Supabase ---------- */
async function rest(camino, opciones = {}){
  const res = await fetch(`${cfg.url}/rest/v1/${camino}`, {
    ...opciones,
    headers: {
      apikey: cfg.llave, Authorization: `Bearer ${cfg.llave}`,
      "Content-Type": "application/json", ...(opciones.headers || {}),
    },
  });
  const texto = await res.text();
  if(!res.ok) throw new Error(`Supabase ${res.status} en ${camino}: ${texto.slice(0, 400)}`);
  return texto ? JSON.parse(texto) : null;
}

const traerPosteos = async () => (await rest("posts?select=*")).map(aObjeto);

async function traerConfig(clave){
  const filas = await rest(`app_config?select=value&key=eq.${encodeURIComponent(clave)}`);
  return filas.length ? filas[0].value : null;
}
async function guardarSyncToken(token){
  const actual = (await traerConfig("calendarSync")) || {};
  const value = { ...actual, syncToken: token, lastSyncedAt: new Date().toISOString() };
  await rest("app_config", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ key: "calendarSync", value }),
  });
}

/* ---------- Leer Google Calendar ---------- */
// Idéntico a fetchCalendarChanges() de la app: 410 (y el 400 de un token
// de otro calendario) quieren decir "empezá de nuevo desde cero".
async function traerCambios(syncToken, desde){
  let pageToken = null, nextSyncToken = null;
  const events = [];
  do{
    const params = new URLSearchParams({ key: cfg.calKey, maxResults: "250", showDeleted: "true" });
    if(syncToken) params.set("syncToken", syncToken);
    else if(desde) params.set("timeMin", `${desde}T00:00:00Z`);
    if(pageToken) params.set("pageToken", pageToken);
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calId)}/events?${params}`);
    if(res.status === 410) return { needsFullResync: true };
    const body = await res.json();
    if(res.status === 400 && syncToken && /sync ?token/i.test(body.error?.message || "")){
      return { needsFullResync: true };
    }
    if(!res.ok) throw new Error(body.error?.message || res.statusText);
    events.push(...(body.items || []));
    pageToken = body.nextPageToken || null;
    if(body.nextSyncToken) nextSyncToken = body.nextSyncToken;
  }while(pageToken);
  return { events, nextSyncToken };
}

/* ---------- Ejecutar lo que decidió decidir() ---------- */
async function ejecutar(accion){
  if(accion.tipo === "actualizar"){
    await rest(`posts?id=eq.${encodeURIComponent(accion.id)}`, {
      method: "PATCH", body: JSON.stringify(aFila(accion.patch)),
    });
    return;
  }
  if(accion.tipo === "crear"){
    // Igual que createOnce en la app: si ya está, no se pisa. El evento
    // puede llegar dos veces (una corrida que se superpone con la
    // siguiente, un reintento) y no puede nacer dos veces el mismo posteo.
    await rest("posts", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ ...aFila(accion.datos), id: accion.id, created_at: MARCA_HORA }),
    });
    return;
  }
  if(accion.tipo === "comentar"){
    await rest("replies", {
      method: "POST",
      body: JSON.stringify({ ...aFila(accion.datos), id: nuevoId(), post_id: accion.postId, created_at: MARCA_HORA }),
    });
    return;
  }
  throw new Error("acción desconocida: " + accion.tipo);
}

// El mismo alfabeto y largo que usa Firestore, para que un id nuevo no se
// distinga de los que ya están.
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function nuevoId(){
  const bytes = new Uint8Array(20);
  (globalThis.crypto || require("node:crypto").webcrypto).getRandomValues(bytes);
  return [...bytes].map(b => ALFABETO[b % ALFABETO.length]).join("");
}

/* ---------- El idioma de los comentarios que escribe ---------- */
// La app los escribe en el idioma de quien tiene la pantalla abierta.
// Acá no hay nadie, así que van en español, que es el del equipo.
const t = (plantilla, vars) =>
  String(plantilla).replace(/\{(\w+)\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
const fmtDate = iso => {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
// Cómo se lee una regla de repetición. Versión corta a propósito: solo se
// usa adentro de un comentario ("repetición (se repite todas las
// semanas)"), y cuál exactamente lo dice la regla guardada, que es la que
// manda.
function etiquetaDeRepeticion(post){
  const lineas = Array.isArray(post.recurrence) ? post.recurrence : [];
  const regla = lineas.map(l => String(l).trim()).find(l => /^RRULE[:;]/i.test(l));
  if(!regla) return "";
  const partes = Object.fromEntries(regla.replace(/^RRULE[:;]/i, "").split(";")
    .map(p => p.split("=")).filter(p => p.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
  const freq = String(partes.FREQ || "").toUpperCase();
  const cada = Number(partes.INTERVAL || 1) || 1;
  const nombres = { DAILY:["días","todos los días"], WEEKLY:["semanas","todas las semanas"],
                    MONTHLY:["meses","todos los meses"], YEARLY:["años","todos los años"] };
  if(!nombres[freq]) return "se repite";
  return cada > 1 ? `se repite cada ${cada} ${nombres[freq][0]}` : `se repite ${nombres[freq][1]}`;
}

/* ---------- Los tipos de actividad, como los tiene el equipo ---------- */
const TIPOS_DE_FABRICA = [
  { key:"rutina", label:"Rutina" }, { key:"visita", label:"Visita" },
  { key:"curso", label:"Curso" }, { key:"seminario", label:"Seminario" },
  { key:"congreso", label:"Congreso" }, { key:"virtual", label:"Virtual" },
  { key:"otro", label:"Otro" },
];
// Los mismos nombres en los cuatro idiomas que usa la app: un evento
// escrito con la app en inglés lleva "Visit: " adelante, y sin esto el
// título quedaría con el prefijo pegado.
const NOMBRES_DE_FABRICA = {
  rutina:    { es:"Rutina",    en:"Routine",  pt:"Rotina",     he:"שגרה" },
  visita:    { es:"Visita",    en:"Visit",    pt:"Visita",     he:"ביקור" },
  curso:     { es:"Curso",     en:"Course",   pt:"Curso",      he:"קורס" },
  seminario: { es:"Seminario", en:"Seminar",  pt:"Seminário",  he:"סמינר" },
  congreso:  { es:"Congreso",  en:"Congress", pt:"Congresso",  he:"כנס" },
  virtual:   { es:"Virtual",   en:"Virtual",  pt:"Virtual",    he:"וירטואלי" },
  otro:      { es:"Otro",      en:"Other",    pt:"Outro",      he:"אחר" },
};
// El admin puede renombrar los tipos y agregar otros desde Configuración;
// eso vive en app_config. Si no hay nada guardado, los de fábrica.
async function tiposDelEquipo(){
  const prefs = (await traerConfig("preferences")) || {};
  const guardados = Array.isArray(prefs.activityTypes) ? prefs.activityTypes : null;
  const lista = guardados && guardados.length ? guardados : TIPOS_DE_FABRICA;
  return {
    porClave: Object.fromEntries(lista.filter(x => x && x.key).map(x => [x.key, x])),
    deFabrica: NOMBRES_DE_FABRICA,
  };
}

/* ---------- El trabajo ---------- */
async function main(){
  leerConfiguracion();

  const meta = (await traerConfig("calendarSync")) || {};
  const prefs = (await traerConfig("preferences")) || {};
  // Si el admin cambió de calendario desde Configuración, ese manda —
  // igual que en la app (applyCalendarIdConfig).
  if(prefs.calendarId) cfg.calId = prefs.calendarId;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(prefs.calendarImportFrom || ""))
    ? prefs.calendarImportFrom : "";

  let resultado = await traerCambios(meta.syncToken || null, desde);
  if(resultado.needsFullResync){
    console.log("El token venció: se relee el calendario entero.");
    resultado = await traerCambios(null, desde);
  }
  const eventos = resultado.events || [];
  console.log(`Eventos con cambios: ${eventos.length}`);
  if(!eventos.length){
    if(resultado.nextSyncToken && !cfg.seco) await guardarSyncToken(resultado.nextSyncToken);
    console.log("Nada que aplicar.");
    return { aplicados:0, fallados:0, revisados:0 };
  }

  const ctx = { tipos: await tiposDelEquipo(), t, fmtDate, hora: ()=> MARCA_HORA, etiquetaDeRepeticion };
  // Los posteos se leen UNA vez y se van actualizando en memoria: dos
  // eventos de la misma serie en la misma corrida tienen que verse entre
  // ellos, igual que en la app (que trabaja sobre state.posts en vivo).
  const posteos = await traerPosteos();
  let aplicados = 0, fallados = 0;

  for(const ev of eventos){
    let acciones;
    try{ acciones = decidir(ev, posteos, ctx); }
    catch(err){ fallados++; console.error(`  ✗ ${ev.id}: al decidir — ${err.message}`); continue; }
    if(!acciones.length) continue;
    try{
      // Cada evento por separado: si uno falla, los demás se aplican igual
      // y el token avanza. Sin esto, un solo evento malo trababa el mismo
      // lote para siempre, en cada corrida.
      for(const a of acciones){ if(!cfg.seco) await ejecutar(a); }
      anotarEnMemoria(posteos, acciones);
      aplicados++;
      console.log(`  ✓ ${ev.id}: ${acciones.map(a=>a.tipo).join(" + ")}`);
    }catch(err){
      fallados++;
      console.error(`  ✗ ${ev.id}: ${err.message}`);
    }
  }

  // El token se guarda igual aunque alguno haya fallado: si no, la próxima
  // corrida vuelve a traer TODO y los mismos eventos vuelven a fallar.
  if(resultado.nextSyncToken && !cfg.seco) await guardarSyncToken(resultado.nextSyncToken);
  console.log(`\nAplicados: ${aplicados}. Fallados: ${fallados}. Revisados: ${eventos.length}.`);
  if(fallados) process.exitCode = 1;
  return { aplicados, fallados, revisados: eventos.length };
}

// Deja la lista en memoria como quedó la base, para que el evento
// siguiente de la misma corrida vea lo que hizo el anterior.
function anotarEnMemoria(posteos, acciones){
  for(const a of acciones){
    if(a.tipo === "actualizar"){
      const p = posteos.find(x => x.id === a.id);
      if(p) Object.assign(p, a.patch);
    } else if(a.tipo === "crear"){
      posteos.push({ id: a.id, ...a.datos });
    }
  }
}

// Se ejecuta solo cuando se lo corre a él; importarlo desde una prueba
// no dispara nada. Así el trabajo entero se puede probar de punta a punta
// contra un Supabase y un Calendar de mentira.
import { pathToFileURL } from "node:url";
if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err=>{ console.error(err); process.exit(1); });
}
export { main, aFila, aObjeto, etiquetaDeRepeticion };
