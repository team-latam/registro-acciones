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

### 2. Posteos y formulario

- Tarjeta: a la vista solo Me gusta, Responder y "N comentarios". Editar,
  Repetir este evento (nuevo: abre el composer con los mismos datos),
  Crear/Ver proyecto, Cancelar evento y Borrar van a un menú "⋯" en la
  esquina; Borrar último y en rojo.
- Formulario de evento: el tipo de actividad primero; un solo campo de
  lugar con explicación y "Agregar dirección exacta (opcional)" para el
  "Dónde ocurre" de hoy; participantes; comentarios con pistas según el
  tipo.
- Adjuntos en la tarjeta: fotos como galería, archivos y links como
  fichas con nombre y origen (nunca la URL cruda), documentación como
  "falta 1 de 3" con el botón de subir lo que falta.
- "Ver traducción" en inglés/hebreo pasa al menú ⋯ o a un enlace chico.

### 3. Calendario en celular

- Mes: un punto de color por día; al tocar un día, la lista de ese día
  debajo de la grilla. Los proyectos largos, agrupados en una línea
  ("2 proyectos en curso este mes") en vez de repetirse en cada semana.
- Agenda: lo que dura varios días aparece una vez, no en cada día.
- Semana en celular: pista de que se desplaza de costado.

### 4. Países y Reportes

- Países: primero los que tuvieron actividad (con su última o próxima
  actividad y una mini-serie por mes), los vacíos plegados abajo.
- Reportes: cuatro números arriba (actividades, países, personas,
  proyectos), comparación con el período anterior, tocar una barra abre
  esas actividades en el Feed, bajar Excel (CSV) y PDF (imprimir).

### 5. Proyectos

- Línea de tiempo con todos los proyectos y la marca de hoy; hitos por
  vencer debajo; filtros en curso/completados/zona.

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
