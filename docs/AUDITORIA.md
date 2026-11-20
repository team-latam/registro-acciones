# Auditoría completa — 20 de noviembre de 2026

> Las anteriores están en `docs/informes/historial/`: la completa del 28/10/2026
> (códigos T y X, con lo de Gastos del 19/11 y las decisiones D14–D19), la completa
> con énfasis en seguridad del 24/10 (S y D10–D13), la completa del 10/10 (R y
> D1–D9), la del 6/10 (U, I, M, B, O), la de lo nuevo del 7/10 (C, E, P, G) y la de
> la Agenda del 9/10 (A). Los de esta van con **Y**, y sus decisiones siguen la
> numeración: **D20** en adelante. El método: `herramientas/auditoria/METODO.md`.

Pedido del usuario (20/11): **una revisión completa de todo el sistema**, con la
crítica de diseño de `/impeccable` y la auditoría interna, buscando lo que no se
veía «por estar tan metidos en la propia experiencia» y lo que depende de que el
sistema **no tiene masa crítica**: pocas personas, pocas actividades, y casi nunca
dos personas usándolo al mismo tiempo.

El detalle de cada hallazgo (dónde, cómo se verificó, qué número dio) está en
`docs/informes/2026-11-20-completa.md`. La página para el usuario, en palabras
simples y con capturas: se enlaza abajo, al final de «Cómo quedó».

**Cómo se hizo.** Sobre `9769ab8` de `main`. Las herramientas completas: **5.009
comprobaciones de la app** (1 en rojo, solo en este sandbox: ver Y14), Calendar y
copias en verde, **1.298 de la base** en verde; 669 pantallas en 13 combinaciones
de tamaño, idioma, oscuro y letra ancha, **sin un solo recorte**; datos variados
con dos semillas (1.500 y 800 posteos); la carga con el procesador 4 y 6 veces más
lento; el detector de diseño de impeccable (4 avisos, todos falsas alarmas). A
mano, y esto es lo nuevo: **la app con tres equipos distintos** (recién creado, de
3 personas, de 45 y 3.000 actividades), **dos personas editando lo mismo**, el
registro de actividad lleno, el botón «Atrás» del celular, un texto a medio
escribir, el buscador con lo que dice un hilo, lo que muestran «Tendencias» y
«Sugerencias» con 12 a 80 actividades puestas **al azar**, y un título largo de
verdad. Todo con la app de mentira; ningún dato real salió de acá.

---

## En una página

**Nada urgente.** La base, las copias y la seguridad están bien; no hay datos de
personas nuevos en el repositorio. Lo que apareció es de otra clase: cosas que **el
volumen real del equipo (de 2 a 6 actividades por mes) esconde o inventa**, y cosas
que **solo ocurren cuando hay otra persona** o cuando se usa el sistema fuera de la
oficina.

1. **Un título largo en «Próximos eventos» desarma el Inicio** (Y1, importante). Con
   un solo evento de 79 letras en los próximos 30 días, la columna del costado pasa
   de 276 a 565 px y el Feed queda en 583 (en 1024 px, en 407). Se corrige solo cuando
   el evento pasa. Nadie lo vio porque el título largo de los datos de prueba cae a
   40 días. Una línea de CSS.
2. **Dos personas editando el mismo evento: gana la última y se pierde lo de la otra,
   sin aviso** (Y2, importante). Probado: A solo corrige el título; la fecha, el lugar
   y el archivo que había subido B desaparecen, y el hilo dice solo «título».
3. **La página pasó los 600 KB que nos habíamos puesto de límite** (Y3, importante):
   748 KB comprimidos (eran 585 hace tres semanas; lo sumó Gastos). Sin comentarios ni
   espacios bajaría a unos 530 KB.
4. **Con el volumen del equipo, algunas pantallas inventan señales** (Y5, Y6, Y7):
   «Tendencias» muestra que algo «subió» o «se apagó» **en 12 de 12 equipos cuyas
   actividades están puestas al azar**; «Sugerencias para 2027» manda a planificar
   enero a agosto (antes de que el equipo usara el sistema); y Administración dice
   «Nunca entró» de alguien que entró, cuando el registro de actividad crece.
