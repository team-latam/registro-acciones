# Auditoría de seguridad — cliente (`index.html`) y workflows

**Fecha:** 6/10/2026. **Alcance:** `index.html` (CSS 37-3612, JS módulo 3799-21862; ~41 asignaciones a `innerHTML`, ~1.270 interpolaciones `${}` revisadas con un scanner propio), `.github/workflows/*.yml`, y los datos personales que quedan a la vista en el repo público. El SQL lo revisa otro agente: acá se mira `supabase/02-politicas.sql` solo para confirmar que lo que el cliente esconde está respaldado del lado del servidor.

**Sobre la revisión del 3/10 (docs/REVISION.md):** verificado en el código actual que siguen resueltos los puntos que tocan al cliente: supabase-js fijo en 2.117.2 (5692), firmas con tope de 7 días que se borran al cerrar sesión por cualquier vía (7358, 7054-7058, 8198-8202), `esErrorDePermiso` no confunde `PGRST301`, miniaturas + `loading="lazy"` (4537), paginación. No se repiten acá.

---

## Resumen

| # | Hallazgo | Gravedad | Evidencia |
|---|---|---|---|
| 1 | **XSS almacenado por el `id` de un posteo/comentario**: la base no limita la forma del `id` y el cliente lo pega sin `esc()` en ~70 atributos `data-post-id="${post.id}"` / `data-reply-id="${r.id}"` | **Alta** | `index.html:9255-9260, 13881, 14003-14016, 14239-14241` · `supabase/01-tablas.sql:31,107` · `supabase/03-validacion.sql` (sin check de `id`) |
| 2 | **SheetJS 0.18.5** (visor de planillas): versión con CVEs conocidos (prototype pollution CVE-2023-30533; ReDoS CVE-2024-22363) y `sheet_to_html` vuelca hipervínculos de celda sin sanear en el DOM de la app | **Alta** | `index.html:18126, 18195-18196` |
| 3 | **Visor de Word (docx-preview)** renderiza un `.docx` ajeno directo en el DOM de la app, sin iframe aislado | **Media** | `index.html:18127, 18186` |
| 4 | **Dependencias de CDN sin SRI** (markercluster, supabase-js ESM, JSZip, SheetJS, docx-preview) y **sin CSP** | **Media** | `index.html:11-12, 3798, 5692, 12476, 18126-18127`; no hay `<meta http-equiv="Content-Security-Policy">` |
| 5 | **Origen compartido `team-latam.github.io`**: el token de sesión de Supabase (`localStorage`) y las firmas de adjuntos son legibles por cualquier otro sitio de Pages de la misma cuenta | **Media** | `index.html:5693, 7418-7442` |
| 6 | **Calendar del equipo público + su ID en el repo**: la API key de solo lectura exige que el Calendar sea público; con el ID cualquiera lee los eventos (títulos, lugares, invitados) | **Media** (privacidad) | `index.html:5743-5752` |
| 7 | **Contenido de posteos a MyMemory** (traducción) e **IP a ipify** en cada login: dos terceros sin contrato; la IP del audit_log la declara el cliente | **Media** (privacidad) | `index.html:10196, 6934, 6946-6953` |
| 8 | Workflows **sin bloque `permissions:`** y acciones **sin pin a SHA** | **Baja** | `.github/workflows/*.yml` (los 6) |
| 9 | `photoURL` de la solicitud de acceso es libre (solo `length ≤ 500`): un `<img src>` ajeno = píxel de rastreo de los admins | **Baja** | `index.html:7151, 7229, 4XXX avatarDe` · `supabase/03-validacion.sql:226-248` |
| 10 | **Ícono de tipo de actividad** (admin) sin `esc()` en 4 lugares (la base deja hasta 16 caracteres) | **Baja** | `index.html:10435, 16653, 17087, 19467` |
| 11 | `t()` no escapa variables; sink real: el mensaje de error de Google Calendar va sin `esc()` a `innerHTML` | **Baja** | `index.html:3866-3872, 12343, 12385` |
| 12 | **Inyección de fórmulas en los CSV** que bajan los admins (nombre de Google de cualquier cuenta, títulos) | **Baja** | `index.html:11874, 10948, 14682` |
| 13 | Token de Calendar en `sessionStorage`; scope `calendar.events` abarca todos los calendarios de la persona | **Baja** | `index.html:5755-5775, 5870-5878, 7054-7062` |
| 14 | Datos personales en el repo público: correo real de un buzón del equipo en un comentario; nombres de pila + ciudades por evento en `13-sugerencias-calendar.sql` | **Baja** (privacidad) | `index.html:8488-8489` · `supabase/13-sugerencias-calendar.sql` |
| 15 | `base-de-datos.yml` con `workflow_dispatch` aplica a producción el SQL de **cualquier rama** | **Info** | `.github/workflows/base-de-datos.yml:92-96` |
| 16 | `<iframe id="filePreviewFrame">` sin `sandbox` | **Info** | `index.html:3717, 18163-18166` |

