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

### 6. Navegación (la tanda grande)

- 5 pestañas: Inicio, Calendario, Países, Proyectos, Reportes.
- Configuración → "Mis preferencias", desde el menú del avatar.
- Actividad, Usuarios y Administrar → una sección "Administración" con
  menú lateral y un Resumen (pedidos pendientes, lugares por sumar,
  estado del Calendar, copias de seguridad, espacio de fotos, el equipo
  este mes).
- En celular: barra inferior de íconos con el + en el medio.
- Buscador general arriba (posteos, personas, lugares).
- Inicio con columna lateral en escritorio: próximos eventos, hitos por
  vencer, filtros guardados.

### 7. Administración

- Zonas: fichas de país que se arrastran entre zonas; aviso de qué
  cambia antes de guardar; sugerencia de separar el Caribe.
- Tipos: tabla con interruptor "Va al Calendar", documentos como
  etiquetas, menú ⋯ (renombrar, ver posteos, archivar, borrar).
- Personas: columnas alineadas, "nunca entró" resaltado, mini-serie de lo
  que cargó, bajar lista, pre-aprobar un email.
- Registro de actividad: agrupado por día, filtros simples, bajar Excel.
  Registrar también lo que se crea, edita y borra (toca la base: al
  final).

### 8. Entrada, espera y avisos

- Portada de entrada con los tres pasos de la primera vez e idiomas.
- Pantalla de espera con los pasos del pedido y aviso de cuenta personal;
  pantalla distinta para quien tenía acceso y se lo quitaron. Sin
  campanita ni menú ahí.
- Campanita: nuevos separados de vistos, filtros (menciones, respuestas,
  eventos), "marcar todo como leído", aviso de evento próximo con lo que
  falta adjuntar.

## Fuera de alcance (necesitan algo que la app no tiene)

- Mandar correos (resumen semanal, invitaciones): no hay servicio de
  envío.
- Estado de las copias de seguridad: primero tienen que existir
  (REVISION.md, punto 13).

## Decisiones pendientes del usuario

- ¿Un integrante común puede editar o cancelar eventos de otros? Hoy sí
  (solo Borrar está restringido). Se deja como está hasta que diga.
