import fs from "node:fs";
import http from "node:http";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";
/* ======================================================================
   El lector de comprobantes, de punta a punta y leyendo de verdad (15/11/2026)

   La app servida por http, como en el sitio (desde un archivo local el
   navegador no deja crear el trabajador donde corre el lector), con las
   piezas de herramientas/publicar/lector/ en lector/ y la CSP de siempre:
   - subir tickets (fotos y un PDF escaneado) a la rendición de una
     actividad en Uruguay: el lector los lee en el fondo y completa SOLO lo
     vacío (fecha, monto, moneda, tarjeta, forma de pago, comercio, tipo);
     el «$» solo se toma como la moneda del país, para revisar;
   - la ventana dice qué completó y marca lo sugerido y lo dudoso;
   - «Leer el comprobante» completa el borrador de la ventana, no la base;
   - lo que la persona ya escribió no se pisa;
   - sin errores en la consola (el motor escribe avisos como errores: van a
     ningún lado).
   Los tickets son INVENTADOS: se dibujan acá mismo.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const INDEX = process.env.INDEX || RAIZ + "index.html";
const LECTOR = RAIZ + "herramientas/publicar/lector/";

// El sitio, como lo arma «Publicar el sitio»: la página y lector/ al lado.
const servidor = http.createServer((req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let archivo = null;
  if(ruta === "/" || ruta === "/index.html") archivo = INDEX;
  else if(/^\/lector\/[\w.\-]+$/.test(ruta)) archivo = LECTOR + ruta.slice(8);
  if(!archivo || !fs.existsSync(archivo)){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": archivo.endsWith(".html") ? "text/html; charset=utf-8" : archivo.endsWith(".js") ? "application/javascript" : "application/octet-stream" });
  fs.createReadStream(archivo).pipe(res);
});
await new Promise(r => servidor.listen(0, "127.0.0.1", r));
const PAGINA = `http://127.0.0.1:${servidor.address().port}/index.html`;

const b = await abrirNavegador();
// Los tickets, dibujados como un papel (letra de ticket, un poco torcido).
const ayer = (() => { const d = new Date(Date.now() - 86400000); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; })();
const ayerISO = ayer.split("/").reverse().join("-");
async function ticket(lineas){
  const p = await b.newPage({ viewport: { width: 360, height: 480 }, deviceScaleFactor: 2 });
  await p.setContent(`<body style="margin:0;background:#d9d4c7;display:flex;align-items:center;justify-content:center;height:480px;font-family:'DejaVu Sans Mono',monospace">
    <div style="background:#fffdf6;width:250px;padding:20px 18px;transform:rotate(-2deg);color:#222;font-size:13px;line-height:1.7">
    ${lineas.map((x, i) => `<div style="${i === 0 ? "font-weight:bold;text-align:center;font-size:15px" : /TOTAL/.test(x) ? "font-weight:bold;font-size:16px" : ""}">${x}</div>`).join("")}</div></body>`);
  const jpg = await p.screenshot({ type: "jpeg", quality: 88 });
  await p.close();
  return jpg;
}
const TAXI = await ticket(["RADIO TAXI EJEMPLO", "Recibo 0001-00004521", `Fecha: ${ayer} 10:42`, "Destino: Aeropuerto", "TOTAL $ 1.250,00", "Pago: tarjeta ****1234"]);
const CENA = await ticket(["RESTAURANTE LA ESQUINA", "Factura B 0003-00012877", `Fecha: ${ayer} 21:15`, "2 x Menu del dia", "TOTAL USD 45,50", "Pago: efectivo"]);
const HOTEL = await ticket(["HOTEL EJEMPLO", "Factura A 0001-00009912", `Fecha: ${ayer}`, "2 noches hab. doble", "TOTAL UYU 12.000,00", "Tarjeta ****5555"]);
// Un PDF como los de CamScanner: la foto del ticket adentro, como JPEG.
const pdfCon = jpg => Buffer.concat([Buffer.from(`%PDF-1.4\n1 0 obj<</Type/XObject/Subtype/Image/Width 720/Height 960/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>stream\n`, "latin1"),
  jpg, Buffer.from("\nendstream\nendobj\ntrailer<<>>\n%%EOF\n", "latin1")]);

const tabla = (p, n) => p.evaluate(n => window.__sb.tablas[n] || [], n);
const hasta = async (p, f, a, veces = 400) => { for(let i = 0; i < veces; i++){ if(await p.evaluate(f, a).catch(() => false)) return true; await p.waitForTimeout(150); } return false; };
const elegir = async (p, sel, files) => { const [ch] = await Promise.all([p.waitForEvent("filechooser"), p.click(sel)]); await ch.setFiles(files); };

const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1280, height: 900 }, pagina: PAGINA });
// Los comprobantes ya subidos: el de gx8 es el ticket del taxi.
await p.route(/\/storage\/v1\/object\/sign\/adjuntos\/gastos\/gx8\//, r => r.fulfill({ contentType: "image/jpeg", body: TAXI }));
eq("la página sale por http, con la CSP de siempre (sin permisos para correr WebAssembly en la página)",
  await p.evaluate(() => [location.protocol, /wasm-unsafe-eval/.test(document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)]), ["http:", false]);
await p.click('[data-action="toggle-user-menu"]'); await p.click('.user-menu [data-view="gastos"]'); await p.waitForSelector(".gastos-view");
await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(200);
const antes = (await tabla(p, "gastos")).length;
await elegir(p, '[data-action="gastos-subir"][data-id="ren_mvd"]', [
  { name: "foto1.jpg", mimeType: "image/jpeg", buffer: TAXI }, { name: "foto2.jpg", mimeType: "image/jpeg", buffer: CENA },
  { name: "escaneo.pdf", mimeType: "application/pdf", buffer: pdfCon(HOTEL) },
  // Y uno que no se puede leer: un PDF sin texto ni foto adentro.
  { name: "vacio.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") }]);
eq("subidos los tres, el lector los lee en el fondo y anota que los leyó", await hasta(p, n => (window.__sb.tablas.gastos || []).slice(n).filter(g => g.lectura && g.lectura.fuente === "lector").length === 3, antes), true);
const nuevos = (await tabla(p, "gastos")).slice(antes);
const de = nombre => nuevos.find(g => g.archivo_nombre === nombre) || {};
const campos = g => [g.fecha, g.monto, g.moneda, g.forma_pago, g.tarjeta, g.concepto, g.tipo, g.estado];
eq("el taxi: la fecha, el total, el «$» como pesos uruguayos (la actividad es en Uruguay), la tarjeta, el comercio y el tipo",
  campos(de("foto1.jpg")), [ayerISO, 1250, "UYU", "tarjeta", "1234", "Radio Taxi Ejemplo", "transporte", "borrador"]);
eq("…y la moneda queda marcada para revisar", (de("foto1.jpg").lectura || {}).dudas, ["moneda"]);
eq("la cena: en dólares y en efectivo", campos(de("foto2.jpg")), [ayerISO, 45.5, "USD", "efectivo", null, "Restaurante La Esquina", "comida", "borrador"]);
eq("el PDF escaneado: se lee la foto de adentro", campos(de("escaneo.pdf")), [ayerISO, 12000, "UYU", "tarjeta", "5555", "Hotel Ejemplo", "alojamiento", "borrador"]);
eq("lo leído queda por confirmar: el lector no confirma nada", nuevos.every(g => g.estado === "borrador"), true);
eq("terminado, el cartel se va solo y queda un aviso pasajero (18/11)", await hasta(p, () => /Se subieron 4 comprobantes/.test(document.getElementById("calendarToastText").textContent) && !document.querySelector(".gx-subida"), null, 40), true);
eq("el que no se pudo leer lo dice en su fila, sin cartel aparte", await p.evaluate(id => /No se pudo leer: completalo a mano/.test((document.querySelector(`[data-action="gasto-abrir"][data-id="${id}"]`) || {}).textContent || ""), de("vacio.pdf").id), true);

// La ventana: qué completó y las marcas.
await p.click(`[data-action="gasto-abrir"][data-id="${de("foto1.jpg").id}"]`); await p.waitForSelector("#gastoOverlay:not([hidden])");
eq("la ventana no tiene cartel de lo que completó el lector: lo dicen las marcas", await p.evaluate(() => !document.querySelector(".gx-sugerido") && !/completó/.test(document.getElementById("gastoBody").innerText)), true);
eq("los campos completados se ven marcados, y la moneda como dudosa", await p.evaluate(() => [document.getElementById("gxMonto").dataset.sug, document.getElementById("gxMoneda").dataset.duda]), ["1", "1"]);
await p.keyboard.press("Escape");

// «Revisar en lista»: lo que el lector dejó dudoso no viene marcado; al corregirlo, sí.
await p.click('[data-action="gastos-lista-abrir"][data-id="ren_mvd"]'); await p.waitForSelector(".gx-lista-rev");
const marca = n => p.$eval(`#gxL_${de(n).id}_marca`, e => e.checked);
eq("en la lista, el taxi (la moneda salió de un «$») viene sin marcar; la cena y el hotel, marcados", [await marca("foto1.jpg"), await marca("foto2.jpg"), await marca("escaneo.pdf")], [false, true, true]);
eq("…la fila chica dice qué revisar", await p.$eval(`#gxLR_${de("foto1.jpg").id}`, e => /Revisar: moneda/.test(e.textContent)), true);
await p.click(`#gxLR_${de("foto1.jpg").id}`);
eq("…y abierta, la moneda se ve como dudosa", await p.$eval(`#gxL_${de("foto1.jpg").id}_moneda`, e => e.dataset.duda), "1");
await p.fill(`#gxL_${de("foto1.jpg").id}_moneda`, "UYU"); await p.press(`#gxL_${de("foto1.jpg").id}_moneda`, "Tab"); await p.waitForTimeout(150);
eq("revisada la moneda, se marca sola", await marca("foto1.jpg"), true);
eq("…y la fila chica dice que está completa", await p.$eval(`#gxLR_${de("foto1.jpg").id}`, e => /Completo/.test(e.textContent) && !/Revisar/.test(e.textContent)), true);
await p.click('[data-action="gastos-lista-cerrar"]'); await p.click("#confirmOk"); await p.waitForSelector(".gx-lista-rev", { state: "detached" });

// «Leer el comprobante» en uno subido antes (gx8, sin datos): completa la ventana, no la base.
await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
await p.click('[data-action="gastos-abrir-rendicion"][data-id="sin"]'); await p.waitForTimeout(150);
await p.click('[data-action="gasto-abrir"][data-id="gx8"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
await p.fill("#gxConcepto", "Viaje al aeropuerto");
// Va en la visita a Montevideo: el «$» del ticket se lee como pesos uruguayos aunque todavía no se haya guardado.
await p.selectOption("#gxVinculo", "post:p9");
await p.click('[data-action="gasto-leer"]');
eq("«Leer el comprobante» completa lo vacío de la ventana", await hasta(p, () => document.getElementById("gxMonto") && document.getElementById("gxMonto").value === "1,250.00", null, 200), true);
eq("…sin pisar lo que la persona ya escribió", await p.$eval("#gxConcepto", e => e.value), "Viaje al aeropuerto");
eq("…y sin tocar la base hasta que se guarda", ((await tabla(p, "gastos")).find(g => g.id === "gx8") || {}).monto, null);
eq("…con la moneda del país de la actividad elegida, para revisar", await p.evaluate(() => [document.getElementById("gxMoneda").value, document.getElementById("gxMoneda").dataset.duda]), ["UYU", "1"]);
await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
eq("al confirmar se guarda lo leído, con lo que completó el lector anotado (lo que escribió la persona, no)", await hasta(p, () => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx8"); return g.estado === "confirmado" && g.monto === 1250 && g.moneda === "UYU" && g.tarjeta === "1234" && g.concepto === "Viaje al aeropuerto"
  && g.lectura && g.lectura.fuente === "lector" && g.lectura.campos.includes("monto") && !g.lectura.campos.includes("concepto"); }, null, 60), true);

eq("sin errores en la consola en todo el camino", errores, []);
await p.close();
await b.close();
servidor.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
