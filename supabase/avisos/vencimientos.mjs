/* ======================================================================
   «Hoy vence»: el recordatorio de un paso de «Lo que sigue» (13/10/2026)
   ======================================================================
   Propuesta 1-B del usuario: quien tiene un paso asignado se entera
   cuando se lo dan (la función `avisar`, 21-avisos-de-pasos.sql) y otra vez
   el día que vence. Esto es lo segundo: corre cada hora, junto con los
   resúmenes (workflow «Resúmenes por correo»), con la llave de servicio.

   A cada persona le manda, por cada paso suyo que sigue pendiente y que vence
   HOY en SU zona horaria, un correo a partir de SU hora (la misma que eligió
   para sus resúmenes, de fábrica las 9), una sola vez: lo ya enviado queda
   anotado en avisos_enviados («paso-vence»); si Resend falla, se borra la
   marca y la corrida de la hora siguiente lo reintenta, mientras siga siendo
   ese día. Quién puede recibir correos y si apagó «El día que vence»
   (emailVence) lo decide la base, con las mismas funciones que usa la app
   (puede_recibir_correos, prefs_de_correo). Como mucho 5 por persona y por
   corrida. El registro de esta corrida es público: solo cantidades.
   ====================================================================== */
import { pathToFileURL } from "node:url";
import { correoVence } from "../functions/_compartido/correos.mjs";
import { leerConfiguracion, rest, rpc, mandar, relojDe } from "./resumen.mjs";

export const TOPE_POR_PERSONA = 5;

// Los pasos pendientes con responsable y fecha, de los posteos que siguen en pie.
export function pasosConFecha(posts){
  const salida = [];
  for(const p of posts){
    if(p.cancelled) continue;
    const partes = Array.isArray(p.resumen && p.resumen.partes) ? p.resumen.partes : [];
    for(const parte of partes) for(const x of (Array.isArray(parte && parte.pasos) ? parte.pasos : [])){
      if(!x || (x.estado && x.estado !== "pendiente")) continue;
      const resp = String(x.resp || "").toLowerCase(), para = String(x.para || "");
      if(!resp || !/^\d{4}-\d{2}-\d{2}$/.test(para)) continue;
      salida.push({ resp, para, asignado: String(x.asigEl || ""), post: p.id, titulo: p.title, tipo: p.activity_type, paso: String(x.id || ""), texto: String(x.t || "") });
    }
  }
  return salida;
}

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const posts = await rest("posts?select=id,title,activity_type,cancelled,resumen&resumen=not.is.null");
  const pasos = pasosConFecha(posts);
  const porPersona = new Map();
  for(const x of pasos) porPersona.set(x.resp, [...(porPersona.get(x.resp) || []), x]);
  let enviados = 0, fallados = 0, saltados = 0;
  for(const [email, suyos] of porPersona){
    try{
      if(!(await rpc("puede_recibir_correos", { p_email: email }))){ saltados++; continue; }
      const pr = await rpc("prefs_de_correo", { p_email: email });
      if(!pr || !pr.on || !pr.vence){ saltados++; continue; }
      const suyo = relojDe(ahora, pr.tz);
      // Los de hoy en su zona, a partir de su hora; y no el que le dieron hoy
      // mismo: se acaba de enterar.
      const asignadoHoy = x => !!x.asignado && !isNaN(Date.parse(x.asignado)) && relojDe(Date.parse(x.asignado), pr.tz).fecha === suyo.fecha;
      const hoy = suyos.filter(x => x.para === suyo.fecha && suyo.hora >= pr.hour && !asignadoHoy(x)).slice(0, TOPE_POR_PERSONA);
      for(const x of hoy){
        const objeto = `${x.post}#${x.paso}@${x.para}`;
        // La marca primero: si dos corridas se pisan, solo una la consigue.
        const hecha = await rest("avisos_enviados", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({ tipo: "paso-vence", objeto, email, autor: null }) });
        if(!Array.isArray(hecha) || !hecha.length) continue;
        try{ await mandar(email, correoVence({ titulo: x.titulo, tipo: x.tipo, texto: x.texto, post: x.post, cuando: x.para, lang: pr.lang })); enviados++; }
        catch(err){
          fallados++; console.error(`  ✗ ${err.message}`);
          await rest(`avisos_enviados?${new URLSearchParams({ tipo: "eq.paso-vence", objeto: `eq.${objeto}`, email: `eq.${email}` })}`, { method: "DELETE" }).catch(() => {});
        }
      }
    }catch(err){ fallados++; console.error(`  ✗ ${err.message}`); }
  }
  console.log(`Pasos con responsable y fecha: ${pasos.length}. Recordatorios enviados: ${enviados}. Saltados: ${saltados}. Fallados: ${fallados}.`);
  if(fallados) process.exitCode = 1;
  return { enviados, fallados, saltados };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
