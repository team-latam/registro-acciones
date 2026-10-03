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
// El <style> ENTERO del archivo, no una selección de reglas: eligiendo
// reglas por selector se agarraba solo la PRIMERA de cada una, así que
// una regla nueva más abajo (que es justo la que pisa a la vieja) no
// entraba en el harness y las pruebas mentían.
const cssTodo = src.slice(src.indexOf("<style>") + 7, src.indexOf("</style>"));
// El bloque real de la fila de fechas del composer, tal cual está en renderComposer
const ini = src.indexOf('        <div class="dt-row">\n          <span class="date-field">');
const fin = src.indexOf('</div>` : ""}', ini) + '</div>` : ""}'.length;
if(ini < 0) throw new Error("no se encontró la fila de fechas del composer");
const bloque = src.slice(ini, fin);

const fns = ["rruleDateToISO","parseRecurrence","isoDate","addDaysISO","isoDow","todayISO",
  "RRULE_DOW","RRULE_DOW_NAMES","RECUR_PRESETS","recurPreset","recurDraftFrom","recurLinesFrom",
  "recurSummary","dowName","dowShort","listToText","recurrenceLabel","positionDatePop",
  "closeRecurPop","syncRecurPopState","renderRecurrenceField"]
  .map(grab).join("\n").replace(/function todayISO\(\)\{[\s\S]*?\n\}/, 'function todayISO(){ return "2026-09-15"; }');

const css = cssTodo;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
:root{ --card:#fff; --border:#dcd8d0; --ink:#1c1a17; --text-muted:#8a8477; --surface-soft:#f1efe9;
  --surface-hover:#eae7df; --celeste-dark:#2b6f8f; --celeste-soft:#e3f0f5; --petroleo:#1f4b5c;
  --radius-md:12px; --radius-sm:8px; --shadow:0 8px 24px rgba(0,0,0,.15); }
${css}
body{ padding:20px; margin:0; }
.modal{ background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px; }
.date-pop[hidden], .recur-pop[hidden]{ display:none; }
</style></head><body>
<div class="modal" id="modal"><div class="field-icon-row"><span class="field-icon">🕐</span>
<div class="field-icon-body">
  <label class="allday-toggle"><input type="checkbox" id="cAllDay" checked> Todo el día</label>
  <div id="box"></div>
</div></div></div>
<script>
let recurPopOpen = false;
const state = { prefs:{ weekStart:0 } };
function prefs(){ return state.prefs; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function t(es,en,pt,he,vars){ let o=es; if(vars) for(const k in vars) o=o.split("{"+k+"}").join(String(vars[k])); return o; }
function isRTL(){ return false; }
function uses12h(){ return false; }
function typedTimePlaceholder(){ return "hh:mm"; }
function fmtTypedTime(v){ return v||""; }
function fmtISO(iso, opts){ return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone:"UTC" }).format(new Date(iso+"T00:00:00Z")); }
function fmtDate(iso){ return fmtISO(iso, { day:"numeric", month:"short", year:"numeric" }); }
function fmtTypedDate(iso){ const p=iso.split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }

${fns}

let d = { activityType:"evento", allDay:true, startDate:"2026-12-09", endDate:"2026-12-09",
          startTime:"", endTime:"", recur:{ key:"none", byDay:[3], byDayAuto:true, until:"" }, recurrence:null };
function render(){
  // El bloque sale de adentro de un template literal del archivo real y
  // vuelve a entrar en otro: sus backticks anidados y sus \${...} tienen
  // que quedar TAL CUAL — escaparlos rompía los templates de adentro.
  document.getElementById("box").innerHTML = \`${bloque}\`;
  syncRecurPopState();
}
window.render = render;
window.setD = x => { d = { ...d, ...x }; render(); };
render();
</script></body></html>`;
fs.writeFileSync("row.html", html);
console.log("row.html listo");
