# Auditoría completa — 10 de octubre de 2026

> Las anteriores están en `docs/auditoria/historial/`: la completa del
> 6/10/2026 (códigos U, I, M, B y O), la de lo nuevo del 7/10 (C, E, P y G)
> y la de la Agenda del 9/10 (A). Los de esta van con **R**. El método:
> `auditoria/METODO.md`.

Pedido del usuario: «una revisión completa del sistema, como ya sabes que
se realiza, junto con toda la batería de puntos, entre ellos diseño,
funcionalidades, etc.».

El detalle de cada hallazgo (archivo y línea, cómo se dispara, cómo se
arreglaría) está en `docs/auditoria/2026-10-10-completa.md`. La página
para el usuario, en palabras simples:
https://claude.ai/artifact/WU63mH5TcT2TrJQbQqsA92 (privada).

**Cómo se hizo.** Sobre `3adb02c` de `main` (lo último: la Agenda con
contactos por lugar, y el retiro de «Revisar el Mapeo»). Las herramientas
(`./auditoria/correr.sh`, completa): **2.194 comprobaciones de la app en
verde**, Calendar, copias y las 486 de la base en verde; pantallas en 13
combinaciones de tamaño, idioma, oscuro y letra ancha; datos variados con
dos semillas (20261010 con 1.500 posteos y 14839 con 800) sin un solo error
ni texto roto, con HTML metido en cada campo. Cinco revisiones a mano en
paralelo: los permisos de la base (rol por rol, con la base local
descartable), seguridad y privacidad (las 859 interpolaciones sin `esc()`
leídas una por una, los servicios de afuera, el historial de git), la
lógica de las tandas 37–44, 57 y 59 (lo hecho después del 6/10 que ninguna
auditoría había mirado), accesibilidad e idiomas (contraste calculado para
60 pares de colores en claro y oscuro), y GitHub (las corridas de los 10
workflows, sus avisos, las ramas). Capturas de cada vista en seis
combinaciones (compu y celular de 661 px de alto, claro y oscuro, hebreo),
y un recorrido como integrante: cargar un evento y una rutina, buscar algo
viejo, ir de una fila de Reportes al Inicio, revisar lo de Calendar, llegar
al WhatsApp de un contacto desde Países.

---

## Estado al cerrar la tanda 1 (10/10/2026)

**Hecho (con su prueba, en verde: 2.273 de la app y 516 de la base):**
R1, R2, R3, R4, R5, R6, R7 (a y b), R8, R9, R10, R11, R13, R14, R16, R17,
R19, parte de R20, R22 y R27, más R25, R28 y R29 de antes; y de lo que
pediste ese día: la planilla de la Agenda solo para quien carga eventos,
la tabla «Por país» de Comparar sin barra lateral, y «Ver traducción» en
las respuestas.

**Queda para Claude** (sin decisiones tuyas, en orden):

1. **R15**: la huella de supabase-js. No es un cambio chico: el `+esm` de
   jsDelivr se genera en el servidor y una huella fija podría romper la app
   entera. El camino es pasar a la build UMD con `cargarScript` y huella, y
   tocar las pruebas que simulan el CDN. Tanda aparte, con cuidado.
2. **R12** (ensayo de restauración) cuando tengas el proyecto de prueba.
3. **Lo que quedó de R20, R22 y R27** (listado en cada fila), **R21, R23,
   R24, R26 y R30**: bajos, cuando se toque cada parte.

**Queda para vos:**

- **D4, dos cosas:** volver a tildar «Block force pushes» (Settings →
  Rules → Rulesets → el de `main`), y pedirle a GitHub que borre las copias
  sueltas de los commits viejos: https://support.github.com/contact (motivo
  «quitar datos sensibles de un repositorio»); sin eso, quien tenga el
  enlace exacto a un commit viejo lo sigue viendo un tiempo. Y si tenés el
  repositorio clonado en otra computadora, clonarlo de nuevo.
