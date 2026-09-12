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
- **Las reglas exigen login con Google y email verificado**
  (`signedIn()` en `firestore.rules`: `email_verified == true` y
  `sign_in_provider == 'google.com'`). Todo el modelo de acceso descansa
  en `request.auth.token.email`; si en la consola de Firebase se
  habilitara otro proveedor que deje elegir el email sin verificarlo
  (Email/Password, por ejemplo), cualquiera podría presentarse como el
  admin. Por eso, además de esa regla, **en Authentication → Sign-in
  method tiene que estar habilitado solo Google**.
- **Lo que escribe cada uno va firmado con su propio token**: un posteo o
  una respuesta tienen que llevar el `authorEmail` de quien la crea (las
  reglas lo comparan con el token), los "me gusta" solo pueden agregar o
  sacar el propio email (la lista entera se compara contra "la de antes
  ± yo"), y cada documento solo puede tener las claves que la app usa
  (`keys().hasOnly()` al crear, `affectedKeys().hasOnly()` al editar).
  Quien no es admin solo puede registrar en `auditLog` su propio login o
  su propio pedido de acceso. La única excepción, y es deliberada: los
  mensajes firmados "Google Calendar" (el posteo que importa un evento
  creado directo en Calendar y la respuesta de sistema del sync) no
  tienen una persona detrás, así que un aprobado podría fabricarlos —
  sin backend no hay forma de distinguirlos. Lo importante es que ya no
  se puede firmar como **otra persona real**.

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

> **Glosario:** lo que en el código, en Firestore y en este README se
> llama "alcance" / `scopes` (país, ciudad, región o "Toda LatAm" al que
> pertenece un posteo), en la pantalla se llama **"Dónde"** desde
> septiembre de 2026. Es la misma cosa; se renombró solo el texto que ve
> la gente, para no tocar el modelo de datos. No confundir con
> `location`, el campo de texto libre del lugar puntual (un hotel, una
> dirección), que se muestra con 📍 debajo del título.

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

### Configuración (panel admin)

Pestaña **Configuración** (solo admin; por dentro sigue siendo
`preferencias` en el código, Firestore y este README — se renombró solo
el texto que ve la gente), con una sub-navegación de 5
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
de la vista Vistas — aunque el posteo original "viva" en otro lugar. Ver
`getVisiblePosts()` y `computePlaceCounts()` en `index.html`.

### Por qué el mapa no usa imágenes satelitales "pesadas"

La vista Mapa usa Leaflet + capas de OpenStreetMap reales (no es un mapa
esquemático), pero los círculos se ubican en la **capital** de cada país
(no hay geocoding de ciudades exactas sin un servicio externo de geocoding,
que no está configurado). El detalle por ciudad se ve en la vista
Vistas → Lista, al hacer click en un país.

### Calendario (vista propia, no un embed de Google)

La pestaña **Calendario** dibuja los eventos sobre `state.posts`, lo que ya
está en memoria — no pide nada por red ni depende de que la persona esté
logueada en el navegador con la cuenta de Google que tiene el calendario
compartido.

Se evaluó incrustar el calendario de Google en un `<iframe>` (el embed
oficial, `mode=MONTH/WEEK/DAY`), que eran diez líneas contra unas
cuatrocientas. Se descartó porque pierde lo que hace útil al Registro:
clickear un evento abriría Google Calendar en vez del posteo con sus
respuestas, adjuntos y participantes; no se puede clickear un día para
crear; y el iframe no hereda el modo oscuro, el idioma ni el RTL. Como el
sync bidireccional ya deja todos los eventos en `state.posts`, la vista
propia sale "gratis" en datos. **El sync con Google Calendar no cambió**:
quien prefiera usar Google Calendar lo sigue teniendo igual.

Seis vistas, con los mismos atajos de teclado que Google Calendar
(D/W/M/Y/A/X, más T para "Hoy"; las letras no se traducen, igual que hace
Google). Día, 4 días y Semana son **la misma grilla horaria** con distinta
cantidad de columnas (`renderCalendarioGrid` recibe la lista de días) —
solo Semana se alinea al domingo. Los eventos que se pisan en el mismo día
se reparten el ancho de la columna (`layoutTimedEvents`).

La banda de **"todo el día"** de Semana/Día no es un detalle: la mayoría de
los eventos de este Registro no tiene horario propio, así que es la parte
más poblada de esas vistas.

Dos cosas a tener en cuenta al tocar esto:

- **Las Rutinas no entran.** El filtro reusa `CALENDAR_SYNC_TYPES`, la misma
  constante que decide qué se publica en el Calendar compartido, en vez de
  mantener una segunda lista de tipos que se despegue de aquella.
- **Toda la aritmética de fechas es UTC** (`isoDate`, `addDaysISO`, y
  `toLocaleDateString` con `timeZone:"UTC"`). Mezclarla con medianoche local
  corre un día para cualquiera al este de Greenwich — el mismo bug que ya
  documenta `addDaysISO`.

### Ex integrantes (`formerMembers/{email}`)

Al revocar un acceso se borra `allowlist/{email}`, y ahí vivía el
`@nickname` — el único lugar. Antes de borrarlo se guarda una copia en
`formerMembers/{email}` (nombre, nickname, foto, desde/hasta cuándo estuvo).
Sin eso, **todos los posteos y respuestas de esa persona pasaban a mostrar
el nombre crudo de su cuenta de Google**, sin `@nickname` ni perfil
clickeable, y las @menciones que le habían hecho quedaban como texto muerto.

La colección **no da acceso a nada**: `isApproved()` sigue mirando
únicamente si existe el documento en `allowlist`. La lee cualquier
aprobado, por el mismo motivo que el roster (resolver el `@nickname` de un
autor); la escribe solo el admin.

`memberByEmail()` / `memberByNick()` son la única resolución de identidad:
buscan primero entre los activos y después entre los ex. Usarlas siempre en
vez de repetir `state.roster.find(...)`, o los ex integrantes vuelven a
desaparecer de a un lugar por vez.

Quien vuelve al equipo recupera **su** `@nickname` de antes (si nadie lo
ocupó): darle uno nuevo partiría su historia en dos personas distintas.

<h4 id="nickname-quemado">Decisión: un @nickname usado queda quemado para siempre</h4>

**Estado: decidido, revisable.** `takenNicknames()` une los nicknames en uso
hoy con los de quienes ya no están, y la usan los cuatro lugares que asignan
o validan uno (auto-alta al aprobar, alta del admin, backfill, y la edición
del propio nickname). O sea: **el `@nickname` de alguien que se fue no se le
puede dar a nadie más.**

Se evaluó permitir "liberarlo" y se descartó por ahora. La evidencia, medida
sobre el comportamiento real (no deducida):

| Qué | Si se libera y otro lo toma | ¿Se reatribuye? |
| --- | --- | --- |
| Autoría del posteo | Pasa de "Creado por @ana" a "Creado por Ana Gómez" (texto plano) | **No** |
| `@ana` escrito en el TEXTO de un posteo viejo | Abre el perfil de la persona nueva | **Sí** |
| Notificación de esa mención | Sigue apuntando a la original | **No** |

La autoría y las notificaciones están atadas al **email**, que es único y no
se recicla. Pero el texto del posteo guarda literalmente la cadena `"@ana"`:
no hay email ahí, así que se resuelve contra quien tenga ese nickname **hoy**.
Un "gracias @ana por la ayuda" escrito hace dos años terminaría linkeando a
otra persona.

El daño está acotado (solo los posteos que mencionan por texto, no los que
esa persona escribió) pero es silencioso y no tiene arreglo posterior. Contra
eso, el costo de quemarlos es bajo: son nombres cortos y hay combinaciones de
sobra.

**Si alguna vez hace falta revisarlo**, la variante intermedia ya pensada es:
liberar el nickname **y además** dejar de linkear las menciones viejas a esa
cadena (quedarían en gris, sin link). Se pierde el link, pero nadie queda mal
atribuido. Haría falta una lista de nicknames "retirados" que
`highlightMentions` consulte antes de linkear.

### Configuración personal (`userPrefs/{email}`)

La solapa **Configuración** es de cada persona; la de admin se llama
**Administrar** y configura el equipo (`meta/preferences`). No confundirlas.

Las preferencias viven en una colección propia, `userPrefs/{email}`, y **no**
como un campo más de `allowlist/{email}`. El motivo es concreto: ese
documento lo lee entero todo el equipo con un `onSnapshot` (hace falta para
las @menciones), así que meter ahí la configuración de cada uno haría que
todos se bajen las preferencias de todos en cada cambio del roster, y las
dejaría a la vista de cualquier aprobado. En `userPrefs/{email}` cada uno
lee y escribe solo el suyo.

Cada control lleva `data-pref="<clave>"` y lo guarda **un solo** manejador
genérico de `change` (más `data-action="pref-toggle-list"` para las listas
multi-selección), en vez de una rama por opción. El cambio se aplica en
pantalla al toque y el `onSnapshot` confirma después.

Cualquier clave nueva hay que sumarla al `hasOnly` de `isValidUserPrefs` en
`firestore.rules` **y volver a publicar las reglas a mano**.

### Notificaciones: qué puede y qué no

Sin backend no hay push. La campanita solo puede mostrar lo que hay **ahora**,
cada vez que alguien abre la app: no hay nada agendado ni ningún temporizador
corriendo. Muestra tres cosas, separadas por sección: los eventos que
arrancan dentro de la ventana configurada, las respuestas nuevas en posteos
propios, y las @menciones de siempre.

La única capa que alcanza a alguien con la app cerrada es el recordatorio
que se le escribe al evento en Google Calendar (`reminders.overrides` en
`buildCalendarEvent`, si la persona lo activó). **Ojo con el alcance**: en un
calendario compartido ese override vale para quien escribe el evento, no
para cada persona que lo tiene compartido — cada una define los suyos en su
propio Google Calendar. Por eso la campanita sigue siendo la capa que ve
todo el equipo.

### Feriados

Salen de los **calendarios públicos de Google** (uno por país, más el de
festividades judías), leídos con la misma `CALENDAR_API_KEY` del sync: son
públicos, no piden login. Por eso no hay ninguna tabla de fechas en el repo
— mantenerla año a año sería trabajo puro, y las festividades judías además
necesitan el calendario hebreo.

`HOLIDAY_CAL` mapea nombre de país → prefijo del calendario de Google. Los
países del Registro que Google no publica (territorios chicos) simplemente
no aparecen como opción, en vez de ofrecer algo que después no trae nada.

Si la red falla, el calendario se dibuja igual, sin feriados: nunca rompe la
vista. Cada calendario se pide una vez por año mostrado y se marca como
pedido **antes** del `fetch`, así un error no se reintenta en cada render.

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
- El login con Google pide SOLO identidad (perfil/email). El permiso de
  `calendar.events` se pide recién la primera vez que hace falta escribir
  en Calendar (crear/editar/cancelar un evento, compartir el calendario)
  — un popup extra de Google, una vez por sesión (~1 h). Se eligió así a
  propósito: ese scope es sobre **todos** los calendarios de la persona,
  no solo el compartido, y quien solo lee la app no tiene por qué
  concederlo (ni dejar un token con ese alcance en `sessionStorage`).
  Google puede mostrar la pantalla **"Google no verificó esta app"** al
  pedir ese permiso — es normal en apps internas chicas que no pasaron
  la revisión formal de Google; para seguir hay que tocar **Avanzado →
  Ir a [nombre del proyecto] (no seguro)**. No es un error ni un
  problema de seguridad real: solo significa que Google todavía no
  revisó manualmente esta app (revisión pensada para apps públicas
  masivas).
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
  los 32 países en los conteos de Vistas/Mapa antes de tiempo) —
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

