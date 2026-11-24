/* ======================================================================
   La cuenta corriente de Gastos, caso por caso (24/11/2026, docs/AUDITORIA.md, H11)

   `cuentaDe` suma plata: lo gastado de su bolsillo en rendiciones aprobadas, menos lo recibido, más lo devuelto y los
   ajustes. El rompe-código (herramientas/auditoria/herramientas/mutaciones.mjs) mostró que las pruebas de la pantalla
   (gastos_test) la miraban con un solo juego de datos «feliz»: se podía cambiar a quién cuenta cada renglón sin que
   ninguna prueba se enterara. Acá cada renglón de la cuenta tiene su caso:
   - cuenta lo aprobado de su bolsillo; lo que pagó la organización, no;
   - lo que se rinde en otra moneda cuenta en la moneda en que se rinde;
   - lo «enviado» y lo «observado» van aparte, como «en revisión» (todavía no cuenta); una rendición abierta, en ningún lado;
   - lo histórico (importado de años anteriores) no entra, ni lo de otra persona, ni un gasto sin monto, ni uno cuya
     rendición no está;
   - lo recibido, lo devuelto y los ajustes confirmados cuentan; lo anotado sin confirmar va aparte y sin signo;
   - el saldo y su frase («le debe a la organización», «le debe la organización», «saldado»).
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs); todo con gente inventada.
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, PERS, BASE } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const hasta = async (p, f, ...a) => { const fin = Date.now() + 5000; while(Date.now() < fin){ if(await p.evaluate(f, ...a).catch(() => false)) return true; await p.waitForTimeout(100); } return false; };

const Y = new Date().getFullYear(), ahora = Date.now();
const hace = d => new Date(ahora - d * 86400e3).toISOString();
const ANA = PERS[1], DIEGO = PERS[2];
const g = o => ({ autor: ANA.email, rendicion_id: null, fecha: `${Y}-02-10`, concepto: "", tipo: "comida", moneda: "USD", monto: null, rendido_moneda: "USD", rendido_monto: null,
  pago: "persona", forma_pago: null, tarjeta: null, factura: true, observaciones: "", estado: "aprobado", archivo: null, archivo_nombre: null,
  archivo_tipo: "image/jpeg", archivo_hash: null, lectura: null, creado_el: hace(3), tocado_el: hace(3), ...o });
const r = o => ({ autor: ANA.email, post_id: null, rutina_mes: null, titulo: "", estado: "aprobada", enviada_el: null, aprobada_el: hace(1), aprobada_por: ADMIN,
  total_manual: {}, total_manual_confirmado: false, total_manual_por: null, total_manual_el: null, historica: false, creada_el: hace(5), tocada_el: hace(5), ...o });
const mv = o => ({ persona: ANA.email, tipo: "recibido", fecha: `${Y}-03-01`, moneda: "USD", monto: 0, descripcion: "", estado: "confirmado",
  cargado_por: ADMIN, confirmado_por: ADMIN, confirmado_el: hace(2), creado_el: hace(2), ...o });
const pendiente = { estado: "pendiente", cargado_por: ANA.email, confirmado_por: null, confirmado_el: null };

const datos = ({ rendiciones, gastos, movimientos }) => {
  const b = BASE();
  const pref = b.app_config.find(c => c.key === "preferences");
  pref.value = { ...pref.value, gastos: { prendido: true } };
  return Object.assign(b, { gastos_rendiciones: rendiciones, gastos, gastos_comentarios: [], gastos_cambios: [], gastos_movimientos: movimientos });
};

// La cuenta de la persona elegida, tal cual se ve: por moneda, el saldo, su frase y cada renglón con su rótulo.
const cuentaDe = async (p, persona) => {
  await p.click('#tabs button[data-view="gastos"]'); await p.waitForSelector(".gastos-view"); await p.waitForTimeout(200);
  await p.click('[data-action="gastos-seccion"][data-key="cuenta"]'); await p.waitForTimeout(200);
  if(persona){ await p.selectOption("#gxCuentaDe", persona); await p.waitForTimeout(250); }
  return p.$$eval(".gx-cuenta-mon", l => l.map(m => ({
    moneda: m.querySelector(".gx-cm-cab b").textContent.trim(), saldo: m.querySelector(".gx-saldo").textContent.trim(), dice: m.querySelector(".gx-cm-sub").textContent.trim(),
    filas: Object.fromEntries([...m.querySelectorAll(".gx-cm-filas dt")].map(dt => [dt.textContent.trim(), dt.nextElementSibling.textContent.trim()])),
  })));
};

const b = await abrirNavegador();
const vp = { width: 1280, height: 900 };

/* ---------------- Todos los casos juntos, en dos monedas ---------------- */
{
  const base = datos({
    rendiciones: [
      r({ id: "re_apr", rutina_mes: `${Y}-01-01` }),
      r({ id: "re_env", rutina_mes: `${Y}-02-01`, estado: "enviada", enviada_el: hace(2), aprobada_el: null, aprobada_por: null }),
      r({ id: "re_obs", rutina_mes: `${Y}-03-01`, estado: "observada", enviada_el: hace(4), aprobada_el: null, aprobada_por: null }),
      r({ id: "re_abi", rutina_mes: `${Y}-04-01`, estado: "abierta", aprobada_el: null, aprobada_por: null }),
      r({ id: "re_his", rutina_mes: `${Y - 1}-05-01`, historica: true }),
      r({ id: "re_die", autor: DIEGO.email, rutina_mes: `${Y}-01-01` }),
    ],
    gastos: [
      g({ id: "a1", rendicion_id: "re_apr", concepto: "Hotel", monto: 100 }),
      g({ id: "a2", rendicion_id: "re_apr", concepto: "Pasajes pagados en pesos", moneda: "ARS", monto: 90000, rendido_moneda: "USD", rendido_monto: 80 }),
      g({ id: "a3", rendicion_id: "re_apr", concepto: "Cena en euros", moneda: "EUR", monto: 20 }),
      g({ id: "a4", rendicion_id: "re_apr", concepto: "La pagó la organización", monto: 999, pago: "organizacion" }),
      g({ id: "a5", rendicion_id: "re_apr", concepto: "Todavía sin monto", monto: null }),
      g({ id: "a6", rendicion_id: "re_env", concepto: "Taxi mandado", monto: 40, estado: "enviado" }),
      g({ id: "a7", rendicion_id: "re_obs", concepto: "Almuerzo observado", monto: 15, estado: "enviado" }),
      g({ id: "a8", rendicion_id: "re_abi", concepto: "Se está armando", monto: 7, estado: "confirmado" }),
      g({ id: "a9", rendicion_id: "re_his", concepto: "Del año pasado, ya saldado", monto: 500 }),
      g({ id: "a10", rendicion_id: "re_nunca", concepto: "Sin rendición", monto: 33 }),
      g({ id: "d1", autor: DIEGO.email, rendicion_id: "re_die", concepto: "Cena de Diego", monto: 70 }),
    ],
    movimientos: [
      mv({ id: "m1", tipo: "recibido", monto: 60 }),
      mv({ id: "m2", tipo: "devuelto", monto: 10 }),
      mv({ id: "m3", tipo: "ajuste", monto: -5 }),
      mv({ id: "m4", tipo: "recibido", monto: 20, ...pendiente }),
      mv({ id: "m5", tipo: "devuelto", monto: 4, ...pendiente }),
      mv({ id: "m6", tipo: "ajuste", monto: 2, ...pendiente }),
      mv({ id: "m7", tipo: "recibido", monto: 12, moneda: "EUR" }),
      mv({ id: "m8", tipo: "recibido", monto: null }),
      mv({ id: "m9", persona: DIEGO.email, tipo: "recibido", monto: 900 }),
    ],
  });
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base });
  const c = await cuentaDe(p, ANA.email);
  eq("las monedas de la cuenta, el dólar primero", c.map(x => x.moneda), ["USD", "EUR"]);
  const usd = c[0], eur = c[1];
  // Gastado: 100 + 80 (lo que se rinde, no los 90.000 pesos) = 180. Recibido 60, devuelto 10, ajuste −5. Saldo = 180 + 10 − 5 − 60 = 125.
  eq("dólares: lo aprobado de su bolsillo, lo recibido, lo devuelto y el ajuste, con su saldo", [usd.saldo, usd.filas["Gastado (aprobado)"], usd.filas["Recibido"], usd.filas["Devuelto"], usd.filas["Ajustes"]], ["125.00", "180.00", "60.00", "10.00", "-5.00"]);
  eq("…y la frase del saldo (a su favor: se lo debe la organización)", usd.dice, "la organización le debe");
  eq("«en revisión» suma lo enviado y lo observado (55) y NO lo de la rendición abierta (7), ni lo histórico (500), ni lo que no tiene rendición (33)", usd.filas["En revisión (todavía no cuenta)"], "55.00");
  eq("lo anotado sin confirmar va aparte, por tipo y sin signo", [usd.filas["Recibido, falta confirmar"], usd.filas["Devuelto, falta confirmar"], usd.filas["Ajuste, falta confirmar"]], ["20.00", "4.00", "2.00"]);
  eq("y no entra en el saldo (125 de arriba)", usd.saldo, "125.00");
  eq("euros: lo gastado en esa moneda y lo recibido, a su cuenta aparte (saldo 20 − 12 = 8)", [eur.saldo, eur.filas["Gastado (aprobado)"], eur.filas["Recibido"], eur.filas["Devuelto"]], ["8.00", "20.00", "12.00", "0.00"]);
  eq("…sin renglón de ajustes ni de revisión cuando no hay", [eur.filas["Ajustes"] ?? null, eur.filas["En revisión (todavía no cuenta)"] ?? null], [null, null]);
  eq("ni la plata de Diego ni la pagada por la organización: lo de Diego (70 gastado, 900 recibido) está en SU cuenta", (await cuentaDe(p, DIEGO.email)).map(x => [x.moneda, x.saldo, x.filas["Gastado (aprobado)"], x.filas["Recibido"]]), [["USD", "-830.00", "70.00", "900.00"]]);
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---------------- La frase del saldo y las cuentas vacías ---------------- */
{
  // Ana gastó 50 y se le dieron 50: saldado. Diego no tiene nada.
  const base = datos({
    rendiciones: [r({ id: "re_a", rutina_mes: `${Y}-01-01` })],
    gastos: [g({ id: "s1", rendicion_id: "re_a", concepto: "Taxi", monto: 50 })],
    movimientos: [mv({ id: "n1", tipo: "recibido", monto: 50 })],
  });
  const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vp, base });
  const ana = await cuentaDe(p, ANA.email);
  eq("gastó 50 y recibió 50: saldo en cero y «saldado»", ana.map(x => [x.saldo, x.dice]), [["0.00", "saldado"]]);
  await p.selectOption("#gxCuentaDe", DIEGO.email); await p.waitForTimeout(250);
  eq("quien no tiene nada: la cuenta vacía lo dice (sin tarjetas de moneda)", [await p.$$eval(".gx-cuenta-mon", l => l.length), await p.$$eval(".gx-nada", l => l.length)], [0, 1]);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