5. **Fuera de la oficina**: «Atrás» del celular saca de la app (Y8), un texto a medio
   escribir se pierde al recargar (Y9), el buscador no encuentra lo que se habló en
   un hilo ni lo que dice el resumen de un Cierre (Y10), no hay cómo compartir el
   enlace de un evento (Y11), y sin conexión no se ve nada (Y12).

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Y1 | Un título largo en «Próximos eventos» estira la columna del costado del Inicio (`.feed-side`, `flex:0 0 276px`, sin `min-width:0`, con `.fs-item` en `nowrap`) y aprieta el Feed. Verificado con los datos de la app de mentira más un evento de 79 letras a 5 días: columna 276 → 565 px, Feed 872 → 583 (1440 px) y 696 → 407 (1024 px). Con los datos variados de la herramienta, el Feed queda en 0 a 200 px: eran los cuatro «cortados» que marcó `datos` (la foto de una tarjeta y los filtros). | Pasa con cualquier evento de los próximos 30 días cuyo título supere ~40 letras («Seminario regional de seguridad comunitaria para instituciones del Cono Sur y Brasil» tiene 84). Cada persona de escritorio lo ve, todos los días, hasta que el evento pasa. | Claude |
| Y2 | Dos personas editando el mismo evento se pisan. El formulario de «Editar» guarda **todos** los campos con lo que tenían al abrirse (`parcheDeEdicion`, `d.editingPost` es una foto de ese momento). Probado: A abre «Editar», B cambia la fecha, anota el lugar y sube un archivo, A corrige el título y guarda → en la base queda la fecha vieja, sin lugar y sin el archivo de B (el archivo queda suelto en el bucket). El mensaje del hilo dice solo «título». Lo mismo con los hitos y el resumen de un proyecto (`milestones` y `resumen` se reescriben enteros). | Hoy casi nunca pasa (poca gente, poco al mismo tiempo): es exactamente lo que aparece cuando el equipo crece, y cuando pasa **no deja ningún rastro**. | **usuario** (D20) |
| Y3 | `index.html` pesa **748 KB comprimidos** (761 KB con gzip -9; 2.481 KB sin comprimir). D1 (6/10) dijo «volver a mirarlo al llegar a 600»; el 28/10 eran 585. La primera carga con 4G lento baja en 3,8 s y con 3G en 15 s; en un celular 6 veces más lento, el primer posteo aparece a los 1,5 s (la compu, 0,24 s). Medido: sin comentarios ni espacios (sin renombrar nada) el JS baja de 664 a 474 KB y el CSS de 89 a 50 KB: **unos 530 KB en total**. | Cada visita nueva y cada publicación lo bajan entero; quien viaja con datos lentos es quien más lo siente, y cada tanda lo agranda. | **usuario** (D21) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Y4 | **Las horas de un evento no dicen en qué zona están.** Todo evento con hora se crea en Calendar con la zona del calendario compartido (hoy Argentina, GMT-3, `zonaDelCalendario()`), sea cual sea el lugar; el formulario y las tarjetas muestran «09:00–17:00» sin más. Una visita en Ciudad de México cargada con la hora de allá queda 3 horas corrida para los invitados de Calendar; para alguien en Israel, «15:00» de una reunión virtual es ambiguo. Verificado en el código; **no probado con una invitación real de Calendar**. | Es un equipo repartido en varios países y husos; el 6/10 (I5) se arregló que la hora no cambie sola, no que se sepa de qué zona es. | **usuario** (D22) |
| Y5 | **«Tendencias» muestra cambios que son puro azar** con el volumen del equipo. Se pusieron 12, 24, 40 y 80 actividades al azar (sin ninguna tendencia por construcción) en 12 equipos de cada tamaño: **la tarjeta aparece en 11 de 12 y en 12 de 12** y siempre trae algo como «Chile 4 → 0 *se apagó*» o «Visita 6 → 3 ▼ −3». Los mínimos de hoy (8 actividades en 180 días; 3 en un tramo) están pensados para otro volumen. | Alguien puede decidir «retomar Chile» por una diferencia de tres actividades. | **usuario** (D23) |
| Y6 | **Reportes cuenta como «sin actividad» los meses de antes de que el equipo usara el sistema.** Con un equipo que empezó en octubre: «Sugerencias para 2027 — No hubo actividad en enero, febrero, marzo, abril, mayo, junio, julio, agosto y septiembre: conviene planificar algo para esos meses», nueve barras en cero en «Mes a mes» y «Solo el 0% de las actividades tiene participantes». | Recomienda planificar meses que ya pasaron, y hace parecer que el equipo estuvo parado. | Claude |
| Y7 | **Administración › Personas dice «Nunca entró» (y suma a «Inactivos») de alguien que entró hace 12 días** cuando el registro de actividad tiene más de 1.000 acciones nuevas: la app carga solo las últimas 1.000 (`subscribeRecent(1000)`) y de ahí saca el último ingreso de cada uno. Probado con 1.500 acciones más nuevas. No hay una columna de «última vez» en la base. | Con 25 a 30 personas activas, 1.000 acciones son menos de un mes: la pantalla empieza a mentir justo cuando más hace falta. | Claude |
| Y8 | **El botón «Atrás» del celular saca de la app.** La app no usa el historial del navegador (solo `replaceState` para limpiar la dirección): de la ficha de un país, «Atrás» deja la página; también cierra de golpe una ventana abierta. Probado. | Es el gesto más natural en un teléfono. | Claude |
| Y9 | **Un texto a medio escribir se pierde al recargar** (evento, rutina y respuesta: 3 de 3). No hay borrador guardado. En el celular el navegador recarga solo al volver de otra aplicación. | Se pierde un texto largo escrito en un viaje. | Claude |
| Y10 | **El buscador no mira lo que se habló ni lo que dice el Cierre.** `matchesTextFilter` mira título, comentarios, autor, participantes, lugar y alcance. No mira las respuestas del hilo, el resumen que sale de un Cierre (objetivos, pasos, resumen ejecutivo), los hitos de un proyecto ni los nombres de archivo. Probado: «portón» (en una respuesta), «motivado» (en un resumen) y «Presupuesto aprobado» (un hito) dan «Sin resultados». | La cadena documento → resumen → ficha es lo más valioso de la memoria (informe de diseño y uso, 6/10): hoy se llega por el título, no por lo que dice. | Claude |
| Y11 | **No hay «Copiar enlace» de un evento**, aunque el enlace (`?post=`) ya existe: lo usan los correos y la columna «Enlace» de la planilla. | Es un equipo que vive en WhatsApp: mandar «mirá este evento» es lo primero que se pide. | Claude |
| Y12 | **Sin conexión no se ve nada y no se puede instalar en el celular** (no hay `serviceWorker` ni manifiesto; ya figuraba en ESTADO como «solo si algún día se habilita»). Lo nuevo es el motivo: en una visita (aeropuerto, interior) es cuando se necesita el próximo evento, el plan y el teléfono de la Agenda. | Verificado en el código. Cuánto pasa en la práctica lo sabe el usuario. | **usuario** (D24) |
| Y13 | **El recorrido de bienvenida** (`tourSteps()`) tiene 11 pasos (el de Gastos tiene 56 palabras y el de Reportes 62) y **dos prometen «Tendencias»**, que con menos de 8 actividades en 180 días no aparece en ninguna parte. Verificado en una cuenta nueva de un equipo chico, compu y celular. | Es lo primero que ve cada cuenta nueva; promete lo que no está. | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| Y14 | `agenda_ventanas_test` («celular: «Rab a cargo» se lee entero en su campo») **da rojo siempre en este sandbox**, también con la página de hace un día; en GitHub pasa («Publicar el sitio» salió verde para `9769ab8`). Una prueba que siempre falla acá enseña a ignorar el rojo, y la regla D12 pide «todas, siempre». Hacerla robusta a la letra del sandbox (RECURRENTES, «Lo que entra justo acá…») | Claude |
| Y15 | ~~Falsas alarmas de las herramientas: 12 «teléfonos» (los números de los dibujos SVG del logo) y cuatro textos~~ ✅ 20/11: `seguridad` ya no mira dibujos ni identificadores de ceros; las demás, en `conocidos.json` con su porqué | Claude |
| Y16 | `fabi@team-latam.com` («Fabi Finanzas») en tres pruebas de Gastos: una persona inventada con el dominio de verdad. La regla pide `@x.com`. Cambiarlo | Claude |
| Y17 | `firmar()` pide **todas** las direcciones de adjuntos en una sola llamada (`createSignedUrls`, sin partir): con miles de adjuntos, la primera carga en un aparato nuevo es un pedido muy grande. **No verificado contra la base real** (la de mentira no lo modela); mirarlo si el medidor de «Copia de seguridad» pasa de unos pocos cientos de MB | Claude, cuando haga falta |
| Y18 | Lo de siempre y ya anotado: `diasEntre` y `csvDeTabla` sin usar; 12 anchos de pantalla en el CSS; funciones largas (`crearSupabaseStore`, `textoDelPdf`, `renderFichaLugar`). Nada nuevo | Se deja anotado |

