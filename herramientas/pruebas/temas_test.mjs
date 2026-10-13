/* ======================================================================
   Temas en Reportes: las palabras que suben y bajan (13/10/2026, segunda
   vuelta de propuestas, opción 4-A)

   El usuario pidió ver «de qué se está hablando» sin etiquetar nada: las
   palabras de los títulos y textos de los últimos 90 días, contadas contra
   las de los 90 anteriores, con sube / baja / nuevo / igual. Reglas que esta
   prueba cuida:
   - cuenta posteos, no apariciones (una palabra repetida en un texto es una);
   - «cámara» y «cámaras» son un tema;
   - no son temas las palabras de relleno ni los nombres de los lugares de
     cada posteo, ni lo cancelado, ni lo que todavía no pasó;
   - con menos de 8 posteos en los 180 días, la sección no aparece;
   - tocar un tema abre el Inicio con ese texto buscado.
   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   ====================================================================== */
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
import { abrirNavegador, entrar, ADMIN, BASE, post, ciudad, dia, tab } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const rosario = [ciudad("Argentina", "Rosario")];
// Un posteo de «hace n días» (n negativo: todavía no pasó).
const P = (n, titulo, texto = "", extra = {}) => post({ title: titulo, content: texto, start: dia(n), end: dia(n), type: "otro", scopes: rosario, ...extra });
const datos = (posts, lista = []) => { const b = BASE(); b.posts = posts; b.replies = []; return b; };

// Los últimos 90 días («ahora») y los 90 anteriores («antes»).
const ahora = [
  P(2, "Plan de seguridad", "Seguridad para la sede, seguridad en el acceso, seguridad seguridad."),
  P(9, "Capacitación", "Hablamos de seguridad con los directores."),
  P(15, "Taller con padres", "Seguridad y cámaras en la entrada."),
  P(22, "Presupuesto", "Pedir cámaras para el colegio."),
  P(30, "Obra", "Instalar cámaras nuevas. Una cámara en el patio."),
  P(37, "Seguridad del edificio", "Revisión general."),
  P(44, "Reunión con jóvenes", "Los jóvenes proponen una actividad."),
  P(51, "Shabat con jóvenes", "Se sumaron jóvenes de tres barrios."),
  P(58, "Campamento", "Jóvenes y madrijim."),
  P(65, "Encuentro de jóvenes", "Primer encuentro."),
  P(12, "Preparativos de Pésaj", "Pésaj en tres ciudades."),
  P(33, "Seder", "Pésaj en la comunidad."),
  P(48, "Menú", "Compras para Pésaj."),
  P(70, "Reunión de equipo", "Reunión semanal."),
  P(71, "Reunión con la comisión", "Otra reunión."),
  P(72, "Reunión de seguimiento", "Reunión sobre becas."),
  P(5, "Reunión chica", "Una reunión más."),
];
const antes = [
  P(100, "Convocatoria de becas", "Becas para líderes."),
  P(110, "Selección", "Se eligieron las becas."),
  P(120, "Primera cohorte", "Becas otorgadas."),
  P(130, "Entrevistas", "Entrevistas para becas."),
  P(140, "Cierre", "Cierre de becas del año."),
  P(105, "Seguridad en escuelas", "Una charla sobre seguridad."),
  P(150, "Jóvenes del sur", "Reunión con jóvenes."),
  P(155, "Retiro de jóvenes", "Retiro anual."),
  P(160, "Jóvenes en Quito", "Visita a jóvenes."),
  P(165, "Encuentro de jóvenes", "Cierre del año."),
  P(125, "Cámaras", "Una pregunta sobre cámaras."),
];
const apartes = [
  P(-5, "Futurama", "Futurama futurama futurama."),                        // todavía no pasó
  P(-9, "Futurama 2", "Futurama otra vez."),
  P(-14, "Futurama 3", "Futurama y más futurama."),
  P(6, "Cancelado", "Cancelado cancelado cancelado.", { extra: { cancelled: true, cancelled_at: dia(1), cancelled_by: ADMIN } }),
  P(8, "Cancelado 2", "Cancelado cancelado.", { extra: { cancelled: true, cancelled_at: dia(1), cancelled_by: ADMIN } }),
  P(10, "Cancelado 3", "Cancelado.", { extra: { cancelled: true, cancelled_at: dia(1), cancelled_by: ADMIN } }),
  P(250, "Muy viejo", "Dinosaurio dinosaurio."),                           // fuera de los 180 días
];

