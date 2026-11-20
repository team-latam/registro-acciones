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

> **Estado al cierre (20/11/2026, a la tarde):** todo lo que sigue está **arreglado y subido**, salvo Y12 (sin conexión: el
> usuario dijo «nada por ahora»). Las filas tachadas dicen qué se hizo y qué prueba lo cuida. Lo que se midió *antes* de
> arreglar se deja como se escribió, para que se vea de dónde se partió. Al final, la revisión de seguridad, el código muerto
> y las optimizaciones (código W).

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
| Y1 | ~~Un título largo en «Próximos eventos» estira la columna del costado del Inicio (`.feed-side`, `flex:0 0 276px`, sin `min-width:0`, con `.fs-item` en `nowrap`) y aprieta el Feed. Verificado con los datos de la app de mentira más un evento de 79 letras a 5 días: columna 276 → 565 px, Feed 872 → 583 (1440 px) y 696 → 407 (1024 px). Con los datos variados de la herramienta, el Feed queda en 0 a 200 px: eran los cuatro «cortados» que marcó `datos` (la foto de una tarjeta y los filtros).~~ ✅ 20/11: `.feed-side` con `min-width:0; max-width:276px`; los textos largos se cortan con puntos suspensivos, como ya estaba pensado. `columna_lateral_test` (un evento largo a 5 días, un hito largo y una palabra de 70 letras, en 1024, 1280 y 1440: falla contra la página de antes en 5 comprobaciones) | Pasa con cualquier evento de los próximos 30 días cuyo título supere ~40 letras («Seminario regional de seguridad comunitaria para instituciones del Cono Sur y Brasil» tiene 84). Cada persona de escritorio lo ve, todos los días, hasta que el evento pasa. | Claude |
| Y2 | ~~Dos personas editando el mismo evento se pisan. El formulario de «Editar» guarda **todos** los campos con lo que tenían al abrirse (`parcheDeEdicion`, `d.editingPost` es una foto de ese momento). Probado: A abre «Editar», B cambia la fecha, anota el lugar y sube un archivo, A corrige el título y guarda → en la base queda la fecha vieja, sin lugar y sin el archivo de B (el archivo queda suelto en el bucket). El mensaje del hilo dice solo «título». Lo mismo con los hitos y el resumen de un proyecto (`milestones` y `resumen` se reescriben enteros).~~ ✅ 20/11 (D20-A): el formulario de «Editar» guarda solo lo que esa persona cambió (`parcheDeEdicion` compara cada campo con lo que había al abrir); lo que cambió la otra (fecha, lugar, archivos) se conserva, el resumen del hilo cuenta solo lo suyo, y si la otra persona cambió justo lo MISMO se pregunta «Guardar lo mío» / «Cancelar» (al cancelar, el formulario sigue abierto con lo escrito). `edicion_simultanea_test` | Hoy casi nunca pasa (poca gente, poco al mismo tiempo): es exactamente lo que aparece cuando el equipo crece, y cuando pasa **no deja ningún rastro**. | **usuario** (D20) |
| Y3 | ~~`index.html` pesa **748 KB comprimidos** (761 KB con gzip -9; 2.481 KB sin comprimir). D1 (6/10) dijo «volver a mirarlo al llegar a 600»; el 28/10 eran 585. La primera carga con 4G lento baja en 3,8 s y con 3G en 15 s; en un celular 6 veces más lento, el primer posteo aparece a los 1,5 s (la compu, 0,24 s). Medido: sin comentarios ni espacios (sin renombrar nada) el JS baja de 664 a 474 KB y el CSS de 89 a 50 KB: **unos 530 KB en total**.~~ ✅ 20/11 (D21-A): al publicar, `herramientas/publicar/achicar.mjs` saca espacios, saltos de línea y comentarios del JavaScript y del CSS (sin cambiar ningún nombre): **de 755 a 515 KB por la red (−32 %), de 2,5 a 1,8 MB sin comprimir**; bajarla con 4G lento pasa de 3,9 a 2,6 s y con 3G de 15 a 11 s; el primer posteo en un celular 4 veces más lento, de 1,05 a 0,94 s. El fuente no cambia. `achicar_test` recorre las 52 pantallas y ventanas en compu (español) y celular (hebreo) con el fuente y con la achicada y compara el texto y cómo se dibuja cada elemento: sin una diferencia, y falla si el achicado rompe el JavaScript o un estilo; `csp_publicada_test` usa lo achicado | Cada visita nueva y cada publicación lo bajan entero; quien viaja con datos lentos es quien más lo siente, y cada tanda lo agranda. | **usuario** (D21) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Y4 | ~~**Las horas de un evento no dicen en qué zona están.** Todo evento con hora se crea en Calendar con la zona del calendario compartido (hoy Argentina, GMT-3, `zonaDelCalendario()`), sea cual sea el lugar; el formulario y las tarjetas muestran «09:00–17:00» sin más. Una visita en Ciudad de México cargada con la hora de allá queda 3 horas corrida para los invitados de Calendar; para alguien en Israel, «15:00» de una reunión virtual es ambiguo. Verificado en el código; **no probado con una invitación real de Calendar**.~~ ✅ 20/11 (D22-A): el formulario dice «🕘 Hora de Buenos Aires, la del Calendar del equipo» (`#cZonaHoraria`, con la zona del calendario compartido) y la hora de cada tarjeta lo dice al pasar el dedo. No se cambió qué zona usa Calendar: la nota nombra la del calendario compartido y, si todavía no se leyó, la del aparato (la misma con la que se crea el evento). `zona_horaria_test` | Es un equipo repartido en varios países y husos; el 6/10 (I5) se arregló que la hora no cambie sola, no que se sepa de qué zona es. | **usuario** (D22) |
| Y5 | ~~**«Tendencias» muestra cambios que son puro azar** con el volumen del equipo. Se pusieron 12, 24, 40 y 80 actividades al azar (sin ninguna tendencia por construcción) en 12 equipos de cada tamaño: **la tarjeta aparece en 11 de 12 y en 12 de 12** y siempre trae algo como «Chile 4 → 0 *se apagó*» o «Visita 6 → 3 ▼ −3». Los mínimos de hoy (8 actividades en 180 días; 3 en un tramo) están pensados para otro volumen.~~ ✅ 20/11 (D23-A): «Tendencias» muestra un cambio de lugar o de tipo solo si es mayor que el azar (z ≥ 3) y, si no hay ninguno, dice «Nada cambió más de lo que podría ser azar» o «Todavía hay pocos datos para hablar de tendencias». Con 12 equipos al azar por tamaño pasó de **12 de 12 con cambios inventados a 0 de 12**. `tendencias_azar_test` (y `tendencias_test`, con la exigencia anterior apagada para seguir probando lo suyo) | Alguien puede decidir «retomar Chile» por una diferencia de tres actividades. | **usuario** (D23) |
| Y6 | ~~**Reportes cuenta como «sin actividad» los meses de antes de que el equipo usara el sistema.** Con un equipo que empezó en octubre: «Sugerencias para 2027 — No hubo actividad en enero, febrero, marzo, abril, mayo, junio, julio, agosto y septiembre: conviene planificar algo para esos meses», nueve barras en cero en «Mes a mes» y «Solo el 0% de las actividades tiene participantes».~~ ✅ 20/11: los meses sin actividad se cuentan desde el primer mes con algo cargado, y sin ningún participante dice «Ninguna actividad tiene participantes cargados» en vez de «Solo el 0 %». `reportes_sugerencias_test` | Recomienda planificar meses que ya pasaron, y hace parecer que el equipo estuvo parado. | Claude |
| Y7 | ~~**Administración › Personas dice «Nunca entró» (y suma a «Inactivos») de alguien que entró hace 12 días** cuando el registro de actividad tiene más de 1.000 acciones nuevas: la app carga solo las últimas 1.000 (`subscribeRecent(1000)`) y de ahí saca el último ingreso de cada uno. Probado con 1.500 acciones más nuevas. No hay una columna de «última vez» en la base.~~ ✅ 20/11: `supabase/28-ultimas-entradas.sql` (`ultimas_entradas()`, solo admin, devuelve un correo y una fecha) y la app la pide aparte; ya no depende de las últimas 1.000 acciones. `ultima_entrada_test` (1.500 acciones más nuevas) y `supabase/pruebas/69-ultimas-entradas.sql` (6 comprobaciones: solo admin, sin nombres ni detalles) | Con 25 a 30 personas activas, 1.000 acciones son menos de un mes: la pantalla empieza a mentir justo cuando más hace falta. | Claude |
| Y8 | ~~**El botón «Atrás» del celular saca de la app.** La app no usa el historial del navegador (solo `replaceState` para limpiar la dirección): de la ficha de un país, «Atrás» deja la página; también cierra de golpe una ventana abierta. Probado.~~ ✅ 20/11: la app usa el historial del navegador: cada cambio de pantalla (solapa, ficha de un país) suma una entrada y «Atrás» vuelve; una ventana abierta suma otra y «Atrás» la cierra (como Escape); cerrar con un botón no deja una de más; desde el Inicio «Atrás» sale de la página, como en cualquier sitio. `atras_test` | Es el gesto más natural en un teléfono. | Claude |
| Y9 | ~~**Un texto a medio escribir se pierde al recargar** (evento, rutina y respuesta: 3 de 3). No hay borrador guardado. En el celular el navegador recarga solo al volver de otra aplicación.~~ ✅ 20/11: lo que se escribe (rutina, título y comentarios de un evento, una respuesta) se guarda en el aparato mientras se escribe, vuelve al recargar y se borra al publicar, al cerrar sesión y al entrar con otra cuenta; un evento que se está *editando* no se guarda. Con el almacenamiento lleno todo sigue andando. `borradores_test` | Se pierde un texto largo escrito en un viaje. | Claude |
| Y10 | ~~**El buscador no mira lo que se habló ni lo que dice el Cierre.** `matchesTextFilter` mira título, comentarios, autor, participantes, lugar y alcance. No mira las respuestas del hilo, el resumen que sale de un Cierre (objetivos, pasos, resumen ejecutivo), los hitos de un proyecto ni los nombres de archivo. Probado: «portón» (en una respuesta), «motivado» (en un resumen) y «Presupuesto aprobado» (un hito) dan «Sin resultados».~~ ✅ 20/11: el buscador mira también las respuestas del hilo, el resumen de un Cierre (resumen ejecutivo, objetivos, pasos), los hitos y los nombres de archivo; los mensajes automáticos del sistema no cuentan. `buscador_enlace_test` | La cadena documento → resumen → ficha es lo más valioso de la memoria (informe de diseño y uso, 6/10): hoy se llega por el título, no por lo que dice. | Claude |
| Y11 | ~~**No hay «Copiar enlace» de un evento**, aunque el enlace (`?post=`) ya existe: lo usan los correos y la columna «Enlace» de la planilla.~~ ✅ 20/11: «🔗 Copiar enlace» en el menú ⋯ de cada actividad (el mismo `?post=` de los correos, sin lo que la dirección ya traiga); si el portapapeles no se puede usar, el aviso trae el enlace para copiarlo a mano. `buscador_enlace_test` | Es un equipo que vive en WhatsApp: mandar «mirá este evento» es lo primero que se pide. | Claude |
| Y12 | **Sin conexión no se ve nada y no se puede instalar en el celular** (no hay `serviceWorker` ni manifiesto; ya figuraba en ESTADO como «solo si algún día se habilita»). Lo nuevo es el motivo: en una visita (aeropuerto, interior) es cuando se necesita el próximo evento, el plan y el teléfono de la Agenda. | Verificado en el código. Cuánto pasa en la práctica lo sabe el usuario. | **usuario** (D24) |
| Y13 | ~~**El recorrido de bienvenida** (`tourSteps()`) tiene 11 pasos (el de Gastos tiene 56 palabras y el de Reportes 62) y **dos prometen «Tendencias»**, que con menos de 8 actividades en 180 días no aparece en ninguna parte. Verificado en una cuenta nueva de un equipo chico, compu y celular.~~ ✅ 20/11: el recorrido se reescribió con el vocabulario nuevo (D25) y los dos pasos que prometían «Tendencias» (Inicio y Reportes) ahora dicen «con suficientes actividades» / «con suficientes datos»; `tour_test` | Es lo primero que ve cada cuenta nueva; promete lo que no está. | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| Y14 | ~~`agenda_ventanas_test` («celular: «Rab a cargo» se lee entero en su campo») **da rojo siempre en este sandbox**, también con la página de hace un día; en GitHub pasa («Publicar el sitio» salió verde para `9769ab8`). Una prueba que siempre falla acá enseña a ignorar el rojo, y la regla D12 pide «todas, siempre». Hacerla robusta a la letra del sandbox (RECURRENTES, «Lo que entra justo acá…»)~~ ✅ 20/11: la prueba mide el ancho con la letra de la marca (Montserrat); si la máquina no la puede bajar (este sandbox no llega a fonts.gstatic.com) lo dice y salta esa medición, y en GitHub, que sí la baja, se mide como siempre. Ya no da rojo acá (D12: todas, siempre) | Claude |
| Y15 | ~~Falsas alarmas de las herramientas: 12 «teléfonos» (los números de los dibujos SVG del logo) y cuatro textos~~ ✅ 20/11: `seguridad` ya no mira dibujos ni identificadores de ceros; las demás, en `conocidos.json` con su porqué | Claude |
| Y16 | ~~Una dirección inventada con el dominio de verdad del equipo (la de «Fabi Finanzas») en tres pruebas de Gastos. La regla pide `@x.com`~~ ✅ 20/11: las tres pruebas de Gastos usan una dirección con `@x.com` | Claude |
| Y17 | ~~`firmar()` pide **todas** las direcciones de adjuntos en una sola llamada (`createSignedUrls`, sin partir): con miles de adjuntos, la primera carga en un aparato nuevo es un pedido muy grande. **No verificado contra la base real** (la de mentira no lo modela); mirarlo si el medidor de «Copia de seguridad» pasa de unos pocos cientos de MB~~ ✅ 20/11: `firmar()` pide las direcciones en pedidos de hasta `FIRMAS_POR_PEDIDO` (no una llamada con todos los adjuntos); `sb_test`. Contra la base real sigue sin verificarse | Claude, cuando haga falta |
| Y18 | Lo de siempre y ya anotado: ~~`diasEntre` y `csvDeTabla` sin usar~~ ✅ 20/11 (borradas; ver código W); 12 anchos de pantalla en el CSS; funciones largas (`crearSupabaseStore`, `textoDelPdf`, `renderFichaLugar`). Lo que queda no se toca: juntar los anchos cambia el diseño entre ellos y partir las funciones es riesgo sin ganancia para quien usa el sistema | Se deja anotado |

