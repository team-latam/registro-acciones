/* ======================================================================
   Textos e idiomas

   Todo texto visible pasa por t(es, en, pt, he, vars?) (CLAUDE.md). Esto
   revisa cada llamada:
   - que tenga los cuatro idiomas y ninguno vacío;
   - que el hebreo esté en hebreo (no el español copiado);
   - que los {marcadores} sean los mismos en los cuatro (si falta uno, en
     ese idioma sale "{n}" o se pierde el dato);
   - y busca texto en español escrito directo en el HTML que arman las
     plantillas, sin pasar por t() (queda en español en los cuatro).
   ====================================================================== */
import { js, lineaDeJs, recorrer, hallazgo, entregar } from "./comun.mjs";

const out = [];
const re = /(?<![\w$.])t\(/g;
let m, llamadas = 0;
const dentroDeT = [];   // [desde, hasta] de cada t(...): lo de adentro ya está traducido
const enComentario = pos => /^\s*(\/\/|\*|\/\*)/.test(js.slice(js.lastIndexOf("\n", pos) + 1, pos));
const NOMBRES = /^(Calendar|Google|Google Calendar|PDF|Excel|Word|LatAm|Supabase|GitHub|E-?mail|WhatsApp|IP|CSV|Zoom|OK|Team LatAm)\b/;
while((m = re.exec(js))){
  const abre = m.index + 1;
  const args = []; let desde = abre + 1, fin = -1;
  for(const [j, c, prof] of recorrer(js, abre)){
    if(c === "," && prof === 1){ args.push(js.slice(desde, j)); desde = j + 1; }
    if(c === ")" && prof === 0){ args.push(js.slice(desde, j)); fin = j; break; }
  }
  if(fin < 0 || enComentario(m.index)) continue;
  dentroDeT.push([abre, fin]);
  llamadas++;
  const a = args.map(s => s.trim());
  const linea = lineaDeJs(abre);
  const lit = s => { const x = /^(["'`])([\s\S]*)\1$/.exec(s); return x ? x[2] : null; };
  const [es, en, pt, he] = a.slice(0, 4).map(lit);
  const donde = `index.html:${linea}`;
  if(a.length < 4){ out.push(hallazgo("idiomas", "medio", "Texto con menos de cuatro idiomas", donde, a[0])); continue; }
  [["inglés", en], ["portugués", pt], ["hebreo", he]].forEach(([n, v]) => { if(v === "") out.push(hallazgo("idiomas", "medio", `Texto sin ${n}`, donde, es)); });
  const esFormato = /^[admy\/. -]+$/i.test(es || "");   // "dd/mm/aaaa": igual en hebreo
  if(es && he !== null && !/[\u0590-\u05FF]/.test(he) && /[a-záéíóúñ]{3,}/i.test(es) && !NOMBRES.test(es) && !esFormato)
    out.push(hallazgo("idiomas", "bajo", "El hebreo no está en hebreo", donde, `${es} → ${he}`));
  if(es !== null){
    const marcas = s => [...new Set((s || "").match(/\{(\w+)\}/g) || [])].sort().join(",");
    const base = marcas(es);
    [["en", en], ["pt", pt], ["he", he]].forEach(([n, v]) => {
      if(v !== null && marcas(v) !== base) out.push(hallazgo("idiomas", "medio", `Los {marcadores} no coinciden (${n})`, donde, `${es} | ${v}`));
    });
  }
}
// Texto en español suelto en las plantillas: ">Algo en español<" sin ${}.
const reTxt = />([^<>${}`\n]*[a-záéíóúñ]{4,}[^<>${}`\n]*)</gi;
while((m = reTxt.exec(js))){
  const txt = m[1].trim();
  if(enComentario(m.index) || dentroDeT.some(([a, b]) => m.index > a && m.index < b)) continue;
  if(/[=;{}]|=>|\(\)/.test(txt)) continue;   // es código, no texto
  if(!txt || /^[\s\d·.,:;()+\-–—✕×→←↑↓▾▴…%/]*$/.test(txt) || NOMBRES.test(txt)) continue;
  if(!/[áéíóúñ¿¡]|\b(de|la|el|los|las|un|una|para|con|sin|que|del)\b/i.test(txt)) continue;
  out.push(hallazgo("idiomas", "bajo", "Texto visible escrito directo, sin t()", `index.html:${lineaDeJs(m.index)}`, txt));
}
out.push(hallazgo("idiomas", "dato", `Textos traducidos: ${llamadas}`));
entregar("textos", out);
