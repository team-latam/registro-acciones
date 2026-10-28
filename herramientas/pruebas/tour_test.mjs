import fs from "node:fs";
import { abrirNavegador, entrar, BASE, hace, click } from "./app_de_mentira.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El recorrido de bienvenida cuenta el sistema de HOY (12/10/2026)

   Lo primero que ve alguien a quien se le da el primer ingreso es este
   recorrido. Si la app crece y el recorrido no, esa persona aprende un
   sistema que ya no existe. Esta prueba lo ata a la navegación real:

   - Abre la app como una cuenta recién aprobada, en la compu y en el celular,
     como integrante y como observador, y recorre cada paso.
   - Saca de la pantalla qué pantallas existen de verdad (las solapas de
     arriba, la barra de abajo, la hoja «Más», el menú del avatar) y exige
     que cada una esté cubierta por algún paso del recorrido (`data-cubre`)
     o anotada en TOUR_SIN_PASO con su motivo. Si alguien suma una solapa y
     se olvida del recorrido, esta prueba falla y dice cuál.
   - Al revés también: un paso que dice cubrir una pantalla que ya no
     existe, o una excepción de TOUR_SIN_PASO que ya no hace falta, falla.
   - Los textos están en los cuatro idiomas, las cuentas de antes no lo
     ven, y quien lo termina o lo saltea no lo vuelve a ver.

   Para comprobar que la prueba muerde: INDEX=/ruta/a/copia/vieja.html
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("../..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");

// De index.html: las excepciones anotadas (pantalla → motivo).
const sinPaso = (() => {
  const m = /const TOUR_SIN_PASO = (\{[\s\S]*?\n\});/.exec(src);
  if(!m) return null;
  try{ return new Function("return " + m[1])(); }catch(e){ return null; }
})();
eq("index.html tiene TOUR_SIN_PASO (las pantallas sin paso, con su motivo)", !!sinPaso, true);
const SIN_PASO = sinPaso || {};
eq("cada excepción trae su motivo escrito", Object.values(SIN_PASO).every(v => typeof v === "string" && v.length > 20), true);

const b = await abrirNavegador();
const NUEVO = "nuevo@team-latam.com";
const baseCon = (rol, aprobado) => {
  const base = BASE();
  base.members.push({ email: NUEVO, name: "Nuevo Ingreso", nickname: "nuevo", role: rol, approved_at: aprobado, calendar_shared: false, last_seen_at: null });
  return base;
};
const COMPU = { width: 1280, height: 900 }, CELU = { width: 390, height: 844 };

