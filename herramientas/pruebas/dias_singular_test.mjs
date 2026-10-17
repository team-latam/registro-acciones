/* ======================================================================
   «hace 1 día», no «hace 1 días» (12/10/2026)

   Al armar el video de presentación (en inglés) apareció «Last visit 1 days
   ago» en la ficha de un país. Las frases con «hace N días» no tenían el
   singular, ni «hoy» para el mismo día (salía «hace 0 días»). Pasaba en la
   lectura rápida de la ficha, en la cifra «Última», en las filas de ciudades
   y en la frase de «todavía no hay visitas». Se comprueba en los cuatro
   idiomas, con una visita de hoy, una de ayer y una de hace tres días.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// El mediodía (UTC) de hoy, fijo en Node y en el navegador: si la corrida cruza la medianoche a mitad de la
// prueba, «ayer» no pasa a ser «hace 2 días» (pasó el 17/10/2026 a las 00:00 UTC, en el idioma hebreo).
const MEDIODIA = (() => { const h = new Date(); return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate(), 12)); })();
const base = () => {
  const real = Date.now; Date.now = () => MEDIODIA.getTime();
  try { return armar(); } finally { Date.now = real; }
};
const armar = () => {
  const b = BASE();
  b.posts = [
    post({ id: "hoy", title: "Visita de hoy", d: 0, a: 1, type: "visita", scopes: [ciudad("Argentina", "Bariloche")], content: "" }),
    post({ id: "ayer", title: "Visita de ayer", d: 1, a: 1, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "" }),
    post({ id: "tres", title: "Visita de hace tres días", d: 3, a: 1, type: "visita", scopes: [ciudad("Argentina", "Cordoba")], content: "" }),
    // Un lugar sin visitas, solo con un registro de ayer: «Todavía no hay visitas… Último registro…»
    post({ id: "rut", title: "Llamado de ayer", d: 1, a: 1, type: "rutina", scopes: [ciudad("Chile", "Santiago")], content: "Llamado" }),
  ];
  b.replies = [];
  return b;
};
const b = await abrirNavegador();
const abrir = async (lang, viewport) => {
  const r = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: viewport || { width: 1280, height: 900 }, lang, base: base() });
  await r.p.clock.setFixedTime(MEDIODIA);
  await tab(r.p, "paises");
  return r;
};
const irPais = async (p, pais) => { await p.evaluate(c => document.querySelector(`[data-action="drill-country"][data-country="${c}"]`).click(), pais); await p.waitForTimeout(400); };
const irCiudad = async (p, nombre) => { await p.evaluate(c => document.querySelector(`[data-action="drill-city"][data-city="${c}"]`).click(), nombre); await p.waitForTimeout(400); };
const leer = p => p.evaluate(() => ({
  pagina: document.body.innerText.replace(/\s+/g, " "),
  lectura: (document.querySelector(".fl-lectura li")?.innerText || "").replace(/\s+/g, " ").trim(),
  ultima: [...document.querySelectorAll(".fl-stat")].map(e => e.innerText.replace(/\s+/g, " ").trim()).find(x => /^(Última|Latest|Última)/i.test(x) || /אחרון/.test(x)) || "",
}));
const fila = (p, nombre) => p.evaluate(n => { const e = [...document.querySelectorAll('[data-action="drill-city"]')].find(x => x.dataset.city === n); return e ? (e.closest(".fl-hijo") || e).innerText.replace(/\s+/g, " ").trim() : ""; }, nombre);
const MALOS = /\b1 days ago|\b0 days ago|hace 1 días|hace 0 días|há 1 dias|há 0 dias|לפני 1 ימים|לפני 0 ימים/;

// Por idioma: [Argentina → filas de las tres ciudades], [Rosario → lectura y «Última»], [Chile → sin visitas]
const ESPERADO = {
  en: { hoy: "latest: today", ayer: "latest: 1 day ago", tres: "latest: 3 days ago", lectura: /Last visit 1 day ago/, ultima: /1 day ago/, sinVisitas: /Last record 1 day ago/ },
  es: { hoy: "último: hoy", ayer: "último: hace 1 día", tres: "último: hace 3 días", lectura: /Última visita hace 1 día(?!s)/, ultima: /hace 1 día(?!s)/, sinVisitas: /Último registro hace 1 día(?!s)/ },
  pt: { hoy: "último: hoje", ayer: "último: há 1 dia", tres: "último: há 3 dias", lectura: /Última visita há 1 dia(?!s)/, ultima: /há 1 dia(?!s)/, sinVisitas: /Último registro há 1 dia(?!s)/ },
  he: { hoy: "אחרון: היום", ayer: "אחרון: לפני יום", tres: "אחרון: לפני 3 ימים", lectura: /ביקור אחרון לפני יום(?! ?ימים)/, ultima: /לפני יום(?! ?ימים)/, sinVisitas: /רשומה אחרונה לפני יום/ },
};
for(const lang of ["en", "es", "pt", "he"]){
  const E = ESPERADO[lang];
  const { p, errores } = await abrir(lang);
  await irPais(p, "Argentina");
  const pais = await leer(p);
  eq(`${lang}: la fila de la ciudad con visita de hoy dice «${E.hoy}»`, (await fila(p, "Bariloche")).includes(E.hoy), true);
  eq(`${lang}: la de ayer dice «${E.ayer}»`, (await fila(p, "Rosario")).includes(E.ayer), true);
  eq(`${lang}: la de hace tres días dice «${E.tres}»`, (await fila(p, "Cordoba")).includes(E.tres), true);
  eq(`${lang}: la ficha del país no tiene «1 días» ni «0 días»`, MALOS.test(pais.pagina), false);
  await irCiudad(p, "Rosario");
  const rosario = await leer(p);
  eq(`${lang}: la lectura rápida de Rosario (visita de ayer) usa el singular`, E.lectura.test(rosario.lectura), true);
  eq(`${lang}: la cifra «Última» de Rosario usa el singular`, E.ultima.test(rosario.ultima), true);
  eq(`${lang}: Rosario no tiene «1 días» ni «0 días» en ninguna parte`, MALOS.test(rosario.pagina), false);
  await p.close();

  // Un lugar con registros pero sin visitas: «Todavía no hay visitas cargadas. Último registro hace 1 día.»
  const chile = await abrir(lang);
  await irPais(chile.p, "Chile"); await irCiudad(chile.p, "Santiago");
  const stgo = await leer(chile.p);
  eq(`${lang}: «sin visitas, último registro» usa el singular`, E.sinVisitas.test(stgo.lectura), true);
  eq(`${lang}: sin errores de página`, [...errores, ...chile.errores], []);
  await chile.p.close();
}
// La visita de hoy, en la ficha de su ciudad: «hoy», no «hace 0 días».
{
  const { p } = await abrir("en");
  await irPais(p, "Argentina"); await irCiudad(p, "Bariloche");
  const r = await leer(p);
  eq("la visita de hoy dice «Last visit today»", /Last visit today/.test(r.lectura), true);
  eq("y la cifra «Última» dice «today»", /today/.test(r.ultima), true);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
