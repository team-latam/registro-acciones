/* ======================================================================
   Un texto largo no estira la columna del costado del Inicio (auditoría del 20/11/2026, Y1)

   La columna de la derecha del Inicio («Próximos eventos», «Hitos por vencer», «Tendencias»)
   es de 276 px. Un hijo flexible no baja de su contenido, y una línea en `nowrap` (el título
   de un evento de los próximos 30 días, el nombre de un hito) la estiraba: con un título de
   79 letras pasaba a 565 px y el Feed quedaba en 583 (en 1024 px, en 407); con los datos
   variados de la auditoría, el Feed llegó a 0 y a 200 px. Nadie lo había visto porque el
   título largo de los datos de prueba cae a 40 días, fuera de la ventana de 30.

   Se mide con la app de verdad, en tres anchos, con un evento largo A 5 DÍAS (donde se ve),
   un hito largo que vence en 3 días y una palabra de 70 letras sin espacios.
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const LARGO = "Visita a la comunidad judía de Ciudad de México y Cuernavaca con las comisiones";
const PALABRA = "Superlargapalabrasinespaciosquenoterminanuncayrompelasfilas" + "x".repeat(14);
const base = largo => {
  const b = BASE();
  if(!largo) return b;
  b.posts.push(post({ id: "largo1", title: LARGO, d: -5, a: 0, type: "visita", scopes: [ciudad("México", "Ciudad de México")], content: "" }));
  b.posts.push(post({ id: "largo2", title: PALABRA, d: -6, a: 0, type: "curso", scopes: [ciudad("Uruguay", "Montevideo")], content: "" }));
  b.posts.push(post({ id: "proy-largo", title: "Proyecto con un hito larguísimo", d: 10, start: dia(10), end: dia(-60), a: 0, type: "otro", scopes: [], content: "",
    extra: { is_project: true, project_status: "open", milestones: [{ id: "hl", label: LARGO + " " + LARGO, date: dia(-3), done: false, owners: [] }] } }));
  return b;
};
const medir = p => p.evaluate(() => { const s = document.querySelector(".feed-side"), m = document.querySelector(".feed-main");
  return s && m ? { lateral: Math.round(s.getBoundingClientRect().width), feed: Math.round(m.getBoundingClientRect().width), corrida: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 } : null; });

const b = await abrirNavegador();
for(const ancho of [1024, 1280, 1440]){
  const sin = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 800 }, base: base(false) }); await sin.p.waitForTimeout(700);
  const m0 = await medir(sin.p); await sin.p.close();
  const con = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 800 }, base: base(true) }); await con.p.waitForTimeout(700);
  const m1 = await medir(con.p);
  const lado = await con.p.evaluate(() => (document.querySelector(".feed-side") || {}).innerText || "");
  ok(`[${ancho}] hay columna del costado`, !!m0 && !!m1, JSON.stringify({ m0, m1 }));
  ok(`[${ancho}] los eventos largos están en «Próximos eventos» (se mide donde se ve)`, /Cuernavaca/.test(lado) && /Superlarga/.test(lado), lado.slice(0, 200));
  ok(`[${ancho}] el hito largo está en «Hitos por vencer»`, /Hitos por vencer/i.test(lado) && /Cuernavaca/.test(lado.split(/Hitos por vencer/i)[1] || ""), lado.slice(0, 300));
  ok(`[${ancho}] la columna del costado sigue en 276 px con textos largos`, m1 && m1.lateral === 276, JSON.stringify(m1));
  ok(`[${ancho}] el Feed mide lo mismo con y sin textos largos`, m1 && m0 && m1.feed === m0.feed, JSON.stringify({ sin: m0, con: m1 }));
  ok(`[${ancho}] la página no se corre de costado`, m1 && !m1.corrida, JSON.stringify(m1));
  await con.p.close();
}
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
