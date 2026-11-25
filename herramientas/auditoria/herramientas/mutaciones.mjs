/* ======================================================================
   Rompe-código: ¿las pruebas se dan cuenta si el código se rompe? (24/11/2026)

   Que una prueba dé verde no dice cuánto vale. Esto mide la fuerza de las
   comprobaciones: toma un tramo de `index.html`, le hace roturas chicas a
   propósito (un === que pasa a !==, un && que pasa a ||, un > que pasa a >=,
   un true que pasa a false, una línea borrada) y corre la prueba contra cada
   copia rota. Si la prueba falla, «mató» la rotura (bien: ahí cuidaba algo);
   si sigue en verde, la rotura SOBREVIVIÓ: o la prueba no mira eso, o la
   rotura no cambia nada (un «equivalente»: una condición que daba lo mismo).
   Los sobrevivientes son una lista de lugares a mirar a mano, no una nota.

   No es parte de `correr.sh` (cada rotura cuesta una corrida de la prueba, y
   corre en minutos, no en segundos): se usa a pedido, sobre un tramo y una o
   dos pruebas, cuando se quiere saber si lo que se cubrió está bien cubierto.

     node herramientas/auditoria/herramientas/mutaciones.mjs --desde 32932 --hasta 32952 --prueba teclado_autocompletar
     node herramientas/auditoria/herramientas/mutaciones.mjs --desde 100 --hasta 400 --prueba brujula,tour --max 30 --semilla 7

   --desde / --hasta   líneas de index.html (solo se rompe el JS; el CSS y el HTML no)
   --prueba            nombre(s) de prueba de herramientas/pruebas/ (sin «_test.mjs»), separados por coma:
                       se corren todos contra cada copia y alcanza con que UNO falle para darla por muerta
   --max               cuántas roturas probar (de fábrica 30), elegidas al azar
   --semilla           para repetir la misma elección (de fábrica 1)
   --paralelo          cuántas corridas a la vez (de fábrica 4)
   --lista             solo muestra las roturas posibles, sin correr nada
   --lineas 10,25      solo las roturas de esas líneas (todas): para volver a mirar a los sobrevivientes de una corrida anterior
   ETIQUETA=nombre     (variable de entorno) suma ese nombre al del informe, para no pisar el de otra corrida del mismo día

   Un archivo que no es index.html (por ejemplo, la función que da y quita permisos en Drive) se rompe igual:
     node herramientas/auditoria/herramientas/mutaciones.mjs --archivo supabase/functions/_compartido/brujula.mjs --desde 1 --hasta 470 \
       --script supabase/functions/_pruebas/brujula.mjs --max 200
   --archivo           el archivo (desde la raíz del repo); sin esto, es index.html
   --script            los scripts de prueba de node a correr (desde la raíz del repo), en vez de --prueba
   --copiar            la carpeta que se copia para cada rotura (de fábrica, las dos primeras partes de la ruta: supabase/functions)

   Antes de empezar corre la prueba SIN romper nada: si ya falla, corta (todo
   «moriría» por nada). Una rotura que deja el JS con un error de sintaxis se
   descarta (no mide nada). Deja el informe en herramientas/auditoria/salida/mutaciones-<fecha>.md.
   ====================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const PRUEBAS = RAIZ + "herramientas/pruebas/";
const arg = (n, def) => { const i = process.argv.indexOf("--" + n); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const desde = Number(arg("desde", 0)), hasta = Number(arg("hasta", 0));
const nombres = String(arg("prueba", "")).split(",").filter(Boolean);
const archivoRel = String(arg("archivo", "")), esHtml = !archivoRel || /\.html?$/.test(archivoRel);
const scripts = String(arg("script", "")).split(",").filter(Boolean);
const copiarDir = String(arg("copiar", archivoRel.split("/").slice(0, 2).join("/")));
const MAX = Number(arg("max", 30)), SEMILLA = Number(arg("semilla", 1)), PARALELO = Number(arg("paralelo", 4)), SOLO_LISTA = process.argv.includes("--lista");
const TOPE_SEG = Number(arg("tiempo", 300));
if(!desde || !hasta || hasta < desde || (esHtml ? !nombres.length : !scripts.length) && !SOLO_LISTA){
  console.log("Uso: node herramientas/auditoria/herramientas/mutaciones.mjs --desde N --hasta M --prueba nombre[,nombre] [--max 30] [--semilla 1] [--paralelo 4] [--lista]\n     o:  ... --archivo ruta/al/archivo.mjs --script ruta/de/la/prueba.mjs (ver arriba)");
  process.exit(2);
}
const archivos = esHtml ? nombres.map(n => PRUEBAS + n.replace(/(\.mjs)$/, "").replace(/_test$/, "") + "_test.mjs") : scripts.map(x => RAIZ + x);
for(const a of archivos) if(!fs.existsSync(a)){ console.log("No existe la prueba " + a); process.exit(2); }

const ruta = esHtml ? (process.env.INDEX || RAIZ + "index.html") : RAIZ + archivoRel;
if(!fs.existsSync(ruta)){ console.log("No existe el archivo " + ruta); process.exit(2); }
const html = fs.readFileSync(ruta, "utf8"), lineas = html.split("\n");
// En index.html solo se rompe el JS del módulo; en un .mjs, todo el archivo.
const iniJs = esHtml ? lineas.findIndex(l => l.startsWith('<script type="module">')) : -2;
const finJs = esHtml ? lineas.length - 1 - [...lineas].reverse().findIndex(l => l.startsWith("</script>")) : lineas.length;

// ---------- Las roturas ----------
// [nombre, expresión, reemplazo]. Cada coincidencia en cada línea es una rotura posible.
const OPERADORES = [
  ["=== → !==", /===/g, "!=="], ["!== → ===", /!==/g, "==="],
  ["&& → ||", /&&/g, "||"], ["|| → &&", /\|\|/g, "&&"],
  [">= → >", />=/g, ">"], ["<= → <", /<=/g, "<"],
  ["> → >=", /(?<![=>-])\s>\s(?!=)/g, " >= "], ["< → <=", /(?<![=<])\s<\s(?!=)/g, " <= "],
  ["true → false", /\btrue\b/g, "false"], ["false → true", /\bfalse\b/g, "true"],
  ["+ 1 → - 1", /\+ 1\b/g, "- 1"], ["- 1 → + 1", /(?<=[\w)\]]) - 1\b/g, " + 1"],
  ["if(…) → if(!…)", /\bif\(/g, "if(!"], ["if(!… → if(…", /\bif\(!/g, "if("],
];
// Líneas que se borran enteras (un efecto que deja de pasar).
const BORRABLES = [/^\s*render\(\);\s*$/, /^\s*e\.preventDefault\(\);\s*$/, /^\s*return;\s*$/, /^\s*e\.stopPropagation\(\);\s*$/, /^\s*continue;\s*$/];

// Los renglones de un comentario /* … */ de varias líneas no se rompen (no hacen nada).
const enBloque = (() => { const r = new Array(lineas.length).fill(false); let dentro = false;
  for(let i = 0; i < lineas.length; i++){ const t = lineas[i].trim();
    if(dentro){ r[i] = true; if(t.includes("*/")) dentro = false; }
    else if(t.startsWith("/*")){ r[i] = true; if(!t.includes("*/")) dentro = true; } }
  return r; })();
