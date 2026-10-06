# Auditoría completa — 6 de octubre de 2026

Pedido del usuario: una auditoría de todo (bugs, código muerto, seguridad,
diseño, sobrecarga y tamaño de lo visual, estética en escritorio y celular,
almacenamiento, uso de las funcionalidades) y una crítica del uso, para
terminar con la lista de mejoras ordenada en **urgente, importante, medio,
bajo y opcional**.

Este archivo es el resumen y la lista de prioridades. El detalle de cada
hallazgo (archivo y línea, fragmento, arreglo propuesto) está en cinco
informes aparte, en `docs/auditoria/`:

| Informe | Qué cubre |
|---|---|
| `docs/auditoria/seguridad.md` | el cliente (`index.html`) y los workflows: XSS, dependencias, tokens, privacidad |
| `docs/auditoria/backend.md` | Supabase (esquema, políticas, pruebas SQL), el sincronizador de Calendar, la limpieza, la copia de seguridad, los workflows y las cuotas del plan gratis |
| `docs/auditoria/codigo.md` | bugs probables, código muerto, CSS que sobra, duplicaciones, tamaño y accesibilidad |
| `docs/auditoria/rendimiento.md` | peso de carga, arranque, renders, imágenes, memoria, almacenamiento del navegador, red |
| `docs/auditoria/diseno-y-uso.md` | lo que vi usando la app en escritorio y celular, claro y oscuro, español y hebreo, y la crítica de uso |

**Cómo se hizo.** Sobre el commit `d12352f` de `main` (todo al día).
Primero se corrió la suite entera: **1.448 comprobaciones en 30 archivos,
todas en verde**. Después cuatro revisiones en paralelo sobre el código (cada
hallazgo abierto y leído antes de anotarlo, con archivo y línea), una
corrida de la app con 2.000 posteos y 3.000 comentarios de prueba para medir
tiempos, y un recorrido a mano de las 37 pantallas con datos parecidos a los
reales, en 1440, 1920, 1024, 768, 390 y 360 píxeles, claro y oscuro, español,
inglés y hebreo (90 capturas). Lo que no se puede ver desde el repo (paneles
de Supabase, Google Cloud, Google Calendar, GitHub) está marcado
**a confirmar** y va en una lista al final.

---

## En una página

**La app está bien hecha.** Lo que importa está resuelto y se nota que hubo
una revisión seria hace tres días: permisos en la base para todo lo
sensible (los botones del cliente son comodidad, no la barrera), todo texto
escapado salvo contadas excepciones, pruebas que corren en cada push,
copia de seguridad semanal, cuatro idiomas completos con hebreo de derecha a
izquierda, modo oscuro, celular con barra propia. No se encontró ninguna
fuga de memoria, ningún texto sin traducir, ningún guardado que se trague un
error, ningún link que permita `javascript:`.

**Lo que hay que arreglar ya** son cinco cosas, ninguna visible a simple
vista, y por eso peligrosas:

1. **El sitio se publica antes de que corran las pruebas.** Cada push a
   `main` sale a producción en un minuto; las pruebas tardan diez y no
   frenan nada. Un `index.html` roto queda en línea hasta el próximo push.
2. **Dos pushes seguidos aplican el SQL en paralelo** a la base real y
   pueden dejarla con el esquema viejo sin que nada quede en rojo. Son dos
   líneas en un workflow.
3. **Cada pestaña abierta escribe en la base cada 30 segundos** (el token
   de Google Calendar) y ese cambio se difunde en vivo a todas las demás.
   Con ocho pestañas abiertas en el equipo son casi dos millones de
   mensajes por mes: la cuota del plan gratis de Supabase que primero se
   agota.
4. **El id de un posteo o comentario va sin escapar en 46 atributos del
   HTML.** La base no exige ninguna forma para el id, así que un integrante
   aprobado puede escribir, desde su propia sesión, una fila con un id
   armado que ejecute código en el navegador de todos los demás, incluido
   el admin. Lo puede hacer solo alguien ya aprobado; igual es el único
   hallazgo de seguridad de gravedad alta.
