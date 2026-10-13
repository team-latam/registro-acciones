import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { hacerGrab } from "./grab.mjs";
import { abrirZip, leerHoja, leerTabla } from "./xlsx_lector.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El .xlsx que arma la app (13/10/2026): una Tabla de Excel de verdad

   La planilla de actividades se baja como un .xlsx escrito a mano (un .zip de
   XML), sin librerías. Esta prueba corre el código del index.html de verdad y
   lee el resultado con un lector aparte:
   - el .zip es válido (CRC y tamaños), comprimido o guardado tal cual;
   - hay una Tabla de Excel cuyo rango y cuyos títulos coinciden con la hoja,
     con filtros y la primera fila fija; los títulos repetidos se distinguen;
   - los textos vuelven iguales (con <, &, comillas, saltos de línea y acentos),
     los caracteres de control se sacan, un texto enorme se corta, y algo que
     parece una fórmula queda como texto;
   - las fechas son fechas (número de Excel), los números son números y lo vacío
     no ocupa celda;
   - un enlace válido es un HYPERLINK y uno raro (javascript:) queda como texto;
   - sin filas no hay tabla;
   - el CSV lleva las mismas columnas.
   Si hay python3 con openpyxl, además se comprueba con él (otro lector, el de
   verdad); si no, se omite.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const trozos = ["XLSX_TIPO", "xmlEsc", "sinControl", "letraDeColumna", "serialDeFecha", "CRC_TABLA", "crc32", "comprimirRaw", "zipDe", "URL_DE_ENLACE", "xlsxDeTabla", "celdaCsv", "csvDeTabla"];
const app = new Function(`${trozos.map(n => g(n)).join("\n")}\nreturn { xlsxDeTabla, csvDeTabla, letraDeColumna, serialDeFecha, zipDe };`)();

const leer = async blob => abrirZip(Buffer.from(await blob.arrayBuffer()));
const tabla = filas => ({ hoja: "Actividades", columnas: [
  { titulo: "Desde", tipo: "fecha", ancho: 13 }, { titulo: "Año", tipo: "numero", ancho: 8 }, { titulo: "Título", tipo: "texto", ancho: 40 },
  { titulo: "Texto", tipo: "texto", ancho: 60 }, { titulo: "Enlace", tipo: "enlace", ancho: 10 }, { titulo: "Año", tipo: "texto", ancho: 8 }], filas });
const ENLACE = { url: "https://team-latam.github.io/registro-acciones/?post=p1", texto: "Abrir" };

eq("letras de columna: A, Z, AA, AZ, BA", [0, 25, 26, 51, 52].map(app.letraDeColumna), ["A", "Z", "AA", "AZ", "BA"]);
eq("fechas de Excel: 1/1/2026 es 46023, 30/12/1899 es 0, y una fecha mal escrita no es nada", [app.serialDeFecha("2026-01-01"), app.serialDeFecha("1899-12-30"), app.serialDeFecha("mañana"), app.serialDeFecha("")], [46023, 0, null, null]);

