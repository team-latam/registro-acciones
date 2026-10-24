# Auditoría de seguridad y del costo de cada cambio — el detalle (24/10/2026)

El resumen y las prioridades están en `docs/AUDITORIA.md` (códigos **S**).
Acá, para cada hallazgo: dónde está, cómo se verificó, qué se hizo y qué
queda. Sobre `1ccc721` de `main` (lo último: sacar una lista de la Agenda,
tanda 101).

Pedido del usuario: «una auditoría completa de mi sistema, haciendo especial
énfasis en todo lo que tiene que ver con seguridad», y entender si se pueden
reducir los tokens que gasta cada cambio, que hoy hace una revisión completa
y todas las comprobaciones «cuando quizás pueden ser menos».

## Cómo se hizo

1. **Las herramientas** (`./herramientas/auditoria/correr.sh`, completa;
   salida en `herramientas/auditoria/salida/2026-10-24_0203/`, no se
   versiona): **3.697 comprobaciones de la app en 112 archivos, en verde**;
   Calendar en verde; **las copias, en rojo** (S5); **990 de la base, en
   verde**; `textos`, `codigo`, `seguridad`, `github`; `pantallas` y
   `datos` con dos semillas.
2. **A mano, seguridad** (el énfasis del pedido), sobre todo lo que entró
   después de la auditoría del 10/10 y que ninguna había mirado: los SQL
   `21` a `26` (avisos de pasos, «Algo no anda», informe mensual, traer y
   sacar listas de la Agenda), las dos funciones de Supabase (`avisar` y
   `calendario`) y sus correos, los 14 workflows (disparadores, secretos,
   entradas), la CSP, cómo se carga cada librería de afuera, el visor de
   archivos, las planillas que se bajan (fórmulas), lo que «Algo no anda»
   manda a la base, el enlace del informe mensual, y el historial de git
   de esas dos semanas.
3. **A mano, el costo**: las corridas de Actions de la última semana (por la
   API), el tamaño de lo que se lee en cada sesión, cuántas veces se corre la
   suite entera por cada cambio y cuánto tarda.
4. **Lo que no se repitió** de la del 10/10, porque no cambió: permisos rol
   por rol de las tablas viejas (las pruebas SQL los cubren y dieron verde),
   el recorrido de uso, contraste y capturas de cada vista.

## Seguridad

### S4 — Datos de personas en el repositorio público (urgente)

Dos lugares, el mismo error:

1. `docs/REDISENO.md`, desde el commit `3167489` (17/10/2026, «Traer una
   lista trae la nota de cada persona…»): al contar cómo se corrigió el
   Excel del Mapeo se copió entero, como ejemplo, el teléfono de una
   persona de ese Excel («+1 (929) …», código de Nueva York).
2. Las pruebas de la Agenda (`herramientas/pruebas/agenda_test.mjs`,
   `agenda_region_test`, `agenda_tiras_test`, `agenda_ventanas_test`,
   `agenda_toda_latam_test`, `tablas_a11y_test`, `app_de_mentira.mjs`) y de
   la base (`supabase/pruebas/79-agenda.sql`), un comentario de `index.html`
   y el informe del 10/10: **ocho nombres con su teléfono, su ciudad y su
   cargo** (Córdoba, Rosario, Buenos Aires, Brasil), uno con el cargo
   «Seguridad · Kabat Kehila». Una parte viene de una prueba que se llama
   «Mapeo de prueba» (16 y 17/10, cuando se probó «Traer una lista» con
   filas como las del Mapeo) y otra del directorio de Chabad (los rabinos
   de cada casa, que ese directorio publica). Están desde el primer commit
   del historial actual (12/10). No se contrastaron con el Excel del Mapeo
   para no mover más datos personales: se tratan como reales.

Es **la tercera vez** del mismo patrón (D4 y R31 el 10/10: RECURRENTES,
«Un dato personal real copiado a un documento al anotar un hallazgo»).

- *Cómo se vio:* `seguridad` marcó el de `REDISENO.md` («Parece un
  teléfono», nivel bajo: por eso la regla de que todo se verifica); al
  revisar los otros que marcó, aparecieron los nombres de las pruebas. Los
  teléfonos de las pruebas no los veía: el «9» de los celulares de
  Argentina («+54 9 351 …») no entraba en su patrón. El 10/10 se anotó uno
  de ellos como «inventado» en `conocidos.json` sin mirar los nombres que
  iban al lado.