- **D8**: probar la Agenda en el teléfono (el teclado de verdad no se
  puede simular).
- **R4**: mirar el lunes 12/10 que la copia del domingo esté en verde.
- **D1** queda decidida (todavía no); se vuelve a mirar al pasar los 600 KB.
- **El dominio** `team-latam.com` vence el 12/12/2026; desde el 1/12 se te
  recuerda al empezar cada sesión.

---

## En una página

**La app está sana.** Ninguna prueba en rojo, ningún error en pantalla con
datos raros, nada cortado en ningún tamaño ni idioma, nada que se pueda
ejecutar metiendo HTML en los campos, ninguna llave en el repositorio, los
permisos de la base como los decidiste. Lo que apareció es de otro orden:
cuentas que no cierran, cosas que la auditoría anterior dio por hechas y
no lo estaban, y detalles de accesibilidad en lo nuevo.

**Lo que más pesa (importante):**

1. **Tres cuentas que no cierran.** La ficha de un lugar cuenta lo
   planificado de este mes como hecho («N registros en 12 meses», «Última
   visita»): es la tercera vez que vuelve esta falla, por eso sube de
   nivel. «Próximos eventos» del Inicio esconde una rutina semanal tres de
   cada siete días. Y una fila de Reportes puede llevar a una lista del
   Inicio que no da el mismo número (tres casos).
2. **Un integrante puede cancelar un evento ajeno** sumándose primero como
   editor: la auditoría del 6/10 dio por hecho que `editors` quedaba
   restringido y no lo está. Cancelar lo saca del Calendar de todos. Hay
   que hacerlo a propósito desde la consola del navegador; nadie lo hizo.
3. **Todavía no hubo ninguna copia de seguridad automática.** La única
   copia es la manual del 5/10 (el workflow nació después del domingo 4).
   Desde entonces entró la Agenda entera. La primera dominical es mañana
   11/10. Conviene disparar una a mano hoy.
4. **El 19/10 GitHub cambia `ubuntu-latest` a Ubuntu 26** y lo avisa en
   todas las corridas. Puede romper el paso que baja el navegador para las
   pruebas (el que ya se colgó el 7/10) y el que vuelca la base en la
   copia. Se fija la versión de hoy (`ubuntu-24.04`) en los 10 workflows.
5. **Los enlaces celestes no se leen bien en modo claro**: 3,1 de
   contraste, el mínimo es 4,5. Es el color de marca usado como texto
   chico en la Agenda («Ver la ficha ›», «Volver», el teléfono), «Ver
   más», los contadores de las solapas. Un celeste apenas más oscuro para
   el texto lo arregla.

