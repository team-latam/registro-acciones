/* ======================================================================
   El informe mensual por correo (13/10/2026, propuesta 3-A del usuario)
   ======================================================================
   El primer día de cada mes, a las personas que eligió un admin
   (Administración → Correos → «Informe mensual»: app_config 'preferences' →
   correos.informe = {on, para: [correos]}) les llega un aviso del informe
   del mes que terminó. El correo NO lleva ningún número: trae un botón al
   informe, que se abre dentro del Registro con la cuenta del equipo, y el
   enlace vence a las 48 horas (23-informe-mensual.sql, informe_vigente).
   Lo que decide el vencimiento es la marca de avisos_enviados («informe»,
   «2026-10») con la hora en que salió, que se escribe acá.
   Corre cada hora junto con los resúmenes (workflow «Resúmenes por correo»),
   con la llave de servicio, y manda como mucho uno por persona y por mes:
   - le toca el día 1 EN SU zona horaria a partir de SU hora (la de sus
     resúmenes; de fábrica, las 9) y hasta el día 3, por si GitHub atrasó o
     falló la corrida del día 1 (si pasa del 3, el enlace llegaría casi
     vencido a otro día y ya no tiene sentido);
   - la marca va primero: dos corridas que se pisan mandan uno solo; si
     Resend falla, se borra la marca y la corrida de la hora siguiente reintenta;
   - los destinatarios los elige el admin: tienen que seguir siendo del equipo
     (members). Quién puede recibir los demás avisos (Administración → Correos →
     «Quién puede recibir avisos») no los frena: no son lo mismo. Sí cuenta que no
     hayan apagado todos sus correos (emailOn), cosa que solo pueden hacer
     quienes ven esa pantalla.
   El registro de esta corrida es público: solo cantidades.
   ====================================================================== */
import { pathToFileURL } from "node:url";
import { correoInforme, idioma } from "../functions/_compartido/correos.mjs";
import { cfg, leerConfiguracion, rest, rpc, mandar, relojDe } from "./resumen.mjs";

export const DIA_MAXIMO = 3;
export const HORAS_DE_VIDA_DEL_ENLACE = 48;

// El mes que terminó, «2026-10», si hoy (en SU zona) es del 1 al 3 y ya pasó SU
// hora el día 1; si no, null. Un mes antes de enero es diciembre del año anterior.
export function mesQueLeToca(reloj, hora){
  const dia = Number(reloj.fecha.slice(8, 10));
  if(dia > DIA_MAXIMO) return null;
  if(dia === 1 && reloj.hora < hora) return null;
  const anio = Number(reloj.fecha.slice(0, 4)), mes = Number(reloj.fecha.slice(5, 7));
  const m = mes === 1 ? 12 : mes - 1, a = mes === 1 ? anio - 1 : anio;
  return `${a}-${String(m).padStart(2, "0")}`;
}

// Lo que guardó el admin; lo que no tenga la forma, vale lo de fábrica (apagado, sin nadie).
export function configDelInforme(valor){
  const i = valor && valor.correos && valor.correos.informe;
  const para = i && Array.isArray(i.para) ? [...new Set(i.para.filter(e => typeof e === "string" && /^[^@\s]+@[^@\s]+$/.test(e)).map(e => e.toLowerCase()))].slice(0, 100) : [];
  return { on: !!(i && i.on === true), para };
}

export async function main(ahora = Date.now()){
  leerConfiguracion();
  const filas = await rest("app_config?select=value&key=eq.preferences");
  const { on, para } = configDelInforme(Array.isArray(filas) && filas[0] ? filas[0].value : null);
  if(!on || !para.length){ console.log("El informe mensual está apagado, o no tiene a nadie elegido, en Administración → Correos."); return { enviados: 0, fallados: 0, saltados: 0 }; }
  const miembros = new Set((await rest("members?select=email")).map(m => String(m.email).toLowerCase()));
  if(cfg.admin) miembros.add(cfg.admin.toLowerCase());

  let enviados = 0, fallados = 0, saltados = 0, quienesToca = 0;
  for(const email of para){
    try{
      if(!miembros.has(email)){ saltados++; continue; }
      const pr = await rpc("prefs_de_correo", { p_email: email });
      if(!pr || !pr.on){ saltados++; continue; }
      const suyo = relojDe(ahora, pr.tz);
      const mes = mesQueLeToca(suyo, pr.hour);
      if(!mes) continue;
      quienesToca++;
      // La marca primero: si dos corridas se pisan, solo una la consigue. Trae la hora
      // en que salió, que es la que cuenta para el vencimiento del enlace.
      const hecha = await rest("avisos_enviados", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ tipo: "informe", objeto: mes, email, autor: null }) });
      if(!Array.isArray(hecha) || !hecha.length) continue;
      const salio = Date.parse(hecha[0].enviado_el) || ahora;
      const vence = new Date(salio + HORAS_DE_VIDA_DEL_ENLACE * 3600000).toISOString();
      try{ await mandar(email, correoInforme({ mes, vence, lang: idioma(pr.lang), zona: pr.tz })); enviados++; }
      catch(err){
        fallados++; console.error(`  ✗ ${err.message}`);
        await rest(`avisos_enviados?${new URLSearchParams({ tipo: "eq.informe", objeto: `eq.${mes}`, email: `eq.${email}` })}`, { method: "DELETE" }).catch(() => {});
      }
    }catch(err){ fallados++; console.error(`  ✗ ${err.message}`); }
  }
  console.log(`Personas elegidas: ${para.length}. Les tocaba hoy: ${quienesToca}. Avisos enviados: ${enviados}. Saltadas: ${saltados}. Fallados: ${fallados}.`);
  if(fallados) process.exitCode = 1;
  return { enviados, fallados, saltados };
}

if(import.meta.url === pathToFileURL(process.argv[1] || "").href){
  main().catch(err => { console.error(err.message); process.exit(1); });
}
