/* ======================================================================
   Nombres para el lector de pantalla (auditoría del 10/10/2026, R22)

   - Una ✕ sola no dice qué hace: el lector la leía «equis». Las que no
     tenían nombre llevan aria-label (en los cuatro idiomas): quitar un
     enlace del formulario, y las que solo tenían title (quitar hito,
     eliminar zona, quitar un archivo del evento, quitar un adjunto suelto).
   - La foto del visor llevaba alt="": ahora su alt es el título que ya
     muestra («Foto 2 de 3»).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, tab, click, irAdmin, admin, cerrar } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const b = await abrirNavegador();

// Los botones que son solo una ✕ (o ×): su acción y su nombre accesible.
const equis = p => p.$$eval("button, [role=button]", l => l.filter(e => /^[✕×✖]$/.test(e.textContent.trim())).map(e => ({
  accion: e.dataset.action || e.id || e.className, nombre: (e.getAttribute("aria-label") || "").trim() || (e.getAttribute("aria-labelledby") ? "(labelledby)" : "") })));
const base = () => { const x = BASE(); x.posts.find(q => q.id === "p1").files.push({ name: "Suelto.pdf", kind: "pdf", path: "posts/p1/suelto.pdf" }); return x; };

const ESPERADO = { "ms-remove": { es: "Quitar hito", en: "Remove milestone", pt: "Remover marco", he: "הסרת אבן דרך" },
  "zonas-remove-zone": { es: "Eliminar zona", en: "Delete zone", pt: "Excluir zona", he: "מחיקת אזור" },
  "quitar-doc": { es: "Quitar este archivo del evento", en: "Remove this file from the event", pt: "Remover este arquivo do evento", he: "הסרת הקובץ הזה מהאירוע" },
  "quitar-adjunto": { es: "Quitar este archivo del evento", en: "Remove this file from the event", pt: "Remover este arquivo do evento", he: "הסרת הקובץ הזה מהאירוע" },
  "rm-link": { es: "Quitar este enlace", en: "Remove this link", pt: "Remover este link", he: "הסרת הקישור" } };

for(const lang of ["", "en", "pt", "he"]){
  const idioma = lang || "es", L = idioma;
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang, base: base() });
  const vistas = {};
  const juntar = async () => { for(const x of await equis(p)) vistas[x.accion] = x.nombre; };

  // Los archivos de un evento (los de un documento esperado y los sueltos).
  await p.waitForSelector('.post[data-post-id="p1"]');
  await juntar();
  // El panel de documentos de un evento (los archivos de cada documento esperado).
  await click(p, '.post[data-post-id="p1"] [data-action="toggle-docs"]'); await p.waitForTimeout(300);
  await juntar();
  // Un proyecto abierto: sus hitos.
  await tab(p, "proyectos"); await p.waitForTimeout(300);
  if(await click(p, '[data-action="project-open"]')){ await p.waitForTimeout(500); await juntar(); await cerrar(p); }
  // El formulario de un evento con un enlace.
  await tab(p, "feed"); await p.waitForTimeout(300);
  await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(500);
  await click(p, '[data-action="toggle-post-attach"]'); await p.waitForTimeout(200);
  await click(p, '[data-action="post-add-link"]'); await p.waitForTimeout(300);
  await juntar();
  // Las zonas (en otra página: el formulario de arriba quedó con cambios sin guardar).
  const { p: q, errores: errQ } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang, base: base() });
  await irAdmin(q); await admin(q, "preferencias", "avanzado"); await admin(q, "preferencias", "zonas"); await q.waitForTimeout(400);
  for(const x of await equis(q)) vistas[x.accion] = x.nombre;
  errores.push(...errQ);
  await q.close();

  const ya = ["ms-remove", "zonas-remove-zone", "quitar-doc", "quitar-adjunto", "rm-link"];
  eq(`[${idioma}] la prueba vio las cinco ✕ que no tenían nombre`, ya.filter(k => !(k in vistas)), []);
  eq(`[${idioma}] y ninguna ✕ de las que vio queda sin nombre`, Object.entries(vistas).filter(([, n]) => !n).map(([a]) => a), []);
  for(const k of ya) if(vistas[k]) eq(`[${idioma}] ${k}: dice «${ESPERADO[k][L]}»`, vistas[k], ESPERADO[k][L]);
  eq(`[${idioma}] sin errores en la página`, errores, []);
  await p.close();
}

// ---- El alt de la foto del visor ----
for(const [lang, uno, de] of [["", "Foto", n => `Foto ${n[0]} de ${n[1]}`], ["en", "Photo", n => `Photo ${n[0]} of ${n[1]}`]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang });
  const alt = () => p.evaluate(() => [document.getElementById("lightboxImg").getAttribute("alt"), document.getElementById("lightboxTitle").textContent]);
  await p.click('.post[data-post-id="p1"] [data-action="open-lightbox"]'); await p.waitForTimeout(300);
  let [a, titulo] = await alt();
  eq(`[${lang || "es"}] con dos fotos, el alt es el título que ya muestra`, [a, a === titulo], [de([1, 2]), true]);
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(200);
  [a, titulo] = await alt();
  eq(`[${lang || "es"}] y cambia con la foto`, [a, a === titulo], [de([2, 2]), true]);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  await p.click('.post[data-post-id="p6"] [data-action="open-lightbox"]'); await p.waitForTimeout(300);
  [a, titulo] = await alt();
  eq(`[${lang || "es"}] con una sola, «${uno}»`, [a, a === titulo], [uno, true]);
  eq(`[${lang || "es"}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
