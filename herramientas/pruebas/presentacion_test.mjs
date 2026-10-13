/* ======================================================================
   El modo presentación de Reportes (13/10/2026, propuesta 3-C)

   El usuario eligió «Modo presentación» —pantalla completa, una diapositiva
   por tema, con flechas— y pidió además poder imprimir o exportar lo que se
   genera. Lo que esta prueba cuida:
   - «▶ Presentar» arma las diapositivas con lo que el reporte tiene en pantalla
     (los mismos números), una por tema, y las que no tienen nada no están;
   - flechas, Inicio, Fin, puntos y botones; en hebreo (de derecha a izquierda)
     las flechas se invierten; Escape sale y el foco vuelve al botón;
   - «Imprimir / PDF» arma una hoja por diapositiva, apaisada, y se vuelve a lo de antes;
   - en el celular no se sale de la pantalla.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, post, ciudad, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const cierre = { v: 2, partes: [{ tipo: "cierre", fuente: { name: "Formulario de Cierre.docx" }, lugar: "Rosario, Argentina", duracion: "", ejecutivo: "",
  objetivos: [{ t: "Conocer a los jóvenes del club", logrado: "si" }, { t: "Presentar el curso de verano", logrado: "si" }, { t: "Anotar 20 inscriptos", logrado: "parcial" }], pasos: [] }] };
// Datos controlados: todo pasó hoy (así siempre cae en el año en curso) y una visita dentro de 20 días.
const datos = () => {
  const base = BASE();
  base.replies = [];
  base.posts = [
    post({ id: "q1", title: "Visita con Cierre", d: 0, start: dia(0), end: dia(0), a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")], extra: { resumen: cierre } }),
    post({ id: "q2", title: "Curso de verano", d: 0, start: dia(0), end: dia(0), a: 2, type: "curso", scopes: [ciudad("Uruguay", "Montevideo")] }),
    post({ id: "q3", title: "Visita a Santiago", d: 0, start: dia(0), end: dia(0), a: 1, type: "visita", scopes: [ciudad("Chile", "Santiago")] }),
    post({ id: "q4", title: "Seminario de seguridad", d: 0, start: dia(0), end: dia(0), a: 3, type: "seminario", scopes: [{ type: "region", region: "Cono Sur" }] }),
    post({ id: "q5", title: "Visita a San Pablo", d: -20, start: dia(-20), end: dia(-20), a: 0, type: "visita", scopes: [ciudad("Brasil", "São Paulo")] }),
  ];
  return base;
};
const vp = { width: 1280, height: 800 };
const b = await abrirNavegador();

// Lo que se dibuja: los títulos de las diapositivas (por los puntos) y la actual.
const titulos = p => p.$$eval("#presPuntos .pres-punto", l => l.map(e => e.getAttribute("aria-label")));
const actual = p => p.evaluate(() => [document.getElementById("presCuenta").textContent.trim(), (document.querySelector("#presEscena .ps-tit") || {}).textContent]);
const abrir = async p => { await tab(p, "reportes"); await p.waitForSelector(".rep-total-num"); await p.click('[data-action="reporte-presentar"]'); await p.waitForSelector("#presOverlay:not([hidden]) .ps-slide"); };

{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  const numerosDelReporte = await p.$$eval(".rep-kpis .rep-kpi-num", l => l.map(e => e.textContent.trim()));
  const anio = new Date().toISOString().slice(0, 4);
  eq("la barra de Reportes ofrece «▶ Presentar»", await p.$eval('[data-action="reporte-presentar"]', e => e.textContent.trim()), "▶ Presentar");
  await p.click('[data-action="reporte-presentar"]'); await p.waitForSelector("#presOverlay:not([hidden]) .ps-slide");
  eq("se abre una ventana accesible, con el foco adentro", await p.evaluate(() => [document.getElementById("presOverlay").getAttribute("role"), document.getElementById("presOverlay").getAttribute("aria-modal"), document.getElementById("presOverlay").contains(document.activeElement)]), ["dialog", "true", true]);
  eq("la primera diapositiva: el título del reporte y el período", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), /Registro de Acciones/.test(document.querySelector("#presEscena .ps-cap").textContent)]), [`Reporte ${anio}`, true]);
  eq("…con los mismos cuatro números que el reporte de atrás", await p.$$eval("#presEscena .ps-nums b", l => l.map(e => e.textContent.trim())), numerosDelReporte);
  const t = await titulos(p);
  eq("las diapositivas: números, dónde, qué se hizo, mes a mes, lo logrado y lo que viene", t.length, 6);
  eq("«Diapositiva 1 de 6»", (await actual(p))[0], "Diapositiva 1 de 6");
  eq("el botón de atrás está apagado en la primera", await p.$eval("#presAnt", e => e.disabled), true);

  await p.keyboard.press("ArrowRight");
  eq("flecha derecha: la siguiente, «Dónde estuvimos», con los países y cuántas actividades cada uno", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), [...document.querySelectorAll("#presEscena .ps-barras li")].map(li => li.querySelector(".ps-et").textContent.trim() + ":" + li.querySelector("b").textContent)]).then(([t, l]) => [t, l.sort()]),
    ["Dónde estuvimos", ["Argentina:1", "Chile:1", "Uruguay:1"]]);
  await p.keyboard.press("ArrowRight");
  eq("«Qué hicimos»: por tipo", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), document.querySelectorAll("#presEscena .ps-barras li").length]), ["Qué hicimos", 3]);
  await p.keyboard.press("ArrowRight");
  eq("«Mes a mes»: doce columnas", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), document.querySelectorAll("#presEscena .ps-col").length]), ["Mes a mes", 12]);
  eq("…y como hay una planeada (barra rayada), una leyenda dice qué es lo rayado", await p.evaluate(() => [document.querySelectorAll("#presEscena .ps-barra.plan").length > 0, /Rayado: actividades planeadas/.test((document.querySelector("#presEscena .ps-leyenda") || {}).textContent || "")]), [true, true]);
  await p.keyboard.press("ArrowRight");
  eq("«Lo logrado»: 2 de 3 objetivos, y cuáles", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), document.querySelector("#presEscena .ps-nums b").textContent, document.querySelector("#presEscena .ps-nums span").textContent.trim(), [...document.querySelectorAll("#presEscena .ps-lista li")].map(e => e.textContent.trim())]),
    ["Lo logrado", "2", "de 3 objetivos logrados", ["✓ Conocer a los jóvenes del club", "✓ Presentar el curso de verano"]]);
  await p.keyboard.press("ArrowRight");
  eq("«Lo que viene»: la visita de dentro de 20 días", await p.evaluate(() => [document.querySelector("#presEscena .ps-tit").textContent.trim(), [...document.querySelectorAll("#presEscena .ps-lista li")].map(e => /Visita a San Pablo/.test(e.textContent))]), ["Lo que viene", [true]]);
  eq("en la última, el botón de adelante está apagado", await p.$eval("#presSig", e => e.disabled), true);
  await p.keyboard.press("ArrowRight");
  eq("y más allá de la última no pasa nada", (await actual(p))[0], "Diapositiva 6 de 6");
  await p.keyboard.press("Home");
  eq("Inicio vuelve a la primera", (await actual(p))[0], "Diapositiva 1 de 6");
  await p.keyboard.press("End");
  eq("Fin va a la última", (await actual(p))[0], "Diapositiva 6 de 6");
  await p.click('#presPuntos .pres-punto:nth-child(3)');
  eq("un punto lleva a esa diapositiva", await actual(p), ["Diapositiva 3 de 6", "Qué hicimos"]);
  await p.click("#presSig"); await p.click("#presAnt"); await p.click("#presAnt");
  eq("los botones ‹ › también", (await actual(p))[0], "Diapositiva 2 de 6");

  // Imprimir / PDF: una hoja por diapositiva, y se vuelve a lo de antes.
  await p.evaluate(() => { window.__imp = null; window.print = () => { window.__imp = { hojas: document.querySelectorAll("#presPrint .pres-pagina").length, clase: document.body.classList.contains("pres-imprimiendo"), titulos: [...document.querySelectorAll("#presPrint .ps-tit")].map(e => e.textContent.trim()) };
    setTimeout(() => window.dispatchEvent(new Event("afterprint")), 0); }; });
  await p.click('[data-action="pres-imprimir"]');
  await p.waitForFunction(() => window.__imp);
  eq("«Imprimir / PDF»: una hoja por diapositiva, con la app escondida", await p.evaluate(() => window.__imp.hojas + " " + window.__imp.clase + " " + window.__imp.titulos[0]), `6 true Reporte ${anio}`);
  await p.waitForTimeout(200);
  eq("…y después queda todo como antes", await p.evaluate(() => [!!document.getElementById("presPrint"), document.body.classList.contains("pres-imprimiendo"), document.getElementById("presOverlay").hidden]), [false, false, false]);

  // Salir.
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  eq("Escape sale de la presentación, y el foco vuelve al botón «Presentar»", await p.evaluate(() => [document.getElementById("presOverlay").hidden, document.activeElement.dataset.action]), [true, "reporte-presentar"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

// Un reporte sin nada no ofrece presentar; con un filtro, las diapositivas son de ese filtro.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  await p.click('[data-action="reporte-filtros"]'); await p.selectOption("#repFPais", "Uruguay"); await p.click('.rep-filtros-pie [data-action="reporte-filtros"]'); await p.waitForTimeout(300);
  await p.click('[data-action="reporte-presentar"]'); await p.waitForSelector("#presOverlay:not([hidden]) .ps-slide");
  eq("con «Ver solo Uruguay»: una sola actividad en la primera diapositiva", await p.$eval("#presEscena .ps-nums b", e => e.textContent.trim()), "1");
  eq("…y sin diapositiva de lo logrado ni de lo que viene (nada de eso es de Uruguay)", (await titulos(p)).some(x => /logrado|viene/i.test(x)), false);
  await p.close();
}
{
  const base = datos(); base.posts = [];
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base });
  await tab(p, "reportes"); await p.waitForTimeout(400);
  eq("sin nada cargado, no se ofrece presentar", await p.$$('[data-action="reporte-presentar"]').then(l => l.length), 0);
  await p.close();
}

// En hebreo, de derecha a izquierda: las flechas se invierten.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "he", base: datos() });
  await abrir(p);
  eq("en hebreo, el botón «siguiente» lleva ‹", await p.evaluate(() => [document.getElementById("presSig").textContent, document.getElementById("presAnt").textContent]), ["‹", "›"]);
  await p.keyboard.press("ArrowLeft");
  eq("…y la flecha izquierda avanza", (await actual(p))[0].includes("2"), true);
  await p.keyboard.press("ArrowRight");
  eq("…y la derecha vuelve", (await actual(p))[0].includes("1"), true);
  await p.close();
}

// En el celular: entra en la pantalla y se pasa con el dedo.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 780 }, lang: "es", base: datos() });
  await abrir(p);
  eq("en el celular, nada se sale de la pantalla", await p.evaluate(() => { const o = document.getElementById("presOverlay"), s = document.querySelector("#presEscena .ps-slide").getBoundingClientRect(); return [o.scrollWidth <= o.clientWidth, s.left >= 0, s.right <= innerWidth]; }), [true, true, true]);
  await p.evaluate(() => {
    const el = document.getElementById("presEscena");
    const toque = (tipo, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 }); el.dispatchEvent(new TouchEvent(tipo, { touches: tipo === "touchend" ? [] : [t], changedTouches: [t], bubbles: true })); };
    toque("touchstart", 300); toque("touchend", 80);
  });
  eq("deslizar el dedo hacia la izquierda pasa a la siguiente", (await actual(p))[0], "Diapositiva 2 de 6");
  await p.evaluate(() => {
    const el = document.getElementById("presEscena");
    const toque = (tipo, x) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 }); el.dispatchEvent(new TouchEvent(tipo, { touches: tipo === "touchend" ? [] : [t], changedTouches: [t], bubbles: true })); };
    toque("touchstart", 80); toque("touchend", 300);
  });
  eq("y hacia la derecha, a la anterior", (await actual(p))[0], "Diapositiva 1 de 6");
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
