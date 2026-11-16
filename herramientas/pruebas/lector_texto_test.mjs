import fs from "node:fs";
import zlib from "node:zlib";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El lector de comprobantes: qué saca del texto (15/11/2026)

   El lector (Tesseract, en el aparato) devuelve el texto del ticket como lo
   vio; leerTextoDeComprobante saca la fecha, el total, la moneda, la
   tarjeta, cómo se pagó, el comercio y el tipo, y anota lo dudoso. Estos
   tickets son INVENTADOS (el repo es público), con los errores típicos del
   lector: renglones de ruido, «N%» por «Nº», un título que no es el
   comercio. fotoDentroDelPdf saca la foto de un PDF escaneado, y
   textoDelPdf el texto de un PDF con texto de verdad (como el recibo de Uber
   o la cuenta del hotel que trajo el usuario el 15/11): los PDF se arman acá,
   con datos inventados.
   Corre el código del index.html de verdad.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };

let L = { leer: () => "no se pudo armar", numero: () => null, foto: () => null };
globalThis.t = (es, en, pt, he, v) => String(es).replace(/\{(\w+)\}/g, (x, k) => v && k in v ? v[k] : x);
try{
  L = new Function(`${["MESES_ESCRITOS", "MONEDAS_EN_TEXTO", "MONEDA_DEL_PAIS", "APPS_EN_TEXTO", "TIPOS_EN_TEXTO", "numeroDeTicket", "numerosDeLinea",
    "fechaDeTicket", "tituloDeComercio", "leerTextoDeComprobante", "fotoDentroDelPdf", "textoDelPdf", "faltaElTotal",
    "normalTexto", "PALABRAS_VACIAS", "primeraPalabra", "tipoPorPalabras", "predecirTipo", "NUM_CONTABLE", "numContable", "numeroEscrito", "montoEnCampo",
    "MONEDA_LOCAL_ETIQUETA", "notaDeMoneda"].map(grab).join("\n")}
    return { leer: leerTextoDeComprobante, numero: numeroDeTicket, foto: fotoDentroDelPdf, pdf: textoDelPdf, faltaTotal: faltaElTotal, tipo: predecirTipo,
      escrito: numeroEscrito, enCampo: montoEnCampo, nota: notaDeMoneda };`)();
}catch(e){ console.log("no se pudo armar:", e.message); }
const HOY = "2026-11-15";
const leer = (texto, pais) => { try{ return L.leer(texto, { hoy: HOY, pais }); }catch(e){ return "error: " + e.message; } };
const campos = (r, ...k) => typeof r === "string" ? r : k.map(x => r[x]);

/* ---- Los números como los escribe un ticket ---- */
eq("miles y decimales, en las dos costumbres", ["12.500,00", "12,500.00", "1.234", "45,50", "45.5", "1.234.567", "3", "0,99"].map(x => (L.numero(x) || {}).n),
  [12500, 12500, 1234, 45.5, 45.5, 1234567, 3, 0.99]);
eq("tres decimales donde no van: dudoso", [L.numero("1.234,567"), L.numero("12.3456")].map(x => x && x.dudoso), [true, true]);
eq("lo que no es un número, nada", [L.numero("abc"), L.numero(""), L.numero("12a")], [null, null, null]);

/* ---- Tickets enteros ---- */
const taxi = `RADIO TAXI EJEMPLO
Recibo N% 0001-00004521
Fecha: 15/11/2026 10:42
Origen: Hotel Centro
Destino: Aeropuerto
Km: 18,4
TOTAL $ 12.500,00
Pago: tarjeta ****1234
¡Gracias por viajar!`;
let r = leer(taxi, "Argentina");
eq("taxi (Argentina): fecha, total, la moneda del país por el $ solo, tarjeta, comercio y tipo",
  campos(r, "fecha", "monto", "moneda", "tarjeta", "formaPago", "comercio", "tipo"), ["2026-11-15", 12500, "ARS", "1234", "tarjeta", "Radio Taxi Ejemplo", "transporte"]);
eq("…y la moneda queda para revisar (salió del país, no del ticket)", r.dudas, ["moneda"]);
eq("sin saber el país, el $ solo no dice la moneda", campos(leer(taxi), "moneda", "dudas"), [null, ["moneda"]]);

