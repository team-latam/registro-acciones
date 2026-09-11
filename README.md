# Registro de Acciones — Team LatAm

Herramienta web de un solo archivo (`index.html`) para llevar la memoria
histórica de las acciones del equipo (rutinas, visitas, cursos, seminarios,
etc.) en cada ciudad/país/región de LatAm. Feed tipo posteo +
hilo de respuestas, vista agregada por país (lista y mapa), y una vista
"Memoria" de lectura cronológica.

No requiere build ni instalación de dependencias: es HTML/CSS/JS plano que
se sirve como archivo estático. La persistencia es compartida entre todo el
equipo vía **Firebase Firestore** (tiempo real, sin exportar/importar nada
a mano).

## 1. Poner en marcha el backend (Firebase)

1. Andá a [console.firebase.google.com](https://console.firebase.google.com)
   y creá un proyecto nuevo (o reutilizá uno existente del equipo).
2. En el proyecto, andá a **Compilación → Firestore Database** y creá una
   base de datos (elegí la región más cercana al equipo; modo "producción").
3. Andá a **Configuración del proyecto** (ícono de tuerca) → pestaña
   **General** → sección **Tus apps** → agregá una app **Web** (ícono `</>`).
   No hace falta Firebase Hosting para este paso, sólo registrar la app.
4. Copiá el objeto `firebaseConfig` que te muestra (algo como esto):
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "tu-proyecto.firebaseapp.com",
     projectId: "tu-proyecto",
     storageBucket: "tu-proyecto.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```
5. Abrí `index.html` en este repo, buscá la constante `FIREBASE_CONFIG`
   (cerca del principio del `<script type="module">`) y reemplazá los
   valores de ejemplo por los tuyos.
6. Publicá las reglas de seguridad: en Firestore Database → pestaña
   **Reglas**, pegá el contenido de [`firestore.rules`](./firestore.rules)
   de este repo y publicá. (Si usás la CLI de Firebase: `firebase deploy
   --only firestore:rules`.)
7. Activá el login con Google: **Compilación → Authentication → Comenzar**
   (o "Sign-in method" si ya la activaste antes) → método **Google** →
   Habilitar → elegí un email de soporte → Guardar.

Sin el paso 5, la app muestra un aviso de "Falta configurar Firebase" y no
guarda nada. Sin el paso 7, cualquiera que inicie sesión se queda trabado
en "Cargando…" porque Firebase rechaza el login.

### Acceso privado (login + aprobación manual)

La app **no es pública**: para entrar hay que iniciar sesión con una cuenta
de Google, y la primera vez que alguien lo hace queda "pendiente de
aprobación" hasta que el administrador lo apruebe desde la propia app
(pestaña **Solicitudes**, visible solo para el admin).

- El único email con permisos de administrador está fijo en dos lugares que
  tienen que coincidir: la constante `ADMIN_EMAIL` en `index.html` y la
  función `isAdmin()` en `firestore.rules`. Hoy es `benny@team-latam.com`.
  Para cambiarlo (o agregar un segundo admin) hay que editar ambos archivos
  y volver a publicar las reglas.
- No hay roles intermedios: todo el que está aprobado ve y carga todo por
  igual — el admin solo se diferencia en que además ve la pestaña
  Solicitudes y puede aprobar/rechazar/revocar accesos.
- El nombre que se muestra en cada posteo/respuesta ya no es un campo de
  texto libre: se toma automáticamente del nombre de la cuenta de Google
  con la que se inició sesión.
- La pestaña Solicitudes tiene dos secciones (ver `renderAccesoView` en
  `index.html`): **Usuarios** (quién tiene acceso *ahora mismo*, sacado en
  vivo de `allowlist` — cada fila muestra email, una categoría de actividad
  de los últimos 3 meses (🟢 Activo/🟡 Ocasional/⚪ Inactivo según cuántos
  posteos cargó, ver `ACTIVITY_TIERS`) y el último login) y **Solicitudes**
  (la cola de pedidos por decidir, con las rechazadas aparte por si hay que
  revertir alguna).
- Compartir el Calendar (ACL `calendars.acl.insert`) no da acceso
  automático: Google le manda a esa persona un mail de invitación que
  tiene que aceptar a mano ("Unirse al calendario compartido"). Por eso el
  estado en Usuarios dice "✅ Invitación enviada" (no "Calendar" a secas —
  sería falso prometer que ya lo tiene activo) y al lado hay un botón
  "Reenviar invitación" (`resendCalendarInvite()`: saca el ACL y lo vuelve
  a insertar, porque Google no manda un mail nuevo si el ACL ya existía).
  Cada compartir/reenvío guarda `calendarInviteSentAt` en el `allowlist` de
  esa persona. Con eso, la próxima vez que esa persona entre a la app le
  aparece un popup recordándole revisar el correo y aceptar la invitación,
  más una novedad extra en la campanita de notificaciones — todo llevado
  con marcas de "visto" en `localStorage` (igual que las @menciones, ver
  `MENTIONS_SEEN_KEY`), porque un usuario normal no puede escribir en su
  propio doc de `allowlist` para guardarlo del lado del servidor.
  OJO: son DOS marcas separadas, no una — cerrar el popup con "Entendido"
  (`markCalendarInvitePopupSeen()`) solo evita que se imponga de nuevo en
  cada entrada, pero NO apaga la novedad de la campanita: como el ACL de
  Calendar no avisa cuándo la persona acepta de verdad, ese recordatorio
  se queda ahí hasta que la persona lo apague a mano con "Ya la acepté"
  (`markCalendarInviteBellDismissed()`, ver `hasActiveCalendarInviteNotice`)
  — antes las dos cosas compartían una sola marca y cerrar el popup
  apagaba también la campanita sin que la persona hubiera aceptado nada.
- Revocar acceso (botón "Revocar" en Usuarios) borra a esa persona de la
  lista de aprobados — dejará de poder leer y cargar, pero **no borra** lo
  que ya haya publicado (la memoria histórica queda intacta). También
  marca su solicitud original como rechazada, así si vuelve a intentar
  entrar le aparece la pantalla de "acceso no aprobado" con un "Pedir
  acceso de nuevo" que funciona de verdad (antes de este cambio, quedaba
  en un limbo: ni aparecía de nuevo en la cola de Solicitudes ni el admin
  se enteraba).