Sin hallazgos: open redirect, `postMessage`, `target="_blank"` sin `noopener`, `javascript:` en links de usuario, `eval`/`new Function`, handlers inline, path traversal en el bucket, SVG como imagen, botones de admin que la base no respalde.

---

## 1. XSS almacenado por el `id` de un posteo o comentario — Alta

**Qué pasa.** El `id` de `posts` y de `replies` es `text primary key` sin restricción de forma: en `supabase/01-tablas.sql:31` (`id text primary key`) y `:107`, y en `supabase/03-validacion.sql` no existe ningún check sobre el `id` de esas tablas (las únicas referencias a `new.id` son las del `audit_log`, líneas 539-540, que sí tiene formato exigido). La política `posts_crear` (`02-politicas.sql:199-209`) solo verifica que `author_email` sea el de la sesión; no mira el `id`. El `id` lo elige el cliente (`index.html:7617`, 20 bytes aleatorios en base36), pero nada del lado del servidor obliga a que tenga esa forma: un integrante aprobado, con su propia sesión y la clave publishable (que es pública), puede escribir una fila por REST con un `id` arbitrario, incluidas comillas y corchetes angulares.

**El sink.** Ese `id` se interpola en decenas de atributos HTML **sin pasar por `esc()`**. Ejemplos (todos con `${post.id}` / `${r.id}` crudos dentro de un atributo con comillas dobles):

- `index.html:9255-9260` — `data-post-id="${post.id}"` en la tarjeta de posteo.
- `index.html:13881, 13889-13890, 13913, 13919, 13928` — el panel de resumen.
- `index.html:14003-14016, 14110-14132` — acciones de la tarjeta.
- `index.html:14239-14241` — `data-post-id="${r.postId}"` y `data-reply-id="${r.id}"` en cada respuesta.

Un `id` que contenga una comilla doble cierra el atributo y permite inyectar atributos nuevos (por ejemplo un manejador de evento, o un `<img>`/`<svg>` con un atributo que dispare al fallar la carga). Como la fila la lee y pinta el navegador de **todos** los integrantes y de los admin, es XSS almacenado que se ejecuta en la sesión de terceros, incluido el admin — es decir, con acceso al token de sesión de Supabase guardado en `localStorage` y a las acciones de administración.

**Nota comparativa.** Donde el `id` va a `data-df-id`, `data-ms-id`, `data-email`, `data-key` el código **sí** usa `CSS.escape()` (p.ej. 8981, 9306, 9849, 14174, 16320) — pero eso protege selectores, no atributos HTML, y de todos modos no se aplica a `post.id`/`r.id`.

**Corrección.** Dos capas, ambas convienen:
1. Cliente: envolver `post.id` y `r.id` con `esc()` en todas las interpolaciones de atributo (igual que ya se hace con `${esc(p.id)}` en varios lugares, p.ej. 10433, 13168, 16653 — el patrón ya existe, falta aplicarlo parejo). Lo más robusto es un helper `attr(id)` y reemplazar en masa.
2. Servidor (pedir al otro agente / el usuario): un check en `posts` y `replies` que exija `id ~ '^[A-Za-z0-9_-]{1,40}$'`, que es la forma que el cliente ya genera. Esto cierra el vector aunque se escape algún sink.

**Probar la regresión:** una fila con `id` que lleve `">` y un atributo, y comprobar en `app_dom_test.mjs` que el DOM renderizado no gana un nodo/atributo nuevo.

