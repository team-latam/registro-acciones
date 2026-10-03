import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "index.html","utf8");
const css = src.slice(src.indexOf("<style>") + 7, src.indexOf("</style>"));
// La fila del ex integrante, tal cual está en renderSolicitudesQueueSection
const ini = src.indexOf("  const formersHtml = formers.length ? `");
const fin = src.indexOf("</div>` : \"\";", ini) + "</div>` : \"\";".length;
if(ini < 0) throw new Error("no se encontró el bloque de ex integrantes");
const bloque = src.slice(ini, fin);
// La rama nueva del dispatcher
const a1 = src.indexOf('    "delete-former-member": async (el, e, action, postId) => {');
const a2 = src.indexOf('    "revoke-access": async (el, e, action, postId) => {');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${css}
body{ padding:20px; margin:0; }
</style></head><body>
<div id="box"></div>
<script>
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function t(es,en,pt,he,vars){ let o=es; if(vars) for(const k in vars) o=o.split("{"+k+"}").join(String(vars[k])); return o; }
function fmtDateTime(v){ return v ? "1 ene 2026" : ""; }
function tsToMillis(v){ return Number(v) || 0; }
const savingRoster = new Set();
const state = { formerMembers: [], posts: [] };
window.__borrados = [];
window.__confirmado = true;
window.__alertas = [];
async function appConfirm(msg, opts){ window.__ultimoConfirm = msg; window.__ultimoOpts = opts; return window.__confirmado; }
async function appAlert(msg){ window.__alertas.push(msg); }
async function withRosterGuard(email, fn){ savingRoster.add(email); try{ await fn(); } finally { savingRoster.delete(email); render(); } }
window.__falla = false;
// El borrado ya no llama a Firestore directo: pasa por la capa de datos.
// El harness le pone su propia implementación, que es exactamente lo que
// va a hacer Supabase el día que le toque.
window.__borradosStore = [];
const store = {
  formerMembers: {
    async remove(email){
      if(window.__falla) throw new Error("permiso denegado");
      window.__borradosStore.push(email);
    },
  },
};
const CLICK_ACTIONS = {
${src.slice(a1, a2)}};

function render(){
  const formers = state.formerMembers.slice().sort((a,b)=> tsToMillis(b.revokedAt) - tsToMillis(a.revokedAt));
  ${bloque}
  document.getElementById("box").innerHTML = formersHtml;
}
window.render = render;
window.setFormers = (f, posts) => { state.formerMembers = f; state.posts = posts || []; render(); };
document.addEventListener("click", async e=>{
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const h = CLICK_ACTIONS[el.dataset.action];
  if(h) await h(el, e, el.dataset.action, el.dataset.postId);
});
render();
</script></body></html>`;
fs.writeFileSync("ex.html", html);
console.log("ex.html listo");
