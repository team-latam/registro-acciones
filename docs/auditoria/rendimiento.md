# Auditoría de rendimiento — Registro de Acciones (6/10/2026)

Repo `registro-acciones`, commit `d12352f`. Un solo `index.html` publicado en
GitHub Pages, backend Supabase + Google Calendar. Se leyó `CLAUDE.md` y los
puntos 3, 5, 8, 9 y 10 de `docs/REVISION.md` (paginado de a 1.000, miniaturas
`.min.jpg` + firmas estables + `loading="lazy"`, políticas envueltas en
`(select …)`, recarga al reconectar, relectura de una sola fila al escribir):
**nada de eso se repite acá**; esta auditoría mira lo que queda.

**Cómo se midió.** Tamaños con `wc`/`gzip -9` sobre el archivo real (brotli no
está instalado en el sandbox). Conteos con `grep`/un script sobre el CSS y el
JS. Y la app entera corriendo en Chromium (Playwright) con el Supabase de
mentira de `pruebas/app_dom_test.mjs`, cargado con **2.000 posteos y 3.000
comentarios** sintéticos (10 % con tres fotos, 14 % con `resumen` de ~3,5 KB,
5 % con repetición semanal, 25 integrantes, 1.200 filas de auditoría), más
una corrida con 200 posteos para ver cómo escala y otra con 50 ms de latencia
por consulta. Los scripts y los resultados crudos quedaron en el scratchpad de la sesión
(no se versionan). Los
tiempos son de un Chromium de escritorio en el sandbox: en un celular de gama
media hay que multiplicarlos por 3 o 4. Lo marcado **a confirmar** no se pudo
ver desde acá (el sitio publicado no es alcanzable desde el sandbox).

---

## Resumen

| # | Hallazgo | Impacto | Evidencia / medida |
|---|---|---|---|
| 1 | El HTML pesa **1,43 MB (414 KB gzip)** y se vuelve a bajar entero con cada deploy; hubo ≥50 pushes a `main` en 7 días | **Alto** | `wc -c` = 1.427.910; `gzip -9` = 423.296; JS 1.163 KB (81 %), CSS 253 KB (18 %); `git log --since='7 days ago'` = 50 (tope del clon) |
| 2 | Leaflet + markercluster (2 JS clásicos sin `defer` + 3 CSS de unpkg) se bajan en **todas** las cargas aunque solo los usa Países › Mapa | **Alto** (celular) | L10-12, L3797-3798; `initOrUpdateMap()` solo desde `afterRenderView()` L12797 cuando `paisesSubview==="mapa"` |
| 3 | Arranque en serie: sesión → padrón → posts (2 páginas, una tras otra) → **recién entonces** replies (3 páginas, una tras otra) | **Alto** (4G) | `subscribeReplies()` se llama adentro del callback de posts (L8678); `traerTodas` pide página por página (L7655-7668); medido: replies@676 ms cuando posts terminó @386 |
| 4 | Toda la tabla `posts` en memoria con `select("*")`, incluido `resumen` jsonb (hasta 64 KB por fila) que el Feed no muestra | **Alto** (datos) | L7738 `select("*")`; `03-validacion.sql` L184 tope 65.536 B; 2.000 posteos sintéticos = 2,75 MB JSON (1,4 KB/fila sin resumen gordo) |
| 5 | **10-11 renders completos** de `#viewRoot` en el arranque (8 son el cascarón "Cargando…", 2-3 el Feed entero) | **Medio** | MutationObserver sobre `#viewRoot`: 10 (integrante) / 11 (admin); cada suscripción llama `render()` sincrónico (L7190, L7218, L8277, L8303, L8327, L8361, L8371, L7244, L7250) |
| 6 | El render del Feed cuesta según el **total** de posteos, no los 15 que muestra: 25 ms con 200 → **94 ms con 2.000**; cada tecla del buscador y cada aviso en vivo lo repiten | **Alto** (celular) | `getVisiblePosts()` L12988 + `sortedFeedPosts()` L13040 (`occurrenceOf` expande 30 meses de repeticiones por posteo recurrente, 2 veces, L16282/16288) + `renderFeedSide()`; buscador: tarea larga de 98-127 ms por tecla |
| 7 | «Ver más» reconstruye **todo** el Feed: 167 → 356 ms por clic al pasar de 30 a 165 tarjetas (5.585 nodos, ~33 por tarjeta) | **Medio** | `feedVisibleCount += PAGE_STEP; render()` L12784, L20437; medido en `perf_2000.json → verMas` |
| 8 | Reportes recalculan **dos** reportes sobre todos los posteos en cada render (137 ms con 2.000) | **Medio** | `armarReporte()` L14828 ×2 por `renderReportePeriodo` (L14831-14832); sin caché entre renders |
| 9 | Tareas largas en el arranque: **606 ms** bloqueando el hilo principal (277 + 195 + 134) con 2.000 posteos; 89 ms con 200 | **Alto** (celular) | `PerformanceObserver longtask`; en un celular medio ≈ 2 s de pantalla congelada |
| 10 | Miniaturas: con 15 tarjetas, 46 `<img>` en el DOM, **6 a la vista, 33 pedidas** (umbral de `loading="lazy"` de Chromium = 1.250-2.500 px); cada render recrea los `<img>` | **Medio** | `perf2.json`: imgsUnicas 33 / enViewport 6; ≈ 1 MB a 30 KB cada una |
| 11 | Polling de Calendar cada **30 s** por pestaña con permiso de escritura, sin frenar en pestañas ocultas: 2 pedidos (app_config + Google) → **5.760 pedidos/día/pestaña** | **Medio** | L6890 `setInterval(… 30000)`; `getSyncMeta()` L6933 → `app_config` L8027; no hay `visibilitychange` en todo el archivo |
| 12 | Un pedido a `api.ipify.org` en cada inicio de sesión (y en cada acción auditada) | **Bajo** | L6934 `fetchPublicIp()` desde `logAudit()`; con tope de 3 s |
| 13 | Sin service worker, sin `manifest.json`, sin ícono, sin `theme-color`: no se instala como app, no hay nada sin conexión, cada visita revalida/baja el HTML | **Medio** | `grep rel="icon"|manifest|serviceWorker` = 0 resultados |
| 14 | Fuente Montserrat en 5 pesos (400-800), todos usados; ≈ 100 KB más 1 CSS bloqueante | **Bajo** | L9; CSS usa 500×8, 600×71, 700×147, 800×108 |
| 15 | CSS: 2.000 reglas, 18 `!important`, **8 breakpoints distintos** de `max-width` (400/420/480/500/520/640/760/900), `backdrop-filter: blur(16px)` en la barra fija del celular | **Bajo** | `css_stats.mjs`; L3538, L3559 |
| 16 | 9 canales realtime por pestaña (1 websocket); 1 interval de 60 s global; 2 relojes de 1 h; sin fugas de listeners encontradas | **Bajo** (está bien) | `canales=9` medido; L4983, L7816; los `pointermove/up` se sacan (L9390-9392, L11954-11956) |
| 17 | `localStorage` compartido con todo `team-latam.github.io`; firmas de adjuntos hasta cientos de KB; claves por usuario sí llevan el correo (no se mezclan cuentas) | **Bajo** | `registro.firmas.v1` L7417; `perUserStorageKey` L5075 |