- *Hecho:* cambiados en todos los archivos por nombres inventados
  (Ficticio, Ejemplar, Muestral, Supuesto…) y teléfonos con 555, de forma
  pareja (también escritos sin espacios, como van en los enlaces de
  WhatsApp), así las pruebas siguen comparando lo mismo: la app (3.714) y la
  base (990), en verde. `seguridad` ahora: ve esos formatos (en la versión
  vieja de la prueba encuentra los 12 números; en la actual, ninguno),
  informa todo **recortado** (su informe se copia a los documentos), lo
  sube a «importante», y no marca los inventados (con 555 o 5555) ni un
  `viewBox`.
- *Queda (D10, del usuario):* siguen en el historial público (56 commits,
  desde el 12/10). Lo mismo que D4: reescribir el historial de `main`
  (necesita que destildes un momento «Block force pushes»), revisar todas
  las revisiones y la rama de la sesión del 22/10, y el pedido a GitHub de
  que borre las copias sueltas. Recomendación: sí.
- *Regla nueva en `CLAUDE.md`:* nunca enteros, ni como ejemplo; una prueba
  usa datos inventados aunque imite el formato del Mapeo.

### S1 — SheetJS se cargaba sin huella (importante)

`index.html`, `SHEETJS_CDN` y las dos llamadas `cargarScript(SHEETJS_CDN)`
(el visor de planillas y «Traer una lista»). Es la única librería de afuera
sin huella (SRI). Corre en dos lugares: cuando **cualquiera** abre un
adjunto `.xlsx`, y cuando **un admin**, con su sesión, trae una lista a la
Agenda. Si `cdn.sheetjs.com` sirviera otra cosa (un servidor chico, de un
solo proyecto), ese código correría con la sesión del admin: puede leer y
escribir la base entera como él.

El 6/10 (U3) se dejó sin huella porque SheetJS no está en npm y la huella
de las demás se calcula del paquete de npm. Pero su servidor sirve cada
versión como un archivo fijo: la huella se calcula de ese archivo.

- *Hecho:* `SHEETJS_SRI` y las dos llamadas con huella; la CSP nombra el
  archivo exacto; `herramientas/pruebas/sheetjs_integridad_test.mjs` (en
  GitHub, que llega a ese servidor, baja el archivo, compara la huella y
  usa la librería de verdad: arma una planilla, la lee y la muestra como
  tabla; desde el sandbox, que no llega, comprueba solo lo que puede); y
  «¿Está arriba la página?» la verifica cada día con las otras ocho.
  La huella se calculó en GitHub (el sandbox no llega a `cdn.sheetjs.com`).
- `conocidos.json`: se sacó la excepción de U3.

### S5 — «Algo no anda» no entraba en la copia de seguridad (importante)

La tabla `problemas` (`supabase/22-problemas.sql`, 13/10) no estaba en
`supabase/respaldo/respaldar.mjs` ni en el botón de la app: las copias
del 18/10 en adelante no la traen. La prueba que exige que la copia
conozca cada tabla existe y **está en rojo desde el 13/10**, pero nadie
la vio: en GitHub corre solo cuando cambia `supabase/respaldo/`, y lo que
la rompe (un `.sql` nuevo) está en otra carpeta. La auditoría la corrió
entera y la vio.

- *Hecho:* `problemas` en la copia, en la restauración (al final del
  orden) y en el botón de la app; el workflow «Copia de seguridad» corre
  sus pruebas también cuando cambia un `.sql` o la app. Las pruebas de las
  copias, en verde.
- *A RECURRENTES:* «Una prueba que solo corre cuando cambia su carpeta».

### S2 — La CSP no frenaba un script colado (medio)

La CSP de `index.html` decía `script-src 'self' 'unsafe-inline'
https://cdn.jsdelivr.net https://unpkg.com …`. Dos problemas:

1. `'unsafe-inline'` deja correr **cualquier** script escrito en la página.
   Si algún día un dato sin escapar dejara pasar un `<script>` o un
   `onerror=`, la CSP no lo trabaría. Hoy no hay ningún XSS conocido (las
   herramientas meten HTML en cada campo, con 1.500 posteos, y no corre
   nada); la CSP es la segunda llave, por si la primera falla. Y lo que hay
   detrás vale: la sesión de cada uno (con el admin, la base entera) y el
   permiso de Calendar de Google de cada persona (`calendar.events`, de
   todos sus calendarios).
