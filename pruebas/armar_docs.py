# La sección "Documentación" y el editor de Configuración, sacados del
# index.html de verdad.
import io, json, re, sys
from extractor import grab, balanceada, src, estilo, cuerpo_click   # el extractor vive en un solo lugar

codigo = "\n".join(grab(n) for n in [
  "TIPOS_DE_ARCHIVO","CLASE_POR_DEFECTO","extensionDe","claseDeArchivo","claseDe",
  "esUrlDelBucket","FILE_DATA_URL_RE","safeFileDataUrl","esWordNuevo","sePuedeVer","seAbreEnVisor","esPlanilla","itemDelVisor",
  "DOCS_POR_TIPO","docsEsperados","docDeArchivo","archivosDelDoc","docsDesplegados","archivoDelDoc","archivosSueltos",
  "cuantosDocsHay","renderDocumentacion","renderTiposSection","tiposFootnote","countPostsByType",
  # La lista + ficha de Tipos: qué tipo está abierto, su ficha, el formulario
  # de uno nuevo y el aviso de "cambios sin guardar".
  "tipoAbierto","tiposDirty","renderTipoPanel","renderTipoNuevoPanel",
  "normalize","slugifyKey","fmtDate","sinRanura","docsAbiertos","eventoYaPaso","docsAbierto","fechaDeArchivo",
  "quitarDocumento","quitarAdjunto","renderPostedFiles","ownerAttrs"])

# Los handlers DE VERDAD, sacados del archivo. Una prueba que se escribe el
# "+" a mano no prueba el "+" que aprieta él: el botón no andaba porque el
# handler tiraba una excepción, y un clic simulado a mano no la habría visto.
def rama_input(accion):
    m = re.search(r'else if\(el\.dataset\.action === "%s"\)\{\n(.*?)\n  \}' % accion, src, re.S)
    if not m: sys.exit("no se encontró la rama de input " + accion)
    return m.group(1)

codigo += """
// Escribir en el campo y apretar "+" con el código de la app: la rama del
// listener de "input" y el handler del click, los dos de index.html.
window.__escribir = (key, texto) => {
  const el = { dataset:{ key, action:"tipo-doc-nuevo" }, value: texto };
""" + rama_input("tipo-doc-nuevo") + """
};
window.__clickMas = key => {
  const el = { dataset:{ key } };
  try{ (()=>{
""" + cuerpo_click("tipo-doc-add") + """
  })(); return null; }catch(err){ return String(err); }
};
window.__clickQuitar = (key, idx) => {
  const el = { dataset:{ key, idx:String(idx) } };
  try{ (()=>{
""" + cuerpo_click("tipo-doc-remove") + """
  })(); return null; }catch(err){ return String(err); }
};
// El despachador delegado, igual que el de la app: un solo listener de
// clicks sobre document, que resuelve la acción con closest(). Hasta
// ahora las pruebas llamaban al handler derecho; esto comprueba además
// que el clic LLEGUE, que es la otra mitad.
// El <select> de "o usar uno ya adjunto…" avisa por change, igual que en
// la app: su rama se saca del listener de change de index.html.
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-action]");
  if(!el) return;
  window.__ultimaAccion = el.dataset.action;
  try{
    if(el.dataset.action === "tipo-doc-remove"){ (()=>{
""" + cuerpo_click("tipo-doc-remove") + """
    })(); }
    else if(el.dataset.action === "tipo-doc-add"){ (()=>{
""" + cuerpo_click("tipo-doc-add") + """
    })(); }
    else if(el.dataset.action === "quitar-doc"){
""" + cuerpo_click("quitar-doc") + """
    }
    else if(el.dataset.action === "toggle-docs"){
""" + cuerpo_click("toggle-docs") + """
    }
    else if(el.dataset.action === "quitar-adjunto"){
""" + cuerpo_click("quitar-adjunto") + """
    }
  }catch(err){ window.__ultimoError = String(err); }
});
window.__docsDe = key => (getTiposDraft().types.find(x=>x.key===key).docs || []).map(d=>({id:d.id, label:d.label}));
window.__errorTipos = () => getTiposDraft().error;
"""

pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Documentacion</title><style>%s</style></head>
<body><div class="app"><div id="raiz" style="max-width:720px;margin:24px auto;padding:0 16px;"></div></div>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
const isRTL = () => false;
const SUPABASE_URL = "https://benonmzlgdjkhzauamrz.supabase.co";
let PUEDE_EDITAR = true;
const canEditPost = () => PUEDE_EDITAR;
const canCancelPost = () => PUEDE_EDITAR;
const state = { posts: [] };
// Una fecha fija: así "ya pasó" no depende del día en que se corra.
const HOY = "2026-10-02";
const todayISO = () => HOY;
const pad2 = n => String(n).padStart(2, "0");
const dateFormatPref = () => "dmy";
const prefs = () => ({ dateFormat:"dmy" });
const dateLocale = () => "es";

