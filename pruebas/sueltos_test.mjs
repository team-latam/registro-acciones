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
p.on("console", m => { if(m.type()==="error" && !/Error (quitando|sacando|asignando)/.test(m.text())) errores.push(m.text()); });
await p.goto("file://" + process.cwd() + "/documentacion.html");
await p.waitForTimeout(200);
eq("la página levanta sin errores", errores, []);

const PDF = "data:application/pdf;base64,QQ==";
const DOCX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ==";
const SUBIDO = "2026-10-02T15:30:00.000Z";

const leer = () => p.evaluate(()=>({
  cuenta: (document.querySelector(".doc-cuenta")||{}).textContent,
  hayCombo: !!document.querySelector('[data-action="doc-elegir"], select'),
  filas: [...document.querySelectorAll(".doc-fila")].map(e=>({
    nombre: e.querySelector(".doc-nombre").textContent.trim(),
    falta: e.classList.contains("falta"),
    archivo: (e.querySelector(".doc-archivo")||{}).textContent,
    fecha: (e.querySelector(".doc-fecha")||{}).textContent || null,
    tieneQuitar: !!e.querySelector('[data-action="quitar-doc"]'),
  })),
  sueltos: [...document.querySelectorAll(".post-file-row")].map(e=>({
    texto: e.textContent.replace("✕","").trim(),
    fecha: (e.querySelector(".doc-fecha")||{}).textContent || null,
    tieneQuitar: !!e.querySelector('[data-action="quitar-adjunto"]'),
  })),
}));
const escrituras = () => p.evaluate(()=>window.__escrituras);

/* ====== El combobox no va más ====== */
await p.evaluate(x=>window.__ponerPost(x, true), { id:"p1", activityType:"visita", authorEmail:"x@x.com",
  files:[{ name:"Eze Sept 28th.docx", kind:"doc", dataUrl:DOCX }] });
let v = await leer();
eq("no hay ningún desplegable", v.hayCombo, false);
eq("la ranura vacía ofrece adjuntar y nada más",
   await p.$$eval(".doc-fila.falta", els => els.map(e => e.querySelectorAll("button, a, select").length)), [1,1]);

/* ====== Un adjunto suelto se puede quitar, y el ✕ está al lado ====== */
eq("el suelto tiene su ✕", v.sueltos[0].tieneQuitar, true);
const lejos = await p.evaluate(()=>{
  const fila = document.querySelector(".post-file-row");
  const arch = fila.querySelector(".post-file-link, .fname");
  const x = fila.querySelector('[data-action="quitar-adjunto"]');
  return Math.round(x.getBoundingClientRect().left - arch.getBoundingClientRect().right);
});
eq("y está pegado al archivo, no en la otra punta", lejos >= 0 && lejos < 40, true);

/* ====== La fecha de subida, suave pero presente ====== */
await p.evaluate(x=>window.__ponerPost(x, true), { id:"p1", activityType:"visita", authorEmail:"x@x.com", files:[
  { name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF, subidoEl:SUBIDO },
  { name:"suelto.pdf", kind:"pdf", dataUrl:PDF, subidoEl:SUBIDO },
  { name:"viejo.pdf", kind:"pdf", dataUrl:PDF }]});
v = await leer();
eq("el documento de la ranura muestra cuándo se subió", v.filas[0].fecha, "02/10/2026");
eq("el adjunto suelto también", v.sueltos[0].fecha, "02/10/2026");
eq("y un archivo de antes, que no la tiene, no inventa nada", v.sueltos[1].fecha, null);
const suave = await p.evaluate(()=>{
  const e = document.querySelector(".doc-fecha");
  const c = getComputedStyle(e);
  return { tam: parseFloat(c.fontSize), op: parseFloat(c.opacity) };
});
eq("es más chica que el texto normal", suave.tam <= 11, true);
eq("y va atenuada", suave.op < 1, true);

/* ====== El ✕ de la ranura: pregunta, y quita ====== */
await p.evaluate(()=>{ window.__escrituras = []; });
await p.evaluate(x=>window.__ponerPost(x, true, false), { id:"p1", activityType:"visita", authorEmail:"x@x.com",
  files:[{ name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF }] });
await p.click('[data-action="quitar-doc"]');
await p.waitForTimeout(120);
eq("si cancela, no pasa nada", (await escrituras()).length, 0);

await p.evaluate(x=>window.__ponerPost(x, true, true), { id:"p1", activityType:"visita", authorEmail:"x@x.com",
  files:[{ name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF }, { name:"otro.pdf", kind:"pdf", dataUrl:PDF }] });
await p.click('[data-action="quitar-doc"]');
await p.waitForTimeout(120);
let esc = await escrituras();
eq("si confirma, lo quita del evento", esc[0].parche.files.map(f=>f.name), ["otro.pdf"]);

/* ====== Con varios sueltos, saca el que se apretó ====== */
await p.evaluate(x=>window.__ponerPost(x, true, true), { id:"p2", activityType:"visita", authorEmail:"x@x.com", files:[
  { name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"uno.pdf", kind:"pdf", dataUrl:PDF },
  { name:"dos.docx", kind:"doc", dataUrl:DOCX },
  { name:"tres.pdf", kind:"pdf", dataUrl:PDF }]});
v = await leer();
eq("se dibujan los tres sueltos (el Word ya no se baja: abre en el visor)", v.sueltos.map(s=>s.texto), ["📄 uno.pdf","📘 dos.docx","📄 tres.pdf"]);
await p.evaluate(()=>{ window.__escrituras = []; });
await p.evaluate(()=>document.querySelectorAll('[data-action="quitar-adjunto"]')[1].click());
await p.waitForTimeout(120);
esc = await escrituras();
eq("saca el del medio y no otro", esc[0].parche.files.map(f=>f.name), ["plan.pdf","uno.pdf","tres.pdf"]);

/* ====== Quien no puede editar no ve ningún ✕ ====== */
await p.evaluate(x=>window.__ponerPost(x, false), { id:"p2", activityType:"visita", authorEmail:"x@x.com", files:[
  { name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF }, { name:"uno.pdf", kind:"pdf", dataUrl:PDF }]});
v = await leer();
eq("un observador no ve ✕ en los sueltos", v.sueltos.every(s=>!s.tieneQuitar), true);
eq("ni en la ranura", v.filas.every(f=>!f.tieneQuitar), true);
eq("pero sí la fecha y el archivo", v.filas[0].archivo !== undefined, true);

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
