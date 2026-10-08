/* ======================================================================
   La copia de seguridad semanal
   ======================================================================
   Desde que Firebase se apagó no quedaba ninguna copia (docs/REVISION.md,
   punto 13). Esto corre una vez por semana (.github/workflows/respaldo.yml)
   y deja todo en el repo PRIVADO team-latam/registro-respaldos:

   - datos/<tabla>.json: cada tabla entera, ordenada por su clave. Se
     pisan cada semana y el historial de git guarda las anteriores: para
     ver cómo estaba algo un domingo, se mira ese commit.
   - archivos/<ruta>: las fotos y adjuntos del bucket. Solo se bajan los
     que todavía no están (una ruta nueva es un archivo nuevo: la app
     nunca reescribe uno), y lo que se borra del bucket se queda en la
     copia. Lo de papelera/ no se copia: ya se copió con su ruta original.
   - base/registro.sql.gz: el volcado de la base, que hace el workflow
     con pg_dump (no este archivo).

   El repo de la app es PÚBLICO y los registros de Actions también: acá
   no se escribe ni un dato, solo cantidades.

   Variables: SUPABASE_SERVICE_ROLE_KEY (la misma del sincronizador de
   Calendar), DESTINO (la carpeta del repo de copias ya clonado) y,
   opcional, SUPABASE_URL (si no, sale de index.html).
   ====================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Las tablas y su clave (para leerlas de a páginas en un orden fijo). Una
// tabla nueva en supabase/*.sql tiene que sumarse acá: la prueba lo exige.
export const TABLAS = {
  posts: "id", replies: "id", members: "email", former_members: "email",
  access_requests: "email", user_prefs: "email", app_config: "key", audit_log: "id",
  calendar_sugerencias: "evento", calendar_sacados: "evento", personas: "id",
  agenda_listas: "id", instituciones: "id", contactos: "id",
};
// Las que a propósito NO van en la copia: anotaciones de qué correo ya
// salió (17-avisos-por-correo.sql), que solo lee la llave de servicio.
// Restauradas en una base nueva no aportan nada: el resumen siguiente
// cubre el último día o la última semana igual, y un aviso al momento
// solo podría repetirse por algo de los últimos 15 minutos. Tampoco
// avisos_listos: lo que la función `avisar` tiene que mandar en los
// próximos 10 minutos, con su turno (7/10/2026).
export const SIN_COPIA = ["avisos_enviados", "resumenes_enviados", "avisos_listos"];
const BUCKET = "adjuntos";
const PAGINA = 1000;

const cfg = { url: "", llave: "", destino: "" };
function leerConfiguracion(){
  let deLaApp = "";
  try{
    const app = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    deLaApp = (/(?:const|let) SUPABASE_URL\s*=\s*["']([^"']+)["']/.exec(app) || [])[1] || "";
  }catch(err){
    throw new Error("No pude leer index.html para sacar la dirección de Supabase: " + err.message);
  }
  cfg.url = process.env.SUPABASE_URL || deLaApp;
  cfg.llave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  cfg.destino = process.env.DESTINO || "";
  if(!cfg.url) throw new Error("Falta SUPABASE_URL.");
  if(!cfg.llave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  if(!cfg.destino) throw new Error("Falta DESTINO (la carpeta del repo de copias).");
}

const encabezados = () => ({ apikey: cfg.llave, Authorization: `Bearer ${cfg.llave}` });
async function pedirJson(camino, metodo = "GET", cuerpo){
  const res = await fetch(cfg.url + camino, {
    method: metodo,
    headers: { ...encabezados(), "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let datos = null;
  try{ datos = texto ? JSON.parse(texto) : null; }catch(e){ datos = texto; }
  // Sin el texto de la respuesta en el error: podría traer un dato.
  if(!res.ok) throw new Error(`Supabase ${res.status} en ${camino.split("?")[0]}`);
  return datos;
}

// Una tabla entera, de a mil filas (el tope de fábrica de la API).
async function leerTabla(tabla, clave){
  const filas = [];
  for(let desde = 0; ; desde += PAGINA){
    const pagina = await pedirJson(`/rest/v1/${tabla}?select=*&order=${clave}.asc&limit=${PAGINA}&offset=${desde}`);
    if(!Array.isArray(pagina)) throw new Error(`Supabase no devolvió una lista para ${tabla}`);
    filas.push(...pagina);
    if(pagina.length < PAGINA) return filas;
  }
}

// Todos los archivos del bucket, recorriendo las carpetas (la API lista un
// nivel por vez: una carpeta viene sin id).
async function listarBucket(prefijo = ""){
  const archivos = [];
  for(let desde = 0; ; desde += PAGINA){
    const items = await pedirJson(`/storage/v1/object/list/${BUCKET}`, "POST",
      { prefix: prefijo, limit: PAGINA, offset: desde, sortBy: { column: "name", order: "asc" } }) || [];
    for(const it of items){
      const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
      if(ruta === "papelera" || ruta.startsWith("papelera/")) continue;
      if(it.id == null) archivos.push(...await listarBucket(ruta));
      else archivos.push(ruta);
    }
    if(items.length < PAGINA) return archivos;
  }
}

async function bajarArchivo(ruta){
  const camino = ruta.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${camino}`, { headers: encabezados() });
  if(!res.ok) throw new Error(`Supabase ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const LEEME = `# Copias de seguridad del Registro de Acciones

Repo **privado**. Lo llena solo, cada domingo, el trabajo «Copia de
seguridad» del repo team-latam/registro-acciones (\`supabase/respaldo/\`).
No hace falta tocar nada acá.

- \`datos/<tabla>.json\`: cada tabla entera, legible. Para ver cómo estaba
  algo un día, se abre el commit de esa semana (pestaña «Commits»).
- \`archivos/\`: las fotos y adjuntos, con la misma ruta que en Supabase.
  Lo que se borra de la app se queda acá.
- \`base/registro.sql.gz\`: la base entera (estructura y datos), para
  restaurarla de una sola vez con \`gunzip -c registro.sql.gz | psql <dirección>\`.

Para restaurar algo puntual (un posteo borrado, por ejemplo), alcanza con
\`datos/posts.json\` de la semana anterior y \`archivos/\`.
`;

export async function main(){
  leerConfiguracion();
  const hoy = new Date().toISOString().slice(0, 10);
  const fallas = [];
  console.log(`## Copia de seguridad — ${hoy}\n`);

  /* ---- Las tablas ---- */
  mkdirSync(join(cfg.destino, "datos"), { recursive: true });
  let filasEnTotal = 0;
  const porTabla = [];
  for(const [tabla, clave] of Object.entries(TABLAS)){
    try{
      const filas = await leerTabla(tabla, clave);
      writeFileSync(join(cfg.destino, "datos", `${tabla}.json`), JSON.stringify(filas, null, 1) + "\n");
      filasEnTotal += filas.length;
      porTabla.push(`${tabla} ${filas.length}`);
    }catch(err){ fallas.push(`tabla ${tabla}: ${err.message}`); }
  }
  console.log(`- Tablas: ${porTabla.length} de ${Object.keys(TABLAS).length}, ${filasEnTotal} filas (${porTabla.join(", ")})`);

  /* ---- Los archivos nuevos ---- */
  let rutas = [];
  try{ rutas = await listarBucket(); }
  catch(err){ fallas.push(`lista del bucket: ${err.message}`); }
  const nuevas = rutas.filter(r => !existsSync(join(cfg.destino, "archivos", r)));
  let bajados = 0;
  for(const ruta of nuevas){
    try{
      const destino = join(cfg.destino, "archivos", ruta);
      // Que una ruta rara no escriba fuera de archivos/.
      if(!destino.startsWith(join(cfg.destino, "archivos") + "/")) throw new Error("ruta inválida");
      const datos = await bajarArchivo(ruta);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, datos);
      bajados++;
    }catch(err){ fallas.push(`archivo nº ${bajados + 1} de los nuevos: ${err.message}`); }
  }
  console.log(`- Archivos en el bucket: ${rutas.length}; nuevos desde la copia anterior: ${nuevas.length}; bajados: ${bajados}`);

  writeFileSync(join(cfg.destino, "LEEME.md"), LEEME);
  if(fallas.length){
    console.log(`\n### ⚠️ Quedaron ${fallas.length} cosas sin copiar\n`);
    console.log(fallas.slice(0, 20).map(f => `- ${f}`).join("\n"));
    process.exitCode = 1;
  }
  return { tablas: porTabla.length, filas: filasEnTotal, archivos: rutas.length, nuevos: nuevas.length, bajados, fallas };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.log(`\n### ⛔ La copia no se pudo hacer\n\n${err.message}`); process.exitCode = 1; });
}
