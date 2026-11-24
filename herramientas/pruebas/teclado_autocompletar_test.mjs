/* ======================================================================
   El teclado en los campos que autocompletan (24/11/2026)

   La medición de cobertura mostró que lo más grande sin ninguna prueba era
   el teclado de los buscadores: ↑ ↓ (con vuelta al llegar al borde), Enter y
   Tab para elegir, Escape para cerrar, y los Enter que «aprietan el botón»
   de un formulario (apodo, alta por adelantado, tipos y documentos). Todo
   eso vive en un solo manejador de teclado (`handleAutocompleteKeydown` y la
   cadena de `keydown` del documento); si una rama se rompe, a quien usa
   teclado se le traba el campo y ninguna otra prueba lo nota (los clicks
   siguen andando).

   Se prueba con la app de verdad y el Supabase de mentira
   (app_de_mentira.mjs); la dirección exacta (Nominatim, afuera) se simula.
   ====================================================================== */
import { abrirNavegador, entrar, tab, admin, irAdmin, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, extra) => eq(n + (c ? "" : "  " + (extra || "")), !!c, true);

// La lista desplegada: cuántas opciones, cuál está resaltada y qué dice cada una.
const lista = (p, raiz = ".autocomplete-list") => p.$$eval(`${raiz} .autocomplete-option`, l => ({
  n: l.length, activo: l.findIndex(e => e.classList.contains("active")),
  textos: l.map(e => e.innerText.trim().replace(/\s+/g, " ")) }));
const cerrada = async (p, raiz) => (await lista(p, raiz)).n === 0;
const confirmAbierto = p => p.$eval("#confirmOverlay", e => !e.hidden && getComputedStyle(e).display !== "none");
const foco = p => p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.className));
const tipear = async (p, sel, texto) => { await p.click(sel); await p.keyboard.type(texto); await p.waitForTimeout(250); };
const nueva = async (b, { ancho = 1280, ...resto } = {}) => entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 900 }, ...resto });

const b = await abrirNavegador();