### Idioma (ES / EN / PT / HE)

Selector en el menú del avatar, arriba de Claro/Oscuro (`LANGS` en
`index.html`). La preferencia se guarda en `localStorage` (`ra_lang`,
mismo criterio que el tema: por dispositivo, no por cuenta) y se aplica
de verdad: toda la interfaz se traduce, y hebreo cambia además el
sentido de lectura de la página (RTL).

**El helper `t(es, en, pt, he, vars?)`.** No hay un diccionario de
textos aparte — cada string se traduce AL LADO de su original, en el
mismo lugar donde se usa: `t("Guardar", "Save", "Salvar", "שמירה")`.
Se eligió así a propósito: la traducción de cada texto se revisa junto
al original en el mismo diff, en vez de tener que saltar a un archivo
de claves separado donde es fácil que una traducción quede huérfana o
desincronizada del texto real. Para textos con datos adentro, `vars` es
un objeto con placeholders `{así}`:
`t("Editado por {n}", "Edited by {n}", ..., ..., {n: nombre})`. Los
cuatro idiomas son obligatorios en cada llamado — no hay un valor por
defecto que se olvide de traducir en silencio.

`currentLang()`/`isRTL()` leen el idioma actual; `setLang(lang)` lo
guarda, fija `lang`/`dir` en el `<html>`, y llama a `applyStaticI18n()` +
`render()`. El script suelto del `<head>` (el mismo que evita el flash
del tema) también fija `lang`/`dir` ahí, antes de pintar — si se
aplicara recién en el módulo, se vería la página armada en LTR
"saltando" a RTL un instante después.

