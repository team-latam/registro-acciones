import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { hacerGrab } from "./grab.mjs";
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* El selector de fechas de una serie que se repite (occ-*): funciones,
   handlers y estilos sacados del index.html DE VERDAD en cada corrida.

   Antes esto se armaba con occ.css y dom_fns.js, dos copias guardadas a
   mediados de septiembre que nadie regeneraba. Cuando se mudaron las
   pruebas al repo coincidían todavía con el código real, función por
   función — pero eso era suerte: el día que cambiara una, la prueba iba a
   seguir pasando contra la versión vieja. */
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const grab = hacerGrab(src);
const css = src.match(/<style>([\s\S]*?)<\/style>/)[1];
const NOMBRES = ["RRULE_DOW","RRULE_MAX_STEPS","OCC_BACK_MONTHS","occView","occPopOpen","todayISO",
  "isoDate","addMonthsISO","addDaysISO","isoDow","rruleDateToISO","parseRecurrence","expandRecurrence",
  "recurrenceSkipDates","recurrenceLabel","postOccurrenceList","recurrenceMoves",
  "isISODate","occurrenceDateOf","nearestOccurrence","occurrenceOf","repliesForOccurrence","isRecurring",
  "closeOccPops","syncOccPopState","occDateLabel","renderOccurrencePicker","positionDatePop"];
const ACCIONES = ["occ-toggle","occ-pick","occ-skip","occ-unskip","occ-unmove","cal-open-holiday","holiday-new-event"];
// El cuerpo de cada handler, tal cual está en la tabla del despachador.
const cuerpo = n => {
  const m = src.match(new RegExp(`"${n}": async \\(el, e, action, postId\\) => \\{\\n([\\s\\S]*?)\\n  \\},\\n`));
  if(!m) throw new Error("no se encontró el handler " + n);
  return m[1];
};
let fns = NOMBRES.map(grab).join("\n")
  // "Hoy" fijo: si no, la prueba de cuál fecha queda elegida dependería del día.
  .replace(/function todayISO\(\)\{[\s\S]*?\n\}/, 'function todayISO(){ return "2026-09-15"; }');
fns += "\nconst CLICK_ACTIONS = {\n" +
  ACCIONES.map(n => `  "${n}": async (el, e, action, postId) => {\n${cuerpo(n)}\n  },`).join("\n") + "\n};\n";

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${css}
/* ---- Lo de abajo lo fija la prueba a propósito, encima del CSS real ---- */
:root{ --card:#fff; --border:#dcd8d0; --ink:#1c1a17; --text-muted:#8a8477; --surface-soft:#f1efe9;
  --surface-hover:#eae7df; --celeste-dark:#2b6f8f; --celeste-soft:#e3f0f5;
  --radius-md:12px; --shadow:0 8px 24px rgba(0,0,0,.15); }
body{ font-family:system-ui,sans-serif; background:#f6f5f2; padding:24px; margin:0; }
/* La tarjeta recorta lo que sobresale: es justo el caso que obliga al popup
   a ser position:fixed en vez de absolute. */
.card{ background:#fff; border:1px solid var(--border); border-radius:12px; padding:14px; overflow:hidden; max-width:520px; }
.post-date{ font-size:12px; color:var(--text-muted); }
</style></head><body>
<div class="card"><div class="post-meta"><span class="post-date" id="dateLine"></span></div></div>
<script>
const state = { repliesByPost: {}, posts: [] };
let PUEDE_EDITAR = true;
function canEditPost(){ return PUEDE_EDITAR; }
function getPostById(id){ return state.posts.find(p=>p.id===id) || null; }
window.__confirmado = true;
async function appConfirm(msg){ window.__ultimoConfirm = msg; return window.__confirmado; }
window.__escrituras = [];
async function setOccurrenceSkipped(postId, iso, skipped){ window.__escrituras.push(["skip", postId, iso, skipped]); }
async function moveOccurrence(postId, a, b){ window.__escrituras.push(["move", postId, a, b]); }
function fmtDate(iso){ return iso; }
function occurrenceDateOfSafe(p,i){ return occurrenceDateOf(p,i); }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
// Igual que el t() real: sustituye {clave} con vars. Un stub que no
// sustituye hace fallar tests por culpa del stub, no del código.
function t(es, en, pt, he, vars){
  let out = es;
  if(vars) Object.keys(vars).forEach(k=>{ out = out.split("{"+k+"}").join(String(vars[k])); });
  return out;
}
function isRTL(){ return false; }
function fmtISO(iso, opts){ return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone:"UTC" }).format(new Date(iso+"T00:00:00Z")); }

${fns}

let POST = null;
function render(){
  const occ = occurrenceOf(POST);
  document.getElementById("dateLine").innerHTML = "lun 14 sep" + renderOccurrencePicker(POST, occ);
  syncOccPopState();
  window.__occ = occ;
}
window.render = render;
window.setPost = p => { POST = p; render(); };
window.state = state;
window.occView = occView;
window.getOccPopOpen = () => occPopOpen;
window.setPuedeEditar = v => { PUEDE_EDITAR = v; render(); };

document.addEventListener("click", async e=>{
  if(!e.target.closest(".occ-picker")) closeOccPops();
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const h = CLICK_ACTIONS[el.dataset.action];
  if(h) await h(el, e, el.dataset.action, el.dataset.postId);
});
document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && document.querySelector(".occ-picker.open")) closeOccPops();
});
window.addEventListener("scroll", ()=>{ if(document.querySelector(".occ-picker.open")) closeOccPops(); }, { passive:true });
</script></body></html>`;
fs.writeFileSync("harness.html", html);
console.log("harness.html listo");
