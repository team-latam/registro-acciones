/* ======================================================================
   Buscar por lugar (8/10/2026)

   El usuario cargó dos rutinas con alcance La Habana y, al buscar
   «La Habana», no aparecían: los buscadores miraban el título, el texto,
   quién lo cargó, los participantes y «dónde», pero no el alcance. Ahora
   el del Inicio y el de arriba encuentran también por la ciudad, el país
   o la región (en el idioma de la app y como quedó guardado), y el de
   arriba ofrece la ciudad para abrir el Inicio filtrado ahí.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Una rutina en La Habana cuyo texto no nombra el lugar (como las del
// usuario), y una en Córdoba sin texto.
const conLaHabana = () => {
  const base = BASE();
  base.posts = base.posts.concat([
    post({ id: "r_habana", d: 3, a: 0, type: "rutina", title: "", content: "Contacto con un referente para averiguar por una persona.",
      scopes: [{ type: "ciudad", country: "Cuba", city: "La Habana" }] }),
  ]);
  return base;
};
const visibles = p => p.$$eval("#viewRoot .post[data-post-id]", l => l.map(e => e.dataset.postId));
async function buscarEnElInicio(p, texto){
  await p.fill("#feedSearch", texto);
  await p.waitForTimeout(500);
  return visibles(p);
}

const b = await abrirNavegador();
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conLaHabana() });
  eq("Inicio: «La Habana» trae la rutina con ese alcance aunque el texto no la nombre", await buscarEnElInicio(p, "La Habana"), ["r_habana"]);
  eq("Inicio: sin tildes ni mayúsculas, igual", await buscarEnElInicio(p, "habana"), ["r_habana"]);
  eq("Inicio: por el país del alcance («Cuba»)", await buscarEnElInicio(p, "cuba"), ["r_habana"]);
  const cordoba = await buscarEnElInicio(p, "Córdoba");
  eq("Inicio: «Córdoba» trae el curso de Córdoba (su título no la nombra)",
     cordoba.includes(await p.evaluate(() => window.__sb.tablas.posts.find(x => x.title === "Curso de primeros auxilios").id)), true);
  eq("Inicio: un lugar donde no hay nada, nada", await buscarEnElInicio(p, "Tegucigalpa"), []);
  await p.fill("#feedSearch", "");

  // El de arriba: la ciudad como resultado, y la rutina entre los posteos.
  await p.click("#globalSearchInput");
  await p.type("#globalSearchInput", "Habana");
  await p.waitForSelector('#globalResults [data-action="gs-city"]', { timeout: 4000 }).catch(() => {});
  eq("arriba: ofrece la ciudad, con su país",
     await p.$$eval('#globalResults [data-action="gs-city"]', l => l.map(e => [e.querySelector("b").textContent, e.querySelector("small").textContent])), [["La Habana", "Cuba"]]);
  eq("arriba: y la rutina entre los posteos",
     await p.$$eval('#globalResults [data-action="gs-post"]', l => l.map(e => e.dataset.postId)), ["r_habana"]);
  await p.click('#globalResults [data-action="gs-city"]');
  await p.waitForTimeout(400);
  eq("arriba: elegir la ciudad abre el Inicio filtrado ahí",
     [await p.$eval("nav.tabs button.active", e => e.dataset.view), await p.$eval('[data-action="clear-place"]', e => e.textContent.trim()), await visibles(p)],
     ["feed", "📍 La Habana, Cuba ✕", ["r_habana"]]);
  eq("sin errores", errores, []);
  await p.close();
}
{
  // En inglés la ciudad se llama Havana: se encuentra igual, por los dos nombres.
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: conLaHabana(), lang: "en" });
  eq("en inglés: «Havana» la encuentra", await buscarEnElInicio(p, "Havana"), ["r_habana"]);
  eq("en inglés: y «La Habana», como quedó guardada, también", await buscarEnElInicio(p, "La Habana"), ["r_habana"]);
  eq("en inglés: sin errores", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
