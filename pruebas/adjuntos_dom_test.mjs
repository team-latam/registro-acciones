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
await p.goto("file://" + process.cwd() + "/adjuntos.html");
await p.waitForTimeout(300);

eq("el panel se dibuja sin un solo error", errores, []);

const campos = await p.evaluate(()=>window.__leer());
const unidades = await p.evaluate(()=>window.__unidades());
const subs = await p.evaluate(()=>window.__subs());

eq("hay tres controles", campos.map(c=>c.id), ["adjMaxImages","adjMaxFiles","adjMaxFileSize"]);
eq("imágenes: arranca en 20 y no deja pasar de 20", [campos[0].value, campos[0].max], ["20","20"]);
eq("archivos: 10 y 10", [campos[1].value, campos[1].max], ["10","10"]);
eq("tamaño: arranca en 10, tope 25", [campos[2].value, campos[2].max], ["10","25"]);
eq("y el campo va en MB, que es lo que se puede escribir a mano", unidades[0], "MB");
eq("de a 1 MB por paso", campos[2].step, "1");

/* ---------- Lo que dice, no solo lo que vale ---------- */
eq("cada control dice el tope de la base", subs[0].includes("20"), true);
eq("y el del tamaño lo dice en palabras", subs[2].includes("25 MB"), true);
eq("ninguno sigue hablando de topes duros del código",
   subs.filter(s=>/tope duro|hard cap/i.test(s)), []);

/* ---------- Que entre en un teléfono ---------- */
await p.setViewportSize({ width: 380, height: 800 });
await p.waitForTimeout(150);
const desborde = await p.evaluate(()=> document.documentElement.scrollWidth > window.innerWidth + 1);
eq("a 380px de ancho no se va de la pantalla", desborde, false);
await p.screenshot({ path: "adjuntos_angosto.png", fullPage: true });
await p.setViewportSize({ width: 900, height: 1000 });
await p.waitForTimeout(150);
await p.screenshot({ path: "adjuntos_ancho.png", fullPage: true });

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
