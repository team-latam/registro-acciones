/* ======================================================================
   Reportes sin huecos (pedido del usuario, 8/10/2026)

   En una pantalla ancha, «Por zona», «Por país» y «Por tipo» dejaban un
   cuarto lugar vacío al lado (la grilla hacía lugar para cuatro), y en una
   mediana la tercera tarjeta quedaba sola con medio renglón vacío. Lo
   mismo en el PDF, en Todos los años y en Comparar. El usuario eligió no
   llenarlo con una tarjeta más sino que las tres ocupen el ancho.

   Recorre las tres pantallas de Reportes en varios anchos y en papel, y
   en cada grilla mira renglón por renglón que las tarjetas lleguen de un
   borde al otro.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Cada renglón de cada grilla, de borde a borde. Devuelve los que no.
const huecos = p => p.evaluate(() => {
  const out = [];
  for(const g of document.querySelectorAll(".rep-grilla, .rep-extras")){
    const rg = g.getBoundingClientRect();
    if(!rg.width) continue;
    const hijos = [...g.children].map(h => h.getBoundingClientRect()).filter(r => r.width && r.height);
    const renglones = new Map();
    for(const r of hijos){
      const k = Math.round(r.top);
      const x = renglones.get(k) || { izq: Infinity, der: -Infinity, n: 0 };
      x.izq = Math.min(x.izq, r.left); x.der = Math.max(x.der, r.right); x.n++;
      renglones.set(k, x);
    }
    // Una tarjeta alta (País) puede abarcar dos renglones de las cortas:
    // cuenta como llenando los renglones que cruza.
    for(const [top, x] of renglones){
      const cruzan = hijos.filter(r => Math.round(r.top) < top && r.bottom > top + 1);
      const izq = Math.min(x.izq, ...cruzan.map(r => r.left)), der = Math.max(x.der, ...cruzan.map(r => r.right));
      if(izq - rg.left > 2 || rg.right - der > 2)
        out.push(`${g.className} (${[...g.querySelectorAll(":scope > * h3")].map(h => h.textContent.trim()).join(", ")}): renglón con ${x.n} tarjeta(s) y ${Math.round(rg.right - der + izq - rg.left)} px vacíos`);
    }
  }
  return out;
});

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
await tab(p, "reportes"); await p.waitForTimeout(400);
const anio = String(new Date().getFullYear());
const PANTALLAS = [
  ["Un período", async () => { await p.click('[data-action="reporte-modo"][data-key="periodo"]'); await p.selectOption("#repAnio", anio); }],
  ["Todos los años", async () => { await p.click('[data-action="reporte-modo"][data-key="periodo"]'); await p.selectOption("#repAnio", "todos"); }],
  ["Comparar", async () => { await p.click('[data-action="reporte-modo"][data-key="periodo"]'); await p.selectOption("#repAnio", anio); await p.click('[data-action="reporte-modo"][data-key="comparar"]'); }],
];
const encontrados = [];
for(const [nombre, ir] of PANTALLAS){
  await p.emulateMedia({ media: "screen" });
  await p.setViewportSize({ width: 1440, height: 900 });
  await ir(); await p.waitForTimeout(250);
  const grillas = await p.$$eval(".rep-grilla", gs => gs.length);
  eq(`${nombre}: hay grillas que revisar`, grillas > 0, true);
  // 1920 a 390: la pantalla ancha del pedido (1137), las medianas donde la
  // tercera quedaba sola, y el celular.
  for(const ancho of [1920, 1440, 1280, 1180, 1137, 1100, 1080, 1000, 900, 821, 800, 700, 600, 390]){
    await p.setViewportSize({ width: ancho, height: 900 }); await p.waitForTimeout(60);
    encontrados.push(...(await huecos(p)).map(x => `${nombre} a ${ancho} px: ${x}`));
  }
  // En papel (una hoja A4 de ancho).
  await p.emulateMedia({ media: "print" });
  await p.setViewportSize({ width: 718, height: 1000 }); await p.waitForTimeout(60);
  encontrados.push(...(await huecos(p)).map(x => `${nombre} en el PDF: ${x}`));
}
eq("ninguna grilla de Reportes deja un lugar vacío al lado de una tarjeta", encontrados, []);
eq("sin un solo error en la página", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
