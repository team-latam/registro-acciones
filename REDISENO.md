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

## Fuera de alcance (necesitan algo que la app no tiene)

- Mandar correos (resumen semanal, invitaciones): no hay servicio de
  envío.
- Estado de las copias de seguridad: primero tienen que existir
  (REVISION.md, punto 13).

## Decisiones pendientes del usuario

- ¿Un integrante común puede editar o cancelar eventos de otros? Hoy sí
  (solo Borrar está restringido). Se deja como está hasta que diga.
