/* ======================================================================
   El botón «Atrás» no saca de la app (auditoría del 20/11/2026, Y8)

   La app no usaba el historial del navegador: de la ficha de un país, «Atrás» (el gesto más
   natural en un teléfono) sacaba de la página en vez de volver a Países. Ahora:
   - cada cambio de pantalla (la solapa, la ficha de un país) suma una entrada, y «Atrás» vuelve;
   - una ventana abierta suma otra, y «Atrás» la cierra (como Escape);
   - cerrar una ventana con un botón no deja una entrada de más;
   - desde la primera pantalla, «Atrás» sale de la página, como en cualquier sitio.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await abrirNavegador();
// Qué se ve: si la página sigue siendo la app (la marca __adentro se pone a mano y se pierde si «Atrás» saca de la página), la solapa
// activa y el título de la pantalla.
const vista = p => p.evaluate(() => ({ adentro: window.__adentro === true,
  activa: (document.querySelector("nav.tabs button.active, .bn-item.active") || {}).dataset?.view || null,
  titulo: (document.querySelector("#viewRoot h2, #viewRoot h1") || {}).innerText || null }));
const atras = async p => { await p.goBack({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); };

// 1) Solapa → ficha de un país → Atrás → Países → Atrás → Inicio → Atrás → sale.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(500); await p.evaluate(() => { window.__adentro = true; });
  await tab(p, "paises"); await p.waitForTimeout(300);
  await p.evaluate(() => { const x = document.querySelector('[data-action="drill-country"]'); x && x.click(); }); await p.waitForTimeout(500);
  const enFicha = await vista(p);
  eq("en la ficha de un país se ve el nombre del país", enFicha.titulo, "Argentina");
  await atras(p);
  const v1 = await vista(p);
  eq("«Atrás» desde la ficha del país sigue adentro de la app", v1.adentro, true);
  eq("y vuelve a Países (la lista de países, no la ficha)", [v1.activa, v1.titulo === "Argentina"], ["paises", false]);
  await atras(p);
  const v2 = await vista(p);
  eq("«Atrás» desde Países vuelve al Inicio, adentro de la app", [v2.adentro, v2.activa], [true, "feed"]);
  await atras(p);
  eq("«Atrás» desde el Inicio sale de la página (como en cualquier sitio)", (await p.evaluate(() => window.__adentro === true).catch(() => false)), false);
  await p.close(); }
// 2) Una solapa tras otra: Atrás las recorre al revés.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(500); await p.evaluate(() => { window.__adentro = true; });
  await tab(p, "calendario"); await tab(p, "reportes"); await p.waitForTimeout(300);
  await atras(p); eq("de Reportes, «Atrás» va a Calendario", (await vista(p)).activa, "calendario");
  await atras(p); eq("y de Calendario, a Inicio", (await vista(p)).activa, "feed");
  await p.close(); }
// 3) Una ventana abierta: «Atrás» la cierra y no sale de la app ni cambia de pantalla.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(500); await p.evaluate(() => { window.__adentro = true; });
  await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(600);
  eq("la ventana «Nuevo evento» está abierta", await p.evaluate(() => !!document.querySelector("#postForm").offsetParent), true);
  await atras(p);
  eq("«Atrás» cierra la ventana", await p.evaluate(() => !document.querySelector("#postForm").offsetParent), true);
  const v = await vista(p);
  eq("y sigue en la app, en la misma pantalla", [v.adentro, v.activa], [true, "feed"]);
  await p.close(); }
// 4) Cerrar la ventana con Escape no deja una entrada de más: un «Atrás» desde el Inicio sale.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 390, height: 844 } });
  await p.waitForTimeout(500); await p.evaluate(() => { window.__adentro = true; });
  await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(600);
  await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  eq("con Escape la ventana se cierra", await p.evaluate(() => !document.querySelector("#postForm").offsetParent), true);
  await atras(p);
  eq("y un «Atrás» desde el Inicio sale de la página (no queda una entrada de la ventana)", (await p.evaluate(() => window.__adentro === true).catch(() => false)), false);
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
