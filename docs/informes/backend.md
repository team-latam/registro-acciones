# Auditoría de Supabase y operaciones — 6 de octubre de 2026

**Alcance.** Esquema y políticas (`supabase/01…15`), las pruebas SQL
(`supabase/pruebas/`), el sincronizador de Calendar, la limpieza del
bucket, la copia de seguridad, los seis workflows de GitHub, el uso que
hace `index.html` de Supabase y de Google Calendar, y las cuotas del plan
gratis. No se repite lo que `docs/REVISION.md` (3/10/2026) da por resuelto,
pero cada punto marcado «resuelto» ahí se confirmó en el código de hoy
(sección «Lo de la revisión anterior» al final).

**Cómo se verificó.** Cada hallazgo se leyó en el archivo y la línea que
se cita. Lo que no se ve desde el repo (configuración del panel de
Supabase, de Google Cloud, de GitHub Pages) está marcado **a confirmar en
el panel**. No se corrió nada contra la base real.

---

## Resumen

| # | Hallazgo | Gravedad | Evidencia |
|---|---|---|---|
| 1 | El calendario de Google es público para todo internet y su id está en el repo público | **Alta** | `supabase/sync-calendar/LEEME.md` «configurado como público», `index.html:5743` |
| 2 | Cada pestaña abierta escribe `app_config` cada 30 s y eso se difunde en vivo a todas las demás: la cuota de mensajes de Realtime (2 M/mes) es la primera que se agota | **Alta** | `index.html:6890`, `:8044`, `:8040`; `06-tiempo-real.sql:25` |
| 3 | `base-de-datos.yml` sin `concurrency:`: dos push seguidos aplican el SQL en paralelo y puede quedar el esquema viejo | **Alta** | `.github/workflows/base-de-datos.yml` (no hay `concurrency`), `aplicar.sh:49` |
| 4 | GitHub Pages publica antes y sin esperar a las pruebas; un `index.html` roto queda en línea | **Alta** | no existe workflow de Pages; `app.yml` no gatea nada |
| 5 | El sincronizador nocturno guarda el token aunque un evento haya fallado por un error pasajero: ese cambio se pierde hasta que el evento vuelva a cambiar | Media | `sincronizar.mjs:317-319` vs `index.html:6812-6817` |
| 6 | Errores de Supabase van al registro público de Actions con hasta 400 caracteres de respuesta (que puede traer la fila entera) | Media | `sincronizar.mjs:88`, `:313`; `calendario.yml:99` |
| 7 | Los adjuntos de un posteo «sacado del Registro» quedan huérfanos para la limpieza y se borran a los 32 días; «Devolver» lo devuelve sin archivos | Media | `04-funciones.sql:220-224` (solo `posts` y `replies`), `12-revisar-calendar.sql:176-179` |
| 8 | Horas sin zona horaria: un evento con hora cargado desde otro huso se «corrige» solo y deja comentario | Media | `index.html:6121-6127`, `decidir.mjs:47-52` |
| 9 | Excepciones de series con hora: la fecha original se saca del id en UTC; un evento de 21:00–23:59 (Argentina) cae al día siguiente | Media | `decidir.mjs:59-64` |
| 10 | `unificar_cuentas`: un admin por rol puede pasarse a sí mismo todo lo del admin fijo (o de cualquiera), y no queda anotado en la auditoría | Media | `15-unificar-cuentas.sql:45-59`, `index.html:8133-8138` |
| 11 | `workflow_dispatch` de `base-de-datos.yml` desde cualquier rama aplica ESE SQL a producción | Media | `base-de-datos.yml:29`, `:97` |
| 12 | Si `auth.identities` cambia de forma, el control del correo cae a `user_metadata` (que el usuario reescribe) o deja a todos afuera, sin aviso | Media (a confirmar) | `02-politicas.sql:56-68` |
| 13 | El registro `registrar_posteo` se puede esquivar (no falsificar): una edición directa sin tocar `last_edited_at`, o con `last_edited_by = 'Google Calendar'`, no se anota | Media | `04-funciones.sql:343-346` |
| 14 | Copia de seguridad: no hay procedimiento de restauración ensayado ni herramienta para resubir `archivos/`; el volcado no incluye `auth` ni la configuración del proyecto | Media | `respaldo.yml:123` (`--schema=public`), `respaldo/LEEME.md` «Restaurar» |
| 15 | La app manda la IP de cada persona a `api.ipify.org` en cada login y acción de admin, y la guarda sin fecha de vencimiento | Media | `index.html:6934`, `6941-6955`; `audit_log` sin política de borrado |
| 16 | «Copia completa» desde la app baja el bucket entero (hasta 1 GB) cada vez: un clic es hasta un quinto de los 5 GB/mes | Media | `index.html:12593-12625` |
| 17 | Cualquier integrante puede cambiar `editors`, `participants`, `mentions`, `calendar_event_id`, `sin_calendar`, `last_edited_by_email` de un evento ajeno | Baja | `02-politicas.sql:214`, `:467-525` |
| 18 | Subir al bucket no exige carpeta: se puede subir a `posts/<otro id>/…` o a `papelera/…` | Baja | `02-politicas.sql:444-445` |
| 19 | Pruebas SQL: sin ninguna sobre `storage.objects` como usuario, ni sobre 10, 13, 17, 18 | Baja | `supabase/pruebas/` |
| 20 | Workflows sin `permissions:` mínimos; acciones fijadas por tag (`@v4`), no por SHA | Baja | los seis `.github/workflows/*.yml` |
| 21 | `esta-arriba.yml` es manual, no mira Supabase y no avisa a nadie; no evita la pausa por inactividad | Baja | `esta-arriba.yml:11-12` |
| 22 | Un rechazado puede volver a ponerse «pendiente» sin límite (por diseño, pero sin tope) | Baja | `02-politicas.sql:357-363`, `index.html:7233` |
| 23 | `13-sugerencias-calendar.sql` publica 925 ids de eventos y nombres de pila en un repo público | Baja | `13-sugerencias-calendar.sql:16-…` |
| 24 | `calendar_sacados.fila` no tiene tope de peso ni validación (lo escribe solo la base) | Info | `12-revisar-calendar.sql:55` |
| 25 | `12` le da a `authenticated` solo `select/delete` sobre las tablas nuevas, pero en la segunda aplicación el `grant … on all tables` del `02` les suma `insert/update` (RLS los frena igual) | Info | `02-politicas.sql:176`, `12:69-70` |
| 26 | Índices: ninguno falta para lo que la app consulta; `posts_scopes_idx`, `posts_author_email_idx`, `replies_author_idx` no los usa nadie | Info | `01-tablas.sql:93-100`, `:128-130` |
| 27 | Token `RESPALDOS_TOKEN` vence el 5/10/2027: el aviso existe (rojo faltando 15 días); una *deploy key* no vencería | Info | `respaldo.yml:163-181` |
| 28 | Pantalla de consentimiento de Google: estado no documentado (¿Testing o producción sin verificar?) | Info (a confirmar) | `README.md:1327-1332` |

---

## 1. Esquema y políticas

### Lo que está bien (confirmado hoy)

- RLS prendido en las **diez** tablas, incluidas `calendar_sugerencias` y
  `calendar_sacados` (`12:73-74`); `anon` sin permisos sobre ninguna
  (`02:177`, `12:71`).
- Las 31 políticas del `02` y las 3 del `12` llaman a las funciones con
  `(select …)`.
