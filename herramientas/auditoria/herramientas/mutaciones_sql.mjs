/* ======================================================================
   Rompe-código para el SQL: ¿las pruebas de la base se dan cuenta si una regla se rompe? (25/11/2026)

   Es lo mismo que `mutaciones.mjs`, pero sobre un archivo de SQL (las reglas de quién ve y quién escribe, las
   validaciones, las funciones que mueven plata). Toma el archivo, le hace roturas chicas a propósito (un `=` que pasa
   a `<>`, un `and` a `or`, un `is null` a `is not null`, un `<=` a `<`, un `true` a `false`, un número del borde ±1, un
   `security definer` a `security invoker`, una función de permiso negada con `not`, un `grant` o un `revoke` borrado, un
   `raise exception` cambiado por `null`) y, para cada rotura, corre TODAS las pruebas de SQL contra una copia
   descartable de la base. Si alguna falla, la rotura «murió» (bien); si todas siguen en verde, SOBREVIVIÓ: o ninguna
   prueba cuida eso, o la rotura no cambia nada (un «equivalente»). Los sobrevivientes son una lista de lugares a mirar.
   Una rotura que el servidor rechaza al aplicarla (error de sintaxis o de tipos) se descarta: no mide nada.

   Hace falta el servidor local de las pruebas (supabase/pruebas/levantar.sh lo levanta). Cada rotura arma una base NUEVA de
   cero (el laboratorio y todos los archivos de supabase/, con el roto en su lugar, dos veces como en GitHub: 3 s) y corre `supabase/pruebas/correr.sh`
   (unos 10 s). Se arma de cero y no se copia una base ya armada porque un `grant`/`revoke` borrado, un `create table` o un
   `default` no se deshacen sobre una base que ya los tenía. Nunca toca la base de verdad.

     bash supabase/pruebas/levantar.sh
     node herramientas/auditoria/herramientas/mutaciones_sql.mjs --archivo supabase/27-gastos.sql --max 300

   --archivo   el SQL a romper (desde la raíz del repo); de fábrica supabase/27-gastos.sql
   --desde / --hasta   solo las líneas de ese tramo (de fábrica, todo el archivo)
   --lineas 10,25      solo las roturas de esas líneas (todas): para volver a mirar a los sobrevivientes
   --max               cuántas roturas probar, al azar (de fábrica 150)
   --semilla           para repetir la misma elección (de fábrica 1)
   --paralelo          cuántas a la vez (de fábrica 4)
   --lista             solo muestra las roturas posibles, sin correr nada
   ETIQUETA=nombre     (variable de entorno) suma ese nombre al del informe
   Deja el informe en herramientas/auditoria/salida/mutaciones-sql-<archivo>-<fecha>.md.
   ====================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const arg = (n, def) => { const i = process.argv.indexOf("--" + n); return i < 0 ? def : (process.argv[i + 1] ?? true); };
const archivoRel = String(arg("archivo", "supabase/27-gastos.sql"));
const ARCHIVO = path.join(RAIZ, archivoRel);
const MAX = Number(arg("max", 150)), SEMILLA = Number(arg("semilla", 1)), PARALELO = Number(arg("paralelo", 4)), SOLO_LISTA = process.argv.includes("--lista");
const LINEAS = new Set(String(arg("lineas", "")).split(",").filter(Boolean).map(Number));
const SOCKET = "/var/run/postgresql", USUARIO = "postgres";
const uri = db => `postgresql:///${db}?host=${SOCKET}&user=${USUARIO}`;

const original = fs.readFileSync(ARCHIVO, "utf8");
const lineas = original.split("\n");
const desde = Number(arg("desde", 1)), hasta = Number(arg("hasta", lineas.length));

// ---------- Las roturas ----------
// Cada operador: [nombre, regex sobre la línea con los textos entre comillas tapados, reemplazo (texto o función)].
const NUM = (m, op, n) => op + " " + (Number(n) + 1);
const OPERADORES = [
  ["= → <>", /(?<![<>:!=])\s=\s(?!=)/g, " <> "],
  ["<> → =", /\s<>\s/g, " = "],
  ["!= → =", /\s!=\s/g, " = "],
  ["and → or", /\band\b/gi, "or"],
  ["or → and", /\bor\b/gi, "and"],
  ["> → >=", /\s>\s(?!=)/g, " >= "],
  [">= → >", /\s>=\s/g, " > "],
  ["< → <=", /\s<\s(?![=>])/g, " <= "],
  ["<= → <", /\s<=\s/g, " < "],
  ["is null → is not null", /\bis null\b/gi, "is not null"],
  ["is not null → is null", /\bis not null\b/gi, "is null"],
  ["true → false", /\btrue\b/gi, "false"],
  ["false → true", /\bfalse\b/gi, "true"],
  ["in → not in", /\s(?<!not )in\s*\(/gi, " not in ("],
  ["not in → in", /\snot in\s*\(/gi, " in ("],
  ["exists → not exists", /(?<!not )\bexists\s*\(/gi, "not exists ("],
  ["not exists → exists", /\bnot exists\s*\(/gi, "exists ("],
  ["borde +1", /([<>]=?)\s*(\d+)\b/g, NUM],
  ["security definer → invoker", /\bsecurity definer\b/gi, "security invoker"],
  ["función de permiso → not función", /(?<!not )(?<![\w.])(public\.[a-z_]+\(\))/g, "not $1"],
];
// Una línea entera que es una sola sentencia: se borra («grant»/«revoke») o se cambia por «null;» («raise exception»).
const SENTENCIAS = [
  ["borrar la línea (grant)", /^\s*grant\b.*;\s*$/i, ""],
  ["borrar la línea (revoke)", /^\s*revoke\b.*;\s*$/i, ""],
  ["raise exception → null", /^(\s*)raise exception\b.*;\s*$/i, "$1null;"],
];
const tapar = l => l.replace(/'(?:[^']|'')*'/g, m => "'" + "\u0001".repeat(m.length - 2) + "'");

function candidatos(){
  const res = [];
  let enBloque = false;
  for(let k = 0; k < lineas.length; k++){
    const n = k + 1, crudo = lineas[k];
    // Comentarios de varias líneas y de una línea; «comment on» y lo que no es código.
    let l = crudo;
    if(enBloque){ if(l.includes("*/")) enBloque = false; continue; }
    if(l.includes("/*") && !l.includes("*/")){ enBloque = true; continue; }
    if(/^\s*--/.test(l) || /^\s*comment on\b/i.test(l)) continue;
    if(n < desde || n > hasta || (LINEAS.size && !LINEAS.has(n))) continue;
    const corte = tapar(l).search(/\s--(\s|$)/);
    const codigo = corte < 0 ? l : l.slice(0, corte), resto = corte < 0 ? "" : l.slice(corte);
    for(const [op, re, rep] of SENTENCIAS){
      if(re.test(codigo)) res.push({ n, op, antes: crudo.trim().slice(0, 110), nueva: codigo.replace(re, rep) + resto });
    }
    if(/^\s*(raise|grant|revoke)\b/i.test(codigo)) continue;
    // La cabecera de una función o de una política (create/alter/drop/language/returns) no tiene condiciones que romper, salvo «security definer».
    const cabecera = /^\s*(create|drop|alter|language|returns)\b/i.test(codigo);
    const masc = tapar(codigo);
    for(const [op, re, rep] of OPERADORES){
      if(cabecera && op !== "security definer → invoker") continue;
      for(const m of masc.matchAll(new RegExp(re.source, re.flags))){
        const trozo = codigo.slice(m.index, m.index + m[0].length);
        const nuevo = typeof rep === "function" ? m[0].replace(new RegExp(re.source, re.flags.replace("g", "")), rep) : m[0].replace(new RegExp(re.source, re.flags.replace("g", "")), rep);
        if(nuevo === m[0]) continue;
        res.push({ n, op, antes: crudo.trim().slice(0, 110), nueva: codigo.slice(0, m.index) + trozo.replace(trozo, nuevo) + codigo.slice(m.index + m[0].length) + resto });
      }
    }
  }
  return res;
}