**Lo que decidís vos** está al final: el peso del archivo (ya 514 KB
comprimidos, de los que 165 son comentarios), si un observador puede bajar
la Agenda entera en planilla, dos cosas del repositorio público (los
nombres de prueba y un número de teléfono en un comentario viejo), y las
confirmaciones en los paneles de GitHub.

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| R1 | ~~La ficha de un lugar cuenta lo planificado: «N registros en 12 meses» y las barras del Ritmo suman lo de este mes que todavía no pasó; «N visitas en los últimos 12 meses» y «Última visita» de la lectura rápida toman fechas futuras~~ ✅ 10/10 (la ficha, el Ritmo, «Última visita» y «último: hace N días» cuentan solo lo hecho; `ficha_planificado_test`) | tercera vez que vuelve (RECURRENTES: «lo que todavía no pasó, contado como hecho»); por regla sube de nivel | Claude |
| R2 | ~~«Próximos eventos» esconde lo que se repite: usa la repetición *más cercana* a hoy, que puede ser la de ayer, y la descarta. Una rutina de los lunes desaparece de la columna de martes a jueves~~ ✅ 10/10 (`proximaFecha()`: la primera repetición que viene; `proximos_que_viene_test`) | la columna del Inicio, todos los días | Claude |
| R3 | ~~Un integrante puede cancelar un evento ajeno en dos escrituras (primero se suma como editor o participante, después cancela). La auditoría del 6/10 (I6) dijo que `editors` quedaba restringido: no lo está~~ ✅ 10/10 (los editores los suma solo quien maneja el posteo y nadie se suma solo como participante de un evento ajeno; `90-permisos.sql`. Cambia algo de la vida diaria; D9: el usuario eligió dejarlo así) | cancelar saca el evento del Calendar de todos; la regla que decidiste (tanda 17) no se cumple | Claude |
| R4 | ~~Ninguna copia automática todavía: la única es la manual del 5/10; la primera dominical sería el 11/10 (y GitHub la atrasa 5–7 horas)~~ ✅ 10/10 (copia manual disparada y en verde a las 16:12 UTC, corrida 13; falta ver la del domingo) | cinco días de cambios sin copia, la Agenda entera entre ellos | **usuario** (Actions → «Copia de seguridad» → Run workflow) o Claude, si lo pedís |
| R5 | ~~`ubuntu-latest` pasa a Ubuntu 26 el 19/10 (aviso en los 14 jobs de la última corrida de los 10 workflows). Fijar `ubuntu-24.04`~~ ✅ 10/10 (`runs-on: ubuntu-24.04` en los 10 workflows; `workflows_test` rechaza cualquier «-latest») | puede romper bajar el navegador de las pruebas y el volcado de la base del domingo 25/10 | Claude |
| R6 | ~~Los enlaces y «links de texto» en celeste (`--celeste-dark`) dan 3,1 de contraste en claro (mínimo 4,5): Agenda, ficha de un lugar, solapas, Calendario~~ ✅ 10/10 (`--link`, 5,8 de contraste; `accesibilidad_test`) | baja visión, en toda la app; en oscuro pasa holgado | Claude (un celeste un poco más oscuro solo para el texto) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| R7 | ~~Reportes → Inicio no siempre lista lo que la fila contó: (a) si la preferencia «Qué incluir» está en «+ Región», la lista suma lo de la región; (b) un alcance puesto en un comentario cuenta en el Inicio y no en Reportes; (c) una rutina semanal cuenta 13 veces en la fila y es una tarjeta en la lista~~ ✅ 10/10 en (a) y (b) (la fila fija «solo lo propio» y «solo el alcance del posteo»; `reporte_ir_nivel_test`). Queda (c): una rutina semanal cuenta 13 veces en la fila y es una tarjeta en la lista; es de promesa, no de código, y está anotado | la tanda 42 prometió «la lista da lo mismo que la fila» | Claude |
| R8 | ~~Una preferencia de correo mal formada (`emailHour: "nueve"`, por API) rompe los avisos de todo el equipo: `prefs_de_correo` castea sin mirar el tipo y la corrida de resúmenes se cae entera~~ ✅ 10/10 (`entero_de_pref` y el tipo de cada valor; `82-avisos-por-correo.sql`) | riesgo real que todavía no pasó | Claude |
| R9 | ~~«Devolver al Registro» falla con copias guardadas antes del 4/10 (la columna `sin_calendar` quedó `null`); cada columna obligatoria nueva repite el problema~~ ✅ 10/10 (`posts_de_fabrica()` rellena las columnas obligatorias, leídas del catálogo; `87-revisar-calendar.sql`) | el camino de vuelta de «Sacar del Registro» | Claude |
| R10 | ~~La limpieza de las marcas de avisos solo corre si la corrida cae a las 4 de la mañana de Argentina; con el atraso de GitHub nunca cayó~~ ✅ 10/10 (la limpieza corre en cada corrida; `supabase/avisos/pruebas/resumen.mjs`) | la regla de «nunca si es exactamente esta hora» ya estaba (7/10) y se repitió | Claude |
| R11 | ~~La limpieza del bucket y la copia del domingo no comparten cola: si GitHub atrasa más a la copia, la limpieza mueve archivos mientras la copia los baja~~ ✅ 10/10 (la limpieza del bucket usa el mismo grupo que la copia) | B9 las separó dos horas, pero el atraso varía | Claude (dos líneas) |
| R12 | «Restaurar una copia» nunca se ejecutó de verdad (6 corridas, todas por push): I7 sigue abierto | el camino de vuelta no está probado | **usuario** crea un proyecto gratis de prueba; Claude hace el resto |
| R13 | ~~Los avisos nuevos de la Agenda («Número copiado», «Guardado: N») y los de Calendar no se anuncian al lector de pantalla~~ ✅ 10/10 (`role=status aria-live=polite`) | quien usa lector aprieta «Copiar» y no oye nada | Claude |
| R14 | ~~Los resultados de «Buscar en todo» y las filas de Reportes que llevan al Inicio pierden el anillo de foco (`outline:none`)~~ ✅ 10/10 (sin `outline:none`) | con teclado es como no tener foco | Claude |
| R15 | supabase-js entra por `import()` sin huella (SRI): es la librería que maneja la sesión. Quedó del 6/10 (hallazgo 4 de seguridad) sin cerrar y la herramienta no lo veía | si el CDN sirviera otra cosa, corre con la sesión de cada persona | Claude (`modulepreload` con `integrity`; la herramienta ya lo mira) |
| R16 | ~~«Ver calendario» desde la tarjeta de «Próximos eventos» marca el día solo si el Calendario está en Mes; en Semana, Año o Agenda va a la fecha sin marcar~~ ✅ 10/10 (desde Año o Agenda pasa a Mes; en Semana y Día marca la columna del día; `proximos_que_viene_test`) | la tanda 38 prometió «con el día marcado» | Claude |
| R17 | ~~Contraste en lo nuevo: el logo de WhatsApp chico sobre su fondo verde en claro (1,8); el número blanco del tono 3 del mapa de calor de Año (2,1); el tono más alto de «Todos los años» en claro (3,1); el rojo de alerta (4,0) y el atajo rápido activo del Inicio (1,3) en oscuro; lo cancelado o cerrado al 60 % (2,5)~~ ✅ 10/10, salvo la barra de desplazamiento: la oscurecí y `barra_test` frenó el cambio, porque es el diseño que elegiste el 8/10; queda como estaba | baja visión | Claude |
| R18 | El archivo pesa 514 KB comprimidos (414 el 6/10, 458 el 7/10): +24 % en cuatro días; 165 KB son comentarios. Es la opción O5 (publicar sin comentarios, el fuente igual) que dejaste para después | cada visita baja el archivo entero | **usuario** decide O5 |
| R19 | ~~En el celular, botones de toque chicos en lo nuevo: el WhatsApp chico (28 px de alto), la ✕ de todas las ventanas (24), los chips (26–28), «Ver más» y «Volver» (texto suelto)~~ ✅ 10/10 en lo principal (en pantalla táctil el WhatsApp chico y la ✕ de las ventanas miden 40 px; chips, solapas y links de acción, 32). Quedan como estaban los chips de los formularios y «Volver» de la Agenda, para que «Sumar a alguien» siga entrando en 660 px | mínimo recomendado 44 px | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| R20 | Base, bajos. ~~Me gusta ajenos al crear un posteo o un comentario; `requested_at` lo cambia quien pide; `papelera/` legible por todo aprobado~~ ✅ 10/10 (`90-permisos.sql`, `92-validacion.sql`). **Quedan:** `personas.lista` sin clave foránea y el correo de una ficha lo cambia cualquiera (cruza con «aprobar y vincular»); campos libres en el login de alguien de afuera; un comentario «Google Calendar» en una rutina ajena | Claude, con sus pruebas SQL |
| R21 | Lógica chica: ciudades duplicadas por ortografía en «Buscar en todo» (se ven idénticas); `ventanaDelReporte` repite `ventanaDe`; «+ Sumar» en un país con la Agenda vacía pide crear una institución; la fila de una región y «Ver Agenda» abren la Agenda sin filtro; «Toda LatAm» en la ficha de una persona lleva a Países; «Ver N posteos» suma las dos solapas; se ofrece un trimestre que no empezó; un período aplicado desde «Próximos» deja la solapa vacía | Claude, cuando se toque |
| R22 | Accesibilidad menor. ~~La pestaña activa con `aria-current`; buscadores con `type=search`; `autocomplete` en teléfono y correo; el avatar de iniciales con `aria-hidden`~~ ✅ 10/10. **Quedan:** al volver de una ficha de la Agenda el foco va al buscador y no a la fila; «Buscar en todo» sin flechas ni `aria-expanded`, y con Escape el foco cae al fondo; «Ver más» sin `aria-expanded`; dos `h1` en la ficha; `th` sin `scope`; «↗» y el interruptor de Personas/Tipos sin espejar en hebreo; `alt` vacío en el visor de fotos; cinco ✕ sin nombre; tres `scrollIntoView` suaves que no miran «reducir movimiento» | Claude |
| R23 | El visor de archivos: si el foco entra al PDF (un clic adentro), Tab puede salir de la ventana (el iframe no está en la trampa). Con teclado desde los botones no se reproduce; `pantallas` lo vio una vez en 390 | Claude, cuando se toque |
| R24 | `data-title` y `data-content` llevan el texto entero del posteo en «Ver traducción» (escapado, pero contra la convención) | Claude, cuando se toque |
| R25 | ~~Documentación desfasada: README decía que se publica «desde la rama» y que el sincronizador usa `CALENDAR_API_KEY`; CLAUDE.md ponía Pages en condicional~~ ✅ 10/10 | Claude |
| R26 | Versiones: `actions/setup-node` 7.1.0 (A17), jszip 3.10.2, supabase-js 2.117.3. Nada que estos workflows o la app usen | Claude, cuando se toquen |
| R27 | Pruebas SQL que faltan. ~~Las de R3, R8, R9 y lo hecho de R20~~ ✅ 10/10. **Quedan:** qué funciones puede llamar `anon`; observador sobre `audit_log`, `access_requests` y el bucket; admin por rol vs fijo en comentarios; `search_path` fijo en las `security definer`; que `avisos_*` no estén en Realtime | Claude, junto con R3 y R20 |

