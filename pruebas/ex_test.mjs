import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const b = await chromium.launch();
const page = await b.newPage({ viewport:{ width:900, height:600 } });
const errores = [];
page.on("pageerror", e=>errores.push("pageerror: " + e.message));
page.on("console", m=>{ if(m.type()==="error") errores.push("console: " + m.text()); });
await page.goto("file://" + process.cwd() + "/ex.html");
if(errores.length) console.log("ERRORES DE CARGA:", errores);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const JULIA = { email:"julia@x.com", name:"Julia G", nickname:"julia", approvedAt:1, revokedAt:2 };
const SOFIA = { email:"sofia@x.com", name:"Sofia P", nickname:"sofia", approvedAt:1, revokedAt:3 };
await page.evaluate(([j,s])=>window.setFormers([j,s], [{ authorEmail:"julia@x.com" },{ authorEmail:"julia@x.com" }]), [JULIA, SOFIA]);

// ---- la ✕ está, es chica y no es un botón más ----
eq("una ✕ por ex integrante", await page.locator(".row-x").count(), 2);
const caja = await page.locator(".row-x").first().boundingBox();
eq("es chica (26px)", [Math.round(caja.width), Math.round(caja.height)], [26, 26]);
const otros = await page.locator(".request-row").first().locator(".ractions button:not(.row-x)").count();
eq("los otros tres botones siguen ahí", otros, 3);
eq("va al final de la fila",
   await page.locator(".request-row").first().evaluate(r=>r.querySelector(".ractions").lastElementChild.classList.contains("row-x")), true);
eq("tiene nombre accesible",
   await page.locator(".row-x").first().getAttribute("aria-label"), "Borrar de la lista");
eq("y no se lee como los botones de acción (sin borde ni fondo)",
   await page.locator(".row-x").first().evaluate(e=>getComputedStyle(e).backgroundColor), "rgba(0, 0, 0, 0)");

// ---- pregunta antes, y dice qué se pierde ----
await page.evaluate(()=>{ window.__confirmado = false; window.__borradosStore = []; });
await page.locator('.row-x[data-email="julia@x.com"]').click();
const msg = await page.evaluate(()=>window.__ultimoConfirm);
eq("avisa que es para siempre", msg.includes("Es para siempre"), true);
eq("nombra a quién", msg.includes("julia@x.com"), true);
eq("dice cuántos posteos deja", msg.includes("Dejó 2 posteos") || msg.includes("2 posteos"), true);
eq("y que se van a quedar sin @nickname", msg.includes("@julia"), true);
eq("el confirm va en rojo", await page.evaluate(()=>window.__ultimoOpts.danger), true);
eq("si se dice que no, no borra", await page.evaluate(()=>window.__borradosStore), []);
eq("y la fila sigue", await page.locator(".row-x").count(), 2);

// ---- sin posteos, el aviso lo dice ----
await page.evaluate(()=>window.setFormers([{ email:"sofia@x.com", name:"Sofia P", nickname:"sofia", approvedAt:1, revokedAt:3 }], []));
await page.locator('.row-x[data-email="sofia@x.com"]').click();
eq("sin posteos, lo aclara", (await page.evaluate(()=>window.__ultimoConfirm)).includes("No dejó posteos"), true);

// ---- si se confirma, borra ----
await page.evaluate(()=>{ window.__confirmado = true; window.__falla = false; window.__alertas = []; });
await page.locator('.row-x[data-email="sofia@x.com"]').click();
eq("borra sin avisar de más", await page.evaluate(()=>window.__alertas), []);
eq("y el borrado pasó por la capa de datos, no por Firestore directo",
   await page.evaluate(()=>window.__borradosStore), ["sofia@x.com"]);

// ---- si Firestore lo rechaza, se avisa ----
await page.evaluate(()=>{ window.__falla = true; window.__alertas = []; });
await page.locator('.row-x[data-email="sofia@x.com"]').click();
eq("un rechazo del servidor se cuenta", (await page.evaluate(()=>window.__alertas))[0].includes("No se pudo borrar"), true);
eq("con el motivo", (await page.evaluate(()=>window.__alertas))[0].includes("permiso denegado"), true);
eq("y la fila no desaparece sola", await page.locator(".row-x").count(), 1);

// El caso de falla que provoca el propio test hace un console.error a
// propósito (para que quede rastro en la consola del navegador): no
// cuenta como error de página.
const inesperados = errores.filter(e => !e.includes("permiso denegado"));
eq("sin errores de página inesperados", inesperados, []);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
await b.close();
process.exit(fail ? 1 : 0);