const cena = `RESTAURANTE LA ESQUINA
Factura B 0003-00012877
Fecha: 14/11/2026 21:15
2 x Menú del día
1 x Agua mineral
1 x Café
TOTAL USD 45,50
Pago: efectivo
Gracias por su visita`;
eq("cena: en dólares, en efectivo, comida, sin dudas", campos(leer(cena), "fecha", "monto", "moneda", "tarjeta", "formaPago", "comercio", "tipo", "dudas"),
  ["2026-11-14", 45.5, "USD", null, "efectivo", "Restaurante La Esquina", "comida", []]);

const hotel = `HOTEL EJEMPLO
Factura A 0001-00009912
Check-in 07/07 Check-out 09/07
2 noches hab. doble
TOTAL UYU 12.000,00
Tarjeta ****5555`;
eq("hotel (Uruguay): sin año en las fechas no inventa una", campos(leer(hotel), "fecha", "monto", "moneda", "tarjeta", "tipo"), [null, 12000, "UYU", "5555", "alojamiento"]);

const remis = `E
REMISES DEL SUR
Comprobante 778
Fecha: 11/11/2026
Viaje: Oficina - Centro
TOTAL USD 20,00
Efectivo
————_——`;
eq("remís con ruido arriba y abajo: el comercio es el primer renglón con nombre", campos(leer(remis), "comercio", "fecha", "monto", "moneda", "formaPago", "tipo"),
  ["Remises Del Sur", "2026-11-11", 20, "USD", "efectivo", "transporte"]);

const mexico = `TACOS EL GUERO SA DE CV
RFC TEG123456AB1
Av. Reforma 123, CDMX
FECHA 12/11/2026 HORA 14:35
2 TACOS AL PASTOR 90.00
1 AGUA FRESCA 35.00
SUBTOTAL 107.76
IVA 16% 17.24
TOTAL $125.00 M.N.
PAGO CON TARJETA VISA ****9876`;
eq("México: el total y no el subtotal ni el IVA; «M.N.» es peso mexicano", campos(leer(mexico, "México"), "fecha", "monto", "moneda", "tarjeta", "formaPago", "dudas"),
  ["2026-11-12", 125, "MXN", "9876", "tarjeta", []]);

const brasil = `PADARIA BOM DIA LTDA
CNPJ 12.345.678/0001-90
CUPOM FISCAL
DATA 10/11/2026 08:12
1 PAO DE QUEIJO 6,50
2 CAFE 9,00
TOTAL R$ 15,50
DINHEIRO 20,00
TROCO 4,50`;
eq("Brasil: reales, en efectivo («dinheiro»), el total y no lo pagado ni el vuelto", campos(leer(brasil), "fecha", "monto", "moneda", "formaPago", "comercio", "tipo"),
  ["2026-11-10", 15.5, "BRL", "efectivo", "Padaria Bom Dia Ltda", "comida"]);

const eeuu = `STARBUCKS STORE #1234
NEW YORK NY
11/03/2026 09:15 AM
GRANDE LATTE 5.45
SUBTOTAL 5.45
TAX 0.48
TOTAL 5.93
VISA XXXXXXXXXXXX4321
THANK YOU`;
r = leer(eeuu);
eq("Estados Unidos: mes primero, y como podría ser al revés, queda para revisar", campos(r, "fecha", "monto", "tarjeta", "dudas"), ["2026-11-03", 5.93, "4321", ["fecha"]]);

const israel = `קפה ירושלים
חשבונית מס 4567
תאריך 05/11/2026
סה"כ לתשלום 48.00 ₪
אשראי ****1111`;
eq("Israel: shekels, el total en hebreo, la tarjeta y el comercio", campos(leer(israel), "fecha", "monto", "moneda", "tarjeta", "formaPago", "comercio", "dudas"),
  ["2026-11-05", 48, "ILS", "1111", "tarjeta", "קפה ירושלים", []]);

/* ---- Los montos que se escriben en un campo, y cómo se muestran (contables, como el Sheet del usuario) ---- */
eq("un monto escrito: con coma o punto, con «$», negativo (un ajuste); vacío es nada; lo que no se entiende, no",
  ["1250", "1,250.50", "1.250,50", "12,5", "$ 40", "-30", "abc", "", "1.234,567"].map(x => { const n = L.escrito(x); return n === null ? "vacío" : Number.isNaN(n) ? "no" : n; }),
  [1250, 1250.5, 1250.5, 12.5, 40, -30, "no", "vacío", "no"]);