---

## 2. SheetJS 0.18.5 en el visor de planillas — Alta

`index.html:18126` carga `xlsx.full.min.js@0.18.5` desde cdnjs, y `:18195-18196` hace `window.XLSX.read(...)` + `XLSX.utils.sheet_to_html(...)` sobre un `.xlsx`/`.ods` subido por cualquier integrante, inyectando el HTML resultante en `filePreviewWord.innerHTML`.

Dos problemas:
- **Versión vulnerable.** 0.18.5 es anterior a los arreglos de prototype pollution (CVE-2023-30533, corregido en 0.19.3) y de ReDoS (CVE-2024-22363). La librería "community" ya no se publica en npm con parches; el proyecto migró a su CDN propio. Un `.xlsx` malicioso subido al Registro lo procesa el navegador de quien lo abra.
- **`sheet_to_html` no sanea para este contexto.** Vuelca el contenido de las celdas y, según la versión/opciones, los hipervínculos de celda, como HTML incrustado en el DOM de la app. No hay `esc()` ni iframe por el medio. Aun sin el CVE, es una superficie de HTML derivado de un archivo de usuario corriendo en el origen de la app.

**Corrección.** Subir SheetJS a ≥ 0.20.x (desde su CDN oficial, con versión fija y a ser posible SRI), y renderizar la tabla dentro de un `<iframe sandbox>` (ver hallazgo 16). Como mínimo, mover el visor a un iframe aislado del origen de la app aunque no se actualice la librería.

---

## 3. Visor de Word (docx-preview) sin aislar — Media

`index.html:18127` carga `docx-preview@0.4.1` y `:18186` hace `window.docx.renderAsync(blob, filePreviewWord, …)` sobre un `.docx` subido por cualquiera, directo en `filePreviewWord`, que es un nodo del documento principal. docx-preview renderiza estilos e hipervínculos del documento; un `.docx` preparado puede traer CSS que se escape del contenedor o enlaces que no se saneen. Vive en el mismo origen que el token de sesión.

**Corrección.** Renderizar dentro de un `<iframe sandbox="allow-same-origin">` dedicado (o directamente aislado), no en el DOM de la app. Mismo iframe que serviría para SheetJS.

---

## 4. Dependencias de CDN sin SRI y sin CSP — Media

Scripts/estilos externos y su estado de `integrity`:

| Recurso | Línea | Versión fija | SRI |
|---|---|---|---|
| leaflet.css / leaflet.js | 10, 3797 | 1.9.4 | **sí** |
| MarkerCluster.css / .Default.css / markercluster.js | 11-12, 3798 | 1.5.3 | **no** |
| Google Fonts (Montserrat) | 9 | — | n/a |
| supabase-js ESM (jsdelivr) | 5692 | 2.117.2 | **no** (import dinámico) |
| GIS (accounts.google.com) | 5794 | — | n/a |
| JSZip (cdnjs) | 12476 | 3.10.1 | **no** |
| SheetJS (cdnjs) | 18126 | 0.18.5 | **no** |
| docx-preview (jsdelivr) | 18127 | 0.4.1 | **no** |

Las versiones están fijas (bien; evita el "último 2.x" que ya mordió con supabase-js, 5684-5692), pero sin `integrity` un CDN comprometido o un recurso repинтroducido con otro contenido entra con el token de sesión y las acciones de admin. Leaflet lo hace bien; el resto no. **No hay CSP** (`<meta http-equiv="Content-Security-Policy">` ausente), que sería la red de contención para los hallazgos 1-3 y para cualquier script inyectado. Tampoco `referrerpolicy` en los links/recursos salientes.

**Corrección.** Agregar `integrity` + `crossorigin="anonymous"` a markercluster, JSZip, SheetJS y docx-preview (hashes de la versión fijada); para supabase-js por `import()` no hay SRI nativo, conviene o bien un `<link rel="modulepreload" integrity>` o servirlo como otros. Agregar una CSP restrictiva (`default-src 'self'`; `script-src` con los CDNs y `'unsafe-inline'` solo si no se puede evitar — hay bastante HTML por `innerHTML`, así que una CSP estricta necesita trabajo, pero vale para el XSS). Como GitHub Pages no manda cabeceras propias, la CSP tiene que ir en `<meta>`.

