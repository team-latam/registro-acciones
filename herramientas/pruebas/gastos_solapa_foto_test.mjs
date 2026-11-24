/* ======================================================================
   Gastos: la solapa que no se hace esperar, el «+» adentro y la cámara (20/11/2026)

   Lo marcó el usuario mirando la pantalla:
   - La solapa «Gastos» aparecía más tarde que las demás (esperaba a leer la
     configuración del módulo) y movía a «Reportes». Ahora se muestra desde el
     primer momento, como estaba la última vez en ese aparato (o, la primera
     vez, como es lo normal para quien carga), y después se confirma o se saca.
   - Adentro de Gastos, en la compu, no estaba el «+» (se había sacado el 18/11
     por taparle botones): vuelve, como en todas las solapas.
   - Para subir un comprobante no había cómo sacar una foto: en Android, con
     fotos y PDF juntos en el selector, no se ofrece la cámara. Ahora hay un
     «📷 Sacar una foto» aparte (solo en pantallas táctiles), que abre la cámara
     y manda la foto por el mismo camino que cualquier comprobante.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const datos = gastos => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  const pref = base.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos };
  return base;
};
const hasta = async (p, f, ...a) => { const fin = Date.now() + 6000; while(Date.now() < fin){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
// Las solapas que se ven de verdad, en orden.
const pestanas = p => p.$$eval("#tabs button[data-view]", l => l.filter(b => !b.hidden && b.offsetParent).map(b => b.dataset.view));
const recordada = p => p.evaluate(() => { try{ return JSON.parse(localStorage.getItem("ra_gastos_solapa") || "null"); }catch(e){ return "roto"; } });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// La configuración tarda en llegar (2,5 s) y, si se pide, ya se sabe qué se vio la última vez.
const tardaConfig = (recuerda, quien) => `window.__sb.demoraDe = { app_config: 2500 };`
  + (recuerda === undefined ? "" : `try{ localStorage.setItem("ra_gastos_solapa", ${JSON.stringify(JSON.stringify({ u: quien, v: recuerda }))}); }catch(e){}`);
const TODAS = ["feed", "calendario", "paises", "proyectos", "gastos", "reportes"], SIN = ["feed", "calendario", "paises", "proyectos", "reportes"];

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 }, celu = { width: 390, height: 844 };

/* ---------------- La solapa no espera a la configuración ---------------- */
{
  // Sin nada recordado (primera vez en este aparato): como es lo normal, está desde el principio.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), iniciar: tardaConfig() });
  eq("la configuración todavía no llegó (el prueba mide lo que se ve mientras tanto)", await p.evaluate(() => (window.__sb.consultas || []).filter(t => t === "app_config").length >= 1 && !document.querySelector(".gastos-view")), true);
  eq("sin nada recordado, la solapa Gastos ya está, en su lugar, mientras llega la configuración", await pestanas(p), TODAS);
  await hasta(p, () => !!localStorage.getItem("ra_gastos_solapa"));
  eq("al llegar la configuración sigue ahí y se recuerda para la próxima vez (de esa persona)", [await pestanas(p), await recordada(p)], [TODAS, { u: ADMIN, v: true }]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // La última vez estaba apagada: no aparece ni un instante, y si se prendió, aparece cuando llega.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), iniciar: tardaConfig(false, ADMIN) });
  eq("recordada como apagada: mientras llega la configuración no está", await pestanas(p), SIN);
  await hasta(p, () => !!document.querySelector('#tabs button[data-view="gastos"]:not([hidden])'));
  eq("…y cuando llega la configuración (está prendido) aparece y se recuerda", [await pestanas(p), (await recordada(p)).v], [TODAS, true]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // La última vez estaba y un admin lo apagó: se ve hasta que llega la configuración y después se va (y se recuerda).
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: false }), iniciar: tardaConfig(true, ADMIN) });
  eq("recordada como prendida: mientras llega la configuración se ve", await pestanas(p), TODAS);
  await hasta(p, () => !document.querySelector('#tabs button[data-view="gastos"]:not([hidden])'));
  eq("…y cuando llega la configuración (apagado) se saca, y se recuerda apagada", [await pestanas(p), (await recordada(p)).v], [SIN, false]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Lo recordado es de la persona: lo de otra cuenta en el mismo aparato no vale (una apagada para otra, la ve igual).
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), iniciar: tardaConfig(false, "otra@team-latam.com") });
  eq("lo recordado por otra cuenta no cuenta: como es lo normal, está", await pestanas(p), TODAS);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Un observador nunca la ve, ni de antemano, aunque haya algo recordado.
  const { p, errores } = await entrar(b, OBS, "Olga Observa", { viewport: vp, base: datos({ prendido: true }), iniciar: tardaConfig(true, OBS) });
  eq("un observador no ve la solapa mientras llega la configuración", (await pestanas(p)).includes("gastos"), false);
  await p.waitForTimeout(2600);
  eq("…ni después", (await pestanas(p)).includes("gastos"), false);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Tocarla antes de que llegue la configuración no rebota al Feed: espera («Cargando…») y se abre.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }), iniciar: tardaConfig(true, ADMIN) });
  await p.click('#tabs button[data-view="gastos"]');
  await p.waitForTimeout(300);
  eq("tocada antes de tiempo, queda en Gastos esperando (no vuelve al Feed)", await p.evaluate(() => [(document.querySelector("#tabs button.active") || {}).dataset?.view, !!document.querySelector(".gastos-view")]), ["gastos", true]);
  eq("…y cuando llega la configuración se ven sus datos", await hasta(p, () => !!document.querySelector('.gastos-view [data-action="gastos-destino-abrir"], .gastos-view .gx-tarjeta')), true);
  eq("…en la misma solapa", await p.evaluate(() => (document.querySelector("#tabs button.active") || {}).dataset?.view), "gastos");
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Apagado desde antes (el admin lo apagó y no hay nada recordado de esta cuenta): tocarla no es posible; y un enlace
  // guardado en Gastos termina en el Feed apenas se sabe que está apagado.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: false }), iniciar: tardaConfig(false, ADMIN) });
  await p.waitForTimeout(2800);
  eq("apagado: sigue sin solapa, ni durante ni después", await pestanas(p), SIN);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- El «+» adentro de Gastos ---------------- */
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(250);
  eq("en Gastos, en la compu, está el «+» (como en las demás solapas)", await p.evaluate(() => { const f = document.getElementById("fab"), m = document.getElementById("fabMain"); const r = m.getBoundingClientRect();
    return !f.hidden && getComputedStyle(f).display !== "none" && r.width > 0 && r.bottom <= innerHeight && r.right <= innerWidth; }), true);
  await p.click("#fabMain"); await p.waitForTimeout(150);
  eq("…y tiene lo de siempre, con «Subir comprobantes»", await p.$$eval(".fab-action", l => l.filter(b => !b.hidden).map(b => b.textContent.trim())), ["📝Nueva actividad", "📅Nuevo evento", "🧾Subir comprobantes"]);
  await p.click("#fabGastos");
  eq("«Subir comprobantes» del + lleva a «¿De qué son estos comprobantes?», con el foco ahí", await hasta(p, () => document.activeElement && document.activeElement.id === "gxDestino"), true);
  // En una rendición, el «+» sigue estando.
  await p.click('[data-action="gastos-destino-cancelar"]');
  await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendiciones"]').click()); await p.waitForTimeout(150);
  eq("en «Rendiciones» también", await p.evaluate(() => getComputedStyle(document.getElementById("fab")).display !== "none"), true);
  await p.evaluate(() => document.querySelector('[data-action="gastos-seccion"][data-key="rendir"]').click()); await p.waitForTimeout(150);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(200);
  eq("abierta una rendición, también", await p.evaluate(() => getComputedStyle(document.getElementById("fab")).display !== "none"), true);
  // Revisando en lista, los botones de abajo flotan: ahí el «+» se corre (como antes).
  await p.evaluate(() => document.querySelector('[data-action="gastos-lista-abrir"]').click()); await p.waitForTimeout(200);
  eq("revisando en lista, el «+» no tapa los botones que flotan abajo", await p.evaluate(() => getComputedStyle(document.getElementById("fab")).display), "none");
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200);
  eq("en el celular, en Gastos, el «+» sigue en el medio de la barra de abajo", await p.evaluate(() => { const r = document.getElementById("fabMain").getBoundingClientRect(); return getComputedStyle(document.getElementById("fab")).display !== "none" && Math.abs((r.left + r.width / 2) - innerWidth / 2) < 2; }), true);
  eq("sin errores de página", errores, []);
  await p.close();
}

