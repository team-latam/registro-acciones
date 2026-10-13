/* ======================================================================
   Las tablas de Reportes entran en su tarjeta, también con una letra ancha
   (captura del usuario, 10/10/2026)

   En «Comparar», la tabla «Por país» se salía de la tarjeta con barra
   lateral y la columna «Diferencia» cortada. Acá no pasaba: la letra de
   las pruebas (Inter) es más angosta que la del navegador del usuario
   (Montserrat). Se mide con una letra ancha (monospace), como
   proximos_tarjeta_test: ninguna tabla de Reportes puede ser más ancha que
   su tarjeta, y el último encabezado tiene que verse entero.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, dia, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const base = BASE();
const anterior = String(Number(dia(0).slice(0, 4)) - 1);
base.posts = base.posts.concat([
  post({ id: "rd", title: "Visita a Santo Domingo", d: 30, a: 0, type: "visita", scopes: [ciudad("República Dominicana", "Santo Domingo")] }),
  post({ id: "sb", title: "Visita a San Bartolomé", d: 40, a: 0, type: "visita", scopes: [{ type: "pais", country: "San Bartolomé (St. Barth)" }] }),
  post({ id: "tc", title: "Visita a Turcas y Caicos", d: 45, a: 0, type: "visita", scopes: [{ type: "pais", country: "Islas Turcas y Caicos" }] }),
  post({ id: "ar_antes", title: "Visita a Córdoba del año pasado", start: `${anterior}-05-10`, a: 1, type: "visita", scopes: [ciudad("Argentina", "Córdoba")] }),
]);
const LETRA_ANCHA = `*{ font-family:"DejaVu Sans", Verdana, monospace !important; }`;
const b = await abrirNavegador();
for(const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base });
  await p.addStyleTag({ content: LETRA_ANCHA });
  await tab(p, "reportes"); await p.waitForTimeout(400);
  for(const modo of ["comparar", "periodo"]){
    if(modo === "comparar"){ await click(p, '[data-action="reporte-modo"][data-key="comparar"]'); await p.waitForTimeout(500); }
    const tablas = await p.evaluate(() => [...document.querySelectorAll(".rep-tabla-envoltorio")].filter(e => e.offsetParent).map(e => {
      const t = e.querySelector("table"); const ths = [...t.querySelectorAll("thead th")]; const ultimo = ths[ths.length - 1];
      const ce = e.getBoundingClientRect(), cu = ultimo ? ultimo.getBoundingClientRect() : null;
      return { desborda: t.scrollWidth > e.clientWidth + 1, ultimoEntero: !cu || (cu.right <= ce.right + 1 && ultimo.scrollWidth <= ultimo.clientWidth + 1), th: ultimo ? ultimo.textContent.trim() : "" };
    }));
    eq(`${vp.width} · ${modo}: hay tablas para medir`, tablas.length > 0, true);
    eq(`${vp.width} · ${modo}: ninguna tabla es más ancha que su tarjeta (sin barra lateral)`, tablas.map(x => x.desborda), tablas.map(() => false));
    eq(`${vp.width} · ${modo}: el último encabezado («Diferencia») se ve entero`, tablas.map(x => x.ultimoEntero), tablas.map(() => true));
  }
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