---

## 5. Origen compartido `team-latam.github.io` — Media

Todas las páginas publicadas en Pages bajo la cuenta `team-latam` comparten el **mismo origen** (`https://team-latam.github.io`). Por eso:
- El token de sesión de Supabase vive en `localStorage` de ese origen (createClient en `5693` usa el almacenamiento por defecto de supabase-js, que es `localStorage` con clave `sb-…-auth-token`).
- Las firmas de adjuntos se guardan en `localStorage` bajo `registro.firmas.v1` (`7418`, `7438`).

Cualquier otro repo de la misma cuenta publicado en Pages (hoy o mañana) corre en ese origen y puede leer ese `localStorage`. El propio código lo reconoce a medias en el comentario de 7414-7416 ("lo comparten todas las páginas de team-latam.github.io"). No es explotable por un extraño, pero sí por cualquiera que pueda publicar una página en esa cuenta, y amplía el daño de un XSS.

**Corrección.** El plan de dominio propio (`docs/DOMINIO.md`) resolvería esto de raíz al dar un origen exclusivo. Mientras tanto: documentar que la cuenta `team-latam` no debe publicar otras Pages, y evaluar `storage` propio por-app para supabase-js (un prefijo exclusivo no aísla el origen, pero al menos evita colisiones). El riesgo real es el origen compartido, no la clave; se cierra con el dominio.

---

## 6. El Calendar del equipo es público y su ID está en el repo — Media (privacidad)

`index.html:5752` lleva una API key de Google ("SOLO para LEER el calendario… Requiere que el calendario esté configurado como público para lectura"), y `5743` el ID del calendario (`ahf2jnkbng1tblmk7uioolc9ko@group.calendar.google.com`). Para que esa lectura sin login funcione, el Calendar de LatAm tiene que estar **público**. Con el ID a la vista en un repo público, cualquiera (sin pasar por la app ni por la aprobación) puede leer todos los eventos del calendario — títulos, lugares, horarios e invitados — por la API pública de Google Calendar. Es exactamente la información que la app protege detrás del login y la aprobación manual.

La API key en sí está bien expuesta (restringida por dominio y a la Calendar API, es lo correcto para una key de navegador); el problema es que su modelo de uso obliga a que el calendario sea público.

**Corrección.** Es la opción 2 del "A decidir con el usuario" de REVISION.md (Calendar desde el servidor con una cuenta de servicio): leer el calendario desde el workflow con credenciales, no desde el navegador con una key que exige calendario público. Mientras siga así, dejarlo explícito con el usuario: cualquiera con el ID lee la agenda del equipo. Es una decisión suya (presentarla con la opción de cuenta de servicio y su costo).

---

## 7. Contenido e IP a terceros — Media (privacidad)

- **Traducción (`index.html:10196`)**: el título y el contenido de un posteo se mandan a `api.mymemory.translated.net` por GET en la URL (`?q=…`) cuando alguien pulsa "Ver traducción". MyMemory es un servicio gratuito que, según sus términos, puede almacenar y reutilizar lo enviado; además queda en los logs de la URL. Puede haber contenido sensible (nombres, lugares, detalles de visitas) de un equipo cuya app es privada a propósito.
- **IP (`index.html:6934`, usada en `6946-6953`)**: en cada login se pide la IP a `api.ipify.org` y se guarda en `audit_log`. Dos cosas: (a) se comparte la IP del equipo con un tercero; (b) como no hay backend, la IP la provee y la escribe el cliente, así que en el registro de auditoría es un dato **declarado por quien hace la acción**, no verificado — un integrante podría escribir cualquier IP. El comentario del código ya asume que la IP sirve poco; conviene que el admin sepa que no es una prueba forense.

**Corrección.** Traducción: avisar en la UI que el texto se manda a un servicio externo, o restringir la función a textos no sensibles, o mover la traducción a un proxy propio. IP: documentar que es orientativa y falsificable; si no aporta, considerar sacarla (el `deviceLabel` local de 6909-6924, que no llama a nadie, ya da la señal útil "¿esto lo hice yo?").

