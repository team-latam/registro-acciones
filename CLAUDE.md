# Registro de Acciones — Team LatAm

SPA de una sola página (`index.html`) sin backend propio ni build step:
HTML + CSS + JS (`<script type="module">` inline) que se edita y publica tal
cual. El backend es **Supabase** (Postgres + Auth con Google + Storage, ver
`supabase/LEEME.md`) más la API de Google Calendar. Firebase fue la base
hasta el 3 de octubre de 2026: quedó cerrado y fuera del código, y la rama
`firebase-v1` que guardaba cómo era la borró el usuario el 5/10/2026 (lo
de entonces sigue en el historial de `main`). Ver `README.md` para las
decisiones de arquitectura.

## Reglas fijas del usuario — valen en toda sesión

- **Nunca pedirle que pegue en el chat contraseñas, la llave de servicio
  de Supabase ni el Client Secret de Google.** Si hace falta que mire o
  cambie algo en un panel, se le dan los pasos y él cuenta qué vio.
- **Nunca borrar** el proyecto de Google Cloud `40280679854`: aunque
  nació con Firebase, ahí viven el login de Google y la API de Calendar
  que la app usa hoy.
- No es técnico: hablarle en español, en palabras simples y paso a paso.
  Las propuestas van con capturas; las decisiones que son suyas se le
  presentan con opciones y una recomendación.
- El estado del trabajo vive en el repo, en `docs/`: `docs/REDISENO.md`
  (tandas hechas y decisiones), `docs/REVISION.md` (la revisión técnica y
  lo que queda), `docs/QUE-GUARDAR.md` (qué tener a mano para reconstruir)
  `docs/DOMINIO.md` (el plan, no ejecutado, de mudar el sitio a un
  dominio propio si `*.github.io` vuelve a bloquearse en Argentina) y
  `docs/AUDITORIA.md` (la auditoría completa del 6/10/2026 con la lista de
  mejoras por prioridad; el detalle en `docs/auditoria/`) y
  `docs/RESTAURAR.md` (cómo volver atrás con una copia: workflow
  «Restaurar una copia», `supabase/respaldo/restaurar.mjs`). En la
  raíz quedan solo `index.html`, `README.md` y este archivo.
  Copias de seguridad (docs/REVISION.md, punto 13): andando desde el
  5/10/2026 — workflow «Copia de seguridad» (`supabase/respaldo/`) cada
  domingo al repo privado `team-latam/registro-respaldos`, y
  Administración → Copia de seguridad para bajar una. **El token
  `RESPALDOS_TOKEN` vence el 5/10/2027**: hay que renovarlo antes (pasos
  en `supabase/respaldo/LEEME.md`; la corrida avisa en rojo faltando 15
  días). **El token `SUPABASE_ACCESS_TOKEN`** (publica la función
  `calendario`, `supabase/functions/LEEME.md`) **vence el 30/9/2027**:
  renovarlo junto con el otro; si vence, la función sigue andando y solo
  falla publicar un cambio. **El dominio `team-latam.com`** (el correo del
  equipo, y desde el 7/10/2026 el remitente de los avisos de Resend) está
  en **Squarespace** (account.squarespace.com/domains, la ex Google
  Domains) y **vence el 12/12/2026**, con renovación automática: confirmar
  antes de esa fecha que se renovó y que la tarjeta sigue vigente. Si se
  cae el dominio, se cae el correo `@team-latam.com` y con él el login del
  admin. Claude no puede crear repos en la cuenta `team-latam` (es una
  cuenta de usuario; la conexión de GitHub no tiene ese permiso).

## Auditorías — `auditoria/`

Cuando el usuario pida una auditoría (o «revisá todo»), se arranca de
`auditoria/METODO.md`: los pasos, las áreas, los niveles y lo que se revisa
a mano. `auditoria/RECURRENTES.md` es lo que ya falló más de una vez;
`auditoria/correr.sh` corre las herramientas (textos, código, seguridad,
pantallas en todos los tamaños e idiomas, ventanas, datos variados con
semilla) y arma un informe. Queda abierto: cada auditoría suma lo que
aprendió. La skill `.claude/skills/auditoria/` es la entrada. A diferencia
de `pruebas/`, la auditoría no falla: busca y anota.

## Ramas — LEER ANTES DE EMPEZAR

