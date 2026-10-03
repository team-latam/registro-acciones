# Revisión de Supabase — 3 de octubre de 2026

Firebase se deja de usar pronto, así que esta revisión es **solo sobre
Supabase**: el esquema y los permisos, el bucket de adjuntos, el
sincronizador nocturno de Calendar, los dos workflows que tienen
credenciales, la parte de `index.html` que habla con Supabase y las
herramientas de la mudanza. La revisión anterior, de Firebase, quedó en el
historial (commit `1ec9dbf`).

**Cómo se verificó.** Cada hallazgo se comprobó contra el código. Los
marcados **reproducido** se repitieron en un Postgres 16 local con el
esquema real y el laboratorio de pruebas del repo; los **medidos** traen el
número. Lo que no se ve desde acá (la configuración del panel de Supabase,
los datos reales) está marcado **a confirmar**.

**Lo revisado:** 9 archivos de esquema (~1.200 líneas de SQL) y sus 212
pruebas (todas en verde), el sincronizador y sus 15 corridas nocturnas, los
workflows `base-de-datos.yml` y `calendario.yml`, el adaptador
`crearSupabaseStore` / `crearSupabaseSesion` (~700 líneas) e `importar.html`.

---

## Resumen

| # | Qué | Gravedad | Cómo se sabe | Estado |
|---|---|---|---|---|
| 1 | El próximo cambio de SQL no se va a poder aplicar | **Urgente** | reproducido | resuelto |
| 2 | Lo que crea el sincronizador nocturno queda fechado en 1970 | Alta | reproducido | resuelto |
| 3 | Pasando las 1.000 filas, posteos y comentarios desaparecen | Alta | código + límite de fábrica de Supabase | resuelto |
| 4 | La importación final perdería datos | Alta — frena la mudanza | código | resuelto |
| 5 | Las fotos se comen la cuota de descarga del plan gratis | Alta | calculado | resuelto |
| 6 | Cualquier integrante puede inflar lo que bajan todos | Media | reproducido | resuelto |
| 7 | El correo se valida con un dato que el usuario puede cambiar | Media — depende del panel | a confirmar | resuelto en la base |
| 8 | Las políticas se evalúan fila por fila: 80 veces más lentas | Media | medido | resuelto |
| 9 | Después de una desconexión, la pantalla queda vieja | Media | código | resuelto |
| 10 | Cada escritura, hasta un «me gusta», vuelve a bajar la tabla entera | Media | código | resuelto |
| 11 | Quitar un adjunto no lo borra del bucket | Media | código | **pendiente** |
| 12 | Menores (ver abajo) | Baja | — | resuelto |

---

## 1. El próximo cambio de SQL no se va a poder aplicar — urgente

> **Resuelto.** Cada restricción se define en un solo archivo: el `07` y el
> `08` se fundieron en el `01` y el `03`, y el `09` quedó solo con la
> limpieza de datos. Y CI ahora vuelve a aplicar el esquema sobre una base
> **con datos al límite** de lo permitido (`reaplicar-con-datos.sh`):
> contra el esquema de antes da exactamente el error de arriba.

`aplicar.sh` vuelve a aplicar **todos** los archivos en orden en cada push,
y dos de ellos definen la misma restricción distinto:

```
03-validacion.sql      content entre 1 y 5000   ← la vuelve a crear en cada corrida
09-contenido-vacio.sql content entre 0 y 5000   ← y además vació el relleno de Calendar
```

Después del `09` la base de verdad casi seguro tiene posteos con contenido
vacío: el relleno que se borró de los eventos importados, y de ahora en más
cada evento sin descripción que traiga el sincronizador. En la próxima corrida el `03` intenta recrear la
restricción vieja y Postgres la rechaza:

```
ERROR: check constraint "posts_textos" of relation "posts" is violated by some row
```

**Reproducido** con el esquema real y una sola fila vacía. No rompe datos
(cada archivo es todo o nada), pero el workflow queda en rojo y **ningún
cambio de la base vuelve a aplicarse** hasta arreglarlo. La prueba de CI no
lo ve porque aplica el esquema dos veces sobre una base **vacía**.

El bucket tiene el mismo patrón: `01` pone la lista de tipos completa,
`07` la achica y `08` la vuelve a agrandar, en cada corrida.

