# Rediseño de la interfaz — plan y estado

Las propuestas gráficas (cómo se ve hoy a la izquierda, cómo quedaría a la
derecha) están en https://claude.ai/artifact/VNMcfbw5zaJo8aucTqBHRC. Este
archivo es la lista de trabajo que sale de ahí, para que cualquier sesión
sepa por dónde va. **Cada tanda se marca al terminarla**, con la fecha.

El pedido del usuario (3 de octubre de 2026): hacer las tandas de corrido,
una tras otra, pushear cada una a `main` al terminarla, y frenar solo ante
algo que de verdad necesite una decisión suya.

## Reglas que valen para todas las tandas

- Mismos colores, misma letra (Montserrat), mismo petróleo/celeste: tiene
  que seguir sintiéndose la misma app.
- Todo texto nuevo en los 4 idiomas (`t(es, en, pt, he)`).
- `./pruebas/correr.sh` en verde antes de cada commit; las pruebas que
  comprueban un comportamiento viejo se actualizan al nuevo, con el
  porqué en el comentario.
- Nada de lo que hoy puede hacer alguien deja de poder hacerse: lo que se
  saca de la vista pasa a un menú, no desaparece.
- Los números de las propuestas (comparaciones con 2025, espacio usado,
  etc.) eran de ejemplo; la app muestra los reales.

## Tandas

### 1. Arreglos chicos — HECHO (3 oct 2026)

Pie fijo en el modal de evento, hebreo (dir="auto"), años en orden,
Administrar en celular, ✕ más grandes, + que se esconde al bajar, aviso
del mapa, modo oscuro, campanita, franja de Documentación.

### 2. Posteos y formulario — HECHO (3 oct 2026)

- Tarjeta: a la vista Me gusta, Responder, "N comentarios" y "Ver
  proyecto". Editar, Repetir este evento (nuevo: abre el composer con
  los mismos datos, fechado hoy), Convertir en proyecto, Cancelar evento
  y Borrar están en el menú "⋯" de la esquina; Borrar último y en rojo.
- Formulario de evento: el tipo primero; un solo campo de lugar (el
  alcance) con explicación y "+ Agregar dirección exacta (opcional)"
  que despliega el "Dónde ocurre"; la pista del texto cambia con el tipo.
- Adjuntos: fotos más grandes, archivos y links como fichas con nombre y
  sitio (nunca la URL cruda); la franja de documentación en amarillo
  mientras falta algo, con el botón "Subir X" al lado.
- Pendiente de esta tanda: "Ver traducción" sigue como renglón aparte.

### 3. Calendario — HECHO (3 oct 2026)

- Lo que dura más de tres semanas (proyectos) va una sola vez en la
  línea "En curso" arriba del Mes, la Agenda y la Semana, en vez de una
  barra en cada semana (`separarLargos`).
- Agenda: lo de varios días aparece una vez, con "hasta el …".
- Mes en celular: un punto de color por evento en cada día (sin barras);
  tocar un día muestra su lista debajo de la grilla, con "+ Nuevo
  evento" para ese día. En escritorio no cambia nada.
- Semana/4 días en celular: línea que avisa que se desplaza de costado.

### 4. Países y Reportes — HECHO (3 oct 2026)

- Países: primero los que tienen actividad propia, del que más al que
  menos, cada uno con su última o próxima actividad y una mini-serie de
  los últimos 12 meses; los que no tienen nada propio, plegados abajo
  como fichas (`actividadPorPais`).
- Reportes: cuatro números arriba (actividades, países, personas que
  participaron, personas que cargaron) con la diferencia contra el
  período anterior; en "Mes a mes", una barra fina con el mismo mes del
  período anterior; tocar una fila de país, zona o tipo abre el Feed con
  ese filtro; "Bajar planilla" (CSV que Excel abre, con punto y coma) e
  "Imprimir / PDF" (hoja de impresión sin el cascarón de la app).

### 5. Proyectos — HECHO (3 oct 2026)

- Línea de tiempo con todos los proyectos juntos: una barra por
  proyecto sobre una regla de meses (acotada a 14 meses alrededor de
  hoy), los hitos como rombos de colores y la marca de hoy. Filtro "En
  curso / Completados" y la vista de tarjetas de antes como alternativa.
- Debajo, "Hitos por vencer": los vencidos, de hoy y por vencer de todos
  los proyectos en curso, con "Ver proyecto" y "Marcar cumplido".

### 6. Navegación — HECHO (3 oct 2026)

- 5 pestañas: Inicio, Calendario, Países, Proyectos, Reportes.
- Configuración → "Mis preferencias", desde el menú del avatar.
- Actividad, Usuarios y Administrar → la sección "Administración" con
  menú lateral (Resumen · Equipo: Personas, Registro de actividad · Cómo
  se carga: Zonas y países, Tipos, Lugares, Adjuntos · Sistema: Google
  Calendar). El Resumen: pedidos de acceso para aprobar ahí, lugares por
  sumar, hitos vencidos, cuatro números del equipo este mes, el estado
  del Calendar y el aviso de que no hay copias de seguridad. Las vistas
  de adentro siguen siendo las mismas (`solicitudes`, `auditoria`,
  `preferencias`): el cascarón solo las agrupa.
- En celular: barra inferior (Inicio, Calendario, +, Países, Más) con
  el + en el medio; "Más" abre Proyectos, Reportes, Mis preferencias y
  Administración. El número rojo de pedidos pendientes va sobre el
  avatar y en "Más".
- Quedan para una tanda aparte (no hechas): el buscador general arriba
  y la columna lateral del Inicio en escritorio (próximos eventos, hitos
  por vencer, filtros guardados).

### 7. Administración — HECHO (3 oct 2026)

- Zonas: fichas de país que se arrastran de una zona a otra (el
  selector chico de cada ficha queda para el teclado); antes de guardar
  dice qué cambió ("Bolivia: Norte → Central").
- Tipos: el tilde "Calendar" es un interruptor.
- Personas: columnas alineadas (persona, rol, Calendar, última vez,
  cargó en 6 meses), "Nunca entró" y "hace más de 30 días" en rojo,
  mini-serie de lo que cargó cada uno, "Bajar lista" (CSV).
- Registro de actividad: agrupado por día (Hoy, Ayer, fecha) con la hora
  en cada fila, y "Bajar planilla" (CSV) con lo filtrado.
- Quedan para después (no hechos): el menú ⋯ de cada tipo con archivar
  (toca la forma guardada de los tipos), pre-aprobar un email, la
  sugerencia de separar el Caribe, y registrar lo que se crea, edita y
  borra (toca la base).

### 8. Entrada, espera y avisos — HECHO (3 oct 2026)

- Portada de entrada: qué es el Registro a un lado y la tarjeta de
  "Entrar" al otro, con los tres pasos de la primera vez y los cuatro
  idiomas a mano (en celular la tarjeta va primero).
- Pantalla de espera: "Tu pedido está en camino" con los pasos ya
  cumplidos tildados y el que falta, y un aviso amarillo si se entró con
  una cuenta personal (gmail, hotmail, outlook, yahoo, icloud, live).
  Sin campanita ahí ni en la de sin acceso.