**La rama de producción es `main`.** Es la rama default
del repo y la ÚNICA conectada al deploy: cada push ahí dispara el workflow
«Publicar el sitio» (`.github/workflows/pages.yml`), que corre todas las
pruebas de la app y **recién si dan verde** publica `index.html` en GitHub
Pages (desde el 6/10/2026; antes publicaba el «pages build and deployment»
automático, sin esperar a nadie). Para eso Settings → Pages → Source tiene
que estar en «GitHub Actions»; mientras siga en «Deploy from a branch», el
trabajo lo avisa en su resumen y GitHub publica por su cuenta como antes.
Un push a cualquier otra rama NO despliega nada.

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

**Pushear a `main` de una, sin preguntar.** El usuario lo pidió explícito:
al terminar una tanda de cambios, el push a `main` va directo — nada de
"commiteo local y te mando capturas para que mires antes", nada de "¿lo
pusheo?". La única excepción es un cambio muy, muy grande (una
reestructuración de varias vistas, algo que cambie cómo se usa la app);
ahí sí avisar antes. Si él quiere revisar algo antes de que salga, lo va a
aclarar en el pedido. Un stop hook del repo también reclama los commits
sin pushear: obedecerlo.

Si la sesión arranca desde una rama que ya quedó atrás respecto de
`main`, traerse primero los commits nuevos (merge o
rebase) antes de trabajar.

## La autorización: `supabase/02-politicas.sql`

Es la única capa de autorización del lado servidor (más las validaciones de
`03-validacion.sql`). Se aplica sola: al llegar a `main`, el workflow
"Base de datos" la prueba entera en una base descartable y recién después
la aplica a Supabase. Un push con el SQL roto no llega a la base real, pero
**probarlo antes en local** (`bash supabase/pruebas/levantar.sh` y
`bash supabase/pruebas/correr.sh "postgresql:///registro?host=/var/run/postgresql&user=postgres"`).

## Algo para pegar a mano en una consola

Ya no hay nada que se publique a mano (`firestore.rules` se fue con la base
de Firestore, borrada el 3 de octubre de 2026). Si alguna vez hiciera falta
que el usuario pegue algo en una consola, se le entrega como pidió para las
reglas, sin que lo pida:

1. **Entero, siempre.** Nunca un fragmento, ni ofrecer el fragmento como
   alternativa: un fragmento obliga a buscar dónde va.
2. **Pegado en el chat, en un bloque de código, no adjunto.** Un adjunto lo
   obliga a abrirlo, seleccionar y copiar.
3. Después del bloque, **una línea** diciendo qué es nuevo respecto de lo
   último que pegó.

## Verificación antes de cada commit

```
./pruebas/correr.sh
```

Corre todas las pruebas de `index.html` (más de mil comprobaciones), la
carga de la página y la app entera con la sesión iniciada contra un
Supabase de mentira (`app_dom_test.mjs`). **Tiene que terminar en verde antes de
cada commit que toque la app.** GitHub lo corre igual en cada push
(`.github/workflows/app.yml`; en `main`, adentro de «Publicar el sitio»),
y un push en rojo ya no se publica: queda en línea la versión anterior.
Pero igual queda roto en `main` hasta el próximo push, así que se prueba
antes.

- Las pruebas sacan el código del `index.html` real en cada corrida, nunca
  de una copia. Una prueba nueva va en `pruebas/` y sigue esa regla; las
  páginas de prueba se arman solas y no se versionan. Ver
  `pruebas/LEEME.md`.
- **Comprobar que una prueba nueva falla contra el código roto** antes de
  darla por buena: `INDEX=/ruta/a/copia/rota.html ./pruebas/correr.sh`.
- En este sandbox Playwright y Chromium ya están (`/opt/pw-browsers`, con
  `PLAYWRIGHT_BROWSERS_PATH` seteado): **no correr `playwright install`**.
  El corredor resuelve solo el `node_modules`.
- Los errores `ERR_TUNNEL_CONNECTION_FAILED` son esperados: los CDN de
  Google no son alcanzables desde el sandbox. `carga_test.mjs` ya los
  descuenta.
- El esquema SQL y el sync de Calendar tienen sus propias pruebas
  (`supabase/pruebas/`, `supabase/sync-calendar/pruebas/`) y sus workflows.

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
