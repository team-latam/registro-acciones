/* ======================================================================
   La barra de desplazamiento (opción A, elegida el 8/10/2026)

   Fina, petróleo suave; celeste al pasar el mouse; petróleo al
   arrastrarla; clara en el modo oscuro. Solo en la computadora: en el
   celular sigue la del teléfono, que no ocupa lugar.

   El resto de las pruebas esconde las barras (Playwright las oculta por
   defecto); esta las muestra, mide cuánto ocupa la de la página y mira el
   color del pulgar en la captura.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { chromium } from "playwright";
import { entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const cerca = (n, rgb, esperado, tol = 10) => eq(`${n} (${rgb.join(",")} ≈ ${esperado.join(",")})`, rgb.every((c, i) => Math.abs(c - esperado[i]) <= tol), true);
// rgba sobre un fondo, como lo pinta el navegador.
const mezcla = (c, a, fondo) => c.map((x, i) => Math.round(x * a + fondo[i] * (1 - a)));

const b = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });

// El color de un punto de la pantalla (una captura de 1×1).
const pixel = async (p, x, y) => {
  const png = await p.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return await p.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = c.height = 1; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, png.toString("base64"));
};
// Dónde está el medio del pulgar de la barra de la página.
const medioDelPulgar = p => p.evaluate(() => {
  const h = innerHeight, sh = document.documentElement.scrollHeight;
  const alto = Math.max(44, h * h / sh);
  return { x: document.documentElement.clientWidth + 6, y: Math.round(scrollY / (sh - h) * (h - alto) + alto / 2) };
});

for(const oscuro of [false, true]){
  const modo = oscuro ? "en oscuro" : "en claro";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 600 }, dark: oscuro });
  await tab(p, "calendario"); await p.waitForTimeout(300);
  await p.mouse.move(300, 300);
  eq(`${modo}: la página se desplaza (hay barra que mirar)`, await p.evaluate(() => document.documentElement.scrollHeight > innerHeight), true);
  eq(`${modo}: la barra de la página ocupa 12 px`, await p.evaluate(() => innerWidth - document.documentElement.clientWidth), 12);
  const m = await medioDelPulgar(p);
  const fondo = oscuro ? [10, 23, 25] : [244, 248, 248];
  cerca(`${modo}: en reposo, petróleo suave`, await pixel(p, m.x, m.y), oscuro ? mezcla([198, 228, 230], .3, fondo) : mezcla([13, 59, 62], .3, fondo));
  // A 1 px del borde del pulgar en reposo (6 px de ancho, centrado): vacío.
  cerca(`${modo}: en reposo es fina (el borde del riel, vacío)`, await pixel(p, m.x - 5, m.y), fondo, 14);
  await p.mouse.move(m.x, m.y); await p.waitForTimeout(80);
  cerca(`${modo}: con el mouse encima, celeste`, await pixel(p, m.x, m.y), oscuro ? [111, 216, 236] : [26, 159, 184]);
  cerca(`${modo}: con el mouse encima, más gruesa`, await pixel(p, m.x - 3, m.y), oscuro ? [111, 216, 236] : [26, 159, 184]);
  await p.mouse.down(); await p.waitForTimeout(80);
  cerca(`${modo}: arrastrándola, oscura`, await pixel(p, m.x, m.y), oscuro ? [198, 228, 230] : [13, 59, 62]);
  await p.mouse.up();
  // Ningún elemento le pone scrollbar-width (salvo none, para esconderla)
  // ni scrollbar-color: en Chrome eso apaga el estilo de la barra ahí.
  const pisan = [];
  for(const v of ["feed", "calendario", "paises", "proyectos", "reportes"]){
    await tab(p, v); await p.waitForTimeout(250);
    pisan.push(...await p.evaluate(v => [...document.querySelectorAll("*")].filter(e => { const cs = getComputedStyle(e); return !["auto", "none"].includes(cs.scrollbarWidth) || cs.scrollbarColor !== "auto"; })
      .map(e => `${v}: ${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`), v));
  }
  eq(`${modo}: nada pisa la barra con scrollbar-width o scrollbar-color`, [...new Set(pisan)], []);
  eq(`${modo}: sin un solo error en la página`, errores, []);
  await p.close();
}

// En el celular, la barra del teléfono: no ocupa lugar.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 700 } });
  await tab(p, "calendario"); await p.waitForTimeout(300);
  const lista = await p.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "overflow:auto;height:50px;width:200px"; d.innerHTML = '<div style="height:400px"></div>'; document.body.append(d); const w = d.offsetWidth - d.clientWidth; d.remove(); return w; });
  eq("en el celular, una lista que se desliza no pierde ancho por la barra", lista, 0);
  await p.close();
}
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
