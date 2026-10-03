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
await p.goto("file://" + process.cwd() + "/puerta.html");
await p.waitForTimeout(200);
eq("la página levanta sin un solo error", errores, []);

const USUARIO = { email:"ana@team-latam.com", displayName:"Ana" };
const mirar = () => p.evaluate(()=>({
  texto: document.getElementById("raiz").innerText.replace(/\s+/g," ").trim(),
  acciones: [...document.querySelectorAll("[data-action]")].map(e=>e.dataset.action),
}));

/* ================= 1. "Cargando…" mientras es razonable ================= */
await p.evaluate(a=>window.__puerta(a), { status:"loading", user:USUARIO, padronConocido:false, demorado:false });
let g = await mirar();
eq("al principio dice Cargando", g.texto, "⏳ Cargando…");
eq("y no ofrece nada más (todavía no hay nada que contar)", g.acciones, []);

/* ================= 2. Cuando se pasa de tiempo, HAY SALIDA ============== */
await p.evaluate(a=>window.__puerta(a), { status:"loading", user:USUARIO, padronConocido:false, demorado:true });
g = await mirar();
eq("deja de prometer y lo dice", g.texto.includes("tardando más de lo normal"), true);
eq("nombra la cuenta con la que no pudo", g.texto.includes("ana@team-latam.com"), true);
eq("dice que la base no contesta, no un error genérico", g.texto.includes("la base no contesta"), true);
eq("dice a quién avisarle", g.texto.includes("Administrador"), true);
eq("y las dos salidas que antes no existían", g.acciones, ["reload-page","sign-out"]);

/* ---- esto es lo que importa: antes esta pantalla NO tenía salida ---- */
const sinSalida = await p.evaluate(a=>{
  window.__puerta(a);
  return document.querySelectorAll('[data-action="sign-out"]').length;
}, { status:"loading", user:USUARIO, padronConocido:false, demorado:true });
eq("se puede cerrar sesión y probar con otra cuenta", sinSalida, 1);

/* ================= 3. Las otras pantallas, intactas =================== */
await p.evaluate(a=>window.__puerta(a), { status:"signedOut", user:null });
g = await mirar();
// Desde la tanda 8 la portada también ofrece los cuatro idiomas (set-lang),
// además del botón de Google que sigue siendo la única forma de entrar.
eq("la de inicio sigue ofreciendo Google", g.acciones, ["google-signin","set-lang","set-lang","set-lang","set-lang"]);
await p.evaluate(a=>window.__puerta(a), { status:"pending", user:USUARIO, requestStatus:"pending" });
g = await mirar();
eq("la de pendiente sigue igual", g.acciones, ["sign-out"]);
eq("y sigue nombrando la cuenta", g.texto.includes("ana@team-latam.com"), true);
await p.evaluate(a=>window.__puerta(a), { status:"rejected", user:USUARIO, requestStatus:"rejected" });
eq("la de rechazado sigue con sus dos botones", (await mirar()).acciones, ["request-again","sign-out"]);

/* ====== 4. El visor abre EL archivo del botón, no el de al lado ====== */
const PDF = "data:application/pdf;base64,QQ==";
const DOCX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ==";
const MP3 = "data:audio/mpeg;base64,QQ==";

// Un posteo con documentación esperada: el plan y el reporte ocupan ranura
// (NO se dibujan acá), y quedan tres sueltos. Antes el handler contaba
// sobre los cinco y abría corrido.
const conDocs = { id:"p1", activityType:"visita", files:[
  { name:"plan.pdf",     kind:"pdf",  doc:"plan",    dataUrl:PDF },
  { name:"reporte.docx", kind:"doc",  doc:"reporte", dataUrl:DOCX },
  { name:"suelto-1.pdf", kind:"pdf",  dataUrl:PDF },
  { name:"suelto-2.txt", kind:"texto",dataUrl:"data:text/plain;base64,QQ==" },
  { name:"suelto-3.pdf", kind:"pdf",  dataUrl:PDF },
]};
await p.evaluate(x=>window.__pintarArchivos(x), conDocs);
const botones = await p.$$eval('[data-action="open-file-preview"]',
  els => els.map(e => ({ nombre: e.textContent.trim().replace(/^\S+\s/,""), idx: e.dataset.idx })));
eq("la tarjeta dibuja solo los sueltos", botones.map(x=>x.nombre), ["suelto-1.pdf","suelto-2.txt","suelto-3.pdf"]);
eq("con índices 0,1,2 dentro de ESA lista", botones.map(x=>x.idx), ["0","1","2"]);
for(let i=0; i<botones.length; i++){
  eq(`clic en «${botones[i].nombre}» abre ese archivo`, await p.evaluate(k=>window.__clickear(k), i), botones[i].nombre);
}

/* Sin documentación esperada, nada cambia respecto de antes */
const sinDocs = { id:"p2", activityType:"rutina", files:[
  { name:"a.pdf",  kind:"pdf",   dataUrl:PDF },
  { name:"voz.mp3",kind:"audio", dataUrl:MP3 },
  { name:"b.docx", kind:"doc",   dataUrl:DOCX },
  { name:"c.pdf",  kind:"pdf",   dataUrl:PDF },
]};
await p.evaluate(x=>window.__pintarArchivos(x), sinDocs);
const b2 = await p.$$eval('[data-action="open-file-preview"]',
  els => els.map(e => ({ nombre: e.textContent.trim().replace(/^\S+\s/,""), idx: e.dataset.idx })));
eq("el audio y el Word no son botones del visor", b2.map(x=>x.nombre), ["a.pdf","c.pdf"]);
for(let i=0; i<b2.length; i++){
  eq(`sin docs, clic en «${b2[i].nombre}» abre ese archivo`, await p.evaluate(k=>window.__clickear(k), i), b2[i].nombre);
}

/* Un comentario: no tiene activityType, así que se dibujan todos */
const comentario = { id:"r1", files:[
  { name:"uno.pdf", kind:"pdf", dataUrl:PDF },
  { name:"dos.pdf", kind:"pdf", dataUrl:PDF },
]};
await p.evaluate(x=>window.__pintarArchivos(x), comentario);
eq("en un comentario se ven los dos", (await p.$$('[data-action="open-file-preview"]')).length, 2);
eq("y el segundo abre el segundo", await p.evaluate(()=>window.__clickear(1)), "dos.pdf");

/* Un archivo con dataUrl inválido no se dibuja ni descoloca al resto */
await p.evaluate(x=>window.__pintarArchivos(x), { id:"p3", activityType:"visita", files:[
  { name:"roto.pdf", kind:"pdf", dataUrl:"javascript:alert(1)" },
  { name:"bueno.pdf", kind:"pdf", dataUrl:PDF },
]});
eq("el archivo con url inválida no se dibuja", (await p.$$('[data-action="open-file-preview"]')).length, 1);
eq("y el que queda abre bien", await p.evaluate(()=>window.__clickear(0)), "bueno.pdf");

eq("ni un error en toda la corrida", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