### Para el usuario

| # | Qué | Opciones (la recomendada primero) |
|---|---|---|
| D20 | ✅ 20/11: **A** (la recomendada). **¿Qué pasa si dos personas editan el mismo evento?** (Y2) | **A**: cada una guarda solo lo que cambió, y si la otra tocó lo mismo, se avisa. **B**: se avisa «alguien lo cambió mientras editabas» y se vuelve a abrir. **C**: dejar como está |
| D21 | ✅ 20/11: **A** (la recomendada). **¿Hacemos más liviana la página?** (Y3) | **A**: al publicar, se le sacan los comentarios y los espacios (no se cambia nada de cómo se escribe ni se prueba: lo que se prueba es lo publicado). **B**: además, Gastos en un archivo aparte que se baja al entrar a Gastos. **C**: dejar como está |
| D22 | ✅ 20/11: **A** (la recomendada). **¿De qué zona son las horas de un evento?** (Y4) | **A**: de Buenos Aires para todo (como hoy), pero escrito junto a la hora y en las tarjetas. **B**: la del país del evento (más cambios, Calendar lo acepta por evento). **C**: dejar como está |
| D23 | ✅ 20/11: **A** (la recomendada). **¿Qué hacemos con «Tendencias» cuando hay pocas actividades?** (Y5) | **A**: se muestra solo cuando el cambio es más grande que el azar, y si no alcanza dice «todavía hay pocos datos». **B**: se deja, con una nota «con pocas actividades un cambio de 2 o 3 puede ser azar». **C**: sacarla del Inicio y dejarla solo en Reportes |
| D24 | **¿Instalable en el celular y con algo sin conexión?** (Y12) | **A**: instalable (ícono, pantalla completa, más rápida), sin sin-conexión. **B**: lo de A, y poder ver la Agenda y lo próximo sin conexión. **C**: nada por ahora |

