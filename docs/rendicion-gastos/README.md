# Gastos y rendiciones — el módulo nuevo (en construcción)

> **Estado (15/11/2026):** la **etapa de prueba** tiene la base (`supabase/27-gastos.sql`, 137 comprobaciones en
> `supabase/pruebas/71-gastos.sql`) y las pantallas (`herramientas/pruebas/gastos_test.mjs`), **publicadas en
> `main` el 15/11 con el OK del usuario y apagadas**: nadie las ve hasta que un admin prende el interruptor de
> Administración → Gastos. El **lector de comprobantes** se publicó el 15/11, también con el OK del usuario.
> Los arreglos de la revisión de diseño (la lista nueva, borrar, el lector de PDF con texto) se publicaron el 15/11,
> también con su OK, y el 16/11 los montos contables, el tipo predicho y borrar una rendición vacía (con una regla
> nueva en la base); después, borrar una rendición entera o varios gastos juntos y la ventana del gasto rediseñada.
> El 16/11 también: la ventana sin el cartel del lector y más compacta, las flechas para pasar de un gasto a otro y
> la nota de la moneda local; el 17/11, elegir la moneda y las listas largas con una ventanita que busca, y lo
> aprobado como texto, que el admin fijo lo pueda borrar, el comprobante opcional en la cuenta corriente y los
> avisos de «te observaron un gasto» (campanita y correo): **con eso la etapa 1 está completa**. Lo que sigue
> (elegido por el usuario el 17/11): cargar un viaje real entero en el sistema, en paralelo con la skill, para ver
> si falta algo antes de la etapa 2 (Drive). El 18/11 pidió adelantar la **etapa 4** (publicada ese día: los PDF de entrega y el
> cambio de moneda; ver «Etapa 4» más abajo) y después volver a la 2 y la 3. **Cada parte que sigue va a `main` recién
> con el OK explícito del usuario**, con capturas: es lo que se acordó, y es una excepción a la regla general de
> «pushear a `main` de una» de `CLAUDE.md` (al llegar a `main`, la base real se actualiza sola).

El usuario rinde hoy sus gastos de viaje y de rutina con una skill de Claude que lee los comprobantes de su
Drive, los carga en un Google Sheet y arma los PDF de entrega. Quiere que **el sistema** haga eso y quede todo
conectado con las actividades, sin depender de Claude ni de la skill. Lo que se acordó salió de una
conversación pregunta por pregunta (15/11/2026); acá está entero.

**Sin datos sensibles.** El proceso de la skill tiene el ID del Sheet, el enlace de la carpeta de Drive, la
cuenta de Gmail y las terminaciones de las tarjetas: **nada de eso va a este repo, que es público** (está en la
skill del usuario y, cuando haga falta, en secretos o en configuración). Por eso las notas del proceso y del
diseño que trajo el usuario no están acá: solo esta y la revisión del proyecto
([`03_revision_del_proyecto.md`](./03_revision_del_proyecto.md), del 17/10, parte de la cual quedó superada
por lo de abajo).

## Lo que se decidió

**Cargar**
- Se suben fotos o PDF de cada gasto, **uno o muchos juntos**, desde el celular o la compu (las dos pantallas
  importan). Agregar desde un enlace, más adelante.
- El sistema **lee** el comprobante y **sugiere** fecha, concepto, tipo, monto, moneda, forma de pago y
  tarjeta; quien carga **confirma o cambia**. Nunca decide solo. Lo dudoso se marca para revisar.
- La lectura es la **simple y sin costo**, en el propio dispositivo (no se mandan las imágenes a ningún
  servicio). Se probó con 19 comprobantes reales del usuario (15/11): fechas 16 de 19, montos 14 de 19 bien
  tratados; los 3 montos mal leídos se detectan con reglas (tres decimales, la suma que no cierra). El lector
  se arma de forma que se pueda cambiar después (por el de Google, si hace falta) sin rehacer nada.
- **Cómo se carga el lector** (decidido el 15/11, «opción 1» de tres): sus piezas se guardan en el sitio
  (`herramientas/publicar/lector/`) y no se traen de afuera; corre en un trabajador aparte del navegador, así
  que la página no necesitó permisos nuevos. Las otras dos opciones eran traerlo de un servidor de afuera (dos
  piezas sin control de huella: descartada) o el lector de Google Drive (mejor lectura, pero necesita antes la
  conexión con Google de la etapa 2): se puede comparar cuando esté esa conexión.
- **El nombre del archivo** en Drive lo arma el sistema con el concepto confirmado: `D-M-AAAA - Concepto - Actividad.pdf`.
  Los datos del gasto viven en sus campos; el nombre no es de donde salen.

**A dónde va cada gasto**
- A un **evento** en el que la persona **participó** (figura como participante o lo cargó); si falta, un admin
  la suma. O a **«la Rutina del mes»** de esa persona (un grupo por mes y por persona, como las carpetas
  «Rutina» de hoy).
- Si el evento todavía no está cargado, el gasto se sube **«sin vincular»** y se asigna después.
- No hay gastos personales puros: todo termina en una rendición.

**La plata**
- Cada gasto dice **quién puso la plata**: la organización (a la persona no se le debe nada) o la persona (de
  su bolsillo o de un adelanto: entra en su cuenta corriente).
- **Monedas:** cada gasto guarda la del comprobante. El monto en dólares **lo escribe la persona** con lo que
  le cobró su banco; **nunca** una cotización de afuera. Una actividad suele rendirse en dólares más una moneda
  local; los totales van por moneda. Las más comunes: las latinoamericanas, dólar, euro y shekel.
- **Tipos de gasto:** arrancan los siete de hoy (Reunión, Comida, Pasaje, Alojamiento, Transporte, Compra de
  material, Suscripción); un admin los suma, saca o cambia.
- **Cuenta corriente** por persona y por moneda: lo gastado, lo recibido (adelantos y reintegros), lo devuelto
  y el saldo. La persona puede anotar lo que recibió; un admin lo confirma.
- **Total rápido:** se puede anotar cuánto se gastó en una actividad sin cargar el detalle. Vale el detalle;
  si no coinciden, el sistema avisa y la persona puede confirmar que vale el total a mano. Cada uno anota lo
  suyo; un admin puede anotar o corregir el total general de la actividad.

**Quién ve y quién aprueba**
- **Cada persona ve solo lo suyo** (gastos, comentarios, cuenta). Los admins ven todo. Más adelante podría
  haber otro nivel de permiso para aprobar.
- La persona **manda la rendición** de una actividad entera; un admin la revisa, puede **observar** un gasto
  con un comentario (le llega un aviso **por la campanita y por correo**), la persona corrige y la vuelve a
  mandar, y el admin **aprueba todo junto**.
- **Estadísticas:** todo el equipo ve los números grandes **agrupados** (por país, mes, tipo de actividad,
  año), nunca el total de una actividad suelta; el admin ve también el total por actividad.

**Google**
- Los comprobantes quedan guardados **en el sistema y en Drive** (los dos frentes): primero en el sistema, y
  la copia a Drive se hace sola después (si Google falla, el comprobante no se pierde). Una subcarpeta por
  persona dentro de cada actividad. La conexión con Google será con **un permiso que se da una sola vez**.
- El objetivo final es que el sistema también **cargue el Sheet** (mostrando antes las filas exactas y con
  aprobación) y **arme los PDF** de entrega.
- Lo cargado en 2026 **no se importa** por ahora: se arranca de cero.

**Poder volver atrás:** un interruptor en Administración prende o apaga el módulo; las tablas son aparte (no
tocan eventos, comentarios ni la Agenda); se hace por etapas chicas; Drive y el Sheet no se tocan sin el OK.

