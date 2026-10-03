/* ======================================================================
   La limpieza del bucket
   ======================================================================
   Quitar una foto de un posteo, cambiarla por otra o borrar el posteo
   entero dejaba el archivo en el bucket para siempre: ocupaba lugar del
   GB del plan, y quien tuviera la ruta lo seguía pudiendo abrir. La app no
   borra nunca (solo el admin fijo puede, ver 02-politicas.sql).

   Esto corre una vez por semana (.github/workflows/limpieza.yml):

   1. Le pregunta a la base qué sobra: limpieza_del_bucket(), en
      04-funciones.sql. Es lo que ninguna fila nombra —ni como foto, ni
      como adjunto, ni como miniatura de una foto que sí está— y tiene más
      de dos días.
   2. Lo MUEVE a papelera/<fecha de hoy>/, no lo borra. Si algún día la
      cuenta sale mal (una columna nueva con adjuntos que la función no
      conoce), lo movido se devuelve con RESTAURAR=<esa fecha>.
   3. Borra de verdad lo que lleva más de 30 días en la papelera.

   Y frena solo, sin tocar nada, si lo que habría que mover es más de un
   cuarto del bucket: eso no es limpieza, es la cuenta que salió mal. Para
   pasarlo hay que pedirlo a mano (SIN_TOPE=1), después de mirar la lista.

   Con EN_SECO=1 dice qué haría, sin mover ni borrar nada.
   ====================================================================== */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const GRACIA_DIAS = 2, PAPELERA_DIAS = 30;
const TOPE = 0.25, MINIMO_PARA_EL_TOPE = 40;

// Se lee al arrancar y no al cargar el archivo: así una prueba puede
// correr el trabajo varias veces con configuraciones distintas.
const cfg = { url: "", llave: "", seco: false, sinTope: false, restaurar: "" };