**Arreglo:** cada restricción definida en un solo lugar, y una prueba nueva
en CI que vuelva a aplicar el esquema sobre una base **con datos**.

## 2. Lo que crea el sincronizador nocturno queda fechado en 1970

> **Resuelto.** La base reemplaza la marca también cuando escribe la llave
> de servicio (y respeta una fecha real), y `10-fechas-de-1970.sql`
> corrige lo que haya quedado así de antes.

El sincronizador escribe `created_at = 1970-01-01` (y lo mismo en la última
edición) contando con que la base lo reemplace por su hora. Pero el
disparador que pone la hora **se hace a un lado a propósito cuando escribe
la llave de servicio**, que es justo la que usa el sincronizador.

**Reproducido:** un posteo y un comentario escritos como el sincronizador
quedan con `1970-01-01 00:00:00+00`. Efectos: el comentario de sistema
aparece primero en el hilo, el posteo nunca cuenta como nuevo para avisos y
menciones, y «editado» muestra 1970.

En las corridas revisadas no se creó nada todavía (ver «A confirmar»), así
que hoy probablemente no hay filas así; la primera que entre, sí.

**Arreglo:** que la base reemplace la marca con cualquier credencial salvo
la importación, más una corrección para las filas que ya la tengan.

## 3. Pasando las 1.000 filas, posteos y comentarios desaparecen

> **Resuelto.** La app pide cada lista de a páginas ordenadas por su clave,
> con la cuenta total en el primer pedido (una tabla chica sigue siendo un
> pedido), y anda igual si se cambia el tope en el panel. El sincronizador
> también pagina: con el código de antes, un evento del posteo 2.400 creaba
> un duplicado, y la prueba lo muestra.

La app pide cada lista entera con `select("*")`, sin paginar
(`enVivo` → `cargar`). La API de Supabase devuelve como máximo **1.000
filas por pedido** de fábrica (Settings → API → Max rows). Pasado ese
número, el resto **no llega y nadie se entera**: sin error, sin aviso. Los
posteos además se piden sin orden, así que lo que falta no son «los más
viejos»: es cualquiera.

Los comentarios son los primeros en llegar a mil. El sincronizador tiene el
mismo límite (`posts?select=*`) y ahí es peor: un evento cuyo posteo quedó
afuera de los mil se toma como nuevo y **se duplica**.

**Arreglo:** pedir de a páginas hasta traer todo, en la app y en el
sincronizador.

## 4. La importación final perdería datos — frena la mudanza

> **Resuelto.** `importar.html` tiene un modo **Importación final**: lo de
> Firebase pisa lo que hay (fila entera; lo que vino igual no se
> reescribe) y se saca de Supabase exactamente la lista de lo que ya no
> está en Firebase, que la página muestra antes y hay que confirmar. Cada
> adjunto conserva todos sus campos y su extensión; el nombre lleva una
> huella del contenido, así que lo que ya estaba en el bucket se reusa y
> nada se pisa. Cada foto sube con su miniatura. Una fila rota no frena a
> las demás. Trae también el estado de la sincronización de Calendar, y no
> trae los topes de adjuntos de Firebase. El paso a paso está en
> `supabase/LEEME.md`, «La mudanza».
>
> **Encontrado al arreglarlo:** sin sacar lo que ya no está, un posteo
> borrado en Firebase después de la primera importación volvía a aparecer,
> y alguien a quien se le sacó el acceso allá seguía entrando acá.

Para apagar Firebase hay que traer lo último. `importar.html` hoy:

- **Arma cada adjunto de nuevo con nombre y ruta nada más**, y pierde la
  ranura de documentación, el tipo y la fecha de subida. Los documentos que
  se adjuntaron a «Plan de viaje» o «Reporte» llegarían como adjuntos
  sueltos. Es el mismo error que se corrigió en la app el 2 de octubre; acá
  sigue.
- **No actualiza lo que ya está** (`on conflict do nothing`). Todo lo que se
  editó en Firebase después de la primera importación —documentos nuevos,
  cambios de fecha, «me gusta», cancelaciones— **no pasaría**.
- Los Word, Excel y audios suben como `.bin`.