**`applyStaticI18n()`** traduce el "cascarón" fijo del HTML —header,
pestañas, footer, el aviso del Calendar compartido— que vive afuera de
`#viewRoot` y por eso NUNCA pasa por `render()`/`doRender()`. Todo lo
demás (el 99% de la app) se traduce solo, porque cada `render()` ya
reconstruye su `innerHTML` desde cero en cada pasada — ahí alcanza con
que el string use `t()`.

**Objetos con label fijo → funciones.** Varios objetos vivían como
`const` evaluados una sola vez al cargar el módulo (`USER_ROLE_LABELS`,
`ACTIVITY_TIERS`, `TOUR_STEPS`, `AUDIT_LABELS`, `PREFERENCIAS_SECTIONS`).
Un label ahí adentro con `t()` se hubiera traducido una vez, al arrancar
la página, y quedado congelado en ese idioma para siempre. Se
convirtieron en funciones (`userRoleLabel()`, `activityTiers()`,
`tourSteps()`, `auditLabels()`, `preferenciasSections()`) que arman el
objeto de nuevo en cada llamado, así el label sale siempre con el idioma
actual.

**`ACTIVITY_TYPES`/`ZONES`: editables por el admin, con traducción
"de fábrica".** Son datos editables desde Configuración, no texto fijo
de la interfaz — no se pueden traducir contra un diccionario a ciegas
porque el admin puede haber escrito cualquier cosa ahí. Para los 7 tipos
y las 3 zonas DE FÁBRICA (las que trae la app antes de que el admin
toque nada), sí hay traducción: `refreshActivityTypeLabels()`/
`refreshZoneLabels()` re-etiquetan una entrada SOLO si su label actual
coincide con alguna de las 4 traducciones conocidas para esa key — en
cuanto el admin escribe otra cosa, se respeta tal cual y deja de
tocarse.