function leerConfiguracion(){
  // La dirección del proyecto sale de index.html: no es secreta (viaja al
  // navegador de cualquiera) y así hay un solo lugar donde cambiarla.
  let deLaApp = "";
  try{
    const app = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    deLaApp = (/(?:const|let) SUPABASE_URL\s*=\s*["']([^"']+)["']/.exec(app) || [])[1] || "";
  }catch(err){
    throw new Error("No pude leer index.html para sacar la dirección de Supabase: " + err.message);
  }
  cfg.url = process.env.SUPABASE_URL || deLaApp;
  cfg.llave = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  cfg.seco = process.env.EN_SECO === "1";
  cfg.sinTope = process.env.SIN_TOPE === "1";
  cfg.restaurar = String(process.env.RESTAURAR || "").trim();
  if(!cfg.url) throw new Error("Falta SUPABASE_URL.");
  if(!cfg.llave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  if(cfg.restaurar && !/^\d{4}-\d{2}-\d{2}$/.test(cfg.restaurar))
    throw new Error(`RESTAURAR tiene que ser una fecha AAAA-MM-DD, no «${cfg.restaurar}».`);
}

async function pedir(camino, metodo = "GET", cuerpo){
  const res = await fetch(cfg.url + camino, {
    method: metodo,
    headers: { apikey: cfg.llave, Authorization: `Bearer ${cfg.llave}`, "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let datos = null;
  try{ datos = texto ? JSON.parse(texto) : null; }catch(e){ datos = texto; }
  if(!res.ok) throw new Error(`Supabase ${res.status} en ${camino}: ${String((datos && (datos.message || datos.error)) || texto).slice(0, 300)}`);
  return datos;
}
const mover = (desde, hasta) => pedir("/storage/v1/object/move", "POST",
  { bucketId: "adjuntos", sourceKey: desde, destinationKey: hasta });

const muestra = (lista, cuantos = 20) => lista.slice(0, cuantos).map(n => `  - ${n}`).join("\n")
  + (lista.length > cuantos ? `\n  - … y ${lista.length - cuantos} más` : "");

async function main(){
  leerConfiguracion();
  // Una sola fecha para toda la corrida, aunque cruce la medianoche.
  const hoy = new Date().toISOString().slice(0, 10);
  const estado = await pedir("/rest/v1/rpc/limpieza_del_bucket", "POST",
    { p_gracia: GRACIA_DIAS, p_papelera: PAPELERA_DIAS, p_restaurar: cfg.restaurar || null }) || {};
  const total = Number(estado.total) || 0;
  const huerfanos = Array.isArray(estado.huerfanos) ? estado.huerfanos : [];
  const vencidos = Array.isArray(estado.vencidos) ? estado.vencidos : [];
  const fallas = [];

  /* ---- Devolver lo que se movió un día ---- */
  if(cfg.restaurar){
    const aDevolver = Array.isArray(estado.restaurar) ? estado.restaurar : [];
    const prefijo = `papelera/${cfg.restaurar}/`;
    console.log(`## Devolver lo que la limpieza movió el ${cfg.restaurar}\n`);
    console.log(`En la papelera de ese día: ${aDevolver.length}${cfg.seco ? " (en seco: no se mueve nada)" : ""}`);
    if(aDevolver.length) console.log(muestra(aDevolver));
    if(cfg.seco) return { devueltos: 0, fallas };
    let devueltos = 0;
    for(const nombre of aDevolver){
      try{ await mover(nombre, nombre.slice(prefijo.length)); devueltos++; }
      catch(err){ fallas.push(`${nombre}: ${err.message}`); }
    }
    console.log(`\nDevueltos a su lugar: ${devueltos}.`);
    if(fallas.length){ console.log(`\nNo se pudieron devolver ${fallas.length}:\n${muestra(fallas)}`); process.exitCode = 1; }
    return { devueltos, fallas };
  }

  console.log(`## Limpieza del bucket — ${hoy}\n`);
  console.log(`- Archivos en el bucket: ${total}`);
  console.log(`- Que ninguna fila nombra (con más de ${GRACIA_DIAS} días): ${huerfanos.length}`);
  console.log(`- En la papelera hace más de ${PAPELERA_DIAS} días: ${vencidos.length}`);

  // Más de un cuarto del bucket de una vez no es limpieza: es la cuenta que
  // salió mal. Se frena sin tocar nada, y la corrida queda en rojo para
  // que alguien mire.
  const tope = Math.max(MINIMO_PARA_EL_TOPE, Math.floor(total * TOPE));
  if(huerfanos.length > tope && !cfg.sinTope){
    console.log(`\n### ⛔ No se tocó nada`);
    console.log(`Habría que mover ${huerfanos.length} de ${total} archivos, y el tope es ${tope}. Eso no es limpieza: es casi`
      + ` seguro una cuenta que salió mal (una columna nueva con adjuntos, una tabla que se vació).`
      + ` Si la lista está bien, se corre a mano con «sin tope».\n`);
    console.log(muestra(huerfanos, 30));
    process.exitCode = 1;
    return { movidos: 0, borrados: 0, frenado: true, fallas };
  }

  if(cfg.seco){
    if(huerfanos.length) console.log(`\nSe moverían a papelera/${hoy}/:\n${muestra(huerfanos)}`);
    if(vencidos.length) console.log(`\nSe borrarían de la papelera:\n${muestra(vencidos)}`);
    console.log(`\n(En seco: no se movió ni se borró nada.)`);
    return { movidos: 0, borrados: 0, fallas };
  }

  let movidos = 0;
  for(const nombre of huerfanos){
    try{ await mover(nombre, `papelera/${hoy}/${nombre}`); movidos++; }
    catch(err){ fallas.push(`mover ${nombre}: ${err.message}`); }
  }
  // De a mil: es lo que acepta la API por pedido.
  let borrados = 0;
  for(let i = 0; i < vencidos.length; i += 1000){
    const tanda = vencidos.slice(i, i + 1000);
    try{
      const r = await pedir("/storage/v1/object/adjuntos", "DELETE", { prefixes: tanda });
      borrados += Array.isArray(r) ? r.length : tanda.length;
    }catch(err){ fallas.push(`borrar ${tanda.length} de la papelera: ${err.message}`); }
  }

  if(movidos) console.log(`\nMovidos a papelera/${hoy}/: ${movidos}. Se devuelven con «restaurar ${hoy}».\n${muestra(huerfanos)}`);
  if(borrados) console.log(`\nBorrados de la papelera (más de ${PAPELERA_DIAS} días): ${borrados}.`);
  if(!movidos && !borrados && !fallas.length) console.log(`\nNo había nada que limpiar.`);
  if(fallas.length){ console.log(`\nNo se pudieron hacer ${fallas.length}:\n${muestra(fallas)}`); process.exitCode = 1; }
  return { movidos, borrados, fallas };
}

// Se ejecuta solo cuando se lo corre a él; importarlo desde una prueba no
// dispara nada.
if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error("✗ " + err.message); process.exit(1); });
}
export { main, GRACIA_DIAS, PAPELERA_DIAS };