- Todas las funciones `security definer` fijan `search_path = ''`
  (`correo_de_su_google`, `esta_aprobado`, `mi_rol`, los cuatro
  disparadores de control, `hora_del_servidor`, `posts_marca_de_hora`,
  `limpieza_del_bucket`, `registrar_posteo`, `sacar_del_registro`,
  `devolver_al_registro`, `limpiar_tipo_en_titulos`, `unificar_cuentas`) y
  cada una chequea quién llama donde corresponde. Las `security invoker`
  (`me_gusta_*`, `guardar_preferencias`, `guardar_config`,
  `clasificar_importados`) pasan por las políticas.
- `limpieza_del_bucket` y `limpiar_tipo_en_titulos`: `revoke … from
  public, anon, authenticated` (`04:246`, `14:61`).
- Topes de fila (posteo 256 KB, comentario 128 KB, preferencias 32 KB,
  configuración 256 KB; `03:373-384`) y forma de `calendarSync`,
  `activityTypes`, `extraCities`, `territoryConfig` (`03:408-511`).
- `audit_log`: sin políticas de `update` ni `delete` (nadie la corrige, ni
  el admin fijo); un login o pedido de acceso por persona y por día
  (`03:529-551`).

### Respuestas a las preguntas puntuales

| Pregunta | Respuesta | Dónde |
|---|---|---|
| ¿Un integrante común lee `audit_log`? | **No**: solo admin fijo o por rol (`audit_leer`). Probado (`90-permisos.sql:49`). | `02:411-412` |
| ¿Lee `access_requests` de otros? | **No**: admin, o solo la propia fila. Probado (`90:189`). | `02:349-350` |
| ¿Modifica `liked_by`, `editors`, `participants` de posteos ajenos? | `liked_by` **no** (solo el propio, una vez; probado). `editors` y `participants` **sí**, en cualquier evento que no sea Rutina: ver hallazgo 17. | `02:481-499`, `:504` |
| ¿Sube a la carpeta de otro posteo? | **Sí**: `adjuntos_subir` no mira la ruta. Hallazgo 18. | `02:444-445` |
| ¿Políticas de Storage para `delete`/`update`? | `delete`: solo admin fijo. `update`: **no hay** → nadie desde el navegador puede pisar ni mover (correcto: la app sube siempre con nombre nuevo; la limpieza mueve con la llave de servicio, que no pasa por RLS). | `02:440-453` |
| ¿Borra comentarios ajenos? | **No**: `replies_borrar` es solo admin fijo; tampoco los propios (probado `90:137-141`, `:151`). | `02:252-253` |
| ¿`unificar_cuentas` solo admin? | Admin fijo **o admin por rol**. No protege al admin fijo ni exige que `p_viejo` exista. Hallazgo 10. | `15:45-47` |
| ¿`registrar_posteo` se falsifica? | **No se inventa** (la política rechaza `post_*` a cualquiera, `02:423`; probado `97:273-282`). **Se esquiva**: hallazgo 13. | `04:343-346` |
| ¿Y si `auth.identities` cambia de forma? | Hallazgo 12. | `02:66-67` |

### Hallazgo 10 — `unificar_cuentas` no protege al admin fijo ni queda en la auditoría (Media)

```sql
-- 15-unificar-cuentas.sql:45-59
if not (public.es_admin_fijo() or public.es_admin_rol()) then raise …
select * into m_nuevo from public.members where lower(email) = nuevo;   -- tiene que existir
select * into m_viejo from public.members where lower(email) = viejo;   -- puede NO existir
…
perform set_config('request.jwt.claims', '{}', true);   -- apaga los controles hasta el final
update public.posts set author_email = m_nuevo.email, author_name = nombre_nuevo
 where lower(coalesce(author_email, '')) = viejo;
```

Un admin por rol puede llamar `unificar_cuentas('benny@team-latam.com',
'su-propio-correo')` y quedarse con la autoría de todo lo del admin fijo
(y lo mismo con cualquier integrante). En el resto del esquema, al admin
fijo «nadie lo toca» (`members_editar`, `members_borrar`). La app tampoco
anota la unificación en `audit_log` (`index.html:8133-8138` no llama a
`logAudit`), y la función corre «sin sesión de persona», así que
`registrar_posteo` no anota nada. Es irreversible.

Además: `m_viejo.nickname` entra sin escapar en un `regexp_replace`
(`15:135-137`). Un @nickname que se cambió a mano es `[a-z0-9_]`, pero el
autogenerado en el alta y el que carga un admin por `members.add` solo
tienen tope de largo (`03:225`): un nickname con `.` o `(` cambia lo que
reemplaza o hace fallar la función.

**Arreglo.** (a) `if viejo = public.admin_fijo() or nuevo = public.admin_fijo() and not public.es_admin_fijo() then raise`;
(b) exigir que `viejo` esté en `members` o `former_members` salvo que lo
pida el admin fijo; (c) insertar una fila `audit_log` tipo
`accounts_merged` (sumar el tipo a `audit_tipo`) con `actor = yo`,
`target = viejo`, `detail = nuevo` antes del `set_config`; (d) escapar el
nickname (`regexp_replace(m_viejo.nickname, '([.*+?^${}()|\[\]\\])', '\\\1', 'g')`)
o usar `position()`.

**Prueba que falta** (`85-unificar-cuentas.sql`): «un admin por rol no se
queda con lo del admin fijo» y «la unificación queda en el registro».

### Hallazgo 12 — Si `auth.identities` cambia, el control del correo se degrada en silencio (Media, a confirmar)

```sql
-- 02-politicas.sql:56-68
return exists (select 1 from auth.identities i
   where i.user_id = auth.uid() and i.provider = 'google'
     and lower(i.identity_data ->> 'email') = lower(auth.jwt() ->> 'email') …);
exception when insufficient_privilege or undefined_table or undefined_column then
  return coalesce(auth.jwt() -> 'user_metadata' ->> 'email_verified', 'false') = 'true';
```

Dos formas de cambiar:

- **Supabase le saca al rol `postgres` la lectura de `auth.identities`**
  → `insufficient_privilege` → se vuelve a `user_metadata.email_verified`,
  que **cualquier usuario reescribe con `updateUser()`** (lo dice el
  propio comentario del archivo). La protección del punto 7 de la
  revisión anterior desaparece y nadie se entera: todo sigue andando.
- **Cambia la clave dentro de `identity_data`** (hoy `email`) → no hay
  excepción: el `exists` da false para todos → **todo el equipo queda
  afuera**, incluido el admin fijo.

No hay forma de saber desde el repo si hoy la función corre por la rama
buena o por la excepción. **A confirmar en el panel**: en SQL Editor,
`select has_table_privilege('postgres', 'auth.identities', 'select');`
tiene que dar `true`.

**Arreglo.** (a) Que la rama de excepción **no** afloje: devolver `false`
y, mejor, dejar una fila en una tabla de avisos o `raise warning`, y que
`esta-arriba.yml` (hallazgo 21) llame a una función `salud()` que compruebe
`has_table_privilege(...)` y la presencia de `identity_data->>'email'` en
al menos una fila, para enterarse el mismo día. (b) Comparar también con
`auth.users.email`... no: ese es el que el usuario cambia. Mantener
`identities`, pero sumar el chequeo de salud.

### Hallazgo 13 — El registro de posteos se esquiva (Media)

```sql
-- 04-funciones.sql:343-346
if new.last_edited_at is not distinct from old.last_edited_at
   or new.last_edited_by is not distinct from 'Google Calendar' then
  return null;      -- no se anota
end if;
```

Desde la consola del navegador, con su propia sesión, un integrante puede
`update posts set content = … where id = …` sin mandar `last_edited_at`,
o mandando `last_edited_by = 'Google Calendar'`: la edición pasa (la
política y el disparador la permiten) y no queda rastro ni en «Editado
por» ni en la auditoría. Es lo contrario de lo que el comentario del
archivo promete («nadie puede no anotar»). El `actor_name` sale de
`last_edited_by` si el correo firmado es el propio (`04:350`), así que el
nombre que figura en el registro también lo elige quien edita.