5. **El calendario de Google del equipo es público para todo internet** y
   su identificador está en el repo público. Es lo que permite leerlo sin
   login desde la app y desde el trabajo nocturno, pero significa que
   cualquiera que tenga el id lee los 925 eventos desde 2019: títulos,
   lugares, horarios, invitados. Esta es una decisión del usuario.

**Lo que más se nota al usar la app** (y que no apareció en ninguna
revisión anterior): en escritorio, cambiar de pestaña no vuelve arriba (se
entra al Calendario sin su barra de herramientas y a Reportes por la
mitad); el Inicio muestra primero lo que todavía no pasó (ene 2027, dic
2026…) y lo hecho esta semana queda bajo el pliegue; **los reportes, las
fichas y los perfiles cuentan como actividad los eventos futuros** ("18
actividades, 13 más que el año anterior" incluye lo planificado para
noviembre y diciembre); la tabla "Por persona del equipo" de Reportes se
sale de la pantalla del celular; y el botón "Actualizar" no actualiza la
lista, trae lo de Google Calendar.

**Lo que pesa:** 1,43 MB de HTML (414 KB comprimido) que se vuelve a bajar
entero con cada uno de los ~50 pushes semanales; Leaflet (el mapa) se carga
en cada visita aunque se use en una subvista; el arranque encadena seis
viajes al servidor y dibuja la pantalla once veces. En un celular con 4G
lento son 8 a 10 segundos hasta ver el Feed con comentarios.

**Lo que sobra:** 6 funciones y 6 ramas del despachador que nadie llama,
38 clases CSS sin uso y reglas que se pisan, 8 puntos de quiebre distintos
para lo que son tres tamaños de pantalla, tres vocabularios para "lugar" y
dos relojes (uno local y uno UTC) que al tocarse producen los cinco bugs de
fecha del informe de código.

---

## La lista, por prioridad

Cada fila dice qué, por qué importa, dónde está el detalle, cuánto trabajo
es (**chico**: menos de una hora; **medio**: una tanda; **grande**: varias
tandas) y quién decide (**Claude** lo puede hacer solo; **usuario** tiene
que decidir o hacer un paso en un panel).

### Urgente — esta semana

> **6/10/2026: U1 a U4 hechos** (commits `f15e3e2`, `a67723f`, `c5a47a9`).
> Para que U1 tenga efecto falta un clic del usuario: Settings → Pages →
> Build and deployment → Source → «GitHub Actions». Hasta entonces el
> trabajo «Publicar el sitio» corre las pruebas y avisa en su resumen que
> todavía no publica. U5 queda esperando la decisión del usuario y la
> confirmación en Google Calendar de que el calendario está público.

| # | Qué | Por qué | Detalle | Trabajo | Quién |
|---|---|---|---|---|---|
| U1 | ~~Publicar GitHub Pages desde un workflow que espere a las pruebas~~ ✅ 6/10 (falta el clic en Pages) | hoy un `index.html` roto está en línea desde el minuto 1 y las pruebas avisan 10 minutos después, sin vuelta atrás | backend 4 | medio | Claude arma el workflow; **usuario** cambia Settings → Pages → Source a "GitHub Actions" (un clic, Claude le dice dónde) |
| U2 | ~~`concurrency` en `base-de-datos.yml` (y en `calendario.yml`, `limpieza.yml`) y que los jobs con secretos corran solo desde `main`~~ ✅ 6/10 | dos pushes seguidos aplican el SQL a la vez y puede quedar el esquema viejo; con el botón "Run workflow" se aplica a producción el SQL de cualquier rama | backend 3 y 11, seguridad 15 | chico | Claude |
| U3 | ~~Escapar `post.id` y `r.id` en los 46 atributos y exigir en la base que el id sea `[A-Za-z0-9_-]{1,40}`~~ ✅ 6/10 | XSS almacenado que un integrante aprobado puede meter desde su sesión y corre en el navegador del admin | seguridad 1 | chico (cliente) + chico (SQL con su prueba) | Claude |
| U4 | ~~Guardar el token de Calendar solo si cambió, sin `lastSyncedAt` en cada vuelta; pausar el sondeo con la pestaña oculta; subirlo de 30 s a 2–5 min~~ ✅ 6/10 | 5.760 pedidos por día por pestaña y 120 × N² mensajes por hora de Realtime; es la primera cuota que se agota | backend 2, rendimiento 11 y G | chico | Claude |
| U5 | Decidir qué hacer con el calendario público | cualquiera con el id (que está en el repo) lee todos los eventos desde 2019; la alternativa es leer con credencial (token de lectura en el navegador + cuenta de servicio en el nocturno) y cerrar el calendario | backend 1, seguridad 6 | grande | **usuario** decide; primero **confirmar** en Google Calendar que efectivamente está "público – ver todos los detalles" |