---

## 1. Peso de carga

### El archivo

| Parte | Líneas | Bytes | gzip -9 | % |
|---|---|---|---|---|
| `<head>` + script del tema | 1-36 | 2.073 | 1.028 | 0,1 |
| CSS (`<style>`) | 37-3612 | 252.625 | 58.100 | 17,7 |
| HTML estático (cascarón, modales) | 3613-3796 | 9.944 | 2.957 | 0,7 |
| JS (`<script type="module">`) | 3799-21862 | 1.162.985 | 361.746 | 81,4 |
| **Total** | 21.865 | **1.427.910** | **423.296** | |

Brotli no está en el sandbox; para texto así suele dar un 15-20 % menos que
gzip: **≈ 340-360 KB**. GitHub Pages sirve gzip; si también sirve brotli es
**a confirmar** (`curl -I -H 'Accept-Encoding: br'` contra el sitio).

Adentro del JS:

- **Comentarios**: 3.321 líneas que son solo comentario, **225 KB** (19 % del
  JS). Comprimen bien, pero siguen siendo ~50-60 KB de gzip y hay que
  parsearlos.
- **Traducciones**: 1.551 llamadas `t(es,en,pt,he)`, **219 KB** de texto en
  total (promedio 141 B, la más larga 1,9 KB). Tres de cada cuatro idiomas
  nunca se usan en una sesión: ≈ 160 KB que viajan de más (≈ 45 KB gzip).
- **Datos embebidos**: `DEFAULT_CITY_LABELS` 17,0 KB (L4065),
  `CITY_PRESETS` 10,3 KB (L3950), `DEFAULT_COUNTRY_LABELS` 4,5 KB (L4006).
  Son chicos: 32 KB en total, no es el problema.
- Las funciones más grandes: `crearSupabaseStore` 43 KB (L7316),
  `renderFichaLugar` 25 KB (L18696), `onAuthChanged` 11 KB (L7013),
  `applyCalendarEventToPosts` 10,7 KB (L6581), `renderComposer` 10,5 KB
  (L17845). El despachador de clicks (L19839) tiene 393 `data-action`.

Nada está minificado: es la decisión de arquitectura (un solo archivo, sin
build, `README.md` L3 y L174). Vale la pena saber lo que cuesta: con
comentarios y espacios afuera el JS quedaría en ≈ 0,6 MB (≈ 200 KB gzip) y la
página entera en **≈ 250 KB gzip (−40 %)**.

### Lo externo

