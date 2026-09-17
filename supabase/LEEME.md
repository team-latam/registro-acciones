# La base de datos, sin copiar y pegar

Hasta ahora, cada cambio al SQL te lo pasaba por chat y vos lo pegabas en
el panel de Supabase. Eso se terminó: **el SQL vive en el repo y se aplica
solo al pushear a `main`.**

Era uno de los motivos de la mudanza. Con Firebase no se puede: las reglas
de Firestore se publican a mano desde la consola y no hay forma de
automatizarlo desde acá. Por eso `firestore.rules` **sigue siendo a mano**
mientras Firebase sea la base del equipo.

---

## Lo único que tenés que hacer, una vez

### 1. Copiar la dirección de la base

En Supabase → **Project Settings** → **Database** → **Connection string** →
pestaña **URI**. Es una línea que arranca con `postgresql://`.

Te va a pedir la contraseña de la base. Si no la tenés, en esa misma
pantalla se puede generar una nueva (**Reset database password**); ojo que
al cambiarla se corta cualquier otra cosa que la esté usando.

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
2. **Se corren las 195 comprobaciones** contra esa base: permisos de los
   tres roles, validaciones, me gusta, importación, tiempo real.
3. **Recién si todo eso quedó en verde**, se aplica a tu Supabase.

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
| `02-politicas.sql` | Quién puede tocar qué. Es el equivalente de `firestore.rules` |
| `03-validacion.sql` | Qué forma tiene que tener lo que se guarda |
| `04-funciones.sql` | Lo que hace la base y no el navegador (me gusta, fechas) |
| `05-importar.sql` | La puerta por la que entró el respaldo de Firebase |
| `06-tiempo-real.sql` | Que los cambios lleguen solos a las pantallas abiertas |
| `07-adjuntos-grandes.sql` | Los topes de adjuntos, sueltos |

## El otro secreto

Hay un segundo trabajo automático que también necesita algo tuyo: el que
trae los cambios de Google Calendar todas las madrugadas
(`sync-calendar/LEEME.md`). Ese usa la **llave de servicio**
(`SUPABASE_SERVICE_ROLE_KEY`), que es otra cosa distinta de la dirección de
la base de arriba. Los dos secretos se cargan en el mismo lugar.

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