### Para el usuario

| # | Qué | Opciones (la recomendada primero) |
|---|---|---|
| D20 | ✅ 20/11: **A** (la recomendada). **¿Qué pasa si dos personas editan el mismo evento?** (Y2) | **A**: cada una guarda solo lo que cambió, y si la otra tocó lo mismo, se avisa. **B**: se avisa «alguien lo cambió mientras editabas» y se vuelve a abrir. **C**: dejar como está |
| D21 | ✅ 20/11: **A** (la recomendada). **¿Hacemos más liviana la página?** (Y3) | **A**: al publicar, se le sacan los comentarios y los espacios (no se cambia nada de cómo se escribe ni se prueba: lo que se prueba es lo publicado). **B**: además, Gastos en un archivo aparte que se baja al entrar a Gastos. **C**: dejar como está |
| D22 | ✅ 20/11: **A** (la recomendada). **¿De qué zona son las horas de un evento?** (Y4) | **A**: de Buenos Aires para todo (como hoy), pero escrito junto a la hora y en las tarjetas. **B**: la del país del evento (más cambios, Calendar lo acepta por evento). **C**: dejar como está |
| D23 | ✅ 20/11: **A** (la recomendada). **¿Qué hacemos con «Tendencias» cuando hay pocas actividades?** (Y5) | **A**: se muestra solo cuando el cambio es más grande que el azar, y si no alcanza dice «todavía hay pocos datos». **B**: se deja, con una nota «con pocas actividades un cambio de 2 o 3 puede ser azar». **C**: sacarla del Inicio y dejarla solo en Reportes |
| D24 | ✅ 20/11: **C** (nada por ahora; se puede volver a decidir). **¿Instalable en el celular y con algo sin conexión?** (Y12) | **A**: instalable (ícono, pantalla completa, más rápida), sin sin-conexión. **B**: lo de A, y poder ver la Agenda y lo próximo sin conexión. **C**: nada por ahora |

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

