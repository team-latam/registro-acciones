# Diseño y uso — lo que vi usando la app (escritorio 1440/1920/1024/768, celular 390/360, claro y oscuro, es/en/he)

Método: la app entera con la sesión iniciada contra el Supabase de mentira de `pruebas/app_dom_test.mjs`, con 25 posteos de prueba (visitas, cursos, rutinas, un cancelado, dos importados de Calendar, tres proyectos con hitos, un Cierre leído), recorriendo las 37 pantallas y sacando 90 capturas. Las capturas están en el scratchpad de la sesión; las que importan van en la página del informe.

## Bugs de interfaz (confirmados)

1. **Escritorio: cambiar de pestaña no vuelve arriba.** Las pestañas de arriba (`#tabs button`, index.html:19149) hacen `render()` pero no `scrollToTop()`; la barra de abajo y el menú del avatar (`goto-view`, 20093) sí. Medido: con el Feed scrolleado, pasar a Calendario deja `scrollY=95` (la barra Hoy ‹ › Mes queda arriba, fuera de vista: se ve la grilla sola) y pasar a Reportes deja `scrollY=879` (se entra por la mitad del reporte). **Alta** (lo nota cualquiera todos los días; arreglo de una línea).
2. **Celular: la tabla "Por persona del equipo" de Reportes se sale de la pantalla.** `table.rep-tabla` mide 426 px en 390: las columnas Participó y países quedan cortadas, sin scroll horizontal. **Media**.
3. **Escritorio: el cuadro "¿Qué hiciste hoy?" es fijo (sticky, css:160) y tapa las tarjetas** al scrollear; desplegado (al tocar + › Nuevo posteo) tapa aún más. En celular ya se sacó (tanda 21). Además es redundante con el + flotante. **Media**.
4. **Documentos del evento en pantalla angosta**: cada documento se parte en tres renglones (nombre / archivo ✕ / ⊕), con el ⊕ solo en una línea. Se ve en la tarjeta, en la ventana de la ficha y en el hilo. **Media**.
5. **Vista Año del Calendario no muestra nada**: todos los días llevan el mismo círculo celeste; los que tienen eventos no se distinguen. Es una vista que hoy no sirve para lo que promete. **Media** (o sacarla).
6. **Título de la semana** "4 oct – 10 de oct de 2026" (formato distinto en cada mitad); el texto del evento en la vista Semana va centrado verticalmente en un bloque de 8 horas. **Baja**.
7. **Ficha de lugar en celular**: dos botones apilados a lo ancho (Reporte del lugar / + Cargar algo acá) y el segmentado "Solo Argentina · + Región · + Toda LatAm" que se parte en dos filas. **Baja**.
8. **Robustez ante datos malformados**: un alcance con `type` desconocido pinta un chip vacío "● 📍"; un hito sin `label` pinta "undefined"; un `owner` que no es texto pinta "[object Object]"; la "lectura rápida" dice "vencido ()". Lo vi porque mis datos de prueba tenían la forma vieja; con la base real no pasa, pero muestra que el cliente confía en la forma del jsonb (ver backend: ¿la valida la base?). **Baja**.
9. **Nombres de ciudad sin acento en `CITY_PRESETS`** ("Cordoba", "Tucuman", "Bahia Blanca", "Mar Del Plata", "Moron", "Martinez"): la ficha de Argentina dice "Cordoba" aunque los posteos digan "Córdoba". **Baja** (datos).
10. **El velo de los modales atenúa poco** y el + flotante y el botón "subir" quedan encima del velo, clickeables con el modal abierto. **Baja**.

## Diseño: sobrecarga y tamaño

- **El Inicio arranca con tres filas de controles** (composer, buscador + Actividades + Zonas, orden + Actualizar) antes del primer posteo: ≈290 px de 844 en celular. El buscador del Feed duplica al "Buscar en todo…" de la barra (en escritorio hay dos buscadores a la vista).
- **El Inicio muestra primero lo que todavía no pasó.** El orden "Más reciente primero" es por fecha del evento, así que la primera pantalla son ene 2027, dic 2026, nov 2026… y lo que se hizo esta semana queda bajo el pliegue. Para una "memoria histórica" es al revés de lo que uno espera. Propuesta: separar "Próximos" (una tira corta arriba o solo en la columna lateral, que ya existe) de "Lo que pasó" (hoy hacia atrás), o al menos un separador "Hoy".
- **"Actualizar"** (Feed y Calendario) no actualiza la lista: es `sync-calendar`, trae lo nuevo de Google Calendar. El nombre promete otra cosa, y aparece para todo el equipo en dos vistas. Propuesta: "Traer de Google Calendar" en Calendario solamente, o moverlo a Administración (ya está en el Resumen como "Actualizar ahora").
- **Cuatro maneras de crear**: el composer, el + flotante (con dos opciones), "+ Cargar algo acá" en la ficha y "+ Nuevo evento" en el día del calendario. Está bien que haya atajos, pero el composer fijo en escritorio es el que sobra.
- **Calendario con seis vistas** (Día, Semana, Mes, Año, Agenda, 4 días) para un equipo que carga unas 2 a 6 actividades por mes. Día y 4 días quedan vacías casi siempre; Año no distingue nada. Mes + Agenda cubren el uso real.
- **Barra de herramientas del Calendario en celular**: 3 filas (Hoy ‹ › / título / Capas · Mes · Actualizar) + la tira "En curso" ≈ 220 px antes de la grilla.
- **Reportes en celular**: 4 filas de controles (Un período/Comparar, Año, Período + Filtros, Planilla + PDF) ≈ 190 px.
- **Administración tiene 10 secciones** para un equipo de pocas personas: Lugares, Adjuntos (los topes) y Zonas y países se tocan una vez al año. Podrían ir plegadas en "Avanzado" para que Personas, Revisar lo de Calendar y Copia de seguridad queden a la vista.
- **Texto en rojo para todos**: "⚠️ Sin Dónde definido — editalo para asignarle un país/ciudad" sale en rojo en el Feed de cada integrante para lo que vino de Google Calendar, y solo un admin lo puede ordenar en Revisar lo de Calendar. Para el integrante es un reto por algo que no puede hacer.
- **Tarjetas de país** (Países › Lista): seis por fila en 1440 y la línea "Última: Visita a la c…" queda cortada en todas; no dice nada útil. Mejor cuatro por fila o dos renglones.
- **Densidad en escritorio**: el contenido ocupa 1140 px centrados; en 1920 sobran 780 px de fondo liso. Es una decisión válida (lectura cómoda), pero la columna lateral podría aprovechar más (hoy son tres tarjetitas y queda vacía debajo).
- **Modo oscuro y hebreo**: bien resueltos (la barra de abajo se espeja, el + pasa a la izquierda, los contadores van LTR). Sin desbordes en 390 salvo la tabla de Reportes.

