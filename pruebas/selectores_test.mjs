/* ======================================================================
   Los selectores de la app: abrir, ver, elegir y cerrar (7/10/2026)

   Desde el 7/10/2026 la lista abierta de cada <select> se dibuja con la
   cara de la app (appearance: base-select, en Chrome y Edge). Esto abre
   CADA selector de cada pantalla, en compu (claro) y celular (oscuro), y
   comprueba que:
     - se abre con un toque, y no lo tapa nada (la barra de abajo, el +);
     - la lista abierta entra en la pantalla (la opción elegida, visible y
       sin nada encima);
     - el selector cerrado no se sale de la pantalla;
     - Escape lo cierra y el foco queda en él;
     - en los de Mis preferencias, elegir otra opción la cierra y se guarda.
   Pedido del usuario: «que no tengamos problemas con los objetos, tamaño,
   superposición, apertura y cierre de la ventana».
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click, cerrar, recorrerApp } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await abrirNavegador();
for(const [tam, ancho, alto, oscuro] of [["compu", 1280, 900, false], ["celular", 390, 844, true]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: ancho, height: alto }, dark: oscuro });
  eq(`${tam}: el navegador de las pruebas dibuja la lista con la cara de la app`, await p.evaluate(() => CSS.supports("appearance", "base-select")), true);
  const vistos = new Set(), problemas = [];
  let probados = 0, guardados = 0;

  async function revisar(p, pantalla){
    // Por su clave y no por una marca: cada elección redibuja la pantalla
    // y los selectores son elementos nuevos.
    const claveDe = "s => s.dataset.pref || s.id || s.className || s.getAttribute('aria-label') || '?'";
    const claves = await p.evaluate(f => { const clave = eval(f); return [...new Set([...document.querySelectorAll("select")]
      .filter(s => s.offsetParent && !s.disabled && s.options.length > 1).map(clave))]; }, claveDe);
    for(const clave of claves){
      if(vistos.has(clave)) continue;
      vistos.add(clave);
      const donde = `${pantalla} › ${clave}`;
      // Marca el primero visible con esa clave, cada vez que hace falta.
      const marcar = () => p.evaluate(([f, c]) => { const clave = eval(f);
        const s = [...document.querySelectorAll("select")].find(s => s.offsetParent && clave(s) === c);
        document.querySelectorAll("[data-prueba-sel]").forEach(x => x.removeAttribute("data-prueba-sel"));
        if(s) s.dataset.pruebaSel = "1"; return !!s; }, [claveDe, clave]);
      const sel = `[data-prueba-sel="1"]`;
      await marcar();
      const antes = await p.evaluate(sel => { const s = document.querySelector(sel); if(!s) return null;
        s.scrollIntoView({ block: "center", behavior: "instant" }); const r = s.getBoundingClientRect();
        const x = r.left + Math.min(r.width / 2, 40), y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
        return { x, y, tapado: !(e === s || s.contains(e)), por: e ? (String(e.className || "") || e.tagName) : `nada en ${Math.round(x)},${Math.round(y)} (pantalla ${innerWidth}x${innerHeight})`, fuera: r.left < -1 || r.right > innerWidth + 1, valor: s.value }; }, sel);
      if(!antes){ problemas.push(`${donde}: desapareció`); continue; }
      if(antes.fuera) problemas.push(`${donde}: cerrado, se sale de la pantalla`);
      if(antes.tapado){ problemas.push(`${donde}: lo tapa ${antes.por}`); continue; }
      await p.mouse.click(antes.x, antes.y);
      await p.waitForTimeout(200);
      const abierto = await p.evaluate(sel => { const s = document.querySelector(sel); if(!s) return null;
        const o = s.selectedOptions[0] || s.options[0], r = o.getBoundingClientRect();
        const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { open: s.matches(":open"), dentro: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height > 0,
                 visible: e === o || o.contains(e) }; }, sel);
      probados++;
      if(!abierto || !abierto.open){ problemas.push(`${donde}: no se abrió`); continue; }
      if(!abierto.dentro) problemas.push(`${donde}: la lista abierta no entra en la pantalla`);
      if(!abierto.visible) problemas.push(`${donde}: la opción elegida queda tapada`);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(150);
      const cerrado = await p.evaluate(sel => { const s = document.querySelector(sel); return s ? { open: s.matches(":open"), foco: document.activeElement === s } : null; }, sel);
      if(cerrado && cerrado.open) problemas.push(`${donde}: Escape no la cerró`);
      if(cerrado && !cerrado.foco) problemas.push(`${donde}: al cerrar, el foco no quedó en el selector`);
      // Mis preferencias: elegir otra opción la cierra y se guarda.
      if(await p.evaluate(sel => !!document.querySelector(sel)?.dataset.pref, sel)){
        await marcar();
        const otra = await p.evaluate(sel => { const s = document.querySelector(sel); s.scrollIntoView({ block: "center", behavior: "instant" }); const r = s.getBoundingClientRect();
          return { x: r.left + Math.min(r.width / 2, 40), y: r.top + r.height / 2 }; }, sel);
        await p.mouse.click(otra.x, otra.y);
        await p.waitForTimeout(200);
        const elegida = await p.evaluate(sel => { const s = document.querySelector(sel); const o = [...s.options].find(o => !o.selected && !o.disabled);
          const r = o.getBoundingClientRect(); return { valor: o.value, x: r.left + r.width / 2, y: r.top + r.height / 2, pref: s.dataset.pref }; }, sel);
        await p.mouse.click(elegida.x, elegida.y);
        await p.waitForTimeout(300);
        const guardado = await p.evaluate(([pref, valor]) => {
          const f = (window.__sb.tablas.user_prefs || []).find(x => x.email === "benny@team-latam.com");
          const s = document.querySelector(`select[data-pref="${pref}"]`);
          return { abierto: !!s && s.matches(":open"), guardado: !!f && String(f.prefs[pref]) === String(valor) }; }, [elegida.pref, elegida.valor]);
        if(guardado.abierto) problemas.push(`${donde}: al elegir, no se cerró`);
        if(!guardado.guardado) problemas.push(`${donde}: lo elegido no se guardó`);
        else guardados++;
      }
    }
  }

  await recorrerApp(p, revisar);
  // Lo que el recorrido no abre: las tres secciones de Mis preferencias, el
  // calendario chiquito de una fecha, y Administración → Correos.
  for(const k of ["calendario", "notificaciones", "capas"]){
    await p.evaluate(k => { const b = document.querySelector(`[data-action="config-section"][data-key="${k}"]`); b && b.click(); }, k);
    await p.waitForTimeout(300); await revisar(p, "Mis preferencias " + k);
  }
  await click(p, "#fabMain"); await click(p, '[data-action="new-evento"]'); await p.waitForTimeout(400);
  if(await click(p, '.date-trigger[data-action="date-open"]')){ await p.waitForTimeout(250); await revisar(p, "Calendario de una fecha"); }
  await cerrar(p); await cerrar(p);

  // El rol de una persona del equipo (Administración → Personas → su ficha).
  await click(p, '[data-action="toggle-user-menu"]');
  await p.evaluate(() => { const b = document.querySelector('.user-menu [data-action="goto-view"][data-view="admin"]'); b && b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('[data-action="admin-go"][data-view="solicitudes"]'); b && b.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('.lp-row[data-action="usuario-abrir"][data-email="ana@team-latam.com"]'); b && b.click(); });
  await p.waitForTimeout(300); await revisar(p, "Ficha de Ana");
  await cerrar(p);

  // Editar un evento ya no dice «Editás como … (el posteo original sigue
  // figurando de …)»: el usuario lo pidió sacar el 7/10/2026.
  await p.evaluate(() => { const b = document.querySelector('.tabs [data-view="feed"], .bn-item[data-view="feed"]'); b && b.click(); });
  await p.waitForTimeout(300);
  await click(p, '.post[data-post-id="p1"] [data-action="toggle-post-menu"]');
  await click(p, '.post[data-post-id="p1"] .post-menu [data-action="edit-post"], .post-menu [data-action="edit-post"]');
  await p.waitForTimeout(400);
  eq(`${tam}: editar un evento no muestra «Editás como…»`,
     await p.evaluate(() => { const f = document.getElementById("postForm"); return !!f && f.textContent.length > 0 && !/Editás como|sigue figurando/.test(f.textContent); }), true);
  await cerrar(p);

  eq(`${tam}: se probaron los selectores de toda la app`, probados >= 12, true);
  eq(`${tam}: también el rol de una persona`, vistos.has("role-select lp-sel"), true);
  eq(`${tam}: los de Mis preferencias guardan lo elegido`, guardados >= 5, true);
  eq(`${tam}: ningún problema al abrir, ver, elegir y cerrar`, problemas, []);
  eq(`${tam}: sin errores`, errores, []);
  console.log(`  (${tam}: ${probados} selectores probados, ${guardados} guardados: ${[...vistos].join(", ")})`);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