## Las etapas

1. **Prueba** (en curso): solo admins, apagable. Comprobantes y gastos, confirmación, mandar, observar y
   aprobar, cuenta corriente y total rápido. Sin Drive ni Sheet. Las reglas de privacidad ya quedan armadas:
   abrirlo al equipo es prender `app_config 'preferences' → gastos.abierto`.
2. Copia a Drive.
3. Carga al Sheet, con aprobación.
4. PDF de entrega.
5. Abrirlo a más personas, y las estadísticas.

### Etapa 1, por partes

- [x] **Base de datos** (publicada el 15/11): `supabase/27-gastos.sql` — cuatro tablas (`gastos_rendiciones`,
  `gastos`, `gastos_comentarios`, `gastos_movimientos`), las reglas de quién ve y toca qué, los pasos de una
  rendición (`gastos_rendicion_abrir`, `_enviar`, `gastos_observar`, `gastos_comentar`,
  `gastos_rendicion_aprobar`), la cuenta (`gastos_cuenta`, `gastos_movimiento_confirmar`) y los comprobantes en
  el bucket (`gastos/<id del gasto>/…`). La limpieza semanal del bucket sabe que se usan; la copia de
  seguridad y la restauración las incluyen; van en vivo. Pruebas: `supabase/pruebas/71-gastos.sql` (y se cae si
  se rompe la privacidad, los estados, los comprobantes o la cuenta).
- [x] **Las pantallas** (publicadas el 15/11, apagadas): con el interruptor de **Administración → Gastos** prendido
  (`preferences → gastos.prendido`, cuya forma controla `gastos_config_ok`), un admin ve **«🧾 Gastos»** en el
  menú de su foto (en el celular, en «Más»):
  - *Mis rendiciones*: subir muchos comprobantes juntos (fotos o PDF; el mismo dos veces no se repite; la fecha
    y el concepto salen del nombre del archivo cuando lo traen), los «sin vincular», cada rendición con sus
    gastos, el total del detalle, el total rápido y «Mandar la rendición».
  - La ventana de un gasto: el comprobante y sus datos para confirmar o corregir, a qué actividad o rutina va, y
    para un admin, «Observar» con un comentario.
  - *Cuenta corriente*: el saldo por moneda, los movimientos y «Anotar plata recibida o devuelta» (un admin
    mira la de cualquiera y anota ajustes).
  - *Para aprobar* (admins): lo mandado, la plata por confirmar y lo que espera corrección.
  - En Administración → Gastos, también los tipos: renombrar, dejar de ofrecer y sumar.
  Lo prueba `herramientas/pruebas/gastos_test.mjs`; el recorrido de bienvenida lo anota en `TOUR_SIN_PASO`
  (solo lo ven los admins) hasta que se abra al equipo.
- [x] **El lector de comprobantes** (publicado el 15/11): al subir, lee cada comprobante en el fondo (las
  fotos, los PDF escaneados con una foto adentro, como los de CamScanner, y —desde los arreglos de la revisión—
  los PDF con texto de verdad) y completa **solo lo vacío**: fecha, monto, moneda, tarjeta, forma de pago, comercio (como
  concepto) y tipo. Un «$» solo se toma como la moneda del país de la actividad, para revisar. La ventana
  dice qué completó, marca lo sugerido y lo dudoso, y tiene «Leer el comprobante» para uno subido antes. El
  lector nunca confirma. Lo prueban `lector_texto_test.mjs` (tickets inventados de seis países),
  `lector_test.mjs` (leyendo de verdad) y `lector_integridad_test.mjs`. La primera vez baja unos 6 MB.
- [x] **Revisar en lista** (publicado el 15/11 con el OK del usuario; lo pidió él, opción B): en una rendición o en «Sin
  vincular», todos los gastos por confirmar en filas editables (con la foto chica del comprobante, fecha,
  concepto, tipo, monto, moneda, el monto en dólares y quién pagó) y una casilla por fila; vienen marcados los
  completos y sin dudas del lector. «Confirmar los marcados» confirma los que tienen todo, guarda sin confirmar
  lo editado sin marcar y deja en la lista, con lo que falta, los incompletos. En «Sin vincular», a dónde
  llevar los marcados. Lo prueba `gastos_test.mjs`.
- [x] **Arreglos de la revisión de diseño** (publicados el 15/11 con el OK del usuario): el usuario vio un
  PDF abierto como texto crudo y no encontraba cómo quitar un comprobante mal subido, y pidió revisar el diseño
  (la crítica dio 23/40). Eligió arreglar los tres urgentes y ver la lista con la foto grande:
  - **El PDF** se abre como documento en el visor (en el celular, en una pestaña aparte); el visor ya no
    intenta leer como planilla un archivo de tipo desconocido. Al subir un PDF escaneado se guarda también la
    foto de adentro, que se ve en la lista y en la ventana.
  - **Borrar**: cada gasto que todavía se puede tocar tiene su 🗑️ en la fila de la rendición y «Borrar» en la
    lista, siempre preguntando. Cerrar la ventana o irse de la lista con cambios sin guardar también pregunta.
  - **La moneda**: «Subir comprobantes» pregunta antes **de qué son** (una actividad, la rutina de un mes o
    «todavía no sé»), así el lector sabe el país y la moneda; después se ve esa rendición. La moneda que salió
    de un «$» queda dudosa y la fila no viene marcada en la lista hasta revisarla. En la lista, «La misma moneda
    a todos». Al mandar, avisa (y deja mandar igual, lo eligió el usuario) los gastos en otra moneda sin el monto
    en dólares. El total de una rendición cuenta solo lo confirmado y dice cuántos quedan afuera.
  - **La lista** muestra el comprobante grande al lado de cada fila; sin nada marcado, el botón dice «Guardar sin
    confirmar» y espera a que haya algo.
  - **La lista, más ordenada** (lo pidió el usuario después, mirando la captura): los campos en una grilla pareja,
    dos vistas para elegir —**«Lista»**, una fila chica por gasto (miniatura, qué es, cuánto y qué le falta o qué
    revisar) que se despliega al tocarla, y **«Con foto»**, todas abiertas con el comprobante mediano; cada
    navegador recuerda la elegida— y los botones flotando abajo mientras se recorre. Revisando en lista no se ven
    el total, el total rápido ni «Mandar»: vuelven al salir. En la rendición, «Revisar en lista» y «Subir
    comprobantes» van juntos arriba de los gastos. Después, también a pedido suyo: la casilla de cada fila va
    sin la palabra «Confirmar», en su columna a la izquierda (lo abierto queda debajo, alineado), con «Marcar
    todos» arriba en la misma columna; y cada fila tiene sus **observaciones**, como la columna de su skill
    (se ven en el resumen de la fila cerrada). En la skill, las observaciones llevan además la tarjeta y el
    monto en moneda local («VISA 1234. Gasto por UYU 1.250.-»): eso el sistema ya lo tiene en sus campos, así
    que al cargar el Sheet (etapa 3) se puede armar solo, sin escribirlo a mano.
  - **El lector, con tres PDF reales del usuario** (15/11; se usaron solo en la sesión, no están en el repo):
    el de Uber y la cuenta del hotel son PDF con texto adentro, que el lector salteaba: ahora se lee ese texto
    directo (sin el lector de fotos ni bajar nada, `textoDelPdf`), y se aprendió de ellos la fecha en inglés
    («Feb 3, 2026»), que en un recibo de Uber el comercio es Uber y el tipo transporte, que en Panamá el «$»
    es dólar, que en un hotel vale la llegada y que «Guest Folio» o «Thanks for riding» no son el comercio. El
    de la cena es un escaneo del iPhone largo y angosto con el total en letras grandes, que el lector se
    salteaba: si no aparece un renglón con «total» y un número, lee la foto de nuevo más chica, y ese monto
    queda para revisar. Con los tres: fechas, montos y comercios bien. Lo de la foto larga se comprobó a mano
    con el comprobante real (con tickets dibujados el lector no se equivoca igual); lo demás lo prueba
    `lector_texto_test.mjs` con PDF y recibos inventados con la misma forma.
  Lo prueban `gastos_test.mjs`, `lector_test.mjs` y `lector_texto_test.mjs`. Quedan de la crítica, para más adelante: el comprobante dentro
  de la ventana en el celular y que la cuenta corriente se entienda mejor.
