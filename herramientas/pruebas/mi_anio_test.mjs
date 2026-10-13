/* ======================================================================
   «Mi año»: el resumen personal de cada integrante y la tarjeta para
   compartir (13/10/2026, propuesta 6-B)

   - En el menú de la cuenta (y en «Más», en el celular): «✨ Mi año».
   - Cuenta lo que cargaste o donde figurás como participante, sin las rutinas,
     sin lo cancelado y sin lo de otras personas: actividades, visitas, países,
     días viajando (cada día una vez, y solo los del año) y personas.
   - Un gráfico por mes y los años que tienen algo cargado, para cambiar de año.
   - Una tarjeta vertical que se baja como imagen (1080×1350): lleva los números
     y NUNCA el nombre de otra persona (el usuario lo pidió así).
   - Cada uno ve lo suyo: lo de otra persona no entra en sus números.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
import fs from "node:fs";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, PERS, BASE, post, ciudad, pais } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const ANA = PERS[1], DIEGO = PERS[2], LUCIA = PERS[3];
const datos = () => {
  const base = BASE();
  base.posts = [
    // Ana: cargó una visita de 5 días (con Diego y Guypo, que no tiene cuenta).
    post({ id: "a1", title: "Visita a Santiago", start: "2025-03-10", end: "2025-03-14", a: 1, type: "visita", scopes: [ciudad("Chile", "Santiago")],
      extra: { participants: [{ email: DIEGO.email, name: DIEGO.name }, { persona: "per_guypo", name: "Guypo" }] } }),
    // Diego cargó una visita de 2 días en la que figura Ana.
    post({ id: "a2", title: "Visita a Montevideo", start: "2025-06-02", end: "2025-06-03", a: 2, type: "visita", scopes: [pais("Uruguay")],
      extra: { participants: [{ email: ANA.email, name: ANA.name }] } }),
    post({ id: "a3", title: "Curso en Buenos Aires", start: "2025-06-20", a: 1, type: "curso", scopes: [pais("Argentina")] }),
    post({ id: "a4", title: "Rutina de junio", start: "2025-06-21", a: 1, type: "rutina" }),                                    // la bitácora no cuenta
    post({ id: "a5", title: "Visita de Lucía", start: "2025-07-01", end: "2025-07-05", a: 3, type: "visita", scopes: [pais("Perú")] }),  // no es de Ana
    post({ id: "a6", title: "Visita cancelada", start: "2025-08-01", a: 1, type: "visita", scopes: [pais("Bolivia")], extra: { cancelled: true } }),
    // Una visita que empezó el año anterior: en 2025 caen 2 días (el 1 y el 2 de enero), y cuenta una vez.
    post({ id: "a7", title: "Visita de fin de año", start: "2024-12-30", end: "2025-01-02", a: 1, type: "visita", scopes: [pais("Chile")] }),
    // Una de 2024, que solo aparece en ese año.
    post({ id: "a8", title: "Seminario 2024", start: "2024-05-05", a: 1, type: "seminario", scopes: [pais("Argentina")] }),
  ];
  base.replies = [];
  return base;
};
const vp = { width: 1280, height: 900 };
const b = await abrirNavegador();

async function irAMiAnio(p){
  await p.click('[data-action="toggle-user-menu"]');
  await p.click('.user-menu [data-action="goto-view"][data-view="mianio"]');
  await p.waitForSelector(".mia-view");
}
const numeros = p => p.$$eval(".mia-view .rep-kpi", l => l.map(k => k.querySelector(".rep-kpi-num").textContent.trim() + " " + k.querySelector(".rep-kpi-txt").textContent.trim()));
const anio = async (p, a) => { await p.click(`[data-action="mianio-anio"][data-year="${a}"]`); await p.waitForTimeout(250); };

/* ---- Ana ---- */
{
  const { p, errores } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "es", base: datos() });
  await irAMiAnio(p);
  eq("«Mi año» está en el menú de la cuenta y abre la pantalla, que dice que es solo de ella", await p.$eval(".mia-view .admin-lead", e => /Solo lo ves vos/.test(e.textContent)), true);
  eq("los años con algo cargado, el más nuevo primero", await p.$$eval(".mia-anios [data-action=\"mianio-anio\"]", l => l.map(x => x.dataset.year)).then(l => l.slice(0, 3)), [String(new Date().getFullYear()), "2025", "2024"].filter((x, i, a) => a.indexOf(x) === i).slice(0, 3));
  // El año de hoy no tiene nada a su nombre (los posteos de prueba son de 2024 y 2025).
  eq("un año sin nada a su nombre dice que todavía no hay nada, y no ofrece la tarjeta", [await p.$eval(".mia-view .empty-state", e => /Todavía no hay nada cargado a tu nombre/.test(e.textContent)), await p.$$('[data-action="mianio-bajar"]').then(l => l.length)], [true, 0]);
  await anio(p, "2025");
  eq("2025: 4 actividades (sin la rutina, sin lo cancelado y sin lo de Lucía), 3 visitas, 3 países, 9 días viajando, 2 personas",
     await numeros(p), ["4 actividades", "3 visitas", "3 países", "9 días viajando", "2 personas con quienes trabajaste"]);
  eq("el gráfico por mes: enero 1, marzo 1, junio 2, y el resto en cero", await p.$$eval(".mia-view .rep-col .rep-num", l => l.map(x => x.textContent.trim())), ["1", "0", "1", "0", "0", "2", "0", "0", "0", "0", "0", "0"]);
  eq("las columnas del gráfico son para mirar: no llevan al Reportes", await p.$$('.mia-view [data-action="reporte-mes"]').then(l => l.length), 0);
  const tarjeta = await p.$eval("#miaTarjeta", e => e.textContent.replace(/\s+/g, " ").trim());
  eq("la tarjeta de la pantalla: el año, el número, los países, los días y las personas", tarjeta, "Mi 2025 en Team LatAm4actividadesen 3 países9 días viajando · 2 personasRegistro de Acciones");
  eq("y no lleva el nombre de nadie más", [/Diego|Guypo|Lucía|Martínez/.test(tarjeta), /Diego|Guypo/.test(await p.$eval("#miaTarjeta", e => e.getAttribute("aria-label")))], [false, false]);
  // La imagen.
  const bajada = p.waitForEvent("download", { timeout: 8000 });
  await p.click('[data-action="mianio-bajar"]');
  const d = await bajada;
  const png = fs.readFileSync(await d.path());
  eq("«Bajar la imagen» baja mi-2025.png, un PNG de 1080×1350 con algo dibujado",
     [d.suggestedFilename(), png.subarray(1, 4).toString(), png.readUInt32BE(16), png.readUInt32BE(20), png.length > 20000], ["mi-2025.png", "PNG", 1080, 1350, true]);
  await anio(p, "2024");
  eq("2024: el seminario y la visita de fin de año (que empezó el 30 de diciembre: cuenta en los dos años, con sus 2 días de este)",
     await numeros(p), ["2 actividades", "1 visita", "2 países", "2 días viajando", "0 personas con quienes trabajaste"]);
  eq("sin gente con quien trabajar, la tarjeta no dice «0 personas»", await p.$eval("#miaTarjeta", e => e.querySelector("i").textContent), "2 días viajando");
  eq("sin errores en la consola", errores, []);
  await p.close();
}

