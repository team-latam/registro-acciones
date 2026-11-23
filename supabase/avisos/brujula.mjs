/* ======================================================================
   Brújula: el aviso a los admin cuando hay personas nuevas esperando acceso
   (23/11/2026, pedido del usuario; viene APAGADO de fábrica)
   ======================================================================
   Las planillas de Google «Users» son donde se carga a quien hay que darle
   acceso a Brújula; el Script de los lunes (o «Dar acceso» en Toldot) los
   procesa. Si el admin prendió este aviso (Administración › Correos), cada
   hora —junto con los resúmenes (workflow «Resúmenes por correo»)— se leen las
   planillas y, si hay alguien cargado que todavía no está «Enviado», le llega
   un correo corto con quiénes son.
   - Solo LEE: pide a Google un permiso de solo lectura (cuenta de servicio de
     Brújula, secreto GOOGLE_CUENTA_BRUJULA). Sin ese secreto, no hace nada.
   - Una sola vez por persona y por admin: la marca va primero (avisos_enviados,
     «brujula», el correo de la persona): dos corridas que se pisan mandan uno
     solo, y si Resend falla se borran las marcas y la hora siguiente reintenta.
   - Quién puede recibir correos y si apagó todos sus correos lo decide la base,
     con las mismas funciones que usa la app (puede_recibir_correos, prefs_de_correo).
   - Si no hay nadie nuevo, no llega nada. El registro de esta corrida es
     público: solo cantidades, nunca nombres ni correos.
   ====================================================================== */
import { pathToFileURL } from "node:url";
import { correoPendientesBrujula, idioma } from "../functions/_compartido/correos.mjs";
import { leerCuenta, permisoDeGoogle } from "../functions/_compartido/google.mjs";
import { filasDe, ALCANCE_LECTURA } from "../functions/_compartido/brujula.mjs";
import { cfg, leerConfiguracion, rest, rpc, mandar } from "./resumen.mjs";

// Prendido solo si el admin lo prendió (app_config 'preferences' → correos.brujula = { on: true }, Administración › Correos).
export const configDeBrujula = valor => ({ on: !!(valor && valor.correos && valor.correos.brujula && valor.correos.brujula.on === true) });

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const filas = await rest("app_config?select=value&key=eq.preferences");
  if(!configDeBrujula(Array.isArray(filas) && filas[0] ? filas[0].value : null).on){
    console.log("El aviso de Brújula está apagado en Administración › Correos.");
    return { enviados: 0, fallados: 0, saltados: 0, pendientes: 0 };
  }
  const cuenta = process.env.GOOGLE_CUENTA_BRUJULA;
  if(!cuenta){ console.log("Falta GOOGLE_CUENTA_BRUJULA: no se pueden leer las planillas."); return { enviados: 0, fallados: 0, saltados: 0, pendientes: 0 }; }
  const planillas = await rest("brujula_planillas?select=id&order=orden.asc&limit=20");
  if(!Array.isArray(planillas) || !planillas.length){ console.log("Brújula todavía no tiene planillas."); return { enviados: 0, fallados: 0, saltados: 0, pendientes: 0 }; }

  // Quién espera: cargado en una planilla y sin «Enviado».
  const token = await permisoDeGoogle(leerCuenta(cuenta), { fetch: (...a) => globalThis.fetch(...a), ahora, alcance: ALCANCE_LECTURA });
  const pendientes = new Map();
  for(const pl of planillas){
    const r = await filasDe((...a) => globalThis.fetch(...a), token, pl.id);
    if(r.error){ console.error(`  ✗ no se pudo leer una planilla (${r.error})`); continue; }
    for(const f of r.filas) if(!f.enviado) pendientes.set(f.correo, f.nombre || f.correo);
  }
  if(!pendientes.size){ console.log("Nadie espera acceso."); return { enviados: 0, fallados: 0, saltados: 0, pendientes: 0 }; }

  const miembros = await rest("members?select=email&role=eq.admin");
  const admins = [...new Set([cfg.admin, ...miembros.map(m => String(m.email).toLowerCase())])].filter(Boolean);
  let enviados = 0, fallados = 0, saltados = 0;
  for(const email of admins){
    try{
      if(!(await rpc("puede_recibir_correos", { p_email: email }))){ saltados++; continue; }
      const pr = await rpc("prefs_de_correo", { p_email: email });
      if(!pr || !pr.on){ saltados++; continue; }
      const ya = new Set((await rest(`avisos_enviados?${new URLSearchParams({ select: "objeto", tipo: "eq.brujula", email: `eq.${email}` })}`)).map(x => x.objeto));
      const nuevos = [...pendientes.keys()].filter(c => !ya.has(c));
      if(!nuevos.length) continue;
      // Las marcas primero: las que se consiguen son las nuevas de verdad.
      const hechas = await rest("avisos_enviados", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify(nuevos.map(objeto => ({ tipo: "brujula", objeto, email, autor: null }))) });
      if(!Array.isArray(hechas) || !hechas.length) continue;
      const quienes = hechas.map(h => h.objeto);
      try{ await mandar(email, correoPendientesBrujula({ nombres: quienes.map(c => pendientes.get(c)), total: pendientes.size, lang: idioma(pr.lang) })); enviados++; }
      catch(err){
        fallados++; console.error(`  ✗ ${err.message}`);
        for(const objeto of quienes) await rest(`avisos_enviados?${new URLSearchParams({ tipo: "eq.brujula", objeto: `eq.${objeto}`, email: `eq.${email}` })}`, { method: "DELETE" }).catch(() => {});
      }
    }catch(err){ fallados++; console.error(`  ✗ ${err.message}`); }
  }
  console.log(`Esperan acceso: ${pendientes.size}. Correos enviados: ${enviados}. Saltados: ${saltados}. Fallados: ${fallados}.`);
  if(fallados) process.exitCode = 1;
  return { enviados, fallados, saltados, pendientes: pendientes.size };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