const b = await abrirNavegador();
const { p, errores } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos([...ahora, ...antes, ...apartes]) });
await tab(p, "reportes"); await p.waitForTimeout(500);

const filas = () => p.$$eval(".rep-tema", l => l.map(e => ({ palabra: e.querySelector("b").textContent, cuentas: e.querySelector("small").textContent, tipo: e.querySelector(".rep-delta").textContent.trim() })));
const t1 = await filas();
const por = Object.fromEntries(t1.map(x => [x.palabra, x]));

eq("la sección se llama «Tendencias»", await p.$$eval(".rep-seccion-cabeza h3", l => l.map(e => e.textContent.trim()).includes("Tendencias")), true);
eq("«seguridad» sube: 4 posteos ahora (uno la repite cuatro veces y cuenta uno), 1 antes, y se muestra en minúscula", [por["seguridad"] && por["seguridad"].cuentas, por["seguridad"] && por["seguridad"].tipo], ["4 ahora · 1 antes", "▲ sube"]);
eq("«cámara» y «cámaras» son un solo tema: 3 posteos ahora, 1 antes", [Object.keys(por).filter(k => /^c[aá]mara/i.test(k)).length, Object.entries(por).find(([k]) => /^c[aá]mara/i.test(k))[1].cuentas], [1, "3 ahora · 1 antes"]);
eq("…que sube", Object.entries(por).find(([k]) => /^c[aá]mara/i.test(k))[1].tipo, "▲ sube");
eq("«jóvenes»: 4 ahora, 4 antes, igual", [por["jóvenes"].cuentas, por["jóvenes"].tipo], ["4 ahora · 4 antes", "igual"]);
eq("«becas» baja (1 ahora, 5 antes)", [por["becas"].cuentas, por["becas"].tipo], ["1 ahora · 5 antes", "▼ baja"]);
eq("«pésaj» es nuevo (3 ahora, 0 antes)", [por["Pésaj"].cuentas, por["Pésaj"].tipo], ["3 ahora · 0 antes", "nuevo"]);
eq("la palabra se muestra como se escribió, con su tilde", Object.keys(por).filter(k => /^p[eé]saj$/i.test(k)), ["Pésaj"]);
const palabras = Object.keys(por).map(k => k.toLowerCase());
eq("«reunión» es relleno: no es un tema", palabras.includes("reunión") || palabras.includes("reunion"), false);
eq("«Rosario» es el lugar de cada posteo: no es un tema", palabras.includes("rosario"), false);
eq("lo que todavía no pasó no cuenta", palabras.includes("futurama"), false);
eq("lo cancelado no cuenta", palabras.includes("cancelado"), false);
eq("lo de hace más de 180 días no cuenta", palabras.includes("dinosaurio"), false);
eq("a lo sumo diez temas", t1.length <= 10, true);

// Tocar un tema abre el Inicio con ese texto buscado.
await p.click('.rep-tema[data-tema="seguridad"]'); await p.waitForTimeout(600);
eq("tocar «seguridad» abre el Inicio", await p.$eval("#feedSearch", e => e.value), "seguridad");
const tarjetas = await p.$$eval("#viewRoot article.post[data-post-id]", l => l.length);
eq("…con los posteos que la mencionan (los de ahora y los de antes)", tarjetas >= 1, true);
eq("…y la solapa «Lo que pasó» activa", await p.$eval('.feed-solapas button.on', e => e.dataset.key), "pasado");

// En inglés, las etiquetas se traducen.
{
  const en = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "en", base: datos([...ahora, ...antes]) });
  await tab(en.p, "reportes"); await en.p.waitForTimeout(500);
  const f = await en.p.$$eval(".rep-tema .rep-delta", l => [...new Set(l.map(e => e.textContent.trim()))].sort());
  eq("en inglés: rising / steady / new / falling", f, ["steady", "new", "▲ rising", "▼ falling"].sort());
  await en.p.close();
}