---

## 8. Workflows sin `permissions:` ni pin a SHA — Baja

Ninguno de los 6 workflows declara un bloque `permissions:`, así que heredan el `GITHUB_TOKEN` por defecto del repo (que puede ser de escritura). Las acciones se referencian por tag móvil (`actions/checkout@v4`, `actions/setup-node@v4`), no por SHA.

Riesgo moderado porque: el SQL/secretos de verdad no pasan por el `GITHUB_TOKEN` (van por `SUPABASE_DB_URL`, `RESPALDOS_TOKEN`, etc., 11-13), y los triggers son `push`/`schedule`/`workflow_dispatch`, **no** `pull_request_target` (revisado: no aparece en ninguno), así que no hay ejecución de código de un PR externo con secretos. Aun así:

**Corrección.** Agregar `permissions: contents: read` por defecto a cada workflow (subir a `contents: write` solo donde haga falta; `respaldo.yml` escribe en otro repo con su propio token, así que el `GITHUB_TOKEN` puede quedar en `read`). Pinnear las acciones oficiales a SHA. La interpolación de `${{ }}` ya está bien tratada: en `limpieza.yml` lo que escribe el usuario entra por `env:` y no pegado en el `run` (hay un comentario explícito, 86-89), y los logs de los trabajos evitan a propósito volcar datos (solo cantidades y rutas) — bien hecho.

---

## 9. `photoURL` libre → píxel de rastreo de los admins — Baja

`avatarDe()` (≈4XXX) pinta `<img class="lp-av" src="${esc(u.photoURL)}">`. El `esc()` evita romper el atributo, pero la **URL en sí** es de libre elección: `03-validacion.sql:226-248` solo limita `length(photo_url) ≤ 500`, no el esquema ni el dominio. Al pedir acceso, cualquiera escribe su propia solicitud con `photoURL` apuntando a un servidor suyo (`index.html:7151`, `:7229`). Cuando un admin abre Solicitudes, su navegador pide esa imagen: el que pidió acceso ve la IP del admin, el user-agent y el momento. No es ejecución de código, pero sí fuga de metadata de los admin a un desconocido.

**Corrección.** Validar que `photo_url` sea `https://` de dominios conocidos (googleusercontent, el storage de Supabase), o no renderizar la foto de una solicitud **pendiente** (recién al aprobar). Decisión chica; conviene al menos restringir el dominio en el SQL.

---

## 10. Ícono de tipo de actividad del admin sin `esc()` — Baja

El admin define tipos de actividad con un campo "ícono" de texto libre; la base lo valida solo por largo (`03-validacion.sql:415-416`, hasta 16 caracteres, "string") — no por contenido. En la mayoría de los renders va con `esc()` (`11537`, `11596`, `12105`, `12142`, `17866`, `18763`...), pero en **cuatro** va crudo: `index.html:10435` (`${type.icon}`), `16653`, `17087` (los chips del calendario) y `19467` (autocompletado de lugar, `${it.icon}`). Un admin podría meter HTML ahí. El riesgo es acotado (solo un admin escribe la config, `config_crear`/`config_editar` lo exigen), pero rompe la regla del repo de "todo texto visible pasa por esc()" y un admin comprometido/equivocado lo dispara para todo el equipo.

**Corrección.** Envolver esas cuatro con `esc()`. Coincide con la convención ya documentada en CLAUDE.md.

---

## 11. `t()` no escapa; sink real en el error de Calendar — Baja

`t()` (`3866-3872`) sustituye `{var}` por el valor crudo. La mayoría de las ~240 llamadas con variables usan `esc()` en la variable o van a `textContent`; se revisaron una por una. El sink claro: `index.html:12343` arma `No se pudieron pasar {n} ({m})` con `m:f.fallados[0].motivo`, y ese `motivo` sale de `err.message` de la API de Google (`12385`, `body.error?.message` de la respuesta de Calendar, 5992 etc.). Ese string va a `renderCalendarFaltantes()` que termina en `innerHTML`. Google no suele devolver HTML, así que es de explotación difícil, pero es contenido de un tercero concatenado a HTML sin escapar.