---

## Lo que está bien y conviene no tocar

- **La app a cualquier escala**: vacía (cada pantalla dice qué falta y qué hacer), con 3.000
  actividades y 45 personas (sin errores, sin textos rotos, sin página corrida; el Inicio
  se dibuja en 20–30 ms), el listado de Personas con buscador y filtros.
- **Las 1.000 filas de PostgREST**: la lectura de cada tabla pide de a páginas con la
  cuenta total (`traerTodas`); no hay datos que se corten sin aviso.
- **El buscador**: encuentra «cordoba» como «Córdoba» y «sao paulo» como «San Pablo».
- **Los cuatro idiomas y el celular**: 669 vistas en 13 combinaciones sin un recorte.
- **Los permisos de la base**: 1.298 pruebas en verde; Gastos repasado por rol (X3, X4).
- **Cuando algo falla**: avisos entendibles, «Probar de nuevo», nada se pierde a medias.
- **El detector de diseño de impeccable**: cuatro avisos, todos revisados: la imagen vacía
  es el visor de fotos (se llena al abrir), Montserrat es la tipografía de la marca, la
  sombra de color es una sombra de elevación del color de la marca y las rayas son la
  trama de «planificado» en las diapositivas. Ninguno es un defecto.

## Operación (para tenerlo a la vista)

- **El peso**: 748 KB comprimidos (Y3). Cargar en un celular 4 veces más lento, el primer
  posteo a los 0,94 s; 6 veces, 1,48 s; la compu, 0,24 s.
- **Vence**: `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN` 30/9/2027.
- **Workflows**: «Publicar el sitio» salió verde para `9769ab8`; el anterior (`e454d7b`)
  quedó rojo por una etiqueta de Gastos y se corrigió en el siguiente. Calendar, copias,
  resúmenes y «¿Está arriba?», en verde.
- **Ramas**: `main` y la de esta sesión.
- **Un solo admin**: la lista de Personas muestra un solo admin. Las aprobaciones de
  cuentas, las rendiciones propias (D17) y compartir Calendar dependen de una persona.
  Conviene que haya un segundo admin; lo decide el usuario (no hace falta código).

