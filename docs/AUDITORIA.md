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

**Cómo se hizo.** Sobre `4b31799` de `main` (lo último: la Agenda con
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
| R1 | La ficha de un lugar cuenta lo planificado: «N registros en 12 meses» y las barras del Ritmo suman lo de este mes que todavía no pasó; «N visitas en los últimos 12 meses» y «Última visita» de la lectura rápida toman fechas futuras | tercera vez que vuelve (RECURRENTES: «lo que todavía no pasó, contado como hecho»); por regla sube de nivel | Claude |
| R2 | «Próximos eventos» esconde lo que se repite: usa la repetición *más cercana* a hoy, que puede ser la de ayer, y la descarta. Una rutina de los lunes desaparece de la columna de martes a jueves | la columna del Inicio, todos los días | Claude |
| R3 | Un integrante puede cancelar un evento ajeno en dos escrituras (primero se suma como editor o participante, después cancela). La auditoría del 6/10 (I6) dijo que `editors` quedaba restringido: no lo está | cancelar saca el evento del Calendar de todos; la regla que decidiste (tanda 17) no se cumple | Claude |
| R4 | Ninguna copia automática todavía: la única es la manual del 5/10; la primera dominical sería el 11/10 (y GitHub la atrasa 5–7 horas) | cinco días de cambios sin copia, la Agenda entera entre ellos | **usuario** (Actions → «Copia de seguridad» → Run workflow) o Claude, si lo pedís |
| R5 | `ubuntu-latest` pasa a Ubuntu 26 el 19/10 (aviso en los 14 jobs de la última corrida de los 10 workflows). Fijar `ubuntu-24.04` | puede romper bajar el navegador de las pruebas y el volcado de la base del domingo 25/10 | Claude |
| R6 | Los enlaces y «links de texto» en celeste (`--celeste-dark`) dan 3,1 de contraste en claro (mínimo 4,5): Agenda, ficha de un lugar, solapas, Calendario | baja visión, en toda la app; en oscuro pasa holgado | Claude (un celeste un poco más oscuro solo para el texto) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| R7 | Reportes → Inicio no siempre lista lo que la fila contó: (a) si la preferencia «Qué incluir» está en «+ Región», la lista suma lo de la región; (b) un alcance puesto en un comentario cuenta en el Inicio y no en Reportes; (c) una rutina semanal cuenta 13 veces en la fila y es una tarjeta en la lista | la tanda 42 prometió «la lista da lo mismo que la fila» | Claude |
| R8 | Una preferencia de correo mal formada (`emailHour: "nueve"`, por API) rompe los avisos de todo el equipo: `prefs_de_correo` castea sin mirar el tipo y la corrida de resúmenes se cae entera | riesgo real que todavía no pasó | Claude |
| R9 | «Devolver al Registro» falla con copias guardadas antes del 4/10 (la columna `sin_calendar` quedó `null`); cada columna obligatoria nueva repite el problema | el camino de vuelta de «Sacar del Registro» | Claude |
| R10 | La limpieza de las marcas de avisos solo corre si la corrida cae a las 4 de la mañana de Argentina; con el atraso de GitHub nunca cayó | la regla de «nunca si es exactamente esta hora» ya estaba (7/10) y se repitió | Claude |
| R11 | La limpieza del bucket y la copia del domingo no comparten cola: si GitHub atrasa más a la copia, la limpieza mueve archivos mientras la copia los baja | B9 las separó dos horas, pero el atraso varía | Claude (dos líneas) |
| R12 | «Restaurar una copia» nunca se ejecutó de verdad (6 corridas, todas por push): I7 sigue abierto | el camino de vuelta no está probado | **usuario** crea un proyecto gratis de prueba; Claude hace el resto |
| R13 | Los avisos nuevos de la Agenda («Número copiado», «Guardado: N») y los de Calendar no se anuncian al lector de pantalla | quien usa lector aprieta «Copiar» y no oye nada | Claude |
| R14 | Los resultados de «Buscar en todo» y las filas de Reportes que llevan al Inicio pierden el anillo de foco (`outline:none`) | con teclado es como no tener foco | Claude |
| R15 | supabase-js entra por `import()` sin huella (SRI): es la librería que maneja la sesión. Quedó del 6/10 (hallazgo 4 de seguridad) sin cerrar y la herramienta no lo veía | si el CDN sirviera otra cosa, corre con la sesión de cada persona | Claude (`modulepreload` con `integrity`; la herramienta ya lo mira) |
| R16 | «Ver calendario» desde la tarjeta de «Próximos eventos» marca el día solo si el Calendario está en Mes; en Semana, Año o Agenda va a la fecha sin marcar | la tanda 38 prometió «con el día marcado» | Claude |
| R17 | Contraste en lo nuevo: el logo de WhatsApp chico sobre su fondo verde en claro (1,8); el número blanco del tono 3 del mapa de calor de Año (2,1); el tono más alto de «Todos los años» en claro (3,1); el rojo de alerta (4,0) y el atajo rápido activo del Inicio (1,3) en oscuro; lo cancelado o cerrado al 60 % (2,5) | baja visión | Claude |
| R18 | El archivo pesa 514 KB comprimidos (414 el 6/10, 458 el 7/10): +24 % en cuatro días; 165 KB son comentarios. Es la opción O5 (publicar sin comentarios, el fuente igual) que dejaste para después | cada visita baja el archivo entero | **usuario** decide O5 |
| R19 | En el celular, botones de toque chicos en lo nuevo: el WhatsApp chico (28 px de alto), la ✕ de todas las ventanas (24), los chips (26–28), «Ver más» y «Volver» (texto suelto) | mínimo recomendado 44 px | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| R20 | Base: me gusta ajenos al crear un posteo (la política de insert no mira `liked_by`); `requested_at` lo cambia quien pide (un correo al admin por cada rechazo, sin espera); `personas.lista` sin clave foránea y el correo de una ficha lo cambia cualquiera (cruza con «aprobar y vincular»); campos libres en el login de alguien de afuera; comentario «Google Calendar» en una rutina ajena; `papelera/` legible por todo aprobado | Claude, con sus pruebas SQL |
| R21 | Lógica chica: ciudades duplicadas por ortografía en «Buscar en todo» (se ven idénticas); `ventanaDelReporte` repite `ventanaDe`; «+ Sumar» en un país con la Agenda vacía pide crear una institución; la fila de una región y «Ver Agenda» abren la Agenda sin filtro; «Toda LatAm» en la ficha de una persona lleva a Países; «Ver N posteos» suma las dos solapas; se ofrece un trimestre que no empezó; un período aplicado desde «Próximos» deja la solapa vacía | Claude, cuando se toque |
| R22 | Accesibilidad menor: al volver de una ficha de la Agenda el foco va al buscador y no a la fila; «Buscar en todo» sin flechas ni `aria-expanded`, y con Escape el foco cae al fondo; solapas de arriba sin `aria-current`; «Ver más» sin `aria-expanded`; dos `h1` en la ficha; `th` sin `scope`; buscadores con `type="text"`; sin `autocomplete` en nombre/teléfono/correo; «↗» sin espejar en hebreo y el interruptor de Personas/Tipos tampoco; `alt` vacío en el visor de fotos; el avatar de iniciales se lee dos veces; cinco ✕ sin nombre; tres `scrollIntoView` suaves que no miran «reducir movimiento»; la barra de desplazamiento propia poco visible en oscuro | Claude |
| R23 | El visor de archivos: si el foco entra al PDF (un clic adentro), Tab puede salir de la ventana (el iframe no está en la trampa). Con teclado desde los botones no se reproduce; `pantallas` lo vio una vez en 390 | Claude, cuando se toque |
| R24 | `data-title` y `data-content` llevan el texto entero del posteo en «Ver traducción» (escapado, pero contra la convención) | Claude, cuando se toque |
| R25 | ~~Documentación desfasada: README decía que se publica «desde la rama» y que el sincronizador usa `CALENDAR_API_KEY`; CLAUDE.md ponía Pages en condicional~~ ✅ 10/10 | Claude |
| R26 | Versiones: `actions/setup-node` 7.1.0 (A17), jszip 3.10.2, supabase-js 2.117.3. Nada que estos workflows o la app usen | Claude, cuando se toquen |
| R27 | Pruebas SQL que faltan: qué funciones puede llamar `anon`; observador sobre `audit_log`, `access_requests`, el bucket; los puntos de R3 y R20; admin por rol vs fijo en comentarios; `search_path` fijo en las `security definer`; forma de `user_prefs`; que `avisos_*` no estén en Realtime; `storage.objects` con lectura en el laboratorio | Claude, junto con R3 y R20 |

### Herramientas y pruebas

| # | Qué | Quién |
|---|---|---|
| R28 | ~~`seguridad` no veía un `import()` de afuera sin huella~~ ✅ 10/10 (mira que haya un `modulepreload` con `integrity` para esa URL) | Claude |
| R29 | ~~Dos falsos positivos: el ejemplo de correo «en hebreo» y un teléfono inventado de una prueba SQL~~ ✅ 10/10 (`conocidos.json`) | Claude |
| R30 | `pantallas` dio un hallazgo que no se repite (R23): cuando una medición no se reproduce dos veces va a «dudas», y la herramienta tendría que anotar el camino del foco | Claude, cuando se toque |

### Para el usuario

| # | Qué | Quién |
|---|---|---|
| D1 | **El peso del archivo** (R18): ¿publicar una copia sin comentarios (O5)? El fuente no cambia; lo publicado sería otro archivo, un tercio más liviano. Recomendación: sí, cuando el archivo pase los 600 KB; hoy todavía carga en unos segundos en 4G | **usuario** |
| D2 | **¿Un observador puede bajar la Agenda entera en planilla?** Hoy sí (decidiste que todos ven teléfonos; ver y exportar son cosas distintas). Recomendación: la planilla solo para quien carga eventos | **usuario** |
| D3 | **Los nombres de prueba** del repositorio público: Ana Pérez, Diego Martínez, Lucía Fernández Goldberg y Moshe Levi con casillas `@team-latam.com`. Si alguno coincide con alguien real del equipo, su correo queda adivinable: se cambian por nombres claramente inventados | **usuario** confirma |
| D4 | **Un número con forma real en el historial**: en un comentario del `mapeo.html` retirado (commits `b0bbd3f` y `7371ca7`) quedó `1 (929) 555-0100` como ejemplo de formato; 929 es Nueva York. Si está en tu Excel es un teléfono real público; si no, no hay nada. El Excel de prueba de esos commits está anonimizado (Persona 1…159, teléfonos `+1 555`), pero trae la estructura real: ~90 ciudades con cantidad de miembros y entidades | **usuario** mira en «Mapeo - LatAm» |
| D5 | **Dos personas distintas con el mismo nombre** quedan en una sola ficha al traer una lista (`agenda_traer` une por nombre sin tildes) | **usuario** decide si lo acepta |
| D6 | **Proteger `main`** contra `push --force` y borrado (un ruleset; el push directo sigue andando) | **usuario**, opcional |
| D7 | **Settings de GitHub** que la API no deja leer: Secret scanning y Push protection prendidos; Actions → permisos en «Read»; Pages ya está en «GitHub Actions» (verificado por los logs) | **usuario** confirma |
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

1. **Hoy, un clic tuyo:** la copia a mano (R4). Si preferís, la disparo yo.
2. **Tanda 1 (Claude, sin decisiones):** R1, R2, R3, R5, R7, R8, R9,
   R10, R11, R13, R14, R15, R16, R17, R19, y los bajos rápidos (R20, R22),
   cada uno con su prueba en rojo contra el código de hoy.
3. **Decisiones tuyas, de a cuatro:** D1 a D8.
4. **Después:** R12 (el ensayo de restauración, cuando tengas el proyecto
   de prueba), R21, R23–R27 cuando se toque cada parte.
