import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   La vista Año como mapa de calor (docs/AUDITORIA.md, M6): los cuatro
   tonos se reparten por cuartos entre los días con actividad del año, así
   se distinguen los días movidos de los tranquilos aunque casi todos
   tengan algo (las rutinas). Corre el código del index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };
let niveles = () => () => "no existe";
try{ niveles = new Function(`${grab("nivelesDeCalor")}\nreturn nivelesDeCalor;`)(); }catch(e){}
const de = (cuentas, n) => { try{ return niveles(cuentas)(n); }catch(e){ return "error"; } };

const año = [1,1,1,1,2,2,2,3,3,4,5,8,0,0,0];
eq("un día sin nada, sin color", de(año, 0), 0);
eq("los días con algo, de menos a más en cuatro tonos", [1, 2, 3, 4, 8].map(n => de(año, n)), [1, 2, 3, 3, 4]);
eq("si casi todos tienen una cosa, igual se ven los picos", [1, 6].map(n => de([1,1,1,1,1,1,1,1,1,6], n)), [1, 4]);
eq("un año vacío no se rompe", de([0, 0], 3), 0);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
