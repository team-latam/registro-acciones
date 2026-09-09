# Registro de Acciones — Team LatAm

Herramienta web de un solo archivo (`index.html`) para llevar la memoria
histórica de las acciones del equipo (rutinas, visitas, cursos, seminarios,
etc.) en cada ciudad/país/región de LatAm y el Caribe. Feed tipo posteo +
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
- Revocar acceso (botón "Revocar" en Solicitudes) borra a esa persona de la
  lista de aprobados — dejará de poder leer y cargar, pero **no borra** lo
  que ya haya publicado (la memoria histórica queda intacta).
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
  organizer: string          (opcional — quién organiza, puede ser distinto de quien carga)
  location: string           (opcional — lugar/salón/dirección concreta)
  activityType: "rutina" | "visita" | "curso" | "seminario" | "congreso" | "otro"
  authorName: string         (nombre de Google de quien publicó)
  authorEmail: string        (email de Google de quien publicó)
  scopes: [{ type:"ciudad", country, city } | { type:"pais", country } | { type:"region", region:"sur"|"central"|"norte" } | { type:"todo" }, ...]
  images: ["data:image/jpeg;base64,...", ...]   (comprimidas en el navegador)
  links: [{ label, url }, ...]
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
  links: [...]
  createdAt: Timestamp (servidor)
  system: bool               (opcional — true en las respuestas automáticas de edición/cancelación)
  icon: string                (opcional — emoji que acompaña una respuesta de sistema, ej. "✏️")
  replyToId: string | null    (opcional — id de OTRA respuesta del mismo posteo a la que le contesta; un solo nivel de anidamiento)
  likedBy: [string, ...]      (opcional — emails de quienes le dieron "me gusta"; único campo editable después de creada)

allowlist/{email}            (el documento EXISTE = esa persona tiene acceso; el contenido no importa)
  email, approvedAt, approvedBy

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
qué cambió (título, fechas, lugar, quién organiza, tipo, comentarios o
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

### Zonas (fijas, no editables desde la UI)

- **Sur** (azul): Argentina, Chile, Uruguay, Paraguay.
- **Central** (amarillo): Brasil.
- **Norte** (verde): el resto de los países/territorios de LatAm y el Caribe
  (lista completa en la constante `COUNTRIES` de `index.html`).

La zona de un alcance se calcula siempre a partir del país (o directamente
del campo `region` cuando el alcance es "región completa") — nunca se
carga a mano. El cuarto tipo de alcance, **"Toda LatAm y el Caribe"**
(`{type:"todo"}`), afecta a las tres zonas y a todos los países al mismo
tiempo (por ejemplo, un anuncio general del equipo).

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

Cada posteo de tipo Visita/Curso/Seminario/Congreso/Otro (todo menos
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
  completo de nuevo. La **lectura** (sincronizar Calendar → Feed) no usa
  este token — ver más abajo.
- Si falla la sincronización (permiso denegado, sin conexión, etc.) el
  posteo **igual se guarda** en el Feed — el Calendar es un agregado, nunca
  bloquea la memoria histórica. Aparece un aviso abajo del header avisando
  si se pudo sumar o no.
- La descripción del evento arranca con la línea `Alcance: tipo | valor`.

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
  organiza si Calendar lo tiene) con tipo **"Otro"** y alcance **"Toda
  LatAm y el Caribe"** por default — cualquier persona aprobada puede
  después editarlo desde la app para afinar el tipo real de actividad y
  el alcance correcto.

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

### Auditoría (solo admin)

Pestaña "Auditoría", visible solo para `ADMIN_EMAIL`: un registro de
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

## 4. Qué falta / decisiones pendientes

- **Roles**: hoy todo aprobado tiene los mismos permisos (leer + publicar).
  Si más adelante hace falta un rol intermedio (por ejemplo, alguien que
  solo lee), hay que sumarlo a mano en `firestore.rules` y en la UI.
