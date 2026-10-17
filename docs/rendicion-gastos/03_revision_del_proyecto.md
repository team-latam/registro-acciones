# Módulo de gastos: revisión del proyecto para la Fase 1

> Hecha el 2026-10-17 por Claude Code, antes de escribir una línea del módulo.
> Cubre lo que el diseño (`02_diseno_modulo_gastos.md`) deja pendiente en «Estado»: el modelo de Acción y las tablas
> actuales de Supabase. **No se tocó nada** del proyecto: ni base, ni app, ni Drive, ni el Sheet.
> Esta nota no lleva IDs, cuentas ni terminaciones de tarjeta (el repo es público).

## 1. Qué hay hoy

- **Nada de gastos.** No hay tabla, pantalla, función ni prueba que hable de gastos, comprobantes o rendición.
- **Una «Acción» es una fila de `posts`.** `id` de texto, `activity_type` (`rutina | visita | curso | seminario | congreso |
  virtual | otro`, más los que cree el admin), `start_date`/`end_date`, `scopes` (lista de lugares: país o ciudad),
  `participants`, `files`, y `resumen` (lo leído del Formulario de Cierre/Viaje de una visita).
- **No existe una entidad «viaje».** Una visita a varias ciudades es **un solo posteo con varios lugares y un solo rango de
  fechas**: no guarda fechas ni moneda por lugar. Por eso los `tramos` del diseño son tablas nuevas; se pueden **proponer**
  desde los lugares del posteo, pero las fechas de cada tramo y la moneda las pone una persona.
- **«Rutina» quiere decir otra cosa en la app.** Acá es un tipo de posteo (la entrada liviana del día a día, con su propio
  composer). El «grupo Rutina del mes» del diseño es un cubo de gastos sueltos. Mismo nombre, dos cosas: conviene otro
  nombre en pantalla (p. ej. «Gastos del mes») y no mezclarlas en el código.
- **Tipos de la app vs. «Actividad» del Sheet**: la app tiene 7 tipos (más los del admin) y el Sheet acepta 4. Congreso,
  Virtual y Otro no tienen destino (la decisión abierta de «Congreso» es más grande que Congreso). El mapeo ya está previsto
  como configuración; no bloquea la Fase 1.
- **Quién puede qué**: admin fijo, admin por rol, integrante y observador. Hoy cualquier aprobado **ve todo** lo del equipo.
  El diseño no dice quién ve ni quién carga gastos, y es plata: **hay que decidirlo antes de escribir las políticas**.
- **Monedas**: la app no sabe monedas. `COUNTRIES` solo trae zona y coordenadas. `moneda_local` por tramo es un dato nuevo.
  El proceso usa «MX» (lista del Sheet) y «MEX» (observaciones) para el peso mexicano; el código ISO es `MXN`. Hay que fijar uno.

## 2. Cómo se suma una tabla en este proyecto (lo que la Fase 1 va a tener que cumplir)

Sumar una tabla con su pantalla toca de diez a veinte archivos (así fue `problemas`, 22: el SQL, su prueba, los inventarios,
`index.html`, dos pruebas de la app y los README); la Fase 1 trae 4 o 5 tablas.

1. **SQL numerado e idempotente** (`26-…sql`): `create table if not exists`, `check` con topes (largo de textos, rangos,
   estados), RLS prendido, `revoke all` + `grant` mínimo, una política por acción con
   `es_admin_fijo()` / `es_admin_rol()` / `puede_escribir()`, y las funciones `security definer` con `set search_path = ''`.
   Se aplica solo al llegar a `main`, después de probarlo en una base descartable.
2. **Prueba SQL** nueva en `supabase/pruebas/` (`NN-…sql`) con los seis roles (admin fijo, admin por rol, integrante,
   observador, ex integrante, de afuera), y `reaplicar-con-datos.sh` (aplicar el esquema de nuevo con datos al límite).
3. **Inventarios que hacen fallar la prueba si se olvidan**: `funciones-esperadas.sql` (cada función nueva que se pueda
   llamar), `TABLAS` en `supabase/respaldo/respaldar.mjs` y `TABLAS_DE_LA_COPIA` en `index.html` (la copia semanal),
   `06-tiempo-real.sql` y la prueba `88` (cuáles se mandan en vivo), `verificar/permisos.sql`.
4. **La app**: un adaptador `store.*`, la pantalla, textos **en cuatro idiomas** (`t(es, en, pt, he)`, con hebreo
   espejado), `data-action` + rama en el despachador, modales accesibles, y su prueba en `herramientas/pruebas/`.
5. **Recorrido de bienvenida**: una solapa nueva obliga a un paso en `tourSteps()`; una sección de Administración no
   (queda cubierta por `TOUR_SIN_PASO.admin`).
