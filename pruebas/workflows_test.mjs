import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
/* ======================================================================
   Los workflows de GitHub: las reglas que no se pueden aflojar

   Hasta el 6/10/2026 las acciones iban por etiqueta (`@v4`): GitHub
   avisaba en cada corrida que eran de Node 20, ya viejo, y una etiqueta
   la puede mover quien controle esa acción. Ahora:
   - cada acción va fijada por su huella (40 letras de su commit), con la
     versión en un comentario para saber cuál es;
   - cada workflow declara sus permisos (si no, hereda los del repo);
   - cada trabajo tiene un tiempo máximo (si no, uno trabado corre 6 horas);
   - checkout no deja guardada la llave de GitHub en la carpeta
     (persist-credentials: false): ningún paso la necesita;
   - donde hay llaves de verdad, setup-node no usa el caché de npm, que se
     comparte entre corridas y lo puede llenar una rama cualquiera;
   - nada de lo que escribe una persona (los campos del botón «Run
     workflow», el título de un PR) se pega directo en un `run:`: va por
     `env:`.
   WORKFLOWS=/otra/carpeta corre esto contra una copia (para ver que falla).
   ====================================================================== */
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const DIR = process.env.WORKFLOWS || RAIZ + ".github/workflows";
const flujos = fs.readdirSync(DIR).filter(f => /\.ya?ml$/.test(f)).map(f => ({ f, y: fs.readFileSync(`${DIR}/${f}`, "utf8") }));
eq("hay workflows para revisar", flujos.length >= 8, true);

// Los trabajos de cada workflow: el texto desde "  nombre:" hasta el siguiente.
function trabajos(y){
  const desde = y.search(/^jobs:\s*$/m);
  if(desde < 0) return [];
  const partes = y.slice(desde).split(/\n(?=  [A-Za-z0-9_-]+:\s*$)/m).slice(1);
  return partes.map(t => ({ nombre: t.match(/^  ([A-Za-z0-9_-]+):/)[1], t }));
}
// Cada "uses:" con lo que sigue en su mismo paso.
function pasos(t){
  return t.split(/\n(?=\s+- )/).filter(p => /^\s+- /.test(p));
}

