/* ======================================================================
   El aviso de un formulario se anuncia y lleva al campo (auditoría del 28/10/2026, T3)

   Apretar «Publicar» sin título mostraba «Escribí un título.» como una línea
   chica y roja abajo de todo, lejos del campo que falta, y nada más: ni el
   cursor iba al campo, ni el campo se marcaba como inválido, ni un lector de
   pantalla anunciaba el aviso. Ahora:
   - todo aviso de formulario es role="alert" (lo anuncia el lector);
   - en el evento, el aviso de un dato que falta (título, lugar, fecha, hora)
     queda atado a su campo: el campo lleva aria-invalid y aria-describedby, y
     el cursor cae ahí (en el celular, también queda a la vista);
   - un error que no es de un campo (la base rechazó guardar) se anuncia igual
     pero no marca ninguno.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// Estático: todo aviso de formulario lleva su role="alert"; solo el de la ventana del evento pasa por htmlFormError (el que sabe de campos).
const avisos = html.match(/<div class="form-error"[^>]*>/g) || [];
eq("todo aviso de formulario escrito en el código lleva role=\"alert\"", avisos.filter(a => !/role="alert"/.test(a)).length, 0);
eq("y hay al menos una decena (la prueba mira algo)", avisos.length >= 10, true);

const estado = p => p.evaluate(() => {
  const err = document.querySelector("#postForm .form-error");
  const a = document.activeElement;
  const marcados = [...document.querySelectorAll('[aria-invalid="true"]')].filter(e => e.offsetParent !== null).map(e => e.id || e.className);
  const r = a ? a.getBoundingClientRect() : null;
  return {
    rol: err && err.getAttribute("role"), texto: err && err.textContent.trim(), campo: err && err.dataset.campo,
    foco: a && a.id, marcados,
    describe: a && (a.getAttribute("aria-describedby") || "").split(/\s+/).includes(err && err.id),
    aLaVista: !!r && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
  };
});
// Se suelta el foco antes de tocar «Publicar»: al perderlo, el campo cambia de alto un poco y, en una ventana justa, el botón se corre bajo
// el dedo entre apretar y soltar (el toque cae en la ventana y no en el botón). Es del diseño de la ventana, no de lo que se prueba acá.
const publicar = async p => { await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.waitForTimeout(150);
  await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(350); };

const b = await abrirNavegador();
for(const [nombre, vp] of [["compu", { width: 1440, height: 900 }], ["celular", { width: 390, height: 844 }]]){
  const { p, errores } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: vp });
  await p.click("#fabMain"); await p.click('[data-action="new-evento"]'); await p.waitForSelector("#cTitle");

  // 1. Sin título
  await publicar(p);
  let e = await estado(p);
  eq(`[${nombre}] sin título: el aviso es role="alert" y dice qué falta`, [e.rol, e.texto], ["alert", "Escribí un título."]);
  eq(`[${nombre}] el aviso queda atado al título`, e.campo, "titulo");
  eq(`[${nombre}] el cursor cae en el título`, e.foco, "cTitle");
  eq(`[${nombre}] el título se marca inválido y apunta a su aviso`, [e.marcados, e.describe], [["cTitle"], true]);
  eq(`[${nombre}] y el campo queda a la vista`, e.aLaVista, true);

  // 2. Con título, sin lugar
  await p.fill("#cTitle", "Charla con padres"); await publicar(p);
  e = await estado(p);
  eq(`[${nombre}] sin lugar: el aviso y el cursor van al lugar`, [e.campo, e.foco, e.marcados], ["lugar", "cPlaceQuery", ["cPlaceQuery"]]);
  eq(`[${nombre}] y el título ya no está marcado`, e.marcados.includes("cTitle"), false);

  // 3. Con lugar, sin las horas (se destilda «Todo el día»)
  await p.fill("#cPlaceQuery", "Rosario"); await p.waitForSelector('#postForm [data-action="pick-place"]'); await p.evaluate(() => document.querySelector('#postForm [data-action="pick-place"]').click()); await p.waitForTimeout(250);
  await p.evaluate(() => document.getElementById("cAllDay").click()); await p.waitForTimeout(250);
  await p.evaluate(() => { for(const id of ["cStartTime", "cEndTime"]){ const i = document.getElementById(id); if(i){ i.value = ""; i.dispatchEvent(new Event("input", { bubbles: true })); } } });
  await publicar(p);
  e = await estado(p);
  eq(`[${nombre}] sin horas: el aviso y el cursor van a la hora de inicio`, [e.rol, e.campo, e.foco], ["alert", "horaInicio", "cStartTime"]);
  // Cerrar la ventana con datos cargados pregunta si se descarta.
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  if(await p.evaluate(() => { const o = document.getElementById("confirmOverlay"); return !!o && !o.hidden; })){ await p.click("#confirmOk"); await p.waitForTimeout(250); }

  // 4. Un error que no es de un campo: la base rechaza guardar (la rutina del Inicio)
  await p.evaluate(() => { window.__sb.fallo = "42501"; });
  await p.click(".quick-composer textarea"); await p.fill("#rutinaContent", "Una rutina que no se guarda");
  await p.click("#rutinaPublish"); await p.waitForTimeout(700);
  const r = await p.evaluate(() => { const x = document.querySelector(".quick-composer .form-error"); return { rol: x && x.getAttribute("role"), campo: x && x.dataset.campo || null, marcados: [...document.querySelectorAll('[aria-invalid="true"]')].filter(e => e.offsetParent !== null).length }; });
  eq(`[${nombre}] si la base rechaza, el aviso se anuncia (role="alert") sin marcar ningún campo`, r, { rol: "alert", campo: null, marcados: 0 });
  // (la app deja en la consola el error de la base que provocó la prueba: es lo único que se acepta)
  eq(`[${nombre}] sin errores en la página`, errores.filter(x => !/row-level security/.test(x)), []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
