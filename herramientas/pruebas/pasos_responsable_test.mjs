/* ======================================================================
   Responsable y fecha en cada paso de «Lo que sigue» (13/10/2026,
   propuesta 1-B)

   Los pasos que salen del Formulario de Cierre solo se tildaban: no decían
   quién se encarga ni para cuándo. El usuario eligió sumar las dos cosas,
   en los mismos dos lugares de siempre (el panel «Resumen» de la tarjeta y
   la ficha de cada lugar):
   - quien puede editar el evento elige un responsable (un menú con el equipo
     que carga, no los observadores) y una fecha, y cada cambio se guarda al
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
  eq("sin asignar, se lee «+ Responsable» y «+ Fecha»", await p.$eval(primero, e => [e.querySelector(".rs-resp option:checked").textContent.trim(), e.querySelector(".rs-fecha").textContent.trim().replace(/^📅\s*/, "")]), ["+ Responsable", "+ Fecha"]);
  eq("el menú ofrece al equipo que carga y no al observador", await p.$$eval(primero + " .rs-resp option", l => l.map(o => o.value).filter(Boolean).includes("obs@team-latam.com")), false);

  await p.selectOption(primero + " .rs-resp", DIEGO.email);
  eq("elegir un responsable lo guarda, con quién lo asignó", await hasta(p, (d) => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return x.resp === d && x.asigPor === "ana@team-latam.com" && !!x.asigEl; }, DIEGO.email), true);
  eq("…y el menú muestra su nombre", await hasta(p, () => /Diego/.test(document.querySelector('.post[data-post-id="p1"] .rs-pasos li:first-child .rs-resp option:checked').textContent)), true);
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
  await p.selectOption(primero + " .rs-resp", ANA.email); await hasta(p, (a) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === a, ANA.email);
  await p.waitForTimeout(500);
  await p.selectOption(primero + " .rs-resp", DIEGO.email); await hasta(p, (d) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === d, DIEGO.email);
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
  await p.selectOption(primero + " .rs-resp", "");
  await hasta(p, () => !window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await abrirFecha(p, primero + " .rs-fecha");
  await p.click(".date-pop:not([hidden]) [data-action='dp-clear']");
  eq("sin responsable ni fecha, el paso queda como era", await hasta(p, () => { const x = window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0]; return !x.resp && !x.para && !x.asigPor && !x.asigEl; }), true);
  eq("sin errores en la consola", errores, []);
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
  eq("en la ficha, cada paso de «Lo que sigue» también tiene su responsable y su fecha", await p.$$eval(".fl-sigue .rs-pasos li", l => l.map(e => [!!e.querySelector(".rs-resp"), !!e.querySelector(".rs-fecha")])), [[true, true], [true, true]]);
  await p.selectOption(".fl-sigue .rs-pasos li:first-child .rs-resp", DIEGO.email);
  eq("…y elegirlo desde ahí también lo guarda", await hasta(p, (d) => window.__sb.tablas.posts.find(y => y.id === "p1").resumen.partes[0].pasos[0].resp === d, DIEGO.email), true);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