const sinHuella = [], sinVersion = [], sinPermisos = [], sinTiempo = [], conLlaveGuardada = [], cacheConLlaves = [], pegado = [];
for(const { f, y } of flujos){
  for(const m of y.matchAll(/^\s*(?:- )?uses:\s*(\S+)(.*)$/gm)){
    const [, ref, resto] = m;
    if(ref.startsWith("./")) continue;             // otro workflow de este repo
    if(!/@[0-9a-f]{40}$/.test(ref)) sinHuella.push(`${f}: ${ref}`);
    else if(!/#\s*v\d+(\.\d+)*/.test(resto)) sinVersion.push(`${f}: ${ref}`);
  }
  if(!/^permissions:/m.test(y)) sinPermisos.push(f);
  const tieneLlaves = t => /secrets\.(?!GITHUB_TOKEN)/.test(t);
  for(const { nombre, t } of trabajos(y)){
    if(/^    runs-on:/m.test(t) && !/^    timeout-minutes:\s*\d+/m.test(t)) sinTiempo.push(`${f}: ${nombre}`);
    for(const p of pasos(t)){
      if(/uses:\s*actions\/checkout@/.test(p) && !/persist-credentials:\s*false/.test(p)) conLlaveGuardada.push(`${f}: ${nombre}`);
      if(/uses:\s*actions\/setup-node@/.test(p) && tieneLlaves(t) && (!/package-manager-cache:\s*false/.test(p) || /cache:\s*npm/.test(p))) cacheConLlaves.push(`${f}: ${nombre}`);
      // Un run: con algo que escribe una persona pegado adentro.
      const run = (p.match(/run:\s*\|?\n?([\s\S]*)/) || [, ""])[1];
      for(const x of run.matchAll(/\$\{\{\s*(github\.event\.inputs\.[\w-]+|inputs\.[\w-]+|github\.event\.(?:pull_request|issue|comment|review|head_commit)\.[\w.]+|github\.head_ref)\s*\}\}/g))
        pegado.push(`${f}: ${nombre}: ${x[1]}`);
    }
  }
}
eq("cada acción de afuera, fijada por su huella (@ y 40 letras)", sinHuella, []);
eq("y con la versión en un comentario (# vX.Y.Z)", sinVersion, []);
eq("cada workflow declara sus permisos", sinPermisos, []);
eq("cada trabajo tiene un tiempo máximo (timeout-minutes)", sinTiempo, []);
eq("checkout sin guardar la llave de GitHub (persist-credentials: false)", conLlaveGuardada, []);
eq("donde hay llaves, setup-node sin caché compartido (package-manager-cache: false)", cacheConLlaves, []);
eq("nada que escribe una persona pegado en un run: (va por env:)", pegado, []);

// Ninguna acción de Node 20: GitHub las dejó de lado (ver arriba). Se
// conoce por la versión mayor de las oficiales que se usan acá.
const minimas = { checkout: 5, "setup-node": 5, "configure-pages": 6, "upload-pages-artifact": 4, "deploy-pages": 5 };
const viejas = [];
for(const { f, y } of flujos)
  for(const m of y.matchAll(/uses:\s*actions\/([\w-]+)@\S+\s*#\s*v(\d+)/g))
    if(minimas[m[1]] && Number(m[2]) < minimas[m[1]]) viejas.push(`${f}: ${m[1]} v${m[2]}`);
eq("ninguna acción oficial en una versión de Node 20", viejas, []);

// Lo que se aplica a la base, copia o sincroniza con las llaves de verdad
// sale solo de main (docs/AUDITORIA.md, U2): el botón «Run workflow» deja
// elegir cualquier rama.
const llavesFueraDeMain = [];
for(const { f, y } of flujos)
  for(const { nombre, t } of trabajos(y))
    if(/secrets\.(?!GITHUB_TOKEN)/.test(t) && !/github\.ref\s*==\s*'refs\/heads\/main'/.test(t)) llavesFueraDeMain.push(`${f}: ${nombre}`);
eq("los trabajos con llaves de verdad solo corren desde main", llavesFueraDeMain, []);

// El sistema de cada runner, fijado (ubuntu-24.04), nunca «-latest»:
// GitHub mueve ubuntu-latest a Ubuntu 26 el 19/10/2026 (lo avisa en cada
// corrida: actions/runner-images#14748) y un cambio de sistema puede
// romper bajar el navegador de las pruebas o el volcado de la base. Subir
// de versión se decide y se prueba, como subir una acción
// (docs/AUDITORIA.md, R5).
const flotantes = [];
for(const { f, y } of flujos)
  for(const m of y.matchAll(/^\s*runs-on:\s*(.+?)\s*$/gm))
    if(/-latest\b/.test(m[1])) flotantes.push(`${f}: ${m[1]}`);
eq("ningún runs-on en «-latest»: el sistema del runner va fijado", flotantes, []);

// Lo que toca el bucket y la base con la llave de servicio (la limpieza
// del bucket, la copia, la restauración) hace cola en el MISMO grupo de
// concurrency: si GitHub atrasa más a la copia que a la limpieza, la
// limpieza movía archivos a la papelera mientras la copia los bajaba
// (docs/AUDITORIA.md, R11). Con el mismo grupo, la segunda espera.
const grupos = f => [...((flujos.find(x => x.f === f) || { y: "" }).y.matchAll(/^\s*group:\s*(\S+)/gm))].map(m => m[1]).join(",");
eq("la limpieza del bucket, la copia y la restauración hacen cola en el mismo grupo (respaldo)",
   ["limpieza.yml", "respaldo.yml", "restaurar.yml"].map(f => `${f}: ${grupos(f)}`),
   ["limpieza.yml: respaldo", "respaldo.yml: respaldo", "restaurar.yml: respaldo"]);

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
