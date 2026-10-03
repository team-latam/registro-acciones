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

// Los seis campos: tres del panel con Firebase, tres con Supabase.
eq("hay tres controles por base", campos.length, 6);
eq("con los mismos identificadores de siempre", campos.slice(0,3).map(c=>c.id),
   ["adjMaxImages","adjMaxFiles","adjMaxFileSize"]);

/* ---------- Con Firebase, todo como estaba ---------- */
eq("imágenes: arranca en 6 y no deja pasar de 6",
   [campos[0].value, campos[0].max], ["6","6"]);
eq("archivos: 2 y 2", [campos[1].value, campos[1].max], ["2","2"]);
eq("tamaño: 150, tope 500", [campos[2].value, campos[2].max], ["150","500"]);
eq("y el campo va en KB", unidades[0], "KB");

/* ---------- Con Supabase, soltado ---------- */
eq("imágenes: 20 y 20", [campos[3].value, campos[3].max], ["20","20"]);
eq("archivos: 10 y 10", [campos[4].value, campos[4].max], ["10","10"]);
eq("tamaño: arranca en 10, tope 25", [campos[5].value, campos[5].max], ["10","25"]);
eq("y el campo va en MB, que es lo que se puede escribir a mano", unidades[1], "MB");
eq("de a 1 MB por paso", campos[5].step, "1");

/* ---------- Lo que dice, no solo lo que vale ---------- */
eq("cada control dice el tope de SU base",
   [subs[0].includes("6"), subs[3].includes("20")], [true, true]);
eq("y el del tamaño lo dice en palabras",
   [subs[2].includes("500 KB"), subs[5].includes("25 MB")], [true, true]);
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
