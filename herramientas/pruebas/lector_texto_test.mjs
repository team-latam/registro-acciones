import fs from "node:fs";
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
   comercio. fotoDentroDelPdf saca la foto de un PDF escaneado.
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
try{
  L = new Function(`${["MESES_ESCRITOS", "MONEDAS_EN_TEXTO", "MONEDA_DEL_PAIS", "TIPOS_EN_TEXTO", "numeroDeTicket", "numerosDeLinea",
    "fechaDeTicket", "tituloDeComercio", "leerTextoDeComprobante", "fotoDentroDelPdf"].map(grab).join("\n")}
    return { leer: leerTextoDeComprobante, numero: numeroDeTicket, foto: fotoDentroDelPdf };`)();
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

/* ---- Casos que confunden ---- */
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
