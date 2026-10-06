import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   «Ir a una fecha» del Calendario lee la fecha con el orden que eligió
   la persona (docs/AUDITORIA.md, B2): antes leía siempre día primero, y
   quien eligió mes/día/año en Configuración iba a otra fecha. Usa el
   mismo lector que el formulario (parseTypedDate). Corre el código del
   index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };

const ctx = { formato: "auto" };
let leer = () => "no se pudo armar";
try{
  leer = new Function("ctx", `
    const dateFormatPref = () => ctx.formato;
    ${["daysInMonthUTC","typedDateOrder","parseTypedDate","fechaEscrita"].map(grab).join("\n")}
    return t => fechaEscrita(t);`)(ctx);
}catch(e){ console.log("no se pudo armar:", e.message); }
const iso = t => { try{ const r = leer(t); return r ? (r.vista ? r.vista + ":" + r.iso : r.iso) : null; }catch(e){ return "error"; } };

ctx.formato = "auto";
eq("por omisión, día primero", ["3/4/2026", "01-01-24", "1.1.2024", "1 1 2024", "1 / 2 / 2024", "29/2/2023"].map(iso),
  ["2026-04-03", "2024-01-01", "2024-01-01", "2024-01-01", "2024-02-01", null]);
ctx.formato = "mdy";
eq("con mes/día/año elegido, mes primero", ["3/4/2026", "12/31/2025", "31/12/2025"].map(iso), ["2026-03-04", "2025-12-31", null]);
ctx.formato = "ymd";
eq("con año-mes-día elegido, año primero", ["2026/3/4", "2026.03.04", "4/3/2026"].map(iso), ["2026-03-04", "2026-03-04", null]);
for(const f of ["auto", "mdy", "ymd"]){
  ctx.formato = f;
  eq(`la forma ISO, un mes solo y un año solo valen siempre (${f})`, ["2024-02-01", "3/2024", "2024", "hola", ""].map(iso),
    ["2024-02-01", "mes:2024-03-01", "anio:2024-01-01", null, null]);
}
// Y lo de afuera de esta función no cambió: el texto de ayuda sigue al orden.
const vista = grab("renderCalIr");
eq("el campo y la ayuda muestran el orden elegido", /placeholder="\$\{esc\(typedDatePlaceholder\(\)\)\}"/.test(vista) && /f: typedDatePlaceholder\(\)/.test(vista), true);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
