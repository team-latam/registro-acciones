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
  persona puede escribir en el Registro (`puede_escribir()`: integrante o
  admin, no un observador; la misma regla de todas las tablas) y recién
  ahí lee con la cuenta de servicio. De cada evento devuelve solo los
  campos que usa la app (sin invitados, sin creador, sin link de Meet:
  `CAMPOS_DEL_EVENTO` en `_compartido/google.mjs`).
- **El trabajo de la madrugada** (`supabase/sync-calendar/`) lee con la
  misma cuenta, directo.
- **Escribir** en el calendario (crear o mover un evento desde la app)
  sigue igual: con el permiso de Google de cada persona.
- Los **feriados** siguen con la clave de API: son calendarios públicos
  de Google, no del equipo.

**Hecho el 6/10/2026**: la función publicada, la cuenta con el calendario
compartido solo para ver, y el calendario **cerrado** (comprobado desde
afuera: la clave de API recibe «Not Found»). La app y el nocturno ya no
tienen el camino viejo; los pasos de abajo quedan para rehacerlo si hiciera
falta (una llave nueva, otro proyecto).

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
   - Vencimiento: **Custom**, a menos de un año (Supabase no deja más).
     El del 6/10/2026 **vence el 30/9/2027**, anotado en `CLAUDE.md`.
   - Resource access: **Project** → el de la app. Permissions: todo en
     None salvo **Application services → Edge Functions** y **Edge
     Function Secrets**, en Read-write.
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

Después ya no hace falta el secreto `CALENDAR_API_KEY` de GitHub (la
clave de la página sigue, solo para los feriados).

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

---

# La función `avisar`: el correo al administrador (6/10/2026)

La pantalla de espera de alguien nuevo decía «Le avisamos al
administrador ✓» y no era cierto: ningún aviso salía (`docs/AUDITORIA.md`,
I10). Ahora la app de quien pide entrar llama a `avisar`
(`avisar/index.ts`, la lógica en `_compartido/avisos.mjs`, sus pruebas en
`_pruebas/avisos.mjs`), con su sesión. La función le pregunta a la base si
corresponde y a quién (`pedir_aviso_al_admin()`,
`supabase/16-aviso-al-admin.sql`): **uno por pedido, un intento por hora**,
al admin fijo y a los que tienen rol de admin. Así nadie puede usarla para
llenar la casilla de nadie. El correo sale con **Resend** (3.000 por mes
gratis); si salió, la base lo anota y recién ahí la pantalla muestra el ✓.
Si no salió, dice «Tu pedido quedó anotado: el administrador lo ve cuando
entra a la app», que es lo que pasa.

La publica el mismo workflow «Funciones de Supabase».

## Lo que tiene que hacer el usuario, una vez

1. Crear la cuenta en https://resend.com/signup **con la dirección donde
   quiere recibir los avisos** (la del admin). Sin un dominio propio
   verificado, Resend solo le entrega a la dirección de la cuenta, desde
   `onboarding@resend.dev`.
2. En Resend → **API Keys** → **Create API Key**: nombre `registro-avisos`,
   permiso **Sending access**. Copiarla (empieza con `re_`; se ve una sola
   vez). **No va al chat.**
3. GitHub → Settings → Secrets and variables → Actions → **New repository
   secret**: Name `RESEND_API_KEY`, Secret la llave.
4. Actions → **Funciones de Supabase** → **Run workflow**. En el resumen
   tiene que decir «✓ Llave de Resend cargada» y «✓ «avisar» contesta».
5. Probar: entrar a la app desde una ventana de incógnito con una cuenta
   de Google que no sea del equipo. La pantalla de espera tiene que decir
   «Le avisamos al administrador ✓» y el correo tiene que llegar (mirar
   también en Spam la primera vez). Después rechazar ese pedido en
   Administración → Solicitudes.

**Desde el 7/10/2026** el dominio `team-latam.com` está cargado en Resend
(los cuatro registros en Squarespace: `resend._domainkey`, `send`,
`rsend`, `_dmarc`) y los avisos salen de **`info@team-latam.com`**, con
las respuestas a `benny@team-latam.com` (pedido del usuario). Si Resend
no acepta el remitente (dominio sin verificar), el aviso sale igual desde
`onboarding@resend.dev`.

Antes de eso: para mandarle también a otros admins, hacía falta verificar un dominio en
Resend (Domains → Add domain, con registros en el DNS) y cargar el
remitente en el secreto de Supabase `AVISOS_DESDE`
(por ejemplo `Registro de Acciones <avisos@ese-dominio>`).

---

# Avisos por correo para el equipo (7/10/2026)

El dominio `team-latam.com` quedó **verificado en Resend** el 7/10/2026
(13:57): los avisos salen de `info@team-latam.com`.

Además del pedido de acceso, ahora hay (`supabase/17-avisos-por-correo.sql`):

- **Al momento**, por la función `avisar`: cuando alguien te menciona con
  @ o comenta en un posteo tuyo. La app de quien publica lo pide
  (`avisarPorCorreo` en `index.html`); la base decide a quién
  (`preparar_aviso`): solo su autor lo puede pedir, en los primeros 15
  minutos, y cada destinatario una sola vez (`avisos_enviados`).
- **Resúmenes diarios o semanales**, por el workflow «Resúmenes por correo»
  (`supabase/avisos/resumen.mjs`), que corre cada hora y le escribe a cada
  uno a su hora (hora de Argentina). Si no pasó nada, no llega nada.
- **Correo de prueba**, desde Mis preferencias.

**Quién puede recibir correos** lo decide un admin en **Administración →
Correos**: «Solo yo» (el admin fijo; es lo elegido de fábrica, a pedido
del usuario), «Todo el equipo» o «Elegir personas». Cada persona
habilitada elige después en **Mis preferencias → Notificaciones** si los
quiere, cuándo y de qué. Los diseños de los correos están en
`_compartido/correos.mjs` (aprobados por el usuario con capturas).

## Lo que cambió con la auditoría del 7/10/2026

- **Quien llama no ve a quién le llega.** `pedir_aviso_al_admin()`,
  `preparar_aviso()` y `preparar_prueba()` siguen decidiendo todo con la
  sesión de quien llama, pero ya no le devuelven la lista de
  destinatarios: guardan lo que hay que mandar en `avisos_listos` y
  contestan solo un número de turno. La función lo lee con la llave de
  servicio (`tomar_aviso()`, una vez y dentro de los 10 minutos). Hasta
  ese día, cualquiera que pidiera entrar podía ver, llamando a la base
  directo, los correos de los admins.
- **La llave de servicio** la carga el workflow como `LLAVE_DE_SERVICIO`
  (la misma `SUPABASE_SERVICE_ROLE_KEY` de las copias y los resúmenes);
  si no está, la función usa la que Supabase le da sola. Sin ninguna,
  contesta «sin-configurar».
- **Topes**: como mucho 30 avisos al momento por hora por autor (lo que
  pasa del tope llega en el resumen) y el correo de prueba, uno por hora
  y tres por día.
- **Si a alguien no le sale** (Resend falla), se borra su marca de
  «enviado» y le llega en el resumen del día. Ante un 429 de Resend
  (demasiados pedidos) espera y reintenta una vez, y entre un correo y
  otro hace una pausa.
- El nombre de quien escribió sale de su cuenta, no de la firma del
  posteo; el asunto va sin saltos de línea.
- `calendario` atiende solo a quien puede escribir (`puede_escribir()`:
  no a un observador) y devuelve de cada evento solo lo que usa la app.