### Importante — en las próximas dos o tres semanas

| # | Qué | Por qué | Detalle | Trabajo | Quién |
|---|---|---|---|---|---|
| I1 | ~~Las pestañas de arriba hacen `scrollToTop()` como ya lo hace la barra de abajo~~ ✅ 6/10 | en escritorio se entra al Calendario sin su barra (`scrollY=95`) y a Reportes por la mitad (`scrollY=879`); lo nota cualquiera todos los días | diseño 1 (`index.html:19149`) | chico | Claude |
| I2 | Que todo lo que mide "actividad" corte en hoy, o separe "realizadas" de "planificadas" | Reportes, Países, la ficha, el perfil y "cargó en 6 meses" cuentan eventos futuros; las "Sugerencias para el año siguiente" salen torcidas | diseño, "futuro y pasado" (`armarReporte` 14588, `vecesEnVentana` 14464) | medio | Claude; **usuario** decide si lo planificado se muestra aparte o no se cuenta |
| I3 | ~~Aislar los visores de Word y planilla en un `<iframe sandbox>` y subir SheetJS de 0.18.5 a 0.20; `integrity` en los cinco recursos de CDN que no lo tienen; una CSP en `<meta>`~~ ✅ 6/10 (CSP completa queda para cuando se pueda probar contra el sitio de verdad) | SheetJS 0.18.5 tiene vulnerabilidades conocidas; los dos visores dibujan un archivo ajeno en el DOM de la app, donde vive el token de sesión | seguridad 2, 3, 4, 16 | medio | Claude |
| I4 | ~~El sincronizador nocturno: no guardar el token si un evento falló por error de red o 5xx (reintentar); recortar lo que va al registro público; sumar `calendar_sacados` a lo que la limpieza considera "usado"~~ ✅ 6/10 | un error pasajero pierde un cambio de Calendar para siempre; el registro público de Actions puede mostrar la fila entera de un posteo; lo "sacado del Registro" pierde sus adjuntos a los 32 días y "Devolver" lo devuelve roto | backend 5, 6, 7 | medio | Claude |
| I5 | ~~Zonas horarias: pedir los eventos a Google con la zona del calendario y crearlos con esa misma zona; preferir `originalStartTime` para las excepciones de una serie; un helper `isoLocalDe(ms)` para los cinco lugares que mezclan día UTC con día local~~ ✅ 6/10 (falta confirmar la zona horaria del calendario LatAm; la app la toma sola de Google) | un evento con hora cargado desde Israel se "corrige" solo a otra hora (y deja comentario); una rutina de 22:00 en Buenos Aires se salta el día equivocado; "Hoy/Ayer", "este mes" y las series por mes se corren después de las 21:00 en Argentina o antes de las 03:00 en Israel | backend 8 y 9, código 1–5 | medio, con prueba en `TZ=Asia/Jerusalem` y `America/Argentina/Buenos_Aires` | Claude; **confirmar** la zona horaria del calendario LatAm |
| I6 | ~~Endurecer cuatro puntos de la base: `unificar_cuentas` no toca al admin fijo y queda en la auditoría; `registrar_posteo` anota cualquier edición de contenido (hoy se esquiva sin `last_edited_at` o firmando "Google Calendar"); `editors`, `participants`, `calendar_event_id`, `sin_calendar` solo autor/editor/admin; subir al bucket solo a `posts/` y `replies/`~~ ✅ 6/10 (participantes y vínculo con Calendar siguen abiertos a propósito) | un admin por rol puede quedarse con todo lo del admin fijo sin dejar rastro; una edición puede no anotarse; cualquiera puede sacar o poner participantes en un evento ajeno | backend 10, 13, 17, 18, con las pruebas SQL que faltan (19) | medio | Claude |
| I7 | Ensayar una restauración completa en un proyecto gratis aparte, escribir `restaurar.mjs` (resubir `archivos/`) y `docs/RESTAURAR.md` | la copia existe pero nadie hizo el camino de vuelta; no hay herramienta para resubir miles de archivos al bucket; el volcado no incluye `auth` ni la configuración del proyecto | backend 14 | grande | Claude arma; **usuario** crea el proyecto de prueba |
| I8 | ~~Arranque más liviano: Leaflet a demanda, `replies` en paralelo con `posts` y las páginas 2..n juntas, `scheduleRender()` en todas las suscripciones, `posts` sin la columna `resumen` en la lista~~ ✅ 6/10 (mapa a demanda y pedidos en paralelo; juntar los dibujados del arranque pasa a M7) | −5 pedidos y −60 KB por carga; −0,5 a −1,5 s hasta ver comentarios en 4G; 11 renders → 3; −50 % a −80 % del JSON de posteos | rendimiento A, B, C, D | medio | Claude |
| I9 | ~~Tres bugs visuales: la tabla "Por persona" de Reportes en celular (426 px en 390), el cuadro "¿Qué hiciste hoy?" fijo en escritorio que tapa las tarjetas, y las filas de documentos que se parten en tres renglones en angosto~~ ✅ 6/10 | se ven en el uso diario | diseño 2, 3, 4 | chico cada uno | Claude |
| I10 | "Le avisamos al administrador ✓" y "Suele tardar menos de un día" en la pantalla de espera | prometen un aviso que no existe (no hay correo ni push; el admin se entera cuando abre la app) | diseño, "uso" (`index.html:10646`) | chico (cambiar el texto) o grande (mandar correo: ver O5) | **usuario** elige |

