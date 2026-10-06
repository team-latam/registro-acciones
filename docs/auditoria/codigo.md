# Revisión de código — `index.html` (Registro de Acciones)

Fecha: 2026-10-06 · Commit base: `d12352f` · Archivo: 21.865 líneas (CSS 37–3612, módulo JS 3799–21862).
Método: se extrajeron las 1.068 declaraciones de nivel de módulo con el tokenizador del repo (`pruebas/grab.mjs → recorrer()`), se contaron referencias en todo el archivo (JS + HTML + atributos), y cada candidato se abrió y se leyó antes de anotarlo. Lo que resultó falso positivo (p. ej. funciones llamadas vía spread `...fn()`, clases CSS armadas con `cols-${n}`, `docx-wrapper` que pone la librería) quedó afuera.

## Tabla resumen

| # | Hallazgo | Gravedad | Línea(s) |
|---|----------|----------|----------|
| 1 | Mes de "login/cargadas este mes" en Administración mezcla fecha UTC con mes local | Media | 11211–11214 |
| 2 | Rótulo "Hoy/Ayer" de la auditoría compara día UTC contra día local | Media | 11849–11851 |
| 3 | Serie "posteos por mes" de Personas usa mes UTC contra índice local | Media | 10934–10943 |
| 4 | Lista de últimos 12 meses de la ficha de lugar se arma con `toISOString()` sobre fecha local | Baja | 18872 |
| 5 | Fecha de aprobación de un miembro se muestra en día UTC | Baja | 10857, 18278 |
| 6 | `memberByEmail` compara correos con distinción de mayúsculas; el resto del código los baja a minúsculas | Baja | 5153–5158 vs 5193–5197 |
| 7 | Contraste de `--text-muted` sobre `--bg` y `--surface-alt` por debajo de AA en tema claro (4.33 y 4.17), usado en 86 reglas con letra de 10–11.5 px | Media | 44–60, CSS varias |
| 8 | `prefers-reduced-motion` solo apaga 1 de 9 animaciones y ninguna de las 25 transiciones | Baja | 3409 |
| 9 | 4 `<img>` de vista previa sin `alt` | Baja | 13254, 14259, 14304, 17943 |
| 10 | 8 botones "✕" sin `aria-label` ni `title` (solo el símbolo) | Baja | 13254, 14259, 14304, 14327, 17943, 19351 |
| 11 | `<span>`/`<div>` clickeables (`data-action`) sin `role`, `tabindex` ni teclado: chips de filtro, chips de alcance, tarjetas de país, @menciones | Media | 4481, 5185, 5219, 12855–12872, 13030–13031, 14192, 14198, 15234, 15297, 15862, 19635 |
| 12 | 4 funciones muertas (64 líneas) + 2 que solo usan las pruebas | Baja | 5173, 12634, 14331, 16256, 13438, 19367 |
| 13 | 6 ramas de `CLICK_ACTIONS` que ningún botón emite (y 3 campos de estado que ya nadie cambia) | Baja | 20014, 20469, 20472, 20779, 20790, 21145 |
| 14 | 38 clases CSS definidas y no usadas (muestra confirmada abajo) | Baja | 251–1432 (ver detalle) |
| 15 | Reglas CSS que se pisan: `.fab-wrap/.fab-main/.scroll-top` dos veces dentro del mismo `@media 640`; `.dt-row .date-field`, `.rep-kpis`, `.rep-filtros-tit`, `.doc-fila` redefinidas | Baja | 299–302 vs 3576–3579; 1943/1953; 2606/2648; 2642/2694; 2325/2372 |
| 16 | 18 bloques `@media (max-width:640px)` y 7 de `760px` repartidos por el archivo | Baja | 297…3518 |
| 17 | Dos vocabularios de "lugar" (`scope.type: todo/region/pais/ciudad` vs `place.kind: latam/zona/country/city` vs `L:{zona,country,city}`) y dos resolvedores de nivel paralelos (`scopeLevelFor`/`recordLevelFor`/`postLevelFor` y `nivelEnFicha`) | Media (refactor) | 5443–5470 vs 18508–18530 |
| 18 | Dos sistemas de fecha: local (`fmtDate`, `todayISO`) y UTC (`isoDate`, `fmtISO`, `addDaysISO`); dos parsers de fecha tipeada (`parseTypedDate`, `fechaEscrita`) | Media (refactor) | 4751–4855 vs 15990–16003, 4823 vs 16851 |
| 19 | Cinco formas de resolver "quién es" a partir de un correo/nombre | Baja (refactor) | 5153, 5181, 5193, 11504, 14966, 18556 |
| 20 | `crearSupabaseStore` tiene 890 líneas; 9 funciones superan las 100 | Baja | 7316 |
| 21 | Cada cambio de estado hace `viewRoot.innerHTML = html` (376 llamadas a `render()`); el foco se restaura a mano, el scroll de sub-paneles también | Baja (diseño) | 9855, 10487–10575 |
| 22 | `recurrenceSkipDates` recorre `state.posts` por cada posteo recurrente al ordenar el Feed (O(recurrentes × posteos)) | Baja | 16166–16180, 13046 |

