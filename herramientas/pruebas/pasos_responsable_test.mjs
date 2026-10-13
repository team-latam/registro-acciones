/* ======================================================================
   Responsable y fecha en cada paso de «Lo que sigue» (13/10/2026,
   propuesta 1-B)

   Los pasos que salen del Formulario de Cierre solo se tildaban: no decían
   quién se encarga ni para cuándo. El usuario eligió sumar las dos cosas,
   en los mismos dos lugares de siempre (el panel «Resumen» de la tarjeta y
   la ficha de cada lugar):
   - quien puede editar el evento elige un responsable (una ventanita con buscador y la
     lista del equipo que carga, no los observadores) y una fecha, y cada cambio se guarda al
     elegirlo, con quién lo asignó y cuándo;
   - un paso pendiente con la fecha ya pasada se ve «vencido»;
   - quien no puede editar (un observador) ve lo mismo como etiquetas, sin menús;
   - tildar un paso y destildarlo conserva el responsable y la fecha.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const ANA = PERS[1], DIEGO = PERS[2];
const comoSeEscribe = iso => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const datos = (editar = x => x) => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  const p1 = base.posts.find(x => x.id === "p1");
  editar(p1.resumen.partes[0].pasos);
  return base;
};
const paso = (p, i = 0) => p.evaluate(i => window.__sb.tablas.posts.find(x => x.id === "p1").resumen.partes[0].pasos[i], i);
const hasta = async (p, f, ...a) => { for(let i = 0; i < 40; i++){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
// Abrir el selector de fechas: primero el botón a la vista y quieto, porque un scroll cierra el selector.
const abrirFecha = async (p, sel) => { await p.$eval(sel, e => e.scrollIntoView({ block: "center" })); await p.waitForTimeout(350); await p.click(sel); await p.waitForSelector(".date-pop:not([hidden]) .dp-date-input"); };
// «+ Responsable» abre una ventanita con buscador y lista (13/10/2026): se abre, se toca a alguien (o «Quitar responsable»).
const elegir = async (p, disparador, email) => {
  await p.click(disparador); await p.waitForSelector("#respPop:popover-open");
  await p.click(email ? `#respPop .rp-op[data-email="${email}"]` : "#respPop .rp-quitar");
  await p.waitForFunction(() => !document.getElementById("respPop").matches(":popover-open"));
};
const tarjeta = '.post[data-post-id="p1"]';
const primero = tarjeta + " .rs-pasos li:first-child";

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };

/* ---- Quien puede editar: elige responsable y fecha ---- */
{
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  const avisos = []; p.on("request", r => { if(/\/functions\/v1\/avisar/.test(r.url()) && r.method() === "POST") avisos.push(JSON.parse(r.postData() || "{}")); });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  eq("cada paso pendiente tiene su menú de responsable y su fecha", await p.$$eval(tarjeta + " .rs-pasos li", l => l.map(e => [!!e.querySelector(".rs-resp"), !!e.querySelector(".rs-fecha")])), [[true, true], [true, true]]);
  eq("sin asignar, se lee «+ Responsable» y «+ Fecha»", await p.$eval(primero, e => [e.querySelector(".rs-resp").textContent.trim(), e.querySelector(".rs-fecha").textContent.trim().replace(/^📅\s*/, "")]), ["+ Responsable", "+ Fecha"]);
  await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
  eq("la ventanita ofrece al equipo que carga (5) y no al observador", await p.$$eval("#respPop .rp-op", l => [l.length, l.map(o => o.dataset.email).includes("obs@team-latam.com")]), [5, false]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);

  await elegir(p, primero + " .rs-resp", DIEGO.email);
  eq("elegir un responsable lo guarda, con quién lo asignó", await hasta(p, (d) => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return x.resp === d && x.asigPor === "ana@team-latam.com" && !!x.asigEl; }, DIEGO.email), true);
  eq("…y el botón muestra su nombre", await hasta(p, () => /Diego/.test(document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-resp').textContent)), true);
  eq("…sin tocar el otro paso", (await paso(p, 1)).resp || null, null);
  eq("darle el paso a otra persona le pide a la función de avisos el correo, por el paso", await hasta(p, () => true) && avisos, [{ tipo: "paso", id: "p1#x1" }]);

  // La fecha: tipeada en el selector de fechas de la app, y ya pasada.
  const pasada = dia(3);
  await abrirFecha(p, primero + " .rs-fecha");
  await p.fill(".date-pop:not([hidden]) .dp-date-input", comoSeEscribe(pasada)); await p.keyboard.press("Enter");
  eq("elegir una fecha la guarda", await hasta(p, (f) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].para === f, pasada), true);
  eq("una fecha ya pasada se ve «vencido»", await hasta(p, () => { const e = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-fecha'); return !!e && e.classList.contains("vencido") && /vencido/.test(e.textContent); }), true);

  // Una fecha que viene: ya no está vencido. (Tras tipear, el selector sigue abierto: se cierra y se vuelve a abrir.)
  const futura = dia(-10);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await abrirFecha(p, primero + " .rs-fecha");
  await p.fill(".date-pop:not([hidden]) .dp-date-input", comoSeEscribe(futura)); await p.keyboard.press("Enter");
  eq("con una fecha que viene, no figura vencido", await hasta(p, (f) => { const e = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-fecha'); return window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].para === f && !!e && !e.classList.contains("vencido") && !/vencido/.test(e.textContent); }, futura), true);

  eq("cambiar solo la fecha no manda otro aviso", avisos.length, 1);
  // Dárselo a sí misma o sacarlo no avisa a nadie.
  await elegir(p, primero + " .rs-resp", ANA.email); await hasta(p, (a) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === a, ANA.email);
  await p.waitForTimeout(500);
  await elegir(p, primero + " .rs-resp", DIEGO.email); await hasta(p, (d) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === d, DIEGO.email);
  await p.waitForTimeout(300);
  eq("dárselo a sí misma no avisa; volver a dárselo a Diego, sí", avisos.length, 2);

  // Tildar y destildar conserva todo.
  await p.keyboard.press("Escape");
  await p.click(primero + ' input[data-action="resumen-paso"]');
  eq("tildar el paso lo deja hecho y conserva responsable y fecha", await hasta(p, (d) => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return x.estado === "hecho" && x.resp === d && !!x.para; }, DIEGO.email), true);
  await p.click(tarjeta + ' [data-action="resumen-todos-pasos"]'); await p.waitForTimeout(300);
  await p.click(tarjeta + ' .rs-pasos li.hecho input[data-action="resumen-paso"]');
  eq("destildarlo lo vuelve pendiente y conserva responsable y fecha", await hasta(p, (d) => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return x.estado === "pendiente" && x.resp === d && !!x.para; }, DIEGO.email), true);

  // Sacarlos: sin responsable ni fecha, se va también quién lo asignó.
  await elegir(p, primero + " .rs-resp", "");
  await hasta(p, () => !window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await abrirFecha(p, primero + " .rs-fecha");
  await p.click(".date-pop:not([hidden]) [data-action='dp-clear']");
  eq("sin responsable ni fecha, el paso queda como era", await hasta(p, () => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return !x.resp && !x.para && !x.asigPor && !x.asigEl; }), true);
  // «No es tarea» (13/10/2026): en la misma fila que el responsable y la fecha, del lado derecho.
  const fila = (p, sel) => p.evaluate(sel => { const li = document.querySelector(sel); const f = li.querySelector(".rs-fecha").getBoundingClientRect(), n = li.querySelector(".rs-no").getBoundingClientRect(),
    r = li.querySelector(".rs-resp").getBoundingClientRect(); return { adentro: !!li.querySelector(".rs-asig .rs-no"), mismaFila: Math.abs((n.top + n.bottom) / 2 - (f.top + f.bottom) / 2) < 8 && Math.abs((r.top + r.bottom) / 2 - (f.top + f.bottom) / 2) < 8,
      aLaDerecha: n.left >= f.right - 1, pegadoAlBorde: Math.abs(li.querySelector(".rs-asig").getBoundingClientRect().right - n.right) < 2 }; }, sel);
  eq("«No es tarea» va adentro de la fila del responsable y la fecha, en la misma línea, y pegado al lado derecho", await fila(p, primero), { adentro: true, mismaFila: true, aLaDerecha: true, pegadoAlBorde: true });
  eq("y sigue andando: quita el paso de los pendientes", await p.$eval(primero + ' [data-action="resumen-no-tarea"]', e => e.dataset.paso), "x1");
  eq("sin errores en la consola", errores, []);
  await p.close();
}
/* ---- «+ Responsable»: el buscador, la lista larga y el celular (13/10/2026) ----
   El usuario vio el menú abierto en el celular y pidió reemplazar el primer renglón («+ Responsable») por un buscador para
   escribir un nombre, con la lista debajo y su scroll. Un <select> no puede tener un campo adentro: es una ventanita propia.
   Y el botón se ve del tamaño de «+ Fecha» (antes, con la letra de 16 px de los menús del celular, se veía mucho más grande). */
{
  const NOMBRES = ["Abraham Cohen", "Adriana Blumen", "Alejandro Szwarc", "Beatriz Katz", "Benjamín Rubin", "Carolina Mizrahi", "Daniel Gold", "Débora Fridman", "Eduardo Salem", "Elena Berman",
    "Federico Lerner", "Gabriela Wainer", "Gustavo Eisen", "Hernán Kaplan", "Ilana Zimerman", "Jacobo Nahum", "Judith Perelman", "Leandro Edelman", "Marina Grinberg", "Natalia Sebel",
    "Pablo Tenembaum", "Rebeca Alfie", "Ricardo Averbuj", "Sara Chocron", "Sergio Hazan", "Tamara Waserman", "Uriel Sabbag", "Valeria Rotenberg", "Yael Bendersky", "Zeev Pinkas"];
  const larga = () => { const base = datos(); NOMBRES.forEach((n, i) => base.members.push({ email: `p${i}@team-latam.com`, name: n, nickname: "p" + i, role: "member", approved_at: "2025-01-10T12:00:00Z" })); return base; };
  const vistas = p => p.$$eval("#respPop .rp-op", l => l.filter(b => !b.hidden).map(b => b.textContent.replace(/[✓\s]+$/, "").replace(/^[✓\s]+/, "").replace("👤 ", "").trim()));
  const estaEnLaPantalla = p => p.evaluate(() => { const r = document.getElementById("respPop").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });

  /* Celular, con la lista larga (36 personas) */
  {
    const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 390, height: 844 }, lang: "es", base: larga() });
    await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
    eq("celular: el botón «+ Responsable» tiene la letra y la altura de «+ Fecha» (11,5 px, a 3 px o menos), en la misma fila", await p.evaluate(sel => { const li = document.querySelector(sel), r = li.querySelector(".rs-resp"), f = li.querySelector(".rs-fecha"), a = r.getBoundingClientRect(), c = f.getBoundingClientRect();
      return [getComputedStyle(r).fontSize, getComputedStyle(f).fontSize, Math.abs(a.height - c.height) <= 3, Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2) < 4]; }, primero), ["11.5px", "11.5px", true, true]);
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    eq("celular: se abre la ventanita, con el buscador arriba (sin «+ Responsable» como primera fila) y sin «Quitar» porque no hay responsable", await p.evaluate(() => { const el = document.getElementById("respPop"); return [el.firstElementChild.querySelector("#respBuscar") !== null, el.querySelectorAll(".rp-quitar").length, el.querySelector("#respBuscar").placeholder, !/\+ Responsable/.test(el.textContent)]; }), [true, 0, "Buscar a alguien…", true]);
    eq("…entra en la pantalla y se ven todos (35) con scroll adentro de la lista", await p.evaluate(() => { const l = document.getElementById("respLista"); return [document.querySelectorAll("#respPop .rp-op").length, l.scrollHeight > l.clientHeight, getComputedStyle(l).overflowY]; }), [35, true, "auto"]);
    eq("…y entra entera en la pantalla", await estaEnLaPantalla(p), true);
    eq("el foco no salta al campo (saldría el teclado y taparía la lista): se enfoca al tocarlo", await p.evaluate(() => document.activeElement.id !== "respBuscar"), true);
    await p.click("#respBuscar"); await p.keyboard.type("ma");
    eq("escribir «ma» deja solo los que la tienen (sin tildes ni mayúsculas): Débora, Diego, Elena, Ilana, Judith, Leandro, Marina, Tamara", await vistas(p), ["Débora Fridman", "Diego Martínez", "Elena Berman", "Ilana Zimerman", "Judith Perelman", "Leandro Edelman", "Marina Grinberg", "Tamara Waserman"]);
    await p.fill("#respBuscar", "ÁNA"); 
    eq("«ÁNA» (con tilde y mayúsculas) encuentra a quienes la tienen en el nombre: Adriana, Ana e Ilana", await vistas(p), ["Adriana Blumen", "Ana Pérez", "Ilana Zimerman"]);
    await p.fill("#respBuscar", "zzz");
    eq("sin coincidencias, un aviso «No hay nadie con ese nombre.» y ninguna fila", [await vistas(p), await p.$eval("#respPop .rp-vacio", e => [e.hidden, e.textContent.trim()])], [[], [false, "No hay nadie con ese nombre."]]);
    await p.fill("#respBuscar", "marina"); await p.keyboard.press("Enter");
    eq("Enter elige la primera que se ve (Marina) y la ventanita se cierra", await hasta(p, () => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return x.resp === "p18@team-latam.com"; }), true);
    eq("…y el botón dice «👤 Marina Grinberg»", await hasta(p, () => /Marina Grinberg/.test(document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-resp').textContent)), true);
    eq("…con el foco de vuelta en el botón", await hasta(p, () => document.activeElement && document.activeElement.classList.contains("rs-resp")), true);
    // Con responsable: aparece «Quitar responsable», la actual va marcada y vuelve a empezar sin lo escrito antes.
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    eq("con un responsable, la ventanita ofrece «Quitar responsable», marca a Marina con ✓ y arranca con el buscador vacío", await p.evaluate(() => [document.querySelector("#respPop .rp-quitar").textContent.trim(), document.querySelector("#respPop .rp-op.actual").textContent.replace(/\s+/g, " ").trim(), document.querySelector("#respPop .rp-op.actual").getAttribute("aria-selected"), document.getElementById("respBuscar").value]), ["✕ Quitar responsable", "✓👤 Marina Grinberg", "true", ""]);
    // Escape cierra y devuelve el foco; tocar afuera cierra.
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
    eq("Escape la cierra y el foco vuelve al botón", await p.evaluate(() => [document.getElementById("respPop").matches(":popover-open"), document.activeElement.classList.contains("rs-resp")]), [false, true]);
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    await p.mouse.click(5, 400); await p.waitForTimeout(150);
    eq("tocar afuera la cierra", await p.evaluate(() => document.getElementById("respPop").matches(":popover-open")), false);
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    await p.click(primero + " .rs-resp"); await p.waitForTimeout(150);
    eq("tocar de nuevo el mismo botón la cierra", await p.evaluate(() => document.getElementById("respPop").matches(":popover-open")), false);
    // Quitar.
    await elegir(p, primero + " .rs-resp", "");
    eq("«Quitar responsable» lo saca", await hasta(p, () => !window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp), true);
    eq("…y el botón vuelve a «+ Responsable», con el trazo punteado", await hasta(p, () => { const r = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-resp'); return r.textContent.trim() === "+ Responsable" && r.classList.contains("vacio"); }), true);
    eq("sin errores en la consola", errores, []);
    await p.close();
  }

  /* Con el teclado: flechas y Enter (compu), y la ventanita pegada al botón */
  {
    const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
    await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    eq("compu: el campo ya tiene el foco al abrir", await p.evaluate(() => document.activeElement.id), "respBuscar");
    eq("compu: la ventanita queda pegada abajo del botón y entra en la pantalla", await p.evaluate(() => { const b = document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-resp').getBoundingClientRect(), r = document.getElementById("respPop").getBoundingClientRect();
      return [r.top >= b.bottom - 1 && r.top - b.bottom < 20, Math.abs(r.left - b.left) < 2 || r.left >= 12, r.right <= innerWidth && r.bottom <= innerHeight]; }), [true, true, true]);
    eq("compu: la letra del botón es la de siempre (11,5 px)", await p.$eval(primero + " .rs-resp", e => getComputedStyle(e).fontSize), "11.5px");
    await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter");
    eq("↓ ↓ Enter elige a la tercera de la lista (Diego Martínez)", await hasta(p, () => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === "diego@team-latam.com"), true);
    eq("sin errores en la consola", errores, []);
    await p.close();
  }
  /* En hebreo la ventanita se alinea con el borde derecho del botón */
  {
    const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "he", base: datos() });
    await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
    await p.click(primero + " .rs-resp"); await p.waitForSelector("#respPop:popover-open");
    eq("hebreo: se abre dentro de la pantalla, con el campo «חיפוש אדם…»", await p.evaluate(() => { const r = document.getElementById("respPop").getBoundingClientRect(); return [r.left >= 0 && r.right <= innerWidth, document.getElementById("respBuscar").placeholder]; }), [true, "חיפוש אדם…"]);
    await p.close();
  }
}
/* ---- En hebreo, de derecha a izquierda: «No es tarea» queda del lado izquierdo ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "he", base: datos() });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  const r = await p.evaluate(sel => { const li = document.querySelector(sel); const f = li.querySelector(".rs-fecha").getBoundingClientRect(), n = li.querySelector(".rs-no").getBoundingClientRect(); return { mismaFila: Math.abs((n.top + n.bottom) / 2 - (f.top + f.bottom) / 2) < 8, aLaIzquierda: n.right <= f.left + 1 }; }, primero);
  eq("en hebreo, «No es tarea» queda a la izquierda de la fecha y en la misma línea", r, { mismaFila: true, aLaIzquierda: true });
  await p.close();
}

/* ---- Quien no puede editar: las mismas dos cosas, como etiquetas ---- */
{
  const asignado = pasos => { pasos[0].resp = DIEGO.email; pasos[0].para = dia(4); pasos[0].asigPor = ANA.email; pasos[0].asigEl = new Date().toISOString(); };
  const { p } = await entrar(b, OBS, "Olga Observa", { viewport: vp, lang: "es", base: datos(asignado) });
  await p.click(tarjeta + " .rs-pill"); await p.waitForSelector(tarjeta + " .rs-panel");
  eq("un observador ve el responsable como etiqueta", await p.$eval(primero + " .rs-chip", e => e.textContent.trim()), "👤 Diego Martínez");
  eq("…y la fecha, con lo vencido marcado", await p.$$eval(primero + " .rs-chip", l => [l.length, l[1].classList.contains("vencido"), /vencido/.test(l[1].textContent)]), [2, true, true]);
  eq("…y no tiene los menús", await p.$$(primero + " .rs-resp, " + primero + " .rs-fecha").then(l => l.length), 0);
  await p.close();
}

/* ---- En la ficha del lugar ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  await tab(p, "paises");
  await p.evaluate(() => { const x = document.createElement("button"); x.dataset.action = "paises-subview"; x.dataset.key = "lista"; document.body.appendChild(x); x.click(); x.remove(); });
  await p.click('[data-action="drill-country"][data-country="Argentina"]'); await p.waitForSelector(".ficha-lugar .fl-sigue");
  eq("en la ficha, «No es tarea» también va en la fila del responsable y la fecha", await p.$$eval(".fl-sigue .rs-pasos li", l => l.map(li => !!li.querySelector(".rs-asig .rs-no") && !li.querySelector(".rs-paso > .rs-no"))), [true, true]);
  eq("en la ficha, cada paso de «Lo que sigue» también tiene su responsable y su fecha", await p.$$eval(".fl-sigue .rs-pasos li", l => l.map(e => [!!e.querySelector(".rs-resp"), !!e.querySelector(".rs-fecha")])), [[true, true], [true, true]]);
  await elegir(p, ".fl-sigue .rs-pasos li:first-child .rs-resp", DIEGO.email);
  eq("…y elegirlo desde ahí también lo guarda", await hasta(p, (d) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === d, DIEGO.email), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
