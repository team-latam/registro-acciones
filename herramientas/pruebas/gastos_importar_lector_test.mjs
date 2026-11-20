import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Importador de gastos: el lector de planillas (20/11/2026; docs/rendicion-gastos/README.md, «Importador»)

   Puro, sin navegador: el código sale del index.html de verdad. Datos inventados; los esperados, calculados a mano.
   - montos: «$25,155.00», «$1.500,00», «38.22.-», números, negativos, y los que pueden leerse de dos maneras;
   - fechas: «6-1-2026», «25.01.26», «2/03/2022», Date de Excel, serie, y las imposibles;
   - solapas: «SEP26» sí, «Resumen» no; columnas por NOMBRE (cambian de lugar entre años);
   - moneda original en Observaciones («Gasto por MEX 2,834.00.-» → MXN);
   - lo dudoso queda aparte, los de la columna Cuenta «Empleados» también, y los repetidos no se cargan;
   - el armado: rutina por mes, viajes por cercanía de fechas, enlace propuesto con la Agenda, histórico antes del 1/10/2026.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const trozos = ["impNorm", "IMP_CORTE", "impNumero", "impIso", "impFecha", "IMP_MESES", "impMesDeHoja", "impMonedaOriginal", "IMP_COLUMNAS", "impLeerHoja", "impDias", "impFirma", "impArmar", "impParaLaBase"];
const A = new Function(`${trozos.map(n => g(n)).join("\n")}\nreturn { impNumero, impFecha, impMesDeHoja, impMonedaOriginal, impLeerHoja, impArmar, impParaLaBase, impNorm };`)();

// Montos
const n = v => { const x = A.impNumero(v); return x ? [x.n, x.amb] : null; };
eq("«$25,155.00» (coma de miles, punto de decimales)", n("$25,155.00"), [25155, false]);
eq("«$1.500,00» (al revés)", n("$1.500,00"), [1500, false]);
eq("«38.22.-» con el punto y el guion de la planilla", n("38.22.-"), [38.22, false]);
eq("«2,834.00.-»", n("2,834.00.-"), [2834, false]);
eq("«1.500» es ambiguo: se toma como miles", n("1.500"), [1500, true]);
eq("«13.599.-» también", n("13.599.-"), [13599, true]);
eq("un número de Excel pasa tal cual", n(12.5), [12.5, false]);
eq("negativo con paréntesis y con guion", [n("($40.00)"), n("-$40.00")], [[-40, false], [-40, false]]);
eq("texto sin cifras no es monto", [n("abc"), n(""), n(null)], [null, null, null]);
eq("«0.500» es medio, no quinientos", n("0.500"), [0.5, false]);

// Fechas
const f = A.impFecha;
eq("«6-1-2026» es el 6 de enero (día primero)", f("6-1-2026"), "2026-01-06");
eq("«25.01.26»", f("25.01.26"), "2026-01-25");
eq("«2/03/2022» es el 2 de marzo", f("2/03/2022"), "2022-03-02");
eq("«2026-02-05»", f("2026-02-05"), "2026-02-05");
eq("«31/02/2026» no existe", f("31/02/2026"), null);
eq("un Date de Excel", f(new Date(2026, 8, 10)), "2026-09-10");
eq("una serie de Excel: 46275 es el 10/09/2026", f(46275), "2026-09-10");
eq("basura", [f("ayer"), f(""), f(null), f(5)], [null, null, null, null]);

// Solapas
eq("«SEP26» y «ENE 2026» son meses; «Resumen» y «Modelo» no", [A.impMesDeHoja("SEP26"), A.impMesDeHoja("ENE 2026"), A.impMesDeHoja("Resumen"), A.impMesDeHoja("Modelo")], [{ anio: 2026, mes: 9 }, { anio: 2026, mes: 1 }, null, null]);
eq("«JUN22-bis y JUL» se lee como junio de 2022", A.impMesDeHoja("JUN22-bis y JUL"), { anio: 2022, mes: 6 });

