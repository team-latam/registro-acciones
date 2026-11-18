import fs from "node:fs";
import http from "node:http";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";
/* ======================================================================
   Los PDF de entrega de Gastos (etapa 4, 18/11/2026; docs/rendicion-gastos/)

   - Solo de una rendición aprobada, con sus gastos: «Descargar el PDF de
     entrega» en su barra, de una, con los idiomas al lado (sin panel: lo
     eligió el usuario el 18/11); el «listo», en el aviso que se va solo.
   - Adentro: cada comprobante en orden, con su sello (N° 1, N° 2…, y
     «pág. 1/2» si tiene varias páginas; el PDF del comprobante entra
     entero, no como foto), la planilla en cada idioma elegido (el hebreo,
     con los tramos latinos aislados para que no se desordenen), y al final
     el comprobante de cada cambio de moneda, como anexo.
   - Un comprobante que no se puede leer no saltea el número: va una hoja
     que lo dice, y la pantalla avisa.
   - El nombre de quien rinde, solo en «Quién pagó» (decidido el 18/11): ni
     en el título ni en los datos del PDF.
   - Los conceptos, las observaciones y la actividad, traducidos con el
     traductor del navegador (uno de mentira acá: el Chromium de las pruebas
     no lo trae); sin traductor van como se escribieron, y el panel lo dice.
   - El resumen por mes, desde «Mis rendiciones».
   - Si no carga el armador, lo dice.
   Con el sitio servido por http, como lo publica «Publicar el sitio»
   (la página y pdf/ al lado), y el Supabase de mentira.
   Los comprobantes son INVENTADOS: se dibujan acá mismo.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const INDEX = process.env.INDEX || RAIZ + "index.html";
const PDFDIR = RAIZ + "herramientas/publicar/pdf/";

const servidor = http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let archivo = null;
  if(ruta === "/" || ruta === "/index.html") archivo = INDEX;
  else if(/^\/pdf\/[\w.\-]+$/.test(ruta)) archivo = PDFDIR + ruta.slice(5);
  if(!archivo || !fs.existsSync(archivo)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": archivo.endsWith(".html") ? "text/html; charset=utf-8" : "application/javascript" });
  fs.createReadStream(archivo).pipe(res);
});
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const PAGINA = `http://127.0.0.1:${servidor.address().port}/index.html`;

const b = await abrirNavegador({ utf8: true });
// Una factura inventada de dos páginas, en PDF de verdad.
const FACTURA = await (async () => {
  const p = await b.newPage();
  await p.setContent(`<body style="font-family:sans-serif;padding:40px"><h1>HOTEL EJEMPLO</h1><p>Factura inventada</p><h2>TOTAL UYU 12.000,00</h2>
    <div style="page-break-before:always"><p>Página 2</p></div></body>`);
  const pdf = await p.pdf({ format: "A4" }); await p.close(); return pdf;
})();

// Lo que dibuja la app en los lienzos (las hojas y los sellos), para leerlo.
const ANOTAR = `(() => { window.__dibujado = []; const f = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(s, ...r){ window.__dibujado.push(String(s)); return f.call(this, s, ...r); }; })();`;
// Un traductor de mentira, con la forma del de Chrome: «[he] Taxi al aeropuerto». El hebreo lo conoce como «iw»
// (como algunas versiones de Chrome), y el detector dice que todo es castellano.
// Sin traductor (el Chromium de las pruebas trae el de verdad, pero tendría que bajar los idiomas de internet).
const SIN_TRADUCTOR = `(() => { for(const k of ["Translator", "LanguageDetector"]) try{ Object.defineProperty(window, k, { value: undefined, configurable: true, writable: true }); }catch(e){} })();`;
const TRADUCTOR = `(() => { window.__traducidos = [];
  window.LanguageDetector = { availability: async () => "available", create: async () => ({ detect: async s => [{ detectedLanguage: "es", confidence: 0.9 }], destroy(){} }) };
  window.Translator = { availability: async o => o.targetLanguage === "he" ? "unavailable" : "available",
    create: async o => ({ translate: async s => { window.__traducidos.push(o.sourceLanguage + ">" + o.targetLanguage); return "[" + o.targetLanguage + "] " + s; }, destroy(){} }) }; })();`;

const datos = (aprobada = true) => {
  const base = BASE();
  if(aprobada){
    Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_mvd"), { estado: "aprobada", enviada_el: "2026-07-20T12:00:00Z", aprobada_el: "2026-07-21T12:00:00Z", aprobada_por: ADMIN });
    base.gastos.filter(g => g.rendicion_id === "ren_mvd").forEach(g => { g.estado = "aprobado"; });
    Object.assign(base.gastos.find(g => g.id === "gx1"), { tipo: "transporte", moneda: "UYU", monto: 790, rendido_monto: 20, forma_pago: "efectivo", observaciones: "Ida y vuelta" });
    Object.assign(base.gastos_cambios[0], { archivo: "gastos/cambio-cb1/comprobante.png", archivo_nombre: "cambio.png", archivo_tipo: "image/png" });
  }
  return base;
};
const sirvo = async (p, { faltaGx3 = false } = {}) => p.route(/\/storage\/v1\/object\/sign\//, ruta => {
  const u = decodeURIComponent(new URL(ruta.request().url()).pathname);
  if(u.endsWith("gastos/gx2/comprobante_2.pdf")) return ruta.fulfill({ contentType: "application/pdf", body: FACTURA });
  if(faltaGx3 && /gastos\/gx3\//.test(u)) return ruta.fulfill({ status: 404, body: "" });
  return ruta.fallback();
});
const irGastos = async p => { await p.click('[data-action="toggle-user-menu"]'); await p.click('.user-menu [data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200); };
const abrir = async (p, id) => { await p.click(`[data-action="gastos-abrir-rendicion"][data-id="${id}"]`); await p.waitForTimeout(250); };
const tocar = (p, sel) => p.click(sel, { timeout: 3000 }).then(() => true, () => false);
const leer = (p, sel, f) => p.$eval(sel, f).catch(() => null);
const bajar = async p => {
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }).catch(() => null), tocar(p, '[data-action="gastos-pdf-bajar"]')]);
  if(!dl) return { nombre: null, bytes: null };
  const ruta = await dl.path();
  return { nombre: dl.suggestedFilename(), bytes: ruta ? fs.readFileSync(ruta) : null };
};
// El PDF, leído con la misma librería (ya cargada en la página).
const examinar = (p, bytes) => p.evaluate(async b64 => {
  const L = window.PDFLib, bin = atob(b64), u = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const d = await L.PDFDocument.load(u, { updateMetadata: false });
  return { titulo: d.getTitle(), autor: d.getAuthor() || "", creador: d.getCreator(),
    paginas: d.getPages().map(pg => { const { width, height } = pg.getSize(); const xo = pg.node.Resources() && pg.node.Resources().lookup(L.PDFName.of("XObject"));
      return { w: Math.round(width), h: Math.round(height), imagenes: xo ? xo.keys().length : 0 }; }) };
}, Buffer.from(bytes).toString("base64"));

// El aviso pasajero de la app (el mismo del Calendar): ahí dice «se bajó» y lo que haya que avisar.
const aviso = async p => { let x = ""; for(let i = 0; i < 40 && !x; i++){ x = await p.evaluate(() => { const t = document.getElementById("calendarToast"); return t && !t.hidden ? document.getElementById("calendarToastText").textContent : ""; }); if(!x) await p.waitForTimeout(100); } return x; };
// El botón con flecha (lo eligió el usuario el 18/11): lo que dice la flecha, y marcar un idioma en su menú.
const flecha = (p, donde = ".gx-paso") => p.$eval(`${donde} .gx-split-flecha`, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const marcar = async (p, l, donde = ".gx-paso") => {
  if(!(await p.$(`${donde} .gx-split-menu`))) await tocar(p, `${donde} [data-action="gastos-pdf-menu"]`);
  await tocar(p, `${donde} .gx-split-menu [data-gpdf-l="${l}"]`);
};

// ---------- 1. Una rendición aprobada: de una, sin panel (lo eligió el usuario el 18/11) ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(), iniciar: ANOTAR + TRADUCTOR });
  await sirvo(p);
  await irGastos(p);
  await abrir(p, "ren_mvd");
  eq("la barra de la aprobada: «Descargar el PDF de entrega» con una flecha que dice el idioma, y «Reabrir» al lado", await p.evaluate(() => [(document.querySelector('.gx-paso [data-action="gastos-pdf-bajar"][data-id="ren_mvd"]') || {}).textContent,
    (document.querySelector(".gx-paso .gx-split-flecha") || {}).getAttribute && document.querySelector(".gx-paso .gx-split-flecha").getAttribute("aria-expanded"), !!document.querySelector('.gx-paso [data-action="gastos-reabrir"]')]), ["Descargar el PDF de entrega", "false", true]);
  eq("sin panel ni explicaciones", await p.evaluate(() => !document.querySelector(".gx-pdf, .gx-split-menu") && !/se traducen|Adentro van/.test(document.querySelector(".gastos-view").textContent)), true);
  eq("de entrada, el idioma de la app", await flecha(p), "ES ▾");
  await tocar(p, '.gx-paso [data-action="gastos-pdf-menu"]');
  eq("la flecha abre el menú, con el foco adentro; el único marcado no se puede desmarcar (siempre queda uno)", await p.evaluate(() => [
    document.querySelector(".gx-paso .gx-split-flecha").getAttribute("aria-expanded"), [...document.querySelectorAll(".gx-split-menu input")].map(i => [i.dataset.gpdfL, i.checked, i.disabled]),
    document.activeElement.closest(".gx-split-menu") !== null]), ["true", [["es", true, true], ["en", false, false], ["pt", false, false], ["he", false, false]], true]);
  await marcar(p, "he");
  eq("se suma el hebreo: el menú sigue abierto con el foco ahí, la flecha lo dice y se recuerdan para la próxima", await p.evaluate(() => [document.activeElement.dataset.gpdfL,
    !!document.querySelector(".gx-split-menu"), localStorage.getItem("ra_pdf_idiomas")]), ["he", true, '["es","he"]']);
  eq("…la flecha dice «ES · HE»", await flecha(p), "ES · HE ▾");
  await marcar(p, "en"); await marcar(p, "pt");
  const ancho = await p.$eval(".gx-paso .gx-split", e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]);
  eq("con 3 o 4, la flecha dice cuántos, y el botón no engorda (un renglón)", [await flecha(p), ancho[1] < 50], ["4 idiomas ▾", true]);
  await marcar(p, "en"); await marcar(p, "pt");
  eq("…y volviendo a dos, las siglas", await flecha(p), "ES · HE ▾");
  await p.keyboard.press("Escape");
  eq("Escape cierra el menú y el foco vuelve a la flecha", await p.evaluate(() => [!document.querySelector(".gx-split-menu"), document.activeElement.classList.contains("gx-split-flecha")]), [true, true]);
  await tocar(p, '.gx-paso [data-action="gastos-pdf-menu"]'); await p.mouse.click(5, 5);
  eq("tocar afuera también lo cierra", await p.evaluate(() => !document.querySelector(".gx-split-menu")), true);
  eq("con traductor, no hace falta avisar nada", await p.evaluate(() => /no traduce/.test(document.querySelector(".gx-paso").textContent)), false);

  const { nombre, bytes } = await bajar(p);
  eq("se baja con el nombre de la actividad y el mes", /^Visita a Montevideo - [A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}\.pdf$/.test(nombre || ""), true);
  const listo = await aviso(p);
  eq("y un aviso pasajero dice que se bajó (y el botón vuelve a estar)", [!!nombre && listo.includes(nombre), await leer(p, '[data-action="gastos-pdf-bajar"]', e => [e.disabled, e.textContent])], [true, [false, "Descargar el PDF de entrega"]]);
  const x = bytes ? await examinar(p, bytes) : { paginas: [] };
  // 1 (taxi) + 2 (la factura en PDF) + 1 (cena) + planilla en español + en hebreo + el anexo del cambio
  eq("7 páginas: los comprobantes (la factura con sus dos), dos planillas y el anexo", x.paginas.length, 7);
  eq("todas A4: los comprobantes de pie; las planillas, apaisadas", x.paginas.map(q => q.w < q.h ? "pie" : "apaisada"), ["pie", "pie", "pie", "pie", "apaisada", "apaisada", "pie"]);
  eq("cada comprobante lleva su sello (una imagen más, arriba)", x.paginas.filter((q, i) => [0, 1, 2, 3, 6].includes(i)).map(q => q.imagenes >= 2), [true, true, true, true, true]);
  eq("los datos del PDF: el título, «Toldot», y sin autor", [x.titulo, x.creador, x.autor], [nombre && nombre.replace(/\.pdf$/, ""), "Toldot", ""]);
  const dib = await p.evaluate(() => window.__dibujado);
  eq("los sellos: N° 1 a N° 3, «pág. 1/2» y «pág. 2/2» en la factura, y ANEXO", ["N° 1", "N° 2", "N° 3", "pág. 1/2", "pág. 2/2", "ANEXO"].map(s => dib.includes(s)), [true, true, true, true, true, true]);
  eq("el sello dice la actividad y el mes", dib.some(s => /^Visita a Montevideo · [A-Z][a-z]+ \d{4}$/.test(s)), true);
  eq("la planilla en español, con su título y la aclaración del sello", [dib.some(s => /^Planilla de gastos — Visita a Montevideo · /.test(s)), dib.includes("El N° de comprobante coincide con el sello de cada página de este documento.")], [true, true]);
  // (un título largo se corta en renglones: «N°» / «comp.»)
  const junto = dib.join(" ");
  eq("con las columnas de la planilla del usuario", ["N° comp.", "Fecha", "Concepto", "Actividad", "Tipo", "Moneda", "Monto", "Pago", "Quién pagó", "Factura", "Observaciones"].filter(s => !junto.includes(s)), []);
  eq("una visita va como «Visita»; quien puso la plata, su nombre u «Organización»", ["Visita", PERS[0].name, "Organización"].every(s => dib.includes(s)), true);
  eq("en observaciones, la tarjeta y la moneda del comprobante, cada una en su renglón", ["Tarjeta terminada en 5555", "Gasto en UY $ 790.-", "Ida y vuelta"].every(s => dib.includes(s)), true);
  eq("el total y el cambio con su tasa", ["Total", "365.50", "1 USD = 39.5 UYU", "Comprobante en el anexo"].every(s => dib.includes(s)), true);
  eq("y en hebreo: su título y sus columnas", [dib.some(s => /^טבלת הוצאות — /.test(s.replace(/[⁦-⁩]/g, ""))), ["תאריך", "תיאור", "סכום", "הערות"].every(s => dib.includes(s))], [true, true]);
  eq("en hebreo, el tramo latino de un renglón mezclado va aislado (no se desordena)", dib.includes("הוצאה ב-⁦UY $ 790.-⁩"), true);
  eq("en hebreo, lo que es todo latino (la tasa) va tal cual", dib.filter(s => s === "1 USD = 39.5 UYU").length, 2);
  eq("el nombre de quien rinde, solo en «Quién pagó» (dos filas por idioma), no en títulos ni sellos", dib.filter(s => s.includes(PERS[0].name)).every(s => s === PERS[0].name) && dib.filter(s => s === PERS[0].name).length === 4, true);
  eq("en la planilla en hebreo, el concepto, las observaciones y la actividad, traducidos", ["[iw] Taxi al aeropuerto", "[iw] Ida y vuelta", "[iw] Casa de cambio del aeropuerto"].map(s => dib.includes(s)), [true, true, true]);
  eq("y el título de la hoja en hebreo también", dib.some(s => s.replace(/[\u2066-\u2069]/g, "").includes("[iw] Visita a Montevideo")), true);
  eq("en la de castellano (el idioma en que se escribieron), tal cual", [dib.includes("Taxi al aeropuerto"), dib.some(s => /\[es\]/.test(s))], [true, false]);
  eq("se tradujo con el detector: de castellano a hebreo (probando «he» y después «iw»)", [...new Set(await p.evaluate(() => window.__traducidos))], ["es>iw"]);
  eq("sin errores", errores, []);
  await p.close();
}

// ---------- 2. Un comprobante que no se puede leer ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(), iniciar: SIN_TRADUCTOR });
  await sirvo(p, { faltaGx3: true });
  await irGastos(p); await abrir(p, "ren_mvd");
  eq("sin traductor y solo en castellano, no avisa nada", await p.evaluate(() => /no traduce/.test(document.querySelector(".gx-paso").textContent)), false);
  await marcar(p, "en");
  eq("con otro idioma, una línea: los conceptos van como se escribieron", await p.evaluate(() => /Este navegador no traduce: los conceptos van como se escribieron/.test(document.querySelector(".gx-paso").textContent)), true);
  await marcar(p, "en"); await p.keyboard.press("Escape");
  const { bytes } = await bajar(p);
  const x = bytes ? await examinar(p, bytes) : { paginas: [] };
  eq("no se saltea su número: va una hoja que lo dice (siguen siendo 6 con un idioma)", x.paginas.length, 6);
  eq("y el aviso dice cuál es el problema, y no se va solo", [/no se pudo poner: en su lugar va una hoja que lo dice/.test(await aviso(p)), await p.waitForTimeout(5500).then(() => p.evaluate(() => !document.getElementById("calendarToast").hidden))], [true, true]);
  eq("sin errores (solo el aviso en la consola)", errores, []);
  await p.close();
}

// ---------- 3. Lo que no está aprobado no tiene PDF; el resumen por mes ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(false), iniciar: ANOTAR + SIN_TRADUCTOR });
  await irGastos(p); await abrir(p, "ren_mvd");
  eq("una rendición abierta no ofrece el PDF", await p.$('[data-action="gastos-pdf-bajar"]'), null);
  await tocar(p, '[data-action="gastos-volver"]'); await p.waitForTimeout(200);
  eq("en «Mis rendiciones», el resumen por mes, plegado (hay una aprobada)", await leer(p, "details.gx-resumen", e => [e.querySelector("summary").textContent, e.open]), ["Resumen por mes (PDF)", false]);
  await tocar(p, "details.gx-resumen > summary");
  eq("pide desde y hasta, con los meses que tienen algo aprobado", await p.$$eval("#gxPdfDesde option", l => l.length), 1);
  const { nombre, bytes } = await bajar(p);
  eq("se baja como «Resumen de gastos - <mes>»", /^Resumen de gastos - [A-Z][a-z]+ \d{4}\.pdf$/.test(nombre || ""), true);
  const x = bytes ? await examinar(p, bytes) : { paginas: [] };
  eq("una hoja apaisada por idioma", x.paginas.map(q => q.w > q.h), [true]);
  const dib = await p.evaluate(() => window.__dibujado);
  eq("con la rutina del mes, sus comprobantes, el tipo y el TOTAL FINAL", [dib.some(s => /^Rutina de .+ \(1 comprobante\)$/.test(s)), dib.includes("Transporte"), dib.includes("TOTAL USD"), dib.includes("TOTAL FINAL"), dib.filter(s => s === "20.00").length >= 2], [true, true, true, true, true]);
  eq("sin errores", errores, []);
  await p.close();
}

// ---------- 4. Si el armador no carga, lo dice ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(), iniciar: SIN_TRADUCTOR });
  await p.route(/\/pdf\/pdf-lib\.min\.js$/, ruta => ruta.fulfill({ status: 404, body: "" }));
  await irGastos(p); await abrir(p, "ren_mvd");
  await tocar(p, '[data-action="gastos-pdf-bajar"]');
  const msg = await aviso(p);
  eq("lo dice en palabras simples, y se puede volver a probar", [/No se pudo cargar lo que arma el PDF/.test(msg || ""), await leer(p, '[data-action="gastos-pdf-bajar"]', e => e.disabled)], [true, false]);
  eq("sin errores en la página (el que falta es el archivo)", errores.filter(e => !/pdf-lib/.test(e)), []);
  await p.close();
}

// ---------- 5. Un traductor que no contesta no traba el PDF ----------
{
  const TRABADO = `(() => { Object.defineProperty(window, "LanguageDetector", { value: undefined, configurable: true, writable: true });
    window.Translator = { availability: () => new Promise(() => {}), create: () => new Promise(() => {}) }; })();`;
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(), iniciar: TRABADO });
  await sirvo(p);
  await irGastos(p); await abrir(p, "ren_mvd");
  await marcar(p, "en"); await p.keyboard.press("Escape");
  const t0 = Date.now();
  const { bytes } = await bajar(p);
  const x = bytes ? await examinar(p, bytes) : { paginas: [] };
  eq("el PDF sale igual (con las dos planillas), sin esperar de más", [x.paginas.length, Date.now() - t0 < 40000], [7, true]);
  eq("y avisa que algunos textos van sin traducir", /no se pudieron traducir/.test(await aviso(p)), true);
  eq("la próxima vez ya no lo espera: dice que este navegador no traduce", await p.evaluate(() => /no traduce/.test(document.querySelector(".gx-paso").textContent)), true);
  eq("sin errores", errores, []);
  await p.close();
}

// ---------- 6. En el celular, el botón y los idiomas entran ----------
// Con letras más anchas que las de acá (en GitHub el navegador usa otras, y en algunos teléfonos también): así falló
// el 18/11 en «Publicar el sitio» y no acá.
const LETRA_ANCHA = `document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "*{ letter-spacing:.1em !important; }"; document.head.appendChild(s); });`;
for(const ancho of [360, 320]){
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: ancho, height: 740 }, pagina: PAGINA, base: datos(), iniciar: SIN_TRADUCTOR + LETRA_ANCHA });
  await p.evaluate(() => { const v = document.querySelector('.bn-item[data-action="toggle-more-menu"]'); if(v) v.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const v = document.querySelector('[data-view="gastos"]'); if(v) v.click(); });
  await p.waitForSelector(".gastos-view").catch(() => {});
  await abrir(p, "ren_mvd");
  await marcar(p, "en"); await marcar(p, "pt"); await marcar(p, "he");   // los cuatro
  eq(`en ${ancho} px y con letra ancha, con los cuatro idiomas, el botón con flecha entra en un renglón y no se sale`, await p.evaluate(() => { const e = document.querySelector(".gx-paso .gx-split"), w = document.documentElement.clientWidth;
    return !!e && e.getBoundingClientRect().height < 50 && [...e.querySelectorAll("button")].every(b => b.getBoundingClientRect().right <= w + 1 && b.getBoundingClientRect().left >= -1) && document.documentElement.scrollWidth <= w + 1; }), true);
  eq(`…(${ancho} px) la flecha dice «4 idiomas» y el menú entra en la pantalla, con casillas que se tocan con el dedo`, await p.evaluate(() => { const m = document.querySelector(".gx-split-menu"), w = document.documentElement.clientWidth;
    return [(document.querySelector(".gx-paso .gx-split-flecha") || {}).textContent.replace(/\s+/g, " ").trim(), !!m && m.getBoundingClientRect().left >= -1 && m.getBoundingClientRect().right <= w + 1,
      !!m && [...m.querySelectorAll("label")].every(l => l.getBoundingClientRect().height >= 32)]; }), ["4 idiomas ▾", true, true]);
  eq(`(${ancho} px) sin errores`, errores, []);
  await p.close();
}

// ---------- 7. Lo que llegó tarde va al final (lo eligió el usuario el 18/11) ----------
{
  const base = datos();
  // El taxi (el de fecha más vieja) se sumó después de la primera aprobación: va último, con el N° que sigue.
  base.gastos.filter(g => g.rendicion_id === "ren_mvd").forEach(g => { g.aprobado_el = g.id === "gx1" ? "2026-08-01T12:00:00Z" : "2026-07-21T12:00:00Z"; });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base, iniciar: ANOTAR + SIN_TRADUCTOR });
  await sirvo(p);
  await irGastos(p); await abrir(p, "ren_mvd");
  const { bytes } = await bajar(p);
  const dib = await p.evaluate(() => window.__dibujado);
  const fila = c => dib.indexOf(c);
  eq("en la planilla: primero lo aprobado antes (por fecha) y al final el que llegó tarde", bytes && [fila("Hotel Rambla, dos noches") < fila("Cena con los directores"), fila("Cena con los directores") < fila("Taxi al aeropuerto")], [true, true]);
  eq("…y su sello es el N° 3, aunque su fecha sea la primera (el hotel, N° 1, tiene dos páginas)", dib.slice(0, dib.indexOf("N° 3") + 1).filter(s => /^N° \d$/.test(s)), ["N° 1", "N° 1", "N° 2", "N° 3"]);
  eq("sin errores", errores, []);
  await p.close();
}

await b.close(); servidor.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