- El `firebaseConfig` (`apiKey`, `projectId`, etc.) sigue sin ser secreto —
  eso es así por diseño en cualquier app web de Firebase — pero ya no
  alcanza por sí solo para entrar: hace falta estar en la lista de
  aprobados. Igualmente, si el repositorio es público, cualquiera puede ver
  ese dato (y el código en general); si prefieren ocultarlo también,
  pueden poner el repo en privado desde Settings → General → Danger Zone
  → Change visibility en GitHub.

## 2. Publicar el archivo

Es un archivo estático, así que sirve cualquier hosting simple:

- **GitHub Pages**: Settings → Pages → Deploy from branch → elegir la rama
  y la raíz (`/`). Importante: **tiene que servirse por HTTP(S)**, no abrirse
  como `file://` local, porque usa módulos ES (`<script type="module">`) que
  el navegador bloquea en local por CORS.
- **Firebase Hosting**: `firebase init hosting` (elegir esta carpeta como
  público) y `firebase deploy --only hosting`. Cómodo porque ya tenés el
  proyecto de Firebase creado.
- Cualquier otro hosting estático (Netlify, Vercel, un servidor propio, etc.)
  también funciona — es un único `index.html` sin build step.

## 3. Cómo está armado (por si hay que tocarlo)

### Modelo de datos (Firestore)

