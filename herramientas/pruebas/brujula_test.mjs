/* ======================================================================
   Brújula en Toldot (Administración › Brújula, docs/brujula/README.md)

   La pantalla del admin: quién tiene acceso a las carpetas de Drive (se lee por la
   función `brujula`, que acá es de mentira), invitar, dar y quitar acceso, y editar el
   catálogo de carpetas pegando links. Con la app de verdad y el Supabase de mentira de
   app_dom_test.mjs; todo con gente inventada (@example.org).
   ====================================================================== */
import { abrirNavegador, entrar, admin, irAdmin, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const C1 = "CarpetaUnoAbCdEf", C2 = "CarpetaDosGhIjKl", C3 = "CarpetaTresMnOpQr", PL1 = "PlanillaUnoAbCdEf", PL2 = "PlanillaDosGhIjKl";
const base = () => ({
  ...BASE(),
  brujula_carpetas: [
    { id: C1, nombre: "Brújula Cloud", nombre_drive: "Brújula Cloud", orden: 1, activa: true, planillas: [PL1], creada: "2026-11-01T00:00:00Z", creada_por: ADMIN },
    { id: C2, nombre: "CARE", nombre_drive: "CARE", orden: 2, activa: true, planillas: [PL1, PL2], creada: "2026-11-01T00:00:00Z", creada_por: ADMIN },
    { id: C3, nombre: "Archivo 2025", nombre_drive: "Archivo 2025", orden: 3, activa: false, planillas: [], creada: "2026-11-01T00:00:00Z", creada_por: ADMIN },
  ],
  brujula_planillas: [{ id: PL1, nombre: "Users grande", orden: 1 }, { id: PL2, nombre: "Users CARE", orden: 2 }],
  brujula_paquetes: [{ id: "paq-todo", nombre: "Todo Brújula", orden: 1 }],
  brujula_paquete_carpetas: [{ id: "pc1", paquete: "paq-todo", carpeta: C1 }, { id: "pc2", paquete: "paq-todo", carpeta: C2 }],
});
const persona = (correo, nombre, o = {}) => ({ correo, nombre, idioma: "Español", comunidad: "", carpetas: {}, permisos: {}, editor: false, planillas: [], pendiente: false, error: "", ...o });
const LEIDO = () => ({
  leido: new Date().toISOString(),
  carpetas: [
    { id: C1, nombre: "Brújula Cloud", orden: 1, activa: true, planillas: [PL1], estado: "ok", personas: 4 },
    { id: C2, nombre: "CARE", orden: 2, activa: true, planillas: [PL1, PL2], estado: "ok", personas: 1 },
    { id: C3, nombre: "Archivo 2025", orden: 3, activa: false, planillas: [], estado: "sinpermiso", personas: 0 },
  ],
  planillas: [{ id: PL1, nombre: "Users grande", orden: 1, estado: "ok", filas: 3, pendientes: 2 }, { id: PL2, nombre: "Users CARE", orden: 2, estado: "ok", filas: 0, pendientes: 0 }],
  personas: [
    persona("valeria@example.org", "Valeria Montes", { comunidad: "Buenos Aires", carpetas: { [C1]: "reader", [C2]: "reader" }, permisos: { [C1]: "pv1", [C2]: "pv2" }, planillas: [{ planilla: PL1, fila: 2, enviado: true }] }),
    persona("camila@example.org", "Camila Ortega", { carpetas: { [C1]: "reader" }, permisos: { [C1]: "pc1" } }),
    persona("hannah@example.org", "Hannah Cole", { idioma: "Inglés", pendiente: true, planillas: [{ planilla: PL1, fila: 3, enviado: false }] }),
    persona("joaquin@example.org", "Joaquín Salas", { pendiente: true, error: "Error: no se pudo compartir", planillas: [{ planilla: PL1, fila: 4, enviado: false }] }),
    persona("evil@example.org", "<img src=x onerror=window.__xss=1>", { carpetas: { [C1]: "reader" }, permisos: { [C1]: "pe1" } }),
    persona("equipo@example.org", "Equipo", { carpetas: { [C1]: "writer" }, permisos: { [C1]: "pq1" }, editor: true }),
  ],
});

const b = await abrirNavegador();
// Entra como admin y deja la función `brujula` de mentira: anota cada pedido y contesta según el guion.
async function abrir({ lang, viewport, guion = {}, datos = LEIDO, estado = 200, baseFn = base } = {}){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { base: baseFn(), lang, viewport });
  const pedidos = [];
  await p.route(/\/functions\/v1\/brujula/, ruta => {
    const cuerpo = JSON.parse(ruta.request().postData() || "{}");
    pedidos.push(cuerpo);
    const r = (guion[cuerpo.accion] || (() => cuerpo.accion === "leer" ? { estado, cuerpo: estado === 200 ? datos() : { error: "sin-configurar" } } : { estado: 200, cuerpo: {} }))(cuerpo);
    return ruta.fulfill({ status: r.estado ?? 200, contentType: "application/json", body: JSON.stringify(r.cuerpo ?? r) });
  });
  await irAdmin(p);
  await admin(p, "preferencias", "brujula");
  await p.waitForTimeout(900);
  return { p, errores, pedidos };
}
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.innerText.replace(/\s+/g, " ").trim()));
const filas = p => p.$$eval(".bj-fila:not(.bj-cab)", l => l.map(f => f.querySelector(".bj-nombre").innerText.trim()));
const clic = async (p, sel, ms = 350) => { await p.click(sel); await p.waitForTimeout(ms); };
// Espera de verdad (hasta 8 s) a que se cumpla algo que la app hace DESPUÉS de apretar un botón (varias invitaciones una tras otra):
// con una pausa fija, el reloj más lento de GitHub (24/11/2026, 3 comprobaciones de «Invitar») miraba a mitad de camino.
const hastaQue = async (p, f) => { const fin = Date.now() + 8000; while(Date.now() < fin && !(await f())) await p.dormir(100); };
const confirmar = async p => { await p.click("#confirmOk"); await p.waitForTimeout(500); };
const tabla = (p, t) => p.evaluate(t => window.__sb.tablas[t], t);

