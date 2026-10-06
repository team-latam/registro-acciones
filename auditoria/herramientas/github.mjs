/* ======================================================================
   GitHub: los workflows y las acciones que usan

   Las reglas fijas (huella, permisos, tiempo máximo, llaves solo desde
   main) las cuida pruebas/workflows_test.mjs en cada corrida. Esto busca
   lo que una prueba no puede saber sola:
   - si salió una versión nueva de alguna acción (pregunta a github.com con
     `git ls-remote`; sin red, lo dice y sigue). Una versión mayor nueva
     suele venir porque la anterior quedó vieja (así llegó el aviso de
     Node 20 del 6/10/2026), y la huella fija no se actualiza sola;
   - actionlint, si está a mano (errores de sintaxis, expresiones mal
     escritas, `run:` con problemas);
   - y deja anotado qué corre solo y cuándo.
   ====================================================================== */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { RAIZ, hallazgo, entregar } from "./comun.mjs";

const out = [];
const DIR = process.env.WORKFLOWS || RAIZ + ".github/workflows";
const flujos = fs.readdirSync(DIR).filter(f => /\.ya?ml$/.test(f)).map(f => ({ f, y: fs.readFileSync(`${DIR}/${f}`, "utf8") }));

// Las acciones fijadas: dueño/nombre, huella y versión del comentario.
const usadas = new Map();
for(const { f, y } of flujos)
  for(const m of y.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([0-9a-f]{40})\s*#\s*v([\d.]+)/g)){
    const k = `${m[1]}@${m[2]}#${m[3]}`;   // la misma acción puede ir en dos versiones
    if(!usadas.has(k)) usadas.set(k, { accion: m[1], huella: m[2], version: m[3], donde: new Set() });
    usadas.get(k).donde.add(f);
  }
const comparar = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for(let i = 0; i < 3; i++){ if((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
let sinRed = false;
for(const u of usadas.values()){
  const accion = u.accion;
  let tags = "";
  try{ tags = execFileSync("git", ["ls-remote", "--tags", `https://github.com/${accion}`], { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "ignore"] }); }
  catch(e){ sinRed = true; continue; }
  const versiones = [...tags.matchAll(/^([0-9a-f]{40})\trefs\/tags\/v(\d+\.\d+\.\d+)$/gm)].map(m => ({ huella: m[1], v: m[2] }));
  if(!versiones.length) continue;
  const ultima = versiones.sort((a, b) => comparar(a.v, b.v)).at(-1);
  const donde = [...u.donde].join(", ");
  if(Number(ultima.v.split(".")[0]) > Number(u.version.split(".")[0]))
    out.push(hallazgo("github", "medio", "Hay una versión mayor nueva de una acción", donde, `${accion}: v${u.version} → v${ultima.v} (${ultima.huella}). Leer qué cambia antes de subir.`));
  else if(comparar(ultima.v, u.version) > 0)
    out.push(hallazgo("github", "bajo", "Hay una versión nueva de una acción", donde, `${accion}: v${u.version} → v${ultima.v} (${ultima.huella})`));
  // La huella tiene que ser la de la versión que dice el comentario.
  const dicha = versiones.find(x => x.v === u.version);
  if(dicha && dicha.huella !== u.huella)
    out.push(hallazgo("github", "importante", "La huella no es la de la versión que dice el comentario", donde, `${accion} v${u.version}: ${u.huella} en el workflow, ${dicha.huella} en GitHub`));
}
if(sinRed) out.push(hallazgo("github", "dato", "Sin red hacia github.com: no se miraron las versiones nuevas de las acciones"));

// actionlint: el del sistema, o se baja una vez de sus releases a la
// carpeta temporal (sin red, se saltea y lo dice).
const ACTIONLINT = "1.7.7";
const enTmp = `${os.tmpdir()}/actionlint-${ACTIONLINT}/actionlint`;
const anda = c => { try{ execFileSync(c, ["-version"], { stdio: "ignore" }); return true; }catch(e){ return false; } };
let al = [process.env.ACTIONLINT, "actionlint", enTmp].filter(Boolean).find(anda);
if(!al && process.platform === "linux"){
  try{
    fs.mkdirSync(`${os.tmpdir()}/actionlint-${ACTIONLINT}`, { recursive: true });
    execFileSync("sh", ["-c", `curl -sSfL https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT}/actionlint_${ACTIONLINT}_linux_amd64.tar.gz | tar xz -C "$(dirname "$1")" actionlint`, "sh", enTmp], { stdio: "ignore", timeout: 60000 });
    if(anda(enTmp)) al = enTmp;
  }catch(e){}
}
if(al){
  try{ execFileSync(al, ["-shellcheck=", "-no-color", ...flujos.map(x => `${DIR}/${x.f}`)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch(e){
    for(const l of String(e.stdout || "").split("\n").filter(l => /:\d+:\d+:/.test(l)))
      out.push(hallazgo("github", "medio", "actionlint marca un problema", l.split(": ")[0].split("/").pop(), l.split(": ").slice(1).join(": ")));
  }
} else out.push(hallazgo("github", "dato", "actionlint no está: no se revisó la sintaxis de los workflows"));

// Lo que corre solo, para tenerlo a la vista (y ver que no se pisen).
for(const { f, y } of flujos)
  for(const m of y.matchAll(/cron:\s*['"]([^'"]+)['"]/g))
    out.push(hallazgo("github", "dato", "Corre solo", f, `${m[1]} (UTC)`));
out.push(hallazgo("github", "dato", `Workflows: ${flujos.length}; acciones de afuera distintas: ${new Set([...usadas.values()].map(u => u.accion)).size}`));
entregar("github", out);
