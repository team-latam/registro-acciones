/* ======================================================================
   El reparto de las pruebas en partes para GitHub (repartir.py, SHARD=i/n en correr.sh)

   Si el reparto pierde un archivo, ese archivo deja de probarse en GitHub sin que nadie lo note: es lo único grave que
   puede pasar acá. Se comprueba que las partes, juntas, sean EXACTAMENTE todas las pruebas (ninguna de menos, ninguna
   repetida), que ninguna parte quede vacía ni cargada de más, y que lo mal escrito grite en vez de correr cero pruebas.
   ====================================================================== */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const aqui = fileURLToPath(new URL(".", import.meta.url));
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const repartir = (spec, archivos) => spawnSync("python3", ["repartir.py", spec, ...archivos], { cwd: aqui, encoding: "utf-8" });
const lista = r => r.stdout.split("\n").filter(Boolean);

const todas = fs.readdirSync(aqui).filter(f => f.endsWith("_test.mjs")).sort();
const pesos = {}; for(const l of fs.readFileSync(aqui + "pesos.txt", "utf-8").split("\n")){ const p = l.split(/\s+/); if(p.length === 2 && !l.startsWith("#")) pesos[p[0]] = Number(p[1]); }

for(const n of [1, 2, 4, 7]){
  const partes = Array.from({ length: n }, (_, i) => lista(repartir(`${i + 1}/${n}`, todas)));
  const juntas = partes.flat();
  eq(`en ${n} partes: juntas son exactamente todas las pruebas (ninguna de menos ni repetida)`, [juntas.length, [...juntas].sort()], [todas.length, todas]);
  eq(`en ${n} partes: ninguna queda vacía`, partes.every(p => p.length > 0), true);
  const carga = partes.map(p => p.reduce((a, f) => a + (pesos[f] ?? 10), 0)), media = carga.reduce((a, b) => a + b, 0) / n;
  eq(`en ${n} partes: parejas (ninguna lleva más del 15 % de la media: ${carga.map(Math.round).join(" / ")} s)`, Math.max(...carga) <= media * 1.15 + 120, true);
}
eq("es determinista: dos veces lo mismo", lista(repartir("2/4", todas)), lista(repartir("2/4", todas)));
eq("una prueba nueva (que todavía no está en pesos.txt) también se reparte, en una sola parte",
   [1, 2, 3, 4].map(i => lista(repartir(`${i}/4`, [...todas, "nueva_test.mjs"])).filter(f => f === "nueva_test.mjs").length).reduce((a, b) => a + b, 0), 1);
for(const mal of ["0/4", "5/4", "x", "2/0", "2/", "/4", "a/b", "1"]){
  const r = repartir(mal, todas);
  eq(`«${mal}» no es una parte válida: se queja y no imprime nada`, [r.status !== 0, r.stdout], [true, ""]);
}
// Cada archivo de pesos.txt existe (un peso de una prueba borrada ensucia el reparto) y toda prueba tiene el suyo.
eq("pesos.txt no nombra pruebas que ya no existen", Object.keys(pesos).filter(f => !todas.includes(f)), []);
eq("pesos.txt tiene a todas las pruebas (si falta alguna, correr medir_tiempos.sh)", todas.filter(f => !(f in pesos)), []);
// El corredor de verdad: la parte 1/4 corre solo sus archivos y se lo dice (con un nombre que no existe, no corre nada).
const r = spawnSync("bash", ["-c", "SHARD=9/4 ./correr.sh acceso_aviso 2>&1 | tail -2"], { cwd: aqui, encoding: "utf-8" });
eq("el corredor con una parte inválida se cae con un mensaje (no da el visto bueno)", /no es una parte válida/.test(r.stdout), true);
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