// ---------- 1. «Dónde» del formulario de un evento (lugar) ----------
{
  const { p, errores } = await nueva(b);
  await p.click("#fabMain"); await p.click('[data-action="new-evento"]');
  await p.waitForSelector("#cPlaceQuery"); await p.waitForTimeout(250);
  const chips = () => p.$$eval('[data-action="rm-scope-post"]', l => l.length);
  eq("lugar: al empezar no hay lugares elegidos", await chips(), 0);

  await tipear(p, "#cPlaceQuery", "uru");
  let l = await lista(p);
  ok("lugar: escribir «uru» abre una lista de varias opciones", l.n >= 3, JSON.stringify(l));
  eq("lugar: la primera opción arranca resaltada", l.activo, 0);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("lugar: ↓ baja el resaltado a la segunda", (await lista(p)).activo, 1);
  await p.keyboard.press("ArrowUp"); await p.keyboard.press("ArrowUp"); await p.waitForTimeout(120);
  l = await lista(p);
  eq("lugar: ↑ desde la primera da la vuelta y va a la última", l.activo, l.n - 1);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("lugar: ↓ desde la última da la vuelta y va a la primera", (await lista(p)).activo, 0);
  eq("lugar: el foco sigue en el campo mientras se navega", await foco(p), "cPlaceQuery");

  // Enter elige la resaltada (la segunda), no la primera.
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  l = await lista(p);
  const elegida = l.textos[1].replace(/^\S+\s/, "").split(",")[0];
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("lugar: Enter suma un lugar", await chips(), 1);
  const texto = await p.$eval('[data-action="rm-scope-post"]', e => e.closest(".scope-chip").innerText);
  ok(`lugar: el lugar sumado es el resaltado («${elegida}»), no otro`, texto.includes(elegida), texto);
  eq("lugar: tras elegir, el campo queda vacío", await p.inputValue("#cPlaceQuery"), "");
  ok("lugar: tras elegir, la lista se cierra", await cerrada(p));

  // Tab también elige (y no se va el foco a otro campo).
  await tipear(p, "#cPlaceQuery", "chi");
  l = await lista(p);
  const primera = l.textos[0].replace(/^\S+\s/, "").split(",")[0];
  await p.keyboard.press("Tab"); await p.waitForTimeout(250);
  eq("lugar: Tab suma el resaltado", await chips(), 2);
  ok(`lugar: Tab sumó «${primera}»`, (await p.$$eval('[data-action="rm-scope-post"]', ls => ls.map(e => e.closest(".scope-chip").innerText).join("|"))).includes(primera));
  eq("lugar: Tab no sacó el foco del campo", await foco(p), "cPlaceQuery");

  // Escape vacía el campo y cierra la lista, sin cerrar el formulario.
  await tipear(p, "#cPlaceQuery", "par");
  ok("lugar: «par» abre la lista", (await lista(p)).n >= 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("lugar: Escape vacía el campo", await p.inputValue("#cPlaceQuery"), "");
  ok("lugar: Escape cierra la lista", await cerrada(p));
  ok("lugar: Escape no cierra el formulario", await p.$eval("#cPlaceQuery", e => !!e.offsetParent));
  eq("lugar: Escape no suma nada", await chips(), 2);

  // Sin coincidencias, Enter no hace nada (ni suma ni manda el formulario) y
  // Escape borra lo escrito (antes no hacía nada y no dejaba cerrar el formulario).
  await tipear(p, "#cPlaceQuery", "zzzqqq");
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("lugar: sin coincidencias, Enter no suma nada", await chips(), 2);
  ok("lugar: sin coincidencias, el formulario sigue abierto", await p.$eval("#cPlaceQuery", e => !!e.offsetParent));
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("lugar: sin coincidencias, Escape borra lo escrito", await p.inputValue("#cPlaceQuery"), "");
  eq("lugar: ese Escape no abrió el «¿Descartar?»", await confirmAbierto(p), false);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("lugar: con el campo vacío, el siguiente Escape sí pregunta si descartar", await confirmAbierto(p), true);
  eq("lugar: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 2. Menciones (@) y participantes, en el mismo formulario ----------
{
  const { p, errores } = await nueva(b);
  await p.click("#fabMain"); await p.click('[data-action="new-evento"]');
  await p.waitForSelector("#cContent"); await p.waitForTimeout(250);

  await tipear(p, "#cContent", "Hola @a");
  let l = await lista(p);
  eq("mención: «@a» ofrece «all» y «ana»", l.textos.map(t => t.replace(/^\S\s/, "").replace(/\s+/g, " ")).map(t => t.split(" ").pop()), ["@all", "@ana"]);
  eq("mención: la primera arranca resaltada", l.activo, 0);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("mención: ↓ baja a la segunda", (await lista(p)).activo, 1);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("mención: ↓ desde la última da la vuelta", (await lista(p)).activo, 0);
  await p.keyboard.press("ArrowUp"); await p.waitForTimeout(120);
  eq("mención: ↑ desde la primera va a la última", (await lista(p)).activo, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("mención: Enter pone la mención elegida (no un salto de línea)", await p.inputValue("#cContent"), "Hola @ana ");
  ok("mención: tras elegir, la lista se cierra", await cerrada(p));

  // Escape cierra la lista de menciones.
  await p.keyboard.type("y @mo"); await p.waitForTimeout(250);
  ok("mención: «@mo» abre la lista", (await lista(p)).n === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok("mención: Escape cierra la lista", await cerrada(p));
  ok("mención: Escape no cierra el formulario", await p.$eval("#cContent", e => !!e.offsetParent));

  // Sin coincidencias, Escape también cierra el aviso (y deja el texto).
  await p.keyboard.type(" @zzz"); await p.waitForTimeout(250);
  ok("mención: «@zzz» muestra «Sin coincidencias»", (await p.$$eval(".autocomplete-list .autocomplete-empty", l => l.length)) === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("mención: sin coincidencias, Escape cierra el aviso", await p.$$eval(".autocomplete-list", l => l.length), 0);
  eq("mención: sin coincidencias, Escape deja el texto", await p.inputValue("#cContent"), "Hola @ana y @mo @zzz");
  eq("mención: ese Escape no abrió el «¿Descartar?»", await confirmAbierto(p), false);

  // Participantes.
  await tipear(p, "#cParticipantQuery", "a");
  l = await lista(p);
  ok("participante: «a» abre una lista", l.n >= 2, JSON.stringify(l));
  const segundo = l.textos[1];
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("participante: ↓ baja a la segunda", (await lista(p)).activo, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("participante: Enter suma una persona", await p.$$eval('[data-action="rm-participant"]', ls => ls.length), 1);
  const quien = await p.$eval('[data-action="rm-participant"]', e => e.parentElement.innerText);
  ok(`participante: la persona sumada es la resaltada (${segundo.split(" ").slice(1, 2)})`, quien.toLowerCase().includes(segundo.split(" ")[1].toLowerCase()), quien);
  await tipear(p, "#cParticipantQuery", "m");
  ok("participante: «m» abre la lista", (await lista(p)).n >= 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("participante: Escape vacía el campo", await p.inputValue("#cParticipantQuery"), "");
  ok("participante: Escape cierra la lista", await cerrada(p));
  eq("participante: Escape no suma a nadie", await p.$$eval('[data-action="rm-participant"]', ls => ls.length), 1);
  await tipear(p, "#cParticipantQuery", "zzzqqq");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("participante: sin coincidencias, Escape también vacía el campo", await p.inputValue("#cParticipantQuery"), "");
  eq("menciones y participantes: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 3. «Dirección exacta» (Escape NO borra el texto) ----------
{
  const { p, errores } = await nueva(b);
  await p.route("https://nominatim.openstreetmap.org/**", r => r.fulfill({ contentType: "application/json",
    body: JSON.stringify([{ display_name: "Hotel Alvear, Buenos Aires" }, { display_name: "Hotel Plaza, Montevideo" }, { display_name: "Hotel Sol, Lima" }]) }));
  await p.click("#fabMain"); await p.click('[data-action="new-evento"]');
  await p.waitForSelector("#cPlaceQuery");
  await p.click('[data-action="composer-toggle-location"]'); await p.waitForSelector("#cLocation");
  await p.click("#cLocation"); await p.keyboard.type("Hotel"); await p.waitForTimeout(1000);
  let l = await lista(p);
  eq("dirección: «Hotel» muestra las tres sugerencias", l.n, 3);
  await p.keyboard.press("ArrowUp"); await p.waitForTimeout(120);
  eq("dirección: ↑ desde la primera da la vuelta", (await lista(p)).activo, 2);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("dirección: Escape NO borra lo escrito (es el dato que se guarda)", await p.inputValue("#cLocation"), "Hotel");
  eq("dirección: ese Escape no abre el «¿Descartar?» (solo cierra las sugerencias)", await confirmAbierto(p), false);
  eq("dirección: el foco se queda en el campo", await foco(p), "cLocation");
  ok("dirección: Escape cierra las sugerencias", await cerrada(p));
  ok("dirección: Escape no cierra el formulario", await p.$eval("#cLocation", e => !!e.offsetParent));
  await p.keyboard.type(" Pl"); await p.waitForTimeout(1000);
  ok("dirección: seguir escribiendo vuelve a buscar", (await lista(p)).n === 3);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("dirección: ↓ baja a la segunda", (await lista(p)).activo, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("dirección: Enter pone la sugerencia resaltada", await p.inputValue("#cLocation"), "Hotel Plaza, Montevideo");
  ok("dirección: tras elegir, se cierra la lista", await cerrada(p));
  eq("dirección: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 4. Rutina: lugar y mención del formulario de «Inicio» ----------
{
  const { p, errores } = await nueva(b);
  await p.click("#fabMain"); await p.click('[data-action="new-rutina"]');
  await p.waitForSelector("#rutinaPlaceQuery"); await p.waitForTimeout(250);
  await tipear(p, "#rutinaPlaceQuery", "mon");
  let l = await lista(p);
  ok("rutina: «mon» abre la lista de lugares", l.n >= 2, JSON.stringify(l));
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("rutina: ↓ baja a la segunda", (await lista(p)).activo, 1);
  const elegida = (await lista(p)).textos[1].replace(/^\S+\s/, "").split(",")[0];
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  const chips = await p.$$eval('[data-action="rm-scope-rutina"]', ls => ls.map(e => e.closest(".scope-chip").innerText));
  eq("rutina: Enter suma un lugar", chips.length, 1);
  ok(`rutina: sumó el resaltado («${elegida}»)`, (chips[0] || "").includes(elegida), JSON.stringify(chips));
  await tipear(p, "#rutinaContent", "Con @mo");
  eq("rutina: «@mo» ofrece a una persona", (await lista(p)).n, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("rutina: Enter pone la mención", await p.inputValue("#rutinaContent"), "Con @moshe ");
  await p.keyboard.type("y @ana"); await p.waitForTimeout(250);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok("rutina: Escape cierra la lista de menciones", await cerrada(p));
  ok("rutina: Escape no cierra el formulario", await p.$eval("#rutinaContent", e => !!e.offsetParent));
  eq("rutina: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 5. Respuesta a una actividad: lugar y mención ----------
{
  const { p, errores } = await nueva(b);
  const id = await p.$eval('[data-action="toggle-reply"]', e => e.dataset.postId);
  await p.click(`[data-action="toggle-reply"][data-post-id="${id}"]`);
  await p.waitForSelector(`#replyPlaceQuery-${id}`); await p.waitForTimeout(250);
  await tipear(p, `#replyPlaceQuery-${id}`, "mon");
  ok("respuesta: «mon» abre la lista de lugares", (await lista(p)).n >= 2);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  eq("respuesta: ↓ baja a la segunda", (await lista(p)).activo, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("respuesta: Enter suma un lugar", await p.$$eval('[data-action="rm-scope-reply"]', ls => ls.length), 1);
  await p.keyboard.type("par"); await p.waitForTimeout(250);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("respuesta: Escape vacía el lugar a medio escribir", await p.inputValue(`#replyPlaceQuery-${id}`), "");
  eq("respuesta: Escape no se lleva el lugar ya elegido", await p.$$eval('[data-action="rm-scope-reply"]', ls => ls.length), 1);
  const caja = await p.$eval(`[data-reply-field="content"][data-post-id="${id}"]`, e => e.id);
  await tipear(p, `#${caja}`, "Gracias @mo");
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("respuesta: Enter pone la mención en el texto", await p.inputValue(`#${caja}`), "Gracias @moshe ");
  eq("respuesta: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 6. Proyecto: sumar editor y responsable de un hito escribiendo ----------
{
  const { p, errores } = await nueva(b);
  await tab(p, "proyectos");
  await p.click('[data-action="project-open"][data-post-id="proj1"]'); await p.waitForTimeout(400);
  const ed = '[data-pp-key="ed:proj1"]';
  await p.waitForSelector(ed);
  const ppLista = () => lista(p, ".pp-list");
  await tipear(p, ed, "mo");
  eq("editor: «mo» ofrece a moshe", (await ppLista()).textos.map(t => t.split(" ")[0]), ["@moshe"]);
  await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  eq("editor: Enter suma al editor", await p.$$eval(".pj-editor-chip", ls => ls.map(e => e.innerText.trim().split("\n")[0])), ["@moshe"]);
  eq("editor: tras sumar, el campo queda vacío", await p.$eval(ed, e => e.value), "");
  await tipear(p, ed, "zzz");
  eq("editor: sin coincidencias lo dice", await p.$eval(".pp-list", e => e.innerText.trim()), "Sin coincidencias");
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("editor: Enter sin coincidencias no suma a nadie", await p.$$eval(".pj-editor-chip", ls => ls.length), 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("editor: Escape vacía el campo (aunque no haya coincidencias)", await p.$eval(ed, e => e.value), "");
  ok("editor: Escape cierra la lista", await p.$$eval(".pp-list", l => l.length) === 0);

  // Responsable de un hito: lo que se resalta es lo que Enter agrega (antes del
  // arreglo del 2026, Enter agregaba a otra persona porque el cálculo de
  // «a quién excluir» era distinto en pantalla y en el teclado).
  const own = '[data-pp-key="own:proj1:h2"]';
  const dueñosDe = () => p.$$eval('[data-action="ms-owner-remove"][data-ms-id="h2"]', ls => ls.map(e => e.dataset.email));
  const dueñosAntes = await dueñosDe();
  ok("responsable: el hito ya tiene un responsable (para probar que no se vuelve a ofrecer)", dueñosAntes.length >= 1);
  await tipear(p, own, "a");
  const l = await ppLista();
  ok("responsable: «a» ofrece varias personas", l.n >= 2, JSON.stringify(l));
  eq("responsable: no ofrece a quien ya es responsable del hito", l.textos.filter(t => dueñosAntes.some(e => t.startsWith("@" + e.split("@")[0]))), []);
  await p.keyboard.press("ArrowDown"); await p.waitForTimeout(120);
  const quien = await p.$eval(".pp-list .autocomplete-option.active", e => e.dataset.email);
  eq("responsable: ↓ resalta a la segunda", (await ppLista()).activo, 1);
  await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  eq("responsable: Enter agrega exactamente a la persona resaltada", await dueñosDe(), [...dueñosAntes, quien]);
  eq("proyecto: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 7. Apodo: Enter guarda, Escape cancela ----------
{
  const { p, errores } = await nueva(b);
  const abrirApodo = async () => {
    if(!(await p.$(".user-menu"))){ await p.click('[data-action="toggle-user-menu"]'); await p.waitForTimeout(200); }
    await p.click('[data-action="edit-nickname"]'); await p.waitForSelector("#nicknameInput"); await p.waitForTimeout(150);
  };
  await abrirApodo();
  await p.fill("#nicknameInput", "a b"); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  ok("apodo: con espacios, Enter no guarda: el campo sigue", !!(await p.$("#nicknameInput")));
  ok("apodo: con espacios, Enter explica el error", (await p.$$eval(".um-nickname-form .form-error", l => l.map(e => e.innerText)))[0]?.includes("Solo letras"));
  await p.fill("#nicknameInput", "bennyx"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  ok("apodo: Enter con uno válido cierra el campo", !(await p.$("#nicknameInput")));
  eq("apodo: se ve el nuevo", await p.$$eval(".um-nickname span", l => l.map(e => e.innerText)), ["@bennyx"]);
  eq("apodo: quedó guardado en la base", await p.evaluate(() => (window.__sb.tablas.members || []).find(m => m.email === "benny@team-latam.com").nickname), "bennyx");
  await abrirApodo();
  await p.fill("#nicknameInput", "otroapodo"); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok("apodo: Escape cierra el campo", !(await p.$("#nicknameInput")));
  eq("apodo: Escape no guarda lo escrito", await p.evaluate(() => (window.__sb.tablas.members || []).find(m => m.email === "benny@team-latam.com").nickname), "bennyx");
  eq("apodo: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 8. Administración: Enter en «Dar acceso por adelantado» ----------
{
  const { p, errores } = await nueva(b);
  await irAdmin(p); await admin(p, "solicitudes", "usuarios"); await p.waitForTimeout(300);
  await p.click('[data-action="acceso-section"][data-key="pendientes"]'); await p.waitForSelector("#preEmail");
  const hay = () => p.evaluate(() => (window.__sb.tablas.members || []).some(m => m.email === "nuevo.integrante@example.org"));
  await p.fill("#preEmail", "esto no es un correo"); await p.focus("#preEmail"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  ok("acceso por adelantado: un correo inválido + Enter lo rechaza", (await p.$eval("#viewRoot", e => e.innerText)).includes("Escribí un correo válido."));
  eq("acceso por adelantado: no se agregó a nadie", await hay(), false);
  await p.fill("#preEmail", "nuevo.integrante@example.org"); await p.fill("#preName", "Nuevo Integrante");
  await p.focus("#preName"); await p.keyboard.press("Enter"); await p.waitForTimeout(700);
  eq("acceso por adelantado: Enter desde el campo de nombre da el acceso", await hay(), true);
  ok("acceso por adelantado: avisa que ya tiene acceso", (await p.$eval("#viewRoot", e => e.innerText)).includes("ya tiene acceso"));
  eq("acceso por adelantado: sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 9. Administración › Tipos: Enter crea el tipo y suma el documento ----------
{
  const { p, errores } = await nueva(b);
  await irAdmin(p); await admin(p, "preferencias", "tipos"); await p.waitForTimeout(400);
  const filas = () => p.$$eval('[data-action="tipo-abrir"]', l => l.length);
  const antes = await filas();
  await p.click('[data-action="tipo-nuevo"]'); await p.waitForSelector("#tiposNewLabel");
  await p.fill("#tiposNewLabel", "Taller de prueba"); await p.focus("#tiposNewLabel"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  eq("tipos: Enter en el nombre crea el tipo", await filas(), antes + 1);
  ok("tipos: el tipo nuevo figura con su nombre", (await p.$eval("#viewRoot", e => e.innerText)).includes("Taller de prueba"));

  await p.click('[data-action="tipo-abrir"]'); await p.waitForSelector('[data-action="tipo-doc-nuevo"]'); await p.waitForTimeout(250);
  const docs = () => p.$$eval(".doc-fila .doc-nombre", l => l.map(e => e.innerText.trim()));
  const docsAntes = await docs();
  await p.fill('[data-action="tipo-doc-nuevo"]', "Plan de prueba"); await p.focus('[data-action="tipo-doc-nuevo"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(450);
  eq("tipos: Enter en «Nombre del documento» lo suma", await docs(), [...docsAntes, "Plan de prueba"]);
  eq("tipos: tras sumar el documento, el campo queda vacío", await p.$eval('[data-action="tipo-doc-nuevo"]', e => e.value), "");
  eq("tipos: sin errores en la consola", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
