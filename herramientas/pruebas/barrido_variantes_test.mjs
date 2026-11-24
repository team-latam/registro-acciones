/* ======================================================================
   Barrido de pantallas: el celular chico y el hebreo (24/11/2026)

   Los otros dos recorridos de lo que antes eran recortes_test y hebreo_titulos_test (barrido.mjs
   explica cómo y por qué):
   - un celular chico (320x640): nada se corta;
   - el celular en hebreo (de derecha a izquierda: ahí apareció lo que en español no se ve): nada
     se corta, y ningún rótulo con letras separadas, en mayúsculas ni de menos de 12 px.
   El celular común en español está en barrido_celular_test.mjs y la compu en barrido_compu_test.mjs.
   ====================================================================== */
import { abrirNavegador } from "./app_de_mentira.mjs";
import { barrer } from "./barrido.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const b = await abrirNavegador();
await barrer(b, { nombre: "celular chico 320x640", vp: { width: 320, height: 640 }, revisiones: ["recortes"] }, eq);
await barrer(b, { nombre: "celular he", vp: { width: 390, height: 844 }, lang: "he", revisiones: ["recortes", "hebreo"] }, eq);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