- [x] **Más pedidos del usuario mirando la pantalla** (publicados el 16/11 con su OK):
  - **Borrar una rendición vacía**: una ✕ en la tarjeta de una rendición propia, abierta y sin gastos ni total
    rápido (quedó de elegir una actividad o de una subida), preguntando; y una subida que no deja ningún
    comprobante no deja la rendición que abrió. En la base (`27-gastos.sql`), cada persona puede borrar la suya
    mientras está abierta (antes, solo el admin fijo); vacía siempre, porque los gastos la sostienen.
  - **Los montos, contables como en su Sheet** («"$"#,##0.00»; lo eligió entre esto y el estilo de acá): coma para
    los miles, punto para los centavos, siempre dos decimales, con la moneda chica al lado y alineados a la
    derecha (los decimales quedan uno abajo del otro), en las filas, los totales y la cuenta corriente. En los
    campos se escribe como uno quiera («1250», «1.250,50», «1,250.50») y al salir se acomoda.
  - **«Organización»** en «¿Quién pagó?» (en vez de «la organización»).
  - **El tipo, predicho**: primero por lo que la persona ya cargó con ese mismo concepto; después por las
    palabras del concepto o del título del archivo (la que aparece primero: «Taxi al hotel» es transporte; un
    almuerzo de reunión, comida, como en su skill; las apps de viaje); al final, por la primera palabra en lo
    ya cargado. Al subir, cuando el lector completa el concepto y mientras se escribe (si el tipo está vacío o
    lo había puesto la sugerencia), y queda marcado para revisar.
- [x] **Borrar más y la ventana nueva** (publicados el 16/11 con el OK del usuario):
  - **Borrar una rendición entera**, aunque tenga comprobantes: «Borrar esta rendición (con sus N gastos)» al pie de
    una rendición propia que todavía se puede corregir, preguntando. Lo hace de una vez una función nueva de la base,
    `gastos_rendicion_borrar`: la persona, la suya abierta u observada; el admin fijo, cualquiera en esos estados;
    una mandada o aprobada, nunca. Los archivos quedan sin fila y los saca la limpieza semanal.
  - **Borrar varios gastos juntos** (desde el 18/11, con las casillas siempre a la vista: ver el punto 10 más abajo): «Seleccionar» en una rendición o en «Sin vincular» (con dos o más que se puedan
    tocar), una casilla por fila, «Todos», y «Borrar N» abajo, preguntando.
  - **La ventana de un gasto, rediseñada** (lo pidió para aprovechar el espacio y mostrar distinto): ancha, con el
    comprobante grande a la izquierda y los datos a la derecha; el concepto primero, el monto destacado con su moneda
    (y el monto en dólares abajo, si es otra), fecha y «Va en» juntos, y el tipo, quién pagó y la forma de pago con
    botones a la vista. En el celular, todo en una columna con el comprobante arriba.
- [x] **La ventana de un gasto, sin carteles y más compacta** (publicado el 16/11 con el OK del usuario):
  sacó el cartel «📖 El lector completó: …» (y el de «Del nombre del archivo salió…»): lo completado se ve en las
  marcas de cada campo (celeste, sugerido; amarillo, para revisar); si «Leer el comprobante» no encuentra nada, lo
  dice una línea chica bajo el comprobante. Para que entre todo sin bajar, aun en una laptop: el concepto arriba, al
  lado del estado, como un título que se escribe ahí mismo; el monto en dólares en la misma fila que el del
  comprobante; quién pagó y la forma de pago lado a lado; «Tiene factura» bajo el comprobante (es sobre el papel).
- [x] **Pasar de un gasto al de al lado sin cerrar** (publicado el 16/11; lo pidió el usuario, como en el visor de
  fotos y PDF): en la compu, flechas a los costados de la ventana (las mismas del visor) y las flechas del teclado
  fuera de los campos, con «2 de 3» arriba; recorren la lista que se está mirando (la rendición, «Sin vincular» o
  «Revisar en lista»), en el mismo orden. Con algo escrito sin guardar, pregunta antes de pasar. En el celular no
  hay flechas (la ventana ocupa la pantalla).
- [x] **La nota de la moneda local en «Observaciones»** (publicado el 16/11; lo pidió el usuario): si el gasto fue en
  otra moneda y también tiene el monto en dólares, arriba de sus observaciones dice «Gasto en MX $ 642.-», como la
  escribe él en su Sheet (sin centavos, «.-»; los pesos con su país: MX $, AR $, UY $…; las demás, su símbolo o su
  código). Sale sola de los montos y no se guarda escrita, así que nunca queda vieja si se corrige un monto; al cargar
  el Sheet (etapa 3) va adelante de lo que escribió la persona. Se ve en la ventana, en la lista y en el resumen.
- [x] **Elegir la moneda y las listas largas** (publicado el 17/11; lo pidió el usuario: las listas eran interminables
  y, con una moneda ya puesta, la lista del navegador mostraba solo esa): la misma ventanita que la de «Responsable».
  En la moneda, tocar el campo la abre entera aunque ya tenga una: arriba «Las que más usás» (por sus gastos, con el
  dólar siempre) y abajo todas, con su nombre; escribir busca por código o nombre, Enter o tocarla elige, Escape deja
  la que había, y salir con Tab después de buscar toma la resaltada. «Va en», «Llevar los marcados a» y «La cuenta
  de», en la compu, con un buscador arriba; en una pantalla táctil, el selector del teléfono. Lo prueban
  `gastos_test.mjs` y `selectores_test.mjs`.
- [x] **Lo aprobado, más claro y borrable; el comprobante de la cuenta corriente** (publicado el 17/11 con el OK
  del usuario; lo pidió ese día mirando un gasto aprobado):
  - Un gasto que ya no se corrige (mandado, aprobado o de otra persona) se ve como texto: el monto grande, cada
    dato con su nombre y las observaciones solo si hay, en vez de los campos y botones apagados. Arriba dice por
    qué no se cambia («Aprobado el 16 de nov…: ya no se cambia»).
  - Con la ventana angosta (una laptop con las flechas, 1024 px) «¿Quién pagó?» y «Forma de pago» no entraban de a
    dos y aparecía una barra para correr de costado: ahora cada uno va en su renglón, y el monto en dólares baja
    abajo del otro.
  - El **admin fijo** puede borrar lo ya mandado o aprobado: un gasto (desde su ventana), varios («Seleccionar») o
    la rendición entera, también desde «Para aprobar». Antes de borrar avisa que sale de la cuenta corriente de
    esa persona o que estaba en revisión. La base lo deja solo a él (`gastos_rendicion_borrar` y la regla
    `gastos_borrar`); un admin por rol, no.
  - En la **cuenta corriente**, cada movimiento puede llevar un comprobante (opcional): una foto o un PDF de la
    transferencia o el recibo, al anotarlo o después («📎 Adjuntar comprobante»), y se ve con «📎 Ver el
    comprobante». Va en `gastos/mov-<id>/`; lo sube quien puede corregir el movimiento (la persona mientras está
    pendiente; un admin, siempre) y lo ven ella y los admins. La limpieza semanal del bucket lo cuenta como usado.
- [x] **Los avisos de «te observaron un gasto»** (publicado el 17/11 con el OK del usuario; ese día eligió
  terminar la etapa 1 con esto y después cargar un viaje real entero en paralelo con la skill):
  - **La campanita**: «Gastos para corregir», arriba de todo, con quién lo observó, en qué rendición y qué pidió;
    cuenta en el globito mientras no se abre, tiene su filtro «Gastos» y tocarlo abre el gasto en su rendición. Se
    va solo cuando se corrige y confirma. Sale de los datos que la app ya tiene (no hay nada guardado aparte).
  - **El correo**: al observar, la app del admin le pide a la función `avisar` el aviso; la base
    (`preparar_aviso_de_gasto`, 27-gastos.sql) decide si corresponde: un admin, sobre un gasto observado que no
    es suyo y con su comentario de recién; la persona tiene que poder ver sus gastos y recibir correos, y no
    haber apagado «Gastos que me observan» (Mis preferencias → Notificaciones, `emailGastos`). Una vez por
    comentario, al momento aunque haya elegido el resumen. El correo (`correoGasto`, en los cuatro idiomas) dice
    el concepto, el monto, la fecha, la actividad o la rutina del mes, y lo que hay que corregir.
  - **Su botón** «Ver el gasto» lleva a `?gasto=<id>`: la app abre ese gasto apenas llegan los datos (a un admin,
    desde «Para aprobar») y limpia la dirección.

- [x] **«Otra persona» pagó, y reabrir una rendición aprobada** (publicado el 18/11 con el OK del usuario; lo
  decidió ese día):
  - En «¿Quién pagó?», además de «Yo» y «Organización», **«Otra persona»**: alguien que participó de la actividad
    (o, en la rutina del mes, alguien del equipo) puso la plata. Se elige quién (`gastos.pago = 'otro'` y
    `pago_quien`, su correo o su nombre); sin decir quién no se confirma. No entra en ninguna cuenta corriente
    (`gastos_cuenta` cuenta solo `pago = 'persona'`). Está en la ventana, en «Revisar en lista», en la fila y en
    el resumen de lo aprobado.
  - **Reabrir una rendición aprobada**, para un comprobante que llegó tarde: solo un admin
    (`gastos_rendicion_reabrir`), con «↩️ Reabrir» en la rendición aprobada y avisando que sus gastos salen de la
    cuenta corriente hasta que se apruebe de nuevo. Vuelve a «abierta» y sus gastos a «confirmado». «Para
    aprobar» muestra abajo las aprobadas de los últimos 60 días, para llegar a ellas. En un gasto de un mes cuya
    rutina ya se aprobó, «Va en» lo dice: un admin la puede reabrir, o va en la rutina de otro mes.

- [x] **Revisión de UX de todo el módulo** (publicada el 18/11 con el OK del usuario; pidió «UX de toda la parte
  de gastos», la revisión dio 28/40 y eligió hacer las cinco prioridades y los detalles):
  - **La rendición**: el título es el del viaje o la rutina (antes se repetía «Mis rendiciones»); debajo, su
    **camino en cuatro pasos** (Cargar → Confirmar → Mandar → Aprobada, lo eligió el usuario; «Corregir» si la
    observaron, «En revisión» mientras la miran) y **una barra con lo que sigue y un solo botón**: «Subir
    comprobantes», «Revisar y confirmar», «Ver el gasto observado», «Mandar la rendición», «Aprobar la rendición»
    o «Reabrir». «Subir más» y «Seleccionar» son links chicos arriba de la lista (antes eran tres botones del
    mismo peso que el principal, y «Mandar» quedaba gris abajo de todo).
  - **El celular**: en cada fila el monto y el estado van debajo del nombre (la 🗑️ queda, la había pedido el
    usuario) y las tres secciones entran juntas, con su número.
  - **Los botones**: «Confirmar» la plata es un botón como los demás principales; «Dejar de ofrecer» un tipo es un
    link; borrar un movimiento es una 🗑️ con su nombre; el «+» de nuevo evento no aparece en gastos en la compu
    (tapaba botones).
  - **La cuenta corriente**: «Anotar plata recibida o devuelta» está detrás de un botón; en cada tarjeta la
    moneda va una sola vez, arriba; lo recibido y lo devuelto van sin signo (el «−500.00» confundía); el ajuste
    sí lo lleva.
  - **Detalles**: un gasto mandado dice «En revisión», como su rendición, y uno confirmado «Confirmado» (antes
    «Mandado» y «Listo»); el total dice «(no suma el que falta)»; la ayuda de «Revisar en lista» va en un
    renglón; «Sin vincular» ya no tiene el borde punteado (parecía una zona para soltar archivos).

### Etapa 4, los PDF de entrega (publicada el 18/11 con el OK del usuario)

El usuario pidió adelantarla antes de Drive y el Sheet («Se puede avanzar a la etapa 4 luego volver a las
demás?») y eligió: **los dos documentos** (el PDF de cada actividad y el resumen por mes), **los idiomas se
eligen** (español, inglés, portugués y/o hebreo), **solo de una rendición aprobada**, y **el cambio de moneda
ahora**, junto con los PDF. El formato es el de la rendición que arma hoy con su skill.

- **El cambio de moneda** (parte A): «Anotar un cambio de moneda» en la rendición — cuánto entregó, cuánto
  recibió (con la comisión adentro), la fecha y el comprobante. No es un gasto: va aparte
  (`gastos_cambios`, en `supabase/27-gastos.sql`). En un gasto en efectivo en esa moneda, la ventana ofrece
  pasarlo a dólares con cada cambio («Usar»); no elige sola cuál, como pide su rendición (no se promedia).
- **El PDF de una actividad** (botón «📄 PDF de entrega» en la barra de la aprobada): sus comprobantes en el orden
  de la lista, cada página con un **sello rojo** arriba a la derecha («N° 3», la actividad y el mes, y
  «pág. 1/2» si el comprobante tiene varias). El sello va en una franja propia: **no tapa nada** del comprobante.
  Un PDF entra entero (nítido, no como foto). Al final, **la planilla** en cada idioma elegido (A4 apaisada, las
  columnas de la suya: N° comp. · Fecha · Concepto · Actividad · Tipo · Moneda · Monto · Pago · Quién pagó ·
  Factura · Observaciones, con la fila del total), debajo el **subtotal por tipo** y la tabla de **los cambios**
  (con su tasa), y como **anexo** el comprobante de cada cambio. Se baja como «<actividad> - <Mes Año>.pdf».
- **El resumen por mes** («Resumen de gastos por mes (PDF)» en *Mis rendiciones*, debajo de las aprobadas):
  desde y hasta; una fila por actividad aprobada (con cuántos comprobantes), una columna por tipo y el TOTAL
  USD (y «Otras monedas» si algo se rindió en otra), el subtotal de cada mes y el TOTAL FINAL; debajo, los cambios.
- **Cómo se llena la planilla**: «Actividad» con las cuatro del Sheet (Congreso → Seminario; Virtual y Otro →
  Rutina); el monto es el rendido (en dólares; si no lo tiene, el del comprobante en su moneda); el peso
  mexicano, «MX»; en «Observaciones», la tarjeta, «Gasto en UY $ 790.-» y lo que escribió la persona, cada uno
  en su renglón. En «Quién pagó», **el nombre de quien rinde** (lo decidió el usuario al ver el ejemplo: «aquí no
  hay problema que aparezca mi nombre»), «Organización» o el nombre de la otra persona; el nombre no va en el título,
  en los sellos ni en los datos del PDF. El hebreo va de derecha a izquierda, con las columnas espejadas.
- **Se traducen** (lo pidió el usuario al ver el ejemplo) los conceptos, las observaciones y el nombre de la
  actividad, a cada idioma elegido, con **el traductor que trae el navegador** (Chrome en la compu, desde la
  versión 138): corre en el aparato, así que los textos no salen de ahí, y la primera vez el navegador baja el idioma.
  De qué idioma es cada texto lo dice el detector del navegador (si duda, castellano). Donde no hay traductor (el
  celular, Safari, Firefox) van como se escribieron y el panel lo dice antes de bajar; si el traductor no contesta,
  el PDF sale igual y la pantalla avisa qué no se tradujo. Otra opción, si hiciera falta traducir también desde el
  celular, es el traductor de Google desde la base (con una llave que el usuario cargaría en Supabase).
- **Cómo se arma**: en el aparato de quien lo baja, con pdf-lib (libre, guardada en
  `herramientas/publicar/pdf/` y servida desde el mismo sitio, como el lector; `pdf_integridad_test.mjs`). Las
  hojas las dibuja el navegador y van como imagen (así el hebreo sale bien). Si un comprobante no se puede leer,
  en su lugar va una hoja que lo dice (el número no se saltea) y la pantalla avisa.
- Pruebas: `herramientas/pruebas/gastos_pdf_test.mjs` (arma PDF de verdad y los vuelve a leer) y, la del cambio,
  `supabase/pruebas/71-gastos.sql` y `gastos_test.mjs`.

**Visto al armar las pantallas (15/11), para decidir más adelante:** ~~si la rutina de un mes ya se aprobó, un
gasto nuevo de ese mes no tiene dónde ir~~ — **decidido el 18/11**: lo decide la persona cada vez, con un
administrador: o un admin reabre la rutina aprobada y se suma ahí, o va en la rutina de otro mes (ver «Reabrir»
más arriba). Y el total general de una actividad que corrige un admin (la «C» del total rápido) todavía no está: hoy cada
uno anota el suyo; va con las estadísticas (etapa 5).

**Decidido después (15/11):** un admin **puede aprobar su propia** rendición (en la prueba el único que carga
es el admin; al abrirlo al equipo se puede revisar que la apruebe otro). El **total rápido no mueve la cuenta
corriente**: es para los números grandes, porque no dice quién puso la plata.

## Lo que anotó el usuario al probarlo (desde el 18/11)

Lo fue dejando mientras revisaba la versión publicada. **Hecho el 18/11 en una tanda** (en la rama; va a `main` con su
OK y capturas de antes y después). Eligió: el PDF de una, sin panel; «Anotar solo el total» como nombre único; y lo
que llega tarde, al final del PDF con los números que siguen. Cómo quedó cada punto:
- **1** — el cartel de la subida se va solo al terminar (subir y leer) y deja un aviso pasajero (el mismo de la app,
  que ahora espera si el mouse está encima); queda solo si algo no subió. Lo que el lector no pudo leer lo dice su
  fila («No se pudo leer: completalo a mano»). Lo mismo el aviso de «Revisar en lista» y el «listo» del PDF.
- **3** — el cambio: «Entregaste» y «Recibiste», cada uno con su moneda al lado; la tasa justo debajo; sin tarjeta
  adentro ni título; el comprobante como link «(opcional)»; de entrada, la fecha en que empieza la actividad y la
  moneda de su país; sin la explicación de arriba.
- **4** — «Anotar solo el total» en todos lados («Total anotado: …» después), debajo de los cambios, y en una
  rendición vacía la barra ofrece «Subir comprobantes» y, al lado, «o anotar solo el total».
- **5** — «Descargar el PDF de entrega» en la barra de la aprobada; el avance en el botón; la nota de la traducción
  solo si hace falta. El resumen por mes, en un desplegable de *Mis rendiciones*. Los idiomas, primero como cuatro
  botones al lado; al verlos («sigue sin gustarme»), eligió entre dos maquetas **un botón con flecha** que abre un
  menú con los idiomas, y pidió que con 3 o 4 no engorde: la flecha dice las siglas hasta dos («ES · HE ▾») y, con
  más, cuántos («4 idiomas ▾»). Una rendición reabierta sin nada nuevo se vuelve a mandar desde su barra.
- **6** — reabrir: lo aprobado sigue aprobado (base: `aprobado_el`; al mandar y aprobar, solo lo nuevo o corregido);
  la lista muestra «Nuevos o corregidos» y abajo «Ya aprobados», plegados; un admin puede observar uno aprobado.
- **7** — las observaciones al final de la ventana, la última a la vista y «Ver las anteriores»; «Observar» solo para
  un admin que no cargó el gasto y no en uno ya observado; si no, «Responder».
- **Menos texto** — fuera las explicaciones de las tres secciones, de «¿De qué son…?», de «Revisar en lista», de
  los tipos, los «Opcional:…» y las segundas frases de las barras; acortados los avisos al mandar, el del
  comprobante que no subió, el del ajuste y «Nada para aprobar».
- **2** (el PDF de Uber que el lector no leyó) sigue pendiente: hace falta el archivo.

**Anotado después (18/11), para hacer:**
- **8 — «¿De qué son estos comprobantes?» ofrece pocas rendiciones** (con captura: «¿por qué solo me permite estas
  rendiciones?»). Lo arman `opcionesDeVinculo()` y `actividadesParaGastos()` en `index.html`:
  - **La rutina del mes**: solo el mes de la fecha del gasto, el mes actual y el anterior. Antes de subir todavía no
    hay fecha, así que salen dos (noviembre y octubre): un comprobante de septiembre no tiene dónde ir.
  - **Una actividad**: las 40 más cercanas a hoy (o a la fecha del gasto), pasadas o futuras, sin las de tipo Rutina
    ni las canceladas. A un admin le salen **todas las del equipo**, no solo las suyas (por eso aparecen actividades
    ajenas); a una integrante, solo aquellas en las que participó. La búsqueda de la ventanita busca entre esas 40.
  - Propuesta para mostrarle: la rutina de cualquier mes (los últimos 12, y uno más viejo eligiendo el mes); las
    actividades propias primero («Mis actividades») y después las demás; la búsqueda, sobre todas. Y, ya que los
    nombres de sus archivos traen la fecha y la actividad («14-9-2026 - Uber a Reunión - Rutina.pdf»), que al subir
    varios de meses distintos cada uno vaya solo a la rutina de su mes.
- **Hecho el 18/11 con 5 comprobantes reales que mandó el usuario** (4 tickets de café escaneados con el iPhone y un
  recibo de Uber; usados solo en la sesión, no están en el repo): el lector no lee el número enmascarado de ningún ticket
  térmico (sale «Ke)» o números sueltos), así que la ventana del gasto **ofrece las tarjetas que la persona ya usó**
  para tocar, y si usó una sola, la propone (para revisar). En una rutina, el «$» sin país se reconoce por las marcas
  del ticket (RFC, Ciudad de México, «M.N.»; el CUIT argentino) o por la moneda en que la persona suele gastar en sus
  rutinas. Y si el total sale mal leído («$341. 008» salió 8), vale consumo + propina (para revisar). El Uber «a Casa» se
  leyó bien; el que había fallado («a Reunión») queda para ver cuando lo mande. Pruebas: `lector_texto_test.mjs` (con
  tickets inventados de la misma forma) y `gastos_test.mjs`.