- La pantalla de sin acceso habla de los dos casos (pedido no aprobado
  o acceso quitado) sin acusar: la app no puede distinguirlos desde el
  navegador, así que no hay dos pantallas distintas.
- Campanita: filtros Todo / Menciones / Respuestas / Eventos; lo que
  llegó después de la última vez que se abrió lleva "Nuevo" y fondo
  celeste (la primera vez, todo); los eventos próximos dicen cuántos
  documentos les faltan (los hitos de proyecto no, que no tienen
  documentación propia). No hay botón "marcar todo como leído": abrir
  la campanita ya marca todo como visto, así que sobraba.

### 9. El Inicio en escritorio — HECHO (4 oct 2026)

- Columna lateral a la derecha del Feed (solo de 1024px para arriba):
  próximos eventos (30 días), hitos por vencer y accesos directos (Mis
  posteos, Donde participo, Les falta documentación, Este mes), que se
  suman a los filtros de siempre y se ven como un chip más. Con un
  filtro puesto, "Guardar este filtro" lo deja con nombre en la columna
  (en las preferencias de la persona, hasta 12).
- Buscador general en la barra de arriba (`renderGlobalSearch`): desde
  cualquier pestaña busca posteos, proyectos, países y personas; Enter o
  el último renglón lo pasa como texto al Feed. En angosto no entra:
  ahí sigue el buscador del Feed.
- "Ver traducción" pasó a la fila de acciones de la tarjeta (Me gusta ·
  Responder · …), ya no es un renglón suelto.

### 10. Administración, retoques — HECHO (4 oct 2026)

- Zonas: si las islas del Caribe siguen mezcladas en una zona con otros
  países, arriba aparece la sugerencia de separarlas; "Armar la zona
  Caribe" la crea en el borrador con las 25 islas y queda como cambios
  sin guardar hasta "Guardar cambios". "Ahora no" la esconde en ese
  navegador.
- Tipos: cada tipo tiene su menú ⋯ con Subir / Bajar (el orden en que
  se ofrecen al cargar un evento) y Eliminar, que dice por qué no se
  puede cuando hay posteos con ese tipo. Archivar un tipo (dejar de
  ofrecerlo sin borrarlo) necesita que la base acepte la marca: va en
  la tanda 11.

### 11. Lo que toca la base — HECHO (4 oct 2026)

- El registro de actividad anota también quién cargó, editó (y
  canceló) o borró cada posteo, con «título» y tipo en el detalle
  (`post_created` / `post_edited` / `post_deleted`). Lo escribe la app
  al hacerlo; la base solo se lo acepta a quien puede cargar posteos y
  siempre sobre sí mismo (`audit_crear`, `audit_tipo`).
- Dar acceso por adelantado: en Administración › Personas › Solicitudes,
  el admin carga un correo (y un nombre opcional) y esa persona entra
  directo la primera vez, sin cola. Si ya había pedido acceso, es
  aprobar ese pedido. No necesitó SQL nuevo: un admin ya podía dar de
  alta en `members`.
- Archivar un tipo de actividad (menú ⋯ › Archivar): deja de ofrecerse
  al cargar un evento, pero sigue nombrando a sus posteos viejos y se
  puede desarchivar. La base acepta la marca `archived` (`tipo_ok`);
  se guarda solo cuando es verdadera, así un guardado sin archivar
  nada escribe la misma forma de siempre.

### 12. Revisión estética de Administración — HECHO (4 oct 2026)

- Todas las secciones arrancan igual: título, una línea de para qué
  sirve y, si hace falta, "¿Cómo funciona?" plegado (`adminSeccionTextos`).
  Los párrafos grises largos de arriba de Tipos, Lugares, Adjuntos y
  Calendar pasaron ahí.
- Tipos: una tarjeta por tipo; el ícono en un cuadrado suave (ya no
  parece un campo), el nombre más grande, y debajo "Documentos
  esperados:" con los chips, un campo punteado "+ Agregar documento…"
  (Enter también agrega) y un + chico. Se fueron la franja gris, el
  rótulo en mayúsculas y los seis botones + grandes y brillantes.
- Personas: nombre y email en un renglón (con puntos suspensivos si no
  entran) y el pill de "Invitación enviada" sin partirse.

### 13. Personas y Tipos como lista + ficha — HECHO (3 oct 2026)

Las opciones se compararon en https://claude.ai/artifact/2vtYrPhNKwsbqN8FqX16Jq
(Personas A, Tipos C, las dos recomendadas, elegidas por el usuario).

- Personas: la lista muestra solo foto, nombre, email, el rol como
  etiqueta y cuándo entró por última vez; los grupos de arriba son
  Todos / Admins / Sin Calendar / Inactivos. Al tocar a alguien se abre
  su ficha a la derecha (en celular, a pantalla completa con "← Personas")
  con el rol, el Calendar, la actividad (última vez, posteos, mini-serie),
  "Ver perfil", "Ver lo que cargó" (el Feed filtrado por esa persona) y,
  aparte, la "zona de cuidado" con "Quitar acceso…".
- Tipos de actividad: la lista muestra ícono, nombre, los documentos
  resumidos, si va al Calendar y cuántos posteos; al tocar uno, su
  ficha con nombre, ícono, el interruptor del Calendar, los documentos
  esperados (lista con ✕ y "Nombre del documento…" + Enter), Subir /
  Bajar y la zona de cuidado (Archivar / Desarchivar, Eliminar solo si
  no tiene posteos). "+ Agregar tipo" abre la ficha de uno nuevo. Todo va
  al borrador y se guarda con "Guardar cambios", que avisa "Cambios sin
  guardar" mientras haya algo.
- La acción principal de una sección ("+ Agregar tipo") va en la cabecera,
  a la derecha del título (`adminSeccionAccion`), sin un renglón propio.
- La fila tocada con el mouse recupera el foco sin el anillo del navegador
  (`.sin-anillo`, lo pone `render()` cuando el foco original no lo tenía);
  el anillo de teclado de las filas va por dentro (`outline-offset:-2px`)
  para que la esquina redondeada de la lista no lo recorte.

### 14. Que todo se sienta de la misma familia — HECHO (3 oct 2026)

- Mis preferencias se arma como Administración: el menú de secciones al
  costado (en celular, la tira de arriba) y cada sección con su título,
  una línea de para qué sirve y "¿Cómo funciona?" plegado
  (`prefsSeccionTextos`). Los párrafos grises de cada sección pasaron ahí.
- El perfil de una persona (tocar un nombre) usa el lenguaje de la ficha
  de Personas: foto, nombre, @usuario · email, el rol, los datos en
  grilla (en el equipo desde, actividad, posteos y, para el admin, última
  vez), la mini-serie, los últimos posteos y "Ver todo lo que cargó".
  Se fue el "·" que quedaba suelto después del nombre.
- Registro de actividad: los títulos de columna van adentro de la
  tarjeta, como primera fila.
- Lugares: cada ciudad en la misma lista que Personas y Tipos.

### 15. Revisión completa en celular — HECHO (3 oct 2026)

Barrido automático a 390px de las 37 pantallas en es/en/pt/he y en modo
oscuro (es y he), midiendo desbordes y textos cortados, más la revisión a
ojo de las hojas de contacto. Lo que salió:

