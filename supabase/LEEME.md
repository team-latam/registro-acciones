# La base de datos, sin copiar y pegar

Hasta ahora, cada cambio al SQL te lo pasaba por chat y vos lo pegabas en
el panel de Supabase. Eso se terminó: **el SQL vive en el repo y se aplica
solo al pushear a `main`.**

Era uno de los motivos de la mudanza: con Firebase no se podía, las reglas
de Firestore se publicaban a mano desde la consola.

---

## Lo único que tenés que hacer, una vez

### 1. Copiar la dirección de la base

En Supabase, el **botón verde `Connect`** de arriba de todo (al lado del
nombre de la rama). No está en el menú de la izquierda: Supabase lo movió
ahí.

Se abre una ventana con varias opciones. **Elegí "Session pooler".**

> ⚠️ **No elijas "Direct connection".** Esa es solo IPv6, y las máquinas de
> GitHub no tienen IPv6: el trabajo fallaría con un timeout que no dice
> nada útil. La de "Session pooler" anda por IPv4 y es la correcta para
> esto.

Es una línea que arranca con `postgresql://` y trae un `[YOUR-PASSWORD]` en
el medio: hay que reemplazarlo por la contraseña de la base.

Si no la tenés, se genera una nueva desde **Database → Settings** (o con
`Ctrl+K`, escribiendo "database password"). Ojo que al cambiarla se corta
cualquier otra cosa que la esté usando.

> ⚠️ **Esa línea es la llave maestra del proyecto**: quien la tenga puede
> leer, cambiar y borrar todo, sin pasar por los permisos. No la pegues en
> un chat (tampoco conmigo), ni en un mail, ni en un documento. Va directo
> del panel de Supabase al de GitHub.

### 2. Guardarla en GitHub

https://github.com/team-latam/registro-acciones/settings/secrets/actions
→ **New repository secret**

- **Name:** `SUPABASE_DB_URL`
- **Secret:** la línea que copiaste

Listo. No hay paso 3.

---

## Qué pasa a partir de ahí

Cada vez que se pushea a `main` un cambio en `supabase/`:

1. **Se arma un Postgres nuevo, vacío y descartable**, y se le aplica el
   esquema entero — dos veces, para comprobar que aplicar lo mismo de nuevo
   no rompe nada.
2. **Se corren todas las comprobaciones** contra esa base: permisos de los
   tres roles, validaciones, topes, me gusta, la hora del servidor,
   importación, tiempo real.
3. **Se vuelve a aplicar el esquema con datos adentro**, al límite de lo
   que se permite: la base de verdad no está vacía, y un archivo que
   endurece algo sin acordarse de lo ya guardado se cae acá y no allá.
4. **Recién si todo eso quedó en verde**, se aplica a tu Supabase.

Si falla aunque sea una comprobación, el segundo paso no corre y **tu base
no se toca**.

### Dónde mirar

https://github.com/team-latam/registro-acciones/actions

Un tilde verde es que se aplicó. Una cruz roja es que algo no dio, y tu
base quedó como estaba. Si entrás, la corrida te dice cuál archivo falló y
por qué.

### Si algo falla a la mitad

No queda a medias: cada archivo se aplica **entero o nada**. Si el tercero
falla, el primero y el segundo quedaron aplicados, el tercero no dejó ni un
rastro, y los que venían después ni se intentaron.

---

## Los archivos

Se aplican en orden. Todos se pueden correr más de una vez sin romper nada
— aplicar lo que ya estaba aplicado simplemente no cambia nada.

| | Qué es |
|---|---|
| `01-tablas.sql` | Las 8 tablas y el bucket de adjuntos |
| `02-politicas.sql` | Quién puede tocar qué. Es la única autorización del lado del servidor |
| `03-validacion.sql` | Qué forma tiene que tener lo que se guarda |
| `04-funciones.sql` | Lo que hace la base y no el navegador (me gusta, fechas, qué sobra en el bucket) |
| `05-sin-importacion.sql` | Saca las funciones por las que entraron los datos de Firebase: esa puerta ya no tiene motivo para estar abierta |
| `06-tiempo-real.sql` | Que los cambios lleguen solos a las pantallas abiertas |
| `09-contenido-vacio.sql` | Saca el relleno de los eventos de Calendar sin descripción |
| `10-fechas-de-1970.sql` | Corrige lo que el sincronizador nocturno haya fechado en 1970 |
| `11-firmas-guardadas.sql` | Corrige las fotos que quedaron guardadas con su firma vencida en vez de su ruta |

**Cada cosa se define en UN solo archivo.** Como se vuelven a aplicar
todos en cada push, dos archivos que definen lo mismo distinto se pisan
en cada corrida — y si el de antes es más estricto que lo que ya está
guardado, el esquema deja de poder aplicarse. Pasó con el contenido de un
posteo (1 carácter en el `03`, 0 en el `09`): por eso el `07` y el `08`
se fundieron en el `01` y el `03`, y del `09` en adelante solo se corrigen
datos.

## La mudanza (terminada)

**Desde el 3 de octubre de 2026, Supabase es la base del equipo**, y la
única. Para entonces el equipo ya trabajaba ahí (con `?base=supabase`), y
Supabase tenía cosas que Firebase no: por eso no hubo una «importación
final» que dejara Supabase igual a Firebase, que habría borrado lo cargado
acá.

Ese mismo día:

1. Se bajó la última copia de Firebase y el importador la comparó con
   Supabase: faltaban 4 posteos, 6 comentarios, 4 registros de actividad y
   unas preferencias. Se trajo eso y nada más.
2. Se cerró Firestore (reglas que no dejaban entrar a nadie) y después
   se borró su base. La última copia quedó guardada aparte.
3. Se sacó de la app todo lo de Firebase, y de la base la puerta de la
   importación (`05-sin-importacion.sql`). El importador quedó en el
   historial del repo.

4. En Firebase Console se apagó el login con Google y se borró su lista de
   usuarios. Hosting nunca tuvo nada publicado, y Storage nunca se activó.

Lo que queda del proyecto de Firebase es el proyecto de Google Cloud que
está detrás, y **no se borra**: ahí viven el permiso y la clave de
Calendar, y el cliente de Google con el que se pide el permiso.

## El otro secreto

Hay dos trabajos automáticos más que también necesitan algo tuyo: el que
trae los cambios de Google Calendar todas las madrugadas
(`sync-calendar/LEEME.md`) y el que limpia del bucket los archivos que ya
no usa nadie, los domingos (`limpieza/LEEME.md`). Los dos usan la **llave
de servicio** (`SUPABASE_SERVICE_ROLE_KEY`), que es otra cosa distinta de
la dirección de la base de arriba. Los secretos se cargan todos en el
mismo lugar.

---

`pruebas/` es aparte y **nunca** se aplica a la base de verdad: adentro hay
un `auth` de mentira y una función para hacerse pasar por cualquier
persona. Eso existe para probar permisos en una base descartable, y es
justo lo que no puede existir en producción. Por eso vive en otra carpeta.

---

## A mano, si alguna vez hace falta

Los dos scripts que corre GitHub son los mismos que se pueden correr a
mano:

```
./supabase/aplicar.sh "postgresql://…"          # aplica el esquema
./supabase/pruebas/correr.sh "postgresql://…"   # corre las pruebas
```

El segundo **solo contra una base descartable**: cada archivo de prueba
empieza vaciando las tablas.
