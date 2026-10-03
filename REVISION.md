# Revisión del sistema — 3 de octubre de 2026

Revisión completa de estructura, arquitectura, seguridad, código y uso de
recursos. Cada hallazgo se verificó contra el código, no de memoria; los
que se descartaron están al final, porque saber qué NO es un problema vale
tanto como saber qué sí.

**Tamaño de lo revisado:** `index.html` 961 KB (15.956 líneas: 135 KB de
CSS, 817 KB de JavaScript, 9 KB de HTML), con 572 funciones, 171 acciones
del despachador y 873 textos traducidos. Más `firestore.rules` (846
líneas), nueve archivos de esquema SQL y el sincronizador de Calendar.

---

## Lo que hay que arreglar, por orden

### 1. Las pruebas no están en el repositorio

> **Resuelto** (`fba759e`). Viven en `pruebas/`, sacan el código del
> `index.html` de verdad en cada corrida, y GitHub las corre en cada push
> que toca la app (`.github/workflows/app.yml`).

**1.145 de las 1.451 comprobaciones viven fuera del repo** y desaparecen
cuando termina la sesión que las escribió.

| Dónde | Qué cubre | Cuántas | ¿Corre en CI? |
|---|---|---|---|
| `supabase/pruebas/` | esquema, permisos, validación | 212 | sí |
| `supabase/sync-calendar/pruebas/` | sync de Calendar | 94 | sí |
| scratchpad de la sesión | **todo `index.html`** | **1.145** | **no** |

Es el hallazgo más importante porque es el que se lleva puestos a los
demás: lo que protege la aplicación —el acceso, los adjuntos, el
calendario, los permisos de pantalla, el plegado, el adaptador de
Supabase— no lo corre nadie después de que la sesión se cierra. Un cambio
mañana no tiene red.

**Qué hacer:** mover esos archivos a `pruebas/` dentro del repo y agregar
un workflow que los corra en cada push, igual que el de la base. El
extractor (`extractor.py` / `grab.mjs`) y los armadores de harness van con
ellos. Es media hora de trabajo y cambia el piso del proyecto.

### 2. Cada carga descarga la base entera

```js
// index.html:5624
return fb.onSnapshot(fb.collection(db, "posts"), …)   // sin limit()
// index.html:5666
return fb.onSnapshot(fb.collectionGroup(db, "replies"), …)   // sin limit()
```

El Feed **dibuja** 15 tarjetas (`PAGE_SIZE`) y **descarga** todos los
posteos y todos los comentarios. En Firebase las imágenes van en base64
*adentro* del documento, así que también se descargan todas las fotos del
historial para mostrar quince.

Dos costos, los dos crecen solos con el tiempo:

- **Lecturas de Firestore:** una por documento y por carga. La cuota
  gratis son 50.000 por día para todo el equipo. Con 500 posteos y 1.000
  comentarios, cada persona que entra gasta 1.500 — unas 33 cargas por
  día entre todos.
- **Bytes:** un posteo con seis fotos pesa cerca de 1 MB. Cien de esos son
  100 MB en cada carga, en el celular con datos también.

**Qué hacer:** acotar la consulta a una ventana (los últimos N meses o los
últimos N posteos) y traer el resto a pedido, como ya hace "Ver más" del
lado del dibujo. Del lado de Supabase la pieza ya existe y no se usa:
`enVivo()` acepta `tope` (`index.html:6206`) y `posts.subscribe` no se lo
pasa.

### 3. Los topes por archivo suman más que el tope del documento

> **Resuelto.** La base declara su techo por posteo entero
> (`limites.bytesPorPosteo`: 1 MiB en Firebase, sin techo en Supabase) y
> `excesoDePeso()` lo mide antes de cada escritura, en las tres funciones
> por donde pasan todas (`createPost`, `createReply`, `updatePostDoc`). El
> aviso dice cuánto sobra y qué sacar. Al editar se mide *antes* de cerrar
> la ventana, que era donde se perdía la edición. A un posteo que ya está
> al límite se le puede seguir sacando cosas: solo se frena lo que suma.
> La medida se comparó contra el cálculo que publica Firestore
> (`pruebas/peso_test.mjs`): difiere en menos de 250 bytes.

```
tope por archivo (crudo)        500 KB
ese archivo ya en base64        667 KB
dos archivos al tope          1.333 KB
tope de un documento Firestore 1.024 KB   ← se pasa por 309 KB
```

