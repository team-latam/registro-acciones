# Cómo probar la base nueva

La app del equipo sigue funcionando con Firebase, como siempre. En
paralelo hay una copia de los datos en Supabase, y **una forma de usar la
app de verdad contra esa copia**, sin que nadie se entere.

Esta es la etapa larga de la migración, y es a propósito: mientras las dos
bases estén andando, volver atrás no cuesta nada.

---

## La dirección

```
https://team-latam.github.io/registro-acciones/?base=supabase
```

Esa pestaña —y **solo** esa— trabaja contra Supabase. Se reconoce por un
**cartel naranja** arriba de todo.

Si el cartel no está, estás en la base del equipo: lo que hagas ahí lo ve
todo el mundo.

**Para volver:** cerrás la pestaña. No hay nada que deshacer.

---

## Lo que conviene probar

No hace falta hacerlo todo de una. La idea es que, cada tanto, en vez de
abrir la app normal abras esta y trabajes un rato ahí. Lo que se rompa, se
rompe sin consecuencias.

### Leer
- [ ] El Feed muestra los mismos posteos que la otra pestaña
- [ ] Un evento viejo con comentarios: están todos
- [ ] Un posteo con foto: **la foto se ve**
- [ ] El Calendario se ve igual, mes a mes
- [ ] Los filtros de actividad y de zona
- [ ] El mapa y los conteos por país
- [ ] Proyectos, con sus hitos

### Escribir
- [ ] Un posteo nuevo, y que aparezca solo
- [ ] Un posteo **con una foto**
- [ ] Un comentario
- [ ] Un "me gusta", ponerlo y sacarlo
- [ ] Editar un posteo
- [ ] Cancelar un evento
- [ ] Marcar un hito como cumplido
- [ ] Cambiar algo en Configuración (colores, avisos)

### Lo que esta base permite y la otra no
Esta es la razón por la que nos mudamos. En la pestaña con
`?base=supabase` los topes son otros — no hay que configurar nada, salen
solos:

| | Antes (Firebase) | Acá |
|---|---|---|
| Fotos por posteo | 6 | **20** |
| Calidad de la foto | achicada a 1280 px | **2560 px, casi sin comprimir** |
| PDF/audio por posteo | 2 | **10** |
| Peso de cada uno | 150 KB | **10 MB** |

- [ ] Subí **una foto grande** (de la cámara del celular, sin achicarla) y
      fijate que se vea nítida al abrirla — comparala con la misma foto
      subida en la pestaña normal
- [ ] Subí **más de 6 fotos** a un posteo
- [ ] Subí un **PDF de verdad** (uno de varios MB, no uno recortado)
- [ ] Mandá una **nota de voz** o un audio largo
- [ ] En **Administrar → Configuración → Adjuntos**, mirá que los topes
      digan 20 / 10 / 25 MB y que el tamaño esté en MB (en la pestaña
      normal dice 6 / 2 / 500 KB, en KB)

> El **video** sigue yendo por link, a propósito. No es por el lugar (hay
> de sobra) sino por la descarga: el plan da 5 GB por mes y un video que
> mire todo el equipo se lo come.

### Lo que se repite
- [ ] Un evento semanal: que se vea en todas sus fechas
- [ ] Un comentario en UNA fecha: que no aparezca en las otras
- [ ] Mover una fecha suelta a otro día
- [ ] Suspender una fecha

### Lo de administrar
- [ ] Aprobar una solicitud
- [ ] Cambiar el rol de alguien
- [ ] Ver la Actividad (el registro de accesos)
- [ ] Compartir el Calendar con alguien

### Entre dos
- [ ] Abrí **dos** pestañas con `?base=supabase`, escribí en una y mirá la
      otra: tiene que aparecer sola

---

## Si algo se ve mal

Sacá una captura y contámelo. No hay ningún riesgo:

- Firebase no se toca, y es la que manda
- Si rompés algo en Supabase, se vacía y se vuelve a importar en dos
  minutos
- Lo que escribas ahí no lo ve nadie del equipo

**Lo que más sirve** es comparar: la misma pantalla en las dos pestañas,
lado a lado. Las diferencias son lo que hay que cazar.

---

## Lo que YA apareció así

Cinco cosas, y ninguna la habrían encontrado las pruebas automáticas:

1. Los horarios salían con los segundos colgando (`15:00:00` en vez de `15:00`)
2. Lo que se escribía no aparecía hasta recargar
3. Las imágenes no se veían
4. Aprobar a alguien que ya tenía ficha se caía
5. El permiso de Calendar dependía de Firebase

Todas arregladas. Por eso esta etapa existe: son errores que solo se ven
usando la app, no probándola.