6. **Bucket de adjuntos** (solo si los comprobantes llegan a Storage): hoy es privado, 25 MB, tipos permitidos, y solo acepta
   rutas `posts/…` y `replies/…`. La limpieza semanal **mueve a la papelera todo archivo que ninguna fila nombre**: hay que
   sumar la tabla nueva a `limpieza_del_bucket()` o los comprobantes se van a la papelera.

## 3. Huecos y cosas a afinar en el diseño

- **Dónde se crea la «Rutina del mes»**: sin servidor propio, lo natural es una función de la base que la crea al cargar el
  primer gasto del mes (no un cron).
- **Montos**: `numeric(12,2)`, nunca decimal flotante; `monto_usd` admite NULL (regla del proceso: no se inventa conversión).
- **`accion_id`**: referencia a `posts(id)`. Borrar un posteo solo lo hace el admin fijo; conviene `on delete set null` (un
  gasto ya rendido no debe desaparecer ni bloquear el borrado) y que el gasto guarde el título de la acción.
- **`tarjeta`**: guardar solo la terminación (4 dígitos) como el proceso; las pruebas y el SQL del repo con datos
  **inventados**, nunca las terminaciones reales.
- **Tipos del Sheet** (Reunión, Comida, Pasaje…): en la base una **clave estable** y la etiqueta traducida en pantalla; al
  Sheet siempre va el texto en español de la lista desplegable.
- **Los comprobantes en Drive no entran en la copia semanal** (la copia guarda IDs y enlaces). Si la cuenta de Drive se
  pierde, se pierden los archivos. A tener presente cuando se decida la Fase 2.
- **Google (Fase 2 y 3, no 1)**: lo que existe hoy es una cuenta de servicio que **solo lee** el calendario del equipo, y el
  cliente de OAuth del login. Para la opción (a): si la pantalla de consentimiento está «En prueba», el permiso (refresh
  token) vence a los 7 días; con el alcance `drive.file` la app solo ve lo que ella misma crea (no la carpeta raíz que ya
  existe). La opción (b) (Apps Script como dueño) evita las dos cosas. Confirmar contra la documentación de Google antes de
  decidir. Regla del proyecto: nada de secretos pegados en el chat.

## 4. Propuesta de Fase 1 (a aprobar)

- **Base**: `26-gastos.sql` con `grupos_rendicion`, `tramos`, `cambios_moneda`, `gastos` y `comprobantes` (esta última
  queda sin usar hasta la Fase 2, para no migrar después). Solo la gente que se decida (ver abajo) lee y escribe.
  Pruebas SQL con los seis roles; sumadas a la copia, el tiempo real y las listas de funciones.
- **App**: una sección de **Administración → Gastos** (sin tocar el recorrido de bienvenida): crear un grupo
  (Visita/Curso/Seminario/Congreso o «Gastos del mes»), sus tramos y, si hubo, sus cambios de moneda; cargar, editar y
  confirmar gastos a mano; observaciones generadas con la regla del proceso; Monto USD vacío cuando no hay un USD ni un
  cambio aplicable; totales por tipo y por grupo. Cuatro idiomas.
- **Fuera de la Fase 1**: Drive, Sheet, extracción automática, PDFs, y cualquier credencial de Google.

## 5. Decisiones que necesita el usuario (con recomendación)

1. **¿Quién ve y carga los gastos?** A) Solo admins *(recomendada)*; B) cualquier integrante carga y ve lo suyo, el admin ve
   todo; C) todo el equipo ve todo.
2. **¿Dónde vive en la app?** A) Dentro de Administración *(recomendada para empezar)*; B) una solapa propia «Gastos»
   (entonces hay que sumar un paso al recorrido de bienvenida).
3. **Qué hacer con los documentos del módulo**: el proceso trae el ID del Sheet, el enlace de la carpeta de Drive, la cuenta
   de Gmail y las terminaciones de las dos tarjetas, y el `CLAUDE.md` dice que eso va **«nunca al repo»**. Recomendada: en el
   repo, las dos notas con **marcadores** (`<ID_DEL_SHEET>`, `<TARJETA_1>`…) y los valores reales en la skill o en la
   configuración local/secrets.
4. *(No bloquean la Fase 1.)* Código del peso mexicano; mapeo de Congreso/Virtual/Otro al Sheet; regla de mes por defecto;
   método de extracción; opción (a) o (b) de Google; convención del nombre de archivo; si se carga desde el celular.

## Estado propuesto para `02_diseno_modulo_gastos.md`

- 2026-10-17: revisado el proyecto (esta nota). Falta el OK a la propuesta de la Fase 1 y las decisiones 1 a 3.
