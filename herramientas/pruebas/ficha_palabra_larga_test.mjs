/* ======================================================================
   «Lectura rápida» de la ficha de un lugar con un proyecto de nombre larguísimo (23/11/2026)

   La auditoría con datos variados (nombre de 60 letras sin un solo espacio)
   encontró que, en el celular, la línea «1 proyecto abierto (nombre…)» de
   «Lectura rápida» empujaba la página entera hacia un costado: el texto es
   hijo de una fila flex y no podía achicarse ni cortar la palabra. Se arregló
   dejando que ese texto se achique y corte (`min-width:0` + `overflow-wrap`).
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, tab, ADMIN, BASE, post, pais } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const LARGA = "Superlargapalabrasinespaciosquenoterminanuncayrompelasfilas";
// Argentina con un solo proyecto abierto, de nombre sin espacios.
const conProyectoLargo = () => {
  const base = BASE();
  base.posts = base.posts.filter(p => !p.is_project);
  base.posts.push(post({ id: "plarga", title: LARGA, d: 3, type: "visita", scopes: [pais("Argentina")],
    extra: { is_project: true, project_status: "open", milestones: [{ id: "hx", label: "Primer paso", date: "2099-01-01", done: false, owners: [] }] } }));
  return base;
};

const b = await abrirNavegador();
for(const [lang, ancho] of [["", 390], ["he", 390], ["", 320]]){
  const nom = `${ancho}${lang ? " " + lang : ""}`;
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: 844 }, lang, base: conProyectoLargo() });
  await tab(p, "paises");
  await p.click('[data-action="drill-country"][data-country="Argentina"]');
  await p.waitForSelector(".fl-lectura");
  await p.waitForTimeout(200);
  eq(`${nom}: la lectura nombra el proyecto largo (lo que se prueba)`, await p.$eval(".fl-lectura", e => e.textContent.includes("Superlargapalabras")), true);
  eq(`${nom}: la página no se corre de costado`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  eq(`${nom}: el texto de la lectura entra en su tarjeta`, await p.$eval(".fl-lectura", c => {
    const lim = c.getBoundingClientRect();
    return [...c.querySelectorAll("li > span:not(.ic)")].every(s => { const r = s.getBoundingClientRect(); return r.left >= lim.left - 1 && r.right <= lim.right + 1; }); }), true);
  eq(`${nom}: sin errores en la consola`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
