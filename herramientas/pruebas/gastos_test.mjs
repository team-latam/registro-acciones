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
  eq("cada una dice qué falta y cuánto suma", await textos(p, '[data-id="ren_mvd"] .gx-aviso, [data-id="ren_mvd"] .gx-t-total'), ["1 por confirmar", "USD 345,50"]);
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
  eq("la ventana: accesible, con el foco en la fecha y los datos sugeridos a la vista", await p.evaluate(() => [document.querySelector("#gastoOverlay .modal").getAttribute("role"),
    document.querySelector("#gastoOverlay .modal").getAttribute("aria-modal"), document.activeElement.id, document.getElementById("gxFecha").value, document.getElementById("gxConcepto").value,
    !!document.querySelector(".gx-sugerido")]), ["dialog", "true", "gxFecha", "2026-11-15", "Taxi al aeropuerto", true]);
  await p.click('[data-action="gasto-guardar"][data-confirmar="1"]');
  eq("confirmar sin tipo ni monto: lo dice, marca los dos campos y lleva el foco al primero", await p.evaluate(() => [document.querySelector("#gastoBody .form-error").textContent.trim(),
    document.getElementById("gxTipo").getAttribute("aria-invalid"), document.getElementById("gxMonto").getAttribute("aria-invalid"), document.activeElement.id]),
    ["Para confirmarlo falta el tipo, el monto.", "true", "true", "gxTipo"]);
  eq("y no escribe nada", (await tabla(p, "gastos")).find(g => g.id === foto.id).estado, "borrador");
  await p.selectOption("#gxTipo", "transporte");
  await p.fill("#gxMonto", "12.5");
  await p.fill("#gxMoneda", "ars"); await p.press("#gxMoneda", "Tab");
  eq("en otra moneda aparece el monto en dólares, con la moneda en mayúsculas", await p.evaluate(() => [document.getElementById("gxMoneda").value, !!document.getElementById("gxRendido")]), ["ARS", true]);
  await p.fill("#gxRendido", "8");
  await p.selectOption("#gxForma", "tarjeta");
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
  await p.fill("#gxFecha", mesAnt + "-03"); await p.fill("#gxConcepto", "Fotocopias"); await p.selectOption("#gxTipo", "material"); await p.fill("#gxMonto", "3");
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
  eq("el total confirmado suma lo que se rinde (en dólares cuando lo tiene)", await textos(p, ".gx-total b"), ["USD 353,50"]);
  await p.click('[data-action="gastos-enviar"]'); await aceptar(p);
  eq("mandar: pregunta y la manda con la función de la base", await hasta(p, () => window.__sb.tablas.gastos_rendiciones.find(r => r.id === "ren_mvd").estado === "enviada"), true);
  eq("…una vez", (await rpcs(p, "gastos_rendicion_enviar")), [{ p_id: "ren_mvd" }]);
  eq("mandada, dice que la está revisando un admin y no se puede tocar", await p.evaluate(() => [!!document.querySelector(".gx-info"), !document.querySelector('[data-action="gastos-subir"]'), !document.querySelector('[data-action="gastos-enviar"]')]), [true, true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx2"]'); await p.waitForSelector("#gastoOverlay:not([hidden])");
  eq("un gasto mandado se ve pero no se cambia", await p.evaluate(() => [document.getElementById("gxConcepto").disabled, !document.querySelector('[data-action="gasto-guardar"]')]), [true, true]);
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
  eq("para aprobar: lo mandado (de cualquiera, también lo propio), la plata por confirmar y lo que espera corrección",
    await textos(p, ".gastos-view .admin-h3"), ["Para revisar", "Plata anotada por confirmar", "Esperando la corrección"]);
  eq("las rendiciones mandadas, la más vieja primero y con de quién son", (await p.$$eval(".gastos-view .gx-lista", l => [...l[0].querySelectorAll(".gx-t-txt small")].map(e => e.textContent.split(" · ")[0]))),
    ["Ana Pérez", "Benny Rosenthal"]);
  await p.click('[data-action="gastos-mov-confirmar"][data-id="mv2"]');
  eq("confirmar la plata anotada", await hasta(p, () => window.__sb.tablas.gastos_movimientos.find(m => m.id === "mv2").estado === "confirmado"), true);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_ana"]'); await p.waitForTimeout(150);
  eq("la rendición de otra persona: con su nombre y «Aprobar»", await p.evaluate(() => [document.querySelector(".gx-cab .setting-sub").textContent.includes("Ana Pérez"), !!document.querySelector('[data-action="gastos-aprobar"]')]), [true, true]);
  await p.click('[data-action="gasto-abrir"][data-id="gx5"]'); await p.waitForSelector("#gastoOverlay:not([hidden]) #gxObs");
  await p.click('[data-action="gasto-observar"]');
  eq("observar sin comentario no se puede", await p.evaluate(() => [document.querySelector("#gastoBody .form-error").textContent.trim(), document.activeElement.id]), ["Escribí qué hay que corregir: le llega a la persona.", "gxObs"]);
  await p.fill("#gxObs", "Falta el ticket del micro");
  await p.click('[data-action="gasto-observar"]');
  eq("observar: con la función de la base y el comentario", await hasta(p, () => document.getElementById("gastoOverlay").hidden), true);
  eq("…lo que se mandó", (await rpcs(p, "gastos_observar")), [{ p_gasto: "gx5", p_texto: "Falta el ticket del micro" }]);
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
    ["-USD 172,00", "le debés a la organización", "USD 328,00", "USD 500,00", "USD 0,00"]);
  await p.selectOption("#gxMov_tipo", "ajuste"); await p.waitForTimeout(100);
  await p.fill("#gxMov_monto", "50"); await p.fill("#gxMov_descripcion", "Saldo inicial");
  await p.click('[data-action="gastos-mov-anotar"]');
  eq("un admin anota un ajuste, que ya cuenta", await hasta(p, () => /-USD\s122,00/.test(document.querySelector(".gx-saldo").textContent)), true);
  eq("…a nombre de la persona, confirmado", (await tabla(p, "gastos_movimientos")).filter(m => m.tipo === "ajuste").map(m => [m.persona, m.monto, m.moneda, m.estado, m.descripcion]), [[ADMIN, 50, "USD", "confirmado", "Saldo inicial"]]);
  await p.fill("#gxMov_monto", ""); await p.click('[data-action="gastos-mov-anotar"]');
  eq("sin monto, avisa", await p.$eval(".gx-anotar .form-error", e => e.textContent.trim()), "Falta el monto.");
  await p.selectOption("#gxCuentaDe", ANA.email); await p.waitForTimeout(150);
  eq("la cuenta de otra persona: lo recibido ya confirmado y lo que está en revisión aparte", await textos(p, ".gx-cuenta-mon .gx-saldo, .gx-cuenta-mon .gx-cm-sub, .gx-cm-filas dd"),
    ["-USD 200,00", "le debe a la organización", "USD 0,00", "USD 200,00", "USD 0,00", "USD 170,00"]);
  eq("sin errores de página en todo el camino", errores, []);
  await p.close();
}

