/* ======================================================================
   El buscador llega a lo que se habló, y se puede copiar el enlace de una actividad
   (auditoría del 20/11/2026, Y10 e Y11)

   Y10. El buscador miraba el título, los comentarios, el autor, la gente, el lugar y el alcance.
   No miraba las respuestas del hilo, el resumen que sale de un Formulario de Cierre (resumen
   ejecutivo, objetivos, pasos), los hitos de un proyecto ni los nombres de los archivos: «portón»,
   «motivado» y «Presupuesto aprobado» daban «Sin resultados». Los mensajes automáticos del
   sistema («… cambió la fecha de fin») no cuentan: no los escribió nadie.

   Y11. El menú ⋯ de una actividad tiene «Copiar enlace»: el mismo ?post= que ya usan los
   correos, sin lo que la dirección ya traiga, para mandarlo por WhatsApp.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const b = await abrirNavegador();
const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
await p.waitForTimeout(600);
const buscar = async q => {
  await p.fill("#globalSearch input", ""); await p.fill("#globalSearch input", q); await p.waitForTimeout(450);
  return p.evaluate(() => { const r = document.getElementById("globalResults"); return { texto: r ? r.innerText.replace(/\s+/g, " ") : "", ids: r ? [...r.querySelectorAll("[data-post-id]")].map(x => x.dataset.postId) : [] }; });
};
// Y10: cada cosa que antes daba «Sin resultados» ahora lleva a su actividad.
const porHilo = await buscar("portón");
ok("«portón» (dicho en una respuesta del hilo de «Visita a la comunidad de Rosario») la encuentra", porHilo.ids.includes("p1"), JSON.stringify(porHilo));
const porResumen = await buscar("motivado");
ok("«motivado» (del resumen ejecutivo de un Cierre) encuentra la actividad", porResumen.ids.includes("p1"), JSON.stringify(porResumen));
const porObjetivo = await buscar("charla con los padres");
ok("un objetivo del Cierre la encuentra", porObjetivo.ids.includes("p1"), JSON.stringify(porObjetivo));
const porPaso = await buscar("plan de verano por escrito");
ok("un paso del Cierre la encuentra", porPaso.ids.includes("p1"), JSON.stringify(porPaso));
const porHito = await buscar("Presupuesto aprobado");
ok("el hito de un proyecto encuentra el proyecto", porHito.ids.includes("proj1"), JSON.stringify(porHito));
const porArchivo = await buscar("Formulario de Cierre Rosario");
ok("el nombre de un archivo adjunto la encuentra", porArchivo.ids.includes("p1"), JSON.stringify(porArchivo));
// Lo que no escribió nadie no cuenta, y lo que no existe sigue sin resultados.
const sistema = await buscar("cambió la fecha de fin");
ok("un mensaje automático del sistema no se busca", !sistema.ids.includes("p2"), JSON.stringify(sistema));
const nada = await buscar("zzzqqq");
ok("lo que no existe sigue dando «Sin resultados»", /Sin resultados/.test(nada.texto) && nada.ids.length === 0, JSON.stringify(nada));
// Lo de siempre sigue andando.
const clasico = await buscar("cordoba");
ok("buscar por lugar sin tilde sigue andando", /Córdoba/.test(clasico.texto), clasico.texto.slice(0, 120));
await p.fill("#globalSearch input", ""); await p.keyboard.press("Escape");

// Y11: «Copiar enlace».
await p.evaluate(() => { window.__copiado = null; Object.defineProperty(navigator, "clipboard", { value: { writeText: async t => { window.__copiado = t; } }, configurable: true }); });
await click(p, '.post[data-post-id="p1"] [data-action="toggle-post-menu"]'); await p.waitForTimeout(200);
const item = await p.$('.post[data-post-id="p1"] [data-action="copy-post-link"]');
ok("el menú ⋯ trae «Copiar enlace»", !!item);
if(item){
  eq("con el texto en español", (await item.innerText()).replace(/\s+/g, " ").trim(), "🔗 Copiar enlace");
  await item.click(); await p.waitForTimeout(400);
  const url = await p.evaluate(() => window.__copiado);
  ok("copia la dirección de la página con ?post=p1", typeof url === "string" && /\?post=p1$/.test(url) && url.split("?").length === 2, String(url));
  ok("y sin ningún # ni otra consulta", typeof url === "string" && !url.includes("#"), String(url));
  ok("avisa que se copió", await p.evaluate(() => /Enlace copiado: pegalo donde quieras\./.test((document.getElementById("calendarToast") || {}).textContent || "")));
  eq("y el menú se cierra", await p.$$eval('.post[data-post-id="p1"] .post-menu', l => l.length), 0);
}
// Si el portapapeles no se puede usar, el aviso trae el enlace para copiarlo a mano.
await p.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("negado"); } }, configurable: true }); document.execCommand = () => false; });
await click(p, '.post[data-post-id="p1"] [data-action="toggle-post-menu"]'); await p.waitForTimeout(200);
await p.click('.post[data-post-id="p1"] [data-action="copy-post-link"]'); await p.waitForTimeout(400);
ok("si no se puede copiar, el aviso trae el enlace", await p.evaluate(() => /No se pudo copiar\. El enlace es: .*\?post=p1/.test((document.getElementById("calendarToast") || {}).textContent || "")));
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
