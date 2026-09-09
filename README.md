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
  createdAt: Timestamp (servidor)

posts/{postId}/replies/{replyId}
  content: string
  authorName: string
  authorEmail: string
  scopes: [...]              (alcance adicional opcional, mismo formato)
  images: [...]
  links: [...]
  createdAt: Timestamp (servidor)

allowlist/{email}            (el documento EXISTE = esa persona tiene acceso; el contenido no importa)
  email, approvedAt, approvedBy

accessRequests/{email}       (una solicitud de acceso por persona; el id es su propio email)
  email, name, photoURL, status: "pending"|"approved"|"rejected", requestedAt
```

Los posteos son **append-only** (no se editan ni se borran desde la UI ni
lo permiten las reglas) — si algo cambió, se aclara en una respuesta del
hilo, como pide el prompt original.

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

### Sincronización con Google Calendar (Feed → Calendar)

Cada posteo de tipo Visita/Curso/Seminario/Congreso/Otro (todo menos
**Rutina**) se suma automáticamente como evento de día completo al
calendario compartido de LatAm — el ID vive en la constante `CALENDAR_ID`
de `index.html`. No hay backend propio: se usa el token de Google del
propio usuario que publica (por eso hace falta que TODO el que carga
eventos tenga permiso de "Hacer cambios en eventos" en ese calendario,
compartido a mano desde Google Calendar — la app no puede hacer eso por
sí sola, son dos sistemas separados).

- **Mantené sincronizadas dos listas por separado**: la de aprobados en
  la app (pestaña Solicitudes) y la de "compartido con" del calendario
  "LatAm" en Google Calendar. La app te lo recuerda con un aviso cada vez
  que aprobás o revocás a alguien, pero el paso en sí (agregar/sacar del
  calendario) es manual, en la configuración del calendario, no en la app.
- Al iniciar sesión con Google, la app pide también el permiso de
  `calendar.events` (además del básico de perfil/email). Google puede
  mostrar la pantalla **"Google no verificó esta app"** al pedir ese
  permiso — es normal en apps internas chicas que no pasaron la revisión
  formal de Google; para seguir hay que tocar **Avanzado → Ir a
  [nombre del proyecto] (no seguro)**. No es un error ni un problema de
  seguridad real: solo significa que Google todavía no revisó
  manualmente esta app (revisión pensada para apps públicas masivas).
- El token de Calendar dura ~1 hora y **no sobrevive** a recargar la
  página (a diferencia de la sesión de Firebase, que sí persiste). Si
  hace falta y no hay uno vigente, la app vuelve a pedir el login de
  Google automáticamente antes de crear el evento — normalmente un click
  rápido, no un login completo de nuevo.
- Si falla la sincronización (permiso denegado, sin conexión, etc.) el
  posteo **igual se guarda** en el Feed — el Calendar es un agregado, nunca
  bloquea la memoria histórica. Aparece un aviso abajo del header avisando
  si se pudo sumar o no.
- La descripción del evento arranca con la línea `Alcance: tipo | valor`
  (misma convención pensada en el diseño original para una futura lectura
  Calendar → Feed), por si más adelante se retoma esa dirección inversa.

## 4. Qué falta / decisiones pendientes

- **Lectura Calendar → Feed**: seguir en pausa. La idea original era que
  eventos ya cargados directamente en el Calendar (sin pasar por esta app)
  también alimenten el Feed — hoy la sincronización solo va en el sentido
  Feed → Calendar.
- **Roles**: hoy todo aprobado tiene los mismos permisos (leer + publicar).
  Si más adelante hace falta un rol intermedio (por ejemplo, alguien que
  solo lee), hay que sumarlo a mano en `firestore.rules` y en la UI.