**Corrección.** `esc()` sobre `m`/`reason` donde el mensaje viene de una API externa (12343, y por consistencia los `{msg}` de `renderFatalError`, 5720/7203/8683 — estos van a `setup-banner` con `esc(fatalError)` en 10511, así que ya están cubiertos; el de Calendar no).

---

## 12. Inyección de fórmulas en los CSV — Baja

`csvDelRegistro` (`11874`), `csvDePersonas` (`10948`) y `csvDelReporte` (`14682`) arman CSV citando comillas (`"" `) pero sin neutralizar celdas que empiezan con `=`, `+`, `-`, `@`. Un integrante cuyo nombre de Google o cuyo título de posteo empiece con `=` hace que Excel/Sheets, al abrir el CSV que baja un admin, ejecute una fórmula (DDE/exfiltración clásica). El `name` sale de Google (no del todo libre) pero el **título** de un posteo sí es libre.

**Corrección.** Prefijar con comilla simple (`'`) o con un espacio las celdas que empiecen con `= + - @` antes de citar. Un helper en las tres funciones.

---

## 13. Token de Calendar y scope — Baja

El token OAuth de Calendar se guarda en `sessionStorage` (`5755-5775`, `5870-5878`) — bien, no toca disco y muere con la pestaña. Se limpia en `doSignOut()` (`5725`). Dos matices menores:
- Si la sesión termina desde otra pestaña o por vencimiento (el flujo de `onAuthChanged` → `7054-7062` llama a `olvidarFirmas()` pero no toca `CALENDAR_TOKEN_STORAGE_KEY`), el token de Calendar puede sobrevivir en `sessionStorage` hasta cerrar la pestaña. Vence solo (expiry), así que el impacto es chico.
- El scope pedido es `calendar.events` (`5886`), que da acceso de escritura a **todos** los calendarios de la persona, no solo al compartido — el propio comentario lo señala (5716-5718). Es una limitación de la API de Calendar; vale tenerlo presente.

**Corrección.** En el handler de `onAuthChanged` para `!user`, limpiar también el token de Calendar (`calendarAccessToken=null` y `sessionStorage.removeItem`). El scope es decisión de producto; la alternativa es la cuenta de servicio del hallazgo 6.

---

## 14. Datos personales en el repo público — Baja (privacidad)

El repo es público (lo dice el README y CLAUDE.md). Aparecen:
- **Correo real** de un buzón del equipo en un comentario del código: `index.html:8488-8489` (un correo operativo real, en la línea 8488), usado como ejemplo de "primera palabra de un email". Es un correo operativo real, no un placeholder.
- **Nombres de pila + ciudades por evento** en `supabase/13-sugerencias-calendar.sql`: aunque el archivo dice "a propósito SIN títulos ni fechas" y los IDs de evento son opacos, sí lista nombres de pila y ciudades/países por fila. Cruzado con el calendario público (hallazgo 6) reconstruye quién estuvo en qué.

Los correos de prueba (`laura@x.com`, `ana@x.com` en `pruebas/`) son ficticios, está bien.

**Corrección.** Cambiar el correo real del comentario 8488 por un placeholder (`ejemplo.ciudad@gmail.com`). Para el 13: evaluar con el usuario si los nombres de pila deben estar en un repo público; se podrían anonimizar o mover a un dato no versionado. Es dato personal, así que decisión suya.

---

## 15. `base-de-datos.yml` aplica SQL de cualquier rama con el botón — Info

`.github/workflows/base-de-datos.yml`: el job `aplicar` corre `if: github.event_name != 'pull_request'` (92-96) y `workflow_dispatch` permite elegir cualquier rama. O sea, un `Run workflow` desde una rama arbitraria aplica **ese** SQL a la Supabase de producción (tras pasar las pruebas). Hoy solo quien tiene permiso de Actions puede dispararlo, y las pruebas lo filtran, así que es bajo; pero el modelo mental "solo `main` toca producción" (CLAUDE.md) no se cumple para la base por esta vía.

**Corrección.** Restringir el job `aplicar` a `github.ref == 'refs/heads/main'` además del `event_name`.

---

## 16. `<iframe>` del visor sin `sandbox` — Info