```
posts/{postId}
  title: string              (título corto, ej: "Curso de Transition")
  content: string            (comentarios / descripción libre)
  date: "YYYY-MM-DD"         (= startDate; se mantiene por compatibilidad con posteos viejos y con el orderBy de Firestore)
  startDate: "YYYY-MM-DD"
  endDate: "YYYY-MM-DD"      (= startDate si el evento dura un solo día)
  startTime: "HH:MM"         (opcional — vacío/ausente = "todo el día"; si se carga, endTime también)
  endTime: "HH:MM"           (opcional — tiene que ser posterior a startTime cuando startDate == endDate)
  organizer: string          (legado — texto libre de "quién organiza", solo en posteos viejos; los nuevos usan `participants`)
  participants: [{ email, name }, ...]  (opcional, máx. 10 — participantes taggeados: gente del roster o un email suelto de
                             alguien externo. Se suman como invitados de verdad al evento de Calendar, ver `attendees` más abajo)
  location: string           (opcional — lugar/salón/dirección concreta)
  activityType: "rutina" | "visita" | "curso" | "seminario" | "congreso" | "virtual" | "otro"
  authorName: string         (nombre de Google de quien publicó)
  authorEmail: string        (email de Google de quien publicó)
  scopes: [{ type:"ciudad", country, city } | { type:"pais", country } | { type:"region", region:"sur"|"central"|"norte" } | { type:"todo" }, ...]
                             (Evento: mínimo 1. Rutina: opcional, se agrega con el buscador de lugar del composer)
  images: ["data:image/jpeg;base64,...", ...]   (comprimidas en el navegador)
  files: [{ name, mime, kind:"pdf"|"audio", dataUrl }, ...]  (opcional — PDF/audio chicos, sin comprimir, máx. 2)
  links: [{ label, url }, ...]
  mentions: [string, ...]    (opcional — emails de a quién se etiquetó con @ en el texto)
  createdAt: Timestamp (servidor, nunca cambia)
  calendarEventId: string | null   (id del evento en Calendar, para poder actualizarlo/borrarlo en vez de duplicarlo)
  cancelled: bool                  (opcional — true si se canceló el evento)
  lastEditedAt: Timestamp          (opcional — última edición)
  lastEditedBy: string             (opcional — nombre de quien hizo la última edición)

posts/{postId}/replies/{replyId}
  content: string
  authorName: string
  authorEmail: string
  scopes: [...]              (alcance adicional opcional, mismo formato)
  images: [...]
  files: [...]               (mismo formato que en posts)
  links: [...]
  mentions: [...]            (mismo formato que en posts)
  createdAt: Timestamp (servidor)
  system: bool               (opcional — true en las respuestas automáticas de edición/cancelación)
  icon: string                (opcional — emoji que acompaña una respuesta de sistema, ej. "✏️")
  replyToId: string | null    (opcional — id de OTRA respuesta del mismo posteo a la que le contesta; un solo nivel de anidamiento)
  likedBy: [string, ...]      (opcional — emails de quienes le dieron "me gusta"; único campo editable después de creada)

allowlist/{email}            (el documento EXISTE = esa persona tiene acceso)
  email, name, nickname, approvedAt, approvedBy
                             (name/nickname: nombre de Google y @nickname corto armado al aprobar,
                             para el autocompletado de @menciones — accesos aprobados de antes de
                             que existiera este campo no lo tienen, y se les arma un nickname de
                             reserva a partir del email solo para mostrar, sin guardarlo.
                             CADA PERSONA puede cambiar SU PROPIO nickname más adelante, desde el
                             menú del avatar ("✏️ Editar tu @nickname" en renderUserBadge) — es la
                             única excepción a "solo el admin escribe en allowlist": firestore.rules
                             deja que el dueño del doc toque nada más que el campo nickname, y
                             encima solo con forma válida (isValidNicknameEdit: 2-20 caracteres,
                             letras/números ASCII/guion bajo, sin espacios ni "@"). Unicidad y la
                             palabra reservada "all" se controlan en el cliente antes de escribir
                             — ver validateNicknameDraft() — porque las reglas no comparan bien
                             contra el resto de la colección)
  calendarShared: bool       (opcional — si ya se le compartió el Calendar de LatAm; lo pone en
                             true shareCalendarWith() al compartir con éxito, para mostrar un ✅
                             real en Usuarios en vez de ofrecer siempre a ciegas el mismo botón.
                             OJO: significa "se le mandó la invitación", no "ya la aceptó" — el
                             ACL de Calendar no tiene un campo de estado de aceptación)
  calendarInviteSentAt: Timestamp (servidor)
                             (opcional — cuándo se compartió/reenvió el Calendar por última vez;
                             lo pisa shareCalendarWith() en cada compartir o reenvío. Sirve para el
                             popup + novedad de campanita que le recuerda a esa persona aceptar la
                             invitación la próxima vez que entre, ver maybeShowCalendarInviteOverlay()
                             / shouldShowCalendarInvitePopup() y hasActiveCalendarInviteNotice())

accessRequests/{email}       (una solicitud de acceso por persona; el id es su propio email)
  email, name, photoURL, status: "pending"|"approved"|"rejected", requestedAt
```

### Editar y cancelar posteos

Los posteos ya NO son estrictamente append-only (cambio deliberado sobre
el diseño original): se pueden editar, con estas reglas de permiso
(en `canEditPost()` de `index.html` y `canEditPost()` de `firestore.rules`
— tienen que decir lo mismo):

- El **autor** siempre puede editar su propio posteo.
- Cualquier persona aprobada puede editar un posteo que **no** sea Rutina
  (Visita/Curso/Seminario/Congreso/Otro) — son eventos del equipo, no una
  entrada personal, así que cualquiera puede corregir una fecha o un lugar.
