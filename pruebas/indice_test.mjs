import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   El posteo de cada evento de Calendar, sin recorrer la lista entera
   (docs/AUDITORIA.md, B8). Tiene que dar lo mismo que el find() de antes:
   el primero que tenga ese evento, y lo de la lista de AHORA aunque se
   haya reemplazado. Corre el código del index.html de verdad.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };

const state = { posts: [] };
let buscar = () => "no existe postDeEvento";
try{ buscar = new Function("state", `${grab("indicePorEvento")}\n${grab("postDeEvento")}\nreturn postDeEvento;`)(state); }catch(e){}
const id = ev => { const p = buscar(ev); return p && typeof p === "object" ? p.id : p; };

state.posts = [{ id:"a", calendarEventId:"ev1" }, { id:"b" }, { id:"c", calendarEventId:"ev2" }, { id:"d", calendarEventId:"ev1" }];
eq("encuentra el posteo de un evento", id("ev2"), "c");
eq("con dos del mismo evento, el primero (como find)", id("ev1"), "a");
eq("un evento sin posteo, nada", id("ev9"), undefined);
eq("sin evento, nada (no el primer posteo sin Calendar)", [id(undefined), id("")], [undefined, undefined]);
state.posts = [{ id:"e", calendarEventId:"ev9" }, { id:"c2", calendarEventId:"ev2" }];
eq("cuando la lista se reemplaza, busca en la nueva", [id("ev9"), id("ev2"), id("ev1")], ["e", "c2", undefined]);

// Y el sincronizador ya no recorre la lista por cada evento.
const cuerpo = grab("applyCalendarEventToPosts");
eq("applyCalendarEventToPosts usa el índice", /postDeEvento\(ev\.id\)/.test(cuerpo) && !/state\.posts\.find\(p => p\.calendarEventId ===/.test(cuerpo), true);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