| Recurso | Cuándo | Cómo | Bloquea |
|---|---|---|---|
| Google Fonts CSS (Montserrat 400;500;600;700;800, `display=swap`) + 5 woff2 | arranque | `<link rel=stylesheet>` L9, con `preconnect` | el CSS sí (render-blocking); las fuentes no (swap) |
| `leaflet.css` 1.9.4 (unpkg, con SRI) | arranque | L10 | sí |
| `MarkerCluster.css` + `MarkerCluster.Default.css` (unpkg, sin SRI) | arranque | L11-12 | sí |
| `leaflet.js` (con SRI) + `leaflet.markercluster.js` (sin SRI) | arranque | `<script>` clásico sin `defer`/`async`, L3797-3798, después del body y **antes del módulo** | no bloquean el primer pintado, pero el módulo no corre hasta que bajen (≈ 42 + 10 KB gzip) |
| `@supabase/supabase-js@2.117.2/+esm` (jsdelivr) | arranque | `import()` dinámico en `arrancar()` L5692 | la app no hace nada hasta que llega (≈ 50 KB gzip, **a confirmar**) |
| Google Identity (`gsi/client`) | a demanda (primer token de Calendar) | `loadGis()` L5799, `async defer` | no |
| JSZip 3.10.1 (cdnjs) | a demanda (copia de seguridad / leer un .docx) | `cargarScript()` L12551 | no |
| SheetJS 0.18.5 (cdnjs) | a demanda (visor de planillas) | L18126 | no |
| docx-preview 0.4.1 (jsdelivr) | a demanda (visor de Word) | L18127 | no |
| `api.ipify.org` | en cada `logAudit` (login incluido) | `fetch` L6934 | no (tope 3 s) |
| Google Calendar `events?syncToken` | al cargar posts y cada 30 s | L6446 | no |

Lo bien resuelto: JSZip, SheetJS, docx-preview y GIS se cargan recién cuando
hacen falta. **Leaflet no**, y es lo único que falta: 5 pedidos a unpkg
(≈ 60 KB) en cada carga para un mapa que se abre en una subvista.

### GitHub Pages y la caché

GitHub Pages manda `Cache-Control: max-age=600` y un `ETag` (documentado; **a
confirmar** con `curl -I` desde afuera). O sea: dentro de los 10 minutos el
navegador no pregunta; después manda un pedido condicional y, si el archivo no
cambió, recibe un 304 (un viaje de ida y vuelta, sin cuerpo). **Pero el
archivo cambia todo el tiempo**: hay 50 commits en `main` en los últimos 7
días (el clon es superficial, puede haber más) y cada push es un deploy. En la
práctica, casi cada vez que alguien abre la app después de un rato baja los
414 KB enteros, porque al ser un único archivo cualquier letra cambiada
invalida CSS, JS, traducciones y tablas de ciudades juntas.

### Qué cuesta en un celular con 4G lento

Perfil «slow 4G» de Lighthouse: 1,6 Mbps de bajada, 150 ms de ida y vuelta.

| Paso | Bytes | Tiempo |
|---|---|---|
| HTML (gzip) | 414 KB | ≈ 2,1 s + 1 RTT |
| Fonts CSS + 5 woff2 | ≈ 100 KB | ≈ 0,5 s (en paralelo, pero el CSS bloquea el pintado) |
| Leaflet CSS ×3 + JS ×2 | ≈ 60 KB | ≈ 0,3 s + RTTs a unpkg (otro origen) |
| supabase-js | ≈ 50 KB | ≈ 0,25 s + RTT a jsdelivr (otro origen más) |
| Parsear y compilar 1,16 MB de JS | — | ≈ 0,4-0,8 s en un Android de gama media |
| **Hasta "Cargando…"** | **≈ 620 KB** | **≈ 4-5 s** |
| Sesión + padrón (2 RTT en serie) | — | ≈ 0,4 s |
| `posts` 2.000 filas (2,75 MB JSON, ≈ 550 KB gzip), 2 páginas en serie | 550 KB | ≈ 2,8 s |
| `replies` 3.000 filas (1 MB, ≈ 200 KB gzip), 3 páginas en serie, **después** de posts | 200 KB | ≈ 1 s |
| **Hasta ver el Feed con comentarios** | **≈ 1,4 MB** | **≈ 8-10 s** |
| 33 miniaturas × 30 KB (de fondo) | ≈ 1 MB | ≈ 5 s más |

Hoy con menos posteos los pasos de datos son proporcionalmente más cortos;
los primeros 4-5 s son fijos y no dependen de cuántos posteos haya.

---

## 2. Arranque

### La secuencia (código)

1. `arrancar()` L5686: `import()` de supabase-js → `crearSupabaseStore` →
   `sesion.alCambiar(onAuthChanged)`, que dispara `getSession()` y
   `onAuthStateChange` (L8254-8255).
