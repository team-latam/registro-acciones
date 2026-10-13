/* ======================================================================
   Las tablas de «Todos los años» en modo oscuro (pedido del usuario,
   8/10/2026)

   Las celdas van de menos a más con un tono (.rep-h1 a .rep-h4). Los
   fondos eran fijos y claros, pensados para el modo claro: en oscuro la
   letra es clara, y los números quedaban claro sobre claro, invisibles;
   la tabla, manchones blancos sobre la tarjeta oscura.

   Mide el contraste entre el número y su fondo en cada tono (en celdas de
   prueba con cada uno y en las celdas reales de Reportes), en claro, en
   oscuro y en papel (siempre en claro, aunque la app esté en oscuro).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// El contraste de cada celda: su letra contra su fondo (si es
// transparente, el de la tarjeta). Mínimo 3, el de un número en negrita.
const contrastes = p => p.evaluate(() => {
  const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const c = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };
  const fondo = e => { for(let x = e; x; x = x.parentElement){ const c = rgb(getComputedStyle(x).backgroundColor); if(c.length < 4 || c[3] > 0) return c.slice(0, 3); } return [255, 255, 255]; };
  // Una celda de prueba por tono, dentro de la tabla real (mismas reglas).
  const tabla = document.querySelector(".rep-evolucion tbody");
  const fila = document.createElement("tr"); fila.id = "filaDePrueba";
  fila.innerHTML = "<td>prueba</td>" + [0, 1, 2, 3, 4].map(n => `<td class="rep-h${n}">${n * 7}</td>`).join("");
  tabla.append(fila);
  const celdas = [...document.querySelectorAll(".rep-evolucion td[class^='rep-h']")];
  const out = celdas.map(td => {
    const a = lum(rgb(getComputedStyle(td).color)), b = lum(fondo(td));
    return { tono: td.className, prueba: !!td.closest("#filaDePrueba"), c: Math.round((Math.max(a, b) + .05) / (Math.min(a, b) + .05) * 10) / 10, fondo: fondo(td) };
  });
  fila.remove();
  return out;
});

const b = await abrirNavegador();
for(const oscuro of [false, true]){
  const modo = oscuro ? "en oscuro" : "en claro";
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 800 }, dark: oscuro });
  await tab(p, "reportes"); await p.waitForTimeout(300);
  await p.selectOption("#repAnio", "todos"); await p.waitForTimeout(300);
  const cs = await contrastes(p);
  eq(`${modo}: hay celdas reales con tono que medir`, cs.filter(x => !x.prueba && x.tono !== "rep-h0").length > 0, true);
  eq(`${modo}: los cinco tonos de prueba se miden`, cs.filter(x => x.prueba).map(x => x.tono), ["rep-h0", "rep-h1", "rep-h2", "rep-h3", "rep-h4"]);
  eq(`${modo}: todos los números se leen sobre su tono (contraste de 3 o más)`, cs.filter(x => x.c < 3).map(x => `${x.tono}${x.prueba ? " (prueba)" : ""}: ${x.c}`), []);
  if(oscuro){
    // Ningún tono en blanco sobre la tarjeta oscura: el más claro, el de más
    // actividad, igual es celeste, no casi blanco.
    eq("en oscuro: ningún tono es casi blanco", cs.filter(x => x.prueba && x.fondo.every(v => v > 220)).map(x => x.tono), []);
    // En papel, siempre los tonos claros.
    await p.emulateMedia({ media: "print" }); await p.waitForTimeout(100);
    const papel = await contrastes(p);
    eq("en papel (con la app en oscuro): los tonos claros de siempre", papel.filter(x => x.prueba).map(x => x.fondo.join(",")),
      ["255,255,255", "230,246,249", "191,233,242", "127,211,230", "26,159,184"]);
    eq("en papel: todos los números se leen", papel.filter(x => x.c < 3).map(x => `${x.tono}: ${x.c}`), []);
  }
  eq(`${modo}: sin un solo error en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
