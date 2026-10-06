# El calendario del equipo, sin que sea público

Hasta el 6/10/2026 el calendario «LatAm» estaba **compartido de forma
pública, con todos los detalles**: la app y el trabajo de la madrugada lo
leían «como visitantes», con una clave de API, sin entrar con ninguna
cuenta. Eso significaba que cualquiera que tuviera el identificador del
calendario (está en el código de la página) veía todos los eventos desde
2019: títulos con nombres, lugares, fechas de viajes
(`docs/AUDITORIA.md`, U5).

Ahora lo lee una **cuenta de servicio**: una cuenta de Google que es de la
app, no de una persona, con el calendario compartido a su correo **solo
para ver**. Con eso el calendario puede dejar de ser público.

- **La app** le pide los cambios a la función `calendario` de Supabase
  (`calendario/index.ts`, la lógica en `_compartido/google.mjs`), con la
  sesión de quien la está usando. La función le pregunta a la base si esa
  persona es un integrante aprobado (`esta_aprobado()`, la misma regla de
  todas las tablas) y recién ahí lee con la cuenta de servicio.
- **El trabajo de la madrugada** (`supabase/sync-calendar/`) lee con la
  misma cuenta, directo.
- **Escribir** en el calendario (crear o mover un evento desde la app)
  sigue igual: con el permiso de Google de cada persona.
- Los **feriados** siguen con la clave de API: son calendarios públicos
  de Google, no del equipo.

Mientras la función no esté publicada, la app sigue leyendo como antes,
con la clave de API: nada se corta durante el armado.

La publica sola el workflow **«Funciones de Supabase»**
(`.github/workflows/funciones.yml`) en cada push a `main` que la toca.

---

## Lo que tiene que hacer el usuario, una vez

> ⚠️ La llave de la cuenta de servicio y el token de Supabase son como
> contraseñas. **No se pegan en el chat** (tampoco con Claude), ni en un
> mail, ni en una captura: van directo del panel donde nacen al de GitHub.

### 1. Crear la cuenta de servicio (Google Cloud)

1. Entrar a https://console.cloud.google.com/iam-admin/serviceaccounts
2. Arriba a la izquierda, elegir el proyecto de siempre (**40280679854**).
3. **+ Crear cuenta de servicio**.
   - Nombre: `registro-calendario`
   - **Crear y continuar**. Los dos pasos siguientes (roles y acceso) se
     dejan **vacíos**: **Continuar** y **Listo**. No necesita ningún rol:
     su único permiso va a ser ver el calendario.
4. En la lista aparece su correo, algo como
   `registro-calendario@….iam.gserviceaccount.com`. **Copiarlo** (no es
   secreto).
5. Tocar la cuenta → solapa **Claves** → **Agregar clave** → **Crear clave
   nueva** → **JSON** → **Crear**. Se baja un archivo `.json`: esa es la
   llave.

Si al crear la clave aparece un cartel de que «la creación de claves
está inhabilitada por una política», no seguir: contarle a Claude.

### 2. Compartirle el calendario (Google Calendar)

1. https://calendar.google.com → calendario **LatAm** → ⋮ →
   **Configuración y uso compartido**.
2. **Compartir con determinadas personas o grupos** → **Agregar personas y
   grupos**.
3. Pegar el correo de la cuenta de servicio, permiso **«Ver todos los
   detalles de los eventos»** → **Enviar**.

**Todavía no destildar «Compartir de forma pública»**: eso va al final.

### 3. Guardar la llave en GitHub

1. Abrir el archivo `.json` que se bajó con el Bloc de notas (clic derecho
   → Abrir con → Bloc de notas). `Ctrl+A`, `Ctrl+C`.
2. https://github.com/team-latam/registro-acciones/settings/secrets/actions
   → **New repository secret**
   - **Name:** `GOOGLE_CUENTA_DE_SERVICIO`
   - **Secret:** pegar todo
3. Borrar el `.json` de Descargas (y de la papelera). Si algún día hace
   falta otra, se crea una clave nueva en el mismo lugar.

### 4. Un token de Supabase para publicar la función

1. https://supabase.com/dashboard/account/tokens → **Generate new token**.
   - Nombre: `github-funciones`
   - Vencimiento: el más largo que ofrezca. **Anotar la fecha** si tiene
     (como la de `RESPALDOS_TOKEN`, hay que renovarlo antes).
2. Copiar el token (empieza con `sbp_`). Se ve una sola vez.
3. En GitHub, igual que antes, **New repository secret**:
   - **Name:** `SUPABASE_ACCESS_TOKEN`
   - **Secret:** el token

### 5. Publicar y probar

1. https://github.com/team-latam/registro-acciones/actions → **Funciones de
   Supabase** → **Run workflow**. Tiene que terminar en verde, con
   «✓ La función contesta y pide sesión» en el resumen.
2. Ahí mismo, **Calendar** → **Run workflow**: también en verde. Esa
   corrida ya lee con la cuenta de servicio.
3. En la app: **Calendario** → **Traer de Google Calendar**. Tiene que
   decir que sincronizó.
4. En Supabase → **Edge Functions** → `calendario` → **Invocations**: tiene
   que haber pedidos recientes (los de la app).

### 6. Recién ahora: cerrar el calendario

1. Google Calendar → LatAm → Configuración → **Permisos de acceso para
   eventos** → **destildar «Compartir de forma pública»**.
2. Repetir las pruebas del paso 5 (2 y 3). Si las dos andan, listo: el
   calendario ya no se ve desde afuera.

Después Claude saca de la app el camino viejo (la clave de API para leer
el calendario del equipo), y el secreto `CALENDAR_API_KEY` de GitHub se
puede borrar.

---

## Si algo falla

- **«Funciones de Supabase» en verde pero dice «faltan secretos»**: falta
  alguno de los dos del paso 3 o 4, o el nombre está mal escrito.
- **«✗ La llave de la cuenta de servicio no es un JSON válido»**: se pegó
  un pedazo o el archivo equivocado. Volver a copiar el `.json` entero.
- **La app avisa «sin permiso» o «Not Found» después de cerrar el
  calendario**: la cuenta de servicio no tiene el calendario compartido
  (paso 2). Mientras se arregla, volver a tildar «Compartir de forma
  pública» y todo vuelve a andar como antes.
