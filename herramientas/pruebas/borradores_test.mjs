/* ======================================================================
   Lo que se está escribiendo sobrevive a una recarga (auditoría del 20/11/2026, Y9)

   En el celular el navegador recarga la página solo al volver de otra aplicación, y un texto a
   medio escribir (una rutina, el título de un evento, una respuesta) se perdía: 3 de 3. Ahora el
   texto se guarda en el aparato mientras se escribe, vuelve al recargar, y se borra al publicar
   y al cerrar sesión. Un evento que se está EDITANDO no se guarda (ya existe en la base).

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const b = await abrirNavegador();
const abrir = async () => { const r = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: 844 } }); await r.p.waitForTimeout(500); return r; };
const guardado = p => p.evaluate(() => { try{ return JSON.parse(localStorage.getItem("ra_borradores_v1") || "null"); }catch(e){ return "ilegible"; } });
const abrirEvento = async p => { await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(500); };

// 1) Una rutina a medio escribir.
{ const { p } = await abrir();
  await p.fill("#rutinaContent", "Llamado largo con la comisión: quedaron en mandar el presupuesto el lunes");
  eq("la rutina se guarda mientras se escribe", (await guardado(p) || {}).rutina, "Llamado largo con la comisión: quedaron en mandar el presupuesto el lunes");
  await p.reload(); await p.waitForTimeout(1200);
  eq("al recargar, la rutina vuelve", await p.$eval("#rutinaContent", e => e.value), "Llamado largo con la comisión: quedaron en mandar el presupuesto el lunes");
  // Publicarla borra el borrador.
  await p.click('[data-action="submit-rutina"]'); await p.waitForTimeout(1200);
  eq("publicada, ya no queda guardada", (await guardado(p)) || {}, {});
  await p.reload(); await p.waitForTimeout(1200);
  eq("y al recargar el campo está vacío", await p.$eval("#rutinaContent", e => e.value), "");
  await p.close(); }
// 2) Un evento nuevo a medio escribir (título y comentarios).
{ const { p } = await abrir();
  await abrirEvento(p);
  await p.fill("#cTitle", "Visita a Salta con 5 instituciones"); await p.fill("#cContent", "Llevar el plan impreso");
  const g = await guardado(p) || {};
  eq("el título y los comentarios del evento se guardan", [g["evento:titulo"], g["evento:contenido"]], ["Visita a Salta con 5 instituciones", "Llevar el plan impreso"]);
  await p.reload(); await p.waitForTimeout(1200);
  await abrirEvento(p);
  eq("al recargar y abrir «Nuevo evento», vuelven", await p.evaluate(() => [document.getElementById("cTitle").value, document.getElementById("cContent").value]), ["Visita a Salta con 5 instituciones", "Llevar el plan impreso"]);
  await p.close(); }
// 3) Una respuesta a medio escribir: vuelve con su formulario abierto.
{ const { p } = await abrir();
  await p.evaluate(() => { const x = document.querySelector('.post[data-post-id="p1"] [data-action="toggle-reply"]'); x && x.click(); }); await p.waitForTimeout(400);
  const ta = '.post[data-post-id="p1"] textarea';
  await p.fill(ta, "Me sumo a la charla de marzo");
  eq("la respuesta se guarda por posteo", (await guardado(p) || {})["respuesta:p1"], "Me sumo a la charla de marzo");
  await p.reload(); await p.waitForTimeout(1200);
  eq("al recargar, el formulario de esa respuesta está abierto y con su texto", await p.evaluate(() => { const t = document.querySelector('.post[data-post-id="p1"] textarea'); return t ? t.value : null; }), "Me sumo a la charla de marzo");
  await p.close(); }
// 4) Editar un evento que ya existe NO guarda borrador.
{ const { p } = await abrir();
  await click(p, '.post[data-post-id="p5"] [data-action="toggle-post-menu"]'); await click(p, '.post[data-post-id="p5"] [data-action="edit-post"]'); await p.waitForTimeout(500);
  await p.fill("#cTitle", "Otro título distinto");
  eq("un evento que se edita no se guarda como borrador", Object.keys(await guardado(p) || {}).filter(k => k.startsWith("evento:")), []);
  await p.close(); }
// 5) Cerrar sesión borra todo: lo escrito no le queda a la persona siguiente.
{ const { p } = await abrir();
  await p.fill("#rutinaContent", "Algo que no es para la persona siguiente");
  ok("hay algo guardado antes de cerrar sesión", Object.keys(await guardado(p) || {}).length > 0);
  await p.evaluate(() => window.__sb.oyentes.forEach(f => f("SIGNED_OUT", null))); await p.waitForTimeout(800);
  eq("al cerrar sesión no queda nada guardado", await guardado(p), null);
  await p.close(); }
// 6) Sin lugar donde guardar (localStorage roto), todo sigue andando.
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { viewport: { width: 390, height: 844 }, iniciar: `Storage.prototype.setItem = function(){ throw new Error("lleno"); };` });
  await p.waitForTimeout(500);
  await p.fill("#rutinaContent", "Esto no se puede guardar, y no pasa nada");
  eq("con el almacenamiento lleno, se puede seguir escribiendo", await p.$eval("#rutinaContent", e => e.value), "Esto no se puede guardar, y no pasa nada");
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
