/* ======================================================================
   En hebreo, los rótulos chicos se leen (docs/AUDITORIA.md, V4; el usuario, 24/11/2026)

   Los rótulos de grupo y de tarjeta se pensaron para el alfabeto latino: 11 px, negrita fuerte, letras separadas y MAYÚSCULAS.
   En hebreo no hay mayúsculas, separar las letras estorba y 11 px en negrita se empasta (el menú de Administración se veía mal).
   Acá se recorre toda la app en hebreo (escritorio y celular, y las secciones de Administración) y se mide TODO texto en hebreo:
   ninguno con letras separadas ni en mayúsculas, ninguno de menos de 12 px en negrita fuerte, el menú de Administración con
   rótulos casi del tamaño de sus ítems. Y en español no cambia nada (ahí siguen como se pensaron).
   Un rótulo nuevo de ese estilo hace fallar esto: se suma a la lista de «Hebreo» del CSS de index.html.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, recorrerApp, irAdmin, admin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const sonda = p => p.evaluate(() => {
  const mal = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while(w.nextNode()){
    const n = w.currentNode, tx = n.textContent.trim(); if(!tx || !/[֐-׿]/.test(tx)) continue;
    const el = n.parentElement; if(!el || (!el.offsetParent && getComputedStyle(el).position !== "fixed")) continue;
    const cs = getComputedStyle(el), ls = parseFloat(cs.letterSpacing) || 0, fs = parseFloat(cs.fontSize), peso = Number(cs.fontWeight);
    const quien = (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase()) + " «" + tx.slice(0, 12) + "»";
    if(ls > 0) mal.push(`letras separadas (${ls}px): ${quien}`);
    if(cs.textTransform === "uppercase") mal.push(`mayúsculas: ${quien}`);
    if(fs < 12 && peso >= 800) mal.push(`${fs}px en negrita ${peso}: ${quien}`);
  }
  return mal;
});

const b = await abrirNavegador();
for(const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "he" });
  const halladas = new Map();
  const ver = async n => { for(const x of await sonda(p)) if(!halladas.has(x)) halladas.set(x, n); };
  await recorrerApp(p, async (p, n) => { await ver(n); });
  if(vp.width > 800){
    await irAdmin(p);
    for(const [v, k] of [["resumen"], ["personas"], ["preferencias", "brujula"], ["preferencias", "tipos"], ["preferencias", "correos"], ["preferencias", "gastos"]]){ await admin(p, v, k); await p.waitForTimeout(250); await ver("Administración " + (k || v)); }
  }
  eq(`hebreo ${vp.width}: ningún texto con letras separadas, en mayúsculas ni de menos de 12 px en negrita fuerte`, [...halladas].slice(0, 8).map(([x, n]) => x + " — " + n), []);
  eq(`hebreo ${vp.width}: sin errores en la página`, errores, []);
  await p.close();
}
{
  // El menú de Administración, en hebreo: los rótulos de grupo casi del tamaño de los ítems y el título sin negrita fuerte.
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1360, height: 900 }, lang: "he" });
  await irAdmin(p);
  const m = await p.evaluate(() => { const g = document.querySelector(".admin-menu .admin-grupo"), i = document.querySelector(".admin-menu .admin-item"), t = document.querySelector(".admin-titulo");
    const c = (e, k) => parseFloat(getComputedStyle(e)[k]);
    return { grupo: c(g, "fontSize"), item: c(i, "fontSize"), pesoGrupo: Number(getComputedStyle(g).fontWeight), pesoTitulo: Number(getComputedStyle(t).fontWeight), may: getComputedStyle(g).textTransform, ls: c(g, "letterSpacing") || 0 }; });
  eq("menú de Administración en hebreo: el rótulo de grupo mide 13 px o más (y no más que el ítem)", [m.grupo >= 13, m.grupo <= m.item], [true, true]);
  eq("menú de Administración en hebreo: rótulo y título en negrita común, sin mayúsculas ni letras separadas", [m.pesoGrupo <= 700, m.pesoTitulo <= 700, m.may, m.ls], [true, true, "none", 0]);
  await p.close();
}
{
  // En español no cambia nada: ahí los rótulos siguen en mayúsculas, chicos y con las letras separadas, como se pensaron.
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1360, height: 900 } });
  await irAdmin(p);
  const m = await p.evaluate(() => { const g = document.querySelector(".admin-menu .admin-grupo"), cs = getComputedStyle(g); return { may: cs.textTransform, ls: parseFloat(cs.letterSpacing) > 0, fs: parseFloat(cs.fontSize), peso: Number(cs.fontWeight) }; });
  eq("en español el rótulo de grupo sigue como se pensó (mayúsculas, letras separadas, 11 px, negrita fuerte)", m, { may: "uppercase", ls: true, fs: 11, peso: 800 });
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
