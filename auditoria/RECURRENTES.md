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
pasos adentro decide su tamaño al abrirse; si no, cuelga de arriba y
crece hacia abajo. En el celular, pantalla completa.

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