2. `https://cdn.jsdelivr.net` y `https://unpkg.com` enteros: cualquiera
   publica un paquete en npm y queda servido ahí. Con una CSP estricta,
   eso sería la puerta.

La página tiene **solo dos scripts escritos adentro** y ningún `onclick=`
(todo pasa por el despachador): se pueden nombrar por su huella.

- *Hecho:* al publicar (`herramientas/publicar/csp.mjs`, que corre
  «Publicar el sitio») la CSP lleva la huella sha256 de los dos scripts;
  el navegador corre esos y ningún otro (con huellas, ignora
  `'unsafe-inline'`). El fuente queda como estaba, para no recalcular la
  huella en cada cambio. En el fuente, cada CDN pasa a nombrar el archivo
  exacto de cada librería. `herramientas/pruebas/csp_publicada_test.mjs`
  prueba lo publicado: arranca (los dos scripts corren, la pantalla se
  traduce), no se frena nada propio, y un script colado **no** corre (con
  el fuente, sí: la prueba distingue). Se comprobó que con una huella mal
  puesta la app no arranca y la prueba lo ve. «¿Está arriba?» avisa si lo
  publicado deja de traer las huellas.
- `seguridad` ahora marca `'unsafe-inline'` sin huellas y un CDN entero.

### S3 — Otra página podía mostrar la app en un marco (medio)

GitHub Pages no manda `X-Frame-Options`, y `frame-ancestors` no vale en un
`<meta>`. Sin nada más, cualquier página puede poner el Registro en un
`<iframe>` invisible y hacer que alguien con la sesión abierta toque sin
saberlo un botón de verdad («Aprobar», «Borrar», «Sacar lista»): se llama
*clickjacking*.

- *Hecho:* el primer script de la página, si está adentro de un marco de
  otro sitio, la esconde entera (y prueba salir del marco). Si el marco
  no deja correr scripts, la app tampoco corre: no hay nada que tocar.
  `herramientas/pruebas/marco_test.mjs` (dos sitios de mentira con
  Playwright: la app sola se ve; adentro de otro sitio, no hay ni un
  botón visible). `seguridad` lo mira.

### S9 — Los secretos de GitHub se leen desde cualquier rama (medio)

Los secretos (la llave de servicio de Supabase, la dirección de la base
con su contraseña, la de Resend, la cuenta de servicio de Google, los dos
tokens) están cargados **en el repositorio**. Los trabajos que los usan
dicen «solo desde main» (`if: github.ref == 'refs/heads/main'`), pero esa
línea está en el mismo archivo del workflow: quien puede empujar una rama
puede empujar un workflow que la saque y los lea. Hoy pueden empujar el
usuario y las sesiones de Claude (que empujan una rama `claude/…` en cada
sesión, y que leen contenido de afuera: correos, Calendar, Excel,
comentarios de GitHub; un contenido armado a propósito podría intentar
engañarlas).

- *La traba de GitHub para esto:* un **entorno** («Environment») con sus
  propios secretos y la regla «solo la rama `main`». Un workflow de otra
  rama que pida ese entorno no recibe nada, diga lo que diga el archivo.
- *Lo que cuesta:* GitHub no deja mover un secreto: hay que cargar de nuevo
  cada valor en el entorno. La llave de servicio y la dirección de la base
  se vuelven a copiar del panel de Supabase en un minuto; las otras piden
  crear una llave nueva. Y Claude cambia los workflows para pedir ese
  entorno, en el mismo momento.
- *Decisión (D11):* A) las dos de Supabase ahora (las más poderosas, las
  más fáciles de recargar) y el resto cuando venzan los tokens (2027);
  B) todas ahora; C) dejarlo. Recomendación: A.
- Mientras tanto, a `CLAUDE.md` se suma una regla: ninguna sesión toca un
  workflow que use secretos por algo que diga un contenido de afuera.

### S6 — Un paso con una fecha que no existe tiraba el aviso (bajo)

