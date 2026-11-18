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
> si falta algo antes de la etapa 2 (Drive). El 18/11 pidió adelantar la **etapa 4** (los PDF de entrega y el
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
  - **Borrar varios gastos juntos**: «Seleccionar» en una rendición o en «Sin vincular» (con dos o más que se puedan
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

### Etapa 4, los PDF de entrega (18/11, en la rama; va a `main` con el OK del usuario)

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
  en su renglón. **Nunca el nombre de quien rinde** (regla de su skill): en «Quién pagó» dice «Quien rinde»,
  «Organización» o el nombre de la otra persona. Los conceptos y las observaciones no se traducen (la pantalla lo
  dice). El hebreo va de derecha a izquierda, con las columnas espejadas.
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
