import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:900, height:600 } });
const errores = [];
page.on("pageerror", e=>errores.push("pageerror: " + e.message));
page.on("console", m=>{ if(m.type()==="error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/rechazadas.html");
if(errores.length) console.log("ERRORES DE CARGA:", errores);
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

await page.evaluate(()=>window.setPedidos([
  { email:"spam@x.com", name:"Spam", status:"rejected", requestedAt:1 },
  { email:"otro@x.com", name:"Otro", status:"rejected", requestedAt:2 },
  { email:"espera@x.com", name:"Espera", status:"pending", requestedAt:3 },
]));

// ---- está, es chica, y no es un botón más ----
eq("una ✕ por pedido rechazado", await page.locator(".row-x").count(), 2);
eq("y NO en los pendientes (ahí todavía hay que decidir)",
   await page.locator('.row-x[data-email="espera@x.com"]').count(), 0);
const caja = await page.locator(".row-x").first().boundingBox();
eq("del mismo tamaño que la de ex integrantes (26px)",
   [Math.round(caja.width), Math.round(caja.height)], [26, 26]);
// La app dibuja los PENDIENTES arriba y los rechazados abajo: "la primera
// fila" es la pendiente. Se mira la de un rechazado, que es la que tiene ✕.
const filaRechazada = page.locator('.request-row', { has: page.locator('.row-x') }).first();
eq("va al final de la fila",
   await filaRechazada.evaluate(r=>r.querySelector(".ractions").lastElementChild.classList.contains("row-x")), true);
eq("y no se lee como un botón de acción (sin fondo)",
   await page.locator(".row-x").first().evaluate(e=>getComputedStyle(e).backgroundColor), "rgba(0, 0, 0, 0)");
eq("tiene nombre accesible", await page.locator(".row-x").first().getAttribute("aria-label"), "Borrar el pedido");
eq("el botón de aprobar igual sigue ahí",
   await filaRechazada.locator('[data-action="approve-request"]').count(), 1);

// ---- pregunta antes, y dice la consecuencia que importa ----
await page.evaluate(()=>{ window.__confirmado = false; window.__borrados = []; });
await page.locator('.row-x[data-email="spam@x.com"]').click();
const msg = await page.evaluate(()=>window.__ultimoConfirm);
eq("nombra a quién", msg.includes("spam@x.com"), true);
eq("y avisa lo que de verdad cambia: que va a poder pedir de nuevo",
   msg.includes("pedir acceso de nuevo"), true);
eq("el confirm va en rojo", await page.evaluate(()=>window.__ultimoOpts.danger), true);
eq("si se dice que no, no borra", await page.evaluate(()=>window.__borrados), []);
eq("y la fila sigue", await page.locator(".row-x").count(), 2);

// ---- si se confirma, borra por la capa de datos ----
await page.evaluate(()=>{ window.__confirmado = true; window.__alertas = []; });
await page.locator('.row-x[data-email="spam@x.com"]').click();
eq("borra sin avisar de más", await page.evaluate(()=>window.__alertas), []);
eq("y pasa por la capa de datos",
   await page.evaluate(()=>window.__borrados), ["spam@x.com"]);

// ---- si el servidor lo rechaza, se avisa ----
await page.evaluate(()=>{ window.__falla = true; window.__alertas = []; });
await page.locator('.row-x[data-email="otro@x.com"]').click();
const al = await page.evaluate(()=>window.__alertas);
eq("un rechazo del servidor se cuenta", al[0].includes("No se pudo borrar"), true);
eq("con el motivo", al[0].includes("permiso denegado"), true);
eq("y la fila no desaparece sola", await page.locator(".row-x").count(), 2);

// El "permiso denegado" de arriba lo provoca la prueba a propósito, y que
// quede anotado en la consola es lo correcto: es cómo se entera quien
// tenga que averiguar por qué no se borró.
eq("sin errores de página, salvo el que la prueba provocó",
   errores.filter(e => !e.includes("permiso denegado")), []);
eq("y ese sí queda anotado, que es lo que corresponde",
   errores.some(e => e.includes("permiso denegado")), true);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