### Medio — próximo mes

| # | Qué | Por qué | Detalle | Trabajo | Quién |
|---|---|---|---|---|---|
| M1 | La IP: dejar que la base la tome del pedido (como ya hace con los `post_*`) en vez de pedirla a `api.ipify.org`; retención (borrar la IP a los 90 días); decirlo en la app | cada integrante le cuenta su IP a un tercero en cada login y la auditoría guarda para siempre dónde estuvo cada persona; además la IP la declara el cliente, no es prueba de nada | backend 15, seguridad 7 | medio | **usuario** decide la retención; Claude hace |
| M2 | Avisar que "Ver traducción" manda el texto a un servicio externo (MyMemory), o sacarlo de lo sensible | el contenido de un posteo viaja por la URL a un servicio gratuito que puede guardarlo | seguridad 7 | chico | **usuario** |
| M3 | Revisar lo de Calendar: usar la herramienta (925 eventos esperando desde la tanda 19) | mientras tanto, 925 posteos "Otro" sin lugar ensucian el Feed, el mapa, los reportes y las fichas, y el aviso rojo "Sin Dónde definido" lo ven todos | diseño, "uso" | tiempo del **usuario** | **usuario** |
| M4 | El Inicio: separar "Próximos" de "Lo que pasó" (o un separador "Hoy"); renombrar "Actualizar" a "Traer de Google Calendar" y dejarlo solo en Calendario; un solo buscador en escritorio; menos filas de controles antes del primer posteo | la primera pantalla es toda futuro; "Actualizar" promete otra cosa; tres filas de controles (≈ 290 px de 844 en celular) | diseño, "sobrecarga" | medio | Claude propone con capturas; **usuario** elige |
| M5 | ~~Accesibilidad: `--text-muted` un poco más oscuro (hoy 4,3 de contraste sobre el fondo, el mínimo es 4,5, en 86 reglas de letra chica); los chips de filtro y las tarjetas de país como `<button>`; nombre accesible en los seis "✕"; `prefers-reduced-motion` global~~ ✅ 6/10 | hoy no se llega con Tab a los chips ni a las tarjetas de país, y el lector de pantalla no los anuncia | código 7–11 | medio | Claude |
| M6 | Calendario: sacar o arreglar la vista Año (todos los días con el mismo círculo, no distingue nada); evaluar si Día y 4 días sirven para 2–6 actividades por mes | menos vistas, menos que explicar | diseño 5 | chico | **usuario** decide |
| M7 | ~~Renders: memorizar lo derivado por posteo (repeticiones, próximos, hitos) entre renders; "Ver más" que agrega tarjetas en vez de rehacer el Feed; cachear `armarReporte`~~ ✅ 6/10 (Inicio de 150 a 70 ms con 2.000 posteos; falta que «Ver más» agregue en vez de rehacer) | con 2.000 posteos el Feed tarda 94 ms por render (cada tecla del buscador, cada aviso en vivo), Reportes 137 ms, "Ver más" 356 ms; en celular ×3 | rendimiento E, F, 6, 7, 8 | medio | Claude |
| M8 | ~~"Copia completa" desde Administración: mostrar "X archivos, Y MB" y pedir confirmación pasados 200 MB; un medidor del bucket en Administración~~ ✅ 6/10 | un clic baja el bucket entero (hasta 1 GB = un quinto de la cuota mensual de descarga) y arma un zip en memoria; el GB de Storage es la cuota que se llena por uso normal y nadie lo ve | backend 16 y cuotas | chico | Claude |
| M9 | ~~`esta-arriba.yml`: que mire también Supabase (`/rest/v1`, `/auth/v1/health`) y corra solo cada 6 horas~~ ✅ 6/10 (probado en verde contra el sitio y Supabase de verdad) | hoy es manual, no mira la base y no avisa a nadie; un `schedule` que falla manda mail al dueño | backend 21 | chico | Claude |
| M10 | Datos personales en el repo público: un correo real en un comentario del código; nombres de pila con ciudad en `13-sugerencias-calendar.sql` | el repo es público; con el calendario público (U5) el id de evento es el evento | seguridad 14, backend 23 | chico | **usuario** decide qué sacar; Claude saca |
| M11 | ~~Cinco endurecimientos chicos: `photoURL` de una solicitud limitada a dominios conocidos (hoy es un píxel de rastreo de los admins); neutralizar `= + - @` al inicio de celdas en los CSV; `esc()` en el ícono de tipo (4 lugares) y en el mensaje de error de Calendar; borrar el token de Calendar también cuando la sesión termina desde otra pestaña~~ ✅ 6/10 | seguridad 9–13 | chico | Claude |
| M12 | Administración: plegar Lugares, Adjuntos y Zonas en "Avanzado" | diez secciones para un equipo chico; tres se tocan una vez al año | diseño, "sobrecarga" | chico | **usuario** decide |
| M13 | ~~Pruebas SQL que faltan: `storage.objects` como integrante, campos de un evento ajeno, admin por rol vs admin fijo, editar sin firmar, `devolver_al_registro` conserva `created_at`, rechazado que vuelve a pendiente~~ ✅ 6/10 (las de I6) | las preguntas de I6 hoy no tienen prueba; `correr.sh` solo toma archivos `8x-` y `9x-` | backend 19 | medio | Claude (junto con I6) |