/* ---------- La pantalla: lista, cuadrícula, filtros ---------- */
{
  const { p, errores, pedidos } = await abrir();
  eq("el menú de Administración tiene «Brújula» en Equipo, con la cantidad de pendientes", await textos(p, '.admin-menu [data-key="brujula"]'), ["Brújula 2"]);
  eq("la pantalla pide leer a la función", pedidos.map(x => x.accion), ["leer"]);
  eq("las solapas dicen cuántas personas y cuántas carpetas (solo las activas)", await textos(p, ".bj-tab"), ["Personas · 6", "Carpetas · 2"]);
  eq("la cuadrícula tiene una columna por carpeta activa", await textos(p, ".bj-cab .bj-c-cab"), ["Brújula Cloud", "CARE"]);
  eq("las personas en orden de lectura", await filas(p), ["Valeria Montes", "Camila Ortega", "Hannah Cole", "Joaquín Salas", "<img src=x onerror=window.__xss=1>", "Equipo"]);
  eq("quién tiene qué (✓ lector, – nada, E editor)", await p.$$eval(".bj-fila:not(.bj-cab)", l => l.map(f => [...f.querySelectorAll(".bj-celdas .bj-c")].map(c => c.innerText).join(""))), ["✓✓", "✓–", "––", "––", "✓–", "E–"]);
  eq("cada persona con su etiqueta", await p.$$eval(".bj-fila:not(.bj-cab) .bj-tag", l => l.map(e => e.innerText)), ["Todo", "1 de 2", "Pendiente", "Error", "1 de 2", "1 de 2"]);
  eq("un nombre con HTML se ve como texto: no se crea nada ni se ejecuta", [await p.$$eval(".bj img", l => l.length), await p.evaluate(() => window.__xss === 1)], [0, false]);
  eq("sin la pregunta de siempre: no hay párrafos explicativos ni «¿Cómo funciona?» en la sección", await p.$$eval(".bj p, .bj details, .admin-ayuda", l => l.length), [0].map(() => 0)[0]);
  eq("la cabecera lleva el botón de invitar", await textos(p, ".admin-cab-acc .bj-btn"), ["+ Invitar personas"]);
  eq("«Actualizado» y el botón de actualizar", [(await textos(p, ".bj-actualiza span"))[0].startsWith("Actualizado"), await p.$$eval('[data-action="bj-recargar"]', l => l.length)], [true, 1]);

  await p.fill("#bjBuscar", "camil"); await p.waitForTimeout(250);
  eq("buscar filtra por nombre", await filas(p), ["Camila Ortega"]);
  await p.fill("#bjBuscar", "HANNAH@example"); await p.waitForTimeout(250);
  eq("…o por correo, sin mirar mayúsculas", await filas(p), ["Hannah Cole"]);
  await p.fill("#bjBuscar", ""); await p.waitForTimeout(250);
  eq("los filtros cuentan: pendientes 2, con problemas 1, parciales 3", await textos(p, ".bj-fchip"), ["Todas", "Pendientes · 2", "Con problemas · 1", "Parciales · 3"]);
  await clic(p, '[data-action="bj-filtro"][data-key="pend"]');
  eq("pendientes: los dos que esperan (uno con error)", await filas(p), ["Hannah Cole", "Joaquín Salas"]);
  eq("pendientes: el aviso corto con el botón para darles acceso", await textos(p, ".bj-aviso"), ["2 personas esperan acceso. Dar acceso a las 2"]);
  await clic(p, '[data-action="bj-filtro"][data-key="prob"]');
  eq("con problemas: solo el que tiene error", await filas(p), ["Joaquín Salas"]);
  await clic(p, '[data-action="bj-filtro"][data-key="parc"]');
  eq("parciales: los que tienen algo pero no todo", await filas(p), ["Camila Ortega", "<img src=x onerror=window.__xss=1>", "Equipo"]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------- Elegir a varios y quitar ---------- */
{
  const { p, pedidos } = await abrir({ guion: { quitar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), planilla: "no" }) } });
  await p.check('[data-action="bj-sel"][data-correo="valeria@example.org"]'); await p.waitForTimeout(200);
  await p.check('[data-action="bj-sel"][data-correo="camila@example.org"]'); await p.waitForTimeout(200);
  eq("al elegir aparece la barra con cuántas", await textos(p, ".bj-barra strong"), ["2 personas elegidas"]);
  eq("…con sus tres acciones y limpiar", await textos(p, ".bj-barra button"), ["Agregar carpeta", "Quitar de una carpeta", "Quitar todo el acceso", "Limpiar"]);
  await clic(p, '[data-action="bj-quitar-todo-varios"]');
  eq("quitar todo pide confirmar, con cuántas personas", (await textos(p, "#confirmMessage")).join(" ").includes("2 personas"), true);
  await confirmar(p);
  const q = pedidos.filter(x => x.accion === "quitar");
  eq("se le pide a la función de a una persona, solo las carpetas que tiene y con los permisos de Drive que leyó",
     q.map(x => [x.correo, x.carpetas, x.permisos, x.filas]),
     [["valeria@example.org", [C1, C2], { [C1]: "pv1", [C2]: "pv2" }, [{ planilla: PL1, fila: 2 }]], ["camila@example.org", [C1], { [C1]: "pc1" }, []]]);
  eq("muestra lo que salió: «Listo» y cada persona con sus carpetas", [await textos(p, ".bj-form h3"), await textos(p, ".bj-res-n")], [["Listo"], ["Valeria Montes", "Camila Ortega"]]);
  eq("…y vuelve a leer Drive para mostrar lo nuevo", pedidos.filter(x => x.accion === "leer").length, 2);
  eq("queda anotado en el registro de actividad, con quién lo hizo", (await tabla(p, "audit_log")).filter(x => x.type === "brujula_quito").map(x => [x.actor_email, x.target_email, x.detail]),
     [[ADMIN, "valeria@example.org", "Brújula Cloud, CARE"], [ADMIN, "camila@example.org", "Brújula Cloud"]]);
  await clic(p, '[data-action="bj-volver"]');
  eq("«Entendido» vuelve a la lista y limpia lo elegido", [await p.$$eval(".bj-barra", l => l.length), (await filas(p)).length], [0, 6]);
  await p.close();
}

/* ---------- Sacar de la lista (23/11/2026) ----------
   Dos cosas que pasaron con la planilla de verdad: (1) una persona a la que el Script no pudo darle acceso (el administrador de
   su organización no deja recibir archivos de afuera) queda con la fila en error y sin nada en Drive; «Quitar todo el acceso» le pedía
   a la función quitar cero carpetas, la función rechazaba todo y la pantalla ponía «Google no contestó» en las 7 carpetas. (2) A quien
   se le sacaba todo el acceso le quedaba su fila «Enviado» y seguía en la lista como «Sin acceso». */
