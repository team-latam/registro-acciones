/* ======================================================================
   Tendencias: qué subió y qué bajó en los últimos 90 días (13/10/2026;
   los temas, solos, desde el 14/10/2026)

   Reemplaza a «Temas» (las palabras sueltas que subían y bajaban). El usuario
   pidió ver, juntas, lo que pasó (lugares y tipos) y de qué se habló (temas),
   en Reportes y en el costado del Inicio. Lo que esta prueba cuida:

   El cálculo
   - los últimos 90 días contra los 90 anteriores, con «hoy» fijo; lo cancelado
     y lo que todavía no pasó no cuentan;
   - solo lo que cambió bastante: 3 o más en alguno de los dos tramos, y nuevo,
     apagado, o una vez y media más o menos (con una diferencia de 2 por lo menos);
     de los que más cambiaron a los que menos, y nunca más de 10;
   - lugares y tipos dan lo mismo que el reporte de siempre; los temas los
     descubre el sistema leyendo los posteos y sus respuestas, sin ninguna lista:
     palabras que van juntas («krav maga»), plural y tildes, varias palabras que
     aparecen en los mismos posteos son un solo tema, y un tema solo se muestra si
     el cambio no puede ser casualidad;
   - con menos de 8 posteos en los 180 días, ni la sección ni la tarjeta.
   Reportes
   - las categorías (Todo, Lugares, Tipos, Temas), «Ver las otras N» y «Mostrar menos»;
   - en la compu, un mosaico sin huecos (la primera ficha, grande); en el celular, filas;
   - tocar una ficha abre el Inicio con eso en «Últimos 90 días», y la lista
     da lo que decía el número; «← Volver a Reportes».
   El costado del Inicio
   - 5 filas, «Ver más» de a 5 hasta 10, «Mostrar menos»; la fila abre el Inicio,
     la flecha ↗ abre Reportes (lugar, tipo o tema marcado).
   Los temas solos (sección 7)
   - se arman con el título, el texto y las respuestas; no cuentan lugares, gente,
     tipos, relleno, charla ni verbos; nadie define nada (no hay Administración › Temas).
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, pais, tab, irAdmin, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// «Hoy» es el 12 de octubre de 2026: los últimos 90 días van del 15/7 al 12/10; los 90 anteriores, del 16/4 al 14/7.
const HOY = new Date("2026-10-12T12:00:00");
let k = 0;
const AHORA = i => `2026-${i % 2 ? "08" : "09"}-${String(1 + (i * 3) % 27).padStart(2, "0")}`;     // dentro de los últimos 90 días
const ANTES = i => `2026-${i % 2 ? "05" : "06"}-${String(1 + (i * 3) % 27).padStart(2, "0")}`;     // dentro de los 90 anteriores
// `n` posteos de un país en un tramo; `titulos` y `contenidos` (opcionales) dan el título y el texto de cada uno.
const poner = (base, n, tramo, o = {}) => {
  for(let i = 0; i < n; i++){
    const titulo = o.titulos ? o.titulos[i % o.titulos.length] : `Actividad ${++k}`;
    base.posts.push(post({ id: `t${++k}`, title: titulo, content: o.contenidos ? o.contenidos[i % o.contenidos.length] : o.contenido || "", start: (tramo === "ahora" ? AHORA : ANTES)(i + k), a: 1, type: o.type || "visita", scopes: o.pais ? [pais(o.pais)] : [] }));
  }
};
const vacia = () => { const b = BASE(); b.replies = []; b.posts = []; k = 0; return b; };
// Los datos de la prueba: lo que cambió y lo que no, con la cuenta hecha a mano (ver el comentario de cada línea).
// Los temas no se cargan en ningún lado: salen de los títulos y textos. Hay 37 posteos en los últimos 90 días y 24 en los 90 anteriores.
const datos = () => {
  const b = vacia();
  poner(b, 6, "ahora", { pais: "Chile", titulos: ["Plan de seguridad", "Cámaras nuevas para la sede", "Revisión de la ALARMA", "Seguridad en el acceso", "Cursos de otoño", "Seguridad: protocolo de ingreso"],
    contenidos: ["Seguridad del edificio: cámaras.", "Seguridad: cámaras en la sede.", "Revisión de la seguridad y las cámaras.", "", "", "Cámaras en el ingreso."] });   // Chile: 6 ahora (5 hablan de seguridad, y 4 de ellos también de «cámaras»: un solo tema)
  poner(b, 2, "antes", { pais: "Chile", titulos: ["Seguridad del edificio", "Reunión de comisión"] });                                                                // Chile: 2 antes (1 de seguridad)
  poner(b, 4, "ahora", { pais: "Paraguay", titulos: ["Entrega de becas", "Nueva beca para jóvenes", "Convocatoria a becas", "Reunión de equipo"] });                     // Paraguay: 4 ahora y ninguno antes; 3 de becas
  poner(b, 1, "ahora", { pais: "Brasil" });  poner(b, 5, "antes", { pais: "Brasil" });                                                                                 // Brasil: 1 ahora, 5 antes
  poner(b, 3, "antes", { pais: "Uruguay" });                                                                                                                           // Uruguay: 0 ahora, 3 antes
  poner(b, 4, "ahora", { pais: "Argentina", titulos: ["Taller de Krav Maga", "Clase de krav magá", "Reunión", "Visita"] }); poner(b, 3, "antes", { pais: "Argentina" });  // Argentina: 4/3 (no cambió); 2 de krav maga
  poner(b, 2, "ahora", { pais: "Perú", titulos: ["Charla de seguridad", "Seguridad en la escuela"] });  poner(b, 1, "antes", { pais: "Perú" });                          // Perú: 2/1 (no llega a 3); 2 más de seguridad
  poner(b, 3, "ahora", { pais: "Panamá", titulos: ["Purim con todos", "Seguridad en las fiestas", "Fiestas de fin de año"] });  poner(b, 2, "antes", { pais: "Panamá" });   // Panamá: 3/2 (una diferencia de 1: no cuenta); 1 más de seguridad
  poner(b, 3, "ahora", { pais: "Colombia", titulos: ["Capacitación de líderes", "Capacitación docente", "Capacitación virtual"] });  poner(b, 1, "antes", { pais: "Colombia" });  // Colombia: 3/1 (sube +2); «capacitación» 0 → 3: podría ser casualidad, no es un tema que suba
  poner(b, 4, "ahora", { type: "seminario" });                                                                                                                         // Seminarios, sin lugar: 4 ahora y ninguno antes
  // Sin lugar: más de lo que se habla (tipo «visita», como casi todo, para que «Visita» no cambie: 34 contra 24).
  poner(b, 2, "ahora", { titulos: ["Seguridad: simulacro de evacuación", "Informe de seguridad"] });                                                                    // seguridad: Chile 5 + Perú 2 + Panamá 1 + estos 2 = 10 ahora
  poner(b, 4, "ahora", { titulos: ["Becas 2027: abrió la convocatoria", "Charla informativa sobre becas", "Entrevistas a postulantes a becas", "Cierre de las becas"] });   // becas: 3 + 4 = 7 ahora
  poner(b, 5, "ahora", { titulos: ["Krav maga para jóvenes", "Segunda clase de krav maga", "Krav maga: grupo de chicas", "Encuentro de krav maga", "Krav maga en el club"] });       // krav maga: 2 + 5 = 7 ahora
  poner(b, 7, "antes", { titulos: ["Shavuot: noche de estudio", "Shavuot con los chicos", "Preparativos de Shavuot", "Cena de Shavuot", "Shavuot en familia", "Cheesecake de Shavuot", "Espigas de Shavuot"] });   // Shavuot: 7 antes y ninguno ahora
  // Lo que no cuenta: una cancelada, algo que todavía no pasó y algo de hace más de 180 días.
  b.posts.push(post({ id: "cancelada", title: "Seguridad cancelada", start: "2026-09-10", a: 1, type: "visita", scopes: [pais("Chile")], extra: { cancelled: true, cancelled_at: "2026-09-01", cancelled_by: ADMIN } }));
  b.posts.push(post({ id: "futura", title: "Seguridad que viene", start: "2026-11-20", a: 1, type: "visita", scopes: [pais("Chile")] }));
  b.posts.push(post({ id: "vieja", title: "Seguridad de hace un año", start: "2025-12-20", a: 1, type: "visita", scopes: [pais("Chile")] }));
  return b;
};
// Lo que tiene que mostrar, de los que más cambiaron a los que menos (la cuenta hecha a mano de arriba).
const ESPERADO = [
  ["tema", "Seguridad", 10, 1, "▲ +9"], ["tema", "Becas", 7, 0, "nuevo"], ["tema", "Krav maga", 7, 0, "nuevo"], ["tema", "Shavuot", 0, 7, "se apagó"],
  ["lugar", "Chile", 6, 2, "▲ +4"], ["lugar", "Brasil", 1, 5, "▼ −4"],
  ["lugar", "Paraguay", 4, 0, "nuevo"], ["tipo", "Seminario", 4, 0, "nuevo"], ["lugar", "Uruguay", 0, 3, "se apagó"], ["lugar", "Colombia", 3, 1, "▲ +2"],
];

const b = await abrirNavegador();
const abrir = async (viewport, base, { lang = "es", vista = "reportes" } = {}) => {
  const r = await entrar(b, ADMIN, "Benny Rosenthal", { viewport, lang, base });
  await r.p.clock.setFixedTime(HOY);
  if(vista === "reportes"){ await tab(r.p, "reportes"); await r.p.waitForSelector(".rep-total-num"); }
  else { await tab(r.p, "feed"); await r.p.waitForTimeout(400); }
  return r;
};
// Las fichas de Reportes, como [kind, nombre, antes, ahora, variación].
const fichas = p => p.$$eval("#repTendencias .rep-mov-it", l => l.map(li => [li.dataset.kind, li.querySelector(".mv-nom b").textContent.trim(),
  Number(li.getAttribute("aria-label").match(/: (\d+) [→←] (\d+),/)[2]), Number(li.getAttribute("aria-label").match(/: (\d+) [→←] (\d+),/)[1]), li.querySelector(".mv-pil").textContent.trim()]));
const filasLateral = p => p.$$eval(".fs-tendencias .fila .tr", l => l.map(b => [b.dataset.kind, b.querySelector(".nn").textContent.replace(/^\S+\s/, "").trim(), b.querySelector(".dd").textContent.trim()]));
const enElInicio = p => p.evaluate(() => [...document.querySelectorAll(".post[data-post-id]")].map(c => c.dataset.postId));
const fichaFecha = p => p.evaluate(() => { const c = document.querySelector('.fb-ficha-abrir[data-cat="fecha"]'); return c ? c.textContent.replace(/\s+/g, " ").trim() : null; });
// Si todavía no se ven todas, toca «Ver las otras N» (el botón alterna: tocarlo con todo abierto las cierra).
const abrirTodas = async p => { const t = await p.$eval("#repTendencias .rep-tend-ver", e => e.textContent.trim()).catch(() => null); if(t && t.startsWith("Ver")) await p.click('#repTendencias [data-action="tendencias-ver-mas"]'); };
const solo = (p, sel) => p.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, " ").trim() : null, sel);

/* ---------------- 1. El cálculo, en Reportes (compu) ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos());
  eq("las 6 primeras fichas, de las que más cambiaron a las que menos", (await fichas(p)).map(x => [x[0], x[1], x[2], x[3], x[4]]), ESPERADO.slice(0, 6));
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  const T = await fichas(p);
  eq("con «Ver las otras 4»: las 10, en ese orden (y ninguna más: son 10 los que cambiaron)", T.map(x => [x[0], x[1], x[2], x[3], x[4]]), ESPERADO);
  eq("no aparece lo que no cambió (Argentina 4/3, Perú 2/1, Panamá 3/2) ni lo que se repite poco («Fiestas», 2 posteos; «Purim», 1)",
    T.some(x => ["Argentina", "Perú", "Panamá", "Fiestas", "Purim"].includes(x[1])), false);
  eq("«Visita» tampoco: pasó de 24 a 34 sin llegar a una vez y media", T.some(x => x[1] === "Visita"), false);
  eq("«Capacitación» tampoco: 0 → 3 es «nuevo» por el número, pero con tantos posteos podría ser casualidad", T.some(x => x[1] === "Capacitación"), false);
  eq("«Seguridad» juntó «cámaras» (están en los mismos posteos): un solo tema, que la ficha nombra al pasar el mouse", await p.$eval('#repTendencias .rep-mov-it[data-key="seguridad"]', li => [li.title, li.getAttribute("aria-label")]),
    ["Ver en el Inicio las actividades de «Seguridad» · también: cámaras", "Seguridad: 1 → 10, ▲ +9"]);
  eq("la sección y su subtítulo", [await solo(p, "#repTendencias .rep-seccion-cabeza h3"), await solo(p, "#repTendencias .rep-seccion-cabeza span")], ["Tendencias", "Últimos 90 días, contra los 90 anteriores"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 2. Las categorías y «Ver las otras» ---------------- */
{
  const { p } = await abrir({ width: 1280, height: 900 }, datos());
  const chips = () => p.$$eval("#repTendencias .rep-tend-chips .chip-toggle", l => l.map(c => [c.textContent.replace(/\s+/g, " ").trim(), c.getAttribute("aria-pressed")]));
  eq("las categorías, con «Todo» elegida", await chips(), [["Todo", "true"], ["📍 Lugares", "false"], ["🏷 Tipos", "false"], ["💬 Temas", "false"]]);
  eq("hay un botón «Ver las otras 4» porque se ven 6 de 10", await solo(p, "#repTendencias .rep-tend-ver"), "Ver las otras 4");
  eq("…y mientras no se toca, se ven solo 6 fichas", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 6);
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("al tocarlo se ven las 10 y el botón dice «Mostrar menos»", [await p.$$eval("#repTendencias .rep-mov-it", l => l.length), await solo(p, "#repTendencias .rep-tend-ver")], [10, "Mostrar menos"]);
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("«Mostrar menos» vuelve a 6", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 6);
  await p.click('#repTendencias [data-key="lugar"]');
  eq("«Lugares»: solo países (6, de los que más cambiaron a los que menos)", (await fichas(p)).map(x => x[1]), ["Chile", "Brasil", "Paraguay", "Uruguay", "Colombia"]);
  eq("…y ya no hay botón de «Ver las otras» (son 5)", await solo(p, "#repTendencias .rep-tend-ver"), null);
  await p.click('#repTendencias [data-key="tipo"]');
  eq("«Tipos»: solo Seminario", (await fichas(p)).map(x => [x[0], x[1]]), [["tipo", "Seminario"]]);
  await p.click('#repTendencias [data-key="tema"]');
  eq("«Temas»: Seguridad, Becas, Krav maga y Shavuot (los que subieron o se apagaron, sin que nadie los haya definido)", (await fichas(p)).map(x => x[1]), ["Seguridad", "Becas", "Krav maga", "Shavuot"]);
  eq("la categoría elegida queda marcada", await chips(), [["Todo", "false"], ["📍 Lugares", "false"], ["🏷 Tipos", "false"], ["💬 Temas", "true"]]);
  await p.click('#repTendencias [data-key="todo"]');
  eq("«Todo» vuelve a las 6 primeras", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 6);
  await p.close();
}