**Arreglo.** Anotar `post_edited` cuando cambie **cualquier** columna de
contenido (comparar `campos_cambiados` menos `liked_by`, `resumen`,
`calendar_event_id`, `milestones`-tildado, etc.), y tomar
`'Google Calendar'` como marca válida **solo** cuando
`sin_sesion_de_persona()`; con sesión de persona, `last_edited_by =
'Google Calendar'` se anota igual con el correo real. `actor_name`:
siempre de `members.name`, nunca del valor firmado.

**Prueba que falta** (`97-registro-de-posteos.sql`): «editar sin firmar
también se anota» y «firmar como Google Calendar con sesión se anota».

### Hallazgo 17 — Campos «de otros» editables en eventos ajenos (Baja)

`posts_editar` (`02:214-216`) deja pasar a cualquiera que escribe; el
disparador (`02:467-525`) solo protege `id`, `author_*`, `created_at`,
`liked_by`, la Rutina ajena y `cancelled`. En un evento que no es Rutina,
cualquier integrante puede: agregarse o sacar a otros de `editors` y
`participants` (y con eso ganar o quitar el derecho de cancelar, `02:513-
522`), cambiar `calendar_event_id` (desvincular el evento de su Calendar,
o apuntarlo a otro), poner `sin_calendar`, inventar `mentions` (avisos a
quien quiera) y escribir `last_edited_by_email` con el correo de otro
(la campanita avisa «lo editó X»). Es coherente con «editar sigue abierto
a todo el equipo» (REDISENO, tanda 17), pero esos cinco campos no son
«contenido».

**Arreglo.** En `posts_controlar_update`, si `cambios && array['editors',
'participants','calendar_event_id','sin_calendar']` exigir autor, editor
o admin; y pisar `last_edited_by_email := yo` siempre que haya sesión de
persona (igual que se pisa la hora).

### Hallazgo 18 — Subir a cualquier carpeta del bucket (Baja)

```sql
-- 02-politicas.sql:444-445
create policy adjuntos_subir on storage.objects for insert
  with check (bucket_id = 'adjuntos' and (es_admin_fijo() or puede_escribir()));
```

La app sube a `posts/<id>/img<i>_<hora>.<ext>` y `replies/<id>/…`
(`index.html:7566`, `:7581`), pero la política no lo exige. Un integrante
puede subir a `posts/<id de otro>/`, a `papelera/2020-01-01/x` (la
limpieza lo borra a los 30 días) o a la raíz. Impacto: ocupar el GB del
plan (25 MB por archivo, sin tope por persona) y confundir una
restauración de la papelera. No da acceso a nada ajeno (todo el bucket ya
lo lee todo aprobado).

**Arreglo.** `and (storage.foldername(name))[1] in ('posts','replies')
and name not like 'papelera/%'`, y opcionalmente que la carpeta del medio
sea un id de 20 caracteres `[A-Za-z0-9]`.

### Otros puntos del esquema (Info/Baja)

- **jsonb sin forma**: `scopes` y `milestones` solo tienen tope de
  elementos (`03:59`, `:158`, `:168`); `resumen` solo tipo objeto y 64 KB
  (`:184`); `participants.email` no se valida como correo (`:73-80`);
  `links.url` no exige esquema, pero la app filtra con `safeUrl()` al
  dibujar (`index.html:13349`) y escapa todo con `esc()`. Riesgo bajo
  mientras el renderer siga escapando; conviene al menos
  `jsonb_typeof(elemento) = 'object'` en `scopes` y `milestones`.
- **`audit_log`**: insertan (a) cualquier cuenta de Google su `login` /
  `access_requested`, 1 por día; (b) un admin, cualquier otro tipo sin
  tope (`02:415-424`); (c) la base, los `post_*`. Leen solo admins.
  Guarda `ip` y `device`: para `post_*` sale de `cf-connecting-ip` /
  `x-real-ip` / `x-forwarded-for` del pedido (`04:319-320`; el
  `x-forwarded-for` lo puede inventar el cliente, pero va último); para el
  resto lo trae la app de ipify (hallazgo 15). **Sin retención**: no hay
  política de `delete` ni trabajo que pode; crece ~1 fila por acción de
  posteo (unas pocas por día: decenas de MB en años, no es el problema de
  tamaño sino de privacidad).
- **`former_members`**: lo lee todo aprobado, con `photo_url` y correo;
  lo escribe un admin. Sin retención (hace falta para los @nicknames).
- **`user_prefs`**: solo la propia fila; **sin `delete`**: al revocar a
  alguien quedan sus preferencias (y `visto_*`) para siempre. Agregar una
  política de borrado para admins o borrarlas en el mismo flujo de
  revocar.
- **`app_config`**: `calendarSync` lo escribe cualquiera que escribe
  (hallazgo 2 por volumen, no por permiso); sin `delete` (correcto).
- **`access_requests`** (hallazgo 22): `solicitudes_editar` deja que la
  propia fila vuelva a `pending` desde `rejected`; la app lo hace a
  propósito (`index.html:7233` «pidió de nuevo tras un rechazo»), pero sin
  tope: un rechazado puede reaparecer en la cola del admin cada minuto.
  Tope sugerido: que el disparador de hora exija `requested_at` ≥ 1 día
  después de la última, o guardar `rejected_at` y exigir 7 días.
- **`posts_crear`** (`02:199-209`): cualquiera que escribe puede crear
  posteos a nombre de «Google Calendar» sin correo; `registrar_posteo` no
  los anota (`04:336`). Ya está documentado como inevitable sin servidor
  propio; se podría al menos anotar `post_created` con `actor = yo` y
  `detail = 'a nombre de Google Calendar'`.
- **`devolver_al_registro`** (`12:216`): reinserta la fila con sesión de
  admin, así que `hora_del_servidor` pisa `created_at` con ahora y
  `posts_marca_de_hora` pisa `last_edited_at`: el posteo devuelto aparece
  como «nuevo» para todos. La prueba 87 «sacar y devolver deja el posteo
  como estaba» no mira `created_at`. Arreglo: `perform
  set_config('request.jwt.claims','{}',true)` antes del insert (como hace
  `unificar_cuentas`), o conservar `created_at` explícito.
- **Grants** (hallazgo 25): `12:69-70` da `select` / `select, delete`; en
  el segundo `aplicar.sh` el `02:176` (`grant … on all tables`) les suma
  `insert, update`. Inofensivo (RLS sin política = rechaza), pero el
  comentario de `12` queda falso y el día que alguien agregue una
  política de insert «para la base» se abre. Arreglo: en `02`, enumerar
  las tablas, o en `12` `revoke insert, update on … from authenticated`
  al final.
- **Realtime** (`06`): `audit_log`, `user_prefs`, `access_requests` y
  `members` están en la publicación; RLS se aplica por suscriptor, salvo
  en los **`DELETE`**, que Supabase manda a todos con solo la clave
  primaria (limitación documentada de Realtime). Acá las claves son
  correos (`members`, `access_requests`, `user_prefs`): cada navegador
  conectado se entera de qué correo fue revocado o rechazado. Bajo.
- **Índices** (hallazgo 26): lo que la app consulta —todo por clave
  primaria, `replies(post_id, created_at)`, `audit_log(created_at desc)`,
  `access_requests(status, requested_at)`— está cubierto. `calendar_sacados
  order by sacado_el desc` no tiene índice (tabla chica, da igual).
  `posts_scopes_idx` (GIN), `posts_author_email_idx`, `replies_author_idx`
  no los usa ninguna consulta de la app ni de los trabajos: sobran, y el
  GIN se reescribe en cada edición.
