import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
import { abrirNavegador, entrar, ADMIN, BASE, post, pais, dia, tab } from "./app_de_mentira.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El celular que se quedaba colgado (el usuario grabó la pantalla el
   10/10/2026: tocaba «Reportes» en el menú «Más» y el menú seguía abierto,
   con el botón apretado, más de tres segundos).

   Con ~1.000 posteos, muchos que se repiten, lo que más tardaba era sumar
   días con `new Date(...)` + `toISOString()` por cada fecha de cada serie,
   y expandir cada serie tres veces en Reportes. Se arregló con aritmética
   entera y una sola expansión. Una cuenta de fechas que cambia de forma no
   puede cambiar de resultado, así que acá:

   1. las cuentas nuevas se comparan, día por día de 70 años, contra las de
      antes (la versión con Date, escrita acá como referencia);
   2. con la app entera, los números de Reportes y de «Última actividad por
      país» salen iguales a una cuenta hecha a mano, y a la de un posteo
      suelto puesto en el mismo día;
   3. con muchos posteos, tocar una pantalla cierra el menú y marca el
      cambio AL INSTANTE, y dibuja en el cuadro siguiente.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const grab = hacerGrab(src);

/* ---------------- 1. Las cuentas de fechas, contra las de antes ---------------- */
// La referencia: cómo se sumaban los días antes (un Date por cada paso).
const sumarAntes = (iso, dias) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
const isoDateAntes = iso => new Date(iso + "T00:00:00Z");
let nuevas = null;
try{
  // Cada una sola, como las sacan los otros harness: no tienen que depender de nada suelto.
  nuevas = new Function(`${grab("isoDate")}\n${grab("addDaysISO")}\nlet HOY = "2026-10-11"; const todayISO = () => HOY;\n${grab("nearestOccurrence")}\n`
    + `return { addDaysISO, nearestOccurrence, ponerHoy: h => { HOY = h; } };`)();
}catch(e){ console.log("✗ no se pudieron sacar las cuentas de fechas del index.html: " + e.message); }
if(nuevas){
  const DESPLAZAMIENTOS = [0, -1100, -400, -100, -31, -7, -1, 1, 2, 7, 28, 31, 100, 366, 1100];
  let malas = [], total = 0;
  const ini = Date.UTC(1990, 0, 1) / 86400000, fin = Date.UTC(2060, 11, 31) / 86400000;
  for(let n = ini; n <= fin; n++){
    const iso = new Date(n * 86400000).toISOString().slice(0, 10);
    for(const k of DESPLAZAMIENTOS){
      total++;
      const esp = sumarAntes(iso, k), got = nuevas.addDaysISO(iso, k);
      if(got !== esp && malas.length < 5) malas.push(`addDaysISO(${iso}, ${k}) = ${got}, antes ${esp}`);
      else if(got !== esp) malas.push("…");
    }
  }
  eq(`sumar días da lo mismo que antes, ${total.toLocaleString("es")} cuentas de 1990 a 2060 (bisiestos, fines de mes, de año)`, malas.slice(0, 5), []);
  eq("los bisiestos y los siglos", ["2024-02-28", "2100-02-28", "2000-02-28", "2026-12-31", "2027-03-01"].map(x => nuevas.addDaysISO(x, 1)),
     ["2024-02-29", "2100-03-01", "2000-02-29", "2027-01-01", "2027-03-02"]);
  eq("un texto que no es una fecha simple sigue por el camino de antes", nuevas.addDaysISO("+002026-03-05", 1), sumarAntes("+002026-03-05", 1));

  // La fecha más cercana a hoy: la referencia de antes, con tres Date por vuelta.
  const cercanaAntes = (dates, hoy) => {
    if(!dates.length) return null;
    const dist = iso => Math.abs(Math.round((isoDateAntes(iso) - isoDateAntes(hoy)) / 86400000));
    let best = dates[0];
    for(const iso of dates){ const d = dist(iso), b = dist(best); if(d < b || (d === b && iso > best)) best = iso; }
    return best;
  };
  let sem = 11102026;
  const rnd = () => (sem = (sem * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const fechaAlAzar = (hoy, radio) => sumarAntes(hoy, Math.floor(rnd() * radio * 2) - radio);
  const diferentes = [];
  for(const hoy of ["2026-10-11", "2024-02-29", "2026-01-01", "2026-12-31"]){
    nuevas.ponerHoy(hoy);
    for(let i = 0; i < 400; i++){
      const lista = Array.from({ length: Math.floor(rnd() * 12) }, () => fechaAlAzar(hoy, 400));
      if(rnd() < 0.3 && lista.length > 2) lista.push(sumarAntes(hoy, 5), sumarAntes(hoy, -5));   // un empate a propósito: gana la que viene
      const got = nuevas.nearestOccurrence(lista), esp = cercanaAntes(lista, hoy);
      if(got !== esp && diferentes.length < 3) diferentes.push({ hoy, lista, got, esp });
    }
  }
  eq("la fecha más cercana a hoy elige lo mismo que antes (1.600 listas al azar, con empates)", diferentes, []);
  nuevas.ponerHoy("2026-10-11");
  eq("sin fechas, null", nuevas.nearestOccurrence([]), null);
  eq("un empate lo gana la que viene", nuevas.nearestOccurrence(["2026-10-08", "2026-10-14"]), "2026-10-14");
}

/* ---------------- 2. Los números, con la app entera ---------------- */
const b = await abrirNavegador();
const hoy = dia(0), anio = hoy.slice(0, 4);
const suma = (iso, d) => sumarAntes(iso, d);
// Las veces que cae una serie semanal entre dos fechas (inclusive), contadas a mano.
const semanales = (inicio, hasta) => { const r = []; for(let f = inicio; f <= hasta; f = suma(f, 7)) r.push(f); return r; };
const enElAnio = fechas => fechas.filter(f => f.slice(0, 4) === anio && f <= hoy);

// Los posteos de relleno: sin lugar (no entran en «Última actividad por país») y de otro tipo.
const base = BASE();
const relleno = Array.from({ length: 430 }, (_, i) => post({ id: "r" + i, d: 1 + (i * 7) % 700, a: i % 4, type: "visita", title: "Relleno " + i, scopes: [] }));
const rellenoDelAnio = relleno.filter(p => p.start_date.slice(0, 4) === anio && p.start_date <= hoy).length;

// Una serie semanal que sigue; una mensual que terminó hace ~300 días; una semanal que terminó hace ~700 días.
const iniSemana = dia(200);
const iniMensual = (() => { let n = 700; while(+dia(n).slice(8, 10) > 28) n++; return dia(n); })();
const finMensual = dia(300);
const iniVieja = dia(800), finVieja = dia(700);
const mensuales = []; for(let f = iniMensual; f <= finMensual; f = (() => { const [y, m, d] = f.split("-").map(Number); return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); })()) mensuales.push(f);
const viejas = semanales(iniVieja, finVieja);
const activas = semanales(iniSemana, suma(hoy, 400));
const ultimaActiva = activas.filter(f => f <= hoy).pop(), ultimaMensual = mensuales[mensuales.length - 1], ultimaVieja = viejas[viejas.length - 1];

const serie = (id, ini, lugar, regla) => post({ id, start: ini, a: 0, type: "virtual", title: "Serie " + id, scopes: [pais(lugar)],
  extra: { start_time: "10:00:00", end_time: "11:00:00", recurrence: [regla] } });
// Cada serie tiene un gemelo: un posteo suelto en otro país, el día exacto de su última vez (cuenta hecha a mano).
const gemelo = (id, fecha, lugar) => post({ id, start: fecha, a: 1, type: "visita", title: "Gemelo " + id, scopes: [pais(lugar)] });
base.posts = [
  ...relleno,
  serie("activa", iniSemana, "Argentina", "RRULE:FREQ=WEEKLY"),
  serie("mensual", iniMensual, "Chile", `RRULE:FREQ=MONTHLY;UNTIL=${finMensual.replace(/-/g, "")}T235959Z`),
  serie("vieja", iniVieja, "Perú", `RRULE:FREQ=WEEKLY;UNTIL=${finVieja.replace(/-/g, "")}T235959Z`),
  gemelo("g1", ultimaActiva, "Brasil"), gemelo("g2", ultimaMensual, "Colombia"), gemelo("g3", ultimaVieja, "Ecuador"),
];
base.replies = [];
const gemeloEnElAnio = [ultimaActiva, ultimaMensual, ultimaVieja].filter(f => f.slice(0, 4) === anio && f <= hoy).length;

for(const [nombre, viewport] of [["celular", { width: 390, height: 844 }], ["escritorio", { width: 1280, height: 900 }]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport, base });
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num", { timeout: 8000 });
  const numero = async sel => parseInt((await p.$eval(sel, e => e.textContent)).match(/\d+/)[0], 10);
  const virtual = await numero('[data-action="reporte-ir"][data-kind="tipo"][data-key="virtual"]');
  const visitas = await numero('[data-action="reporte-ir"][data-kind="tipo"][data-key="visita"]');
  const total = await numero(".rep-total-num");
  const esperadoVirtual = enElAnio(activas).length + mensuales.filter(f => f.slice(0, 4) === anio).length + viejas.filter(f => f.slice(0, 4) === anio).length;
  eq(`[${nombre}] Reportes: las veces de las tres series (a mano: ${esperadoVirtual})`, virtual, esperadoVirtual);
  eq(`[${nombre}] Reportes: los posteos sueltos`, visitas, rellenoDelAnio + gemeloEnElAnio);
  eq(`[${nombre}] Reportes: el total es la suma`, total, esperadoVirtual + rellenoDelAnio + gemeloEnElAnio);

  // «Última actividad por país»: cada serie dice lo mismo que su gemelo suelto.
  const filas = await p.$$eval(".rep-cobertura li", l => Object.fromEntries(l.map(li => [li.children[0].textContent.trim(), { hace: li.children[1].textContent.trim(), fecha: li.children[1].title }])));
  for(const [serieDe, gemeloDe, cual] of [["Argentina", "Brasil", "la semanal que sigue (ventana corta)"], ["Chile", "Colombia", "la mensual que terminó hace ~300 días (ventana media)"], ["Perú", "Ecuador", "la semanal que terminó hace ~700 días (ventana larga)"]]){
    const a = filas[serieDe], g = filas[gemeloDe];
    eq(`[${nombre}] Última actividad: ${cual} figura`, !!a && !!g, true);
    eq(`[${nombre}] Última actividad: ${serieDe} = ${gemeloDe} (el mismo día, ${g && g.fecha})`, a && { hace: a.hace, fecha: a.fecha }, g && { hace: g.hace, fecha: g.fecha });
  }
  eq(`[${nombre}] sin errores en la consola`, errores, []);
  await p.close();
}

