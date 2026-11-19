/* ======================================================================
   Gastos y rendiciones (15/11/2026; 27-gastos.sql y docs/rendicion-gastos/)

   - Quién lo ve: desde el 19/11 dejó de ser una prueba: está en el menú de
     arriba, entre Proyectos y Reportes (en el celular, en «Más»), en el + y
     en el ⋯ de cada actividad, para todos los que cargan. Un observador, una
     integrante con el módulo cerrado al equipo o cualquiera con el módulo
     apagado no lo ven ni lo leen de la base.
   - Subir: muchos comprobantes juntos; cada uno queda como un gasto por
     confirmar, con la fecha y el concepto sacados del nombre del archivo,
     su huella (el mismo comprobante dos veces no se repite) y el archivo en
     gastos/<id>/, con su miniatura si es una foto.
   - Revisar: la ventana pide lo que falta para confirmar, marca los campos,
     ata el gasto a una actividad o abre la rendición del mes.
   - La rendición: no se manda con gastos por confirmar; mandada, un admin
     la observa (con comentario) o la aprueba entera. El total rápido avisa
     si no coincide con el detalle.
   - La cuenta corriente: la misma cuenta que gastos_cuenta (27-gastos.sql).
   - Administración → Gastos: el interruptor y los tipos.
   - Teclado, los cuatro idiomas y el celular.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, irAdmin, admin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const ANA = PERS[1];
const OBS = "obs@team-latam.com";
const datos = (gastos, extra = {}) => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  const pref = base.app_config.find(c => c.key === "preferences");
  if(gastos === null){ const { gastos: _, ...resto } = pref.value; pref.value = resto; }
  else if(gastos !== undefined) pref.value = { ...pref.value, gastos };
  return Object.assign(base, extra);
};
const tabla = (p, n) => p.evaluate(n => window.__sb.tablas[n] || [], n);
const hasta = async (p, f, ...a) => { for(let i = 0; i < 50; i++){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const abrirMenu = async p => { await p.click('[data-action="toggle-user-menu"]'); await p.waitForSelector(".user-menu"); };
// Gastos, en el menú de arriba, entre Proyectos y Reportes (19/11).
// (En el celular, en «Más», entre Proyectos y Reportes.)
const irGastos = async p => {
  if(await p.evaluate(() => { const b = document.querySelector('#tabs button[data-view="gastos"]'); return !!(b && b.offsetParent); })) await p.click('#tabs button[data-view="gastos"]');
  else { await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150); await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); }
  await p.waitForSelector(".gastos-view"); await p.waitForTimeout(150);
};
const pestanas = p => p.$$eval("#tabs button[data-view]", l => l.filter(b => !b.hidden && b.offsetParent).map(b => b.dataset.view));   // las que se ven de verdad
const textos = (p, sel) => p.$$eval(sel, l => l.map(e => e.textContent.replace(/\s+/g, " ").trim()));
const rpcs = (p, nombre) => p.evaluate(n => window.__sb.rpc.filter(r => r[0] === n).map(r => r[1]), nombre);
const leyoGastos = p => p.evaluate(() => (window.__sb.consultas || []).some(t => String(t).startsWith("gastos")));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const elegir = async (p, sel, files) => {
  const [ch] = await Promise.all([p.waitForEvent("filechooser"), p.click(sel)]);
  await ch.setFiles(files);
};
const aceptar = async p => { await p.waitForSelector("#confirmOverlay:not([hidden])"); await p.click("#confirmOk"); };
// Sin cortar la prueba si lo que se busca no está: la comprobación que sigue anota la falla.
const tocar = (p, sel) => p.click(sel, { timeout: 3000 }).then(() => true, () => false);
const leer = (p, sel, f) => p.$eval(sel, f).catch(() => null);
// La lista agrupada (18/11): la tarjeta despliega la rendición y «Abrir la rendición →» la abre. En «Para aprobar» y
// «Sin vincular», la tarjeta la abre directo.
const abrirRen = async (p, id) => {
  const hay = sel => p.evaluate(s => !!document.querySelector(s), sel);
  const directo = `[data-action="gastos-abrir-rendicion"][data-id="${id}"]`, grupo = `[data-action="gastos-grupo"][data-id="${id}"]`;
  // Desde el 19/11 (D16): en «Por rendir» las que están en manos de la persona; las demás, en «Rendiciones».
  if(!(await hay(directo)) && !(await hay(grupo)) && await hay('[data-action="gastos-seccion"][data-key="rendiciones"]')){
    await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendiciones"]').click()); await p.waitForTimeout(150); }
  if(!(await hay(directo)) && await hay(grupo)){ await p.evaluate(s => document.querySelector(s).click(), grupo); await p.waitForTimeout(100); }
  await p.click(directo, { timeout: 3000 }).catch(() => {});
};
// «Rendiciones» (la lista agrupada, D16).
const irRendiciones = async p => { await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendiciones"]').click()); await p.waitForTimeout(150); };
const elegirSiHay = async (p, sel, files) => {
  if(!(await p.$(sel))) return false;
  const [ch] = await Promise.all([p.waitForEvent("filechooser", { timeout: 3000 }), p.click(sel, { timeout: 3000 })]).catch(() => []);
  if(ch) await ch.setFiles(files);
  return !!ch;
};
// «Subir comprobantes» pregunta antes de qué son (vinculo: "" = todavía no sé, "post:<id>", "mes:AAAA-MM").
async function subirDesdeCabecera(p, vinculo, files){
  if(!(await p.$('[data-action="gastos-destino-abrir"]'))){
    if(await p.$('[data-action="gastos-volver"]')) await p.click('[data-action="gastos-volver"]');
    else await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendir"]').click());
    await p.waitForTimeout(150);
  }
  await p.click('[data-action="gastos-destino-abrir"]');
  await p.selectOption("#gxDestino", vinculo);
  await elegir(p, '[data-action="gastos-destino-elegir"]', files);
}

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 }, celu = { width: 390, height: 844 };

/* ---------------- Quién lo ve ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  // 19/11: dejó de ser una prueba: en el menú de arriba, entre Proyectos y Reportes, y no en el de la foto.
  eq("el admin lo tiene en el menú de arriba, entre Proyectos y Reportes", await pestanas(p), ["feed", "calendario", "paises", "proyectos", "gastos", "reportes"]);
  eq("…con lo que espera su revisión (una rendición mandada y plata por confirmar)", await textos(p, '#tabs button[data-view="gastos"]'), ["Gastos 2"]);
  await abrirMenu(p);
  eq("…y ya no en el menú de su foto", await p.$$eval('.user-menu [data-view="gastos"]', l => l.length), 0);
  eq("y lo lee de la base", await leyoGastos(p), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
for(const [quien, nombre, gastos, rotulo] of [[ANA.email, ANA.name, { prendido: true, abierto: false }, "una integrante, con el módulo cerrado al equipo"],
  [OBS, "Olga Observa", { prendido: true }, "un observador, aunque esté abierto al equipo"],
  [ADMIN, PERS[0].name, { prendido: false }, "el admin, con el módulo apagado"]]){
  const { p } = await entrar(b, quien, nombre, { viewport: vp, base: datos(gastos) });
  eq(`${rotulo}: no lo ve`, [(await pestanas(p)).includes("gastos"), await p.evaluate(() => !!document.querySelector('#fabGastos:not([hidden])'))], [false, false]);
  eq(`${rotulo}: ni lo pide a la base`, await leyoGastos(p), false);
  await p.close();
}
{
  // Desde el 19/11, abierto al equipo de fábrica (si nunca se tocó la configuración): lo ve quien puede cargar.
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos(null) });
  eq("abierto al equipo de fábrica: una integrante lo ve en el menú de arriba", (await pestanas(p)).includes("gastos"), true);
  await irGastos(p);
  eq("…sin «en prueba»", await p.$eval(".gastos-view .admin-titulo", e => e.textContent.trim()), "🧾 Gastos");
  eq("«Por rendir», «Rendiciones», su cuenta y sus estadísticas; no «Para aprobar» (es de los admins)", await p.$$eval('.admin-menu [data-action="gastos-seccion"]', l => l.map(e => e.dataset.key)), ["rendir", "rendiciones", "cuenta", "estadisticas"]);
  // D16 (19/11): «Por rendir» es lo que tiene que hacer; lo ya mandado está en «Rendiciones».
  eq("en «Por rendir», nada por hacer (la suya ya se mandó) y el camino a «Rendiciones»", await p.evaluate(() => [/No tenés nada por rendir/.test(document.querySelector(".gastos-view .admin-body").textContent),
    !!document.querySelector('.gx-a-rendiciones [data-action="gastos-seccion"][data-key="rendiciones"]'), !!document.querySelector(".gx-grupos")]), [true, true, false]);
  await irRendiciones(p);
  eq("en «Rendiciones», solo las suyas", await textos(p, '.gx-tarjeta b'), ["Visita a la comunidad de Rosario"]);
  eq("…con una sola, sin filtros ni resumen (X11: sobraban para quien empieza)", await p.evaluate(() => [!!document.getElementById("gxHDesde"), !!document.querySelector(".gx-hresumen")]), [false, false]);
  await p.click('[data-action="gastos-grupo"][data-id="ren_ana"]');
  eq("desplegada, sus gastos con casillas; ya mandada, la barra baja en Excel pero no tiene «Borrar»", await p.evaluate(() => [document.querySelectorAll(".gx-g-cuerpo [data-gsel]").length,
    [...document.querySelectorAll(".gx-selpie button")].map(b => b.dataset.action)]), [2, ["gastos-sel-excel"]]);
  await p.close();
}
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.click('.bn-item[data-action="toggle-more-menu"]'); await p.waitForTimeout(150);
  eq("en el celular está en «Más»", await p.$$eval('.bn-sheet-item[data-view="gastos"]', l => l.length), 1);
  await p.click('.bn-sheet-item[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  eq("y abre la pantalla de gastos en «Por rendir» (D16, 19/11)", await p.$eval(".gastos-view .admin-h2", e => e.textContent.trim()), "Por rendir");
  eq("en el celular, la página no se corre de costado", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  eq("sin errores de página en el celular", errores, []);
  await p.close();
}

/* ---------------- Mis rendiciones, subir, revisar, mandar ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  eq("«Por rendir»: sin vincular arriba y lo que tiene para completar y mandar (la rutina aprobada, no)", await textos(p, ".gx-tarjeta b"), ["Sin vincular", "Visita a Montevideo"]);
  eq("…y lo ya mandado, a un toque: «Rendiciones»", await p.evaluate(() => !!document.querySelector('.gx-a-rendiciones [data-key="rendiciones"]')), true);
  eq("cada una dice qué falta y cuánto suma", await textos(p, '[data-id="ren_mvd"] .gx-aviso, [data-id="ren_mvd"] .gx-t-total'), ["1 por confirmar", "USD 345.50"]);

  // Subir dos juntos: una foto con la fecha y el concepto en el nombre, y un PDF.
  const antes = (await tabla(p, "gastos")).length;
  await subirDesdeCabecera(p, "", [
    { name: "15-11-2026 - Taxi al aeropuerto - Visita a Lima.png", mimeType: "image/png", buffer: PNG },
    { name: "factura.pdf", mimeType: "application/pdf", buffer: PDF }]);
  eq("subir dos: quedan dos gastos nuevos, con su comprobante", await hasta(p, n => (window.__sb.tablas.gastos || []).filter(g => g.archivo).length === n + 2, antes), true);
  const nuevos = (await tabla(p, "gastos")).slice(antes);
  const foto = nuevos.find(g => /\.jpg$/.test(g.archivo || "")), pdf = nuevos.find(g => /\.pdf$/.test(g.archivo || ""));
  eq("la foto: por confirmar, sin vincular, a nombre de quien la subió, con la fecha y el concepto del nombre del archivo",
    foto && [foto.autor, foto.estado, foto.rendicion_id, foto.fecha, foto.concepto, foto.lectura && foto.lectura.fuente, foto.archivo_nombre],
    [ADMIN, "borrador", null, "2026-11-15", "Taxi al aeropuerto", "nombre", "15-11-2026 - Taxi al aeropuerto - Visita a Lima.png"]);
  eq("con su huella y en la carpeta de su gasto", foto && [/^[0-9a-f]{64}$/.test(foto.archivo_hash), new RegExp(`^gastos/${foto.id}/comprobante_\\d+\\.jpg$`).test(foto.archivo)], [true, true]);
  eq("el PDF va como PDF, sin fecha inventada", pdf && [pdf.archivo_tipo, pdf.fecha, pdf.concepto, new RegExp(`^gastos/${pdf.id}/comprobante_\\d+\\.pdf$`).test(pdf.archivo)], ["application/pdf", null, "", true]);
  const subidas = await p.evaluate(() => window.__sb.subidas);
  eq("al bucket: la foto en JPEG, su miniatura al lado y el PDF", [subidas.some(s => s[0] === foto.archivo && s[1] === "image/jpeg"),
    subidas.some(s => s[0] === foto.archivo.replace(/\.jpg$/, ".min.jpg")), subidas.some(s => s[0] === pdf.archivo && s[1] === "application/pdf")], [true, true, true]);
  eq("terminado, el cartel se va solo y un aviso pasajero dice cuántos subieron", await hasta(p, () => /Se subieron 2 comprobantes/.test(document.getElementById("calendarToastText").textContent)
    && !document.getElementById("calendarToast").hidden && !document.querySelector(".gx-subida")), true);

  // El mismo otra vez, y algo que no es ni foto ni PDF.
  await subirDesdeCabecera(p, "", [
    { name: "otra-vez.png", mimeType: "image/png", buffer: PNG }, { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") }]);
  await hasta(p, () => { const s = document.querySelector(".gx-subida"); return s && !/Subiendo/.test(s.textContent); });
  eq("el mismo comprobante no se repite, y lo que no es foto ni PDF se avisa", [(await tabla(p, "gastos")).length - antes,
    await p.$eval(".gx-subida", e => /Ya estaban cargados.*otra-vez\.png/.test(e.textContent) && /Uno no se pudo subir:/.test(e.textContent) && /notas\.txt: no es una foto ni un PDF/.test(e.textContent)).catch(() => false)], [2, true]);
  await p.click('[data-action="gastos-subida-cerrar"]');

  // Revisar la foto: la ventana pide lo que falta. Después de subir «todavía no sé», se ve dónde quedaron.
  eq("después de subir, se ve dónde quedaron: en «Sin vincular»", await leer(p, ".gx-cab .gx-ren-tit", e => e.textContent.includes("Sin vincular")), true);
  eq("«Sin vincular» lista los tres", await p.$$eval('.gx-fila[data-action="gasto-abrir"]', l => l.length), 3);
  await p.click(`[data-action="gasto-abrir"][data-id="${foto.id}"]`);
  await p.waitForSelector("#gastoOverlay:not([hidden]) #gxFecha");
  eq("la ventana: accesible, con el foco en el concepto (lo primero) y los datos sugeridos a la vista", await p.evaluate(() => [document.querySelector("#gastoOverlay .modal").getAttribute("role"),
    document.querySelector("#gastoOverlay .modal").getAttribute("aria-modal"), document.activeElement.id, document.getElementById("gxFecha").value, document.getElementById("gxConcepto").value,
    document.getElementById("gxFecha").dataset.sug]), ["dialog", "true", "gxConcepto", "2026-11-15", "Taxi al aeropuerto", "1"]);
  eq("sin cartel de lo que se completó (lo pidió el usuario el 16/11): lo dicen las marcas de cada campo", await p.evaluate(() => !document.querySelector(".gx-sugerido") && !/completó|salió/.test(document.getElementById("gastoBody").innerText)), true);
  eq("la ventana es ancha, con el comprobante grande al lado de los datos", await p.evaluate(() => { const m = document.querySelector("#gastoOverlay .modal").getBoundingClientRect(),
    c = document.querySelector("#gastoBody .gx-comp").getBoundingClientRect(); return [m.width >= 1000, c.height >= 400, c.right < document.getElementById("gxMonto").getBoundingClientRect().left]; }), [true, true, true]);
  eq("arriba, el estado y el concepto en la misma fila", await p.evaluate(() => { const a = document.querySelector(".gx-cabecera .gx-chip").getBoundingClientRect(), b = document.getElementById("gxConcepto").getBoundingClientRect();
    return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 6 && b.left > a.right; }), true);
  eq("el tipo vino sugerido por el título del archivo («Taxi al aeropuerto»: transporte), marcado para revisar",
    await p.evaluate(() => [(document.querySelector('#gxTipo [aria-pressed="true"]') || {}).dataset?.tipo || "", document.getElementById("gxTipo").dataset.sug]), ["transporte", "1"]);
  eq("el tipo se elige con botones, a la vista", await p.$$eval("#gxTipo [data-tipo]", l => l.map(b => b.textContent.trim())), ["Reunión", "Comida", "Pasaje", "Alojamiento", "Transporte", "Compra de material", "Suscripción"]);
  await p.click('#gxTipo [data-tipo="transporte"]');
  eq("tocar el elegido lo deja vacío", await p.evaluate(() => [(document.querySelector('#gxTipo [aria-pressed="true"]') || {}).dataset?.tipo || "", document.activeElement.dataset.tipo]), ["", "transporte"]);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("confirmar sin tipo ni monto: lo dice, marca los dos campos y lleva el foco al primero", await p.evaluate(() => [document.querySelector("#gastoBody .form-error").textContent.trim(),
    document.getElementById("gxTipo").getAttribute("aria-invalid"), document.getElementById("gxMonto").getAttribute("aria-invalid"), document.activeElement.id]),
    ["Para confirmarlo falta el tipo, el monto.", "true", "true", "gxTipo"]);
  eq("y no escribe nada", (await tabla(p, "gastos")).find(g => g.id === foto.id).estado, "borrador");
  await p.fill("#gxConcepto", "Taxi al aeropuerto de Lima");
  eq("con el tipo vacío, escribir el concepto lo vuelve a sugerir", await p.evaluate(() => [(document.querySelector('#gxTipo [aria-pressed="true"]') || {}).dataset?.tipo || "", document.getElementById("gxTipo").dataset.sug]), ["transporte", "1"]);
  await p.click('#gxTipo [data-tipo="comida"]'); await p.click('#gxTipo [data-tipo="transporte"]');
  eq("elegido a mano, deja de verse como sugerido", await p.evaluate(() => [(document.querySelector('#gxTipo [aria-pressed="true"]') || {}).dataset?.tipo || "", document.getElementById("gxTipo").hasAttribute("data-sug")]), ["transporte", false]);
  await p.fill("#gxMonto", "12,5"); await p.press("#gxMonto", "Tab");
  eq("en la ventana, el monto también se acomoda al salir del campo («12,5» → «12.50»)", await p.$eval("#gxMonto", e => e.value), "12.50");
  await p.fill("#gxMoneda", "ars"); await p.press("#gxMoneda", "Tab");
  eq("en otra moneda aparece el monto en dólares, con la moneda en mayúsculas", await p.evaluate(() => [document.getElementById("gxMoneda").value, !!document.getElementById("gxRendido")]), ["ARS", true]);
  await p.fill("#gxRendido", "8");
  await p.click('#gxForma [data-forma="tarjeta"]');
  eq("quién pagó y la forma de pago, también con botones", await p.evaluate(() => [document.getElementById("gxPagoPersona").getAttribute("aria-pressed"),
    document.querySelector('#gxForma [data-forma="tarjeta"]').getAttribute("aria-pressed"), !!document.getElementById("gxTarjeta")]), ["true", "true", true]);
  await p.fill("#gxTarjeta", "43a21");
  eq("la tarjeta: solo los cuatro números", await p.$eval("#gxTarjeta", e => e.value.length <= 5), true);
  await p.fill("#gxTarjeta", "4321");
  await p.selectOption("#gxVinculo", "post:p9");
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("confirmado: se guarda entero y atado a la rendición de esa actividad", await hasta(p, id => { const g = window.__sb.tablas.gastos.find(x => x.id === id);
    return g.estado === "confirmado" && g.tipo === "transporte" && g.monto === 12.5 && g.moneda === "ARS" && g.rendido_monto === 8 && g.rendido_moneda === "USD" && g.forma_pago === "tarjeta" && g.tarjeta === "4321" && g.rendicion_id === "ren_mvd"; }, foto.id), true);
  eq("la ventana se cierra y el foco vuelve a la lista", await p.evaluate(() => [document.getElementById("gastoOverlay").hidden, !!document.activeElement.closest(".gastos-view")]), [true, true]);

  // El PDF, a la rutina del mes anterior: la rendición se abre en la base.
  const mesAnt = await p.evaluate(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); });
  await p.click(`[data-action="gasto-abrir"][data-id="${pdf.id}"]`); await p.waitForSelector("#gastoOverlay:not([hidden]) #gxFecha");
  eq("el PDF se abre con «Abrir el PDF»", await p.$$eval('#gastoBody [data-action="gasto-ver-comprobante"]', l => l.map(e => e.getAttribute("aria-label") || e.textContent.replace(/\s+/g, " ").trim())), ["Abrir el PDF"]);
  await p.click('#gastoBody [data-action="gasto-ver-comprobante"]');
  eq("…y el visor lo muestra como documento, no como una planilla de bytes (lo vio el usuario el 15/11)", await hasta(p, () => !document.getElementById("filePreviewOverlay").hidden
    && !document.getElementById("filePreviewFrame").hidden && /gastos\//.test(document.getElementById("filePreviewFrame").src) && !document.querySelector(".visor-planilla")), true);
  await p.keyboard.press("Escape");
  eq("Escape cierra el visor y la ventana del gasto sigue abierta", await hasta(p, () => document.getElementById("filePreviewOverlay").hidden && !document.getElementById("gastoOverlay").hidden), true);
  eq("la rutina de un mes ya aprobado no se ofrece", await p.$eval(`#gxVinculo option[value="mes:${new Date().toISOString().slice(0, 7)}"]`, o => o.disabled), true);
  await p.fill("#gxFecha", mesAnt + "-03"); await p.fill("#gxConcepto", "Fotocopias"); if(!(await p.$('#gxTipo [data-tipo="material"][aria-pressed="true"]'))) await p.click('#gxTipo [data-tipo="material"]'); await p.fill("#gxMonto", "3");
  await p.selectOption("#gxVinculo", "mes:" + mesAnt);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("abre la rendición de la rutina de ese mes", await hasta(p, () => document.getElementById("gastoOverlay").hidden), true);
  eq("…con la función de la base", (await rpcs(p, "gastos_rendicion_abrir")).slice(-1), [{ p_post: null, p_mes: mesAnt + "-01" }]);
  const rutAnt = (await tabla(p, "gastos_rendiciones")).find(r => r.rutina_mes === mesAnt + "-01");
  eq("y el gasto queda en ella", (await tabla(p, "gastos")).find(g => g.id === pdf.id).rendicion_id, rutAnt && rutAnt.id);

  // La rendición de Montevideo: con un gasto por confirmar no se manda.
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  // La pantalla de la rendición (rehecha el 18/11): el camino en cuatro pasos y una barra con lo que sigue.
  eq("con un gasto por confirmar: el camino está en «Confirmar» y la barra dice qué falta, con «Revisar y confirmar» (todavía sin «Mandar»)", await p.evaluate(() => [
    (document.querySelector('.gx-camino [aria-current="step"]') || {}).textContent, (document.querySelector(".gx-paso b") || {}).textContent,
    [...document.querySelectorAll(".gx-paso button")].map(b => b.dataset.action), !document.querySelector('[data-action="gastos-enviar"]')]),
    ["2Confirmar", "Falta confirmar 1 gasto", ["gastos-lista-abrir"], true]);
  eq("el título es el del viaje, sin «Mis rendiciones» repetido arriba", await p.evaluate(() => [...document.querySelectorAll(".gastos-view h2")].map(h => h.textContent.trim())), ["Visita a Montevideo"]);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  await p.click('[data-action="gasto-borrar"]'); await aceptar(p);
  eq("borrar un gasto pregunta y lo borra", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.id === "gx1")), true);
  eq("el total confirmado suma lo que se rinde (en dólares cuando lo tiene)", await textos(p, ".gx-total b"), ["USD 353.50"]);
  eq("todo confirmado: el camino pasa a «Mandar» y la barra trae ese único botón", await hasta(p, () => (document.querySelector('.gx-camino [aria-current="step"]') || {}).textContent === "3Mandar"
    && (document.querySelector(".gx-paso b") || {}).textContent === "Todo confirmado" && [...document.querySelectorAll(".gx-paso button")].map(b => b.dataset.action).join() === "gastos-enviar"), true);
  await p.click('[data-action="gastos-enviar"]'); await aceptar(p);
  eq("mandar: pregunta y la manda con la función de la base", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_mvd").estado === "enviada"), true);
  eq("…una vez", (await rpcs(p, "gastos_rendicion_enviar")), [{ p_id: "ren_mvd" }]);
  eq("mandada, sus gastos dicen «En revisión», como la rendición", await hasta(p, () => [...document.querySelectorAll(".gx-filas .gx-chip")].every(c => c.textContent === "En revisión")
    && document.querySelectorAll(".gx-filas .gx-chip").length > 0), true);
  eq("mandada, dice que la está revisando un admin y no se puede tocar", await p.evaluate(() => [/^La mandaste el /.test((document.querySelector(".gx-paso b") || {}).textContent || ""),
    (document.querySelector('.gx-camino [aria-current="step"]') || {}).textContent, !document.querySelector('[data-action="gastos-subir"]'), !document.querySelector('[data-action="gastos-enviar"]')]), [true, "4En revisión", true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto mandado se ve como texto, sin campos apagados, y no se cambia", await p.evaluate(() => [document.getElementById("gxConcepto").tagName,
    document.querySelectorAll("#gastoBody .gx-v-form > :not(.gx-observar) :is(input, select, textarea, .gx-opc)").length, !!document.querySelector("#gastoBody .gx-res"),
    !document.querySelector('[data-action="gasto-guardar"]'), (document.querySelector("#gastoBody .gx-res-estado") || {}).textContent]), ["SPAN", 0, true, true, "Mandado: un administrador lo está revisando."]);
  await p.keyboard.press("Escape");
  eq("Escape cierra la ventana y el foco vuelve a su fila", await hasta(p, () => document.getElementById("gastoOverlay").hidden && document.activeElement.dataset.id === "gx2"), true);

  // El total rápido de la rutina del mes anterior (tiene 3 USD de detalle).
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, rutAnt.id); await p.waitForTimeout(150);
  eq("al final de la rendición: primero los cambios de moneda, después «Anotar solo el total»", await p.$$eval("details.gx-rapido > summary", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())),
    ["💱 Cambios de moneda", "Anotar solo el total"]);
  await p.click(".gx-solo-total summary");
  await p.fill("#gxTotal_0_monto", "10");
  await p.click('[data-action="gastos-total-guardar"]');
  eq("el total rápido se guarda por moneda", await hasta(p, id => { const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === id); return JSON.stringify(r.total_manual) === '{"USD":10}' && r.total_manual_confirmado === false; }, rutAnt.id), true);
  eq("guardado, el desplegable dice el total con el mismo nombre", await hasta(p, () => /^Total anotado: USD 10\.00$/.test(((document.querySelector(".gx-solo-total summary") || {}).textContent || "").trim())), true);
  eq("si no coincide con los comprobantes, avisa que valen los comprobantes", await hasta(p, () => /No coincide con los comprobantes \(USD 3\.00\): valen los comprobantes/.test((document.querySelector(".gx-solo-total .gx-alerta") || {}).textContent || "")), true);
  await p.check("#gxTotalConfirmado"); await p.click('[data-action="gastos-total-guardar"]');
  eq("y la persona puede confirmar que vale el suyo", await hasta(p, id => window.__sb.tablas.gastos_rendiciones.find(x => x.id === id).total_manual_confirmado === true, rutAnt.id), true);

  /* ---------------- Para aprobar ---------------- */
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  eq("para aprobar: lo mandado (de cualquiera, también lo propio), la plata por confirmar, lo que espera corrección y abajo lo aprobado hace poco",
    await textos(p, ".gastos-view .admin-h3"), ["Para revisar", "Plata anotada por confirmar", "Esperando la corrección", "Aprobadas hace poco"]);
  eq("las rendiciones mandadas, la más vieja primero y con de quién son", (await p.$$eval(".gastos-view .gx-lista", l => [...l[0].querySelectorAll(".gx-t-txt small")].map(e => e.textContent.split(" · ")[0]))),
    ["Ana Pérez", "Benny Rosenthal"]);
  await p.click('[data-action="gastos-mov-confirmar"][data-id="mv2"]');
  eq("confirmar la plata anotada", await hasta(p, () => window.__sb.tablas.gastos_movimientos.find(m => m.id === "mv2").estado === "confirmado"), true);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  eq("la rendición de otra persona: con su nombre y «Aprobar»", await p.evaluate(() => [document.querySelector(".gx-cab .setting-sub").textContent.includes("Ana Pérez"), !!document.querySelector('[data-action="gastos-aprobar"]')]), [true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden]) #gxObs");
  // El correo de «te observaron un gasto» (17/11): la app lo pide; a quién y si corresponde lo decide la base.
  const avisos = [];
  await p.route(/\/functions\/v1\/avisar/, r => { avisos.push(JSON.parse(r.request().postData() || "{}")); return r.fulfill({ contentType: "application/json", body: '{"enviado":true}' }); });
  await p.click('[data-action="gasto-observar"]');
  eq("observar sin comentario no se puede", await p.evaluate(() => [document.querySelector("#gastoBody .form-error").textContent.trim(), document.activeElement.id]), ["Escribí qué hay que corregir: le llega a la persona.", "gxObs"]);
  await p.fill("#gxObs", "Falta el ticket del micro");
  await p.click('[data-action="gasto-observar"]');
  eq("observar: con la función de la base y el comentario", await hasta(p, () => document.getElementById("gastoOverlay").hidden), true);
  eq("…lo que se mandó", (await rpcs(p, "gastos_observar")), [{ p_gasto: "gx5", p_texto: "Falta el ticket del micro" }]);
  // Desde el 19/11 (D18) la observación queda anotada y la rendición sigue en revisión: se devuelve todo junto.
  eq("…la rendición sigue en revisión, sin «Aprobar», con «Devolver con la observación»", await hasta(p, () => !document.querySelector('[data-action="gastos-aprobar"]')
    && window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_ana").estado === "enviada"
    && /1 gasto observado/.test((document.querySelector(".gx-paso b") || {}).textContent || "") && /Devolver con la observación/.test((document.querySelector('[data-action="gastos-devolver"]') || {}).textContent || "")), true);
  eq("…y el aviso por correo todavía no sale", avisos, []);
  await p.click('[data-action="gastos-devolver"]');
  eq("devolver pregunta, con a quién", await p.$eval("#confirmMessage", e => e.textContent).catch(() => ""), "¿Devolverle «Visita a la comunidad de Rosario» a Ana Pérez con la observación?");
  await p.click("#confirmOk");
  eq("devuelta: la rendición vuelve a la persona, con la función de la base", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_ana").estado === "observada"), true);
  eq("…con la función de la base", await rpcs(p, "gastos_rendicion_devolver"), [{ p_id: "ren_ana" }]);
  eq("…y ahí sale el aviso por correo de cada gasto observado (una vez)", await hasta(p, () => true).then(() => avisos), [{ tipo: "gasto", id: "gx5" }]);
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-aprobar"]'); await aceptar(p);
  eq("aprobada: los cuatro pasos hechos y la barra lo dice", await hasta(p, () => document.querySelectorAll(".gx-camino .gx-cam-hecho").length === 4
    && !document.querySelector('.gx-camino [aria-current="step"]') && /^Aprobada el /.test((document.querySelector(".gx-paso b") || {}).textContent || "")), true);
  eq("un admin aprueba la suya (decidido el 15/11) entera", await hasta(p, () => { const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_mvd"); return r.estado === "aprobada" && window.__sb.tablas.gastos.filter(g => g.rendicion_id === "ren_mvd").every(g => g.estado === "aprobado"); }), true);
  eq("…con la función de la base", (await rpcs(p, "gastos_rendicion_aprobar")), [{ p_id: "ren_mvd" }]);

  /* ---------------- La cuenta corriente ---------------- */
  await p.click('[data-action="gastos-seccion"][data-key="cuenta"]'); await p.waitForTimeout(150);
  // Gastado: el remís (20) + el hotel (300 en dólares) + el taxi (8); la cena la pagó la organización. Recibido: 500.
  eq("la cuenta: lo gastado de su bolsillo en rendiciones aprobadas, menos lo recibido", await textos(p, ".gx-cuenta-mon .gx-saldo, .gx-cuenta-mon .gx-cm-sub, .gx-cm-filas dd"),
    ["-172.00", "le debés a la organización", "328.00", "500.00", "0.00"]);
  eq("cada tarjeta dice la moneda una sola vez, arriba", await p.$$eval(".gx-cuenta-mon .gx-cur", l => l.length), 0);
  // «Anotar plata recibida o devuelta», detrás de un botón (18/11): abrirlo lleva al primer campo.
  eq("el formulario para anotar arranca cerrado, con su botón", await p.evaluate(() => [!document.getElementById("gxMov_tipo"), !!document.querySelector('[data-action="gastos-mov-abrir"]')]), [true, true]);
  await p.click('[data-action="gastos-mov-abrir"]');
  eq("…abrirlo lleva al primer campo", await p.evaluate(() => document.activeElement.id), "gxMov_tipo");
  await p.selectOption("#gxMov_tipo", "ajuste"); await p.waitForTimeout(100);
  await p.fill("#gxMov_monto", "50"); await p.fill("#gxMov_descripcion", "Saldo inicial");
  await p.click('[data-action="gastos-mov-anotar"]');
  eq("un admin anota un ajuste, que ya cuenta (y el formulario se cierra)", await hasta(p, () => /-122\.00/.test(document.querySelector(".gx-saldo").textContent) && !document.getElementById("gxMov_tipo")), true);
  eq("los movimientos sin signo menos en lo recibido; el ajuste sí lleva el suyo", await p.$$eval(".gx-mov .gx-mov-der b", l => l.map(e => e.textContent.replace(/\s+/g, " ").trim())), ["USD +50.00", "USD 500.00"]);
  eq("…a nombre de la persona, confirmado", (await tabla(p, "gastos_movimientos")).filter(m => m.tipo === "ajuste").map(m => [m.persona, m.monto, m.moneda, m.estado, m.descripcion]), [[ADMIN, 50, "USD", "confirmado", "Saldo inicial"]]);
  await p.click('[data-action="gastos-mov-abrir"]');
  await p.fill("#gxMov_monto", ""); await p.click('[data-action="gastos-mov-anotar"]');
  eq("sin monto, avisa", await p.$eval(".gx-anotar .form-error", e => e.textContent.trim()), "Falta el monto.");
  await p.selectOption("#gxCuentaDe", ANA.email); await p.waitForTimeout(150);
  eq("la cuenta de otra persona: lo recibido ya confirmado y lo que está en revisión aparte", await textos(p, ".gx-cuenta-mon .gx-saldo, .gx-cuenta-mon .gx-cm-sub, .gx-cm-filas dd"),
    ["-200.00", "le debe a la organización", "0.00", "200.00", "0.00", "170.00"]);
  eq("sin errores de página en todo el camino", errores, []);
  await p.close();
}

/* ---------------- Los arreglos de la crítica del 15/11 ---------------- */
{
  // gx1 confirmado en pesos uruguayos, sin el monto en dólares: «Mandar» avisa.
  const base = datos({ prendido: true });
  Object.assign(base.gastos.find(g => g.id === "gx1"), { estado: "confirmado", tipo: "transporte", monto: 1250, moneda: "UYU" });
  // Un borrador con un monto mal leído: no entra en el total hasta que se confirma.
  base.gastos.push({ ...base.gastos.find(g => g.id === "gx3"), id: "gx9", concepto: "Peaje leído mal", monto: 72570, estado: "borrador",
    archivo: "gastos/gx9/comprobante_9.jpg", archivo_nombre: "peaje-viejo.jpg", archivo_hash: "9".repeat(64) });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  // Subir: primero «¿De qué son?».
  await p.click('[data-action="gastos-destino-abrir"]');
  eq("«Subir comprobantes» pregunta antes de qué son, y no deja elegir archivos sin decirlo", await p.evaluate(() => [!!document.getElementById("gxDestino"),
    document.activeElement.id, document.querySelector('[data-action="gastos-destino-elegir"]').disabled]), [true, "gxDestino", true]);
  eq("las opciones: «todavía no sé», la rutina del mes y las actividades", await p.$$eval("#gxDestino option", l => [l[1].textContent, l.some(o => o.value === "post:p9")]), ["Todavía no sé (quedan sin vincular)", true]);
  // Lo pidió el usuario el 18/11 («por qué solo me permite estas rendiciones»): las rutinas de todo el año; las actividades propias primero y todas; las del resto, aparte.
  eq("las rutinas de los últimos doce meses, de la más nueva a la más vieja", await p.$$eval('#gxDestino option[value^="mes:"]', l => {
    const ms = l.map(o => o.value.slice(4)), d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11);
    return [ms.length >= 12, ms[0] === new Date().toISOString().slice(0, 7), ms.includes(d.toISOString().slice(0, 7)), ms.join() === [...ms].sort().reverse().join()]; }), [true, true, true, true]);
  eq("las actividades: primero las mías (Montevideo, que cargué yo), después las del resto del equipo", await p.$$eval("#gxDestino optgroup", l => l.map(g => [g.label, [...g.querySelectorAll("option")].some(o => o.value === "post:p9")])),
    [["La rutina del mes", false], ["Mis actividades", true], ["Otras actividades del equipo", false]]);
  const antes = (await tabla(p, "gastos")).length;
  await p.selectOption("#gxDestino", "post:p9");
  await elegir(p, '[data-action="gastos-destino-elegir"]', [{ name: "peaje.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([1])]) }]);
  eq("subido a un viaje: queda en su rendición, y se ve esa rendición", await hasta(p, n => { const g = (window.__sb.tablas.gastos || []).slice(n)[0];
    return !!g && g.rendicion_id === "ren_mvd" && !!g.archivo && /Visita a Montevideo/.test((document.querySelector(".gx-cab .gx-ren-tit") || {}).textContent || ""); }, antes), true);
  const nuevo = (await tabla(p, "gastos")).slice(antes)[0];
  // Los totales: solo lo confirmado.
  eq("el total de la rendición cuenta solo lo confirmado, y dice cuántos quedan afuera", await textos(p, ".gx-total > span"), ["Total confirmado (no suma los 2 que faltan)"]);
  eq("…sin el monto del borrador (lo que asustó al usuario: «USD 72.570» que eran pesos)", await p.$eval(".gx-total b", e => [/72[.,]?570/.test(e.textContent), /345\.50/.test(e.textContent)]), [false, true]);
  // Borrar sin abrir la ventana: la casilla de la fila y «Borrar» en la barra (desde el 18/11; antes, una papelera por fila).
  eq("cada fila tiene su casilla", await p.$$eval("[data-gsel]", l => l.map(e => e.dataset.gsel).sort()), ["gx1", "gx2", "gx3", "gx9", nuevo.id].sort());
  await p.check(`#gxS_${nuevo.id}`);
  await p.click('[data-action="gastos-sel-borrar"]');
  eq("borrar pregunta", await p.$eval("#confirmMessage", e => /¿Borrar el gasto seleccionado y su comprobante\?/.test(e.textContent)).catch(() => false), true);
  await p.click("#confirmOk");
  eq("…lo borra y el foco no se pierde", await hasta(p, id => !window.__sb.tablas.gastos.some(g => g.id === id) && !!document.activeElement.closest(".gastos-view"), nuevo.id), true);
  await p.check("#gxS_gx9"); await p.click('[data-action="gastos-sel-borrar"]'); await aceptar(p);
  await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.id === "gx9"));
  // Cerrar la ventana con cambios: pregunta.
  await p.click('[data-action="gasto-abrir"][data-id="gx3"]'); await p.waitForSelector("#gastoOverlay:not([hidden]) #gxConcepto");
  await p.fill("#gxConcepto", "Cena con los directores y el rabino");
  await p.keyboard.press("Escape");
  eq("con algo escrito, Escape pregunta antes de cerrar", await p.evaluate(() => [!document.getElementById("confirmOverlay").hidden, !document.getElementById("gastoOverlay").hidden]), [true, true]);
  await p.click("#confirmCancel");
  eq("…y si no, sigue abierta con lo escrito", await p.evaluate(() => [!document.getElementById("gastoOverlay").hidden, document.getElementById("gxConcepto").value]), [true, "Cena con los directores y el rabino"]);
  await p.click('#gastoBody [data-action="gasto-cerrar"]'); await aceptar(p);
  eq("«Cerrar sin guardar» cierra sin escribir nada", await hasta(p, () => document.getElementById("gastoOverlay").hidden && window.__sb.tablas.gastos.find(g => g.id === "gx3").concepto === "Cena con los directores"), true);
  eq("el «Borrar» de la ventana se ve rojo", await p.evaluate(() => { const d = document.createElement("div"); d.className = "btn-secondary gx-borrar"; document.body.appendChild(d);
    const c = getComputedStyle(d).color; d.remove(); const x = document.createElement("div"); x.style.color = "var(--danger-fg)"; document.body.appendChild(x); const r = getComputedStyle(x).color; x.remove(); return c === r; }), true);
  // Mandar: avisa lo que está en otra moneda sin el monto en dólares, y deja mandar igual.
  await p.click('[data-action="gastos-enviar"]');
  eq("«Mandar» avisa que un gasto en otra moneda no tiene el monto en dólares", await p.$eval("#confirmMessage", e => e.textContent.includes("Ojo: «Taxi al aeropuerto» no tiene el monto en USD.")).catch(() => false), true);
  eq("…y deja mandar igual", await p.$eval("#confirmOk", e => e.textContent.trim()), "Mandar igual");
  await p.click("#confirmOk");
  eq("mandada igual", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_mvd").estado === "enviada"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Subir a una rutina: cada comprobante va a la rutina de su mes (lo pidió el usuario el 18/11) ---------------- */
{
  const base = datos({ prendido: true });
  Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_rutina"), { estado: "abierta", enviada_el: null, aprobada_el: null, aprobada_por: null });
  base.gastos.filter(g => g.rendicion_id === "ren_rutina").forEach(g => Object.assign(g, { estado: "confirmado" }));
  const mesDe = atras => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - atras); return d.toISOString().slice(0, 7); };
  const [hoyM, dos, tres] = [mesDe(0), mesDe(2), mesDe(3)];
  // Hace tres meses: una rutina ya aprobada (lo de ese mes no puede ir ahí).
  base.gastos_rendiciones.push({ ...base.gastos_rendiciones.find(r => r.id === "ren_rutina"), id: "ren_tres", rutina_mes: tres + "-01", estado: "aprobada", aprobada_el: "2026-01-01T00:00:00Z", aprobada_por: ADMIN });
  const nombre = (ym, c) => `10-${ym.slice(5)}-${ym.slice(0, 4)} - ${c} - Rutina.png`;
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  const antes = (await tabla(p, "gastos")).length, rends = (await tabla(p, "gastos_rendiciones")).length;
  await subirDesdeCabecera(p, "mes:" + hoyM, [
    { name: nombre(hoyM, "Taxi de este mes"), mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([31])]) },
    { name: nombre(dos, "Taxi de hace dos meses"), mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([32])]) },
    { name: nombre(tres, "Taxi de hace tres meses"), mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([33])]) },
    { name: "foto-sin-fecha.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([34])]) },
    { name: "otra-vez.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([34])]) }]);
  eq("subidos los cuatro", await hasta(p, n => window.__sb.tablas.gastos.length === n + 4 && !document.querySelector(".gx-subida"), antes), true);
  eq("X16: el repetido, el aviso dice cuál", await p.$eval("#calendarToastText", e => /«otra-vez\.png» ya estaba cargado\./.test(e.textContent)), true);
  const g = await tabla(p, "gastos"), rs = await tabla(p, "gastos_rendiciones"), en = c => (g.find(x => (x.concepto || x.archivo_nombre) === c) || {}).rendicion_id;
  const rDos = rs.find(r => r.rutina_mes === dos + "-01");
  eq("el de este mes y el sin fecha, en la rutina elegida; el de hace dos meses, en la suya (se abrió); el de un mes ya aprobado, en la elegida",
    [en("Taxi de este mes"), en("foto-sin-fecha.png"), en("Taxi de hace dos meses"), en("Taxi de hace tres meses")], ["ren_rutina", "ren_rutina", rDos && rDos.id, "ren_rutina"]);
  eq("…se abrió una sola rendición nueva, con la función de la base", [rs.length - rends, (await rpcs(p, "gastos_rendicion_abrir")).map(x => x.p_mes)], [1, [dos + "-01"]]);
  eq("…y el aviso dice adónde fue", await p.$eval("#calendarToastText", e => /Se subieron 4 comprobantes\. .*1 fue a la rutina de /.test(e.textContent)), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Una rendición vacía se borra (lo pidió el usuario el 15/11) ---------------- */
{
  const base = datos({ prendido: true });
  base.gastos_rendiciones.push({ ...base.gastos_rendiciones.find(r => r.id === "ren_mvd"), id: "ren_vacia", post_id: "p1", titulo: "Viaje sin gastos" });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await abrirRen(p, "ren_vacia"); await p.waitForTimeout(150);
  eq("vacía: el camino en «Cargar» y la barra con «Subir comprobantes» y, al lado, «o anotar solo el total»", await p.evaluate(() => [(document.querySelector('.gx-camino [aria-current="step"]') || {}).textContent,
    (document.querySelector(".gx-paso b") || {}).textContent, [...document.querySelectorAll(".gx-paso button")].map(b => [b.dataset.action, b.textContent.replace(/\s+/g, " ").trim()]), !document.querySelector(".gx-filas-cab")]),
    ["1Cargar", "Subí los comprobantes", [["gastos-subir", "📎 Subir comprobantes"], ["gastos-total-abrir", "o anotar solo el total"]], true]);
  await tocar(p, '.gx-paso [data-action="gastos-total-abrir"]');
  eq("«o anotar solo el total» abre ese formulario ahí y va al monto", await p.evaluate(() => [(document.querySelector("details.gx-solo-total") || {}).open, document.activeElement.id]), [true, "gxTotal_0_monto"]);
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  eq("una rendición propia, abierta y vacía tiene su ✕; una con gastos, no", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-quitar"][data-id="ren_vacia"]'),
    !!document.querySelector('[data-action="gastos-rendicion-quitar"][data-id="ren_mvd"]')]), [true, false]);
  const titulo = await p.$eval('[data-action="gastos-abrir-rendicion"][data-id="ren_vacia"] .gx-t-txt b', e => e.textContent);
  await p.click('[data-action="gastos-rendicion-quitar"][data-id="ren_vacia"]');
  await p.waitForSelector("#confirmOverlay:not([hidden])");
  eq("pregunta antes, con el nombre", await p.$eval("#confirmMessage", (e, t0) => e.textContent.includes(`¿Borrar la rendición vacía «${t0}»?`), titulo), true);
  await p.click("#confirmOk");
  eq("…la borra, y el foco no se pierde", await hasta(p, () => !window.__sb.tablas.gastos_rendiciones.some(r => r.id === "ren_vacia")
    && !document.querySelector('[data-id="ren_vacia"]') && !!document.activeElement.closest(".gastos-view")), true);
  // Una subida a un mes sin rendición que no deja ningún comprobante: la rendición que se abrió no queda vacía.
  const antes = (await tabla(p, "gastos_rendiciones")).length;
  await p.click('[data-action="gastos-destino-abrir"]');
  const mes = await p.$eval("#gxDestino", s => ([...s.options].find(o => o.value.startsWith("mes:") && !o.disabled) || {}).value);
  await p.selectOption("#gxDestino", mes);
  await elegir(p, '[data-action="gastos-destino-elegir"]', [{ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") }]);
  eq("una subida que no dejó ningún comprobante no deja una rendición vacía, y vuelve a la lista", await hasta(p, n => window.__sb.tablas.gastos_rendiciones.length === n
    && /no es una foto ni un PDF/.test((document.querySelector(".gx-subida") || {}).textContent || "") && !!document.querySelector('[data-action="gastos-destino-abrir"]'), antes), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Borrar varios gastos juntos, y una rendición entera (lo pidió el usuario el 16/11) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  // Desde el 18/11, las casillas siempre a la vista (sin «Seleccionar» ni papeleras) y la barra abajo, siempre.
  eq("una casilla por gasto, sin papeleras ni «Seleccionar»; abajo, «Todos», «Descargar Excel» y «Borrar» esperando", await p.evaluate(() => [document.querySelectorAll("[data-gsel]").length,
    document.querySelectorAll('[data-action="gasto-quitar"], [data-action="gastos-sel-abrir"]').length, [...document.querySelectorAll(".gx-selpie button")].map(b => [b.dataset.action, b.disabled]), !!document.getElementById("gxSelTodos")]),
    [3, 0, [["gastos-sel-excel", true], ["gastos-sel-borrar", true]], true]);
  eq("…y lo de siempre sigue a la vista (la barra de lo que sigue y «Borrar esta rendición»)", await p.evaluate(() => [!!document.querySelector(".gx-paso"), !!document.querySelector('[data-action="gastos-rendicion-borrar"]')]), [true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]');
  eq("tocar la fila abre el gasto (no lo elige)", await hasta(p, () => !document.getElementById("gastoOverlay").hidden && !document.getElementById("gxS_gx1").checked), true);
  await p.keyboard.press("Escape"); await hasta(p, () => document.getElementById("gastoOverlay").hidden);
  await p.check("#gxS_gx1"); await p.check("#gxS_gx3");
  eq("la casilla lo elige; la barra cuenta, y el foco sigue en la casilla", await p.evaluate(() => [document.getElementById("gxS_gx1").checked, document.getElementById("gxS_gx3").checked,
    document.querySelector(".gx-selpie .gx-lcuenta").textContent, document.querySelector('[data-action="gastos-sel-borrar"]').textContent.trim(), document.activeElement.id]), [true, true, "2 seleccionados", "🗑️ Borrar 2", "gxS_gx3"]);
  await p.check("#gxSelTodos");
  eq("«Todos» elige todos", await p.$eval(".gx-selpie .gx-lcuenta", e => e.textContent), "3 seleccionados");
  await p.uncheck("#gxSelTodos"); await p.check("#gxS_gx1"); await p.check("#gxS_gx3");
  await p.click('[data-action="gastos-sel-borrar"]');
  eq("borrar pregunta, con cuántos", await p.$eval("#confirmMessage", e => e.textContent).catch(() => ""), "¿Borrar los 2 gastos seleccionados y sus comprobantes? No se puede deshacer.");
  await p.click("#confirmOk");
  eq("…borra los elegidos y deja el resto, con su casilla y la barra", await hasta(p, () => { const ids = window.__sb.tablas.gastos.map(g => g.id);
    return !ids.includes("gx1") && !ids.includes("gx3") && ids.includes("gx2") && document.querySelectorAll("[data-gsel]").length === 1 && !!document.querySelector(".gx-selpie"); }), true);
  // La rendición entera, con lo que tiene adentro.
  eq("«Borrar esta rendición» dice con cuántos gastos", await p.$eval('[data-action="gastos-rendicion-borrar"]', e => e.textContent.trim()), "🗑️ Borrar esta rendición (con su gasto)");
  await p.click('[data-action="gastos-rendicion-borrar"]');
  eq("pregunta, con el nombre", await p.$eval("#confirmMessage", e => /¿Borrar la rendición «.+» con su gasto y su comprobante\? No se puede deshacer\./.test(e.textContent)).catch(() => false), true);
  eq("…y el botón dice «Borrar todo»", await p.$eval("#confirmOk", e => e.textContent.trim()), "Borrar todo");
  await p.click("#confirmOk");
  eq("…la borra con sus gastos, y vuelve a «Mis rendiciones»", await hasta(p, () => !window.__sb.tablas.gastos_rendiciones.some(r => r.id === "ren_mvd")
    && !window.__sb.tablas.gastos.some(g => g.rendicion_id === "ren_mvd") && !!document.querySelector('[data-action="gastos-destino-abrir"]') && !document.querySelector('[data-id="ren_mvd"]')), true);
  // Una aprobada la borra solo el admin fijo (lo pidió el usuario el 17/11): ver «Lo ya aprobado», más abajo.
  await abrirRen(p, "ren_rutina"); await p.waitForTimeout(150);
  eq("una rendición aprobada: el admin fijo tiene «Borrar» y la casilla de su gasto", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.getElementById("gxS_gx4")]), [true, true]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- La lista agrupada: filtros, resumen, desplegar, Excel y borrar (lo pidió el usuario el 18/11) ---------------- */
{
  // SheetJS de mentira: se queda con lo que se pidió escribir.
  const XLSX_FALSO = `window.XLSX = { utils: { aoa_to_sheet: f => ({ f }), book_new: () => ({ hojas: [] }), book_append_sheet: (l, h, n) => l.hojas.push([n, h.f]) },
    writeFile: (l, nombre) => { window.__excel = { nombre, hojas: l.hojas }; } };`;
  // Seis rendiciones: con más de cinco aparecen los filtros (X11). Dos rutinas viejas de Diego, aprobadas y sin gastos.
  const base = datos({ prendido: true }), r0 = base.gastos_rendiciones.find(r => r.id === "ren_rutina");
  base.gastos_rendiciones.push({ ...r0, id: "ren_x1", autor: PERS[2].email, rutina_mes: "2026-01-01" }, { ...r0, id: "ren_x2", autor: PERS[2].email, rutina_mes: "2026-02-01" });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base, iniciar: XLSX_FALSO });
  await irGastos(p); await irRendiciones(p);
  const ids = () => p.$$eval(".gx-grupos .gx-tarjeta", l => l.map(e => e.dataset.id));
  eq("el admin ve las rendiciones de todo el equipo, la más nueva primero", await ids(), ["ren_ana", "ren_diego", "ren_rutina", "ren_mvd", "ren_x2", "ren_x1"]);
  eq("…las de otros, con de quién son; las suyas, sin el nombre", await p.$$eval(".gx-grupos .gx-tarjeta", (l, ns) => l.map(e => ns.find(n => e.querySelector(".gx-t-txt small").textContent.includes(n)) || ""),
    PERS.slice(0, 3).map(x => x.name)), [PERS[1].name, PERS[2].name, "", "", PERS[2].name, PERS[2].name]);
  eq("los filtros: desde, hasta, persona y estado", await p.$$eval(".gx-filtros .gx-et", l => l.map(e => e.textContent)), ["Desde", "Hasta", "Persona", "Estado"]);
  const nGastos = (await tabla(p, "gastos")).filter(g => ["ren_ana", "ren_diego", "ren_rutina", "ren_mvd"].includes(g.rendicion_id)).length;
  eq("el resumen: cuántas rendiciones y gastos, y el total por moneda", await p.$eval(".gx-hresumen b", e => e.textContent), `6 rendiciones · ${nGastos} gastos`);
  eq("…con el total en cada moneda", await p.$eval(".gx-hresumen span", e => /USD [\d,]+\.\d\d/.test(e.textContent)), true);
  await p.selectOption("#gxHPersona", PERS[1].email);
  eq("persona: Ana → solo la suya, y el foco sigue en el filtro", [await ids(), await p.evaluate(() => document.activeElement.id)], [["ren_ana"], "gxHPersona"]);
  await p.selectOption("#gxHPersona", "");
  await p.selectOption("#gxHEstado", "aprobada");
  eq("estado: aprobadas", await ids(), ["ren_rutina", "ren_x2", "ren_x1"]);
  await p.selectOption("#gxHEstado", "completar");
  eq("estado: para completar (abiertas u observadas)", await ids(), ["ren_diego", "ren_mvd"]);
  await p.selectOption("#gxHEstado", "");
  const mesHoy = new Date().toISOString().slice(0, 7);
  await p.selectOption("#gxHDesde", mesHoy);
  eq("desde este mes: sin Montevideo (es de hace unos meses)", (await ids()).includes("ren_mvd"), false);
  const mesMvd = await p.$$eval("#gxHHasta option", (l, m) => l.map(o => o.value).filter(v => v && v < m)[0], mesHoy);
  await p.selectOption("#gxHHasta", mesMvd);
  eq("desde después de hasta: ninguna, y lo dice con «Quitar los filtros»", await p.evaluate(() => [document.querySelectorAll(".gx-grupos").length, /Ninguna rendición con estos filtros/.test(document.querySelector(".gastos-view").textContent),
    !!document.querySelector('[data-action="gastos-hist-limpiar"]'), !!document.querySelector(".gx-selpie")]), [0, true, true, false]);
  await p.click('[data-action="gastos-hist-limpiar"]');
  eq("«Quitar los filtros» las vuelve a mostrar todas", (await ids()).length, 6);
  // Desplegar: sus gastos, con casillas, y «Abrir la rendición».
  await p.click('[data-action="gastos-grupo"][data-id="ren_mvd"]');
  eq("al tocar una rendición se despliegan sus gastos con casillas, y «Abrir la rendición →»; el foco queda en la tarjeta", await p.evaluate(() => [
    document.querySelector('[data-action="gastos-grupo"][data-id="ren_mvd"]').getAttribute("aria-expanded"), document.querySelectorAll(".gx-g-cuerpo [data-gsel]").length,
    (document.querySelector('.gx-g-cuerpo [data-action="gastos-abrir-rendicion"]') || {}).dataset.id, document.activeElement.dataset.id]), ["true", 3, "ren_mvd", "ren_mvd"]);
  await p.check("#gxS_gx1"); await p.check("#gxS_gx2");
  eq("la barra cuenta lo elegido", await p.$eval(".gx-selpie .gx-lcuenta", e => e.textContent), "2 seleccionados");
  await p.click('[data-action="gastos-sel-excel"]');
  eq("«Descargar Excel»: una planilla con una fila por gasto elegido", await hasta(p, () => !!window.__excel), true);
  const xl = await p.evaluate(() => window.__excel);
  eq("…con el nombre y la fecha de hoy", xl.nombre, `gastos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  const hoja = xl.hojas[0][1], col = n => hoja[0].indexOf(n);
  eq("…las columnas", hoja[0].slice(0, 7), ["Persona", "Rendición", "Fecha", "Concepto", "Tipo", "Moneda", "Monto"]);
  eq("…dos filas, de Montevideo, con el monto como número", [hoja.length, hoja[1][col("Rendición")], typeof hoja.find(f => f[col("Concepto")] === "Hotel Rambla, dos noches")[col("Monto rendido")]], [3, "Visita a Montevideo", "number"]);
  // «Todos»: todo lo de la lista filtrada, también lo de las rendiciones plegadas.
  await p.check("#gxSelTodos");
  eq("«Todos» elige todos los gastos de la lista (también los de las plegadas)", await p.$eval(".gx-selpie .gx-lcuenta", e => e.textContent), `${nGastos} seleccionados`);
  eq("…y «Borrar» cuenta solo lo que se puede borrar (el admin fijo, todo)", await p.$eval('[data-action="gastos-sel-borrar"]', e => e.textContent.trim()), `🗑️ Borrar ${nGastos}`);
  await p.uncheck("#gxSelTodos"); await p.check("#gxS_gx2");
  await p.click('[data-action="gastos-sel-borrar"]'); await aceptar(p);
  eq("borrar desde la lista agrupada", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.id === "gx2") && !document.getElementById("gxS_gx2")), true);
  // Abrir la rendición y volver: vuelve a la lista, con la rendición desplegada.
  await p.click('.gx-g-cuerpo [data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  eq("«Abrir la rendición» la abre, y «volver» dice «Rendiciones»", await p.evaluate(() => [document.querySelector(".gx-ren-tit").textContent, document.querySelector(".gx-volver").textContent.trim()]), ["Visita a Montevideo", "← Rendiciones"]);
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  eq("…y al volver sigue desplegada, con el foco en su tarjeta", await p.evaluate(() => [document.querySelector('[data-action="gastos-grupo"][data-id="ren_mvd"]').getAttribute("aria-expanded"), document.activeElement.dataset.id]), ["true", "ren_mvd"]);
  // La de otra persona, mandada: el admin la abre desde acá y la puede aprobar.
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  eq("la de otra persona, mandada: el admin la ve con «Aprobar la rendición»", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-aprobar"][data-id="ren_ana"]'), document.querySelector(".gx-volver").textContent.trim()]), [true, "← Rendiciones"]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Sin SheetJS (no carga): un .csv que Excel también abre, con punto y coma.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.route(/cdn\.sheetjs\.com/, r => r.abort());
  await p.click('.bn-item[data-action="toggle-more-menu"]'); await p.waitForTimeout(150);
  await p.click('.bn-sheet-item[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  await irRendiciones(p);
  await p.click('[data-action="gastos-grupo"][data-id="ren_mvd"]');
  await p.check("#gxS_gx1");
  eq("en el celular: la barra entra (sin «Descargar», solo «Excel») y la página no se corre de costado", await p.evaluate(() => {
    const bar = document.querySelector(".gx-selpie").getBoundingClientRect(); return [bar.right <= innerWidth + 1, document.documentElement.scrollWidth <= innerWidth + 1,
      document.querySelector('[data-action="gastos-sel-excel"]').innerText.trim()]; }), [true, true, "⬇️ Excel"]);
  const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click('[data-action="gastos-sel-excel"]')]);
  const texto = (await import("node:fs")).readFileSync(await descarga.path(), "utf8");
  eq("sin SheetJS baja un .csv, con punto y coma y coma decimal", [descarga.suggestedFilename().endsWith(".csv"), /^\uFEFF"Persona";"Rendición"/.test(texto), /"Taxi al aeropuerto"/.test(texto)], [true, true, true]);
  eq("sin errores de página", errores.filter(e => !/sheetjs|SheetJS|ERR_FAILED/.test(e)), []);
  await p.close();
}

/* ---------------- Gastos desde el + y desde el ⋯ de cada actividad (19/11: dejó de ser una prueba) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  const idDe = titulo => p.evaluate(t0 => (window.__sb.tablas.posts.find(x => x.title === t0) || {}).id, titulo);
  const menuDe = async id => { await p.click(`[data-action="toggle-post-menu"][data-post-id="${id}"]`); await p.waitForTimeout(150);
    return p.$$eval(".post-menu-item", l => l.filter(e => e.offsetParent).map(e => e.dataset.action)); };
  // El +: «Subir comprobantes».
  await p.click("#fabMain"); await p.waitForTimeout(150);
  eq("el + tiene «Subir comprobantes», debajo de «Nuevo posteo» y «Nuevo evento»", await p.$$eval(".fab-action", l => l.filter(b => !b.hidden).map(b => b.textContent.trim())),
    ["📝Nuevo posteo", "📅Nuevo evento", "🧾Subir comprobantes"]);
  await p.click("#fabGastos");
  eq("…lleva a «Por rendir», con «¿De qué son estos comprobantes?» abierto y el foco ahí", await hasta(p, () => !!document.querySelector(".gastos-view") && document.activeElement.id === "gxDestino"
    && document.querySelector('.admin-menu [data-key="rendir"]').classList.contains("active")), true);
  // El ⋯ de una actividad: «Rendición de gastos».
  await p.click('#tabs button[data-view="feed"]'); await p.waitForTimeout(250);
  const rosario = await idDe("Visita a la comunidad de Rosario"), rutina = await idDe("Reunión de equipo");
  eq("en el ⋯ de una actividad (Rosario: el admin la puede rendir, todavía sin rendición), «Rendición de gastos»", (await menuDe(rosario)).includes("post-gastos"), true);
  await p.click(`.post-menu-item[data-action="post-gastos"][data-post-id="${rosario}"]`);
  eq("…sin rendición, lleva a subir comprobantes con esa actividad ya elegida (sin crear una rendición vacía)", await hasta(p, (r0) => {
    const s0 = document.getElementById("gxDestino"); return !!s0 && s0.value === "post:" + r0 && !window.__sb.rpc.some(x => x[0] === "gastos_rendicion_abrir"); }, rosario), true);
  await p.click('#tabs button[data-view="feed"]'); await p.waitForTimeout(250);
  eq("una Rutina no tiene «Rendición de gastos»", (await menuDe(rutina)).includes("post-gastos"), false);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Ana: en su actividad con rendición (Rosario, ya mandada), la lleva a esa rendición; en una ajena, no aparece.
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos({ prendido: true }) });
  const idDe = titulo => p.evaluate(t0 => (window.__sb.tablas.posts.find(x => x.title === t0) || {}).id, titulo);
  const rosario = await idDe("Visita a la comunidad de Rosario"), ajena = await idDe("Charla en Bariloche");
  await p.click(`[data-action="toggle-post-menu"][data-post-id="${ajena}"]`).catch(() => {}); await p.waitForTimeout(150);
  eq("en una actividad donde no participó, no aparece", await p.$$eval(`.post-menu-item[data-action="post-gastos"]`, l => l.filter(e => e.offsetParent).length), 0);
  await p.keyboard.press("Escape");
  await p.click(`[data-action="toggle-post-menu"][data-post-id="${rosario}"]`); await p.waitForTimeout(150);
  await p.click(`.post-menu-item[data-action="post-gastos"][data-post-id="${rosario}"]`);
  eq("en la suya, con rendición, la lleva a esa rendición (mandada: en «Rendiciones»)", await hasta(p, () => /Visita a la comunidad de Rosario/.test((document.querySelector(".gx-ren-tit") || {}).textContent || "")
    && document.querySelector('.admin-menu [data-key="rendiciones"]').classList.contains("active")), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Los arreglos de la prueba como tester (X5, X6, X8, X10, X13–X16), 19/11 ---------------- */
{
  // X13: los gastos no se pueden leer: el cartel trae «Probar de nuevo», y vuelve a leer.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), iniciar: `window.__sb && (window.__sb.falloLecturaDe = "gastos");` });
  await p.evaluate(() => { window.__sb.falloLecturaDe = "gastos"; });
  await irGastos(p); await p.waitForTimeout(300);
  eq("X13: si no se pueden leer los gastos, el cartel trae «Probar de nuevo»", await p.evaluate(() => !!document.querySelector('.setup-banner [data-action="gastos-reintentar"]')), true);
  await p.evaluate(() => { window.__sb.falloLecturaDe = null; });
  await p.click('[data-action="gastos-reintentar"]');
  eq("…y al tocarlo, vuelve a leer y aparece «Por rendir»", await hasta(p, () => !document.querySelector(".setup-banner") && !!document.querySelector('[data-action="gastos-destino-abrir"]')), true);
  // X5: la cuenta corriente de Ana, con la plata que falta confirmar sin signo y con su nombre.
  await p.click('[data-action="gastos-seccion"][data-key="cuenta"]'); await p.waitForTimeout(150);
  await p.selectOption("#gxCuentaDe", ANA.email); await p.waitForTimeout(150);
  eq("X5: lo recibido que falta confirmar se ve como «Recibido, falta confirmar 200.00», sin el menos", await p.$$eval(".gx-cm-filas dt", l => l.map(d => [d.textContent, d.nextElementSibling.textContent.trim()]).filter(([k]) => /falta confirmar/.test(k))),
    [["Recibido, falta confirmar", "200.00"]]);
  await p.click('[data-action="gastos-mov-confirmar"][data-id="mv2"]');
  eq("X15: confirmar la plata de alguien avisa", await hasta(p, () => /Confirmado/.test(document.getElementById("calendarToastText").textContent)), true);
  await p.selectOption("#gxCuentaDe", PERS[2].email).catch(() => {}); await p.waitForTimeout(150);
  // X14: revisando el gasto de otra persona, la ventana no tiene «Borrar».
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("X14: revisando el gasto de otra persona, sin «Borrar» en la ventana", await p.evaluate(() => !!document.querySelector('#gastoBody [data-action="gasto-borrar"]')), false);
  await p.keyboard.press("Escape");
  eq("sin errores de página", errores.filter(e => !/Failed to fetch|leyendo los gastos/.test(e)), []);
  await p.close();
}
{
  // X6: reabierta y sin nada nuevo: sin «Nuevos o corregidos (0)» vacío ni la barra sola.
  const base = datos({ prendido: true });
  Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_rutina"), { estado: "abierta", aprobada_el: null, aprobada_por: null });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p); await abrirRen(p, "ren_rutina"); await p.waitForTimeout(150);
  eq("X6: reabierta sin nada nuevo: dice «Todavía no hay nada nuevo.», sin «(0)» ni la barra sola", await p.evaluate(() => [(document.querySelector(".gx-nada-nuevo") || {}).textContent,
    /\(0\)/.test(document.querySelector(".gastos-view").textContent), !!document.querySelector(".gx-selpie"), (document.querySelector("details.gx-ya > summary") || {}).textContent]),
    ["Todavía no hay nada nuevo.", false, false, "Ya aprobados (1)"]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // X10: en el celular, al abrir una fila de «Revisar en lista», la foto es chica.
  const { p } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.click('.bn-item[data-action="toggle-more-menu"]'); await p.waitForTimeout(150);
  await p.click('.bn-sheet-item[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  // X8: en «Rendiciones», la barra no queda pegada al resumen por mes.
  await irRendiciones(p);
  eq("X8: entre la barra y el resumen por mes hay aire (antes, 2 px)", await p.evaluate(() => { const a = document.querySelector(".gx-selpie"), r = document.querySelector("details.gx-resumen");
    if(!a || !r) return "falta " + (!a ? "la barra" : "el resumen"); a.style.position = "static"; const d = r.getBoundingClientRect().top - a.getBoundingClientRect().bottom; a.style.position = ""; return d >= 14; }), true);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('[data-action="gastos-lista-abrir"]').click()); await p.waitForTimeout(200);
  await p.evaluate(() => document.getElementById("gxLR_gx1").click()); await p.waitForTimeout(200);
  eq("X10: en el celular, la foto de la fila abierta mide como mucho 160 px de alto", await p.evaluate(() => { const f = document.querySelector(".gx-lfila.gx-abierta .gx-lfoto"); return !!f && f.getBoundingClientRect().height <= 160; }), true);
  eq("X9: la papelera de la fila, adentro de la fila abierta (cerrada, la fila no la muestra)", await p.evaluate(() => [!!document.querySelector(".gx-lfila.gx-abierta .gx-lmas [data-action=\"gastos-lista-quitar\"]"),
    [...document.querySelectorAll(".gx-lfila:not(.gx-abierta) [data-action=\"gastos-lista-quitar\"]")].length]), [true, 0]);
  await p.close();
}

/* ---------------- Confirmar con un dato dudoso del lector pregunta (D19) y sigue con el próximo (X7), 19/11 ---------------- */
{
  const base = datos({ prendido: true });
  const g1 = base.gastos.find(g => g.id === "gx1");
  // Dos por confirmar en Montevideo: el café que el lector leyó con la moneda dudosa y un taxi completo.
  Object.assign(g1, { concepto: "Café", tipo: "comida", monto: 96, moneda: "USD", lectura: { fuente: "lector", campos: ["monto", "moneda"], dudas: ["moneda"] } });
  base.gastos.push({ ...g1, id: "gx10", concepto: "Taxi al hotel", tipo: "transporte", monto: 300, moneda: "UYU", rendido_monto: 7.5, fecha: g1.fecha, lectura: null, archivo_hash: "0".repeat(64) });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p); await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("confirmar con la moneda dudosa pregunta antes, con «Sí, confirmar» y «Cambiar»", await p.evaluate(() => [!document.getElementById("confirmOverlay").hidden && document.getElementById("confirmMessage").textContent,
    document.getElementById("confirmOk").textContent, document.getElementById("confirmCancel").textContent]), ["El lector no está seguro de la moneda: ¿es USD?", "Sí, confirmar", "Cambiar"]);
  await p.click("#confirmCancel");
  eq("«Cambiar» vuelve a la moneda, sin confirmar", await hasta(p, () => document.getElementById("confirmOverlay").hidden && document.activeElement.id === "gxMoneda"
    && window.__sb.tablas.gastos.find(g => g.id === "gx1").estado === "borrador"), true);
  await p.fill("#gxMoneda", "UYU"); await p.press("#gxMoneda", "Tab");
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("tocada la moneda, confirma sin preguntar", await hasta(p, () => document.getElementById("confirmOverlay").hidden && window.__sb.tablas.gastos.find(g => g.id === "gx1").estado === "confirmado"), true);
  eq("…y la ventana sigue con el próximo por confirmar (X7)", await hasta(p, () => !document.getElementById("gastoOverlay").hidden && document.getElementById("gxConcepto") && document.getElementById("gxConcepto").value === "Taxi al hotel"), true);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("confirmado el último, se cierra", await hasta(p, () => document.getElementById("gastoOverlay").hidden && window.__sb.tablas.gastos.find(g => g.id === "gx10").estado === "confirmado"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- «Está bien» da por revisado lo dudoso del lector, sin reescribirlo (19/11) ---------------- */
{
  const base = datos({ prendido: true });
  const g1 = base.gastos.find(g => g.id === "gx1");
  Object.assign(g1, { concepto: "Uber a Reunión", tipo: "transporte", monto: 51.13, moneda: "MXN", lectura: { fuente: "lector", campos: ["monto", "moneda"], dudas: ["monto"] } });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p); await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("el monto dudoso se ve en amarillo y dice cuál es, con «Está bien»", await p.evaluate(() => [!!document.querySelector("#gxMonto[data-duda]"), !!document.querySelector('[data-action="gasto-duda-ok"]'),
    (document.querySelector(".gx-duda-ok span") || {}).textContent]), [true, true, "⚠️ Revisá el monto"]);
  await p.click('[data-action="gasto-duda-ok"]'); await p.waitForTimeout(150);
  eq("tocar «Está bien» saca la marca y el aviso, y deja el monto como estaba", await p.evaluate(() => [!!document.querySelector("#gxMonto[data-duda]"), !!document.querySelector(".gx-duda-ok"), document.getElementById("gxMonto").value]), [false, false, "51.13"]);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("y confirma sin volver a preguntar", await hasta(p, () => document.getElementById("confirmOverlay").hidden && window.__sb.tablas.gastos.find(g => g.id === "gx1").estado === "confirmado"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Gastos no firma los comprobantes al abrir la app, solo al entrar a Gastos (20/11, la app tardaba) ---------------- */
{
  const base = datos({ prendido: true });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await p.waitForTimeout(800);
  const deGastos = () => p.evaluate(() => (window.__sb.firmadas || []).filter(r => String(r).startsWith("gastos/")).length);
  eq("al abrir la app (sin entrar a Gastos) no se firma ningún comprobante de gastos", await deGastos(), 0);
  eq("…pero los datos ya están (la solapa cuenta lo que hay)", await p.evaluate(() => !!document.querySelector('.tab[data-view="gastos"], [data-view="gastos"]')), true);
  await irGastos(p); await abrirRen(p, "ren_mvd"); await p.waitForTimeout(400);
  eq("al entrar a Gastos sí se firman, y el comprobante se ve", await p.evaluate(() => [(window.__sb.firmadas || []).filter(r => String(r).startsWith("gastos/")).length > 0,
    !!document.querySelector(".gx-mini")]), [true, true]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Pasar por un campo dudoso sin cambiarlo lo da por bueno (19/11) ---------------- */
{
  const base = datos({ prendido: true });
  const g1 = base.gastos.find(g => g.id === "gx1");
  Object.assign(g1, { concepto: "Uber a Reunión", tipo: "transporte", monto: 51.13, moneda: "MXN", lectura: { fuente: "lector", campos: ["monto", "moneda"], dudas: ["monto"] } });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p); await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  await p.focus("#gxMonto"); await p.press("#gxMonto", "Tab"); await p.waitForTimeout(100);
  eq("pasar por el monto sin cambiarlo saca la marca y el aviso, y el monto sigue igual", await p.evaluate(() => [!!document.querySelector("#gxMonto[data-duda]"), !!document.querySelector(".gx-duda-ok"), document.getElementById("gxMonto").value]), [false, false, "51.13"]);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("y confirma sin preguntar", await hasta(p, () => document.getElementById("confirmOverlay").hidden && window.__sb.tablas.gastos.find(g => g.id === "gx1").estado === "confirmado"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Lo propio lo aprueba otro admin (D17) y lo observado se ve al devolver (D18), 19/11 ---------------- */
{
  const base = datos({ prendido: true });
  base.members.push({ email: "otra.admin@x.com", name: "Otra Admin", nickname: "otra", role: "admin", approved_at: "2025-01-10T12:00:00Z" });
  Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_mvd"), { estado: "enviada", enviada_el: new Date().toISOString() });
  base.gastos.filter(g => g.rendicion_id === "ren_mvd").forEach(g => Object.assign(g, { estado: "enviado", monto: g.monto == null ? 10 : g.monto, tipo: g.tipo || "transporte" }));
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  eq("con otro admin, la propia no cuenta en el número de «Para aprobar» (solo la de Ana y la plata)", await p.$eval('[data-action="gastos-seccion"][data-key="aprobar"] .pending-count', e => e.textContent).catch(() => ""), "2");
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  eq("…y abierta, dice que la aprueba otro admin, sin «Aprobar»", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-aprobar"]'), (document.querySelector(".gx-paso b") || {}).textContent]), [false, "La aprueba otro admin"]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Ana: en su rendición en revisión, un gasto observado que todavía no le devolvieron.
  const base = datos({ prendido: true, abierto: true });
  base.gastos.find(g => g.id === "gx5").estado = "observado";
  base.gastos_comentarios.push({ id: "gc9", gasto_id: "gx5", autor: ADMIN, texto: "Falta el ticket del micro", creado_el: new Date().toISOString() });
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base });
  await irGastos(p);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  eq("lo observado que todavía no le devolvieron, la persona lo ve «En revisión»", await p.$eval('[data-action="gasto-abrir"][data-id="gx5"] .gx-chip', e => e.textContent).catch(() => ""), "En revisión");
  await p.click('[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("…y en la ventana, sin la observación hasta que se la devuelvan", await p.evaluate(() => [!!document.getElementById("gxObsTit"), /Falta el ticket/.test(document.getElementById("gastoBody").textContent)]), [false, false]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Pasar de un gasto al de al lado sin cerrar (lo pidió el usuario el 16/11) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  const estado = () => p.evaluate(() => [document.getElementById("gxConcepto").value, document.querySelector(".gx-contador").textContent,
    document.getElementById("gastoAnt").disabled, document.getElementById("gastoSig").disabled]);
  eq("con varios gastos, flechas a los costados y cuál es («1 de 3»); en el primero, la de atrás no anda", await estado(), ["Taxi al aeropuerto", "1 de 3", true, false]);
  eq("las flechas quedan afuera de la caja, sin taparla", await p.evaluate(() => { const m = document.querySelector("#gastoOverlay .modal").getBoundingClientRect(),
    a = document.getElementById("gastoAnt").getBoundingClientRect(), z = document.getElementById("gastoSig").getBoundingClientRect(); return a.right <= m.left && z.left >= m.right; }), true);
  eq("cada flecha dice a cuál lleva", await p.$eval("#gastoSig", e => e.getAttribute("aria-label")), "Gasto siguiente: Hotel Rambla, dos noches");
  await p.click("#gastoSig");
  eq("la flecha pasa al siguiente sin cerrar, y el foco sigue en ella", [...await estado(), await p.evaluate(() => document.activeElement.id)], ["Hotel Rambla, dos noches", "2 de 3", false, false, "gastoSig"]);
  await p.keyboard.press("ArrowRight");
  eq("con la flecha del teclado, también", await estado(), ["Cena con los directores", "3 de 3", false, true]);
  await p.fill("#gxConcepto", "Cena con los directores y el rabino");
  await p.keyboard.press("ArrowLeft");
  eq("escribiendo en un campo, las flechas del teclado mueven el cursor, no el gasto", await p.$eval(".gx-contador", e => e.textContent), "3 de 3");
  await p.click("#gastoAnt");
  eq("con algo escrito, pregunta antes de pasar", await p.$eval("#confirmMessage", e => e.textContent).catch(() => ""), "¿Pasar al gasto anterior sin guardar lo que cambiaste?");
  await p.click("#confirmCancel");
  eq("…y si no, se queda con lo escrito", await p.$eval("#gxConcepto", e => e.value), "Cena con los directores y el rabino");
  await p.click("#gastoAnt"); await p.click("#confirmOk");
  eq("…o pasa sin guardar", await hasta(p, () => document.getElementById("gxConcepto").value === "Hotel Rambla, dos noches"), true);
  eq("y no guardó lo escrito", (await tabla(p, "gastos")).find(g => g.id === "gx3").concepto, "Cena con los directores");
  eq("en otra moneda y con el monto en dólares, «Observaciones» trae la nota de la moneda local (como en el Sheet del usuario)",
    await p.$eval("#gxObsAuto", e => [e.hidden, e.textContent.replace(/[\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim()]), [false, "Gasto en UY $ 12,000.- (se escribe sola)"]);
  await p.fill("#gxMonto", "11.500,50");
  eq("…y se pone al día mientras se escribe el monto", await p.$eval("#gxObsAuto .gx-obs-auto-txt", e => e.textContent.replace(/[\u2066-\u2069]/g, "")), "Gasto en UY $ 11,500.50");
  await p.keyboard.press("Escape"); await p.click("#confirmOk");
  eq("al cerrar, el foco vuelve a la fila del último que se vio", await hasta(p, () => document.getElementById("gastoOverlay").hidden && document.activeElement.dataset.id === "gx2"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("en el celular no hay flechas a los costados (la ventana ocupa la pantalla)", await p.$eval("#gastoSig", e => getComputedStyle(e).display), "none");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  if(await p.$("#confirmOverlay:not([hidden])")) await p.click("#confirmOk");
  // Revisión de UX del 18/11.
  eq("en el celular, todas las secciones entran (si no caben en una fila, pasan a otra: sin correr de costado), con su número", await p.evaluate(() => { const m = document.querySelector(".gastos-view .admin-menu");
    return [m.scrollWidth <= m.clientWidth + 1, [...m.querySelectorAll(".admin-item")].every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })]; }), [true, true]);
  eq("en el celular, el monto y el estado van debajo del nombre del gasto", await p.evaluate(() => { const f = document.querySelector('[data-action="gasto-abrir"][data-id="gx2"]');
    const t = f.querySelector(".gx-f-txt").getBoundingClientRect(), d = f.querySelector(".gx-f-der").getBoundingClientRect(); return d.top >= t.bottom - 1; }), true);
  eq("…y el botón de lo que sigue ocupa el ancho", await p.evaluate(() => { const b = document.querySelector(".gx-paso .btn-primary"), c = document.querySelector(".gx-paso").getBoundingClientRect();
    return !!b && b.getBoundingClientRect().width >= c.width - 40; }), true);
  await p.close();
}

/* ---------------- Elegir la moneda y las listas largas (lo pidió el usuario el 17/11) ---------------- */
// Antes: la lista del navegador, con todas las monedas, que con una ya puesta mostraba solo esa.
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  const abierta = () => p.evaluate(() => { const el = document.getElementById("selPop"); return !!el && el.matches(":popover-open"); });
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("sin la lista del navegador en los campos de moneda", await p.evaluate(() => [!!document.getElementById("gxMonedas"), document.querySelectorAll("input.gx-moneda[list]").length]), [false, 0]);
  await p.click("#gxMoneda");
  eq("con una moneda ya puesta, tocar el campo abre la lista entera", await hasta(p, () => document.getElementById("selPop") && document.getElementById("selPop").matches(":popover-open")
    && document.querySelectorAll("#selPop .rp-op:not([hidden])").length >= 26), true);
  eq("arriba, las que más usa la persona, empezando por el dólar; la puesta, marcada", await p.evaluate(() => [document.querySelector("#selPop .sel-grupo").textContent,
    document.querySelector("#selPop .rp-op").dataset.selValor, document.querySelector('#selPop .rp-op[aria-selected="true"]').dataset.selValor]), ["Las que más usás", "USD", "UYU"]);
  eq("cada una con su nombre", await p.$eval('#selPop [data-sel-valor="MXN"] .sel-sub', e => e.textContent), "Peso mexicano");
  await p.keyboard.type("mex");
  eq("escribir busca por el código o por el nombre", await p.$$eval("#selPop .rp-op:not([hidden])", l => l.map(x => x.dataset.selValor)), ["MXN"]);
  await p.keyboard.press("Enter");
  eq("Enter la elige y la ventana la toma (la nota de la moneda local cambia)", await hasta(p, () => document.getElementById("gxMoneda").value === "MXN"
    && !document.getElementById("selPop").matches(":popover-open") && /MX \$/.test(document.getElementById("gxObsAuto").textContent)), true);
  await p.click("#gxMoneda"); await hasta(p, () => document.getElementById("selPop").matches(":popover-open"));
  await p.keyboard.type("eu"); await p.keyboard.press("Escape");
  eq("Escape la cierra y deja la que había, sin cerrar la ventana del gasto", await p.evaluate(() => [document.getElementById("gxMoneda").value,
    document.getElementById("selPop").matches(":popover-open"), document.getElementById("gastoOverlay").hidden]), ["MXN", false, false]);
  await p.click("#gxMoneda"); await hasta(p, () => document.getElementById("selPop").matches(":popover-open"));
  await p.click('#selPop [data-sel-valor="EUR"]');
  eq("también se elige tocándola", await hasta(p, () => document.getElementById("gxMoneda").value === "EUR"), true);
  await p.click("#gxMoneda"); await hasta(p, () => document.getElementById("selPop").matches(":popover-open"));
  await p.keyboard.type("ars"); await p.keyboard.press("Tab");
  eq("escribir un código y salir con Tab lo deja", await p.$eval("#gxMoneda", e => e.value), "ARS");
  // «Va en», con buscador.
  await p.click("#gxVinculo");
  eq("«Va en» se abre en la misma ventanita, con un buscador", await p.evaluate(() => [document.getElementById("selPop").matches(":popover-open"), document.activeElement.id]), [true, "selBuscar"]);
  await p.keyboard.type("sin vinc");
  eq("…que filtra", await p.$$eval("#selPop .rp-op:not([hidden])", l => l.map(x => x.dataset.selValor)), [""]);
  await p.keyboard.press("Enter");
  eq("Enter la elige: la lista queda con eso y el foco vuelve a ella", await p.evaluate(() => [document.getElementById("gxVinculo").value, document.activeElement.id,
    document.getElementById("selPop").matches(":popover-open")]), ["", "gxVinculo", false]);
  await p.keyboard.press("Escape"); await p.click("#confirmOk").catch(() => {});
  // La cuenta corriente: la moneda de «Anotar plata recibida» (la de la captura del usuario).
  await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="cuenta"]').click()); await p.waitForSelector('[data-action="gastos-mov-abrir"]');
  await p.click('[data-action="gastos-mov-abrir"]'); await p.waitForSelector("#gxMov_moneda");
  await p.click("#gxMov_moneda");
  eq("en la cuenta corriente, la misma lista entera", await hasta(p, () => document.getElementById("selPop").matches(":popover-open") && document.querySelectorAll("#selPop .rp-op:not([hidden])").length >= 26), true);
  await p.click('#selPop [data-sel-valor="ILS"]');
  eq("…y se elige", await hasta(p, () => document.getElementById("gxMov_moneda").value === "ILS"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Un PDF con texto de verdad se lee sin el lector de fotos ---------------- */
// Como el recibo de Uber que trajo el usuario el 15/11 (inventado): el texto está adentro del PDF,
// así que se lee directo, aun desde un archivo local, donde el lector de fotos no corre.
{
  const contenido = "BT /F1 11 Tf 14 TL 50 760 Td (Mar 4, 2026) Tj T* (Thanks for riding, Ana) Tj T* (Total USD 8.75) Tj T* (Visa \\225\\225\\225\\2254242) Tj T* (UberX) Tj ET";
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const RECIBO = Buffer.from(`%PDF-1.4\n${objs.map((o, k) => `${k + 1} 0 obj\n${o}\nendobj\n`).join("")}5 0 obj\n<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, "latin1");
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  const antes = (await tabla(p, "gastos")).length;
  await subirDesdeCabecera(p, "", [{ name: "recibo-viaje.pdf", mimeType: "application/pdf", buffer: RECIBO }]);
  eq("un PDF con texto se lee aunque no haya lector de fotos: fecha, total, moneda, tarjeta, la app y el tipo", await hasta(p, n => {
    const g = (window.__sb.tablas.gastos || []).slice(n)[0];
    return !!g && g.lectura && g.lectura.fuente === "lector" && g.estado === "borrador" && JSON.stringify([g.fecha, g.monto, g.moneda, g.tarjeta, g.concepto, g.tipo]) === JSON.stringify(["2026-03-04", 8.75, "USD", "4242", "Uber", "transporte"]); }, antes), true);
  eq("…y, leído, el cartel se va solo: queda el aviso pasajero", await hasta(p, () => /Se subió 1 comprobante/.test(document.getElementById("calendarToastText").textContent) && !document.querySelector(".gx-subida")), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Revisar en lista: confirmar varios juntos ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  const antes = (await tabla(p, "gastos")).length;
  await subirDesdeCabecera(p, "", [
    { name: "12-11-2026 - Almuerzo - Lima.png", mimeType: "image/png", buffer: PNG },
    { name: "factura.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "foto.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([0])]) }]);
  await hasta(p, n => (window.__sb.tablas.gastos || []).filter(g => g.archivo).length >= n + 3, antes);
  await p.waitForTimeout(150);
  const nuevos = (await tabla(p, "gastos")).slice(antes);
  const id = nombre => (nuevos.find(g => g.archivo_nombre === nombre) || {}).id;
  eq("con varios por confirmar, la barra dice cuántos y ofrece «Revisar y confirmar»", await p.evaluate(() => [(document.querySelector(".gx-paso b") || {}).textContent,
    (document.querySelector('.gx-paso [data-action="gastos-lista-abrir"]') || {}).textContent]), ["Faltan confirmar 4 gastos", "✏️ Revisar y confirmar"]);
  await p.click('[data-action="gastos-lista-abrir"]'); await p.waitForTimeout(150);
  eq("la lista: una fila por gasto, ninguna marcada (a ninguno le está todo)", await p.$$eval(".gx-lfila", l => l.map(e => e.querySelector("[data-glista-marca]").checked)), [false, false, false, false]);
  eq("sin nada marcado ni cambiado, el botón dice lo que haría y espera", await p.$eval('[data-action="gastos-lista-guardar"]', e => [e.textContent.trim(), e.disabled]), ["Guardar sin confirmar", true]);
  const a = id("12-11-2026 - Almuerzo - Lima.png"), f = id("factura.pdf"), c = id("foto.png");
  // «Lista» (la de entrada): filas chicas, cerradas, que dicen qué es, cuánto y qué les falta (lo propuso el usuario el 15/11).
  eq("de entrada, la vista «Lista»: cada gasto en una fila chica, cerrada", await p.evaluate(() => [document.querySelector('[data-action="gastos-lista-vista"][aria-pressed="true"]').dataset.vista,
    document.querySelectorAll(".gx-lfila .gx-lcuerpo").length, [...document.querySelectorAll(".gx-lresumen")].every(e => e.getAttribute("aria-expanded") === "false")]), ["lista", 0, true]);
  eq("la casilla va sin la palabra (se entiende), con su nombre para los lectores de pantalla", await p.evaluate(a => [document.getElementById(`gxL_${a}_marca`).closest("label").textContent.trim(),
    document.getElementById(`gxL_${a}_marca`).getAttribute("aria-label")], a), ["", "Confirmar «Almuerzo»"]);
  eq("la fila chica dice qué es, cuánto y qué le falta", await p.$eval(`#gxLR_${a}`, e => e.innerText.replace(/\s+/g, " ").trim()), "Almuerzo 12 de nov de 2026 · Comida Sin monto Falta: monto");
  await p.click(`#gxLR_${a}`);
  eq("tocarla la despliega, con el comprobante y los campos, y el foco sigue ahí", await p.evaluate(a => [document.getElementById(`gxLR_${a}`).getAttribute("aria-expanded"),
    !!document.querySelector(`#gxLB_${a} .gx-lfoto`), !!document.getElementById(`gxL_${a}_monto`), document.activeElement.id], a), ["true", true, true, `gxLR_${a}`]);
  eq("cada fila trae lo que sugirió el nombre del archivo", await p.$eval(`#gxL_${a}_concepto`, e => [e.value, e.dataset.sug]), ["Almuerzo", "1"]);
  // El almuerzo: tipo y monto. Al quedar completo se marca solo, y la fila chica lo dice.
  await p.selectOption(`#gxL_${a}_tipo`, "comida"); await p.fill(`#gxL_${a}_monto`, "20"); await p.press(`#gxL_${a}_monto`, "Tab"); await p.waitForTimeout(100);
  eq("completa, la fila se marca sola", await p.$eval(`#gxL_${a}_marca`, e => e.checked), true);
  eq("…y «Marcar todos» queda a medias (una de cuatro)", await p.$eval("#gxListaTodos", e => [e.checked, e.indeterminate]), [false, true]);
  // Las observaciones, como la columna de la skill del usuario: en la fila, y se ven en el resumen.
  await p.fill(`#gxL_${a}_observaciones`, "Con el equipo de Lima");
  eq("…y su resumen se pone al día mientras se escribe, con las observaciones", await p.$eval(`#gxLR_${a}`, e => e.innerText.replace(/\s+/g, " ").trim()), "Almuerzo 12 de nov de 2026 · Comida 💬 Con el equipo de Lima USD 20.00 Completo");
  eq("…y la cuenta de abajo también", await p.$eval("#gxListaCuenta", e => e.textContent), "1 de 4 marcados");
  await p.click(`#gxLR_${a}`);
  eq("tocarla de nuevo la cierra, sin perder lo escrito", await p.evaluate(a => [!document.getElementById(`gxL_${a}_monto`), document.getElementById(`gxL_${a}_marca`).checked], a), [true, true]);
  // «Con foto»: todas abiertas, con el comprobante mediano; se recuerda.
  await p.click('[data-action="gastos-lista-vista"][data-vista="foto"]');
  eq("«Con foto» abre todas, con el comprobante al lado", await p.$$eval(".gx-lfila", l => l.map(e => { const x = e.querySelector(".gx-lfoto"); return !!x && x.getBoundingClientRect().height >= 140; })), [true, true, true, true]);
  eq("…y lo escrito sigue ahí", await p.$eval(`#gxL_${a}_monto`, e => e.value), "20.00");
  eq("la vista elegida queda guardada en este navegador", await p.evaluate(() => localStorage.getItem("ra_gastos_vista")), "foto");
  // La factura, en pesos: aparece el monto en dólares.
  await p.fill(`#gxL_${f}_fecha`, "2026-11-10"); await p.fill(`#gxL_${f}_concepto`, "Fotocopias");
  eq("en la lista, escribir el concepto sugiere el tipo", await p.$eval(`#gxL_${f}_tipo`, e => [e.value, e.dataset.sug]), ["material", "1"]);
  await p.selectOption(`#gxL_${f}_tipo`, "material");
  await p.fill(`#gxL_${f}_monto`, "3000"); await p.fill(`#gxL_${f}_moneda`, "ars"); await p.press(`#gxL_${f}_moneda`, "Tab"); await p.waitForTimeout(100);
  eq("en otra moneda aparece «En USD», con la moneda en mayúsculas", await p.evaluate(f => [document.getElementById(`gxL_${f}_moneda`).value, !!document.getElementById(`gxL_${f}_rendidoMonto`)], f), ["ARS", true]);
  eq("el monto, contable como el Sheet: se acomoda al salir del campo", await p.$eval(`#gxL_${f}_monto`, e => e.value), "3,000.00");
  await p.fill(`#gxL_${f}_monto`, "2.999,50"); await p.press(`#gxL_${f}_monto`, "Tab");
  eq("…y se puede escribir a la manera de acá («2.999,50»)", await p.$eval(`#gxL_${f}_monto`, e => e.value), "2,999.50");
  await p.fill(`#gxL_${f}_monto`, "3000"); await p.press(`#gxL_${f}_monto`, "Tab");
  await p.fill(`#gxL_${f}_rendidoMonto`, "3");
  eq("en la lista, la fila en otra moneda trae la nota de la moneda local en sus observaciones", await p.$eval(`#gxL_${f}_obsAuto .gx-obs-auto-txt`, e => e.textContent.replace(/[\u2066-\u2069]/g, "")), "Gasto en AR $ 3,000.-");
  // La foto sin datos: marcada a mano, para ver que no se confirma incompleta.
  await p.check(`#gxL_${c}_marca`);
  // «La misma moneda a todos»: se prueba y se vuelve (la factura queda en ARS, el resto en USD).
  // gx8: se le escribe el concepto y se deja sin marcar.
  await p.fill("#gxL_gx8_concepto", "Remís");
  await p.uncheck("#gxL_gx8_marca").catch(() => {});
  eq("el botón dice cuántos va a confirmar", await p.$eval('[data-action="gastos-lista-guardar"]', e => e.textContent.trim()), "Confirmar los 3 marcados");
  await p.selectOption("#gxListaDestino", "post:p9");
  await p.click('[data-action="gastos-lista-guardar"]');
  eq("confirmar: los completos quedan confirmados y en la actividad elegida", await hasta(p, ([a, f]) => { const g = id => window.__sb.tablas.gastos.find(x => x.id === id);
    return g(a).estado === "confirmado" && g(a).rendicion_id === "ren_mvd" && g(a).tipo === "comida" && g(a).monto === 20 && g(a).observaciones === "Con el equipo de Lima"
      && g(f).estado === "confirmado" && g(f).moneda === "ARS" && g(f).monto === 3000 && g(f).rendido_monto === 3 && g(f).concepto === "Fotocopias"; }, [a, f]), true);
  eq("lo editado sin marcar se guarda sin confirmar, sin moverlo", await hasta(p, () => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx8"); return g.estado === "borrador" && g.concepto === "Remís" && !g.rendicion_id; }), true);
  eq("el incompleto no se confirma: queda en la lista con lo que falta", await p.evaluate(c => [window.__sb.tablas.gastos.find(x => x.id === c).estado,
    (document.querySelector(`#gxL_${c}_marca`) || {}).closest ? document.getElementById(`gxL_${c}_marca`).closest(".gx-lfila").querySelector(".gx-lerror").textContent : "",
    document.getElementById(`gxL_${c}_tipo`).getAttribute("aria-invalid")], c), ["borrador", "Falta la fecha, el concepto, el tipo, el monto.", "true"]);
  eq("y el aviso cuenta lo que pasó", await textos(p, ".gx-lista-rev .gx-alerta"), ["Se confirmaron 2 gastos. 1 quedó guardado sin confirmar. 1 no se pudo confirmar: mirá lo marcado en su fila."]);
  eq("en la lista quedan los dos que faltan", await p.$$eval(".gx-lfila", l => l.length), 2);
  await p.click('[data-action="gastos-lista-vista"][data-vista="lista"]');
  eq("en «Lista», el que no se pudo confirmar se ve abierto, con lo que falta; el otro, cerrado", await p.evaluate(c => [!!document.getElementById(`gxLB_${c}`), !!document.getElementById("gxLB_gx8")], c), [true, false]);
  await p.click('[data-action="gastos-lista-cerrar"]'); await p.waitForTimeout(150);
  eq("«Salir de la lista» sin cambios nuevos no pregunta", await p.evaluate(() => [!document.querySelector(".gx-lista-rev"), document.getElementById("confirmOverlay").hidden]), [true, true]);
  await p.click('[data-action="gastos-lista-abrir"]'); await p.waitForTimeout(150);
  eq("al volver a entrar, sigue en la vista elegida", await p.$eval('[data-action="gastos-lista-vista"][aria-pressed="true"]', e => e.dataset.vista), "lista");
  await p.click('[data-action="gastos-lista-ver"][data-id="gx8"]');
  await p.fill("#gxL_gx8_monto", "15");
  await p.click('[data-action="gastos-lista-cerrar"]');
  eq("con cambios sin guardar, pregunta antes de volver", await p.evaluate(() => !document.getElementById("confirmOverlay").hidden), true);
  await p.click("#confirmCancel"); await p.waitForTimeout(100);
  eq("…y si no, sigue en la lista con lo escrito", await p.$eval("#gxL_gx8_monto", e => e.value), "15.00");
  // «La misma moneda a todos».
  await p.fill("#gxListaMoneda", "brl"); await p.click('[data-action="gastos-lista-moneda"]'); await p.waitForTimeout(100);
  await p.click('[data-action="gastos-lista-vista"][data-vista="foto"]');
  eq("«La misma moneda a todos» la pone en cada fila", await p.$$eval('.gx-lfila input[data-glista$=":moneda"]', l => l.map(e => e.value)), ["BRL", "BRL"]);
  // «Marcar todos»: una casilla en la misma columna que las de las filas.
  await p.check("#gxListaTodos");
  eq("«Marcar todos» marca todas", await p.evaluate(() => [[...document.querySelectorAll("[data-glista-marca]")].every(e => e.checked), document.getElementById("gxListaCuenta").textContent]), [true, "2 de 2 marcados"]);
  await p.uncheck("#gxListaTodos");
  eq("…y las desmarca", await p.evaluate(() => [[...document.querySelectorAll("[data-glista-marca]")].some(e => e.checked), document.getElementById("gxListaTodos").indeterminate]), [false, false]);
  eq("está en la misma columna que las casillas de las filas", await p.evaluate(() => { const x = r => r.getBoundingClientRect(), t = x(document.getElementById("gxListaTodos")), f = x(document.querySelector("[data-glista-marca]"));
    return Math.abs((t.left + t.right) / 2 - (f.left + f.right) / 2) <= 2; }), true);
  // Borrar desde la lista.
  await p.click(`[data-action="gastos-lista-quitar"][data-id="${c}"]`); await aceptar(p);
  eq("«Borrar» en una fila de la lista la borra (preguntando)", await hasta(p, c => !window.__sb.tablas.gastos.some(g => g.id === c) && document.querySelectorAll(".gx-lfila").length === 1, c), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Lo ya aprobado: se ve como texto y el admin fijo lo puede borrar (lo pidió el usuario el 17/11) ---------------- */
{
  const ROL = "rita@team-latam.com";
  const base = datos({ prendido: true });
  base.members = base.members.concat([{ email: ROL, name: "Rita Rol", nickname: "rita", role: "admin", approved_at: "2025-01-10T12:00:00Z" }]);
  const gx4 = base.gastos.find(g => g.id === "gx4");
  Object.assign(gx4, { moneda: "MXN", monto: 642, rendido_monto: 35.2, forma_pago: "tarjeta", tarjeta: "5555", observaciones: "Ida y vuelta" });
  // Dos más en la misma rutina aprobada, para «Seleccionar».
  base.gastos.push({ ...gx4, id: "gx9", concepto: "Café con el equipo", tipo: "comida", moneda: "USD", monto: 6, rendido_monto: null, forma_pago: "efectivo", tarjeta: null, observaciones: "",
    archivo: "gastos/gx9/c.jpg", archivo_hash: "9".repeat(64) });
  base.gastos.push({ ...gx4, id: "gx10", concepto: "Estacionamiento", tipo: "transporte", moneda: "USD", monto: 4, rendido_monto: null, forma_pago: "efectivo", tarjeta: null, observaciones: "",
    archivo: "gastos/gx10/c.jpg", archivo_hash: "8".repeat(64) });

  // Un admin por rol: ve lo mandado por otra persona, pero no lo borra.
  {
    const { p, errores } = await entrar(b, ROL, "Rita Rol", { viewport: vp, base: structuredClone(base) });
    await irGastos(p);
    await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
    await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
    eq("un admin por rol no tiene «Borrar esta rendición» ni «Seleccionar» en una mandada", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.querySelector('[data-action="gastos-sel-abrir"]')]), [false, false]);
    await tocar(p, '[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForTimeout(200);
    eq("…ni «Borrar» en el gasto (sí «Observar»)", await p.evaluate(() => [!!document.querySelector('#gastoBody [data-action="gasto-borrar"]'), !!document.querySelector("#gxObs")]), [false, true]);
    eq("sin errores de página (admin por rol)", errores, []);
    await p.close();
  }

  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await abrirRen(p, "ren_rutina"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx4"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto aprobado se ve como texto: sin campos ni botones apagados, sin «Guardar»", await p.evaluate(() => [document.getElementById("gxConcepto").tagName, document.getElementById("gxConcepto").textContent,
    document.querySelectorAll("#gastoBody input, #gastoBody select, #gastoBody textarea, #gastoBody .gx-opc").length, !!document.querySelector('[data-action="gasto-guardar"]')]),
    ["SPAN", "Remís a la reunión de equipo", 0, false]);
  eq("…dice que está aprobado", await leer(p, "#gastoBody .gx-res-estado", e => /^Aprobado el .+: ya no se cambia\.$/.test(e.textContent)), true);
  eq("…el monto, y lo rendido en dólares", await leer(p, "#gastoBody .gx-res-plata", e => e.innerText.replace(/\s+/g, " ").trim()), "MXN 642.00 Rendido: USD 35.20");
  eq("…y cada dato con su nombre", await p.$$eval("#gastoBody .gx-res-fila", l => l.map(f => [f.querySelector("dt").textContent, f.querySelector("dd").innerText.replace(/[\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim()])
    .filter(([k]) => !["Fecha", "Va en"].includes(k))),
    [["Tipo", "Transporte"], ["Forma de pago", "Tarjeta terminada en 5555"], ["¿Quién pagó?", "Yo Entra en tu cuenta corriente."], ["Factura", "✓ Tiene factura o comprobante válido"],
     ["Observaciones", "Gasto en MX $ 642.- Ida y vuelta"]]);
  eq("el admin fijo lo puede borrar igual", !!(await p.$('#gastoBody [data-action="gasto-borrar"]')), true);
  await tocar(p, '#gastoBody [data-action="gasto-borrar"]');
  eq("…y antes avisa que sale de la cuenta corriente", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => e.textContent.trim()), "¿Borrar este gasto y su comprobante? Ya está aprobado: sale también de tu cuenta corriente.");
  await tocar(p, "#confirmOk");
  eq("…lo borra y cierra la ventana", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.id === "gx4") && document.getElementById("gastoOverlay").hidden), true);

  // Varios de una rendición aprobada.
  if(!(await p.evaluate(() => document.getElementById("gastoOverlay").hidden))) await p.keyboard.press("Escape");
  await hasta(p, () => document.querySelectorAll("[data-gsel]").length === 2);   // con la máquina cargada, la lista se redibuja un poco después
  eq("en una aprobada, cada fila tiene su casilla, prendida", await p.evaluate(() => [...document.querySelectorAll("[data-gsel]")].map(x => !x.disabled)), [true, true]);
  await p.check("#gxSelTodos", { timeout: 3000 }).catch(() => {});
  await tocar(p, '[data-action="gastos-sel-borrar"]');
  eq("borrar varios de una aprobada: avisa cuántos ya están aprobados", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => e.textContent.trim()),
    "¿Borrar los 2 gastos seleccionados y sus comprobantes? No se puede deshacer. 2 ya están aprobados: salen también de tu cuenta corriente.");
  await tocar(p, "#confirmOk");
  eq("…y los borra", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.rendicion_id === "ren_rutina")), true);

  // Una rendición de otra persona, ya mandada (desde «Para aprobar»).
  if(await p.$("#confirmOverlay:not([hidden])")) await p.keyboard.press("Escape");
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  eq("una mandada de otra persona: el admin fijo tiene «Borrar esta rendición» y «Borrar» en la barra", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.querySelector('.gx-selpie [data-action="gastos-sel-borrar"]')]), [true, true]);
  await tocar(p, '[data-action="gastos-rendicion-borrar"]');
  eq("…avisa que está en revisión", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => / Ana Pérez ya la mandó: está en revisión\.$/.test(e.textContent.trim())), true);
  await tocar(p, "#confirmOk");
  eq("…la borra entera con la función de la base", await hasta(p, () => !window.__sb.tablas.gastos_rendiciones.some(r => r.id === "ren_ana") && !window.__sb.tablas.gastos.some(g => g.rendicion_id === "ren_ana")), true);
  eq("…y el foco no se pierde", await p.evaluate(() => document.activeElement && document.activeElement !== document.body), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Sin barra para correr de costado con la ventana angosta (lo vio el usuario el 17/11) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: { width: 1024, height: 768 }, base: datos({ prendido: true }) });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("a 1024 px, los datos del gasto entran a lo ancho", await p.$eval(".gx-v-form", f => f.scrollWidth <= f.clientWidth), true);
  eq("…y el monto se lee entero", await p.$eval("#gxMonto", x => x.scrollWidth <= x.clientWidth), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- El comprobante de la cuenta corriente, opcional (lo pidió el usuario el 17/11) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  await p.click('[data-action="gastos-seccion"][data-key="cuenta"]'); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gastos-mov-abrir"]');
  await elegirSiHay(p, '[data-action="gastos-mov-adjuntar"][data-id=""]', { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
  eq("un archivo que no es foto ni PDF se avisa en el formulario", await hasta(p, () => /«notas\.txt» no es una foto ni un PDF\./.test((document.querySelector(".gx-anotar .form-error") || {}).textContent || "")), true);
  await elegirSiHay(p, '[data-action="gastos-mov-adjuntar"][data-id=""]', { name: "transferencia.png", mimeType: "image/png", buffer: PNG });
  eq("elegido, se ve su nombre y se puede quitar (el foco va a «Quitar»)", await hasta(p, () => /transferencia\.png/.test((document.querySelector(".gx-mov-arch") || {}).textContent || "")
    && document.activeElement.dataset.action === "gastos-mov-adj-quitar"), true);
  await tocar(p, '[data-action="gastos-mov-adj-quitar"]');
  eq("quitarlo vuelve a ofrecer «Adjuntar comprobante»", await p.evaluate(() => [!document.querySelector(".gx-mov-arch"), document.activeElement.dataset.action || ""]), [true, "gastos-mov-adjuntar"]);
  await elegirSiHay(p, '[data-action="gastos-mov-adjuntar"][data-id=""]', { name: "transferencia.png", mimeType: "image/png", buffer: PNG });
  await hasta(p, () => !!document.querySelector(".gx-mov-arch"));
  await p.fill("#gxMov_monto", "250"); await p.fill("#gxMov_descripcion", "Adelanto para Lima");
  await p.click('[data-action="gastos-mov-anotar"]');
  eq("anotar con comprobante: queda en la carpeta del movimiento, con su nombre y su tipo", await hasta(p, () => {
    const m = window.__sb.tablas.gastos_movimientos.find(x => x.descripcion === "Adelanto para Lima");
    return !!m && String(m.archivo).startsWith(`gastos/mov-${m.id}/comprobante_`) && m.archivo_nombre === "transferencia.png" && m.archivo_tipo === "image/jpeg"; }), true);
  eq("…el archivo se subió ahí", await p.evaluate(() => { const m = window.__sb.tablas.gastos_movimientos.find(x => x.descripcion === "Adelanto para Lima");
    return !!m && window.__sb.subidas.some(([r]) => r === m.archivo); }), true);
  eq("…y el formulario se cierra, limpio", await hasta(p, () => !document.querySelector(".gx-mov-arch") && !document.getElementById("gxMov_monto") && !!document.querySelector('[data-action="gastos-mov-abrir"]')), true);
  const nuevo = await p.evaluate(() => (window.__sb.tablas.gastos_movimientos.find(x => x.descripcion === "Adelanto para Lima") || {}).id || "");
  eq("en la lista: «Ver el comprobante»", await hasta(p, id => !!document.querySelector(`[data-action="gastos-mov-ver"][data-id="${id}"]:not([disabled])`), nuevo), true);
  await tocar(p, `[data-action="gastos-mov-ver"][data-id="${nuevo}"]`);
  eq("…lo abre en el visor", await hasta(p, () => document.getElementById("lightbox").classList.contains("show")), true);
  await p.keyboard.press("Escape");
  // Adjuntarlo después a uno ya anotado (el admin, aunque esté confirmado).
  await elegirSiHay(p, '[data-action="gastos-mov-adjuntar"][data-id="mv1"]', { name: "recibo.pdf", mimeType: "application/pdf", buffer: PDF });
  eq("adjuntar después a un movimiento ya anotado (un PDF)", await hasta(p, () => { const m = window.__sb.tablas.gastos_movimientos.find(x => x.id === "mv1");
    return String(m.archivo).startsWith("gastos/mov-mv1/comprobante_") && m.archivo.endsWith(".pdf") && m.archivo_tipo === "application/pdf"; }), true);
  eq("…y el foco queda en «Ver el comprobante»", await hasta(p, () => document.activeElement.dataset.action === "gastos-mov-ver" && document.activeElement.dataset.id === "mv1"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- «Te observaron un gasto»: la campanita, el correo y su enlace (17/11/2026; lo acordado el 15/11) ---------------- */
{
  // Diego (integrante, con el módulo abierto al equipo) tiene la cena observada por Benny (gx7, con su comentario).
  const conDiego = (cambiar) => { const base = datos({ prendido: true, abierto: true }); base.app_config.find(c => c.key === "preferences").value.correos = { quienes: "todos" };
    if(cambiar) cambiar(base); return base; };
  const globito = p => p.$eval(".mention-dot", e => Number(e.textContent)).catch(() => 0);
  let sinObservar;
  {
    const { p } = await entrar(b, PERS[2].email, PERS[2].name, { viewport: vp, base: conDiego(base => { base.gastos.find(g => g.id === "gx7").estado = "confirmado"; }) });
    sinObservar = await globito(p);
    await p.close();
  }
  const { p, errores } = await entrar(b, PERS[2].email, PERS[2].name, { viewport: vp, base: conDiego() });
  eq("el globito de la campanita cuenta el gasto observado", await globito(p), sinObservar + 1);
  await p.click('[data-action="toggle-mentions-menu"]'); await p.waitForTimeout(150);
  eq("la campanita: «Gastos para corregir» arriba de todo, con quién lo observó y qué pidió", await p.evaluate(() => {
    const sec = [...document.querySelectorAll(".mentions-menu .bell-section")].map(e => e.textContent.trim());
    const it = document.querySelector('.mentions-menu [data-action="goto-gasto"]');
    return it && [sec[0], it.dataset.id, /@benny/.test(it.querySelector(".mi-author").textContent), it.classList.contains("nuevo"),
      it.querySelector(".mi-content").textContent.trim() === "⚠️ «Cena»: Falta la factura: ¿la podés subir de nuevo?",
      /^Visita a la comunidad de Rosario · /.test(it.querySelector(".mi-date").textContent.trim())];
  }), ["Gastos para corregir", "gx7", true, true, true, true]);
  eq("abrirla lo marca visto: el globito se va", await p.evaluate(() => !document.querySelector(".mention-dot")), true);
  await tocar(p, '[data-action="bell-filtro"][data-key="gastos"]');
  eq("el filtro «Gastos» deja solo eso", await p.$$eval(".mentions-menu .bell-section", l => l.map(e => e.textContent.trim())), ["Gastos para corregir"]);
  await tocar(p, '.mentions-menu [data-action="goto-gasto"][data-id="gx7"]');
  eq("detrás, la rendición: el camino en «Corregir» y la barra que lleva al gasto observado", await hasta(p, () =>
    (document.querySelector('.gx-camino [aria-current="step"]') || {}).textContent === "2Corregir" && (document.querySelector(".gx-paso b") || {}).textContent === "Te observaron un gasto"
    && !!document.querySelector('.gx-paso [data-action="gasto-abrir"][data-id="gx7"]')), true);
  eq("tocarlo abre el gasto en su rendición, con el comentario a la vista", await hasta(p, () => !document.getElementById("gastoOverlay").hidden
    && /Falta la factura/.test(document.querySelector("#gastoBody .gx-hilo").textContent) && !!document.querySelector(".gastos-view .gx-volver")), true);
  await tocar(p, '#gastoBody [data-action="gasto-guardar"][data-confirmar="1"]');
  await hasta(p, () => document.getElementById("gastoOverlay").hidden);
  if(!(await p.$(".mentions-menu"))){ await p.click('[data-action="toggle-mentions-menu"]'); await p.waitForTimeout(150); }
  eq("corregido, sale de la campanita", await p.$$eval('.mentions-menu [data-action="goto-gasto"]', l => l.length), 0);
  if(await p.$(".mentions-menu")) await p.click('[data-action="toggle-mentions-menu"]');
  if(!(await p.evaluate(() => document.getElementById("gastoOverlay").hidden))) await p.keyboard.press("Escape");
  // La preferencia del correo, en Mis preferencias → Notificaciones.
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="configuracion"]');
  await p.click('[data-action="config-section"][data-key="notificaciones"]'); await p.waitForTimeout(200);
  eq("en las notificaciones: «Gastos que me observan», prendido de fábrica", await p.$$eval('.avisos-correo input[data-pref="emailGastos"]', l => l.map(x => x.checked)), [true]);
  await tocar(p, '.avisos-correo input[data-pref="emailGastos"] + .pref-slider');
  eq("apagarlo lo guarda", await hasta(p, e => (((window.__sb.tablas.user_prefs || []).find(f => f.email === e) || {}).prefs || {}).emailGastos === false, PERS[2].email), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // El botón del correo: ?gasto=<id>. Abre el gasto apenas llegan los gastos, y limpia la dirección.
  const base = datos({ prendido: true, abierto: true });
  const { p, errores } = await entrar(b, PERS[2].email, PERS[2].name, { viewport: vp, base, query: "?gasto=gx7" });
  eq("el enlace del correo abre ese gasto", await hasta(p, () => !document.getElementById("gastoOverlay").hidden && document.getElementById("gxConcepto").value === "Cena"), true);
  eq("…y se limpia la dirección (recargar no vuelve a saltar ahí)", await p.evaluate(() => location.search), "");
  eq("sin errores de página", errores, []);
  await p.close();
  // Un admin que abre el enlace de un gasto de otra persona: lo ve desde «Para aprobar».
  const { p: q, errores: e2 } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), query: "?gasto=gx5" });
  eq("un admin con el enlace de un gasto ajeno: lo abre, desde «Para aprobar»", await hasta(q, () => !document.getElementById("gastoOverlay").hidden
    && /Para aprobar/.test((document.querySelector(".gastos-view .gx-volver") || {}).textContent || "")), true);
  eq("sin errores de página", e2, []);
  await q.close();
  // Alguien que no tiene ese gasto (o uno que ya no está): no pasa nada.
  const { p: r, errores: e3 } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), query: "?gasto=no-existe" });
  await r.waitForTimeout(500);
  eq("un enlace a un gasto que no está: no abre nada ni se rompe", await r.evaluate(() => [document.getElementById("gastoOverlay").hidden, location.search]), [true, ""]);
  eq("sin errores de página", e3, []);
  await r.close();
}