%s
let POSTS = {};
const getPostById = id => POSTS[id] || null;
const store = { horaDelServidor: () => "AHORA" };
const state2 = { auth:{ user:{ displayName:"Benny", email:"benny@team-latam.com" } } };
state.auth = state2.auth;
let CONFIRMAR = true;
const appConfirm = async () => CONFIRMAR;
const appAlert = async m => { window.__ultimaAlerta = m; };
window.__escrituras = [];
const updatePostDoc = async (id, parche) => {
  if(window.__fallarUpdate) throw new Error(window.__fallarUpdate);
  window.__escrituras.push({ id, parche });
  POSTS[id] = { ...POSTS[id], ...parche };
};
function pintarTarjetaDe(post){
  document.getElementById("raiz").innerHTML = renderDocumentacion(post)
    + renderPostedFiles(archivosSueltos(post.files, post.activityType),
        { postId: post.id, todos: post.files || [], puede: PUEDE_EDITAR });
}
window.__ponerPost = (post, puede, confirmar, auto) => {
  Object.keys(DOCS_POR_TIPO).forEach(k=>delete DOCS_POR_TIPO[k]);
  docsAbiertos.clear();
  DOCS_POR_TIPO.visita = [{id:"plan", label:"Plan de viaje"}, {id:"reporte", label:"Reporte"}];
  POSTS[post.id] = post; PUEDE_EDITAR = puede !== false; CONFIRMAR = confirmar !== false;
  // auto === true: no se fuerza nada, decide docsAbierto() — que es lo que
  // hay que probar. Las pruebas viejas miran el detalle, así que por
  // omisión se abre.
  if(auto !== true && !docsAbiertos.has(post.id)) docsAbiertos.set(post.id, true);
  window.__escrituras = []; window.__ultimaAlerta = null; window.__ultimoError = null;
  ULTIMO = post.id;
  pintarTarjetaDe(post);
};
// Repintado PURO: no toca el estado. __ponerPost limpia docsAbiertos, así
// que usarlo acá borraba justo lo que la prueba quería comprobar que se
// recuerda.
window.__repintar = id => pintarTarjetaDe(POSTS[id]);
let tiposDraft = null;
const getTiposDraft = () => tiposDraft;
// Repinta lo que esté en pantalla: la tarjeta si se está mirando un
// posteo, y si no el editor de Tipos de actividad. Los handlers llaman a
// render() igual que en la app, así que sin esto un toggle no se veía.
let ULTIMO = null;
const render = () => {
  const r = document.getElementById("raiz");
  if(ULTIMO && POSTS[ULTIMO]){ pintarTarjetaDe(POSTS[ULTIMO]); return; }
  if(tiposDraft) r.innerHTML = renderTiposSection();
};
window.__abrir = (id, v) => { docsAbiertos.set(id, v !== false); };
window.__cerrar = id => { docsAbiertos.set(id, false); };
window.__estadoDocs = id => docsAbiertos.has(id) ? docsAbiertos.get(id) : null;
window.__pintarTarjeta = (post, puede) => {
  docsAbiertos.clear(); docsAbiertos.set(post.id, true);   // el detalle, que es lo que miran
  PUEDE_EDITAR = puede !== false;
  Object.keys(DOCS_POR_TIPO).forEach(k=>delete DOCS_POR_TIPO[k]);
  DOCS_POR_TIPO.visita = [{id:"plan", label:"Plan de viaje"}, {id:"reporte", label:"Reporte"}, {id:"gastos", label:"Rendición de gastos"}];
  document.getElementById("raiz").innerHTML = renderDocumentacion(post);
};
window.__pintarConfig = () => {
  ULTIMO = null;
  Object.keys(DOCS_POR_TIPO).forEach(k=>delete DOCS_POR_TIPO[k]);
  tiposDraft = { nuevoDoc:{}, error:"", saving:false, newIcon:"", newLabel:"", types:[
    { key:"visita", label:"Visita", icon:"🧳", calendarSync:true,
      docs:[{id:"plan",label:"Plan de viaje"},{id:"reporte",label:"Reporte"}] },
    { key:"curso", label:"Curso", icon:"📘", calendarSync:true, docs:[{id:"programa",label:"Programa"}] },
    { key:"virtual", label:"Virtual", icon:"💻", calendarSync:false, docs:[] },
  ]};
  // Con la ficha de Visita abierta: los documentos se editan ahí, y las
  // pruebas de siempre (quitar, sumar) miran la de Visita.
  tipoAbierto = "visita";
  document.getElementById("raiz").innerHTML = renderTiposSection();
};
// Abre la ficha de un tipo (los documentos se editan ahí, no en la lista).
window.__abrirTipo = key => { tipoAbierto = key; document.getElementById("raiz").innerHTML = renderTiposSection(); };
window.__sinDocs = () => {
  Object.keys(DOCS_POR_TIPO).forEach(k=>delete DOCS_POR_TIPO[k]);
  document.getElementById("raiz").innerHTML = renderDocumentacion({ id:"p1", activityType:"rutina", files:[] }) || "<i>vacio</i>";
};
window.__pintarTarjeta(%s, true);
</script></body></html>"""

PDF = "data:application/pdf;base64,QQ=="
DOCX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ=="
post = { "id":"p1", "activityType":"visita", "files":[
  { "name":"Plan de viaje - Peru 2026.pdf", "kind":"pdf", "doc":"plan", "dataUrl":PDF },
  { "name":"Reporte de la visita a Lima.docx", "kind":"doc", "doc":"reporte", "dataUrl":DOCX },
  { "name":"foto suelta.pdf", "kind":"pdf", "dataUrl":PDF },
]}
io.open("documentacion.html","w",encoding="utf-8").write(pagina % (estilo, codigo, json.dumps(post, ensure_ascii=False)))
print("documentacion.html armado")