- Una **Rutina** solo la edita quien la publicó.
- Nunca se puede editar de quién es (`authorName`/`authorEmail`) ni cuándo
  se creó originalmente (`createdAt`) — eso lo protegen las reglas.

Cada edición dispara automáticamente una respuesta en el hilo resumiendo
qué cambió (título, fechas, lugar, participantes, tipo, comentarios o
alcance), firmada por quien editó — así la memoria histórica conserva el
rastro del cambio. Esas respuestas se distinguen con un ícono (✏️ edición,
🚫 cancelación) y fondo distinto, pero por lo demás se ven como cualquier
respuesta del hilo.

**Cancelar** (botón aparte de "Editar", mismos permisos) no borra el
posteo: lo marca visiblemente como "🚫 Cancelado" en el Feed/Memoria,
dispara la respuesta automática, y borra el evento correspondiente del
Calendar compartido (si lo tenía).

Si el posteo sincroniza con Calendar, editar sus fechas/título/lugar
**actualiza el mismo evento** (usando el `calendarEventId` guardado al
crearlo) en vez de crear uno duplicado; si el tipo de actividad cambia a
Rutina, el evento se borra del Calendar; si pasa de Rutina a un tipo que
sincroniza, se crea recién en ese momento.

### Rutina: composer liviano estilo "¿Qué está pasando?"

Aparte del modal grande de Evento (Visita/Curso/Seminario/Congreso/Virtual/
Otro), hay una barra fija arriba del Feed —inspirada en el compositor de
X— para cargar una **Rutina**: solo pide texto; título y fechas se
completan solos del lado del cliente (`submitRutina()` en `index.html`) y
no se muestran en la tarjeta para no repetir el contenido dos veces.
Rutina y Evento comparten el mismo `posts/{postId}`, así que aparecen
mezclados en el mismo Feed — se distinguen por el badge de tipo
("🔁 Rutina"). A diferencia de Evento, el alcance (lugar) es **opcional**
en Rutina, y no sincroniza con Calendar.

El buscador de lugar del composer de Rutina (📍, en forma de chip) es un
autocompletar simple sobre `PLACE_INDEX` — un índice plano armado una sola
vez con "Toda LatAm", cada región, cada país y cada ciudad de
`CITY_PRESETS` — y agrega el mismo objeto `scope` que ya usa Evento/
respuestas, solo que sin el selector paso a paso.

### Adjuntos: imágenes, PDF/audio chicos, y links

- **Imágenes**: se comprimen en el navegador (JPEG, máx. 1280px de lado),
  hasta 6 por posteo/respuesta.
- **PDF y audio**: se adjuntan de verdad (embebidos como `data:` URL en el
  documento, igual que las imágenes) pero SIN comprimir, así que hay un
  tope de tamaño chico por archivo (`MAX_ATTACHMENT_FILE_BYTES`, 150KB) y
  de cantidad (`MAX_ATTACHMENT_FILES`, 2) — Firestore permite ~1MB por
  documento entero y el base64 pesa ~33% más que el archivo original, hay
  que dejar margen para el resto del posteo. Pasarse del tamaño muestra un
  aviso pidiendo usar un link en su lugar.
- **Video**: siempre por link (Drive, YouTube, etc.) — casi nunca entra
  comprimido bajo el límite de 1MB de Firestore, así que no vale la pena
  tratar de embeberlo como a las imágenes/PDF/audio.
- No hay Firebase Storage ni plan pago (Blaze) en este proyecto — decisión
  deliberada para mantenerlo gratis; todo lo que no entra chico va por
  link.

### @Menciones

Escribir `@` en cualquier comentario/respuesta (Evento, Rutina, respuesta
o respuesta anidada) despliega un autocompletar sobre `state.roster` (la
lista de aprobados, con su `nickname`) — al elegir uno, se inserta
"@Nickname " en el texto y se guarda su email en el array `mentions` del
posteo/respuesta.

No hay notificaciones push ni email (eso requeriría Cloud Functions y
pasar a plan pago Blaze, que este proyecto evita a propósito): en su
lugar, el avatar del header muestra un punto rojo con la cantidad de
menciones nuevas (`getUnseenMentionCount()`), calculada comparando la
fecha de creación contra la última vez que la persona abrió el menú del
avatar (`localStorage`, por dispositivo — no sincroniza entre aparatos).
Abrir el menú marca todo como visto.

