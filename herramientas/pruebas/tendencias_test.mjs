/* ======================================================================
   Tendencias: qué subió y qué bajó en los últimos 90 días (13/10/2026)

   Reemplaza a «Temas» (las palabras sueltas que subían y bajaban). El usuario
   pidió ver, juntas, lo que pasó (lugares y tipos) y de qué se habló (temas),
   en Reportes y en el costado del Inicio. Lo que esta prueba cuida:

   El cálculo
   - los últimos 90 días contra los 90 anteriores, con «hoy» fijo; lo cancelado
     y lo que todavía no pasó no cuentan;
   - solo lo que cambió bastante: 3 o más en alguno de los dos tramos, y nuevo,
     apagado, o una vez y media más o menos (con una diferencia de 2 por lo menos);
     de los que más cambiaron a los que menos, y nunca más de 10;
   - lugares y tipos dan lo mismo que el reporte de siempre; los temas salen de
     la lista (la de ejemplo hasta que un administrador arma la suya), con
     plural, tildes y frases («krav maga»);
   - con menos de 8 posteos en los 180 días, ni la sección ni la tarjeta.
   Reportes
   - las categorías (Todo, Lugares, Tipos, Temas), «Ver las otras N» y «Mostrar menos»;
   - en la compu, un mosaico sin huecos (la primera ficha, grande); en el celular, filas;
   - tocar una ficha abre el Inicio con eso en «Últimos 90 días», y la lista
     da lo que decía el número; «← Volver a Reportes».
   El costado del Inicio
   - 5 filas, «Ver más» de a 5 hasta 10, «Mostrar menos»; la fila abre el Inicio,
     la flecha ↗ abre Reportes (lugar, tipo o tema marcado).
   Administración › Temas
   - sumar una palabra, un tema, renombrar, quitar y volver a la lista de ejemplo;
     escribir el nombre de un tema en el buscador busca todas sus palabras.
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
// `n` posteos de un país en un tramo; `titulos` (opcional) da el título de cada uno.
const poner = (base, n, tramo, o = {}) => {
  for(let i = 0; i < n; i++){
    const titulo = o.titulos ? o.titulos[i % o.titulos.length] : `Actividad ${++k}`;
    base.posts.push(post({ id: `t${++k}`, title: titulo, content: o.contenido || "", start: (tramo === "ahora" ? AHORA : ANTES)(i + k), a: 1, type: o.type || "visita", scopes: o.pais ? [pais(o.pais)] : [] }));
  }
};
const vacia = () => { const b = BASE(); b.replies = []; b.posts = []; k = 0; return b; };
// Los datos de la prueba: lo que cambió y lo que no, con la cuenta hecha a mano (ver el comentario de cada línea).
const datos = () => {
  const b = vacia();
  poner(b, 5, "ahora", { pais: "Chile", titulos: ["Plan de seguridad", "Cámaras nuevas para la sede", "Revisión de la ALARMA", "Seguridad en el acceso", "Cursos de otoño"] });   // Chile: 5 ahora (4 hablan de seguridad)
  poner(b, 1, "ahora", { pais: "Chile", titulos: ["Seguridad: protocolo de ingreso"] });                                                                                // Chile: 6 ahora (5 de seguridad)
  poner(b, 2, "antes", { pais: "Chile", titulos: ["Vigilancia del edificio", "Reunión de comisión"] });                                                                // Chile: 2 antes (1 de seguridad)
  poner(b, 4, "ahora", { pais: "Paraguay", titulos: ["Entrega de becas", "Nueva beca para jóvenes", "Scholarship fund", "Reunión de equipo"] });                       // Paraguay: 4 ahora y ninguno antes; Becas: 3
  poner(b, 1, "ahora", { pais: "Brasil" });  poner(b, 5, "antes", { pais: "Brasil" });                                                                                 // Brasil: 1 ahora, 5 antes
  poner(b, 3, "antes", { pais: "Uruguay" });                                                                                                                           // Uruguay: 0 ahora, 3 antes
  poner(b, 4, "ahora", { pais: "Argentina", titulos: ["Taller de Krav Maga", "Clase de krav magá", "Reunión", "Visita"] }); poner(b, 3, "antes", { pais: "Argentina" });  // Argentina: 4/3 (no cambió); Krav magá: 2 (no llega a 3)
  poner(b, 2, "ahora", { pais: "Perú" });  poner(b, 1, "antes", { pais: "Perú" });                                                                                     // Perú: 2/1 (no llega a 3)
  poner(b, 3, "ahora", { pais: "Panamá", titulos: ["Purim con todos", "Pésaj en la comunidad", "Fiestas de fin de año"] });  poner(b, 2, "antes", { pais: "Panamá" });  // Panamá: 3/2 (una diferencia de 1: no cuenta); Fiestas: 3 ahora
  poner(b, 3, "ahora", { pais: "Colombia", titulos: ["Capacitación de líderes", "Capacitación docente", "Capacitación virtual"] });  poner(b, 1, "antes", { pais: "Colombia" });  // Colombia: 3/1 (sube +2); «capacitación» se repite y no está en ningún tema
  poner(b, 4, "ahora", { type: "seminario" });                                                                                                                         // Seminarios, sin lugar: 4 ahora y ninguno antes
  // Lo que no cuenta: una cancelada, algo que todavía no pasó y algo de hace más de 180 días.
  b.posts.push(post({ id: "cancelada", title: "Seguridad cancelada", start: "2026-09-10", a: 1, type: "visita", scopes: [pais("Chile")], extra: { cancelled: true, cancelled_at: "2026-09-01", cancelled_by: ADMIN } }));
  b.posts.push(post({ id: "futura", title: "Seguridad que viene", start: "2026-11-20", a: 1, type: "visita", scopes: [pais("Chile")] }));
  b.posts.push(post({ id: "vieja", title: "Seguridad de hace un año", start: "2025-12-20", a: 1, type: "visita", scopes: [pais("Chile")] }));
  return b;
};
// Lo que tiene que mostrar, de los que más cambiaron a los que menos (la cuenta hecha a mano de arriba).
const ESPERADO = [
  ["lugar", "Chile", 6, 2, "▲ +4"], ["lugar", "Brasil", 1, 5, "▼ −4"], ["tema", "Seguridad", 5, 1, "▲ +4"], ["lugar", "Paraguay", 4, 0, "nuevo"], ["tipo", "Seminario", 4, 0, "nuevo"],
  ["tema", "Becas", 3, 0, "nuevo"], ["tema", "Fiestas", 3, 0, "nuevo"], ["lugar", "Uruguay", 0, 3, "se apagó"], ["lugar", "Colombia", 3, 1, "▲ +2"],
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
const solo = (p, sel) => p.evaluate(s => document.querySelector(s) ? document.querySelector(s).textContent.replace(/\s+/g, " ").trim() : null, sel);

/* ---------------- 1. El cálculo, en Reportes (compu) ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos());
  eq("las 6 primeras fichas, de las que más cambiaron a las que menos", (await fichas(p)).map(x => [x[0], x[1], x[2], x[3], x[4]]), ESPERADO.slice(0, 6));
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  const T = await fichas(p);
  eq("con «Ver las otras 3»: las 9, en ese orden (y ninguna más: son 9 los que cambiaron)", T.map(x => [x[0], x[1], x[2], x[3], x[4]]), ESPERADO);
  eq("no aparece lo que no cambió (Argentina 4/3, Perú 2/1, Panamá 3/2) ni «Krav magá» (2) ni «Jóvenes»",
    T.some(x => ["Argentina", "Perú", "Panamá", "Krav magá", "Jóvenes", "Visita"].includes(x[1])), false);
  eq("«Visita» tampoco: pasó de 17 a 23 sin llegar a una vez y media", T.some(x => x[1] === "Visita"), false);
  eq("la sección y su subtítulo", [await solo(p, "#repTendencias .rep-seccion-cabeza h3"), await solo(p, "#repTendencias .rep-seccion-cabeza span")], ["Tendencias", "Últimos 90 días, contra los 90 anteriores"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 2. Las categorías y «Ver las otras» ---------------- */
{
  const { p } = await abrir({ width: 1280, height: 900 }, datos());
  const chips = () => p.$$eval("#repTendencias .rep-tend-chips .chip-toggle", l => l.map(c => [c.textContent.replace(/\s+/g, " ").trim(), c.getAttribute("aria-pressed")]));
  eq("las categorías, con «Todo» elegida", await chips(), [["Todo", "true"], ["📍 Lugares", "false"], ["🏷 Tipos", "false"], ["💬 Temas", "false"]]);
  eq("hay un botón «Ver las otras 3» porque se ven 6 de 9", await solo(p, "#repTendencias .rep-tend-ver"), "Ver las otras 3");
  eq("…y mientras no se toca, se ven solo 6 fichas", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 6);
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("al tocarlo se ven las 9 y el botón dice «Mostrar menos»", [await p.$$eval("#repTendencias .rep-mov-it", l => l.length), await solo(p, "#repTendencias .rep-tend-ver")], [9, "Mostrar menos"]);
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("«Mostrar menos» vuelve a 6", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 6);
  await p.click('#repTendencias [data-key="lugar"]');
  eq("«Lugares»: solo países (6, de los que más cambiaron a los que menos)", (await fichas(p)).map(x => x[1]), ["Chile", "Brasil", "Paraguay", "Uruguay", "Colombia"]);
  eq("…y ya no hay botón de «Ver las otras» (son 5)", await solo(p, "#repTendencias .rep-tend-ver"), null);
  await p.click('#repTendencias [data-key="tipo"]');
  eq("«Tipos»: solo Seminario", (await fichas(p)).map(x => [x[0], x[1]]), [["tipo", "Seminario"]]);
  await p.click('#repTendencias [data-key="tema"]');
  eq("«Temas»: Seguridad, Becas y Fiestas", (await fichas(p)).map(x => x[1]), ["Seguridad", "Becas", "Fiestas"]);
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
  // Con 1 a 10 fichas y a varios anchos, siempre sin huecos: se prueba el reparto con las categorías (1, 3, 5, 6 fichas) y con las 9.
  const cuentas = {};
  for(const [clave, ancho] of [["todo", 1280], ["todo", 900], ["todo", 700]]){
    await p.setViewportSize({ width: ancho, height: 900 }); await p.waitForTimeout(250);
    await p.click('#repTendencias [data-key="todo"]');
    if(await p.$("#repTendencias .rep-tend-ver")){ const t = await solo(p, "#repTendencias .rep-tend-ver"); if(t.startsWith("Ver")) await p.click('#repTendencias [data-action="tendencias-ver-mas"]'); }
    await p.waitForTimeout(250);
    h = await huecos(); cuentas[ancho] = [h.modo, h.celdas === h.cols * h.filas, h.cols];
  }
  eq("con las 9 fichas y a 1280, 900 y 700 px de pantalla: mosaico sin huecos, con más o menos columnas según el ancho", cuentas, { 1280: ["mosaico", true, 6], 900: ["mosaico", true, 5], 700: ["mosaico", true, 4] });
  for(const cat of ["lugar", "tipo", "tema"]){
    await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(200);
    await p.click(`#repTendencias [data-key="${cat}"]`); await p.waitForTimeout(200);
    h = await huecos(); cuentas[cat] = [h.modo, h.celdas === h.cols * h.filas];
  }
  eq("con 5 (lugares), 1 (tipo) y 3 (temas) fichas también", [cuentas.lugar, cuentas.tipo, cuentas.tema], [["mosaico", true], ["mosaico", true], ["mosaico", true]]);
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
  eq("se ven 6 filas y «Ver las otras 3»", [await p.$$eval("#repTendencias .rep-mov-it", l => l.length), await solo(p, "#repTendencias .rep-tend-ver")], [6, "Ver las otras 3"]);
  await p.close();
}

