/* ======================================================================
   Lo que se toca en el celular tiene el tamaño de un dedo (auditoría del 20/11/2026, Z2)

   Ninguna prueba medía el tamaño de lo que se toca. En el Inicio del celular, «Me gusta» medía
   19×36 y «Responder» 17×36 (uno al lado del otro en cada tarjeta), el «⋯» 40×30, las filas de
   Reportes que se tocan 15 de alto y las flechas del Calendario 34×32. WCAG 2.2 (2.5.8) pide 24×24
   como piso y 44 es lo recomendado. Ahora el área de toque crece con relleno (el dibujo no cambia):
   - lo principal de cada actividad («Me gusta», «Responder», «⋯», «ver quién dio Me gusta»): 44×44;
   - lo secundario (documentos, «ver completo», «+ lugar», las filas de Reportes): 32 de alto, y los nombres de los
     participantes («👥 Diego Martínez»), 24;
   - las flechas del Calendario: 40×40.
   En la compu no cambia nada (la regla es solo para el celular).

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const b = await abrirNavegador();
// Las medidas (ancho, alto) de cada control a la vista que cumple el selector.
const medidas = (p, sel) => p.$$eval(sel, es => es.map(e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return (r.width && r.height && cs.visibility !== "hidden" && cs.display !== "none") ? [Math.round(r.width), Math.round(r.height)] : null; }).filter(Boolean));
const chequear = async (p, que, sel, minAncho, minAlto, { obligatorio = true } = {}) => {
  const m = await medidas(p, sel);
  if(!m.length){ ok(`${que}: hay controles para medir`, !obligatorio); return; }
  const chicos = m.filter(([w, h]) => w < minAncho || h < minAlto);
  ok(`${que}: ${m.length} controles, ninguno menor de ${minAncho}×${minAlto}`, chicos.length === 0, `los más chicos: ${chicos.slice(0, 4).map(x => x.join("×")).join(", ")}`);
};

// 1) Celular: el Inicio.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(600);
  await chequear(p, "«Me gusta»", 'button[data-action="toggle-like"]', 44, 44);
  await chequear(p, "«Responder»", 'button[data-action="toggle-reply"]', 44, 44);
  await chequear(p, "«⋯» de cada actividad", ".post-menu-btn", 44, 44);
  await chequear(p, "«ver quién dio Me gusta»", 'button[data-action="ver-me-gusta"]', 44, 44, { obligatorio: false });
  await chequear(p, "los nombres de los participantes", '.post-quien [data-action="show-user-profile"]', 24, 24);
  await chequear(p, "los documentos de una actividad", 'button[data-action="toggle-docs"]', 32, 32, { obligatorio: false });
  // 2) Reportes: las filas que se tocan para ver esas actividades.
  await tab(p, "reportes"); await p.waitForTimeout(500);
  await chequear(p, "las filas de Reportes", ".rep-fila-ir", 32, 32);
  // 3) Calendario: las flechas.
  await tab(p, "calendario"); await p.waitForTimeout(500);
  await chequear(p, "las flechas del Calendario", ".cal-arrow", 40, 40);
  await p.close(); }
// 4) En la compu no se cambió nada: «Me gusta» sigue siendo el botón compacto de siempre (la regla es solo del celular).
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  await p.waitForTimeout(600);
  const m = await medidas(p, 'button[data-action="toggle-like"]');
  ok("compu: «Me gusta» sigue compacto (menos de 44 de alto)", m.length > 0 && m.every(([, h]) => h < 44), JSON.stringify(m.slice(0, 3)));
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