Como cualquier aprobado necesita ver nombres/nicknames del resto del
equipo para poder etiquetarlos, `allowlist` (antes solo legible por el
admin en su totalidad) ahora permite `list` a cualquier aprobado — cada
documento solo tiene email/nombre/nickname/fecha de aprobación, nada
sensible. El `nickname` se arma una sola vez al aprobar a alguien
(`makeNickname()`, primer nombre de Google, con desempate si ya existe
otro con el mismo) y queda guardado en su documento de `allowlist`.

### Preferencias (panel admin)

Pestaña **Preferencias** (solo admin), con una sub-navegación de 5
secciones para las cosas que antes solo se podían cambiar editando
código. Todas se guardan en Firestore (`meta/territoryConfig` para
Zonas, `meta/preferences` — un campo por sección, con `merge:true` — para
el resto) y se leen para **todos los aprobados** apenas inician sesión
(no solo el admin), porque afectan lo que ve todo el mundo: colores del
mapa, tipos de actividad disponibles, sugerencias del buscador de lugar,
a qué Calendar se sincroniza, límites de adjuntos.

- **Zonas** — a qué zona pertenece cada país (ej. Paraguay de Sur a
  Central) y el nombre/color de cada zona, incluso sumar una zona nueva
  (ej. "Caribe"). Los defaults hardcodeados con los que arranca la app:
  **Sur** (azul: Argentina, Chile, Uruguay, Paraguay), **Central**
  (amarillo: Brasil), **Norte** (verde: el resto — lista completa en la
  constante `COUNTRIES`). Cambiar una zona se aplica al toque a todo lo
  ya cargado, porque la zona de un alcance se calcula siempre a partir
  del país (o del campo `region` si el alcance es "región completa"),
  nunca se guarda dentro del posteo. El territorio en sí (los países y
  sus coordenadas) no se edita desde acá, sigue siendo la constante
  `COUNTRIES` en el código. El cuarto tipo de alcance, **"Toda LatAm"**
  (`{type:"todo"}`), afecta a todas las zonas y países al mismo tiempo.
- **Tipos de actividad** — renombrar/cambiar el ícono de un tipo de
  Evento existente, agregar uno nuevo, o borrar uno que no tenga
  posteos cargados (Rutina queda afuera, tiene su propio composer y
  nunca se edita acá). También si un tipo se sincroniza solo con el
  Calendar compartido o no.
- **Lugares** — ciudades que el equipo fue escribiendo a mano en el
  buscador de lugar (cuando no encuentra una ciudad, ofrece sumarla
  como lugar nuevo escribiendo "Ciudad, País") y todavía no están en la
  lista oficial `CITY_PRESETS`; se pueden sumar ahí para que aparezcan
  como sugerencia para todo el mundo en vez de que cada uno la
  reescriba de cero.
- **Calendar** — a qué calendario de Google (`CALENDAR_ID`) se
  sincronizan los Eventos. Cambiarlo no mueve lo que ya está en el
  calendario viejo, solo afecta a los nuevos/editados de ahí en más.
- **Adjuntos** — límites de cantidad/tamaño de archivos que se pueden
  adjuntar a un posteo. Son topes *ajustables hacia abajo* de los topes
  duros del código (6 imágenes, 2 archivos), que además exige
  Firestore — no se pueden agrandar más allá de eso desde acá.

### Ciudades sugeridas (`CITY_PRESETS`)

