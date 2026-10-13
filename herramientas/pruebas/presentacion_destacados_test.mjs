/* ======================================================================
   «Presentar» con más para mostrar (13/10/2026, opción 2 de la propuesta
   de Presentar, que el usuario eligió: «me encantó lo del punto 2»)

   Dos diapositivas nuevas entre «Mes a mes» y «Lo logrado»:
   - «Lo más destacado»: hasta tres actividades del período, con su foto
     (o el ícono del tipo si no la tienen). Se eligen por lo que tuvieron:
     foto, gente, días, me gusta, un Cierre con objetivos. Nunca una rutina,
     una cancelada ni algo que todavía no pasó; con el mismo «Ver solo» del
     reporte.
   - «Quién lo hizo posible» / «De qué se habló»: las personas que más
     cargaron y los temas de los últimos 90 días como burbujas. El botón
     «👥 Mostrar al equipo» saca o pone los nombres (se acuerda); sin nombres
     queda solo lo que se habló, y sin nombres ni temas la diapositiva no está.
   Y lo mismo en el informe mensual, y en la hoja que se imprime.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, post, ciudad, pais, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const per = i => ({ email: PERS[i].email, name: PERS[i].name });
const cierre = { v: 2, partes: [{ tipo: "cierre", fuente: { name: "Formulario de Cierre.docx" }, lugar: "Rosario, Argentina", duracion: "", ejecutivo: "",
  objetivos: [{ t: "Conocer a los jóvenes del club", logrado: "si" }, { t: "Presentar el curso de verano", logrado: "si" }], pasos: [] }] };
const rosario = [ciudad("Argentina", "Rosario")];
// Actividades de este año, todas ya pasadas. Los puntos de cada una (foto 3, gente hasta 8, me gusta ½ hasta 6, días ½ hasta 6,
// Cierre con objetivos 2, tipo grande 1): GRANDE 3+4+1.5+1.5+2+1 = 13; SEMINARIO 4+1+.5 = 5.5; CURSO 3+1+.5 = 4.5; el resto, menos.
const datos = (extra = []) => {
  const base = BASE(); base.replies = [];
  base.posts = [
    post({ id: "g1", title: "Visita grande a Rosario", start: dia(4), end: dia(2), a: 1, type: "visita", scopes: rosario,
      extra: { images: ["posts/g1/img0_1.jpg"], participants: [per(2), per(3), per(4), per(0)], liked_by: [ADMIN, PERS[2].email, PERS[3].email], resumen: cierre } }),
    post({ id: "g2", title: "Seminario con mucha gente", start: dia(6), end: dia(6), a: 2, type: "seminario", scopes: [ciudad("Uruguay", "Montevideo")],
      extra: { participants: [per(1), per(3), per(4), per(0)] } }),
    post({ id: "g3", title: "Curso con foto", start: dia(8), end: dia(8), a: 3, type: "curso", scopes: [ciudad("Chile", "Santiago")], extra: { images: ["posts/g3/img0_1.jpg"] } }),
    post({ id: "g4", title: "Llamada corta", start: dia(9), end: dia(9), a: 1, type: "virtual", scopes: [ciudad("Perú", "Lima")] }),
    // Lo que NO puede aparecer aunque tenga de todo: una rutina, una cancelada y algo que todavía no pasó.
    post({ id: "x1", title: "Rutina con foto", start: dia(3), end: dia(3), a: 1, type: "rutina", extra: { images: ["posts/x1/img0_1.jpg"], participants: [per(2), per(3), per(4), per(0)] } }),
    post({ id: "x2", title: "Cancelada con foto", start: dia(5), end: dia(5), a: 1, type: "visita", scopes: rosario, extra: { cancelled: true, images: ["posts/x2/img0_1.jpg"], participants: [per(2), per(3)] } }),
    post({ id: "x3", title: "Visita futura con foto", start: dia(-20), end: dia(-20), a: 1, type: "visita", scopes: rosario, extra: { images: ["posts/x3/img0_1.jpg"], participants: [per(2), per(3)] } }),
    ...extra,
  ];
  return base;
};
// Con temas: más de 8 posteos en los 180 días y una palabra que se repite.
const conTemas = () => datos([
  ...[2, 12, 18, 25, 33, 41].map((n, i) => post({ id: "t" + i, title: "Plan de seguridad " + (i + 1), content: "Seguridad en la sede.", start: dia(n), end: dia(n), a: 1 + (i % 3), type: "otro", scopes: rosario })),
]);
const vp = { width: 1280, height: 800 };
const b = await abrirNavegador();

const abrir = async p => { await tab(p, "reportes"); await p.waitForSelector(".rep-total-num"); await p.click('[data-action="reporte-presentar"]'); await p.waitForSelector("#presOverlay:not([hidden]) .ps-slide"); };
const ir = async (p, id) => { const i = (await p.$$eval("#presPuntos .pres-punto", l => l.map(e => e.getAttribute("aria-label")))).findIndex(x => x.includes(id)); await p.click(`#presPuntos .pres-punto:nth-child(${i + 1})`); };
const titulos = p => p.$$eval("#presPuntos .pres-punto", l => l.map(e => e.getAttribute("aria-label").replace(/^[^:]*: /, "")));

/* ---- Lo más destacado ---- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: conTemas() });
  await abrir(p);
  const t = await titulos(p);
  eq("las diapositivas nuevas van entre «Mes a mes» y «Lo logrado»", t.slice(3, 6), ["Mes a mes", "Lo más destacado", "Quién lo hizo posible"]);
  await ir(p, "Lo más destacado");
  eq("tres tarjetas, de la que más tuvo a la que menos: la grande, el seminario con gente y el curso con foto",
    await p.$$eval("#presEscena .ps-card .ps-card-t", l => l.map(e => e.textContent.trim())), ["Visita grande a Rosario", "Seminario con mucha gente", "Curso con foto"]);
  eq("nunca la rutina, la cancelada ni la que todavía no pasó (ni la llamada corta, que quedó cuarta)",
    await p.$eval("#presEscena", e => /Rutina|Cancelada|futura|Llamada/.test(e.textContent)), false);
  eq("las dos con foto la muestran, la del medio (sin foto) lleva el ícono de su tipo",
    await p.$$eval("#presEscena .ps-card", l => l.map(c => [c.querySelectorAll("img").length, c.querySelector(".ps-ico") ? c.querySelector(".ps-ico").textContent : ""])), [[1, ""], [0, "🎤"], [1, ""]]);
  eq("la foto es la de verdad y carga", await p.$$eval("#presEscena .ps-card img", l => l.map(i => i.complete && i.naturalWidth > 0)), [true, true]);
  eq("cada tarjeta lleva el tipo, y el lugar y la fecha", await p.$$eval("#presEscena .ps-card", l => l.map(c => [c.querySelector(".ps-tag").textContent.trim(), /^(Rosario, Argentina|Montevideo, Uruguay|Santiago, Chile) · \d{1,2} de \p{L}+$/u.test(c.querySelector(".ps-card-m").textContent.trim())])).then(l => l.map(x => x[1]).concat(l.map(x => x[0].length > 0))), [true, true, true, true, true, true]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- El equipo y los temas, con y sin nombres ---- */
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: conTemas() });
  await abrir(p);
  eq("«Mostrar al equipo» está en la barra, prendido de fábrica", await p.$eval("#presEquipo", e => [e.hidden, e.getAttribute("aria-pressed"), e.textContent.trim()]), [false, "true", "👥 Mostrar al equipo"]);
  await ir(p, "Quién lo hizo posible");
  const equipo = () => p.evaluate(() => ({
    tit: document.querySelector("#presEscena .ps-tit").textContent.trim(),
    sub: (document.querySelector("#presEscena .ps-sub") || {}).textContent || "",
    gente: [...document.querySelectorAll("#presEscena .ps-gente li")].map(li => li.querySelector(".ps-nom").textContent.trim() + ":" + li.querySelector("b").textContent),
    ini: [...document.querySelectorAll("#presEscena .ps-av")].map(e => e.textContent),
    temas: [...document.querySelectorAll("#presEscena .ps-bu b")].map(e => e.textContent),
  }));
  let e = await equipo();
  eq("con nombres: el título, el rótulo que dice las dos cosas y las personas con lo que cargaron (de mayor a menor)", [e.tit, e.sub, e.gente.length >= 3, e.gente.every(x => /:\d+$/.test(x)), e.gente.map(x => +x.split(":").pop()).every((n, i, l) => !i || l[i - 1] >= n)],
    ["Quién lo hizo posible", "El equipo y de qué se habló", true, true, true]);
  eq("…con las iniciales en cada círculo", e.ini.every(x => /^\p{Lu}{1,2}$/u.test(x)), true);
  eq("…y las burbujas de los temas, con «seguridad» entre ellos", e.temas.includes("seguridad"), true);
  const antes = await p.$eval("#presCuenta", x => x.textContent);
  await p.click("#presEquipo");
  eq("«Mostrar al equipo» apagado: sin personas, solo los temas, y la diapositiva se queda donde estaba", await p.evaluate(() => [document.getElementById("presEquipo").getAttribute("aria-pressed"), document.querySelectorAll("#presEscena .ps-gente").length, document.querySelectorAll("#presEscena .ps-bu").length > 0, document.querySelector("#presEscena .ps-tit").textContent.trim(), document.getElementById("presCuenta").textContent.trim()]),
    ["false", 0, true, "De qué se habló", antes]);
  eq("…y no queda ningún nombre de persona en la diapositiva", await p.$eval("#presEscena", x => /Ana|Diego|Lucía|Moshe|Benny|Pérez|Martínez/.test(x.textContent)), false);
  eq("se acuerda para la próxima vez", await p.evaluate(() => localStorage.getItem("ra_pres_equipo")), "0");
  // Cerrar y volver a abrir: sigue apagado.
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await abrir(p);
  eq("al abrir de nuevo sigue sin nombres", await p.$eval("#presEquipo", x => x.getAttribute("aria-pressed")), "false");
  await ir(p, "De qué se habló");
  eq("…y la diapositiva se llama «De qué se habló»", await p.$eval("#presEscena .ps-tit", x => x.textContent.trim()), "De qué se habló");
  // Imprimir sin nombres: lo mismo en la hoja.
  await p.evaluate(() => { window.__imp = null; window.print = () => { window.__imp = { hojas: document.querySelectorAll("#presPrint .pres-pagina").length, nombres: document.querySelectorAll("#presPrint .ps-gente").length, burbujas: document.querySelectorAll("#presPrint .ps-bu").length };
    setTimeout(() => window.dispatchEvent(new Event("afterprint")), 0); }; });
  await p.click('[data-action="pres-imprimir"]'); await p.waitForFunction(() => window.__imp);
  eq("la hoja impresa también va sin personas y con las burbujas, una hoja por diapositiva", await p.evaluate(() => [window.__imp.hojas, window.__imp.nombres, window.__imp.burbujas > 0]), [8, 0, true]);
  await p.waitForTimeout(200);
  // Volver a prender.
  await p.click("#presEquipo"); await p.waitForTimeout(100);
  eq("volver a prenderlo trae a las personas", await p.evaluate(() => [document.getElementById("presEquipo").getAttribute("aria-pressed"), document.querySelectorAll("#presEscena .ps-gente li").length > 0, localStorage.getItem("ra_pres_equipo")]), ["true", true, "1"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Sin temas: solo las personas; y sin nombres ni temas, la diapositiva no está ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: datos() });
  await abrir(p);
  eq("hay menos de 8 posteos: sin temas, la diapositiva es solo de las personas (un solo bloque)", await titulos(p).then(t => t.slice(4, 6)), ["Lo más destacado", "Quién lo hizo posible"]);
  await ir(p, "Quién lo hizo posible");
  eq("…con personas y sin burbujas", await p.evaluate(() => [document.querySelectorAll("#presEscena .ps-gente li").length > 0, document.querySelectorAll("#presEscena .ps-bu").length, !!document.querySelector("#presEscena .ps-sub")]), [true, 0, false]);
  await p.click("#presEquipo"); await p.waitForTimeout(100);
  eq("apagar los nombres, sin temas: la diapositiva desaparece y la presentación queda con 7", await p.evaluate(() => [document.querySelectorAll("#presPuntos .pres-punto").length, [...document.querySelectorAll("#presPuntos .pres-punto")].some(e => /hizo posible|habló/.test(e.getAttribute("aria-label")))]), [7, false]);
  await p.close();
}