Lo que se buscó y **no** apareció (vale decirlo para que no se vuelva a buscar): `parseInt` sin radix (0 casos), `JSON.parse` fuera de `try` (los 3 están adentro), `==` sueltos que importen (solo `==null` idiomáticos), `.find()` desreferenciado sin guarda (los 4 sospechosos tienen `|| {}` o `|| null`), listeners agregados en cada render (los 16 `addEventListener` indentados viven en funciones que se llaman una sola vez: `vigilarTeclado`, `deslizarPara`, `trapTabWithin`; el de `calGridBody` va sobre un nodo que se recrea), `setInterval` sin `clearInterval` (el de 4983 es global a propósito; el de 7816 se limpia en 7821), canal realtime sin `removeChannel` (7821), `IntersectionObserver` sin `disconnect` (12773/12780), doble submit (todos los `submitting`/`saving` tienen guarda `if(d.submitting) return` o `disabled` en el botón), textos visibles sin `t()` (1.557 llamadas; las 3 sospechas eran `t()` partidas en varias líneas y "🔗 Link"), idiomas faltantes en `t()` (ninguno vacío; las 4 sin hebreo son los placeholders `dd/mm/aaaa`), `catch` vacíos que traguen un guardado (los 16 son `localStorage`/`sessionStorage`/`URL`; el de 8586 es a propósito y está comentado), comentarios sobre Firebase (los 6 son notas de historia, correctas), `TODO/FIXME` (0), `canCancelPost` vs UI (la misma función decide el menú 14095 y el handler 20193), `sinCalendar` (consistente entre composer 21716, merge 9624 y sync 9736/9746), `recurrenceSkip/Moves` (validados en 16167 y 16224–16231; `expandRecurrence` calcula cada repetición desde el inicio, no encadenando, y cuenta `COUNT` antes de `EXDATE` como pide el RFC).

---

## 2. Bugs probables

### 1. Mes UTC contra mes local en el resumen de Administración — Media

`index.html:11211-11214`
```js
const mes = todayISO().slice(0,7);                                   // LOCAL
const mesDe = ts => { const ms = tsToMillis(ts); return ms ? new Date(ms).toISOString().slice(0,7) : ""; };   // UTC
const entraron = new Set(state.auditLog.filter(e => e.type === "login" && e.actorEmail && mesDe(e.createdAt) === mes)...
const cargadas = state.posts.filter(p => mesDe(p.createdAt) === mes).length;
```
`todayISO()` (4751) arma el mes con `getFullYear()/getMonth()` locales; `mesDe` lo arma en UTC. En Argentina/Brasil (UTC−3) un posteo cargado el 31 a las 22:00 cae en el mes siguiente; en Israel (UTC+2/+3) uno cargado el 1 a la 01:00 cae en el mes anterior. "Entraron este mes" y "cargadas este mes" dan distinto según desde dónde se mire.