/* ---------------- Los arreglos de la crítica del 15/11 ---------------- */
{
  // gx1 confirmado en pesos uruguayos, sin el monto en dólares: «Mandar» avisa.
  const base = datos({ prendido: true });
  Object.assign(base.gastos.find(g => g.id === "gx1"), { estado: "confirmado", tipo: "transporte", monto: 1250, moneda: "UYU" });
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
  eq("el total de la rendición cuenta solo lo confirmado, y dice cuántos quedan afuera", await textos(p, ".gx-total span"), ["Total confirmado (sin contar 1 por confirmar)"]);
  // Borrar desde la fila, sin abrir la ventana.
  eq("cada fila que se puede tocar tiene su «Borrar»", await p.$$eval('[data-action="gasto-quitar"]', l => l.map(e => e.dataset.id).sort()), ["gx1", "gx2", "gx3", nuevo.id].sort());
  await p.click(`[data-action="gasto-quitar"][data-id="${nuevo.id}"]`);
  eq("borrar pregunta, con el nombre", await p.$eval("#confirmMessage", e => /¿Borrar «peaje\.png» y su comprobante\?/.test(e.textContent)).catch(() => false), true);
  await p.click("#confirmOk");
  eq("…lo borra y el foco no se pierde", await hasta(p, id => !window.__sb.tablas.gastos.some(g => g.id === id) && !!document.activeElement.closest(".gastos-view"), nuevo.id), true);
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
  eq("cada fila con su comprobante grande al lado, que se abre", await p.$$eval(".gx-lfila", l => l.map(e => { const f = e.querySelector(".gx-lfoto"); return !!f && f.getBoundingClientRect().height >= 200; })), [true, true, true, true]);
  eq("sin nada marcado ni cambiado, el botón dice lo que haría y espera", await p.$eval('[data-action="gastos-lista-guardar"]', e => [e.textContent.trim(), e.disabled]), ["Guardar sin confirmar", true]);
  eq("cada fila trae lo que sugirió el nombre del archivo", await p.$eval(`#gxL_${id("12-11-2026 - Almuerzo - Lima.png")}_concepto`, e => [e.value, e.dataset.sug]), ["Almuerzo", "1"]);
  // El almuerzo: tipo y monto. Al quedar completo se marca solo.
  const a = id("12-11-2026 - Almuerzo - Lima.png"), f = id("factura.pdf"), c = id("foto.png");
  await p.selectOption(`#gxL_${a}_tipo`, "comida"); await p.fill(`#gxL_${a}_monto`, "20"); await p.press(`#gxL_${a}_monto`, "Tab"); await p.waitForTimeout(100);
  eq("completa, la fila se marca sola", await p.$eval(`#gxL_${a}_marca`, e => e.checked), true);
  // La factura, en pesos: aparece el monto en dólares.
  await p.fill(`#gxL_${f}_fecha`, "2026-11-10"); await p.fill(`#gxL_${f}_concepto`, "Fotocopias"); await p.selectOption(`#gxL_${f}_tipo`, "material");
  await p.fill(`#gxL_${f}_monto`, "3000"); await p.fill(`#gxL_${f}_moneda`, "ars"); await p.press(`#gxL_${f}_moneda`, "Tab"); await p.waitForTimeout(100);
  eq("en otra moneda aparece «En USD», con la moneda en mayúsculas", await p.evaluate(f => [document.getElementById(`gxL_${f}_moneda`).value, !!document.getElementById(`gxL_${f}_rendidoMonto`)], f), ["ARS", true]);
  await p.fill(`#gxL_${f}_rendidoMonto`, "3");
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
    return g(a).estado === "confirmado" && g(a).rendicion_id === "ren_mvd" && g(a).tipo === "comida" && g(a).monto === 20
      && g(f).estado === "confirmado" && g(f).moneda === "ARS" && g(f).monto === 3000 && g(f).rendido_monto === 3 && g(f).concepto === "Fotocopias"; }, [a, f]), true);
  eq("lo editado sin marcar se guarda sin confirmar, sin moverlo", await hasta(p, () => { const g = window.__sb.tablas.gastos.find(x => x.id === "gx8"); return g.estado === "borrador" && g.concepto === "Remís" && !g.rendicion_id; }), true);
  eq("el incompleto no se confirma: queda en la lista con lo que falta", await p.evaluate(c => [window.__sb.tablas.gastos.find(x => x.id === c).estado,
    (document.querySelector(`#gxL_${c}_marca`) || {}).closest ? document.getElementById(`gxL_${c}_marca`).closest(".gx-lfila").querySelector(".gx-lerror").textContent : "",
    document.getElementById(`gxL_${c}_tipo`).getAttribute("aria-invalid")], c), ["borrador", "Falta la fecha, el concepto, el tipo, el monto.", "true"]);
  eq("y el aviso cuenta lo que pasó", await textos(p, ".gx-lista-rev .gx-alerta"), ["Se confirmaron 2 gastos. 1 quedó guardado sin confirmar. 1 no se pudo confirmar: mirá lo marcado en su fila."]);
  eq("en la lista quedan los dos que faltan", await p.$$eval(".gx-lfila", l => l.length), 2);
  await p.click('[data-action="gastos-lista-cerrar"]'); await p.waitForTimeout(150);
  eq("«Volver a la vista de siempre» sin cambios nuevos no pregunta", await p.evaluate(() => [!document.querySelector(".gx-lista-rev"), document.getElementById("confirmOverlay").hidden]), [true, true]);
  await p.click('[data-action="gastos-lista-abrir"]'); await p.waitForTimeout(150);
  await p.fill("#gxL_gx8_monto", "15");
  await p.click('[data-action="gastos-lista-cerrar"]');
  eq("con cambios sin guardar, pregunta antes de volver", await p.evaluate(() => !document.getElementById("confirmOverlay").hidden), true);
  await p.click("#confirmCancel"); await p.waitForTimeout(100);
  eq("…y si no, sigue en la lista con lo escrito", await p.$eval("#gxL_gx8_monto", e => e.value), "15");
  // «La misma moneda a todos».
  await p.fill("#gxListaMoneda", "brl"); await p.click('[data-action="gastos-lista-moneda"]'); await p.waitForTimeout(100);
  eq("«La misma moneda a todos» la pone en cada fila", await p.$$eval('.gx-lfila input[data-glista$=":moneda"]', l => l.map(e => e.value)), ["BRL", "BRL"]);
  // Borrar desde la lista.
  await p.click(`[data-action="gastos-lista-quitar"][data-id="${c}"]`); await aceptar(p);
  eq("«Borrar» en una fila de la lista la borra (preguntando)", await hasta(p, c => !window.__sb.tablas.gastos.some(g => g.id === c) && document.querySelectorAll(".gx-lfila").length === 1, c), true);
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
  eq("en un gasto se ofrecen los tipos nuevos, sin el oculto", await p.$$eval("#gxTipo option", l => l.map(o => o.textContent).slice(1)),
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
  eq(`${lang}: la ventana de un gasto también`, /Revisar el gasto|Concepto|Quién puso la plata|Forma de pago|Va en/.test(await p.$eval("#gastoBody", e => e.innerText)), false);
  await p.keyboard.press("Escape");
  for(const k of ["cuenta", "aprobar"]){ await p.click(`[data-action="gastos-seccion"][data-key="${k}"]`); await p.waitForTimeout(120); }
  eq(`${lang}: sin errores de página`, errores, []);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