- **2 — El Uber «a Reunión», visto (18/11)**: no es el recibo de Uber sino una **captura de pantalla de la app de Uber
  guardada como PDF desde el iPhone** (Creator «Screenshots»). Adentro tiene una sola imagen sin texto, comprimida
  con FlateDecode (no JPEG): 1179×2192, RGB de 8 bits, sin predictor. `fotoDentroDelPdf()` solo saca JPEG
  (DCTDecode), así que no encontraba nada. Para hacer: que también saque esas imágenes (descomprimirlas con
  `DecompressionStream`, armar la imagen en un lienzo y leerla como foto). Probarlo con una captura inventada.
- **Hecho el 18/11 (tanda 3, en la rama; va a `main` con su OK)**:
  - **2** — el lector lee las capturas de pantalla guardadas como PDF: `imagenDentroDelPdf()` saca la JPEG de un
    escaneo o, si no hay, la imagen comprimida común (FlateDecode, en colores o grises, con el perfil de color a una o
    dos referencias, como el del iPhone), la arma en un lienzo y la lee como foto. Se usa al leer y para la vista
    chica. Con el Uber «a Reunión» lee la fecha, el monto y la moneda. Y sin «total» en el ticket, el monto es el
    número con centavos más grande (antes ganaban los cuatro números de la tarjeta, que la app pone pegados al monto).
    Pruebas: una captura inventada en `lector_test.mjs` y el caso en `lector_texto_test.mjs`.
  - **8** — «Van en» ofrece las rutinas de los últimos doce meses (más las que la persona tiene abiertas y el mes
    del gasto); «Mis actividades», todas, primero; y al admin, aparte, «Otras actividades del equipo» (las 40 más
    cercanas). Subiendo a una rutina, **cada comprobante va a la rutina de su mes** (la fecha del nombre del
    archivo), si esa todavía no se mandó; el aviso dice cuántos fueron a cuál. Pruebas: `gastos_test.mjs`.
  - **10** — las casillas, siempre: cada fila de gasto (en una rendición, en «Sin vincular» y en la lista agrupada)
    tiene la suya, sin «Seleccionar» ni la papelera de cada fila; tocar la fila abre el gasto. Abajo, siempre que
    haya gastos, la barra: «Todos», cuántos, **«Descargar Excel»** (una fila por gasto, con su rendición y de quién
    es; con SheetJS, y si no carga, un .csv que Excel abre) y «Borrar» (si hay algo que la persona pueda borrar;
    cuenta solo eso). En el celular la barra va arriba del menú de abajo y dice solo «Excel».
  - **11** — «Mis rendiciones» es ahora la **lista agrupada** (para el admin se llama «Rendiciones» y trae las de todo
    el equipo, con el nombre de quién es cada una): arriba «Sin vincular» y los filtros (desde y hasta qué mes,
    estado y, para el admin, persona); un resumen (cuántas rendiciones y gastos, el total confirmado por moneda);
    cada rendición cerrada, la más nueva primero, que al tocarla despliega sus gastos con casillas y «Abrir la
    rendición →»; y la barra. Un admin que abre la de otra persona desde ahí la ve como en «Para aprobar» (con
    «Aprobar la rendición»). «Todos» elige todo lo de la lista filtrada, también lo de las plegadas. Pruebas:
    `gastos_test.mjs` (y las demás que abrían una rendición desde la lista).