**Arreglo:** que conserve todos los campos de cada adjunto y que tenga un
modo «importación final» que actualice lo que ya existe (solo el admin
fijo, como hoy).

## 5. Las fotos se comen la cuota de descarga

> **Resuelto.** Cada foto nueva sube con una miniatura al lado
> (`.min.jpg`, 480 px, ~30 KB): las tarjetas y los borradores muestran esa,
> y la entera se baja recién en el visor. Las fotos de las tarjetas se
> bajan cuando están por verse (`loading="lazy"`). Las firmas duran una
> semana y se guardan en el navegador, así una foto tiene la misma
> dirección de una carga a la otra y no se vuelve a bajar; lo subido se
> puede guardar un año en el navegador, porque una ruta no se reusa nunca.
> Una pestaña abierta renueva sola las firmas que vencen en menos de un
> día (antes, pasadas cuatro horas, lo que no se había bajado aparecía
> roto). Al cerrar la sesión, por donde sea, las firmas guardadas se
> borran.
>
> **El precio:** una dirección copiada abre su archivo hasta una semana,
> aun para alguien a quien se le sacó el acceso. Antes eran cuatro horas.
>
> **Las fotos de antes no tienen miniatura** y se siguen mostrando
> enteras: la importación final (punto 4) las tiene que armar.

El plan gratis da **5 GB de descarga por mes**. Hoy:

- Las fotos se suben a 2560 px (~600 KB) y **las tarjetas muestran ese
  archivo entero**, no una miniatura.
- La URL firmada cambia en cada carga de la página, así que el navegador no
  reconoce que ya tenía la foto y **la vuelve a bajar entera cada vez**.
- No hay carga diferida (`loading="lazy"` no aparece en la app): se bajan
  todas las de las tarjetas dibujadas, se vean o no.

Una pantalla con ocho fotos son ~5 MB. **Mil cargas por mes entre todo el
equipo, unas 33 por día, agotan la cuota.**

**Arreglo:** una miniatura al subir (las tarjetas usan esa; la foto entera,
solo al abrirla), URL firmada estable entre cargas para que el navegador la
reuse, y carga diferida.

## 6. Cualquier integrante puede inflar lo que bajan todos

> **Resuelto.** Tope por fila entera (posteo 256 KB, comentario 128 KB,
> preferencias 32 KB, configuración 256 KB) y la forma exacta de la
> sincronización, los tipos de actividad y las zonas. Lo de los tipos y las
> ciudades se valida cuando cambia, para que un dato viejo de una sección
> no trabe el guardado de las otras.

**Reproducido**, con la credencial de una integrante común:

| Qué | Guardé | Quién lo baja |
|---|---|---|
| `app_config` → `calendarSync` | 5 MB | el navegador de cada integrante, **cada 30 segundos** |
| `milestones` de un posteo | 4 MB | todos, en cada carga |
| sus preferencias | 5 MB | ella, en cada carga |

No hay tope de tamaño en ningún `jsonb`, ni forma para la configuración del
equipo (tipos de actividad y zonas: lo que en Firebase era la prioridad 4
de la revisión anterior, y que acá sí se puede validar entero porque SQL no
tiene el tope de expresiones de las reglas de Firestore).

**Arreglo:** tope de tamaño por fila en posteos, comentarios, preferencias y
configuración, y la forma exacta de `calendarSync`, tipos y zonas.

## 7. El correo se valida con un dato que el usuario puede cambiar

> **Resuelto en la base:** el correo del token tiene que ser el que
> autenticó Google (`auth.identities`). Si algún día Supabase no dejara
> leer esa tabla, se vuelve a la regla de antes en vez de dejar a todos
> afuera. Igual conviene revisar el panel.

`sesion_valida()` exige `user_metadata.email_verified`, pero **cualquier
usuario puede reescribir su propio `user_metadata`** desde el navegador.
Lo que de verdad protege es que el proveedor sea Google… más la
configuración del panel: si «Confirm email» estuviera apagado, alguien que
entró con su Google podría cambiarse el correo al de una persona aprobada
que **todavía no entró nunca a Supabase**, sin confirmación, y pasar a ser
ella. (Al del admin no: ese correo ya existe y Supabase no lo deja repetir.)

