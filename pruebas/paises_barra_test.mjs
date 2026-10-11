/* ======================================================================
   La barra de Países: «Lista · Mapa», «📇 Agenda» y las zonas, parejos
   (10/10/2026, captura del usuario)

   Medían 40, 34 y 31 px de alto y no se veían parejos. Ahora los cinco
   (el interruptor, la Agenda y los tres chips de zona) miden lo mismo, en
   la compu, en el celular (pantalla táctil) y con letra grande. Lo de
   adentro del interruptor no cambia: su píldora activa sigue en 32.
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
const RUTA = process.env.INDEX || RAIZ + "index.html";
const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js";
const FALSO_UMD = () => FALSO.replace("export function createClient", "function createClient") + "\nvar supabase = { createClient };";
const ADMIN = "benny@team-latam.com";
const BASE = () => ({
  members: [{ email: ADMIN, name: "Benny", nickname: "benny", role: "admin", approved_at: "2025-01-10T12:00:00Z" }],
  posts: [], replies: [], access_requests: [], former_members: [], audit_log: [], app_config: [], user_prefs: [],
  agenda_listas: [], instituciones: [], personas: [], contactos: [],
});

const b = await chromium.launch();
async function medir(viewport, { tactil = false, letra = "" } = {}){
  const p = await b.newPage({ viewport, ...(tactil ? { hasTouch: true, isMobile: true } : {}) });
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.route(/^https?:\/\//, ruta => {
    const u = ruta.request().url();
    if(u === CDN) return ruta.fulfill({ contentType: "application/javascript", body: FALSO_UMD() });
    if(u.includes("/functions/v1/")) return ruta.fulfill({ contentType: "application/json", body: JSON.stringify({ enviado: false, estado: 200, cuerpo: { items: [] } }) });
    return ruta.abort();
  });
  await p.addInitScript(([base, sesion]) => {
    window.__sb = { tablas: base, sesion, oyentes: [], rpc: [], escrituras: [], subidas: [], borradas: [], logins: [], canales: 0 };
    window.__pruebasSinIntegridad = true;
  }, [BASE(), { user: { id: "uuid-" + ADMIN, email: ADMIN, user_metadata: { full_name: "Benny" } } }]);
  await p.goto("file://" + RUTA);
  await p.waitForSelector('[data-action="toggle-user-menu"]', { timeout: 8000 });
  // En el celular las solapas están abajo (y «Países» detrás de «Más»).
  await p.evaluate(() => { const v = "paises", b = document.querySelector(`nav.tabs button[data-view="${v}"]`);
    if(b && b.offsetParent) return b.click();
    const m = document.querySelector(`.bn-item[data-view="${v}"]`); if(m && m.offsetParent) return m.click();
    document.querySelector('.bn-item[data-action="toggle-more-menu"]')?.click();
    setTimeout(() => document.querySelector(`.bn-sheet-item[data-view="${v}"]`)?.click(), 250); });
  await p.waitForSelector(".paises-agenda", { timeout: 8000 });
  if(letra) await p.addStyleTag({ content: `html{ font-size:${letra} }` });
  await p.waitForTimeout(200);
  const m = await p.evaluate(() => {
    const h = e => Math.round(e.getBoundingClientRect().height * 10) / 10;
    const tb = document.querySelector(".paises-toolbar");
    return { piezas: [h(tb.querySelector(".subview-toggle")), h(tb.querySelector(".paises-agenda")), ...[...tb.querySelectorAll(".chip-toggle")].map(h)],
      interior: h(tb.querySelector(".subview-toggle button.active")), cantidad: tb.querySelectorAll(".chip-toggle").length };
  });
  await p.close();
  return { ...m, errores };
}
const parejos = l => Math.max(...l) - Math.min(...l) <= 0.5;

for(const [nombre, vp, op] of [["compu", { width: 1280, height: 800 }, {}], ["celular táctil", { width: 390, height: 800 }, { tactil: true }], ["pantalla angosta", { width: 320, height: 700 }, { tactil: true }]]){
  const m = await medir(vp, op);
  eq(`${nombre}: el interruptor, la Agenda y las 3 zonas miden lo mismo (${m.piezas.join(" · ")})`, [m.cantidad, parejos(m.piezas)], [3, true]);
  eq(`${nombre}: ni muy chicos (≥ 36 px)`, Math.min(...m.piezas) >= 36, true);
  eq(`${nombre}: la píldora de Lista/Mapa por dentro sigue en 32`, m.interior, 32);
  eq(`${nombre}: sin errores`, m.errores, []);
}

await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