2. `onAuthChanged(user)` L7013. Para un integrante:
   - en paralelo: `members` propio (`roster.watchOwn`, L7169) y
     `access_requests` propio (L7212); cada uno llama `render()`;
   - cuando contesta el padrón (L7177): `subscribeData()` (posts),
     `subscribeRoster()` (members entera), `subscribeTerritoryConfig()` y
     `subscribePreferences()` (dos filas de `app_config`),
     `subscribeUserPrefs()`, `subscribeFormerMembers()` — en paralelo, y
     cada callback llama `render()`;
   - **recién cuando posts terminó** de cargar (callback L8669):
     `subscribeReplies()` (L8678) y `startCalendarAutoSync()` (L8680).
   El admin fijo salta el padrón y suma `access_requests` entera y
   `audit_log` (últimas 1.000, L7248).
3. Cada `enVivo` (L7672) abre **un canal realtime** (L7717) y después carga
   la tabla con `traerTodas` (L7655): página de 1.000, y la siguiente solo
   cuando llegó la anterior.
4. `logAudit("login")` (L7072): `fetchPublicIp()` → `upsert audit_log` →
   relectura de esa fila.

### Medido (Supabase de mentira, latencia 0, 2.000 posteos / 3.000 comentarios)

| | Integrante | Admin |
|---|---|---|
| Consultas de lectura hasta estar estable | **13** | **15** (+1 upsert +1 relectura de auditoría) |
| Por tabla | members×2 (propio + roster), access_requests, posts×2 páginas, app_config×2, user_prefs, former_members, replies×3 páginas, app_config (calendarSync) | ídem + audit_log (tope 1.000) + audit_log por id |
| Canales realtime | **9** | **9** |
| Orden (ms desde navegación) | members@268 · access_requests@275 · posts@279 · members@315 · app_config@319/320 · user_prefs@321 · former_members@324 · **posts p.2@328 · replies@571 · replies p.2@575 · replies p.3@577** | members@358 · posts@358 · … · posts p.2@386 · **replies@676** · … · replies p.3@898 |
| Renders completos de `#viewRoot` | **10** (8 de "Cargando…", 2 del Feed) | **11** (8 + 3) |
| Tareas largas (>50 ms) | 234 + 116 = **350 ms** | 277 + 195 + 134 = **606 ms** |
| Feed visible desde la navegación | 745 ms | 1.122 ms |
| Con 200 posteos: tareas largas / Feed visible | 73 ms / 541 ms | 89 ms / 731 ms |
| Heap JS después del arranque | 35 MB | 20 MB (30 MB al final del recorrido) |

Lectura:

- **Hay una cadena en serie de 6-7 viajes** antes de que aparezcan los
  comentarios: sesión → padrón → posts p.1 → posts p.2 → replies p.1 → p.2 →
  p.3. Con 150 ms de ida y vuelta son ≈ 1 s solo de esperas encadenadas, más
  la transferencia. `replies` no depende de `posts` para pedirse (la capa
  agrupa por `post_id` sola, L7877-7882), y las páginas 2..n se pueden pedir
  todas juntas apenas la primera trae `count`.
- **Tablas enteras en memoria**: posts (con todo: `resumen`, `milestones`,
  `recurrence_moves`…), replies, members, former_members; el admin además
  1.000 filas de auditoría y las solicitudes. Lo que más pesa es `resumen`:
  el Feed no lo muestra (se usa en la ficha del lugar, L18595), pero viaja
  en cada carga y en cada recarga por reconexión.
- **8 renders de "Cargando…"** son baratos (2 nodos) pero cada uno recorre
  `doRender()` entero (badge, campanita, barra de abajo, tabs). Los 2-3
  renders del Feed sí cuestan (ver §3): el segundo y el tercero son porque
  replies, preferencias y auditoría llaman `render()` cada uno al llegar.
  `scheduleRender()` (L9887) existe justamente para juntar ráfagas, pero solo
  lo usa replies (L8661).
- Las tareas largas del arranque son: convertir las 2.000 filas
  (`aPosteo` → `resolverAdjuntos` por fila) + ordenar + primer render del
  Feed (277 ms), y los dos renders siguientes (195 y 134 ms). En un celular
  de gama media eso son **≈ 2 s con la pantalla congelada**, justo cuando
  la persona ya ve la lista e intenta tocar.

---

## 3. Render

### Un `render()` global

Sí: `render()` L9855 → `doRender()` L10487 → arma un string y hace
`viewRoot.innerHTML = html` (L10528 portada, L10539 "Cargando…", L10558 la
vista). **376** sitios llaman `render()`. Después de reemplazar el DOM
(`afterRenderView()` L12790) se vuelve a medir el alto del header, se ajusta
el scroll de las tabs, se reposicionan desplegables, se rearma el
IntersectionObserver de «Ver más», y si hay modales abiertos se vuelven a
dibujar también (L10569-10573).

**Foco**: se guarda un selector del elemento activo, el anillo y la selección
del texto, y se restaura sobre el elemento nuevo (L9856-9877). Funciona: en
la prueba, al tipear en el buscador el `<input>` se destruye y se recrea y el
foco vuelve. El costo es que cada tecla rehace el Feed completo (150 ms de
respiro, L21430): **tarea larga de 98-127 ms por tecla** con 2.000 posteos.

