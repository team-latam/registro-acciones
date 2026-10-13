# -*- coding: utf-8 -*-
# La cola de Solicitudes, con la ✕ de los pedidos rechazados: el render, el
# handler y el CSS DE VERDAD, sacados de index.html.
#
# Reemplaza a un rechazadas.html armado a mano el 17 de septiembre, que
# nadie regeneraba: la prueba pasaba contra el código de esa fecha, y
# hubiera seguido pasando aunque la pantalla real cambiara por completo.
import io
from extractor import grab, src, estilo, cuerpo_click

codigo = "\n".join(grab(n) for n in [
    "esc", "fotoSegura", "tsToMillis", "pad2", "fmtDate", "uses12h", "fmtTime", "fmtDateTime",
    "solicitudesPendientes", "withRosterGuard",
    # «¿Es X, que figura sin cuenta?» (7/10/2026), abajo de cada pedido pendiente.
    "normalize", "recortar", "cuantasActividades", "actividadesDePersona",
    "parecidosDescartados", "personaQueParece", "renderPareceSerPersona",
    # El formulario de "Dar acceso por adelantado" (tanda 11) va arriba de la cola.
    "preaprobarDraft", "renderPreaprobar", "renderSolicitudesQueueSection"])

pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solicitudes</title><style>%s</style></head>
<body><div class="app"><div id="raiz" style="max-width:820px;margin:24px auto;padding:0 16px;"></div></div>
<script>
const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
// Lo de afuera de esta pantalla, simulado y anotado para la prueba.
const prefs = () => ({});
const dateFormatPref = () => "dmy", timeFormatPref = () => "24", dateLocale = () => "es";
const state = { accessRequests: [], formerMembers: [], roster: [], posts: [], personas: [] };
const savingRoster = new Set();
const appConfirm = async (msg, opts) => { window.__ultimoConfirm = msg; window.__ultimoOpts = opts || {}; return window.__confirmado === true; };
const appAlert = async m => { (window.__alertas = window.__alertas || []).push(m); };
const store = { accessRequests: { remove: async email => {
  if(window.__falla) throw new Error("permiso denegado");
  (window.__borrados = window.__borrados || []).push(email);
} } };
%s
function render(){ document.getElementById("raiz").innerHTML = renderSolicitudesQueueSection(); }
// El despachador delegado, igual que el de la app, con el handler de verdad.
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-action]");
  if(!el || el.disabled) return;
  if(el.dataset.action === "delete-request"){
%s
  }
});
window.setPedidos = lista => { state.accessRequests = lista; render(); };
render();
</script></body></html>"""

io.open("rechazadas.html", "w", encoding="utf-8").write(pagina % (estilo, codigo, cuerpo_click("delete-request")))
print("rechazadas.html armado desde index.html")
