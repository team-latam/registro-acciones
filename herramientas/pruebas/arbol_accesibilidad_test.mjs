/* ======================================================================
   Todo control tiene nombre en el árbol de accesibilidad (auditoría del 28/10/2026, T7)

   Mide lo que ve un lector de pantalla: el ÁRBOL DE ACCESIBILIDAD de Chrome
   (Accessibility.getFullAXTree), en cada pantalla de la app (compu y celular, con la
   cuenta de admin, que ve todas). Un botón, un enlace o un campo sin nombre se
   anuncia solo como «cuadro de texto» o «número»: no se sabe qué es.
   El 28/10/2026 había: los tres topes de «Adjuntos», los nombres de las zonas, el
   nombre y el ícono de un tipo de actividad, el nombre de un hito, y los selectores
   y casillas de «Mis preferencias». Ahora no queda ninguno.
   (Las ✕ sueltas y el alt de la foto del visor las vigila nombres_accesibles_test, de la auditoría del 10/10.)
   Los campos que toman su nombre del placeholder (el cuadro de publicar) cuentan:
   Chrome los nombra con él.
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, recorrerApp } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ROLES = new Set(["button", "link", "textbox", "searchbox", "spinbutton", "combobox", "checkbox", "radio", "switch", "tab", "menuitem", "slider", "listbox"]);

const b = await abrirNavegador();
for(const [nombre, vp] of [["compu", { width: 1440, height: 900 }], ["celular", { width: 390, height: 844 }]]){
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Accessibility.enable"); await cdp.send("DOM.enable");
  const sinNombre = new Map(); let vistas = 0, medidos = 0;
  await recorrerApp(p, async (p, vista) => {
    vistas++;
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    for(const n of nodes){
      if(n.ignored || !n.role || !ROLES.has(n.role.value)) continue;
      medidos++;
      if(((n.name && n.name.value) || "").trim()) continue;
      let quien = n.role.value;
      try {
        const d = await cdp.send("DOM.describeNode", { backendNodeId: n.backendDOMNodeId });
        const at = {}; (d.node.attributes || []).forEach((v, i, l) => { if(i % 2 === 0) at[v] = l[i + 1]; });
        quien = `${n.role.value} <${d.node.localName}${at.id ? "#" + at.id : ""}${at.class ? "." + String(at.class).split(" ")[0] : ""}${at["data-action"] ? " [" + at["data-action"] + "]" : ""}${at["data-pref"] ? " [pref " + at["data-pref"] + "]" : ""}${at.type ? " " + at.type : ""}>`;
      } catch(e) { /* el nodo ya no está */ }
      const clave = quien + " · " + vista;
      sinNombre.set(clave, (sinNombre.get(clave) || 0) + 1);
    }
  });
  eq(`[${nombre}] la prueba midió algo (más de 40 pantallas y 1.500 controles)`, vistas > 40 && medidos > 1500, true);
  eq(`[${nombre}] ningún control queda sin nombre para el lector de pantalla`, [...sinNombre.keys()].slice(0, 20), []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
