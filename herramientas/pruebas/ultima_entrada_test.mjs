/* ======================================================================
   «Nunca entró» no sale de las últimas 1.000 acciones (auditoría del 20/11/2026, Y7)

   Administración › Personas sacaba el último ingreso de cada uno del registro de actividad que
   la app carga, que es solo el de las últimas 1.000 acciones: con 1.500 acciones más nuevas,
   alguien que entró hace 12 días figuraba como «Nunca entró» y sumaba a «Inactivos». Ahora la
   última entrada se le pregunta a la base (ultimas_entradas(), 28-ultimas-entradas.sql), que
   mira TODO el registro. Quien de verdad nunca entró sigue diciendo «Nunca entró», y si la base
   no contesta, la pantalla sigue andando con lo que tiene.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, hace, irAdmin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const equipo = () => {
  const base = BASE(); base.audit_log = [{ id: "a-ana", type: "login", actor_email: "ana@team-latam.com", actor_name: "Ana Pérez", created_at: hace(12) }];
  for(let i = 0; i < 1500; i++) base.audit_log.push({ id: "e" + i, type: i % 3 ? "post_edited" : "login", actor_email: "diego@team-latam.com", actor_name: "Diego Martínez", created_at: hace((i % 1000) / 90), details: { title: "algo" } });
  return base;
};
const abrirPersonas = async (b, opciones = {}) => {
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, base: equipo(), ...opciones });
  await p.waitForTimeout(500); await irAdmin(p);
  await p.evaluate(() => { const x = document.querySelector('[data-action="admin-go"][data-view="solicitudes"][data-key="usuarios"]'); x && x.click(); }); await p.waitForTimeout(700);
  return p;
};
const fila = (p, correo) => p.evaluate(c => { const r = [...document.querySelectorAll(".lp-row")].find(x => x.innerText.includes(c)); return r ? r.innerText.replace(/\s+/g, " ") : null; }, correo);
const inactivos = p => p.evaluate(() => (([...document.querySelectorAll(".chip-toggle")].map(x => x.innerText).find(t => /Inactivos/.test(t))) || "").replace(/\D/g, ""));

const b = await abrirNavegador();
{ const p = await abrirPersonas(b);
  const ana = await fila(p, "ana@team-latam.com");
  eq("Ana entró hace 12 días: la pantalla lo dice (no «Nunca entró»)", /Hace 12 días/.test(ana || "") && !/Nunca entr/.test(ana || ""), true);
  const lla = await p.evaluate(() => window.__sb.rpc.map(r => r[0]));
  eq("se le preguntó a la base la última entrada de cada uno", lla.includes("ultimas_entradas"), true);
  const dg = await fila(p, "diego@team-latam.com");
  eq("y Diego, que entró hoy, sigue diciendo que entró hoy", /Hoy|Hace (\d+) (minutos|horas)/.test(dg || ""), true);
  const mo = await fila(p, "moshe@team-latam.com");
  eq("quien de verdad nunca entró sigue diciendo «Nunca entró»", /Nunca entr/.test(mo || ""), true);
  eq("«Inactivos» no cuenta a Ana (entró hace menos de 30 días)", Number(await inactivos(p)) <= 3, true);
  await p.close(); }
// Si la base no contesta, la pantalla sigue andando con lo que tiene (sin romperse).
{ const p = await abrirPersonas(b, { falla: "falloRpc" });
  eq("sin respuesta de la base, la lista de personas se ve igual", !!(await fila(p, "ana@team-latam.com")), true);
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