**Scroll**: no se guarda ni se restaura en general (solo el camino de «Ver
más», L12783-12786, guarda y repone `window.scrollY`). El navegador conserva
`scrollY` si el documento nuevo es igual de alto; cuando lo que está arriba
cambia de alto (llega un posteo nuevo en vivo, se abre un hilo, cambia un
contador) la lectura salta. `updateNewPostsPill()` avisa de posteos nuevos
pero el render igual ocurre en el momento.

### Listas largas

| Lista | Paginado | Virtualizado | Nota |
|---|---|---|---|
| Feed | 15 + 15 (`PAGE_SIZE`/`PAGE_STEP` L13012-13013), «Ver más» automático con IntersectionObserver (L12770) | no | cada «Ver más» reconstruye todo lo ya pintado |
| Lo que pasó (ficha de lugar) | 30 + 30 (`FICHA_TANDA` L18495) | no | ídem |
| Registro de actividad | 30 + 30 (`auditVisibleCount` L11330) | no | filtra y ordena las 1.000 en cada render |
| Revisar lo de Calendar (925 filas) | 100 + 100 (`RV_PAGINA` L11406) | no | 100 filas por render: 192 nodos medidos con pocas; con 925 pendientes y «Ver más» ×9 serían ~3.000 nodos y el render entero por cada chip o tecla (`rvBuscar` también con 150 ms, L21446) |
| Personas | sin paginar (L10952) | no | son ~25: bien |
| Calendario mes | no aplica | no | 1.163 nodos, 37-63 ms por render con 2.000 posteos |

### Costo por render (ms, escritorio, 1 render = 1 `innerHTML`)

| Vista | 200 posteos | 2.000 posteos | Nodos |
|---|---|---|---|
| Feed (15 tarjetas) | 25 | **94** | 752 |
| Calendario | 21 | 37-63 | 1.163 |
| Países (lista) | 13 | 27-40 | 394 |
| Proyectos | 2 | 4-10 | 148 |
| Reportes | 32 | **137** | 534 |
| Administración › Resumen | 13 | 47 | 209 |
| Personas | 10 | 38-51 | 416 |
| Registro de actividad | 16 | 33 | 391 |
| Feed, «Ver más» ×1…×10 | 58 → 114 | **167 → 356** | 1.297 → 5.585 |

El Feed muestra 15 tarjetas en los dos casos; los 70 ms de diferencia son
trabajo sobre los 2.000:

- `getVisiblePosts()` L12988: cuatro `filter` encadenados sobre todos los
  posteos; por cada uno, `matchesTextFilter` sobre sus comentarios.
- `sortedFeedPosts()` L13040: por cada posteo, `occurrenceOf()` (L16280),
  que para cada posteo con repetición llama `postOccurrenceList()` **dos
  veces** (L16282 y L16288) y cada una expande 30 meses de regla
  (`OCC_BACK_MONTHS = 18, OCC_FWD_MONTHS = 12`, L16218) y rearma los `Set`
  de saltos y movidas. Y `renderPostCard` la vuelve a llamar para las 15
  pintadas (L14054).
- `renderFeedSide()` L13078: próximos 30 días, hitos por vencer, comentarios
  y menciones recientes — todo sobre todos los posteos; se cachea, pero los
  cachés se vacían al principio de **cada** `doRender()` (L10488-10492), así
  que no sirven de un render al siguiente.
- Reportes: `armarReporte()` (L14828) corre dos veces por render (el período
  y el anterior, L14831-14832), con `vecesEnVentana`/`fechasEnVentana`
  (expansión de repeticiones) por posteo; nada se guarda entre renders, y
  abrir el desplegable de filtros o tocar un chip es un render.

### O(n²)

No hay nada cuadrático en el camino caliente del Feed: los comentarios ya
llegan agrupados por `post_id` (L7877-7882) y se buscan por clave. Lo que sí:

- `applyCalendarEventToPosts()` hace `state.posts.find(p => p.calendarEventId
  === ev.id)` por evento (L6582, L6591, L6691, L6714): en una resincronización
  completa (primera vez, o token vencido con 410/400, L6447/6451) son
  eventos × posteos — con 925 eventos y 2.000 posteos, ≈ 1,9 M comparaciones.
  Son decenas de ms, no un problema hoy, pero un `Map` por
  `calendarEventId` lo deja en nada.
- `getPostById()` L14147 es un `find` lineal; se usa en clics (una vez), está
  bien.

---

## 4. Imágenes

- **Al subir** (`achicarDataUrl` L5514): canvas → JPEG calidad 0,85, lado
  máximo 2.560 px (`LIMITES_DE_LA_BASE` L7290), ≈ 600 KB; miniatura 480 px
  calidad 0,75 (`LADO_MINIATURA` L7386) ≈ 30 KB. Siempre JPEG
  (`toDataURL("image/jpeg")` L5527): PNG y WebP de origen pierden
  transparencia (relleno blanco) y no se aprovecha WebP, que a igual calidad
  pesa 25-35 % menos y lo soportan todos los navegadores actuales
  (`canvas.toBlob("image/webp")`; Safari desde 16).
