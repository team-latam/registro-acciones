/* ======================================================================
   «Algo no anda» y los errores anotados solos (13/10/2026, propuesta 8-C)

   - Un botón en el menú del avatar (también para un observador): la persona
     cuenta qué pasó, con lo técnico si quiere, y queda en la base a su nombre.
   - La app anota sola los errores que le saltan, y NUNCA lo que sea de
     alguien: sin lo que va entre comillas, sin correos ni direcciones web.
     Cada error se anota una vez por sesión y como mucho cinco; los ruidos
     que no son de la app (otro script, la red caída) no cuentan.
   - Administración → Problemas: un admin lee, marca (visto, resuelto,
     reabrir) y borra; los nuevos se cuentan en el menú.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE, irAdmin, admin, hace } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const OBS = "obs@team-latam.com";
const ANA = PERS[1];
const datos = (extra = {}) => {
  const base = BASE();
  base.members = base.members.concat([{ email: OBS, name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]);
  base.problemas = [];
  return Object.assign(base, extra);
};
const filas = p => p.evaluate(() => window.__sb.tablas.problemas || []);
const hasta = async (p, f, ...a) => { for(let i = 0; i < 40; i++){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };
const abrirMenu = async p => { await p.click('[data-action="toggle-user-menu"]'); await p.waitForSelector(".user-menu"); };

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };

/* ---- «Algo no anda»: el botón y la ventana ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  await abrirMenu(p);
  eq("el menú del avatar tiene «Algo no anda»", await p.$$eval('.user-menu [data-action="problema-abrir"]', l => l.map(e => e.textContent.trim())), ["🛟 Algo no anda"]);
  await p.click('.user-menu [data-action="problema-abrir"]');
  await p.waitForSelector("#problemaOverlay:not([hidden]) #problemaTexto");
  eq("se abre una ventana accesible, con el foco en lo que hay que escribir", await p.evaluate(() => [document.querySelector("#problemaOverlay .modal").getAttribute("role"), document.querySelector("#problemaOverlay .modal").getAttribute("aria-modal"), document.activeElement.id]), ["dialog", "true", "problemaTexto"]);
  eq("los datos técnicos vienen prendidos, y se explica qué son", await p.evaluate(() => [document.getElementById("problemaTecnico").checked, /Nunca lo que escribiste/.test(document.getElementById("problemaBody").textContent)]), [true, true]);
  await p.click('[data-action="problema-enviar"]');
  eq("sin escribir nada, pide que cuente qué pasó y no manda nada", [await p.$eval("#problemaBody .form-error", e => e.textContent.trim()), (await filas(p)).length], ["Escribí qué pasó, aunque sea en una línea.", 0]);
  await p.fill("#problemaTexto", "Al tocar Reportes se queda en blanco");
  await p.click('[data-action="problema-enviar"]');
  eq("al enviar queda en la base: a su nombre, la pantalla en que estaba y lo técnico", await hasta(p, () => { const x = (window.__sb.tablas.problemas || [])[0]; return !!x && x.origen === "persona" && x.autor === "ana@team-latam.com" && x.nombre === "Ana Pérez" && x.pantalla === "feed" && x.mensaje === "Al tocar Reportes se queda en blanco" && x.estado === "nuevo" && !!x.tecnico && !!x.tecnico.navegador && /^\d+x\d+$/.test(x.tecnico.pantalla) && x.tecnico.idioma === "es" && Array.isArray(x.tecnico.errores); }), true);
  eq("y la ventana dice «Listo, gracias»", await p.$eval("#problemaTitle", e => e.textContent.trim()), "✅ Listo, gracias");
  await p.click('#problemaBody [data-action="problema-cerrar"]');
  eq("al cerrar, la ventana se va y el foco vuelve al avatar", await p.evaluate(() => [document.getElementById("problemaOverlay").hidden, document.activeElement.classList.contains("avatar-btn")]), [true, true]);

  // Sin los datos técnicos: sin eso.
  await abrirMenu(p); await p.click('.user-menu [data-action="problema-abrir"]'); await p.waitForSelector("#problemaOverlay:not([hidden]) #problemaTexto");
  await p.fill("#problemaTexto", "Otra cosa"); await p.click("#problemaTecnico + .pref-slider"); await p.click('[data-action="problema-enviar"]');
  eq("con la llave apagada, viaja sin lo técnico", await hasta(p, () => { const x = (window.__sb.tablas.problemas || [])[1]; return !!x && x.mensaje === "Otra cosa" && x.tecnico === null; }), true);
  await p.keyboard.press("Escape");
  eq("Escape cierra la ventana", await hasta(p, () => document.getElementById("problemaOverlay").hidden), true);
  await p.close();
}
// Un observador también puede avisar.
{
  const { p } = await entrar(b, OBS, "Olga Observa", { viewport: vp, lang: "es", base: datos() });
  await abrirMenu(p);
  eq("un observador también ve «Algo no anda»", await p.$$('.user-menu [data-action="problema-abrir"]').then(l => l.length), 1);
  await p.close();
}

/* ---- Los errores que la app anota sola ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  const lanzar = msg => p.evaluate(m => setTimeout(() => { throw new Error(m); }, 0), msg);
  await lanzar('Unexpected token "hola mundo secreto" para ana@x.com en https://x.y/z?clave=1 (reading \'title\')');
  await p.waitForTimeout(500);
  let f = await filas(p);
  eq("un error de la app se anota solo, agrupado por su huella", [f.length, f[0] && f[0].origen, f[0] && f[0].veces, !!(f[0] && f[0].huella), f[0] && f[0].pantalla], [1, "automatico", 1, true, "feed"]);
  eq("…sin lo que va entre comillas (salvo un nombre de código), ni el correo ni la dirección", [/hola mundo secreto/.test(f[0].mensaje), /ana@x\.com/.test(f[0].mensaje), /https?:/.test(f[0].mensaje), /reading 'title'/.test(f[0].mensaje)], [false, false, false, true]);
  eq("…y trae lo técnico, con sus propios errores recientes ya limpios", [!!f[0].tecnico.navegador, (f[0].tecnico.errores || []).length >= 1, JSON.stringify(f[0].tecnico).includes("hola mundo secreto")], [true, true, false]);
  await lanzar('Unexpected token "hola mundo secreto" para ana@x.com en https://x.y/z?clave=1 (reading \'title\')');
  await p.waitForTimeout(400);
  eq("el mismo error en la misma sesión no se manda otra vez", (await filas(p)).length, 1);

  // Los ruidos que no son de la app.
  await lanzar("Script error.");
  await lanzar("ResizeObserver loop completed with undelivered notifications.");
  await p.evaluate(() => { Promise.reject(new TypeError("Failed to fetch")); });
  await p.waitForTimeout(500);
  eq("otro script, el redibujado del navegador y la red caída no son errores nuestros", (await filas(p)).length, 1);
  // Una promesa rechazada sin atajo sí.
  await p.evaluate(() => { Promise.reject(new Error("Falló la cuenta de los meses")); });
  await p.waitForTimeout(500);
  eq("una promesa rechazada sin atajo se anota", (await filas(p)).length, 2);
  // Tope: como mucho cinco por sesión.
  for(let i = 0; i < 8; i++) await lanzar("Error distinto número " + i);
  await p.waitForTimeout(800);
  eq("como mucho cinco por sesión", (await filas(p)).length, 5);
  await p.close();
}
// Sin sesión aprobada no se anota nada (la base lo rechazaría igual).
{
  const { p } = await entrar(b, "afuera@x.com", "Alguien de afuera", { viewport: vp, lang: "es", base: datos() });
  await p.evaluate(() => setTimeout(() => { throw new Error("Falla de alguien de afuera"); }, 0));
  await p.waitForTimeout(500);
  eq("alguien sin aprobar no anota errores", (await filas(p)).length, 0);
  await p.close();
}

/* ---- Administración → Problemas ---- */
{
  const base = datos();
  const ahora = hace(0.1);
  base.problemas = [
    { id: "a1", creado: hace(2), ultimo: hace(1), origen: "persona", autor: ANA.email, nombre: "Ana Pérez", pantalla: "reportes", mensaje: "Reportes en blanco", estado: "nuevo", huella: null, veces: 1, personas: [ANA.email],
      tecnico: { navegador: "iPhone Safari", pantalla: "390x844", tactil: true, idioma: "es", errores: [{ t: "Cannot read properties of undefined (reading 'x')", v: "reportes", el: ahora }] } },
    { id: "a2", creado: hace(5), ultimo: hace(4), origen: "persona", autor: PERS[2].email, nombre: "Diego Martínez", pantalla: "feed", mensaje: "No sube la foto", estado: "visto", huella: null, veces: 1, personas: [PERS[2].email], tecnico: null },
    { id: "a3", creado: hace(9), ultimo: hace(3), origen: "automatico", autor: ANA.email, nombre: null, pantalla: "reportes", mensaje: "Cannot read properties of undefined (reading 'x') (123:4)", estado: "nuevo", huella: "h1", veces: 7, personas: [ANA.email, PERS[2].email, PERS[3].email], tecnico: { navegador: "iPhone Safari", pantalla: "390x844" } },
    { id: "a4", creado: hace(30), ultimo: hace(20), origen: "persona", autor: ANA.email, nombre: "Ana Pérez", pantalla: "feed", mensaje: "Ya arreglado", estado: "resuelto", huella: null, veces: 1, personas: [ANA.email], tecnico: null },
  ];
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: "es", base });
  await irAdmin(p);
  eq("en el menú de Administración, «Problemas» cuenta los nuevos (dos)", await p.$eval('.admin-menu [data-key="problemas"]', e => e.textContent.replace(/\s+/g, " ").trim()), "Problemas2");
  await admin(p, "preferencias", "problemas");
  await p.waitForSelector(".pb-lista");
  eq("avisos de personas: los dos abiertos, sin el resuelto, con quién y de qué pantalla", await p.$$eval(".pb-fila", l => l.map(e => [e.querySelector(".pb-tit").textContent.trim(), e.querySelector(".pb-estado").textContent.trim(), e.querySelector(".pb-sub").textContent.split(" · ").slice(0, 2).join(" · ")])),
    [["Reportes en blanco", "Nuevo", "Ana Pérez · Reportes"], ["No sube la foto", "Visto", "Diego Martínez · Inicio"]]);
  eq("lo técnico queda plegado y trae el navegador, la pantalla y los errores", await p.$eval('.pb-fila[data-id="a1"] .pb-det', e => [e.open, e.textContent.includes("iPhone Safari"), e.textContent.includes("390x844"), e.textContent.includes("reading 'x'")]), [false, true, true, true]);
  await p.click('[data-action="problemas-resueltos"]');
  eq("«Ver el resuelto» lo suma", await p.$$eval(".pb-fila", l => l.length), 3);
  await p.click('[data-action="problemas-resueltos"]');
  await p.click('[data-action="problemas-tab"][data-key="automatico"]');
  eq("errores anotados solos: cuántas veces y a cuántas personas, sin decir quiénes", await p.$$eval(".pb-fila", l => l.map(e => [e.querySelector(".pb-tit").textContent.trim(), /Ana|Diego|@/.test(e.querySelector(".pb-sub").textContent)])), [["Falló 7 veces · 3 personas", false]]);
  await p.click('[data-action="problemas-tab"][data-key="persona"]');
  await p.click('.pb-fila[data-id="a1"] [data-action="problema-estado"][data-estado="visto"]');
  eq("marcar visto lo guarda", await hasta(p, () => window.__sb.tablas.problemas.find(x => x.id === "a1").estado === "visto"), true);
  await p.click('.pb-fila[data-id="a1"] [data-action="problema-estado"][data-estado="resuelto"]');
  eq("marcar resuelto lo guarda y lo saca de la lista", [await hasta(p, () => window.__sb.tablas.problemas.find(x => x.id === "a1").estado === "resuelto"), await p.$$eval(".pb-fila", l => l.length)], [true, 1]);
  await p.click('[data-action="problemas-resueltos"]');
  await p.click('.pb-fila[data-id="a1"] [data-action="problema-estado"][data-estado="nuevo"]');
  eq("reabrir lo vuelve a «nuevo»", await hasta(p, () => window.__sb.tablas.problemas.find(x => x.id === "a1").estado === "nuevo"), true);
  await p.click('.pb-fila[data-id="a4"] [data-action="problema-borrar"]');
  await p.waitForSelector("#confirmOk", { state: "visible" }); await p.click("#confirmOk");
  eq("borrar pregunta antes y lo saca de la base", await hasta(p, () => !window.__sb.tablas.problemas.some(x => x.id === "a4")), true);
  eq("sin errores en la consola", errores, []);
  await p.close();
}
// Un integrante común no tiene Administración, ni «Problemas».
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  await abrirMenu(p);
  eq("un integrante no ve Administración", await p.$$('.user-menu [data-action="goto-view"][data-view="admin"]').then(l => l.length), 0);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
