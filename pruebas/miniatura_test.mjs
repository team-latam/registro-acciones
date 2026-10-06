import { chromium } from "playwright";
import fs from "node:fs";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));

/* ======================================================================
   La miniatura de una foto, en un navegador de verdad

   Con Supabase, cada foto se sube dos veces: entera, para el visor, y
   chica, para la tarjeta, que la muestra en un cuadrado de 92 px (ver
   crearSupabaseStore). La chica la arma achicarDataUrl con un canvas, y
   un canvas no existe fuera del navegador: sb_test.mjs le pasa al
   adaptador una de mentira. Acá se prueba la de verdad.

   Y compressImage, que es la que achica la foto entera al elegirla, ahora
   usa la misma función por dentro: que siga andando como antes.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const grab = hacerGrab(src);
let codigo = null;
try{ codigo = [grab("achicarDataUrl"), grab("compressImage")].join("\n"); }
catch(e){ fail++; console.log(`✗ no se encontró el código que arma las fotos: ${e.message}`); }

if(codigo){
  const b = await chromium.launch();
  const p = await b.newPage();
  const errores = [];
  p.on("pageerror", e => errores.push(String(e)));
  await p.setContent("<!doctype html><meta charset=utf-8><body></body>");
  await p.addScriptTag({ content: `const t = es => es;\n${codigo}\n
    window.__achicar = achicarDataUrl; window.__comprimir = compressImage;` });

  const r = await p.evaluate(async () => {
    // Una "foto" de 2560 x 1920 como las que se suben: degradé, formas y
    // grano, para que el JPEG pese como el de una foto y no como un dibujo.
    const foto = (ancho, alto) => {
      const c = document.createElement("canvas");
      c.width = ancho; c.height = alto;
      const x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, ancho, alto);
      g.addColorStop(0, "#1d4ed8"); g.addColorStop(1, "#f59e0b");
      x.fillStyle = g; x.fillRect(0, 0, ancho, alto);
      for(let i = 0; i < 60; i++){
        x.fillStyle = `hsl(${i * 37 % 360} 70% 50% / .6)`;
        x.beginPath(); x.arc((i * 997) % ancho, (i * 613) % alto, 40 + i % 90, 0, 7); x.fill();
      }
      const d = x.getImageData(0, 0, ancho, alto);
      let s = 7;
      for(let i = 0; i < d.data.length; i += 4){ s = (s * 1103515245 + 12345) % 2147483648; d.data[i] += (s >> 24) % 24; }
      x.putImageData(d, 0, 0);
      return c.toDataURL("image/jpeg", 0.85);
    };
    const medidas = url => new Promise((ok, mal) => {
      const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.onerror = mal; i.src = url;
    });
    const bytes = url => Math.floor((url.length - url.indexOf(",") - 1) * 3 / 4);

    const apaisada = foto(2560, 1920), parada = foto(1920, 2560), chica = foto(300, 200);
    const mApaisada = await window.__achicar(apaisada, 480, 0.75);
    const mParada = await window.__achicar(parada, 480, 0.75);
    const mChica = await window.__achicar(chica, 480, 0.75);
    const mWebp = await window.__achicar(apaisada, 480, 0.75, "image/webp");
    let rota = null;
    try{ await window.__achicar("data:image/jpeg;base64,esto no es una foto", 480, 0.75); }
    catch(e){ rota = e.message; }

    // compressImage, como la usa la app: con el archivo que se eligió.
    const archivo = new File([await (await fetch(apaisada)).blob()], "foto.jpg", { type: "image/jpeg" });
    const entera = await window.__comprimir(archivo, 1280, 0.72);

    return {
      tipo: mApaisada.slice(0, 23),
      apaisada: await medidas(mApaisada), parada: await medidas(mParada), chica: await medidas(mChica),
      pesoFoto: bytes(apaisada), pesoMini: bytes(mApaisada),
      rota, tipoWebp: mWebp.slice(0, 23), pesoWebp: bytes(mWebp),
      entera: await medidas(entera), tipoEntera: entera.slice(0, 23),
    };
  });

  eq("sin pedir otra cosa, un JPEG", r.tipo, "data:image/jpeg;base64,");
  eq("pedida en WebP, sale en WebP", r.tipoWebp, "data:image/webp;base64,");
  eq("y pesa menos que en JPEG", r.pesoWebp < r.pesoMini, true);
  eq("una foto apaisada queda de 480 de ancho, sin deformarse", r.apaisada, [480, 360]);
  eq("una parada, de 480 de alto", r.parada, [360, 480]);
  eq("una que ya es chica no se agranda", r.chica, [300, 200]);
  eq("y pesa al menos diez veces menos que la foto entera", r.pesoMini * 10 < r.pesoFoto, true);
  eq("una foto que no se puede leer avisa, no se cuelga", r.rota, "Imagen inválida");
  eq("compressImage sigue achicando la foto elegida como antes", r.entera, [1280, 960]);
  eq("y la sigue dando en JPEG", r.tipoEntera, "data:image/jpeg;base64,");
  eq("sin un solo error en la página", errores, []);
  console.log(`  (foto ${Math.round(r.pesoFoto / 1024)} KB → miniatura ${Math.round(r.pesoMini / 1024)} KB)`);
  await b.close();
}
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
