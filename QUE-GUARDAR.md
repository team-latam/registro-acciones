# Qué guardar antes de migrar

Lista de todo lo que tenés que tener a mano por si hay que reconstruir la app
desde cero. Está todo en GitHub, pero conviene tener una copia tuya en otro
lado — en Drive, en un pendrive, donde sea, pero **no solo en la computadora
que usás todos los días**.

---

## 1. Los archivos del repositorio

| Archivo | Qué es | Sin esto… |
|---|---|---|
| **`index.html`** | La app entera: pantallas, lógica, estilos y las claves de conexión. Son 850 KB en un solo archivo. | No hay app. Es lo más importante de todo. |
| **`firestore.rules`** | Los permisos del servidor: quién puede leer y escribir qué. | Cualquiera con la dirección de la página podría entrar. |
| **`README.md`** | Cómo está armado y cómo se pone en marcha desde cero, paso a paso. | Se puede reconstruir, pero a ciegas. |
| **`CLAUDE.md`** | Las reglas de trabajo del proyecto (dónde se publica, cómo se prueba). | Se pierde el "cómo se hacen las cosas acá". |
| **`VOLVER-A-FIREBASE.md`** | El procedimiento de marcha atrás de la migración. | — |
| **`QUE-GUARDAR.md`** | Este archivo. | — |

## 2. Tu copia de seguridad de los datos

El archivo JSON que bajaste desde **Administrar → Preferencias → Copia de
seguridad**. Contiene los posteos, los comentarios, el roster, los ex
integrantes, las solicitudes, la auditoría y la configuración del equipo.

**Bajá una nueva cada tanto** — la que tenés hoy envejece con cada posteo
nuevo.

## 3. Los accesos (esto NO está en ningún archivo)

Anotá en algún lado seguro con qué cuenta entrás a cada cosa:

- **Firebase / Google Cloud** — el proyecto se llama `team-latam-2f320`.
  Ahí viven la base, el login y las reglas publicadas.
- **Google Calendar** — el calendario compartido de LatAm (su dirección
  está en `index.html`, buscá `CALENDAR_ID`).
- **GitHub** — el repositorio `team-latam/registro-acciones`, que además es
  lo que publica el sitio.

Si se pierde el acceso a la cuenta de Firebase, los archivos no alcanzan:
los datos viven ahí.

## 4. Dónde están las claves de conexión

Todas dentro de `index.html`, cerca del principio:

- `FIREBASE_CONFIG` — a qué proyecto de Firebase se conecta.
- `ADMIN_EMAIL` — el único email con permisos de admin fijo. **Tiene que
  coincidir exactamente con el que está escrito en `firestore.rules`**: si
  cambiás uno, cambiá el otro.
- `CALENDAR_ID` y `CALENDAR_API_KEY` — el calendario compartido.

No son secretos (viajan al navegador de cualquiera que entre a la página):
lo que de verdad protege los datos son las reglas de `firestore.rules`.

---

## Las tres copias que conviene tener

1. **GitHub** — ya la tenés, en las ramas `main` y `firebase-v1`.
2. **Una carpeta tuya** con los 6 archivos de arriba + el JSON de datos.
3. **El proyecto de Firebase**, vivo y sin tocar.

Con esas tres, cualquier cosa que pase se puede deshacer.