**A confirmar** en el panel: Authentication → Providers → Email apagado y
«Confirm email» prendido.

**Arreglo, independiente del panel:** atar el correo a la identidad de
Google (`auth.identities`), que el usuario no puede tocar.

## 8. Las políticas se evalúan fila por fila

> **Resuelto:** las 31 políticas, envueltas.

Cada política llama a `es_admin_fijo()` / `esta_aprobado()` directo, y
Postgres las vuelve a evaluar **por cada fila**: decodifica el token cuatro
veces y busca en `members` otra vez, fila por fila.

**Medido**, leyendo 3.000 posteos como integrante: **67 ms** así, **0,8 ms**
envolviendo las funciones en `(select …)`, que hace que se evalúen una vez
por consulta. Pesa en cada carga y en cada aviso en vivo, que se chequea
contra las políticas de cada persona conectada.

**Arreglo:** envolver las llamadas en todas las políticas. No cambia quién
puede qué; lo comprueban las 66 pruebas de permisos.

## 9. Después de una desconexión, la pantalla queda vieja

> **Resuelto.** Cuando el canal se vuelve a suscribir, la lista se vuelve a
> cargar. Y si esa recarga falla (la red todavía inestable), no aparece la
> pantalla de error: queda la lista que había y se reintenta sola.

Los avisos en vivo de Supabase no se repiten: lo que cambió mientras la
notebook dormía o se cortaba el wifi **se pierde**, y la pantalla queda
mostrando lo de antes hasta recargar. Firebase se resincronizaba solo.
`enVivo` se suscribe sin mirar el estado de la conexión y la app no escucha
ni el foco ni la vuelta de la red.

**Arreglo:** volver a cargar la lista cuando el canal se reconecta.

## 10. Cada escritura vuelve a bajar la tabla entera

> **Resuelto.** Después de escribir se relee solo esa fila, y un aviso en
> vivo con una foto nueva firma solo esa foto.

Después de escribir, `refrescar()` recarga la tabla completa para que se vea
al instante: un «me gusta» baja todos los posteos; uno en un comentario,
todos los comentarios. Y cuando llega en vivo un posteo con una foto, **cada
navegador conectado** recarga la tabla entera para firmarla.

**Arreglo:** releer solo la fila que cambió, y firmar solo lo nuevo.

## 11. Quitar un adjunto no lo borra del bucket

Solo el admin fijo puede borrar del bucket y la app no lo hace nunca. Un
archivo quitado de un evento **sigue ahí**: ocupa lugar del GB del plan y
cualquier aprobado que tenga la ruta lo sigue pudiendo abrir.

**Arreglo:** una limpieza periódica de lo que ninguna fila nombra. Ojo:
la miniatura de una foto (`…_123.min.jpg`) no la nombra ninguna fila; se
la nombra a través de su foto, y se va con ella.

## 12. Menores

- ~~**El «me gusta» se puede duplicar** escribiendo directo a la base.~~
  **Resuelto.**
- ~~**`cuantas_filas()` la puede llamar cualquier cuenta de Google.**~~
  **Resuelto:** solo un admin.
- ~~**La auditoría acepta filas sin límite** de cualquier cuenta de
  Google.~~ **Resuelto:** un login se anota con el id que arma la app
  (correo, tipo y fecha), así que son tres filas como mucho.
- ~~**`supabase-js` se carga sin versión fija.**~~ **Resuelto:** fija en
  2.117.2, en la app y en las dos páginas de herramientas.
- ~~El cartel «Esta pestaña está mirando SUPABASE…» está escrito solo en
  español.~~ **Resuelto.**
- ~~`esErrorDePermiso` toma `PGRST301` (token vencido) como falta de
  permiso.~~ **Resuelto.**
- ~~Documentación vieja.~~ **Resuelto.**
- **Encontrado al arreglar lo demás:** un `.docx` o `.xlsx` que el navegador
  no reconoce (pasa en Windows y Android) se leía como
  `application/octet-stream`, que el bucket no acepta: el archivo
  rebotaba. **Resuelto:** el tipo sale de la extensión.