eq("en el campo se ve contable: coma para los miles, punto para los centavos, siempre dos decimales (un punto con tres cifras detrás son miles, como se escribe acá)",
  ["1250", "2.999,5", "0", "-30", "12.345", "abc", ""].map(L.enCampo), ["1,250.00", "2,999.50", "0.00", "-30.00", "12,345.00", "abc", ""]);

/* ---- La nota de la moneda local en «Observaciones» (como la escribe el usuario en su Sheet) ---- */
eq("«Gasto en MX $ 642.-»: en otra moneda y con el monto en dólares; sin centavos, «.-»; si no, con los centavos",
  [L.nota("MXN", 642, "USD", 35.2), L.nota("UYU", 1250.5, "USD", 30), L.nota("ARS", "12.000", "USD", "12"), L.nota("XCG", 162, "USD", 100), L.nota("EUR", 40, "USD", "43,10")],
  ["Gasto en MX $ 642.-", "Gasto en UY $ 1,250.50", "Gasto en AR $ 12,000.-", "Gasto en XCG 162.-", "Gasto en € 40.-"]);
eq("en dólares, o todavía sin el monto en dólares: sin nota", [L.nota("USD", 50, "USD", null), L.nota("MXN", 642, "USD", ""), L.nota("MXN", "", "USD", 35)], ["", "", ""]);

/* ---- Casos que confunden ---- */
eq("la tarjeta, aunque el lector confunda un asterisco con «+», «#» o «%»", ["Pago: tarjeta ***+1234", "VISA **%*5678", "Tarjeta ##9012", "Débito terminada en 3456"].map(x => leer(x).tarjeta),
  ["1234", "5678", "9012", "3456"]);
eq("con «total» y «total a pagar», vale el de pagar aunque sea menor", leer(`TIENDA
TOTAL 1.000,00
DESCUENTO 100,00
TOTAL A PAGAR 900,00`).monto, 900);
eq("«TOTAL» sin número: el de abajo", leer(`LIBRERIA CENTRAL
TOTAL
$ 3.250,00`, "Argentina").monto, 3250);
eq("…y por el nombre, es material", leer(`LIBRERIA CENTRAL
TOTAL
$ 3.250,00`, "Argentina").tipo, "material");
eq("«total de artículos» no es el total", campos(leer(`KIOSCO
TOTAL ARTICULOS 3
TOTAL $ 1.500,00`, "Argentina"), "monto", "dudas"), [1500, ["moneda"]]);
eq("sin la palabra total: el número con decimales más grande, para revisar", campos(leer(`CAFE CENTRAL
Fecha 01/11/2026
Cafe 2.500,00
Medialuna 1.200,00
USD 3.700,00`), "monto", "moneda", "dudas"), [3700, "USD", ["monto"]]);
eq("una fecha del futuro no es la del comprobante (se toma la siguiente)", leer(`HOTEL X
Vence: 25/12/2026
Fecha: 02/11/2026
TOTAL USD 10,00`).fecha, "2026-11-02");
eq("fechas escritas con el mes en letras (español, portugués, abreviado)", ["Fecha: 15 de noviembre de 2026", "Data: 3 de outubro de 2026", "15-NOV-26"].map(x => leer(x).fecha),
  ["2026-11-15", "2026-10-03", "2026-11-15"]);
eq("un 31/02 no existe", leer("Fecha: 31/02/2026").fecha, null);
eq("el CUIT, el teléfono y la hora no se toman como plata", leer(`ALMACEN
CUIT 30-71234567-8
Tel 4555-1234
14:30`).monto, null);
eq("un texto vacío no rompe", campos(leer(""), "fecha", "monto", "moneda", "tarjeta", "formaPago", "comercio", "tipo", "dudas"), [null, null, null, null, null, "", null, []]);