## Lo que no pude verificar desde acá

- **Un teléfono de verdad** (D8, T10): el teclado, la cámara, «Atrás» y los borradores se
  probaron en un Chromium con el tamaño del celular, no en un iPhone ni en un Android.
- **Una invitación real de Calendar con la hora de otro país** (Y4): está en el código.
- **La base real** (nunca se toca desde acá): cuánto ocupa el bucket, cuántos eventos tiene
  el registro de actividad hoy, si hay actividad en los meses de antes de octubre.
- **Los límites del plan gratis de Supabase para el tiempo real**: cada persona abre 18
  canales (medido en la app de mentira). No sé cuántas conexiones a la vez permite el plan
  hoy; conviene mirarlo en el panel cuando el equipo pase de unas pocas decenas.
- **Las traducciones**: 3.274 textos en cuatro idiomas escritos sin revisión de personas que
  los lean de corrido. Una revisión por alguien del equipo que lea hebreo y portugués
  (con la línea «יומן פעולות» que ya estaba pendiente) vale más que cualquier prueba.

## Lo que sigue abierto de las anteriores

**R12** (el ensayo completo de restauración), **D8** (probar en un teléfono: Agenda, «+ Sumar»,
foto desde la cámara y T10), el pedido a GitHub de borrar las copias sueltas del 24/10
(ticket 4899727), **T9** (crear un evento con el teclado desde una casilla del calendario),
y del repaso de diseño el logo en el video y en las diapositivas.

## Cómo quedó

Esta tanda **audita, no arregla**: lo que se hizo en el repositorio son las herramientas.
Se suma `herramientas/auditoria/herramientas/masa.mjs` (la masa crítica: tres escalas, poco
volumen, varias personas, el celular, un título largo de verdad; ya devuelve lo que se
verificó a mano —Y1, Y2 y Y5 a Y10— y se corre en `correr.sh`), se corrigen dos falsas alarmas de
`seguridad` y se anotan cuatro en `conocidos.json`, y se suman cinco patrones a
`herramientas/auditoria/RECURRENTES.md` y una fila a METODO.md. Cada arreglo de la lista
entra con su prueba, en rojo contra el código de antes, cuando el usuario diga por dónde.

La página para el usuario, con capturas y las decisiones D20–D24 con su recomendación:
https://claude.ai/artifact/7aJtRBkkMyoyrdkub6xjtj (privada).

---

## Agregado: la pasada de UX (20/11/2026, a pedido del usuario) — código Z

Pedido del usuario, al terminar lo de arriba: «¿no te parece que pueden haber más cosas para
cambiar? ¿Cosas de UX?». Tenía razón: la primera pasada miró sobre todo datos, volumen y
funcionamiento, y casi no miró la entrada, la espera de aprobación, Países, la Agenda, Gastos,
el menú «Más», los formularios, el tamaño de los botones ni el vocabulario. Esta pasada los mira,
con capturas, con un toque simulado (no un clic de mouse) y midiendo. Las decisiones siguen:
**D25** en adelante.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Z1 | **En el celular, el primer toque en «Publicar» de «Nuevo evento» no hace nada.** Con un campo de texto con el foco (el «Dónde», por ejemplo), `html.teclado .modal{…}` (índice, ~5142) cambia el relleno, el alto y la posición del cuadro al soltar el foco: el botón sube entre 29 y 46 px entre que se apoya el dedo y se levanta, y el toque cae en otra parte. Probado con un toque simulado en 844, 740, 661 y 600 px de alto: **nunca publica al primer toque**; con el mouse en la compu, sí. La rutina de una línea y «Responder» andan. Es el **T10 del 28/10** («sin verificar en un teléfono»): se reproduce siempre y a cualquier alto, no solo en pantalla corta. Sigue sin verificarse en un teléfono de verdad (D8) | Es el botón principal del flujo principal: se toca, no pasa nada, y no hay mensaje. Se toca de nuevo y anda: parece que el sistema se colgó | Claude (con una prueba con `touchscreen.tap`) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Z2 | **Ninguna prueba mide el tamaño de lo que se toca.** En el Inicio del celular, 26 de 100 controles miden menos de 44 px y 8 menos de 24: «Me gusta» 19×36 y «Responder» 17×36 (juntos, en cada tarjeta), el nombre de una persona 92×15, «📄 2/3» 63×21, «⋯» 40×30, «ver quién dio Me gusta» 19×36. En Reportes, 15 filas de 336×15 que se tocan para ver esas actividades; en el Calendario, las flechas 34×32 y «+ Nuevo evento» 96×23; «¿Cómo funciona?» 116×15; los tres botones de la cabecera 36×36. WCAG 2.2 AA pide 24×24 (o espacio alrededor) y 44 es lo recomendado | Es lo que más se toca en un teléfono, con un dedo, en movimiento. Agrandar el área de toque con relleno invisible no cambia cómo se ve | Claude |
| Z3 | **La misma cosa se llama de cinco maneras.** En los 3.247 textos en español: *actividad* 139 veces, *evento* 98, *posteo* 63, *registro* 34, *rutina* 23. Y la pantalla de inicio es «Inicio» en la pestaña y «Feed» en cuatro textos («Ver en el Feed», «se filtra el Feed», «Sale al Feed al instante»): «Feed» es una palabra en inglés que nadie del equipo usa. «Países» tiene adentro las ciudades, las zonas, el mapa y la Agenda de teléfonos | Alguien nuevo no sabe si «posteo», «registro» y «actividad» son lo mismo; el recorrido de bienvenida lo cuenta de una manera y la pantalla de otra | **usuario** (D25) |
| Z4 | **Nadie le avisa a quien pidió acceso que ya lo aprobaron.** Los correos que existen son: pedido (al admin), posteo, respuesta, paso, gasto, rendición, informe y prueba; ninguno es «ya podés entrar». La pantalla de espera dice «se actualiza sola» (solo si la deja abierta) y «Suele tardar menos de un día». Tampoco dice a quién escribirle | Quien pide entrar cierra la pestaña y no vuelve. Es la primera impresión del sistema | **usuario** (D26) |