- **`search_path`**: `me_gusta_*`, `guardar_preferencias`, `guardar_config`
  (`04:26`, `:45`, `:160`, `:172`) son `security invoker` sin `set
  search_path`; califican todo con `public.`, así que no hay riesgo real.
  Uniformar.
- **`13-sugerencias-calendar.sql`** (hallazgo 23): 925 ids de eventos y
  nombres de pila en un repo público. Con el
  calendario público (hallazgo 1), el id **sí** permite leer el evento
  entero por la API. Mover los nombres a la base (o dejar `personas`
  vacío) y, sobre todo, cerrar el hallazgo 1.

## 2. Pruebas SQL

**Cubren** (≈300 comprobaciones, 16 archivos): los seis roles sobre las
ocho tablas originales, suplantación por cambio de correo, un login por
día, validaciones y topes, me gusta atómico, hora del servidor, guardar
por partes, importación cerrada, registro de posteos (incluida la IP),
contenido vacío, adjuntos grandes, revisar lo de Calendar (sugerencias,
sacar, devolver, clasificar), títulos sin tipo, resumen de visita, y
huérfanos del bucket; más la reaplicación con datos al límite.

**No cubren** (y por qué importa):

| Pregunta | Prueba hoy | Falta |
|---|---|---|
| Subir al bucket a la carpeta de otro / a `papelera/` (18) | ninguna sobre `storage.objects` como usuario (`99` solo prueba `rutas_ok` y el bucket) | `probar('un integrante no sube a la carpeta de otro', …insert into storage.objects…)` |
| `update`/`delete` en `storage.objects` por integrante | ninguna | que `update` falle para todos y `delete` solo admin fijo |
| `editors`/`participants`/`calendar_event_id` de un evento ajeno (17) | ninguna | tras el arreglo, que rebote sin ser autor/editor/admin |
| Unificar la cuenta del admin fijo (10) | `85` solo prueba «común no» y «nueva tiene que existir» | admin por rol no toca al admin fijo; queda en auditoría |
| Esquivar `registrar_posteo` (13) | `97` prueba «me gusta no es edición» | editar sin `last_edited_at` se anota; `'Google Calendar'` con sesión se anota |
| `devolver_al_registro` conserva `created_at` | `87` compara contenido | comparar `created_at` |
| Rechazado que vuelve a `pending` (22) | ninguna | tope en el tiempo |
| `correo_de_su_google` en la rama de excepción (12) | el laboratorio siempre tiene `auth.identities` | una prueba que la `revoke` y compruebe que **nadie** entra |
| Realtime `DELETE` sin RLS | `88` solo mira la publicación | documentar; no es probable en local |
| `13` (datos) y `14` (limpieza de títulos) | `86` solo prueba que no se llame desde la app | que `limpiar_tipo_en_titulos` no vacíe un título que es solo prefijo (está en el código, no en prueba) |

Dos observaciones del banco: `00-laboratorio.sql` imita `storage.objects`
sin `owner_id`/`path_tokens` ni los índices reales, y `auth.identities` es
inventada: las pruebas de permisos demuestran la lógica, no que Supabase
le dé a `postgres` lectura sobre `auth` (hallazgo 12). Y `correr.sh` solo
toma `[89][0-9]-*.sql`: `84`–`87` entran porque empiezan con 8; un `79-`
nuevo no correría nunca (el portero del cero sí está).

## 3. Sincronizador de Calendar

**Bien:** `decidir()` es pura y la prueba diferencial la compara con la
app en cada push (`calendario.yml:43-51`); `crear` es idempotente por id
derivado del evento (`decidir.mjs:144-147`, `sincronizar.mjs:180-184`
con `resolution=ignore-duplicates`); pagina posteos y sacados por id
(`:97-123`); 410 y el 400 de «token de otro calendario» releen todo
(`:155-159`); `set -o pipefail` en el workflow; `EN_SECO`.

### Hallazgo 5 — Un error pasajero de Supabase pierde un cambio para siempre (Media)

```js
// sincronizar.mjs:317-319
// El token se guarda igual aunque alguno haya fallado: si no, la próxima
// corrida vuelve a traer TODO y los mismos eventos vuelven a fallar.
if(resultado.nextSyncToken && !cfg.seco) await guardarSyncToken(resultado.nextSyncToken);
```

Si el PATCH de un evento falla por un 502/timeout de Supabase (no por una
validación), el token avanza igual y Google ya no vuelve a mandar ese
evento: el cambio (fecha, cancelación) **no entra nunca**, hasta que
alguien lo toque de nuevo en Calendar. La app hace lo contrario (no
guarda el token si algo falló, `index.html:6812-6817`), así que si un
navegador se abre al día siguiente lo recupera; si nadie la abre en
semanas, no. La corrida queda en rojo (`exitCode = 1`), pero el aviso es
«fallados: 1» sin decir que no se va a reintentar.

**Arreglo.** Distinguir error de Supabase ≥ 500 / de red (reintentar 3
veces con espera; si sigue, **no** guardar el token) de error 4xx de
validación (guardar el token y dejar el evento anotado). Alternativa
simple: guardar en `app_config.calendarSync` una lista `pendientes` de
ids fallados y volver a pedirlos por `events.get` en la corrida
siguiente.

### Hallazgo 6 — Registros públicos con datos (Media)

```js
// sincronizar.mjs:88
if(!res.ok) throw new Error(`Supabase ${res.status} en ${camino}: ${texto.slice(0, 400)}`);
// :313
console.error(`  ✗ ${ev.id}: ${err.message}`);
```

El repo es público y el registro de Actions también. Cuando Postgres
rechaza una fila por una restricción `check`, el cuerpo de la respuesta
de PostgREST trae `details: "Failing row contains (id, title, content,
…)"`: esos 400 caracteres incluyen título y contenido del posteo (o del
comentario de sistema, que cita el título viejo y el nuevo). `respaldar.mjs:67`
lo hace bien («Sin el texto de la respuesta en el error: podría traer un
dato»); `sincronizar.mjs` y `limpiar.mjs:66` (300 caracteres) no. Hoy es
poco probable (los recortes de `decidir` respetan los topes), pero la
próxima restricción nueva lo vuelve probable. Además `  ✓ <id del
evento>` por evento y las rutas de archivos de la limpieza
(`limpiar.mjs:118`, `:145`: `posts/<id>/img0_<hora>.jpg`) también van al
registro público; con el calendario público (hallazgo 1), el id de un
evento es el evento.

**Arreglo.** En los dos scripts, registrar solo `status` y `camino` sin
query, y el `code`/`message` **sin** `details`/`hint`; en la limpieza,
contar en vez de listar (o listar solo con `EN_SECO`).

### Hallazgo 8 — Horas sin zona (Media)

- La app crea el evento con `timeZone` del **navegador de quien carga**
  (`index.html:6121-6127`): alguien en Israel carga «15:00» y Google lo
  guarda como 15:00 Asia/Jerusalem.
- `events.list` devuelve las horas **en la zona del calendario** (sin el
  parámetro `timeZone`, Google usa la del calendario), y las dos copias
  recortan el texto: `startTime: ev.start.dateTime.slice(11,16)`
  (`decidir.mjs:50`, `index.html:6482`). Ese evento vuelve como
  `09:00-03:00`.
- `cambioHora` da verdadero (`decidir.mjs:209-213`): el posteo se
  reescribe a 09:00 con «Se actualizó desde Google Calendar: fecha
  (…)» firmado por Google Calendar, y si el evento cruza la medianoche
  cambia también la fecha. Con el equipo entre Argentina y Israel (la app
  tiene hebreo) esto pasa en cada evento con hora cargado desde allá.
- Un `dateTime` en `Z` (lo manda Google si el calendario está en UTC)
  daría horas UTC en pantalla.

