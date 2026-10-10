# Lo que suele fallar

El catálogo de los problemas que ya aparecieron más de una vez (o que
tienen pinta de volver). Cada auditoría empieza leyendo esto, y suma lo
nuevo al final de su sección. Para cada uno: cómo se ve, por qué pasa,
cómo se detecta y la regla que lo evita.

## Diseño y pantallas

**Algo cortado por el borde de una zona que se desplaza.** El anillo de
foco de un campo o un botón que va de punta a punta queda cortado (el
cuadro de comentarios del formulario, las pestañas, el mes del
Calendario). *Por qué:* el anillo se dibujaba por fuera del borde y toda
zona con `overflow` recorta. *Se detecta:* `pantallas`, y
`pruebas/recortes_test.mjs` en cada corrida. *Regla:* el anillo va hacia
adentro (`outline-offset:-2px`); los enlaces de texto, afuera.

**Un desplegable que se sale de la pantalla.** El menú ⋯ de una tarjeta,
los filtros del Inicio, el panel de filtros de Reportes. *Por qué:* se
abre hacia un lado fijo desde su botón, y el botón a veces está en el
borde (cuando la fila de abajo de la tarjeta no entra y el ⋯ baja solo).
*Se detecta:* `pantallas`. *Regla:* todo desplegable nuevo se suma a
`acomodarDesplegable` (o `fitDropdownPanels`), que lo corre lo justo para
entrar, medido sin la animación de entrada.

**En hebreo, la página corrida de costado.** *Por qué:* en un idioma de
derecha a izquierda, si algo asoma por la izquierda aunque sea un
instante, Chrome agranda la página hacia ese lado y la deja corrida.
*Se detecta:* `pantallas` y `datos` en hebreo; la medición nombra lo que
asoma. *Regla:* en RTL, un panel se cuelga del borde de su barra (que
ocupa todo el ancho), no del botón.

**Una palabra larga estira la página.** Un nombre larguísimo, una ciudad
escrita a mano, un link pegado: un chip, un botón con un nombre o una
lista no lo cortan y empujan todo de costado (chips de lugar y de
proyecto, participantes, «Lugares», el nombre en la ficha). *Por qué:*
`white-space:nowrap` o un elemento flexible sin `min-width:0`. *Se
detecta:* `datos` (palabras de 60 letras sin espacios). *Regla:* todo lo
que muestra texto escrito por alguien lleva `max-width:100%; min-width:0;
overflow-wrap:anywhere`. El `body` ya tiene `overflow-wrap:break-word`.

**Un select se estira hasta su opción más larga.** *Por qué:* el ancho de
un select es el de su opción más larga. *Se detecta:* `datos`. *Regla:*
`select{max-width:100%; min-width:0}` (ya global) y que su contenedor
también pueda achicarse.

**El iPhone agranda la página al tocar un campo.** *Por qué:* Safari hace
zoom en todo campo con letra de menos de 16 px. *Se detecta:*
`app_dom_test.mjs` (celular táctil). *Regla:* en pantallas táctiles los
campos van a 16 px (ya global).

**Una fila que no entra y deja algo solo en un renglón.** Los tipos del
formulario en tres renglones, el ⋯ solo abajo. *Se detecta:* a mano, con
capturas de celular. *Regla:* en el celular, grilla de columnas iguales.

**Una zona con barra propia adentro de la página, en el celular.** La
tarjeta «Ciudades» desplegada tenía un recuadro de 380 px que se
desplazaba por dentro (así se pidió para la compu, 6/10); en el celular
quedaban dos barras, una adentro de la otra, mientras «Contactos en …»
(sin recuadro) se movía con una sola (captura del usuario, 9/10). *Por
qué:* una regla pensada para la compu, donde el costado es una columna
que se desplaza, se heredó tal cual en el celular, donde esa columna no
existe. *Se detecta:* `ficha_celular_test.mjs` (esta tarjeta); en general,
a mano con capturas del celular. *Regla:* en el celular una lista que
crece va entera y se baja con la página; la barra propia, solo en la
compu y solo donde reemplaza a la de la columna
(`@media (min-width:761px)`). Las ventanas y los desplegables sí llevan
barra propia.

**Una ventana a pantalla completa con poco adentro, en el celular.** Una
ficha o un formulario de la Agenda ocupaba toda la pantalla y dejaba un
blanco abajo, que se agrandaba al desplazarse (captura del iPhone del
usuario, 9/10). *Por qué:* el navegador esconde sus barras al bajar, lo
visible crece (de unos 660 a unos 760 px) y la ventana, atada a ese alto
(`--vvh`), crece con él. *Se detecta:* `pantallas` (agranda la pantalla 100
px con la ventana abierta y avisa si crece sin que nada adentro se
desplace) y `agenda_ventanas_test.mjs` (con 661 y con 760). *Regla:* en el
celular solo lo largo (una lista) ocupa la pantalla entera; lo demás mide
lo que necesita, hasta la pantalla, y queda en el medio.

