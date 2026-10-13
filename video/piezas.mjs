/* Las piezas gráficas del video (fondos, marco del celular, carteles, tarjetas), dibujadas con el navegador.
   Uso: node piezas.mjs [carpeta]  → carpeta/*.png */
import fs from "node:fs";
import { chromium } from "playwright";
const out = process.argv[2] || "piezas"; fs.mkdirSync(out, { recursive: true });
const TEAL = "#0d3b3c", AQUA = "#2bb6d2";
const fuente = `font-family:"Inter Display","Inter",sans-serif;`;
const b = await chromium.launch();
async function png(nombre, w, h, html, { transparente = true } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;${transparente ? "background:transparent" : ""};overflow:hidden;${fuente}-webkit-font-smoothing:antialiased}</style>${html}`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${nombre}.png`, omitBackground: transparente });
  await p.close();
}
const fondo = (w, h) => `<div style="width:${w}px;height:${h}px;background:radial-gradient(120% 90% at 20% 0%,#16595b 0%,${TEAL} 55%,#081f20 100%)"></div>`;

// ---- Celular 1080x1920
await png("fondo_celu", 1080, 1920, fondo(1080, 1920), { transparente: false });
// el marco: un hueco de 700x1515 en (190,330) con esquinas redondas; alrededor, el borde del aparato
await png("marco_celu", 1080, 1920, `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <path fill="#040e0f" fill-rule="evenodd" d="M246 290 H834 a96 96 0 0 1 96 96 V1789 a96 96 0 0 1 -96 96 H246 a96 96 0 0 1 -96 -96 V386 a96 96 0 0 1 96 -96Z M254 330 a64 64 0 0 0 -64 64 V1781 a64 64 0 0 0 64 64 H826 a64 64 0 0 0 64 -64 V394 a64 64 0 0 0 -64 -64Z"/>
  <rect x="151.5" y="291.5" width="777" height="1592" rx="95" fill="none" stroke="#2c5456" stroke-width="3"/>
  </svg>`);
const cartelCelu = (txt, sub) => `<div style="position:absolute;left:0;right:0;top:${sub ? 92 : 112}px;text-align:center;color:#fff;padding:0 70px">
  <div style="font-weight:700;font-size:62px;line-height:1.12;letter-spacing:-.5px;text-wrap:balance">${txt}</div>
  ${sub ? `<div style="margin-top:14px;font-weight:500;font-size:34px;opacity:.78">${sub}</div>` : ""}</div>`;
const cartelCompu = (txt, sub) => `<div style="position:absolute;left:0;right:0;bottom:64px;display:flex;justify-content:center"><div style="background:rgba(8,31,32,.86);color:#fff;border-radius:22px;padding:22px 44px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12)">
  <div style="font-weight:700;font-size:46px;letter-spacing:-.3px">${txt}</div>${sub ? `<div style="margin-top:6px;font-weight:500;font-size:27px;opacity:.78">${sub}</div>` : ""}</div></div>`;
const CAPS = {
  home: ["Every action, shared with the team."],
  crear: ["Plan events with date, place and people.", "Synced to the team’s Google Calendar"],
  paises: ["Every country at a glance."],
  agenda: ["A shared directory of people and organizations."],
  calendario: ["One shared calendar."],
  proyectos: ["Turn any event into a project."],
  reportes: ["Reports that answer: how are we doing?", "Tap any month to open its card"],
  novedades: ["Mentions, replies and updates, as they happen."],
  hebreo: ["In Hebrew, the whole screen flips."],
  traduccion: ["Any post, in your language, with one tap.", "Written in Spanish, read in Hebrew"],
};
for (const [k, [txt, sub]] of Object.entries(CAPS)) {
  await png(`cap_${k}_celu`, 1080, 1920, cartelCelu(txt, sub));
  await png(`cap_${k}_compu`, 1920, 1080, cartelCompu(txt, sub));
}
// ---- Tarjetas (sin transparencia para el fondo; los textos van aparte para entrar con retraso)
for (const [fmt, w, h] of [["celu", 1080, 1920], ["compu", 1920, 1080]]) {
  await png(`fondo_${fmt}`, w, h, fondo(w, h), { transparente: false });
  const k = w / 1080;
  await png(`titulo_nombre_${fmt}`, w, h, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff"><div style="font-weight:700;font-size:${(fmt === "celu" ? 150 : 150)}px;letter-spacing:-3px;line-height:1">Action Log</div></div>`);
  await png(`titulo_frase_${fmt}`, w, h, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff"><div style="height:${fmt === "celu" ? 220 : 210}px"></div><div style="font-weight:500;font-size:${fmt === "celu" ? 52 : 46}px;opacity:.88;text-align:center;padding:0 80px;text-wrap:balance">The team’s work, made visible.</div></div>`);
  await png(`titulo_marca_${fmt}`, w, h, `<div style="position:absolute;left:0;right:0;bottom:${fmt === "celu" ? 150 : 90}px;text-align:center;color:${AQUA};font-weight:600;font-size:${fmt === "celu" ? 34 : 28}px;letter-spacing:6px;text-transform:uppercase">Team LatAm</div>`);
  await png(`final_mensaje_${fmt}`, w, h, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;padding:0 ${fmt === "celu" ? 90 : 260}px;text-align:center"><div style="font-weight:700;font-size:${fmt === "celu" ? 88 : 84}px;line-height:1.12;letter-spacing:-1.5px;text-wrap:balance">Everything you need to fulfill your mission, in one place.</div></div>`);
  await png(`final_marca_${fmt}`, w, h, `<div style="position:absolute;left:0;right:0;bottom:${fmt === "celu" ? 230 : 120}px;text-align:center;color:#fff"><div style="font-weight:700;font-size:${fmt === "celu" ? 40 : 36}px;letter-spacing:.5px">Action Log <span style="color:${AQUA}">·</span> Team LatAm</div></div>`);
  await png(`final_puntos_${fmt}`, w, h, `<div style="position:absolute;left:0;right:0;bottom:${fmt === "celu" ? 180 : 100}px;text-align:center;color:#fff;opacity:.82;font-weight:500;font-size:${fmt === "celu" ? 28 : 25}px;letter-spacing:.3px;padding:0 60px;line-height:1.5">Google Calendar sync &nbsp;·&nbsp; Roles and permissions<br>Weekly backups &nbsp;·&nbsp; EN · ES · PT · HE</div>`);
}
await b.close();
console.log("piezas listas:", fs.readdirSync(out).length);