/* ---------------- La cámara ---------------- */
const filas = p => p.evaluate(() => (window.__sb.tablas.gastos || []).filter(g => g.archivo_nombre && /^Foto /.test(g.archivo_nombre)).map(g => ({ n: g.archivo_nombre, r: g.rendicion_id, t: g.archivo_tipo, e: g.estado })));
{
  // En la compu no hay botón de cámara (el navegador ignoraría `capture`: abriría el mismo selector de archivos).
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: vp, base: datos({ prendido: true }) });
  await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view");
  await p.click('[data-action="gastos-destino-abrir"]'); await p.waitForSelector("#gxDestino");
  eq("en la compu, «¿De qué son…?» no ofrece sacar una foto", await p.$$eval('[data-action="gastos-destino-foto"], [data-action="gastos-foto"]', l => l.length), 0);
  await p.click('[data-action="gastos-destino-cancelar"]');
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForTimeout(200);
  eq("…ni arriba de los gastos de una rendición", await p.$$eval('[data-action="gastos-foto"]', l => l.length), 0);
  eq("el selector de archivos sigue igual: varios, fotos y PDF", await p.$eval("#gastosArchivos", e => [e.multiple, e.accept]), [true, "image/*,application/pdf"]);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  eq("(el celular de la prueba tiene pantalla táctil)", await p.evaluate(() => matchMedia("(pointer: coarse)").matches), true);
  eq("el campo de la cámara: solo imágenes, una por vez, con la cámara de atrás (`capture`)", await p.$eval("#gastosFoto", e => [e.accept, e.multiple, e.getAttribute("capture"), e.type]), ["image/*", false, "environment", "file"]);
  await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200);
  await p.click('[data-action="gastos-destino-abrir"]'); await p.waitForSelector("#gxDestino");
  eq("en el celular, «¿De qué son…?» ofrece «📷 Sacar una foto» (apagado hasta elegir de qué son)", await p.$eval('[data-action="gastos-destino-foto"]', e => [e.textContent.trim(), e.disabled]), ["📷 Sacar una foto", true]);
  await p.selectOption("#gxDestino", "post:p9");
  eq("elegido el viaje, se prende (como «Elegir los archivos»)", await p.evaluate(() => [document.querySelector('[data-action="gastos-destino-foto"]').disabled, document.querySelector('[data-action="gastos-destino-elegir"]').disabled]), [false, false]);
  const antes = (await filas(p)).length;
  const [ch] = await Promise.all([p.waitForEvent("filechooser"), p.click('[data-action="gastos-destino-foto"]')]);
  eq("toca la cámara: abre el campo de la cámara (no el de archivos): una sola foto", [ch.isMultiple(), await ch.element().evaluate(e => e.id)], [false, "gastosFoto"]);
  await ch.setFiles({ name: "image.jpg", mimeType: "image/jpeg", buffer: PNG });
  eq("la foto sube como un comprobante más, en el viaje elegido, por confirmar, con un nombre que dice cuándo se sacó", await hasta(p, () => (window.__sb.tablas.gastos || []).some(g => /^Foto \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}\.jpg$/.test(g.archivo_nombre || ""))), true);
  const nuevas = await filas(p);
  eq("…una sola, en Montevideo, como foto, sin confirmar", [nuevas.length - antes, nuevas[nuevas.length - 1] && nuevas[nuevas.length - 1].r, nuevas[nuevas.length - 1] && nuevas[nuevas.length - 1].t, nuevas[nuevas.length - 1] && nuevas[nuevas.length - 1].e], [1, "ren_mvd", "image/jpeg", "borrador"]);
  await hasta(p, () => !!document.querySelector(".gx-filas-acc"));
  eq("terminada la subida se ve esa rendición, con «Subir más» y «📷 Sacar una foto» arriba de los gastos", await p.evaluate(() => [...document.querySelectorAll(".gx-filas-acc [data-action]")].map(b => b.textContent.trim())), ["📎 Subir más", "📷 Sacar una foto"]);
  // Otra foto, desde ahí: va a esa rendición sin volver a preguntar.
  const [ch2] = await Promise.all([p.waitForEvent("filechooser"), p.click('.gx-filas-acc [data-action="gastos-foto"]')]);
  await ch2.setFiles({ name: "image.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([PNG, Buffer.from("otra")]) });
  eq("la segunda foto va a la misma rendición (sin repetirse con la primera)", await hasta(p, () => (window.__sb.tablas.gastos || []).filter(g => /^Foto /.test(g.archivo_nombre || "") && g.rendicion_id === "ren_mvd").length === 2), true);
  eq("el celular no se corre de costado", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // La misma foto dos veces no se repite (la huella es del contenido, no del nombre) y avisa con el nombre de la foto.
  const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, base: datos({ prendido: true }) });
  await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200);
  await p.click('[data-action="gastos-abrir-rendicion"][data-id="ren_mvd"]'); await p.waitForSelector(".gx-filas-acc");
  for(let i = 0; i < 2; i++){
    const [ch] = await Promise.all([p.waitForEvent("filechooser"), p.click('.gx-filas-acc [data-action="gastos-foto"]')]);
    await ch.setFiles({ name: "image.jpg", mimeType: "image/jpeg", buffer: PNG });
    await hasta(p, () => !document.querySelector(".gx-subida") || !/Subiendo/.test(document.querySelector(".gx-subida").textContent));
    await p.waitForTimeout(400);
  }
  eq("la misma foto dos veces queda una sola vez", (await filas(p)).length, 1);
  eq("sin errores de página", errores, []);
  await p.close();
}
{
  // Los cuatro idiomas: el botón dice lo mismo que «Subir comprobantes» en su idioma (y el hebreo, de derecha a izquierda).
  for(const [lang, texto] of [["es", "📷 Sacar una foto"], ["en", "📷 Take a photo"], ["pt", "📷 Tirar uma foto"], ["he", "📷 צילום קבלה"]]){
    const { p, errores } = await entrar(b, ADMIN, PERS[0].name, { viewport: celu, lang, base: datos({ prendido: true }) });
    await p.evaluate(() => document.querySelector('.bn-item[data-action="toggle-more-menu"]').click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('.bn-sheet-item[data-view="gastos"]').click()); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200);
    await p.click('[data-action="gastos-destino-abrir"]'); await p.waitForSelector("#gxDestino");
    eq(`idioma ${lang}: el botón de la cámara`, await p.$eval('[data-action="gastos-destino-foto"]', e => e.textContent.trim()), texto);
    eq(`idioma ${lang}: sin correrse de costado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    eq(`idioma ${lang}: sin errores de página`, errores, []);
    await p.close();
  }
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
