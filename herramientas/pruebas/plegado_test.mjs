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

const PDF = "data:application/pdf;base64,QQ==";
// El harness congela "hoy" en 2026-10-02, así que esto no depende del día.
const PASADO = "2026-09-20", FUTURO = "2026-12-01", HOY = "2026-10-02";
const post = (extra={}) => ({ id:"p1", activityType:"visita", authorEmail:"x@x.com", files:[], ...extra });
const conPlan = extra => post({ files:[{ name:"plan.pdf", kind:"pdf", doc:"plan", dataUrl:PDF }], ...extra });

const pintar = (x, auto=true) => p.evaluate(([v,a])=>window.__ponerPost(v, true, true, a), [x, auto]);
const ver = () => p.evaluate(()=>{
  const linea = document.querySelector(".doc-linea");
  return {
    hayLinea: !!linea,
    abierto: !!document.querySelector(".doc-abierto"),
    filas: document.querySelectorAll(".doc-fila").length,
    texto: linea ? linea.innerText.replace(/\s+/g," ").trim() : null,
    detalle: linea ? linea.getAttribute("title") : null,
    completo: linea ? linea.classList.contains("ok") : null,
    tarde: linea ? linea.classList.contains("tarde") : null,
    expandido: linea ? linea.getAttribute("aria-expanded") : null,
    botonesAdentro: linea ? linea.querySelectorAll("button, a, select").length : null,
  };
});

/* ====== Cerrada es una pastilla con la cuenta (rediseño del 6/10/2026) ====== */
await pintar(post({ date: FUTURO }));
let v = await ver();
eq("cerrado: no se dibuja la caja", v.abierto, false);
eq("ni una sola fila de detalle", v.filas, 0);
eq("pero sí la pastilla", v.hayLinea, true);
eq("que dice la cuenta", v.texto, "📄 0/2 documentos");
eq("y cada documento con su estado al pasar el mouse", v.detalle, "Documentación: ○ Plan de viaje · ○ Reporte");
eq("y se anuncia cerrado para un lector de pantalla", v.expandido, "false");
eq("adentro del botón no hay otros botones (HTML inválido)", v.botonesAdentro, 0);

await pintar(conPlan({ date: FUTURO }));
v = await ver();
eq("con uno subido, la cuenta sube", v.texto, "📄 1/2 documentos");
eq("y el detalle marca ése con ✓", v.detalle, "Documentación: ✓ Plan de viaje · ○ Reporte");
eq("y todavía no está completo", v.completo, false);

await pintar(post({ date: FUTURO, files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"b.pdf", kind:"pdf", doc:"reporte", dataUrl:PDF }]}));
v = await ver();
eq("completo: 2/2", v.texto, "📄 2/2 documentos");
eq("y la pastilla se marca como completa", v.completo, true);
eq("completo y callado: sigue cerrado", v.abierto, false);
eq("la cuenta también se marca", await p.$eval(".doc-cuenta", e=>e.classList.contains("completo")), true);

/* ====== En amarillo cuando el evento ya pasó y falta algo, sin abrirse ====== */
await pintar(post({ date: PASADO }));
v = await ver();
eq("un evento que ya pasó con documentos faltando se pinta de amarillo", [v.tarde, v.texto], [true, "📄 0/2 documentos · faltan"]);
eq("pero no se abre solo: ocupaba media tarjeta", v.abierto, false);

await pintar(post({ date: FUTURO }));
eq("uno que todavía no pasó, no", (await ver()).tarde, false);

await pintar(post({ date: HOY }));
eq("el de hoy tampoco: todavía no terminó", (await ver()).tarde, false);

await pintar(post({ date: PASADO, files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"b.pdf", kind:"pdf", doc:"reporte", dataUrl:PDF }]}));
eq("si ya pasó pero está completo, no hay nada que pedir", (await ver()).tarde, false);

await pintar(post({ startDate: PASADO, endDate: FUTURO }));
eq("un evento largo que todavía no terminó, tampoco", (await ver()).tarde, false);

await pintar(post({ startDate: "2026-09-01", endDate: PASADO }));
eq("uno largo que ya terminó, sí", (await ver()).tarde, true);

await pintar(post({}));
eq("sin fecha no se inventa nada", (await ver()).tarde, false);

/* ====== Se abre y se cierra a mano, y se recuerda ====== */
await pintar(post({ date: FUTURO }));
await p.click(".doc-linea");
await p.waitForTimeout(80);
eq("al tocarla se abre la lista", (await ver()).abierto, true);
eq("con la elección guardada", await p.evaluate(()=>window.__estadoDocs("p1")), true);
eq("con sus dos filas", (await ver()).filas, 2);
await p.evaluate(()=>window.__repintar("p1"));
eq("y sobrevive a que se redibuje la pantalla", (await ver()).abierto, true);
await p.click(".doc-linea");
await p.waitForTimeout(80);
eq("y volver a tocarla la cierra", (await ver()).abierto, false);
eq("también anotado", await p.evaluate(()=>window.__estadoDocs("p1")), false);

/* ====== Abierta, está todo lo de antes ====== */
await pintar(conPlan({ date: PASADO }), true);
await p.click(".doc-linea");
await p.waitForTimeout(80);
v = await ver();
eq("abierta a mano", v.abierto, true);
eq("con sus dos filas", v.filas, 2);
eq("y se anuncia abierta", v.expandido, "true");
eq("se puede abrir el que está", (await p.$$('[data-action="open-doc"], a.doc-archivo')).length, 1);
eq("adjuntar el que falta", (await p.$$('.doc-adjuntar')).length, 1);
eq("y sumarle otro al que está, con el +", (await p.$$('.doc-agregar')).length, 1);
eq("y sacar el que está de su ranura", (await p.$$('[data-action="quitar-doc"]')).length, 1);

/* ====== Si el tipo no espera documentos, no se dibuja nada ====== */
await pintar(post({ activityType:"rutina", date: PASADO }));
eq("una Rutina no muestra ninguna pastilla", (await ver()).hayLinea, false);

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
