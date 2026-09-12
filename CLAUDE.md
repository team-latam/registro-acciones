# Registro de Acciones — Team LatAm

SPA de una sola página (`index.html`) sin backend propio ni build step:
HTML + CSS + JS (`<script type="module">` inline) que se edita y publica tal
cual. El backend es Firebase (Firestore + Auth con Google) más la API de
Google Calendar. Ver `README.md` para las decisiones de arquitectura.

## Ramas — LEER ANTES DE EMPEZAR

**La rama de producción es `main`.** Es la rama default
del repo y la ÚNICA conectada al deploy: cada push ahí dispara el workflow
"pages build and deployment" de GitHub Pages y publica el sitio. Un push a
cualquier otra rama NO despliega nada.

Claude Code on the web crea una rama nueva (`claude/...`) por cada sesión —
eso no se puede desactivar. Para que no se acumulen ramas sueltas:

1. Trabajar normalmente en la rama de la sesión.
2. **Al terminar cada tanda de cambios**, hacer fast-forward de esa rama
   hacia `main` y pushear ahí:
   ```
   git push origin <rama-de-sesion>:main
   ```
   Recién ahí los cambios salen a producción.
3. Avisarle al usuario que puede borrar la rama de sesión desde
   https://github.com/team-latam/registro-acciones/branches

Si la sesión arranca desde una rama que ya quedó atrás respecto de
`main`, traerse primero los commits nuevos (merge o
rebase) antes de trabajar.

## firestore.rules

Es la única capa de autorización del lado servidor. **No se puede publicar
desde acá**: cada cambio a ese archivo requiere que el usuario lo pegue a
mano en Firebase Console → Firestore → Reglas, lo pruebe en el Simulador y
haga clic en "Publicar". Avisarle explícitamente cada vez que el archivo
cambie.

**Cómo entregárselo (siempre, sin que lo pida):** cuando el archivo cambie,
pegar el **contenido completo en un bloque de código en el chat**, listo
para seleccionar y copiar de una. **No** mandarlo como archivo adjunto: eso
lo obliga a abrirlo, copiar y pegar, que es un paso de más para algo que
hace seguido. Va entero aunque el cambio sea de tres líneas — las reglas se
publican reemplazando todo el archivo, no por partes. Después del bloque,
decirle en una línea qué bloques son los nuevos.

## Verificación antes de cada commit

1. Extraer el contenido del `<script type="module">` de `index.html` a un
   `.mjs` en el scratchpad y correr `node --check`.
2. Para cambios de UI, levantar la página con Playwright headless (Chromium
   ya está en `/opt/pw-browsers`, con `PLAYWRIGHT_BROWSERS_PATH` seteado —
   **no correr `playwright install`**) y verificar que no haya errores de
   página, filtrando los `ERR_TUNNEL_CONNECTION_FAILED` esperados (Firebase
   y los CDN de Google no son alcanzables desde el sandbox).
3. El paquete de Playwright vive en `/opt/node22/lib/node_modules/playwright`;
   para usarlo desde el scratchpad hace falta
   `ln -sfn /opt/node22/lib/node_modules "$SCRATCH/node_modules"`.

## Convenciones de código

- **i18n**: todo texto visible pasa por `t(es, en, pt, he, vars?)`. El
  cascarón fijo fuera de `#viewRoot` se traduce en `applyStaticI18n()`. Las
  flechas se espejan a mano con `isRTL() ? "←" : "→"`.
- **Dispatcher delegado**: cada elemento interactivo nuevo lleva
  `data-action="..."` y una rama `else if(action === "...")` en el handler
  único de clicks sobre `document`.
- **Buscar en vivo, no embeber**: en los `data-*` va sólo un identificador
  (`postId`, `replyId`, `idx`, `nickname`), nunca el dato completo; se
  resuelve contra el estado vivo al momento de la interacción.
- **Modales accesibles**: `role="dialog"`, `aria-modal="true"`, el foco
  entra al abrir y vuelve al trigger al cerrar, `trapTabWithin()` cicla Tab,
  y Escape cierra en el orden de prioridad ya definido.
- **Commits en español**, explicando el "por qué" del cambio, no sólo el
  "qué".
