/* ======================================================================
   Usar Toldot solo con el teclado, de punta a punta (24/11/2026, docs/AUDITORIA.md, H10)

   La auditoría recorrió la app como alguien que no usa el mouse. Lo que apareció, y esta prueba cuida:
   - el botón «+» (crear) estaba **después de toda la lista** en el HTML: 115 Tab para llegar (ahora está
     antes del contenido, a ~11);
   - sus acciones («Nueva actividad», «Nuevo evento») estaban invisibles pero con Tab (se paraba el foco en
     un botón que no se ve), y al abrir el menú con Enter el foco no entraba: había que adivinar un Shift+Tab;
   - cerrado el formulario de un evento que se abrió desde ese menú, el foco caía al <body>.
   Y que se pueda crear un evento y una actividad (rutina) de punta a punta, con solo Tab, escribir y Enter.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, extra) => eq(n + (c ? "" : "  " + (extra || "")), !!c, true);

const b = await abrirNavegador();
const quien = p => p.evaluate(() => { const a = document.activeElement; if(!a || a === document.body) return "BODY"; return a.id ? "#" + a.id : a.dataset.action ? "[" + a.dataset.action + "]" : a.tagName; });
const tab = async (p, n = 1, atras = false) => { for(let i = 0; i < n; i++) await p.keyboard.press(atras ? "Shift+Tab" : "Tab"); };
// Apretar Tab hasta que el foco cumpla algo (con tope): devuelve cuántos Tab hicieron falta, o -1.
const hasta = async (p, f, max = 25) => { for(let i = 1; i <= max; i++){ await p.keyboard.press("Tab"); if(f(await quien(p))) return i; } return -1; };
const posts = p => p.evaluate(() => (window.__sb.tablas.posts || []).length);
const ultimo = p => p.evaluate(() => { const l = window.__sb.tablas.posts || []; const x = l[l.length - 1]; return x ? { titulo: x.title, tipo: x.activity_type, contenido: x.content, lugares: x.scopes } : null; });

// ---------- 1. El botón «+» ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  const hasta1 = await hasta(p, q => q === "#fabMain", 40);
  ok(`el «+» se alcanza en pocos Tab desde que se abre la página (${hasta1}; eran 115)`, hasta1 > 0 && hasta1 <= 14, String(hasta1));
  eq("las acciones del «+», cerrado, ni se ven ni se alcanzan con Tab (visibility: hidden)", await p.$$eval("#fab .fab-action", l => l.map(e => getComputedStyle(e).visibility)), ["hidden", "hidden", "hidden"]);
  await tab(p);
  ok("cerrado, el Tab siguiente al «+» no cae en una acción invisible", !/new-rutina|new-evento|fab-gastos/.test(await quien(p)), await quien(p));
  await tab(p, 1, true);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  eq("Enter en el «+» lo abre", await p.$eval("#fabMain", e => e.getAttribute("aria-expanded")), "true");
  eq("…y el foco pasa a la primera acción («Nueva actividad»)", await quien(p), "[new-rutina]");
  await tab(p);
  eq("Tab sigue por la segunda («Nuevo evento»)", await quien(p), "[new-evento]");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  eq("Escape cierra el menú", await p.$eval("#fabMain", e => e.getAttribute("aria-expanded")), "false");
  eq("…y el foco vuelve al «+»", await quien(p), "#fabMain");
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  await tab(p, 4);
  await p.waitForTimeout(250);
  eq("saliendo del menú con Tab, se cierra solo", await p.$eval("#fabMain", e => e.getAttribute("aria-expanded")), "false");
  // El mouse sigue igual.
  await p.click("#fabMain"); await p.waitForTimeout(250);
  eq("con el mouse el «+» también abre el menú", await p.$eval("#fabMain", e => e.getAttribute("aria-expanded")), "true");
  await p.mouse.click(300, 400); await p.waitForTimeout(250);
  eq("…y un toque afuera lo cierra", await p.$eval("#fabMain", e => e.getAttribute("aria-expanded")), "false");
  eq("sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 2. Crear un evento, solo con el teclado ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  const antes = await posts(p);
  await p.focus("#fabMain"); await p.keyboard.press("Enter"); await tab(p); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  eq("«Nuevo evento»: el foco entra al formulario, en el título", await quien(p), "#cTitle");
  await p.keyboard.type("Reunión por teclado");
  // El Tab cicla adentro del formulario: después del último vuelve al primero, y Shift+Tab del primero va al último.
  const primero = "#cTitle", ciclo = [];
  for(let i = 0; i < 25; i++){ await tab(p); const q = await quien(p); ciclo.push(q); if(q === primero) break; }
  ok("Tab cicla adentro del formulario (vuelve al título sin salirse)", ciclo[ciclo.length - 1] === primero && ciclo.length >= 8, ciclo.join(" "));
  const ultimoDelCiclo = ciclo[ciclo.length - 2];
  await tab(p, 1, true);
  eq("…y Shift+Tab desde el título va al último", await quien(p), ultimoDelCiclo);
  await p.focus("#cTitle");
  ok("el lugar se alcanza con Tab", (await hasta(p, q => q === "#cPlaceQuery", 14)) > 0);
  await p.keyboard.type("mon"); await p.waitForTimeout(250);
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  ok("elegir el lugar con Enter lo suma", (await p.$$eval('[data-action="rm-scope-post"]', l => l.length)) === 1);
  ok("el botón de publicar se alcanza con Tab", (await hasta(p, q => q === "[submit-post]" || q === "BUTTON", 14)) > 0);
  const publicar = await p.evaluate(() => document.activeElement.innerText.trim());
  ok(`…y es «Publicar» (dice «${publicar}»)`, /Publicar/i.test(publicar), publicar);
  await p.keyboard.press("Enter"); await p.waitForTimeout(900);
  eq("Enter lo publica: hay una actividad más", await posts(p), antes + 1);
  const u = await ultimo(p);
  eq("…con el título y el lugar que se escribieron", [u.titulo, u.tipo, (u.lugares || []).map(x => x.city)], ["Reunión por teclado", "visita", ["Montevideo"]]);
  eq("la ventana se cierra", await p.$$eval("#postModalOverlay:not([hidden])", l => l.length), 0);
  eq("…y el foco no se pierde: vuelve al «+»", await quien(p), "#fabMain");
  eq("sin errores en la consola", errores, []);
  await p.close();
}

// ---------- 3. Cancelar un evento: Escape, y el foco vuelve ----------
{
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  await p.focus("#fabMain"); await p.keyboard.press("Enter"); await tab(p); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  eq("Escape en un formulario sin tocar lo cierra", await p.$$eval("#postModalOverlay:not([hidden])", l => l.length), 0);
  eq("…y el foco vuelve al «+»", await quien(p), "#fabMain");
  await p.keyboard.press("Enter"); await tab(p); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  await p.keyboard.type("Algo a medio escribir");
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  eq("con algo escrito, Escape pregunta antes de descartar", await p.$$eval("#confirmOverlay:not([hidden])", l => l.length), 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  eq("…y Escape de nuevo vuelve al formulario, sin descartar", [await p.$$eval("#confirmOverlay:not([hidden])", l => l.length), await p.$$eval("#postModalOverlay:not([hidden])", l => l.length)], [0, 1]);
  await p.close();
}

// ---------- 4. Crear una actividad (rutina), solo con el teclado ----------
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 } });
  const antes = await posts(p);
  await p.focus("#fabMain"); await p.keyboard.press("Enter"); await p.waitForTimeout(250); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  eq("«Nueva actividad»: el foco entra al cuadro de texto", await quien(p), "#rutinaContent");
  await p.keyboard.type("Hoy hablé con el equipo");
  ok("el lugar está a un Tab", (await hasta(p, q => q === "#rutinaPlaceQuery", 3)) === 1);
  await p.keyboard.type("mon"); await p.waitForTimeout(250); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  ok("elegir el lugar con Enter lo suma", (await p.$$eval('[data-action="rm-scope-rutina"]', l => l.length)) === 1);
  ok("Publicar se alcanza con Tab", (await hasta(p, q => q === "#rutinaPublish", 6)) > 0);
  await p.keyboard.press("Enter"); await p.waitForTimeout(900);
  eq("Enter la publica: hay una actividad más", await posts(p), antes + 1);
  const u = await ultimo(p);
  eq("…con el texto y el lugar que se escribieron", [u.contenido, (u.lugares || []).map(x => x.city)], ["Hoy hablé con el equipo", ["Montevideo"]]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