`index.html:3717` declara `<iframe id="filePreviewFrame">` y `18163-18166` le asigna `src = item.dataUrl` para los PDF y archivos que el navegador muestra nativo. Sin `sandbox`, un PDF/HTML servido ahí corre con los permisos de su origen. Como las fuentes son `data:` o URLs firmadas del propio bucket (validadas por `safeFileDataUrl`, 18152 vía `itemDelVisor`), el riesgo es bajo, pero un `sandbox="allow-same-origin allow-scripts"` acotado (o sin `allow-scripts`) es gratis y además sería el contenedor para aislar SheetJS/docx-preview (hallazgos 2-3).

**Corrección.** Agregar `sandbox` al iframe y, de paso, mover los visores de Word/planilla ahí dentro en vez de a `filePreviewWord` del documento principal.

---

## Lo que está bien hecho

- **`esc()` parejo en casi todo** el HTML generado: títulos, contenido (`nl2br`→`esc`, 4484), nombres, nicknames (`ownerChip` 9419), emails, labels de país/ciudad/zona, nombre de archivo, ciudades del admin. La convención de CLAUDE.md se cumple salvo las excepciones de arriba.
- **Links de usuario robustos**: `safeUrl()` (4491) solo deja pasar `http/https/mailto` por `new URL`, y lo que pinta va con `esc()` y `rel="noopener noreferrer"` + `target="_blank"` (13355). No hay forma de colar `javascript:`.
- **Imágenes y adjuntos embebidos**: `safeImageSrc`/`safeFileDataUrl`/`esUrlDelBucket` (4514-4631) exigen `data:` con charset validado o una URL firmada del **propio** proyecto, comparando la URL entera, no "que parezca de Supabase". Sin SVG en la lista de tipos de imagen (4514), así que no hay XSS por SVG.
- **Colores del admin**: `safeColor()` (4631) solo acepta `#rrggbb`; todos los `style="background:${...}"` de zonas/tipos pasan por ahí (verificado en 12923, 15484, 16653, 18712, etc.).
- **Rutas del bucket** las arma el servidor/cliente con `base_${Date.now()}.${ext}` (7536-7546) y la base valida que no salgan de su carpeta (`rutas_ok`); no hay traversal con nombre de archivo del usuario.
- **Autorización respaldada por el servidor** en cada acción sensible — confirmado contra `02-politicas.sql`/`15`/`12`: borrar posteo/comentario solo admin fijo (`posts_borrar`/`replies_borrar` 220-253, cliente `isFixedAdmin()` 20315-20321); aprobar/rechazar/revocar/rol/borrar solicitud/ex-miembro → `es_admin_fijo/es_admin_rol` (265-365); unificar cuentas → `unificar_cuentas` con guarda de admin (`15:45-47`); sacar del Registro → `sacar_del_registro` con guarda (`12:166`); config/tipos/zonas → solo admin (`config_*` 379-395); audit_log select solo admin (411-412), insert acotado por día (`addOnce` 6967, respaldado por `auditoria_una_por_dia`); la firma del autor la fuerza la política (`author_email = mi_correo`). Los botones del cliente son conveniencia, no la barrera.
- **GIS con timeout y caída al popup** (5799-5838), sin quedar trabado; el token no se guarda en disco.
- **Workflows**: entradas de usuario por `env:` y no interpoladas en `run` (limpieza.yml 86-89); `set -o pipefail` donde importa; logs que solo vuelcan cantidades/rutas, nunca títulos ni correos (comentado a propósito en respaldo.yml 15-16); no usan `pull_request_target`.

---

## Prioridad sugerida

1. **#1 (XSS por `id`)** — es el único con impacto alto y explotable por un integrante común; el arreglo de cliente es mecánico y el de servidor es un check de una línea.
2. **#2 / #3 / #16 (visores) y #4 (SRI+CSP)** — juntos: aislar los visores en un iframe `sandbox` y subir SheetJS cierra buena parte, y una CSP respalda todo lo anterior.
3. **#5 / #6 / #7 (privacidad/origen)** — decisiones del usuario (dominio propio, cuenta de servicio de Calendar, aviso de traducción); presentar con opciones.
4. El resto (8-15) son endurecimientos de bajo costo.