/* ---- Con «Ver solo»: las tarjetas son de ese filtro ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base: conTemas() });
  await tab(p, "reportes"); await p.waitForSelector(".rep-total-num");
  await p.click('[data-action="reporte-filtros"]'); await p.selectOption("#repFPais", "Uruguay"); await p.click('.rep-filtros-pie [data-action="reporte-filtros"]'); await p.waitForTimeout(300);
  await p.click('[data-action="reporte-presentar"]'); await p.waitForSelector("#presOverlay:not([hidden]) .ps-slide");
  await ir(p, "Lo más destacado");
  eq("con «Ver solo Uruguay»: una sola tarjeta, la del seminario, y el título en singular", await p.evaluate(() => [[...document.querySelectorAll("#presEscena .ps-card-t")].map(e => e.textContent.trim()), document.querySelector("#presEscena .ps-tit").textContent.trim()]), [["Seminario con mucha gente"], "Lo más destacado"]);
  await p.close();
}

/* ---- En otros idiomas ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "en", base: conTemas() });
  await abrir(p);
  eq("en inglés: los títulos y el botón", [await titulos(p).then(t => t.slice(4, 6)), await p.$eval("#presEquipo", e => e.textContent.trim())], [["The highlights", "Who made it possible"], "👥 Show the team"]);
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "he", base: conTemas() });
  await abrir(p);
  eq("en hebreo hay las mismas diapositivas", await titulos(p).then(t => t.length), 8);
  await p.close();
}

/* ---- En el celular: nada se sale de la pantalla ---- */
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 780 }, lang: "es", base: conTemas() });
  await abrir(p);
  const caben = async () => p.evaluate(() => { const o = document.getElementById("presOverlay"), s = document.querySelector("#presEscena .ps-slide").getBoundingClientRect(); return [o.scrollWidth <= o.clientWidth, s.left >= 0, s.right <= innerWidth]; });
  await ir(p, "Lo más destacado");
  eq("celular: «Lo más destacado» entra en la pantalla", await caben(), [true, true, true]);
  await ir(p, "Quién lo hizo posible");
  eq("celular: el equipo y los temas entran en la pantalla", await caben(), [true, true, true]);
  eq("celular: el botón «Mostrar al equipo» se ve en la barra", await p.$eval("#presEquipo", e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth; }), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
