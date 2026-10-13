/* ======================================================================
   «Ver traducción» también en las respuestas, en su fila de acciones
   (pedido del usuario, 10/10/2026)

   En el posteo el botón vive en la fila de acciones (Me gusta · Responder ·
   Ver traducción). En las respuestas quedaba como un renglón suelto y más
   chico debajo del texto, fácil de no ver. Ahora va en la fila de acciones
   de cada respuesta, también para quien solo observa (que no tiene Me
   gusta ni Responder); y en español no se ofrece, como siempre.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const conObservador = () => { const base = BASE(); base.members = base.members.concat([{ email: "obs@team-latam.com", name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]); return base; };
const b = await abrirNavegador();
const medir = p => p.evaluate(() => [...document.querySelectorAll('.post[data-post-id="p1"] .reply')].map(r => ({
  enAcciones: r.querySelectorAll(".reply-actions .translate-toggle").length,
  sueltos: r.querySelectorAll(":scope > .translate-toggle").length,
  texto: r.querySelector(".reply-actions .translate-toggle")?.textContent.trim() || null,
  letra: r.querySelector(".reply-actions .translate-toggle") ? getComputedStyle(r.querySelector(".reply-actions .translate-toggle")).fontSize : null,
  letraFila: r.querySelector(".reply-actions button:not(.translate-toggle)") ? getComputedStyle(r.querySelector(".reply-actions button:not(.translate-toggle)")).fontSize : null,
})));
for(const [quien, nombre, lang] of [[ADMIN, "Benny Rosenthal", "pt"], ["obs@team-latam.com", "Olga Observa", "en"], [ADMIN, "Benny Rosenthal", ""]]){
  const { p } = await entrar(b, quien, nombre, { viewport: { width: 1280, height: 900 }, lang, base: conObservador() });
  await click(p, '.post[data-post-id="p1"] [data-action="toggle-thread"]'); await p.waitForTimeout(400);
  const r = await medir(p);
  eq(`${nombre} (${lang || "es"}): hay respuestas para mirar`, r.length >= 3, true);
  if(lang){
    eq(`${nombre} (${lang}): cada respuesta tiene «Ver traducción» en su fila de acciones, una sola vez`, r.map(x => x.enAcciones), r.map(() => 1));
    eq(`${nombre} (${lang}): y ya no como renglón suelto debajo del texto`, r.map(x => x.sueltos), r.map(() => 0));
    eq(`${nombre} (${lang}): con el texto en el idioma de la app`, r[0].texto, lang === "pt" ? "🌐 Ver tradução" : "🌐 See translation");
    if(r[0].letraFila) eq(`${nombre} (${lang}): con la misma letra que Me gusta y Responder`, r[0].letra, r[0].letraFila);
  } else {
    eq("en español no se ofrece (ni en el posteo ni en las respuestas)", [r.map(x => x.enAcciones + x.sueltos), await p.$$eval('.post[data-post-id="p1"] .post-actions .translate-toggle', l => l.length)], [r.map(() => 0), 0]);
  }
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
