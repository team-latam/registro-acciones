/* ======================================================================
   Accesibilidad: contraste, avisos anunciados, el anillo de foco y el
   tamaño de lo que se toca (auditoría del 10/10/2026: R6, R13, R14, R17,
   R19 y los chicos de R22)

   - El texto en celeste lleva un color propio (--link) con contraste de
     4,5 o más sobre el fondo, en claro y en oscuro; el celeste de la marca
     (3,1 sobre blanco) queda para fondos y bordes. Ninguna regla de CSS
     pinta letra con --celeste-dark (crítica de diseño del 28/10/2026: 57
     reglas lo hacían, R6 había quedado a medias) y el texto que va SOBRE el
     celeste es oscuro, no blanco (1,9 a 3,1).
   - Los avisos («Número copiado», «Guardado») se anuncian al lector de
     pantalla (role=status).
   - Los resultados de «Buscar en todo» y las filas de Reportes no apagan
     el anillo de foco.
   - El logo de WhatsApp, el tono 3 del mapa de calor y el tono alto de
     «Todos los años» se leen; el rojo de alerta y el atajo activo en
     oscuro también.
   - En una pantalla táctil, el WhatsApp chico y la ✕ de las ventanas miden
     40 px o más; chips y solapas, 32.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, detalle) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${detalle ? "\n   " + detalle : ""}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// El CSS (lo que está entre <style> y </style>), regla por regla.
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const reglas = css.split("}").map(r => r.replace(/\/\*[\s\S]*?\*\//g, " ").trim());
// Letra pintada con el celeste de la marca (3,1 sobre blanco). La propiedad
// tiene que ser `color`: border-color, outline-color, accent-color… son
// bordes y rellenos, y ahí el celeste está bien.
const conCeleste = reglas.filter(r => /(?<![-\w])color\s*:\s*var\(--celeste-dark\)/.test(r));
ok("ninguna regla de CSS pinta letra con --celeste-dark (va --link: 5,8 sobre blanco)", conCeleste.length === 0,
  `${conCeleste.length} reglas, por ejemplo: ${conCeleste.slice(0, 4).map(r => r.replace(/\s+/g, " ").slice(0, 90)).join(" || ")}`);
// Letra blanca sobre el relleno celeste (3,1 en claro, 1,7 en oscuro, donde el celeste es claro).
const blancoSobreCeleste = reglas.filter(r => /background\s*:\s*var\(--celeste(-dark)?\)/.test(r) && /(?<![-\w])color\s*:\s*(#fff\b|#ffffff|white)/i.test(r));
ok("ninguna regla pone letra blanca sobre el relleno celeste (va el petróleo oscuro)", blancoSobreCeleste.length === 0,
  `${blancoSobreCeleste.length} reglas, por ejemplo: ${blancoSobreCeleste.slice(0, 4).map(r => r.replace(/\s+/g, " ").slice(0, 90)).join(" || ")}`);

// Contraste WCAG entre dos colores "rgb(r, g, b)" o "#rrggbb".
const canal = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
// "rgb(r, g, b)", "#rrggbb" o "color(srgb r g b)" (lo que devuelve color-mix).
const rgb = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if(m) return [+m[1], +m[2], +m[3]];
  const k = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c); if(k) return [+k[1], +k[2], +k[3]].map(v => Math.round(v * 255));
  const h = c.trim().replace("#", ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lum = c => { const [r, g, b] = rgb(c).map(canal); return .2126 * r + .7152 * g + .0722 * b; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 100) / 100; };
// El color de fondo que de verdad hay detrás de un elemento: sube hasta el
// primer fondo opaco y mezcla encima los semitransparentes que haya en el
// camino (un chip con rgba(…, .16) no se lee contra ese rgba, sino contra lo
// que queda al ponerlo sobre la tarjeta). color-mix() devuelve «color(srgb r g
// b)» con valores de 0 a 1, no «rgb(…)».
const fondoDe = `(el) => { const capas = []; let base = null;
  for(let e = el; e; e = e.parentElement){ const c = getComputedStyle(e).backgroundColor || "", n = c.match(/[0-9.]+/g); if(!n || n.length < 3) continue; if(c.startsWith("color(")) for(let i = 0; i < 3; i++) n[i] = n[i] * 255; const a = n.length > 3 ? +n[3] : 1; if(a === 0) continue; if(a === 1){ base = n.slice(0, 3).map(Number); break; } capas.push(n.map(Number)); }
  if(!base) base = (getComputedStyle(document.body).backgroundColor.match(/[0-9.]+/g) || [255, 255, 255]).slice(0, 3).map(Number);
  for(const c of capas.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]);
  return "rgb(" + base.map(Math.round).join(", ") + ")"; }`;
// Sondas: elementos con esas clases, para leer el CSS sin buscarlos en cada pantalla.
const SONDAS = `<div id="sondas"><a href="#" class="s-a">a</a><span class="ymd l3">5</span><table><tr><td class="rep-h4">9</td></tr></table><span class="fs-link active">x</span><span class="rep-kpi-num alerta">3</span><span class="pl-st overdue">v</span><span class="pl-st soon">s</span><span class="ag-wa chico"><svg class="ag-wa-ic"></svg></span><span class="feed-solapas"><button type="button">b</button></span><button type="button" class="fb-boton">f</button><button type="button" class="rep-boton">r</button><button type="button" class="btn-text-add">t</button><button type="button" class="btn-sync">s</button><span class="pj-owner">@a</span><span class="up-nick">@a</span><span class="status-pill observer">o</span><span class="participant-chip">p</span><button type="button" class="recur-opt sel">o</button><button type="button" class="recur-dow sel">d</button><span class="cal-cell today"><span class="cal-daynum">28</span></span></div>`;
const medir = p => p.evaluate(([sondas, fondoDe]) => {
  document.body.insertAdjacentHTML("beforeend", sondas);
  const fondo = eval(fondoDe);
  const css = getComputedStyle(document.documentElement);
  const q = s => document.querySelector("#sondas " + s);
  const par = s => { const e = q(s); return [getComputedStyle(e).color, fondo(e)]; };
  const r = {
    link: css.getPropertyValue("--link").trim(), card: css.getPropertyValue("--card").trim(), bg: css.getPropertyValue("--bg").trim(), soft: css.getPropertyValue("--celeste-soft").trim(),
    a: par(".s-a"), l3: par(".ymd.l3"), h4: par(".rep-h4"), fsLink: par(".fs-link.active"), kpi: par(".rep-kpi-num.alerta"), overdue: par(".pl-st.overdue"), soon: par(".pl-st.soon"),
    wa: [getComputedStyle(q(".ag-wa-ic")).fill, getComputedStyle(q(".ag-wa.chico")).backgroundColor],
    fbBoton: par(".fb-boton"), repBoton: par(".rep-boton"), btnTextAdd: par(".btn-text-add"), btnSync: par(".btn-sync"), pjOwner: par(".pj-owner"), upNick: par(".up-nick"),
    observador: par(".status-pill.observer"), participante: par(".participant-chip"), recurOpt: par(".recur-opt.sel"), recurDow: par(".recur-dow.sel"), hoy: par(".cal-daynum"),
  };
  document.getElementById("sondas").remove();
  return r;
}, [SONDAS, fondoDe]);

const b = await abrirNavegador();
for(const oscuro of [false, true]){
  const modo = oscuro ? "oscuro" : "claro";
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 }, dark: oscuro });
  const m = await medir(p);
  ok(`${modo}: --link existe`, !!m.link, JSON.stringify(m));
  ok(`${modo}: --link sobre la tarjeta da 4,5 o más`, m.link && contraste(m.link, m.card) >= 4.5, `${m.link} sobre ${m.card}: ${m.link && contraste(m.link, m.card)}`);
  ok(`${modo}: --link sobre el fondo da 4,5 o más`, m.link && contraste(m.link, m.bg) >= 4.5, `${m.link} sobre ${m.bg}: ${m.link && contraste(m.link, m.bg)}`);
  ok(`${modo}: --link sobre el celeste suave (los contadores de las solapas) da 4,5 o más`, m.link && m.soft && contraste(m.link, m.soft) >= 4.5, `${m.link} sobre ${m.soft}`);
  ok(`${modo}: un enlace se pinta con --link`, m.link && m.a[0] === `rgb(${rgb(m.link).join(", ")})`, `a: ${m.a[0]}, --link: ${m.link}`);
  for(const [k, n, min] of [["l3", "el tono 3 del mapa de calor del año", 4.5], ["h4", "el tono alto de «Todos los años»", 4.5], ["fsLink", "el atajo rápido activo del Inicio", 4.5], ["kpi", "el número en alerta de Reportes", 4.5], ["overdue", "un hito vencido", 4.5], ["soon", "un hito próximo", 4.5]]){
    ok(`${modo}: ${n} da ${min} o más`, contraste(m[k][0], m[k][1]) >= min, `${m[k][0]} sobre ${m[k][1]}: ${contraste(m[k][0], m[k][1])}`);
  }
  for(const [k, n] of [["fbBoton", "el botón «Filtros» del Inicio"], ["repBoton", "los botones de Reportes (Filtros, Mi año, Presentar, Planilla, PDF)"], ["btnTextAdd", "los «+ Agregar…» de los formularios"],
    ["btnSync", "«Traer de Google Calendar» y «Bajar lista»"], ["pjOwner", "el @responsable de un hito"], ["upNick", "el @nickname del perfil"], ["observador", "la etiqueta «Observador»"],
    ["participante", "el chip de un participante"], ["recurOpt", "la opción elegida de «Se repite»"], ["recurDow", "el día de la semana elegido de «Se repite»"], ["hoy", "el número de hoy en el Calendario"]]){
    ok(`${modo}: ${n} da 4,5 o más`, contraste(m[k][0], m[k][1]) >= 4.5, `${m[k][0]} sobre ${m[k][1]}: ${contraste(m[k][0], m[k][1])}`);
  }
  ok(`${modo}: el logo de WhatsApp chico da 3 o más sobre su fondo`, contraste(m.wa[0], m.wa[1]) >= 3, `${m.wa[0]} sobre ${m.wa[1]}: ${contraste(m.wa[0], m.wa[1])}`);
  await p.close();
}
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  eq("el aviso de la Agenda y de Calendar se anuncia al lector (role=status, aria-live)", await p.$eval("#calendarToast", e => [e.getAttribute("role"), e.getAttribute("aria-live")]), ["status", "polite"]);
  eq("la pestaña activa lleva aria-current=page", await p.$$eval("#tabs button[aria-current='page']", l => l.map(b => b.dataset.view)), ["feed"]);
  eq("el buscador del Inicio es type=search", await p.$eval("#feedSearch", e => e.type), "search");
  await tab(p, "paises"); await click(p, ".paises-agenda"); await p.waitForTimeout(400);
  eq("el avatar de iniciales no se lee dos veces (aria-hidden)", await p.$eval(".ag-p .ag-av", e => e.getAttribute("aria-hidden")), "true");
  const link = await p.evaluate(() => { const css = getComputedStyle(document.documentElement).getPropertyValue("--link").trim(); const e = document.querySelector(".ag-ir, .ag-link"); return [getComputedStyle(e).color, css]; });
  ok("los links de la Agenda («Ver la ficha ›», «Bajar en planilla») van con --link", link[1] && link[0] === `rgb(${rgb(link[1]).join(", ")})`, JSON.stringify(link));
  await p.close();
}
// El CSS no apaga el anillo de foco donde se llega con el teclado.
for(const sel of [".gs-item:hover, .gs-item:focus", ".rep-fila-ir:hover, .rep-fila-ir:focus-visible"]){
  const linea = html.split("\n").find(l => l.includes(sel)) || "";
  ok(`la regla «${sel}» no lleva outline:none`, linea && !/outline\s*:\s*none/.test(linea), linea.trim().slice(0, 140));
}
// Táctil: el tamaño de lo que se toca.
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 661 } });
  const alto = (sel) => p.$$eval(sel, l => l.filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().height)));
  const cuando = await p.evaluate((fondoDe) => { const fondo = eval(fondoDe); const e = document.querySelector(".post-top .post-cuando"); return e && [getComputedStyle(e).color, fondo(e)]; }, fondoDe);
  ok("celular: la fecha de cada posteo (en mayúsculas, 12 px) da 4,5 o más", cuando && contraste(cuando[0], cuando[1]) >= 4.5, JSON.stringify(cuando) + (cuando ? ": " + contraste(cuando[0], cuando[1]) : ""));
  const solapas = await alto(".feed-solapas button");
  ok("celular: las solapas «Lo que pasó / Próximos» miden 32 px o más", solapas.length && solapas.every(h => h >= 32), JSON.stringify(solapas));
  await tab(p, "paises"); await click(p, ".paises-agenda"); await p.waitForTimeout(500);
  const wa = await alto(".ag-wa.chico");
  ok("celular: el WhatsApp chico de cada fila mide 40 px o más", wa.length && wa.every(h => h >= 40), JSON.stringify(wa));
  const cierre = await alto("#agendaOverlay .modal .close, #agendaOverlay .close");
  ok("celular: la ✕ de la ventana mide 40 px o más", cierre.length && cierre.every(h => h >= 40), JSON.stringify(cierre));
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