Al elegir "Ciudad específica" con un país que tiene ciudades conocidas, el
selector ofrece una lista en vez de texto libre (con opción "Otra ciudad
(escribir)…" para sumar una que no esté). Esa lista sale del directorio de
instituciones de **Directorio Chabad LatAm** (city + coordenadas reales),
para evitar variantes tipo "Buenos Aires" / "CABA" / "Bs As" que romperían
los conteos agregados por lugar. Países sin presencia institucional
conocida (o países nuevos para el equipo) siguen aceptando cualquier ciudad
como texto libre. Si suman presencia en un país nuevo, se puede ampliar
`CITY_PRESETS` en `index.html` a mano.

### Agregación "país afectado por una respuesta"

Cuando una respuesta suma un alcance adicional (por ejemplo, un curso en
Buenos Aires donde alguien responde que también vino gente de Montevideo),
ese alcance se lee tanto en los filtros de Feed/Memoria como en los conteos
de la vista Países — aunque el posteo original "viva" en otro lugar. Ver
`getVisiblePosts()` y `computePlaceCounts()` en `index.html`.

### Por qué el mapa no usa imágenes satelitales "pesadas"

La vista Mapa usa Leaflet + capas de OpenStreetMap reales (no es un mapa
esquemático), pero los círculos se ubican en la **capital** de cada país
(no hay geocoding de ciudades exactas sin un servicio externo de geocoding,
que no está configurado). El detalle por ciudad se ve en la vista
Países → Lista, al hacer click en un país.

### Sincronización con Google Calendar (Feed ↔ Calendar)

Cada posteo de tipo Visita/Curso/Seminario/Congreso/Virtual/Otro (todo menos
**Rutina**) se suma automáticamente como evento de día completo al
calendario compartido de LatAm — el ID vive en la constante `CALENDAR_ID`
de `index.html`. No hay backend propio: se usa el token de Google de
quien publica para crear el evento.

- **Compartir el calendario es automático**: cuando el admin aprueba a
  alguien en la pestaña Solicitudes, la app usa el propio permiso del
  admin sobre el calendario para agregar a esa persona con acceso de
  edición — nadie tiene que ir a la configuración de Google Calendar a
  mano. Al revocar a alguien pasa lo mismo al revés: se lo saca del
  calendario en el mismo paso.
- **Esto requiere que `ADMIN_EMAIL` sea el DUEÑO del calendario "LatAm"**
  (no alcanza con tener permiso de edición) — Google solo deja
  administrar quién tiene acceso a alguien con ese nivel. Si al aprobar
  aparece un aviso de que no se pudo compartir el Calendar, lo más
  probable es que el admin no sea el dueño; en ese caso hay que
  transferirle la propiedad del calendario desde Google Calendar
  (Configuración del calendario → "Transferir la propiedad"), o compartir
  a esa persona a mano como respaldo.
- La primera vez que el admin aprueba o revoca a alguien, Google puede
  pedir un login extra (para el permiso de administrar quién tiene acceso
  al calendario) — es normal, solo pasa una vez por sesión.
- Al iniciar sesión con Google, la app pide también el permiso de
  `calendar.events` (además del básico de perfil/email). Google puede
  mostrar la pantalla **"Google no verificó esta app"** al pedir ese
  permiso — es normal en apps internas chicas que no pasaron la revisión
  formal de Google; para seguir hay que tocar **Avanzado → Ir a
  [nombre del proyecto] (no seguro)**. No es un error ni un problema de
  seguridad real: solo significa que Google todavía no revisó
  manualmente esta app (revisión pensada para apps públicas masivas).
- El token de Calendar (el que se usa para **escribir** — crear/editar/
  cancelar) dura ~1 hora, y se guarda en `sessionStorage` para sobrevivir
  a recargar la página dentro de la misma pestaña (se pierde si se cierra
  la pestaña, si vence, o al cerrar sesión). Si hace falta y no hay uno
  vigente, la app vuelve a pedir el login de Google automáticamente antes
  de escribir en Calendar — normalmente un click rápido, no un login
  completo de nuevo. (Se probó renovarlo en segundo plano con Google
  Identity Services antes de este popup, para evitar interrumpir — se
  sacó porque requiere agregar a mano el origen de esta página a
  "Authorized JavaScript origins" del Client ID en Google Cloud Console,
  y sin eso el intento silencioso queda trabado mostrando una pantalla de
  error de Google en vez de resolverse solo. Mejor un popup confiable que
  uno silencioso que a veces se rompe.) La **lectura** (sincronizar
  Calendar → Feed) no usa este token — ver más abajo.
- Si falla la sincronización (permiso denegado, sin conexión, etc.) el
  posteo **igual se guarda** en el Feed — el Calendar es un agregado, nunca
  bloquea la memoria histórica. Aparece un aviso abajo del header avisando
  si se pudo sumar o no.
- La descripción del evento arranca con la línea `Alcance: tipo | valor`.
- Los **participantes** taggeados en el posteo (campo 👥 del composer) se
  mandan como `attendees` del evento de Calendar, con `sendUpdates=all` —
  Google les manda la invitación por mail de verdad, no es solo texto en la
  descripción. No hace falta ningún permiso extra de Google para esto: ya
  alcanza con el scope `calendar.events` de más arriba.

#### Calendar → Feed (la dirección inversa)

Si alguien edita, cancela/borra o crea un evento **directamente en Google
Calendar**, sin pasar por la app, eso también se refleja en los posteos:

- **Edición** (cambia fecha o lugar de un evento ya vinculado a un
  posteo): se actualiza el posteo y queda una respuesta automática en el
  hilo, igual que si lo hubiera editado una persona.
- **Cancelación/borrado** de un evento vinculado: el posteo queda marcado
  como cancelado (no se borra), con su respuesta automática en el hilo.
- **Creación** de un evento nuevo en Calendar que no vino de la app: se
  crea un posteo simple a partir de él (título, fechas, lugar, quién
  organiza si Calendar lo tiene) con tipo **"Otro"** y **sin alcance
  definido** por default (no se le asume "Toda LatAm" para no sumarlo a
  los 32 países en los conteos de Países/Mapa antes de tiempo) —
  cualquier persona aprobada puede después editarlo desde la app para
  afinar el tipo real de actividad y el alcance correcto.

Cómo funciona, en criollo: la app le pregunta a Google "¿qué cambió desde
la última vez?" (usando un "sync token" que Calendar entrega y que se
guarda en el documento `meta/calendarSync` de Firestore) en vez de releer
todo el calendario cada vez. Esta lectura usa una **clave de API de
Google Cloud** (constante `CALENDAR_API_KEY` en `index.html`), no el
login de la persona — así nunca aparece un popup de Google solo por
mirar si cambió algo. Eso sí, tiene una condición: el calendario "LatAm"
tiene que estar configurado como **público para lectura**:

