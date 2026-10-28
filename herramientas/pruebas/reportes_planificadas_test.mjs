/* ======================================================================
   «Mes a mes»: el número de lo planificado va adentro de su barra (13/10/2026)

   El usuario vio que el «+12», «+9», «+6» quedaba pegado debajo del número de
   lo hecho (el «13») y que, sin la barra cerca, parecía una comparación con
   el año pasado. Pidió moverlo, sin tocar el gráfico. Ahora:
   - el número de arriba es solo lo hecho (sin «+n») y lo planificado se lee
     adentro de su barra punteada, sin el «+»;
   - en el celular la letra es más chica y entra en la barra (una sola línea,
     sin salirse), y no es cursiva;
   - si la barra es muy baja y el número no entra, sube arriba de ella; y si
     tampoco hay lugar arriba (el mes más alto), no se dibuja: queda en el
     globito y en lo que lee el lector de pantalla;
   - un mes que solo tiene lo planificado deja vacío el renglón de arriba.
   Las barras (alto, ancho, borde punteado) no cambian.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs); la
   fecha de «hoy» queda fija para que la cuenta no dependa del día.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, pais, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

let k = 0;
const poner = (base, n, fechas, p = "Chile") => { for(let i = 0; i < n; i++) base.posts.push(post({ id: `c${k++}`, title: `Actividad ${k}`, start: fechas(i), a: 1, type: "visita", scopes: [pais(p)] })); };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Hoy: 12 de octubre de 2026. Hecho: marzo 5, abril 7, mayo 9, junio 12, julio 10, agosto 18, septiembre 15, octubre 8 (días 1 a 8).
// Planificado: octubre 12 (días 14 a 25), noviembre 9, diciembre 6, y dos meses de prueba (ver abajo).
const datos = ({ conAnterior = true } = {}) => {
  const base = BASE(); base.replies = []; base.posts = []; k = 0;
  [[3, 5], [4, 7], [5, 9], [6, 12], [7, 10], [8, 18], [9, 15]].forEach(([m, n]) => poner(base, n, i => iso(2026, m, 1 + (i % 27))));
  poner(base, 8, i => iso(2026, 10, 1 + (i % 8)));
  poner(base, 12, i => iso(2026, 10, 14 + (i % 12)));
  poner(base, 9, i => iso(2026, 11, 1 + (i % 27)));
  poner(base, 6, i => iso(2026, 12, 1 + (i % 27)));
  if(conAnterior) [4, 6, 8, 9, 11, 13, 14, 18, 9, 9, 16, 11].forEach((n, m) => poner(base, n, i => iso(2025, m + 1, 1 + (i % 27))));
  return base;
};
const HOY = new Date("2026-10-12T12:00:00");
const b = await abrirNavegador();
const abrir = async (viewport, base, lang = "es") => {
  const r = await entrar(b, ADMIN, "Benny Rosenthal", { viewport, lang, base });
  await r.p.clock.setFixedTime(HOY);
  await tab(r.p, "reportes"); await r.p.waitForSelector(".rep-total-num");
  await r.p.addStyleTag({ content: "#bottomNav{display:none !important}" });
  return r;
};
// Lo que se ve de la columna de un mes: el número de arriba, el de la barra punteada y dónde cae cada cosa.
const columna = (p, mes) => p.evaluate(m => {
  const c = document.querySelector(`.rep-bloque-mensual .rep-col[data-mes="${m}"]`);
  const num = c.querySelector(".rep-num"), bar = c.querySelector(".rep-col-plan"), n = c.querySelector(".rep-plan-n");
  const rb = bar && bar.getBoundingClientRect(), rn = n && n.getBoundingClientRect(), cs = n && getComputedStyle(n);
  return { arriba: num.textContent.trim(), nPlan: n ? n.textContent.trim() : null, plus: /\+/.test(num.textContent),
    visible: !!(n && cs.display !== "none" && rn.width > 0),
    adentro: !!(rb && rn && rn.top >= rb.top - 0.5 && rn.bottom <= rb.bottom + 0.5 && rn.left >= rb.left - 2 && rn.right <= rb.right + 2),
    arribaDeLaBarra: !!(rb && rn && rn.bottom <= rb.top + 0.5),
    renglones: rn ? Math.round(rn.height / parseFloat(cs.fontSize)) : null,
    letra: cs ? parseFloat(cs.fontSize) : null, estilo: cs ? cs.fontStyle : null, alto: bar ? Math.round(rb.height) : null, ancho: bar ? Math.round(rb.width) : null,
    aria: c.getAttribute("aria-label"), globito: (c.querySelector(".rep-tip") || {}).textContent || "" };
}, mes);

/* ---------------- Compu ---------------- */
{
  const { p, errores } = await abrir({ width: 1280, height: 900 }, datos());
  const oct = await columna(p, "2026-10"), nov = await columna(p, "2026-11"), dic = await columna(p, "2026-12");
  eq("octubre: arriba solo lo hecho (8), sin «+12» pegado", [oct.arriba, oct.plus], ["8", false]);
  eq("octubre: el 12 se lee adentro de la barra punteada, en una línea y sin cursiva", [oct.nPlan, oct.visible, oct.adentro, oct.renglones, oct.estilo], ["12", true, true, 1, "normal"]);
  eq("noviembre y diciembre: nada arriba y el 9 y el 6 adentro de su barra", [[nov.arriba, nov.nPlan, nov.adentro], [dic.arriba, dic.nPlan, dic.adentro]], [["", "9", true], ["", "6", true]]);
  eq("el lector de pantalla y el globito siguen diciendo cuánto viene", [/2 por venir|12 por venir/.test(oct.aria), /12 planificadas/.test(oct.globito)], [true, true]);
  eq("el renglón de arriba de todas las columnas es un número o está vacío (nunca «+n»)", await p.$$eval(".rep-bloque-mensual .rep-num", l => l.every(e => /^\d*$/.test(e.textContent.trim()))), true);
  eq("las barras no cambiaron: octubre lleva su barra punteada con borde y la de lo hecho", await p.$eval('.rep-col[data-mes="2026-10"]', c => [!!c.querySelector(".rep-col-barra"), getComputedStyle(c.querySelector(".rep-col-plan")).borderTopStyle]), [true, "dashed"]);
  eq("sin errores en la consola", errores.length, 0);
  await p.close();
}