/* ---------------- 4. Tocar una ficha abre el Inicio con lo que cuenta ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos());
  const tocar = async (kind, key) => { await p.click(`#repTendencias .rep-mov-it[data-kind="${kind}"][data-key="${key}"]`); await p.waitForTimeout(350); };
  const ver = async () => ({ ids: await enElInicio(p), fecha: await fichaFecha(p), volver: await solo(p, ".fb-volver") });
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  await tocar("lugar", "Chile");
  let v = await ver();
  eq("Chile: la lista tiene los 6 posteos que dice la ficha, en «Últimos 90 días»", [v.ids.length, v.fecha, v.volver], [6, "📅 Últimos 90 días", "← Volver a Reportes · 2026"]);
  eq("…y no la cancelada, la de hace un año ni la que todavía no pasó", ["cancelada", "vieja", "futura"].some(id => v.ids.includes(id)), false);
  await p.click(".fb-volver"); await p.waitForSelector("#repTendencias");
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  await tocar("tipo", "seminario");
  v = await ver();
  eq("Seminario: los 4 seminarios de los últimos 90 días", v.ids.length, 4);
  await p.click(".fb-volver"); await p.waitForSelector("#repTendencias");
  await p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  await tocar("tema", "Seguridad");
  v = await ver();
  eq("Seguridad: los 5 posteos que hablan del tema (con «cámaras», «alarma» y «seguridad»), no los de más de 90 días atrás", v.ids.length, 5);
  eq("…y el buscador dice «Seguridad»", await p.$eval("#feedSearch", e => e.value), "Seguridad");
  eq("…con la ficha del período", v.fecha, "📅 Últimos 90 días");
  await p.click('.fb-ficha-abrir[data-cat="fecha"]'); await p.waitForTimeout(250);
  eq("la ficha abre Fecha con «Últimos 90 días» elegido y ningún año marcado", await p.evaluate(() => [[...document.querySelectorAll('.fp-op.on')].map(e => e.textContent.replace(/\s+/g, " ").trim()), document.querySelectorAll('.fp-tris').length]), [["Últimos 90 días"], 0]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.click('.fb-ficha-x[data-cat="fecha"]'); await p.waitForTimeout(300);
  eq("sin el período salen también los de antes", (await enElInicio(p)).length > 5, true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- 5. El costado del Inicio ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  eq("la tarjeta está entre «Hitos por vencer»/«Próximos eventos» y «Accesos directos»", await p.evaluate(() => { const l = [...document.querySelectorAll(".feed-side .fs-box")]; const i = l.findIndex(e => e.classList.contains("fs-tendencias")); return [i > 0, /Accesos directos/.test(l[i + 1].textContent)]; }), [true, true]);
  eq("encabezado: «Tendencias», la etiqueta «90 días» (con la explicación al pasar el mouse) y «Reportes ↗»", await p.evaluate(() => [document.querySelector(".fs-tendencias h4").firstChild.textContent.trim(), document.querySelector(".fs-90").textContent, /últimos 90 días/i.test(document.querySelector(".fs-90").title), document.querySelector(".fs-rep").textContent.trim()]), ["📈 Tendencias", "90 días", true, "Reportes ↗"]);
  eq("5 filas, las mismas de más arriba en Reportes", (await filasLateral(p)).map(x => [x[0], x[1], x[2]]), ESPERADO.slice(0, 5).map(x => [x[0], x[1], x[4]]));
  eq("cada fila dice «antes → ahora» (con el de ahora en negrita)", await p.$$eval(".fs-tendencias .md", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["2 → 6", "5 → 1", "1 → 5", "0 → 4", "0 → 4"]);
  eq("«Ver más» dice cuántas suma (4 de las 4 que faltan)", await solo(p, ".fs-vermas"), "Ver más 4 más");
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(250);
  eq("al tocarlo, las 9 y «Mostrar menos 9 de 9»", [(await filasLateral(p)).length, await solo(p, ".fs-vermas")], [9, "Mostrar menos 9 de 9"]);
  await p.click('[data-action="tendencias-lateral"]'); await p.waitForTimeout(250);
  eq("«Mostrar menos» vuelve a 5", (await filasLateral(p)).length, 5);
  // Tocar la fila abre el Inicio; sin «Volver a Reportes» porque no se vino de ahí.
  await p.click('.fs-tendencias .tr[data-kind="lugar"][data-key="Paraguay"]'); await p.waitForTimeout(350);
  eq("la fila abre el Inicio con Paraguay en «Últimos 90 días»: los 4 posteos", [(await enElInicio(p)).length, await fichaFecha(p), await solo(p, ".fb-volver")], [4, "📅 Últimos 90 días", null]);
  await p.close();
  // La flecha ↗ abre Reportes.
  const r = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  await r.p.click('.fs-tendencias .ir[data-kind="lugar"][data-key="Chile"]'); await r.p.waitForTimeout(500);
  eq("la flecha ↗ de un lugar abre Reportes «Ver solo» ese país, en Tendencias", await r.p.evaluate(() => [!!document.querySelector("#repTendencias"), [...document.querySelectorAll(".rep-chip-filtro")].map(e => e.textContent.trim()), (() => { const r = document.getElementById("repTendencias").getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight - 100; })()]), [true, ["Chile ✕"], true]);
  eq("…y ahí las fichas son las de Chile (Seguridad, y los tipos de Chile)", (await fichas(r.p)).map(x => x[1]).includes("Seguridad"), true);
  await tab(r.p, "feed"); await r.p.waitForTimeout(300);
  await r.p.click('[data-action="tendencias-lateral"]'); await r.p.waitForTimeout(200);
  await r.p.click('.fs-tendencias .ir[data-kind="tema"][data-key="Becas"]'); await r.p.waitForTimeout(500);
  eq("la de un tema abre Reportes sin filtro y con ese tema marcado un momento (aunque quede entre «las otras»)", await r.p.evaluate(() => [document.querySelectorAll(".rep-chip-filtro").length, !!document.querySelector('#repTendencias .rep-mov-it.resaltada[data-key="Becas"]'), (() => { const r = document.getElementById("repTendencias").getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight - 100; })()]), [0, true, true]);
  await tab(r.p, "feed"); await r.p.waitForTimeout(300);
  await r.p.click(".fs-rep"); await r.p.waitForTimeout(500);
  eq("«Reportes ↗» abre Reportes en Tendencias, sin marcar nada", await r.p.evaluate(() => [!!document.querySelector("#repTendencias"), document.querySelectorAll("#repTendencias .resaltada").length]), [true, 0]);
  eq("sin errores en la consola", [errores, r.errores], [[], []]);
  await r.p.close();
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

/* ---------------- 7. Administración › Temas ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  await irAdmin(p);
  await click(p, '.admin-item[data-key="temas"]'); await p.waitForTimeout(400);
  const tarjetas = () => p.$$eval(".tm-card", l => l.map(c => [c.querySelector(".tm-nombre").value, [...c.querySelectorAll(".tm-chip:not(.fijo)")].map(x => x.textContent.replace("✕", "").trim())]));
  eq("la lista de ejemplo: cinco temas y el aviso de que nadie armó la suya", [(await tarjetas()).map(x => x[0]), await p.$$eval(".tm-aviso", l => l.length)], [["Seguridad", "Krav magá", "Jóvenes", "Becas", "Fiestas"], 1]);
  eq("cada tema dice cuántas actividades lo mencionan (Seguridad: 5 ahora y 1 antes)", await p.$eval(".tm-card .tm-cuenta", e => e.textContent.trim()), "Ahora: 5 · antes: 1");
  // Sumar una palabra a «Krav magá»: «defensa» no estaba y hay dos posteos con «defensa personal».
  await p.fill('.tm-card:nth-child(2) [data-tema-campo="palabra"]', "taller de lucha, Reunión"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  eq("sumar palabras (separadas por coma, con Enter): quedan en el tema y se guarda como la lista del equipo", [(await tarjetas())[1][1].slice(-2), await p.$$eval(".tm-aviso", l => l.length)], [["taller de lucha", "Reunión"], 0]);
  eq("…y «Krav magá» ahora cuenta los posteos con «Reunión» (2 ahora y 1 antes) y los 2 de «krav maga»", await p.$eval(".tm-card:nth-child(2) .tm-cuenta", e => e.textContent.trim()), "Ahora: 4 · antes: 1");
  // Un tema nuevo.
  await p.fill("#temaNuevoNombre", "Cursos"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  eq("un tema nuevo se suma al final", (await tarjetas()).map(x => x[0]), ["Seguridad", "Krav magá", "Jóvenes", "Becas", "Fiestas", "Cursos"]);
  eq("…y uno con el mismo nombre (sin importar mayúsculas ni tildes) no se suma", await (async () => {
    await p.fill("#temaNuevoNombre", "BECAS"); await p.click('[data-action="tema-agregar"]'); await p.waitForTimeout(250);
    const aviso = await p.$eval("#confirmMessage", e => e.textContent).catch(() => null); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    return [(await tarjetas()).length, aviso];
  })(), [6, "Ya hay un tema con ese nombre."]);
  // Renombrar.
  await p.fill('.tm-card:nth-child(6) [data-tema-campo="nombre"]', "Cursos y talleres"); await p.keyboard.press("Tab"); await p.waitForTimeout(400);
  eq("renombrar se guarda al salir del campo", (await tarjetas())[5][0], "Cursos y talleres");
  // Quitar una palabra y un tema.
  await p.click('.tm-card:nth-child(1) [data-action="tema-palabra-quitar"][data-j="0"]'); await p.waitForTimeout(300);
  eq("quitar una palabra (la ✕ de «cámaras»)", (await tarjetas())[0][1].includes("cámaras"), false);
  await p.click('.tm-card:nth-child(6) [data-action="tema-borrar"]'); await p.waitForTimeout(200); await p.click("#confirmOk"); await p.waitForTimeout(400);
  eq("quitar un tema pide confirmación y lo saca", (await tarjetas()).map(x => x[0]), ["Seguridad", "Krav magá", "Jóvenes", "Becas", "Fiestas"]);
  // Las palabras que se repiten y no están en ningún tema, para sumarlas.
  const sugeridas = () => p.$$eval(".tm-sug .tm-chip.sug", l => l.map(c => c.dataset.palabra.toLowerCase()));
  eq("abajo, palabras que se repiten y no están en ningún tema: «capacitación», sin las que ya cubre un tema", [(await sugeridas()).includes("capacitación"), (await sugeridas()).some(w => /seguridad|becas|fiestas|krav/i.test(w))], [true, false]);
  await p.selectOption("#temaDestino", "Becas"); await p.click('.tm-sug .tm-chip.sug[data-palabra="Capacitación"]'); await p.waitForTimeout(400);
  eq("tocar una sugerida la suma al tema elegido (Becas) y deja de sugerirse", [(await tarjetas())[3][1].some(w => /^capacitación$/i.test(w)), (await sugeridas()).includes("capacitación")], [true, false]);
  // Lo que cuenta Tendencias cambia con la lista: «cámaras» sale de Seguridad (4 de los 5 de antes hablaban de seguridad, 1 solo de cámaras).
  await tab(p, "reportes"); await p.waitForSelector("#repTendencias");
  await p.click('#repTendencias [data-key="tema"]');
  eq("con la lista editada, Reportes cuenta con ella: sin «cámaras», Seguridad bajó de 5 a 4", (await fichas(p)).filter(x => x[1] === "Seguridad").map(x => [x[2], x[3]]), [[4, 1]]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}
{
  // «Volver a la lista de ejemplo» y el buscador del Inicio con el nombre de un tema.
  const { p } = await abrir({ width: 1280, height: 900 }, datos(), { vista: "feed" });
  await p.fill("#feedSearch", "Cámaras"); await p.waitForTimeout(500);
  eq("«Cámaras» no es un tema: es una búsqueda de texto, y trae el posteo con esa palabra (1)", (await enElInicio(p)).length, 1);
  await p.fill("#feedSearch", "plan de seguridad"); await p.waitForTimeout(500);
  eq("«plan de seguridad» tampoco: trae el que lo dice (1)", (await enElInicio(p)).length, 1);
  await p.fill("#feedSearch", "Seguridad"); await p.waitForTimeout(500);
  const tema = await enElInicio(p);
  eq("«Seguridad», el nombre de un tema, busca todas sus palabras («cámaras», «alarma», «vigilancia»): 8 en lo hecho (los 5 de 90 días, uno antes, el cancelado y el de hace un año)", tema.length, 8);
  await p.fill("#feedSearch", "seguridad"); await p.waitForTimeout(500);
  eq("…y escrito en minúscula es lo mismo", (await enElInicio(p)).length, 8);
  await p.fill("#feedSearch", "becas"); await p.waitForTimeout(500);
  eq("«becas» (el tema Becas, en singular o plural, y «scholarship»): los 3 de los últimos 90 días", (await enElInicio(p)).length, 3);
  await p.close();
}

/* ---------------- 8. En otros idiomas ---------------- */
{
  const en = await abrir({ width: 1280, height: 900 }, datos(), { lang: "en" });
  eq("en inglés: «Trends» y los textos", await en.p.evaluate(() => [document.querySelector("#repTendencias h3").textContent, document.querySelector("#repTendencias .rep-seccion-cabeza span").textContent,
    [...document.querySelectorAll("#repTendencias .rep-tend-chips .chip-toggle")].map(c => c.textContent.replace(/\s+/g, " ").trim()), document.querySelector("#repTendencias .rep-tend-ver").textContent]),
    ["Trends", "Last 90 days, against the 90 before", ["All", "📍 Places", "🏷 Types", "💬 Topics"], "See the other 3"]);
  eq("…y las variaciones: «new» y «went quiet»", await en.p.$$eval("#repTendencias .mv-pil", l => l.map(e => e.textContent.trim()).filter(x => /[a-z]/.test(x))), ["new", "new", "new"]);
  await en.p.click('#repTendencias [data-action="tendencias-ver-mas"]');
  eq("…con «went quiet» entre las 9", await en.p.$$eval("#repTendencias .mv-pil", l => l.map(e => e.textContent.trim()).includes("went quiet")), true);
  await en.p.close();
  const he = await abrir({ width: 1280, height: 900 }, datos(), { lang: "he" });
  eq("en hebreo: «מגמות», de derecha a izquierda y con la flecha ← en «antes ← ahora»", await he.p.evaluate(() => [document.querySelector("#repTendencias h3").textContent, document.documentElement.dir, document.querySelector("#repTendencias .mv-n").textContent.includes("←")]), ["מגמות", "rtl", true]);
  eq("…y la ficha grande queda a la derecha (la primera, como en cualquier lista)", await he.p.evaluate(() => { const u = document.querySelector("#repTendencias .rep-mov"), h = u.firstElementChild.getBoundingClientRect(), r = u.getBoundingClientRect(); return h.right >= r.right - 2; }), true);
  await he.p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
