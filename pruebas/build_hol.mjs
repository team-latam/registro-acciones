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
const css = src.slice(src.indexOf("<style>") + 7, src.indexOf("</style>"));
const fns = ["HOLIDAY_CAL","JEWISH_CAL","holidaysOn","holidayColorOf","holidaySourceLabel",
  "renderHolidayCard","openHolidayCard","closeEventCard","isoDate","safeColor","readableOn"].map(grab).join("\n");
// Las dos ramas nuevas del dispatcher, tal cual
const a1 = src.indexOf('    "cal-open-holiday": async (el, e, action, postId) => {');
const a2 = src.indexOf('    "cal-open": async (el, e, action, postId) => {');
// goto-config-capas vive en otra parte del dispatcher: se saca aparte.
const g1 = src.indexOf('    "goto-config-capas": async (el, e, action, postId) => {');
const g2 = src.indexOf("  },", src.indexOf("scrollToTop();", g1)) + 4;
const acciones = "const CLICK_ACTIONS = {\n" + src.slice(a1, a2) + src.slice(g1, g2) + "\n};\n";
// La rama de feriado de calendarioBar, tal cual
const b1 = src.indexOf("function calendarioBar(it, weekDays){");
const b2 = src.indexOf("  const p = it.post;", b1);
const barra = "function calendarioBarHoliday(it){\n" + src.slice(src.indexOf("  if(it.holiday){", b1), b2) + "  return null;\n}\n";

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${css}
body{ padding:20px; margin:0; }
</style></head><body>
<div id="barras" class="cal-week-bars" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
<!-- El mismo cascarón que el archivo real: con estilos propios acá, el
     "hidden" lo pisaba un display:flex en línea y el overlay invisible
     seguía tapando los clicks. -->
<div class="modal-overlay" id="eventCardOverlay" hidden>
  <div class="modal event-card" role="dialog" aria-modal="true" aria-labelledby="eventCardTitle">
    <button class="close" id="eventCardClose" aria-label="Cerrar">✕</button>
    <div id="eventCardBody"></div>
  </div>
</div>
<script>
const eventCardOverlay = document.getElementById("eventCardOverlay");
const eventCardBody = document.getElementById("eventCardBody");
let eventCardPostId = null, eventCardOcc = null, eventCardHoliday = null, eventCardReturnFocus = null;
let PUEDE_ESCRIBIR = true;
function canWrite(){ return PUEDE_ESCRIBIR; }
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function t(es,en,pt,he,vars){ let o=es; if(vars) for(const k in vars) o=o.split("{"+k+"}").join(String(vars[k])); return o; }
function fmtISO(iso, opts){ return new Intl.DateTimeFormat("es-AR", { ...opts, timeZone:"UTC" }).format(new Date(iso+"T00:00:00Z")); }
let holidaysByDate = {};
const state = { view:"calendario", configSection:null, prefs:{ holidayMode:"marca", holidayCountries:["Argentina"], holidayJewish:true,
  holidayColor:"#c0392b", holidayJewishColor:"#6b4fbb",
  calendarShowHolidaysLocal:true, calendarShowHolidaysJewish:true } };
function prefs(){ return state.prefs; }
function holidayCalendarsWanted(){
  const p = prefs();
  if(p.holidayMode === "off") return [];
  const keys = (p.holidayCountries||[]).map(n=>HOLIDAY_CAL[n]).filter(Boolean);
  if(p.holidayJewish) keys.push(JEWISH_CAL);
  return [...new Set(keys)];
}
function renderEventCard(){ if(eventCardHoliday){ renderHolidayCard(); return; } }
window.__composer = [];
function openComposerOnDate(iso){ window.__composer.push(iso); }
let calLayersMenuOpen = false;
window.__scrolls = 0;
function scrollToTop(){ window.__scrolls++; }
function render(){ if(!eventCardOverlay.hidden) renderEventCard(); }

${fns}
${barra}
${acciones}

window.setHolidays = h => { holidaysByDate = h; };
window.setPrefs = p => { Object.assign(state.prefs, p); };
window.setPuedeEscribir = v => { PUEDE_ESCRIBIR = v; };
window.abrir = (iso, i) => openHolidayCard(iso, i);
window.render = render;
window.getVista = () => ({ view: state.view, configSection: state.configSection });
window.setVistaCalendario = () => { state.view = "calendario"; state.configSection = null; };
window.pintarBarras = iso => {
  document.getElementById("barras").innerHTML = holidaysOn(iso).map((h,hi)=>
    calendarioBarHoliday({ holiday:h.name, holidayColor:holidayColorOf(h), holidayDate:iso, holidayIdx:hi, from:0, to:0, lane:hi })).join("");
};
document.getElementById("eventCardClose").addEventListener("click", closeEventCard);
document.addEventListener("click", async e=>{
  const el = e.target.closest("[data-action]");
  if(!el) return;
  const h = CLICK_ACTIONS[el.dataset.action];
  if(h) await h(el, e, el.dataset.action, el.dataset.postId);
});
</script></body></html>`;
fs.writeFileSync("hol.html", html);
console.log("hol.html listo");