**A confirmar en Google Calendar**: la zona horaria del calendario LatAm.
**Arreglo.** Pedir `events.list` con `timeZone=<zona del calendario>`
fijo en las dos copias y crear los eventos con esa misma zona (en vez de
la del navegador), o guardar la zona en el posteo. Sumar a la prueba
diferencial un evento en `+02:00`.

### Hallazgo 9 — Excepciones de series con hora, fecha original en UTC (Media)

```js
// decidir.mjs:59-64
return fechaDeRrule(String(ev.id || "").slice(String(ev.recurringEventId).length + 1)) ||
  (ev.originalStartTime && fechaDeRrule(…originalStartTime.date || .dateTime…)) || null;
```

Google forma el id de una instancia con la hora original **en UTC**
(`serie_20260113T010000Z`). Una rutina de 22:00 en Buenos Aires del 12/1
tiene id `…_20260113T010000Z`: la cancelación o la mudanza se anotan en
`recurrence_skip` / `recurrence_moves` con la clave `2026-01-13`, que
para la app (que expande la serie en fecha local) es otro día: el 12
sigue dibujado y el 13 se esconde o se mueve. `originalStartTime.dateTime`
viene con el offset del calendario y daría el día correcto, pero se usa
solo de respaldo. La prueba diferencial solo usa `T000000Z`.

**Arreglo.** Preferir `originalStartTime` (date o los 10 primeros
caracteres de dateTime) y dejar el id como respaldo; en las dos copias
(la diferencial obliga).

### Otros (Baja/Info)

- **Duplicados**: los posteos no (id derivado); los **comentarios de
  sistema sí** pueden salir dos veces si un navegador abierto y el
  trabajo nocturno ven el mismo cambio en el mismo minuto (los dos hacen
  PATCH idempotente y los dos insertan el comentario). Raro: el nocturno
  corre a las 3 de la madrugada.
- **Cancelaciones**: cubiertas (serie entera, instancia suelta, posteo ya
  cancelado); una instancia cancelada de una serie que no es posteo se
  ignora (correcto).
- **429/403 de Google**: no hay reintento ni espera; el trabajo se cae y
  vuelve al día siguiente (`sincronizar.mjs:160`). Aceptable con una
  corrida por día; el navegador lo intenta cada 30 s por pestaña (hasta
  2.880 pedidos/día/pestaña contra la cuota de 1 M/día de la clave).
- **Falla a la mitad**: cada evento es independiente; un corte antes de
  `guardarSyncToken` hace que la próxima corrida vuelva a traer lo mismo
  (idempotente salvo los comentarios de arriba).
- **Tamaño**: `maxResults=250` con paginación; una relectura completa son
  ~4 páginas y un pedido REST por escritura (sin lotes). Bien para este
  volumen.
- **Carrera con el navegador por `syncToken`**: los dos escriben
  `calendarSync` (`sincronizar.mjs:132-140` con `merge-duplicates`;
  la app con `guardar_config`). Un token «más viejo» puede pisar uno más
  nuevo; Google acepta tokens viejos (reenvía lo de en medio) o devuelve
  410 → relectura. Sin pérdida, con costo.

## 4. Limpieza del bucket

**Bien:** mueve a `papelera/<fecha>/` en vez de borrar; 2 días de gracia
(mínimo 1 en la base, `04:236`); borra de la papelera a los 30 (mínimo 7,
`:239`); `RESTAURAR=<fecha>`; frena si lo que sobra pasa el tope; la
función solo la llama la llave de servicio; las miniaturas se derivan
igual que en la app (`04:228` ↔ `index.html:7388`); respuestas no
reemplazan nombres por URLs (`esRuta` excluye `http`, `:7371`).

### Hallazgo 7 — Lo «sacado del Registro» pierde sus adjuntos (Media)

```sql
-- 04-funciones.sql:220-224: lo que se considera «usado»
with nombrados as (
  select unnest(p.images) from public.posts p
  union all select a ->> 'path' from public.posts p, jsonb_array_elements(p.files) a
  union all select unnest(r.images) from public.replies r
  union all select a ->> 'path' from public.replies r, jsonb_array_elements(r.files) a )
```

`sacar_del_registro` borra la fila de `posts` y guarda la copia en
`calendar_sacados.fila` (`12:176-179`), pero la limpieza no mira esa
tabla: los archivos del posteo sacado quedan huérfanos el domingo
siguiente, van a la papelera y a los 30 días se borran. `devolver_al_
registro` reinserta la fila con rutas a archivos que ya no existen (fotos
rotas, adjuntos 404). La prueba 89 no tiene un caso de `calendar_sacados`.

Hoy pasa poco (lo que viene de Calendar nace sin adjuntos; pero un admin
puede sacar un evento al que alguien ya le sumó fotos, y `clasificar`
no lo impide). **Arreglo.** Sumar a `nombrados`:
`select x from public.calendar_sacados s, jsonb_array_elements_text(coalesce(s.fila->'images','[]')) x`
y lo mismo con `fila->'files'->>'path'`; y una prueba en `89`.

### Otros (Info)

- **Umbral**: `tope = max(40, floor(total × 0,25))` (`limpiar.mjs:112`).
  Con un bucket chico (< 160 archivos) pueden moverse hasta 40 (más del
  25 %) sin frenar; es reversible 30 días, así que está bien. Con un
  bucket de 2.000 archivos, 499 se mueven sin preguntar: pensar un tope
  absoluto (p. ej. 200) además del porcentaje.
- **Riesgo con `resumen`**: no guarda rutas (es texto leído del Word),
  confirmado en `index.html:13821`, `:13940`. `milestones` tampoco lleva
  archivos. OK.
- **Carrera con la copia**: la copia corre a las 07:00 UTC y la limpieza a
  las 07:30 sin `needs` entre workflows; si la copia tarda más de media
  hora (la primera vez bajó todo), la limpieza mueve archivos mientras
  la copia los baja → «archivo nº N: 404». Se corrige solo la semana
  siguiente (lo movido ya se copió con su ruta original… solo si se bajó
  antes de moverse). Bajo; poner la limpieza a las 09:00.
- **Papelera y restauración**: `RESTAURAR` devuelve todo lo de un día; no
  hay forma de devolver un archivo suelto (se hace a mano desde el panel).

## 5. Copia de seguridad

**Bien:** repo privado y registro con solo cantidades (`respaldar.mjs:67`,
`:160`); tablas enteras paginadas; la prueba exige que `TABLAS` y
`TABLAS_DE_LA_COPIA` de la app cubran todos los `supabase/NN-*.sql`;
`pg_dump` de la base entera; `concurrency` en el workflow
(`respaldo.yml:36`); token oculto en los errores (`:88`, `:155`); aviso
del vencimiento.

### Hallazgo 14 — Restauración no ensayada e incompleta (Media)

- **Lo que se guarda**: `datos/*.json` (10 tablas), `archivos/` (solo lo
  nuevo; lo borrado del bucket queda), `base/registro.sql.gz` con
  `--schema=public` (`respaldo.yml:123`).
- **Lo que NO**: `auth.users` / `auth.identities` (no hace falta para el
  acceso, que va por `members.email`, pero sí para las estadísticas de
  login y para `audit_log.actor` ↔ cuenta); `storage.objects` (se
  reconstruye al subir); la **configuración del proyecto** (proveedor
  Google con su Client ID/Secret, Site URL y Redirect URLs, «Secure email
  change», Max rows, SMTP, la clave `sb_publishable`, la llave de
  servicio) — eso está en `QUE-GUARDAR.md` como lista, no como copia;
  los **secretos de GitHub** (se rehacen).
