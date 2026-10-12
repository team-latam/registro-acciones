# Verificar la base de verdad (solo lectura)

Comprobaciones que se corren **contra la base real** de Supabase, a mano, y no
escriben nada. Las pruebas de `supabase/pruebas/` corren contra una base de
laboratorio; esto cubre lo que el laboratorio no puede: que lo aplicado en
Supabase de verdad se comporte como se probó.

## `papelera.sql` — qué ve cada rol de la papelera

La regla (`adjuntos_leer`, `02-politicas.sql`; auditoría R20): quien tiene la
sesión de una persona lee solo las carpetas `posts/` y `replies/` del bucket
`adjuntos`. La carpeta `papelera/` (lo que la limpieza semanal aparta antes de
borrar) la ve solo la llave de servicio.

Qué hace, todo en una transacción de lectura que termina en `rollback`:

1. Cuenta, como dueño de la base, los archivos de `papelera/` y de
   `posts/` + `replies/`.
2. Lee la regla `adjuntos_leer` tal como quedó puesta y comprueba que limita
   la lectura a `posts/` y `replies/`.
3. Para un **admin**, un **integrante** y un **observador** (una cuenta real
   de cada rol, la que guardó Supabase cuando entró con Google), arma la
   credencial que manda Supabase, se pasa a `authenticated` y cuenta qué ve.

Sale en rojo si algún rol ve aunque sea un archivo de la papelera, si la regla
no limita las carpetas, o si el control falla (si hay archivos en `posts/` y
`replies/` y un rol no ve ninguno, la prueba no entró bien como esa cuenta y un
«0 en la papelera» no valdría). No imprime correos ni identificadores, solo
cantidades.

**Cómo correrlo:** GitHub → Actions → «Verificar la papelera» → Run workflow
(`.github/workflows/verificar-papelera.yml`). Usa el mismo secreto que «Base de
datos» (`SUPABASE_DB_URL`); el resultado queda en el resumen de la corrida.

**Probarlo en el laboratorio:** después de `bash supabase/pruebas/levantar.sh`,
dar de alta tres miembros (admin, integrante, observador) con
`lab.como(correo)`, un bucket `adjuntos` y archivos en `posts/` y `papelera/`, y
correr `psql … -f supabase/verificar/papelera.sql`. Con la regla de antes (sin
el límite de carpetas) sale en rojo.

## `permisos.sql` — los permisos de toda la base

Las comprobaciones de la auditoría (R27) que el laboratorio hace contra una base de
mentira, pero contra la de verdad, donde Supabase pone sus propios permisos de
entrada y alguien pudo tocar algo desde el panel. Crea unas tablas temporales,
pone la transacción en solo lectura y termina en `rollback`. Comprueba:

1. Todas las tablas de `public` tienen las políticas por fila (RLS) prendidas.
2. Quien no inició sesión (`anon`) no tiene permiso sobre ninguna tabla.
3. Las tablas internas (`avisos_enviados`, `avisos_listos`, `resumenes_enviados`)
   no las toca ninguna sesión de persona.
4. En vivo (Realtime) van solo las doce tablas de siempre.
5. Las funciones que se pueden llamar desde el navegador son exactamente las de la
   lista `supabase/pruebas/funciones-esperadas.sql` (la misma que usa la prueba 75 del
   laboratorio: una sola lista), ni una más ni con más permiso.
6. Toda función con permisos de dueño (`security definer`) lleva el camino de
   búsqueda fijo y vacío.
7. El bucket `adjuntos` es privado, con tope de tamaño y de tipos de archivo.
8. Lo que ve de las tablas delicadas una cuenta real de cada rol: un integrante y
   un observador no ven el registro de actividad ni las sugerencias de Calendar ni
   los pedidos de acceso de otras personas (el suyo sí lo ven), y un observador no
   ve lo sacado del Registro. (Una cuenta
   «de integrante» o «de observador» nunca es el admin fijo, que lo es siempre.)
   Si una tabla está vacía lo dice: que un rol no vea nada de una tabla sin filas
   no prueba que la regla ande.

Sale en rojo si algo no coincide. **Cómo correrlo:** GitHub → Actions → «Verificar
los permisos» → Run workflow (`.github/workflows/verificar-permisos.yml`).
**Si falla por una función nueva:** mirar qué devuelve y qué escribe; si es a propósito,
sumarla a `funciones-esperadas.sql` con una línea que diga por qué es segura (eso
también la autoriza en el laboratorio); si no, sacarle el permiso de ejecución.

**Probarlo en el laboratorio:** después de `levantar.sh`, dar de alta miembros (admin,
integrante, observador y el admin fijo con rol de integrante) con `lab.como(correo)`,
el bucket `adjuntos` y una fila en el registro de actividad. Se comprobó que sale en
rojo con: anon con permiso de una tabla, una tabla sin RLS, una función con permisos de
dueño sin camino de búsqueda, una tabla interna publicada en vivo, el bucket público,
una función nueva ejecutable desde el navegador y el registro de actividad abierto a todos.

## `calendar.sql` — cómo va lo que llegó de Google Calendar

Cuenta, contra la base de verdad, cuánto de lo importado de Calendar sigue como
vino (pendiente) y cuánto ya está ordenado, con la definición de la pantalla
la pantalla Administración › Revisar lo de Calendar, retirada el 12/10/2026 (autor «Google Calendar», sin correo,
con id de evento; «ordenado» = alguien le puso tipo, lugar, personas o un
«dónde fue»). Da: el total y los sacados del Registro; lo pendiente por
pestaña (Actividades, Reuniones, Personales, Recordatorios, Sin sugerencia) y
por confianza de la sugerencia (seguro, más o menos, dudoso); lo ya ordenado
por tipo; y si lo ordenado coincide con lo que se había sugerido.

No escribe nada (transacción de solo lectura que termina en `rollback`) y no
imprime títulos, fechas ni nombres de personas, solo cantidades: los registros
de Actions son públicos.

**Cómo correrlo:** GitHub → Actions → «Mirar lo de Calendar» → Run workflow
(`.github/workflows/verificar-calendar.yml`, solo desde `main`). Usa el mismo
secreto que «Base de datos» (`SUPABASE_DB_URL`); el resultado queda en el
resumen de la corrida.
