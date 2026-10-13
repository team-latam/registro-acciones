/* ======================================================================
   La ficha de un lugar para el lector de pantalla (auditoría del 10/10/2026, R22)

   - «Ver más / Ver menos» (.fl-mas) dice con aria-expanded si la tarjeta
     está desplegada.
   - El «Ver más» ya no está adentro del <h3> del título (el lector de
     pantalla anunciaba «encabezado, botón, botón»): va al lado, en una caja
     (.fl-tit) con el mismo aspecto que tenía el h3. Capturas de la ficha de
     un país y de una ciudad (compu, celular de 390 × 661, hebreo y papel)
     idénticas píxel a píxel.
   - Un solo <h1> por pantalla: el de la cabecera fija de la app. El nombre
     del lugar era un segundo <h1>; ahora es un <h2> con el mismo aspecto
     (mismo tamaño en la compu, en el celular y en el papel).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, tab, click, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// Argentina con material de sobra para que aparezcan los cuatro «Ver más»:
// más de 5 ciudades, más de 4 documentos, pasos que seguir, y 7 contactos en Rosario.
function baseGrande(){
  const base = BASE();
  const ciudades = ["Rosario", "Córdoba", "Bariloche", "Mendoza", "Salta", "Tucumán", "La Plata", "Mar del Plata"];
  ciudades.forEach((c, i) => base.posts.push(post({ id: "g" + i, title: "Visita a " + c, d: 10 + i * 9, start: dia(10 + i * 9), end: dia(10 + i * 9), a: i % 3, type: "visita",
    scopes: [ciudad("Argentina", c)], content: "Contenido " + c, extra: { files: [{ name: "Doc " + i + ".pdf", kind: "pdf", path: "posts/g" + i + "/d.pdf" }] } })));
  const ahora = new Date().toISOString();
  for(let i = 0; i < 7; i++){
    base.instituciones.push({ id: "ins_r" + i, name: "Jabad Rosario " + i, country: "Argentina", city: "Rosario", address: null, tipo: "Centro Comunitario", estado: "activa", nota: null, lista: "lista1", created_by: ADMIN, created_at: ahora });
    base.contactos.push({ id: "cr" + i, institucion: "ins_r" + i, persona: i % 2 ? "per_rab1" : "per_rab2", cargo: "Rab", orden: 0, created_at: ahora });
  }
  return base;
}
const b = await abrirNavegador();
const irA = async (p, selector) => { await tab(p, "paises"); await p.waitForTimeout(300); await p.evaluate(s => document.querySelector(s)?.click(), selector); await p.waitForTimeout(600); };
const mas = p => p.$$eval(".fl-mas", l => l.map(e => ({ que: e.dataset.que, texto: e.textContent.trim(), expandido: e.getAttribute("aria-expanded") })));

for(const [lang, vista] of [["", { width: 1280, height: 900 }], ["he", { width: 390, height: 661 }]]){
  const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: vista, lang, base: baseGrande() });
  const nombre = (lang || "es") + " " + vista.width;
  // ---- País: pasos, ciudades, documentos ----
  await irA(p, '[data-action="drill-country"][data-country="Argentina"]');
  const antes = await mas(p);
  eq(`[${nombre}] la ficha de Argentina trae los «Ver más» de pasos, ciudades y documentos (la prueba mide algo)`, antes.map(x => x.que).sort(), ["docs", "hijos", "pasos"]);
  eq(`[${nombre}] cada «Ver más» dice con aria-expanded que está plegado`, antes.every(x => x.expandido === "false"), true);
  // En el celular, con la tarjeta plegada, el «Ver más» no se ve (como antes, cuando iba adentro del h3).
  if(vista.width < 800) eq(`[${nombre}] plegadas, ningún «Ver más» de las tarjetas del costado se ve`, await p.$$eval(".fl-lado .fl-mas", l => l.map(e => e.offsetParent !== null)), antes.filter(x => x.que !== "pasos").map(() => false));
  // Se despliegan de a uno: el DOM se rehace en cada clic.
  for(const k of ["pasos", "hijos", "docs"]){
    if(vista.width < 800) await p.evaluate(k => { const x = document.querySelector(`.fl-pliegue[data-que="${k}"]`); if(x && x.getAttribute("aria-expanded") === "false") x.click(); }, k);
    await p.evaluate(k => document.querySelector(`.fl-mas[data-que="${k}"]`).click(), k); await p.waitForTimeout(300);
  }
  const abierto = await mas(p);
  eq(`[${nombre}] desplegados, aria-expanded=true en todos`, abierto.every(x => x.expandido === "true"), true);
  eq(`[${nombre}] y el texto sigue al estado (dice «menos»)`, abierto.every(x => /menos|פחות/i.test(x.texto)), true);
  await p.evaluate(() => document.querySelector('.fl-mas[data-que="hijos"]').click()); await p.waitForTimeout(300);
  eq(`[${nombre}] plegar uno vuelve a aria-expanded=false`, (await mas(p)).find(x => x.que === "hijos").expandido, "false");

  // ---- Un solo h1 ----
  const h = await p.evaluate(() => ({ h1: [...document.querySelectorAll("h1")].map(e => e.textContent.trim()), h2: document.querySelector(".fl-head h2")?.textContent.trim() || null,
    tam: document.querySelector(".fl-head h2") ? getComputedStyle(document.querySelector(".fl-head h2")).fontSize : null, h1Ficha: document.querySelectorAll(".ficha-lugar h1").length }));
  eq(`[${nombre}] un solo h1 en la pantalla de la ficha (el de la app)`, h.h1.length, 1);
  eq(`[${nombre}] y ninguno adentro de la ficha`, h.h1Ficha, 0);
  eq(`[${nombre}] el nombre del lugar es un h2`, h.h2, lang ? "ארגנטינה" : "Argentina");
  eq(`[${nombre}] con el mismo tamaño de siempre (24 px en la compu, 21 en el celular)`, h.tam, vista.width < 800 ? "21px" : "24px");

  // El «Ver más» no está adentro del encabezado: el lector no lo lee como parte del título.
  eq(`[${nombre}] ningún «Ver más» queda adentro de un <h3>`, await p.$$eval("h3 .fl-mas", l => l.length), 0);
  eq(`[${nombre}] y cada «Ver más» sigue pegado a su título, en la misma fila`, await p.$$eval(".fl-card .fl-mas", l => l.map(e => { const tit = e.closest(".fl-tit"), h = tit && tit.querySelector("h3"); if(!h) return false; const a = h.getBoundingClientRect(), b = e.getBoundingClientRect(); return a.top < b.bottom && b.top < a.bottom; })), (await mas(p)).map(() => true));
  // En el papel («Reporte del lugar») también conserva su tamaño y sin márgenes.
  await p.emulateMedia({ media: "print" });
  eq(`[${nombre}] en el papel: 19 px y sin margen`, await p.$eval(".fl-head h2", e => [getComputedStyle(e).fontSize, getComputedStyle(e).marginTop, getComputedStyle(e).marginBottom]), ["19px", "0px", "0px"]);
  await p.emulateMedia({ media: "screen" });

  // ---- Una ciudad: los contactos ----
  await irA(p, '[data-action="drill-country"][data-country="Argentina"]');
  await p.evaluate(() => document.querySelector('[data-action="drill-city"][data-city="Rosario"]').click()); await p.waitForTimeout(600);
  if(vista.width < 800) await p.evaluate(() => { const x = document.querySelector('.fl-pliegue[data-que="contactos"]'); if(x && x.getAttribute("aria-expanded") === "false") x.click(); });
  await p.waitForTimeout(200);
  const ciu = await mas(p);
  const c = ciu.find(x => x.que === "contactos");
  eq(`[${nombre}] la ficha de una ciudad con muchos contactos trae su «Ver más», con aria-expanded=false`, [!!c, c && c.expandido], [true, "false"]);
  await p.evaluate(() => document.querySelector('.fl-mas[data-que="contactos"]').click()); await p.waitForTimeout(300);
  eq(`[${nombre}] y desplegado, true`, (await mas(p)).find(x => x.que === "contactos").expandido, "true");
  eq(`[${nombre}] un solo h1 también en la ficha de una ciudad`, await p.$$eval("h1", l => l.length), 1);

  // ---- Las demás pantallas siguen con su único h1 ----
  for(const v of ["feed", "calendario", "paises", "proyectos", "reportes"]){
    await tab(p, v); await p.waitForTimeout(300);
    const n = await p.$$eval("h1", l => l.filter(e => e.offsetParent !== null || getComputedStyle(e).position === "fixed").length);
    eq(`[${nombre}] ${v}: un solo h1`, n, 1);
  }
  eq(`[${nombre}] sin errores en la página`, errores, []);
  await p.close();
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