**Un formulario que entra en la prueba y no en el celular de verdad.** Con
844 px de alto «Sumar a alguien» entraba; en el iPhone del usuario, con la
barra del navegador a la vista, quedan unos 660 y había que desplazarse.
*Por qué:* las pruebas y la auditoría usaban un alto de pantalla que ningún
celular tiene con el navegador abierto. *Regla:* lo que tiene que entrar sin
desplazarse en el celular se prueba con unos 660 px de alto (`390 × 661`).

**Un botón que se parte en dos renglones.** «Ver más» al lado de un título
largo («Contactos en Buenos Aires (CABA)») quedaba «Ver / más». *Por qué:* un
botón dentro de un renglón flexible se achica y parte su texto. *Se
detecta:* `ficha_celular_test.mjs` (con 390 y con 320 de ancho). *Regla:* el
botón de una sola palabra o dos lleva `white-space:nowrap; flex:none`; lo
que se parte es el título.

## Datos

**Fechas corridas un día.** *Por qué:* `toISOString()` da la fecha en UTC;
en Buenos Aires después de las 21 ya es mañana. *Se detecta:*
`pruebas/zonas_test.mjs`. *Regla:* `isoLocalDe()` / `todayISO()`, nunca
`toISOString().slice(0,10)` para «hoy».

**Datos con forma rara.** Un lugar de tipo desconocido, un hito sin
nombre, un responsable que no es texto. *Por qué:* `scopes` y `milestones`
son jsonb sin forma fija. *Se detecta:* `datos`. *Regla:* todo lo jsonb se
ordena al leerlo (`formaDeLugares`, `formaDeHitos`).

**Lo que todavía no pasó, contado como hecho.** *Se detecta:* a mano y
`reportes_test.mjs`. *Regla:* lo que mide actividad corta en hoy; lo
planificado va aparte.

**Una fecha de la base que cambia sola.** Al restaurar o devolver algo, la
base le ponía la hora de ahora. *Por qué:* los disparadores de «hora del
servidor» actúan cuando hay sesión de una persona. *Se detecta:*
`supabase/pruebas/80-restaurar.sql`, `87-revisar-calendar.sql`.

## Idiomas

**Un texto sin sus cuatro idiomas, o con un {marcador} de menos.** *Se
detecta:* `textos`. *Regla:* todo texto visible por `t(es, en, pt, he)`.

## Seguridad y privacidad

**Lo escrito por alguien que entra al HTML sin escapar.** *Se detecta:*
`seguridad` (candidatos) y `datos` (un XSS de verdad, con HTML metido en
cada campo). *Regla:* `esc()` en todo dato.

**Datos personales en el repo, que es público.** Un correo real en un
comentario, nombres con su ciudad. *Se detecta:* `seguridad`. *Regla:* en
el código y las pruebas, correos de mentira (`@x.com`, `ejemplo`).

**Un servicio de afuera que recibe datos.** (Lo de la IP en cada login,
la traducción.) *Se detecta:* `seguridad` lista los servicios. *Regla:*
cada servicio nuevo se decide con el usuario.

## Pruebas y herramientas

**Una prueba que pasa aunque el código esté roto.** *Regla:* toda prueba
nueva se corre contra una copia rota (`INDEX=...`) y tiene que fallar.

**Una comprobación vacía.** «Sin un solo error en la página» que nunca
recibía los errores. *Regla:* al revisar una prueba, ver que lo que
compara se llene.

**Un armado de prueba al que le falta una función nueva.** Las pruebas que
sacan una función del index.html (`diferencial.mjs`, `sb_test.mjs`, los
`armar_*.py`) fallan cuando esa función empieza a usar otra nueva. *Regla:*
al agregar una función que usan otras, buscar quién las arma
(`grep -rn nombreDeLaQueLaUsa pruebas/ supabase/`) y correr también
`supabase/sync-calendar/pruebas/correr.sh`.

