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
const trozos = ["impNorm", "IMP_CORTE", "impNumero", "impIso", "impFecha", "IMP_MESES", "impMesDeHoja", "impMonedaOriginal", "IMP_SIN_CENTAVOS", "IMP_COLUMNAS", "impLeerHoja", "impLeerMovimientos", "IMP_VACIAS", "impPalabras", "impDias", "impFirma", "impArmar", "impParaLaBase"];
const A = new Function(`${trozos.map(n => g(n)).join("\n")}\nreturn { impNumero, impFecha, impMesDeHoja, impMonedaOriginal, impLeerHoja, impLeerMovimientos, impArmar, impParaLaBase, impNorm };`)();

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
  ["Hotel en Montevideo", "11-9-2026", 300, "USD", "Alojamiento", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Cena", "12-9-2026", 45.5, "USD", "Comida", "Visita", "", "Efectivo", "", "No", "Gasto por MEX 2,834.00.-"],
  ["Cena sola", "30-9-2026", "$1.500,00", "ARS", "Comida", "Rutina", "", "Efectivo", "", "Si", ""],
  ["Suscripción", "5-9-2026", 20, "USD", "Software nuevo", "Rutina", "", "Tarjeta", "ORG", "Si", ""],
  ["Pasaje de Iván", "14-9-2026", 80, "USD", "Pasaje", "Visita", "Empleados", "Tarjeta", "ORG", "Si", ""],
  ["Sin fecha", "", 10, "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  ["Fecha de otro mes", "3-6-2026", 10, "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  ["Monto raro", "6-9-2026", "mucho", "USD", "Comida", "Rutina", "", "", "", "Si", ""],
  [null, null, null, null, null, null, null, null, null, null, null],
  ["Hotel del otro viaje", "11-9-2026", 100, "USD", "Alojamiento", "Visita", "", "Tarjeta", "ORG", "Si", ""],
  ["Total", null, 9999, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null, null, null, null],
]);
const H = A.impLeerHoja(SEP, "SEP26");
eq("la solapa se reconoce: septiembre de 2026, 10 filas (sin el «Total» ni las vacías)", [H.anio, H.mes, H.filas.length], [2026, 9, 10]);
eq("una solapa que no es de un mes no se lee", A.impLeerHoja(SEP, "Resumen"), null);
eq("una hoja sin fila de títulos no se lee", A.impLeerHoja([["a", "b"], [1, 2]], "SEP26"), null);
const cena = H.filas[2];
eq("la cena en otra moneda: gasto en MXN 2834, rendido USD 45.5", [cena.moneda, cena.monto, cena.rendidoMoneda, cena.rendidoMonto, cena.factura], ["MXN", 2834, "USD", 45.5, false]);
eq("«$1.500,00» en pesos", [H.filas[3].moneda, H.filas[3].monto], ["ARS", 1500]);
eq("las dudas de cada fila", H.filas.map(x => x.dudas), [[], [], [], [], [], [], ["fecha"], ["fecha_fuera_de_la_hoja"], ["monto"], []]);
eq("los bloques: lo separado por una fila en blanco es otro viaje", H.filas.map(x => x.bloque), [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
eq("un mes de distancia no es dudoso (un viaje cruza de mes); tres meses sí", A.impLeerHoja(hoja([["x", "3-8-2026", 1, "USD", "Comida", "Rutina", "", "", "", "Si", ""]]), "SEP26").filas[0].dudas, []);
eq("la forma de pago", H.filas.slice(0, 4).map(x => x.formaPago), ["tarjeta", "tarjeta", "efectivo", "efectivo"]);

// Monedas sin centavos: «13.599» en pesos chilenos es trece mil; en otras, «1.500» sigue siendo dudoso
const mo = o => A.impLeerHoja(hoja([["x", "3-9-2026", 20, "USD", "Comida", "Visita", "", "", "", "Si", o]]), "SEP26").filas[0].dudas;
eq("«Gasto por CLP 13.599.-» no es dudoso (el peso chileno no tiene centavos)", mo("Gasto por CLP 13.599.-"), []);
eq("«Gasto por BZD 1.500.-» sí (puede ser 1500 o 1,5)", mo("Gasto por BZD 1.500.-"), ["monto_ambiguo"]);

// El libro de movimientos de plata
const LIB = [["Work Expenses"], ["Date", "Type", "Description", "Currency", "Amount", "Note"],
  [new Date(2026, 7, 17), "Spent", "Viaje de prueba", "USD", 3113.4, ""],
  [new Date(2026, 8, 8), "Salary", "Sueldo inventado", "USD", 4500, "no se lee"],
  [new Date(2026, 9, 15), "Received for expenses", "Fondos", "USD", 10825, "Recibido en una casa"],
  [new Date(2026, 9, 16), "Returned", "Devolución", "usd", "$100.00", ""],
  ["sin fecha", "Received for expenses", "Roto", "USD", 5, ""],
  [new Date(2026, 9, 20), "Received for expenses", "Sin moneda", "", 5, ""],
  [new Date(2026, 10, 1), "Transfer", "Otra cosa", "USD", 1, ""]];
const L = A.impLeerMovimientos(LIB);
eq("el libro: lo recibido, lo devuelto y lo gastado, y el salario solo se cuenta", [L.recibidos.length, L.devueltos.length, L.gastados.length, L.salarios, L.otros.length], [3, 1, 1, 1, 1]);
eq("…el salario no deja rastro: ni monto ni descripción en lo leído", JSON.stringify(L).includes("4500") || JSON.stringify(L).includes("Sueldo"), false);
eq("…lo recibido: fecha, moneda, monto y descripción", [L.recibidos[0].fecha, L.recibidos[0].moneda, L.recibidos[0].monto, L.recibidos[0].descripcion, L.recibidos[0].dudas], ["2026-10-15", "USD", 10825, "Fondos", []]);
eq("…lo devuelto, con la moneda en mayúsculas y el monto con símbolo", [L.devueltos[0].moneda, L.devueltos[0].monto], ["USD", 100]);
eq("…lo dudoso: sin fecha, sin moneda", [L.recibidos[1].dudas, L.recibidos[2].dudas], [["fecha"], ["moneda"]]);
eq("una hoja que no es el libro no se lee como libro", A.impLeerMovimientos(SEP), null);

// «Gasto en MX $ 61,20.-», sin monto en dólares (solo la moneda original) y los cambios de moneda
const fl = (obs, monto = 20, concepto = "x", tipo = "Comida") => A.impLeerHoja(hoja([[concepto, "3-9-2026", monto, "USD", tipo, "Visita", "", "", "", "Si", obs]]), "SEP26").filas[0];
eq("«Gasto en MX $ 61,20.-» es MXN 61.20", [fl("Gasto en MX $ 61,20.-").moneda, fl("Gasto en MX $ 61,20.-").monto, fl("Gasto en MX $ 61,20.-").rendidoMonto], ["MXN", 61.2, 20]);
const solo = fl("Gasto por MEX 5,549.28.- (50% de otra cosa)", "");
eq("sin monto en dólares pero con la moneda original: queda en esa moneda, sin duda", [solo.moneda, solo.monto, solo.rendidoMoneda, solo.rendidoMonto, solo.dudas], ["MXN", 5549.28, "MXN", 5549.28, []]);
eq("«Cambio Dólares a Florín» (sin tipo) no es un gasto: queda aparte", fl("", 100, "Cambio Dólares a Florín", "").dudas.includes("cambio"), true);
eq("la rutina es la del mes de la SOLAPA, no de la fecha de la fila", A.impArmar(A.impLeerHoja(hoja([["Alojamiento", "13-9-2026", 50, "USD", "Alojamiento", "Rutina", "", "", "", "Si", ""]]), "OCT26").filas, { mapaTipo: { alojamiento: "alojamiento" }, mapaPago: {}, posts: [], existentes: [] }).rends.map(r => r.rutinaMes), ["2026-10-01"]);
eq("desde agosto de 2026 corre la cuenta corriente: un viaje de agosto no es histórico, uno de julio sí", [A.impArmar(A.impLeerHoja(hoja([["x", "5-8-2026", 5, "USD", "Comida", "Visita", "", "", "", "Si", ""]]), "AGO26").filas, { mapaTipo: { comida: "comida" }, mapaPago: {}, posts: [], existentes: [] }).rends[0].historica,
  A.impArmar(A.impLeerHoja(hoja([["x", "5-7-2026", 5, "USD", "Comida", "Visita", "", "", "", "Si", ""]]), "JUL26").filas, { mapaTipo: { comida: "comida" }, mapaPago: {}, posts: [], existentes: [] }).rends[0].historica], [false, true]);

// El enlace con la Agenda: por el NOMBRE (y las fechas), no por las fechas solas
const FILAS_CZ = [["Pasaje a Curazao Ida", "5-8-2026", 900, "USD", "Pasaje", "Visita", "", "", "", "Si", ""], ["Taxi", "13-8-2026", 50, "USD", "Transporte", "Visita", "", "", "", "Si", ""],
  ["Hotel en Curazao", "16-8-2026", 590, "USD", "Alojamiento", "Visita", "", "", "", "Si", ""], ["Cena", "17-8-2026", 30, "USD", "Comida", "Visita", "", "", "", "Si", ""]];
const mt = { pasaje: "pasaje", transporte: "transporte", alojamiento: "alojamiento", comida: "comida" };
const postsCZ = [{ id: "p_scl", title: "Santiago de Chile", activityType: "visita", startDate: "2026-08-13", endDate: "2026-08-14", lugares: "Chile Santiago" },
  { id: "p_cur", title: "Curazao", activityType: "visita", startDate: "2026-08-13", endDate: "2026-08-17", lugares: "Curazao" }];
const armarCZ = (posts, libro = []) => A.impArmar(A.impLeerHoja(hoja(FILAS_CZ), "AGO26").filas, { mapaTipo: mt, mapaPago: {}, posts, existentes: [], libro }).rends[0];
eq("el viaje a Curazao se enlaza con «Curazao» (el nombre coincide), no con «Santiago de Chile» que cae el mismo día", armarCZ(postsCZ).postId, "p_cur");
eq("si en la Agenda solo está «Santiago de Chile» ese día, NO se enlaza: queda sugerida por las fechas, para que lo decida el admin", [armarCZ([postsCZ[0]]).postId, armarCZ([postsCZ[0]]).sugerida], ["", "p_scl"]);
eq("sin nada que se parezca, ni enlace ni sugerencia", [armarCZ([]).postId, armarCZ([]).sugerida], ["", ""]);
const libroCZ = [{ moneda: "USD", monto: 1570, descripcion: "Curaçao (13-17 Aug)" }, { moneda: "USD", monto: 405.08, descripcion: "August Routine" }];
const cz = armarCZ([postsCZ[0]], libroCZ);
eq("el libro, con el mismo total, le da el nombre al viaje y el lugar (sin las fechas entre paréntesis)", [cz.libroNombre, cz.lugar], ["Curaçao (13-17 Aug)", "Curaçao"]);
eq("«Curaçao» del libro y «Curazao» de la Agenda son la misma palabra", armarCZ([postsCZ[1]], libroCZ).postId, "p_cur");
eq("una línea de rutina del libro no se le pone a un viaje aunque el total coincida", armarCZ([], [{ moneda: "USD", monto: 1570, descripcion: "August Routine" }]).libroNombre, "");
eq("un viaje sin ningún nombre en común, de otro lugar el mismo día, queda sugerido", armarCZ([{ id: "p_mdq", title: "Curso Básico en Montevideo", activityType: "curso", startDate: "2026-08-13", endDate: "2026-08-17", lugares: "Uruguay" }]).sugerida, "p_mdq");

// Armado
const mapaTipo = { transporte: "transporte", alojamiento: "alojamiento", comida: "comida", pasaje: "pasaje" }; // «Software nuevo» sin elegir
const posts = [{ id: "p_mvd", title: "Visita a Montevideo", activityType: "visita", startDate: "2026-09-09", endDate: "2026-09-13" },
  { id: "p_otra", title: "Otra", activityType: "visita", startDate: "2026-03-01", endDate: "2026-03-03" },
  { id: "p_largo", title: "Curso anual", activityType: "curso", startDate: "2026-01-05", endDate: "2026-12-18" },
  { id: "p_rut", title: "Rutina", activityType: "rutina", startDate: "2026-09-10", endDate: "2026-09-10" }];
const R = A.impArmar(H.filas, { mapaTipo, mapaPago: { org: "organizacion" }, posts, existentes: [] });
eq("lo dudoso, aparte: el tipo sin elegir, la fecha que no se entiende, la de otro mes y el monto raro", R.dudosas.map(x => [x.concepto, x.dudas]), [["Suscripción", ["tipo"]], ["Sin fecha", ["fecha"]], ["Fecha de otro mes", ["fecha_fuera_de_la_hoja"]], ["Monto raro", ["monto"]]]);
eq("tres rendiciones: la rutina y dos viajes con fechas que se pisan (un bloque cada uno)", R.rends.map(r => [r.clave, r.gastos.length]), [["rutina|2026-09-01", 1], ["viaje|SEP26|0|visita", 4], ["viaje|SEP26|1|visita", 1]]);
const viaje = R.rends.find(r => r.clave === "viaje|SEP26|0|visita");
eq("«Cuenta = Empleados» no deja una fila afuera (la columna no cambia de quién es el gasto)", viaje.gastos.map(x => x.concepto), ["Taxi aeropuerto", "Hotel en Montevideo", "Cena", "Pasaje de Iván"]);
eq("el viaje: fechas, enlace propuesto con la Agenda (no con la rutina) y totales por moneda", [viaje.desde, viaje.hasta, viaje.postId, viaje.totales], ["2026-09-10", "2026-09-14", "p_mvd", { USD: 465.5 }]);
eq("septiembre ya cuenta en la cuenta corriente (corre desde el 1/8/2026)", R.rends.map(r => r.historica), [false, false, false]);
eq("quién pagó: la sigla es la tarjeta de la organización, lo vacío es de bolsillo", viaje.gastos.map(x => x.pago), ["organizacion", "organizacion", "persona", "organizacion"]);
const rut = R.rends.find(r => r.rutinaMes);
eq("la rutina del mes lleva su mes y su total en pesos", [rut.rutinaMes, rut.totales], ["2026-09-01", { ARS: 1500 }]);

// Repetidos: lo ya cargado y lo repetido en la misma planilla
const firmaTaxi = ["2026-09-10", "taxi aeropuerto", 40, "USD"].join("|");
const R2 = A.impArmar(H.filas, { mapaTipo: { ...mapaTipo, "software nuevo": "suscripcion" }, mapaPago: {}, posts: [], existentes: [firmaTaxi] });
eq("lo que ya estaba cargado no se repite", R2.repetidas.map(x => x.concepto), ["Taxi aeropuerto"]);
const R3 = A.impArmar([...H.filas, H.filas[1]], { mapaTipo, mapaPago: {}, posts: [], existentes: [] });
eq("un gasto repetido en la misma planilla tampoco", R3.repetidas.map(x => x.concepto), ["Hotel en Montevideo"]);

// Del 1/8/2026 en adelante no es histórico; y los viajes lejanos no se mezclan
const OCT = hoja([["Taxi", "3-10-2026", 10, "USD", "Transporte", "Visita", "", "", "", "Si", ""], [null, null, null, null, null, null, null, null, null, null, null], ["Taxi 2", "20-10-2026", 12, "USD", "Transporte", "Visita", "", "", "", "Si", ""]]);
const R4 = A.impArmar(A.impLeerHoja(OCT, "OCT26").filas, { mapaTipo, mapaPago: {}, posts: [], existentes: [] });
eq("dos viajes por estar separados por una fila en blanco, no históricos, sin enlace", R4.rends.map(r => [r.desde, r.historica, r.postId]), [["2026-10-03", false, ""], ["2026-10-20", false, ""]]);
const OCT2 = hoja([["Taxi", "3-10-2026", 10, "USD", "Transporte", "Visita", "", "", "", "Si", ""], ["Taxi 2", "20-10-2026", 12, "USD", "Transporte", "Visita", "", "", "", "Si", ""]]);
eq("sin la fila en blanco es un solo viaje, aunque haya semanas entre las fechas", A.impArmar(A.impLeerHoja(OCT2, "OCT26").filas, { mapaTipo, mapaPago: {}, posts: [], existentes: [] }).rends.map(r => [r.desde, r.hasta]), [["2026-10-03", "2026-10-20"]]);

// Lo que viaja a la base
const P = A.impParaLaBase(R.rends.map(r => r === viaje ? { ...r, lugar: "Ciudad X", pais: "Chile" } : r));
const Pv = P.findIndex(x => x.post_id === "p_mvd");
eq("a la base: lo enlazado no lleva lugar ni país (los da la actividad)", [P[Pv].post_id, P[Pv].lugar, P[Pv].pais, P[Pv].historica, P[0].rutina_mes], ["p_mvd", null, null, false, "2026-09-01"]);
eq("…y cada gasto lleva solo lo que la base pide", Object.keys(P[Pv].gastos[0]).sort(), ["concepto", "factura", "fecha", "forma_pago", "moneda", "monto", "observaciones", "pago", "rendido_moneda", "rendido_monto", "tipo"]);
const P2 = A.impParaLaBase(R.rends.map(r => ({ ...r, postId: "", lugar: "Ciudad X", pais: "Chile", excluida: r === rut })));
eq("sin enlace lleva lugar y país; una excluida no viaja", [P2.length, P2[0].lugar, P2[0].pais], [2, "Ciudad X", "Chile"]);

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
