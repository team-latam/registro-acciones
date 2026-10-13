/* ======================================================================
   La barra de desplazamiento (opción A, elegida el 8/10/2026)

   Fina, petróleo suave; celeste al pasar el mouse; petróleo al
   arrastrarla; clara en el modo oscuro. Solo en la computadora: en el
   celular sigue la del teléfono, que no ocupa lugar. La de la página, en
   claro, petróleo pleno (el 30 % se veía gris), con el costado del
   encabezado pintado como el encabezado y el riel arrancando debajo
   (pedido del usuario, 8/10/2026).

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
// Dónde está el medio del pulgar de la barra de la página: el riel
// arranca debajo del encabezado.
const medioDelPulgar = p => p.evaluate(() => {
  const h = innerHeight, sh = document.documentElement.scrollHeight;
  const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
  const riel = h - hh, alto = Math.max(44, riel * h / sh);
  return { x: document.documentElement.clientWidth + 6, y: Math.round(hh + scrollY / (sh - h) * (riel - alto) + alto / 2), hh };
});
// Una caja que se desliza, de fondo liso, para mirar una barra de adentro.
const cajaDePrueba = (p, fondo) => p.evaluate(fondo => {
  const d = document.createElement("div"); d.id = "cajaDePrueba";
  d.style.cssText = `position:fixed;top:300px;left:100px;width:200px;height:120px;overflow:auto;z-index:999;background:${fondo}`;
  d.innerHTML = '<div style="height:600px"></div>'; document.body.append(d);
  return { x: 100 + 200 - 6, y: 300 + 20 };
}, fondo);

for(const oscuro of [false, true]){
  const modo = oscuro ? "en oscuro" : "en claro";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 600 }, dark: oscuro });
  await tab(p, "calendario"); await p.waitForTimeout(300);
  await p.mouse.move(300, 300);
  eq(`${modo}: la página se desplaza (hay barra que mirar)`, await p.evaluate(() => document.documentElement.scrollHeight > innerHeight), true);
  eq(`${modo}: la barra de la página ocupa 12 px`, await p.evaluate(() => innerWidth - document.documentElement.clientWidth), 12);
  const m = await medioDelPulgar(p);
  const fondo = oscuro ? [10, 23, 25] : [244, 248, 248];
  const cabecera = oscuro ? [14, 58, 62] : [8, 42, 44];
  cerca(`${modo}: la de la página en reposo, ${oscuro ? "clara" : "petróleo pleno"}`, await pixel(p, m.x, m.y), oscuro ? mezcla([198, 228, 230], .3, fondo) : [13, 59, 62]);
  // El costado del encabezado, del color del encabezado; y arriba de todo
  // el pulgar no se mete ahí (arranca debajo).
  eq(`${modo}: la página está arriba de todo`, await p.evaluate(() => scrollY), 0);
  cerca(`${modo}: al costado del encabezado, el color del encabezado`, await pixel(p, m.x, Math.round(m.hh / 2)), cabecera, 6);
  cerca(`${modo}: el pulgar no se mete al costado del encabezado`, await pixel(p, m.x, Math.round(m.hh) - 3), cabecera, 6);
  cerca(`${modo}: y arranca justo debajo`, await pixel(p, m.x, Math.round(m.hh) + 8), oscuro ? mezcla([198, 228, 230], .3, fondo) : [13, 59, 62]);
  // A 1 px del borde del pulgar en reposo (6 px de ancho, centrado): vacío.
  cerca(`${modo}: en reposo es fina (el borde del riel, vacío)`, await pixel(p, m.x - 5, m.y), fondo, 14);
  await p.mouse.move(m.x, m.y); await p.waitForTimeout(80);
  cerca(`${modo}: con el mouse encima, celeste`, await pixel(p, m.x, m.y), oscuro ? [111, 216, 236] : [26, 159, 184]);
  cerca(`${modo}: con el mouse encima, más gruesa`, await pixel(p, m.x - 3, m.y), oscuro ? [111, 216, 236] : [26, 159, 184]);
  await p.mouse.down(); await p.waitForTimeout(80);
  cerca(`${modo}: arrastrándola, ${oscuro ? "más clara" : "más oscura"}`, await pixel(p, m.x, m.y), oscuro ? [198, 228, 230] : [8, 42, 44], 6);
  await p.mouse.up(); await p.mouse.move(300, 300);
  // Las de adentro no cambiaron: petróleo suave (en oscuro, clara).
  const fondoCaja = oscuro ? [0, 0, 0] : [255, 255, 255];
  const c = await cajaDePrueba(p, `rgb(${fondoCaja.join(",")})`); await p.waitForTimeout(60);
  cerca(`${modo}: una barra de adentro sigue suave`, await pixel(p, c.x, c.y), mezcla(oscuro ? [198, 228, 230] : [13, 59, 62], .3, fondoCaja));
  await p.evaluate(() => document.getElementById("cajaDePrueba").remove());
  // Una ventana angosta con mouse: el encabezado cambia de alto (a 640 px
  // pasa al diseño de celular, más bajo) y el tramo pintado lo sigue.
  await p.evaluate(() => scrollTo(0, 0)); await p.setViewportSize({ width: 640, height: 600 }); await p.waitForTimeout(250);
  const m2 = await medioDelPulgar(p);
  eq(`${modo}: a 640 px el encabezado cambia de alto (hay qué seguir)`, Math.abs(m2.hh - m.hh) > 4, true);
  cerca(`${modo}: con el encabezado de ${m2.hh} px, el tramo pintado llega hasta ahí`, await pixel(p, m2.x, Math.round(m2.hh) - 3), cabecera, 6);
  cerca(`${modo}: y el pulgar arranca justo debajo`, await pixel(p, m2.x, Math.round(m2.hh) + 8), oscuro ? mezcla([198, 228, 230], .3, fondo) : [13, 59, 62]);
  await p.setViewportSize({ width: 1280, height: 600 }); await p.waitForTimeout(150);
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

// La portada (sin sesión) tiene fondo petróleo y no tiene encabezado: la
// barra va clara y arranca arriba de todo, sin tramo pintado.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 420 }, sinSesion: true });
  await p.waitForTimeout(400);
  eq("en la portada, la página se desplaza (hay barra que mirar)", await p.evaluate(() => document.body.classList.contains("en-portada") && document.documentElement.scrollHeight > innerHeight), true);
  const x = await p.evaluate(() => document.documentElement.clientWidth + 6);
  const luz = c => c[0] + c[1] + c[2];
  const pulgar = await pixel(p, x, 12), riel = await pixel(p, x - 5, 12);
  eq(`en la portada, la barra se ve clara sobre el petróleo, desde arriba (${pulgar} sobre ${riel})`, luz(pulgar) - luz(riel) > 120, true);
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