**Nombres de país y ciudad (`countryLabel()`/`cityLabel()`).** A
diferencia de tipos/zonas, los países y ciudades NO son editables por
el admin (son fijos en el código, en `COUNTRIES`/`CITY_PRESETS`) — así
que alcanza con tablas derechas, `DEFAULT_COUNTRY_LABELS`/
`DEFAULT_CITY_LABELS`, sin el mecanismo de "respetar si ya lo tocaron".
Las dos son solo para MOSTRAR: el identificador real (el que se guarda
en cada scope de Firestore, la key de `CITY_PRESETS`/`COUNTRY_BY_NAME`/
`ZONE_COUNTRIES`, y el que viaja en `data-country`/`data-city` de cada
botón) sigue siendo siempre el nombre en español — cambiarlo por idioma
rompería la carga de posteos viejos y cualquier comparación/matching
contra esos datos.

`DEFAULT_CITY_LABELS` está anidado por país (`{ "Argentina": { "Cordoba":
{es,en,pt,he}, ... }, ... }`), no es un diccionario plano de 102 nombres
— el nombre de ciudad no es único entre países ("San Pedro" existe en
Belice y en Guatemala, "La Paz" en Bolivia y en México), así que
`cityLabel(country, city)` necesita las dos claves para desambiguar. La
traducción al inglés/portugués es mayormente el mismo nombre (son
topónimos, no vocabulario) salvo un puñado de ciudades con nombre
anglicizado/lusitanizado conocido ("Ciudad de México" → "Mexico City" /
"Cidade do México", "São Paulo" con su acentuación real en vez de la
versión sin tildes que usa el dato interno). La transliteración al
hebreo, como con los países, no la revisó nadie nativo — es una primera
pasada razonable, no una garantía de exactitud dialectal.

