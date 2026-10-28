/* ======================================================================
   En hebreo, los signos y las partes van en el orden de lectura (auditoría del 28/10/2026, T2)

   Un texto se guarda en orden LÓGICO: la primera palabra que se lee es la
   primera que se escribe. En una página de derecha a izquierda, un «?», un
   «.» o unos «...» escritos PRIMERO se pintan en el borde derecho, es decir,
   al principio de la frase, y no al final donde van. Hasta el 28/10/2026 había
   unos 120 textos escritos «como se ven» en vez de «como se leen»:
   «?מה עשית היום» (el cuadro de publicar del Inicio), «.לא ניתן היה לשמור»,
   «...טוען», «{msg} :הפרסום נכשל» (el error salía antes que la frase),
   «(עיר, מדינה) ?מה ההיקף», «{d}-לא מתקיים ב»…

   Reglas (todas sobre el cuarto texto de cada t(es, en, pt, he)):
   1. no empieza con «?», «!», «.», «;», «...» ni «…» pegado a la palabra, ni
      con «:» pegado; un trozo que sigue a otro texto («, por…», «: una está…»,
      «… y 3 más») sí puede empezar con su signo, pero seguido de un espacio;
   2. ningún «{dato} :» (el dato iba antes de los dos puntos y la frase después);
   3. los paréntesis están parejos, y un paréntesis de apertura no va pegado
      a otro («(texto (más»): era la señal de un texto escrito al revés;
   4. un paréntesis al principio que se cierra antes de seguir con más texto
      («(עיר) ?מה ההיקף») está al revés; el que abarca todo («(ללא כותרת)») está bien;
   5. un prefijo con guion («ב-», «ל-», «ו-») no queda al final de un texto
      («שימוש ב-»), ni un texto empieza con un dato pegado a un prefijo
      («{d}-לחזור ל»);
   y dos comprobaciones de que la regla no es capricho: en Chromium un «?»
   escrito primero cae a la derecha del texto y escrito al final, a la izquierda;
   y el cuadro de publicar del Inicio, en hebreo, no tiene el «?» al principio.

   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { abrirNavegador, entrar, ADMIN } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const INDEX = process.env.INDEX || __aRuta(new URL("../../index.html", import.meta.url));
const html = fs.readFileSync(INDEX, "utf8");

// Cada t(es, en, pt, he) con sus cuatro textos entre comillas (", ' o `).
const lit = String.raw`(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\]|\\\\.)*`)";
const re = new RegExp(String.raw`\bt\(\s*(${lit})\s*,\s*(${lit})\s*,\s*(${lit})\s*,\s*(${lit})\s*[,)]`, "g");
const HEB = /[֐-׿]/;
const hebreos = [], vistos = new Set();
for(const m of html.matchAll(re)){
  const he = m[4].slice(1, -1);
  if(!HEB.test(he) || vistos.has(he)) continue;
  vistos.add(he);
  hebreos.push({ linea: html.slice(0, m.index).split("\n").length, he });
}
eq("la prueba ve los textos en hebreo (más de 1.500)", hebreos.length > 1500, true);

const mal = (reglaOk) => hebreos.filter(x => !reglaOk(x.he.trim())).map(x => `L${x.linea}: ${x.he.slice(0, 70)}`);
eq("1. ningún texto en hebreo empieza con un signo de fin de frase (? ! . ; ... …)",
  mal(h => !/^(\.\.\.|…(?! )|[?!.;]|:(?! ))/.test(h)), []);
eq("2. ningún «{dato} :» (los dos puntos van después de la frase, y el dato al final)",
  mal(h => !/\{\w+\} :/.test(h)), []);
eq("3. paréntesis parejos y sin dos de apertura pegados",
  mal(h => (h.match(/\(/g) || []).length === (h.match(/\)/g) || []).length && !/\([^()]*\([^()]*$/.test(h) || false), []);
eq("4. un paréntesis al principio que se cierra antes de seguir con más texto está al revés",
  mal(h => !/^\([^()]*\)\s*[֐-׿]/.test(h)), []);
eq("5. un prefijo con guion no queda al final del texto ni empieza pegado a un dato",
  mal(h => h.length <= 3 || !(/[֐-׿]-$/.test(h) || /^[^֐-׿\s]*[A-Za-z0-9}>]-[֐-׿]/.test(h))), []);

// La regla no es capricho: así los pinta Chromium en un párrafo de derecha a izquierda.
const b = await abrirNavegador();
{
  const p = await b.newPage({ viewport: { width: 400, height: 200 } });
  await p.setContent(`<meta charset=utf-8><div dir=rtl style="font:20px sans-serif;width:300px">
    <span id=a>?מה עשית היום</span><br><span id=b>מה עשית היום?</span></div>`);
  const donde = await p.evaluate(() => {
    const x = id => { const n = document.getElementById(id).firstChild, r = document.createRange(), t = n.textContent;
      const sig = id === "a" ? 0 : t.length - 1; r.setStart(n, sig); r.setEnd(n, sig + 1); const s = r.getBoundingClientRect();
      const o = id === "a" ? t.length - 1 : 0; r.setStart(n, o); r.setEnd(n, o + 1); const w = r.getBoundingClientRect(); return s.left > w.left ? "derecha" : "izquierda"; };
    return { primero: x("a"), alFinal: x("b") };
  });
  eq("en Chromium, un «?» escrito primero se pinta a la derecha de la frase", donde.primero, "derecha");
  eq("y escrito al final, a la izquierda (donde va en hebreo)", donde.alFinal, "izquierda");
  await p.close();
}

// Y en la app de verdad: el cuadro de publicar del Inicio.
{
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "he" });
  const ph = await p.$eval("#rutinaContent", e => e.placeholder);
  eq("en hebreo, el cuadro de publicar pregunta «מה עשית היום?» (el «?» al final)", ph, "מה עשית היום?");
  eq("sin errores en la página", errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
