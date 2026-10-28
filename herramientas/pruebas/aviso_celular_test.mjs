/* ======================================================================
   En el celular, los avisos no tapan la barra de abajo (auditoría del 28/10/2026, T6)

   El aviso flotante («Borrado.», «No se pudo guardar…») se pintaba a 24 px del
   borde de abajo, justo encima de la barra de navegación del celular: tapaba el
   «+», Calendario y Países, y el de un error no se va solo hasta tocar «Cerrar».
   En el celular (640 px o menos) ahora flota por ENCIMA de la barra; en la compu
   sigue a 24 px del borde.
   Se mide con la app de verdad, en tres anchos, y también con una letra mucho más
   ancha que la de esta máquina (GitHub corre las pruebas con otra: el 28/10 una
   cuenta ajustada de más de 4 px no entró allá).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const medir = p => p.evaluate(() => {
  const r = e => { const x = e.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom), left: Math.round(x.left), right: Math.round(x.right) }; };
  const aviso = document.getElementById("calendarToast"), nav = document.querySelector(".bottom-nav");
  return { aviso: aviso && !aviso.hidden ? r(aviso) : null, nav: nav && getComputedStyle(nav).display !== "none" ? r(nav) : null, alto: innerHeight,
           texto: aviso ? aviso.textContent.replace(/\s+/g, " ").trim().slice(0, 60) : "" };
});
const borrar = async p => {
  await p.evaluate(() => document.querySelector('.post[data-post-id="p1"] [data-action="toggle-post-menu"]').click());
  await p.evaluate(() => document.querySelector('.post[data-post-id="p1"] [data-action="delete-post"]').click()); await p.waitForTimeout(300);
  await p.click("#confirmOk"); await p.waitForTimeout(600);
};

const b = await abrirNavegador();
for(const [nombre, vp, fuente] of [["celular 390", { width: 390, height: 844 }, null], ["celular 360", { width: 360, height: 740 }, null], ["celular 360, letra ancha", { width: 360, height: 740 }, "DejaVu Sans"]]){
  // Aviso de éxito («Borrado.»)
  { const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp });
    if(fuente) await p.addStyleTag({ content: `html, body, button, input, textarea, select { font-family: "${fuente}", sans-serif !important; }` });
    await borrar(p);
    const m = await medir(p);
    ok(`[${nombre}] el aviso de éxito aparece`, !!m.aviso && /Borrado/.test(m.texto), JSON.stringify(m));
    ok(`[${nombre}] hay barra de abajo`, !!m.nav, JSON.stringify(m));
    ok(`[${nombre}] el aviso de éxito queda por encima de la barra (no la toca)`, !!m.aviso && !!m.nav && m.aviso.bottom <= m.nav.top, JSON.stringify(m));
    ok(`[${nombre}] y entra entero en la pantalla`, !!m.aviso && m.aviso.top >= 0 && m.aviso.left >= 0 && m.aviso.right <= vp.width, JSON.stringify(m));
    await p.close(); }
  // Aviso de error (se queda hasta tocar «Cerrar»)
  { const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp });
    if(fuente) await p.addStyleTag({ content: `html, body, button, input, textarea, select { font-family: "${fuente}", sans-serif !important; }` });
    await p.evaluate(() => { window.__sb.fallo = "42501"; });
    await borrar(p);
    const m = await medir(p);
    ok(`[${nombre}] el aviso de error aparece`, !!m.aviso && /No se pudo borrar/.test(m.texto), JSON.stringify(m));
    ok(`[${nombre}] el de error también queda por encima de la barra`, !!m.aviso && !!m.nav && m.aviso.bottom <= m.nav.top, JSON.stringify(m));
    await p.close(); }
}
// En la compu no hay barra de abajo y el aviso sigue a 24 px del borde.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  await borrar(p);
  const m = await medir(p);
  eq("[compu] sin barra de abajo", m.nav, null);
  eq("[compu] el aviso sigue a 24 px del borde de abajo", m.aviso && 900 - m.aviso.bottom, 24);
  await p.close(); }
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
