/* ======================================================================
   «Tendencias» no inventa cambios que son puro azar (auditoría del 20/11/2026, Y5; D23-A)

   Con 12 a 80 actividades puestas AL AZAR en seis meses, sin ninguna tendencia por construcción,
   la tarjeta mostraba cambios («Chile 4 → 0 se apagó», «Visita 6 → 3 ▼ −3») en 12 de 12 equipos:
   los mínimos (3 en un tramo, una vez y media) estaban pensados para otro volumen. Ahora los
   lugares y los tipos también tienen que apartarse del azar (la prueba z de los temas, con 3 en
   vez de 2 porque son ~20 comparaciones a la vez), y cuando no alcanza la tarjeta lo dice.

   Se mide con la app de verdad y el Supabase de mentira, SIN apagar la regla (las cuentas a
   mano de tendencias_test.mjs sí la apagan). Lo que cuida:
   - actividades al azar (24, 40, 80; varias semillas): ninguna fila de cambio en el Inicio ni en
     Reportes, y la tarjeta dice «Nada cambió más de lo que podría ser azar.»;
   - un cambio REAL (Argentina de 30 a 5) sí aparece, con su ▼;
   - muy pocos datos: «Todavía hay pocos datos…», en el Inicio y en Reportes.
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, hace, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const azarCon = semilla => { let s = semilla >>> 0; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const VACIO = { images: [], files: [], links: [], mentions: [], liked_by: [], milestones: [], editors: [], participants: [], recurrence_skip: [], recurrence_moves: {} };
const LUGARES = [["Argentina", "Buenos Aires"], ["Argentina", "Rosario"], ["Uruguay", "Montevideo"], ["Uruguay", "Montevideo"], ["Brasil", "São Paulo"], ["Chile", "Santiago"], ["México", "Ciudad de México"], ["Perú", "Lima"], ["Panamá", "Ciudad de Panamá"]];
const TIPOS = ["visita", "visita", "curso", "seminario", "virtual", "otro", "rutina", "rutina"];
const fila = (id, type, pais, ciudad, d) => ({ id, date: dia(d), start_date: dia(d), end_date: dia(d), activity_type: type, title: type === "rutina" ? "Rutina " + id : `${type} en ${ciudad} ${id}`, content: "",
  author_name: "Ana Pérez", author_email: "ana@team-latam.com", created_at: hace(d), scopes: [{ type: "ciudad", country: pais, city: ciudad }], ...VACIO });
const sinGastos = b => { for(const k of Object.keys(b)) if(k === "gastos" || k.startsWith("gastos_")) b[k] = []; return b; };
const equipo = (n, semilla) => { const azar = azarCon(semilla), uno = l => l[Math.floor(azar() * l.length)];
  const b = sinGastos(BASE()); b.posts = []; b.replies = [];
  for(let i = 0; i < n; i++){ const [p, c] = uno(LUGARES); b.posts.push(fila("t" + i, uno(TIPOS), p, c, Math.floor(azar() * 178) + 1)); }
  return b; };
const filasDelInicio = p => p.evaluate(() => [...document.querySelectorAll(".fs-tendencias .fila")].map(x => x.innerText.replace(/\s+/g, " ").trim()));
const mensajeDelInicio = p => p.evaluate(() => (document.querySelector(".fs-tendencias .fs-poco") || {}).textContent || null);

const b = await abrirNavegador();
// 1) Al azar: nada. Tres tamaños, cuatro semillas.
for(const n of [24, 40, 80]){
  let conCambios = 0, ejemplo = "", sinMensaje = 0;
  for(let semilla = 1; semilla <= 4; semilla++){
    const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: equipo(n, semilla * 977 + n) });
    await p.waitForTimeout(300);
    const filas = await filasDelInicio(p);
    if(filas.length){ conCambios++; if(!ejemplo) ejemplo = filas[0]; }
    if(!filas.length && !(await mensajeDelInicio(p))) sinMensaje++;
    await p.close();
  }
  ok(`${n} actividades al azar: ningún equipo (de 4) ve cambios en el Inicio`, conCambios === 0, `${conCambios} de 4; ej.: ${ejemplo}`);
  eq(`${n} actividades al azar: la tarjeta siempre dice por qué no hay filas`, sinMensaje, 0);
}
// 2) Reportes también, y con el texto de «Nada cambió…».
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: equipo(40, 3) });
  await p.waitForTimeout(300); await tab(p, "reportes"); await p.waitForTimeout(500);
  eq("Reportes (40 al azar): sin fichas de cambio", await p.$$eval("#repTendencias .rep-mov-it", l => l.length), 0);
  eq("Reportes (40 al azar): dice que nada cambió más que el azar", await p.$eval("#repTendencias .rep-tend-vacio", e => e.textContent), "Nada cambió más de lo que podría ser azar.");
  await p.close(); }
// 3) Un cambio real SÍ aparece: Argentina de 30 a 5 (en los 90 días de antes y de ahora), con el resto repartido igual.
{ const azar = azarCon(11), b2 = sinGastos(BASE()); b2.posts = []; b2.replies = []; let k = 0;
  for(let i = 0; i < 30; i++) b2.posts.push(fila("a" + ++k, "visita", "Argentina", "Rosario", 95 + Math.floor(azar() * 80)));
  for(let i = 0; i < 5; i++) b2.posts.push(fila("a" + ++k, "visita", "Argentina", "Rosario", 1 + Math.floor(azar() * 85)));
  for(const [p, c] of [["Chile", "Santiago"], ["Perú", "Lima"], ["Uruguay", "Montevideo"]]){
    for(let i = 0; i < 6; i++) b2.posts.push(fila("o" + ++k, "visita", p, c, 1 + Math.floor(azar() * 85)));
    for(let i = 0; i < 6; i++) b2.posts.push(fila("o" + ++k, "visita", p, c, 95 + Math.floor(azar() * 80)));
  }
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: b2 });
  await p.waitForTimeout(400);
  const filas = await filasDelInicio(p);
  ok("un cambio real (Argentina de 30 a 5) aparece en el Inicio", filas.some(x => /Argentina/.test(x) && /30\s*→\s*5/.test(x)), JSON.stringify(filas));
  ok("y no aparecen los lugares que no cambiaron", !filas.some(x => /Chile|Perú|Uruguay/.test(x)), JSON.stringify(filas));
  await p.close(); }
// 4) Muy pocos datos.
{ const b3 = sinGastos(BASE()); b3.posts = []; b3.replies = [];
  for(let i = 0; i < 5; i++) b3.posts.push(fila("c" + i, "visita", "Chile", "Santiago", 5 + i * 20));
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 }, base: b3 });
  await p.waitForTimeout(300);
  eq("con 5 actividades: el Inicio dice que todavía hay pocos datos", await mensajeDelInicio(p), "Todavía hay pocos datos para hablar de tendencias.");
  await tab(p, "reportes"); await p.waitForTimeout(500);
  eq("y Reportes también", await p.$eval("#repTendencias .rep-tend-vacio", e => e.textContent), "Todavía hay pocos datos para hablar de tendencias.");
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
