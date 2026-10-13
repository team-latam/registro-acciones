/* ======================================================================
   El «Me gusta»: la ramita de olivo, siempre la misma (13/10/2026)

   El usuario vio que el «Me gusta» cambiaba de un corazón a un pulgar para
   arriba y pidió un solo ícono, y que fuera algo propio de LatAm: la ramita
   de olivo del logo de Sala Segura. Lo que esta prueba cuida:
   - es el mismo dibujo apagado (todavía no te gustó) y encendido (ya te
     gustó), en los posteos, en las respuestas y en el conteo que ven los
     observadores; ya no hay ningún 👍 ni 🤍;
   - se enciende y se apaga al tocarlo, con el botón avisando su estado;
   - apagado toma el color del texto, más suave; encendido, el verde del logo;
   - se lee: unos 17 píxeles (como el emoji de los botones de al lado), y en el celular, donde la palabra se esconde,
     sigue ahí;
   - la estrella de la hoja de arriba es un recorte de verdad (se ve el fondo
     por ella) y el borde no se la come.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const datos = () => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  return base;
};
const b = await abrirNavegador();
const boton = '.post[data-post-id="p1"] [data-action="toggle-like"]';          // al admin ya le gustó
const otro = '.post:not([data-post-id="p1"]) [data-action="toggle-like"]';     // el primero que no le gusta

/* ---- En la compu ---- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos() });
  await p.waitForSelector(boton);
  eq("hay un solo dibujo de la ramita en la página, con su recorte para la estrella (evenodd)",
     await p.evaluate(() => [document.querySelectorAll("symbol#icoOlivo").length, document.querySelector("clipPath#icoOlivoCorte path").getAttribute("clip-rule")]), [1, "evenodd"]);
  eq("al que ya le gustó: la ramita encendida, y ni rastro del pulgar ni del corazón",
     await p.$eval(boton, e => [!!e.querySelector('svg.ico-gusta.on use[href="#icoOlivo"]'), /👍|🤍/.test(e.textContent), e.getAttribute("aria-pressed"), e.classList.contains("liked")]), [true, false, "true", true]);
  eq("al que todavía no: la misma ramita, apagada", await p.$eval(otro, e => [!!e.querySelector('svg.ico-gusta:not(.on) use[href="#icoOlivo"]'), /👍|🤍/.test(e.textContent), e.getAttribute("aria-pressed")]), [true, false, "false"]);
  eq("apagada y encendida son el mismo dibujo: solo cambia la clase",
     await p.evaluate(([a, o]) => document.querySelector(a).querySelector("svg").outerHTML.replace(" on", "") === document.querySelector(o).querySelector("svg").outerHTML, [boton, otro]), true);

  // Los colores.
  const col = sel => p.$eval(sel + " svg", (e, s) => { const c = getComputedStyle(e), btn = getComputedStyle(e.closest("button")); return [c.fill, c.stroke, c.opacity, btn.color]; }, sel);
  const on = await col(boton), off = await col(otro);
  eq("encendida: el verde del logo, sin transparencia", [on[0], on[1], on[2]], ["rgb(0, 152, 105)", "rgb(0, 152, 105)", "1"]);
  eq("apagada: el color del texto del botón, más suave", [off[0] === off[3], off[1] === off[3], Number(off[2]) < 1 && Number(off[2]) >= .5], [true, true, true]);
  // El tamaño: un poco más grande que la letra.
  const caja = await p.$eval(boton + " svg", e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  eq("mide unos 17 píxeles: el alto del 💬 de al lado y un pelo más (no los 15 de antes, ni los 22 de la primera versión)", [caja[0] >= 16 && caja[0] <= 19, caja[0] === caja[1]], [true, true]);

  // Tocar: se enciende y se apaga.
  await p.$eval(otro, e => e.scrollIntoView({ block: "center" }));
  const id = await p.$eval(otro, e => e.dataset.postId);
  const suyo = `.post[data-post-id="${id}"] [data-action="toggle-like"]`;
  await p.click(suyo);
  await p.waitForFunction(s => document.querySelector(s).getAttribute("aria-pressed") === "true", suyo);
  eq("al tocarlo se enciende y el botón lo avisa", await p.$eval(suyo, e => [!!e.querySelector("svg.ico-gusta.on"), e.classList.contains("liked")]), [true, true]);
  await p.click(suyo);
  await p.waitForFunction(s => document.querySelector(s).getAttribute("aria-pressed") === "false", suyo);
  eq("y al tocarlo otra vez se apaga, con el mismo dibujo", await p.$eval(suyo, e => [!!e.querySelector("svg.ico-gusta:not(.on)"), e.classList.contains("liked"), /👍|🤍/.test(e.textContent)]), [true, false, false]);

  // Las respuestas.
  await p.$eval('.post[data-post-id="p1"]', e => e.scrollIntoView({ block: "start" }));
  const hilo = '.post[data-post-id="p1"] [data-action="toggle-thread"]';
  if(await p.$eval(hilo, e => e.getAttribute("aria-expanded")) !== "true") await p.click(hilo);
  await p.waitForSelector('[data-action="toggle-like"][data-reply-id="r3"]');
  eq("en las respuestas, lo mismo: encendida en la que le gustó (r3) y apagada en la otra (r1)",
     await p.evaluate(() => ["r3", "r1"].map(id => { const e = document.querySelector(`[data-action="toggle-like"][data-reply-id="${id}"]`); return [!!e.querySelector("svg.ico-gusta" + (id === "r3" ? ".on" : ":not(.on)")), /👍|🤍/.test(e.textContent)]; })), [[true, false], [true, false]]);

  // La estrella es un agujero: sobre un fondo rojo, el centro de la estrella es rojo y la hoja, verde.
  await p.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend", '<div id="prueba" style="position:fixed;left:20px;top:20px;width:200px;height:200px;background:#f00;z-index:99999"><svg class="ico-gusta on" style="width:200px;height:200px;margin:0;stroke-width:0" viewBox="0 0 580 569"><use href="#icoOlivo"/></svg></div>');
  });
  const png = (await (await p.$("#prueba")).screenshot()).toString("base64");
  const px = await p.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const k = img.width / 200, de = (x, y) => Array.from(g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data.slice(0, 3));
    // El centro de la estrella (480,103 en el dibujo) y un punto de la hoja de abajo a la izquierda (150,345).
    const f = 200 / 580, oy = (200 - 569 * f) / 2;
    return { estrella: de((480.3 - 15) * f, (102.8 - 15) * f + oy), hoja: de((150 - 15) * f, (345 - 15) * f + oy) };
  }, png);
  eq("el centro de la estrella deja ver el fondo (rojo) y la hoja es verde", [px.estrella, px.hoja], [[255, 0, 0], [0, 152, 105]]);
  await p.evaluate(() => document.getElementById("prueba").remove());
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Un observador: ve el conteo, con la misma ramita ---- */
{
  const { p } = await entrar(b, OBS, "Olga Observa", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos() });
  await p.waitForSelector(".post-likes-ro");
  eq("el observador no puede tocar, pero ve la ramita encendida junto a los nombres, sin 👍",
     await p.$eval('.post[data-post-id="p1"] .post-likes-ro', e => [!!e.querySelector("svg.ico-gusta.on"), /👍/.test(e.textContent), e.textContent.trim().length > 0]), [true, false, true]);
  await p.close();
}

/* ---- En el celular, donde la palabra se esconde ---- */
for (const tema of ["claro", "oscuro"]) {
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 800 }, lang: "es", base: datos() });
  if(tema === "oscuro") await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await p.waitForSelector(boton);
  eq(`celular (${tema}): la palabra se esconde y la ramita sigue ahí, del mismo tamaño`,
     await p.$eval(boton, e => { const l = e.querySelector(".pa-l"), r = e.querySelector("svg").getBoundingClientRect(); return [getComputedStyle(l).display, Math.round(r.width) >= 16, e.getAttribute("aria-label")]; }), ["none", true, "Me gusta"]);
  eq(`celular (${tema}): no se sale de la pantalla`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