function candidatos(){
  const res = [];
  for(let n = Math.max(desde, iniJs + 2); n <= Math.min(hasta, finJs); n++){
    const l = lineas[n - 1], t = l.trim();
    if(!t || enBloque[n - 1] || t.startsWith("//") || t.startsWith("*")) continue;
    if(BORRABLES.some(r => r.test(l))){ res.push({ n, op: "borrar la línea", antes: t, nueva: "" }); continue; }
    const corte = l.search(/\s\/\/\s/), codigo = corte < 0 ? l : l.slice(0, corte), resto = corte < 0 ? "" : l.slice(corte);
    for(const [op, re, rep] of OPERADORES){
      for(const m of codigo.matchAll(re)){
        const nueva = codigo.slice(0, m.index) + rep + codigo.slice(m.index + m[0].length) + resto;
        res.push({ n, op, antes: t.slice(0, 110), nueva });
      }
    }
  }
  return res;
}
// Azar con semilla (mulberry32), para poder repetir la misma elección.
const azar = (() => { let a = SEMILLA >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
// --lineas 30913,31054: solo las roturas de esas líneas, todas (para volver a mirar a los sobrevivientes de una corrida anterior).
const LINEAS = new Set(String(arg("lineas", "")).split(",").filter(Boolean).map(Number));
const todos = candidatos().filter(c => !LINEAS.size || LINEAS.has(c.n));
const elegidos = [...todos].sort(() => azar() - 0.5).slice(0, LINEAS.size ? todos.length : MAX).sort((a, b) => a.n - b.n);
console.log(`${esHtml ? "index.html" : archivoRel}, líneas ${desde}–${hasta}: ${todos.length} roturas posibles; se prueban ${elegidos.length} (semilla ${SEMILLA}).`);
if(SOLO_LISTA){ for(const c of todos) console.log(`  l.${c.n}  ${c.op}   ${c.antes}`); process.exit(0); }

// ---------- Correr ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mutaciones-"));
// Una corrida de todas las pruebas de la lista contra una copia (en index.html: el archivo roto; en un módulo: una copia de la carpeta con el archivo roto).
const correr = (dondePath, ms = TOPE_SEG * 1000) => new Promise(res => {
  // Las pruebas de la lista corren una detrás de otra; alcanza con que una falle.
  let i = 0, fallo = null; const t0 = Date.now();
  const sig = () => {
    if(fallo || i >= archivos.length) return res({ fallo, seg: Math.round((Date.now() - t0) / 1000) });
    const a = archivos[i++];
    const [comando, cwd, env] = esHtml ? [a, PRUEBAS, { ...process.env, INDEX: dondePath }] : [path.join(dondePath, path.relative(RAIZ, a)), dondePath, process.env];
    const h = spawn("node", [comando], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let salida = ""; h.stdout.on("data", d => { salida += d; }); h.stderr.on("data", d => { salida += d; });
    const reloj = setTimeout(() => { fallo = { prueba: path.basename(a), por: "se pasó del tiempo" }; h.kill("SIGKILL"); }, ms);
    h.on("close", c => { clearTimeout(reloj); if(!fallo && c !== 0) fallo = { prueba: path.basename(a), por: (salida.split("\n").find(x => x.startsWith("✗")) || salida.trim().split("\n").pop() || "salió con error").slice(0, 120) }; sig(); });
  };
  sig();
});
// Una copia de la carpeta (para un módulo) con el archivo ya cambiado, o el index.html cambiado.
const preparar = (texto, id) => {
  if(esHtml){ const f = path.join(tmp, id + ".html"); fs.writeFileSync(f, texto); return { donde: f, limpiar: () => fs.unlinkSync(f) }; }
  const d = path.join(tmp, id); fs.cpSync(RAIZ + copiarDir, path.join(d, copiarDir), { recursive: true });
  fs.writeFileSync(path.join(d, archivoRel), texto);
  return { donde: d, limpiar: () => fs.rmSync(d, { recursive: true, force: true }) };
};
const sintaxisOk = (texto, id) => {
  const js = esHtml ? texto.split("\n").slice(iniJs + 1, finJs).join("\n") : texto, f = path.join(tmp, id + ".mjs");
  fs.writeFileSync(f, js); const r = spawnSync("node", ["--check", f]); fs.unlinkSync(f); return r.status === 0;
};

console.log("Corriendo la prueba sin romper nada (tiene que dar verde)…");
const basePrep = preparar(html, "base");   // una copia de lo que hay AHORA: si se edita index.html mientras corre, no cambia la medición
const base = await correr(basePrep.donde); basePrep.limpiar();
if(base.fallo){ console.log(`✗ Ya falla sin romper nada: ${base.fallo.prueba} — ${base.fallo.por}. Así no se puede medir.`); process.exit(2); }
console.log(`  verde en ${base.seg} s. Probando ${elegidos.length} roturas (${PARALELO} a la vez)…`);

const resultados = []; let sig = 0, hechos = 0;
async function obrero(){
  while(sig < elegidos.length){
    const c = elegidos[sig], id = "m" + (sig++ + 1);
    const nuevo = lineas.slice(); nuevo[c.n - 1] = c.nueva;
    const texto = nuevo.join("\n");
    let estado, quien = "";
    if(!sintaxisOk(texto, id)) estado = "inválida";
    else {
      const pr = preparar(texto, id);
      const r = await correr(pr.donde); pr.limpiar();
      estado = r.fallo ? "muerta" : "sobrevivió"; if(r.fallo) quien = `${r.fallo.prueba}: ${r.fallo.por}`;
    }
    resultados.push({ ...c, id, estado, quien });
    console.log(`  [${++hechos}/${elegidos.length}] l.${c.n} ${c.op}: ${estado}`);
  }
}
await Promise.all(Array.from({ length: PARALELO }, obrero));
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- Informe ----------
resultados.sort((a, b) => a.n - b.n);
const validas = resultados.filter(r => r.estado !== "inválida"), muertas = validas.filter(r => r.estado === "muerta"), vivas = validas.filter(r => r.estado === "sobrevivió");
const pct = validas.length ? Math.round(100 * muertas.length / validas.length) : 0;
const md = [
  `# Rompe-código — líneas ${desde}–${hasta} de ${esHtml ? "index.html" : archivoRel} — ${new Date().toISOString().slice(0, 10)}`, "",
  `Pruebas: ${(esHtml ? nombres : scripts).join(", ")}. Semilla ${SEMILLA}. **${muertas.length} de ${validas.length} roturas detectadas (${pct} %)**; ${vivas.length} sobrevivieron` + (resultados.length - validas.length ? `; ${resultados.length - validas.length} descartadas (error de sintaxis)` : "") + ".", "",
  "## Sobrevivieron (a mirar a mano: ¿falta una comprobación o la rotura no cambia nada?)", "",
  ...(vivas.length ? vivas.map(r => `- l.${r.n} — ${r.op}\n  - antes:   \`${r.antes}\`\n  - después: \`${r.nueva.trim().slice(0, 140)}\``) : ["Ninguna."]), "",
  "## Detectadas", "",
  ...muertas.map(r => `- l.${r.n} — ${r.op} → ${r.quien}`), "",
].join("\n");
const dir = RAIZ + "herramientas/auditoria/salida/"; fs.mkdirSync(dir, { recursive: true });
const salida = dir + `mutaciones-${esHtml ? "index" : path.basename(archivoRel).replace(/\.[^.]+$/, "")}${process.env.ETIQUETA ? "-" + process.env.ETIQUETA : ""}-${new Date().toISOString().slice(0, 10)}.md`; fs.writeFileSync(salida, md);
console.log(`\n${muertas.length} de ${validas.length} roturas detectadas (${pct} %). Sobrevivieron ${vivas.length}:`);
for(const r of vivas) console.log(`  l.${r.n}  ${r.op}\n      antes:   ${r.antes}\n      después: ${r.nueva.trim().slice(0, 140)}`);
console.log(`\nInforme: ${path.relative(RAIZ, salida)}`);