const cerrar = c => ({ filas: c.filas.map(f => ({ ...f, estado: "cerrada" })) });
{
  const { p, pedidos } = await abrir({ guion: { descartar: cerrar } });
  await p.check('[data-action="bj-sel"][data-correo="joaquin@example.org"]'); await p.waitForTimeout(200);
  eq("quien no tiene carpetas: el botón dice lo que hace («Sacar de la lista»), no «quitar el acceso»", await textos(p, ".bj-barra button"), ["Agregar carpeta", "Quitar de una carpeta", "Sacar de la lista", "Limpiar"]);
  await clic(p, '[data-action="bj-quitar-todo-varios"]');
  eq("pide confirmar con palabras de lista, no de acceso", (await textos(p, "#confirmMessage")).join(" "), "¿Sacar a esta persona de la lista? No tiene acceso a ninguna carpeta.");
  await confirmar(p);
  eq("a la función NO se le pide «quitar» (no hay nada que quitar): se le pide cerrar la fila que esperaba",
     [pedidos.filter(x => x.accion === "quitar").length, pedidos.filter(x => x.accion === "descartar").map(x => [x.correo, x.filas])], [0, [["joaquin@example.org", [{ planilla: PL1, fila: 4 }]]]]);
  eq("el resultado es «Listo» y dice que salió de la lista (sin «Google no contestó»)", [await textos(p, ".bj-form h3"), await textos(p, ".bj-res-n"), await textos(p, ".bj-res .bj-mail"), await p.$$eval(".bj-res-l li", l => l.length)], [["Listo"], ["Joaquín Salas"], ["Sacada de la lista."], 0]);
  eq("queda anotado en el registro de actividad", (await tabla(p, "audit_log")).filter(x => x.type === "brujula_quito").map(x => [x.target_email, x.detail]), [["joaquin@example.org", "Sacado de la lista"]]);
  await p.close();
}
{
  // La ficha de esa persona: un solo botón, el que corresponde.
  const { p, pedidos } = await abrir({ guion: { descartar: cerrar } });
  await clic(p, '[data-action="bj-persona"][data-correo="joaquin@example.org"]');
  eq("la ficha de quien tiene un error y ninguna carpeta: «Sacar de la lista» (y no «Quitar todo el acceso»)", await textos(p, ".bj-acciones button"), ["Sacar de la lista"]);
  await clic(p, '[data-action="bj-quitar-todo"]');
  eq("pide confirmar con el nombre", (await textos(p, "#confirmMessage")).join(" "), "¿Sacar a Joaquín Salas de la lista? No tiene acceso a ninguna carpeta.");
  await confirmar(p);
  eq("se cierra su fila y nada más", pedidos.filter(x => x.accion !== "leer").map(x => x.accion), ["descartar"]);
  await p.close();
}
{
  // Varias personas, una con carpetas y otra sin: la que tiene se «quita», la que no se «saca de la lista».
  const { p, pedidos } = await abrir({ guion: { quitar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), planilla: "no" }), descartar: cerrar } });
  await p.check('[data-action="bj-sel"][data-correo="camila@example.org"]'); await p.waitForTimeout(200);
  await p.check('[data-action="bj-sel"][data-correo="joaquin@example.org"]'); await p.waitForTimeout(200);
  eq("si alguna tiene carpetas, el botón sigue siendo «Quitar todo el acceso»", (await textos(p, ".bj-barra button"))[2], "Quitar todo el acceso");
  await clic(p, '[data-action="bj-quitar-todo-varios"]'); await confirmar(p);
  eq("a Camila se le quita la carpeta que tiene; a Joaquín solo se le cierra la fila",
     [pedidos.filter(x => x.accion === "quitar").map(x => [x.correo, x.carpetas]), pedidos.filter(x => x.accion === "descartar").map(x => x.correo)], [[["camila@example.org", [C1]]], ["joaquin@example.org"]]);
  eq("el resultado: Listo, y solo Joaquín sale de la lista", [await textos(p, ".bj-form h3"), await textos(p, ".bj-res .bj-mail")], [["Listo"], ["Sacada de la lista."]]);
  await p.close();
}
{
  // Alguien con una carpeta Y una fila esperando: si se le quita todo, la fila se cierra; si se le quita solo una, no.
  const conFila = () => { const d = LEIDO(); d.personas.push(
    persona("mixta@example.org", "Mixta Prado", { carpetas: { [C1]: "reader", [C2]: "reader" }, permisos: { [C1]: "pm1", [C2]: "pm2" }, pendiente: true, planillas: [{ planilla: PL1, fila: 5, enviado: false }] })); return d; };
  const guion = { quitar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), planilla: "no" }), descartar: cerrar };
  let { p, pedidos } = await abrir({ guion, datos: conFila });
  await clic(p, '[data-action="bj-persona"][data-correo="mixta@example.org"]');
  await clic(p, '[data-action="bj-quitar-una"][data-id="' + C1 + '"]'); await confirmar(p);
  eq("quitarle una de dos carpetas no cierra su fila (todavía tiene acceso)", [pedidos.filter(x => x.accion === "quitar").length, pedidos.filter(x => x.accion === "descartar").length], [1, 0]);
  await p.close();
  ({ p, pedidos } = await abrir({ guion, datos: conFila }));
  await clic(p, '[data-action="bj-persona"][data-correo="mixta@example.org"]');
  await clic(p, '[data-action="bj-quitar-todo"]'); await confirmar(p);
  eq("quitarle todo cierra además su fila", [pedidos.filter(x => x.accion === "quitar").map(x => x.carpetas), pedidos.filter(x => x.accion === "descartar").map(x => x.filas)], [[[C1, C2]], [[{ planilla: PL1, fila: 5 }]]]);
  await p.close();
  // Un acceso que no se pudo quitar (heredado) tampoco cierra la fila: sigue teniendo la carpeta.
  ({ p, pedidos } = await abrir({ guion: { quitar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: false, error: "heredado" })), planilla: "no" }), descartar: cerrar }, datos: conFila }));
  await clic(p, '[data-action="bj-persona"][data-correo="mixta@example.org"]');
  await clic(p, '[data-action="bj-quitar-todo"]'); await confirmar(p);
  eq("si Drive no deja quitar (heredado), la fila no se cierra", pedidos.filter(x => x.accion === "descartar").length, 0);
  await p.close();
}
{
  // Quien se queda sin carpetas y sin nada esperando ya no figura en la lista (su fila «Enviado» no se borra).
  let quitada = false;
  const datos = () => { const d = LEIDO(); if(quitada){ const v = d.personas.find(x => x.correo === "camila@example.org"); v.carpetas = {}; v.permisos = {}; v.planillas = [{ planilla: PL1, fila: 8, enviado: true }]; } return d; };
  const { p, pedidos } = await abrir({ datos, guion: { quitar: c => { quitada = true; return { carpetas: c.carpetas.map(id => ({ id, ok: true })), planilla: "escrita" }; }, descartar: cerrar } });
  eq("antes: Camila está en la lista", (await filas(p)).includes("Camila Ortega"), true);
  await clic(p, '[data-action="bj-persona"][data-correo="camila@example.org"]');
  await clic(p, '[data-action="bj-quitar-todo"]'); await confirmar(p);
  await clic(p, '[data-action="bj-volver"]'); await p.waitForTimeout(500);
  eq("después: ya no figura (la tabla, las solapas y los filtros no la cuentan)", [(await filas(p)).includes("Camila Ortega"), (await textos(p, ".bj-tab"))[0], pedidos.filter(x => x.accion === "descartar").length], [false, "Personas · 5", 0]);
  await p.close();
}
{
  // Si falla el pedido entero no se inventa un motivo por carpeta.
  const { p } = await abrir({ guion: { quitar: () => ({ estado: 502, cuerpo: { error: "google" } }) } });
  await p.check('[data-action="bj-sel"][data-correo="valeria@example.org"]'); await p.waitForTimeout(200);
  await clic(p, '[data-action="bj-quitar-todo-varios"]'); await confirmar(p);
  eq("falló todo: «No se pudo», una sola frase y ni una carpeta con «Google no contestó»", [await textos(p, ".bj-form h3"), await textos(p, ".bj-res-n"), await p.$$eval(".bj-res-l li", l => l.length)], [["No se pudo"], ["Valeria Montes No se pudo. Probá de nuevo."], 0]);
  await p.close();
}
{
  const { p } = await abrir({ guion: { quitar: () => ({ estado: 400, cuerpo: { error: "carpetas" } }) } });
  await p.check('[data-action="bj-sel"][data-correo="valeria@example.org"]'); await p.waitForTimeout(200);
  await clic(p, '[data-action="bj-quitar-todo-varios"]'); await confirmar(p);
  eq("un código que la pantalla conoce se explica con su frase", await textos(p, ".bj-res-n"), ["Valeria Montes Actualizá la lista y probá de nuevo."]);
  await p.close();
}

