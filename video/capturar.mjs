/* Graba la app de demostración, escena por escena, en tiempo real (CDP screencast).
   Uso: node capturar.mjs celu|compu [carpeta]   → carpeta/frames/*.jpg, carpeta/lista.txt, carpeta/marcas.json */
import fs from "node:fs";
import { abrirNavegador, abrirDemo, CELU, COMPU } from "./comun.mjs";
const formato = process.argv[2] === "compu" ? "compu" : "celu";
const celu = formato === "celu";
const salida = process.argv[3] || `grab_${formato}`;
const SOLO = process.env.SOLO ? process.env.SOLO.split(",") : null;      // para probar una escena sola
fs.rmSync(salida, { recursive: true, force: true }); fs.mkdirSync(salida + "/frames", { recursive: true });

const b = await abrirNavegador();
const { p, errores } = await abrirDemo(b, { celu });
p.setDefaultTimeout(4000);
const vp = celu ? CELU : COMPU, DSF = celu ? 2 : 1.5;
const cdp = await p.context().newCDPSession(p);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: DSF, mobile: celu, screenWidth: vp.width, screenHeight: vp.height });
await p.waitForTimeout(600);

// Un dedo (celu) o un cursor (compu) y un círculo al tocar, dibujados en la propia página para que salgan en el video.
await p.evaluate(celu => {
  const css = document.createElement("style");
  css.textContent = `html,body{scroll-behavior:auto!important}
  .dedo{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(43,182,210,.35);border:2px solid rgba(43,182,210,.9);pointer-events:none;animation:dedo .55s ease-out forwards}
  @keyframes dedo{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}
  .cursor{position:fixed;z-index:99998;left:0;top:0;width:22px;height:22px;pointer-events:none;transition:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}`;
  document.head.appendChild(css);
  if(!celu){
    const c = document.createElement("div"); c.className = "cursor";
    c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 9-6.5 1.6L9.5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener("mousemove", e => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
  }
  addEventListener("pointerdown", e => { const d = document.createElement("div"); d.className = "dedo"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 700); }, true);
}, celu);

// --- el grabador: capturas de pantalla a resolución completa, una tras otra (la captura continua del navegador sale en 1x) ---
const frames = []; let n = 0, grabando = true; const escrituras = [];
const T0 = Date.now() / 1000;
const bucle = (async () => {
  while(grabando){
    const ini = Date.now() / 1000;
    const r = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90, optimizeForSpeed: true, fromSurface: true }).catch(() => null);
    if(!r) continue;
    const fin = Date.now() / 1000, f = `${salida}/frames/f${String(n++).padStart(6, "0")}.jpg`;
    frames.push({ ts: (ini + fin) / 2, f });
    escrituras.push(fs.promises.writeFile(f, Buffer.from(r.data, "base64")));
  }
})();
const marcas = [];
const ahora = () => Date.now() / 1000 - T0;