- **10 — La lista de gastos, siempre con las casillas** (18/11, con capturas): que se vea siempre como hoy al tocar
  «Seleccionar» (la casilla en cada fila) y que abajo esté siempre la barra («Todos», cuántos marcados y las acciones,
  apagadas mientras no haya nada marcado); «quizás no en el mismo diseño, pero similar».
- **11 — Ver los gastos viejos y hacer seguimiento** (18/11, con maquetas): «Mis rendiciones» se reemplaza por una
  vista de **todas las rendiciones agrupadas** («Rutina de enero de 2026», «Visita a…»), cada una cerrada con su
  cantidad de gastos, total y estado; al tocarla se abren sus gastos (con las casillas del punto 10) y un link para
  abrir la rendición entera. Arriba, filtros (desde y hasta qué mes, estado) y un resumen (cuántas rendiciones y
  gastos, el total por moneda). **El admin ve las de todos** (lo marcó como importante), con el filtro de persona
  para ir llegando. Abajo, siempre, la barra: «Todos», cuántos marcados, «Descargar Excel» y «Borrar». «Subir
  comprobantes» y mandar cada rendición siguen donde están.
- **9 — Que complete el final de la tarjeta** (18/11, con captura de un ticket de café de Ciudad de México pagado con
  tarjeta de crédito, con el número enmascarado con asteriscos y los cuatro últimos a la vista). El lector leyó el
  total pero no la tarjeta. La regla de hoy (`leerTextoDeComprobante()`: asteriscos, X o «terminada en» y cuatro
  números) ya cubre esa forma, así que lo más probable es que el lector confundiera los asteriscos con otras letras o
  algún número. Propuesta:
  - una regla más amplia: cuatro números al final de una tira larga de signos o letras sueltas, sobre todo en el
    renglón de «tarjeta», «crédito», «débito», AMEX, VISA o Mastercard (sin confundirla con los códigos de
    autorización o de lote, que también son números);
  - **recordar las tarjetas de cada persona**: si los cuatro números leídos se parecen a los de una que ya usó, poner
    esa; y si eligió «Tarjeta» y no se leyó el número, ofrecerle las suyas para tocar en vez de escribirlas;
  - probarlo con tickets inventados que imiten esa forma (nunca con números de tarjetas reales en el repo).
  - Visto en la misma captura: la moneda quedó en USD aunque el ticket es en pesos mexicanos (una rutina no tiene país,
    y el «$» solo no alcanza: se podría usar la moneda de sus rutinas anteriores), y el gasto, del 21/10, quedó en la
    rutina de noviembre (se resuelve con el punto 8: cada comprobante a la rutina de su mes).