### Bajo

| # | Qué | Quién |
|---|---|---|
| Z5 | **La barra de abajo del celular es solo íconos de emoji** (casa, calendario, mapa, ≡), sin una palabra. El del Calendario dibuja siempre «17 de julio» (es el dibujo del emoji) y «Países» es un mapa. Proyectos, Gastos y Reportes están a dos toques, detrás de «Más» (Gastos es lo que se usa en un viaje). Los emoji también cambian de dibujo según el aparato | **usuario** (D27) |
| Z6 | La casilla «No pasarlo a Google Calendar» de «Nuevo evento» está redactada al revés: se tilda para **apagar** algo, y lo normal es tildar para prender. Mejor «Solo en Toldot» | Claude |
| Z7 | Lo que se vio y está bien, para no tocarlo: la entrada (una sola acción, «¿Es tu primera vez?» en una línea, idiomas a mano), «Rechazada» con «Pedir acceso de nuevo», la Agenda con el botón verde de WhatsApp, la «Lectura rápida» de cada país, Proyectos con «Marcar cumplido» en el mismo lugar, y los toques para cargar: **una rutina, 2; un evento con lugar, 6** (el +, «Nuevo evento», título, lugar, elegir el lugar, Publicar) | Se deja |

### Para el usuario

| # | Qué | Opciones (la recomendada primero) |
|---|---|---|
| D25 | **¿Cómo le decimos a lo que carga el equipo?** (Z3) | **A**: «actividad» para todo (rutina, visita, curso… son tipos de actividad), «Inicio» y nunca «Feed», y «posteo» desaparece de las pantallas. **B**: solo cambiar «Feed» por «Inicio». **C**: dejar como está |
| D26 | **¿Le mandamos un correo a quien pidió acceso cuando lo aprueban?** (Z4) | **A**: sí, uno corto: «Ya podés entrar», con el botón a la app (a la dirección con la que pidió, la de Google). **B**: no; la pantalla de espera dice «el administrador te avisa» y quién es. **C**: dejar como está |
| D27 | **¿Le ponemos palabras a la barra de abajo del celular?** (Z5) | **A**: sí, el nombre debajo de cada ícono (Inicio, Calendario, Países, Más) y un dibujo propio para el calendario. **B**: dejar los íconos solos |

### Herramientas y patrones

`masa.mjs` suma dos comprobaciones del celular: el primer toque en «Publicar» (Z1) y los controles de
menos de 24×24 px en el Inicio (Z2). Dos patrones nuevos en `RECURRENTES.md`.
