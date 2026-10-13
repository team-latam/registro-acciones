import { abrirNavegador, entrar, tab, click } from "../pruebas/app_de_mentira.mjs";
import { baseDemo, fotoSvg, HOY, YO, TRADUCCIONES } from "./datos_demo.mjs";
export { tab, click, HOY };
export const CELU = { width: 390, height: 844 }, COMPU = { width: 1280, height: 720 };
// Abre la app de demostración como Daniel, en inglés, con la fecha fija y las fotos de mentira.
export async function abrirDemo(b, { celu = true, dark = false } = {}) {
  const viewport = celu ? CELU : COMPU;
  const { p, errores } = await entrar(b, YO, "Daniel Rosen", { viewport, lang: "en", dark, base: baseDemo() });
  await p.route(/\/storage\/v1\/object\/sign\//, r => {
    const clave = decodeURIComponent(new URL(r.request().url()).pathname.split("/sign/")[1] || "x");
    r.fulfill({ contentType: "image/svg+xml", body: fotoSvg(clave) });
  });
  // El servicio de traducción (MyMemory) contesta con la traducción de mentira, con una pausa corta para que se vea «Traduciendo…».
  await p.route(/api\.mymemory\.translated\.net/, async r => {
    const q = new URL(r.request().url()).searchParams.get("q") || "";
    await new Promise(res => setTimeout(res, 1000));
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ responseData: { translatedText: TRADUCCIONES[q] || q }, responseStatus: 200 }) });
  });
  await p.clock.setFixedTime(HOY);
  await p.reload(); await p.waitForTimeout(1800);
  // El permiso de Calendar «concedido» (como si ya se hubiera dado), para que al crear un evento salga el aviso de que se sumó al Calendar compartido.
  await p.evaluate(() => { try { localStorage.setItem("ra_tour_seen", "1"); sessionStorage.setItem("calendarToken", JSON.stringify({ token: "demo", expiry: 4102444800000, aclScope: true })); } catch (e) {} });
  await p.reload(); await p.waitForTimeout(1500);
  return { p, errores };
}
export { abrirNavegador };