- **El peso**: la página que se publica baja **515 KB** comprimidos (el fuente pesa 755; Y3 y código W), bajo el límite de
  600. Cargar en un celular 4 veces más lento, el primer posteo a los 0,94 s; 6 veces, 1,52 s; la compu, 0,23 s.
  `codigo.mjs` lo mide en cada auditoría.
- **Vence**: `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN` 30/9/2027.
- **Workflows**: «Publicar el sitio» salió verde para `fc8b9cc` (20/11, 21:23 UTC), ya con la página achicada. El intento
  anterior (`fc32a80`) no salió por una prueba de tiempos de Gastos que solo falla en GitHub (se arregló en la app y en la
  prueba; `RECURRENTES.md`) y siguió en línea la versión anterior. «Base de datos» aplicó `28` y `29` en Supabase. Calendar, copias
  y resúmenes, en verde.
- **Ramas**: `main` y la de esta sesión (el usuario puede borrarla).
- **Un solo admin**: la lista de Personas muestra un solo admin. Las aprobaciones de
  cuentas, las rendiciones propias (D17) y compartir Calendar dependen de una persona.
  Conviene que haya un segundo admin; lo decide el usuario (no hace falta código).

## Lo que no pude verificar desde acá

- **Un teléfono de verdad** (D8, T10): el teclado, la cámara, «Atrás» y los borradores se
  probaron en un Chromium con el tamaño del celular, no en un iPhone ni en un Android.