- **En las tarjetas** (L4537): `srcMiniatura()` + `loading="lazy"` +
  `decoding="async"`, hasta 4 por posteo (L4534). Medido con 15 tarjetas:
  46 `<img>` en el DOM, **6 dentro de la pantalla, 33 miniaturas pedidas**
  (en celular de 390 px: 3 visibles, 27 pedidas). Es el umbral de Chromium
  para `lazy` (1.250 px en 4G, hasta 2.500 px en redes lentas): «lazy» acá
  difiere poco. Son ≈ 1 MB de fondo por carga. Además, como cada render
  recrea los `<img>`, el navegador los vuelve a resolver (desde caché, porque
  la firma es estable) y a decodificar: con 10 renders en el arranque la
  prueba contó 66 pedidos para 33 archivos.
- Los avatares de Google (`photoURL`, L10319, L10760, L10995, L13222…) van
  sin `lazy`. Son chicos.
- `.foto` no declara alto ni `aspect-ratio` en el `<img>` (L1354): **a
  confirmar** si hay salto de layout al cargar; el contenedor tiene
  `max-width:200px` y `overflow:hidden`, así que probablemente no.
- **Mapa**: Leaflet 1.9.4 + markercluster 1.5.3. Teselas de
  `tile.openstreetmap.org` (L15463), el servidor público de OSM (su política
  pide uso moderado y atribución; a escala de equipo está bien). Las teselas
  se piden recién al abrir Países › Mapa; **las librerías no: van en todas las
  cargas** (ver §1).

---

## 5. Memoria y fugas

Se revisó listener por listener. **No se encontraron fugas.**

- `document.addEventListener`: 22; `window.addEventListener`: 17. Todos a
  nivel del módulo (se registran una vez), salvo: `vigilarTeclado()` (L12684,
  llamada una sola vez, L12714); los arrastres (L9375 y L11934) que agregan
  `pointermove/up/cancel` al empezar y los sacan al soltar (L9390-9392,
  L11954-11956); `imprimirFicha` con `{ once:true }` (L18922).
- `setInterval`: **3**. 60 s para refrescar los «hace X» en el lugar sin
  render (L4983, global, barato). **30 s** `syncFromCalendar` (L6890, por
  pestaña con permiso de escritura; se frena en signout y en
  `teardownApprovedData`). 1 h `renovar` firmas por cada `enVivo` con
  adjuntos (posts y replies, L7816; se limpia al desuscribir, L7821).
- Observers: 1 `IntersectionObserver` (L12778), desconectado y rearmado en
  cada `afterRenderView`. No hay Mutation/ResizeObserver.
- Realtime: nombre único por canal (`Date.now()`, L7717); `removeChannel` en
  la función de cierre; `onAuthChanged` corta todo antes de volver a
  suscribir (L7020-7029). Bien.
- Cachés en memoria: `firmadas`, `rutaDeUrl`, `noHay` (Maps del store):
  acotadas por la cantidad de adjuntos; `rutaDeUrl` nunca borra las URL
  viejas al renovar (crece una entrada por adjunto por semana: nada).
  `contentTranslations`/`translationsShown` (L10191-10192): una entrada por
  posteo traducido en la sesión. `recentPostsCache` por minuto (L10703).
  `holidaysByDate` por país-año (L15577). Todo acotado.
- Heap medido con 2.000 posteos: 20-37 MB. Cómodo.

---

## 6. Almacenamiento del navegador

| Dónde | Clave | Qué | Tamaño | Tope / limpieza |
|---|---|---|---|---|
| localStorage | `ra_theme`, `ra_lang` | tema e idioma; se leen en el `<head>` antes de pintar (L19, L30) | bytes | — |
| localStorage | `ra_caribe_no` (L21105), `TOUR_FALLBACK_KEY` (L17516) | un «no volver a mostrar» y el respaldo del tutorial | bytes | — |
| localStorage | `registro.firmas.v1` (L7417) | URL firmada de **cada** adjunto y miniatura, con vencimiento | ≈ 300 B por adjunto: 1.000 adjuntos ≈ 300 KB | si no entra, solo miniaturas; si tampoco, nada (L7436-7442). Se borra al cerrar sesión (L7054, L8201) |
| localStorage | `${prefix}:${email}` (L5075): `mentionsSeenAt`, `repliesSeenAt`, `changesSeenAt`, `calendarInvite…`, `upcomingSeenIds` | marcas de «ya visto» | ≤ 300 ids (`MAX_IDS_VISTOS` L5109) | **llevan el correo**: dos cuentas en el mismo navegador no se mezclan; además se espejan en `user_prefs` |
| sessionStorage | `calendarToken` (L5760) | token OAuth de Calendar + vencimiento | 1 KB | se borra en signOut (L5728); vive solo en la pestaña |
| IndexedDB / Cache API / service worker / manifest | — | **no hay** | | |