const azar = (() => { let a = SEMILLA >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();
const todos = candidatos();
const elegidos = [...todos].sort(() => azar() - 0.5).slice(0, LINEAS.size ? todos.length : MAX).sort((a, b) => a.n - b.n);
console.log(`${archivoRel}, líneas ${desde}–${hasta}: ${todos.length} roturas posibles; se prueban ${elegidos.length} (semilla ${SEMILLA}).`);
if(SOLO_LISTA){ for(const c of todos) console.log(`  l.${c.n}  ${c.op}   ${c.antes}`); process.exit(0); }

// ---------- Correr ----------
const correr = (cmd, args, opts = {}) => new Promise(res => execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: 240000, ...opts }, (err, out, errout) => res({ codigo: err ? (err.code ?? 1) : 0, salida: String(out || "") + String(errout || "") })));
const psql = (db, extra) => correr("psql", ["-h", SOCKET, "-U", USUARIO, "-d", db, "-q", ...extra]);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mut-sql-"));
// La base se arma de cero con los mismos archivos y en el mismo orden que supabase/pruebas/levantar.sh.
const ORDEN = [path.join(RAIZ, "supabase/pruebas/00-laboratorio.sql"), ...fs.readdirSync(path.join(RAIZ, "supabase")).filter(f => /^[0-9][0-9]-.*\.sql$/.test(f)).sort().map(f => path.join(RAIZ, "supabase", f))];
async function construir(db, archivoRoto){
  await psql("postgres", ["-tAc", `drop database if exists ${db} with (force)`]);
  await psql("postgres", ["-tAc", `create database ${db}`]);
  // Dos vueltas, como el trabajo «Base de datos» de GitHub y cada despliegue de la base de verdad: 02-politicas.sql da permisos de tabla y
  // los archivos de después los sacan; con una sola vuelta un `revoke` borrado no se notaría (las tablas todavía no existían en el 02).
  for(const vuelta of [1, 2]){
    for(const f of ORDEN){
      const r = await psql(db, ["-v", "ON_ERROR_STOP=1", "-f", f === ARCHIVO ? archivoRoto : f]);
      if(r.codigo !== 0) return { ok: false, salida: r.salida, archivo: f };
    }
  }
  return { ok: true };
}
const suite = db => correr("bash", [path.join(RAIZ, "supabase/pruebas/correr.sh"), uri(db)]);
const primeraFalla = s => { const m = s.match(/^.*FALLA.*$/m) || s.match(/^✗.*$/m); return m ? m[0].trim().slice(0, 150) : "falló una prueba"; };

