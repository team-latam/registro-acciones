import { abrirNavegador, entrar, ADMIN, BASE, post, pais, tab, click } from "./app_de_mentira.mjs";
/* ======================================================================
   «Mes a mes» con columnas que se tocan (12/10/2026; el usuario eligió la
   opción A de la maqueta «Mes a mes interactivo»)

   Hasta ahora las columnas no hacían nada: en la compu salía el globito del
   navegador y en el celular, nada. Ahora cada columna es un botón: la marca
   y abre debajo del gráfico la ficha de ese mes (cuánto fue, contra el mismo
   mes de antes, qué tipos y dónde, y un botón para ver esas actividades en
   el Inicio). Con ‹ › se pasa de mes, la ✕ o tocar la misma columna la
   cierra, y con el teclado ← → pasan de una columna a otra.

   Los números se comparan con una cuenta hecha a mano sobre los datos de
   la prueba, y la lista del Inicio con lo que decía la ficha.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const P = (id, start, type, scopes, extra) => post({ id, start, a: 0, type, title: "Actividad " + id, scopes, extra: extra || {} });
const AR = [pais("Argentina")], CL = [pais("Chile")], PE = [pais("Perú")];
const base = BASE();
base.posts = [
  // Abril de 2026: 5 actividades (2 visitas, un curso, una virtual, una sin lugar)
  P("a1", "2026-04-03", "visita", AR), P("a2", "2026-04-10", "visita", AR), P("a3", "2026-04-14", "curso", CL), P("a4", "2026-04-20", "virtual", PE), P("a5", "2026-04-25", "otro", []),
  // Abril de 2025: 3 (para «2 más que abril de 2025»)
  P("p1", "2025-04-04", "visita", AR), P("p2", "2025-04-11", "curso", CL), P("p3", "2025-04-18", "visita", AR),
  P("m1", "2026-03-12", "visita", AR), P("y1", "2026-05-06", "curso", CL), P("y2", "2026-05-21", "virtual", PE),
  // Octubre (el mes en curso): 1 hecha y 2 por venir. Noviembre: solo 1 planificada.
  P("o1", "2026-10-05", "visita", AR), P("o2", "2026-10-20", "curso", CL), P("o3", "2026-10-28", "visita", AR), P("n1", "2026-11-15", "seminario", AR),
  // Una reunión semanal de 4 veces en junio: 4 actividades en 1 posteo
  P("serie", "2026-06-01", "virtual", PE, { start_time: "10:00:00", end_time: "11:00:00", recurrence: ["RRULE:FREQ=WEEKLY;COUNT=4"] }),
];
base.replies = [];

const b = await abrirNavegador();
const HOY = new Date("2026-10-12T12:00:00");
const abrir = async (opciones = {}) => {
  const r = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base, ...opciones });
  await r.p.clock.setFixedTime(HOY);
  await tab(r.p, "reportes"); await r.p.waitForSelector(".rep-total-num");
  return r;
};
const texto = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const cuantos = (p, sel) => p.$$eval(sel, l => l.length);
const filas = (p, bloque) => p.$$eval(`.rep-mes-dos > div:${bloque} .rep-fila`, l => l.map(f => [f.querySelector(".rep-etiqueta").textContent.replace(/\s+/g, " ").trim(), Number(f.querySelector(".rep-num").textContent)]));
const col = mes => `button.rep-col[data-mes="${mes}"]`;
const enfocado = p => p.evaluate(() => document.activeElement && (document.activeElement.dataset.nav || (document.activeElement.dataset.cerrar && "cerrar") || document.activeElement.dataset.mes || document.activeElement.tagName));

/* ---------------- 1. Las columnas son botones, la ficha empieza cerrada ---------------- */
{
  const { p, errores } = await abrir();
  eq("hay 12 columnas y todas son botones", await cuantos(p, "button.rep-col"), 12);
  eq("ninguna está marcada y no hay ficha", [await cuantos(p, 'button.rep-col[aria-pressed="true"]'), await cuantos(p, ".rep-mes-ficha")], [0, 0]);
  eq("la nota del gráfico dice que se puede tocar", /Tocá un mes para ver su ficha/.test(await texto(p, ".rep-bloque-mensual .rep-bloque-nota")), true);
  eq("el mes de hoy (octubre) lleva su marca", await cuantos(p, `${col("2026-10")}.rep-hoy`), 1);
  eq("un lector de pantalla oye el mes, la cantidad y la comparación",
     await p.$eval(col("2026-04"), e => e.getAttribute("aria-label")), "abril 2026: 5 actividades. 2 más que antes (3).");
  eq("con lo planificado, también cuánto viene", await p.$eval(col("2026-10"), e => e.getAttribute("aria-label")), "octubre 2026: 1 actividad, 2 por venir. 1 más que antes (0).");

  /* ---------------- 2. Tocar abril ---------------- */
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  eq("la columna queda marcada y las demás se atenúan", [await p.$eval(col("2026-04"), e => e.getAttribute("aria-pressed")), await cuantos(p, ".rep-cols.hay-sel")], ["true", 1]);
  eq("el título de la ficha", await texto(p, ".rep-mes-cab h4"), "abril 2026");
  eq("cuánto fue: 5, como dice la columna", [await texto(p, ".rep-mes-n"), await texto(p, `${col("2026-04")} .rep-num`)], ["5", "5"]);
  eq("contra abril de 2025 (3): 2 más", await texto(p, ".rep-mes-grande .rep-delta"), "▲ 2 más que abril de 2025 (3)");
  eq("qué fueron (a mano: 2 visitas y una de cada otra)", await filas(p, "nth-child(1)"), [["🧳 Visita", 2], ["✨ Otro", 1], ["💻 Virtual", 1], ["📘 Curso", 1]]);
  eq("dónde (el que no tiene lugar no aparece)", await filas(p, "nth-child(2)"), [["Argentina", 2], ["Chile", 1], ["Perú", 1]]);
  eq("el botón dice cuántas y de qué mes", await texto(p, ".rep-mes-ir"), "Ver 5 actividades de abril →");
  eq("el foco queda en la columna que se tocó", await enfocado(p), "2026-04");

  /* ---------------- 3. De mes en mes ---------------- */
  await click(p, '.rep-mes-ficha [data-nav="ant"]'); await p.waitForTimeout(150);
  eq("‹ pasa a marzo (1 actividad)", [await texto(p, ".rep-mes-cab h4"), await texto(p, ".rep-mes-n"), await texto(p, ".rep-mes-t")], ["marzo 2026", "1", "actividad hecha"]);
  eq("y el foco se queda en la flecha (se puede seguir con Enter)", await enfocado(p), "ant");
  await click(p, '.rep-mes-ficha [data-nav="sig"]'); await click(p, '.rep-mes-ficha [data-nav="sig"]'); await p.waitForTimeout(150);
  eq("› dos veces: mayo (2)", [await texto(p, ".rep-mes-cab h4"), await texto(p, ".rep-mes-n")], ["mayo 2026", "2"]);
  await click(p, '.rep-mes-ficha [data-nav="sig"]'); await p.waitForTimeout(150);
  eq("junio: la reunión semanal cuenta 4 veces", [await texto(p, ".rep-mes-cab h4"), await texto(p, ".rep-mes-n"), await texto(p, ".rep-mes-ir")], ["junio 2026", "4", "Ver 4 actividades de junio →"]);

  /* ---------------- 4. Lo planificado ---------------- */
  await click(p, col("2026-10")); await p.waitForTimeout(150);
  eq("octubre, el mes en curso: lo hecho y lo que viene", [await texto(p, ".rep-mes-cab h4"), await texto(p, ".rep-mes-n"), await texto(p, ".rep-mes-aviso")],
     ["octubre 2026 · en curso", "1", "Hechas: 1 · por venir: 2 (con borde punteado en el gráfico)."]);
  await click(p, col("2026-11")); await p.waitForTimeout(150);
  eq("noviembre, que todavía no pasó: solo lo planificado y ningún botón al Inicio",
     [await texto(p, ".rep-mes-n"), await texto(p, ".rep-mes-t"), await texto(p, ".rep-mes-aviso"), await cuantos(p, ".rep-mes-ir")],
     ["1", "planificadas", "Todavía no pasó nada de este mes. Planificadas: 1.", 0]);
  await click(p, col("2026-01")); await p.waitForTimeout(150);
  eq("enero, sin nada: lo dice, sin listas ni botón", [await texto(p, ".rep-mes-n"), await texto(p, ".rep-vacio"), await cuantos(p, ".rep-mes-dos, .rep-mes-ir")], ["0", "No hay nada cargado en este mes.", 0]);
  eq("en enero no hay mes anterior, y en diciembre no hay siguiente", [await p.$eval('.rep-mes-ficha [data-nav="ant"]', e => e.disabled), await p.$eval('.rep-mes-ficha [data-nav="sig"]', e => e.disabled)], [true, false]);
  await click(p, col("2026-12")); await p.waitForTimeout(150);
  eq("diciembre: › deshabilitado", await p.$eval('.rep-mes-ficha [data-nav="sig"]', e => e.disabled), true);

  /* ---------------- 5. Cerrar ---------------- */
  await click(p, col("2026-04")); await p.waitForTimeout(150);
  await click(p, col("2026-04")); await p.waitForTimeout(150);
  eq("tocar la misma columna cierra la ficha", [await cuantos(p, ".rep-mes-ficha"), await cuantos(p, ".rep-cols.hay-sel")], [0, 0]);
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  await click(p, ".rep-mes-ficha [data-cerrar]"); await p.waitForTimeout(150);
  eq("la ✕ también, y el foco vuelve a la columna", [await cuantos(p, ".rep-mes-ficha"), await enfocado(p)], [0, "2026-04"]);

  /* ---------------- 6. Con el teclado ---------------- */
  await p.focus(col("2026-04"));
  await p.keyboard.press("ArrowRight"); eq("→ pasa a mayo", await enfocado(p), "2026-05");
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); eq("← ← vuelve a marzo", await enfocado(p), "2026-03");
  await p.keyboard.press("Home"); eq("Inicio va a enero", await enfocado(p), "2026-01");
  await p.keyboard.press("End"); eq("Fin va a diciembre", await enfocado(p), "2026-12");
  await p.keyboard.press("ArrowRight"); eq("no se sale por la punta", await enfocado(p), "2026-12");
  await p.focus(col("2026-04")); await p.keyboard.press("Enter"); await p.waitForSelector(".rep-mes-ficha");
  eq("Enter abre la ficha de la columna con el foco", [await texto(p, ".rep-mes-cab h4"), await enfocado(p)], ["abril 2026", "2026-04"]);

  /* ---------------- 7. Al Inicio, con ese mes ---------------- */
  await click(p, ".rep-mes-ir"); await p.waitForSelector(".feed-solapas");
  eq("el Inicio llega con el mes puesto en el filtro de fecha", await texto(p, '.fb-ficha-abrir[data-cat="fecha"]'), "📅 abril 2026");
  eq("y la lista tiene los 5 posteos de abril (lo que decía la ficha)", await texto(p, '.feed-solapas button[data-key="pasado"] .fs-n'), "5");
  eq("«Volver a Reportes» está", await cuantos(p, ".fb-volver"), 1);
  await click(p, ".fb-volver"); await p.waitForSelector(".rep-total-num");
  eq("al volver, la ficha de abril sigue abierta", [await cuantos(p, ".rep-mes-ficha"), await texto(p, ".rep-mes-cab h4")], [1, "abril 2026"]);
  // El panel de filtros muestra el mes elegido.
  await click(p, col("2026-06")); await p.waitForTimeout(150); await click(p, ".rep-mes-ir"); await p.waitForSelector(".feed-solapas");
  eq("junio: 1 posteo en la lista, y la línea explica que son 4 actividades", [await texto(p, '.feed-solapas button[data-key="pasado"] .fs-n'), /4 actividades en 1 posteo/.test(await texto(p, ".fb-nota"))], ["1", true]);
  await p.evaluate(() => window.scrollTo(0, 0)); await click(p, "#fbFiltros"); await p.waitForSelector(".fp-panel");
  await click(p, '.fp-item[data-cat="fecha"]'); await p.waitForTimeout(200);
  eq("el panel de filtros muestra «junio 2026» elegido, y ningún año", [await p.$$eval(".fp-op.on", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), await cuantos(p, ".fp-tris")], [["junio 2026"], 0]);
  await p.keyboard.press("Escape");

  /* ---------------- 8. Los «Ver solo» del reporte también valen ---------------- */
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  await click(p, '[data-action="reporte-filtros"]'); await p.waitForSelector("#repFTipo");
  await p.selectOption("#repFTipo", "visita"); await p.waitForTimeout(250);
  await p.keyboard.press("Escape");
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  eq("con «Ver solo: Visita», la ficha de abril cuenta solo las visitas", [await texto(p, ".rep-mes-n"), await filas(p, "nth-child(1)")], ["2", [["🧳 Visita", 2]]]);
  await click(p, ".rep-mes-ir"); await p.waitForSelector(".feed-solapas");
  eq("y la lista del Inicio da lo mismo: 2 posteos de visita en abril", [await texto(p, '.feed-solapas button[data-key="pasado"] .fs-n'), await texto(p, '.fb-ficha-abrir[data-cat="fecha"]')], ["2", "📅 abril 2026"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 9. Cambiar de año cierra la ficha; Comparar no cambia ---------------- */
{
  const { p, errores } = await abrir();
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  await p.selectOption("#repAnio", "2025"); await p.waitForTimeout(250);
  eq("otro año: la ficha se cierra (ese mes ya no está)", await cuantos(p, ".rep-mes-ficha"), 0);
  await p.selectOption("#repAnio", "2026"); await p.waitForTimeout(250);
  eq("y al volver al año no reaparece sola", await cuantos(p, ".rep-mes-ficha"), 0);
  await click(p, '[data-action="reporte-modo"][data-key="comparar"]'); await p.waitForTimeout(300);
  eq("en «Comparar» las columnas siguen siendo solo para mirar", [await cuantos(p, "button.rep-col"), await cuantos(p, ".rep-cols .rep-col")], [0, 12]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 10. En inglés, en hebreo y en el celular ---------------- */
{
  const { p, errores } = await abrir({ lang: "en" });
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  eq("en inglés: título, comparación y botón", [await texto(p, ".rep-mes-cab h4"), await texto(p, ".rep-mes-grande .rep-delta"), await texto(p, ".rep-mes-ir")],
     ["April 2026", "▲ 2 more than April 2025 (3)", "See 5 activities in April →"]);
  eq("y el lector de pantalla lo oye en inglés", await p.$eval(col("2026-04"), e => e.getAttribute("aria-label")), "April 2026: 5 activities. 2 more than before (3).");
  eq("sin errores en la consola", errores, []);
  await p.close();
}
{
  const { p, errores } = await abrir({ lang: "he" });
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  eq("en hebreo: las flechas se espejan (la del mes anterior mira a la derecha)", await p.$$eval(".rep-mes-ficha [data-nav]", l => l.map(e => [e.dataset.nav, e.textContent])), [["ant", "›"], ["sig", "‹"]]);
  eq("y la flecha del botón mira a la izquierda", /←$/.test(await texto(p, ".rep-mes-ir")), true);
  await p.focus(col("2026-04")); await p.keyboard.press("ArrowRight");
  eq("con el teclado, → va al mes anterior (el primero queda a la derecha)", await enfocado(p), "2026-03");
  eq("sin errores en la consola", errores, []);
  await p.close();
}
{
  const { p, errores } = await abrir({ viewport: { width: 390, height: 844 } });
  await click(p, col("2026-04")); await p.waitForSelector(".rep-mes-ficha");
  const m = await p.evaluate(() => {
    const c = document.querySelector('button.rep-col[data-mes="2026-04"]').getBoundingClientRect();
    const dos = document.querySelector(".rep-mes-dos"), a = dos.children[0].getBoundingClientRect(), z = dos.children[1].getBoundingClientRect();
    return { ancho: c.width, alto: c.height, apiladas: z.top >= a.bottom - 1, sinCorrimiento: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      botones: [...document.querySelectorAll(".rep-mes-ficha .rep-mes-btn, .rep-mes-ir")].map(e => Math.round(e.getBoundingClientRect().height)) };
  });
  eq("celular: la columna entera se puede tocar (alto de sobra, ancho de un doceavo)", [m.alto >= 150, m.ancho >= 22], [true, true]);
  eq("celular: «Qué fueron» y «Dónde» van una debajo de la otra, y nada se sale de la pantalla", [m.apiladas, m.sinCorrimiento], [true, true]);
  eq("celular: los botones de la ficha miden 40 o más", m.botones.every(h => h >= 40), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
