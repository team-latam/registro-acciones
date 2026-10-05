// El resumen de una visita (6/10/2026): la app lee el Formulario de
// Cierre (o el de Viaje) en Word y se queda con el resumen ejecutivo, los
// objetivos y "lo que sigue". Se prueba con el código de verdad de
// index.html, en un navegador (hace falta DOMParser), sobre documentos
// inventados: el repo es público y los Cierres reales no se suben.
import fs from "node:fs";
import { chromium } from "playwright";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const grab = hacerGrab(src);

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const codigo = ["W_NS","TITULOS_DE_FORMULARIO","sinTildes","idDePaso","textoDeNodoWord","bloquesDeWord",
  "tituloDeFormulario","logradoDe","recortar","leerFormularioDeViaje","partesDe","claveDeParte","resumenCombinado",
  "extensionDe","esWordDeViaje","cuentaObjetivos","pasosDe","pasosPendientes"].map(grab).join("\n");

// Un Word mínimo con la forma de los formularios: un párrafo por línea,
// y la tabla de objetivos como tabla.
const p = (texto, negrita) => `<w:p>${negrita ? "<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>" : ""}<w:r>${negrita ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${texto}</w:t></w:r></w:p>`;
// Un párrafo partido en varios trozos, como los deja Word.
const pTrozos = (...trozos) => `<w:p>${trozos.map(t => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join("")}</w:p>`;
const tabla = filas => `<w:tbl><w:tblPr/>${filas.map(f => `<w:tr>${f.map(c => `<w:tc><w:p><w:r><w:t>${c}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
const doc = cuerpo => `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr/></w:body></w:document>`;

const CIERRE = doc([
  p("Formulario de Cierre de Viaje", true),
  pTrozos("Lugar: Ciudad Inventada, País Inventado", "<w:tab/>", "Duración: 3 días (01-03 a 03-03-2026)"),
  p("Involucrados: Alguien"),
  p("Objetivos:", true),
  tabla([["Objetivo", "Logrado"], ["1. Conocer la sede", "Sí"], ["2. Revisar el acceso", "Parcial"], ["3. Dar la charla", "No"]]),
  p("Resumen Ejecutivo:", true),
  p("La visita sirvió para conocer la sede."),
  p("Quedó pendiente la segunda charla."),
  p("Preparación de la visita:", true),
  p("Esto no va al resumen."),
  p("Desarrollo de la visita:", true),
  p("Esto tampoco."),
  p("Conclusiones:", true),
  p("1. Mandar el plan de cámaras al responsable."),
  p("La seguridad del lugar es buena."),
].join(""));
const PLAN = doc([
  p("Formulario de Viaje", true),
  p("Lugar: Ciudad Inventada, País Inventado"),
  p("Duración: 3 días"),
  p("Objetivos:", true),
  p("Conocer la sede"),
  p("Revisar el acceso"),
  p("Agenda del viaje:", true),
  p("Día 1: llegada"),
].join(""));
const MEMORIA = doc([p("Memoria Completa – Cierre de Viaje", true), p("Lugar: Ciudad Inventada"), p("Texto largo.")].join(""));
// Un viaje por dos lugares: un Cierre por cada uno.
const CIERRE_2 = doc([
  p("Formulario de Cierre de Viaje", true), p("Lugar: Otra Ciudad, Otro País"), p("Objetivos:", true),
  tabla([["Objetivo", "Logrado"], ["1. Visitar la escuela", "Sí"]]),
  p("Resumen Ejecutivo:", true), p("En la otra ciudad todo bien."), p("Conclusiones:", true), p("Volver en marzo."),
].join(""));
const CIERRE_EN = doc([p("Trip Closure Form", true), p("Goals:"), tabla([["Goals", "Achieved"], ["Meet", "YES"]])].join(""));

const b = await chromium.launch();
const pg = await b.newPage();
await pg.setContent("<!doctype html><meta charset=utf-8><body></body>");
const r = await pg.evaluate(([codigo, CIERRE, PLAN, MEMORIA, CIERRE_EN, CIERRE_2]) => {
  const api = new Function(`${codigo}; return { leerFormularioDeViaje, resumenCombinado, partesDe, idDePaso, esWordDeViaje, cuentaObjetivos, pasosPendientes };`)();
  const cierre = api.leerFormularioDeViaje(CIERRE);
  const plan = api.leerFormularioDeViaje(PLAN);
  const fuente = { name: "Formulario de Cierre.docx", subidoEl: "2026-03-05T10:00:00Z" };
  const uno = (leido, f) => [{ leido, fuente: f }];
  const r1 = api.resumenCombinado(null, uno(cierre, fuente));
  const p1 = api.partesDe(r1)[0];
  // Alguien tilda el primer paso; después se vuelve a subir el mismo Cierre.
  const tildado = { v:2, partes: [{ ...p1, pasos: p1.pasos.map((x, i) => i === 0 ? { ...x, estado: "hecho", por: "ana@x.com" } : x) }] };
  const r2 = api.resumenCombinado(tildado, uno(cierre, { name: "Cierre v2.docx", subidoEl: "2026-03-06T10:00:00Z" }));
  const delPlan = api.resumenCombinado(null, uno(plan, { name: "Formulario de Viaje.docx" }));
  const cierre2 = api.leerFormularioDeViaje(CIERRE_2);
  // Los dos Cierres de un viaje por dos lugares, leídos juntos o de a uno.
  const dos = api.resumenCombinado(null, [{ leido: cierre, fuente }, { leido: cierre2, fuente: { name: "Cierre 2.docx", subidoEl: "2026-03-07" } }]);
  const deAUno = api.resumenCombinado(r1, uno(cierre2, { name: "Cierre 2.docx", subidoEl: "2026-03-07" }));
  return {
    cierre, plan,
    memoria: api.leerFormularioDeViaje(MEMORIA).tipo,
    ingles: api.leerFormularioDeViaje(CIERRE_EN).tipo,
    r1: p1, r2: api.partesDe(r2)[0],
    planNoPisa: api.partesDe(api.resumenCombinado(r1, uno(plan, { name: "Formulario de Viaje.docx", subidoEl: "2026-03-09" }))).map(x => x.tipo),
    delPlan: api.partesDe(delPlan)[0],
    cierreSobrePlan: api.partesDe(api.resumenCombinado(delPlan, uno(cierre, fuente))).map(x => x.tipo),
    elegido: api.partesDe(api.resumenCombinado(null, [
      { fuente: { name: "plan", subidoEl: "2026-03-09" }, leido: plan },
      { fuente: { name: "cierre viejo", subidoEl: "2026-03-01" }, leido: cierre },
      { fuente: { name: "cierre nuevo", subidoEl: "2026-03-07" }, leido: cierre },
      { fuente: { name: "memoria", subidoEl: "2026-03-10" }, leido: { tipo: null } },
    ])).map(x => x.fuente.name),
    nadie: api.resumenCombinado(null, [{ fuente: { name: "m" }, leido: { tipo: null } }]),
    dos: api.partesDe(dos).map(x => [x.lugar, x.objetivos.length, x.pasos.length]),
    deAUno: api.partesDe(deAUno).map(x => x.lugar),
    viejo: api.partesDe({ v:1, tipo:"cierre", objetivos:[], pasos:[] }).length,
    cuentaDos: api.cuentaObjetivos(api.partesDe(dos)),
    word: [api.esWordDeViaje({ name: "Cierre.docx" }), api.esWordDeViaje({ name: "Cierre.pdf" }), api.esWordDeViaje({ name: "viejo.doc" })],
    cuenta: api.cuentaObjetivos(api.partesDe(r1)),
    pendientes: api.pasosPendientes(api.partesDe(r2)).length,
    mismoId: api.idDePaso("Mandar el plan") === api.idDePaso("mandar  el plan"),
  };
}, [codigo, CIERRE, PLAN, MEMORIA, CIERRE_EN, CIERRE_2]);
await b.close();

/* ---------- El Formulario de Cierre ---------- */
eq("cierre: se reconoce por el título", r.cierre.tipo, "cierre");
eq("cierre: lugar y duración, aunque Word los deje en el mismo renglón", [r.cierre.lugar, r.cierre.duracion], ["Ciudad Inventada, País Inventado", "3 días (01-03 a 03-03-2026)"]);
eq("cierre: los objetivos de la tabla, sin el encabezado ni el número", r.cierre.objetivos.map(o => o.t), ["Conocer la sede", "Revisar el acceso", "Dar la charla"]);
eq("cierre: con Sí / Parcial / No", r.cierre.objetivos.map(o => o.logrado), ["si", "parcial", "no"]);
eq("cierre: el resumen ejecutivo, y solo eso", r.cierre.ejecutivo, "La visita sirvió para conocer la sede.\n\nQuedó pendiente la segunda charla.");
eq("cierre: las conclusiones, sin el número", r.cierre.conclusiones, ["Mandar el plan de cámaras al responsable.", "La seguridad del lugar es buena."]);
eq("cierre: la preparación y el desarrollo no entran", JSON.stringify(r.cierre).includes("no va al resumen"), false);

/* ---------- El Formulario de Viaje ---------- */
eq("plan: se reconoce", r.plan.tipo, "plan");
eq("plan: los objetivos son la lista, hasta la agenda", r.plan.objetivos.map(o => [o.t, o.logrado]), [["Conocer la sede", null], ["Revisar el acceso", null]]);
eq("plan: sin resumen ni conclusiones", [r.plan.ejecutivo, r.plan.conclusiones], ["", []]);

/* ---------- Lo que NO se lee ---------- */
eq("la Memoria no se resume (es el detalle entero)", r.memoria, null);
eq("el Cierre en inglés tampoco: se lee el de español", r.ingles, null);
eq("solo los Word nuevos (.docx)", r.word, [true, false, false]);

/* ---------- Lo que se guarda ---------- */
eq("guardado: las conclusiones pasan a ser «lo que sigue», pendientes", r.r1.pasos.map(x => [x.t, x.estado]),
  [["Mandar el plan de cámaras al responsable.", "pendiente"], ["La seguridad del lugar es buena.", "pendiente"]]);
eq("guardado: con de dónde salió", r.r1.fuente, { name: "Formulario de Cierre.docx", subidoEl: "2026-03-05T10:00:00Z" });
eq("guardado: 1 de 3 objetivos logrados", r.cuenta, { total: 3, si: 1, parcial: 1 });
eq("volver a subir el Cierre no destilda lo que ya se marcó", [r.r2.pasos[0].estado, r.r2.pasos[0].por], ["hecho", "ana@x.com"]);
eq("y lo hecho ya no cuenta como pendiente", r.pendientes, 1);
eq("el id de un paso no depende de mayúsculas ni espacios", r.mismoId, true);
eq("un Formulario de Viaje no pisa un Cierre ya leído", r.planNoPisa, ["cierre"]);
eq("sin Cierre, el Formulario de Viaje da los objetivos planeados", [r.delPlan.tipo, r.delPlan.objetivos.length, r.delPlan.pasos], ["plan", 2, []]);
eq("y cuando llega el Cierre, lo reemplaza", r.cierreSobrePlan, ["cierre"]);
eq("del mismo lugar, manda el Cierre más nuevo (y el Formulario de Viaje sobra)", r.elegido, ["cierre nuevo"]);
eq("un viaje por dos lugares guarda los dos Cierres, cada uno con lo suyo", r.dos, [["Ciudad Inventada, País Inventado", 3, 2], ["Otra Ciudad, Otro País", 1, 1]]);
eq("y subir el segundo después no borra el primero", r.deAUno, ["Ciudad Inventada, País Inventado", "Otra Ciudad, Otro País"]);
eq("los objetivos de los dos se suman", r.cuentaDos, { total: 4, si: 2, parcial: 1 });
eq("un resumen guardado con la forma de antes se sigue leyendo", r.viejo, 1);
eq("si no hay ningún formulario, no hay nada que guardar", r.nadie, null);

console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
