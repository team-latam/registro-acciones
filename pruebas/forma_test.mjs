import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Datos con forma rara y nombres bien escritos (docs/AUDITORIA.md, B5)

   - La base guarda los lugares y los hitos como jsonb sin forma fija: un
     lugar de tipo desconocido pintaba un chip vacío, un hito sin nombre
     "undefined", un responsable que no era texto "[object Object]". Se
     ordenan al leerlos (formaDeLugares, formaDeHitos).
   - Las ciudades de la lista se guardaron sin tildes ("Cordoba"): se
     siguen guardando así, pero se muestran bien escritas.
   - Un correo con mayúsculas es la misma persona.
   Corre el código del index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };

let api = {}, idioma = "es";
try{
  api = new Function("ctx", `
    const currentLang = () => ctx.idioma();
    const state = ctx.state;
    ${["hasOwn","textoSano","formaDeLugares","formaDeHitos","DEFAULT_CITY_LABELS","CIUDAD_BIEN_ESCRITA","cityLabel","memberByEmail"].map(grab).join("\n")}
    return { formaDeLugares, formaDeHitos, cityLabel, memberByEmail };`)({
      idioma: () => idioma,
      state: { roster: [{ email: "ana@x.com", name: "Ana", nickname: "ana" }], formerMembers: [{ email: "vieja@x.com", name: "Vieja" }] },
    });
}catch(e){ console.log("no se pudo armar:", e.message); }
const llamar = (f, ...x) => { try{ return api[f](...x); }catch(e){ return "no existe " + f; } };
const lista = v => Array.isArray(v) ? v : [];

/* ---------- Lugares ---------- */
eq("los lugares buenos pasan tal cual",
  llamar("formaDeLugares", [{ type:"todo" }, { type:"region", region:"sur" }, { type:"pais", country:"Chile" }, { type:"ciudad", country:"Argentina", city:"Cordoba" }]),
  [{ type:"todo" }, { type:"region", region:"sur" }, { type:"pais", country:"Chile" }, { type:"ciudad", country:"Argentina", city:"Cordoba" }]);
eq("uno de tipo desconocido, sin datos o que no es un objeto, se va",
  llamar("formaDeLugares", [{ type:"barrio", name:"X" }, { type:"pais" }, { type:"region", region:{ a:1 } }, null, "Chile", 3]), []);
eq("una ciudad sin ciudad queda como su país", llamar("formaDeLugares", [{ type:"ciudad", country:"Perú" }]), [{ type:"pais", country:"Perú" }]);
eq("algo que no es una lista, lista vacía", [llamar("formaDeLugares", null), llamar("formaDeLugares", { type:"todo" })], [[], []]);

/* ---------- Hitos ---------- */
eq("un hito bueno pasa con sus datos",
  llamar("formaDeHitos", [{ id:"h1", label:"Entrega", date:"2026-10-01", done:true, owners:["Ana"] }]),
  [{ id:"h1", label:"Entrega", date:"2026-10-01", done:true, owners:["Ana"] }]);
eq("sin nombre ni fecha: textos vacíos, no undefined",
  llamar("formaDeHitos", [{ id:"h2" }]), [{ id:"h2", label:"", date:"", done:false }]);
eq("un responsable que no es texto no pinta [object Object]",
  lista(llamar("formaDeHitos", [{ id:"h3", label:"X", owner:{ nombre:"Ana" } }, { id:"h4", label:"Y", owners:["Ana", null, { a:1 }, "Juan"] }]))
    .map(h => h.owners), [[], ["Ana", "Juan"]]);
eq("el responsable suelto de antes pasa a la lista",
  lista(llamar("formaDeHitos", [{ id:"h5", label:"Z", owner:"Ana" }]))[0], { id:"h5", label:"Z", date:"", done:false, owners:["Ana"] });
eq("lo que no es un hito se va", lista(llamar("formaDeHitos", [null, "hito", 4, { id:"h6", label:"ok" }])).length, 1);

/* ---------- Nombres bien escritos ---------- */
eq("Córdoba y Tucumán, con tilde", [llamar("cityLabel", "Argentina", "Cordoba"), llamar("cityLabel", "Argentina", "Tucuman")], ["Córdoba", "Tucumán"]);
eq("y una sin traducción también", [llamar("cityLabel", "Colombia", "Bogota"), llamar("cityLabel", "Paraguay", "Asuncion")], ["Bogotá", "Asunción"]);
idioma = "pt";
eq("en otro idioma manda su traducción", llamar("cityLabel", "Brasil", "Sao Paulo"), "São Paulo");
idioma = "he";
eq("en hebreo, la suya", llamar("cityLabel", "Argentina", "Cordoba"), "קורדובה");
idioma = "es";
eq("una escrita por alguien queda como la escribió", llamar("cityLabel", "Argentina", "Villa Gesell"), "Villa Gesell");

/* ---------- Mayúsculas en el correo ---------- */
eq("Ana@X.com es Ana", (llamar("memberByEmail", "Ana@X.com") || {}).name, "Ana");
eq("y alguien que ya no está, también", (llamar("memberByEmail", "VIEJA@x.com") || {}).former, true);
eq("un correo que no es de nadie, nada", llamar("memberByEmail", "otro@x.com"), null);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