**Lo que entra justo acá y en GitHub no.** Las pruebas no cargan
Montserrat (los pedidos afuera se cortan): acá la letra de reemplazo es
Inter, en GitHub una más ancha. El 8/10/2026 los cuatro botones de la
tarjeta de «Próximos eventos» entraban en una fila acá (376 de 376 px) y
en GitHub el ⋯ bajó de renglón y su menú se salió de la tarjeta.
*Regla:* lo que depende del ancho del texto se mide con Montserrat
(bajarla de fonts.gstatic.com y cargarla con `@font-face` en `data:`), se
deja margen, y la prueba fuerza el caso apretado con una letra ancha
(`font-family:monospace`, ver `proximos_tarjeta_test.mjs`).
**Volvió el 9/10/2026:** el WhatsApp chico de la Agenda quedó al pie de
la lista en el celular con la letra de GitHub, y su anillo de foco (hacia
afuera, por ser un enlace) se cortaba: «Publicar el sitio» no publicó.
Acá pasaba con `DejaVu Sans` o `monospace`. Ahora `pantallas` mide una
combinación con letra ancha (`390x844:es:ancha`), y un enlace con forma de
botón lleva el anillo hacia adentro, como los botones.

## GitHub

**Las acciones de los workflows quedan viejas sin que nadie se entere.**
El 6/10/2026 cada corrida avisaba «Node.js 20 is deprecated» en amarillo,
con todo en verde: GitHub las forzaba a andar y un día deja de hacerlo.
*Por qué:* una acción fijada (por etiqueta o por huella) no se actualiza
sola, y el aviso solo se ve abriendo la corrida. *Se detecta:* `github`
(versiones nuevas) y los avisos de la última corrida, a mano. *Regla:*
cada acción por huella con su versión en un comentario
(`pruebas/workflows_test.mjs`); al subirla, leer qué cambia entre
versiones mayores y probar los workflows con actionlint.

**Un punto tachado que no estaba hecho del todo.** B4 decía «acciones
fijadas por SHA» y estaba tachado, pero eso se había dejado a propósito
para después. *Regla:* tachar solo lo hecho; lo que se decide dejar se
escribe al lado, en la misma fila.

## Código

**Código muerto después de reemplazar algo.** El selector de lugar paso a
paso quedó entero al pasar al buscador. *Se detecta:* `codigo`. *Regla:*
al reemplazar, borrar lo viejo en el mismo cambio.

## Agregado en la auditoría del 7/10/2026

**Una función de la base que le devuelve a quien la llama más de lo que
le toca.** `pedir_aviso_al_admin()` y `preparar_aviso()` estaban hechas
para la función de Supabase, pero cualquiera con sesión las podía llamar
directo y recibía los correos de los destinatarios. *Por qué:* se pensó
en quién la llama «de verdad» (la función), no en quién PUEDE llamarla
(todo `authenticated`). *Se detecta:* a mano, leyendo qué devuelve cada
función `grant … to authenticated`. *Regla:* lo que el que llama no
debería ver queda detrás de la llave de servicio (un turno y
`tomar_aviso()`); una función abierta devuelve solo lo suyo.

**Lo que todavía no pasó, contado como hecho — otra vez.** (Ya estaba en
«Datos».) Volvió en las personas sin cuenta y en «Quiénes trabajaron
acá». *Regla:* toda pantalla nueva que diga «N actividades», «estuvo» o
«trabajó» corta en `todayISO()` (`yaPaso`) y muestra lo que viene aparte.
Sube de nivel la próxima vez.

**Un trabajo programado que tiene que caer justo en su hora.** GitHub
atrasa (o se saltea) los que corren solos, sobre todo a la hora en punto.
*Regla:* lo que corre «a la hora de cada uno» toca si la hora ya pasó
hace menos de un margen y todavía no salió (`leToca` en
`supabase/avisos/resumen.mjs`), nunca «si es exactamente esta hora».

**Una prueba que guarda el comportamiento malo.** `personas_test` daba
por bueno vincular aunque el admin dijo «No es», y la herramienta de
capturas sacaba «la ficha de una persona» de otra pantalla sin que nadie
lo notara. *Regla:* al revisar una prueba, preguntarse si lo que espera
es lo que el usuario querría; en un recorrido, que cada paso llegue a
donde dice (si el botón no está, decirlo, no seguir de largo).

**Una herramienta que se marca a sí misma.** La de seguridad buscaba el
prefijo de las llaves de pago de Stripe y su propia línea lo contenía (y
este mismo archivo, al contarlo). *Regla:* el patrón que busca una
herramienta se escribe de forma que no se encuentre a sí mismo, y al
documentarlo no se copia literal.

**Un paso de CI sin tiempo propio.** `playwright install --with-deps`
quedó 20 minutos esperando un servidor de paquetes y se comió el trabajo
entero. *Regla:* todo paso que baja cosas de afuera lleva su
`timeout-minutes` y reintento.

## Agregado en la auditoría de la Agenda (9/10/2026)

