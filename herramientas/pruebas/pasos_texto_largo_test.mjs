/* ======================================================================
   Un paso de «Lo que sigue» con el texto largo: «más» y «menos»
   (13/10/2026, pedido del usuario)

   El texto de un paso se muestra en dos renglones; antes, lo que pasaba de ahí
   se cortaba con «…» y no había cómo leerlo. Ahora, si de verdad se corta en ese
   ancho de pantalla, aparece «más» (y «menos» para volver), en el panel
   «Resumen» de la tarjeta y en la ficha del lugar. Un texto corto no lleva botón;
   lo que se desplegó sigue así aunque se tilde otro paso.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const ANA = PERS[1];
const LARGO = "El trabajo mancomunado entre áreas de LatAm (Shajmat/Moda, CARE) resultó clave para la seguridad de esta nueva arena y debe sostenerse como modelo de intervención, con reuniones de coordinación cada quince días, un responsable por cada lugar y un registro compartido de lo acordado en cada una.";
const MEDIO = "Mandar el plan de verano por escrito a la comisión directiva de la sede, con copia al equipo.";   // entra en dos renglones en la compu, no en un celular
const CORTO = "Llamar a la comisión.";
const datos = () => {
  const base = BASE();
  const pasos = base.posts.find(x => x.id === "p1").resumen.partes[0].pasos;
  // En los datos de prueba x3 ya está hecho: se pone el mediano como un cuarto paso, pendiente.
  pasos[0].t = LARGO; pasos[1].t = CORTO; pasos.push({ id: "x4", t: MEDIO, estado: "pendiente" });
  return base;
};
const hasta = async (p, f, ...a) => { for(let i = 0; i < 40; i++){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const tarjeta = '.post[data-post-id="p1"]';
const estado = (p, sel) => p.evaluate(sel => [...document.querySelectorAll(sel + " .rs-pasos li")].map(li => { const b = li.querySelector(".rs-mas-paso"), t = li.querySelector(".t");
  return { boton: b && !b.hidden ? b.textContent.trim() : null, cortado: t.scrollHeight > t.clientHeight + 1, entero: t.classList.contains("entero"), expandido: b ? b.getAttribute("aria-expanded") : null }; }), sel);

const b = await abrirNavegador();

/* ---- En la compu: el largo lleva «más»; los cortos, nada ---- */
{
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 1280, height: 900 }, lang: "es", base: datos() });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  let e = await estado(p, tarjeta);
  eq("el texto largo se corta y lleva «más»; el corto y el mediano, nada", e.map(x => [x.boton, x.cortado]), [["más", true], [null, false], [null, false]]);
  await p.click(tarjeta + " .rs-pasos li:first-child .rs-mas-paso");
  eq("tocar «más» lo muestra entero y el botón pasa a «menos»", await hasta(p, (t) => { const li = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child'); const x = li.querySelector(".t"); return x.classList.contains("entero") && x.scrollHeight <= x.clientHeight + 1 && li.querySelector(".rs-mas-paso").textContent.trim() === t; }, "menos"), true);
  eq("…con aria-expanded para el lector de pantalla, y el foco queda en el botón", await p.evaluate(() => { const bt = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-mas-paso'); return [bt.getAttribute("aria-expanded"), document.activeElement === bt]; }), ["true", true]);
  // Lo desplegado se queda así aunque otra cosa vuelva a dibujar la pantalla (por ejemplo, elegir un responsable en el paso de al lado).
  await p.selectOption(tarjeta + " .rs-pasos li:nth-child(2) .rs-resp", ANA.email);
  await hasta(p, (a) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[1].resp === a, ANA.email);
  eq("lo desplegado sigue desplegado cuando se redibuja", (await estado(p, tarjeta))[0].entero, true);
  await p.click(tarjeta + " .rs-pasos li:first-child .rs-mas-paso");
  e = await estado(p, tarjeta);
  eq("tocar «menos» lo vuelve a cortar, con «más» otra vez", [e[0].boton, e[0].cortado, e[0].entero], ["más", true, false]);
  eq("«No es tarea» sigue en la fila de abajo, a la derecha, también con el texto largo", await p.evaluate(sel => { const li = document.querySelector(sel); return !!li.querySelector(".rs-asig .rs-no"); }, tarjeta + " .rs-pasos li:first-child"), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- En un celular, el mediano también se corta ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 360, height: 800 }, lang: "es", base: datos() });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  const e = await estado(p, tarjeta);
  eq("en 360 px de ancho, el largo y el mediano llevan «más» y el corto no", e.map(x => x.boton), ["más", null, "más"]);
  // Y si se ensancha la ventana, el botón del mediano se va solo.
  await p.setViewportSize({ width: 1280, height: 900 });
  eq("al ensanchar la ventana, al mediano ya le entra y el botón se va; el largo lo conserva", await hasta(p, () => { const l = [...document.querySelectorAll('.post[data-post-id="p1"] .rs-pasos li')].map(li => { const b = li.querySelector(".rs-mas-paso"); return b && !b.hidden; }); return l[0] === true && l[1] === false && l[2] === false; }), true);
  await p.close();
}

/* ---- En hebreo ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 1280, height: 900 }, lang: "he", base: datos() });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  eq("en hebreo, el botón dice «עוד» y luego «פחות»", [(await estado(p, tarjeta))[0].boton, await (async () => { await p.click(tarjeta + " .rs-pasos li:first-child .rs-mas-paso"); return (await estado(p, tarjeta))[0].boton; })()], ["עוד", "פחות"]);
  await p.close();
}

/* ---- Lo mismo en la ficha del lugar ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 1280, height: 900 }, lang: "es", base: datos() });
  await tab(p, "paises");
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "paises-subview"; x.dataset.key = "lista"; document.body.appendChild(x); x.click(); x.remove(); });
  await p.click('[data-action="drill-country"][data-country="Argentina"]'); await p.waitForSelector(".ficha-lugar .fl-sigue");
  let e = await estado(p, ".fl-sigue");
  eq("en la ficha del lugar, el largo lleva «más» y los cortos no", e.slice(0, 3).map(x => x.boton), ["más", null, null]);
  await p.click(".fl-sigue .rs-pasos li:first-child .rs-mas-paso");
  e = await estado(p, ".fl-sigue");
  eq("y se despliega y vuelve a «menos»", [e[0].entero, e[0].boton, e[0].cortado], [true, "menos", false]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
