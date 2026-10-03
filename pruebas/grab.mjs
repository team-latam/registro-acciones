import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* Sacar una declaración entera de index.html, para probar el código de
   verdad en vez de una copia a mano (que ya me mintió tres veces).

   Recorre el código como el lenguaje: una pila de contextos (template
   adentro de código adentro de template, las veces que haga falta), con
   comillas, escapes, comentarios de bloque y de línea, y expresiones
   regulares.

   Las expresiones regulares fueron lo último que faltó, y aparecieron en la
   función más usada del archivo: esc() tiene /[&<>"']/g, con una comilla
   doble y una simple adentro, y sin reconocerla el extractor las tomaba
   como el principio de dos strings y se iba hasta el final del archivo.
   Para saber si una / abre una expresión o es una división se mira lo
   anterior: después de un valor (un nombre, un número, un paréntesis que
   cierra) es división; después de un operador, una coma, o palabras como
   return o typeof, es una expresión regular. Es la regla de los
   resaltadores de sintaxis, y alcanza para todo este archivo.

   Es el gemelo de extractor.py: los dos tienen que hacer lo mismo, y hay
   una prueba (extractor_test.mjs) que lo exige. */

// Después de esto, una / abre una expresión regular; después de cualquier
// otra cosa —un nombre, un número, un ) o un ]— es una división.
const REGEX_DESPUES = new Set("(,=:[!&|?{};+-*%<>~^");
const REGEX_DESPUES_DE = new Set(["return","typeof","case","do","else","in","of","new",
                                  "delete","void","throw","instanceof","yield","await"]);

// Si en i empieza una expresión regular, dónde termina (con las banderas).
// Si no se puede cerrar en la misma línea, -1: era una división.
function finDeRegex(txt, i){
  let j = i + 1, enClase = false;
  while(j < txt.length){
    const c = txt[j];
    if(c === "\\"){ j += 2; continue; }
    if(c === "\n") return -1;
    if(enClase){ if(c === "]") enClase = false; }
    else if(c === "[") enClase = true;
    else if(c === "/"){
      j++;
      while(j < txt.length && /[A-Za-z]/.test(txt[j])) j++;
      return j;
    }
    j++;
  }
  return -1;
}

// Camina el código desde `desde` y devuelve solo los caracteres que son
// código, cada uno con la profundidad de ( [ { en ese punto.
export function* recorrer(txt, desde = 0){
  const pila = [], marcas = [];
  let prof = 0, i = desde, ultimo = null, palabra = "";
  const n = txt.length;
  while(i < n){
    const c = txt[i];
    if(pila.length && pila[pila.length-1] === "tpl"){          // adentro de `...`
      if(c === "\\"){ i += 2; continue; }
      if(c === "`"){ pila.pop(); i++; ultimo = "`"; palabra = ""; continue; }
      if(c === "$" && txt[i+1] === "{"){                       // y acá vuelve a ser código
        pila.push("sub"); marcas.push(prof); prof++; i += 2; ultimo = "{"; palabra = ""; continue;
      }
      i++; continue;
    }
    if(c === '"' || c === "'"){                                // string común
      const q = c; i++;
      while(i < n){
        if(txt[i] === "\\"){ i += 2; continue; }
        if(txt[i] === q){ i++; break; }
        i++;
      }
      ultimo = q; palabra = ""; continue;
    }
    if(c === "`"){ pila.push("tpl"); i++; continue; }
    if(c === "/" && txt[i+1] === "/"){ const j = txt.indexOf("\n", i); i = j < 0 ? n : j; continue; }
    if(c === "/" && txt[i+1] === "*"){ const j = txt.indexOf("*/", i); i = j < 0 ? n : j + 2; continue; }
    if(c === "/" && (ultimo === null || REGEX_DESPUES.has(ultimo) || REGEX_DESPUES_DE.has(palabra))){
      const fin = finDeRegex(txt, i);
      if(fin >= 0){ i = fin; ultimo = "/"; palabra = ""; continue; }
    }
    if("([{".includes(c)){ yield [i, c, prof]; prof++; i++; ultimo = c; palabra = ""; continue; }
    if(")]}".includes(c)){
      prof--;
      if(marcas.length && pila[pila.length-1] === "sub" && prof === marcas[marcas.length-1]){
        marcas.pop(); pila.pop(); i++; continue;                // este } cierra un ${
      }
      yield [i, c, prof]; i++; ultimo = c; palabra = ""; continue;
    }
    if(!/\s/.test(c)){
      palabra = /[A-Za-z0-9_$]/.test(c) ? palabra + c : "";
      ultimo = c;
    }
    yield [i, c, prof]; i++;
  }
  if(pila.length || prof) throw new SyntaxError(`quedó abierto: pila=${pila} prof=${prof}`);
}

export function balanceada(txt){
  try{ for(const _ of recorrer(txt)){} return true; }
  catch{ return false; }
}

export function hacerGrab(src){
  return function grab(name){
    const m = new RegExp(`\\n(?:function|async function|const|let) ${name}\\s*[=(]`).exec(src);
    if(!m) throw new Error("no se encontró " + name);
    const desde = m.index + m[0].length - 1;
    const finLinea = src.indexOf("\n", desde);
    if(balanceada(src.slice(desde, finLinea + 1))) return src.slice(m.index + 1, finLinea + 1);
    for(const [j, c, prof] of recorrer(src, desde)){
      if(!")]}".includes(c) || prof !== 0) continue;
      const sigue = src.slice(j + 1).match(/^\s*(..?)/);
      const proximo = sigue ? sigue[1][0] : "";
      const yElSiguiente = sigue ? (sigue[1][1] || "") : "";
      // Con ; pegado, la declaración terminó.
      if(proximo === ";") return src.slice(m.index + 1, j + 1 + sigue[0].indexOf(";") + 1);
      // Un /* o un // después del cierre NO es una división: es el
      // comentario de lo que viene después. Tomarlo como continuación
      // hacía que grab() siguiera de largo y se trajera la declaración
      // SIGUIENTE pegada — y el error aparecía como "ya está declarado",
      // en otro lado y sin relación aparente.
      if(proximo === "/" && (yElSiguiente === "/" || yElSiguiente === "*")) return src.slice(m.index + 1, j + 1);
      // Si lo que sigue puede continuar la expresión, todavía no terminó.
      // Los dos casos que importan: la lista de parámetros de una función
      // (sigue el { del cuerpo) y un .join/.map pegado a un array o a un
      // paréntesis — ahí cerrar acá devuelve media declaración.
      if(".([{+-*/?:|&,".includes(proximo)) continue;
      return src.slice(m.index + 1, j + 1);
    }
    throw new Error("no cerró " + name);
  };
}

// El cuerpo de un handler de la tabla de acciones del despachador, tal
// cual está en index.html. Una prueba que se escribe su propio handler no
// prueba el que aprieta la gente. Gemelo de cuerpo_click() en
// extractor.py, con la misma expresión: extractor_test.mjs exige que los
// dos saquen lo mismo de cada handler del archivo.
export function hacerCuerpoClick(src){
  return function cuerpoClick(nombre){
    const literal = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`"${literal}": async \\(el, e, action, postId\\) => \\{\\n([\\s\\S]*?)\\n  \\},\\n`).exec(src);
    if(!m) throw new Error("no se encontró el handler " + nombre);
    return m[1];
  };
}

// El cuerpo de un listener sin nombre (el submit de un formulario, por
// ejemplo): desde la { que cierra `cabeza` hasta la que la cierra, con el
// mismo recorrido que usa grab(). Solo existe en JavaScript: ningún
// armador de Python lo necesita.
export function cuerpoDeListener(src, cabeza){
  const i = src.indexOf(cabeza);
  if(i < 0) throw new Error("no se encontró " + cabeza);
  const abre = i + cabeza.length - 1;
  for(const [j, c, prof] of recorrer(src, abre)) if(c === "}" && prof === 0) return src.slice(abre + 1, j);
  throw new Error("no cerró " + cabeza);
}