## Qué cuenta como "actividad": futuro y pasado mezclados

Confirmado en el código: `armarReporte` (14588) usa `vecesEnVentana` (14464), que excluye cancelados pero no lo posterior a hoy. Efectos que se ven:

- **Reportes 2026** dice "18 actividades ▲13 más que el año anterior" contando nov y dic que todavía no pasaron; "Mes a mes" dibuja barras en meses futuros.
- **Países**: "Próximo: Curso de Team Leader" en la tarjeta, y en la ficha "Este año: 5 registros" suma lo planificado.
- **Perfil de una persona**: "Últimos posteos" lista eventos de dic y nov 2026; "3 posteos en los últimos 6 meses" cuenta futuros.
- **Administración › Personas**: "cargó en 6 meses" ídem.

Para un reporte de gestión esto infla los números. Propuesta: que todo lo que mida "actividad" corte en hoy (o marque lo planificado aparte: "18 realizadas + 4 planificadas").

## Uso: crítica funcional

Lo que está bien y hay que cuidar:

- **La cadena documento → resumen → ficha del lugar** (tandas 30–35) es lo más valioso de la app: el Cierre en Word se lee en el navegador, los objetivos y pendientes quedan en la tarjeta y en la ficha del lugar, y "Lo que sigue" se tilda. Nadie más del equipo tiene que hacer nada para que la memoria se arme sola.
- **Entrada, espera y acceso**: portada sobria, pantalla de espera con los pasos, cuenta personal (gmail) avisada. Es de las mejores partes.
- **Celular**: barra de abajo con el + en el medio, la ficha de Personas a pantalla completa, el mes con puntos y la lista del día debajo. Se usa bien con una mano.
- **Hebreo/RTL completo** y cuatro idiomas sin huecos (1.557 textos, todos con sus cuatro versiones).

Lo que se usa poco o confunde:

- **"Le avisamos al administrador ✓"** en la pantalla de espera (10646) promete un aviso que no existe: no hay correo ni push; el admin se entera cuando abre la app y ve el 2 rojo. "Suele tardar menos de un día" es una promesa que la app no puede cumplir. Habría que decir la verdad ("el administrador lo ve la próxima vez que entra") o mandar un correo (REVISION.md, "a decidir", punto 1).
- **Revisar lo de Calendar tiene 925 eventos esperando** desde la tanda 19 (REDISENO.md, "Decisiones pendientes"). Mientras tanto, 925 posteos "Otro" sin lugar ensucian el Feed, el mapa, los reportes y las fichas ("Sin Dónde definido" en rojo). Es la decisión pendiente con más impacto en lo que se ve.
- **Me gusta** en un registro interno de trabajo: es inofensivo, pero cada tarjeta lleva corazón, burbuja de nombres y la lista de quiénes; para un equipo de pocas personas es más ruido que señal. Si se quiere mantener, está bien; si no, sacarlo simplifica cada tarjeta.
- **Repetición de eventos** (recurrencias con saltos y movimientos, `recurrence_skip`/`recurrence_moves`): es la parte más compleja del modelo de datos y no vi ninguna rutina recurrente en lo que hay cargado hoy. Conviene confirmar si se usa; si no, es un candidato a simplificar.
- **Reportes › Sugerencias para el año siguiente**: reglas simples bien explicadas, pero con los eventos futuros contados ("Argentina creció de 1 a 5") las conclusiones salen torcidas (ver arriba).
- **Dos buscadores** (barra + Feed), **dos "Actualizar"**, **dos lugares para los filtros** (chips del Feed, accesos directos de la columna, filtros guardados). Funciona, pero cada duplicado es una cosa más que explicar.
- **Proyectos**: la línea de tiempo en escritorio es clara; en celular no entra (ya arranca en Tarjetas). Los hitos del proyecto aparecen también en el Calendario (como "◆ Hito") y en la ficha del lugar: tres lugares para lo mismo, consistente pero denso.

## Lo que no pude verificar acá

- El teclado del celular de verdad (la prueba de la tanda 21 fue simulada achicando la ventana). Al tocar + › Nuevo posteo en celular, el composer quedó fuera de la pantalla en mi captura porque el modo "teclado" despega el header; en un teléfono real el navegador desplaza el campo a la vista, pero conviene probarlo en un iPhone y un Android.
- El mapa (los tiles no llegan desde el sandbox); el aviso de "no se pudo cargar" es claro.
- Las fotos de verdad (usé una imagen de 1 px): el visor con fotos reales ya lo revisó el usuario en la tanda 30.
