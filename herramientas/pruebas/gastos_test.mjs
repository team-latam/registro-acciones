/* ======================================================================
   Gastos y rendiciones, la etapa de prueba (15/11/2026; 27-gastos.sql y
   docs/rendicion-gastos/)

   - Quién lo ve: con el interruptor de Administración → Gastos prendido,
     solo los admins (desde el menú de su foto y, en el celular, desde
     «Más»). Una integrante, un observador o un admin con el módulo apagado
     no lo ven ni lo leen de la base. Abierto al equipo (la etapa 5), lo ve
     quien puede cargar.
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
const irGastos = async p => { await abrirMenu(p); await p.click('.user-menu [data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(150); };
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
    else await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendiciones"]').click());
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
  await abrirMenu(p);
  eq("prendido: el admin lo tiene en el menú de su foto, con lo que espera su revisión (una rendición mandada y plata por confirmar)",
    await textos(p, '.user-menu [data-view="gastos"]'), ["🧾 Gastos2"]);
  eq("y lo lee de la base", await leyoGastos(p), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
for(const [quien, nombre, gastos, rotulo] of [[ANA.email, ANA.name, { prendido: true }, "una integrante, con el módulo en prueba"],
  [OBS, "Olga Observa", { prendido: true, abierto: true }, "un observador, aunque esté abierto al equipo"],
  [ADMIN, PERS[0].name, { prendido: false }, "el admin, con el módulo apagado"], [ADMIN, PERS[0].name, null, "el admin, si nunca se prendió"]]){
  const { p } = await entrar(b, quien, nombre, { viewport: vp, base: datos(gastos) });
  await abrirMenu(p);
  eq(`${rotulo}: no lo ve`, await p.$$eval('.user-menu [data-view="gastos"]', l => l.length), 0);
  eq(`${rotulo}: ni lo pide a la base`, await leyoGastos(p), false);
  await p.close();
}
{
  // La etapa 5: abierto al equipo, lo ve quien puede cargar (la base ya lo permite: gastos_habilitado).
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, base: datos({ prendido: true, abierto: true }) });
  await abrirMenu(p);
  eq("abierto al equipo, una integrante lo ve", await p.$$eval('.user-menu [data-view="gastos"]', l => l.length), 1);
  await p.click('.user-menu [data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  eq("y no tiene «Para aprobar» (es de los admins)", await p.$$eval('[data-action="gastos-seccion"]', l => l.map(e => e.dataset.key)), ["rendiciones", "cuenta"]);
  eq("ve solo sus rendiciones", await textos(p, '.gx-tarjeta b'), ["Visita a la comunidad de Rosario"]);
  await p.close();
}
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.click('.bn-item[data-action="toggle-more-menu"]'); await p.waitForTimeout(150);
  eq("en el celular está en «Más»", await p.$$eval('.bn-sheet-item[data-view="gastos"]', l => l.length), 1);
  await p.click('.bn-sheet-item[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  eq("y abre la pantalla de gastos", await p.$eval(".gastos-view .admin-h2", e => e.textContent.trim()), "Mis rendiciones");
  eq("en el celular, la página no se corre de costado", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  eq("sin errores de página en el celular", errores, []);
  await p.close();
}

/* ---------------- Mis rendiciones, subir, revisar, mandar ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  eq("las rendiciones: sin vincular, para completar y aprobadas", await textos(p, ".gx-tarjeta b"), ["Sin vincular", "Visita a Montevideo", await p.evaluate(() => "Rutina de " + new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }))]);
  eq("cada una dice qué falta y cuánto suma", await textos(p, '[data-id="ren_mvd"] .gx-aviso, [data-id="ren_mvd"] .gx-t-total'), ["1 por confirmar", "USD 345.50"]);
  eq("no ve las rendiciones de otros en «Mis rendiciones»", (await textos(p, ".gx-tarjeta b")).includes("Visita a la comunidad de Rosario"), false);

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
  eq("el aviso dice cuántos subieron", await hasta(p, () => /Se subieron 2 comprobantes/.test((document.querySelector(".gx-subida") || {}).textContent || "")), true);

  // El mismo otra vez, y algo que no es ni foto ni PDF.
  await subirDesdeCabecera(p, "", [
    { name: "otra-vez.png", mimeType: "image/png", buffer: PNG }, { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") }]);
  await hasta(p, () => { const s = document.querySelector(".gx-subida"); return s && !/Subiendo/.test(s.textContent); });
  eq("el mismo comprobante no se repite, y lo que no es foto ni PDF se avisa", [(await tabla(p, "gastos")).length - antes,
    await p.$eval(".gx-subida", e => /Ya estaban cargados.*otra-vez\.png/.test(e.textContent) && /notas\.txt: no es una foto ni un PDF/.test(e.textContent))], [2, true]);
  await p.click('[data-action="gastos-subida-cerrar"]');

  // Revisar la foto: la ventana pide lo que falta. Después de subir «todavía no sé», se ve dónde quedaron.
  eq("después de subir, se ve dónde quedaron: en «Sin vincular»", await p.$eval(".gx-cab .gx-h3", e => e.textContent.includes("Sin vincular")), true);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  eq("con un gasto por confirmar, «Mandar» espera y dice por qué", await p.evaluate(() => [document.querySelector('[data-action="gastos-enviar"]').disabled, document.querySelector(".gx-acciones .setting-sub").textContent.trim()]), [true, "Falta confirmar 1 gasto."]);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  await p.click('[data-action="gasto-borrar"]'); await aceptar(p);
  eq("borrar un gasto pregunta y lo borra", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.id === "gx1")), true);
  eq("el total confirmado suma lo que se rinde (en dólares cuando lo tiene)", await textos(p, ".gx-total b"), ["USD 353.50"]);
  await p.click('[data-action="gastos-enviar"]'); await aceptar(p);
  eq("mandar: pregunta y la manda con la función de la base", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_mvd").estado === "enviada"), true);
  eq("…una vez", (await rpcs(p, "gastos_rendicion_enviar")), [{ p_id: "ren_mvd" }]);
  eq("mandada, dice que la está revisando un admin y no se puede tocar", await p.evaluate(() => [!!document.querySelector(".gx-info"), !document.querySelector('[data-action="gastos-subir"]'), !document.querySelector('[data-action="gastos-enviar"]')]), [true, true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto mandado se ve como texto, sin campos apagados, y no se cambia", await p.evaluate(() => [document.getElementById("gxConcepto").tagName,
    document.querySelectorAll("#gastoBody .gx-v-form > :not(.gx-observar) :is(input, select, textarea, .gx-opc)").length, !!document.querySelector("#gastoBody .gx-res"),
    !document.querySelector('[data-action="gasto-guardar"]'), (document.querySelector("#gastoBody .gx-res-estado") || {}).textContent]), ["SPAN", 0, true, true, "Mandado: un administrador lo está revisando."]);
  await p.keyboard.press("Escape");
  eq("Escape cierra la ventana y el foco vuelve a su fila", await hasta(p, () => document.getElementById("gastoOverlay").hidden && document.activeElement.dataset.id === "gx2"), true);

  // El total rápido de la rutina del mes anterior (tiene 3 USD de detalle).
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await p.click(`[data-action="gastos-abrir-rendicion"][data-id="${rutAnt.id}"]`); await p.waitForTimeout(150);
  await p.click(".gx-rapido summary");
  await p.fill("#gxTotal_0_monto", "10");
  await p.click('[data-action="gastos-total-guardar"]');
  eq("el total rápido se guarda por moneda", await hasta(p, id => { const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === id); return JSON.stringify(r.total_manual) === '{"USD":10}' && r.total_manual_confirmado === false; }, rutAnt.id), true);
  eq("si no coincide con el detalle, avisa que vale el detalle", await hasta(p, () => /no coincide con el detalle/.test((document.querySelector(".gx-rapido .gx-alerta") || {}).textContent || "")), true);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_ana"]'); await p.waitForTimeout(150);
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
  eq("…y pide el aviso por correo para la persona, por ese gasto (una vez)", await hasta(p, () => true).then(() => avisos), [{ tipo: "gasto", id: "gx5" }]);
  eq("la rendición vuelve a la persona y ya no se aprueba", await hasta(p, () => !document.querySelector('[data-action="gastos-aprobar"]') && window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_ana").estado === "observada"), true);
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-aprobar"]'); await aceptar(p);
  eq("un admin aprueba la suya (decidido el 15/11) entera", await hasta(p, () => { const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_mvd"); return r.estado === "aprobada" && window.__sb.tablas.gastos.filter(g => g.rendicion_id === "ren_mvd").every(g => g.estado === "aprobado"); }), true);
  eq("…con la función de la base", (await rpcs(p, "gastos_rendicion_aprobar")), [{ p_id: "ren_mvd" }]);

  /* ---------------- La cuenta corriente ---------------- */
  await p.click('[data-action="gastos-seccion"][data-key="cuenta"]'); await p.waitForTimeout(150);
  // Gastado: el remís (20) + el hotel (300 en dólares) + el taxi (8); la cena la pagó la organización. Recibido: 500.
  eq("la cuenta: lo gastado de su bolsillo en rendiciones aprobadas, menos lo recibido", await textos(p, ".gx-cuenta-mon .gx-saldo, .gx-cuenta-mon .gx-cm-sub, .gx-cm-filas dd"),
    ["USD -172.00", "le debés a la organización", "USD 328.00", "USD 500.00", "USD 0.00"]);
  await p.selectOption("#gxMov_tipo", "ajuste"); await p.waitForTimeout(100);
  await p.fill("#gxMov_monto", "50"); await p.fill("#gxMov_descripcion", "Saldo inicial");
  await p.click('[data-action="gastos-mov-anotar"]');
  eq("un admin anota un ajuste, que ya cuenta", await hasta(p, () => /USD\s-122\.00/.test(document.querySelector(".gx-saldo").textContent)), true);
  eq("…a nombre de la persona, confirmado", (await tabla(p, "gastos_movimientos")).filter(m => m.tipo === "ajuste").map(m => [m.persona, m.monto, m.moneda, m.estado, m.descripcion]), [[ADMIN, 50, "USD", "confirmado", "Saldo inicial"]]);
  await p.fill("#gxMov_monto", ""); await p.click('[data-action="gastos-mov-anotar"]');
  eq("sin monto, avisa", await p.$eval(".gx-anotar .form-error", e => e.textContent.trim()), "Falta el monto.");
  await p.selectOption("#gxCuentaDe", ANA.email); await p.waitForTimeout(150);
  eq("la cuenta de otra persona: lo recibido ya confirmado y lo que está en revisión aparte", await textos(p, ".gx-cuenta-mon .gx-saldo, .gx-cuenta-mon .gx-cm-sub, .gx-cm-filas dd"),
    ["USD -200.00", "le debe a la organización", "USD 0.00", "USD 200.00", "USD 0.00", "USD 170.00"]);
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
  const antes = (await tabla(p, "gastos")).length;
  await p.selectOption("#gxDestino", "post:p9");
  await elegir(p, '[data-action="gastos-destino-elegir"]', [{ name: "peaje.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from([1])]) }]);
  eq("subido a un viaje: queda en su rendición, y se ve esa rendición", await hasta(p, n => { const g = (window.__sb.tablas.gastos || []).slice(n)[0];
    return !!g && g.rendicion_id === "ren_mvd" && !!g.archivo && /Visita a Montevideo/.test((document.querySelector(".gx-cab .gx-h3") || {}).textContent || ""); }, antes), true);
  const nuevo = (await tabla(p, "gastos")).slice(antes)[0];
  // Los totales: solo lo confirmado.
  eq("el total de la rendición cuenta solo lo confirmado, y dice cuántos quedan afuera", await textos(p, ".gx-total > span"), ["Total confirmado (sin contar 2 por confirmar)"]);
  eq("…sin el monto del borrador (lo que asustó al usuario: «USD 72.570» que eran pesos)", await p.$eval(".gx-total b", e => [/72[.,]?570/.test(e.textContent), /345\.50/.test(e.textContent)]), [false, true]);
  // Borrar desde la fila, sin abrir la ventana.
  eq("cada fila que se puede tocar tiene su «Borrar»", await p.$$eval('[data-action="gasto-quitar"]', l => l.map(e => e.dataset.id).sort()), ["gx1", "gx2", "gx3", "gx9", nuevo.id].sort());
  await p.click(`[data-action="gasto-quitar"][data-id="${nuevo.id}"]`);
  eq("borrar pregunta, con el nombre", await p.$eval("#confirmMessage", e => /¿Borrar «peaje\.png» y su comprobante\?/.test(e.textContent)).catch(() => false), true);
  await p.click("#confirmOk");
  eq("…lo borra y el foco no se pierde", await hasta(p, id => !window.__sb.tablas.gastos.some(g => g.id === id) && !!document.activeElement.closest(".gastos-view"), nuevo.id), true);
  await p.click('[data-action="gasto-quitar"][data-id="gx9"]'); await aceptar(p);
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
  eq("«Mandar» avisa que un gasto en otra moneda no tiene el monto en dólares", await p.$eval("#confirmMessage", e => e.textContent.includes("Ojo: «Taxi al aeropuerto» está en UYU y no tiene el monto en USD")).catch(() => false), true);
  eq("…y deja mandar igual", await p.$eval("#confirmOk", e => e.textContent.trim()), "Mandar igual");
  await p.click("#confirmOk");
  eq("mandada igual", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_mvd").estado === "enviada"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Una rendición vacía se borra (lo pidió el usuario el 15/11) ---------------- */
{
  const base = datos({ prendido: true });
  base.gastos_rendiciones.push({ ...base.gastos_rendiciones.find(r => r.id === "ren_mvd"), id: "ren_vacia", post_id: "p1", titulo: "Viaje sin gastos" });
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-sel-abrir"][data-id="ren_mvd"]');
  eq("«Seleccionar»: una casilla por gasto, sin las papeleras de cada fila, y la barra con «Borrar» esperando", await p.evaluate(() => [document.querySelectorAll("[data-gsel]").length,
    document.querySelectorAll('[data-action="gasto-quitar"]').length, document.querySelector('[data-action="gastos-sel-borrar"]').disabled, document.activeElement.dataset.gsel || ""]), [3, 0, true, "gx1"]);
  await p.click('[data-action="gastos-sel-tocar"][data-id="gx1"]');
  await p.check("#gxS_gx3");
  eq("tocar la fila o la casilla la elige; la barra cuenta", await p.evaluate(() => [document.getElementById("gxS_gx1").checked, document.getElementById("gxS_gx3").checked,
    document.querySelector(".gx-selpie .gx-lcuenta").textContent, document.querySelector('[data-action="gastos-sel-borrar"]').textContent.trim()]), [true, true, "2 seleccionados", "🗑️ Borrar 2"]);
  await p.check("#gxSelTodos");
  eq("«Todos» elige todos", await p.$eval(".gx-selpie .gx-lcuenta", e => e.textContent), "3 seleccionados");
  await p.uncheck("#gxSelTodos"); await p.check("#gxS_gx1"); await p.check("#gxS_gx3");
  await p.click('[data-action="gastos-sel-borrar"]');
  eq("borrar pregunta, con cuántos", await p.$eval("#confirmMessage", e => e.textContent).catch(() => ""), "¿Borrar los 2 gastos seleccionados y sus comprobantes? No se puede deshacer.");
  await p.click("#confirmOk");
  eq("…borra los elegidos, deja el resto y sale de «Seleccionar»", await hasta(p, () => { const ids = window.__sb.tablas.gastos.map(g => g.id);
    return !ids.includes("gx1") && !ids.includes("gx3") && ids.includes("gx2") && !document.querySelector("[data-gsel]"); }), true);
  await p.click('[data-action="gastos-sel-abrir"]').catch(() => {});
  eq("con un solo gasto que se puede tocar, «Seleccionar» no aparece", await p.$('[data-action="gastos-sel-abrir"]'), null);
  // La rendición entera, con lo que tiene adentro.
  eq("«Borrar esta rendición» dice con cuántos gastos", await p.$eval('[data-action="gastos-rendicion-borrar"]', e => e.textContent.trim()), "🗑️ Borrar esta rendición (con su gasto)");
  await p.click('[data-action="gastos-rendicion-borrar"]');
  eq("pregunta, con el nombre", await p.$eval("#confirmMessage", e => /¿Borrar la rendición «.+» con su gasto y su comprobante\? No se puede deshacer\./.test(e.textContent)).catch(() => false), true);
  eq("…y el botón dice «Borrar todo»", await p.$eval("#confirmOk", e => e.textContent.trim()), "Borrar todo");
  await p.click("#confirmOk");
  eq("…la borra con sus gastos, y vuelve a «Mis rendiciones»", await hasta(p, () => !window.__sb.tablas.gastos_rendiciones.some(r => r.id === "ren_mvd")
    && !window.__sb.tablas.gastos.some(g => g.rendicion_id === "ren_mvd") && !!document.querySelector('[data-action="gastos-destino-abrir"]') && !document.querySelector('[data-id="ren_mvd"]')), true);
  // Una aprobada la borra solo el admin fijo (lo pidió el usuario el 17/11): ver «Lo ya aprobado», más abajo.
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_rutina"]'); await p.waitForTimeout(150);
  eq("una rendición aprobada: el admin fijo tiene «Borrar»; «Seleccionar», no con un solo gasto", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.querySelector('[data-action="gastos-sel-abrir"]')]), [true, false]);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- Pasar de un gasto al de al lado sin cerrar (lo pidió el usuario el 16/11) ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
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
    await p.$eval("#gxObsAuto", e => [e.hidden, e.textContent.replace(/\s+/g, " ").trim()]), [false, "Gasto en UY $ 12,000.- (se escribe sola)"]);
  await p.fill("#gxMonto", "11.500,50");
  eq("…y se pone al día mientras se escribe el monto", await p.$eval("#gxObsAuto .gx-obs-auto-txt", e => e.textContent), "Gasto en UY $ 11,500.50");
  await p.keyboard.press("Escape"); await p.click("#confirmOk");
  eq("al cerrar, el foco vuelve a la fila del último que se vio", await hasta(p, () => document.getElementById("gastoOverlay").hidden && document.activeElement.dataset.id === "gx2"), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await irGastos(p);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx1"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("en el celular no hay flechas a los costados (la ventana ocupa la pantalla)", await p.$eval("#gastoSig", e => getComputedStyle(e).display), "none");
  await p.close();
}

/* ---------------- Elegir la moneda y las listas largas (lo pidió el usuario el 17/11) ---------------- */
// Antes: la lista del navegador, con todas las monedas, que con una ya puesta mostraba solo esa.
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irGastos(p);
  const abierta = () => p.evaluate(() => { const el = document.getElementById("selPop"); return !!el && el.matches(":popover-open"); });
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
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
  await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="cuenta"]').click()); await p.waitForSelector("#gxMov_moneda");
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
  eq("…y el aviso dice que lo leyó, sin fallas", await hasta(p, () => /El lector completó lo que pudo leer/.test((document.querySelector(".gx-subida") || {}).textContent || "") && !document.querySelector(".gx-subida-mal")), true);
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
  eq("con varios por confirmar aparece «Revisar en lista», con cuántos son", await textos(p, ".gx-lboton .setting-sub"), ["4 por confirmar: corregilos y confirmalos juntos, sin abrir uno por uno."]);
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
  eq("en la lista, la fila en otra moneda trae la nota de la moneda local en sus observaciones", await p.$eval(`#gxL_${f}_obsAuto .gx-obs-auto-txt`, e => e.textContent), "Gasto en AR $ 3,000.-");
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
    await tocar(p, '[data-action="gastos-abrir-rendicion"][data-id="ren_ana"]'); await p.waitForTimeout(150);
    eq("un admin por rol no tiene «Borrar esta rendición» ni «Seleccionar» en una mandada", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.querySelector('[data-action="gastos-sel-abrir"]')]), [false, false]);
    await tocar(p, '[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForTimeout(200);
    eq("…ni «Borrar» en el gasto (sí «Observar»)", await p.evaluate(() => [!!document.querySelector('#gastoBody [data-action="gasto-borrar"]'), !!document.querySelector("#gxObs")]), [false, true]);
    eq("sin errores de página (admin por rol)", errores, []);
    await p.close();
  }

  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base });
  await irGastos(p);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_rutina"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gasto-abrir"][data-id="gx4"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto aprobado se ve como texto: sin campos ni botones apagados, sin «Guardar»", await p.evaluate(() => [document.getElementById("gxConcepto").tagName, document.getElementById("gxConcepto").textContent,
    document.querySelectorAll("#gastoBody input, #gastoBody select, #gastoBody textarea, #gastoBody .gx-opc").length, !!document.querySelector('[data-action="gasto-guardar"]')]),
    ["SPAN", "Remís a la reunión de equipo", 0, false]);
  eq("…dice que está aprobado", await leer(p, "#gastoBody .gx-res-estado", e => /^Aprobado el .+: ya no se cambia\.$/.test(e.textContent)), true);
  eq("…el monto, y lo rendido en dólares", await leer(p, "#gastoBody .gx-res-plata", e => e.innerText.replace(/\s+/g, " ").trim()), "MXN 642.00 Rendido: USD 35.20");
  eq("…y cada dato con su nombre", await p.$$eval("#gastoBody .gx-res-fila", l => l.map(f => [f.querySelector("dt").textContent, f.querySelector("dd").innerText.replace(/\s+/g, " ").trim()])
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
  await tocar(p, '[data-action="gastos-sel-abrir"]'); await p.waitForTimeout(100);
  eq("«Seleccionar» en una aprobada: cada fila tiene su casilla, prendida", await p.evaluate(() => [...document.querySelectorAll("[data-gsel]")].map(x => !x.disabled)), [true, true]);
  await tocar(p, '[data-action="gastos-sel-tocar"][data-id="gx9"]');
  eq("…y tocar la fila la marca (no la abre)", await p.evaluate(() => [document.getElementById("gastoOverlay").hidden, document.getElementById("gxS_gx9").checked]), [true, true]);
  await p.check("#gxSelTodos", { timeout: 3000 }).catch(() => {});
  await tocar(p, '[data-action="gastos-sel-borrar"]');
  eq("«Seleccionar» en una aprobada: avisa cuántos ya están aprobados", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => e.textContent.trim()),
    "¿Borrar los 2 gastos seleccionados y sus comprobantes? No se puede deshacer. 2 ya están aprobados: salen también de tu cuenta corriente.");
  await tocar(p, "#confirmOk");
  eq("…y los borra", await hasta(p, () => !window.__sb.tablas.gastos.some(g => g.rendicion_id === "ren_rutina")), true);

  // Una rendición de otra persona, ya mandada (desde «Para aprobar»).
  if(await p.$("#confirmOverlay:not([hidden])")) await p.keyboard.press("Escape");
  await p.click('[data-action="gastos-seccion"][data-key="aprobar"]'); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gastos-abrir-rendicion"][data-id="ren_ana"]'); await p.waitForTimeout(150);
  eq("una mandada de otra persona: el admin fijo tiene «Borrar esta rendición» y «Seleccionar»", await p.evaluate(() => [!!document.querySelector('[data-action="gastos-rendicion-borrar"]'), !!document.querySelector('[data-action="gastos-sel-abrir"]')]), [true, true]);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
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
  eq("…y el formulario queda limpio", await hasta(p, () => !document.querySelector(".gx-mov-arch") && document.getElementById("gxMov_monto").value === ""), true);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
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
  // La rutina aprobada: el gasto que pagó otra persona, como texto; y «Reabrir».
  await p.click('[data-action="gastos-volver"]'); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_rutina"]'); await p.waitForTimeout(150);
  await tocar(p, '[data-action="gasto-abrir"][data-id="gx4"]'); await p.waitForTimeout(300);
  eq("en un gasto aprobado que pagó otra persona: quién y que no entra en ninguna cuenta", await p.$$eval("#gastoBody .gx-res-fila", l => l.map(f => [f.querySelector("dt").textContent, f.querySelector("dd").innerText.replace(/\s+/g, " ").trim()])
    .filter(([k]) => k === "¿Quién pagó?")), [["¿Quién pagó?", "Ana Pérez No entra en ninguna cuenta corriente."]]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  eq("una rendición aprobada: un admin tiene «Reabrir», con lo que pasa", await p.evaluate(() => { const b = document.querySelector('[data-action="gastos-reabrir"]');
    return b && [b.textContent.trim(), /Reabrila para sumarlo/.test(b.closest(".gx-reabrir").textContent)]; }), ["↩️ Reabrir", true]);
  await tocar(p, '[data-action="gastos-reabrir"]');
  eq("…pregunta antes, diciendo que sus gastos salen de la cuenta corriente", await leer(p, "#confirmOverlay:not([hidden]) #confirmMessage", e => e.textContent.trim()),
    `¿Reabrir «Rutina de ${await p.evaluate(m => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(m + "T12:00:00Z")), mes)}»? Sus gastos dejan de estar aprobados y salen de tu cuenta corriente hasta que la vuelvas a aprobar. Después sumás el gasto que faltaba y la mandás de nuevo.`);
  await tocar(p, "#confirmOk");
  eq("…la reabre con la función de la base: vuelve a abierta y sus gastos, a confirmados", await hasta(p, () => {
    const r = window.__sb.tablas.gastos_rendiciones.find(x => x.id === "ren_rutina"), g = window.__sb.tablas.gastos.find(x => x.id === "gx4");
    return r.estado === "abierta" && g.estado === "confirmado" && !!document.querySelector('.gastos-view [data-action="gastos-subir"][data-id="ren_rutina"]'); }), true);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="sin"]'); await p.waitForTimeout(150);
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

/* ---------------- Administración → Gastos ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await irAdmin(p); await admin(p, "preferencias", "gastos");
  eq("la sección: el interruptor prendido y los siete tipos de siempre", await p.evaluate(() => [document.querySelector('[data-action="gastos-prender"]').checked,
    [...document.querySelectorAll(".gx-tipo-nombre")].map(e => e.value || e.placeholder)]),
    [true, ["Reunión", "Comida", "Pasaje", "Alojamiento", "Transporte", "Compra de material", "Suscripción"]]);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="sin"]'); await p.click('[data-action="gasto-abrir"][data-id="gx8"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("en un gasto se ofrecen los tipos nuevos, sin el oculto", await p.$$eval("#gxTipo [data-tipo]", l => l.map(o => o.textContent.trim())),
    ["Reunión", "Comidas y cafés", "Pasaje", "Alojamiento", "Transporte", "Compra de material", "Peajes y estacionamiento"]);
  await p.keyboard.press("Escape");
  await irAdmin(p); await admin(p, "preferencias", "gastos");
  await p.click(".settings-card .pref-switch .pref-slider");
  eq("apagarlo: se guarda y el módulo desaparece del menú", await hasta(p, () => (window.__sb.tablas.app_config.find(c => c.key === "preferences").value.gastos || {}).prendido === false), true);
  await abrirMenu(p);
  eq("…ya no está", await p.$$eval('.user-menu [data-view="gastos"]', l => l.length), 0);
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
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(150);
  eq(`${lang}: la flecha de volver apunta hacia atrás`, await p.$eval(".gx-volver", e => e.textContent.trim()[0]), lang === "he" ? "→" : "←");
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq(`${lang}: la ventana de un gasto también`, /Revisar el gasto|Concepto|Quién pagó|Forma de pago|Va en/.test(await p.$eval("#gastoBody", e => e.innerText)), false);
  await p.keyboard.press("Escape");
  for(const k of ["cuenta", "aprobar"]){ await p.click(`[data-action="gastos-seccion"][data-key="${k}"]`); await p.waitForTimeout(120); }
  eq(`${lang}: sin errores de página`, errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