**Arreglo**: un helper `mesLocalDe(ms)` con `getFullYear()/getMonth()` (o reusar la lógica de `todayISO`) y usarlo acá y en 10943.

### 2. "Hoy"/"Ayer" de la auditoría — Media

`index.html:11849-11851`
```js
const today = todayISO(), ayer = addDaysISO(today, -1);               // LOCAL
const diaDe = e => { const ms = tsToMillis(e.createdAt); return ms ? new Date(ms).toISOString().slice(0,10) : ""; };   // UTC
const rotuloDia = iso => iso === today ? t("Hoy",…) : iso === ayer ? t("Ayer",…) : fmtISO(iso, …);
```
Después de las 21:00 en Argentina todo lo que pasa hoy se agrupa bajo la fecha de mañana (y no dice "Hoy"); en Israel antes de las 03:00 se agrupa en ayer. Mismo arreglo que el 1: `diaLocalDe(ms)`.

### 3. Serie "posteos por mes" de Personas — Media

`index.html:10934-10943`
```js
const hoyM = todayISO().slice(0,7);                                  // LOCAL
…
const i = idx(new Date(ms).toISOString().slice(0,7));               // UTC
```
El índice se calcula desde un mes local y cada posteo se ubica por su mes UTC. Mismo corrimiento de borde de mes que el 1.

### 4. Últimos 12 meses de la ficha — Baja

`index.html:18872`
```js
for(let i = 11; i >= 0; i--){ const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
```
`setDate(1)` fija el día 1 **local** a la hora actual y después se lee en UTC. En Israel entre las 00:00 y las 03:00 del día 1 la lista arranca un mes atrás (y `fechaDePost(p).startsWith(m)` compara contra fechas `YYYY-MM-DD` locales). Arreglo: armar el string con `getFullYear()/getMonth()` o con `addMonthsISO(todayISO().slice(0,7)+"-01", -i)` que ya existe (15993).

### 5. Fecha de aprobación en día UTC — Baja

`index.html:10857` y `18278`
```js
const desde = desdeMs ? fmtDate(new Date(desdeMs).toISOString().slice(0, 10)) : "";
```
`fmtDate` acepta un `Date` directamente (4782: `typeof d === "string" ? new Date(d+"T00:00:00") : d`): pasarle `new Date(desdeMs)` evita el paso por UTC y el día corrido para aprobaciones a la noche.

### 6. `memberByEmail` distingue mayúsculas — Baja

`index.html:5153-5158`
```js
function memberByEmail(email){
  if(!email) return null;
  const active = state.roster.find(u=>u.email===email);
```
mientras que `personaQueGusta` (5193–5197) hace el fallback en minúsculas justamente porque esto puede fallar, y `canCancelPost` (8719–8722), `rvParticipantes` (11513) y el chooser de participantes (19608) comparan con `toLowerCase()`. Los correos de Google vienen en minúscula casi siempre, así que hoy no muerde; pero `authorLabelHtml`, `nombreEnReporte`, `importedPostDocId` y el resto que usan `memberByEmail` quedan con una regla distinta del resto. Arreglo: normalizar adentro de `memberByEmail` y sacar los fallbacks duplicados de `personaQueGusta`.

### 22. Orden del Feed con recurrentes — Baja (rendimiento)

`index.html:16166-16180` recorre `state.posts` entero por cada llamada; `occurrenceOf` (13046, 13081, 12982) la llama por cada posteo recurrente al ordenar. Con pocos recurrentes no se nota; si crecen, el orden del Feed es O(recurrentes × posteos) por render. Arreglo: un índice `masterId → Set<iso>` calculado una vez por `doRender()` (como ya se hace con `placeCountsCache`, 10488).

---

## 5. Accesibilidad

### 7. Contraste de `--text-muted` — Media

`index.html:44-60` (tema claro): `--text-muted:#5c7a7c`, `--card:#ffffff`, `--bg:#f4f8f8`, `--surface-alt:#eef4f4`.

