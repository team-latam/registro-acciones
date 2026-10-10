/* ======================================================================
   El texto del segundo pedido de acceso, igual en la app y en la base
   (auditoría del 10/10/2026, R20)

   Quien no es admin ya no escribe texto libre en el registro de actividad:
   la política `audit_crear` (supabase/02-politicas.sql) acepta `detail`
   vacío o, en `access_requested`, solo los cuatro textos con que la app
   anota que alguien pidió acceso de nuevo tras un rechazo
   (requestAccessAgain, en index.html). Como la app anota la auditoría sin
   frenar lo que está haciendo, si alguien cambia el texto en un lado y no
   en el otro, la base lo rechaza y la entrada se pierde EN SILENCIO. Esta
   prueba compara los dos lados.
   ====================================================================== */
import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
const RAIZ = __aRuta(new URL("..", import.meta.url));
const html = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const sql = fs.readFileSync(process.env.POLITICAS || RAIZ + "supabase/02-politicas.sql", "utf8");

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Los cuatro textos de la app: logAudit("access_requested", { detail:t("es","en","pt","he") }).
const app = (html.match(/logAudit\("access_requested",\s*\{\s*detail:\s*t\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/) || []).slice(1);
eq("la app anota el segundo pedido de acceso con un texto en los cuatro idiomas", app.length, 4);
// Los de la política: la lista `detail in ( 'a', 'b', ... )` de audit_crear.
const lista = (sql.match(/type = 'access_requested' and detail in \(([\s\S]*?)\)\)\)/) || [, ""])[1];
const base = [...lista.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"));
eq("la política de la base acepta exactamente esos cuatro, ni uno más ni uno menos", [...base].sort(), [...app].sort());
console.log(`${pass} pasaron, ${fail} fallaron`);
