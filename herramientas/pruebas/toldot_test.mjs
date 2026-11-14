/* ======================================================================
   Toldot: el nombre y la marca (14/11/2026)

   El sistema, que se llamaba «Registro de Acciones» y usaba el emoji 🗺️ de logo, pasa a
   llamarse **Toldot** (en hebreo, תולדות: «generaciones») y estrena marca: cuatro aros
   unidos por tres líneas, un árbol genealógico mínimo (paquete de marca del 14/11/2026,
   herramientas/publicar/marca/). «Registro de Acciones» queda como lo que es: la línea de
   abajo, el concepto (en hebreo, «יומן פעולות»; en inglés, «Action Log»).

   Esta prueba mide, con la app de verdad:
   - la pestaña: el título y un ícono propio, incrustado (data:, que la CSP ya permite);
   - el encabezado, en los cuatro idiomas: la marca (normal en la compu, chica en el celular,
     con el aria-label «Toldot»), el nombre, la línea de abajo y que NO se espeja en hebreo;
   - que el hueco de cada aro sea del color del fondo, en claro y en oscuro (el aro tapa la
     punta de la línea: con otro color se vería un punto);
   - que en el celular la línea de abajo no se corte con puntos suspensivos, también con
     una letra mucho más ancha que la de esta máquina (GitHub corre las pruebas con otra);
   - la pantalla de entrada: la marca en su cuadrado, el nombre y la línea;
   - el pie y lo impreso (el título de los informes lleva la marca y el nombre).
   Y que el emoji 🗺️ ya no hace de logo (queda solo como ícono de «Países»).
   INDEX=/ruta/a/index-viejo.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// ---- La cabeza de la página (estático)
ok("el título de la pestaña es «Toldot · Team LatAm»", /<title>Toldot · Team LatAm<\/title>/.test(html));
ok("la pestaña tiene un ícono propio, incrustado (data:image/svg+xml)", /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/.test(html));
ok("el ícono de la pestaña es la marca de Toldot (aria-label='Toldot', cuatro aros)", (html.match(/<link rel="icon"[^>]*>/) || [""])[0].split("circle").length === 5 && /aria-label='Toldot'/.test(html));
ok("el encabezado ya no usa el emoji 🗺️ de logo", !/<span class="logo">🗺️<\/span>/.test(html));
ok("la CSP permite imágenes data: (si no, el ícono de la pestaña no se vería)", /img-src [^;]*\bdata:/.test(html));

const NOMBRE = { "": "Toldot", en: "Toldot", pt: "Toldot", he: "תולדות" };
const DESCRIPCION = { "": "Registro de Acciones", en: "Action Log", pt: "Registro de Ações", he: "יומן פעולות" };

const b = await abrirNavegador();
for(const lang of ["", "en", "pt", "he"]){
  const id = lang || "es";
  // ---- Compu
  { const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, lang });
    const e = await p.evaluate(() => {
      const marcas = [...document.querySelectorAll(".brand .logo .toldot-marca")].map(m => ({ clase: m.getAttribute("class"), visible: m.getBoundingClientRect().width > 0, ancho: Math.round(m.getBoundingClientRect().width), dir: m.getAttribute("dir"), nombre: m.getAttribute("aria-label"), aros: m.querySelectorAll("circle").length }));
      const h1 = document.querySelector(".brand h1"), sub = document.querySelector(".brand .sub");
      const vis = el => el && getComputedStyle(el).display !== "none";
      return { marcas, h1: h1.textContent.trim(), sub: sub.textContent.trim().replace(/\s+/g, " "), subEq: vis(sub.querySelector(".sub-eq")), titulo: document.title, pie: (document.querySelector("footer.appfoot") || {}).textContent, dir: document.documentElement.dir };
    });
    const normal = e.marcas.find(m => /normal/.test(m.clase)), chica = e.marcas.find(m => /chica/.test(m.clase));
    eq(`[${id}] compu: el nombre es «${NOMBRE[lang]}»`, e.h1, NOMBRE[lang]);
    eq(`[${id}] compu: debajo, qué es: «${DESCRIPCION[lang]} · Team LatAm»`, e.sub, `${DESCRIPCION[lang]} · Team LatAm`);
    eq(`[${id}] compu: se ve la marca normal (28 px) y no la chica`, [!!normal && normal.visible, normal && normal.ancho, !!chica && chica.visible], [true, 28, false]);
    eq(`[${id}] compu: la marca tiene cuatro aros, nombre accesible «Toldot» y dir=ltr (no se espeja en hebreo)`, [normal.aros, normal.nombre, normal.dir], [4, "Toldot", "ltr"]);
    eq(`[${id}] el título de la pestaña y el pie dicen Toldot`, [e.titulo, e.pie], [`${NOMBRE[lang]} · Team LatAm`, `${NOMBRE[lang]} · Team LatAm`]);
    eq(`[${id}] sin errores en la página`, errores, []);
    // La marca no se espeja: la geometría es la misma con la pantalla de derecha a izquierda (el aro de arriba a la izquierda queda a la izquierda).
    const geo = await p.evaluate(() => { const m = document.querySelector(".brand .logo .toldot-marca.normal"); const c = [...m.querySelectorAll("circle")].map(x => x.getBoundingClientRect()); const r = m.getBoundingClientRect();
      let el = m, espejo = false; while(el){ const t = getComputedStyle(el).transform; if(t && t !== "none" && /matrix\(-/.test(t)) espejo = true; el = el.parentElement; }
      return { izquierdaMenorQueDerecha: c[0].left < c[1].left, arribaIzq: c[0].top < c[3].top, espejo, dentro: c.every(x => x.left >= r.left - 1 && x.right <= r.right + 1) }; });
    eq(`[${id}] compu: la geometría es la de siempre (aro izquierdo a la izquierda, sin transform de espejo)`, geo, { izquierdaMenorQueDerecha: true, arribaIzq: true, espejo: false, dentro: true });
    await p.close(); }

  // ---- Celular
  { const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 }, lang });
    const e = await p.evaluate(() => {
      const m = [...document.querySelectorAll(".brand .logo .toldot-marca")].map(x => ({ clase: x.getAttribute("class"), ancho: Math.round(x.getBoundingClientRect().width) }));
      const sub = document.querySelector(".brand .sub"), vis = el => el && getComputedStyle(el).display !== "none";
      return { marcas: m.filter(x => x.ancho > 0), sub: [...sub.children].filter(vis).map(x => x.textContent).join("").trim(), cortado: sub.scrollWidth > sub.clientWidth + 1 };
    });
    eq(`[${id}] celular: se ve solo la marca chica (22 px, puntos llenos)`, e.marcas.map(x => [/chica/.test(x.clase), x.ancho]), [[true, 22]]);
    eq(`[${id}] celular: la línea de abajo es «${DESCRIPCION[lang]}» (sin «· Team LatAm», que no entra)`, e.sub, DESCRIPCION[lang]);
    eq(`[${id}] celular: la línea de abajo no se corta con puntos suspensivos`, e.cortado, false);
    await p.close(); }
}

// ---- El hueco de cada aro es del color del fondo, en claro y en oscuro
for(const dark of [false, true]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, dark });
  const r = await p.evaluate(() => {
    const m = document.querySelector(".brand .logo .toldot-marca.normal"), hueco = getComputedStyle(m.querySelector("circle")).fill;
    const petroleo = getComputedStyle(document.documentElement).getPropertyValue("--petroleo").trim();
    const probe = document.createElement("i"); probe.style.color = petroleo; document.body.append(probe); const esperado = getComputedStyle(probe).color; probe.remove();
    return { hueco, esperado };
  });
  eq(`[${dark ? "oscuro" : "claro"}] el hueco de los aros es el petróleo del encabezado de ese modo`, r.hueco, r.esperado);
  await p.close();
}

// ---- Con una letra mucho más ancha (la de GitHub): la línea de abajo en el celular sigue sin cortarse
for(const [ancho, lang] of [[360, ""], [360, "pt"], [360, "en"], [360, "he"]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 740 }, lang });
  await p.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif !important}' }); await p.waitForTimeout(300);
  const c = await p.evaluate(() => { const s = document.querySelector(".brand .sub"); return { cortado: s.scrollWidth > s.clientWidth + 1, h1: document.querySelector(".brand h1").scrollWidth > document.querySelector(".brand h1").clientWidth + 1 }; });
  eq(`[${lang || "es"}, ${ancho} px, letra ancha] ni el nombre ni la línea de abajo se cortan`, c, { cortado: false, h1: false });
  await p.close();
}

// ---- La pantalla de entrada
for(const lang of ["", "he"]){
  const { p } = await entrar(b, "x@x.com", "X", { viewport: { width: 1280, height: 800 }, sinSesion: true, lang });
  const g = await p.evaluate(() => { const l = document.querySelector(".gate-logo"); const m = l && l.querySelector("svg.toldot-marca"); const r = l && l.getBoundingClientRect(), mr = m && m.getBoundingClientRect();
    return { tile: r && [Math.round(r.width), Math.round(r.height)], marca: mr && Math.round(mr.width), aros: m ? m.querySelectorAll("circle").length : 0, emoji: l ? /🗺/.test(l.textContent) : null, h1: document.querySelector(".gate-marca h1").textContent.trim(), linea: document.querySelector(".gate-equipo").textContent.trim(), pie: document.querySelector(".gate-pie").textContent.trim(),
      hueco: m ? getComputedStyle(m.querySelector("circle")).fill : null }; });
  eq(`[${lang || "es"}] entrada: la marca (48 px) va en el cuadrado de 68 px, sin el emoji del mapa`, [g.tile, g.marca, g.aros, g.emoji], [[68, 68], 48, 4, false]);
  eq(`[${lang || "es"}] entrada: el nombre y la línea de abajo`, [g.h1, g.linea], [NOMBRE[lang], `${DESCRIPCION[lang]} · Team LatAm`]);
  eq(`[${lang || "es"}] entrada: el pie`, g.pie, `${NOMBRE[lang]} · Team LatAm`);
  ok(`[${lang || "es"}] entrada: el hueco de los aros no es blanco ni transparente (es el color del cuadrado)`, !!g.hueco && g.hueco !== "rgb(255, 255, 255)" && !/rgba\(.*, 0\)/.test(g.hueco), g.hueco);
  await p.close();
}

// ---- La pantalla de entrada en un celular chico y con letra ancha: el nombre y la línea (con interletrado amplio) no empujan la página de costado
for(const lang of ["", "pt", "en", "he"]){
  const { p } = await entrar(b, "x@x.com", "X", { viewport: { width: 360, height: 740 }, sinSesion: true, lang });
  await p.addStyleTag({ content: '*{font-family:"DejaVu Sans",sans-serif !important}' }); await p.waitForTimeout(300);
  const c = await p.evaluate(() => ({ lado: document.documentElement.scrollWidth <= innerWidth, h1: (() => { const e = document.querySelector(".gate-marca h1"); return e.scrollWidth <= e.clientWidth + 1; })(), linea: (() => { const e = document.querySelector(".gate-equipo"); const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })() }));
  eq(`[${lang || "es"}, 360 px, letra ancha] entrada: nada empuja la página de costado ni se sale de la pantalla`, c, { lado: true, h1: true, linea: true });
  await p.close();
}

// ---- Lo impreso: el título de un informe lleva la marca y el nombre
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await tab(p, "reportes"); await p.waitForTimeout(600);
  const t = await p.evaluate(() => { const e = document.querySelector(".rep-print-title span"); return e ? { texto: e.textContent.trim().replace(/\s+/g, " "), marca: !!e.querySelector("svg.toldot-marca"), decorativa: e.querySelector("svg") && e.querySelector("svg").getAttribute("aria-hidden") } : null; });
  eq("lo impreso: el título del informe lleva la marca (decorativa) y «Toldot · Registro de Acciones · Team LatAm»", t, { texto: "Toldot · Registro de Acciones · Team LatAm", marca: true, decorativa: "true" });
  await p.close(); }

// ---- El emoji 🗺️ sigue en «Países» (ícono de la solapa), ya no es la marca
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  const x = await p.evaluate(() => ({ pais: !!document.querySelector('.bn-item[data-view="paises"], nav.tabs button[data-view="paises"]'), enMarca: /🗺/.test(document.querySelector(".brand").textContent) }));
  eq("el mapa 🗺️ ya no está en la marca del encabezado", x.enMarca, false);
  await p.close(); }

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
