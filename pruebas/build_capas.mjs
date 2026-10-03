import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "index.html","utf8");
function grab(name){
  const m = new RegExp(`\\n(?:function|const|let) ${name}\\s*[=(]`).exec(src);
  if(!m) throw new Error("no se encontró " + name);
  const desde = m.index + m[0].length - 1;
  // Un const escalar ("const X = 5;") no abre ninguna llave: si se lo
  // busca igual, se termina agarrando la del declarador SIGUIENTE y se
  // duplican declaraciones. Se corta en el fin de línea.
  const finLinea = src.indexOf("\n", desde);
  const iLl = src.indexOf("{", desde), iCor = src.indexOf("[", desde);
  const primerBloque = iCor >= 0 && (iLl < 0 || iCor < iLl) ? iCor : iLl;
  if(primerBloque < 0 || primerBloque > finLinea) return src.slice(m.index + 1, finLinea + 1);
  const i = primerBloque;
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
const fns = ["MILESTONE_DUE_SOON_DAYS","MILESTONE_DUE_SOON_OPTIONS","milestoneDueSoonDays",
  "milestoneStatus","milestoneStatusLabel","addDaysISO","isoDate","todayISO","safeColor",
  "configSections","prefSwitch","prefRow","prefColorRow","prefChips","similarColorTo",
  "usedColors","colorDistance","hexToRgb","colorControl","countryLabel","hasOwn","DEFAULT_COUNTRY_LABELS","currentLang","holidayCountryOptions","renderConfigCapasSection"].map(grab).join("\n")
  .replace(/function todayISO\(\)\{[\s\S]*?\n\}/, 'function todayISO(){ return "2026-09-15"; }');

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
${css}
body{ padding:20px; margin:0; }
</style></head><body>
<div class="preferencias-view" id="box"></div>
<script>
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function t(es,en,pt,he,vars){ let o=es; if(vars) for(const k in vars) o=o.split("{"+k+"}").join(String(vars[k])); return o; }
const COLOR_TOO_CLOSE = 40;
const ZONES = {};
const COUNTRIES = [{ name:"Argentina" },{ name:"Brasil" },{ name:"México" }];
const HOLIDAY_CAL = { "Argentina":"es.ar", "Brasil":"pt.brazilian", "México":"es.mexican" };
const state = { prefs: {} };
function prefs(){ return state.prefs; }
${fns}
window.setPrefs = p => { state.prefs = p; render(); };
function render(){ document.getElementById("box").innerHTML = renderConfigCapasSection(); }
window.render = render;
window.secciones = () => configSections().map(s=>({ key:s.key, label:s.label }));
window.estado = m => milestoneStatus(m);
window.dias = () => milestoneDueSoonDays();
window.setPrefs({ holidayMode:"sutil", holidayColor:"#c0392b", holidayJewishColor:"#6b4fbb",
  holidayJewish:true, holidayCountries:["Argentina"], calendarShowMilestones:true,
  calendarHideDoneMilestones:false, milestoneDueSoonDays:5 });
</script></body></html>`;
fs.writeFileSync("capas.html", html);
console.log("capas.html listo");