- **Encontrado también:** `pruebas/` tenía copias de las dos pruebas del
  sincronizador, y una ya se había desviado del original. **Resuelto:** se
  sacaron; las originales corren en su workflow con cada cambio a la app.
- ~~`pruebas/levantar.sh` usa una copia del laboratorio guardada aparte.~~
  **Resuelto.** Hay dos pruebas numeradas `98`.

---

## Para apagar Firebase

Lo que falta, en orden:

1. ~~Arreglar 1 a 4: sin eso, la mudanza pierde o esconde datos.~~
   **Hecho.**
2. **Importación final** con el importador, con Firebase en pausa mientras
   corre para que no entre nada nuevo en el medio. El paso a paso, en
   `supabase/LEEME.md` («La mudanza»).
3. Cambiar la base por defecto a Supabase (`baseElegida()`) y sacar el
   cartel; dejar `?base=firebase` unas semanas como vuelta atrás
   (`VOLVER-A-FIREBASE.md`).
4. **No borrar el proyecto de Google Cloud que está detrás de Firebase**
   (número 40280679854). Ahí viven el cliente de OAuth con el que se pide
   el permiso de Calendar y la clave de la API de Calendar, y muy
   probablemente el login de Google de Supabase. Apagar Firebase es dejar
   de usar Firestore, no borrar el proyecto.
5. Sacar la carga de Firebase en modo Supabase: hoy se inicializa igual,
   solo como último recurso para el permiso de Calendar, que ya se pide por
   Google Identity Services.

## El código que sobra

~~**Hoy**, del lado de Supabase: el comentario y la documentación vieja del
punto 12, y el `07`/`08` que se pisan entre sí (punto 1).~~ **Hecho.**

**El día del cambio** (no antes: Firebase sigue siendo producción):
`firebaseStore`, `firebaseSesion`, `LIMITES_FIREBASE` y el control de
peso de 1 MiB (`excesoDePeso` y compañía, que solo existe por Firestore),
el respaldo de Firestore (`armarRespaldo`), el modo de respaldo de los
comentarios para cuando falta la regla de `collectionGroup`, el selector
`?base=` y su cartel, `firestore.rules`, `importar.html`,
`prueba-login.html`, `PROBAR-SUPABASE.md`, `QUE-GUARDAR.md`, y la función
`importar()` del `05`. Más adelante, `VOLVER-A-FIREBASE.md`.

---

## Lo que está bien

No es relleno: son los lugares donde un error habría sido grave, y están
bien resueltos.

- **RLS prendido en las ocho tablas**, y `anon` sin permisos sobre ninguna.
- **Las funciones con permisos elevados fijan `search_path = ''`**: nadie
  les puede cambiar a qué tabla apuntan.
- **Lo que no se puede cambiar, no se puede cambiar**: de quién es un
  posteo y cuándo se creó (ni el admin), el propio rol, el correo de una
  persona. Lo cuidan disparadores, que corren también para quien escribe
  directo a la base.
- **La hora la pone el servidor** para todo lo que escribe una persona.
- **`importar()` exige al admin fijo con su Google**, no una llave, y la
  marca que abre la puerta dura lo que dura la transacción.
- **El bucket es privado**, con tope de 25 MB y lista cerrada de tipos; las
  rutas se validan (nada embebido, nada que salga de su carpeta).
- **El «me gusta» desde la app es atómico** y el correo sale de la
  credencial, no de un parámetro.
- **Ningún cambio de SQL llega a la base sin pasar antes 212 pruebas** en un
  Postgres descartable, y cada archivo se aplica entero o nada.
- **La llave de servicio vive solo en los secretos de GitHub** y solo la usa
  el sincronizador.
- **La lógica del sincronizador está dos veces a propósito**, y una prueba
  diferencial las compara escritura por escritura en cada push.

---

## A confirmar con vos

1. **¿Se creó o se cambió algún evento en el Google Calendar del equipo
   desde el 18 de septiembre?** El sincronizador nocturno corrió todas las
   noches desde entonces y **siempre dijo «0 cambios»**. Si hubo cambios,
   está leyendo otro calendario o un token trabado, y a Supabase le faltan
   esos eventos.
2. En el panel de Supabase, **Authentication → Providers**: ¿está apagado
   «Email» y prendido «Confirm email»? (punto 7)
