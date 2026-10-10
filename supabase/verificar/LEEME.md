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