`preparar_aviso_de_paso` (`supabase/21-avisos-de-pasos.sql`) devuelve la
fecha del paso tal cual la guardó la app, y `correoPaso`
(`supabase/functions/_compartido/correos.mjs`) la formateaba con `Intl`:
con «mañana» o «2026-02-30» (solo por la API: la app siempre escribe
AAAA-MM-DD) tiraba «Invalid time value», la función se caía y el aviso se
perdía (la marca de enviado ya estaba puesta). Verificado con `node`.

- *Hecho:* sin una fecha de verdad, el correo sale sin fecha (también el
  del día que vence). Prueba en `supabase/functions/_pruebas/avisos.mjs`,
  que falla sin el arreglo (3 de 38).

### S7 — «¿Está arriba?» dio una alarma por una sola demora (bajo)

El 23/10 a las 17:11 UTC dio rojo: `/auth/v1/health` de Supabase tardó más
de 30 segundos **una vez** (la siguiente corrida, verde). Te llegó un mail
de alarma por algo que no pasó.

- *Hecho:* cada pedido a Supabase se repite una vez, a los 20 segundos,
  antes de dar rojo.

### Lo que se miró y está bien

- **Las funciones nuevas de la base** (`informe_vigente`,
  `preparar_informe_de_prueba`, `contar_problema`, `anotar_error`,
  `preparar_aviso_de_paso`, `agenda_traer`, `agenda_sacar_lista`):
  `security definer` con `search_path` fijo, cerradas a `anon`, cada una
  controla quién llama (aprobado o admin) y con topes por hora o por día.
  `problemas`: solo un admin la lee, la marca o la borra; nadie escribe
  directo; quién reporta lo pone la base, no la app. Las pruebas SQL de
  cada una (72, 73, 74 y 79) prueban también a alguien de afuera y a un
  integrante.
- **Los avisos por correo**: quién recibe lo decide siempre la base, la
  función solo recibe un turno; lo escrito por alguien va escapado
  (`esc()`) en cada correo; el nombre de quien asigna sale de su cuenta,
  no de lo guardado en el paso (que se puede escribir por la API).
- **«Algo no anda»**: lo automático sale sin textos entre comillas, sin
  correos ni direcciones (`textoDeErrorSeguro`), y en Administración ›
  Problemas todo va escapado.
- **El informe mensual**: el correo no lleva números; el enlace lo valida
  la base (48 horas desde que salió, para ese correo); abre dentro de la
  app con la sesión.
- **Las planillas que bajan los admins**: lo que empieza con `= + - @` va
  con apóstrofo (`celdaCsv`): una fórmula no se ejecuta al abrirla.
- **El visor de archivos**: lo de SheetJS se arma en un documento aparte y
  se limpia antes de entrar; lo de docx-preview se limpia al terminar.
  Queda un detalle teórico (S11, abajo).
- **Los workflows**: las entradas de «Run workflow» pasan por variables de
  entorno, nunca pegadas en un `run:`; permisos de lectura; acciones por
  huella; `ubuntu-24.04`; tiempos máximos.
- **Ramas y pull requests**: solo `main` y la rama de la última sesión
  (`claude/bold-thompson-ebt8tz`, igual a `main`: se puede borrar); ningún
  pull request abierto.

### S11 — Detalles de endurecimiento que no se hicieron (bajo)

- `sanearVisor` saca scripts, marcos, formularios, `on…=` y enlaces
  `javascript:`, pero deja `<style>` y los `<animate>` de SVG. Hoy no se
  alcanza (SheetJS escapa el contenido de las celdas y docx-preview arma
  sus propios elementos), y sacar `<style>` rompería cómo se ve un Word.
  Se mira si un día el visor muestra otra cosa.
- Las copias de seguridad van sin cifrar a un repo privado. Cifrarlas obliga
  a guardar una llave más y, si se pierde, la copia no sirve. Opcional.

## El costo de cada cambio

### Lo que se midió

- **La suite de la app tarda ~20 minutos** (19–24 en las corridas de la
  semana) y se corre **tres veces por cada tanda**: en el sandbox antes del
  commit, en GitHub con la rama de la sesión («Pruebas de la app») y en
  GitHub otra vez con `main` («Publicar el sitio»). El comentario de
  `app.yml` todavía dice «~6 min»: en dos semanas la suite pasó de ~60 a
  112 archivos.