- **¿Se puede restaurar de verdad?** El `LEEME` dice «probado» para
  `gunzip | psql`, pero un proyecto nuevo cambia la URL y la clave →
  `index.html` tiene que editarse, el Client ID de Google tiene que sumar
  el nuevo redirect `https://<nuevo>.supabase.co/auth/v1/callback`, y
  **no hay script para resubir `archivos/` al bucket** (son miles de
  archivos; «subir archivos/ al bucket» a mano no es un procedimiento).
  Nadie hizo el camino entero.

**Arreglo.** (1) Un `supabase/respaldo/restaurar.mjs` que, con la llave
de servicio del proyecto destino, suba `archivos/` respetando rutas
(`upsert: false`) y, opcionalmente, cargue `datos/*.json` por REST para
cuando no haya `pg_dump`. (2) Un `docs/RESTAURAR.md` paso a paso (crear
proyecto → aplicar `supabase/` → `psql` del volcado → `restaurar.mjs` →
proveedor Google → cambiar `SUPABASE_URL`/`SUPABASE_KEY` en `index.html`
→ secretos). (3) **Ensayarlo una vez** en un proyecto gratis aparte y
anotar cuánto tardó. (4) Sumar al volcado `--schema=auth --table=auth.users
--table=auth.identities` solo datos (`--data-only`), si se decide que
vale la pena.

### Token, crecimiento y retención (Info)

- **Token** (`respaldo.yml:163-181`): vence 5/10/2027; faltando < 15 días
  la corrida queda en rojo y GitHub manda mail. Si vence sin renovar: el
  clone falla, rojo, mail; la copia se detiene hasta que alguien lo vea.
  Un token *fine-grained* dura un año como máximo: esto se repite cada
  año. **Alternativa sin vencimiento**: una *deploy key* SSH con
  escritura en `registro-respaldos` (secreto con la clave privada, clone
  por `git@github.com:`). Hallazgo 27.
- **Crecimiento del repo privado**: `archivos/` ≤ 1 GB (el bucket) más
  cada versión semanal de `datos/*.json` en el historial (git las guarda
  como deltas: bien). GitHub recomienda < 1 GB y avisa a los 5 GB; a este
  ritmo son años. No hay poda ni retención: todo queda para siempre, lo
  cual es lo deseado para una copia, pero conviene saber que el repo
  privado también es un lugar con **todos los datos** (y las IPs de
  `audit_log`): quien tenga acceso a la cuenta `team-latam` lo tiene todo.
- `git clone --depth 1` + `push`: correcto; si el repo privado pasara 2 GB
  el clone superficial sigue siendo chico.

## 6. Workflows

### Hallazgo 3 — `base-de-datos.yml` sin `concurrency` (Alta)

No hay bloque `concurrency:` (el de `respaldo.yml:36` sí). Dos push a
`main` con menos de ~3 minutos de diferencia (pasa con las tandas de
Claude: «fast-forward y push») lanzan dos corridas; las dos pasan
`probar` y las dos corren `aplicar` **al mismo tiempo** contra Supabase:

- Cada archivo hace `drop policy if exists` + `create policy`: entre el
  drop de una corrida y su create, la otra puede crear → `policy already
  exists` → rojo, y el archivo entero (en su transacción) no se aplica
  (o se aplica el de la otra). `aplicar.sh:49-58` reintenta solo
  `deadlock detected`.
- Peor: la corrida del commit **viejo** puede terminar después de la del
  nuevo y dejar la base con el esquema anterior (sin que nada quede en
  rojo), hasta el próximo push a `supabase/`.

**Arreglo** (dos líneas al tope del workflow):

```yaml
concurrency:
  group: base-de-datos
  cancel-in-progress: false
```

Con eso las corridas van en fila, en orden de llegada. Lo mismo conviene
en `calendario.yml` (un `Run workflow` a mano mientras corre la nocturna
→ dos sincronizadores pisándose el token) y en `limpieza.yml`.

### Hallazgo 4 — Pages publica sin esperar a las pruebas (Alta)

No existe un workflow de Pages: el sitio se publica con el «pages build
and deployment» automático desde la rama `main` (CLAUDE.md lo dice), que
tarda ~1 minuto. `app.yml` (Playwright: instalar Chromium, más de mil
comprobaciones, `app_dom_test`) tarda del orden de 5–10 minutos y **no
gatea nada**: un `index.html` roto está en línea desde el minuto 1, la
cruz roja llega 10 minutos después, y queda en línea hasta que alguien
pushea el arreglo (no hay vuelta atrás automática). Con un equipo que
tiene la app abierta todo el día y el push directo a `main` como regla,
cada tanda es una ventana de exposición.

**Arreglo.** En Settings → Pages → *Source*: **GitHub Actions** (deja de
publicar desde la rama). Un workflow nuevo `pages.yml`:

```yaml
name: Publicar
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  pruebas:
    uses: ./.github/workflows/app.yml      # o repetir los pasos de app.yml
  publicar:
    needs: pruebas
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deploy.outputs.page_url }} }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: . }
      - id: deploy
        uses: actions/deploy-pages@v4
```

(`app.yml` necesita `on: workflow_call:` para poder reusarse.) Efecto: la
versión anterior sigue publicada hasta que las pruebas den verde; una
tanda rota **no sale**. Costo: la publicación pasa de 1 a ~10 minutos. Si
se quiere acortar, dividir `app.yml` en «rápidas» (sin Playwright, 1–2
min) como gate y «completas» después.

### Hallazgo 11 — `Run workflow` desde otra rama aplica ese SQL a producción (Media)

```yaml
# base-de-datos.yml:29 / :97
workflow_dispatch:
…
if: github.event_name != 'pull_request'
```

`on.push.branches: [main]` limita el push, pero `workflow_dispatch` deja
elegir **cualquier rama** en el botón, y `aplicar` no comprueba
`github.ref`. Elegir una rama `claude/…` a medio hacer aplica su
`supabase/` a la base real (pasando sus propias pruebas). Lo mismo en
`calendario.yml`, `limpieza.yml` y `respaldo.yml`: corren el código de la
rama elegida con las llaves reales (menos grave: no cambian el esquema).

**Arreglo.** En `aplicar`: `if: github.event_name != 'pull_request' &&
github.ref == 'refs/heads/main'`. En los otros tres, lo mismo en el job
que usa secretos.

### `esta-arriba.yml` (hallazgo 21, Baja)

Qué chequea: `curl` a `team-latam.github.io/registro-acciones/` (código
200 y que el HTML sea la app), la misma página comprimida con gzip/br/zstd
como Chrome (tamaño igual a la cruda y `</html>` presente), los
encabezados del CDN, y el espejo de jsDelivr. **Solo a mano**
(`workflow_dispatch`); **no mira Supabase** (ni `/rest/v1/`, ni `/auth/v1/
health`, ni Realtime) y **no avisa a nadie** (quien lo corre ve el
resultado). No evita la pausa de Supabase por inactividad (no toca
Supabase): lo que hoy la evita es el sincronizador de Calendar, que todas
las madrugadas lee y escribe por REST con la llave de servicio (**a
confirmar** que Supabase cuente eso como actividad; en la documentación
del plan gratis cuentan los pedidos a la API).

**Arreglo.** Sumar un paso que pida `${SUPABASE_URL}/rest/v1/app_config?select=key&limit=1`
con la clave publicable (espera 200 y una fila) y `/auth/v1/health`; y
un `schedule` (cada 6 horas) con `permissions: contents: read`: un
trabajo programado que falla **manda mail al dueño**, y ese es el aviso
que hoy falta.

### Permisos, pines y secretos (hallazgo 20, Baja)

- Ningún workflow declara `permissions:`; el `GITHUB_TOKEN` queda con el
  default del repo (**a confirmar en el panel**: Settings → Actions →
  Workflow permissions debería estar en «Read repository contents»). Poner
  `permissions: { contents: read }` arriba de cada uno (la publicación de
  Pages del hallazgo 4 es la única que necesita más).
