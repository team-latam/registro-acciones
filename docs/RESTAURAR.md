# Cómo volver atrás con una copia de seguridad

Cada domingo se guarda una copia de todo en el repo privado
`team-latam/registro-respaldos` (ver `supabase/respaldo/LEEME.md`). Este
documento explica cómo usarla para recuperar cosas. Todo se hace desde
GitHub, con un botón: no hay que instalar nada.

Lo hace el trabajo **«Restaurar una copia»** (pestaña **Actions**). Por
omisión **no escribe nada**: solo cuenta lo que haría. Así se puede probar
sin miedo.

## Caso 1: se borró algo y lo quiero de vuelta

Por ejemplo, un posteo borrado sin querer.

1. Averiguar el código del posteo. Lo más fácil es pedírselo a Claude:
   «se borró el posteo tal, de tal fecha». Claude lo busca en la copia y
   te dice el código (algo como `posts:Ab12Cd34…`).
2. En GitHub, entrar a **Actions → Restaurar una copia → Run workflow**.
3. Completar:
   - **Adónde restaurar**: `produccion`.
   - **Qué traer**: `todo` (así vuelven también sus fotos).
   - **Solo estas filas**: el código del paso 1.
   - Dejar **Escribir de verdad** sin tildar.
4. Apretar **Run workflow** y esperar a que termine (un minuto). Al abrir
   la corrida, abajo dice cuántas filas y archivos traería.
5. Si dice lo que esperabas, repetir los pasos 2 a 4, ahora con **Escribir
   de verdad** tildado y `RESTAURAR` en **confirmar**.

Las fotos y los comentarios del posteo también se pueden traer: los
comentarios van como `replies:<código>` separados con `;`.

Nada de lo que hay hoy se borra. Si el posteo todavía existe, queda como
estaba en la copia (se pierden los cambios que se le hicieron después).

## Caso 2: ensayar que la copia sirve (una vez por año)

Para estar seguros de que, si un día se pierde todo, se puede volver. Se
hace en un proyecto de Supabase **aparte**, gratis, que después se puede
borrar. La app de verdad no se toca.

**Una sola vez, para preparar el ensayo:**

1. En https://supabase.com, crear un proyecto nuevo (por ejemplo
   «registro-ensayo»). Anotar su contraseña de la base en un lugar seguro.
2. En el proyecto nuevo, **Project Settings → API**: copiar la **Project
   URL** y la llave **service_role**.
3. En **Project Settings → Database → Connection string → URI**: copiar la
   dirección de la base (con la contraseña del paso 1).
4. En GitHub, en este repo: **Settings → Secrets and variables → Actions →
   New repository secret**, y cargar tres secretos:
   - `PRUEBA_SUPABASE_URL`: la Project URL del paso 2.
   - `PRUEBA_SUPABASE_SERVICE_ROLE_KEY`: la llave del paso 2.
   - `PRUEBA_SUPABASE_DB_URL`: la dirección del paso 3.

Esas tres cosas no se pegan nunca en el chat: van solo en GitHub.

**El ensayo:**

1. **Actions → Restaurar una copia → Run workflow**, con **Adónde**
   `prueba`, **Qué traer** `todo` y **Escribir de verdad** tildado.
2. Al terminar, la corrida dice cuántas filas y archivos cargó. Tienen que
   coincidir con los de la última copia (están en la corrida de «Copia de
   seguridad» del domingo).
3. Avisarle a Claude: puede comparar los números y revisar que esté todo.

Cuando termine, el proyecto de prueba se puede borrar desde Supabase
(**Project Settings → General → Delete project**). Es ese proyecto nomás:
nunca el de la app, ni el proyecto de Google Cloud.

## Caso 3: se perdió todo

Si el proyecto de la app se borró o quedó inservible:

1. Crear un proyecto nuevo en Supabase, igual que en el caso 2.
2. Cargar sus datos como en el caso 2, pero en los secretos de siempre:
   `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL`. La dirección nueva
   también tiene que ir en `index.html`: eso lo cambia Claude.
3. **Actions → Base de datos → Run workflow**: arma las tablas.
4. **Actions → Restaurar una copia**, con **Adónde** `produccion`, **Qué
   traer** `todo`, **Escribir de verdad** tildado y `RESTAURAR` en
   **confirmar**.
5. Volver a configurar el login de Google en el proyecto nuevo (Supabase →
   Authentication → Providers → Google), con los mismos datos del proyecto
   de Google Cloud `40280679854`. Claude da los pasos.

## Una copia de otra semana

Si lo que se borró ya no está en la última copia (pasó hace más de una
semana y la copia de después ya no lo tiene), en **De qué copia** va el
código de la semana: en el repo `registro-respaldos`, pestaña
**Commits**, cada copia es una línea «Copia del <fecha>» con su código a la
derecha (siete letras y números).

## Para Claude: lo que hace por dentro

`supabase/respaldo/restaurar.mjs` (probado en
`supabase/respaldo/pruebas/restaurar.mjs` y `supabase/pruebas/80-restaurar.sql`):

- Lee `datos/<tabla>.json` (la copia del domingo) o `datos.json` (la que
  baja Administración › Copia de seguridad, descomprimida).
- Carga las tablas con la llave de servicio, por la API, de a 500 filas,
  en un orden donde los comentarios van después de sus posteos. Fila que
  ya existe, se pisa; nunca borra.
- Sube `archivos/` al bucket sin pisar lo que ya está. Lo de `papelera/`,
  no. Con `SOLO`, solo las fotos y adjuntos de esas filas.
- No toma la dirección de `index.html` y se niega a escribir en la de la
  app sin `ES_PRODUCCION=si`.

El volcado `base/registro.sql.gz` sigue siendo la otra forma de volver la
base entera (`gunzip -c registro.sql.gz | psql "<dirección>"` en una base
vacía), pero no trae los archivos.