- **Una invitación real de Calendar con la hora de otro país** (Y4): está en el código.
- **El correo «Ya podés entrar» (Z4) por Resend, de verdad**: las pruebas cubren lo que la app pide, lo que la base decide y
  cómo se arma el correo en cuatro idiomas, pero desde acá no se manda un correo real. La primera vez que se apruebe a alguien,
  conviene mirar que le llegue.
- **Las funciones SQL `28` y `29` en la base real**: se aplicaron (el workflow «Base de datos» salió verde), pero «Verificar los
  permisos» (a mano, solo lee) todavía no se corrió contra ellas.
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

Esta auditoría empezó **sin arreglar nada** (solo las herramientas) y terminó arreglando todo, en dos
subidas a `main`, el mismo 20/11/2026:

1. **Primera subida:** Y1 (la columna del costado) y Z1 (el primer toque en «Publicar»), que eran lo más
   visible y se podían probar solos.
2. **Segunda subida, todo junto** (a pedido del usuario: «todos los arreglos juntos y subidos juntos, de manera
   directa»): Y2 a Y11, Y13, Y14, Y16 a Y18 y Z2 a Z6, con las decisiones D20 a D27 contestadas, más la revisión
   de seguridad, el código muerto y las optimizaciones (código W, al final). **Queda abierta solo Y12** (sin conexión
   e instalable: el usuario eligió «nada por ahora», D24-C).

