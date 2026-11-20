/* ======================================================================
   «Ya podés entrar»: al aprobar un pedido de acceso sale un correo a quien lo pidió
   (auditoría del 20/11/2026, D26-A)

   Antes, quien pedía entrar se enteraba de que lo habían aprobado solo si volvía a mirar: nadie
   le avisaba (con poca gente, la persona que espera es justo la que más lo necesita). Ahora
   la app le pide a la función `avisar` el correo «acceso», por el correo de la persona, y la base
   decide si corresponde (supabase/29-aviso-de-acceso.sql).
   - Aprobar un pedido → se pide el aviso.
   - Dar acceso por adelantado → también.
   - Rechazar un pedido, o «aprobar» a alguien que ya estaba en el equipo → NO.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click, irAdmin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await abrirNavegador();
const pendientes = async p => { await irAdmin(p); await click(p, '.admin-menu [data-action="admin-go"][data-view="solicitudes"]'); await click(p, '[data-action="acceso-section"][data-key="pendientes"]'); await p.waitForTimeout(300); };
const avisosDe = p => { const l = []; p.on("request", r => { if(/\/functions\/v1\/avisar/.test(r.url()) && r.method() === "POST") l.push(JSON.parse(r.postData() || "{}")); }); return l; };

// 1) Aprobar un pedido.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  const avisos = avisosDe(p);
  await pendientes(p);
  await p.click('[data-action="approve-request"][data-email="nueva@gmail.com"]'); await p.waitForTimeout(1200);
  eq("aprobar el pedido de nueva@gmail.com la suma al equipo", await p.evaluate(() => (window.__sb.tablas.members || []).some(m => m.email === "nueva@gmail.com")), true);
  eq("…y le pide a la función de avisos el correo «acceso», por su dirección", avisos, [{ tipo: "acceso", id: "nueva@gmail.com" }]);
  await p.close(); }
// 2) Dar acceso por adelantado.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  const avisos = avisosDe(p);
  await pendientes(p);
  await p.fill("#preEmail", "Nuevo@x.com"); await p.fill("#preName", "Nuevo Integrante");
  await p.click('[data-action="preaprobar"]'); await p.waitForTimeout(1200);
  eq("dar acceso por adelantado a nuevo@x.com la suma al equipo", await p.evaluate(() => (window.__sb.tablas.members || []).some(m => m.email === "nuevo@x.com")), true);
  eq("…y también le avisa, con el correo en minúsculas", avisos, [{ tipo: "acceso", id: "nuevo@x.com" }]);
  await p.close(); }
// 3) Rechazar: no se avisa nada.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 } });
  const avisos = avisosDe(p);
  await pendientes(p);
  const rechazar = p.locator('[data-action="reject-request"][data-email="otra@team-latam.com"]:visible').first();
  eq("hay un botón a la vista para rechazar el otro pedido", await rechazar.count(), 1);
  await rechazar.click(); await p.waitForTimeout(800);
  const confirmar = await p.$("#confirmOk"); if(confirmar && await confirmar.isVisible()){ await confirmar.click(); await p.waitForTimeout(800); }
  eq("y el pedido quedó rechazado", await p.evaluate(() => (window.__sb.tablas.access_requests.find(r => r.email === "otra@team-latam.com") || {}).status), "rejected");
  eq("rechazar un pedido no manda ningún aviso", avisos, []);
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