- `actions/checkout@v4` y `actions/setup-node@v4` por tag, no por SHA
  (nueve y siete usos). Para acciones oficiales de GitHub el riesgo es
  bajo; si se quiere, `@<sha>` con comentario de versión y un
  `dependabot.yml` para `github-actions`.
- **Secretos usados**: `SUPABASE_DB_URL` (`base-de-datos`, `respaldo`),
  `SUPABASE_SERVICE_ROLE_KEY` (`calendario`, `limpieza`, `respaldo`),
  `CALENDAR_API_KEY` (`calendario`), `RESPALDOS_TOKEN` (`respaldo`). Los
  cuatro son «llave maestra» de algo; viven solo en Secrets y se usan por
  `env:`, nunca interpolados en `run:` (bien: `limpieza.yml:83-89` lo
  explica). `pull_request` desde un fork no recibe secretos (los jobs con
  secretos tienen `if: != 'pull_request'`): bien.
- `limpieza.yml` y `respaldo.yml`: **mínimos** correctos salvo el
  `permissions:` ausente; `respaldo` necesita escribir **en otro repo**
  (va con el PAT, no con `GITHUB_TOKEN`): bien.

## 7. Cuotas del plan gratis

Patrón de acceso (verificado en `index.html`): al entrar, cada pestaña
abre **un** websocket de Realtime con 10 canales `postgres_changes`
(`posts`, `replies`, `members`×2, `former_members`, `access_requests`×2,
`user_prefs`, `app_config`, `audit_log` solo admins) y carga cada tabla
entera de a 1.000 (`traerTodas`, `:7655`); firma adjuntos con
`createSignedUrls` por 7 días y los guarda en `localStorage` (`:7358`,
`:7454`), con miniaturas de ~30 KB en las tarjetas y `cacheControl` de
un año en lo subido (`:7524`); cada pestaña con permiso de escribir
consulta Google Calendar y **escribe `app_config` cada 30 s** (`:6890`,
`:8044`).

| Cuota | Uso estimado | ¿Riesgo? |
|---|---|---|
| Base 500 MB | posteos y comentarios: unos pocos MB; `audit_log` crece ~1 fila por acción (decenas de MB en años) | No |
| Storage 1 GB | foto 600 KB + 30 KB; adjuntos de hasta 25 MB (Word/Excel/PDF/audio) sin tope por persona; la limpieza semanal saca lo quitado | **Es la primera que se puede llenar por uso normal**: ~1.500 fotos o ~40 adjuntos de 25 MB. Hoy no hay medidor en la app; conviene un aviso en Administración (la función `limpieza_del_bucket` ya devuelve `total`; sumar `sum(metadata->>'size')`) |
| Egress 5 GB/mes | carga: tablas en JSON comprimidas (cientos de KB) + miniaturas (cacheadas una semana); foto entera solo en el visor; copia semanal baja **solo lo nuevo** | Moderado. Lo que lo rompe: **«Copia completa» de la app** (hallazgo 16): baja el bucket entero (hasta 1 GB) por clic; y una foto de 2560 px sin miniatura (las de antes de la miniatura, si no se regeneraron) |
| Realtime 2 M mensajes/mes | ver hallazgo 2 | **Sí, el primero en agotarse** |
| Realtime 200 conexiones | 1 por pestaña | No |
| MAU 50.000 | decenas | No |
| Pausa a los 7 días | el sincronizador nocturno hace pedidos REST cada madrugada; si `SUPABASE_SERVICE_ROLE_KEY` se borra o el workflow se desactiva (GitHub desactiva los `schedule` tras 60 días sin commits), nadie toca la base los fines de semana largos… pero el equipo la usa a diario | Bajo; **a confirmar** que Supabase cuente las llamadas con la llave de servicio como actividad |

### Hallazgo 2 — La escritura cada 30 s de `calendarSync` (Alta por cuota)

```js
// index.html:6890
calendarSyncInterval = setInterval(()=> syncFromCalendar({ silent:true }), 30000);
// :6817 — Google devuelve nextSyncToken en CADA respuesta, haya o no cambios:
if(!failed && result.nextSyncToken) await setSyncMeta({ syncToken: result.nextSyncToken });
// :8044 — y cada guardado cambia la fila, aunque el token sea el mismo:
await this.merge("calendarSync", { ...parche, lastSyncedAt: new Date().toISOString() });
```

`app_config` está en la publicación (`06-tiempo-real.sql:25`) y cada
pestaña la escucha. Con **N** pestañas abiertas con permiso de escribir,
cada una escribe 120 veces por hora y cada escritura llega a las N:
**120 × N² mensajes por hora**. Ocho pestañas durante 8 horas al día son
~61.000 mensajes/día → **1,8 M/mes**, al borde de los 2 M; diez pestañas
lo pasan. Supabase no corta en el plan gratis, pero avisa y puede
restringir; además son 23.000 `update` diarios con sus disparadores
(`config_controlar`, `config_peso`) y 2.880 pedidos por pestaña a Google.
La revisión anterior (punto 6) vio el costo de **leer** `calendarSync`
cada 30 s; el de escribirla y difundirla no.

**Arreglo** (en la app; sin tocar la base): (a) guardar `calendarSync`
**solo si el token cambió** y sin `lastSyncedAt` en cada vuelta (o con
`lastSyncedAt` redondeado a la hora); (b) un solo sincronizador por
persona (una pestaña «líder» con `BroadcastChannel`/`navigator.locks`), y
pausar el intervalo cuando `document.hidden`; (c) subir el intervalo a
2–5 minutos: el nocturno ya cubre lo que no se vea en el momento; (d)
opcional: sacar `app_config` de la publicación y leerla al cargar y tras
cada escritura propia. Con (a)+(c) los mensajes bajan dos órdenes de
magnitud.

### Hallazgo 16 — «Copia completa» desde la app (Media)

`bajarCopiaCompleta` (`index.html:12593-12625`) baja **todos** los archivos
del bucket por `storage.download` de a cuatro y arma un `.zip` en
memoria. Con 800 MB en el bucket, un clic son 800 MB de egress (16 % del
mes) y ~1 GB de RAM en el navegador. No hay aviso del tamaño antes de
empezar. **Arreglo**: mostrar «X archivos, Y MB» (de `storage.list` con
`metadata.size`) y pedir confirmación pasados 200 MB; o limitar la copia
de la app a los datos más los archivos de los últimos N meses, dejando el
bucket entero a la copia semanal (que ya lo tiene).

## 8. Google Calendar desde el navegador

**Cómo se pide el token** (`index.html:5793-5868`): Google Identity
Services (`initTokenClient`, flujo implícito), primero en silencio
(`prompt: ""`, 4 s de timeout) y si no, popup; `hint` con el correo de la
sesión; el token (~1 h) se guarda en `sessionStorage`. **Scopes**
(`:5895-5896`, `:5918-5925`): `calendar.events` para quien escribe
(sensible: todos los calendarios de la persona, no solo el compartido) y
`calendar.acls` además para admins (compartir/sacar). **Calendario**: el
`CALENDAR_ID` de `:5743` o el que el admin puso en Configuración
(`:8465`). **`sendUpdates=all`** al crear, editar, mover una instancia y
borrar (`:6179`, `:6197`, `:6261`): cada participante (`attendees`,
`:6142`) recibe mail de Google desde la cuenta de quien carga; con
`avisar:false` va `none`. **Compartir** (`:5988`): `role: "writer"` sobre
el calendario entero a cada aprobado (no observadores); requiere que la
cuenta del admin sea **dueña** del calendario (`:5960-5975` avisa si no).