Cada arreglo entró con su prueba, en rojo contra el código de antes. Nuevas, en `herramientas/pruebas/`:
`columna_lateral`, `toque_publicar`, `edicion_simultanea`, `tendencias_azar`, `reportes_sugerencias`,
`ultima_entrada`, `atras`, `borradores`, `buscador_enlace`, `toque_controles`, `zona_horaria`, `acceso_aviso` y
`achicar`; en la base, `69` y `70`; en las funciones, el bloque `acceso` de `_pruebas/avisos.mjs`. Cambiar ~320
textos por el vocabulario nuevo (D25) obligó a actualizar el texto que esperaban 13 pruebas viejas, y dejó dos frases
que habían quedado sin sentido («17 actividades en 3 actividades» pasó a «17 veces en 3 actividades»). Al probar todo junto
aparecieron además **dos errores de armado** que ninguna prueba chica habría visto (una página de prueba con lista fija de
nombres y una función aislada que no conocía una función nueva: `RECURRENTES.md`) y **un tropiezo real**: con los botones
nuevos de 44 px, la ventanita de «Responsable» podía dejar el botón pegado al borde de arriba en el celular (el navegador
mueve la página solo después de que la app revisó); ahora la app vuelve a revisar cuando ese movimiento terminó.

La primera publicación de la segunda subida **no salió**: GitHub, que es más lento que el sandbox, encontró una
comprobación de 5.186 (`gastos_test`, «el foco vuelve a la lista») que miraba el foco en el mismo instante en que
se guardaba el dato, antes de que la lista terminara de dibujarse. Se arregló en la app (si la lista tarda, el
foco se reintenta unos instantes: también ayuda en un celular lento) y en la prueba (espera en vez de exigirlo
en el acto), y se volvió a subir. La versión anterior siguió en línea todo ese rato, que es para lo que existe
ese portero (U1).