// --- gestos ---
const pausa = ms => p.waitForTimeout(ms);
// El centro del elemento, buscado de nuevo en cada intento: la app se redibuja sola de a ratos y un asa vieja quedaría suelta.
const centro = async sel => {
  for(let i = 0; i < 25; i++){
    const r = await p.evaluate(sel => {
      const e = document.querySelector(sel); if(!e) return null;
      let b = e.getBoundingClientRect();
      if(b.width && (b.top < 8 || b.bottom > innerHeight - 8)){ e.scrollIntoView({ block: "center" }); b = e.getBoundingClientRect(); }
      return b.width && b.height ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
    }, sel);
    if(r) return r;
    await pausa(160);
  }
  throw new Error("no está: " + sel);
};
// El toque: el círculo (o el cursor que se desliza) se dibuja a mano y el click se manda al elemento buscado de nuevo en ese
// instante. Un toque «real» (bajar y soltar en dos mensajes) se perdía si la app se redibujaba justo en el medio.
const tocar = async (sel, { espera = 350, previo = 0 } = {}) => {
  const { x, y } = await centro(sel);
  if(!celu) await p.mouse.move(x, y, { steps: 5 });
  await p.evaluate(([x, y]) => {
    const d = document.createElement("div"); d.className = "dedo"; d.style.left = x + "px"; d.style.top = y + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 700);
  }, [x, y]);
  if(previo) await pausa(previo);                    // el círculo se ve apoyarse antes de que la pantalla responda
  await p.evaluate(sel => { const e = document.querySelector(sel); if(!e) return; e.click(); if(e.matches("input,textarea,select")) e.focus({ preventScroll: true }); }, sel);
  await pausa(espera);
};
const tocarHasta = async (sel, hecho, { espera = 300, intentos = 3, previo = 0 } = {}) => {
  for(let i = 0; i < intentos; i++){
    await tocar(sel, { espera, previo: i === 0 ? previo : 0 });
    if(await p.evaluate(hecho).catch(() => false)) return;
  }
  throw new Error("el toque en " + sel + " no hizo lo esperado");
};
const escribir = async (sel, texto, ms = 48) => {
  await tocar(sel, { espera: 200 });
  // Si el toque no dejó el foco en el campo (la app se redibuja al abrirlo), se lo pone: sin foco, la barra espaciadora haría bajar la página.
  for(let i = 0; i < 4; i++){
    if(await p.evaluate(s => document.activeElement === document.querySelector(s), sel)) break;
    await p.evaluate(s => document.querySelector(s)?.focus({ preventScroll: true }), sel); await pausa(150);
  }
  await p.keyboard.type(texto, { delay: ms }); await pausa(200);
};
const desplazar = (y, ms) => p.evaluate(([y, ms]) => new Promise(res => { const y0 = scrollY, t0 = performance.now(); const f = n => { const k = Math.min(1, (n - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), [y, ms]);
const hastaVista = async sel => { const { y } = await centro(sel); };
const escena = async (nombre, seg, fn) => {
  if(SOLO && !SOLO.includes(nombre)) return;
  const ini = ahora(); marcas.push({ nombre, t: +ini.toFixed(3), dur: seg });
  await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()).catch(() => {});
  try { await fn(); } catch(e) { console.log(`✗ ${nombre}: ${String(e.message).split("\n")[0]}`); }
  const usado = ahora() - ini;
  if(usado < seg) await pausa((seg - usado) * 1000); else { console.log(`⚠ ${nombre}: usó ${usado.toFixed(1)} s de ${seg} s`); marcas.at(-1).dur = +usado.toFixed(2); }
};
const navTab = vista => celu ? tocar(`.bn-item[data-view="${vista}"]`, { espera: 500, previo: 280 }) : tocar(`nav.tabs button[data-view="${vista}"]`, { espera: 500, previo: 280 });
const navMas = async vista => {
  if(!celu) return navTab(vista);
  await tocarHasta('.bn-item[data-action="toggle-more-menu"]', "!!document.querySelector('.bn-sheet')", { espera: 450, previo: 260 });
  await tocar(`.bn-sheet-item[data-view="${vista}"]`, { espera: 600, previo: 240 });
};

// --- las escenas ---
await pausa(500);
await escena("home", 10.0, async () => {
  await pausa(500);
  await desplazar(celu ? 760 : 520, 1900); await pausa(500);
  await desplazar(0, 850); await pausa(200);
  await escribir("#rutinaContent", "Trained 22 volunteers in Lima. Sharing photos with the team.", 42); await pausa(400);
  await tocarHasta("#rutinaPublish", "(() => { const e = document.querySelector('#rutinaContent'); return !e || e.value === ''; })()", { espera: 800, previo: 240 });
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await pausa(1050);   // como al cerrarse el teclado del celular; y se lee el posteo nuevo
});
await escena("crear", 13.5, async () => {
  await tocarHasta("#fabMain", "!!document.querySelector('.fab-wrap.open')", { espera: 450, previo: 240 });
  await tocarHasta('[data-action="new-evento"]', "!!document.querySelector('#cTitle')", { espera: 550, previo: 220 });
  await escribir("#cTitle", "Leadership meeting – Lima", 45); await pausa(230);
  await escribir("#cPlaceQuery", "Lima", 85); await pausa(230);
  await tocar('[data-action="pick-place"]', { espera: 550 });
  await escribir("#cParticipantQuery", "Sof", 85); await pausa(230);
  await tocar('[data-action="pick-participant"]', { espera: 600 });
  // En el celular, elegir al participante a veces ya publica; si el formulario sigue abierto, se toca Post.
  if(await p.evaluate(() => !!document.querySelector("#postModalOverlay .modal-actions .btn-primary"))){
    await pausa(500);
    await tocarHasta("#postModalOverlay .modal-actions .btn-primary", "!document.querySelector('#cTitle')", { espera: 800, previo: 240 }).catch(() => {});
  }
  await pausa(1100);   // se ve el evento nuevo y el aviso verde del Calendar
  await p.evaluate(() => { const t = document.getElementById("calendarToast"); if(t) t.hidden = true; });
});
await escena("paises", 5.8, async () => {
  await navTab("paises"); await pausa(250);
  await desplazar(celu ? 260 : 0, 1100); await pausa(200);
  await tocar('[data-action="drill-country"][data-country="Brasil"]', { espera: 600, previo: 260 });
  await desplazar(celu ? 520 : 300, 1400); await pausa(900);
});
await escena("agenda", 8.0, async () => {
  await navTab("paises"); await pausa(350);                    // vuelve a la lista de países
  await tocar('[data-action="agenda-abrir"]', { espera: 1250, previo: 280 });
  await escribir("#agendaBody input", "Lima", 105); await pausa(700);
  await tocar('[data-action="agenda-ver-persona"]', { espera: 1900, previo: 260 });
  await tocar('[data-action="agenda-cerrar"]', { espera: 300 });
});
await escena("calendario", 5.0, async () => {
  await navTab("calendario"); await pausa(1100);
  if(celu) { await tocar('[data-date="2026-10-09"]', { espera: 600, previo: 240 }).catch(() => {}); await desplazar(240, 900); await pausa(900); }
  else { await tocar('.cal-chip[data-action="cal-open"]', { espera: 1400 }).catch(() => {}); }
});
await escena("proyectos", 5.0, async () => {
  await navMas("proyectos"); await pausa(950);
  if(celu) { await desplazar(200, 900); await pausa(900); }
});
await escena("reportes", 8.8, async () => {
  await navMas("reportes"); await p.waitForSelector(".rep-total-num"); await pausa(400);
  // primero se ve el gráfico entero, con calma; después se toca septiembre, y baja a su ficha con movimiento
  const yG = await p.evaluate(() => { const b = document.querySelector(".rep-bloque-mensual").getBoundingClientRect(); return Math.max(0, b.top + scrollY - (innerHeight - b.height) / 2); });
  await desplazar(yG, 850); await pausa(950);
  await tocar('button.rep-col[data-mes="2026-09"]', { espera: 900, previo: 320 });
  const yF = await p.evaluate(() => { const b = document.querySelector(".rep-mes-ficha").getBoundingClientRect(); return Math.max(0, b.top + scrollY - 86); });
  await desplazar(yF, 1000); await pausa(1500);
});
await escena("novedades", 3.5, async () => {
  await tocar(".bell-btn", { espera: 2100, previo: 260 });
  await p.keyboard.press("Escape"); await pausa(300);
});
await escena("hebreo", 4.0, async () => {
  await navTab("feed"); await desplazar(0, 10); await pausa(400);
  await tocar(".avatar-btn", { espera: 600, previo: 240 });
  await tocar('[data-action="set-lang"][data-lang="he"]', { espera: 1000, previo: 280 });
  await p.evaluate(() => document.getElementById("viewRoot").click()); await pausa(800);   // un toque afuera cierra el menú; se ve la pantalla espejada
});
await escena("traduccion", 5.3, async () => {
  const y = await p.evaluate(() => { const e = document.querySelector('.translate-toggle[data-id="rs1"]'); if(!e) return 0; return Math.max(0, e.getBoundingClientRect().top + scrollY - innerHeight * 0.42); });
  await desplazar(y, 800); await pausa(550);
  await tocar('.translate-toggle[data-id="rs1"]', { espera: 1800, previo: 320 });   // «Traduciendo…» y enseguida el texto en hebreo
  await pausa(900);
});
await pausa(400);
grabando = false; await bucle; await Promise.all(escrituras);
// la línea de tiempo: cada cuadro dura hasta el siguiente
frames.sort((a, b) => a.ts - b.ts);
const t0 = frames[0].ts;
const lista = frames.map((x, i) => `file '${x.f.replace(salida + "/", "")}'\nduration ${Math.max(0.001, ((frames[i + 1] ? frames[i + 1].ts : x.ts + 0.5) - x.ts)).toFixed(4)}`).join("\n");
fs.writeFileSync(`${salida}/lista.txt`, lista + `\nfile '${frames.at(-1).f.replace(salida + "/", "")}'\n`);
// las marcas, en el tiempo del video (el primer cuadro es el 0)
const desfase = (Date.now() / 1000 - T0) ; // no se usa: se convierte con el primer cuadro
const primerCuadroEn = t0 - T0;
fs.writeFileSync(`${salida}/marcas.json`, JSON.stringify({ formato, cuadros: frames.length, duracion: +(frames.at(-1).ts - t0 + 0.5).toFixed(2), marcas: marcas.map(m => ({ ...m, t: +(m.t - primerCuadroEn).toFixed(3) })) }, null, 1));
console.log(formato, "cuadros:", frames.length, "dur:", (frames.at(-1).ts - t0).toFixed(1), "s · errores de página:", JSON.stringify(errores));
await b.close();
