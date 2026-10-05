# Dos cosas, las dos sacadas del index.html de verdad:
#  - renderAuthGate, para probar que "Cargando..." tiene salida.
#  - renderPostedFiles Y el handler de open-file-preview, para probar que
#    el data-idx que dibuja uno es el que lee el otro.
import io, re, sys
from extractor import grab, src, estilo

handler = re.search(r'"open-file-preview": async \(el, e, action, postId\) => \{\n(.*?)\n  \},\n', src, re.S)
if not handler: sys.exit("no se encontró el handler de open-file-preview")
cuerpo = handler.group(1)

codigo = "\n".join(grab(n) for n in [
  "TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo","claseDe",
  "esUrlDelBucket","FILE_DATA_URL_RE","safeFileDataUrl","esWordNuevo","sePuedeVer",
  "DOCS_POR_TIPO","docsEsperados","docDeArchivo","archivosDelDoc","docsDesplegados","archivoDelDoc","archivosSueltos",
  "ownerAttrs","fechaDeArchivo","fmtDate","renderPostedFiles",
  # La portada de entrada marca el idioma activo y lista los cuatro.
  "LANGS","currentLang","renderAuthGate"])

pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Puerta</title><style>%s</style></head>
<body><div class="app"><div id="raiz" style="max-width:720px;margin:24px auto;padding:0 16px;"></div></div>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
const SUPABASE_URL = "https://benonmzlgdjkhzauamrz.supabase.co";
const state = { auth: {} };
const pad2 = n => String(n).padStart(2, "0");
const dateFormatPref = () => "dmy";
const dateLocale = () => "es";
%s

/* ---- la puerta ---- */
window.__puerta = auth => { state.auth = auth; document.getElementById("raiz").innerHTML = renderAuthGate(); };

/* ---- el visor: el handler DE VERDAD, con lo de afuera simulado ---- */
let POST = null, ABIERTO = null;
const attachmentOwner = (postId, replyId) => POST;
const openFilePreview = (lista, idx) => { ABIERTO = { lista, idx, elegido: lista[idx] || null }; };
const HANDLER = async (el) => { %s };
window.__pintarArchivos = post => {
  POST = post;
  Object.keys(DOCS_POR_TIPO).forEach(k=>delete DOCS_POR_TIPO[k]);
  if(post.activityType === "visita"){
    DOCS_POR_TIPO.visita = [{id:"plan", label:"Plan de viaje"}, {id:"reporte", label:"Reporte"}];
  }
  document.getElementById("raiz").innerHTML =
    renderPostedFiles(archivosSueltos(post.files, post.activityType), { postId: post.id });
};
window.__clickear = async i => {
  ABIERTO = null;
  await HANDLER(document.querySelectorAll('[data-action="open-file-preview"]')[i]);
  return ABIERTO && ABIERTO.elegido ? ABIERTO.elegido.name : null;
};
</script></body></html>"""

io.open("puerta.html","w",encoding="utf-8").write(pagina % (estilo, codigo, cuerpo))
print("puerta.html armado (handler de %d bytes extraído de index.html)" % len(cuerpo))
