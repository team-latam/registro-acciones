/* ======================================================================
   La planilla de la Agenda, solo para quien carga eventos (10/10/2026, D2)

   Ver la Agenda es de todos los aprobados (lo decidió el usuario el 8/10);
   bajarla entera con los teléfonos, no: un observador no ve «Bajar en
   planilla» y la acción no hace nada para él.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, PERS, tab, click } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const conObservador = () => { const base = BASE(); base.members = base.members.concat([{ email: "obs@team-latam.com", name: "Olga Observa", nickname: "olga", role: "observer", approved_at: "2025-01-10T12:00:00Z" }]); return base; };
const b = await abrirNavegador();
for(const [quien, nombre, espera] of [["obs@team-latam.com", "Olga Observa", 0], [PERS[1].email, PERS[1].name, 1], [ADMIN, "Benny Rosenthal", 1]]){
  const { p } = await entrar(b, quien, nombre, { viewport: { width: 1280, height: 800 }, base: conObservador() });
  await tab(p, "paises"); await click(p, ".paises-agenda"); await p.waitForTimeout(400);
  eq(`${nombre}: ${espera ? "ve" : "no ve"} «Bajar en planilla»`, await p.$$eval('[data-action="agenda-planilla"]', l => l.length), espera);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
