/* ======================================================================
   Nada se corta (pedido del usuario, 6/10/2026)

   Recorre la app en escritorio y en celular (también en hebreo): cada
   vista, cada ventana y cada sección de Administración. En cada una mide
   todo botón, campo, enlace y chip, y el anillo de foco de cada uno (como
   cuando se usa el teclado). Falla si algo queda cortado por el borde de
   una zona que lo recorta (salvo un carrusel que se desplaza a propósito),
   si se sale de la pantalla, o si la página entera se corre de costado.
   Así nació: el anillo del cuadro de comentarios cortado a la izquierda,
   el panel de filtros de Reportes saliéndose, y en hebreo la página
   corrida 100 px al abrir un filtro.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, revisarRecortes, recorrerApp } from "./app_de_mentira.mjs";

const b = await abrirNavegador();
// Escritorio, un celular común y uno chico; el celular también en hebreo
// (de derecha a izquierda: ahí apareció lo que en español no se ve).
const CONFIG = (process.env.TAMANOS || "1280x800:es,390x844:es,320x640:es,390x844:he").split(",").map(x => { const [tam, lang] = x.split(":"); const [w, h] = tam.split("x").map(Number); return { vp: { width: w, height: h }, lang }; });
const todas = [];
const errores = [];
for(const { vp, lang } of CONFIG){
  const tam = vp.width + "x" + vp.height + (lang !== "es" ? " " + lang : "");
  const { p, errores: err } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, lang: lang === "es" ? "" : lang });
  await recorrerApp(p, async (p, n) => { todas.push(...await revisarRecortes(p, tam + " · " + n)); });
  errores.push(...err.map(x => tam + ": " + x));
  await p.close();
}
// Una línea por problema distinto (el mismo en varios estados, junto).
const grupos = new Map();
for(const f of todas){ const k = f.tipo + " | " + (f.el || "") + " | " + (f.por || ""); if(!grupos.has(k)) grupos.set(k, { ...f, donde: [] }); grupos.get(k).donde.push(f.estado); }
let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
eq("nada cortado ni fuera de la pantalla, en ninguna vista ni ventana", [...grupos].map(([k, g]) => k + " (" + g.donde.length + ": " + g.donde.slice(0, 2).join(" / ") + ")"), []);
eq("sin un solo error en la página", errores, []);
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