// Moneda original
eq("«Gasto por BZD 38.22.-»", A.impMonedaOriginal("Gasto por BZD 38.22.-"), { moneda: "BZD", monto: 38.22, amb: false });
eq("«MEX» se corrige a MXN", A.impMonedaOriginal("Gasto por MEX 2,834.00.-").moneda, "MXN");
eq("«CLP 13.599.-» es ambiguo", A.impMonedaOriginal("Tarjeta ****. Gasto por CLP 13.599.-"), { moneda: "CLP", monto: 13599, amb: true });
eq("sin «Gasto por» no hay moneda original", A.impMonedaOriginal("Tarjeta 1234"), null);

// Una hoja inventada. Columnas en otro orden que el real, con una fila de título arriba.
const T = ["Concepto", "Fecha", "Monto", "Moneda", "Tipo", "Actividad", "Cuenta", "Forma de pago", "Quién pagó", "Factura", "Observaciones"];
const hoja = (filas, extra = []) => [["Rendición de prueba"], [], T, ...filas, ...extra];
const SEP = hoja([
  ["Taxi aeropuerto", "10-9-2026", 40, "USD", "Transporte", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Hotel", "11-9-2026", 300, "USD", "Alojamiento", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Cena", "12-9-2026", 45.5, "USD", "Comida", "Visita", "", "Efectivo", "", "No", "Gasto por MEX 2,834.00.-"],
  ["Cena sola", "30-9-2026", "$1.500,00", "ARS", "Comida", "Rutina", "", "Efectivo", "", "Si", ""],
  ["Suscripción", "5-9-2026", 20, "USD", "Software nuevo", "Rutina", "", "Tarjeta", "ORG", "Si", ""],
  ["Pasaje de Iván", "14-9-2026", 80, "USD", "Pasaje", "Visita", "Empleados", "Tarjeta", "ORG", "Si", ""],
  ["Sin fecha", "", 10, "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  ["Fecha de otro mes", "3-8-2026", 10, "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  ["Monto raro", "6-9-2026", "mucho", "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  ["Total", null, 9999, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null, null, null],
]);
const H = A.impLeerHoja(SEP, "SEP26");
eq("la solapa se reconoce: septiembre de 2026, 9 filas (sin el «Total» ni las vacías)", [H.anio, H.mes, H.filas.length], [2026, 9, 9]);
eq("una solapa que no es de un mes no se lee", A.impLeerHoja(SEP, "Resumen"), null);
eq("una hoja sin fila de títulos no se lee", A.impLeerHoja([["a", "b"], [1, 2]], "SEP26"), null);
const cena = H.filas[2];
eq("la cena en otra moneda: gasto en MXN 2834, rendido USD 45.5", [cena.moneda, cena.monto, cena.rendidoMoneda, cena.rendidoMonto, cena.factura], ["MXN", 2834, "USD", 45.5, false]);
eq("«$1.500,00» en pesos", [H.filas[3].moneda, H.filas[3].monto], ["ARS", 1500]);
eq("las dudas de cada fila", H.filas.map(x => x.dudas), [[], [], [], [], [], [], ["fecha"], ["fecha_fuera_de_la_hoja"], ["monto"]]);
eq("la forma de pago", H.filas.slice(0, 4).map(x => x.formaPago), ["tarjeta", "tarjeta", "efectivo", "efectivo"]);

// Armado
const mapaTipo = { transporte: "transporte", alojamiento: "alojamiento", comida: "comida", pasaje: "pasaje" }; // «Software nuevo» sin elegir
const posts = [{ id: "p_mvd", title: "Visita a Montevideo", activityType: "visita", startDate: "2026-09-09", endDate: "2026-09-13" },
  { id: "p_otra", title: "Otra", activityType: "visita", startDate: "2026-03-01", endDate: "2026-03-03" },
  { id: "p_rut", title: "Rutina", activityType: "rutina", startDate: "2026-09-10", endDate: "2026-09-10" }];
const R = A.impArmar(H.filas, { mapaTipo, mapaPago: { org: "organizacion" }, posts, existentes: [] });
eq("los de «Empleados» quedan para después", R.empleados.map(x => x.concepto), ["Pasaje de Iván"]);
eq("lo dudoso, aparte: el tipo sin elegir, la fecha que no se entiende, la de otro mes y el monto raro", R.dudosas.map(x => [x.concepto, x.dudas]), [["Suscripción", ["tipo"]], ["Sin fecha", ["fecha"]], ["Fecha de otro mes", ["fecha_fuera_de_la_hoja"]], ["Monto raro", ["monto"]]]);
eq("dos rendiciones: el viaje y la rutina de septiembre", R.rends.map(r => [r.clave, r.gastos.length]), [["rutina|2026-09-01", 1], ["viaje|visita|2026-09-10", 3]]);
const viaje = R.rends.find(r => r.actividad === "visita");
eq("el viaje: fechas, enlace propuesto con la Agenda (no con la rutina) y totales por moneda", [viaje.desde, viaje.hasta, viaje.postId, viaje.totales], ["2026-09-10", "2026-09-12", "p_mvd", { USD: 385.5 }]);
eq("septiembre es histórico (antes del 1/10/2026)", R.rends.map(r => r.historica), [true, true]);
eq("quién pagó: la sigla es la tarjeta de la organización, lo vacío es de bolsillo", viaje.gastos.map(x => x.pago), ["organizacion", "organizacion", "persona"]);
const rut = R.rends.find(r => r.rutinaMes);
eq("la rutina del mes lleva su mes y su total en pesos", [rut.rutinaMes, rut.totales], ["2026-09-01", { ARS: 1500 }]);

// Repetidos: lo ya cargado y lo repetido en la misma planilla
const firmaTaxi = ["2026-09-10", "taxi aeropuerto", 40, "USD"].join("|");
const R2 = A.impArmar(H.filas, { mapaTipo: { ...mapaTipo, "software nuevo": "suscripcion" }, mapaPago: {}, posts: [], existentes: [firmaTaxi] });
eq("lo que ya estaba cargado no se repite", R2.repetidas.map(x => x.concepto), ["Taxi aeropuerto"]);
const R3 = A.impArmar([...H.filas, H.filas[1]], { mapaTipo, mapaPago: {}, posts: [], existentes: [] });
eq("un gasto repetido en la misma planilla tampoco", R3.repetidas.map(x => x.concepto), ["Hotel"]);

// Octubre en adelante no es histórico; y los viajes lejanos no se mezclan
const OCT = hoja([["Taxi", "3-10-2026", 10, "USD", "Transporte", "Visita", "", "", "", "Si", ""], ["Taxi 2", "20-10-2026", 12, "USD", "Transporte", "Visita", "", "", "", "Si", ""]]);
const R4 = A.impArmar(A.impLeerHoja(OCT, "OCT26").filas, { mapaTipo, mapaPago: {}, posts: [], existentes: [] });
eq("dos viajes distintos por estar separados más de cuatro días, no históricos, sin enlace", R4.rends.map(r => [r.desde, r.historica, r.postId]), [["2026-10-03", false, ""], ["2026-10-20", false, ""]]);

// Lo que viaja a la base
const P = A.impParaLaBase(R.rends.map(r => r === viaje ? { ...r, lugar: "Ciudad X", pais: "Chile" } : r));
eq("a la base: lo enlazado no lleva lugar ni país (los da la actividad)", [P[1].post_id, P[1].lugar, P[1].pais, P[1].historica, P[0].rutina_mes], ["p_mvd", null, null, true, "2026-09-01"]);
eq("…y cada gasto lleva solo lo que la base pide", Object.keys(P[1].gastos[0]).sort(), ["concepto", "factura", "fecha", "forma_pago", "moneda", "monto", "observaciones", "pago", "rendido_moneda", "rendido_monto", "tipo"]);
const P2 = A.impParaLaBase(R.rends.map(r => ({ ...r, postId: "", lugar: "Ciudad X", pais: "Chile", excluida: r === rut })));
eq("sin enlace lleva lugar y país; una excluida no viaja", [P2.length, P2[0].lugar, P2[0].pais], [1, "Ciudad X", "Chile"]);

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