### Herramientas y pruebas

| # | Qué | Quién |
|---|---|---|
| R28 | ~~`seguridad` no veía un `import()` de afuera sin huella~~ ✅ 10/10 (mira que haya un `modulepreload` con `integrity` para esa URL) | Claude |
| R29 | ~~Dos falsos positivos: el ejemplo de correo «en hebreo» y un teléfono inventado de una prueba SQL~~ ✅ 10/10 (`conocidos.json`) | Claude |
| R31 | ~~**El teléfono real se había copiado a los documentos de esta auditoría** (los dos de hoy; error mío al anotarlo, ya subidos a `main` y a la rama de la sesión). Se sacó de los archivos de hoy; sigue en el historial y se saca con la reescritura de D4. En los documentos y en la página se escribe siempre recortado~~ ✅ 10/10 (sacado de los archivos y del historial con la reescritura de D4) | Claude, con la reescritura |
| R30 | `pantallas` dio un hallazgo que no se repite (R23): cuando una medición no se reproduce dos veces va a «dudas», y la herramienta tendría que anotar el camino del foco | Claude, cuando se toque |

### Para el usuario

| # | Qué | Quién |
|---|---|---|
| D1 | ~~**El peso del archivo** (R18): ¿publicar una copia sin comentarios (O5)? El fuente no cambia; lo publicado sería otro archivo, un tercio más liviano. Recomendación: sí, cuando el archivo pase los 600 KB; hoy todavía carga en unos segundos en 4G~~ ✅ 10/10: todavía no; se vuelve a mirar al pasar los 600 KB | **usuario** |
| D2 | ~~**¿Un observador puede bajar la Agenda entera en planilla?** Hoy sí (decidiste que todos ven teléfonos; ver y exportar son cosas distintas). Recomendación: la planilla solo para quien carga eventos~~ ✅ 10/10: solo quien carga eventos (`agenda_planilla_test`) | **usuario** |
| D3 | ~~**Los nombres de prueba** del repositorio público: Ana Pérez, Diego Martínez, Lucía Fernández Goldberg y Moshe Levi con casillas `@team-latam.com`. Si alguno coincide con alguien real del equipo, su correo queda adivinable: se cambian por nombres claramente inventados~~ ✅ 10/10: ninguno es real; quedan como están | **usuario** confirma |
| D4 | ~~**Un número con forma real en el historial**: en un comentario del `mapeo.html` retirado (commits `3c7c8ac` y `c2a2b2a`) quedó `1 (929) …` como ejemplo de formato; 929 es Nueva York. Si está en tu Excel es un teléfono real público; si no, no hay nada. El Excel de prueba de esos commits está anonimizado (Persona 1…159, teléfonos `+1 555`), pero trae la estructura real: ~90 ciudades con cantidad de miembros y entidades — **En curso**: el número es real. Se reescribe el historial (hace falta que apagues un momento «Block force pushes»; ver «Lo que queda»)~~ ✅ 10/10: el número era real. Se reescribió el historial de `main` (10 commits, de `3c7c8ac` en adelante, con un número inventado en su lugar); se revisaron las 536 revisiones, ninguna lo conserva, y los dos pull requests viejos (de septiembre) tampoco. Los árboles de la punta quedaron idénticos. Los códigos de esos commits cambiaron | **usuario** mira en «Mapeo - LatAm» |
| D5 | ~~**Dos personas distintas con el mismo nombre** quedan en una sola ficha al traer una lista (`agenda_traer` une por nombre sin tildes)~~ ✅ 10/10: se acepta por ahora; se revisa la vista previa al traer una lista | **usuario** decide si lo acepta |
| D6 | ~~**Proteger `main`** contra `push --force` y borrado (un ruleset; el push directo sigue andando)~~ ✅ 10/10: la rama `main` ya está protegida (lo hizo el usuario) | **usuario**, opcional |
| D7 | ~~**Settings de GitHub** que la API no deja leer: Secret scanning y Push protection prendidos; Actions → permisos en «Read»; Pages ya está en «GitHub Actions» (verificado por los logs)~~ ✅ 10/10: Secret scanning, Push protection, permisos de Actions y Pages, confirmados por el usuario | **usuario** confirma |
| D9 | ~~**¿Cualquiera puede sumarse solo como participante de un evento de otro?** Desde R3 no: lo suma el autor, un editor o un admin (sumar a OTROS sigue abierto). Quien lo intenta ve el aviso de error con el motivo. Si la gente se suma sola a eventos del equipo, hay que dejarlo abierto y cerrar la cancelación de otra manera. Recomendación: dejarlo cerrado, que es lo que decidiste en la tanda 17 (cancela solo quien creó el evento, sus participantes, editores o un admin)~~ ✅ 10/10: el usuario eligió dejarlo cerrado, como en la tanda 17 | **usuario** |
| D8 | **Probar en el teléfono** (A18, sigue): la Agenda, «+ Sumar», una foto desde la cámara | **usuario** |