/* ---------- Elegir a todas y los títulos de las columnas (24/11/2026) ---------- */
{
  const { p } = await abrir();
  eq("a la izquierda de «Persona» hay un tilde para elegir a todas (y arranca sin marcar)",
     [await p.$eval(".bj-cab > :first-child", e => e.dataset.action), await p.$eval('.bj-cab [data-action="bj-sel-todas"]', e => [e.checked, e.indeterminate])], ["bj-sel-todas", [false, false]]);
  await p.check('[data-action="bj-sel-todas"]'); await p.waitForTimeout(250);
  eq("lo marca para todas las de la lista", [await textos(p, ".bj-barra strong"), await p.$$eval('[data-action="bj-sel"]:checked', l => l.length), await p.$eval('[data-action="bj-sel-todas"]', e => [e.checked, e.indeterminate])], [["6 personas elegidas"], 6, [true, false]]);
  await p.uncheck('[data-action="bj-sel"][data-correo="camila@example.org"]'); await p.waitForTimeout(250);
  eq("si se desmarca una, el tilde de todas queda a medias", await p.$eval('[data-action="bj-sel-todas"]', e => [e.checked, e.indeterminate]), [false, true]);
  await p.click('[data-action="bj-sel-todas"]'); await p.waitForTimeout(250);
  eq("tocarlo a medias las elige a todas", [await textos(p, ".bj-barra strong"), await p.$eval('[data-action="bj-sel-todas"]', e => [e.checked, e.indeterminate])], [["6 personas elegidas"], [true, false]]);
  await p.click('[data-action="bj-sel-todas"]'); await p.waitForTimeout(250);
  eq("tocarlo marcado las suelta a todas (y la barra se va)", [await p.$$eval('[data-action="bj-sel"]:checked', l => l.length), await p.$$eval(".bj-barra", l => l.length)], [0, 0]);
  // Solo las que aparecen: con una búsqueda, elige solo esas.
  await p.fill("#bjBuscar", "camil"); await p.waitForTimeout(250);
  await p.check('[data-action="bj-sel-todas"]'); await p.waitForTimeout(250);
  eq("con una búsqueda elige solo a las que aparecen", await textos(p, ".bj-barra strong"), ["1 persona elegida"]);
  await p.fill("#bjBuscar", ""); await p.waitForTimeout(250);
  eq("al volver a ver a todas, el tilde queda a medias (1 de 6)", await p.$eval('[data-action="bj-sel-todas"]', e => [e.checked, e.indeterminate]), [false, true]);
  await p.close();
}
{
  // Los títulos, en horizontal: el emoji de la carpeta arriba y el nombre debajo; el nombre completo al apoyar el mouse.
  const conEmoji = () => { const x = base(); x.brujula_carpetas[0].nombre = "Hadraja - Enseñanza 🧑‍🏫"; x.brujula_carpetas[1].nombre = "Material de Congresos y Seminarios 📚"; return x; };
  const { p } = await abrir({ baseFn: conEmoji });
  eq("cada título: el emoji (entero, aunque sea compuesto) por un lado y el nombre sin emoji por otro; el nombre completo en el title",
     await p.$$eval(".bj-cab .bj-c-cab", l => l.map(e => [e.querySelector(".bj-c-ic").innerText, e.querySelector(".bj-c-n").innerText, e.title])),
     [["🧑‍🏫", "Hadraja - Enseñanza", "Hadraja - Enseñanza 🧑‍🏫"], ["📚", "Material de Congresos y Seminarios", "Material de Congresos y Seminarios 📚"]]);
  eq("van en horizontal (nada en vertical ni girado)", await p.$$eval(".bj-c-n", l => l.map(e => [getComputedStyle(e).writingMode, getComputedStyle(e).transform])), [["horizontal-tb", "none"], ["horizontal-tb", "none"]]);
  eq("ninguna palabra del título es más ancha que su columna (no se parte ni se corta)",
     await p.$$eval(".bj-cab .bj-c-cab", l => l.map(c => { const n = c.querySelector(".bj-c-n"), cs = getComputedStyle(n);
       return n.innerText.split(/\s+/).every(w => { const x = document.createElement("span"); x.textContent = w; x.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`; c.appendChild(x); const ok = x.offsetWidth <= c.clientWidth; x.remove(); return ok; }); })), [true, true]);
  eq("la cabecera es baja: no deja un hueco enorme a la izquierda", await p.$eval(".bj-cab", e => e.getBoundingClientRect().height <= 110), true);
  eq("la columna de «Persona» no se queda con todo el ancho: las carpetas se reparten lo que sobra",
     await p.evaluate(() => { const f = document.querySelector(".bj-fila:not(.bj-cab)"), q = f.querySelector(".bj-quien").getBoundingClientRect(), c = f.querySelector(".bj-celdas").getBoundingClientRect(); return c.width >= q.width; }), true);
  eq("las tildes de cada fila quedan debajo de su título (misma columna)",
     await p.evaluate(() => { const c = [...document.querySelectorAll(".bj-cab .bj-c-cab")].map(e => Math.round(e.getBoundingClientRect().left)); const f = [...document.querySelectorAll(".bj-fila:not(.bj-cab) .bj-celdas")][0].children; return [...f].map((e, i) => Math.abs(Math.round(e.getBoundingClientRect().left) - c[i]) <= 1); }), [true, true]);
  await p.close();
}
{
  // Las personas: dos líneas cortas, ninguna se parte; los títulos, centrados en vertical.
  const largo = () => { const d = LEIDO(); d.personas.push(persona("una.persona.con.un.correo.muy.largo.de.verdad@subdominio.example.org", "Nombre Apellido Segundo Apellido Muy Largo", { carpetas: { [C1]: "reader" }, permisos: { [C1]: "pl1" } })); return d; };
  const { p } = await abrir({ datos: largo });
  const n = (await filas(p)).length;
  eq("cada persona ocupa dos líneas y ninguna se parte (el nombre y el correo en una línea cada uno) y la fila es baja",
     await p.$$eval(".bj-fila:not(.bj-cab)", l => l.map(f => [f.querySelector(".bj-nombre").getBoundingClientRect().height <= 30, f.querySelector(".bj-mail").getBoundingClientRect().height <= 18, f.getBoundingClientRect().height <= 72])), Array(n).fill([true, true, true]));
  eq("lo que no entra se corta con «…» y lo completo queda en el title (nombre y correo)",
     await p.$$eval(".bj-fila:not(.bj-cab):last-of-type", l => l.map(f => { const m = f.querySelector(".bj-mail"), nm = f.querySelector(".bj-nombre"); return [m.scrollWidth > m.clientWidth, m.title, nm.title]; })),
     [[true, "una.persona.con.un.correo.muy.largo.de.verdad@subdominio.example.org", "Nombre Apellido Segundo Apellido Muy Largo"]]);
  eq("el nombre y sus etiquetas van en la misma línea", await p.$$eval(".bj-fila:not(.bj-cab)", l => l.every(f => Math.abs(f.querySelector(".bj-nombre").getBoundingClientRect().top - f.querySelector(".bj-chips").getBoundingClientRect().top) < 12)), true);
  eq("los títulos de las columnas están centrados en vertical (el ícono y el nombre juntos, a mitad de la cabecera)",
     await p.evaluate(() => { const cab = document.querySelector(".bj-cab").getBoundingClientRect(), mitad = cab.top + cab.height / 2;
       return [...document.querySelectorAll(".bj-cab .bj-c-cab")].every(c => { const a = c.querySelector(".bj-c-ic").getBoundingClientRect(), b = c.querySelector(".bj-c-n").getBoundingClientRect(); return Math.abs((a.top + b.bottom) / 2 - mitad) <= 4; }); }), true);
  eq("en escritorio la tabla entra sin barra de desplazamiento", await p.$eval(".bj-tabla", e => e.scrollWidth <= e.clientWidth + 1), true);
  await p.setViewportSize({ width: 1100, height: 760 }); await p.waitForTimeout(300);
  eq("en una ventana más angosta (1100) también entra: se va el círculo con las iniciales y el correo sigue en una línea",
     [await p.$eval(".bj-tabla", e => e.scrollWidth <= e.clientWidth + 1), await p.$eval(".bj-fila:not(.bj-cab) .bj-av", e => getComputedStyle(e).display), await p.$$eval(".bj-fila:not(.bj-cab) .bj-mail", l => l.every(m => m.getBoundingClientRect().height <= 18))], [true, "none", true]);
  await p.close();
}
{
  // En el celular la cabecera sigue (con el tilde de todas) y solo se van las columnas.
  const { p } = await abrir({ viewport: { width: 390, height: 844 } });
  eq("celular: está el tilde de todas y «Persona», sin los títulos de las carpetas",
     [await p.$eval(".bj-cab", e => getComputedStyle(e).display !== "none"), await p.$eval('.bj-cab [data-action="bj-sel-todas"]', e => e.offsetWidth >= 24 && e.offsetHeight >= 24), await p.$eval(".bj-cab .bj-celdas", e => getComputedStyle(e).display)], [true, true, "none"]);
  await p.check('[data-action="bj-sel-todas"]'); await p.waitForTimeout(250);
  eq("celular: elige a todas", await textos(p, ".bj-barra strong"), ["6 personas elegidas"]);
  await p.close();
}

/* ---------- Una persona ---------- */
{
  const { p, pedidos } = await abrir({ guion: { quitar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: false, error: "heredado" })), planilla: "no" }), dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), mail: "no", planilla: "no" }) } });
  await clic(p, '[data-action="bj-persona"][data-correo="camila@example.org"]');
  eq("la ficha: nombre, correo y estado", [await textos(p, ".bj-ficha h3"), await textos(p, ".bj-ficha .bj-mail"), await textos(p, ".bj-ficha .bj-tag")], [["Camila Ortega"], ["camila@example.org"], ["1 de 2"]]);
  eq("cada carpeta ofrecida con su botón: quitar la que tiene, dar la que no (la desactivada no, si no la tiene)",
     await textos(p, ".bj-carp"), ["📁 Brújula Cloud Tiene acceso Quitar", "📁 CARE Sin acceso Dar acceso"]);
  await clic(p, '[data-action="bj-quitar-una"]');
  await confirmar(p);
  eq("quitar una carpeta: la función recibe solo esa", pedidos.filter(x => x.accion === "quitar").map(x => x.carpetas), [[C1]]);
  eq("si es un acceso heredado, la pantalla lo explica con palabras (no con lo que dijo Google)", await textos(p, ".bj-res-l li"), ["! Brújula Cloud Le llega por otra carpeta: hay que sacarlo en Drive."]);
  await clic(p, '[data-action="bj-volver"]');
  await clic(p, '[data-action="bj-persona"][data-correo="camila@example.org"]');
  await clic(p, '[data-action="bj-dar-una"]');
  eq("dar acceso a una carpeta: sin mail y sin tocar la planilla", pedidos.filter(x => x.accion === "dar").map(x => [x.persona.correo, x.carpetas, x.mail, x.planilla ?? null]), [["camila@example.org", [C2], false, null]]);
  await p.close();
}

/* ---------- La comunidad: el buscador de lugares (24/11/2026) ---------- */
{
  const { p, pedidos } = await abrir({ guion: { dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), mail: "no", planilla: "agregada" }) } });
  await clic(p, '[data-action="bj-invitar-abrir"]');
  eq("es un buscador como los de siempre (no la lista nativa del navegador, que era gigante)", [await p.$$eval("datalist", l => l.length), await p.$eval("#bjComunidad", e => e.getAttribute("role")), await p.$$eval(".bj-combo .autocomplete-option", l => l.length)], [0, "combobox", 0]);
  await p.fill('[data-bj="f.nombre"]', "Elena Ríos"); await p.fill('[data-bj="f.correo"]', "elena@example.org"); await p.waitForTimeout(450);
  await p.click("#bjComunidad"); await p.keyboard.type("cordo"); await p.waitForTimeout(200);
  const ops = await textos(p, ".bj-combo .autocomplete-option");
  eq("al escribir ofrece lugares con el mismo formato que el resto de Toldot (ciudad, país) y ocho como mucho", [ops.includes("📍 Córdoba, Argentina"), ops.length <= 8, await p.$eval("#bjComunidad", e => e.getAttribute("aria-expanded"))], [true, true, "true"]);
  await p.fill("#bjComunidad", ""); await p.keyboard.type("buenos"); await p.waitForTimeout(200);
  eq("ofrece también la ciudad con su país («Buenos Aires (CABA), Argentina»)", (await textos(p, ".bj-combo .autocomplete-option")).includes("📍 Buenos Aires (CABA), Argentina"), true);
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowUp"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("flechas y Enter eligen; queda como la planilla ya la escribe («Buenos Aires», no «Buenos Aires (CABA)») y la lista se cierra",
     [await p.inputValue("#bjComunidad"), await p.$$eval(".bj-combo .autocomplete-option", l => l.length), await p.$eval("#bjComunidadAviso", e => e.hidden)], ["Buenos Aires", 0, true]);
  await p.fill("#bjComunidad", ""); await p.keyboard.type("zzzz"); await p.waitForTimeout(200);
  eq("sin resultados: lo dice y ofrece «Otro»", [await textos(p, ".bj-combo .autocomplete-empty"), await textos(p, ".bj-combo .autocomplete-option")], [["Sin resultados"], ["✨ Otro"]]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  eq("Escape cierra la lista y no la pantalla", [await p.$$eval(".bj-combo .autocomplete-option", l => l.length), (await textos(p, ".bj-form h3"))[0]], [0, "Invitar personas"]);
  await p.click(".bj-form h3"); await p.waitForTimeout(300);
  eq("lo escrito que no es una opción avisa y no deja invitar", [await p.$eval("#bjComunidadAviso", e => e.hidden), await p.$eval('[data-action="bj-invitar"]', e => e.disabled)], [false, true]);
  await p.fill("#bjComunidad", "otro"); await p.waitForTimeout(150); await p.click(".bj-form h3"); await p.waitForTimeout(300);
  eq("«otro» en minúscula es una opción válida: ya no avisa y se puede invitar", [await p.$eval("#bjComunidadAviso", e => e.hidden), await p.$eval('[data-action="bj-invitar"]', e => e.disabled)], [true, false]);
  await clic(p, '[data-action="bj-invitar"]', 600);
  eq("a la función le llega «Otro» tal como lo escribe la planilla", pedidos.filter(x => x.accion === "dar").map(x => x.persona.comunidad), ["Otro"]);
  await p.close();
}
{
  // Tocar una opción con el mouse o el dedo también elige.
  const { p, pedidos } = await abrir({ guion: { dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), mail: "no", planilla: "agregada" }) } });
  await clic(p, '[data-action="bj-invitar-abrir"]');
  await p.fill('[data-bj="f.nombre"]', "Elena Ríos"); await p.fill('[data-bj="f.correo"]', "elena@example.org"); await p.waitForTimeout(450);
  await p.click("#bjComunidad"); await p.keyboard.type("mendoza"); await p.waitForTimeout(200);
  await clic(p, '.bj-combo .autocomplete-option[data-idx="0"]', 300);
  eq("tocar una opción la elige", [await p.inputValue("#bjComunidad"), await p.$$eval(".bj-combo .autocomplete-option", l => l.length)], ["Mendoza", 0]);
  await clic(p, '[data-action="bj-invitar"]', 600);
  eq("y a la función le llega esa", pedidos.filter(x => x.accion === "dar").map(x => x.persona.comunidad), ["Mendoza"]);
  await p.close();
}

/* ---------- Invitar ---------- */
{
  const { p, pedidos } = await abrir({ guion: { dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), mail: "enviado", planilla: "agregada" }) } });
  await clic(p, '[data-action="bj-invitar-abrir"]');
  eq("el formulario: persona, carpetas y mail; el paquete de siempre ya elegido con sus carpetas", [await textos(p, ".bj-form h3"), await textos(p, ".bj-campos legend"), await p.$$eval(".bj-lista-c input:checked", l => l.length), await p.$$eval(".bj-radio.active", l => l.map(e => e.innerText.replace(/\s+/g, " ")))],
     [["Invitar personas"], ["Persona", "Carpetas"], 2, ["Todo Brújula 2 carpetas"]]);
  eq("sin nombre ni correo no se puede invitar", await p.$eval('[data-action="bj-invitar"]', e => e.disabled), true);
  await p.fill('[data-bj="f.nombre"]', "Elena Ríos");
  await p.fill('[data-bj="f.correo"]', "Elena@Example.org");
  await p.waitForTimeout(500);
  await clic(p, '[data-action="bj-idioma"][data-key="he"]');
  await p.fill('[data-bj="f.comunidad"]', "Chile");
  await p.waitForTimeout(500);
  eq("lo escrito no se pierde al cambiar el idioma", [await p.inputValue('[data-bj="f.nombre"]'), await p.inputValue('[data-bj="f.correo"]'), await p.inputValue('[data-bj="f.comunidad"]')], ["Elena Ríos", "Elena@Example.org", "Chile"]);
  eq("el resumen dice cuántas carpetas y si va mail", await textos(p, ".bj-fin .bj-mail"), ["2 carpetas · con mail"]);
  await clic(p, '[data-action="bj-mail"]');
  eq("el mail se puede apagar", await textos(p, ".bj-fin .bj-mail"), ["2 carpetas · sin mail"]);
  await clic(p, '[data-action="bj-mail"]');
  await p.uncheck(`[data-action="bj-carpeta-marcar"][data-id="${C2}"]`); await p.waitForTimeout(250);
  eq("sacar una carpeta pasa el paquete a «A medida»", await p.$$eval(".bj-radio.active", l => l.map(e => e.innerText.replace(/\s+/g, " "))), ["A medida Elegir carpetas"]);
  await p.check(`[data-action="bj-carpeta-marcar"][data-id="${C2}"]`); await p.waitForTimeout(250);
  await clic(p, '[data-action="bj-invitar"]', 600);
  const d = pedidos.filter(x => x.accion === "dar");
  eq("se le pide a la función: la persona normalizada, las carpetas en orden, el mail, y la planilla que corresponde a esas carpetas",
     d.map(x => [x.persona, x.carpetas, x.mail, x.planilla]),
     [[{ correo: "elena@example.org", nombre: "Elena Ríos", idioma: "he", comunidad: "Chile" }, [C1, C2], true, PL1]]);
  eq("muestra «Listo» con el mail", [await textos(p, ".bj-form h3"), await textos(p, ".bj-res .bj-mail")], [["Listo"], ["Mail enviado"]]);
  eq("queda anotado en el registro de actividad", (await tabla(p, "audit_log")).filter(x => x.type === "brujula_dio").map(x => [x.target_email, x.detail]), [["elena@example.org", "Brújula Cloud, CARE"]]);
  await p.close();
}
{
  // Solo CARE → la planilla de CARE; una lista pegada → una invitación por línea.
  const { p, pedidos } = await abrir({ guion: { dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: id !== C2 || c.persona.correo !== "malo@example.org", error: "rechazado" })), mail: "no", planilla: "no" }) } });
  await clic(p, '[data-action="bj-invitar-abrir"]');
  await clic(p, '[data-action="bj-modo"][data-key="lista"]');
  await p.fill('[data-bj="f.lista"]', "Ana Pérez, ana@example.org\nmalo@example.org\nesto no es un correo\nLuis Sosa <luis@example.org>");
  await p.waitForTimeout(500);
  await p.uncheck(`[data-action="bj-carpeta-marcar"][data-id="${C1}"]`); await p.waitForTimeout(250);
  await clic(p, '[data-action="bj-invitar"]', 700);
  await hastaQue(p, async () => (await textos(p, ".bj-form h3"))[0] === "Listo en 2 de 3");
  const d = pedidos.filter(x => x.accion === "dar");
  eq("una lista pegada: una invitación por cada línea con un correo (las demás se ignoran), con su nombre si lo trae",
     d.map(x => [x.persona.correo, x.persona.nombre]), [["ana@example.org", "Ana Pérez"], ["malo@example.org", ""], ["luis@example.org", "Luis Sosa"]]);
  eq("solo CARE: la planilla de CARE (la más específica que las tiene a todas marcadas)", [...new Set(d.map(x => x.planilla))], [PL2]);
  eq("si a alguien no se le pudo dar, se dice cuál y por qué, en una frase", await textos(p, ".bj-res-l .mal"), ["! CARE Google no dejó compartir con ese correo."]);
  eq("«Listo en 2 de 3»", await textos(p, ".bj-form h3"), ["Listo en 2 de 3"]);
  await p.close();
}

/* ---------- Los pendientes de la planilla ---------- */
{
  const { p, pedidos } = await abrir({ guion: { dar: c => ({ carpetas: c.carpetas.map(id => ({ id, ok: true })), mail: "enviado", planilla: "actualizada" }) } });
  await clic(p, '[data-action="bj-filtro"][data-key="pend"]');
  await clic(p, '[data-action="bj-dar-pendientes"]');
  eq("dar acceso a los pendientes pide confirmar, con cuántas personas y qué paquete", (await textos(p, "#confirmMessage")).join(" ").includes("2 personas (Todo Brújula)"), true);
  await confirmar(p);
  const d = pedidos.filter(x => x.accion === "dar");
  eq("se les da el paquete de siempre, con mail, y se le pasa a la función la fila de la planilla para marcarla «Enviado»",
     d.map(x => [x.persona.correo, x.carpetas, x.mail, x.planilla, x.fila]), [["hannah@example.org", [C1, C2], true, PL1, 3], ["joaquin@example.org", [C1, C2], true, PL1, 4]]);
  await p.close();
}

/* ---------- El catálogo de carpetas ---------- */
{
  const guion = {
    comprobar: c => /nueva/.test(c.link) ? { caso: "ok", id: "CarpetaCuatroQrStUv", nombre: "Material 2027" } : /atajo/.test(c.link) ? { caso: "atajo", destino: { id: "DestinoRealAbCdEfG", nombre: "Hadraja · Enseñanza" } }
      : /sinperm/.test(c.link) ? { caso: "sinpermiso" } : { caso: "nocarpeta" },
  };
  const { p, pedidos } = await abrir({ guion });
  await clic(p, '[data-action="bj-tab"][data-key="carpetas"]');
  eq("las carpetas, en su orden, con cuántas personas y la desactivada marcada", await textos(p, ".bj-carp .bj-carp-t").then(l => l.slice(0, 3)), ["Brújula Cloud 4 personas", "CARE 1 personas", "Archivo 2025 0 personas"]);
  eq("una etiqueta solo donde algo pide atención (la desactivada y la que Toldot no ve)", await p.$$eval(".bj-carp .bj-tag", l => l.map(e => e.innerText)), ["Desactivada"]);
  eq("los paquetes con sus carpetas y las planillas con sus pendientes", [await textos(p, ".bj-paq"), await textos(p, ".bj-seccion .bj-carp-t").then(l => l.slice(-2))], [["Todo Brújula Editar Brújula Cloud CARE"], ["Users grande 3 filas · 2 pendientes", "Users CARE 0 filas · 0 pendientes"]]);

  // Agregar por link
  await p.fill("#bjLinkCarpeta", "https://drive.google.com/drive/folders/nueva");
  await clic(p, '[data-action="bj-carpeta-nueva"]', 800);
  eq("agregar por link: comprueba con la función y muestra lo encontrado", [pedidos.filter(x => x.accion === "comprobar").map(x => x.link), await textos(p, ".bj-ok"), await p.inputValue('[data-bj="f.nombre"]')], [["https://drive.google.com/drive/folders/nueva"], ["✓ Carpeta encontrada"], "Material 2027"]);
  eq("…y avisa lo único que no es obvio, en una línea", await textos(p, ".bj-nota"), ["El Script de los lunes no da esta carpeta. Toldot sí."]);
  await p.fill('[data-bj="f.nombre"]', "Material del año");
  await p.check(`[data-action="bj-marca-paquete"][data-id="paq-todo"]`);
  await p.check(`[data-action="bj-marca-planilla"][data-id="${PL2}"]`);
  await clic(p, '[data-action="bj-carpeta-guardar"]', 800);
  const nueva = (await tabla(p, "brujula_carpetas")).find(c => c.id === "CarpetaCuatroQrStUv");
  eq("queda en el catálogo con su ID de Drive (el del link), el nombre elegido, al final y activa", [nueva.nombre, nueva.nombre_drive, nueva.orden, nueva.activa, nueva.planillas], ["Material del año", "Material 2027", 4, true, [PL2]]);
  eq("…y en el paquete", (await tabla(p, "brujula_paquete_carpetas")).filter(x => x.carpeta === "CarpetaCuatroQrStUv").map(x => x.paquete), ["paq-todo"]);
  eq("…y aparece en la lista", (await textos(p, ".bj-carp .bj-carp-n")).includes("Material del año"), true);

  // Los otros casos del link
  for(const [link, texto] of [["sinperm", "Toldot no puede ver esa carpeta. Compartila como Editor con la cuenta de Toldot y volvé a comprobar."], ["otracosa", "Ese link no es de una carpeta."]]){
    await p.fill("#bjLinkCarpeta", "https://drive.google.com/" + link);
    await clic(p, '[data-action="bj-carpeta-nueva"]', 800);
    eq(`link «${link}»: lo dice en una frase y no deja agregar`, [await textos(p, ".bj-aviso"), await p.$eval('[data-action="bj-carpeta-guardar"]', e => e.disabled)], [[texto], true]);
    await clic(p, '[data-action="bj-volver"]');
    await clic(p, '[data-action="bj-tab"][data-key="carpetas"]');
  }
  await p.fill("#bjLinkCarpeta", "https://drive.google.com/atajo");
  await clic(p, '[data-action="bj-carpeta-nueva"]', 800);
  eq("un acceso directo propone la carpeta de verdad", await textos(p, ".bj-aviso"), ["Es un acceso directo a «Hadraja · Enseñanza». Usar esa carpeta"]);
  await clic(p, '[data-action="bj-usar-destino"]');
  eq("…y al usarla se puede agregar con su nombre", [await textos(p, ".bj-ok"), await p.inputValue('[data-bj="f.nombre"]')], [["✓ Carpeta encontrada"], "Hadraja · Enseñanza"]);
  await clic(p, '[data-action="bj-volver"]');

  // Editar, desactivar, ordenar, dejar de gestionar
  await clic(p, '[data-action="bj-tab"][data-key="carpetas"]');
  await clic(p, `[data-action="bj-carpeta-editar"][data-id="${C2}"]`);
  await p.fill('[data-bj="f.nombre"]', "CARE (programa)");
  await clic(p, '[data-action="bj-activa"]');
  await clic(p, '[data-action="bj-carpeta-cambiar"]', 700);
  const care = (await tabla(p, "brujula_carpetas")).find(c => c.id === C2);
  eq("editar: nombre propio y desactivada (el de Drive no se toca)", [care.nombre, care.nombre_drive, care.activa], ["CARE (programa)", "CARE", false]);
  eq("una carpeta desactivada ya no es una columna de la cuadrícula ni se ofrece al invitar", await p.$$eval(".bj-tab", l => l.map(e => e.innerText)), ["Personas · 6", "Carpetas · 2"]);
  await clic(p, `[data-action="bj-mover"][data-id="${C1}"][data-d="1"]`, 700);
  eq("ordenar: bajar una carpeta cambia el orden guardado", (await tabla(p, "brujula_carpetas")).sort((a, c) => a.orden - c.orden).map(c => c.id).slice(0, 2), [C2, C1]);
  await clic(p, `[data-action="bj-carpeta-editar"][data-id="${C3}"]`);
  eq("sacar a todos: el botón espera el nombre exacto de la carpeta", await p.$eval("#bjSacarTodos", e => e.disabled), true);
  await p.fill("#bjConfirmar", "Archivo");
  eq("…con el nombre a medias sigue apagado", await p.$eval("#bjSacarTodos", e => e.disabled), true);
  await p.fill("#bjConfirmar", "Archivo 2025");
  eq("…con el nombre completo se prende", await p.$eval("#bjSacarTodos", e => e.disabled), false);
  await clic(p, '[data-action="bj-carpeta-borrar"]');
  await confirmar(p);
  eq("dejar de gestionar: sale del catálogo (y de los paquetes)", [(await tabla(p, "brujula_carpetas")).some(c => c.id === C3), (await textos(p, ".bj-carp .bj-carp-n")).includes("Archivo 2025")], [false, false]);

  // Paquetes y planillas
  await clic(p, '[data-action="bj-paquete-nuevo"]');
  await p.fill('[data-bj="f.nombre"]', "Solo CARE");
  await p.check(`[data-action="bj-carpeta-marcar"][data-id="${C2}"]`); await p.waitForTimeout(200);
  await clic(p, '[data-action="bj-paquete-guardar"]', 700);
  const paq = (await tabla(p, "brujula_paquetes")).find(x => x.nombre === "Solo CARE");
  eq("un paquete nuevo con sus carpetas", [!!paq, (await tabla(p, "brujula_paquete_carpetas")).filter(x => paq && x.paquete === paq.id).map(x => x.carpeta)], [true, [C2]]);
  await p.close();
}

/* ---------- El aviso por correo a los admin (Administración › Correos) ---------- */
{
  const { p } = await abrir();
  await admin(p, "preferencias", "correos"); await p.waitForTimeout(400);
  const estado = () => p.$$eval(".correos-brujula [role=radio][aria-checked=true]", l => l.map(e => e.innerText));
  eq("el aviso de Brújula viene apagado", [await textos(p, ".correos-brujula .setting-label"), await estado()], [["📁 Brújula: personas esperando acceso"], ["Apagado"]]);
  await clic(p, '[data-action="brujula-aviso"][data-key="on"]');
  eq("se prende y queda guardado en la configuración de correos (lo lee supabase/avisos/brujula.mjs)",
     [await estado(), ((await tabla(p, "app_config")).find(c => c.key === "preferences") || { value: {} }).value.correos.brujula], [["Prendido"], { on: true }]);
  await clic(p, '[data-action="brujula-aviso"][data-key="off"]');
  eq("y se vuelve a apagar", [await estado(), ((await tabla(p, "app_config")).find(c => c.key === "preferences")).value.correos.brujula], [["Apagado"], { on: false }]);
  await p.close();
}

/* ---------- Cuando algo falla ---------- */
{
  const { p } = await abrir({ estado: 503 });
  eq("sin la llave de Google: lo dice en una frase, con «Reintentar», y las carpetas siguen siendo editables", [await textos(p, ".bj-aviso"), await p.$$eval('[data-action="bj-tab"]', l => l.length)], [["Todavía no está conectado Google. Reintentar"], 2]);
  await p.close();
}
{
  const { p } = await abrir({ guion: { comprobar: () => ({ estado: 502, cuerpo: { error: "google" } }) } });
  await clic(p, '[data-action="bj-tab"][data-key="carpetas"]');
  await p.fill("#bjLinkCarpeta", "https://drive.google.com/drive/folders/x");
  await clic(p, '[data-action="bj-carpeta-nueva"]', 800);
  eq("si Google no contesta al comprobar, se dice y no se deja agregar", [(await textos(p, ".bj-aviso"))[0].startsWith("No se pudo leer Drive."), await p.$eval('[data-action="bj-carpeta-guardar"]', e => e.disabled)], [true, true]);
  await p.close();
}

/* ---------- Todos los idiomas y el celular ---------- */
for(const [lang, titulo] of [["en", "Invite people"], ["pt", "Convidar pessoas"], ["he", "הזמנת אנשים"]]){
  const { p, errores } = await abrir({ lang });
  eq(`${lang}: el botón de invitar en su idioma`, await textos(p, ".admin-cab-acc .bj-btn"), ["+ " + titulo]);
  eq(`${lang}: nada se sale de la pantalla`, await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  eq(`${lang}: sin errores en la consola`, errores, []);
  await p.close();
}
{
  const { p } = await abrir({ lang: "he" });
  eq("hebreo: la pantalla va de derecha a izquierda", await p.evaluate(() => getComputedStyle(document.querySelector(".bj")).direction), "rtl");
  await p.close();
}
{
  const { p, errores } = await abrir({ viewport: { width: 390, height: 844 } });
  eq("celular: no hay scroll de costado en la pantalla", await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  eq("celular: la cuadrícula se vuelve puntos (una fila por persona, sin columnas)", [await p.$$eval(".bj-celdas", l => l.every(e => getComputedStyle(e).display === "none")), await p.$$eval(".bj-puntos", l => l.every(e => getComputedStyle(e).display === "flex"))], [true, true]);
  const chicos = await p.$$eval(".bj button, .bj input[type=checkbox], .bj-btn, .bj-tab, .bj-fchip", l => l.filter(e => e.offsetParent && !e.disabled).map(e => { const r = e.getBoundingClientRect(); return [e.className || e.tagName, Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 24 || h < 24));
  eq("celular: nada que se toque mide menos de 24 px (lo principal, 44)", chicos, []);
  eq("celular: sin errores en la consola", errores, []);
  await p.close();
}
{
  // Alguien que no es admin no ve la sección ni puede llamarla.
  const { p } = await entrar(b, PERS[1].email, PERS[1].name, { base: base() });
  eq("un integrante común no tiene Administración ni Brújula", [await p.$$eval('[data-action="goto-view"][data-view="admin"], .admin-menu', l => l.length)], [0]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