// Abre la app como la cuenta nueva y espera el primer globo.
async function abrir(rol, viewport, { lang, aprobado } = {}){
  const r = await entrar(b, NUEVO, "Nuevo Ingreso", { viewport, lang, base: baseCon(rol, aprobado || hace(1)) });
  return r;
}
const hayGlobo = p => p.$("#tourLayer:not([hidden]) .tour-callout").then(e => !!e);
const globo = p => p.evaluate(() => {
  const c = document.querySelector("#tourLayer:not([hidden]) .tour-callout");
  if(!c) return null;
  const r = c.getBoundingClientRect(), h = document.querySelector("#tourLayer .tour-hole").getBoundingClientRect();
  const sig = c.querySelector('[data-action="tour-next"], [data-action="close-tour"].btn-mini');
  return {
    paso: c.dataset.paso, cubre: c.dataset.cubre ? c.dataset.cubre.split(" ") : [],
    titulo: c.querySelector(".tour-ttl").textContent.trim(), texto: c.querySelector(".tour-txt").textContent.trim(),
    puntos: c.querySelectorAll(".tour-dots i").length, boton: sig ? sig.textContent.trim() : "",
    dentro: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
    agujero: { x: Math.round(h.left + h.width / 2), y: Math.round(h.top + h.height / 2) },
  };
});
// Recorre el tour entero tocando «Siguiente» hasta «Listo». Devuelve cada paso.
async function recorrer(p){
  const pasos = [];
  for(let i = 0; i < 20 && await hayGlobo(p); i++){
    pasos.push(await globo(p));
    const fin = await p.$('#tourLayer [data-action="close-tour"].btn-mini');
    if(fin) break;
    await p.click('#tourLayer [data-action="tour-next"]');
    await p.waitForTimeout(60);
  }
  return pasos;
}
// Qué pantallas existen de verdad para esta persona, según el DOM: solapas de arriba, barra de abajo, la hoja
// «Más» y el menú del avatar. Se mira con el recorrido ya cerrado.
async function pantallasReales(p){
  await p.click('#tourLayer [data-action="close-tour"]').catch(() => {});
  await p.waitForTimeout(150);
  const vistas = new Set();
  const leer = async sel => (await p.$$eval(sel, l => l.map(e => e.dataset.view).filter(Boolean))).forEach(v => vistas.add(v));
  await leer("nav.tabs button[data-view]");
  await leer(".bn-item[data-view]");
  if(await click(p, '.bn-item[data-action="toggle-more-menu"]')){ await p.waitForTimeout(150); await leer(".bn-sheet-item[data-view]"); await click(p, '.bn-item[data-action="toggle-more-menu"]'); }
  if(await click(p, '[data-action="toggle-user-menu"]')){ await p.waitForTimeout(150); await leer('.user-menu [data-action="goto-view"][data-view]'); }
  return [...vistas];
}

const ESPERADO_INTEGRANTE = ["inicio", "composer", "crear", "paises", "calendario", "proyectos", "reportes", "buscar", "novedades", "cuenta"];
const ESPERADO_OBSERVADOR = ["observador", "paises", "calendario", "proyectos", "reportes", "buscar", "novedades", "cuenta"];
const todasLasPantallas = new Set();
const cubiertasPorCombo = [];

