# Qué guardar

Lista de todo lo que hay que tener a mano por si hay que reconstruir la app
desde cero. El código está todo en GitHub, pero conviene tener una copia
propia en otro lado — en Drive, en un pendrive, donde sea, pero **no solo
en la computadora que usás todos los días**.

---

## 1. Los archivos del repositorio

| Archivo | Qué es | Sin esto… |
|---|---|---|
| **`index.html`** | La app entera: pantallas, lógica, estilos y las direcciones de conexión. | No hay app. Es lo más importante de todo. |
| **`supabase/`** | Todo lo de la base: el SQL que la arma, las pruebas, el sincronizador de Calendar, la limpieza del bucket y `LEEME.md`. | Habría que rehacer la base desde cero, y con ella los permisos. |
| **`README.md`** | Cómo está armado y por qué. | Se puede reconstruir, pero a ciegas. |
| **`CLAUDE.md`** | Las reglas de trabajo del proyecto (dónde se publica, cómo se prueba). | Se pierde el "cómo se hacen las cosas acá". |
| **`QUE-GUARDAR.md`** | Este archivo. | — |

## 2. Los datos

Viven en Supabase. **Hoy no hay ninguna copia de seguridad automática**
(ver el punto 13 de `REVISION.md`): es lo que falta resolver.

La última copia de Firebase (el JSON que se bajó el 3 de octubre de 2026)
es una foto de cómo estaban las cosas ese día. Guardala, pero no es una
copia de lo que se cargó después.

## 3. Los accesos (esto NO está en ningún archivo)

Anotá en algún lado seguro con qué cuenta entrás a cada cosa:

- **Supabase** — el proyecto `team-latam` (identificador
  `benonmzlgdjkhzauamrz`). Ahí viven la base, el login y los archivos.
  Revisá a nombre de qué cuenta está: si se pierde ese acceso, se pierden
  los datos.
- **Google Cloud** — el proyecto que antes era de Firebase (número
  40280679854). Ahí viven el cliente de OAuth con el que se pide el permiso
  de Calendar y la clave de la API de Calendar. **No se borra** aunque
  Firebase ya no se use.
- **Google Calendar** — el calendario compartido de LatAm (su dirección
  está en `index.html`, buscá `CALENDAR_ID`).
- **GitHub** — el repositorio `team-latam/registro-acciones`, que además es
  lo que publica el sitio y lo que aplica el SQL a la base.

## 4. Las contraseñas de verdad (guardalas aparte, nunca en un chat)

Hay tres cosas en todo el proyecto que sí son secretas. No están en ningún
archivo ni pueden estarlo:

- **La dirección de la base con su contraseña** (`postgresql://…`). Está
  guardada en GitHub como el secreto `SUPABASE_DB_URL`, y es lo que permite
  que el SQL se aplique solo (ver `supabase/LEEME.md`). Quien la tenga
  puede leer, cambiar y borrar todo sin pasar por los permisos.
- **La llave de servicio de Supabase** (secret / service_role). Está en
  GitHub como `SUPABASE_SERVICE_ROLE_KEY`, y la usan el sincronizador de
  Calendar y la limpieza del bucket. Hace lo mismo que la anterior: pasa
  por encima de todos los permisos.
- **El Client Secret de Google** (el del login). Vive en la configuración
  de Supabase, no en el repo.

Si alguna aparece alguna vez en un chat, un mail o una captura, se cambia
por una nueva desde su panel y se vuelve a cargar donde va — no se
"borra" de donde haya quedado.

## 5. Dónde están las claves de conexión

Todas dentro de `index.html`:

- `SUPABASE_URL` y `SUPABASE_KEY` — a qué base se conecta. La clave es la
  "publishable": está hecha para viajar al navegador.
- `ADMIN_EMAIL` — el único email con permisos de admin fijo. **Tiene que
  coincidir exactamente con el de `admin_fijo()` en
  `supabase/02-politicas.sql`**: si cambiás uno, cambiá el otro.
- `CALENDAR_ID`, `CALENDAR_API_KEY` y `GOOGLE_OAUTH_CLIENT_ID` — el
  calendario compartido y el permiso para escribir en él.

No son secretos (viajan al navegador de cualquiera que entre a la página):
lo que de verdad protege los datos son los permisos de
`supabase/02-politicas.sql`.

---

## Las copias que conviene tener

1. **GitHub** — ya la tenés, en la rama `main`. La rama `firebase-v1`
   guarda cómo era la app con Firebase: no se borra.
2. **Una carpeta tuya** con los archivos de arriba.
3. **Una copia de los datos** — la que falta (punto 2).
