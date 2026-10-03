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
    completo: linea ? linea.classList.contains("ok") : null,
    expandido: linea ? linea.getAttribute("aria-expanded") : null,
    botonesAdentro: linea ? linea.querySelectorAll("button, a, select").length : null,
  };
});

/* ====== El renglón cerrado tiene que alcanzar ====== */
await pintar(post({ date: FUTURO }));
let v = await ver();
eq("cerrado: no se dibuja la caja", v.abierto, false);
eq("ni una sola fila de detalle", v.filas, 0);
eq("pero sí el renglón", v.hayLinea, true);
eq("que dice la cuenta y cada documento con su estado", v.texto,
   "📄 Documentación 0/2 · ○ Plan de viaje · ○ Reporte ▼");
eq("y se anuncia cerrado para un lector de pantalla", v.expandido, "false");
eq("adentro del botón no hay otros botones (HTML inválido)", v.botonesAdentro, 0);

await pintar(conPlan({ date: FUTURO }));
v = await ver();
eq("con uno subido, ése va con ✓ y el otro con ○", v.texto,
   "📄 Documentación 1/2 · ✓ Plan de viaje · ○ Reporte ▼");
eq("y todavía no está completo", v.completo, false);

await pintar(post({ date: FUTURO, files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"b.pdf", kind:"pdf", doc:"reporte", dataUrl:PDF }]}));
v = await ver();
eq("completo: los dos con ✓", v.texto, "📄 Documentación 2/2 · ✓ Plan de viaje · ✓ Reporte ▼");
eq("y el renglón entero se marca como completo", v.completo, true);
eq("completo y callado: sigue cerrado", v.abierto, false);
eq("la cuenta también se marca", await p.$eval(".doc-cuenta", e=>e.classList.contains("completo")), true);

/* ====== Se abre solo cuando falta algo Y el evento ya pasó ====== */
await pintar(post({ date: PASADO }));
eq("un evento que ya pasó con documentos faltando se abre solo", (await ver()).abierto, true);

await pintar(post({ date: FUTURO }));
eq("uno que todavía no pasó, no", (await ver()).abierto, false);

await pintar(post({ date: HOY }));
eq("el de hoy tampoco: todavía no terminó", (await ver()).abierto, false);

await pintar(post({ date: PASADO, files:[
  { name:"a.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"b.pdf", kind:"pdf", doc:"reporte", dataUrl:PDF }]}));
eq("si ya pasó pero está completo, no hay nada que pedir", (await ver()).abierto, false);

await pintar(post({ startDate: PASADO, endDate: FUTURO }));
eq("un evento largo que todavía no terminó, cerrado", (await ver()).abierto, false);

await pintar(post({ startDate: "2026-09-01", endDate: PASADO }));
eq("uno largo que ya terminó, abierto", (await ver()).abierto, true);

await pintar(post({}));
eq("sin fecha no se inventa nada: cerrado", (await ver()).abierto, false);

/* ====== Lo que elige la persona manda sobre la regla ====== */
await pintar(post({ date: PASADO }));
eq("arranca abierto por la regla", (await ver()).abierto, true);
await p.click(".doc-linea");
await p.waitForTimeout(80);
eq("y si lo cierra, queda cerrado", (await ver()).abierto, false);
eq("con la elección guardada", await p.evaluate(()=>window.__estadoDocs("p1")), false);
await p.evaluate(()=>window.__repintar("p1"));
eq("y sobrevive a que se redibuje la pantalla", (await ver()).abierto, false);

await p.click(".doc-linea");
await p.waitForTimeout(80);
eq("volver a abrirlo también se recuerda", (await ver()).abierto, true);
eq("ahora sí se dibujan las filas", (await ver()).filas, 2);

await pintar(post({ date: FUTURO }));
eq("otro evento arranca cerrado", (await ver()).abierto, false);
await p.click(".doc-linea");
await p.waitForTimeout(80);
eq("abrirlo a mano funciona aunque la regla diga que no", (await ver()).abierto, true);
eq("y queda anotado", await p.evaluate(()=>window.__estadoDocs("p1")), true);

/* ====== Abierto, está todo lo de antes ====== */
await pintar(conPlan({ date: PASADO }), true);
v = await ver();
eq("abierto por la regla", v.abierto, true);
eq("con sus dos filas", v.filas, 2);
eq("el chevron apunta para arriba", v.texto.endsWith("▲"), true);
eq("y se anuncia abierto", v.expandido, "true");
eq("se puede abrir el que está", (await p.$$('[data-action="open-doc"], a.doc-archivo')).length, 1);
eq("adjuntar el que falta", (await p.$$('[data-action="adjuntar-doc"]')).length, 1);
eq("y sacar el que está de su ranura", (await p.$$('[data-action="quitar-doc"]')).length, 1);

/* ====== Si el tipo no espera documentos, no se dibuja nada ====== */
await pintar(post({ activityType:"rutina", date: PASADO }));
eq("una Rutina no muestra ningún renglón", (await ver()).hayLinea, false);

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
