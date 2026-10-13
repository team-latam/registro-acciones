/* ======================================================================
   Ejemplos de los correos nuevos, para el administrador (13/10/2026)
   ======================================================================
   El usuario pidió ver cómo llegan «Lugares sin actividad» y el «Informe
   mensual» sin esperar al primer lunes ni al día 1. Esto se corre a mano
   (workflow «Ejemplos de los correos», botón «Run workflow») con las llaves
   de verdad, y manda DOS correos, solo al administrador fijo:
   - «Lugares sin actividad», con la lista de verdad de hoy (si hoy no hay
     ningún país en esa situación, con otro plazo más corto, y si tampoco, con
     un ejemplo inventado, dicho en el correo), marcado como ejemplo;
   - el «Informe mensual» del último mes completo, marcado como prueba, y con
     el enlace de verdad: deja la marca de «informe-prueba» para que el botón
     abra el informe durante 48 horas (como el botón «Mandarme un informe de
     prueba» de Administración → Correos).
   En el idioma y la zona que ese administrador tiene guardados. No lee a
   nadie más ni manda a nadie más. El registro de la corrida es público:
   solo cantidades.
   ====================================================================== */
import { pathToFileURL } from "node:url";
import { correoInforme, correoLugares, idioma } from "../functions/_compartido/correos.mjs";
import { cfg, leerConfiguracion, rest, rpc, mandar, relojDe } from "./resumen.mjs";
import { lugaresSinActividad, paisesDeLaApp, configDeLugares, PLAZOS } from "./lugares.mjs";

export const HORAS_DE_VIDA_DEL_ENLACE = 48;
// Si hoy no hay ningún país sin actividad, un ejemplo inventado: tres países y fechas relativas a hoy.
const INVENTADOS = ["Chile", "Perú", "Paraguay"];

const mesAnterior = fecha => {
  const a = Number(fecha.slice(0, 4)), m = Number(fecha.slice(5, 7));
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`;
};
const restar = (fecha, meses) => { const d = new Date(`${fecha}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - meses); return d.toISOString().slice(0, 10); };

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const para = cfg.admin;
  const pr = await rpc("prefs_de_correo", { p_email: para });
  const lang = idioma(pr && pr.lang), tz = pr && pr.tz;
  const hoy = relojDe(ahora, tz).fecha;

  // 1. Lugares sin actividad.
  const filas = await rest("app_config?select=value&key=eq.preferences");
  const { meses: plazoGuardado } = configDeLugares(Array.isArray(filas) && filas[0] ? filas[0].value : null);
  const posts = await rest("posts?select=id,start_date,date,recurrence,recurrence_skip,cancelled,scopes&cancelled=eq.false");
  const paises = paisesDeLaApp();
  let meses = plazoGuardado, lugares = lugaresSinActividad(posts, { hoy, meses, paises: paises.nombres });
  let deVerdad = true;
  if(!lugares.length){ meses = PLAZOS[0]; lugares = lugaresSinActividad(posts, { hoy, meses, paises: paises.nombres }); }
  if(!lugares.length){
    deVerdad = false; meses = plazoGuardado;
    lugares = INVENTADOS.map((pais, i) => ({ pais, ultima: restar(hoy, meses + 2 + i * 3), hace: meses + 2 + i * 3, plan: i === 0 ? restar(hoy, -1) : "" }));
  }
  const conNombre = lugares.map(l => ({ ...l, pais: (paises.etiquetas[l.pais] || {})[lang] || l.pais }));
  await mandar(para, correoLugares({ lugares: conNombre, meses, lang, ejemplo: true }));

  // 2. El informe del último mes completo, con el enlace valiendo 48 horas desde ahora.
  const mes = mesAnterior(hoy);
  const marca = await rest("avisos_enviados", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ tipo: "informe-prueba", objeto: mes, email: para, autor: para, enviado_el: new Date(ahora).toISOString() }) });
  const salio = Array.isArray(marca) && marca[0] && Date.parse(marca[0].enviado_el) || ahora;
  const vence = new Date(salio + HORAS_DE_VIDA_DEL_ENLACE * 3600000).toISOString();
  await mandar(para, correoInforme({ mes, vence, lang, zona: tz, prueba: true }));

  console.log(`Ejemplos enviados: 2. Lugares: ${conNombre.length}${deVerdad ? "" : " (inventados)"}, plazo ${meses} meses.`);
  return { enviados: 2, lugares: conNombre.length, deVerdad, meses, mes };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
