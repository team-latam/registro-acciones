/* ======================================================================
   El aviso al administrador (docs/AUDITORIA.md, I10)

   La pantalla de espera decía «Le avisamos al administrador ✓» sin que
   saliera ningún aviso. Ahora la app le pide a la función `avisar` de
   Supabase que mande el correo, y el ✓ aparece solo si salió. Con la app
   de verdad y el Supabase de mentira de app_dom_test.mjs.
   ====================================================================== */
import { chromium } from "playwright";
import { fileURLToPath as __aRuta } from "node:url";
import fs from "node:fs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "pruebas/app_dom_test.mjs", "utf8");
const FALSO = src.slice(src.indexOf("const FALSO = `") + "const FALSO = `".length, src.indexOf("}`;\n\nconst ADMIN") + 1);
const PAGINA = "file://" + (process.env.INDEX || RAIZ + "index.html");
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
const BASE = () => ({ members: [], posts: [], replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [] });

const b = await chromium.launch();
async function espera(funcion){
  const p = await b.newPage();
  const pedidos = [], errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const req = ruta.request(), u = req.url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO });
    if(u.includes("/functions/v1/avisar")){
      pedidos.push({ auth: req.headers()["authorization"] });
      return funcion ? ruta.fulfill({ status: funcion.estado, contentType: "application/json", body: JSON.stringify(funcion.cuerpo) }) : ruta.abort();
    }
    return ruta.abort();
  });
  await p.addInitScript(base => {
    window.__sb = { tablas: base, sesion: { user: { id: "uuid-pedro", email: "pedro@x.com", user_metadata: { full_name: "Pedro Gómez" } } },
                    oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
  }, BASE());
  await p.goto(PAGINA);
  await p.waitForSelector(".gate-espera", { timeout: 8000 });
  await p.waitForTimeout(800);
  const pasos = await p.$$eval(".gate-espera .gate-paso", ls => ls.map(l => l.innerText.replace(/\s+/g, " ").trim()));
  return { p, pedidos, errores, pasos };
}

{
  const { p, pedidos, errores, pasos } = await espera({ estado: 200, cuerpo: { enviado: true } });
  eq("pide el aviso una sola vez, con la sesión de quien pidió entrar", [pedidos.length, pedidos[0] && pedidos[0].auth], [1, "Bearer sesion-de-mentira"]);
  eq("si el correo salió, dice que le avisamos (con ✓)", /^✓ Le avisamos al administrador/.test(pasos[1] || ""), true);
  eq("sin errores", errores, []);
  await p.close();
}
{
  const { p, pasos, errores } = await espera({ estado: 503, cuerpo: { error: "sin-configurar" } });
  eq("si no salió (Resend sin configurar), no promete ningún aviso",
     [/Le avisamos/.test(pasos.join(" ")), /^2 Tu pedido quedó anotado/.test(pasos[1] || "")], [false, true]);
  eq("sin errores", errores, []);
  await p.close();
}
{
  const { p, pasos } = await espera(null);
  eq("y si la función ni contesta, tampoco", /Le avisamos/.test(pasos.join(" ")), false);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