### Hallazgo 1 — El calendario es público (Alta)

`supabase/sync-calendar/LEEME.md`: «el calendario está configurado como
público para lectura y alcanza con la clave de API», y `index.html:6426-
6430` lee con `CALENDAR_API_KEY`. Para que una API key lea eventos, el
calendario tiene que estar compartido con «Público → Ver todos los
detalles del evento». Eso significa que **cualquiera en internet**, con
el id del calendario (que está en `index.html` y en el repo público, más
los 925 ids de eventos del `13`), lee **todos** los eventos desde 2019:
títulos con nombres de personas, descripciones, lugares, horarios de
viajes. No hace falta cuenta de Google. Y el calendario aparece en la
búsqueda pública de Google Calendar si se marcó «Hacer disponible
públicamente».

**A confirmar en Google Calendar** → Configuración del calendario LatAm →
«Permisos de acceso para eventos»: si dice «Disponible públicamente –
Ver todos los detalles», es esto.

**Arreglo.** Lectura con credencial en vez de clave pública: (a) en el
navegador, pedir también el token de lectura (`calendar.events.readonly`
alcanza, y ya se pide `calendar.events` para escribir) y leer con
`Authorization: Bearer`; (b) en el nocturno, una **cuenta de servicio**
de Google Cloud con el calendario compartido a su correo (lo que la
revisión anterior dejó «a decidir», punto 2), con la clave JSON como
secreto; (c) entonces poner el calendario en «Ver solo disponible/
ocupado» o sin acceso público, y restringir `CALENDAR_API_KEY` o
borrarla. Es un cambio de uso (todo lector necesitaría conceder el
permiso una vez): avisar antes.

### Pantalla de consentimiento (hallazgo 28, a confirmar)

`README.md:1327-1332` describe la pantalla «Google no verificó esta app»
con «Avanzado → Ir a …»: eso es una app **publicada sin verificar**. Si
en cambio estuviera en **Testing**, solo entrarían los correos cargados
como *test users* (máximo 100) y los demás verían `access_denied`; el
vencimiento a los 7 días en Testing aplica a los **refresh tokens**, que
este flujo (implícito, GIS) no usa: los tokens duran 1 hora y se vuelven
a pedir en silencio, así que no hay «renovar cada 7 días». **A confirmar
en Google Cloud** → APIs y servicios → Pantalla de consentimiento →
*Publishing status*. Riesgos operativos en cualquiera de los dos estados:

- Publicada sin verificar + scopes sensibles: tope de **100 usuarios**
  acumulados (sobra), la pantalla de advertencia asusta y Google puede
  exigir verificación (formulario, video, política de privacidad en un
  dominio propio) para seguir; con `calendar.acls` (restringido en algunos
  listados) puede pedir evaluación de seguridad.
- Testing: alguien nuevo del equipo no puede escribir en Calendar hasta
  que el dueño del proyecto lo sume a test users.
- En ambos: el **dueño del proyecto de Google Cloud `40280679854`** es un
  punto único (CLAUDE.md ya lo protege); `https://team-latam.github.io`
  tiene que seguir en *Authorized JavaScript origins* (README) y el
  **dominio propio** del plan `DOMINIO.md` hay que sumarlo ahí **antes**
  de mudar, o vuelve `origin_mismatch`.
- `calendar.events` abarca todos los calendarios de la persona; con
  `calendar.events.owned` o un calendario por cuenta de servicio
  (hallazgo 1, arreglo b) el pedido sería más chico y la verificación más
  fácil.

### Hallazgo 15 — IPs a un tercero y sin vencimiento (Media)

```js
// index.html:6934
const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
```

`logAudit` (`:6941-6955`) sigue pidiendo la IP pública a `ipify` en cada
login, pedido de acceso, aprobación, rechazo, revocación, cambio de rol y
compartir Calendar, y la guarda en `audit_log.ip`. La revisión anterior
movió la IP de los `post_*` al pedido mismo (`datos_del_pedido()`), pero
los otros ocho tipos siguen así: cada integrante le cuenta su IP a un
servicio ajeno en cada entrada (una pestaña con bloqueador la deja en
`null`, y `audit_una_por_dia` igual acepta la fila), y la auditoría
acumula IPs sin fecha de borrado y sin política que permita borrarlas
(ni al admin fijo). Para un equipo que viaja por LatAm e Israel, la IP de
cada login es un rastro de dónde estuvo cada persona, para siempre, y
también en el repo privado de copias.

**Arreglo.** (a) Sacar `fetchPublicIp` y dejar que la base la tome del
pedido: un disparador `before insert` en `audit_log` que, con sesión de
persona, pise `device`/`ip` con `datos_del_pedido()` (ya existe la
función). (b) Retención: un job semanal (sumarlo a `limpieza.yml`) que
ponga `ip = null` en filas de más de 90 días, o `delete` de más de 2 años;
hace falta una función `security definer` solo para `service_role`, igual
que `limpieza_del_bucket`. (c) Decirlo en la app (Auditoría: «se guarda la
IP 90 días»).

---

## Lo de la revisión anterior, confirmado en el código de hoy

| # REVISION | Confirmado | Dónde |
|---|---|---|
| 1 restricciones en un solo archivo | sí: `03` define `posts_textos` con `content` 0–5000; `09` solo datos; `reaplicar-con-datos.sh` en CI | `03:143`, `base-de-datos.yml:86-87` |
| 2 fechas 1970 | sí: `hora_del_servidor` y `posts_marca_de_hora` reemplazan la marca también sin sesión | `03:315-319`, `04:93-97` |
| 3 paginación | sí en app (`traerTodas`), nocturno y copia | `index.html:7655`, `sincronizar.mjs:97`, `respaldar.mjs:72` |
| 5 miniaturas / firmas | sí: `.min.jpg`, 7 días, `localStorage`, `loading="lazy"` | `index.html:7358`, `:7388`, `:7524` |
| 6 topes de fila y forma | sí | `03:358-511` |
| 7 correo de Google | sí (con la salvedad del hallazgo 12) | `02:56-68` |
| 8 `(select …)` | sí, en las 34 políticas | `02`, `12` |
| 9/10 reconexión y releer una fila | sí | `index.html:7717-7726`, `refrescar` |
| 11 limpieza del bucket | sí (con el hallazgo 7) | `04:217-247`, `limpieza/` |
| 12 menores | sí: me gusta atómico (`04:25-57`), `cuantas_filas` borrada (`05:22`), login 1/día (`03:529`), supabase-js fija | — |
| 13 copias | sí (con el hallazgo 14) | `respaldo/`, `respaldo.yml` |
| «importar() exige admin fijo» | ya no existe: `05` borra `importar`, `importar_quitar`, `cuantas_filas`, `es_importacion` | `05:19-23` |

## Qué hacer primero (orden sugerido)

1. **Hoy, sin tocar la app**: `concurrency` en `base-de-datos.yml` (3) y
   `github.ref == 'refs/heads/main'` en los jobs con secretos (11). Diez
   líneas de YAML.
2. **Esta semana**: Pages desde un workflow con gate de pruebas (4); el
   `calendarSync` cada 30 s (2); la lista `nombrados` con
   `calendar_sacados` (7) + su prueba; recortar lo que va al registro
   público (6).
3. **Con el usuario** (son decisiones suyas): cerrar el calendario público
   (1) —cambia cómo entra la gente—; IPs y retención (15); proteger al
   admin fijo en `unificar_cuentas` (10); confirmar en los paneles los
   cuatro «a confirmar» (12, 1, 28, pausa por inactividad).
4. **Antes de que haga falta**: ensayar una restauración completa en un
   proyecto aparte y escribir `restaurar.mjs` (14); recordatorio del
   token para septiembre de 2027 o pasar a deploy key (27).