Las herramientas: `masa.mjs` (la masa crítica; ya cuida Y1, Y2 y Y5 a Y10 y los controles chicos, y exceptúa los enlaces
dentro de un texto como pide WCAG 2.2), `codigo.mjs` (ahora mide lo que **se publica**, ya achicado, contra el límite de
600 KB), dos falsas alarmas corregidas en `seguridad` y cuatro anotadas en `conocidos.json`; patrones nuevos en
`RECURRENTES.md` y filas actualizadas en `METODO.md`.

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
| Z1 | ~~**En el celular, el primer toque en «Publicar» de «Nuevo evento» no hace nada.** Con un campo de texto con el foco (el «Dónde», por ejemplo), `html.teclado .modal{…}` (índice, ~5142) cambia el relleno, el alto y la posición del cuadro al soltar el foco: el botón sube entre 29 y 46 px entre que se apoya el dedo y se levanta, y el toque cae en otra parte. Probado con un toque simulado en 844, 740, 661 y 600 px de alto: **nunca publica al primer toque**; con el mouse en la compu, sí. La rutina de una línea y «Responder» andan. Es el **T10 del 28/10** («sin verificar en un teléfono»): se reproduce siempre y a cualquier alto, no solo en pantalla corta. Sigue sin verificarse en un teléfono de verdad (D8)~~ ✅ 20/11: **la causa**: al apoyar el dedo en «Publicar», el foco pasa del campo al botón y `focusin` apagaba `html.teclado` en el acto, entre `mousedown` y `mouseup` (el `mouseup` y el `click` caían en un `div`). Ahora `vigilarTeclado` no apaga el modo teclado mientras hay algo apoyado y lo apaga cuando el toque terminó (con el clic ya entregado, y con un seguro de 1,5 s si el toque se corta). `toque_publicar_test` (un toque, no un clic; a 844, 740, 661 y 600 de alto, más «el modo teclado no se queda trabado» y «de un campo a otro sigue prendido»: falla contra la página de antes en 8 comprobaciones) | Es el botón principal del flujo principal: se toca, no pasa nada, y no hay mensaje. Se toca de nuevo y anda: parece que el sistema se colgó | Claude (con una prueba con `touchscreen.tap`) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| Z2 | ~~**Ninguna prueba mide el tamaño de lo que se toca.** En el Inicio del celular, 26 de 100 controles miden menos de 44 px y 8 menos de 24: «Me gusta» 19×36 y «Responder» 17×36 (juntos, en cada tarjeta), el nombre de una persona 92×15, «📄 2/3» 63×21, «⋯» 40×30, «ver quién dio Me gusta» 19×36. En Reportes, 15 filas de 336×15 que se tocan para ver esas actividades; en el Calendario, las flechas 34×32 y «+ Nuevo evento» 96×23; «¿Cómo funciona?» 116×15; los tres botones de la cabecera 36×36. WCAG 2.2 AA pide 24×24 (o espacio alrededor) y 44 es lo recomendado~~ ✅ 20/11: en el celular, «Me gusta», «Responder», «⋯» y «ver quién dio Me gusta» miden 44×44 (el área crece con relleno: el dibujo no cambia), lo secundario 32 de alto y las flechas del Calendario 40×40; la compu no cambia. `toque_controles_test` y la comprobación de `masa` (que ahora exceptúa los enlaces dentro de un texto, como pide WCAG 2.2) | Es lo que más se toca en un teléfono, con un dedo, en movimiento. Agrandar el área de toque con relleno invisible no cambia cómo se ve | Claude |
| Z3 | ~~**La misma cosa se llama de cinco maneras.** En los 3.247 textos en español: *actividad* 139 veces, *evento* 98, *posteo* 63, *registro* 34, *rutina* 23. Y la pantalla de inicio es «Inicio» en la pestaña y «Feed» en cuatro textos («Ver en el Feed», «se filtra el Feed», «Sale al Feed al instante»): «Feed» es una palabra en inglés que nadie del equipo usa. «Países» tiene adentro las ciudades, las zonas, el mapa y la Agenda de teléfonos~~ ✅ 20/11 (D25-A): «actividad» para todo (rutina, visita, curso… son tipos de actividad), «Inicio» y nunca «Feed», «posteo» y «registro» (para las actividades) desaparecen de las pantallas: ~320 textos en los cuatro idiomas, el recorrido incluido. Los nombres de afuera (el registro de actividad, un posteo de código) no se tocaron. `tour_test` y toda la suite | Alguien nuevo no sabe si «posteo», «registro» y «actividad» son lo mismo; el recorrido de bienvenida lo cuenta de una manera y la pantalla de otra | **usuario** (D25) |
| Z4 | ~~**Nadie le avisa a quien pidió acceso que ya lo aprobaron.** Los correos que existen son: pedido (al admin), posteo, respuesta, paso, gasto, rendición, informe y prueba; ninguno es «ya podés entrar». La pantalla de espera dice «se actualiza sola» (solo si la deja abierta) y «Suele tardar menos de un día». Tampoco dice a quién escribirle~~ ✅ 20/11 (D26-A): al aprobar un pedido (o dar acceso por adelantado) sale el correo «Ya podés entrar a Toldot», en el idioma de la persona y con el botón a la app. La base lo decide (`supabase/29-aviso-de-acceso.sql`: solo un admin, solo a alguien aprobado hace menos de 15 minutos, una vez por persona, 30 por hora). `acceso_aviso_test` (falla contra la página de antes), `supabase/pruebas/70-aviso-de-acceso.sql` (11) y `_pruebas/avisos.mjs` (idiomas, hebreo de derecha a izquierda, un nombre con HTML no se cuela) | Quien pide entrar cierra la pestaña y no vuelve. Es la primera impresión del sistema | **usuario** (D26) |