/* ---------------- «Otra persona» pagó, y reabrir una aprobada (lo decidió el usuario el 18/11) ---------------- */
{
  const base = datos({ prendido: true });
  const mes = base.gastos_rendiciones.find(r => r.id === "ren_rutina").rutina_mes;
  // Un comprobante que llegó tarde: del mes de la rutina ya aprobada, sin vincular.
  Object.assign(base.gastos.find(g => g.id === "gx8"), { fecha: mes });
  // En la rutina aprobada, uno que pagó Ana.
  Object.assign(base.gastos.find(g => g.id === "gx4"), { pago: "otro", pago_quien: ANA.email });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  eq("en gastos no está el «+» de nuevo evento (tapaba botones de gastos)", await p.evaluate(() => { const f = document.getElementById("fab"); return !f || getComputedStyle(f).display === "none"; }), true);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  eq("los estados de los gastos: «Falta confirmar» y «Confirmado» (antes «Listo»)", await textos(p, ".gx-filas .gx-chip"), ["Falta confirmar", "Confirmado", "Confirmado"]);
  await p.click('[data-action="gasto-abrir"][data-id="gx3"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("«¿Quién pagó?» tiene una tercera opción: «Otra persona»", await p.$$eval("#gxPago [data-pago]", l => l.map(b => b.textContent.trim())), ["Yo", "Organización", "Otra persona"]);
  await tocar(p, "#gxPagoOtro");
  eq("elegida, pide quién (los del equipo, sin quien rinde) y dice que no entra en ninguna cuenta", await p.evaluate(() => [
    [...document.querySelectorAll("#gxPagoQuien option")].slice(1).map(o => o.textContent), (document.querySelector("#gxPago ~ .gx-pista, .gx-fila-opc:has(#gxPago) .gx-pista") || {}).textContent]),
    [["Ana Pérez", "Diego Martínez", "Lucía Fernández Goldberg", "Moshe Levi"], "No entra en ninguna cuenta corriente."]);
  await tocar(p, '#gastoBody [data-action="gasto-guardar"][data-confirmar="1"]');
  eq("sin decir quién, no se confirma: lo pide y va a ese campo", await p.evaluate(() => [(document.querySelector("#gastoBody .form-error") || {}).textContent, document.activeElement.id]),
    ["Para confirmarlo falta quién pagó.", "gxPagoQuien"]);
  await p.selectOption("#gxPagoQuien", ANA.email).catch(() => {});
  await tocar(p, '#gastoBody [data-action="gasto-guardar"][data-confirmar="1"]');
  eq("…con quién, se guarda: «otro» y su correo", await hasta(p, e => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx3"); return g.pago === "otro" && g.pago_quien === e && g.estado === "confirmado"; }, ANA.email), true);
  eq("la fila lo dice", await hasta(p, () => /pagó: Ana Pérez/.test((document.querySelector('[data-action="gasto-abrir"][data-id="gx3"]') || {}).textContent || "")), true);
  eq("…y la ventana sigue con el que falta confirmar (X7)", await p.evaluate(() => !document.getElementById("gastoOverlay").hidden && document.getElementById("gxConcepto").value), "Taxi al aeropuerto");
  await p.keyboard.press("Escape"); await hasta(p, () => document.getElementById("gastoOverlay").hidden);
  // La rutina aprobada: el gasto que pagó otra persona, como texto; y «Reabrir».
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_rutina"); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gasto-abrir"][data-id="gx4"]'); await p.waitForTimeout(300);
  eq("en un gasto aprobado que pagó otra persona: quién y que no entra en ninguna cuenta", await p.$$eval("#gastoBody .gx-res-fila", l => l.map(f => [f.querySelector("dt").textContent, f.querySelector("dd").innerText.replace(/[\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim()])
    .filter(([k]) => k === "¿Quién pagó?")), [["¿Quién pagó?", "Ana Pérez No entra en ninguna cuenta corriente."]]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  eq("una rendición aprobada: un admin tiene «Reabrir»", await p.evaluate(() => { const b = document.querySelector('[data-action="gastos-reabrir"]'); return b && b.textContent.trim(); }), "↩️ Reabrir");
  await tocar(p, '[data-action="gastos-reabrir"]');
  eq("…pregunta antes, diciendo que lo aprobado queda aprobado", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => e.textContent.trim()),
    `¿Reabrir «Rutina de ${await p.evaluate(m => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "T12:00:00Z")), mes)}»? Lo aprobado queda aprobado: después se revisa solo lo que se sume o corrija.`);
  await tocar(p, "#confirmOk");
  eq("…la reabre con la función de la base: vuelve a abierta y lo aprobado sigue aprobado", await hasta(p, () => {
    const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_rutina"), g = window.__sb.tablas.gastos.find(x => x.id === "gx4");
    return r.estado === "abierta" && g.estado === "aprobado" && !!document.querySelector('.gastos-view [data-action="gastos-subir"][data-id="ren_rutina"]'); }), true);
  eq("…la barra dice qué sigue: sumar lo que faltaba o, si no había nada, volver a mandarla con el botón de siempre", await leer(p, ".gx-paso", e => [e.querySelector("b").textContent.trim(),
    [...e.querySelectorAll("button")].map(b => [b.dataset.action, b.textContent.replace(/\s+/g, " ").trim()])]),
    ["Reabierta: sumá lo que faltaba o volvé a mandarla", [["gastos-subir", "📎 Subir comprobantes"], ["gastos-enviar", "Volver a mandar la rendición"]]]);
  await tocar(p, '.gx-paso [data-action="gastos-enviar"]'); await aceptar(p).catch(() => {});
  eq("…y mandada así, sin nada nuevo, queda en revisión con lo aprobado intacto", await hasta(p, () => { const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_rutina"), g = window.__sb.tablas.gastos.find(x => x.id === "gx4");
    return r.estado === "enviada" && g.estado === "aprobado"; }), true);
  eq("…y lo aprobado va aparte, plegado, debajo de lo nuevo (sin nada nuevo todavía, lo dice: X6)", await p.evaluate(() => [(document.querySelector(".gx-nada-nuevo") || {}).textContent,
    (document.querySelector("details.gx-ya > summary") || {}).textContent, (document.querySelector("details.gx-ya") || {}).open]), ["Todavía no hay nada nuevo.", "Ya aprobados (1)", false]);
  eq("…una vez", await rpcs(p, "gastos_rendicion_reabrir"), [{ p_id: "ren_rutina" }]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // El comprobante que llegó tarde: «Va en» dice qué hacer. Y «Para aprobar» muestra las aprobadas hace poco.
  const base = datos({ prendido: true });
  const mes = base.gastos_rendiciones.find(r => r.id === "ren_rutina").rutina_mes;
  Object.assign(base.gastos.find(g => g.id === "gx8"), { fecha: mes });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await abrirRen(p, "sin"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx8"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto de un mes con la rutina ya aprobada: «Va en» dice que se puede reabrir o ponerlo en otro mes", await leer(p, "#gastoBody .gx-pista-vaen", e => /^La rutina de .+ ya se aprobó: un administrador la puede reabrir, o ponelo en la de otro mes\.$/.test(e.textContent.trim())), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  // En la lista: «Otra persona» muestra el «¿Quién?» y lo cuenta como faltante hasta elegirlo.
  await tocar(p, '[data-action="gastos-lista-abrir"]'); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gastos-lista-vista"][data-vista="foto"]');
  await p.selectOption("#gxL_gx8_pago", "otro").catch(() => {}); await p.waitForTimeout(150);
  eq("en «Revisar en lista», «Otra persona» agrega «¿Quién?» y va ahí", await p.evaluate(() => [!!document.getElementById("gxL_gx8_pagoQuien"), document.activeElement.id]), [true, "gxL_gx8_pagoQuien"]);
  eq("…y mientras no se elige, falta", await leer(p, "#gxLR_gx8", e => /quién pagó/.test(e.textContent)), true);
  await p.selectOption("#gxL_gx8_pagoQuien", ANA.email).catch(() => {}); await p.waitForTimeout(150);
  eq("…elegido, ya no", await leer(p, "#gxLR_gx8", e => /quién pagó/.test(e.textContent)), false);
  await p.fill("#gxL_gx8_concepto", "Taxi"); await p.selectOption("#gxL_gx8_tipo", "transporte").catch(() => {}); await p.fill("#gxL_gx8_monto", "12");
  await p.check("#gxL_gx8_marca").catch(() => {});
  await tocar(p, '[data-action="gastos-lista-guardar"]');
  eq("…y se guarda con quién pagó", await hasta(p, e => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx8"); return g.pago === "otro" && g.pago_quien === e && g.estado === "confirmado"; }, ANA.email), true);
  await tocar(p, '[data-action="gastos-lista-cerrar"]');
  if(await p.$("#confirmOverlay:not([hidden])")) await p.click("#confirmOk");
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  eq("«Para aprobar»: abajo, las aprobadas hace poco (desde ahí se reabre una)", await p.evaluate(() => [[...document.querySelectorAll(".gastos-view .admin-h3")].map(e => e.textContent.trim()).pop(),
    !!document.querySelector('.gastos-view [data-action="gastos-abrir-rendicion"][data-id="ren_rutina"]')]), ["Aprobadas hace poco", true]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Los cambios de moneda de una rendición (etapa 4, lo eligió el usuario el 18/11) ---------------- */
{
  const base = datos({ prendido: true });
  // gx1: un taxi en efectivo en pesos uruguayos, sin el monto en dólares; en la rendición está el cambio cb1 (USD 100 → UYU 3,950).
  Object.assign(base.gastos.find(g => g.id === "gx1"), { monto: 790, moneda: "UYU", forma_pago: "efectivo" });
  // Y uno en la rutina, ya aprobada.
  base.gastos_cambios.push({ ...base.gastos_cambios[0], id: "cb2", rendicion_id: "ren_rutina", observaciones: "En la rutina" });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  eq("la rendición muestra sus cambios de moneda, con la tasa", await leer(p, ".gx-cambios .gx-cambio", e => e.innerText.replace(/\s+/g, " ").trim()),
    `USD 100.00 → UYU 3,950.00 ${await p.evaluate(() => document.querySelector(".gx-cambios .gx-cambio small").textContent.split(" · ")[0])} · 1 USD = 39.5 UYU · Casa de cambio del aeropuerto 📎 Adjuntar comprobante 🗑️`);
  await tocar(p, '[data-action="gastos-cambio-abrir"]');
  eq("«Anotar un cambio de moneda» abre el formulario y va a lo que entregaste", await p.evaluate(() => document.activeElement.id), "gxCam_entregadoMonto");
  eq("de entrada: dólares, la moneda del país de la actividad (Uruguay) y la fecha en que empieza", await p.evaluate(() => [document.getElementById("gxCam_entregadoMoneda").value,
    document.getElementById("gxCam_recibidoMoneda").value, document.getElementById("gxCam_fecha").value === String((window.__sb.tablas.posts.find(x => x.id === "p9") || {}).start_date || "").slice(0, 10)]), ["USD", "UYU", true]);
  eq("cada moneda va al lado de su monto, en dos grupos con su nombre; sin tarjeta adentro ni título repetido", await p.evaluate(() => [
    [...document.querySelectorAll(".gx-cam-monto")].map(g => [...g.querySelectorAll("input")].map(i => i.id)), [...document.querySelectorAll(".gx-cam-lado > .gx-et")].map(e => e.textContent),
    !!document.querySelector(".gx-cambios .settings-card, .gx-cambios .settings-card-title")]),
    [[["gxCam_entregadoMoneda", "gxCam_entregadoMonto"], ["gxCam_recibidoMoneda", "gxCam_recibidoMonto"]], ["Entregaste", "Recibiste"], false]);
  await p.fill("#gxCam_fecha", new Date().toISOString().slice(0, 10)).catch(() => {});
  await p.fill("#gxCam_entregadoMonto", "50").catch(() => {}); await p.fill("#gxCam_recibidoMonto", "50").catch(() => {});
  await p.fill("#gxCam_recibidoMoneda", "USD").catch(() => {}); await p.click("#gxCam_observaciones").catch(() => {});
  await tocar(p, '[data-action="gastos-cambio-anotar"]');
  eq("la misma moneda de los dos lados: lo dice", await leer(p, ".gx-cambio-form .form-error", e => e.textContent.trim()), "Las dos monedas son la misma: un cambio es de una moneda a otra.");
  await p.fill("#gxCam_recibidoMoneda", "UYU").catch(() => {}); await p.fill("#gxCam_recibidoMonto", "1980").catch(() => {}); await p.click("#gxCam_observaciones").catch(() => {});
  eq("mientras se escribe, muestra la tasa", await hasta(p, () => (document.getElementById("gxCamTasa") || {}).textContent === "Tasa: 1 USD = 39.6 UYU"), true);
  await p.fill("#gxCam_observaciones", "Segundo cambio").catch(() => {});
  await elegirSiHay(p, '[data-action="gastos-cambio-adjuntar"][data-id=""]', { name: "casa-de-cambio.png", mimeType: "image/png", buffer: PNG });
  await hasta(p, () => !!document.querySelector(".gx-cambio-form .gx-mov-arch"));
  await tocar(p, '[data-action="gastos-cambio-anotar"]');
  eq("anotado: en la base, con la rendición, las monedas, los montos y su comprobante en su carpeta", await hasta(p, () => {
    const c = (window.__sb.tablas.gastos_cambios || []).find(x => x.observaciones === "Segundo cambio");
    return !!c && c.rendicion_id === "ren_mvd" && c.entregado_moneda === "USD" && c.entregado_monto === 50 && c.recibido_moneda === "UYU" && c.recibido_monto === 1980
      && String(c.archivo).startsWith(`gastos/cambio-${c.id}/comprobante_`) && c.archivo_nombre === "casa-de-cambio.png"; }), true);
  eq("…y el formulario se cierra", await hasta(p, () => !document.querySelector(".gx-cambio-form") && document.querySelectorAll(".gx-cambios .gx-cambio").length === 2), true);
  // En el gasto en efectivo, la cuenta en dólares con la tasa de cada cambio de esa moneda.
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto en efectivo en esa moneda: la cuenta en dólares con cada cambio", await p.$$eval("#gastoBody .gx-usar-cambio", l => l.map(e => /\((1 USD = [\d.]+ UYU)\): (USD [\d.,]+)/.exec(e.textContent).slice(1).join(" → "))),
    ["1 USD = 39.5 UYU → USD 20.00", "1 USD = 39.6 UYU → USD 19.95"]);
  await tocar(p, '#gastoBody [data-action="gasto-usar-cambio"]');
  eq("«Usar» pone ese monto en dólares", await leer(p, "#gxRendido", e => e.value), "20.00");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150); if(await p.$("#confirmOverlay:not([hidden])")) await p.click("#confirmOk");
  // Borrar un cambio, preguntando.
  const segundo = await p.evaluate(() => ((window.__sb.tablas.gastos_cambios || []).find(x => x.observaciones === "Segundo cambio") || {}).id || "");
  await tocar(p, `[data-action="gastos-cambio-borrar"][data-id="${segundo}"]`); await aceptar(p).catch(() => {});
  eq("borrar un cambio pregunta y lo borra", await hasta(p, id => !(window.__sb.tablas.gastos_cambios || []).some(x => x.id === id), segundo), true);
  // En una rendición que ya no se corrige, los cambios se ven pero no se tocan.
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_rutina"); await p.waitForTimeout(150);
  eq("aprobada: el cambio se ve, sin borrar ni anotar otro", await p.evaluate(() => [document.querySelectorAll(".gx-cambios .gx-cambio").length,
    !document.querySelector('[data-action="gastos-cambio-borrar"]'), !document.querySelector('[data-action="gastos-cambio-abrir"]')]), [1, true, true]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Administración → Gastos ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irAdmin(p); await admin(p, "preferencias", "gastos");
  eq("la sección: prendido, abierto al equipo y los siete tipos de siempre", await p.evaluate(() => [document.querySelector('[data-action="gastos-prender"]').checked,
    document.querySelector('[data-action="gastos-abrir-equipo"]').checked, [...document.querySelectorAll(".gx-tipo-nombre")].map(e => e.value || e.placeholder)]),
    [true, true, ["Reunión", "Comida", "Pasaje", "Alojamiento", "Transporte", "Compra de material", "Suscripción"]]);
  eq("…sin «en prueba»", await p.evaluate(() => /en prueba|etapa de prueba/i.test(document.querySelector(".admin-body").textContent)), false);
  await p.click('[data-action="gastos-abrir-equipo"] + .pref-slider');
  eq("cerrarlo al equipo: se guarda («abierto: false»)", await hasta(p, () => (window.__sb.tablas.app_config.find(c => c.key === "preferences").value.gastos || {}).abierto === false), true);
  await p.click('[data-action="gastos-abrir-equipo"] + .pref-slider');
  eq("…y abrirlo de nuevo", await hasta(p, () => (window.__sb.tablas.app_config.find(c => c.key === "preferences").value.gastos || {}).abierto === true), true);
  eq("guardar arranca apagado (no hay nada que guardar)", await p.$eval('[data-action="gastos-tipos-guardar"]', e => e.disabled), true);
  await p.fill("#gxTipo_1", "Comidas y cafés");
  await p.click('[data-action="gastos-tipo-ocultar"][data-i="6"]');
  await p.fill("#gxTipoNuevo", "Peajes y estacionamiento"); await p.click('[data-action="gastos-tipo-sumar"]');
  await p.click('[data-action="gastos-tipos-guardar"]');
  eq("guardar los tipos: renombrado, uno sin ofrecer y uno nuevo con su clave", await hasta(p, () => { const g = (window.__sb.tablas.app_config.find(c => c.key === "preferences").value.gastos || {});
    return JSON.stringify(g.tipos) === JSON.stringify([{ key: "reunion" }, { key: "comida", label: "Comidas y cafés" }, { key: "pasaje" }, { key: "alojamiento" }, { key: "transporte" }, { key: "material" },
      { key: "suscripcion", oculto: true }, { key: "peajes_y_estacionamiento", label: "Peajes y estacionamiento" }]) && g.prendido === true; }), true);
  eq("…por guardar_config, sin tocar el resto de las preferencias", (await rpcs(p, "guardar_config")).slice(-1).map(a => [a.p_clave, Object.keys(a.p_parche)]), [["preferences", ["gastos"]]]);
  await irGastos(p);
  await abrirRen(p, "sin"); await p.click('[data-action="gasto-abrir"][data-id="gx8"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("en un gasto se ofrecen los tipos nuevos, sin el oculto", await p.$$eval("#gxTipo [data-tipo]", l => l.map(o => o.textContent.trim())),
    ["Reunión", "Comidas y cafés", "Pasaje", "Alojamiento", "Transporte", "Compra de material", "Peajes y estacionamiento"]);
  await p.keyboard.press("Escape");
  await irAdmin(p); await admin(p, "preferencias", "gastos");
  await p.click('[data-action="gastos-prender"] + .pref-slider');
  eq("apagarlo: se guarda y el módulo desaparece del menú", await hasta(p, () => (window.__sb.tablas.app_config.find(c => c.key === "preferences").value.gastos || {}).prendido === false), true);
  eq("…ya no está", (await pestanas(p)).includes("gastos"), false);
  eq("…y lo cargado sigue en la base", (await tabla(p, "gastos")).length > 0, true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Los cuatro idiomas ---------------- */
for(const lang of ["en", "pt", "he"]){
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, lang, base: datos({ prendido: true }) });
  await irGastos(p);
  const lista = await p.$eval(".gastos-view", e => e.innerText);
  eq(`${lang}: la pantalla de gastos está traducida (sin restos del español)`, /Mis rendiciones|Subir comprobantes|Sin vincular|Aprobadas|Cuenta corriente|Para aprobar|en prueba/.test(lista), false);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  eq(`${lang}: la flecha de volver apunta hacia atrás`, await p.$eval(".gx-volver", e => e.textContent.trim()[0]), lang === "he" ? "→" : "←");
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq(`${lang}: la ventana de un gasto también`, /Revisar el gasto|Concepto|Quién pagó|Forma de pago|Va en/.test(await p.$eval("#gastoBody", e => e.innerText)), false);
  await p.keyboard.press("Escape");
  for(const k of ["cuenta", "aprobar"]){ await p.click(`[data-action="gastos-seccion"][data-key="${k}"]`); await p.waitForTimeout(120); }
  eq(`${lang}: sin errores de página`, errores, []);
  await p.close();
}

{
  // Las tarjetas que la persona ya usó, para tocar (18/11): el lector casi nunca lee el número enmascarado de un
  // ticket térmico. La cena (gx3) se pagó con tarjeta y no tiene el número; el hotel (gx2) se pagó con la 5555.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx3"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("con tarjeta y sin el número, ofrece las que ya usó, al lado del campo", await p.$$eval('#gastoBody [data-action="gasto-tarjeta"]', l => l.map(b => [b.textContent, b.getAttribute("aria-label")])),
    [["5555", "Tarjeta terminada en 5555"]]);
  await tocar(p, '#gastoBody [data-action="gasto-tarjeta"][data-t="5555"]');
  eq("…tocarla la pone, con el foco en el campo, y ya no se ofrece", await p.evaluate(() => [document.getElementById("gxTarjeta").value, document.activeElement.id,
    document.querySelectorAll('#gastoBody [data-action="gasto-tarjeta"]').length]), ["5555", "gxTarjeta", 0]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Las observaciones en la ventana del gasto (18/11): al final y de a poco; «Observar», solo un admin que no cargó
  // el gasto y no en uno ya observado (lo que quiera agregar, como respuesta).
  const base = datos({ prendido: true });
  base.gastos_comentarios.push({ id: "gc2", gasto_id: "gx7", autor: PERS[2].email, texto: "Era una cena de equipo", creado_el: new Date(Date.now() - 2 * 3600e3).toISOString() },
    { id: "gc3", gasto_id: "gx7", autor: ADMIN, texto: "Entonces subí el ticket de los cuatro", creado_el: new Date(Date.now() - 3600e3).toISOString() });
  Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_mvd"), { estado: "enviada", enviada_el: "2026-11-01T10:00:00Z" });
  base.gastos.filter(g => g.rendicion_id === "ren_mvd").forEach(g => Object.assign(g, { estado: "enviado", fecha: g.fecha || "2026-07-05", concepto: g.concepto || "Taxi", tipo: g.tipo || "transporte" }));
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("el gasto mandado de otra persona: «Observar» al final, después de los datos", await p.evaluate(() => {
    const sec = document.querySelector("#gastoBody .gx-obs-sec"), datos = document.querySelector("#gastoBody .gx-res, #gastoBody .gx-campos");
    return !!sec && !!datos && !!(datos.compareDocumentPosition(sec) & Node.DOCUMENT_POSITION_FOLLOWING) && !!sec.querySelector('[data-action="gasto-observar"]'); }), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_diego"); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gasto-abrir"][data-id="gx7"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("uno con tres comentarios: el título los cuenta y se ve solo el último", await p.evaluate(() => [(document.querySelector("#gxObsTit") || {}).textContent,
    [...document.querySelectorAll("#gastoBody .gx-hilo .gx-com div")].map(d => d.textContent)]), ["Observaciones (3)", ["Entonces subí el ticket de los cuatro"]]);
  eq("ya observado, no se ofrece «Observar» otra vez: se responde", await p.evaluate(() => [!!document.querySelector('#gastoBody [data-action="gasto-observar"]'), !!document.querySelector('#gastoBody [data-action="gasto-responder"]')]), [false, true]);
  await tocar(p, '[data-action="gasto-hilo-ver"]');
  eq("«Ver las 2 anteriores» abre el hilo entero, en orden", await p.$$eval("#gastoBody .gx-hilo .gx-com div", l => l.map(d => d.textContent)),
    ["Falta la factura: ¿la podés subir de nuevo?", "Era una cena de equipo", "Entonces subí el ticket de los cuatro"]);
  await p.fill("#gxResponder", "Gracias, lo veo"); await p.dispatchEvent("#gxResponder", "input");
  await tocar(p, '[data-action="gasto-responder"]');
  eq("la respuesta del admin va al hilo, sin cerrar la ventana", await hasta(p, () => window.__sb.rpc.some(r => r[0] === "gastos_comentar" && r[1].p_texto === "Gracias, lo veo")
    && !document.getElementById("gastoOverlay").hidden && [...document.querySelectorAll("#gastoBody .gx-hilo .gx-com div")].some(d => d.textContent === "Gracias, lo veo")), true);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  // Un gasto propio, mandado: el admin que lo cargó no se lo observa a sí mismo.
  await tocar(p, '[data-action="gastos-seccion"][data-key="mias"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_mvd"); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto propio no tiene «Observar», aunque quien lo mira sea admin", await p.evaluate(() => !!document.querySelector('#gastoBody [data-action="gasto-observar"]')), false);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Reabierta una rendición de otra persona: un admin puede observar uno ya aprobado para que lo corrijan.
  const base = datos({ prendido: true });
  const ayer = new Date(Date.now() - 86400e3).toISOString();
  Object.assign(base.gastos_rendiciones.find(r => r.id === "ren_ana"), { estado: "aprobada", aprobada_el: ayer, aprobada_por: ADMIN });
  base.gastos.filter(g => g.rendicion_id === "ren_ana").forEach(g => Object.assign(g, { estado: "aprobado", aprobado_el: ayer }));
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  await abrirRen(p, "ren_ana"); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gastos-reabrir"]'); await tocar(p, "#confirmOk");
  await hasta(p, () => !!document.querySelector("details.gx-ya"));
  eq("reabierta la de otra persona, el admin la sigue viendo: lo aprobado, plegado", await p.evaluate(() => (document.querySelector("details.gx-ya > summary") || {}).textContent), "Ya aprobados (2)");
  if(await p.$("details.gx-ya")) await p.click("details.gx-ya > summary");
  await tocar(p, '[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden])").catch(() => {});
  eq("en una reabierta, un admin que no la cargó puede observar uno aprobado", await p.evaluate(() => !!document.querySelector('#gastoBody [data-action="gasto-observar"]')), true);
  await p.fill("#gxObs", "Corregí el monto en dólares").catch(() => {}); await p.dispatchEvent("#gxObs", "input").catch(() => {});
  await tocar(p, '[data-action="gasto-observar"]');
  eq("…y queda observado (la rendición vuelve a la persona)", await hasta(p, () => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx5"), r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_ana");
    return g.estado === "observado" && r.estado === "observada"; }), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
