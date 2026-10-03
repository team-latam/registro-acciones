import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await chromium.launch();
const p = await b.newPage();
const errores = [];
p.on("pageerror", e => errores.push(String(e)));
p.on("console", m => { if(m.type()==="error") errores.push(m.text()); });
await p.goto("file://" + process.cwd() + "/documentacion.html");
await p.waitForTimeout(200);
eq("la página levanta sin errores", errores, []);

const escribirYApretar = (key, texto) => p.evaluate(([k,t])=>{
  window.__escribir(k, t);
  return window.__clickMas(k);
}, [key, texto]);
const docs = key => p.evaluate(k=>window.__docsDe(k), key);

/* ============ Apretar "+" tiene que agregar el documento ============
   Esto es lo que estaba roto: slugifyKey se llamaba sin la lista de
   claves existentes y reventaba con un TypeError adentro del handler.
   El botón no hacía absolutamente nada y no había forma de saber por qué.
   Las 32 pruebas de esta pantalla miraban lo DIBUJADO; ninguna hacía clic. */
await p.evaluate(()=>window.__pintarConfig());

eq("Visita arranca con los dos que tenía", (await docs("visita")).map(d=>d.label), ["Plan de viaje","Reporte"]);

let err = await escribirYApretar("visita", "Reporte de cierre");
eq("apretar + no tira ninguna excepción", err, null);
eq("y el documento queda agregado", (await docs("visita")).map(d=>d.label),
   ["Plan de viaje","Reporte","Reporte de cierre"]);
eq("con su id derivado del nombre", ((await docs("visita"))[2]||{}).id, "reportedecierre");

// Los chips de ESE tipo: cada chip lleva adentro su botón de quitar con
// el data-key, que es lo único que los separa por tipo en el DOM.
// Los documentos se editan en la ficha del tipo (lista + ficha): para
// mirar los de un tipo, primero se abre su ficha.
const chipsDe = key => p.evaluate(k => { window.__abrirTipo(k); return [...document.querySelectorAll(".doc-chip")]
  .filter(c => c.querySelector(`[data-key="${k}"]`))
  .map(c => c.textContent.replace("✕","").trim()); }, key);
eq("se ve dibujado en la pantalla", await chipsDe("visita"),
   ["Plan de viaje","Reporte","Reporte de cierre"]);
eq("y el campo queda vacío para el siguiente", await p.evaluate(()=>getTiposDraft().nuevoDoc.visita), "");

/* Un segundo documento en el mismo tipo */
err = await escribirYApretar("visita", "Rendición de gastos");
eq("se puede agregar otro seguido", err, null);
eq("y quedan los cuatro", (await docs("visita")).map(d=>d.label),
   ["Plan de viaje","Reporte","Reporte de cierre","Rendición de gastos"]);

/* Cada tipo tiene su propia lista */
err = await escribirYApretar("curso", "Lista de asistentes");
eq("agregar en otro tipo no toca el primero", (await docs("visita")).length, 4);
eq("y el otro queda con el suyo", (await docs("curso")).map(d=>d.label), ["Programa","Lista de asistentes"]);

/* Un tipo que arrancó sin ninguno */
err = await escribirYApretar("virtual", "Grabación");
eq("un tipo sin documentos acepta el primero", err, null);
eq("y queda solo ése", (await docs("virtual")).map(d=>d.label), ["Grabación"]);

/* ---------- Casos de borde ---------- */
await p.evaluate(()=>window.__pintarConfig());
eq("el campo vacío no agrega nada", await escribirYApretar("visita", ""), null);
eq("de verdad no agregó", (await docs("visita")).length, 2);
eq("solo espacios tampoco", await escribirYApretar("visita", "   "), null);
eq("sigue sin agregar", (await docs("visita")).length, 2);

/* Dos documentos con el mismo nombre: el id NO se puede repetir, porque es
   lo que ata cada archivo adjuntado a su ranura. */
await escribirYApretar("visita", "Anexo");
await escribirYApretar("visita", "Anexo");
const ids = (await docs("visita")).map(d=>d.id);
eq("dos con el mismo nombre conviven", (await docs("visita")).map(d=>d.label).slice(2), ["Anexo","Anexo"]);
eq("pero con ids distintos", ids.slice(2), ["anexo","anexo2"]);
eq("y ningún id repetido en toda la lista", new Set(ids).size, ids.length);

/* Un nombre que no deja ninguna letra usable */
await p.evaluate(()=>window.__pintarConfig());
await escribirYApretar("visita", "¿¿¿???");
eq("un nombre sin letras ni números igual recibe un id", (((await docs("visita"))[2]||{}).id||"").length > 0, true);

/* Acentos y mayúsculas */
await p.evaluate(()=>window.__pintarConfig());
await escribirYApretar("visita", "Informe Técnico Final");
eq("los acentos y mayúsculas no rompen el id", ((await docs("visita"))[2]||{}).id, "informetecnicofinal");
eq("pero el nombre se guarda tal cual se escribió", ((await docs("visita"))[2]||{}).label, "Informe Técnico Final");

/* El tope */
await p.evaluate(()=>window.__pintarConfig());
for(let i=0; i<12; i++) await escribirYApretar("virtual", "Doc " + i);
eq("no entran más de 10", (await docs("virtual")).length, 10);
eq("y lo dice en vez de fallar en silencio", (await p.evaluate(()=>window.__errorTipos())).includes("10"), true);

/* Quitar */
await p.evaluate(()=>window.__pintarConfig());
eq("quitar no tira excepción", await p.evaluate(()=>window.__clickQuitar("visita", 0)), null);
eq("y saca el que corresponde", (await docs("visita")).map(d=>d.label), ["Reporte"]);

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
