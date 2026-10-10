/* ======================================================================
   Los encabezados de las tablas, para el lector de pantalla (auditoría del
   10/10/2026, R22)

   - Todo <th> de la fila de arriba lleva scope="col" (Comparar, «Todos los
     años», «Por persona del equipo» y la vista previa de la Agenda).
   - La primera celda de la fila de arriba estaba vacía: el lector no sabía
     qué era esa columna. Ahora lleva su título en un texto que solo lee el
     lector (no se ve ni mueve nada).
   - En «Todos los años», el nombre de cada fila es un <th scope="row">: el
     lector lo une a cada número. Con el aspecto de siempre (se mide contra
     la celda de al lado; las capturas de Reportes, en compu, celular,
     hebreo, oscuro y papel, quedaron idénticas píxel a píxel).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab, click, irAdmin, admin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();

// Todas las tablas que hay a la vista: encabezados y cuántas filas llevan th de fila.
const tablas = p => p.$$eval("table", l => l.filter(t => t.offsetParent !== null).map(t => ({
  clase: t.className || t.closest("[class]").className,
  cabecera: [...t.querySelectorAll("thead th")].map(h => ({ scope: h.getAttribute("scope"), texto: h.textContent.trim() })),
  filas: t.querySelectorAll("tbody tr").length,
  thFila: [...t.querySelectorAll("tbody th")].map(h => h.getAttribute("scope")),
})));

for(const [lang, vista] of [["", { width: 1280, height: 900 }], ["en", { width: 390, height: 661 }]]){
  const nombre = (lang || "es") + " " + vista.width;
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vista, lang });
  await tab(p, "reportes"); await p.waitForTimeout(500);

  // ---- Todos los años ----
  await p.selectOption("#repAnio", "todos"); await p.waitForTimeout(500);
  const hist = await tablas(p);
  const evol = hist.filter(t => /rep-evolucion/.test(t.clase));
  eq(`[${nombre}] todos los años: hay dos tablas de evolución (la prueba mide algo)`, evol.length, 2);
  eq(`[${nombre}] sus encabezados son todos scope=col`, evol.every(t => t.cabecera.length > 1 && t.cabecera.every(h => h.scope === "col")), true);
  eq(`[${nombre}] y ninguno está vacío (la primera columna dice qué es)`, evol.every(t => t.cabecera.every(h => h.texto)), true);
  eq(`[${nombre}] cada fila empieza con un th scope=row`, evol.every(t => t.filas > 0 && t.thFila.length === t.filas && t.thFila.every(s => s === "row")), true);
  // El th de fila tiene el aspecto de la celda de siempre: misma letra, mismo relleno, misma raya.
  const aspecto = await p.$$eval(".rep-evolucion tbody tr", l => l.slice(0, 3).map(tr => {
    // La celda de referencia: un td de primera columna, armado en la misma fila (como era antes).
    const th = tr.querySelector("th");
    if(!th) return { fila: ["sin th de fila", "th de fila"] };
    const td = document.createElement("td"); td.textContent = "x"; tr.insertBefore(td, th);
    const a = getComputedStyle(th), c = getComputedStyle(td);
    const r = { letra: [a.fontSize, c.fontSize], peso: [a.fontWeight, c.fontWeight], color: [a.color, c.color], relleno: [[a.paddingTop, a.paddingBottom, a.paddingLeft, a.paddingRight].join(), [c.paddingTop, c.paddingBottom, c.paddingLeft, c.paddingRight].join()],
      raya: [a.borderTopWidth + a.borderTopColor, c.borderTopWidth + c.borderTopColor], corte: [a.overflowWrap + a.whiteSpace, c.overflowWrap + c.whiteSpace] };
    td.remove();
    return r;
  }));
  const distintos = aspecto.flatMap(r => Object.entries(r).filter(([, v]) => v[0] !== v[1]).map(([k, v]) => k + ": " + v.join(" ≠ ")));
  eq(`[${nombre}] el th de fila se ve como la celda de siempre (letra, peso, color, relleno, raya, corte de palabras)`, distintos, []);
  eq(`[${nombre}] el texto de solo lector no ocupa lugar`, await p.$$eval(".rep-evolucion thead th:first-child .solo-lector", l => l.every(e => { const r = e.getBoundingClientRect(); return r.width <= 1 && r.height <= 1; })), true);

  // ---- «Por persona del equipo» ----
  const eq2 = hist.find(t => /rep-equipo|rep-tabla/.test(t.clase) && t.cabecera.length === 4 && !/rep-evolucion/.test(t.clase));
  eq(`[${nombre}] «Por persona»: encabezados scope=col y con texto`, !!eq2 && eq2.cabecera.every(h => h.scope === "col" && h.texto), true);

  // ---- Comparar ----
  await click(p, '[data-action="reporte-modo"][data-key="comparar"]'); await p.waitForTimeout(500);
  const comp = (await tablas(p)).filter(t => t.cabecera.length === 4);
  eq(`[${nombre}] comparar: hay tablas lado a lado (la prueba mide algo)`, comp.length >= 2, true);
  eq(`[${nombre}] comparar: todos los encabezados scope=col, ninguno vacío`, comp.every(t => t.cabecera.every(h => h.scope === "col" && h.texto)), true);
  eq(`[${nombre}] comparar: la primera columna se llama como la tabla (por tipo, por país…)`, comp.map(t => t.cabecera[0].texto).every((x, i, l) => x && l.indexOf(x) === i), true);
  eq(`[${nombre}] sin errores en la página`, errores, []);
  await p.close();
}

// ---- La vista previa de la Agenda (Administración › Agenda) ----
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await irAdmin(p); await admin(p, "preferencias", "agenda");
  await p.waitForSelector("#agendaArchivo", { state: "attached" });
  const filas = [
    { institution: "Beit Chabad Rosario", city_display: "Rosario", country_display: "Argentina", rab: "Shlomo Tawil", phone: "54 9 341 555 1234", type: "Centro Comunitario", status: "activo" },
    { institution: "Chabad Santo Domingo", city_display: "Santo Domingo", country_display: "Rep. Dominicana", rab: "Shimon Pelman", phone: "1 809 555 0101", type: "Centro Juvenil", status: "activo" }];
  const html = `<!doctype html><title>Directorio de prueba</title><script>const SEED_DATA = ${JSON.stringify(filas)};\nrender();</script>`;
  await p.setInputFiles("#agendaArchivo", { name: "directorio.html", mimeType: "text/html", buffer: Buffer.from(html) });
  await p.waitForSelector(".ag-tabla table", { timeout: 5000 }).catch(() => {});
  const prev = await p.$$eval(".ag-tabla thead th", l => l.map(h => ({ scope: h.getAttribute("scope"), texto: h.textContent.trim() })));
  eq("agenda: la vista previa tiene sus cinco encabezados (la prueba mide algo)", prev.length, 5);
  eq("agenda: todos scope=col y con texto", prev.every(h => h.scope === "col" && h.texto), true);
  eq("sin errores en la página", errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