- La campanita: el panel colgaba del botón y se salía 16px de la pantalla
  (en hebreo por el otro lado). En angosto es fijo, de borde a borde.
- "@usuario" en hebreo: la @ es neutra y el bidi la mandaba al final
  ("diego@") en el menú del avatar, el perfil y las tarjetas. Cada
  @usuario va aislado como texto LTR.
- Modo oscuro: la pestaña activa de la barra de abajo y los números
  grandes de Reportes y del Resumen iban en petróleo, casi el fondo. Van
  en celeste (`--acento-fuerte`).
- Ficha de Personas: "Reenviar" y "Sacar" se partían en dos renglones.
- Lo que el barrido marca y es a propósito: la semana del Calendario se
  desliza de costado (con su pista), y los textos con puntos suspensivos.

### 16. Teclado y accesibilidad — HECHO (3 oct 2026)

- Escape cierra lo que faltaba: la campanita y el menú del avatar (el
  foco vuelve al botón), los desplegables de Actividades / Zonas y la
  ficha de Personas / Tipos (el foco vuelve a la fila).
- ↑ ↓ (Inicio / Fin) recorren las filas de Personas y Tipos y el menú de
  secciones de Administración y Mis preferencias (en angosto, ← → también).
- Al abrir una ficha con el teclado, o en angosto (donde tapa la lista),
  el foco entra en su cabecera (`enfocarFicha`); con el mouse en
  escritorio se queda en la fila.
- El foco del teclado se ve igual en toda la app (anillo celeste, también
  en oscuro); un enlace "Saltar al contenido" aparece al tabular desde el
  principio; `aria-expanded` en la campanita y `aria-current` en la
  sección activa y la pestaña de abajo.

### 17. Editar, cancelar y borrar: la regla — HECHO (3 oct 2026)

Decisión del usuario (3 oct 2026), con la mirada de un integrante:

- **Editar** sigue abierto a todo el equipo para los eventos (es una
  memoria compartida: el que viajó no siempre tiene el reporte a mano).
  Las Rutinas siguen siendo de cada uno (y de los editores que sume).
- **Cancelar**: solo el autor, los participantes, los editores y los
  admins. Saca el evento del Calendar de todos; es lo que más molesta por
  error. Lo exige la app (`canCancelPost`) y la base
  (`posts_controlar_update`).
- **Borrar**: solo el admin fijo, como antes.
- Que se note: la tarjeta dice "✏️ Editado por X · hace N", y la
  campanita avisa al autor de los cambios que hicieron otros en sus
  eventos ("Cambios en tus eventos", con su filtro y su "Nuevo"). Quién
  editó se guarda también por correo (`last_edited_by_email`).

### 18. La entrada, sin adelantar la app — HECHO (3 oct 2026)

Pedido del usuario: que la pantalla de entrada no "spoilee" cómo es el
sistema por dentro. Se le mostraron tres propuestas (pantalla entera, dos
mitades, mínima) y eligió la de pantalla entera con la frase chica debajo
del nombre.

- Sin la barra de arriba ni el pie de la app mientras no hay sesión
  (`body.en-portada`, también en el "Cargando…" del arranque). Aparecen
  recién al entrar.
- Todo el fondo en petróleo, con el nombre grande, "TEAM LATAM" y la
  frase "Lo que hacemos, en un solo lugar." (en los cuatro idiomas).
- Se fue el texto que contaba qué hay adentro (visitas, cursos… por país
  y fecha). Queda una tarjeta con "Espacio privado del equipo", el botón
  de Google, "¿Es tu primera vez?" en una línea y los idiomas.

### 19. Revisar lo de Calendar — HECHO (3 oct 2026)

Todo lo creado directo en Google Calendar entraba como "Otro" y sin
lugar. Se clasificaron los 925 eventos del calendario "LatAm" (2019 →
2026) a partir de sus títulos, y el usuario pidió una herramienta en la
app, más rápida que una planilla, para revisar de a muchos y poder sacar
eventos.

- Administración › **Revisar lo de Calendar** (solo admins), con cuántos
  faltan en el menú. Filtros por lo que es (Actividades, Reuniones,
  Personales, Recordatorios, Sin sugerencia, Ya ordenados), buscador y
  "Solo los seguros". Cada fila: fecha, título de Calendar y la
  sugerencia (tipo, lugar, personas) con un punto de color según qué tan
  segura es.
- Se tilda de a muchos ("Elegir todos") y la barra ofrece: Usar lo
  sugerido, Tipo, Lugar, Personas, Sacar del Registro. "Editar" corrige
  una fila sola.
- **Sacar del Registro** borra el posteo con sus comentarios y anota el
  evento en `calendar_sacados`: los dos sincronizadores lo saltean, así
  no vuelve. En Google Calendar no cambia nada.
- **Personas**: un nombre que coincide con alguien del equipo (@nickname
  o primer nombre) queda vinculado; si no, queda como persona sin cuenta,
  con su ficha (tanda 36; hasta el 7/10 quedaba como nombre suelto y
  "Nombres sueltos" los vinculaba desde acá).
- Nada avisa a nadie: no cambia la fecha de edición ni pasa por la
  edición que sincroniza con Calendar. Los títulos no se tocan.
- Base: `12-revisar-calendar.sql` (tablas y funciones, solo admins y
  solo lo importado) y `13-sugerencias-calendar.sql` (las 925
  sugerencias, sin títulos ni fechas porque el repo es público).
- **Corregido el mismo día:** el usuario ordenó eventos con "Editar" y
  después tocó "Sacar del Registro" creyendo que guardaba o marcaba como
  listo; lo ordenado no se había guardado y los eventos se borraron.
  Ahora: mientras se edita una fila no se ve la barra (solo Guardar /
  Cancelar), la confirmación dice que NO es para marcar como listo, y
  la pestaña **"Sacados"** devuelve lo sacado ("Devolver al Registro"):
  con la copia que se guarda desde ahora vuelve igual; lo sacado antes
  se vuelve a traer de Google Calendar como llegó ("Otro", sin lugar).
- **Ajustes del mismo día, usándola:**
  - Lo guardado se queda en la lista marcado **"✓ Guardado"** y con lo
    que quedó (antes desaparecía al toque y parecía que no se había
    guardado; además las filas mostraban siempre la sugerencia).
  - La barra y el panel **flotan abajo** de la pantalla y acompañan al
    recorrer la lista; con el panel abierto, solo el panel.
  - **Alcance** (a quién alcanza: país, ciudad, región, toda LatAm) y
    **Dónde fue** (el lugar físico: "Israel", "Online", una sede) van
    separados, como en el formulario: un congreso en Israel para toda
    LatAm. Dónde fue se guarda en `location`.
  - Un solo panel, **"Cambiar tipo, alcance, dónde o personas"**: se
    completa solo lo que se quiere cambiar y se aplica una vez (antes,
    abrir otro panel borraba lo elegido). De a muchos, el alcance y las
    personas se **suman** a lo que ya tenían; se pueden poner varios
    alcances; y los elegidos siguen elegidos después de aplicar.