---

## Operación (solo para tenerlo a la vista)

- **Los trabajos programados corren 5–7 horas tarde**: Calendar (cron 03:00
  AR) corre todos los días a las 09:10–09:50; los resúmenes por correo
  (cada hora) corrieron 10 veces en 55 horas; «¿Está arriba?» tres veces
  por día en vez de cuatro. Nada en rojo; los resúmenes no se pierden por
  el margen de 12/48 h. Es la cola de GitHub.
- **Vence:** `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN`
  30/9/2027; el dominio `team-latam.com` **12/12/2026** (Squarespace,
  renovación automática; desde el 1/12 se recuerda al empezar).
- **Secretos** andando (inferido de los logs, nunca se vio un valor): base,
  llave de servicio, cuenta de servicio, Resend, el token de las copias, el
  de las funciones. Sin evidencia de los `PRUEBA_SUPABASE_*` (R12).
- **Almacenamiento:** la copia del 5/10 bajó 27 archivos; la última
  limpieza (4/10) movió 1 a la papelera. El medidor del bucket lo ve el
  admin en Administración › Copia de seguridad (en la app de mentira: 3 MB
  de 1 GB).
- **Ramas:** solo `main`; cero `claude/…` sueltas; cero PRs.
- **Uso de las funciones:** no se puede medir desde acá sin tocar la base
  real; queda como estaba (M3: 925 posteos de Calendar sin clasificar,
  tiempo del usuario).