### Bajo — cuando se toque esa parte

| # | Qué | Detalle |
|---|---|---|
| B1 | Borrar 6 funciones sin llamador, 6 ramas del despachador que ningún botón emite, 38 clases CSS sin uso y 5 reglas pisadas; unificar los 8 puntos de quiebre en 3 (≤ 520, ≤ 760, ≥ 1024); 18 bloques `@media 640` repartidos | código 12–16, rendimiento 15 |
| B2 | Unificar los tres vocabularios de "lugar" y los dos resolvedores de nivel; dejar un solo reloj (local) y un solo parser de fecha tipeada; una sola `personaDe()` | código 17–19 |
| B3 | `crearSupabaseStore` tiene 890 líneas y `CLICK_ACTIONS` 1.500; nueve funciones de más de 100 líneas | código 20 |
| B4 | ~~Workflows: `permissions: contents: read` en los seis; acciones fijadas por SHA; sacar los `insert/update` que el `02` le suma de más a las tablas del `12`; borrar tres índices que nadie usa; uniformar `search_path` en las funciones `security invoker`~~ ✅ 6/10 | seguridad 8, backend 20, 25, 26 |
| B5 | Datos y robustez: `CITY_PRESETS` con nombres sin acento ("Cordoba", "Tucuman", "Bahia Blanca"); el cliente pinta "undefined" o "[object Object]" si un hito o un alcance vienen con otra forma (la base no valida la forma de `scopes` ni `milestones`); `memberByEmail` distingue mayúsculas | diseño 8–9, código 6, backend "jsonb sin forma" |
| B6 | ~~Base: borrar `user_prefs` al revocar (hoy quedan para siempre); tope de tiempo para que un rechazado vuelva a "pendiente"; `devolver_al_registro` conserve `created_at` (hoy el devuelto aparece como nuevo); Realtime manda los `DELETE` (correos) a todas las pestañas~~ ✅ 6/10 | backend "otros puntos" |
| B7 | Visual chico: título de la semana "4 oct – 10 de oct de 2026"; texto del evento centrado en el bloque de la vista Semana; velo de los modales que atenúa poco y deja el + y "subir" encima; ficha de lugar en celular con dos botones apilados y el segmentado en dos filas; tarjetas de país con "Última: Visita a la c…" cortado | diseño 6, 7, 10 y "sobrecarga" |
| B8 | Miniaturas en WebP (−30 %); `prefers-reduced-transparency` para la barra con `backdrop-filter`; un `Map` por `calendarEventId` para la resincronización completa | rendimiento J, L, M |
| B9 | El token `RESPALDOS_TOKEN` vence el 5/10/2027: una deploy key SSH no vencería; mover la limpieza del bucket de las 07:30 a las 09:00 para no pisarse con la copia de las 07:00 | backend 27 y "carrera con la copia" |
| B10 | Confirmar que las series con repetición (`recurrence_skip`/`recurrence_moves`) se usan; si no, es lo más complejo del modelo de datos y se puede simplificar | diseño, "uso" |