- **12 — El final de la lista quedó todo pegado** (19/11, con captura de la versión publicada, en la compu: la última
  rendición, la barra de las casillas, «Resumen por mes (PDF)» abierto y «Anotar solo el total de una actividad»):
  «Pienso que resumen por PDF quedó pegado con lo anterior. Hay que revisar bien todas estas cosas». Para hacer:
  - **la causa de lo pegado**: el margen de abajo que se le puso a la barra (`.gx-selpie{ margin-bottom:14px }`) no
    vale, porque `.gx-lpie{ margin:14px 0 0 }` viene después en los estilos y lo pisa; quedan unos 2 px entre la barra
    y el resumen;
  - **revisar todo el pie de la pantalla, no solo ese espacio**: la barra, cuando no está flotando, se ve como una
    tarjeta más, igual que el resumen de abajo (mismo ancho, borde y sombra), y parecen una sola cosa; el resumen
    abierto no tiene título ni separación propia; «Anotar solo el total de una actividad» queda suelto al final. Ver
    el ritmo entre las secciones (lista, barra, resumen, total), en compu y celular, abierto y cerrado;
  - **pensar si el resumen por mes sigue haciendo falta ahí**: la lista agrupada ya tiene «Desde» y «Hasta», y el
    resumen tiene otros «Desde» y «Hasta» propios. Se podría bajar el resumen de lo que está filtrado (un botón al lado
    de los filtros o en la barra) y sacar el desplegable. Es una decisión del usuario: mostrarle opciones con capturas;
  - una prueba que mida los espacios entre la barra y lo que sigue (que no queden pegados).

- **13 — Separar «Por rendir» de «Rendiciones»** (19/11, mientras se probaba Gastos como tester): «Quizás deberíamos
  dividir, por un lado poner para ver las rendiciones (Rendiciones) y por otro, donde vamos a realizar cada
  rendición». Es la decisión D16 de la prueba de Gastos (`docs/AUDITORIA.md`, sección X, con maqueta), junto con lo
  demás que encontró esa prueba (X1 a X18).