### Bajo

| # | Qué | Quién |
|---|---|---|
| Z5 | ~~**La barra de abajo del celular es solo íconos de emoji** (casa, calendario, mapa, ≡), sin una palabra. El del Calendario dibuja siempre «17 de julio» (es el dibujo del emoji) y «Países» es un mapa. Proyectos, Gastos y Reportes están a dos toques, detrás de «Más» (Gastos es lo que se usa en un viaje). Los emoji también cambian de dibujo según el aparato~~ ✅ 20/11 (D27-A): la barra de abajo del celular tiene su palabra debajo de cada ícono (Inicio, Calendario, Países, Más) y un dibujo propio para el Calendario. `app_dom_test`, `tour_test` | **usuario** (D27) |
| Z6 | ~~La casilla «No pasarlo a Google Calendar» de «Nuevo evento» está redactada al revés: se tilda para **apagar** algo, y lo normal es tildar para prender. Mejor «Solo en Toldot»~~ ✅ 20/11: la casilla dice «Solo en Toldot (sin Google Calendar)» y se tilda para prender, no para apagar | Claude |
| Z7 | Lo que se vio y está bien, para no tocarlo: la entrada (una sola acción, «¿Es tu primera vez?» en una línea, idiomas a mano), «Rechazada» con «Pedir acceso de nuevo», la Agenda con el botón verde de WhatsApp, la «Lectura rápida» de cada país, Proyectos con «Marcar cumplido» en el mismo lugar, y los toques para cargar: **una rutina, 2; un evento con lugar, 6** (el +, «Nuevo evento», título, lugar, elegir el lugar, Publicar) | Se deja |

### Para el usuario

| # | Qué | Opciones (la recomendada primero) |
|---|---|---|
| D25 | ✅ 20/11: **A** (la recomendada). **¿Cómo le decimos a lo que carga el equipo?** (Z3) | **A**: «actividad» para todo (rutina, visita, curso… son tipos de actividad), «Inicio» y nunca «Feed», y «posteo» desaparece de las pantallas. **B**: solo cambiar «Feed» por «Inicio». **C**: dejar como está |
| D26 | ✅ 20/11: **A** (la recomendada). **¿Le mandamos un correo a quien pidió acceso cuando lo aprueban?** (Z4) | **A**: sí, uno corto: «Ya podés entrar», con el botón a la app (a la dirección con la que pidió, la de Google). **B**: no; la pantalla de espera dice «el administrador te avisa» y quién es. **C**: dejar como está |
| D27 | ✅ 20/11: **A** (la recomendada). **¿Le ponemos palabras a la barra de abajo del celular?** (Z5) | **A**: sí, el nombre debajo de cada ícono (Inicio, Calendario, Países, Más) y un dibujo propio para el calendario. **B**: dejar los íconos solos |

### Herramientas y patrones

`masa.mjs` suma dos comprobaciones del celular: el primer toque en «Publicar» (Z1) y los controles de
menos de 24×24 px en el Inicio (Z2). Dos patrones nuevos en `RECURRENTES.md`.

---

## Agregado: seguridad, código muerto y optimizaciones (20/11/2026, a pedido del usuario) — código W

Pedido del usuario, junto con el de arreglar todo y subirlo junto: «revises la seguridad del
sistema, así como entender si hay código muerto o cuestiones que se podrían optimizar». Se
hizo sobre todo lo de esta tanda, mirando lo que cambió desde las revisiones de seguridad del
24/10 y del 28/10: Gastos (15 al 19/11), el lector de comprobantes, los avisos por correo y lo
de hoy. Lo que ya estaba revisado y resuelto (S1 a S13, D10 a D13) no se vuelve a proponer.

### Seguridad: nada urgente ni importante

