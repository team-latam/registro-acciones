/* ======================================================================
   «Ver traducción» sin el dato entero en el HTML (auditoría del 10/10/2026, R24)

   El botón llevaba el título y el contenido enteros en data-title y
   data-content (hasta 5.000 caracteres repetidos por tarjeta), contra la
   convención «en los data-* va solo un identificador». Ahora trae scope +
   id y el despachador busca el texto en vivo.

   Lo que se traduce no cambia: el posteo de la tarjeta, con su título; la
   respuesta, sin título; la rutina, sin título (no lo muestra); y el
   relleno de Calendar («Creado automáticamente desde Google Calendar.»)
   sigue sin mandarse a traducir.

   Se intercepta mymemory (el servicio de traducción) y se mira qué texto
   pide; con la app en inglés.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RELLENO = "Creado automáticamente desde Google Calendar.";
const base = BASE();
base.posts = base.posts.concat([
  post({ id: "gc_relleno", d: 6, a: 0, type: "otro", title: "Charla con relleno de Calendar", content: RELLENO, extra: { author_name: "Google Calendar", author_email: null, calendar_event_id: "gc_9" } }),
]);
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "en", base });

// Lo que la app le pide al servicio de traducción (el texto, ya decodificado).
let pedidos = [], falla = false;
await p.route(/^https:\/\/api\.mymemory\.translated\.net\/get/, ruta => {
  const u = new URL(ruta.request().url());
  const q = u.searchParams.get("q");
  pedidos.push({ q, par: u.searchParams.get("langpair") });
  if(falla) return ruta.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ responseData: { translatedText: "EN(" + q.slice(0, 30) + ")" }, responseStatus: 200 }) });
});
const conDatos = () => p.$$eval(".translate-toggle[data-title], .translate-toggle[data-content]", l => l.length);
const botones = () => p.$$eval(".translate-toggle", l => l.length);
const tocar = async sel => { pedidos = []; await p.click(sel); await p.waitForTimeout(500); return pedidos.map(x => x.q); };

const P1 = '.post[data-post-id="p1"]';
eq("hay botones «Ver traducción» (la prueba mide algo)", (await botones()) > 3, true);
eq("ningún botón lleva data-title ni data-content", await conDatos(), 0);
const TIT = "Visita a la comunidad de Rosario";
const CONT = "Reunión con la comisión directiva, recorrida por la sede y el colegio. Se acordó un plan de trabajo para el verano.\n\nQuedó pendiente la charla con los padres.";

// Un posteo: se pide el título y el contenido de ESE posteo, hacia el idioma de la app.
const ped = await tocar(`${P1} .post-actions .translate-toggle`);
eq("posteo: se pide el título y el contenido de ese posteo", ped.slice().sort(), [TIT, CONT].sort());
eq("posteo: en inglés (es|en)", [...new Set(pedidos.map(x => x.par))], ["es|en"]);
eq("posteo: la tarjeta muestra lo traducido, y el botón pasa a «Ver original»", await p.evaluate(s => [document.querySelector(s + " .post-titulo")?.textContent.trim().startsWith("EN("), document.querySelector(s + " .post-actions .translate-toggle").textContent.trim()], P1), [true, "↩️ See original"]);
eq("y sigue sin data-title ni data-content", await conDatos(), 0);
// Ver original no pide nada.
eq("«Ver original» no pide nada", await tocar(`${P1} .post-actions .translate-toggle`), []);

// Una respuesta: solo su contenido (sin título).
await click(p, `${P1} [data-action="toggle-thread"]`); await p.waitForTimeout(400);
const R1 = `${P1} .reply:has(.reply-content:text-is("¡Excelente! ¿Pudieron ver el tema del portón?")) .translate-toggle`;
eq("respuesta: la hay, con su botón", (await p.$$(R1)).length, 1);
eq("respuesta: en el hilo abierto, tampoco hay data-title ni data-content", await conDatos(), 0);
eq("respuesta: se pide solo su contenido", await tocar(R1), ["¡Excelente! ¿Pudieron ver el tema del portón?"]);
eq("respuesta: y es la de ese botón, no otra (la anidada tiene el suyo)", await tocar(`${P1} .reply:has(.reply-content:text-is("Sí, quedó para el presupuesto de noviembre.")) .translate-toggle`), ["Sí, quedó para el presupuesto de noviembre."]);

// El relleno de Calendar sigue sin mandarse a traducir (solo el título).
eq("relleno de Calendar: solo se pide el título, el relleno no", await tocar('.post[data-post-id="gc_relleno"] .post-actions .translate-toggle'), ["Charla con relleno de Calendar"]);

// Si el servicio falla, el botón de «Reintentar» tampoco lleva el dato, y reintenta con el texto correcto.
falla = true;
const P5 = '.post[data-post-id="p5"]';
await tocar(`${P5} .post-actions .translate-toggle`);
eq("error: el botón dice «Reintentar»", await p.evaluate(s => document.querySelector(s + " .post-actions .translate-toggle").textContent.trim(), P5), "⚠️ Couldn't translate. Retry");
eq("error: y tampoco lleva data-title ni data-content", await conDatos(), 0);
falla = false;
eq("error: reintentar pide el título y el contenido de ese posteo", (await tocar(`${P5} .post-actions .translate-toggle`)).sort(), ["Reunión virtual con Lima", "Seguimiento del plan de emergencia."].sort());

// Una rutina no muestra el título: solo se pide el contenido.
eq("rutina: solo se pide el contenido, sin título", await tocar('.post[data-post-id="p11"] .post-actions .translate-toggle'), ["Clase de los martes, 12 personas. Hablamos del plan para las fiestas."]);

// El error de «el servicio falló» se provoca a propósito, arriba.
eq("sin errores en la página", errores.filter(e => !/Error traduciendo contenido/.test(e)), []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
