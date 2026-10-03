import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { hacerGrab } from "./grab.mjs";

/* ======================================================================
   El extractor es lo que hace que las pruebas prueben el código DE VERDAD
   y no una copia a mano. Si se equivoca, todas las demás pruebas prueban
   otra cosa sin enterarse — y ya pasó cinco veces, cada una con un síntoma
   que apuntaba a otro lado ("ya está declarado", una página en blanco,
   una función de 166 KB). Así que tiene su propia prueba, armada con los
   casos que lo rompieron.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Una declaración de una línea vuelve con su salto de línea final (los dos
// gemelos lo hacen igual); acá se compara el contenido.
const de = (fuente, nombre) => {
  try{ return hacerGrab("\n" + fuente + "\n")(nombre).trimEnd(); }
  catch(e){ return "ERROR: " + e.message; }
};

// Una expresión regular con comillas adentro. Es esc(), la función más usada
// del archivo, y la que lo hizo irse hasta el final.
eq("una regex con comillas adentro",
   de(`function a(s){ return s.replace(/["']/g, ""); }\nfunction b(){}`, "a"),
   `function a(s){ return s.replace(/["']/g, ""); }`);
// Una barra adentro de una clase no cierra la expresión.
eq("una barra adentro de [ ] no cierra la regex",
   de(`const c = /[/]/;\nconst d = 1;`, "c"), `const c = /[/]/;`);
eq("una barra escapada tampoco",
   de(`function e(z){ return /x\\/y/.test(z); }\nfunction f(){}`, "e"), `function e(z){ return /x\\/y/.test(z); }`);
// Y una división tiene que seguir siendo división: después de un valor.
eq("división después de un número",
   de(`function g(x){ return x / 2 / 3; }\nfunction h(){}`, "g"), `function g(x){ return x / 2 / 3; }`);
eq("división después de un paréntesis",
   de(`function h(a){ return (a+1) / 2; }\nfunction i(){}`, "h"), `function h(a){ return (a+1) / 2; }`);
eq("división después de un corchete",
   de(`const j = arr[0] / 2;\nconst k = 1;`, "j"), `const j = arr[0] / 2;`);
// Templates anidados con apóstrofos: el que se llevó 166 KB.
eq("template anidado con apóstrofos en número impar",
   de("function l(){ return `<p>${t(`It's ${n} — isn't it`)}</p>`; }\nfunction m(){}", "l"),
   "function l(){ return `<p>${t(`It's ${n} — isn't it`)}</p>`; }");
// Un comentario de bloque después de una función no es una división.
eq("un /* después de una función no la estira",
   de(`function n(){ return 1; }\n/* comentario */\nfunction o(){}`, "n"), `function n(){ return 1; }`);
// Una expresión de varias líneas tiene que volver entera.
eq("una expresión de varias líneas vuelve entera",
   de(`const RE = new RegExp("^a" +\n  "b$");\nconst p = 1;`, "RE"), `const RE = new RegExp("^a" +\n  "b$");`);
eq("una declaración de una línea con corchetes",
   de(`const q = new Set(["a","b"]);\nconst r = 2;`, "q"), `const q = new Set(["a","b"]);`);

/* ---------- Contra el index.html de verdad ---------- */
const src = fs.readFileSync(process.env.INDEX || "../index.html", "utf8");
const grab = hacerGrab(src);
let escEntera = false;
try{ escEntera = grab("esc").trim().endsWith("[c]));\n}"); }catch(e){}
eq("esc() sale entera", escEntera, true);
const nombres = [...new Set([...src.matchAll(/\n(?:async function|function|const|let) ([A-Za-z_$][\w$]*)\s*[=(]/g)].map(m=>m[1]))];
const js = {}, malas = [];
for(const n of nombres){ try{ js[n] = grab(n); }catch(e){ malas.push(n); } }
eq("todas las declaraciones del archivo se pueden sacar", malas, []);
eq("y son varios cientos (si esto baja de golpe, el patrón dejó de encontrar)", nombres.length > 500, true);

/* ---------- Los gemelos tienen que decir lo mismo ---------- */
// Los armadores de Python usan extractor.py y las pruebas de JavaScript usan
// grab.mjs. Si uno aprende algo y el otro no, la mitad de las pruebas prueba
// otra cosa que la otra mitad.
const py = spawnSync("python3", ["-c", `
import json, sys
from extractor import grab
nombres = json.load(sys.stdin)
out = {}
for n in nombres:
    try: out[n] = grab(n)
    except BaseException as e: out[n] = None
print(json.dumps(out))
`], { input: JSON.stringify(nombres), encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, INDEX: process.env.INDEX || "../index.html" } });
const dePython = py.status === 0 ? JSON.parse(py.stdout) : null;
eq("extractor.py corre", py.status, 0);
if(dePython){
  const distintas = nombres.filter(n => dePython[n] !== js[n]);
  eq("extractor.py y grab.mjs sacan exactamente lo mismo, declaración por declaración", distintas, []);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
