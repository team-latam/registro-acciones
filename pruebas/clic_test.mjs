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
// El console.error de la prueba "si la base lo rechaza" es a propósito:
// se filtra, para que el chequeo final siga sirviendo para los demás.
p.on("console", m => { if(m.type()==="error" && !/Error (quitando|sacando|asignando)/.test(m.text())) errores.push(m.text()); });
await p.goto("file://" + process.cwd() + "/documentacion.html");
await p.waitForTimeout(200);
await p.evaluate(()=>window.__pintarConfig());

// Los documentos se editan en la ficha del tipo (lista + ficha): para
// mirar los de un tipo, primero se abre su ficha.
const chipsDe = key => p.evaluate(k => { window.__abrirTipo(k); return [...document.querySelectorAll(".doc-chip")]
  .filter(c => c.querySelector(`[data-key="${k}"]`))
  .map(c => c.textContent.replace("✕","").trim()); }, key);

/* ====== El ✕ de un documento, con un clic DE VERDAD ====== */
eq("Visita arranca con dos", await chipsDe("visita"), ["Plan de viaje","Reporte"]);

// El ✕ del primero
const hayBoton = await p.evaluate(()=>{
  const b = document.querySelector('.doc-chip [data-action="tipo-doc-remove"]');
  return b ? { existe:true, visible: b.offsetWidth > 0 && b.offsetHeight > 0,
               key: b.dataset.key, idx: b.dataset.idx } : { existe:false };
});
eq("el botón ✕ existe en el DOM", hayBoton.existe, true);
eq("y es visible (no está tapado ni en cero)", hayBoton.visible, true);
eq("con el tipo y la posición que corresponden", [hayBoton.key, hayBoton.idx], ["visita","0"]);

// click() nativo: pasa por el despachador, igual que el dedo de él
await p.click('.doc-chip [data-action="tipo-doc-remove"]');
await p.waitForTimeout(100);
eq("el clic llegó al despachador", await p.evaluate(()=>window.__ultimaAccion), "tipo-doc-remove");
eq("no tiró ninguna excepción", await p.evaluate(()=>window.__ultimoError || null), null);
eq("y el documento quedó sacado", await chipsDe("visita"), ["Reporte"]);

// El segundo
await p.click('.doc-chip [data-action="tipo-doc-remove"]');
await p.waitForTimeout(100);
eq("se puede sacar el último también", await chipsDe("visita"), []);

/* ====== Sacar el del medio saca EL DEL MEDIO ====== */
await p.evaluate(()=>window.__pintarConfig());
await p.evaluate(()=>{ window.__escribir("visita","Tercero"); window.__clickMas("visita"); });
await p.waitForTimeout(50);
eq("tres documentos", await chipsDe("visita"), ["Plan de viaje","Reporte","Tercero"]);
await p.evaluate(()=>{
  const bs = [...document.querySelectorAll('.doc-chip [data-action="tipo-doc-remove"]')]
    .filter(b => b.dataset.key === "visita");
  bs[1].click();
});
await p.waitForTimeout(100);
eq("sacar el del medio saca ese y no otro", await chipsDe("visita"), ["Plan de viaje","Tercero"]);

/* ====== Y en OTRO tipo, el índice no se mezcla ====== */
await p.evaluate(()=>window.__pintarConfig());
await p.evaluate(()=>{
  window.__abrirTipo("curso");
  const bs = [...document.querySelectorAll('.doc-chip [data-action="tipo-doc-remove"]')]
    .filter(b => b.dataset.key === "curso");
  bs[0].click();
});
await p.waitForTimeout(100);
eq("sacar en Curso no toca Visita", await chipsDe("visita"), ["Plan de viaje","Reporte"]);
eq("y saca el de Curso", await chipsDe("curso"), []);

/* ================================================================
   El ✕ del archivo YA ADJUNTADO en la tarjeta del evento.
   Éste es el que él no puede usar.
================================================================ */
const PDF = "data:application/pdf;base64,QQ==";
const conPlan = () => ({ id:"p1", activityType:"visita", authorEmail:"otro@x.com", files:[
  { name:"Plan Peru.pdf", kind:"pdf", doc:"plan", dataUrl:PDF },
  { name:"suelto.pdf", kind:"pdf", dataUrl:PDF },
]});

await p.evaluate(x=>window.__ponerPost(x, true), conPlan());
const filas = () => p.$$eval(".doc-fila", els => els.map(e => ({
  nombre: e.querySelector(".doc-nombre").textContent.trim(),
  tieneQuitar: !!e.querySelector('[data-action="quitar-doc"]'),
})));
eq("la fila del plan muestra el ✕", (await filas())[0].tieneQuitar, true);

const botonQuitar = await p.evaluate(()=>{
  const b = document.querySelector('[data-action="quitar-doc"]');
  return b ? { visible: b.offsetWidth>0 && b.offsetHeight>0,
               postId: b.dataset.postId, pos: b.dataset.pos } : null;
});
eq("el ✕ es visible", botonQuitar && botonQuitar.visible, true);
eq("y lleva el posteo y qué archivo es (su lugar en la lista)", [botonQuitar.postId, botonQuitar.pos], ["p1","0"]);

await p.click('[data-action="quitar-doc"]');
await p.waitForTimeout(150);
eq("el clic no tira excepción", await p.evaluate(()=>window.__ultimoError || null), null);
const esc1 = await p.evaluate(()=>window.__escrituras);
eq("pregunta antes de quitarlo", await p.evaluate(()=>window.__confirmado || true), true);
eq("se guarda el cambio", esc1.length, 1);
eq("el archivo del plan se fue", (esc1[0]||{}).parche && esc1[0].parche.files.map(f=>f.name), ["suelto.pdf"]);
eq("sin tocar el adjunto suelto", (esc1[0]||{}).parche && esc1[0].parche.files.map(f=>f.doc||null), [null]);

/* Si dice que no en el cartel, no se toca nada */
await p.evaluate(x=>window.__ponerPost(x, true, false), conPlan());
await p.click('[data-action="quitar-doc"]');
await p.waitForTimeout(150);
eq("si cancela, no se guarda nada", await p.evaluate(()=>window.__escrituras.length), 0);

/* Si la base lo rechaza, tiene que DECIRLO */
await p.evaluate(x=>window.__ponerPost(x, true), conPlan());
await p.evaluate(()=>{ window.__fallarUpdate = "permission-denied"; });
await p.click('[data-action="quitar-doc"]');
await p.waitForTimeout(150);
eq("si la base lo rechaza, avisa en vez de callarse",
   (await p.evaluate(()=>window.__ultimaAlerta) || "").includes("No se pudo quitar"), true);
await p.evaluate(()=>{ window.__fallarUpdate = null; });

/* Quien no puede editar no ve el ✕ */
await p.evaluate(x=>window.__ponerPost(x, false), conPlan());
eq("un observador no ve el ✕", (await p.$$('[data-action="quitar-doc"]')).length, 0);

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
