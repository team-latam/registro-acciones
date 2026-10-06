import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
import { hacerGrab } from "./grab.mjs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
/* ======================================================================
   Cinco endurecimientos chicos (docs/AUDITORIA.md, M11)
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const g = hacerGrab(src);
const grab = n => { try{ return g(n); }catch(e){ return ""; } };
const fn = (nombre, ...deps) => { try{ return new Function(`${deps.map(grab).join("\n")}\n${grab(nombre)}\nreturn ${nombre};`)(); }catch(e){ return () => "no existe " + nombre; } };

// 1. Las planillas que bajan los admins no ejecutan fórmulas.
const celda = fn("celdaCsv");
eq("un título que empieza con = queda como texto", celda('=HYPERLINK("http://x","clic")'), `"'=HYPERLINK(""http://x"",""clic"")"`);
eq("lo mismo con + - @", [celda("+1+2"), celda("-cmd"), celda("@SUM(A1)")], [`"'+1+2"`, `"'-cmd"`, `"'@SUM(A1)"`]);
eq("los números negativos van tal cual", [celda("-3"), celda("-2,5"), celda(7)], [`"-3"`, `"-2,5"`, `"7"`]);
eq("lo común no cambia", celda("Visita a Lima"), `"Visita a Lima"`);
eq("las tres planillas usan esa celda", ["csvDePersonas", "csvDelRegistro", "csvDelReporte"].map(n => /celdaCsv\(/.test(grab(n))), [true, true, true]);

// 2. La foto de una persona: solo la de Google.
const foto = fn("fotoSegura");
eq("la foto de Google pasa", foto("https://lh3.googleusercontent.com/a/x=s96-c"), "https://lh3.googleusercontent.com/a/x=s96-c");
eq("una de otro sitio no (era un píxel que contaba cuándo un admin abría Personas)", [foto("https://rastreo.example.com/p.gif"), foto("https://googleusercontent.com.example.com/x"), foto("http://lh3.googleusercontent.com/x"), foto("javascript:alert(1)"), foto("")], ["", "", "", "", ""]);
eq("la lista de solicitudes la usa", /fotoSegura\(r\.photoURL\)/.test(src), true);

// 3. El ícono de un tipo (lo escribe un admin) va escapado en todos lados.
eq("ningún ícono de tipo sin escapar", (src.match(/\$\{(type|ty|it)\.icon\}/g) || []), []);

// 4. El error que devuelve Google al pasar eventos va escapado.
eq("el motivo de Google se escapa antes de ir al HTML", /m:esc\(f\.fallados\[0\]\.motivo\)/.test(src), true);

// 5. Al quedar sin sesión por cualquier lado se olvida el permiso de Calendar.
eq("onAuthChanged sin persona olvida el permiso de Calendar", /if\(!user\)\{[\s\S]{0,600}?olvidarPermisoDeCalendar\(\)/.test(grab("onAuthChanged")), true);
eq("y ese olvido borra el token guardado y para el sondeo", ["sessionStorage.removeItem(CALENDAR_TOKEN_STORAGE_KEY)", "stopCalendarAutoSync()", "calendarAccessToken = null"].every(x => grab("olvidarPermisoDeCalendar").includes(x)), true);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