- **Modo privado o datos borrados**: todo está en `try/catch`; la app anda
  igual, pero vuelve al tema claro y al español hasta que el módulo corre
  (flash), el tutorial puede reaparecer, y las firmas se vuelven a pedir
  (un `createSignedUrls` con todos los adjuntos, L7454).
- **Origen compartido**: `team-latam.github.io` es un solo origen para todos
  los proyectos de la cuenta; los 5 MB de localStorage se comparten (el
  código ya lo contempla, L7414-7416).
- **PWA**: no hay `manifest.json`, `<link rel="icon">`, `theme-color` ni
  `apple-mobile-web-app-*`. «Agregar a pantalla de inicio» deja un ícono
  genérico y abre con la barra del navegador. Sin service worker, **sin
  conexión no hay nada** (ni el cascarón), y cada visita después de 10
  minutos vuelve a preguntar por el HTML.

---

## 7. CSS

Medido con `css_stats.mjs` sobre las líneas 37-3612:

- 3.576 líneas, 253 KB (58 KB gzip), ≈ 2.000 reglas, 1.948 selectores,
  22 con `#id`, 3 con 4+ partes (p. ej. `html[dir="rtl"] .pref-switch
  input:checked + .pref-slider::before`). Especificidad razonable.
- `!important`: **18**.
- `@media`: 14 formas distintas. `max-width`: **400, 420, 480, 500, 520,
  640 (×18), 760 (×7), 900** — los dos principales son 640 y 760; los otros
  cinco son ajustes sueltos de un componente cada uno. `min-width`: 761,
  1024. Más `hover:hover`, `hover:none`, `print`, `prefers-reduced-motion`.
  Son **8 puntos de quiebre** para lo que en la práctica son tres
  (celular / tablet / escritorio): cuesta razonar y probar.
- `backdrop-filter: blur(16px) saturate(1.7)`: **6** veces (barra de abajo
  del celular L3538, su hoja L3559, …) sobre elementos `position:fixed`
  encima del contenido que se desplaza: en un Android de gama baja es
  repintado con desenfoque en cada cuadro de scroll. Hay `@supports` de
  respaldo (L3544), no hay `prefers-reduced-transparency`.
- `position:fixed`: 18; `sticky`: 11 (topbar `top:0` L174, tabs L160, menú
  de admin L433, `rv-barra` L698, `fl-lado` L2285, columna del Feed L1187…).
  Con sesión y en celular hay 4-5 capas compuestas siempre vivas: header,
  tabs, barra de abajo, FAB, flecha de subir.
- Transiciones: 25, ninguna `all`. **4 animan propiedades de layout**:
  `width`/`height`/`top`/`left` (L202 `transition:width`, L372 el
  resaltado del tutorial `top/left/width/height`, L389, L1999 `height`).
  Son cortas (0,12-0,22 s) y en elementos chicos: aceptable. `@keyframes`: 5
  (`filterDropdownPop`, `dp-shake`, `calIrEntra`, `calDestino`,
  `visorEntra`), con `transform`/`opacity`. `will-change`: 0 (bien: no hace
  falta).

---

## 8. Red en uso

- **Polling**: `syncFromCalendar({silent:true})` cada **30 s** en toda
  pestaña con permiso de escritura (L6885-6891). Cada vuelta: 1 lectura de
  `app_config` (`getSyncMeta` → L8027) + 1 `GET events?syncToken` a Google
  con API key (L6446); si vinieron eventos, además `calendar_sacados`. Son
  **5.760 pedidos por día por pestaña**, también con la pestaña en segundo
  plano o la notebook con la tapa a medio cerrar (no hay `visibilitychange`
  ni `online` en todo el archivo). Tres personas con dos pestañas cada una
  son ≈ 35.000 pedidos diarios para enterarse de cambios que, además, el
  sincronizador nocturno ya trae.
- **Realtime**: 9 canales por pestaña sobre un websocket: `posts`, `replies`,
  `members` (propio con filtro y entera), `access_requests` (propio; el
  admin, entera), `app_config` (dos claves), `user_prefs` (propio),
  `former_members`, `audit_log` (admin). Sin filtro en posts/replies, cada
  cambio llega a todas las pestañas (correcto para un equipo chico). Cada
  reconexión recarga la tabla entera (decisión del punto 9): en un celular
  que pasa de wifi a 4G son otros 2,75 MB + 1 MB.
- **Cuánto baja el Feed**: fila de `posts` sintética sin resumen ≈ 1,4 KB
  (2,75 MB / 2.000). Con `resumen` el tope es 64 KB por fila (`03-validacion`
  L184) y el de la fila entera 256 KB (L375). Escenarios para 2.000 posteos:

  | Escenario | JSON | gzip (≈5:1) |
  |---|---|---|
  | Sin resúmenes | 2,8 MB | 0,55 MB |
  | 15 % con resumen de 8 KB | 5,2 MB | 1,0 MB |
  | 30 % con resumen de 20 KB | 14,8 MB | 3 MB |
  | + replies (3.000) | +1,0 MB | +0,2 MB |
  | + 33 miniaturas | +1,0 MB | +1,0 MB (ya comprimidas) |

  Supabase comprime las respuestas JSON (gzip en el borde), así que lo que
  cuenta contra los 5 GB mensuales es la columna derecha; las fotos no
  comprimen. Con 1 MB de JSON + 1 MB de miniaturas por carga, el equipo tiene
  ≈ 2.500 cargas al mes antes de tocar la cuota, contando reconexiones.