| Par | Ratio | AA texto normal (4.5) | AA texto grande (3) |
|-----|-------|----|----|
| muted / card | 4.64 | sí | sí |
| muted / bg | **4.33** | **no** | sí |
| muted / surface-alt | **4.17** | **no** | sí |
| (oscuro) muted / card | 6.29 | sí | sí |

`color:var(--text-muted)` aparece en 229 reglas; 86 de ellas con `font-size` entre 10 y 11.5 px (13 de 10.5 px, 2 de 10 px), que es justo donde el contraste pesa más (hints, pies, contadores, `.city-row.cross small`). Arreglo: bajar `--text-muted` claro a algo como `#4f6c6e` (≈5.1 sobre `--bg`) y no usar menos de 11 px con muted.

### 8. `prefers-reduced-motion` — Baja

`index.html:3409`: `@media (prefers-reduced-motion:reduce){ .visor-ventana{ animation:none; } }` es la única regla. El CSS tiene 9 `animation:`, 5 `@keyframes` y 25 `transition:` (incluidos `dp-shake` 1942 y `html{scroll-behavior:smooth}` 142). El JS sí lo respeta en 17632. Arreglo: una regla global al final del CSS: `@media (prefers-reduced-motion:reduce){ *,*::before,*::after{ animation-duration:.01ms!important; transition-duration:.01ms!important; scroll-behavior:auto!important; } }`.

### 9. `<img>` sin `alt` — Baja

`index.html:13254`, `14259`, `14304`, `17943`, todas con la misma forma:
```html
<div class="img-preview"><img src="${srcMiniatura(src)}"><button type="button" class="rm" data-action="rutina-rm-image" data-idx="${i}">✕</button></div>
```
Son miniaturas decorativas de lo que se va a adjuntar: `alt=""` alcanza, y el botón de al lado necesita nombre (hallazgo 10).

### 10. Botones "✕" sin nombre accesible — Baja

`class="rm"` aparece 11 veces; solo 3 llevan `title` (9516, 13512, 19411). Sin nombre: 13254, 14259, 14304, 17943 (quitar imagen), 19351 (`renderFileChips`, quitar archivo), 14327 (`rm-link`). Arreglo: `aria-label="${esc(t("Quitar","Remove","Remover","הסרה"))}"` en los 6, en un solo lugar si se unifica el armado del botón.

### 11. Elementos clickeables que no son botones — Media

Todos son `<span>`/`<div>` con `data-action` que el despachador de clicks resuelve, pero sin `role="button"`, `tabindex="0"` ni manejo de Enter/Espacio: no se alcanzan con Tab ni los anuncia el lector.

- Chips de filtro del Feed `class="chip-toggle"`: 12855, 12859, 12863, 12867, 12872, 13030, 13031, 15234, 15862.
- Chips de alcance: 14192 (`scope-chip ver-completo`), 14198 (`<span class="rm">✕</span>`), 19635 (`rm-participant`).
- Tarjeta de país entera: 15297 `<div class="country-card" … data-action="drill-country">`.
- @menciones y nombres de persona: 4481, 5185, 5219 (`mention-tag`, `person-link`).

Arreglo: cambiarlos a `<button type="button" class="chip-toggle …">` (el CSS ya les pone `cursor:pointer`; haría falta `font:inherit; border:0; background:none` donde no esté). Para las @menciones dentro del texto, `<button>` inline o `role="link" tabindex="0"` + rama de `keydown` Enter en el despachador.

---

## 1. Código muerto

### 12. Funciones sin ningún llamador — Baja

| Función | Línea | Líneas | Evidencia |
|---|---|---|---|
| `authorLabel` | 5173 | 4 | La única otra mención es el comentario 5177 ("Mismo authorLabel() de arriba…"). Se usa `authorLabelHtml`. |
| `renderScopeBuilder` | 14331 | 47 | Única otra mención: comentario 4347. El composer usa `commitScope`/`getPlaceMatches`; tampoco la usan las pruebas. |
| `preferenciasSections` | 12634 | 10 | `renderPreferenciasView` (12644) ya no la llama; la sección se elige con la acción `admin-go` (20099–20102). |
| `postOccurrenceDates` | 16256 | 3 | Nadie la llama; el comentario de arriba dice "es lo que usan el orden del Feed", pero el Feed usa `occurrenceOf` (16279). |
| `sinRanura` | 13438 | 2 | Solo `pruebas/docs_test.mjs:44,51,281`. |
| `sePuedeVer` | 19367 | 2 | Solo `pruebas/armar_docs.py:8`, `armar_puerta.py:14` y un stub en `docs_test.mjs:35`. |