/* ---------------- 3. Tocar una pantalla con muchos posteos ---------------- */
// Lo que ve la persona, medido en el mismo instante del toque (antes del primer await del código).
const alTocar = (p, sel) => p.evaluate(sel => {
  const el = document.querySelector(sel);
  el.click();
  return { menuAbierto: !!document.querySelector(".bn-sheet"), marca: document.body.classList.contains("cambiando-vista"), repArmado: !!document.querySelector(".rep-total-num") };
}, sel);
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, base });
  eq("la prueba parte de 400 posteos o más", base.posts.length >= 400, true);
  await p.click('.bn-item[data-action="toggle-more-menu"]');
  await p.waitForSelector(".bn-sheet-item[data-view=\"reportes\"]");
  const instante = await alTocar(p, '.bn-sheet-item[data-view="reportes"]');
  eq("con muchos posteos, el menú «Más» se cierra en el mismo toque", instante.menuAbierto, false);
  eq("y la pantalla queda marcada como «cambiando»", instante.marca, true);
  eq("y todavía no se armó (se dibuja en el cuadro siguiente)", instante.repArmado, false);
  await p.waitForSelector(".rep-total-num", { timeout: 8000 });
  await p.waitForFunction(() => !document.body.classList.contains("cambiando-vista"), null, { timeout: 4000 });
  eq("Reportes llega a dibujarse y la marca se saca", await p.evaluate(() => ({ marca: document.body.classList.contains("cambiando-vista"), rep: !!document.querySelector(".rep-total-num") })), { marca: false, rep: true });
  eq("la barra de abajo sigue a Reportes o «Más» (no se pierde la ubicación)", await p.evaluate(() => !!document.querySelector(".bn-item.active, .bn-item[aria-current]")), true);
  // Un toque tras otro: ir a Inicio desde la barra
  const inicio = await p.evaluate(() => { const el = document.querySelector('.bn-item[data-view="feed"]'); if(!el) return null; el.click(); return document.body.classList.contains("cambiando-vista"); });
  eq("ir a Inicio desde la barra de abajo también se marca", inicio, true);
  await p.waitForFunction(() => !document.body.classList.contains("cambiando-vista") && document.querySelector(".feed-solapas"), null, { timeout: 8000 });
  eq("y llega a Inicio", await p.evaluate(() => !!document.querySelector(".feed-solapas")), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}
{
  // Con pocos posteos (lo de siempre) no hay nada que esperar: se dibuja en el momento.
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.click('.bn-item[data-action="toggle-more-menu"]');
  await p.waitForSelector(".bn-sheet-item[data-view=\"reportes\"]");
  const instante = await alTocar(p, '.bn-sheet-item[data-view="reportes"]');
  eq("con pocos posteos no se marca nada", instante.marca, false);
  await p.waitForSelector(".rep-total-num", { timeout: 8000 });
  eq("y Reportes se dibuja", await p.evaluate(() => !!document.querySelector(".rep-total-num")), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