**Una ventana nueva que en el celular abre el teclado sola.** La Agenda
mandaba el foco al buscador al abrirse: en un celular el teclado tapaba
media ventana antes de que la persona hiciera nada. La app ya tenía la
regla (el formulario de un evento, el selector de fecha, los colores) y
la ventana nueva no la siguió. *Se detecta:* `pantallas` lo revisa en
cada ventana (nivel importante). *Regla:* al abrir algo, el foco va a un
campo solo si `!isTouchDevice()`; en una pantalla táctil, a la ✕ o a
«Volver». Lo que la persona pidió escribir (tocó «+ Otro teléfono», un
error al guardar) sí lleva el foco al campo.

**Una ventana que cambia de tamaño con cada paso.** La Agenda pasaba de
1040 a 620 px de ancho y de una altura a otra (centrada, saltaba) al ir
de la lista a una ficha; en el celular la lista ocupaba la pantalla y la
ficha era una tarjeta flotando. *Por qué:* el tamaño salía de la vista de
ahora, no de cómo se abrió. *Se detecta:* a mano, midiendo la ventana en
cada paso (`agenda_ventanas_test.mjs` lo cuida). *Regla:* una ventana con
pasos adentro decide su tamaño al abrirse; entre paso y paso cambia el
alto, no el centro (colgarla de arriba para que no se mueva se probó y el
usuario prefirió el medio: ver la siguiente). En el celular, pantalla
completa.

**Una ventana que abre pegada arriba.** La Agenda (a 40 px del borde) y la
ficha de un posteo (a 24 px) abrían arriba, mientras el evento del
Calendario, el perfil y «Nuevo evento» abren en el medio (dos capturas del
usuario, 9/10). *Por qué:* un margen fijo en la ventana (`margin:16px 0
auto`, `margin:24px 0`) le gana al `margin:auto` con que se centran todas
las `.modal`; uno se puso para que una ventana con pasos no se moviera, el
otro para dejar un respiro cuando la ficha es más alta que la pantalla.
*Se detecta:* `pantallas` (si una ventana entra con 24 px de respiro, tiene
que estar a la misma distancia de arriba y de abajo; mide en 1440×1000
para las altas), `agenda_ventanas_test.mjs` y `app_dom_test.mjs`.
*Regla:* una ventana nueva usa el centrado de `.modal` (`margin:auto 0`);
si además necesita un respiro mínimo y desplazarse entera, va con dos
separadores flexibles arriba y abajo (`flex:1 0 24px`), no con un margen
fijo.

**Una prueba que mira la tarjeta equivocada.** `ficha_celular_test`
contaba las ciudades con `.fl-hijos .fl-hijo`, y la tarjeta nueva de
contactos usa las mismas clases. *Regla:* en una pantalla con varias
tarjetas, la prueba se limita a la suya (`.fl-card:has(...)`).

**Un recorrido que no llega a lo plegado.** En el celular la tarjeta
«Ciudades» viene plegada; el clic de Playwright no toca lo que no se ve y
el recorrido seguía de largo sin la ficha de la ciudad (ya estaba la
regla de «que cada paso llegue a donde dice»). *Regla:* para llegar a
algo que puede estar plegado, el clic es de la página
(`p.evaluate(() => el.click())`), y el paso se mide solo si llegó.

**Una espera sin tope.** Un ayudante de prueba le pasaba a
`waitForFunction` su argumento en el lugar del tiempo máximo; a veces
esperaba para siempre y el corredor lo daba por colgado a los 5 minutos.
*Regla:* los ayudantes que esperan llevan su tope escrito
(`{ timeout: 4000 }`) y devuelven `false` al vencer.

## Agregado en la auditoría completa (10/10/2026)

**Lo que todavía no pasó, contado como hecho — tercera vez.** Volvió en la
ficha de un lugar: «N registros en 12 meses» y las barras del Ritmo suman
lo planificado de este mes; «N visitas en los últimos 12 meses» y «Última
visita» de la lectura rápida toman fechas futuras. *Regla:* la de siempre,
y ahora con nivel importante de entrada (METODO.md: lo que se repite sube).
*Se detecta:* a mano; falta una herramienta: buscar en el JS los
`startsWith(mes)` y `diasDesde(...) <= N` que no van precedidos de un
corte en `todayISO()`.

**La repetición «más cercana» no es la próxima.** «Próximos eventos» usaba
`occurrenceOf()` (la repetición más cercana a hoy en valor absoluto, que
puede ser la de ayer) y la descartaba por pasada: una rutina de los lunes
desaparecía de martes a jueves. *Regla:* para «lo que viene» se toma la
primera repetición con fecha `>= hoy` de `postOccurrenceList()`;
`occurrenceOf()` es para pararse en una tarjeta, no para listar lo próximo.