| Qué se miró | Cómo | Resultado |
|---|---|---|
| **La base** | La suite SQL entera (1.315 comprobaciones); Gastos a mano: las 5 tablas con RLS, las 18 funciones `security definer` con `search_path` fijo; lo nuevo de hoy (`28` y `29`) | Todo en verde. `ultimas_entradas()` y `preparar_aviso_de_acceso` son solo para admin; la primera devuelve un correo y una fecha, la segunda no manda a nadie que no se haya aprobado hace menos de 15 minutos |
| **La función `avisar`** (recibe pedidos de afuera) | Leída entera, con el tipo nuevo `acceso` | Dos pasos: la base decide con la **sesión de quien llama** y recién después se leen los datos con la llave de servicio; sin sesión, 401; CORS con lista exacta (`team-latam.github.io` y `localhost`); un nombre con HTML no se cuela al correo (prueba). Sin cambios que hacer |
| **La página: datos que entran al HTML sin escapar** | Cada interpolación nueva de esta tanda (`git diff -U0 -- index.html` con `${` y sin `esc(`) | Todas son texto fijo, números o van con `esc()`. El enlace de «Copiar enlace» va con `encodeURIComponent` y el aviso lo muestra con `textContent` |
| **Lo que se guarda en el aparato** | Los borradores (Y9) | Texto en claro en `localStorage`, como cualquier borrador del navegador: se borra al cerrar sesión y al entrar con otra cuenta, así que no le queda a la persona siguiente. No guarda lo de un evento que se está editando |
| **La CSP y los servidores de afuera** | `seguridad` y la CSP completa | Sin servidores nuevos; la huella de cada script se calcula **sobre lo achicado** y `csp_publicada_test` lo prueba (arranca, no frena nada propio, un script colado no corre) |
| **Los workflows** | Permisos, entornos y qué paso usa llaves | Sin cambios de permisos; S9/D11 sigue vigente (las llaves solo para `main`). Lo nuevo es un paso `npm ci --ignore-scripts` en «Publicar el sitio» |
| **La cadena de publicación (nueva)** | `esbuild` al publicar | **Riesgo aceptado, con las trabas puestas:** una librería de la cadena puede cambiar lo que se publica. Versión exacta (0.24.2), `package-lock.json` con huella (npm la verifica en `npm ci`), sin scripts de instalación, y dos pruebas sobre lo que sale (`achicar_test`, `csp_publicada_test`). Es el mismo nivel de confianza que ya tiene Playwright |
| **Datos de personas en el repo** | `seguridad` | Un solo aviso: el correo de una cuenta de prueba que aparecía **en este mismo documento** (Y16): se sacó |

**Lo que no se pudo verificar desde acá:** la base real (nunca se toca desde acá) y un correo
real por Resend. Después de subir esto, el workflow «Verificar los permisos» (Actions → Run
workflow, a mano, solo lectura) confirma en la base de verdad que `28` y `29` quedaron como en
el laboratorio.

### Código muerto

- **Borrado:** `diasEntre` y `csvDeTabla` (anotadas desde el 24/10 como «solo las usa una
  prueba»). La prueba del CSV se pasó a `celdaCsv`, que sí se usa (la defensa contra fórmulas,
  M11, sigue probada).
- **Revisado y no hay más:** de los 1.949 nombres de nivel superior de `index.html`, ninguno
  otro sin uso (cinco aparecían una sola vez y tres se usan con `...`: ver `RECURRENTES.md`);
  ni clases de CSS ni ramas del despachador sueltas (`codigo`).
- **Se deja anotado, no se toca:** los 12 anchos de pantalla distintos del CSS (juntarlos
  cambia el diseño entre esos anchos) y las funciones más largas (`crearSupabaseStore`, 1.243
  líneas; `textoDelPdf`, 315; `renderFichaLugar`, 306). Partirlas es riesgo sin ganancia para
  quien usa el sistema.

### Optimizaciones

| | Antes | Ahora |
|---|---|---|
| **Lo que baja cada visita** (comprimido) | 755 KB (Y3: pasaba el límite de 600) | **515 KB** (−32 %); sin comprimir, de 2,5 a 1,8 MB |
| **Bajar la página** con 4G lento / con 3G | 3,9 s / 15 s | **2,6 s / 11 s** |
| **El primer posteo en la pantalla**, celular 4 veces más lento | 1,05 s | **0,94 s** |
| **El primer posteo en la pantalla**, celular 6 veces más lento | 1,67 s | **1,52 s** |
| **El primer posteo en la pantalla**, en una compu | 0,23 s | 0,23 s (sin cambio: la compu no lo nota) |

- **Descartado, con el motivo:** renombrar variables y funciones (~10 % más; la app busca cosas
  por su nombre y no vale el riesgo), partir Gastos en un archivo aparte (la opción B de D21,
  no se eligió) y el servicio sin conexión (D24-C, nada por ahora).
- **Para mirar cuando el equipo crezca (no es de hoy):** cada persona abre 18 canales de
  tiempo real; el plan gratis de Supabase tiene un tope de conexiones que no pude consultar desde
  acá. Conviene mirarlo en el panel cuando el equipo pase de unas pocas decenas.