## Lo que sigue abierto de las anteriores

De la del 9/10: A17 (= R26) y A18 (= D8). De la del 7/10: E8, P7, P8, P12
(bajos), P13, E10, E11 (opcionales). De la del 6/10: I7 (= R12), M3, M4
(un solo buscador en escritorio), B3, O1 (dominio propio), O2 (escribir en
Calendar con la cuenta de servicio), O4 (instalable), O5 (= D1), O6, y la
confirmación 6 (= D8). Decidido y no se vuelve a proponer: la IP en el
registro de actividad se guarda siempre (M1, 6/10); «Ver traducción» queda
(M2); el calendario con seis vistas (O8); los me gusta (O7).

## Lo que está bien y conviene no tocar

- **Seguridad:** ningún XSS (859 interpolaciones leídas; con HTML metido
  en 1.500 posteos, 400 instituciones y 320 personas no se ejecutó nada);
  `esc()`, `safeUrl()`, `wa.me` y `tel:` solo con dígitos; CSP; las 25
  funciones `security definer` con `search_path` fijo; `anon` sin ningún
  privilegio; las tablas de avisos sin acceso para `authenticated`; los
  correos con destinatarios que decide la base; la función `calendario`
  con sesión y campos recortados; sin llaves en los 50 commits del clon;
  los logs públicos de Actions solo con cantidades y rutas.
