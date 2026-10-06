# La pantalla REAL de Reportes, sacada de index.html, con datos de mentira.
import io, re, sys, json
# El extractor compartido, como los demás armadores. Antes esto hacía un
# exec() de un pedazo de armar_adjuntos.py, cortado por el texto exacto de
# una línea de import: cambiar esa línea en el otro archivo lo rompía sin
# que nada lo avisara.
from extractor import grab, src

estilo = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
codigo = "\n".join(grab(n) for n in [
    "addDaysISO","isoDate","isoDow","addMonthsISO","RRULE_MAX_STEPS","RRULE_DOW","isISODate",
    "parseRecurrence","expandRecurrence","recurrenceSkipDates","recurrenceMoves",
    "ZONES","ACTIVITY_TYPES","safeColor",
    "vecesEnVentana","fechasEnVentana","aniosConDatos","ventanaDe","ventanaDelReporte","ventanaAnterior",
    "normalize","pasaFiltroDelReporte","calcularReporte","armarReporte","mesCortoDe","filaDeBarra","bloqueDeBarras",
    "trimestresDelReporte","renderReportesView","reporteFiltrosAbierto","renderSelectorDelReporte","cabezaDelReporte",
    "tiraDeNumeros","graficoMensual","seccionDelReporte","renderReportePeriodo",
    "nombreEnReporte","deltaDelReporte","tablaComparada","renderReporteHistorico","renderReporteComparar",
    "ultimaActividadPorPais","haceCuanto","renderCobertura","renderEquipoDelReporte",
    "sugerenciasDelReporte","renderSugerencias"])

pagina = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reportes</title><style>%s</style></head>
<body><div class="app"><div id="viewRoot" style="max-width:980px;margin:24px auto;padding:0 16px;"></div></div>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const t = (es, en, pt, he, vars) => String(es).replace(/\\{(\\w+)\\}/g, (todo, k) => (vars && k in vars) ? vars[k] : todo);
const currentLang = ()=> "es";
const dateLocale = ()=> "es-AR";
const fmtISO = (iso, opts)=> isoDate(iso).toLocaleDateString(dateLocale(), { ...opts, timeZone:"UTC" });
const fmtDate = d => fmtISO(String(d).slice(0,10), { day:"2-digit", month:"short", year:"numeric" });
const todayISO = ()=> "2026-09-17";
const COUNTRIES = [
  { name:"Perú", zone:"sur" }, { name:"Chile", zone:"sur" }, { name:"Argentina", zone:"sur" },
  { name:"México", zone:"norte" }, { name:"Costa Rica", zone:"central" }, { name:"Panamá", zone:"central" },
];
const COUNTRY_BY_NAME = Object.fromEntries(COUNTRIES.map(c=>[c.name,c]));
const countryLabel = n => n;
const zoneOfCountry = n => (COUNTRY_BY_NAME[n]||{}).zone || null;
const EQUIPO = { "ana@x.com":"Ana Robles", "beto@x.com":"Beto Díaz", "cami@x.com":"Cami Ortiz" };
const memberByEmail = e => EQUIPO[e] ? { email:e, name:EQUIPO[e] } : null;
%s
const ACTIVITY_BY_KEY = Object.fromEntries(ACTIVITY_TYPES.map(ty=>[ty.key,ty]));
window.__pintar = (posts, reportes) => {
  state = { posts, loaded:true, reportes };
  document.getElementById("viewRoot").innerHTML = renderReportesView();
};
let state = { posts:[], loaded:true, reportes:{ anio:"", trimestre:0 } };
let reporteEnPantalla = null;
window.__datos = %s;
window.__pintar(window.__datos, { anio:"2026", trimestre:0 });
</script></body></html>"""

# Un año de actividad inventada, con de todo: repeticiones, varios países,
# alcances grandes, cancelados y participantes.
import random
random.seed(7)
posts = []
tipos = ["visita","curso","seminario","congreso","virtual","otro"]
gente = ["ana@x.com","beto@x.com","cami@x.com"]
paises = ["Perú","Chile","Argentina","México","Costa Rica","Panamá"]
for i in range(90):
    mes = random.randint(1,12); dia = random.randint(1,28)
    f = "2026-%02d-%02d" % (mes, dia)
    posts.append({ "id":"p%d"%i, "activityType":random.choice(tipos),
      "authorEmail":random.choice(gente), "date":f, "startDate":f, "endDate":f,
      "scopes":[{"type":"pais","country":random.choice(paises)}],
      "participants":[{"email":e} for e in random.sample(gente, random.randint(0,2))] })
posts.append({ "id":"sem", "activityType":"virtual", "authorEmail":"ana@x.com",
  "date":"2026-01-05","startDate":"2026-01-05","endDate":"2026-01-05",
  "recurrence":["RRULE:FREQ=WEEKLY;BYDAY=MO"], "scopes":[{"type":"pais","country":"Perú"}],
  "participants":[{"email":"ana@x.com"}] })
posts.append({ "id":"reg", "activityType":"seminario", "authorEmail":"beto@x.com",
  "date":"2026-03-03","startDate":"2026-03-03","endDate":"2026-03-03",
  "scopes":[{"type":"region","region":"central"}] })
posts.append({ "id":"lat", "activityType":"otro", "authorEmail":"cami@x.com",
  "date":"2026-06-01","startDate":"2026-06-01","endDate":"2026-06-01", "scopes":[{"type":"todo"}] })
posts.append({ "id":"viejo", "activityType":"curso", "authorEmail":"ana@x.com",
  "date":"2025-04-04","startDate":"2025-04-04","endDate":"2025-04-04",
  "scopes":[{"type":"pais","country":"Chile"}] })
posts.append({ "id":"sin", "activityType":"otro", "authorEmail":"ana@x.com",
  "date":"2026-02-02","startDate":"2026-02-02","endDate":"2026-02-02", "scopes":[] })

io.open("reportes.html","w",encoding="utf-8").write(pagina % (estilo, codigo, json.dumps(posts, ensure_ascii=False)))
print("reportes.html armado —", len(posts), "posteos de prueba")