---

## Arreglos recomendados, por ganancia

| # | Arreglo | Dónde | Esfuerzo | Ganancia estimada |
|---|---|---|---|---|
| A | **Leaflet a demanda**: cargar `leaflet.css`/`.js` y markercluster con `cargarScript()` como SheetJS, al entrar a Países › Mapa | L10-12, L3797-3798, `initOrUpdateMap` L15454 | chico | −5 pedidos y −60 KB en cada carga; el módulo arranca ≈ 0,3-0,5 s antes en 4G |
| B | **`posts` sin `resumen` en la lista** (`select` de columnas) y leer el resumen de un posteo recién al abrir la ficha | `consulta()` L7738, `lecturaDeFicha` L18595 | medio | según cuántos cierres haya: −50 % a −80 % del JSON de posts por carga y por reconexión |
| C | **Paralelizar el arranque**: suscribir `replies` junto con `posts` (no adentro de su callback) y, al conocer `count`, pedir las páginas 2..n en paralelo | L8678, `traerTodas` L7655 | chico | −3 a −5 viajes en serie: ≈ 0,5-1,5 s menos hasta ver comentarios en 4G |
| D | **Juntar los renders del arranque**: `scheduleRender()` en todos los callbacks de suscripción (hoy solo replies) | L7190, L7218, L8277, L8303, L8327, L8361, L8371, L7244, L7250, L8679 | chico | 10-11 renders → 2-3; −150-300 ms de CPU en escritorio, −0,5-1 s de congelamiento en celular |
| E | **Memorizar lo derivado por posteo**: `postOccurrenceList` cacheada por `(post, hoy)` e invalidada cuando cambia ese posteo; no vaciar `upcoming/recent*Cache` en cada `doRender` sino cuando cambian posts/replies; cachear `armarReporte` por `(ventana, filtro)` | L16280-16290, L10488-10492, L14828 | medio | Feed 94 → ≈ 40 ms por render; Reportes 137 → ≈ 50 ms; cada tecla del buscador a la mitad |
| F | **«Ver más» que agrega en vez de rehacer**: pintar solo las tarjetas nuevas con `insertAdjacentHTML` antes del botón | L12784, L20437 | medio | 356 → ≈ 40 ms al llegar a 165 tarjetas; sin salto de scroll |
| G | **Polling de Calendar**: cada 2-5 min, parar con `document.hidden`, correr al volver (`visibilitychange`, `focus`, `online`) | L6890 | chico | −90 % de los 5.760 pedidos diarios por pestaña; también mejora la batería |
| H | **Service worker + manifest + ícono**: cascarón en caché con *stale-while-revalidate* del HTML, `theme-color`, ícono 192/512 | nuevo `sw.js` + `manifest.json` (dos archivos más en la raíz: hay que decidirlo contra la regla «solo index.html») | medio | visitas repetidas sin bajar 414 KB (≈ 2 s en 4G cada deploy); instalable en el celular; portada visible sin red |
| I | **Publicar una copia sin comentarios**: un paso en el workflow de Pages que sirva `index.html` con comentarios y espacios fuera, dejando el fuente como está | `.github/workflows` | medio (decisión) | 414 → ≈ 250 KB gzip (−40 %); −225 KB de comentarios al parser. Choca con «sin build»: proponer, no hacer |
| J | **Miniaturas WebP** (`toBlob("image/webp", 0.8)`) con JPEG de respaldo si el navegador no las genera | L5527, L7549 | chico | 30 → ≈ 20 KB por miniatura: −30 % del MB de fotos por carga y de la cuota de Storage |
| K | Sacar `api.ipify.org` del login (o pedirla solo en acciones de admin) | L6934 | chico | −1 pedido externo y −1 dependencia de terceros por sesión |
| L | Unificar breakpoints en 3 (≤ 520, ≤ 760, ≥ 1024) y un `prefers-reduced-transparency` para la barra con `backdrop-filter` | CSS | chico | más fácil de probar; menos repintado en Android de gama baja |
| M | Índice `Map` por `calendarEventId` para `applyCalendarEventToPosts` | L6582-6714 | chico | resincronización completa de 925 eventos: decenas de ms → ~1 ms |

Lo que ya está bien y conviene no tocar: paginado de a 1.000 con `count`,
miniaturas + firmas estables + `lazy`, carga a demanda de JSZip/SheetJS/
docx-preview/GIS, `scheduleRender` por rAF, restauración de foco y selección
tras el render, limpieza de listeners de arrastre y de canales, tema e idioma
aplicados en el `<head>` antes de pintar, heap chico.