/* ---------------- Celular: la letra (11 px, el piso de las etiquetas) entra en la barra ---------------- */
{
  for(const ancho of [390, 360]){
    const { p } = await abrir({ width: ancho, height: 844 }, datos());
    const oct = await columna(p, "2026-10"), nov = await columna(p, "2026-11"), dic = await columna(p, "2026-12");
    eq(`celular ${ancho}: letra de 11 px (el piso de los números dentro de una barra; antes 8), derecha, en una línea`, [oct.letra, nov.letra, dic.letra, oct.estilo, oct.renglones], [11, 11, 11, "normal", 1]);
    eq(`celular ${ancho}: los tres números se leen adentro de su barra`, [oct, nov, dic].map(c => [c.nPlan, c.visible, c.adentro]), [["12", true, true], ["9", true, true], ["6", true, true]]);
    await p.close();
  }
}

/* ---------------- Barra muy baja: el número sube; en el mes más alto, no se dibuja ---------------- */
{
  const base = BASE(); base.replies = []; base.posts = []; k = 0;
  [[3, 4], [4, 6]].forEach(([m, n]) => poner(base, n, i => iso(2026, m, 1 + (i % 27))));
  poner(base, 30, i => iso(2026, 8, 1 + (i % 27)));            // agosto: el más alto, 30 hechas…
  poner(base, 1, () => iso(2026, 10, 20));                      // …octubre: 1 hecha (hasta hoy) y 1 por venir, bajito
  poner(base, 1, () => iso(2026, 10, 3));
  poner(base, 2, i => iso(2026, 11, 5 + i));                    // noviembre: solo 2 por venir, baja
  poner(base, 18, i => iso(2026, 9, 1 + (i % 27)));
  poner(base, 20, i => iso(2026, 9, 1 + (i % 27)));             // septiembre: 38 hechas, el más alto de todos
  poner(base, 1, () => iso(2026, 12, 4));                       // diciembre: 1 por venir, bajito
  const { p } = await abrir({ width: 1280, height: 900 }, base);
  const nov = await columna(p, "2026-11"), dic = await columna(p, "2026-12");
  eq("una barra de 2 por venir en un año de 38: el número no entra adentro, sube arriba de la barra", [nov.nPlan, nov.visible, nov.adentro, nov.arribaDeLaBarra], ["2", true, false, true]);
  eq("…y la de 1 también", [dic.nPlan, dic.visible, dic.arribaDeLaBarra], ["1", true, true]);
  eq("…sin dejar un «+» ni un número pegado al de arriba", [nov.arriba, dic.arriba, nov.plus, dic.plus], ["", "", false, false]);
  await p.close();
}
{
  // El mes más alto con un solo planificado: ni adentro ni arriba hay lugar; el número queda en el globito.
  const base = BASE(); base.replies = []; base.posts = []; k = 0;
  poner(base, 3, i => iso(2026, 6, 1 + i));
  poner(base, 40, i => iso(2026, 10, 1 + (i % 11)));
  poner(base, 1, () => iso(2026, 10, 25));
  const { p } = await abrir({ width: 1280, height: 900 }, base);
  const oct = await columna(p, "2026-10");
  eq("el mes más alto con 1 por venir: el número no se dibuja (no hay lugar), pero el globito lo cuenta", [oct.arriba, oct.visible, /1 planificada/.test(oct.globito)], ["40", false, true]);
  await p.close();
}

/* ---------------- En inglés, en hebreo (de derecha a izquierda) y con el tema oscuro ---------------- */
{
  for(const lang of ["en", "he"]){
    const { p } = await abrir({ width: 1280, height: 900 }, datos(), lang);
    const oct = await columna(p, "2026-10"), nov = await columna(p, "2026-11");
    eq(`${lang}: el 12 y el 9 siguen adentro de su barra`, [[oct.nPlan, oct.adentro], [nov.nPlan, nov.adentro]], [["12", true], ["9", true]]);
    await p.close();
  }
  const { p } = await abrir({ width: 1280, height: 900 }, datos());
  await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const c = await p.evaluate(() => { const n = document.querySelector(".rep-plan-n"), f = getComputedStyle(document.body).backgroundColor; return [getComputedStyle(n).color, f]; });
  const lum = s => { const [r, g, b] = s.match(/\d+/g).map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  eq("tema oscuro: el número se lee (más claro que el fondo)", lum(c[0]) > lum(c[1]) + 60, true);
  await p.close();
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
