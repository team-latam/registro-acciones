# Arma una página con el panel REAL de Configuración > Adjuntos, sacado de
# index.html en vez de copiado a mano: una copia a mano ya me mintió dos
# veces (probaba mi copia, no la página).
import io, os, re, sys
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.environ.get("INDEX") or os.environ.get("INDEX_HTML") or os.path.join(RAIZ, "index.html"),
              encoding="utf-8").read()

def grab(name):
    m = re.search(r'\n(?:function|async function|const|let) %s\s*[=(]' % name, src)
    if not m: sys.exit("no se encontró " + name)
    desde = m.end() - 1
    fin_linea = src.find("\n", desde)
    i_ll, i_cor = src.find("{", desde), src.find("[", desde)
    primero = i_cor if (i_cor >= 0 and (i_ll < 0 or i_cor < i_ll)) else i_ll
    if primero < 0 or primero > fin_linea: return src[m.start()+1:fin_linea+1]
    depth, en_str, j = 0, None, primero
    abre = src[primero]; cierra = "]" if abre == "[" else "}"
    while j < len(src):
        c = src[j]
        if en_str:
            if c == "\\": j += 2; continue
            if c == en_str: en_str = None
            j += 1; continue
        if c in "\"'`": en_str = c; j += 1; continue
        if c == "/" and src[j+1:j+2] == "/": j = src.find("\n", j); continue
        if c == abre: depth += 1
        elif c == cierra:
            depth -= 1
            if depth == 0: return src[m.start()+1:j+1]
        j += 1
    sys.exit("no cerró " + name)

estilo = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
codigo = "\n".join(grab(n) for n in [
    "LIMITES_FIREBASE","LIMITES_SUPABASE","limitesElegidos","maxImagenes","maxArchivos",
    "maxBytesPorArchivo","topeLegible","unidadAdjuntos","newAdjuntosDraft","getAdjuntosDraft",
    "renderAdjuntosSection"])

pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Panel de Adjuntos</title><style>%s</style></head>
<body><div class="app"><div id="raiz" style="max-width:720px;margin:24px auto;padding:0 16px;"></div></div>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
let adjuntosDraft = null;
%s
let store = { limites: LIMITES_FIREBASE };
function pintar(){
  const partes = [];
  for(const [nombre, lim] of [["Firebase (la del equipo)", LIMITES_FIREBASE], ["Supabase (la nueva)", LIMITES_SUPABASE]]){
    store = { limites: lim }; adjuntosDraft = null;
    partes.push(`<h2 style="margin:24px 0 8px;font-size:16px;">${nombre}</h2>` + renderAdjuntosSection());
  }
  document.getElementById("raiz").innerHTML = partes.join("");
}
pintar();
window.__leer = () => [...document.querySelectorAll("#raiz input[type=number]")].map(i =>
  ({ id:i.id, value:i.value, min:i.min, max:i.max, step:i.step }));
window.__unidades = () => [...document.querySelectorAll("#raiz .setting-unit")].map(e => e.textContent.trim());
window.__subs = () => [...document.querySelectorAll("#raiz .setting-sub")].map(e => e.textContent.trim());
</script></body></html>""" % (estilo, codigo)
io.open("adjuntos.html", "w", encoding="utf-8").write(pagina)
print("adjuntos.html armado —", len(pagina), "bytes")
