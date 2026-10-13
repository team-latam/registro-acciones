/* Un lector mínimo de .xlsx para las pruebas (sin librerías): abre el .zip, trae cada archivo
   como texto y arma las filas de la primera hoja. No es un lector general: entiende lo que
   escribe index.html (textos compartidos, números, fechas como número, fórmulas de enlace). */
import zlib from "node:zlib";

const sinXml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const TABLA = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = b => { let c = 0xFFFFFFFF; for(let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

// { nombres: [en orden], archivos: { nombre: texto }, metodos: { nombre: 0 | 8 }, crcBien: true }
export function abrirZip(buffer){
  const b = Buffer.from(buffer);
  let fin = -1;
  for(let i = b.length - 22; i >= 0; i--) if(b.readUInt32LE(i) === 0x06054b50){ fin = i; break; }
  if(fin < 0) throw new Error("no es un .zip: falta el final");
  const total = b.readUInt16LE(fin + 10); let pos = b.readUInt32LE(fin + 16);
  const salida = { nombres: [], archivos: {}, metodos: {}, crcBien: true };
  for(let k = 0; k < total; k++){
    if(b.readUInt32LE(pos) !== 0x02014b50) throw new Error("registro central roto");
    const metodo = b.readUInt16LE(pos + 10), crc = b.readUInt32LE(pos + 16), comp = b.readUInt32LE(pos + 20), sin = b.readUInt32LE(pos + 24);
    const nom = b.readUInt16LE(pos + 28), extra = b.readUInt16LE(pos + 30), com = b.readUInt16LE(pos + 32), desde = b.readUInt32LE(pos + 42);
    const nombre = b.toString("utf8", pos + 46, pos + 46 + nom);
    if(b.readUInt32LE(desde) !== 0x04034b50) throw new Error("encabezado local roto");
    const inicio = desde + 30 + b.readUInt16LE(desde + 26) + b.readUInt16LE(desde + 28);
    const crudo = b.subarray(inicio, inicio + comp);
    const datos = metodo === 8 ? zlib.inflateRawSync(crudo) : crudo;
    if(datos.length !== sin || crc32(datos) !== crc) salida.crcBien = false;
    salida.nombres.push(nombre); salida.archivos[nombre] = datos.toString("utf8"); salida.metodos[nombre] = metodo;
    pos += 46 + nom + extra + com;
  }
  return salida;
}
// Las filas de la primera hoja: [[valor, …]]. Texto: string · número/fecha: Number · enlace: { f, v }.
export function leerHoja(zip){
  const compartidas = [...(zip.archivos["xl/sharedStrings.xml"] || "").matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)].map(m => sinXml(m[1]));
  const xml = zip.archivos["xl/worksheets/sheet1.xml"];
  const filas = [];
  for(const fila of xml.matchAll(/<row r="(\d+)">([\s\S]*?)<\/row>/g)){
    const valores = [];
    for(const c of fila[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      let col = 0; for(const ch of c[1]) col = col * 26 + (ch.charCodeAt(0) - 64); col--;
      const attrs = c[2], cuerpo = c[3] || "";
      const t = (/ t="(\w+)"/.exec(attrs) || [])[1], v = (/<v>([\s\S]*?)<\/v>/.exec(cuerpo) || [])[1], f = (/<f>([\s\S]*?)<\/f>/.exec(cuerpo) || [])[1];
      valores[col] = f != null ? { f: sinXml(f), v: sinXml(v || "") } : t === "s" ? compartidas[Number(v)] : v == null ? undefined : Number(v);
    }
    filas[Number(fila[1]) - 1] = valores;
  }
  return filas;
}
// Los títulos de la tabla de Excel y su rango.
export function leerTabla(zip){
  const x = zip.archivos["xl/tables/table1.xml"];
  if(!x) return null;
  return { ref: (/ ref="([^"]+)" totalsRowShown/.exec(x) || [])[1], columnas: [...x.matchAll(/<tableColumn id="\d+" name="([^"]*)"\/>/g)].map(m => sinXml(m[1])), filtro: (/<autoFilter ref="([^"]+)"/.exec(x) || [])[1] };
}