- **Encontrado al armarla:** los ids de evento largos se cortaban a 59
  caracteres y algunos (de una integración de Google) comparten esos 59:
  6 eventos de 2024–2026 nunca entraron al Registro. Arreglado en los dos
  sincronizadores; entran con un "Reimportar historial".

### 20. Israel como alcance, y lugares sin ubicar — HECHO (4 oct 2026)

- **Israel** se puede elegir como alcance (formulario del evento, buscador
  de lugar y Revisar lo de Calendar), en un grupo aparte "Fuera de LatAm".
  A propósito no está en `COUNTRIES`: no tiene zona, no suma a "Toda
  LatAm" ni a una región, y no aparece en el mapa, en Países ni en los
  conteos por país (`PAISES_FUERA_DE_LATAM`).
- **Configuración › Lugares** lista "Sin ubicación propia en el mapa": las
  ciudades que hoy caen en la capital de su país (escritas a mano o sumadas
  sin coordenada). Cuando el usuario termine de cargar lugares, pasa esa
  lista y se les carga la coordenada en `CITY_PRESETS`.

### 21. El celular con el teclado abierto — HECHO (4 oct 2026)

Pedido: "algunas pantallas no se ven bien, especialmente cuando se abre el
teclado; queda todo distorsionado". Se recorrieron todas las pantallas a
390×844 y 360×640, con y sin teclado (simulado achicando la ventana).

- **Teclado** (`vigilarTeclado`, `html.teclado`): mientras se escribe en un
  campo de texto en angosto, se esconden la barra de abajo, el +, el
  "subir" y el aviso de posteos nuevos, y el header y el composer dejan de
  quedar pegados arriba. `--vvh`/`--vvtop` siguen la parte visible de la
  pantalla (`visualViewport`): los formularios (modal del evento, panel de
  Revisar lo de Calendar) se acomodan a ese alto con los botones a la
  vista, y el campo vuelve al centro cuando cambia el alto.
- `interactive-widget=resizes-content` en el viewport: en Android el
  teclado achica la página en vez de taparla.
- **Header** en una línea en celulares chicos (en 360px eran cuatro
  renglones fijos arriba).
- El composer "¿Qué hiciste hoy?" ya no queda fijo arriba en el celular
  (para cargar está el +).
- El modal aprovecha la pantalla (menos margen, alto según lo visible).
- Proyectos arranca en **Tarjetas** en el celular: la línea de tiempo no
  entra (se puede elegir igual).
- Orden del Inicio con rótulos cortos en angosto: "Recientes / Antiguos".

### 22. Comentarios opcionales y "No pasarlo a Google Calendar" — HECHO (4 oct 2026)

- En un evento, **Comentarios** es opcional (la base ya lo aceptaba).
- Casilla **"No pasarlo a Google Calendar"** en el formulario del evento,
  para cargar algo que ya pasó sin que aparezca en el Calendar compartido
  ni avise a nadie. Se guarda en `posts.sin_calendar`; con la marca, la app
  no crea el evento, no lo busca al editar o cancelar, y ninguno de los
  dos sincronizadores lo vincula con un evento parecido. Se ofrece solo
  cuando el tipo va al Calendar y el evento todavía no está ahí.

### 23. Sin el tipo delante del título — HECHO (5 oct 2026)

- La app mandaba los eventos a Google Calendar como "Tipo: Título"
  ("Curso: Curso de Team Leader"). Ahora va el título solo
  (`calendarSummary`). La lectura de summaries viejos con prefijo sigue
  (`extractTitleFromSummary`, `summaryMatchesPost`, `findCalendarEventId`).
- `14-titulos-sin-tipo.sql` saca el prefijo exacto "<tipo>: " (de fábrica
  en 4 idiomas, "Actividad" y los del admin) de los títulos ya guardados,
  sin tocar la fecha de edición. Los eventos ya creados en el Calendar
  compartido se renombraron sin avisos (notificaciones apagadas).

### 24. Todo en Calendar — HECHO (5 oct 2026)

El usuario decidió que los eventos del Registro estén también en el
Calendar compartido. Administración › Configuración › Google Calendar
lista "En el Registro pero no en el Calendar" (`postsSinCalendar`: tipo que
va al Calendar, sin evento vinculado, sin cancelar) y un botón los pasa de
una sin avisarle a nadie (`sendUpdates=none`). Si alguno ya estaba en el
Calendar con el mismo título y fecha, se vincula en vez de duplicarse. La
casilla "No pasarlo a Google Calendar" sigue en el formulario.

### 25. Reportes, de nuevo — HECHO (5 oct 2026)

Pedido: ver todos los años juntos, comparar año contra año, y sugerencias
para decidir el año siguiente. El usuario eligió las cuatro mejoras de la
maqueta (sin el rango de fechas libre).

- **Un período / Comparar** arriba de todo. En "Un período", el chip
  **Todos los años**: total histórico, año por año, y tablas de evolución
  por país y por tipo (últimos seis años con datos, con tono según el
  número).
- **Comparar**: dos años (y el mismo trimestre de cada uno, si se elige),
  con los cuatro números de arriba "A → B", mes a mes (gruesa B, fina A) y
  tablas por tipo, zona y país con la diferencia.
- **Ver solo**: zona, país, tipo o persona, en las tres pantallas
  (`pasaFiltroDelReporte`).
- **Última actividad por país** (cobertura, en rojo lo de más de un año)
  y **Por persona del equipo** (cargó, participó, en cuántos países).
- **Sugerencias para el año siguiente** (`sugerenciasDelReporte`): países
  donde se dejó de ir, lo que lleva más de un año sin actividad, lo que
  bajó a la mitad, lo que más creció, meses vacíos, una zona con poco del
  total, y datos que faltan (sin lugar, sin participantes). Reglas
  simples y explicadas, no adivinanzas.

### 26. Reportes más ordenado: opción A — HECHO (5 oct 2026)

"Quedó todo muy armado en partes; quiero algo más profesional." Se
mostraron dos diseños (barra arriba / panel a la izquierda) y el usuario
eligió la **A**: una sola barra de control (Un período/Comparar, Año y
Período como menús, "Filtros" que se despliega con un número de cuántos
hay puestos, Planilla y PDF a la derecha); un título por pantalla con los
filtros puestos como fichas que se sacan con ✕; una tira de números en una
sola tarjeta; y secciones con nombre ("Cuándo y dónde", "Sugerencias",
"Equipo y cobertura"). "Mes a mes" pasa a columnas a todo el ancho; "Quién
cargó/participó" se fue a la tabla "Por persona del equipo".

### 27. Unificar dos cuentas de la misma persona — HECHO (5 oct 2026)

El usuario usó dos correos y va a dejar uno. Administración › Personas, en
la ficha de la cuenta vieja: "Pasar todo lo suyo a otra cuenta". Lo hace
`unificar_cuentas` (15-unificar-cuentas.sql): autor y nombre, quién editó,
quién completó el proyecto, me gusta, editores, menciones, participantes,
responsables de hitos, comentarios, el @usuario escrito en los textos, lo
sacado de Revisar lo de Calendar y las preferencias (si la nueva no
tenía). No toca el registro de actividad (es historia) ni la ficha vieja
(el acceso se quita a mano). Los correos no van en el repositorio.

### 28. Copias de seguridad — HECHO (5 oct 2026)

