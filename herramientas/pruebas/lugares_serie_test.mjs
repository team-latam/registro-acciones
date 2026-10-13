import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El correo de «Lugares sin actividad» (supabase/avisos/lugares.mjs) mira
   las series que se repiten con una COPIA del código de expandir
   repeticiones de la app (el servidor no puede importar index.html). Esta
   prueba la obliga a dar lo mismo que la de verdad —la que sale del
   index.html de cada corrida— con muchas reglas distintas: si alguien
   cambia cómo la app entiende una repetición y no cambia la copia, falla.
   (13/10/2026, propuesta 2-A.)
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);

// El código de la app, tal cual está en index.html.
const app = new Function(`
  ${["RRULE_DOW", "RRULE_MAX_STEPS", "isoDate", "addDaysISO", "addMonthsISO", "isoDow", "rruleDateToISO", "parseRecurrence", "expandRecurrence"].map(n => g(n)).join("\n")}
  return { expandRecurrence, parseRecurrence };
`)();
const { expandirRepeticion, leerRepeticion, ultimaVez } = await import("../../supabase/avisos/lugares.mjs");

const REGLAS = [
  ["2026-01-05", ["RRULE:FREQ=DAILY"]],
  ["2026-01-05", ["RRULE:FREQ=DAILY;INTERVAL=3;COUNT=20"]],
  ["2026-01-05", ["RRULE:FREQ=WEEKLY"]],
  ["2026-01-05", ["RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20260930T000000Z"]],
  ["2026-01-05", ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]],
  ["2026-01-07", ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10"]],
  ["2026-01-07", ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;UNTIL=20260615"]],
  ["2025-12-31", ["RRULE:FREQ=MONTHLY"]],
  ["2026-01-31", ["RRULE:FREQ=MONTHLY;COUNT=5"]],
  ["2024-02-29", ["RRULE:FREQ=YEARLY"]],
  ["2023-03-10", ["RRULE:FREQ=YEARLY;INTERVAL=2"]],
  ["2020-06-15", ["RRULE:FREQ=YEARLY;COUNT=3"]],
  ["2026-03-02", ["RRULE:FREQ=WEEKLY;COUNT=4", "EXDATE;TZID=America/Argentina/Buenos_Aires:20260309T090000,20260316T090000"]],
  ["2026-03-02", ["RRULE:FREQ=WEEKLY;UNTIL=20260401T000000Z", "EXDATE:20260401"]],
  ["2027-02-01", ["RRULE:FREQ=WEEKLY"]],                                  // empieza en el futuro
  ["2026-01-05", ["RRULE:FREQ=MONTHLY;BYSETPOS=2;BYDAY=TU"]],             // la app no la expande: null
  ["2026-01-05", ["RRULE:FREQ=MONTHLY;BYDAY=2TU"]],                       // tampoco
  ["2026-01-05", ["RRULE:FREQ=HOURLY"]],
  ["2026-01-05", ["RRULE:INTERVAL=2"]],
  ["2026-01-05", []],
  ["2026-01-05", null],
  ["2026-01-05", ["RRULE:FREQ=WEEKLY;INTERVAL=1000"]],
];
const HOY = "2026-10-15";
const VENTANAS = [["2026-01-01", HOY], ["2025-06-01", "2026-12-31"], ["2020-01-01", "2030-01-01"], ["2026-09-01", "2026-09-30"]];
for(const [inicio, lineas] of REGLAS){
  const nombre = `${inicio} ${JSON.stringify(lineas)}`;
  for(const [desde, hasta] of VENTANAS)
    eq(`expandir ${nombre} entre ${desde} y ${hasta}`, expandirRepeticion(inicio, lineas, desde, hasta), app.expandRecurrence(inicio, lineas, desde, hasta));
  eq(`lectura de ${nombre}: se entiende o no, igual que la app`, !!leerRepeticion(lineas), !!app.parseRecurrence(lineas));
  // La última vez: lo mismo que mirar toda la serie con la app, hasta hoy.
  const toda = app.expandRecurrence(inicio, lineas, "1990-01-01", HOY);
  const esperado = toda ? toda.reduce((a, b) => a > b ? a : b, "") : (inicio <= HOY ? inicio : "");
  eq(`última vez de ${nombre}`, ultimaVez({ start_date: inicio, recurrence: lineas, recurrence_skip: [] }, HOY), esperado);
}
eq("lo que Google marcó como saltado no cuenta como última vez", ultimaVez({ start_date: "2026-04-06", recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=20260427T000000Z"], recurrence_skip: ["2026-04-27"] }, HOY), "2026-04-20");

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
