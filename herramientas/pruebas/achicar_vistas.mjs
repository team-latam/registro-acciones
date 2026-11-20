/* Ayudante de achicar_test.mjs (no es una prueba: el corredor solo toma *_test.mjs).
   Recorre la app entera (todas las pantallas y ventanas de recorrerApp) y escribe en la salida, en JSON, lo que se
   ve en cada una: el texto y cómo está dibujado cada elemento (color, tamaño, espacios…).
   Se corre dos veces, con INDEX= el fuente y INDEX= la página achicada, y la prueba compara. */
import { abrirNavegador, entrar, ADMIN, recorrerApp } from "./app_de_mentira.mjs";

const [ancho, alto, lang] = process.argv.slice(2);
const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: +ancho, height: +alto }, lang });
await p.waitForTimeout(500);
// Sin animaciones: un color a mitad de una transición no es una diferencia.
await p.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}" });
const pasos = [];
await recorrerApp(p, async (p, nombre) => {
  // Esperar a que la pantalla se asiente (con dos navegadores a la vez, una pantalla puede tardar en terminar de dibujarse).
  let antes = null;
  for(let i = 0; i < 20; i++){ const ahora = await p.evaluate(() => document.body.innerText.length + "|" + document.body.querySelectorAll("*").length); if(ahora === antes) break; antes = ahora; await p.waitForTimeout(150); }
  pasos.push({ nombre, ...(await p.evaluate(() => {
    const PROPS = ["display", "position", "flexDirection", "flexWrap", "alignItems", "justifyContent", "gap", "color", "backgroundColor", "borderTopColor", "borderTopWidth", "borderRadius",
      "fontSize", "fontWeight", "fontFamily", "lineHeight", "letterSpacing", "textAlign", "textTransform", "direction", "whiteSpace", "overflowX", "overflowY", "opacity", "zIndex",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "boxShadow", "cursor", "visibility", "gridTemplateColumns"];
    const lista = [];
    for(const e of document.body.querySelectorAll("*")){
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if(cs.display === "none" || (r.width === 0 && r.height === 0)) continue;
      const nombre = e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
      lista.push([nombre, Math.round(r.width), Math.round(r.height), ...PROPS.map(k => cs[k])].join("|"));
    }
    return { texto: document.body.innerText.replace(/\s+/g, " ").trim(), elementos: lista };
  })) });
});
await b.close();
process.stdout.write(JSON.stringify({ pasos, errores }));
