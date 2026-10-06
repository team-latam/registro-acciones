/* ======================================================================
   Las herramientas de la auditoría siguen andando (y detectando)

   Las de auditoria/herramientas/ no corren en cada push (tardan): esto
   corre las tres que leen el código (textos, codigo, seguridad) sobre el
   index.html de verdad y sobre una copia rota a propósito, para que no se
   pudran sin que nadie se entere. La copia rota tiene un botón sin quién lo
   atienda, un texto con un {marcador} perdido en inglés y un dato metido al
   HTML sin esc(): las tres tienen que verlo.
   ====================================================================== */
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath as __aRuta } from "node:url";
const RAIZ = __aRuta(new URL("..", import.meta.url));
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const correr = (herramienta, index) => {
  const salida = fs.mkdtempSync(os.tmpdir() + "/auditoria-");
  execFileSync("node", [RAIZ + `auditoria/herramientas/${herramienta}.mjs`], { env: { ...process.env, SALIDA: salida, INDEX: index }, stdio: "pipe" });
  return JSON.parse(fs.readFileSync(`${salida}/${herramienta}.json`, "utf8")).hallazgos;
};
const INDEX = process.env.INDEX || RAIZ + "index.html";
const roto = os.tmpdir() + "/auditoria-roto.html";
fs.writeFileSync(roto, fs.readFileSync(INDEX, "utf8")
  .replace('data-action="toggle-fab"', 'data-action="toggle-fab-sin-dueno"')
  .replace('"Escribí una fecha primero, por ejemplo {e}.","Type a date first, e.g. {e}."', '"Escribí una fecha primero, por ejemplo {e}.","Type a date first."')
  .replace('<span class="lk-txt"><b>${esc(u.name)}</b>', '<span class="lk-txt"><b>${u.name}</b>'));

for(const h of ["textos", "codigo", "seguridad"]){
  let bien = null;
  try{ bien = correr(h, INDEX); }catch(e){ bien = "se cayó: " + String(e.stderr || e).slice(0, 200); }
  eq(`${h}: corre sobre el index.html de verdad`, Array.isArray(bien), true);
}
const r = { codigo: correr("codigo", roto), textos: correr("textos", roto), seguridad: correr("seguridad", roto) };
eq("codigo: ve un botón sin quién lo atienda", r.codigo.some(x => /toggle-fab-sin-dueno/.test(x.que)), true);
eq("textos: ve un {marcador} perdido", r.textos.some(x => /marcadores/.test(x.que) && /Type a date first\./.test(x.detalle)), true);
eq("seguridad: ve un nombre metido al HTML sin esc()", r.seguridad.some(x => /sin esc/.test(x.que) && /u\.name/.test(x.detalle)), true);
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