Para las dos últimas: o la app las usa, o la prueba prueba algo que no existe. Borrar las seis y sacar los nombres de las listas de las pruebas (`docs_test.mjs`, `armar_docs.py`, `armar_puerta.py`), corriendo `./pruebas/correr.sh` después.

Variables de estado nunca leídas: ninguna (se chequearon los 119 `let` y 178 `const` de nivel de módulo).

### 13. Ramas del despachador que nadie emite — Baja

Se compararon las 265 claves de `CLICK_ACTIONS` (19889–21394) contra los 268 valores distintos de `data-action="…"` del archivo (más los 4 dinámicos `${action}`, `${rmAction}`, `${removable}`, `${isLast ? "close-tour" : "tour-next"}`, resueltos a mano).

| Clave | Línea | Qué toca |
|---|---|---|
| `"usuarios-sort"` | 20014 | `state.usuariosFilters.sort` — no lo cambia nadie más |
| `"reporte-anio"` | 20469 | `state.reportes.anio` — solo se lee en 14533 con default |
| `"reporte-trimestre"` | 20472 | `state.reportes.trimestre` — ídem, 14534 |
| `"goto-country"` | 20779 | el pie de Vistas emite `goto-latam`, no esta |
| `"goto-city"` | 20790 | ídem |
| `"pref-section"` | 21145 | `state.preferenciasSection` se setea en 20102 por otra acción |

```js
    "reporte-anio": async (el, e, action, postId) => {
    state.reportes.anio = el.dataset.key; render();
  },
```
Al revés (botón sin rama) no hay ninguno: los 53 `data-action` que no están en `CLICK_ACTIONS` los manejan el listener de `change` (21519–21674: `zonas-*`, `tipos-*`, `set-role`, `*-files`, `*-images`, `dp-my-change`, `tipo-doc-*`) o el de `click` previo de 19752 (`tipo-doc-nuevo`), y están todos cubiertos. El prefijo `rm-scope-*` se resuelve antes (21399).

### 14. Clases CSS sin uso en HTML/JS — Baja

De 1.013 clases definidas, 38 no aparecen en ningún `class="…"`, `classList` ni template (muestra confirmada abriendo cada una):

- `.gate-primera` (545) — se usa `gate-primera-linea`, no esta.
- `.sort-label` (260), `.ractions-sep` (615, 632), `.tipo-meta` (384), `.tipo-sync-toggle` (386), `.zone-countries` (396), `.country-row`/`.country-name` (423), `.tipo-icon-input` (459), `.zone-edit-list`/`.zone-edit-row`/`.zone-label-input` (466–467), `.tipo-archivado` (473), `.post-head` (549), `.post-scopes-head` (572), `.t-visita`/`.t-rutina` (852, 867), `.feed-order-seg`/`-btn`/`-hint` (994–996), `.rep-selector`/`.rep-total`/`.rep-total-txt`/`.rep-total-sub`/`.rep-acciones` (1007–1014), `.rep-modo`/`.rep-comparar-elegir`/`.rep-filtros` (1055–1056, y `.rep-filtros{…}` otra vez en 2693), `.quiet` (1128), `.breadcrumb` (2905–2906, 3492), `.city-list`/`.city-row`/`.cname`/`.ccount`/`.cross` (2905–2921, un bloque entero de la vista de ciudades que ya no existe), `.post-cross-region` (1163), `.file-preview-pager` (3295–3303, el visor usa `filePreviewPrev/Next` con otras clases), `.tipo-docs-rotulo` (1432).