/* ---- Los recibos que trajo el usuario el 15/11, inventados con la misma forma ---- */
const app = `Mar 4, 2026
9:12 AM
Thanks for riding, Ana
We hope you enjoyed your ride this morning.
Total $8.75
Trip fare $8.10
Booking Fee $0.65
Payments
Visa ••••4242 $8.75
3/4/26 9:30 AM
Trip details
UberX
6.20 kilometers, 14 minutes
Hotel Central 555, Ciudad de Panamá`;
r = leer(app, "Panamá");
eq("recibo de una app de viajes: la fecha en inglés («Mar 4, 2026»), el total, el «$» de Panamá es dólar, Uber y transporte (no el «booking» ni el hotel)",
  campos(r, "fecha", "monto", "moneda", "tarjeta", "formaPago", "comercio", "tipo", "dudas"), ["2026-03-04", 8.75, "USD", "4242", "tarjeta", "Uber", "transporte", []]);
eq("«Uber Eats» es comida", campos(leer("Your order from Uber Eats\nTotal USD 21.40"), "comercio", "tipo"), ["Uber Eats", "comida"]);
eq("Uberlândia no es Uber", leer("PADARIA DE UBERLÂNDIA\nTOTAL R$ 12,00").comercio, "Padaria De Uberlândia");
const folio = `Print date: 30.01.2026
21:05
2104 Guest Folio
Hotel Mar Azul Ejemplo
Reservation Information
Agency : Booking.com Room Type : DBL
Arrival/Departure : 27.01.2026 / 29.01.2026
Date Department Check / Doc No Remarks USD Net
27.01.2026 15:42 Visa/ Mastercard - -310.50
Taken Payments
310.50 USD 0.00 0.00
Balance : -310.50`;
r = leer(folio);
eq("cuenta de hotel: la fecha de llegada (no la de impresión), el nombre del hotel (no «Guest Folio»), alojamiento; el monto sin «total», para revisar",
  campos(r, "fecha", "monto", "moneda", "formaPago", "comercio", "tipo", "dudas"), ["2026-01-27", 310.5, "USD", "tarjeta", "Hotel Mar Azul Ejemplo", "alojamiento", ["monto"]]);

// El escaneo largo del iPhone (una cena, 15/11): el lector suele traer ruido arriba y saltearse el total en
// letras grandes. El ruido no es el comercio; sin un «total» con número, se lee de nuevo la foto más chica
// (eso se probó a mano con el comprobante real: con tickets dibujados acá el lector no se equivoca igual).
r = leer(`— — —r Sie —
CASA DEL TE EJEMPLO
RESTAURANTE
DATE (MM/DD/YY) 01/27/26
APPROVED - THANK YOU`);
eq("el ruido de arriba no es el comercio; la fecha en inglés con el mes primero", campos(r, "comercio", "fecha", "tipo"), ["Casa Del Te Ejemplo", "2026-01-27", "comida"]);
eq("cuándo se lee de nuevo más chico: sin un renglón con «total» y un número", [L.faltaTotal("CASA\nTOTAL\nAPPROVED"), L.faltaTotal("TOTAL 52.00"), L.faltaTotal("Total   $8.75"), L.faltaTotal("TOTAL\n52.00"), L.faltaTotal("")],
  [true, false, false, true, true]);

/* ---- El tipo, predicho por el concepto (o el título del archivo) y por lo ya cargado ---- */
{
  const tipo = (c, h) => { try{ return L.tipo(c, h); }catch(e){ return "error: " + e.message; } };
  eq("por las palabras del concepto, la que aparece primero; las apps de viaje mandan; «reunión» solo si no hay otra cosa",
    ["Hotel en Curazao x 2 noches", "Cena x 2 personas", "Uber a Hotel2", "Taxi al hotel", "Almuerzo de reunión", "Reunión con directores", "Pasaje Lima - Panamá", "Xyz 123", ""].map(c => tipo(c, [])),
    ["alojamiento", "comida", "transporte", "transporte", "comida", "reunion", "pasaje", null, null]);
  const historia = [{ concepto: "Cena con directores", tipo: "reunion" }, { concepto: "Cena con directores", tipo: "reunion" }, { concepto: "Cena con directores", tipo: "comida" },
    { concepto: "Fotocopiadora del barrio", tipo: "material" }, { concepto: "Hotel Sol", tipo: null }];
  eq("lo ya cargado con el mismo concepto manda (lo más usado), sin importar mayúsculas ni acentos", [tipo("cena con DIRECTORES", historia), tipo("Cena con directores.", historia)], ["reunion", "reunion"]);
  eq("si no, la primera palabra en lo ya cargado («Fotocopiadora Gómez» como «Fotocopiadora del barrio»)", tipo("Fotocopiadora Gómez", historia), "material");
  eq("…pero antes, las palabras del concepto («Cena en el hotel» es comida, aunque haya cenas de reunión)", tipo("Cena en el hotel", historia), "comida");
}