**Para toda la tanda** (18/11: «Hay mucho texto, mucha explicación, podría ser más directo. No es difícil lo que
tenemos que poner»): en todas las pantallas de Gastos, menos texto. Cada botón dice lo que hace; como mucho una
línea corta de ayuda, y solo donde de verdad hay una duda; nada de párrafos que explican lo que la pantalla ya
muestra. Repasar todos los textos del módulo con ese criterio, no solo los de los puntos de abajo.

Lo volvió a decir enseguida: «ponemos muchos mensajes para explicar cosas pero al final no son relevantes». Revisados
los 45 textos largos del módulo (18/11), la propuesta:
- **Sacar** (explican lo que la pantalla ya muestra): el párrafo de *Mis rendiciones* («Subí las fotos o los PDF de
  tus comprobantes, revisá los datos y mandá…»), el de «Cambios de moneda», el del total rápido, el de qué va
  adentro del PDF y el del resumen por mes, el de «¿De qué son estos comprobantes?» (el lector y el «$»), el de
  «Revisar en lista», el de la cuenta corriente («Lo que gastaste de tu bolsillo…»), el de «Para aprobar», la ayuda
  de qué es un ajuste, la de los tipos que se dejan de ofrecer, las de «Opcional: …» debajo de cada comprobante
  (alcanza con «(opcional)» en el botón), la nota de la traducción cuando no hay nada que traducir, y la segunda
  frase de las barras de la rendición cuando el botón ya dice qué hacer («Mandala para que la revise…», «Revisalos
  con su comprobante…», «Un administrador la está revisando. Si te observa algo…»).
- **Acortar a una línea** (dicen algo que hace falta, pero largo): los avisos de gastos sin el monto en dólares al
  mandar, el de un comprobante que no entró al PDF, el de «no se pudo subir el comprobante», el del navegador que no
  traduce y el del total anotado que no coincide con el detalle.
- **Dejar**: las preguntas antes de borrar, mandar o reabrir (avisan algo que no se puede deshacer), los errores, el
  aviso del interruptor en Administración, y lo que va impreso en el PDF (es el formato de su rendición).

1. **Los avisos de la subida tienen que irse solos después de un rato** (18/11: «Mensajes como estos deben
   desaparecer después de un rato, para que la experiencia sea mejor»). Es el recuadro verde que queda arriba
   después de subir comprobantes (`renderSubida()` y `renderEstadoDelLector()` en `index.html`): «✅ Se subieron 10
   comprobantes. Revisá los datos de cada uno y confirmalos.», «📖 El lector completó lo que pudo leer…» y, debajo,
   los que el lector no pudo leer; hoy solo se va con «Listo». La idea para proponerle: lo que es solo buena noticia
   se va solo a los pocos segundos (y no mientras el mouse o el foco están encima, para que dé tiempo a leerlo); lo
   que pide hacer algo (un archivo que no subió, uno que el lector no pudo leer) no se pierde: pasa a la fila de ese
   gasto (por ejemplo, «completalo a mano») en vez de quedar en un cartel. Revisar si otros avisos de Gastos se
   comportan igual (el de la lista, el del PDF listo) y darles el mismo trato.
2. **Para mirar, visto en la misma captura**: un PDF de Uber (un viaje a una reunión de la rutina de septiembre)
   salió como «un PDF sin texto ni foto que se puedan leer». Otros PDF de Uber sí se leen desde el 15/11 (tienen
   el texto adentro): este quizás trae las letras dibujadas o de otra forma. Hace falta ver el archivo (en la sesión,
   sin subirlo al repo) para saber si el lector puede aprender a leerlo.
3. **El formulario de «Cambios de moneda» (UX y diseño)** (18/11: «UX de esto. Mirá cómo está armado y el
   diseño»). Mirado en la compu y en el celular (`renderCambios()` en `index.html`; reusa las clases de «Anotar
   plata» de la cuenta corriente). Lo que no anda:
   - **Dos campos «Moneda» iguales**, cada uno lejos de su monto: en la compu son cinco columnas (fecha, monto,
     moneda, monto, moneda) y en el celular cinco renglones; no se ve qué moneda va con qué monto. Propuesta: dos
     grupos, «Entregaste» y «Recibiste», cada uno con la moneda y el monto juntos en un renglón (como se lee después
     en la fila: «USD 200.00 → UYU 7,800.00»), con la flecha entre los dos.
   - **«Recibiste (ya sin la comisión)»** ocupa dos renglones en la compu y baja su campo (queda desalineado de los
     otros). La aclaración va mejor como ayuda chica debajo del campo: «lo que te dieron en la mano, con la comisión
     ya descontada».
   - **La tasa** («Tasa: 1 USD = 39 UYU»), que es la cuenta que importa, sale abajo de todo, después del comprobante.
     Va pegada a los montos, como resultado de lo que se escribe.
   - **Tarjeta adentro de tarjeta**: el formulario es una tarjeta dentro del desplegable, con su propio título en
     mayúsculas chicas («ANOTAR UN CAMBIO DE MONEDA») que repite lo que ya dice el botón. Que el formulario quede
     dentro del desplegable, sin el segundo recuadro ni ese título.
   - **«Adjuntar comprobante»** es un botón grande en el formulario y un link en la fila ya anotada: el mismo link en
     los dos lados, con «(opcional)», y la ayuda de abajo más corta.
   - **Los valores de entrada**: la fecha sale en hoy (para un viaje de julio hay que cambiarla siempre) y la moneda
     recibida, vacía. Proponer la fecha de comienzo de la actividad y la moneda del país del viaje (la app ya la
     conoce para el lector) o la de los gastos en efectivo de esa rendición.
   - **Los textos**: la explicación de arriba es larga y su ejemplo («dólares por florines») es de Curazao; uno de
     la región se entiende más rápido («dólares por pesos uruguayos»). El ejemplo de «Detalle» («con comisión de XCG
     15») se corta en el celular y suena a que hay que restar la comisión otra vez.
   - Antes de cambiarlo, mostrarle al usuario el antes y el después (compu y celular), como en la revisión de UX
     del 18/11.
4. **El final de la rendición: «Cambios de moneda» y «Total rápido»** (18/11: «es mejor que cambios de moneda esté
   antes que total rápido»; «"Total rápido (sin cargar el detalle)" queda un poco tapado en esta sección. También se
   le puede cambiar o poner otra denominación… Hay que revisar todo este punto»). Hoy son dos desplegables iguales,
   uno abajo del otro, al final de la rendición, y el total rápido va primero. Lo que hay que hacer:
   - **El orden**: «Cambios de moneda» antes que el total rápido (pedido).
   - **El nombre**: la misma cosa se llama de cuatro maneras — «Total rápido (sin cargar el detalle)» (el
     desplegable), «Anotar el total de una actividad, sin comprobantes» (el link de *Mis rendiciones*), «anotar
     solo el total» (la barra de la rendición vacía) y «Total anotado a mano» (lo que se ve después). Elegir una sola
     y usarla en todos lados. Propuesta para mostrarle con opciones: «Anotar solo el total» (es lo que ya dice la
     barra, y dice qué hace sin explicar qué es «rápido»).
   - **Que no quede tapado**: sirve sobre todo cuando no hay comprobantes, y es justo cuando la barra de arriba dice
     «más abajo podés anotar solo el total» y hay que ir a buscarlo. Propuesta: en una rendición sin gastos, la barra
     ofrece las dos cosas («Subir comprobantes» y, al lado, «o anotar solo el total», que abre el formulario ahí
     mismo); con gastos ya cargados, queda abajo como algo secundario, después de los cambios.
   - Revisar también cómo se ve después de anotado (para quien rinde y para el admin) y el aviso de «no coincide con
     el detalle», con el mismo nombre. Antes y después en capturas, compu y celular.