Ver `docs/REVISION.md`, punto 13, y `supabase/respaldo/LEEME.md`: una
copia automática cada domingo al repo privado y Administración → Copia de
seguridad para bajar una. El token vence el 5/10/2027.

### 29. Tarjetas del Inicio que aprovechan el lugar — HECHO (6 oct 2026)

"Me molesta el aprovechamiento de cada evento." Tras varias rondas de
capturas (A/B/C, después D/E/F, después ajustes), el diseño elegido:
- Arriba el **nombre** y, a la derecha, **cuándo**, liviano: "26 – 30 oct
  2026"; con hora, el día de la semana y sin el año si es el actual
  ("lun 26 – vie 30 oct · 09:00–17:00", `fechaDeTarjeta`). "Publicado hace
  … por …" sale de la vista y queda al pasar por la fecha.
- Un renglón con tipo, lugares (**la ciudad sola**; el país al pasar el
  mouse o al tocarla) y participantes.
- La **documentación** deja de ser un recuadro amarillo de dos renglones:
  es una pastilla al final de las acciones, después de los comentarios.
  Gris mientras hay tiempo, **amarilla** cuando el evento ya terminó y
  falta algo, y ya no se abre sola. Al tocarla, la lista se abre debajo.
- "Editado hace 5 h" abajo a la derecha, junto al ⋯.
- En el celular la fecha va arriba del nombre, y abajo quedan los íconos
  con su número ("💬 1" para los comentarios).

### 30. Varios archivos por documento y visor de documentos — HECHO (6 oct 2026)

- Un documento esperado (Plan de Viaje, Otro…) puede tener **varios
  archivos**: subir otro suma, no pisa. Se ve el último subido y "+N más"
  despliega los anteriores; el "+" agrega otro; cada uno con su fecha y su
  ✕. Los nombres largos se recortan y quedan enteros al pasar el mouse.
- **Visor de documentos igual al de las fotos**: fondo oscuro, flechas y
  contador; el documento como una hoja en el medio, con "Descargar" y ✕
  arriba. Los Word (.docx) se dibujan con docx-preview (se carga la
  primera vez); PDF y texto en el marco. Esc cierra, ← → pasan de uno a
  otro. PowerPoint, Excel y los .doc viejos se siguen bajando.
- Después, el usuario no quiso el fondo negro: los dos visores (documentos
  y **fotos**) pasaron a una **ventana flotante** (opción B): la página
  queda atrás apenas atenuada y sin poder tocarse, la ventana blanca tiene
  su barra (nombre, Descargar, ✕) y aparece con un fundido corto. Se cierra
  con la ✕, con Esc o tocando la página de atrás; tocar la foto ya no la
  cierra.
- Y después: **todo archivo abre el visor** (menos el audio): Word, PDF,
  texto, **planillas como tabla** (SheetJS); lo que no se puede mostrar
  (PowerPoint, Word viejo) abre igual con su nombre y "Descargar".
  **Deslizar con el dedo** pasa al anterior o siguiente (fotos y archivos;
  al revés en hebreo). El tamaño de un Word o una planilla se cambia con
  **− porcentaje +** (tocar el porcentaje vuelve al inicial). El contador
  "1 / 2" va siempre de izquierda a derecha (en hebreo salía "2/1").

### 31. Arreglos y detalles después del visor — HECHO (5 oct 2026)

- Un PDF anotado con un tipo que no servía ("otro") abría como "no se
  puede mostrar": ahora el tipo también se deduce de la terminación.
- Al editar un evento, el cuadro de comentarios ya no tapa Cancelar /
  Guardar cambios.
- Un comentario cuya respuesta-madre se borró se ve suelto (antes decía
  "Ver 1 comentario" y el hilo quedaba vacío).
- **Me gusta**: el número abre la lista de quiénes (foto, nombre,
  @apodo, "Vos"), sin dar el me gusta; al pasar el mouse, una burbuja
  con los primeros 3 y "y X más…". Tocar a alguien abre su perfil, y el
  perfil tiene una **«‹»** sutil para volver a la lista (opción A); lo
  mismo desde la tarjeta de un evento del Calendario. Esc vuelve un paso.
- **Adjuntos sueltos como fichas** (opción A): cuadradito de color con
  la sigla (PDF, DOCX, XLSX…), nombre, tipo y día; el ✕ se asoma al
  pasar el mouse.
- **Correos que ya no están en el equipo** (al pie de Personas): lo de
  una cuenta borrada a mano se pasa a otra con el mismo «Pasar…».
  unificar_cuentas ahora también mueve los me gusta de un correo sin
  ficha.

### 32. El resumen de cada visita y de cada lugar — HECHO (6 oct 2026)

- El usuario quiere que lo que ya manda (Formulario de Viaje, Cierre,
  Memoria) alimente solo un resumen de la visita y del lugar, **gratis y
  sin que los documentos salgan a ningún servicio**. Se descartó la
  inteligencia artificial paga: los formularios tienen siempre la misma
  forma, así que **la app los lee en el navegador**.
- Del **Formulario de Cierre en Word (español)** saca el Resumen
  Ejecutivo, la tabla de objetivos (Sí / Parcial / No) y las
  Conclusiones, que pasan a **"Lo que sigue"** (se tildan como hechas o
  "No es tarea"). Sin Cierre, del Formulario de Viaje toma los objetivos
  como planeados. La **Memoria no se resume**: queda para abrirla entera.
  Los Cierres en inglés y hebreo no se leen.
- Se lee al subir el Word (como documento del evento o en el formulario)
  y, para lo de antes, desde ⋯ → "Leer el resumen de los documentos".
  Queda en `posts.resumen` (jsonb, tope 64 KB).
- En la tarjeta: "📋 Resumen · 4/4" despliega el resumen. En **Países →
  un país**: visitas, última, objetivos logrados, lo que sigue (con de
  qué visita salió) e historia.
- Al publicar una **rutina** en un lugar con pendientes, pregunta
  "¿Esto cumple algo pendiente?"; con un toque queda hecho, con la rutina.
- Un viaje por varios lugares trae **un Cierre por lugar**: se guardan
  todos (`resumen.partes`) y cada uno cuenta para el país que nombra su
  "Lugar:" (o el nombre del archivo). En la tarjeta, cada uno con su 📍.
  En la historia de un país, una visita con Word sin leer ofrece "Leer el
  Cierre" ahí mismo.
- **Por ciudad** (pedido del usuario): el país junta todas sus ciudades;
  al entrar a una ciudad (Países → país → ciudad) aparece arriba el
  resumen de esa ciudad, solo con los Cierres que la nombran (o, si el
  evento es de esa sola ciudad y el Cierre no nombra ninguna, el suyo).
  La pregunta de la rutina usa lo pendiente de su ciudad.
- Queda para después: el resumen por zona y otros tipos además de Visita.

### 33. La ficha de cada lugar, dentro de Países — HECHO (6 oct 2026)

