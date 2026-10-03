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
| `02-politicas.sql` | Quién puede tocar qué. Es el equivalente de `firestore.rules` |
| `03-validacion.sql` | Qué forma tiene que tener lo que se guarda |
| `04-funciones.sql` | Lo que hace la base y no el navegador (me gusta, fechas) |
| `05-importar.sql` | La puerta por la que entra el respaldo de Firebase, también en la importación final |
| `06-tiempo-real.sql` | Que los cambios lleguen solos a las pantallas abiertas |
| `09-contenido-vacio.sql` | Saca el relleno de los eventos de Calendar sin descripción |
| `10-fechas-de-1970.sql` | Corrige lo que el sincronizador nocturno haya fechado en 1970 |

**Cada cosa se define en UN solo archivo.** Como se vuelven a aplicar
todos en cada push, dos archivos que definen lo mismo distinto se pisan
en cada corrida — y si el de antes es más estricto que lo que ya está
guardado, el esquema deja de poder aplicarse. Pasó con el contenido de un
posteo (1 carácter en el `03`, 0 en el `09`): por eso el `07` y el `08`
se fundieron en el `01` y el `03`, y el `09` y el `10` solo corrigen
datos.

## La mudanza: la importación final

Para apagar Firebase, Supabase tiene que quedar **igual que Firebase**. Lo
hace `importar.html`, en el modo **Importación final**:

1. **Avisale al equipo** que por un rato no use la app: lo que se escriba
   en Firebase después de bajar la copia no viene.
2. **Bajá la copia completa** desde la app (Preferencias → Copia de
   seguridad → Copia completa). La liviana no sirve: no trae las fotos.
3. Abrí https://team-latam.github.io/registro-acciones/supabase/importar.html,
   entrá con la cuenta del admin y elegí el archivo.
4. **Mirá la comparación**: por cada tabla, cuántas filas son nuevas,
   cuántas ya estaban, y cuáles están **solo en Supabase**. Esas son las
   que se van a sacar: lo que se borró en Firebase después de la primera
   importación (un posteo, el acceso de alguien) y lo que se probó acá.
5. Elegí **Importación final**, abrí las listas, revisalas, tildá la
   confirmación y apretá el botón.

Qué hace:

- Lo de Firebase **pisa** lo que hay en Supabase, la fila entera. Lo que
  vino igual no se reescribe.
- **Saca** de Supabase exactamente lo de la lista: posteos (con sus
  comentarios), comentarios, integrantes, ex integrantes y pedidos de
  acceso. No toca el registro de actividad ni las preferencias de cada
  persona.
- Trae también **el estado de la sincronización con Calendar**: el
  sincronizador nocturno sigue desde donde estaba Firebase, y trae solo lo
  que Firebase no llegó a ver.
- Los **topes de adjuntos** de Firebase no se traen: eran para que todo
  entrara en un documento de Firestore. En Supabase arrancan en los suyos
  (20 fotos, 10 archivos, 10 MB sugeridos) y se cambian en Preferencias →
  Adjuntos.
- Cada foto sube **con su miniatura**. Lo que ya estaba en el bucket (de
  la primera importación) se reconoce y no se vuelve a subir.

Lo que lo frena: una copia que trae mucho menos de lo que hay en Supabase
(¿es la completa? ¿es de este proyecto?), o una tabla que no se pudo leer
para comparar. Y avisa si la copia tiene más de un día.

Si se corta, se vuelve a apretar el botón: lo que ya entró se reconoce. Una
fila que la base no acepta (por ejemplo, un comentario de un posteo que ya
no existe) no frena a las demás: queda listada al final, con el motivo.

Las preferencias personales de cada uno (colores, avisos) **no vienen**: la
copia trae solo las del admin, porque nadie puede leer las de los demás.
Cada persona las vuelve a elegir.

El modo **Completar lo que falta** es el de siempre: trae lo nuevo, no
toca lo que ya está y no saca nada. Sirve para probar.

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
