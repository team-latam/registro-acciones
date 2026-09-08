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

Sin este paso, la app muestra un aviso de "Falta configurar Firebase" y no
guarda nada — es un aviso esperado, no un error de la app.

### Sobre la seguridad (importante)

Esta herramienta **no tiene login** (así se pidió: nombre libre por ahora,
pensado para engancharse a un sistema de usuarios más adelante). Eso
significa que cualquiera que tenga la URL de la página puede leer y escribir
en la base compartida — el `firebaseConfig` no es secreto, pero tampoco hay
una barrera de autenticación. Las reglas en `firestore.rules` validan la
forma de los datos (tamaños de texto, cantidad de adjuntos, campos
requeridos) para evitar abuso accidental, pero no reemplazan un login. Si
más adelante quieren cerrar más el acceso, las opciones más simples son:

- **Firebase App Check**: bloquea llamadas que no vengan de la página real
  (bots/scripts), sin pedirle nada a los usuarios.
- **Firebase Auth**: agregar login (por ejemplo con cuenta de Google) y
  cambiar las reglas a `allow read, write: if request.auth != null;`.
- No hacer público el link/repositorio (obscuridad — no es seguridad real,
  pero reduce exposición mientras no haya algo mejor).

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
  content: string
  date: "YYYY-MM-DD"        (fecha de la actividad, no de carga)
  activityType: "rutina" | "visita" | "curso" | "seminario" | "otro"
  authorName: string
  scopes: [{ type:"ciudad", country, city } | { type:"pais", country } | { type:"region", region:"sur"|"central"|"norte" }, ...]
  images: ["data:image/jpeg;base64,...", ...]   (comprimidas en el navegador)
  links: [{ label, url }, ...]
  createdAt: Timestamp (servidor)

posts/{postId}/replies/{replyId}
  content: string
  authorName: string
  scopes: [...]              (alcance adicional opcional, mismo formato)
  images: [...]
  links: [...]
  createdAt: Timestamp (servidor)
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
carga a mano.

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

## 4. Qué falta / decisiones pendientes

- **Integración con Google Calendar** (Calendar → Feed): queda en pausa,
  tal como se definió en el prompt original. La convención pensada
  (`Alcance: ciudad|país|región | valor(es)` en la primera línea de la
  descripción del evento) todavía no está implementada — hay que sumar un
  backend liviano en Google Apps Script cuando se retome.
- **Login real**: hoy el nombre de quien publica es un campo de texto libre
  (se recuerda el último usado en `localStorage` de cada navegador, sólo
  como comodidad). El modelo de datos ya deja `authorName` como string
  suelto para poder reemplazarlo más adelante por un ID de usuario real sin
  rehacer la estructura.