/* ---- El texto de un PDF con texto de verdad ---- */
// Un PDF chico armado acá: objetos numerados desde 1, con streams (comprimidos o no).
function armarPdf(objs, cola = "trailer\n<< /Root 1 0 R >>\n"){
  const partes = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  objs.forEach((o, k) => {
    if(o.stream == null){ partes.push(Buffer.from(`${k + 1} 0 obj\n${o.dict}\nendobj\n`, "latin1")); return; }
    let data = Buffer.isBuffer(o.stream) ? o.stream : Buffer.from(o.stream, "latin1");
    if(o.flate) data = zlib.deflateSync(data);
    const d = o.dict.replace(/>>\s*$/, ` /Length ${data.length}${o.flate ? " /Filter /FlateDecode" : ""} >>`);
    partes.push(Buffer.from(`${k + 1} 0 obj\n${d}\nstream\n`, "latin1"), data, Buffer.from("\nendstream\nendobj\n", "latin1"));
  });
  partes.push(Buffer.from(cola + "%%EOF\n", "latin1"));
  return Buffer.concat(partes);
}
const lineas = t0 => String(t0).split("\n").map(l => l.replace(/\s+/g, " ").trim());
const pdfTexto = async b => { try{ return await L.pdf(b); }catch(e){ return "error: " + e.message; } };
// 1) Como lo arma Chrome (el recibo de Uber): fuente compuesta con códigos de dos bytes y su mapa
//    (ToUnicode con bfchar y bfrange), comprimido, el eje y dado vuelta, dos columnas y dos páginas.
{
  const letras = [...new Set("Mar 4, 2026Thanks for riding, AnaTotal$8.75Trip fare 8.10Visa ••••4242Payments".replace(/[0-9]/g, ""))];
  const cid = ch => /[0-9]/.test(ch) ? 0x10 + Number(ch) : 0x40 + letras.indexOf(ch);
  const hex = str => "<" + [...str].map(ch => cid(ch).toString(16).padStart(4, "0")).join("") + ">";
  const u16 = ch => ch.charCodeAt(0).toString(16).padStart(4, "0");
  const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap
1 begincodespacerange <0000> <FFFF> endcodespacerange
1 beginbfrange <0010> <0019> <0030> endbfrange
${letras.length} beginbfchar
${letras.map(ch => `<${cid(ch).toString(16).padStart(4, "0")}> <${u16(ch)}>`).join("\n")}
endbfchar
endcmap CMapName currentdict /CMap defineresource pop end end`;
  const linea = (x, y, str) => `BT /F1 12 Tf 1 0 0 -1 ${x} ${y} Tm ${hex(str)} Tj ET`;
  const pag1 = `q 1 0 0 -1 0 792 cm\n${[linea(40, 50, "Mar 4, 2026"), linea(40, 90, "Thanks for riding, Ana"), linea(40, 130, "Total"), linea(480, 130, "$8.75"),
    linea(40, 150, "Trip fare"), linea(480, 150, "$8.10")].join("\n")}\nQ`;
  const pag2 = `q 1 0 0 -1 0 792 cm\n${[linea(40, 50, "Payments"), linea(60, 70, "Visa ••••4242"), linea(480, 70, "$8.75")].join("\n")}\nQ`;
  const pdf = armarPdf([
    { dict: "<< /Type /Catalog /Pages 2 0 R >>" },
    { dict: "<< /Type /Pages /Kids [3 0 R 9 0 R] /Count 2 /Resources << /Font << /F1 5 0 R >> >> >>" },
    { dict: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>" },
    { dict: "<< >>", stream: pag1, flate: true },
    { dict: "<< /Type /Font /Subtype /Type0 /BaseFont /AAAAAA+Inter /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 7 0 R >>" },
    { dict: "<< /Type /Font /Subtype /CIDFontType2 /BaseFont /AAAAAA+Inter /DW 600 /W [16 [560 560]] >>" },
    { dict: "<< >>", stream: cmap, flate: true },
    { dict: "<< /Producer (Skia/PDF) >>" },
    { dict: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents [10 0 R] >>" },
    { dict: "<< >>", stream: pag2, flate: true },
  ]);
  const tx = await pdfTexto(pdf);
  eq("PDF como el de Chrome: el texto, renglón por renglón y de arriba abajo, con las dos columnas juntas y las dos páginas", lineas(tx),
    ["Mar 4, 2026", "Thanks for riding, Ana", "Total $8.75", "Trip fare $8.10", "Payments", "Visa ••••4242 $8.75"]);
  eq("…y de ahí, el gasto", campos(leer(tx, "Panamá"), "fecha", "monto", "moneda", "tarjeta", "formaPago"), ["2026-03-04", 8.75, "USD", "4242", "tarjeta"]);
}
// 2) Una factura electrónica sencilla: Helvetica sin mapa (WinAnsi), textos con escapes, TJ con huecos,
//    renglones con Td, T* y «'», sin comprimir; y un pedazo dentro de un formulario (Do).
{
  const pag = `BT /F1 11 Tf 14 TL 50 760 Td (Caf\\351 Central \\(Sucursal 2\\)) Tj T* [(Fe) 20 (cha: 05/11/2026)] TJ
(TOTAL) ' T* [(T) -30 (OTAL) -3000 (ARS 1.250,00)] TJ ET
q 1 0 0 1 50 600 cm /Fx1 Do Q`;
  const forma = `BT /F1 11 Tf 0 0 Td (Gracias por su visita) Tj ET`;
  const pdf = armarPdf([
    { dict: "<< /Type /Catalog /Pages 2 0 R >>" },
    { dict: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    { dict: "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> /XObject << /Fx1 6 0 R >> >> /Contents 4 0 R >>" },
    { dict: "<< >>", stream: pag },
    { dict: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
    { dict: "<< /Type /XObject /Subtype /Form /BBox [0 0 300 50] /Resources << /Font << /F1 5 0 R >> >> >>", stream: forma, flate: true },
  ]);
  const tx = await pdfTexto(pdf);
  eq("factura sencilla: acentos (WinAnsi), paréntesis escapados, huecos de TJ como espacios, Td/T*/«'» y el texto de un formulario", lineas(tx),
    ["Café Central (Sucursal 2)", "Fecha: 05/11/2026", "TOTAL", "TOTAL ARS 1.250,00", "Gracias por su visita"]);
  eq("…y de ahí, el gasto", campos(leer(tx), "fecha", "monto", "moneda", "comercio", "tipo"), ["2026-11-05", 1250, "ARS", "Café Central Sucursal 2", "comida"]);
}
eq("un PDF cifrado o algo que no es un PDF: nada (se lee como foto o a mano)", [await pdfTexto(armarPdf([{ dict: "<< /Type /Catalog >>" }], "trailer\n<< /Root 1 0 R /Encrypt 2 0 R >>\n")),
  await pdfTexto(Buffer.from("hola, no soy un PDF")), await pdfTexto(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"))], ["", "", ""]);

/* ---- La foto adentro de un PDF escaneado ---- */
{
  const bytes = (...partes) => Uint8Array.from(partes.flatMap(p => typeof p === "string" ? [...p].map(c => c.charCodeAt(0)) : p));
  const chica = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 0xFF, 0xD9], grande = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5, 6, 7, 8, 0xFF, 0xD9];
  const pdf = bytes("%PDF-1.4\n1 0 obj<</Type/XObject/Subtype/Image/Filter/DCTDecode/Length 8>>stream\n", chica, "\nendstream\nendobj\n",
    "2 0 obj<</Type/XObject/Subtype/Image/Width 10/Filter /DCTDecode/Length 14>>stream\r\n", grande, "\r\nendstream\nendobj\ntrailer<<>>\n%%EOF");
  const foto = L.foto(pdf);
  eq("de un PDF escaneado saca la foto JPEG más grande, entera", foto && [...foto], grande);
  eq("un PDF sin fotos (con texto de verdad): nada", L.foto(bytes("%PDF-1.4\n1 0 obj<</Filter/FlateDecode>>stream\nxyz\nendstream\n%%EOF")), null);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