1. Google Calendar → configuración del calendario "LatAm" → "Acceso de
   disponibilidad" → tildar **"Hacer disponible al público"** (alcanza
   con "Ver solo la disponibilidad (ocultar detalles)" desactivado, o sea
   que se vean los detalles, no solo si está libre/ocupado).
2. Google Cloud Console → el mismo proyecto de Firebase → "Credenciales"
   → "Crear credenciales" → "Clave de API".
3. Restringirla (recomendado): "Restricciones de API" → solo **Calendar
   API**; "Restricciones de aplicación" → "Referentes HTTP" → agregar
   `https://team-latam.github.io/*`.
4. Pegar esa clave en `CALENDAR_API_KEY` en `index.html` y volver a
   publicar.

**Trade-off a tener en cuenta**: con esto, cualquiera que tenga el ID del
calendario (visible en el código fuente, que es público en GitHub) y una
clave de API propia podría leer los eventos de "LatAm" sin ser parte del
equipo ni loguearse en la app — es el precio de sacar el popup para la
lectura. Los datos de la app (Firestore: posteos, hilos, quién tiene
acceso) siguen 100% privados, esto solo afecta al Calendar de Google en
sí. **Escribir** en Calendar (crear/editar/cancelar desde la app) sigue
requiriendo el login de la persona que lo hace, igual que siempre.

No hay servidor propio corriendo esto todo el tiempo — se dispara solo
mientras alguien aprobado tiene la app abierta en el navegador: apenas
carga (una vez) y después sola cada **30 segundos** mientras la pestaña
siga abierta, además de a mano con el botón **"🔄 Actualizar desde
Calendar"** (por si alguien quiere forzar un chequeo ya mismo, o nadie
tiene la app abierta en ese momento). Es decir: sigue sin ser en tiempo
real al segundo — si nadie tiene la app abierta, un cambio hecho en
Calendar recién se refleja cuando alguien la vuelve a abrir. Si más
adelante hace falta que sea instantáneo incluso con la app cerrada, la
alternativa es un webhook de Calendar corriendo en una Cloud Function
propia (requiere plan de pago Blaze de Firebase y más piezas de
infraestructura) — se dejó afuera a propósito por ahora, para no sumar
esa complejidad sin necesidad.

Los eventos recurrentes de Calendar no se "expanden" en instancias
individuales (para no generar un aluvión de posteos por cada repetición):
una serie recurrente cuenta como un solo evento. No debería ser un
problema real, ya que cada acción del equipo tiene sus propias fechas.

### Actividad (solo admin)

Pestaña "Actividad", visible solo para `ADMIN_EMAIL`: un registro de
eventos de **acceso y administración** (colección `auditLog`), no del
contenido de los posteos. Como el login es 100% con cuenta de Google, no
existe "cambio de contraseña" que registrar; en su lugar queda
constancia de:

- Inicio de sesión (una vez por sesión de navegador, no en cada recarga).
- Pedido de acceso (primera vez, o "pedir de nuevo" tras un rechazo).
- Aprobar / rechazar / revocar acceso.
- Compartir / sacar a alguien del Calendar compartido.