Son restos de vistas reemplazadas (lista de ciudades, selector de orden viejo, cabecera de reportes vieja). Se pueden borrar en bloque; ninguna la genera JS por concatenación (se revisaron `cols-${n}` y `docx-wrapper`, que sí son dinámicas/de librería y quedan).

### 15. Reglas CSS que se pisan — Baja

- `.fab-wrap`, `.fab-main`, `.scroll-top` dentro del **mismo** `@media (max-width:640px)`, en 299–302 y de nuevo en 3576–3579. La segunda gana en las mismas propiedades (`inset-block-end`, `inset-inline-end`, `width/height/font-size`): las tres de 299–302 son letra muerta.
  ```css
  /* 299 */ .fab-wrap{ inset-block-end:16px; inset-inline-end:16px; }
  /* 3576 */ .fab-wrap{ inset-block-end:calc(16px + env(safe-area-inset-bottom)); inset-inline-end:auto; left:50%; transform:translateX(-50%); align-items:center; }
  ```
- `.dt-row .date-field{ flex:1; min-width:0; }` (1943) pisada entera por `{ flex:0 1 auto; min-width:112px; }` (1953), diez líneas más abajo.
- `.rep-kpis` (2606) pisada por 2648 (`gap:12px`→`0`, `margin-bottom` distinto).
- `.rep-filtros-tit` (2642) pisada entera por 2694.
- `.doc-fila` (2325, con `padding/min-width/flex-wrap`) y 2372 (`display/align-items/gap`): la segunda no agrega nada y confunde.
- Mergeables sin conflicto: `html` (128/142), `.post-actions` (1311/1372), `.dt-row` (1924/1950), `.dt-row .date-trigger` (1944/1954), `.rep-barra-control` (2624/2638), `.rep-sugerencias li` (2668/2716), `.visor-ventana-foto` (3271/3407), `.lightbox-counter` (3287/3439).

### 16. `@media` repetidos — Baja

46 bloques: `(max-width:640px)` ×18 (297, 605, 850, 1314, 1360, 1518, 1798, 1846, 2232, 2276, 2396, 2669, 2931, 2999, 3219, 3447, 3476, 3518), `(max-width:760px)` ×7, `(max-width:520px)` ×5, y además `400/420/480/500/900px` sueltos (cinco breakpoints angostos distintos para lo mismo). No es un bug, pero es lo que permitió el hallazgo 15. Si se reordena el CSS por componente conviene dejar un breakpoint por componente y unificar 400/420/480/500 en 520.

### Constantes sin uso
Ninguna. (`MAX_POST_CONTENT`, `FILE_DATA_URL_RE`, `DATE_LOCALES`, etc. se usan dentro de templates; se verificaron.)

---

## 3. Duplicación (insumo para refactor)

### 17. Lugares: tres formas y dos resolvedores — Media

- **Alcance guardado** (`post.scopes[]`): `{ type:"todo" | "region"(+region) | "pais"(+country) | "ciudad"(+country,city) }` — 5427–5500, 20775.
- **Filtro de lugar** (`state.filters.place`): `{ kind:"latam" | "country"(+country) | "city"(+country,city) }` y `kind:"zona"` en otro lado — 5443–5456, 12947.
- **Ficha** (`L`): `{ zona }` | `{ country }` | `{ country, city }` — 18502–18530.

Y dos funciones que hacen lo mismo con vocabularios distintos:
- `scopeLevelFor(sc, place)` + `recordLevelFor` + `postLevelFor` (5443–5470) → `"own"|"region"|"latam"`.
- `nivelEnFicha(post, L)` (18508) → `"own"|"pais"|"region"|"latam"` (¡un nivel más!), reimplementando la misma tabla de reglas línea por línea.

Más: `esDelPais` (13948) es `postLevelFor(post,{kind:"country",country})==="own"`, `zoneOfCountry` (5484) y `zoneOfScope` (5427) hacen el mismo lookup, `partesDeLugar` (18531) envuelve a `partesDelPais`/`partesDeCiudad` (13963/13973) con una tercera rama para zona. Sugerencia: un solo tipo `Lugar = {nivel:"latam"|"zona"|"pais"|"ciudad", zona?, country?, city?}` con conversores desde `scope` y desde `place`, y una sola `nivelDe(scopes, lugar)`.