async function probar(c, i){
  const db = `mut_sql_${process.pid}_${i}`, archivo = path.join(tmp, `m${i}.sql`);
  const texto = lineas.map((l, k) => k + 1 === c.n ? c.nueva : l).join("\n");
  fs.writeFileSync(archivo, texto);
  try{
    const a = await construir(db, archivo);
    if(!a.ok) return { ...c, estado: "inválida" };
    const s = await suite(db);
    return { ...c, estado: s.codigo === 0 ? "sobrevivió" : "muerta", falla: s.codigo === 0 ? "" : primeraFalla(s.salida) };
  } finally { await psql("postgres", ["-tAc", `drop database if exists ${db} with (force)`]); fs.rmSync(archivo, { force: true }); }
}

console.log("Corriendo las pruebas sin romper nada (tiene que dar verde)…");
{
  const db = `mut_sql_${process.pid}_base`, archivo = path.join(tmp, "base.sql");
  fs.writeFileSync(archivo, original);
  const a = await construir(db, archivo);
  if(!a.ok){ console.log("✗ La base no se arma con el archivo sin romper (" + path.basename(a.archivo) + "):\n" + a.salida.split("\n").filter(l => /error/i.test(l)).slice(0, 5).join("\n")); await psql("postgres", ["-tAc", `drop database if exists ${db} with (force)`]); process.exit(1); }
  const t0 = Date.now(), s = await suite(db);
  await psql("postgres", ["-tAc", `drop database if exists ${db} with (force)`]);
  if(s.codigo !== 0){ console.log("✗ Las pruebas ya fallan sin romper nada:\n" + s.salida.split("\n").slice(-8).join("\n")); process.exit(1); }
  console.log(`  verde en ${Math.round((Date.now() - t0) / 1000)} s. Probando ${elegidos.length} roturas (${PARALELO} a la vez)…`);
}
const resultados = new Array(elegidos.length);
let siguiente = 0, hechas = 0;
await Promise.all(Array.from({ length: PARALELO }, async () => {
  while(true){
    const i = siguiente++; if(i >= elegidos.length) return;
    const r = await probar(elegidos[i], i); resultados[i] = r;
    console.log(`  [${++hechas}/${elegidos.length}] l.${r.n} ${r.op}: ${r.estado}`);
  }
}));
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- Informe ----------
const validas = resultados.filter(r => r.estado !== "inválida"), muertas = validas.filter(r => r.estado === "muerta"), vivas = validas.filter(r => r.estado === "sobrevivió");
const pct = validas.length ? Math.round(100 * muertas.length / validas.length) : 0;
const dir = RAIZ + "herramientas/auditoria/salida/"; fs.mkdirSync(dir, { recursive: true });
const salida = dir + `mutaciones-sql-${path.basename(archivoRel).replace(/\.[^.]+$/, "")}${process.env.ETIQUETA ? "-" + process.env.ETIQUETA : ""}-${new Date().toISOString().slice(0, 10)}.md`;
const md = [`# Rompe-código (SQL) — ${archivoRel}, líneas ${desde}–${hasta} — ${new Date().toISOString().slice(0, 10)}`, "",
  `Todas las pruebas de SQL (supabase/pruebas). Semilla ${SEMILLA}. **${muertas.length} de ${validas.length} roturas detectadas (${pct} %)**; ${vivas.length} sobrevivieron; ${resultados.length - validas.length} se descartaron (el servidor las rechazó).`, "",
  "## Sobrevivieron (a mirar a mano: ¿falta una comprobación o la rotura no cambia nada?)", "",
  ...vivas.flatMap(r => [`- l.${r.n} — ${r.op}`, `  - antes:   \`${r.antes}\``, `  - después: \`${r.nueva.trim().slice(0, 110)}\``]), "",
  "## Detectadas", "", ...muertas.map(r => `- l.${r.n} — ${r.op} → ${r.falla}`), ""].join("\n");
fs.writeFileSync(salida, md);
console.log(`\n${muertas.length} de ${validas.length} roturas detectadas (${pct} %). Sobrevivieron ${vivas.length}; descartadas ${resultados.length - validas.length}.`);
for(const r of vivas) console.log(`  l.${r.n}  ${r.op}\n      antes:   ${r.antes}\n      después: ${r.nueva.trim().slice(0, 110)}`);
console.log(`\nInforme: ${path.relative(RAIZ, salida)}`);