### Opcional — decisiones de producto

| # | Qué | Qué resuelve | Qué cuesta |
|---|---|---|---|
| O1 | **Dominio propio** (`docs/DOMINIO.md`) | el origen compartido `team-latam.github.io` (el token de sesión y las firmas los puede leer cualquier otra página publicada en esa cuenta); y el bloqueo en Argentina si vuelve | el plan ya está escrito; hay que sumar el dominio en Google Cloud **antes** de mudar |
| O2 | **Calendar con cuenta de servicio** (REVISION.md, "a decidir", 2) | cierra el calendario público (U5), saca el popup de permiso y el scope `calendar.events` sobre todos los calendarios de cada persona, y el evento llega aunque se cierre la pestaña | cambia cómo se usa: avisar antes |
| O3 | **Avisos por correo** (Resend, 3.000 por mes gratis) | "Le avisamos al administrador" pasaría a ser verdad; menciones y resumen semanal | una función de Supabase y una cuenta en Resend |
| O4 | **PWA**: `manifest.json`, ícono, `theme-color`, service worker | instalable en el celular con ícono propio; visitas repetidas sin bajar 414 KB; portada visible sin red | dos archivos más en la raíz (hoy la regla es "solo `index.html`") |
| O5 | **Publicar una copia sin comentarios** desde el workflow de U1, dejando el fuente como está | 414 → ≈ 250 KB comprimido (−40 %); 225 KB de comentarios menos para el parser | choca con "sin build": el fuente no cambia, pero lo publicado sería otro archivo |
| O6 | **Separar los cuatro idiomas** en archivos | ≈ 45 KB comprimidos menos por carga | ídem: más de un archivo |
| O7 | **Me gusta**: dejarlo o sacarlo | menos ruido por tarjeta en un registro de trabajo de pocas personas | nada; es gusto del equipo |
| O8 | **Seis vistas del Calendario** → Mes + Agenda (+ Semana) | menos que explicar | ver M6 |

---

## Lo que hay que confirmar en los paneles (el usuario)

Son cosas que desde el repo no se ven. Para cada una, Claude le da los pasos
y él cuenta qué vio.