const MAL = '<b>&"x\'</b> árbol ñandú 🧳';
const LARGO = "x".repeat(40000);
const T = tabla([
  ["2026-03-10", 2026, "Visita a Rosario", "Línea 1\nLínea 2 " + MAL, ENLACE, "uno"],
  ["2026-12-31", 2026, '=HYPERLINK("http://malo")', LARGO, { url: "javascript:alert(1)", texto: 'dice "hola"' }, ""],
  ["", null, "Con control \u0001\u0008 adentro", "", null, "tres"],
]);
const blob = await app.xlsxDeTabla(T, { formatoDeFecha: "dd/mm/yyyy" });
const zip = await leer(blob);
eq("el .zip es válido: CRC y tamaños de cada archivo", zip.crcBien, true);
eq("el tipo del archivo es el de un .xlsx", blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
eq("los archivos de un .xlsx, con [Content_Types].xml primero", zip.nombres, ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml", "xl/worksheets/_rels/sheet1.xml.rels", "xl/tables/table1.xml", "xl/styles.xml", "xl/sharedStrings.xml"]);
eq("comprimido (deflate) donde conviene", Object.values(zip.metodos).some(m => m === 8), true);
const filas = leerHoja(zip), tb = leerTabla(zip);
eq("la tabla cubre exactamente la hoja (6 columnas, 3 filas y los títulos) y tiene filtro", [tb.ref, tb.filtro], ["A1:F4", "A1:F4"]);
eq("los títulos de la tabla son los de la fila 1, y el repetido se distingue", [tb.columnas, filas[0]], [["Desde", "Año", "Título", "Texto", "Enlace", "Año (2)"], ["Desde", "Año", "Título", "Texto", "Enlace", "Año (2)"]]);
eq("la primera fila queda fija y los anchos van por columna", [/<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/.test(zip.archivos["xl/worksheets/sheet1.xml"]), /<col min="4" max="4" width="60" customWidth="1"\/>/.test(zip.archivos["xl/worksheets/sheet1.xml"])], [true, true]);
eq("la fecha es un número de Excel con el estilo de fecha, y el año un número", [filas[1][0], filas[1][1], /<c r="A2" s="1">/.test(zip.archivos["xl/worksheets/sheet1.xml"])], [46091, 2026, true]);
eq("el formato de fecha es el pedido", /<numFmt numFmtId="164" formatCode="dd\/mm\/yyyy"\/>/.test(zip.archivos["xl/styles.xml"]), true);
eq("los textos vuelven iguales: <, &, comillas, acentos, emoji y el salto de línea", filas[1][3], "Línea 1\nLínea 2 " + MAL);
eq("algo que parece una fórmula queda como TEXTO, no como fórmula", [filas[2][2], /<c r="C3" t="s">/.test(zip.archivos["xl/worksheets/sheet1.xml"])], ['=HYPERLINK("http://malo")', true]);
eq("un texto enorme se corta a 32.000 y termina en «…»", [filas[2][3].length, filas[2][3].endsWith("…")], [32000, true]);
eq("los caracteres de control se sacan", filas[3][2], "Con control  adentro");
eq("lo vacío no ocupa celda (fecha vacía, número vacío, texto vacío)", [filas[3][0], filas[3][1], filas[3][3], filas[3][4]], [undefined, undefined, undefined, undefined]);
eq("un enlace válido es un HYPERLINK con su texto", filas[1][4], { f: 'HYPERLINK("https://team-latam.github.io/registro-acciones/?post=p1","Abrir")', v: "Abrir" });
eq("un enlace raro (javascript:) queda como texto, con las comillas bien", [filas[2][4], /HYPERLINK/.test(zip.archivos["xl/worksheets/sheet1.xml"].split('<row r="3">')[1].split("</row>")[0])], ['dice "hola"', false]);

// Sin compresión disponible, igual es un .zip válido.
{
  const guardado = globalThis.CompressionStream; globalThis.CompressionStream = undefined;
  const z = await leer(await app.xlsxDeTabla(T));
  globalThis.CompressionStream = guardado;
  eq("sin CompressionStream, el .zip se guarda tal cual y sigue siendo válido", [z.crcBien, Object.values(z.metodos).every(m => m === 0), leerHoja(z)[1][2]], [true, true, "Visita a Rosario"]);
}
// Sin filas: solo los títulos, sin tabla (Excel no admite una tabla vacía).
{
  const z = await leer(await app.xlsxDeTabla(tabla([])));
  eq("sin filas no hay tabla ni su archivo, pero sí los títulos", [z.nombres.includes("xl/tables/table1.xml"), leerHoja(z)[0].length, leerTabla(z)], [false, 6, null]);
}
// De derecha a izquierda.
eq("en hebreo la hoja se abre de derecha a izquierda", /<sheetView workbookViewId="0" rightToLeft="1">/.test((await leer(await app.xlsxDeTabla(T, { derechaAIzquierda: true }))).archivos["xl/worksheets/sheet1.xml"]), true);
// Muchas filas y columnas.
{
  const filasGrandes = Array.from({ length: 3000 }, (_, i) => ["2026-01-01", i, "Título " + i, "texto ".repeat(20), null, ""]);
  const z = await leer(await app.xlsxDeTabla(tabla(filasGrandes)));
  const h = leerHoja(z);
  eq("3.000 filas: la tabla llega a la 3001 y la última fila es la última", [leerTabla(z).ref, h[3000][2]], ["A1:F3001", "Título 2999"]);
}
// El CSV.
{
  const csv = app.csvDeTabla(T).split("\r\n");
  eq("el CSV: títulos, y la fórmula con apóstrofo; el enlace va como dirección", [csv[0], csv[2].includes("\"'=HYPERLINK"), csv[1].includes("?post=p1"), csv[1].startsWith('"2026-03-10";2026;')], ['"Desde";"Año";"Título";"Texto";"Enlace";"Año"', true, true, true]);
}

// Otro lector, el de verdad, si está.
{
  const ruta = os.tmpdir() + "/prueba_xlsx_" + process.pid + ".xlsx";
  fs.writeFileSync(ruta, Buffer.from(await blob.arrayBuffer()));
  const r = spawnSync("python3", ["-c", `
import sys
try:
    import openpyxl
except Exception:
    print("sin-openpyxl"); sys.exit(0)
ws = openpyxl.load_workbook(sys.argv[1]).active
t = ws.tables["Actividades"]
print("|".join([ws.title, ws.dimensions, t.ref, str(ws.freeze_panes), str(ws["A2"].value.date()), str(ws["B2"].value), ws["C3"].value, str(ws["D3"].value is not None and len(ws["D3"].value))]))
`, ruta], { encoding: "utf8" });
  fs.unlinkSync(ruta);
  if(r.status === 0 && r.stdout.trim() !== "sin-openpyxl")
    eq("openpyxl lo abre: hoja, rango, tabla, fila fija, fecha, número, texto y largo cortado", r.stdout.trim(), "Actividades|A1:F4|A1:F4|A2|2026-03-10|2026|=HYPERLINK(\"http://malo\")|32000");
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