// Las palabras que van juntas son UNA idea (13/10/2026, pedido del usuario: «krav» y «maga» no son dos
// temas). Un par que casi siempre aparece pegado se junta; uno que solo a veces coincide, no; una palabra
// de relleno o un signo en el medio corta («plan de verano» no es «plan verano»); y pueden ser tres.
{
  const frases = [
    P(3, "Clase de krav maga", "Sumamos krav maga."), P(9, "Krav maga para jóvenes", "Mañana."), P(16, "Instructor de krav maga", "Llega pronto."),
    P(23, "Seguimos con krav maga", "Todos juntos."), P(30, "Krav maga: balance", "Terminamos."),
    // «defensa» y «personal» coinciden en 3 de sus 6 posteos cada una: no son una frase.
    P(4, "Curso de defensa personal", "Primero."), P(11, "Defensa personal otra vez", "Segundo."), P(18, "Más defensa personal", "Tercero."),
    P(25, "Taller de defensa", "Cuarto."), P(32, "Defensa en la escuela", "Quinto."), P(39, "Defensa de la comunidad", "Sexto."),
    P(5, "Atención personal", "Uno."), P(12, "Cuidado personal", "Dos."), P(19, "Charla personal", "Tres."),
    // tres palabras pegadas
    P(6, "Arte marcial israelí", "Introducción."), P(13, "Arte marcial israelí en el barrio", "Segunda."), P(20, "Más arte marcial israelí", "Tercera."), P(27, "Cierre del arte marcial israelí", "Cuarta."),
    // con una palabra de relleno en el medio no se juntan
    P(7, "Plan de verano", "Primero."), P(14, "Armar el plan de verano", "Segundo."), P(21, "Plan de verano listo", "Tercero."), P(28, "Revisar el plan de verano", "Cuarto."),
  ];
  const f = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos(frases) });
  await tab(f.p, "reportes"); await f.p.waitForTimeout(500);
  const fr = Object.fromEntries((await f.p.$$eval(".rep-tema", l => l.map(e => [e.querySelector("b").textContent, e.querySelector("small").textContent]))));
  eq("«krav maga» es un solo tema, con los 5 posteos, en minúscula", fr["krav maga"], "5 ahora · 0 antes");
  eq("…y «krav» y «maga» no aparecen por separado", [fr["krav"], fr["maga"], fr["Krav"], fr["Maga"]], [undefined, undefined, undefined, undefined]);
  eq("«defensa» y «personal» coinciden solo a veces: siguen siendo dos temas, y no hay «defensa personal»", [fr["defensa"], fr["personal"], fr["defensa personal"]], ["6 ahora · 0 antes", "6 ahora · 0 antes", undefined]);
  eq("tres palabras pegadas son un solo tema: «arte marcial israelí»", [fr["arte marcial israelí"], fr["arte"], fr["marcial"]], ["4 ahora · 0 antes", undefined, undefined]);
  eq("una palabra de relleno en el medio corta: «plan» y «verano» son dos temas, no «plan verano»", [fr["plan"], fr["verano"], fr["plan verano"], fr["plan de verano"]], ["4 ahora · 0 antes", "4 ahora · 0 antes", undefined, undefined]);
  eq("la nota dice que junta las palabras que van pegadas y que no entiende el significado", await f.p.$eval(".rep-temas .rep-bloque-nota", e => [/krav maga/.test(e.textContent), /seguridad/.test(e.textContent)]), [true, true]);
  // Tocar la frase abre el Inicio con la frase buscada.
  await f.p.click('.rep-tema[data-tema="krav maga"]'); await f.p.waitForTimeout(600);
  eq("tocar «krav maga» abre el Inicio con la frase buscada y sus posteos", [await f.p.$eval("#feedSearch", e => e.value), await f.p.$$eval("#viewRoot article.post[data-post-id]", l => l.length) >= 1], ["krav maga", true]);
  await f.p.close();
}

// Con pocos posteos no hay nada que contar: la sección no aparece.
{
  const poco = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang: "es", base: datos([P(2, "Seguridad", "Seguridad."), P(4, "Seguridad otra", "Seguridad."), P(8, "Seguridad más", "Seguridad.")]) });
  await tab(poco.p, "reportes"); await poco.p.waitForTimeout(500);
  eq("con menos de 8 posteos, la sección no se dibuja", await poco.p.$$(".rep-tema").then(l => l.length), 0);
  await poco.p.close();
}

eq("sin errores en la consola", errores, []);
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