1. **Google Calendar** → configuración del calendario "LatAm" → *Permisos
   de acceso para eventos*: ¿dice "Disponible públicamente – Ver todos los
   detalles del evento"? (U5). Y en el mismo lugar, ¿cuál es la **zona
   horaria** del calendario? (I5).
2. **Google Cloud** (proyecto `40280679854`) → APIs y servicios → Pantalla
   de consentimiento → *Publishing status*: ¿"Testing" o "In production"?
   (backend 28; cambia qué pasa con una persona nueva del equipo).
3. **Supabase** → SQL Editor: `select has_table_privilege('postgres',
   'auth.identities', 'select');` tiene que dar `true` (backend 12: si da
   `false`, el control del correo cayó en silencio a un dato que el usuario
   puede reescribir).
4. **Supabase** → Settings: ¿el proyecto avisó alguna vez de pausa por
   inactividad? (las llamadas nocturnas con la llave de servicio deberían
   contar como actividad; a confirmar).
5. **GitHub** → Settings → Actions → *Workflow permissions*: debería estar
   en "Read repository contents" (B4). Y Settings → Pages → *Source*: hoy
   "Deploy from a branch"; para U1 pasa a "GitHub Actions".
6. **Un iPhone y un Android de verdad**: tocar + › "Nuevo posteo" con el
   teclado abierto, y subir una foto desde la cámara (la prueba de la tanda
   21 fue simulada achicando la ventana).

---

## Lo que está bien y conviene no tocar

- **Autorización en la base** para cada acción sensible (borrar, aprobar,
  revocar, rol, unificar, sacar del Registro, configuración), RLS en las
  diez tablas, `anon` sin permisos, funciones con `search_path` fijo,
  políticas con `(select …)`, topes de fila, hora del servidor, me gusta
  atómico, un login por día.
- **`esc()` parejo**, `safeUrl()` sin `javascript:`, imágenes solo
  `data:` validadas o firmadas del propio bucket, sin SVG, colores del
  admin solo `#rrggbb`, rutas del bucket armadas por la app y validadas.
- **Las pruebas**: 1.448 en la app más ~300 en SQL, que sacan el código del
  `index.html` real en cada corrida; CI que reaplica el esquema sobre datos
  al límite; la prueba diferencial del sincronizador.
- **Carga a demanda** de JSZip, SheetJS, docx-preview y Google Identity;
  miniaturas con firmas estables y `loading="lazy"`; `scheduleRender()` por
  frame; foco y selección restaurados tras cada render; canales y
  listeners que se cierran; el heap en 20–37 MB con 2.000 posteos.
- **La cadena documento → resumen → ficha del lugar**: el Cierre en Word se
  lee en el navegador, los objetivos y pendientes quedan en la tarjeta y en
  la ficha, "Lo que sigue" se tilda. Es lo más valioso de la app y nadie
  del equipo tiene que hacer nada extra para que funcione.
- **La entrada** (portada, espera, cuenta personal avisada), **el celular**
  (barra de abajo con el + en el medio, fichas a pantalla completa, el mes
  con puntos), **hebreo y modo oscuro** completos, sin desbordes en 390 px
  salvo la tabla de Reportes.
- **Los workflows**: entradas por `env:` y no interpoladas, logs con solo
  cantidades y rutas, sin `pull_request_target`, secretos solo en Secrets,
  `concurrency` en la copia.

---

## Cómo seguir

Propuesta de orden, pensada para que lo urgente salga sin esperar
decisiones:

1. **Tanda 1 (Claude, sin decisiones):** U2, U3, U4, I1, I9, M11 y el
   workflow de U1. Al terminar, el usuario cambia el *Source* de Pages.
2. **Decisiones del usuario, con capturas y opciones:** U5 (calendario
   público), I2 (futuro aparte o no), I10/O3 (aviso al admin), M1 (IP y
   retención), M4 (Inicio), M6/O8 (vistas), M12 (Administración), O7 (me
   gusta). Y la lista de confirmaciones en los paneles.
3. **Tanda 2:** I3, I4, I5, I6 + M13, I8.
4. **Tanda 3:** I7 (restauración ensayada), M5, M7, M8, M9.
5. **Después:** lo Bajo cuando se toque cada parte, y lo Opcional según lo
   decidido.