### 18. Fechas: dos relojes y dos parsers — Media

- Rama **local**: `todayISO` (4751), `fmtDate` (4780, `new Date(d+"T00:00:00")`), `fmtDateTime` (4986), `fmtTime` (4955), `timeAgo`, `fechaDeArchivo` (13430).
- Rama **UTC**: `isoDate` (15990, `new Date(iso+"T00:00:00Z")`), `fmtISO` (15991, `timeZone:"UTC"`), `isoDow`, `addDaysISO` (6080), `addMonthsISO` (15993), `weekStartISO`, `diasDesde` (18541), `fechaDeTarjeta` (14023), `mesCortoDe` (14653), `occDateLabel` (16329).

Las dos son correctas por separado (y la nota en 6076 explica por qué nació la UTC), pero `fmtDate(iso)` y `fmtISO(iso,opts)` formatean el mismo `YYYY-MM-DD` por caminos distintos, y los bugs 1–5 son exactamente el punto de contacto entre ambas (un `Date` de timestamp pasado por `toISOString()` y comparado con `todayISO()`). Sugerencia: dejar `todayISO()` como el único productor de "hoy", agregar `isoLocalDe(ms)` y `mesLocalDe(ms)` y prohibir `toISOString().slice(0,10)` por convención (hay 9 usos: 6083, 10857, 10943, 10955, 11212, 11850, 11880, 16002, 18278, 18872; los de 6083 y 16002 son correctos porque operan sobre `Date.UTC`).

- Parsers de fecha tipeada: `parseTypedDate(raw, fallbackYear)` (4823, 60 líneas, según `typedDateOrder()`) y `fechaEscrita(texto)` (16851, 45 líneas, prueba todos los órdenes). Hacen lo mismo con reglas distintas (p. ej. año de 2 dígitos); conviene que uno llame al otro.

### 19. "Quién es" — Baja

| Función | Línea | Entrada | Salida |
|---|---|---|---|
| `memberByEmail` | 5153 | email | miembro (roster o ex) |
| `authorLabelHtml` | 5181 | email, fallback | `<span class="mention-tag">` |
| `personaQueGusta` | 5193 | email | `{email,name,nickname,photoURL,cuenta}` con 3 fallbacks |
| `rvPersona` | 11504 | nombre/apodo | `{email,name}` |
| `miembroPorTexto` (vía `quienDe`) | 18556 | texto suelto | miembro |
| `nombreEnReporte` | 14966 | email | nombre o email |
| `participantsLabel` | 9552 | lista | `"a, b"` |

Cinco maneras de ir de un identificador a un nombre mostrable, con reglas de fallback distintas (`m.name || "@"+nickname` vs `m.name || m.email` vs `m.name || m.nickname || nombre`). Sugerencia: `personaDe(emailOTexto)` única (la de `personaQueGusta` ya es la más completa) y `nombreDe(persona)` con una sola regla de fallback.

### Documentos faltantes
No hay duplicación: `docsEsperados` → `docsExigidos` → `cuantosDocsHay` (13394–13466) es una sola cadena, y `renderCalendarFaltantes` (12335) es otra cosa (eventos sin Calendar). La única trampa posible (`docsExigidos` filtra `!d.opcional` mientras `docEsOpcional` también mira el nombre «Otro») no muerde porque `applyActivityTypesConfig` normaliza `opcional` al cargar (8437).

### Filtros de posteos por lugar
`matchesPlaceOrZoneFilter` (12947) y `computePlaceCounts` (14394) usan `recordLevelFor`; `hijosDeLugar` (18690) y `datosDeFicha` (18558) usan `nivelEnFicha`. Es la misma duplicación del hallazgo 17: dos caminos para decidir si un posteo "toca" un lugar.

---