/* ---- Diego: cada uno ve lo suyo ---- */
{
  const { p } = await entrar(b, DIEGO.email, DIEGO.name, { viewport: vp, lang: "es", base: datos() });
  await irAMiAnio(p);
  await anio(p, "2025");
  eq("Diego, en 2025: 2 actividades (la que cargó y en la que figura), 2 visitas, 2 países, 7 días, 2 personas (Ana y Guypo)",
     await numeros(p), ["2 actividades", "2 visitas", "2 países", "7 días viajando", "2 personas con quienes trabajaste"]);
  await p.close();
}

/* ---- En inglés ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: vp, lang: "en", base: datos() });
  await irAMiAnio(p);
  await anio(p, "2025");
  eq("en inglés: el título, la tarjeta y el botón", [await p.$eval(".mia-view .admin-h2", e => e.textContent.trim()), await p.$eval("#miaTarjeta small", e => e.textContent), await p.$eval('[data-action="mianio-bajar"]', e => e.textContent.trim())],
     ["✨ My year", "My 2025 at Team LatAm", "⬇ Download the image"]);
  await p.close();
}

/* ---- En el celular: «Más» ---- */
{
  const { p } = await entrar(b, ANA.email, ANA.name, { viewport: { width: 390, height: 800 }, lang: "es", base: datos() });
  await p.click('[data-action="toggle-more-menu"]');
  eq("en el celular, «Mi año» está en «Más»", await p.$$eval('.bn-sheet [data-view="mianio"]', l => l.length), 1);
  await p.click('.bn-sheet [data-view="mianio"]');
  await p.waitForSelector(".mia-view");
  await p.click('[data-action="mianio-anio"][data-year="2025"]'); await p.waitForTimeout(250);
  eq("y abre la pantalla, sin que nada se salga de la pantalla del celular", [await p.$eval("#miaTarjeta", e => e.getBoundingClientRect().width <= 320), await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)], [true, true]);
  await p.close();
}

await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