**Un punto tachado que no estaba hecho del todo — volvió.** I6 (6/10)
quedó tachado con «`editors` … solo autor/editor/admin» y el disparador
nunca controló quién cambia `editors`: un integrante se suma como editor y
cancela un evento ajeno. *Regla:* al tachar algo de la base, la prueba SQL
que lo demuestra va en el mismo commit; sin prueba no se tacha.

**Un trabajo que tiene que caer justo en su hora — volvió.** La limpieza
de las marcas de avisos (`resumen.mjs`) corre «si `reloj.hora === 4`», y
con el atraso de GitHub (5–7 horas, medido) nunca cayó a las 4. La regla
del 7/10 se escribió para los resúmenes y no se aplicó al resto del mismo
archivo. *Regla:* en un trabajo programado nada depende de la hora exacta;
lo periódico se hace en cada corrida si es idempotente, o «si hace más de
N horas que no se hizo».

**Un color de marca usado como texto.** El celeste `--celeste-dark`
(#1a9fb8) sirve para fondos y bordes, pero como color de letra chica sobre
blanco da 3,1 de contraste (mínimo 4,5), y la Agenda, la ficha de un lugar
y las solapas lo usan para «Ver la ficha ›», «Volver», el teléfono, los
contadores. *Se detecta:* a mano con el cálculo WCAG; conviene sumarlo a
`codigo` (cada par color/fondo de las variables). *Regla:* el texto lleva
un token propio (`--link`) con contraste calculado en claro y oscuro; los
colores de marca, solo en fondos y bordes.

**Una herramienta que solo mira lo que ya mira.** `seguridad` revisaba
`<script src>` y `cargarScript()`, y el `import()` de supabase-js (la
librería que maneja la sesión) entraba sin huella desde el 6/10 sin que
nadie lo viera; el 6/10 se había propuesto el `modulepreload` y quedó sin
hacer ni anotar. *Regla:* cada forma nueva de traer código de afuera se
suma a la herramienta el mismo día; lo que se propone y no se hace se
anota en `docs/AUDITORIA.md` como abierto, nunca se deja implícito.

**Una medición que no se repite.** `pantallas` marcó que en el visor de
archivos (390) Tab se escapaba y el foco no volvía; reproducido dos veces
a mano, no pasa. *Regla:* un hallazgo de una herramienta que no se
reproduce dos veces va a «dudas» con lo que se intentó, no a la lista; y
la herramienta anota el camino del foco (qué elemento en cada Tab) para
que la próxima vez se vea qué pasó.

**Lo que GitHub cambia por debajo.** `ubuntu-latest` pasa a Ubuntu 26 el
19/10/2026, y lo avisa solo en una anotación de cada corrida. Lo mismo que
las acciones (6/10): lo que no se fija, cambia solo. *Regla:* `runs-on` con
versión (`ubuntu-24.04`), `pruebas/workflows_test.mjs` lo exige, y subirla
es una decisión con prueba, como subir una acción.

**Tres cuentas que no cierran entre dos pantallas.** Reportes → Inicio
prometía «la lista da lo mismo que la fila» y falla con la preferencia
«+ Región», con un alcance puesto en un comentario y con las repeticiones.
*Regla:* cuando dos pantallas cuentan lo mismo, cuentan con la misma
función (una sola regla de «alcances efectivos» y una sola de «cuántas
veces»); la prueba que compara los números incluye una preferencia
distinta de la de fábrica, un alcance en una respuesta y una rutina.

**Un dato personal real copiado a un documento al anotar un hallazgo.**
Al documentar que un teléfono real había quedado en un comentario del
código retirado del Mapeo, se copió entero a `docs/AUDITORIA.md` y al
detalle (que están en el repo público), y después otra vez al comentario
de la herramienta que lo busca: el hallazgo sobre el dato filtró el dato.
*Por qué:* anotar «qué hay» se hace pegando lo que hay. *Se detecta:*
`seguridad` mira ahora también el formato `(NNN) NNN-NNNN` (el 10/10/2026
no lo veía) y no marca los inventados (con 555). *Regla:* en un
documento, en una página, en un comentario o en un mensaje de commit, un
dato personal real se escribe **siempre recortado** («1 (929) …»,
«+54 11 …»); lo que se necesita para encontrarlo es el archivo y el
commit, no el valor. Si se filtró: se saca de los archivos, se reescribe
el historial (los commits cambian de código), se revisan todas las
revisiones y los pull requests, y se le pide a GitHub que borre las
copias sueltas.
