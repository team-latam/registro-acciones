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
await p.waitForTimeout(300);

eq("se dibuja sin un solo error", errores, []);

/* ---------- La sección en la tarjeta ---------- */
const filas = await p.$$eval(".doc-fila", els => els.map(e => ({
  falta: e.classList.contains("falta"),
  nombre: e.querySelector(".doc-nombre").textContent.trim(),
  archivo: e.querySelector(".doc-archivo")?.textContent.trim() || null,
  etiqueta: e.querySelector(".doc-archivo")?.tagName || null,
  tieneQuitar: !!e.querySelector('[data-action="quitar-doc"]'),
  tieneAdjuntar: !!e.querySelector('[data-action="adjuntar-doc"]'),
})));
eq("una fila por documento esperado", filas.length, 3);
eq("en el orden configurado", filas.map(f=>f.nombre), ["Plan de viaje","Reporte","Rendición de gastos"]);
eq("el plan está adjuntado", [filas[0].falta, filas[0].archivo], [false, "📄 Plan de viaje - Peru 2026.pdf"]);
eq("el reporte también", [filas[1].falta, filas[1].archivo], [false, "📘 Reporte de la visita a Lima.docx ↓"]);
eq("la rendición falta", [filas[2].falta, filas[2].archivo], [true, null]);

eq("un PDF abre en el visor (es un botón)", filas[0].etiqueta, "BUTTON");
eq("un Word se baja (es un enlace)", filas[1].etiqueta, "A");
eq("lo adjuntado se puede quitar", filas.map(f=>f.tieneQuitar), [true, true, false]);
eq("lo que falta se puede adjuntar", filas.map(f=>f.tieneAdjuntar), [false, false, true]);

const cuenta = await p.$eval(".doc-cuenta", e => ({ txt: e.textContent.trim(), completo: e.classList.contains("completo") }));
eq("la cuenta dice cuántos hay de cuántos", cuenta.txt, "2/3");
eq("y no está marcada como completa", cuenta.completo, false);

const descarga = await p.$eval('a.doc-archivo', e => e.getAttribute("download"));
eq("el enlace baja con el nombre del archivo", descarga, "Reporte de la visita a Lima.docx");

/* ---------- Todo completo ---------- */
await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:"data:application/pdf;base64,QQ==" },
  { name:"b.pdf", kind:"pdf", doc:"reporte", dataUrl:"data:application/pdf;base64,QQ==" },
  { name:"c.pdf", kind:"pdf", doc:"gastos", dataUrl:"data:application/pdf;base64,QQ==" }]}, true));
await p.waitForTimeout(100);
const completo = await p.$eval(".doc-cuenta", e => ({ txt:e.textContent.trim(), completo:e.classList.contains("completo") }));
eq("con todo adjuntado dice 3/3", completo.txt, "3/3");
eq("y se marca como completa", completo.completo, true);

/* ---------- Nada adjuntado ---------- */
await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[] }, true));
await p.waitForTimeout(100);
eq("sin nada, igual se ven las tres filas", (await p.$$(".doc-fila")).length, 3);
eq("las tres como pendientes", (await p.$$(".doc-fila.falta")).length, 3);
eq("y la cuenta en 0/3", await p.$eval(".doc-cuenta", e=>e.textContent.trim()), "0/3");

/* ---------- Quien no puede editar ---------- */
await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:"data:application/pdf;base64,QQ==" }]}, false));
await p.waitForTimeout(100);
eq("un observador no ve botones de adjuntar", (await p.$$('[data-action="adjuntar-doc"]')).length, 0);
eq("ni de quitar", (await p.$$('[data-action="quitar-doc"]')).length, 0);
eq("pero sí puede abrir lo que hay", (await p.$$(".doc-archivo")).length, 1);
eq("y ve qué falta", (await p.$$(".doc-pendiente")).length, 2);

/* ---------- Un tipo sin documentos esperados ---------- */
await p.evaluate(()=> window.__sinDocs());
await p.waitForTimeout(100);
eq("un tipo sin documentos no dibuja la sección (no molesta a las Rutinas)",
   (await p.$$(".doc-bloque")).length, 0);

/* ---------- Un archivo roto no rompe la fila ---------- */
await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[
  { name:"malo", kind:"pdf", doc:"plan", dataUrl:"javascript:alert(1)" }]}, true));
await p.waitForTimeout(100);
eq("un dataUrl que no se acepta no genera un enlace", (await p.$$(".doc-archivo")).length, 0);
eq("y se avisa en su lugar", (await p.$$(".doc-roto")).length, 1);

/* ---------- El editor de Configuración ---------- */
await p.evaluate(()=> window.__pintarConfig());
await p.waitForTimeout(150);
const porTipo = await p.$$eval(".tipo-docs", els => els.map(e => ({
  chips: [...e.querySelectorAll(".doc-chip")].map(c=>c.textContent.replace("✕","").trim()),
  tieneInput: !!e.querySelector(".doc-nuevo-input"),
  tieneAgregar: !!e.querySelector('[data-action="tipo-doc-add"]'),
})));
eq("una línea de documentos por tipo", porTipo.length, 3);
eq("Visita trae los suyos", porTipo[0].chips, ["Plan de viaje","Reporte"]);
eq("Curso el suyo", porTipo[1].chips, ["Programa"]);
eq("y un tipo sin documentos queda listo para sumarle", porTipo[2].chips, []);
eq("todos con dónde escribir uno nuevo", porTipo.map(x=>x.tieneInput && x.tieneAgregar), [true,true,true]);
const quitables = await p.$$('[data-action="tipo-doc-remove"]');
eq("cada documento configurado se puede quitar", quitables.length, 3);

/* ---------- En un teléfono ---------- */
await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[
  { name:"Reporte final de la visita a Lima, Peru - version 3.docx", kind:"doc", doc:"reporte",
    dataUrl:"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ==" }]}, true));
await p.setViewportSize({ width: 380, height: 800 });
await p.waitForTimeout(150);
const desborde = await p.evaluate(()=> document.documentElement.scrollWidth > window.innerWidth + 1);
eq("a 380px, con un nombre largo, no se va de la pantalla", desborde, false);
await p.screenshot({ path:"docs_angosto.png", fullPage:true });

await p.evaluate(()=> window.__pintarTarjeta({ id:"p1", activityType:"visita", files:[
  { name:"Plan de viaje - Peru 2026.pdf", kind:"pdf", doc:"plan", dataUrl:"data:application/pdf;base64,QQ==" },
  { name:"Reporte de la visita a Lima.docx", kind:"doc", doc:"reporte",
    dataUrl:"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ==" }]}, true));
await p.setViewportSize({ width: 820, height: 700 });
await p.waitForTimeout(150);
await p.screenshot({ path:"docs_ancho.png", fullPage:true });
await p.evaluate(()=> window.__pintarConfig());
await p.waitForTimeout(150);
await p.screenshot({ path:"docs_config.png", fullPage:true });

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