- **Los permisos de la Agenda y las personas** como los decidiste.
- **Pantallas:** nada cortado en 13 combinaciones; hebreo espejado
  (flechas, paneles, el teléfono siempre de izquierda a derecha); el oscuro
  completo; las ventanas con `role="dialog"`, foco que entra, Tab que no
  se escapa, Escape y foco que vuelve; en el celular ninguna abre el
  teclado sola; todas en el medio.
- **Rendimiento:** el Inicio con 1.500 posteos en 36–48 ms; sin bucles de
  más en las tandas nuevas; `fp` sobrevive a los redibujados de Realtime.
- **Idiomas:** 2.008 textos en cuatro idiomas; el hebreo es hebreo y el
  portugués, portugués (327 llamadas de la Agenda muestreadas); plurales
  por función; fechas con el idioma elegido.
- **Workflows:** todas las acciones por huella (coinciden con sus
  etiquetas), permisos de lectura, tiempos máximos, secretos solo desde
  `main`, `concurrency` donde escriben; Pages publica solo con verde (cinco
  rojos desde el 6/10 y ninguno dejó el sitio roto).
- **El recorrido:** cargar un evento (6 campos, entra sin desplazarse en
  la compu; en el celular el botón queda a la vista), una rutina desde el +,
  buscar «Caracas» (lo encuentra en el Inicio, en «Buscar en todo» con el
  lugar, la Agenda y el Feed), Reportes → Inicio (6 = 6 en el caso simple),
  Revisar lo de Calendar solo para admins, el WhatsApp de un contacto a
  tres toques desde Países.

## Cómo seguir

1. **Vos, ahora:** volver a tildar «Block force pushes» y el pedido a
   GitHub (D4).
2. **Después:** R15 en su propia tanda; R12 cuando tengas el proyecto de
   prueba; lo bajo cuando se toque cada parte.
3. **Vos:** D8, cuando puedas.
