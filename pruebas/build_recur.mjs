import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "index.html","utf8");
function grab(name){
  const m = new RegExp(`\\n(?:function|const|let) ${name}\\s*[=(]`).exec(src);
  if(!m) throw new Error("no se encontró " + name);
  const desde = m.index + m[0].length - 1;
  const iLl = src.indexOf("{", desde), iCor = src.indexOf("[", desde);
  const i = iCor >= 0 && iCor < iLl ? iCor : iLl;
  let depth = 0, inStr = null;
  const abre = src[i], cierra = abre === "[" ? "]" : "}";
  for(let j = i; j < src.length; j++){
    const c = src[j];
    if(inStr){ if(c === "\\"){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '"' || c === "'" || c === "`"){ inStr = c; continue; }
    if(c === "/" && src[j+1] === "/"){ j = src.indexOf("\n", j); continue; }
    if(c === abre) depth++;
    else if(c === cierra){ depth--; if(depth === 0) return src.slice(m.index + 1, j + 1) + (abre === "[" ? ";" : ""); }
  }
  throw new Error("no cerró " + name);
}
const cssIni = src.indexOf("  .recur-row{");
const cssFin = src.indexOf("  /* ---------- Selector de fecha de un evento que se repite");
const css = src.slice(cssIni, cssFin);

const fns = ["rruleDateToISO","parseRecurrence","isoDate","addDaysISO","isoDow","todayISO",
  "RRULE_DOW","RRULE_DOW_NAMES","RECUR_PRESETS","recurPreset","recurDraftFrom","recurLinesFrom",
  "recurSummary","dowName","dowShort","listToText","recurrenceLabel","positionDatePop",
  "closeRecurPop","syncRecurPopState","renderRecurrenceField"]
  .map(grab).join("\n").replace(/function todayISO\(\)\{[\s\S]*?\n\}/, 'function todayISO(){ return "2026-09-15"; }');

// Las tres ramas del dispatcher, tal cual están en el archivo
const a1 = src.indexOf('    "recur-open": async (el, e, action, postId) => {');
const a2 = src.indexOf('    "occ-toggle": async (el, e, action, postId) => {');
const acciones = "const CLICK_ACTIONS = {\n" + src.slice(a1, a2) + "};\n";

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
:root{ --card:#fff; --border:#dcd8d0; --ink:#1c1a17; --text-muted:#8a8477; --surface-soft:#f1efe9;
  --surface-hover:#eae7df; --celeste-dark:#2b6f8f; --celeste-soft:#e3f0f5; --petroleo:#1f4b5c;
  --danger:#c0392b; --danger-bg:#fdecea; --danger-text:#c0392b;
  --radius-md:12px; --radius-sm:8px; --shadow:0 8px 24px rgba(0,0,0,.15); }
body{ font-family:system-ui,sans-serif; background:#f6f5f2; padding:24px; margin:0; }
.modal{ background:#fff; border:1px solid var(--border); border-radius:12px; padding:16px; max-width:480px; overflow:hidden; }
.hint{ font-size:11.5px; color:var(--text-muted); line-height:1.35; }
${css}
${src.slice(src.indexOf("  .date-pop{"), src.indexOf("}", src.indexOf("  .date-pop{"))+1)}
${src.slice(src.indexOf("  .date-trigger{"), src.indexOf("}", src.indexOf("  .date-trigger{"))+1)}
.date-field{ position:relative; display:inline-flex; }
.date-pop[hidden]{ display:none; }
</style></head><body>
<div class="modal"><div id="box"></div></div>
<script>
let recurPopOpen = false;
const state = { prefs: { weekStart: 0 } };
function prefs(){ return state.prefs; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function t(es,en,pt,he,vars){ let o=es; if(vars) for(const k in vars) o=o.split("{"+k+"}").join(String(vars[k])); return o; }
function isRTL(){ return false; }
function fmtISO(iso, opts){ return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone:"UTC" }).format(new Date(iso+"T00:00:00Z")); }
function fmtDate(iso){ return fmtISO(iso, { day:"numeric", month:"short", year:"numeric" }); }
function fmtTypedDate(iso){ return iso; }
let composerDraft = { activityType:"evento", startDate:"2026-09-14", recur:{ key:"none", byDay:[1], until:"" }, recurrence:null };

${fns}

function render(){
  document.getElementById("box").innerHTML = renderRecurrenceField(composerDraft);
  syncRecurPopState();
}
window.render = render;
window.getDraft = () => composerDraft;
window.setDraft = d => { composerDraft = { ...composerDraft, ...d }; render(); };
window.setWeekStart = n => { state.prefs.weekStart = n; render(); };
window.lineas = () => recurLinesFrom(composerDraft.recur, composerDraft.startDate);

${acciones}

document.addEventListener("click", async e=>{
  if(!e.target.closest(".recur-field")) closeRecurPop();
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const h = CLICK_ACTIONS[el.dataset.action];
  if(h) await h(el, e, el.dataset.action, el.dataset.postId);
});
document.addEventListener("keydown", e=>{
  if(e.key === "Escape" && document.querySelector(".recur-field.open")) closeRecurPop();
});
render();
</script></body></html>`;
fs.writeFileSync("recur.html", html);
console.log("recur.html listo");