Y **no hay ningún control del peso total** antes de escribir: los únicos
chequeos son por archivo (`index.html:10266` y `:14013`). Dos PDF de
500 KB en un mismo posteo fallan al publicar, después de esperar toda la
codificación, con el error opaco de Firestore.

**Qué hacer:** sumar el peso de imágenes y adjuntos antes de guardar y
avisar con un mensaje claro ("este posteo pesa X, el máximo es 1 MB:
sacá una foto o subí el archivo a Drive"). En Supabase no aplica —ahí el
archivo va al bucket y en el posteo queda la ruta—, así que el control
corresponde al adaptador, junto a `limites`.

### 4. Las reglas no miran lo que hay adentro de la configuración

```
isValidPreferences:      activityTypes is list          ← y nada más
isValidTerritoryConfig:  zones is map && countryZones is map
```

De ahí salen dos cosas:

- **Tamaño sin techo.** Un admin puede dejar ~1 MiB de configuración, y
  eso lo descarga *todo el equipo en cada carga*, porque son documentos
  que todos leen.
- **Contenido sin forma.** Hoy escapé los tres lugares donde el ícono y la
  clave de un tipo llegaban crudos al HTML (commit `0f8d0cd`), así que la
  inyección está cerrada del lado del dibujo. Pero la puerta sigue
  abierta en la regla, y la próxima pantalla que lea esa configuración
  vuelve a quedar expuesta.

**Qué hacer:** validar por elemento, con el mismo patrón que ya usa el
archivo para `images`/`files`/`links` (`isValidImageAt` y compañía): largo
de `key`, `label` e `icon`, y un tope de cantidad. Requiere publicar las
reglas a mano.

---

## Observaciones menores

- **`postOccurrenceDates` no se usa** (`index.html`). Es la única función
  muerta de 572.
- **`fetchPublicIp` pega a un servicio externo en cada inicio de sesión**
  para guardar la IP en la auditoría. Es una dependencia de terceros en el
  camino del login y manda la IP de cada integrante a un tercero. Si la
  auditoría de IP no se usa, sale gratis quitarla.
- **Firebase App Check no está activo.** Está anotado en los comentarios
  de `firestore.rules` y en el README. Sin él, la clave pública de la API
  se puede usar desde cualquier lado; el freno real hoy es que las reglas
  exigen estar en la allowlist para todo lo que importa.
- **Un solo `render()` redibuja la pantalla entera.** Funciona bien con 15
  tarjetas, pero se paga en los campos de texto: hay varios lugares que
  reponen el foco y la posición del cursor a mano después de redibujar
  (los de Calendar, por ejemplo). Es el costo conocido del modelo y no
  hace falta cambiarlo; vale saber de dónde viene ese código.

---

## Lo que revisé y está bien

No es relleno: son las cosas donde un problema habría sido grave.

- **Escapado del contenido.** `nl2br()` escapa primero y resalta después
  —que es el orden correcto—, `highlightMentions` vuelve a escapar el
  nickname, y `safeUrl` deja pasar solo `http/https/mailto`. Busqué
  interpolaciones sin escapar en las 13.659 líneas de JavaScript: las que
  quedaron son ternarios que producen `"active"` o `"disabled"`.
- **Los topes de adjuntos sí se acotan contra el techo de la base.**
  `maxImagenes()` y `maxArchivos()` hacen `Math.min` contra
  `store.limites`, así que una configuración heredada de Supabase (20
  imágenes) no puede hacer que la app intente escribir algo que Firestore
  va a rechazar.
- **No hay ninguna clave privada en el repositorio.** Solo las dos de
  Google que son públicas por diseño y van restringidas por dominio.
- **El freno de la auditoría existe y está implementado.** Las entradas
  que puede escribir cualquier cuenta de Google (`login`,
  `access_requested`) usan un id fijo por cuenta+tipo+día, así que el
  segundo intento del día choca contra `allow update: if false`.
- **Las tres capas de tipos de archivo coinciden**, y hay una prueba que
  saca la expresión *de verdad* de `firestore.rules` y la corre contra los
  mismos casos que la de la app.
- **`isValidLikeToggle` compara la lista entera**, no el tamaño: no se
  pueden pisar los "me gusta" de los demás.
- **El adaptador de base tiene prueba de forma**: los dos stores exponen
  los mismos métodos con la misma cantidad de argumentos.
- **La lógica duplicada del sync de Calendar está fijada.** Está dos veces
  a propósito (`applyCalendarEventToPosts` y `decidir.mjs`) y una prueba
  diferencial las corre contra los mismos 48 eventos y compara escritura
  por escritura. Si alguien toca una sola, se cae en CI.