## 4. Tamaño y estructura

### 20. Funciones más grandes (medidas con `grab()` del repo; 771 funciones medidas, 9 de más de 100 líneas, 3 de más de 200)

| Líneas | Función | Línea |
|---|---|---|
| 890 | `crearSupabaseStore` | 7316 |
| 219 | `renderFichaLugar` | 18696 |
| 211 | `onAuthChanged` | 7013 |
| 168 | `applyCalendarEventToPosts` | 6581 |
| 135 | `renderReportePeriodo` | 14828 |
| 120 | `renderComposer` | 17845 |
| 117 | `renderProjectPanel` | 9434 |
| 114 | `applyStaticI18n` | 10059 |
| 104 | `renderPostCard` | 14043 |
| 97 | `syncFromCalendar` | 6772 |
| 92 | `renderAuthGate` | 10582 |
| 87 | `doRender` | 10487 |
| 83 | `renderCalendarioView` | 16706 |
| 80 | `renderMentionsMenuItems` | 10406 |
| 79 | `renderPaisesView` | 15242 |

Aparte, el objeto `CLICK_ACTIONS` (19889–21394) ocupa 1.500 líneas con 265 handlers adentro de un solo listener: no es una función, pero es el bloque más largo del archivo. `crearSupabaseStore` es un módulo entero (store + realtime + firmas + caché) metido en una closure; es el candidato natural a archivo aparte si alguna vez se parte el `index.html`.

### 21. Re-render total

- `render()` (9855) → `doRender()` (10487) → `viewRoot.innerHTML = html` (10528, 10539, 10558): **toda** la vista se reconstruye en cada uno de los 376 `render()` del archivo (un checkbox del composer en 21610, un chip de filtro, un like, un aviso de realtime).
- Lo que lo hace tolerable, y está bien hecho: `scheduleRender()` junta ráfagas en un frame (9884); el foco, la selección y el anillo se restauran a mano (9856–9876); los popups abiertos se re-sincronizan (`syncDateFieldOpenState`, `syncOccPopState`, `syncRecurPopState`); el scroll del calendario se guarda en `calGridScroll/X` (12834, afterRenderView); los campos de texto del composer **no** re-renderizan al tipear (21458–21464 solo escriben el borrador, y `cContent` renderiza únicamente si cambió la consulta de @mención; la búsqueda se debounce 150 ms, 21430).
- Los modales (`renderComposer`, `renderEventCard`, `renderUserProfile`, `renderLikes`, `renderFichaPost`) se vuelven a pintar al final de cada `doRender` (10570–10574) aunque no haya cambiado nada de ellos.
- Costo real: `IntersectionObserver` del "ver más" se destruye y recrea en cada render (12773–12780); el mapa Leaflet se preserva (`initOrUpdateMap`); el scroll de la ventana lo preserva el navegador porque el alto no cambia.

No hace falta un framework, pero si se quiere aliviar: (a) que el handler de `change`/`click` que solo toca el borrador del composer llame a `renderComposer()` y no a `render()`; (b) un `renderPostCard` por tarjeta con `replaceWith` para likes/comentarios (hoy un like re-arma el Feed completo, 14043).

---

## Lo que convendría hacer primero

1. Bugs 1–5: un helper `isoLocalDe(ms)`/`mesLocalDe(ms)` y reemplazar los 7 `toISOString().slice(…)` sobre timestamps (media hora, con prueba en `pruebas/` que fije `TZ=Asia/Jerusalem` y `TZ=America/Argentina/Buenos_Aires` y chequee "Hoy").
2. Accesibilidad 7, 10, 11: cambio de color de `--text-muted`, `aria-label` en los 6 "✕", y `<button>` en lugar de `<span class="chip-toggle">`.
3. Limpieza 12–15: borrar 6 funciones, 6 ramas, 38 clases y las 5 reglas pisadas (`./pruebas/correr.sh` cubre que no se rompa nada).
4. Refactor 17–18 cuando se toque la ficha o el Feed: un solo tipo `Lugar` y una sola rama de fechas.
