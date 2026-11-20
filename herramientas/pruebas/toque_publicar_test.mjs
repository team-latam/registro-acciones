/* ======================================================================
   En el celular, el primer toque en «Publicar» llega (auditoría del 20/11/2026, Z1)

   «Nuevo evento»: se escribe el título, se elige el lugar y se toca «Publicar» con
   un campo de texto todavía con el foco. Al apoyar el dedo el campo suelta el foco,
   `html.teclado` se apagaba en ese mismo instante y el cuadro cambiaba de relleno, de
   alto y de lugar entre apoyar y levantar: el botón subía entre 29 y 46 px, el toque
   caía en otra parte y no pasaba nada (era el T10 del 28/10, que se creía solo de
   pantalla corta: pasaba a 844, 740, 661 y 600 px de alto). Ahora el modo teclado se
   apaga cuando el toque terminó.

   Se mide con un TOQUE (`page.touchscreen.tap`), no con un clic de mouse: el mouse no
   mueve nada entre apoyar y levantar y nunca lo vio. Con la app de verdad y el
   Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const tocar = async (p, sel) => {
  const c = await p.evaluate(sel => { const e = document.querySelector(sel); if(!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  if(!c) return false;
  await p.touchscreen.tap(c.x, c.y); return true;
};
const preparar = async (p) => {
  await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(400);
  await p.fill("#cTitle", "Visita a Salta"); await p.fill("#cPlaceQuery", "Salta"); await p.waitForTimeout(400);
  await p.evaluate(() => document.querySelector('[data-action="pick-place"]').click()); await p.waitForTimeout(300);
  await p.focus("#cPlaceQuery"); await p.waitForTimeout(300);
};
const publicado = p => p.evaluate(() => window.__sb.tablas.posts.some(x => x.title === "Visita a Salta"));

const b = await abrirNavegador();
for(const alto of [844, 740, 661, 600]){
  // 1) El primer toque en «Publicar», con el foco en un campo de texto.
  { const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: alto } });
    await p.waitForTimeout(400); await preparar(p);
    ok(`[390×${alto}] el modo teclado está prendido con el foco en un campo`, await p.evaluate(() => document.documentElement.classList.contains("teclado")));
    ok(`[390×${alto}] «Publicar» está a la vista`, await p.evaluate(() => { const r = document.querySelector('#postForm button[type="submit"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    ok(`[390×${alto}] se puede tocar «Publicar»`, await tocar(p, '#postForm button[type="submit"]'));
    await p.waitForTimeout(1200);
    ok(`[390×${alto}] el primer toque en «Publicar» publica`, await publicado(p));
    ok(`[390×${alto}] y el formulario se cierra`, await p.evaluate(() => !document.querySelector("#postForm").offsetParent));
    await p.close(); }
}
// 2) El modo teclado no se queda trabado: tocar algo que no es un campo lo apaga.
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: 661 } });
  await p.waitForTimeout(400); await preparar(p);
  ok("el modo teclado está prendido antes del toque", await p.evaluate(() => document.documentElement.classList.contains("teclado")));
  // El título del cuadro («Nuevo evento»): algo que se toca y no es un campo de texto.
  const c = await p.evaluate(() => { const e = [...document.querySelectorAll(".modal *, [role=dialog] *")].find(x => x.children.length === 0 && x.textContent.trim() === "Nuevo evento"); if(!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  ok("se encuentra el título del cuadro para tocarlo", !!c);
  if(c) await p.touchscreen.tap(c.x, c.y);
  await p.waitForTimeout(500);
  ok("tocar algo que no es un campo apaga el modo teclado (no queda trabado)", await p.evaluate(() => !document.documentElement.classList.contains("teclado")));
  await p.close(); }
// 3) Y pasar de un campo a otro no lo apaga.
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: 661 } });
  await p.waitForTimeout(400); await preparar(p);
  await p.focus("#cTitle"); await p.waitForTimeout(300);
  ok("de un campo a otro el modo teclado sigue prendido", await p.evaluate(() => document.documentElement.classList.contains("teclado")));
  await p.close(); }
// 4) En la compu no hay modo teclado y el clic anda como siempre.
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 1440, height: 900 } });
  await p.waitForTimeout(400); await preparar(p);
  eq("[compu] sin modo teclado", await p.evaluate(() => document.documentElement.classList.contains("teclado")), false);
  await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(1200);
  ok("[compu] el clic en «Publicar» publica", await publicado(p));
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