- El usuario no estaba contento: entrar a una ciudad llevaba al Inicio
  con un filtro y "no se entiende". Ahora cada país y cada ciudad tiene su
  **ficha**, sin salir de Países (migas: Países › Región › País › Ciudad;
  el mapa también lleva a la ficha):
  - **Lectura rápida**: frases armadas con cuentas (última visita, visitas
    del año, objetivos logrados, pendientes viejos, este año contra el
    anterior, qué ciudad concentra la actividad). Sin inteligencia
    artificial.
  - Los cuatro números, **Lo que sigue** (con la ciudad y los pendientes de
    más de 3 meses en naranja) y **Lo que pasó**: la línea de tiempo por
    año y mes; cada ítem se abre en una ventana ahí mismo. La ventana
    muestra la tarjeta entera sin barra propia (se desplaza la ventana,
    con la ✕ y "De la ficha de…" pegadas arriba), y se cierra sola si una
    acción cambia de sección ("Gestionar proyecto" no funcionaba porque
    abría Proyectos debajo de la ventana; "Convertir en proyecto" también
    navega solo, después de guardar). Al llegar al Feed o a Proyectos por
    esa vía queda arriba «← Volver a la ficha de …», que desaparece al
    usarlo o al cambiar de pestaña.
  - Al costado: **Ciudades** (cada una lleva a su ficha), **Ritmo** de los
    últimos 12 meses, **Quiénes trabajaron** y **Documentos**.
  - **"Cargar algo acá"** abre el formulario con el lugar puesto.
- **Excluir** (pedido del usuario): por defecto solo lo de ese lugar; se
  puede sumar lo del país en general, la región y toda LatAm (se ve
  atenuado y con su etiqueta). Los tipos de actividad se ocultan con un
  toque.
- **Segunda parte (6 oct 2026):** cada **zona** también tiene su ficha
  (Países › Región), con sus países al costado y "qué incluir" = solo la
  región o + toda LatAm; la lista de Países arranca con las tres zonas.
  **"Reporte del lugar"** imprime o guarda en PDF la ficha de cualquier
  lugar con todo desplegado (pendientes, documentos, la línea entera), sin
  botones, con lo incluido dicho en una línea y las tarjetas del costado
  en dos columnas.

### 34. Proyectos e hitos en la ficha, el costado que acompaña, de a tandas, el mapa — HECHO (6 oct 2026)

- **Los hitos de los proyectos entran en «Lo que pasó»** (pedido del
  usuario: "puede que haya hitos metidos ahí"): cada hito es un rombo ◆
  en la línea, con su fecha, de qué proyecto es, quién lo tiene a cargo y
  su estado (✓ Cumplido, Vencido en rojo, Por vencer, Pendiente). Tocarlo
  abre el proyecto con sus hitos a la vista. El posteo del proyecto dice
  "📋 Proyecto · 2/4 hitos".
