/* Arma el video: lo grabado + fondo, marco del celular, carteles, tarjeta de título y de cierre.
   Uso: node armar.mjs celu|compu [carpetaGrab] [salida.mp4] */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const fmt = process.argv[2] === "compu" ? "compu" : "celu";
const grab = process.argv[3] || `grab_${fmt}`, SALIDA = process.argv[4] || `demo_${fmt}.mp4`;
const celu = fmt === "celu", W = celu ? 1080 : 1920, H = celu ? 1920 : 1080, FPS = 30, FUNDIDO = 0.4;
const M = JSON.parse(fs.readFileSync(`${grab}/marcas.json`, "utf8"));
const marca = n => M.marcas.find(m => m.nombre === n);
const inicio = marca("home").t, ultima = M.marcas.at(-1), fin = ultima.t + ultima.dur;
const DUR_TITULO = 2.6, DUR_FINAL = 3.4, FUNDIDO_ = 0.4, TOPE = 74.0;   // tope: el usuario aceptó hasta 74 s
// Si lo grabado no entra en el minuto, se acelera parejo (todas las escenas y los carteles por igual).
const durGrab = +(fin - inicio).toFixed(3);
const F = Math.min(1, (TOPE - DUR_TITULO - DUR_FINAL + 2 * FUNDIDO_) / durGrab);   // 1 = sin tocar la velocidad; solo acelera parejo si no entra en el tope
if(F > 1.08 || F < 0.9) console.log(`⚠ el ajuste de velocidad es grande: ×${(1 / F).toFixed(3)}`);
const durApp = +(durGrab * F).toFixed(3);
const TOTAL = +(DUR_TITULO + durApp + DUR_FINAL - 2 * FUNDIDO_).toFixed(2);
fs.writeFileSync(`${grab}/fin.txt`, JSON.stringify({ total: TOTAL, fin: +(TOTAL - DUR_FINAL).toFixed(2) }));
console.log(`ajuste de velocidad ×${(1 / F).toFixed(3)} (de ${durGrab} s a ${durApp} s) · duración total ${TOTAL} s · tarjeta final desde ${(TOTAL - DUR_FINAL).toFixed(2)} s`);
const ff = (args, etiqueta) => { console.log("ffmpeg:", etiqueta); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit", maxBuffer: 1 << 28 }); };
fs.mkdirSync("tmp", { recursive: true });

// 1. lo grabado, a 30 cuadros por segundo parejos, recortado desde el inicio de la primera escena
ff(["-f", "concat", "-safe", "0", "-i", `${grab}/lista.txt`, "-ss", String(inicio), "-t", String(durGrab), "-vf", `setpts=PTS*${F},fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-crf", "12", "-preset", "fast", `tmp/app_${fmt}.mp4`], "grabación a 30 fps");

// 2. la escena de la app, con fondo / marco y carteles
const entradas = [["-i", `tmp/app_${fmt}.mp4`]], filtros = [];
const png = (nombre, dur) => { entradas.push(["-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", `piezas/${nombre}.png`]); return entradas.length - 1; };
let ult;
if(celu){
  png("fondo_celu", durApp); png("marco_celu", durApp);
  filtros.push(`[0:v]scale=700:1515:flags=lanczos,setpts=PTS-STARTPTS[app0]`);
  ult = "app0";
} else { filtros.push(`[0:v]setpts=PTS-STARTPTS[app0]`); ult = "app0"; }
// Entre una escena y la siguiente la pantalla se funde un instante al color de la app (entra 0.14 s antes del cambio y sale en 0.3 s): el cambio ya no es un corte seco.
const AW = celu ? 700 : 1920, AH = celu ? 1515 : 1080;
const CON_FUNDIDOS = false;   // al usuario no le gustaron: el cambio de pantalla tiene que ser el de la propia app
(CON_FUNDIDOS ? M.marcas.slice(1) : []).forEach((m, i) => {
  const T = +((m.t - inicio) * F).toFixed(3), k = entradas.length;
  entradas.push(["-f", "lavfi", "-i", `color=c=0x0d3b3c:s=${AW}x${AH}:r=${FPS}:d=1`]);
  filtros.push(`[${k}:v]format=rgba,fade=t=in:st=0:d=0.14:alpha=1,fade=t=out:st=0.16:d=0.32:alpha=1,setpts=PTS+${Math.max(0, T - 0.14)}/TB[dp${i}]`, `[${ult}][dp${i}]overlay=0:0:format=auto:eof_action=pass:repeatlast=0[ap${i}]`);
  ult = `ap${i}`;
});
if(celu){
  const bg2 = entradas.findIndex(e => e.includes("piezas/fondo_celu.png")) , marcoI = entradas.findIndex(e => e.includes("piezas/marco_celu.png"));
  filtros.push(`[${bg2}:v]format=yuv420p[bg]`, `[bg][${ult}]overlay=190:330:shortest=1[v0]`, `[v0][${marcoI}:v]overlay=0:0:format=auto[v1]`);
  ult = "v1";
}
M.marcas.forEach((m, i) => {
  const a = +((m.t - inicio) * F + 0.4).toFixed(2), z = +((m.t - inicio + m.dur) * F - 0.15).toFixed(2);
  const k = png(`cap_${m.nombre}_${fmt}`, durApp);
  filtros.push(`[${k}:v]format=rgba,fade=in:st=${a}:d=0.3:alpha=1,fade=out:st=${z}:d=0.25:alpha=1[c${i}]`, `[${ult}][c${i}]overlay=0:0:format=auto:enable='between(t,${a},${z + 0.3})'[w${i}]`);
  ult = `w${i}`;
});
filtros.push(`[${ult}]format=yuv420p[fin]`);
ff([...entradas.flat(), "-filter_complex", filtros.join(";"), "-map", "[fin]", "-r", String(FPS), "-t", String(durApp), "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p", `tmp/escena_${fmt}.mp4`], "escena con carteles");

// 3. las tarjetas
function tarjeta(nombre, dur, capas){
  const ent = [["-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", `piezas/fondo_${fmt}.png`]], fl = [];
  let u = "0:v";
  capas.forEach(([pieza, aparece, d], i) => {
    ent.push(["-loop", "1", "-framerate", String(FPS), "-t", String(dur), "-i", `piezas/${pieza}_${fmt}.png`]);
    fl.push(`[${i + 1}:v]format=rgba,fade=in:st=${aparece}:d=${d}:alpha=1[t${i}]`, `[${u}][t${i}]overlay=0:0:format=auto[o${i}]`); u = `o${i}`;
  });
  fl.push(`[${u}]format=yuv420p[fin]`);
  ff([...ent.flat(), "-filter_complex", fl.join(";"), "-map", "[fin]", "-r", String(FPS), "-t", String(dur), "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", `tmp/${nombre}_${fmt}.mp4`], nombre);
}
tarjeta("titulo", DUR_TITULO, [["titulo_nombre", 0.15, 0.5], ["titulo_frase", 0.8, 0.5], ["titulo_marca", 1.3, 0.4]]);
tarjeta("final", DUR_FINAL, [["final_mensaje", 0.3, 0.7], ["final_marca", 1.8, 0.6]]);

// 4. todo junto, con fundidos cortos entre las tres partes
const o1 = +(DUR_TITULO - FUNDIDO).toFixed(2), o2 = +(o1 + durApp - FUNDIDO).toFixed(2);
ff(["-i", `tmp/titulo_${fmt}.mp4`, "-i", `tmp/escena_${fmt}.mp4`, "-i", `tmp/final_${fmt}.mp4`,
  "-filter_complex", `[0:v][1:v]xfade=transition=fade:duration=${FUNDIDO}:offset=${o1}[a];[a][2:v]xfade=transition=fade:duration=${FUNDIDO}:offset=${o2}[b];[b]fade=t=out:st=${(TOTAL - 0.7).toFixed(2)}:d=0.7[v]`,
  "-map", "[v]", "-r", String(FPS), "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", SALIDA], "unión");
const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SALIDA], { encoding: "utf8" }).trim();
console.log(`${SALIDA}: ${(+dur).toFixed(1)} s, ${(fs.statSync(SALIDA).size / 1e6).toFixed(1)} MB`);