for(const [rol, viewport, nombre] of [["member", COMPU, "integrante en la compu"], ["member", CELU, "integrante en el celular"], ["observer", COMPU, "observador en la compu"], ["observer", CELU, "observador en el celular"]]){
  const { p, errores } = await abrir(rol, viewport);
  eq(`${nombre}: el recorrido aparece solo, al entrar`, await hayGlobo(p), true);
  const pasos = await recorrer(p);
  eq(`${nombre}: los pasos, en orden`, pasos.map(x => x.paso), rol === "member" ? ESPERADO_INTEGRANTE : ESPERADO_OBSERVADOR);
  eq(`${nombre}: un punto de progreso por paso`, pasos.every(x => x.puntos === pasos.length), true);
  eq(`${nombre}: todos los globos entran en la pantalla`, pasos.filter(x => !x.dentro).map(x => x.paso), []);
  eq(`${nombre}: el último paso se cierra con «Listo»`, (pasos[pasos.length - 1] || {}).boton, "Listo");
  eq(`${nombre}: ningún paso sin título ni texto`, pasos.filter(x => !x.titulo || x.texto.length < 20).map(x => x.paso), []);

  const mas = pasos.filter(x => /^En «Más»: /.test(x.texto)).map(x => x.paso);
  eq(`${nombre}: ${viewport === CELU ? "Proyectos y Reportes avisan que están en «Más»" : "en la compu nada habla de «Más»"}`, mas, viewport === CELU ? ["proyectos", "reportes"] : []);
  if(viewport === CELU){
    // Esos dos pasos señalan el botón «Más» (el agujero cae sobre él), no una solapa que en el celular no existe.
    const centroMas = await p.$eval('.bn-item[data-action="toggle-more-menu"]', e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    const sobreMas = pasos.filter(x => ["proyectos", "reportes"].includes(x.paso)).map(x => Math.abs(x.agujero.x - centroMas.x) < 6 && Math.abs(x.agujero.y - centroMas.y) < 6);
    eq(`${nombre}: el agujero de Proyectos y Reportes está sobre «Más»`, sobreMas, [true, true]);
  }

  // El paso del buscador señala el buscador de verdad: la barra en la compu, la lupa en el celular (T4 de la auditoría del 28/10/2026).
  { const paso = pasos.find(x => x.paso === "buscar");
    const centro = await p.$eval(viewport === CELU ? "#globalSearchToggle" : "#globalSearch", e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    eq(`${nombre}: el agujero de «Buscar en todo» está sobre ${viewport === CELU ? "la lupa de arriba" : "la barra de búsqueda"}`,
      !!paso && Math.abs(paso.agujero.x - centro.x) < 10 && Math.abs(paso.agujero.y - centro.y) < 10, true); }

  // Cobertura contra la navegación real.
  const reales = await pantallasReales(p);
  reales.forEach(v => todasLasPantallas.add(v));
  const cubiertas = new Set(pasos.flatMap(x => x.cubre));
  const sinCubrir = reales.filter(v => !cubiertas.has(v) && !(v in SIN_PASO));
  eq(`${nombre}: toda pantalla de la navegación tiene su paso (o está en TOUR_SIN_PASO) — si falla, hay que sumar un paso en tourSteps()`, sinCubrir, []);
  cubiertasPorCombo.push([nombre, [...cubiertas]]);
  eq(`${nombre}: sin errores de página`, errores, []);
  await p.close();
}
// Un paso no puede decir que cubre una pantalla que no existe (se sacó y el paso quedó), ni una pantalla
// puede estar a la vez cubierta y excusada.
{
  const reales = todasLasPantallas;
  for(const [nombre, cub] of cubiertasPorCombo) eq(`${nombre}: los pasos solo dicen cubrir pantallas que existen`, cub.filter(v => !reales.has(v)), []);
  const cubiertas = new Set(cubiertasPorCombo.flatMap(([, c]) => c));
  eq("ninguna pantalla está a la vez cubierta y en TOUR_SIN_PASO", Object.keys(SIN_PASO).filter(v => cubiertas.has(v)), []);
}
// La excepción de Administración solo existe si de verdad hay una pantalla Administración: se comprueba con un admin nuevo.
{
  const { p } = await abrir("admin", COMPU);
  const pasos = await recorrer(p);
  eq("admin nuevo: ve el mismo recorrido que un integrante", pasos.map(x => x.paso), ESPERADO_INTEGRANTE);
  const reales = await pantallasReales(p);
  eq("admin nuevo: la pantalla Administración existe en su menú", reales.includes("admin"), true);
  eq("TOUR_SIN_PASO solo nombra pantallas que existen (admin incluido)", Object.keys(SIN_PASO).filter(v => !reales.includes(v) && !todasLasPantallas.has(v)), []);
  eq("y lo que no cubre el recorrido de un admin son justo las excepciones anotadas", reales.filter(v => !pasos.some(x => x.cubre.includes(v))).sort(), Object.keys(SIN_PASO).sort());
  await p.close();
}

/* ---------------- Los cuatro idiomas ---------------- */
{
  const en = {};
  const porIdioma = {};
  for(const lang of ["es", "en", "pt", "he"]){
    const { p, errores } = await abrir("member", COMPU, { lang });
    const pasos = await recorrer(p);
    porIdioma[lang] = pasos;
    eq(`${lang}: los mismos ${ESPERADO_INTEGRANTE.length} pasos`, pasos.map(x => x.paso), ESPERADO_INTEGRANTE);
    eq(`${lang}: los globos entran en la pantalla`, pasos.filter(x => !x.dentro).map(x => x.paso), []);
    if(lang === "he") eq("he: la página se lee de derecha a izquierda", await p.evaluate(() => document.documentElement.dir), "rtl");
    eq(`${lang}: sin errores de página`, errores, []);
    await p.close();
  }
  for(const lang of ["en", "pt", "he"]){
    const iguales = porIdioma[lang].filter((x, i) => x.texto === porIdioma.es[i].texto).map(x => x.paso);
    eq(`${lang}: todos los textos están traducidos (ninguno igual al español)`, iguales, []);
  }
  for(const lang of ["en", "he"]){
    const iguales = porIdioma[lang].filter((x, i) => x.titulo === porIdioma.es[i].titulo).map(x => x.paso);
    eq(`${lang}: todos los títulos están traducidos`, iguales, []);
  }
  // Un residuo típico: un texto en inglés/portugués que quedó con una palabra del español de este recorrido.
  eq("en: ningún texto trae «Más» ni palabras sueltas del español", porIdioma.en.filter(x => /[¿¡áéíóúñ]|\bMás\b|\bTocá\b/.test(x.titulo + " " + x.texto)).map(x => x.paso), []);
  // En celular, en inglés, el aviso de «Más» sale en el idioma de la persona.
  const { p } = await abrir("member", CELU, { lang: "en" });
  const pasos = await recorrer(p);
  eq("en el celular, en inglés: «Under “More”: …»", pasos.filter(x => x.paso === "proyectos" || x.paso === "reportes").map(x => x.texto.startsWith("Under “More”: ")), [true, true]);
  await p.close();
}

/* ---------------- Quién lo ve y cuántas veces ---------------- */
{
  const antes = await abrir("member", COMPU, { aprobado: "2026-09-10T12:00:00Z" });
  eq("una cuenta aprobada antes del 11/9/2026 no ve el recorrido", await hayGlobo(antes.p), false);
  await antes.p.close();
  const vieja = await abrir("member", COMPU, { aprobado: "2025-01-10T12:00:00Z" });
  eq("ni una de 2025", await hayGlobo(vieja.p), false);
  await vieja.p.close();
  const borde = await abrir("member", COMPU, { aprobado: "2026-09-11T00:00:00Z" });
  eq("una aprobada el 11/9 sí lo ve", await hayGlobo(borde.p), true);
  await borde.p.close();
}
{
  // Termina el recorrido: queda anotado en la ficha (por cuenta) y en el navegador, y no vuelve.
  const { p } = await abrir("member", COMPU);
  await recorrer(p);
  await p.click('#tourLayer [data-action="close-tour"].btn-mini');
  await p.waitForTimeout(250);
  eq("al terminar, el globo se va", await hayGlobo(p), false);
  eq("y anota en su ficha que ya lo vio (tour_seen_at)", await p.evaluate(email => window.__sb.escrituras.some(e => e[0] === "update" && e[1] === "members" && e[2] && "tour_seen_at" in e[2] && JSON.stringify(e[3]).includes(email)), NUEVO), true);
  eq("y en el navegador", await p.evaluate(() => localStorage.getItem("ra_tour_seen")), "1");
  await p.reload(); await p.waitForTimeout(1500);
  eq("recargando, no vuelve a salir", await hayGlobo(p), false);
  await p.close();
}
{
  // «Saltar» cuenta como visto.
  const { p } = await abrir("member", COMPU);
  await p.click('#tourLayer [data-action="close-tour"].tour-skip');
  await p.waitForTimeout(250);
  eq("«Saltar» lo cierra", await hayGlobo(p), false);
  eq("y lo da por visto", await p.evaluate(() => localStorage.getItem("ra_tour_seen")), "1");
  await p.close();
}
{
  // Si la ficha ya dice que lo vio (otra computadora), no sale aunque este navegador no lo sepa.
  const base = baseCon("member", hace(1));
  base.members.find(m => m.email === NUEVO).tour_seen_at = hace(0.5);
  const { p } = await entrar(b, NUEVO, "Nuevo Ingreso", { viewport: COMPU, base });
  eq("si ya lo vio en otro aparato (la ficha lo dice), no sale", await hayGlobo(p), false);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
