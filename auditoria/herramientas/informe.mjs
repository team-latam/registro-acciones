/* ======================================================================
   El informe de una corrida

   Junta lo que dejó cada herramienta en SALIDA (<nombre>.json) y el
   resultado de las pruebas (pruebas.txt), y escribe SALIDA/informe.md:
   cuántos hallazgos por área y por nivel, cada uno con dónde, lo ya
   revisado aparte, y la lista de lo que hay que revisar A MANO (lo que
   ninguna herramienta mide; sale de METODO.md). Es la materia prima de
   docs/AUDITORIA.md: quien audita lee, verifica, decide el nivel final y
   escribe las mejoras.
   ====================================================================== */
import fs from "node:fs";
import { RAIZ } from "./comun.mjs";

const SALIDA = process.env.SALIDA;
if(!SALIDA) throw new Error("Falta SALIDA (la carpeta de la corrida).");
const ORDEN = ["urgente", "importante", "medio", "bajo", "opcional", "dato"];
const todos = [], conocidos = [];
for(const f of fs.readdirSync(SALIDA).filter(f => f.endsWith(".json"))){
  const d = JSON.parse(fs.readFileSync(`${SALIDA}/${f}`, "utf8"));
  todos.push(...(d.hallazgos || []).map(h => ({ ...h, herramienta: f.replace(".json", "") })));
  conocidos.push(...(d.conocidos || []));
}
const pruebas = fs.existsSync(`${SALIDA}/pruebas.txt`) ? fs.readFileSync(`${SALIDA}/pruebas.txt`, "utf8").trim() : "(no se corrieron)";
const metodo = fs.readFileSync(RAIZ + "auditoria/METODO.md", "utf8");
const aMano = (metodo.split("## Lo que se revisa a mano")[1] || "").split("\n## ")[0].trim();

const porArea = {};
todos.filter(h => h.nivel !== "dato").forEach(h => { (porArea[h.area] = porArea[h.area] || {})[h.nivel] = ((porArea[h.area] || {})[h.nivel] || 0) + 1; });
let md = `# Informe de la corrida — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC\n\n`;
md += `Lo midieron las herramientas de \`auditoria/\`. No es la auditoría: es lo que hay que verificar y decidir para escribirla (ver METODO.md).\n\n`;
md += `## Las pruebas\n\n\`\`\`\n${pruebas}\n\`\`\`\n\n`;
md += `## Hallazgos por área\n\n| Área | ${ORDEN.slice(0, 5).join(" | ")} |\n|---|${ORDEN.slice(0, 5).map(() => "---").join("|")}|\n`;
Object.entries(porArea).sort().forEach(([a, n]) => { md += `| ${a} | ${ORDEN.slice(0, 5).map(k => n[k] || "").join(" | ")} |\n`; });
if(!Object.keys(porArea).length) md += `| (ninguno) | | | | | |\n`;
for(const nivel of ORDEN){
  const hs = todos.filter(h => h.nivel === nivel);
  if(!hs.length) continue;
  md += `\n## ${nivel === "dato" ? "Datos para seguir (no son problemas)" : nivel[0].toUpperCase() + nivel.slice(1)}\n\n`;
  hs.forEach(h => { md += `- **${h.area}** · ${h.que}${h.donde ? ` — \`${h.donde}\`` : ""}${h.detalle ? ` · ${h.detalle.replace(/\|/g, "\\|")}` : ""} _(${h.herramienta})_\n`; });
}
if(conocidos.length){
  md += `\n## Ya revisados (auditoria/conocidos.json)\n\n`;
  conocidos.forEach(h => { md += `- ${h.que}${h.detalle ? " · " + h.detalle : ""} — ${h.conocido}\n`; });
}
md += `\n## Lo que se revisa a mano\n\n${aMano}\n`;
fs.writeFileSync(`${SALIDA}/informe.md`, md);
console.log(`informe: ${SALIDA}/informe.md (${todos.filter(h => h.nivel !== "dato").length} hallazgos, ${conocidos.length} ya revisados)`);
