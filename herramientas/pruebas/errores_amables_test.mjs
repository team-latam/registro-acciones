/* ======================================================================
   Cuando algo falla, la app lo dice en palabras de la persona (auditoría del 28/10/2026, T5)

   Los errores mostraban lo que contesta la base, en inglés y sin explicar:
   «No se pudo publicar: Failed to fetch» (sin internet), «…new row violates
   row-level security policy for table "posts"» (falta un permiso); la carga
   inicial fallida decía «(Failed to fetch)» con el reloj de arena «Cargando…»
   todavía girando y sin botón para reintentar; y si se cortaba internet con la
   app abierta, no avisaba nada hasta que algo fallaba. Ahora:
   - los tres casos de siempre (sin conexión, sin permiso, sesión vencida) se
     dicen en las palabras de la persona, en los cuatro idiomas; cualquier otro
     error sigue mostrando lo que dijo la base;
   - la carga fallida ofrece «Reintentar» (y «Cerrar sesión») y deja de decir
     «Cargando…»;
   - al perderse la conexión aparece el aviso «Sin conexión…», y al volver, «Volvió
     la conexión».
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs), al que se
   le pide que falle (`fallo`, `mensajeFallo`, `falloLectura`).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const FRASES = {
  es: { red: "no hay conexión a internet", permiso: "tu cuenta no tiene permiso para hacerlo", sesion: "venció tu sesión: volvé a entrar" },
  en: { red: "there's no internet connection", permiso: "your account doesn't have permission to do this", sesion: "your session expired: sign in again" },
  pt: { red: "não há conexão com a internet", permiso: "sua conta não tem permissão para fazer isso", sesion: "sua sessão expirou: entre de novo" },
  he: { red: "אין חיבור לאינטרנט", permiso: "לחשבון שלך אין הרשאה לעשות זאת", sesion: "תוקף ההתחברות פג: היכנס/י שוב" },
};
const TECNICOS = /Failed to fetch|row-level security|JWT/i;

const publicarRutina = async (p, texto) => {
  await p.click(".quick-composer textarea"); await p.fill("#rutinaContent", texto);
  await p.click("#rutinaPublish"); await p.waitForTimeout(700);
  return p.evaluate(() => { const x = document.querySelector(".quick-composer .form-error"); return x ? x.textContent.trim() : null; });
};

const b = await abrirNavegador();
for(const lang of ["", "en", "pt", "he"]){
  const id = lang || "es", F = FRASES[id];
  // Sin permiso (lo que de verdad contesta la base cuando una regla lo impide)
  { const { p, errores } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { lang });
    await p.evaluate(() => { window.__sb.fallo = "42501"; });
    const msg = await publicarRutina(p, "Una rutina sin permiso");
    ok(`[${id}] sin permiso: lo dice con palabras de la persona`, !!msg && msg.includes(F.permiso), msg);
    ok(`[${id}] y no muestra lo técnico de la base`, !!msg && !TECNICOS.test(msg), msg);
    await p.close();
    // (la app deja en la consola el error de la base que provocó la prueba: es lo único que se acepta)
    eq(`[${id}] sin errores en la página`, errores.filter(x => !/row-level security/.test(x)), []); }
  // Sin conexión (lo que contesta el navegador cuando no hay red)
  { const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { lang });
    await p.evaluate(() => { window.__sb.fallo = "TypeError"; window.__sb.mensajeFallo = "TypeError: Failed to fetch"; });
    const msg = await publicarRutina(p, "Una rutina sin red");
    ok(`[${id}] sin conexión: lo dice con palabras de la persona`, !!msg && msg.includes(F.red), msg);
    ok(`[${id}] y no muestra «Failed to fetch»`, !!msg && !TECNICOS.test(msg), msg);
    await p.close(); }
  // Sesión vencida
  { const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { lang });
    await p.evaluate(() => { window.__sb.fallo = "PGRST301"; window.__sb.mensajeFallo = "JWT expired"; });
    const msg = await publicarRutina(p, "Una rutina con la sesión vencida");
    ok(`[${id}] sesión vencida: lo dice con palabras de la persona`, !!msg && msg.includes(F.sesion), msg);
    ok(`[${id}] y no muestra «JWT»`, !!msg && !TECNICOS.test(msg), msg);
    await p.close(); }
}

// Un error que no es de esos tres sigue mostrando lo que dijo la base (no se esconde nada).
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez");
  await p.evaluate(() => { window.__sb.fallo = "23514"; window.__sb.mensajeFallo = "el título es demasiado largo"; });
  const msg = await publicarRutina(p, "Una rutina que la base no acepta");
  eq("otro error: sigue diciendo lo que contestó la base", msg, "No se pudo publicar: el título es demasiado largo");
  await p.close(); }

// El «Me gusta» que falla: el aviso también va en palabras de la persona
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez");
  await p.evaluate(() => { window.__sb.falloRpc = true; });
  await p.evaluate(() => document.querySelector('.post [data-action="toggle-like"]').click()); await p.waitForTimeout(600);
  const t = await p.evaluate(() => { const o = document.getElementById("confirmOverlay"); return o && !o.hidden ? document.getElementById("confirmMessage").textContent : null; });
  ok("«Me gusta» rechazado: el cartel habla de permisos, no de la base", !!t && t.includes(FRASES.es.permiso) && !TECNICOS.test(t), t);
  await p.close(); }

// La carga inicial falla: sin «Cargando…» eterno, con salida
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez", { falla: "falloLectura" });
  await p.waitForTimeout(2500);
  const e = await p.evaluate(() => ({ texto: document.querySelector("#viewRoot").innerText.replace(/\s+/g, " "), reintentar: !!document.querySelector('#viewRoot [data-action="reload-page"]'), salir: !!document.querySelector('#viewRoot [data-action="sign-out"]'), reloj: !!document.querySelector("#viewRoot .auth-gate .big") && /⏳/.test(document.querySelector("#viewRoot .auth-gate .big").textContent) }));
  ok("carga fallida: el cartel dice que no hay conexión", e.texto.includes(FRASES.es.red), e.texto);
  ok("y no dice «Failed to fetch»", !TECNICOS.test(e.texto), e.texto);
  eq("hay «Reintentar» y «Cerrar sesión»", [e.reintentar, e.salir], [true, true]);
  eq("y ya no queda el reloj de arena girando", [e.reloj, /Cargando/.test(e.texto)], [false, false]);
  await p.close(); }

// Se corta internet con la app abierta
{ const { p } = await entrar(b, "ana@team-latam.com", "Ana Pérez");
  await p.context().setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event("offline"))); await p.waitForTimeout(400);
  const off = await p.evaluate(() => { const x = document.getElementById("calendarToast"); return { visible: !x.hidden, texto: x.textContent.replace(/\s+/g, " ").trim() }; });
  ok("sin conexión: aparece el aviso", off.visible && /Sin conexión/.test(off.texto), JSON.stringify(off));
  await p.context().setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event("online"))); await p.waitForTimeout(400);
  const on = await p.evaluate(() => { const x = document.getElementById("calendarToast"); return { visible: !x.hidden, texto: x.textContent.replace(/\s+/g, " ").trim() }; });
  ok("al volver la conexión, lo dice", on.visible && /Volvió la conexión/.test(on.texto), JSON.stringify(on));
  await p.close(); }

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