- **Comprobar que una prueba nueva falla contra el código roto** (regla de
  `CLAUDE.md`) se hacía corriendo **la suite entera** con `INDEX=`: otros
  20 minutos por cada arreglo.
- **Lo que imprime la suite**: una línea por archivo, ~115 líneas verdes
  que no dicen nada, en cada corrida.
- **Lo que se lee**: `CLAUDE.md` (13 KB) va entero en cada mensaje de cada
  sesión; casi la mitad es estado e historia (el dominio, los tokens, las
  propuestas, el video), no reglas. `docs/REDISENO.md` pesa 185 KB y se toca
  en casi cada tanda (39 de los 55 commits desde el 10/10); el README, 146 KB.
- **En dos semanas** se sumaron ~29.000 líneas a la app y ~20.000 a las
  pruebas.

### Por qué cuesta (lo que pesa de verdad)

Una sesión de Claude cobra, en cada paso, por todo lo que tiene a la vista.
Lo que más pesa no es una salida larga en sí, sino **cuántos pasos** da la
sesión con mucho a la vista: cada vez que espera 20 minutos a que terminen
las pruebas, consulta, relee, o vuelve a correr todo para comprobar una
sola prueba, paga otra vez todo lo que ya leyó. Por eso lo que más rinde es
(1) que las pruebas terminen antes y (2) correr solo lo que hace falta.

### Lo que se hizo (S10)

- **`herramientas/pruebas/correr.sh` corre de a varias** (tantas como
  procesadores, hasta 4; las que miden tiempos, solas al final). Se probó
  la suite entera así, varias veces, para ver que ninguna se vuelve
  inestable.
- **Se puede correr una sola** (o varias, por nombre):
  `./herramientas/pruebas/correr.sh agenda tour`. Para «que falle contra lo
  roto» alcanza con `INDEX=/tmp/roto.html ./herramientas/pruebas/correr.sh
  nueva`: segundos en vez de 20 minutos.
- **Muestra solo lo que falla y el total** en el sandbox (en GitHub, una
  línea por archivo, como siempre). El detalle queda en
  `herramientas/pruebas/salida/ultima.txt`.
- **«Pruebas de la app» ya no corre en las ramas `claude/…`**: el mismo
  commit va a `main` minutos después y «Publicar el sitio» corre las
  mismas pruebas antes de publicar. (Un pull request la sigue corriendo.)

### Lo que decidió el usuario (D12, 24/10: todas, siempre)

Eligió que se sigan corriendo todas antes de cada cambio («no es tanto 6
minutos»): con el corredor nuevo cuesta poco más que correr algunas, y es
más seguro. Las opciones que se le dieron:

Cuántas pruebas se corren en el sandbox antes de cada cambio. La red que
protege a la gente no cambia en ninguna opción: **GitHub corre siempre la
suite entera antes de publicar, y si algo falla no publica** (queda en línea
la versión anterior).

- **A (recomendada) — Según el cambio.** Un cambio en una pantalla: sus
  pruebas y las generales (`app_dom`, `carga`, `tour`, `recortes`), un par
  de minutos; la entera la corre GitHub. La entera en el sandbox solo en un
  cambio grande o en una auditoría. Solo documentos: ninguna. Solo la base:
  las de la base. Si GitHub da rojo, se arregla en el próximo push (el
  sitio no se rompe: no se publica).
- **B — La entera siempre, pero más rápida.** Como hoy, con el corredor
  nuevo (unos 7 minutos en vez de 20).
- **C — Ninguna en el sandbox.** Que pruebe solo GitHub. Lo más barato,
  pero un error se ve recién después de empujar y cada vuelta cuesta más.

Y dos cosas más chicas, que Claude puede hacer si decís que sí:

- **`CLAUDE.md` más corto**: reglas arriba, y el estado (el dominio, los
  tokens que vencen, las propuestas, el video) en un `docs/ESTADO.md` que
  se lee cuando hace falta. Nada se pierde: se mueve. Ahorra en cada
  mensaje de cada sesión.
- **Las auditorías por nivel**: «de lo nuevo» (solo lo que cambió desde la
  última, con `RAPIDO=1`) cuando pidas revisar algo; «completa» una vez por
  mes o antes de algo grande. Y la revisión de seguridad a mano solo cuando
  el cambio toca la base, las funciones, los workflows o cómo se carga
  código de afuera.
