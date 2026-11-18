import fs from "node:fs";
import http from "node:http";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";
/* ======================================================================
   Los PDF de entrega de Gastos (etapa 4, 18/11/2026; docs/rendicion-gastos/)

   - Solo de una rendición aprobada, con sus gastos: «PDF de entrega».
   - Adentro: cada comprobante en orden, con su sello (N° 1, N° 2…, y
     «pág. 1/2» si tiene varias páginas; el PDF del comprobante entra
     entero, no como foto), la planilla en cada idioma elegido (el hebreo,
     con los tramos latinos aislados para que no se desordenen), y al final
     el comprobante de cada cambio de moneda, como anexo.
   - Un comprobante que no se puede leer no saltea el número: va una hoja
     que lo dice, y la pantalla avisa.
   - Nunca el nombre de quien rinde (ni en las hojas ni en los datos del PDF).
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

// ---------- 1. Una rendición aprobada: el panel ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(), iniciar: ANOTAR });
  await sirvo(p);
  await irGastos(p);
  await abrir(p, "ren_mvd");
  eq("la aprobada ofrece «PDF de entrega»", await leer(p, '.gx-paso [data-action="gastos-pdf-abrir"]', e => e.textContent.trim()), "📄 PDF de entrega");
  await tocar(p, '[data-action="gastos-pdf-abrir"]');
  eq("se abre el panel, con el foco en el primer idioma", await p.evaluate(() => [!!document.querySelector(".gx-pdf"), document.activeElement && document.activeElement.dataset.gpdfIdioma]), [true, "es"]);
  eq("de entrada, el idioma de la app", await p.$$eval("[data-gpdf-idioma]", l => l.filter(c => c.checked).map(c => c.dataset.gpdfIdioma)), ["es"]);
  eq("cuenta qué va adentro (los 3 comprobantes, la planilla y el anexo del cambio)", await leer(p, ".gx-pdf > .setting-sub", e => /3 comprobantes/.test(e.textContent) && /anexo/.test(e.textContent)), true);
  await tocar(p, '[data-gpdf-idioma="es"]');
  eq("sin idiomas no se puede bajar, y lo dice", await p.evaluate(() => [document.querySelector('[data-action="gastos-pdf-bajar"]').disabled, /al menos un idioma/.test(document.querySelector(".gx-pdf").textContent)]), [true, true]);
  await tocar(p, '[data-gpdf-idioma="he"]'); await tocar(p, '[data-gpdf-idioma="es"]');
  eq("con español y hebreo, sí; y se recuerdan para la próxima", await p.evaluate(() => [document.querySelector('[data-action="gastos-pdf-bajar"]').disabled, localStorage.getItem("ra_pdf_idiomas")]), [false, '["es","he"]']);

  const { nombre, bytes } = await bajar(p);
  eq("se baja con el nombre de la actividad y el mes", /^Visita a Montevideo - [A-ZÁÉÍÓÚ][a-záéíóú]+ \d{4}\.pdf$/.test(nombre || ""), true);
  let listo = null;
  for(let i = 0; i < 30 && !listo; i++){ listo = await leer(p, ".gx-pdf .admin-ok", e => e.textContent); if(!listo) await p.waitForTimeout(100); }
  eq("y la pantalla dice que está listo", !!nombre && (listo || "").includes(nombre), true);
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
  eq("una visita va como «Visita»; quien puso la plata, «Quien rinde» u «Organización»", ["Visita", "Quien rinde", "Organización"].every(s => dib.includes(s)), true);
  eq("en observaciones, la tarjeta y la moneda del comprobante, cada una en su renglón", ["Tarjeta terminada en 5555", "Gasto en UY $ 790.-", "Ida y vuelta"].every(s => dib.includes(s)), true);
  eq("el total y el cambio con su tasa", ["Total", "365.50", "1 USD = 39.5 UYU", "Comprobante en el anexo"].every(s => dib.includes(s)), true);
  eq("y en hebreo: su título y sus columnas", [dib.some(s => /^טבלת הוצאות — /.test(s.replace(/[⁦-⁩]/g, ""))), ["תאריך", "תיאור", "סכום", "הערות"].every(s => dib.includes(s))], [true, true]);
  eq("en hebreo, el tramo latino de un renglón mezclado va aislado (no se desordena)", dib.includes("הוצאה ב-⁦UY $ 790.-⁩"), true);
  eq("en hebreo, lo que es todo latino (la tasa) va tal cual", dib.filter(s => s === "1 USD = 39.5 UYU").length, 2);
  eq("nunca el nombre de quien rinde", dib.some(s => s.includes(PERS[0].name)) || dib.some(s => s.includes("Benny")), false);
  eq("sin errores", errores, []);
  await p.close();
}

// ---------- 2. Un comprobante que no se puede leer ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos() });
  await sirvo(p, { faltaGx3: true });
  await irGastos(p); await abrir(p, "ren_mvd");
  await tocar(p, '[data-action="gastos-pdf-abrir"]');
  const { bytes } = await bajar(p);
  const x = bytes ? await examinar(p, bytes) : { paginas: [] };
  eq("no se saltea su número: va una hoja que lo dice (siguen siendo 6 con un idioma)", x.paginas.length, 6);
  eq("y la pantalla avisa cuál es el problema y qué hacer", await leer(p, ".gx-pdf .gx-alerta", e => /no se pudo poner tal cual/.test(e.textContent) && /bajar desde el gasto/.test(e.textContent)), true);
  eq("sin errores (solo el aviso en la consola)", errores, []);
  await p.close();
}

// ---------- 3. Lo que no está aprobado no tiene PDF; el resumen por mes ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos(false), iniciar: ANOTAR });
  await irGastos(p); await abrir(p, "ren_mvd");
  eq("una rendición abierta no ofrece el PDF", await p.$('[data-action="gastos-pdf-abrir"]'), null);
  await tocar(p, '[data-action="gastos-volver"]'); await p.waitForTimeout(200);
  eq("en «Mis rendiciones», el resumen por mes (hay una aprobada)", await leer(p, '[data-action="gastos-pdf-abrir"][data-id="resumen"]', e => /Resumen de gastos por mes/.test(e.textContent)), true);
  await tocar(p, '[data-action="gastos-pdf-abrir"][data-id="resumen"]');
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
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA, base: datos() });
  await p.route(/\/pdf\/pdf-lib\.min\.js$/, ruta => ruta.fulfill({ status: 404, body: "" }));
  await irGastos(p); await abrir(p, "ren_mvd");
  await tocar(p, '[data-action="gastos-pdf-abrir"]');
  await tocar(p, '[data-action="gastos-pdf-bajar"]');
  let msg = null;
  for(let i = 0; i < 40 && !msg; i++){ msg = await leer(p, ".gx-pdf .form-error[role=alert]", e => e.textContent); await p.waitForTimeout(100); }
  eq("lo dice en palabras simples, y se puede volver a probar", [/No se pudo cargar lo que arma el PDF/.test(msg || ""), await leer(p, '[data-action="gastos-pdf-bajar"]', e => e.disabled)], [true, false]);
  eq("sin errores en la página (el que falta es el archivo)", errores.filter(e => !/pdf-lib/.test(e)), []);
  await p.close();
}

// ---------- 5. En el celular, el panel entra ----------
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 360, height: 740 }, pagina: PAGINA, base: datos() });
  await p.evaluate(() => { const v = document.querySelector('.bn-item[data-action="toggle-more-menu"]'); if(v) v.click(); });
  await p.waitForTimeout(250);
  await p.evaluate(() => { const v = document.querySelector('[data-view="gastos"]'); if(v) v.click(); });
  await p.waitForSelector(".gastos-view").catch(() => {});
  await abrir(p, "ren_mvd");
  await tocar(p, '[data-action="gastos-pdf-abrir"]');
  eq("en 360 px, el panel no se sale de la pantalla", await p.evaluate(() => { const e = document.querySelector(".gx-pdf"); return !!e && e.getBoundingClientRect().right <= document.documentElement.clientWidth + 1 && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1; }), true);
  eq("sin errores", errores, []);
  await p.close();
}

await b.close(); servidor.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
