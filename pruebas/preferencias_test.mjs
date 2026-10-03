import fs from "node:fs";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
const grab = hacerGrab(src);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

/* ======================================================================
   Que lo que cada uno elige en Configuración quede guardado

   Hasta el 3 de octubre de 2026, savePrefs no guardaba nada si no había
   conexión con Firestore (la variable db), y en la pestaña de Supabase no
   la había nunca. El cambio se veía al tocarlo —la pantalla se actualiza
   antes de guardar— pero no llegaba a la base: al recargar, todo volvía a
   como estaba. Nadie lo notó durante la prueba de Supabase justamente por
   eso.

   Acá la función corre sola, con solo lo que de verdad necesita: la
   persona, sus preferencias, la capa de datos y la pantalla. Nada de
   Firebase alrededor. Si vuelve a depender de algo de afuera, se cae.
   ====================================================================== */
function armar({ email = "ana@x.com", falla = null } = {}){
  const reg = { guardado: [], dibujos: 0, avisos: [] };
  const ctx = {
    state: { auth: { user: email ? { email } : null }, prefs: { weekStart: 0, dimPast: false } },
    store: { userPrefs: { merge: async (e, parche) => {
      reg.guardado.push([e, parche]);
      if(falla) throw falla;
    } } },
    render: () => { reg.dibujos++; },
    showCalendarNotice: aviso => { reg.avisos.push(aviso); },
    t: (es, en, pt, he, vars) => es.replace(/\{(\w+)\}/g, (_, k) => vars && k in vars ? vars[k] : `{${k}}`),
    console: { error(){} },
  };
  const savePrefs = new Function("ctx", `
    const { state, store, render, showCalendarNotice, t, console } = ctx;
    ${grab("prefs")}
    ${grab("savePrefs")}
    return savePrefs;
  `)(ctx);
  return { savePrefs, ctx, reg };
}
const esperar = () => new Promise(r => setTimeout(r, 0));

{
  const { savePrefs, ctx, reg } = armar();
  let error = null;
  try{ savePrefs({ weekStart: 1 }); await esperar(); }
  catch(e){ error = e.message; }
  eq("guardar una preferencia no depende de nada de Firebase", error, null);
  eq("se guarda en la base, a nombre de quien la eligió", reg.guardado, [["ana@x.com", { weekStart: 1 }]]);
  eq("solo lo que cambió: guardar una no pisa las otras", Object.keys(reg.guardado[0]?.[1] || {}), ["weekStart"]);
  eq("y se ve al instante, sin esperar a la base", ctx.state.prefs, { weekStart: 1, dimPast: false });
  eq("redibujando la pantalla una vez", reg.dibujos, 1);
  eq("sin ningún aviso de error", reg.avisos, []);
}
{
  const { savePrefs, reg } = armar({ email: null });
  let error = null;
  try{ savePrefs({ weekStart: 1 }); await esperar(); }
  catch(e){ error = e.message; }
  eq("sin nadie adentro, no se intenta guardar", [error, reg.guardado], [null, []]);
}
{
  const falla = Object.assign(new Error("sin conexión"), { code: "08006" });
  const { savePrefs, reg } = armar({ falla });
  try{ savePrefs({ dimPast: true }); }catch(e){}
  await esperar(); await esperar();
  eq("si la base no lo acepta, se avisa (no vuelve solo y en silencio)", reg.avisos.length, 1);
  eq("el aviso es de error", reg.avisos[0]?.ok, false);
  eq("y dice qué pasó", /08006/.test(reg.avisos[0]?.message || ""), true);
  eq("y ya no habla de las reglas de Firestore", /Firestore|Firebase/.test(reg.avisos[0]?.message || ""), false);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