5. **El panel del «PDF de entrega»** (18/11: «Todo esto también se puede mejorar desde lo que es UX»). Hoy: el botón
   de la barra de la aprobada abre una tarjeta grande con un título, un párrafo de qué va adentro, «¿EN QUÉ
   IDIOMAS?» en mayúsculas chicas con cuatro casillas, una nota de dos renglones sobre la traducción y «Cancelar» /
   «Descargar el PDF»; al terminar, un recuadro verde grande de «Listo». Lo que no anda:
   - **Dos pasos para algo que casi siempre es igual**: abrir el panel y después descargar, aunque los idiomas sean
     los de la vez anterior (ya se recuerdan).
   - **Mucho texto para leer antes de actuar**: el párrafo de qué va adentro y la nota de la traducción, que aparece
     aunque no haya nada que traducir (solo español, con todo escrito en español) y habla de bajar el idioma antes
     de que haga falta.
   - **«¿EN QUÉ IDIOMAS?»** en mayúsculas chicas, como etiqueta de arriba; las casillas no se parecen al selector de
     idioma que ya tiene la app (ES · EN · PT · HE).
   - **«Cancelar»** cuando no hay nada que cancelar (no se guarda nada): es «Cerrar».
   - **El «Listo»** queda fijo, grande y verde (lo mismo que el punto 1: los avisos tienen que irse solos).
   - Los emoji como íconos (📄, ⬇️) no combinan con el resto de los botones.
   Propuesta para mostrarle con opciones: **(a, la recomendada)** sin panel: en la barra de la aprobada,
   «Descargar el PDF de entrega» baja de una con los idiomas de la vez anterior, y al lado, chiquitos, los idiomas
   para tocar (ES · EN · PT · HE, como el selector de la app); el avance se ve en el mismo botón («Armando… 3 de 5»)
   y el «Listo» se va solo. La nota de la traducción, solo si se eligió un idioma que hace falta traducir, en una
   línea. **(b)** el panel como está, pero más corto: qué va adentro en una línea (o un dibujito: comprobantes →
   planilla → anexo), los idiomas como el selector de la app, «Cerrar» y la nota solo cuando hace falta. Lo mismo para
   el **resumen por mes** de *Mis rendiciones* (mismo panel, con «Desde» y «Hasta»). Antes y después en capturas,
   compu y celular.
6. **Reabrir: que se revise solo lo que cambió** (18/11: «el único que debería quedar para revisar tiene que ser el
   que tuvo cambio/s, no todos nuevamente»). Hoy `gastos_rendicion_reabrir` (`supabase/27-gastos.sql`) pasa todos
   los gastos de «aprobado» a «confirmado»: al mandarla de nuevo, el admin vuelve a ver todo como si fuera nuevo, y
   mientras está reabierta nada cuenta en la cuenta corriente. El flujo que confirmó (reabrir → abierta → sumar →
   mandar → «En revisión» → aprobar) queda igual; cambia qué se revisa:
   - **Base**: al reabrir, los gastos aprobados **siguen aprobados** (y bloqueados: la persona no los puede tocar).
     Al mandar, solo los nuevos o corregidos pasan a «enviado»; al aprobar, esos. La cuenta corriente cuenta cada
     gasto aprobado aunque su rendición esté reabierta (hoy mira el estado de la rendición, no el del gasto).
   - **Corregir uno ya aprobado**: que el admin lo pueda «Observar» en la rendición reabierta (vuelve a ser
     editable, con su comentario) y entra en la revisión siguiente junto con los nuevos. Así lo que se revisa es
     exactamente lo que cambió.
   - **Pantalla del admin**: arriba, «Nuevos o corregidos (N)» para revisar; abajo, «Ya aprobados (M)», plegados.
     El aviso de «Reabrir» se acorta y deja de decir que los gastos dejan de estar aprobados.
   - **Para decidir con el usuario**: en el PDF, un comprobante que llegó tarde con fecha anterior hoy toma su lugar
     por fecha y corre los números de los demás (el PDF entregado antes ya no coincidiría). Opción: que los que se
     suman después de una aprobación vayan al final, con los números que siguen.
   - Pruebas: en `supabase/pruebas/71-gastos.sql` (lo aprobado no se toca ni vuelve a revisión; la cuenta con la
     rendición reabierta) y en `gastos_test.mjs`.
7. **Las observaciones en la ventana del gasto** (18/11, con captura de un gasto observado tres veces: «Estéticamente
   cuando hay observaciones no queda bien el formulario. Sería mejor que toda la observación quede abajo, de manera
   progresiva. Tampoco tiene sentido que quien cargó el gasto y se lo observaron tenga la posibilidad de él mismo
   observar el gasto, especialmente cuando ya fue observado»). En la ventana (`index.html`, donde se arman `hilo` y
   `puedeObservar`):
   - **Hoy**: el hilo de comentarios va arriba de todo en la columna del formulario, cada uno en su globo, y debajo el
     cuadro amarillo «Observar este gasto»; el monto, la fecha y lo demás quedan empujados hacia abajo, fuera de la
     vista.
   - **Abajo y de a poco**: el formulario primero; las observaciones al final, en una sección «Observaciones (3)» que
     muestra la última y abre las anteriores al tocar, con «Responder» ahí mismo (la base ya tiene
     `gastos_comentar`). Arriba alcanza con el estado «Observado» que ya está junto al concepto.
   - **Quién puede observar**: hoy lo ve cualquier admin si el gasto está mandado u observado, aunque sea suyo (en la
     prueba, el admin carga y se aprueba a sí mismo). Que no lo vea quien cargó el gasto, y que en un gasto ya
     observado no aparezca «Observar» otra vez: lo que quiera agregar el admin va como respuesta en el hilo.

## Lo que quedó para decidir más adelante (no frena la etapa 1)

- ~~El código del peso mexicano~~ — **decidido el 17/11: va «MX»**, como en su Sheet. El sistema lo guarda como
  MXN (el código de tres letras que pide la base) y lo escribe «MX» al cargar el Sheet (etapa 3); la nota de la
  moneda ya dice «MX $».
- **Decidido el 18/11, para cargar el Sheet (etapa 3):**
  - «Actividad»: el Sheet tiene solo Rutina, Visita, Curso y Seminario. **Congreso va como Seminario; Virtual y
    Otro, como Rutina.**
  - Un viaje que cruza dos meses: **el sistema pregunta en cada viaje** si todo va en el mes en que termina o cada
    gasto en su mes.
  - «¿Quién pagó?»: «Yo» es quien hace la rendición; «Organización» queda así, a secas (puede ser DAIA u otra);
    «Otra persona» (en el Sheet, «Otro») es alguien que participó de la actividad y puso la plata: se anota quién
    y no entra en ninguna cuenta corriente (ya está en la app desde el 18/11).
  - **Un gasto, una actividad** (decidido el 18/11): no se reparte un gasto entre dos. Es como ya funciona el
    sistema (cada gasto va en una sola rendición).
  - **Todo junto, y sobre eso filtrar** (decidido el 18/11): el usuario hoy lleva su Sheet por separado, pero
    prefiere que esté todo junto, como una base, y filtrar. En el sistema ya es así; al cargar el Sheet (etapa 3)
    la idea es lo mismo: todos juntos, con una columna de quién rindió, para filtrar por persona, mes o
    actividad. El formato exacto se ve al llegar ahí, con capturas.