Cualquier persona logueada puede **crear** una entrada, pero solo sobre
sí misma como actor (así queda registro del login incluso de alguien que
todavía no está aprobado); **leer** el registro es exclusivo del admin.

### Modo claro / oscuro

Toda la paleta vive en variables CSS en `:root` (claro, el default) y el
bloque `html[data-theme="dark"]` las redefine. **Cualquier color nuevo
tiene que salir de una variable**, no hardcodeado: si no, se va a quedar
clavado en su tono claro cuando la página pase a oscuro.

Dos roles que parecen el mismo color pero no lo son, y por eso tienen
variables separadas:

- `--petroleo` / `--petroleo-dark`: el petroleo como **fondo** (header,
  botones primarios, badges). En oscuro se aclara un poco, porque el tono
  original quedaba indistinguible del fondo de la página.
- `--ink` / `--ink-strong`: el mismo petroleo pero como **color de
  texto** (títulos, nombres de autor, números). En oscuro va para el lado
  contrario: pasa a ser un tono claro.

La elección se guarda en `localStorage` (`ra_theme`), es decir **por
dispositivo y no por cuenta**: la misma persona puede querer oscuro en el
celular de noche y claro en la compu. Se aplica desde un `<script>`
suelto en el `<head>`, antes del CSS, a propósito: el script del módulo
corre recién después de pintar la página, así que si se aplicara desde
ahí se vería un destello blanco en cada carga.

El mapa de la vista Países sigue con las imágenes claras de OpenStreetMap
en los dos modos (es lo que hacen casi todas las apps, y las alternativas
oscuras de OSM son de menor calidad).

### Tutorial de bienvenida

Un recorrido de tres paradas (`TOUR_STEPS`) que **señala las partes
reales de la pantalla** — el composer de Rutina ("¿Qué hiciste hoy?"),
el botón de eventos, las pestañas — con el resto atenuado, en vez de
explicar la app en abstracto desde un cartel centrado. Los textos son
cortos y concretos a propósito: que la persona sepa qué es cada cosa y
salga a probarla, no leer un manual (para eso está este README).

**Solo lo ven las cuentas nuevas, una vez**: la primera vez que entra
alguien aprobado a partir de `TOUR_ELIGIBLE_FROM` (11/9/2026). Quien ya
venía usando la app no lo ve nunca. Se usa la fecha de aprobación porque
es el único dato propio que una cuenta común puede leer para saber si es
nueva — los logins están en Actividad (`auditLog`), que solo lee el
admin. Después queda a mano para cualquiera en el menú del avatar
("❔ Cómo funciona").

Como la primera parada es el composer de Rutina, que solo existe en el
Feed, `openTour()` lleva primero a esa pestaña, y `maybeShowTour()` se
llama al final de `doRender()`, con la vista ya dibujada (si corriera
antes, el composer todavía no estaría en el DOM y esa parada se
saltearía sola).

Cómo está hecho (`renderTourStep`): el elemento señalado no se recorta ni
se mueve, se lo ilumina con una sombra gigante alrededor
(`box-shadow: 0 0 0 9999px`) sobre un recuadro posicionado encima con
`getBoundingClientRect()`. La capa entera come los clics, así que
mientras el recorrido está abierto no se toca la app por atrás. Si un
objetivo no está en pantalla, esa parada se saltea sola en vez de dibujar
un globo apuntando a la nada. Los tres objetivos viven en el header, que
es `sticky`, por eso no hace falta seguir el scroll (sí se reposiciona al
cambiar el tamaño de la ventana).

Que ya se vio se marca **por cuenta, no por dispositivo**: en el campo
`tourSeenAt` del documento de `allowlist`, así una cuenta nueva lo ve la
primera vez que entra y no le reaparece aunque después cambie de máquina.
Eso necesita la regla `isValidTourSeenEdit` en `firestore.rules` (cada
persona puede escribir SOLO ese campo, y solo con la hora del servidor).
Si esa escritura falla — típicamente porque las reglas todavía no se
publicaron en Firebase — cae a `localStorage` (`ra_tour_seen`) para no
quedar mostrándolo en bucle en cada carga.

Tiene prioridad sobre el aviso del Calendar compartido: mientras el
recorrido está abierto ese popup no aparece, y se muestra recién cuando
se cierra.

## 4. Qué falta / decisiones pendientes

- **Roles**: hoy todo aprobado tiene los mismos permisos (leer + publicar).
  Si más adelante hace falta un rol intermedio (por ejemplo, alguien que
  solo lee), hay que sumarlo a mano en `firestore.rules` y en la UI.