/* ---------------- 3. El mosaico, sin huecos, y las filas del celular ---------------- */
{
  const { p } = await abrir({ width: 1280, height: 900 }, datos());
  // Cuántas celdas ocupa cada ficha contra las que tiene la grilla: tienen que ser las mismas (ningún hueco).
  const huecos = () => p.$eval("#repTendencias .rep-mov", ul => {
    const cols = getComputedStyle(ul).gridTemplateColumns.split(" ").length, filas = getComputedStyle(ul).gridTemplateRows.split(" ").length;
    const celdas = [...ul.children].reduce((s, li) => s + (Number((li.style.gridColumn.match(/span (\d+)/) || [0, 1])[1]) * Number((li.style.gridRow.match(/span (\d+)/) || [0, 1])[1])), 0);
    return { modo: ul.dataset.modo, cols, filas, celdas, hero: ul.firstElementChild.classList.contains("hero"), heroSpan: [ul.firstElementChild.style.gridColumn, ul.firstElementChild.style.gridRow] };
  });
  let h = await huecos();
  eq("en la compu: mosaico, con la primera ficha grande (2 × 2)", [h.modo, h.hero, h.heroSpan], ["mosaico", true, ["span 2", "span 2"]]);
  eq("…con las celdas justas: ningún hueco (6 fichas)", h.celdas, h.cols * h.filas);
  // Con 1 a 10 fichas y a varios anchos, siempre sin huecos: se prueba el reparto con las categorías (1, 4, 5, 6 fichas) y con las 10.
  const cuentas = {};
  for(const [clave, ancho] of [["todo", 1280], ["todo", 900], ["todo", 700]]){
    await p.setViewportSize({ width: ancho, height: 900 }); await p.waitForTimeout(250);
    await p.click('#repTendencias [data-key="todo"]');
    if(await p.$("#repTendencias .rep-tend-ver")){ const t = await solo(p, "#repTendencias .rep-tend-ver"); if(t.startsWith("Ver")) await p.click('#repTendencias [data-action="tendencias-ver-mas"]'); }
    await p.waitForTimeout(250);
    h = await huecos(); cuentas[ancho] = [h.modo, h.celdas === h.cols * h.filas, h.cols];
  }
  eq("con las 10 fichas y a 1280, 900 y 700 px de pantalla: mosaico sin huecos, con más o menos columnas según el ancho", cuentas, { 1280: ["mosaico", true, 6], 900: ["mosaico", true, 5], 700: ["mosaico", true, 4] });
  for(const cat of ["lugar", "tipo", "tema"]){
    await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(200);
    await p.click(`#repTendencias [data-key="${cat}"]`); await p.waitForTimeout(200);
    h = await huecos(); cuentas[cat] = [h.modo, h.celdas === h.cols * h.filas];
  }
  eq("con 5 (lugares), 1 (tipo) y 4 (temas) fichas también", [cuentas.lugar, cuentas.tipo, cuentas.tema], [["mosaico", true], ["mosaico", true], ["mosaico", true]]);
  eq("al achicar la ventana hasta el celular, vuelve a las filas sin recargar", await (async () => {
    await p.click('#repTendencias [data-key="todo"]'); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
    return p.$eval("#repTendencias .rep-mov", ul => ul.dataset.modo);
  })(), "filas");
  await p.close();
}
{
  const { p } = await abrir({ width: 390, height: 844 }, datos());
  const fila = await p.$eval("#repTendencias .rep-mov-it", li => { const c = getComputedStyle(li), r = li.getBoundingClientRect(); return { modo: li.parentElement.dataset.modo, cols: c.gridTemplateColumns.split(" ").length,
    barra: getComputedStyle(li.querySelector(".mv-rg")).display, nom: li.querySelector(".mv-nom").getBoundingClientRect().left, n: li.querySelector(".mv-n").getBoundingClientRect().left, pil: li.querySelector(".mv-pil").getBoundingClientRect().left, ancho: Math.round(r.width) }; });
  eq("en el celular: filas de tres columnas, sin la barra", [fila.modo, fila.cols, fila.barra], ["filas", 3, "none"]);
  eq("…el nombre, «6 → 14» y la variación, de izquierda a derecha", fila.nom < fila.n && fila.n < fila.pil, true);
  eq("…y entran en la pantalla", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  eq("se ven 6 filas y «Ver las otras 4»", [await p.$$eval("#repTendencias .rep-mov-it", l => l.length), await solo(p, "#repTendencias .rep-tend-ver")], [6, "Ver las otras 4"]);
  await p.close();
}

/* ---------------- 4. Tocar una ficha abre el Inicio con lo que cuenta ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos());
  const tocar = async (kind, key) => { await p.click(`#repTendencias .rep-mov-it[data-kind="${kind}"][data-key="${key}"]`); await p.waitForTimeout(350); };
  const ver = async () => ({ ids: await enElInicio(p), fecha: await fichaFecha(p), volver: await solo(p, ".fb-volver") });
  await abrirTodas(p);
  await tocar("lugar", "Chile");
  let v = await ver();
  eq("Chile: la lista tiene los 6 posteos que dice la ficha, en «Últimos 90 días»", [v.ids.length, v.fecha, v.volver], [6, "📅 Últimos 90 días", "← Volver a Reportes · 2026"]);
  eq("…y no la cancelada, la de hace un año ni la que todavía no pasó", ["cancelada", "vieja", "futura"].some(id => v.ids.includes(id)), false);
  await p.click(".fb-volver"); await p.waitForSelector("#repTendencias");
  await abrirTodas(p);
  await tocar("tipo", "seminario");
  v = await ver();
  eq("Seminario: los 4 seminarios de los últimos 90 días", v.ids.length, 4);
  await p.click(".fb-volver"); await p.waitForSelector("#repTendencias");
  await abrirTodas(p);
  await tocar("tema", "seguridad");
  v = await ver();
  eq("Seguridad: los 10 posteos que hablan del tema (con «seguridad» o con «cámaras»), no los de más de 90 días atrás ni la cancelada", v.ids.length, 10);
  eq("…y el buscador dice «Seguridad»", await p.$eval("#feedSearch", e => e.value), "Seguridad");
  eq("…con la ficha del período", v.fecha, "📅 Últimos 90 días");
  await p.click('.fb-ficha-abrir[data-cat="fecha"]'); await p.waitForTimeout(250);
  eq("la ficha abre Fecha con «Últimos 90 días» elegido y ningún año marcado", await p.evaluate(() => [[...document.querySelectorAll('.fp-op.on')].map(e => e.textContent.replace(/\s+/g, " ").trim()), document.querySelectorAll('.fp-tris').length]), [["Últimos 90 días"], 0]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.click('.fb-ficha-x[data-cat="fecha"]'); await p.waitForTimeout(300);
  eq("sin el período salen también los de antes", (await enElInicio(p)).length > 10, true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 5. El costado del Inicio ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  eq("la tarjeta está entre «Hitos por vencer»/«Próximos eventos» y «Accesos directos»", await p.evaluate(() => { const l = [...document.querySelectorAll(".feed-side .fs-box")]; const i = l.findIndex(e => e.classList.contains("fs-tendencias")); return [i > 0, /Accesos directos/.test(l[i + 1].textContent)]; }), [true, true]);
  eq("encabezado: «Tendencias», la etiqueta «90 días» (con la explicación al pasar el mouse) y «Reportes ↗»", await p.evaluate(() => [document.querySelector(".fs-tendencias h4").firstChild.textContent.trim(), document.querySelector(".fs-90").textContent, /últimos 90 días/i.test(document.querySelector(".fs-90").title), document.querySelector(".fs-rep").textContent.trim()]), ["📈 Tendencias", "90 días", true, "Reportes ↗"]);
  eq("5 filas, las mismas de más arriba en Reportes", (await filasLateral(p)).map(x => [x[0], x[1], x[2]]), ESPERADO.slice(0, 5).map(x => [x[0], x[1], x[4]]));
  eq("cada fila dice «antes → ahora» (con el de ahora en negrita)", await p.$$eval(".fs-tendencias .md", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["1 → 10", "0 → 7", "0 → 7", "7 → 0", "2 → 6"]);
  eq("«Ver más» dice cuántas suma (5 de las 5 que faltan)", await solo(p, ".fs-vermas"), "Ver más 5 más");
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(250);
  eq("al tocarlo, las 10 y «Mostrar menos 10 de 10»", [(await filasLateral(p)).length, await solo(p, ".fs-vermas")], [10, "Mostrar menos 10 de 10"]);
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(250);
  eq("«Mostrar menos» vuelve a 5", (await filasLateral(p)).length, 5);
  // Tocar la fila abre el Inicio; sin «Volver a Reportes» porque no se vino de ahí.
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(250);
  await p.click('.fs-tendencias .tr[data-kind="lugar"][data-key="Paraguay"]'); await p.waitForTimeout(350);
  eq("la fila abre el Inicio con Paraguay en «Últimos 90 días»: los 4 posteos", [(await enElInicio(p)).length, await fichaFecha(p), await solo(p, ".fb-volver")], [4, "📅 Últimos 90 días", null]);
  await p.close();
  // La flecha ↗ abre Reportes.
  const r = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  await r.p.click('.fs-tendencias .ir[data-kind="lugar"][data-key="Chile"]'); await r.p.waitForTimeout(500);
  eq("la flecha ↗ de un lugar abre Reportes «Ver solo» ese país, en Tendencias", await r.p.evaluate(() => [!!document.querySelector("#repTendencias"), [...document.querySelectorAll(".rep-chip-filtro")].map(e => e.textContent.trim()), (() => { const r = document.getElementById("repTendencias").getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight - 100; })()]), [true, ["Chile ✕"], true]);
  eq("…y ahí las fichas son las de Chile (con 8 posteos nada se aparta del azar: ningún tema)", (await fichas(r.p)).filter(x => x[0] === "tema").length, 0);
  await tab(r.p, "feed"); await r.p.waitForTimeout(300);
  await r.p.click('[data-action="tendencias-lateral"]'); await r.p.waitForTimeout(200);
  await r.p.click('.fs-tendencias .ir[data-kind="tema"][data-key="beca"]'); await r.p.waitForTimeout(500);
  eq("la de un tema abre Reportes sin filtro y con ese tema marcado un momento (aunque quede entre «las otras»)", await r.p.evaluate(() => [document.querySelectorAll(".rep-chip-filtro").length, !!document.querySelector('#repTendencias .rep-mov-it.resaltada[data-key="beca"]'), (() => { const r = document.getElementById("repTendencias").getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight - 100; })()]), [0, true, true]);
  await tab(r.p, "feed"); await r.p.waitForTimeout(300);
  await r.p.click(".fs-rep"); await r.p.waitForTimeout(500);
  eq("«Reportes ↗» abre Reportes en Tendencias, sin marcar nada", await r.p.evaluate(() => [!!document.querySelector("#repTendencias"), document.querySelectorAll("#repTendencias .resaltada").length]), [true, 0]);
  eq("sin errores en la consola", [errores, r.errores], [[], []]);
  await r.p.close();
}
/* La columna del costado no lleva barra de scroll propia (16/10/2026): si entra en la pantalla se queda fija al bajar por el Feed, y si es más alta baja con la página. */
{
  const { p } = await abrir({ width: 1280, height: 600 }, datos(), { vista: "feed" });
  const medir = () => p.evaluate(() => {
    const a = document.querySelector(".feed-side"), cs = getComputedStyle(a), cab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 96;
    return { overflow: cs.overflowY, posicion: cs.position, suelta: a.classList.contains("suelta"), masAltaQueLaPantalla: a.offsetHeight > innerHeight - cab - 32, barra: a.scrollHeight - a.clientHeight };
  });
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(300);
  let m = await medir();
  eq("con las 10 tendencias la columna es más alta que la pantalla: no se queda fija, baja con la página y no tiene barra de scroll", [m.masAltaQueLaPantalla, m.suelta, m.posicion, m.overflow, m.barra], [true, true, "static", "visible", 0]);
  await p.setViewportSize({ width: 1280, height: 2400 }); await p.waitForTimeout(400);
  m = await medir();
  eq("en una pantalla alta donde entra entera sí se queda fija al bajar por el Feed (y tampoco lleva barra)", [m.masAltaQueLaPantalla, m.suelta, m.posicion, m.overflow, m.barra], [false, false, "sticky", "visible", 0]);
  await p.setViewportSize({ width: 1280, height: 500 }); await p.waitForTimeout(400);
  m = await medir();
  eq("al achicar la ventana vuelve a soltarse sin recargar", [m.suelta, m.posicion, m.barra], [true, "static", 0]);
  await p.close();
}
{
  const { p } = await abrir({ width: 900, height: 900 }, datos(), { vista: "feed" });
  eq("en pantallas angostas (menos de 1024 px) el costado no está", await p.$$eval(".fs-tendencias", l => l.filter(e => e.offsetParent !== null).length), 0);
  await p.close();
}

/* ---------------- 6. Pocos datos, cap de 10 y sin cambios ---------------- */
{
  const pocas = vacia();
  poner(pocas, 4, "ahora", { pais: "Chile" }); poner(pocas, 3, "antes", { pais: "Brasil" });
  const { p } = await abrir({ width: 1280, height: 900 }, pocas);
  eq("con 7 posteos en los 180 días: ni la sección en Reportes", await p.$$eval("#repTendencias", l => l.length), 0);
  await tab(p, "feed"); await p.waitForTimeout(300);
  eq("…ni la tarjeta del Inicio", await p.$$eval(".fs-tendencias", l => l.length), 0);
  await p.close();
  const iguales = vacia();
  poner(iguales, 5, "ahora", { pais: "Chile" }); poner(iguales, 5, "antes", { pais: "Chile" }); poner(iguales, 3, "ahora", { pais: "Perú" }); poner(iguales, 3, "antes", { pais: "Perú" });
  const r = await abrir({ width: 1280, height: 900 }, iguales);
  eq("con 16 posteos y nada que haya cambiado: la sección dice que no hubo cambios grandes, sin fichas", await r.p.evaluate(() => [document.querySelectorAll("#repTendencias .rep-mov-it").length, (document.querySelector("#repTendencias .rep-tend-vacio") || {}).textContent]), [0, "Nada cambió lo suficiente."]);
  await tab(r.p, "feed"); await r.p.waitForTimeout(300);
  eq("…y en el Inicio, sin tarjeta", await r.p.$$eval(".fs-tendencias", l => l.length), 0);
  await r.p.close();
  // Doce países que cambiaron: nunca más de 10 (en Reportes, 6 + «Ver las otras 4»; en el Inicio, 5 + 5).
  const muchos = vacia();
  ["Chile", "Perú", "Brasil", "Uruguay", "Paraguay", "Bolivia", "Colombia", "México", "Panamá", "Cuba", "Venezuela", "Ecuador"].forEach((c, i) => { poner(muchos, 3 + i, "ahora", { pais: c }); });
  const m = await abrir({ width: 1280, height: 900 }, muchos);
  eq("con 12 que cambiaron: en Reportes se ven 6 y «Ver las otras 4»", [await m.p.$$eval("#repTendencias .rep-mov-it", l => l.length), await solo(m.p, "#repTendencias .rep-tend-ver")], [6, "Ver las otras 4"]);
  await m.p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("…y desplegado, 10: nunca 12", await m.p.$$eval("#repTendencias .rep-mov-it", l => l.length), 10);
  await tab(m.p, "feed"); await m.p.waitForTimeout(300);
  await m.p.click('[data-action="tendencias-lateral"]'); await m.p.waitForTimeout(200);
  eq("en el Inicio, tras «Ver más»: 10 filas, y ya no hay más para ver", [(await filasLateral(m.p)).length, await solo(m.p, ".fs-vermas")], [10, "Mostrar menos 10 de 10"]);
  await m.p.close();
}

/* ---------------- 7. Los temas salen solos: nadie define nada ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  await irAdmin(p);
  eq("Administración ya no tiene «Temas»: no hay lista que armar", await p.$$eval(".admin-item", l => l.map(e => e.dataset.key).includes("temas")), false);
  await tab(p, "feed"); await p.waitForTimeout(300);
  // Escribir una palabra en el buscador es una búsqueda de texto de siempre; el nombre de un tema solo busca todas sus palabras al tocar su ficha.
  await p.fill("#feedSearch", "Cámaras"); await p.waitForTimeout(500);
  eq("«Cámaras» escrito a mano es una búsqueda de texto: los 4 posteos que la dicen", (await enElInicio(p)).length, 4);
  await p.fill("#feedSearch", ""); await p.waitForTimeout(300);
  await p.click('.fs-tendencias .tr[data-kind="tema"][data-key="seguridad"]'); await p.waitForTimeout(400);
  eq("tocar «Seguridad» en el costado del Inicio: busca «Seguridad» en los últimos 90 días y trae los 10 de la ficha", [await p.$eval("#feedSearch", e => e.value), (await enElInicio(p)).length, await fichaFecha(p)], ["Seguridad", 10, "📅 Últimos 90 días"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}
{
  // Lo que NO es un tema aunque se repita mucho y suba de golpe: lugares y gente (los cuentan «Lugares» y el equipo), tipos, relleno, charla y verbos.
  // Y lo que sí: una palabra que solo está en las respuestas de una conversación.
  const b = vacia();
  // Un tipo de actividad que el equipo agregó («Voluntariado»): su nombre tampoco es un tema, lo cuenta «Tipos».
  b.app_config[0].value.activityTypes.push({ key: "voluntariado", label: "Voluntariado", icon: "🤝", calendarSync: true, docs: [] });
  b.members = b.members.concat([{ email: "dana@x.com", name: "Dana Katz", nickname: "dana", role: "member", approved_at: "2025-01-10T12:00:00Z" }]);
  // Seis posteos que repiten, todos juntos, palabras que NO son un tema: charla (gracias, excelente), un verbo (instalamos), un tipo (el «Voluntariado» que agregó el equipo),
  // una persona del equipo (Dana) y un lugar (Rosario, el alcance de los posteos). Cada una sube de golpe: si alguna regla falla, aparece como tema.
  poner(b, 6, "ahora", { pais: "Chile", titulos: Array(6).fill("Gracias, excelente voluntariado: instalamos todo con Dana en Rosario"), contenido: "Llamado con Dana. Rosario." });
  b.posts.forEach(x => { x.scopes = [{ type: "ciudad", country: "Argentina", city: "Rosario" }]; });
  poner(b, 6, "ahora", { titulos: ["Llegaron los pasajes", "Pasajes a Quito", "Los pasajes están listos", "Nuevo pasaje", "Pasajes confirmados", "Último pasaje"] });   // un tema de verdad: «pasajes», 6 posteos
  poner(b, 6, "antes", {});
  const vacioR = { scopes: [], links: [], images: [], files: [], mentions: [], liked_by: [] };
  b.replies = b.posts.slice(0, 6).map((x, i) => ({ id: "rr" + i, post_id: x.id, content: "Falta tramitar la visa de migración", author_name: "Ana Pérez", author_email: "ana@team-latam.com", created_at: "2026-09-01T12:00:00Z", system: false, ...vacioR }));   // «visa» y «migración» solo en respuestas, 6 posteos
  b.replies.push(...b.posts.slice(12, 18).map((x, i) => ({ id: "sr" + i, post_id: x.id, content: "Recordatorio automático de la aduana", author_name: "Sistema", author_email: ADMIN, created_at: "2026-06-02T12:00:00Z", system: true, ...vacioR })));   // las del sistema no cuentan: «aduana» no es un tema
  const { p } = await abrir({ width: 1280, height: 900 }, b);
  const temas = (await fichas(p)).filter(x => x[0] === "tema").map(x => [x[1], x[2], x[3], x[4]]);
  eq("solo salen los temas de verdad: «pasajes» (lo dicen los títulos) y «migración» (solo se dijo en las respuestas, junto con «visa»: un mismo tema porque van en los mismos posteos)", temas.map(x => x[0]).sort(), ["Migración", "Pasaje"]);
  eq("…cada uno con su cuenta: 6 posteos ahora y ninguno antes", temas.map(x => [x[1], x[2], x[3]]), [[6, 0, "nuevo"], [6, 0, "nuevo"]]);
  eq("…y nunca un lugar (Rosario), una persona (Dana), un tipo (Seminario), relleno, charla (gracias, excelente), un verbo (instalamos) ni lo que dice el sistema (aduana)",
    temas.some(x => /rosario|dana|voluntariado|jornada|gracias|excelente|instalamos|aduana|visita|llamado/i.test(x[0])), false);
  await p.close();
}

/* ---------------- 8. En otros idiomas ---------------- */
{
  const en = await abrir({ width: 1280, height: 900 }, datos(), { lang: "en" });
  eq("en inglés: «Trends» y los textos", await en.p.evaluate(() => [document.querySelector("#repTendencias h3").textContent, document.querySelector("#repTendencias .rep-seccion-cabeza span").textContent,
    [...document.querySelectorAll("#repTendencias .rep-tend-chips .chip-toggle")].map(c => c.textContent.replace(/\s+/g, " ").trim()), document.querySelector("#repTendencias .rep-tend-ver").textContent]),
    ["Trends", "Last 90 days, against the 90 before", ["All", "📍 Places", "🏷 Types", "💬 Topics"], "See the other 4"]);
  eq("…y las variaciones: «new» y «went quiet»", await en.p.$$eval("#repTendencias .mv-pil", l => l.map(e => e.textContent.trim()).filter(x => /[a-z]/.test(x))), ["new", "new", "went quiet"]);
  await en.p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("…y con las 10, dos «went quiet» (Shavuot y Uruguay)", await en.p.$$eval("#repTendencias .mv-pil", l => l.map(e => e.textContent.trim()).filter(x => x === "went quiet").length), 2);
  await en.p.close();
  const he = await abrir({ width: 1280, height: 900 }, datos(), { lang: "he" });
  eq("en hebreo: «מגמות», de derecha a izquierda y con la flecha ← en «antes ← ahora»", await he.p.evaluate(() => [document.querySelector("#repTendencias h3").textContent, document.documentElement.dir, document.querySelector("#repTendencias .mv-n").textContent.includes("←")]), ["מגמות", "rtl", true]);
  eq("…y la ficha grande queda a la derecha (la primera, como en cualquier lista)", await he.p.evaluate(() => { const u = document.querySelector("#repTendencias .rep-mov"), h = u.firstElementChild.getBoundingClientRect(), r = u.getBoundingClientRect(); return h.right >= r.right - 2; }), true);
  await he.p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
