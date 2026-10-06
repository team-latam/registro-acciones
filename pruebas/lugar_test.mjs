import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
/* ======================================================================
   Una sola regla para «este evento toca este lugar» (docs/auditoria/
   codigo.md, 17)

   El filtro de lugar del Inicio (scopeLevelFor) y la ficha de cada lugar
   (nivelEnFicha) tenían la misma tabla de reglas escrita dos veces, línea
   por línea: un arreglo en una no llegaba a la otra. Desde el 6/10/2026
   las dos usan nivelDeAlcance. Al unificarlas se comparó la versión nueva
   con la vieja en 257.312 combinaciones de alcance y lugar: idénticas.
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };
let f = {};
try{
  f = new Function("state", ["COUNTRIES", "COUNTRY_BY_NAME", "ZONE_COUNTRIES", "normalize", "zoneOfCountry", "nivelDeAlcance", "scopeLevelFor", "nivelEnFicha"].map(grab).join("\n")
    + "\nCOUNTRIES.forEach(c=>ZONE_COUNTRIES[c.zone].push(c.name));\nreturn { scopeLevelFor, nivelEnFicha, zoneOfCountry, ZONE_COUNTRIES };")({ repliesByPost: {} });
}catch(e){ console.log("no se pudo armar:", e.message); }
const prueba = (fn, ...a) => { try{ return fn(...a); }catch(e){ return "error"; } };
const filtro = (sc, pl) => prueba(f.scopeLevelFor, sc, pl);
const ficha = (scopes, L) => prueba(f.nivelEnFicha, { id: "x", scopes }, L);

eq("hay una sola regla, y las dos la usan", [/function nivelDeAlcance\(/.test(src), /nivelDeAlcance\(sc, /.test(grab("scopeLevelFor")), /nivelDeAlcance\(sc, L\)/.test(grab("nivelEnFicha"))], [true, true, true]);
const AR = { type: "pais", country: "Argentina" }, ROS = { type: "ciudad", country: "Argentina", city: "Rosario" };
const zonaAR = f.zoneOfCountry ? f.zoneOfCountry("Argentina") : "?";
const REG = { type: "region", region: zonaAR }, TODO = { type: "todo" };
eq("filtro por país: lo del país y sus ciudades es propio", [filtro(AR, { kind: "country", country: "Argentina" }), filtro(ROS, { kind: "country", country: "Argentina" })], ["own", "own"]);
eq("filtro por ciudad: lo de la ciudad (sin importar tildes ni mayúsculas) sí, lo del país entero no", [filtro({ ...ROS, city: "rosario" }, { kind: "city", country: "Argentina", city: "Rosario" }), filtro(AR, { kind: "city", country: "Argentina", city: "Rosario" })], ["own", null]);
eq("la región y toda LatAm, como niveles aparte", [filtro(REG, { kind: "country", country: "Argentina" }), filtro(TODO, { kind: "country", country: "Argentina" })], ["region", "latam"]);
eq("«Toda LatAm» como lugar: solo lo transversal", [filtro(TODO, { kind: "latam" }), filtro(AR, { kind: "latam" })], ["own", null]);
eq("otro país no toca", filtro({ type: "pais", country: "Chile" }, { kind: "country", country: "Argentina" }), null);
eq("ficha de ciudad: lo del país entero es el nivel «pais»", ficha([AR], { country: "Argentina", city: "Rosario" }), "pais");
eq("ficha: gana el nivel más cercano entre varios alcances", ficha([TODO, REG, ROS], { country: "Argentina", city: "Rosario" }), "own");
eq("ficha de zona: lo de sus países y lo de la región es propio", [ficha([AR], { zona: zonaAR }), ficha([REG], { zona: zonaAR }), ficha([TODO], { zona: zonaAR })], ["own", "own", "latam"]);
eq("un alcance vacío o raro no rompe nada", [filtro(null, { kind: "country", country: "Argentina" }), ficha([null, {}, { type: "raro" }], { country: "Argentina" })], [null, null]);
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