- **Filtrar por proyecto**: una fila "Proyectos" con "📋 Todos los hitos ·
  N", un botón por proyecto y "Sin hitos". Con un proyecto elegido se ven
  solo sus hitos y **los demás proyectos y sus hitos quedan atenuados**
  (el usuario eligió "atenuado" antes que ocultar), con una nota
  "Mostrando solo los hitos de … · Ver todos". Al costado, la tarjeta
  **"Proyectos en {lugar}"**: cada uno con su barra de avance, los
  vencidos en rojo y el próximo hito; tocar uno filtra igual. La lectura
  rápida suma una línea ("2 proyectos abiertos con 4 hitos pendientes, 2
  de ellos vencidos (…)"). El reporte impreso no muestra los botones y
  dice en su línea de "Incluye" si se imprimió con un solo proyecto o sin
  hitos.
- **El costado acompaña el scroll** (Ritmo, Quiénes, Documentos…): en
  escritorio la columna queda pegada debajo del header, como la del
  Inicio; si es más alta que la pantalla, se desplaza por dentro. En el
  papel, no.
- **«Lo que pasó» se carga de a tandas**, como el Inicio: 30 filas y, al
  acercarse al final, se liberan 30 más (con un botón "Ver más" de
  respaldo). El reporte impreso sigue sacando todo.
- **"Google Calendar" ya no es una persona** en "Quiénes trabajaron acá":
  lo traído del calendario cuenta a su organizador si es alguien del
  equipo (por correo, nombre o @apodo; el calendario "LatAm" no es nadie)
  y a los participantes que tienen cuenta en la app, una vez por registro.
  Lo mismo en la línea de tiempo y en "Última visita … por …".
- **Países › Mapa llega hasta abajo de la pantalla** en vez de medir
  480px fijos y dejar una franja vacía: se mide al dibujarlo y al cambiar
  el tamaño de la ventana (en el celular deja el lugar de la barra de
  abajo), y se le avisa a Leaflet del cambio.
- De paso: la ventana de un ítem de la ficha vacía su contenido al
  cerrarse (escondida, seguía en la página y una búsqueda por posteo podía
  dar con ella primero).

### 35. Documentos opcionales, la ventana de la ficha y las ciudades al costado — HECHO (6 oct 2026)

- **Documentos opcionales** (opción A, elegida por el usuario): había
  puesto «Otro» en casi todos los tipos "por si alguien quiere subir algo
  más", y le contaba como faltante (2/3 en amarillo, "Falta
  documentación", la campanita). Ahora en Administración › Tipos de
  actividad cada documento tiene una casilla **"Opcional"**: queda en la
  lista del evento con su "📎 Adjuntar", pero no cuenta para el 2/2, no
  pone la pastilla en amarillo ni figura como faltante; se ve con la
  marquita "opcional". Los «Otro» ya cargados arrancan opcionales sin
  tocar nada (y un documento nuevo que se llame así también); con el
  primer guardado cada documento lleva el dato explícito. Un tipo con
  solo documentos opcionales muestra "📄 documentos" sin fracción. No
  cambia la base: la configuración ya admitía el dato.
- **La ventana de un ítem de la ficha** (captura del usuario): al
  scrollear, la cabecera pegada quedaba 24px abajo del borde (el relleno
  de la capa oscura, que es la que scrollea) y por esa franja asomaba lo
  que ya había pasado. El respiro pasó de la capa a la ventana.
- **Ciudades (y Países) al costado de la ficha**: hasta cinco y «Ver
  más» / «Ver menos» (pedido del usuario). Desplegada, la lista se
  desplaza adentro de la tarjeta con su propia barra, no la columna
  entera (segunda captura del usuario). En el reporte impreso salen
  todas.

### 36. Personas sin cuenta — HECHO (7 oct 2026)

El usuario mostró «Swimmers Online», con Darío y Guypo asignados: no
tienen cuenta y no se los podía cargar ni contar. Decidió: cualquiera que
carga eventos puede sumar (A), una ficha por persona (A), y básico
(nombre, correo opcional, nota).

- **En Participantes**, al escribir un nombre: la gente del equipo, las
  fichas que ya existen («Darío · sin cuenta · 3 actividades») y «Sumar
  «Darío» como persona nueva». La ficha se crea al publicar, sin
  duplicar por tildes ni mayúsculas. En el evento queda `{persona, name}`
  y se muestra el nombre de la ficha (renombrarla alcanza).
- **Cuentan** en «Quiénes trabajaron acá» de cada lugar y en el filtro
  por persona de los reportes.
- **Administración › Personas › Sin cuenta**: lista y ficha (nombre,
  correo, nota, dónde estuvo), sumar a mano, unir dos que son la misma,
  vincular a una cuenta cuando entra (el historial pasa a su cuenta),
  borrar si no está en ningún evento.
- **Al pedir entrar**: con el correo de una ficha se vincula sola al
  aprobar; con el nombre parecido, se le pregunta al admin («¿Es
  «Guypo», que figura sin cuenta?»).
- Base: `supabase/18-personas.sql` (tabla, políticas, `unir_personas`,
  `vincular_persona`, y la migración de los nombres sueltos que ya
  estaban). «Nombres sueltos» de Revisar lo de Calendar se fue: lo
  reemplaza esta sección. Detalle en README, «Personas sin cuenta».

### 37. Buscar por lugar — HECHO (8 oct 2026)

El usuario cargó dos rutinas con alcance La Habana y, al buscar «La
Habana», no aparecían: los buscadores miraban título, texto, quién cargó,
participantes y «dónde», pero no el alcance. Ahora el del Inicio y el de
arriba («Buscar en todo») encuentran también por la ciudad, el país o la
región del alcance, en el idioma de la app y como quedó guardado
(«Havana» y «La Habana» traen lo mismo). Y el de arriba suma el grupo
**Ciudades**: las ciudades donde hay algo cargado; elegir una abre el
Inicio filtrado ahí, como ya hacía con los países
(`pruebas/buscar_lugar_test.mjs`).

### 38. «Próximos eventos» abre la tarjeta del evento — HECHO (8 oct 2026)

Tocar un evento de la columna «Próximos eventos» del Inicio llevaba
directo a su tarjeta en el Feed. El usuario pidió que se abra la
tarjetita del Calendario, con lo básico a la vista: **Ver historia**
(la de siempre: el posteo en el Feed), **Ver calendario** (el Calendario
parado en ese día, marcado; en uno que se repite, la repetición que se
veía en la lista), **Editar** y un **⋯** con lo que tiene el ⋯ del Feed
(Repetir este evento, Convertir en proyecto o Ver proyecto, Cancelar
evento, Borrar). Cada opción cierra la tarjeta antes de seguir. Un
observador ve solo Ver historia y Ver calendario. La tarjeta que se abre
desde el Calendario quedó como estaba
(`pruebas/proximos_tarjeta_test.mjs`).

### 39. Reportes sin lugares vacíos — HECHO (8 oct 2026)

En Reportes, debajo de «Mes a mes», al lado de Por zona, Por país y Por
tipo quedaba un cuarto lugar vacío en las pantallas anchas: la grilla
hacía lugar para cuatro tarjetas y había tres. Se le propusieron tres
opciones con capturas: **A** una tarjeta «Por ciudad» (la recomendada),
**B** «Lo que viene» (lo planificado), **C** no agregar nada y que las
tres ocupen el ancho. **Eligió C.**

Ahora esas tarjetas van de a tres o una debajo de la otra, nunca de a
cuatro ni de a dos. Al revisar se vio que pasaba lo mismo en otros
anchos y pantallas: en una pantalla mediana la tercera tarjeta quedaba
sola, con medio renglón vacío (Un período, Todos los años, Comparar), y en
el PDF también. Se arregló en todos esos casos. En el PDF: Zona, País y
Tipo de a tres; Todos los años, todo a lo ancho; Comparar, Tipo y Zona
lado a lado y País abajo
(`pruebas/reportes_huecos_test.mjs`, que recorre 14 anchos y el papel).

Si algún día se quiere sumar una cuarta tarjeta, las dos ideas de la
propuesta quedan anotadas: «Por ciudad» (las 12 ciudades con más
actividad: arriba ya figura cuántas son, pero no cuáles) y «Lo que viene».

### 40. La barra de desplazamiento con el estilo de la app — HECHO (8 oct 2026)

La barra para desplazarse (hacia abajo y de costado) era la del
navegador: gris, con flechitas, igual que en cualquier página. Al
usuario no le gustaba. Se le mostraron tres opciones con capturas, en
reposo, con el mouse encima, arrastrando y en oscuro: **A** petróleo fina
(la recomendada), **B** celeste con degradé sobre un riel, **C** invisible
hasta pasar el mouse. **Eligió A.**

Fina, en petróleo suave, con las puntas redondeadas y sin flechitas. Al
pasar el mouse se engrosa y se pone celeste, y arrastrándola, petróleo. En
oscuro va en claro. Es la misma en toda la app: página, listas, tablas y
ventanas. Solo en la computadora: en el celular sigue la del teléfono
(si no, Android la volvía fija y le comía 12 px a cada lista). En Firefox,
los mismos colores con la forma más simple del navegador
(`pruebas/barra_test.mjs`).

También se le propuso un **extra**: que la última columna de una tabla se
desvanezca en el borde mientras la tabla sigue de costado, para que se
note que hay más. **Dijo que no**: solo la barra.

**Ajuste el mismo día:** la barra grande, la de la página, en claro se le
veía gris (el 30 % de petróleo sobre el fondo casi blanco queda apagado).
Se le mostraron tres tonos solo para esa (petróleo pleno, petróleo medio,
celeste) y **eligió petróleo pleno**, el color del encabezado. Y al lado
del encabezado, que queda fijo arriba, la barra dejaba una franja clara,
como un corte: ahora ese tramo va del color del encabezado y la barra
arranca debajo (también lo eligió). Las barras de adentro y el modo
oscuro quedaron como estaban. De paso, en la portada (fondo petróleo) la
columna de la barra salía blanca y la barra no se veía: va en petróleo,
con la barra clara.

### 41. Las tablas de «Todos los años» en modo oscuro — HECHO (8 oct 2026)

El usuario mostró en modo oscuro «Evolución por país» y «Evolución por
tipo»: las celdas van de menos a más con un tono, pero los tonos eran
fijos y claros, pensados para el modo claro. En oscuro la letra es clara,
así que los números quedaban claro sobre claro, invisibles, y la tabla
eran manchones blancos sobre la tarjeta oscura. Ahora en oscuro la escala
va de petróleo (poco) a celeste (mucho) y todos los números se leen. El
modo claro y el papel (que sale siempre en claro) no cambiaron
(`pruebas/calor_oscuro_test.mjs`, que mide el contraste de cada tono).

### 42. Las filas de Reportes llevan al Inicio en ese período — HECHO (8 oct 2026)

Tocar una fila de Por zona, Por país o Por tipo abría el Inicio con ese
filtro, pero de todos los años: «Argentina 34» en el reporte de 2026
mostraba Argentina desde siempre. Ahora también filtra por el período del
reporte, con la misma regla que el número: lo hecho en ese año o
trimestre (hasta hoy, si está en curso), y lo cancelado no. Aparece un
chip **📅 2026 · hasta hoy ✕** (o **📅 2025**, **📅 2.º trimestre 2025**)
para sacarlo, y entra en «Guardar este filtro». De paso, el selector
«Solo acá · + Región · + Toda LatAm» ahora cuenta con todos los filtros
puestos (período, «Mis posteos» y demás accesos directos, lo que cargó
una persona): antes decía «Solo acá 74» con 13 en la lista
(`pruebas/reporte_ir_periodo_test.mjs`).

### 43. Los filtros del Inicio: la B2 — HECHO (8 oct 2026)

Lo que llegaba de otra pantalla (📍 Argentina y 📅 2026 desde Reportes,
lo que cargó alguien desde Personas) aparecía como fichas sueltas al lado
de los menús «Actividades» y «Zonas», y solo se podía sacar: para pasar
de 2026 a 2025 había que volver a Reportes. El lugar se elegía en tres
sitios, en el celular eran cinco renglones antes del primer posteo, y los
accesos directos y los guardados no estaban (vivían en la columna de la
compu). El usuario pidió propuestas **que se pudieran tocar**, no
capturas: se le armó una página con maquetas en vivo
(https://claude.ai/artifact/EvbV2yqiNp48BUTvEqTh9i, privada; sus tres
versiones son las tres vueltas). Primera vuelta: A cuatro menús, B un
botón «Filtros» como en Reportes, C una frase. Dudó entre A y B («la B
desplegada es muy grande»: 640 × 642, y en el celular más alta que la
pantalla); segunda vuelta, tres maneras de achicar la B; eligió la
**B2**, y en la tercera vuelta pidió dos ajustes que se probaron en la
maqueta antes de hacerla.

Cómo quedó (`renderFilterBar`, `renderPanelDeFiltros`):
- **La barra**: el buscador y «⚙ Filtros» con cuántos hay, y debajo **una
  ficha por filtro** (🗂️ Actividad, 📍 Lugar, 📅 Fecha, 👤 Persona). Tocar
  la ficha abre el panel en ese filtro; su ✕ lo saca al toque. Si se
  llegó desde Reportes o Personas, un renglón finito dice «← Volver a
  Reportes · 2026», con «Limpiar» al lado (`filtroOrigen`).
- **El panel**, en la compu: los filtros a la izquierda con lo elegido en
  cada uno, las opciones del que se tocó a la derecha; mide siempre 600 ×
  436. Arriba, los accesos directos. «Qué incluir» (Solo acá · + Región
  · + Toda LatAm) pasó adentro de Lugar; «Este mes», a Fecha; «Mis
  posteos» y «Donde participo», a Persona; «Les falta documentación», a
  Actividad. En el celular **sube desde abajo** sobre todo lo demás: la
  lista y, al tocar un filtro, sus opciones, con «← Filtros» para volver.
- **Elegir todo y después ver** (pedido del usuario): lo que se toca
  adentro es un borrador (`fp.b`). El Inicio no cambia hasta **«Ver N
  posteos»** (que ya dice cuántos van a quedar) o **Enter**; Cancelar,
  Escape o tocar afuera lo descartan. Un punto marca cada filtro
  cambiado y arriba dice «· 2 cambios».
- **Sin el efecto de «volver a cargar»**: como toda la vista, el panel se
  vuelve a dibujar con cada toque, y la animación de abrir se repetía en
  cada uno (se midió contando `animationstart`). Ahora se anima solo al
  abrirse (`fp.entra`); al cambiar de filtro se mueve solo lo que cambia
  (un fundido en la compu, de costado en el celular) y lo desplazado
  adentro del panel no se pierde. Los menús del Calendario (vista, capas)
  todavía tienen el efecto viejo.
- **Los accesos directos se combinan**: antes era uno solo a la vez
  (`state.filters.quick`); ahora cada uno es parte de su filtro (`quien`,
  `mes`, `docs`), así que «Mis posteos de este mes» se puede. Los filtros
  guardados antes siguen andando (`filtrosDeGuardado` entiende `quick`), y
  desde el panel se guarda también lo elegido (Guardados).
- La columna de la compu (próximos, hitos, accesos directos, guardados)
  quedó igual. Un año en Fecha cuenta lo hecho hasta hoy, como Reportes:
  por eso solo se ofrecen los años que ya empezaron.

Pruebas: `pruebas/filtros_inicio_test.mjs` (borrador, Ver/Enter/Escape/
afuera, el ✕ de las fichas, atajos juntos, guardar, Volver, la hoja del
celular, hebreo, un guardado viejo, y que tocar adentro **no** repita la
animación de abrir; falla con el código de antes). Se adaptaron las que
usaban la barra vieja.

## Fuera de alcance (necesitan algo que la app no tiene)

- ~~Mandar correos (resumen semanal, invitaciones): no hay servicio de
  envío.~~ Desde el 7/10/2026 hay: Resend, con la función `avisar` y los
  resúmenes (`17-avisos-por-correo.sql`).
- ~~Estado de las copias de seguridad: primero tienen que existir~~
  Existen desde el 5/10/2026: Administración → Copia de seguridad.

## Decisiones pendientes del usuario

- **Agenda de contactos** (pedido del 8/10/2026): sumar los contactos más
  importantes de cada lugar, a partir del «Directorio Chabad LatAm» (un
  HTML con 189 instituciones en 102 ciudades de 32 países, un rab y un
  teléfono por institución: 173 personas) y de otras listas parecidas que
  el usuario tiene. Propuesta con maqueta que se puede tocar, armada con
  los datos del Directorio (teléfonos con los últimos 4 números tapados):
  https://claude.ai/artifact/9YhvpSXRbJLDnV36vZRWE8 (privada). Lo
  propuesto: instituciones con su gente (cargo, teléfonos con WhatsApp,
  correo, idiomas, nota); cada contacto es la misma ficha que una persona
  sin cuenta (`personas`, tanda 36), así cuenta si participa de un evento;
  las listas se traen enteras desde Administración › Agenda, con una
  vista previa de lo que va a hacer. Tres decisiones suyas, con lo
  recomendado primero: **dónde vive** (A dentro de Países, como tercera
  vista al lado de Lista y Mapa, más una tarjeta en la ficha de cada país
  y ciudad · B pestaña propia · C solo en la ficha de cada lugar), **quién
  ve teléfonos y correos** (A todos los aprobados · B sin observadores) y
  **quién suma y corrige** (A cualquiera que carga eventos, borrar solo un
  admin, también para las personas sin cuenta · B como hoy las personas
  sin cuenta · C solo admins). Datos para cuando se haga: las ciudades
  del Directorio ya están en `CITY_PRESETS` (de ahí salieron); cinco
  nombres se escriben distinto y se pasan al de la app («Hollbox» →
  Holbox, «Rep. Dominicana», «St. Martin», «Turks and Caicos», «St.
  Barth»); 60 nombres traen «Rabbi»/«Rab» delante; «Centro Juvenil» y
  «Centro de Jóvenes» parecen el mismo tipo. El usuario va a mandar las
  otras listas.

- **Clasificar lo que vino de Google Calendar**: la herramienta está
  (tanda 19); falta que el usuario la use. Empezar por Actividades →
  "Solo los seguros" → "Elegir todos" → "Usar lo sugerido". Las
  reuniones, personales y recordatorios quedan para cuando decida.
  Las planillas de Drive ("Clasificación – Actividades / Personas") que
  se armaron antes quedaron sin uso: la herramienta las reemplaza.

- ~~¿Un integrante común puede editar o cancelar eventos de otros?~~
  Decidido el 3 oct 2026: editar sí, cancelar solo autor / participantes /
  editores / admins, borrar solo el admin fijo (tanda 17).