**Contenido libre (posteos/respuestas): traducción bajo demanda.** Lo
de arriba traduce el "cascarón" de la interfaz, pero el contenido que
escribe cada quien (título y texto de un posteo, el texto de una
respuesta) no se puede pre-traducir — no está en el código, lo tipea la
gente. Para eso hay un botón discreto "🌐 Ver traducción" debajo de cada
posteo/respuesta (solo visible cuando el idioma activo no es español,
que es en el que se escribe todo el contenido) que pide la traducción a
[MyMemory](https://mymemory.translated.net/doc/spec.php) — un traductor
gratuito, sin API key, con CORS habilitado — el mismo criterio que ya se
usaba para `fetchPublicIp()` contra ipify.org: sin backend propio, la
llamada sale directo del navegador de quien mira. Puntos importantes:

- **Nunca es automático.** Se pide solo al hacer click, nunca al
  renderizar — el tier gratuito de MyMemory tiene cupo diario limitado
  (típicamente 5000 palabras/día por IP), y traducir de arriba todos los
  posteos de un feed lo agotaría enseguida sin que nadie lo haya pedido.
- **Se cachea en memoria** por `${scope}:${id}` (`contentTranslations`)
  — volver a "Ver original" y después a "Ver traducción" no vuelve a
  pedir nada mientras el idioma no cambie; `translationsShown` guarda
  solo cuáles items están mostrando la traducción ahora mismo.
- Si falla (cupo agotado, sin red), el botón pasa a "⚠️ No se pudo
  traducir. Reintentar" — el reintento manda de nuevo el texto original
  (`data-title`/`data-content` en el propio botón), no depende de que
  haya quedado nada en caché.
- La caché es por pestaña/carga de página únicamente (vive en una
  variable JS, no en `localStorage`) — a propósito: es contenido de
  terceros, no hace falta persistirlo.
- Es la única parte del sistema de idiomas que hace una llamada de red
  en tiempo real — todo lo demás (interfaz, tipos/zonas/países) es
  traducción pre-armada en el propio código, sin depender de que un
  servicio externo esté arriba.

**RTL de verdad, no maquillaje.** Se auditó cada declaración de CSS
direccional del archivo (`margin`/`padding`/`border` con `-left`/
`-right`, `text-align:left/right`, posiciones `left`/`right` de menús y
dropdowns) y se convirtió a su equivalente lógico (`margin-inline-start`,
`text-align:end`, `inset-inline-end`, etc.), que el navegador invierte
solo con `dir="rtl"` — sin flexbox `row-reverse` ni reglas duplicadas
por idioma. Dos excepciones, documentadas en el propio CSS: el globo del
tutorial (su posición la calcula JS con `getBoundingClientRect()`, que
ya devuelve coordenadas físicas correctas después de que el navegador
aplicó RTL — convertir esa regla a lógica lo habría roto) y un par de
overlays simétricos (`left:0;right:0`) donde no hay nada que invertir.
`transform-origin` no tiene equivalente lógico en CSS (el spec solo
acepta `top`/`left`/`right` físicos): se corrige a mano con un bloque
`html[dir="rtl"]` puntual para la animación de los desplegables de
filtro.

**Las flechas (← →) no se invierten solas.** A diferencia de los
paréntesis u otra puntuación que Unicode sí "espeja" en contextos
bidireccionales, una flecha es un símbolo de glifo fijo — `dir="rtl"` no
le toca el dibujo. Cada lugar que usa una flecha de navegación o de
rango (breadcrumb de Vistas, "Elegir de la lista", popup del mapa,
separador entre fecha/hora de inicio y fin) elige el caracter con
`isRTL() ? "←" : "→"` (o viceversa) en vez de tenerlo fijo.

**Una colisión de nombres que hubo que resolver primero.** Los cinco
manejadores de eventos delegados (`click`/`change`/`input`/`keydown`/
`scroll`) usaban `const t = e.target...` para el elemento clickeado o
tocado — el mismo nombre corto que el helper de traducción. Llamar a
`t(...)` adentro de esos manejadores habría intentado invocar un
`<button>`/`<input>` como si fuera función. Se renombró esa variable a
`el` en los cinco (y un `const t` suelto en `lastLoginByEmail()`, a
`ts`) antes de poder traducir nada de lo que vive ahí adentro
(confirmaciones, validación de formularios, mensajes de error).

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

El mapa de la vista Vistas sigue con las imágenes claras de OpenStreetMap
en los dos modos (es lo que hacen casi todas las apps, y las alternativas
oscuras de OSM son de menor calidad).

### Tutorial de bienvenida

Un recorrido de tres paradas (`TOUR_STEPS`) que **señala las partes
reales de la pantalla** — el composer de Rutina ("¿Qué hiciste hoy?"),
el botón de eventos, las pestañas — con el resto atenuado, en vez de
explicar la app en abstracto desde un cartel centrado. Los textos son
cortos y concretos a propósito: que la persona sepa qué es cada cosa y
salga a probarla, no leer un manual (para eso está este README).

**Solo lo ven las cuentas nuevas, una vez, y no hay forma de reabrirlo a
mano**: la primera vez que entra alguien aprobado a partir de
`TOUR_ELIGIBLE_FROM` (11/9/2026). Quien ya venía usando la app no lo ve
nunca. Se usa la fecha de aprobación porque es el único dato propio que
una cuenta común puede leer para saber si es nueva — los logins están en
Actividad (`auditLog`), que solo lee el admin. (Hasta el 11/9/2026 hubo
un botón "❔ Cómo funciona" en el menú del avatar para volver a verlo
cuando se quisiera; se sacó para dejar ese lugar libre — ahí va a ir el
selector de idioma.)

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

### Revisión de código (septiembre 2026): decisiones que hay que conocer

Se hizo una pasada completa (seguridad del cliente, reglas, bugs, código
muerto). Lo que cambió y conviene tener presente al tocar el código:

- **Todo `src`/`href` que viene de datos pasa por un validador**:
  `safeImageSrc()` (solo `data:image/...;base64,` con cuerpo base64 puro),
  `safeFileDataUrl()` (PDF/audio/octet-stream), `safeUrl()` (http/https/
  mailto; acepta "www.algo.com/x" sin esquema y le pone https) y
  `safeColor()` (`#rrggbb`, para los colores de zona que van a un
  `style=""`). Las reglas solo chequean que `images`/`files` sean listas,
  no qué tienen adentro — un documento escrito a mano contra Firestore
  podía meter un `" onerror="..."` que corría en el navegador de todos.
  Labels/iconos de tipos y zonas (config del admin) también van con
  `esc()`. Regla general: **nada que venga de Firestore o de Calendar se
  interpola sin `esc()` o sin uno de esos validadores.**
- **Fechas**: `todayISO()` da "hoy" en hora local (`toISOString()` es
  UTC: a las 22:00 de Buenos Aires ya es mañana) y `addDaysISO()` hace la
  aritmética enteramente en UTC (mezclar medianoche local con
  `toISOString()` daba el día anterior al este de Greenwich — en Israel,
  `addDaysISO(x, 1) === x`).
- **Lookups con claves que vienen de datos** (`byCountry[sc.country]`,
  `CITY_PRESETS[country]`, `byNickname[nick]`, los diccionarios de
  labels) usan `Object.create(null)` o `hasOwn()`: un scope con country
  `"__proto__"` escribía en `Object.prototype`, y un `@constructor` en un
  texto metía la función `Object` en `mentions` y Firestore rechazaba el
  posteo entero. `canonicalCityName()` devuelve el nombre del preset si
  coincide sin tildes/mayúsculas (antes `titleCase()` convertía "Ciudad
  de México" en "Ciudad De México" y no matcheaba nada).
- **Zonas/tipos borrados por el admin** con posteos que todavía los
  referencian: `scopeLabel()`, `renderScopeChip()`, `renderPostCard()`
  tienen fallbacks (no hay `try/catch` en `render()` — un `TypeError` ahí
  congelaba la página entera), y no se puede borrar una zona con posteos
  apuntando a ella.
- **Composer**: cerrar con cambios sin guardar pregunta; Escape cierra
  de adentro hacia afuera (lightbox → desplegable → modal); Enter en un
  input no publica; hay un flag `submitting` que evita el doble envío
  (los posteos no se pueden borrar); los topes de las reglas (15 lugares,
  10 links, 10 participantes, 10 @menciones, 5000/3000 caracteres) se
  chequean antes de escribir, con mensaje.
- **Calendar**: los eventos que crea la app llevan
  `extendedProperties.private.raActivityType` (la KEY del tipo, no el
  label, que cambia con el idioma) y `raPostId`; `extractTitleFromSummary`
  y `findCalendarEventId` reconocen el prefijo "Tipo: " en cualquiera de
  los labels conocidos. Los posteos importados desde Calendar usan un id
  de documento derivado del id del evento (`cal_<id>`) y se crean en una
  transacción: el poll de 30 s corre en todos los navegadores abiertos y
  dos podían importar el mismo evento. Un evento cancelado no se
  resucita al editar el posteo. Cambiar el ID del calendario resetea el
  `syncToken`. El loop del sync tolera un evento que falle (los demás se
  aplican y el token avanza).
- **Sesión**: revocar a alguien online corta sus listeners antes de que
  fallen; si el listener de `allowlist` falla se muestra el motivo (no un
  "pendiente" eterno). El roster no usa `orderBy("approvedAt")` porque
  Firestore excluye los docs sin ese campo.
- **Respuestas con una sola consulta**: `subscribeReplies()` lee las
  respuestas de todos los posteos con un `collectionGroup("replies")` en
  vez de un listener por posteo (que crecían sin tope). Necesita el
  `match /{path=**}/replies/{replyId}` de `firestore.rules` — la regla
  anidada en `/posts/{postId}/replies` NO cubre consultas de grupo, y eso
  era lo que faltaba cuando "hasta con `if true` seguía fallando". Si
  las reglas publicadas todavía no lo tienen, Firestore contesta
  permission-denied y el cliente pasa solo al modo posteo por posteo.
- **Marcas de "visto"** (popup y campanita del Calendar, @menciones)
  guardan la hora DEL DATO (la invitación, la mención más nueva), no
  `Date.now()`: con el reloj del dispositivo atrasado, un "ahora" local
  quedaba antes que el dato y el popup volvía a aparecer en loop.
- **Foco**: `render()` vuelve a encontrar el elemento con foco por id o,
  si no tiene, por tag + sus `data-*` (`focusSelectorOf()`): las filas de
  link y los selects del alcance no tienen id y un render de fondo sacaba
  a la persona del campo. Los modales (Evento, invitación al Calendar,
  tutorial) tienen `role="dialog"`, reciben el foco al abrir, lo devuelven
  al cerrar, ciclan el Tab adentro y se cierran con Escape.
- **Rendimiento**: los listeners de respuestas juntan sus renders en uno
  por frame (`scheduleRender()`); Feed y Memoria muestran de a 30 con
  "Ver más"; el mapa se crea una vez y conserva zoom/posición entre
  renders (se vuelve a enchufar su contenedor y solo se rehacen los
  marcadores si cambió algo); la regex de @menciones y los conteos por
  persona se memoizan por versión de roster/posts; Actividad baja como
  mucho 1000 entradas.
- **Se dejó a propósito**: el banner de `CONFIG_IS_PLACEHOLDER` (hoy es
  siempre `false`, pero es el camino de arranque para un fork nuevo) y
  los chequeos `isAuthorized()` redundantes dentro de vistas que ya están
  detrás del gate (defensa barata).

## 4. Qué falta / decisiones pendientes

- **Reciclar `@nickname` de ex integrantes**: hoy quedan quemados para
  siempre, a propósito — ver
  [la decisión y su evidencia](#nickname-quemado). Está marcada como
  revisable: si alguna vez el equipo necesita reusar un nombre, ahí está
  medido qué se rompe y cuál es la variante intermedia.
- **Roles**: hoy todo aprobado tiene los mismos permisos (leer + publicar).
  Si más adelante hace falta un rol intermedio (por ejemplo, alguien que
  solo lee), hay que sumarlo a mano en `firestore.rules` y en la UI.
- **SRI en tres assets de unpkg**: `leaflet.markercluster.js` y sus dos
  CSS (`MarkerCluster.css`, `MarkerCluster.Default.css`) se cargan sin
  `integrity=` (los de Leaflet sí lo tienen). Desde el entorno donde se
  hizo la revisión no se pudo descargar unpkg para calcular los hashes;
  se calculan con `curl -sSL <url> | openssl dgst -sha256 -binary |
  base64` y se pegan como `integrity="sha256-..."`.
- **CSP**: no hay `Content-Security-Policy`. Una que limite `script-src` a
  self + unpkg + gstatic y `connect-src` a googleapis/firestore/ipify/
  mymemory reduciría mucho el impacto de cualquier XSS futuro, pero hay
  que probarla en producción (los popups de login de Google y las
  teselas del mapa son fáciles de romper con una CSP mal armada).
- **Privacidad de terceros**: la traducción bajo demanda manda el texto
  del posteo a MyMemory en el query string (memoria de traducción
  pública + logs), y el login manda la IP de cada persona a ipify para
  la auditoría. Son decisiones asumidas por no tener backend; conviene
  que el equipo lo sepa.
