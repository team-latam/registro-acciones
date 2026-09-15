# Cómo volver a Firebase

Este archivo existe por una sola razón: que la migración a Supabase se pueda
deshacer. Está escrito para vos, no para un programador.

**Regla de oro mientras dure la migración: no se borra NADA de Firebase.**
Ni el proyecto, ni la base, ni las reglas publicadas. Firebase se queda ahí,
apagado pero entero, hasta que pasen meses de que Supabase ande bien.

---

## Las dos cosas que te dejan volver

**1. El código.** El historial de Git tiene una marca llamada `firebase-v1`
en el último `index.html` que funciona 100% con Firebase. Esa marca no se
mueve nunca.

**2. Los datos.** El botón de copia de seguridad, en
**Administrar → Preferencias → Copia de seguridad**. Baja todo lo que hay
guardado a un archivo JSON.

> **Bajá una copia completa ANTES de empezar, y guardala fuera de la
> computadora** (Drive, un pendrive, lo que uses). Sin ese archivo, esto no
> sirve de nada.

---

## Qué se pierde según cuándo vuelvas

Volver siempre es posible. Lo que cambia es cuánto trabajo cuesta.

| Cuándo | Qué se pierde | Cómo se vuelve |
|---|---|---|
| Antes de que el equipo empiece a usar Supabase | **Nada** | Se vuelve el código a `firebase-v1`. Firebase nunca dejó de estar al día. |
| Después de que el equipo ya cargó cosas en Supabase | Lo que se cargó en Supabase desde el cambio | Se vuelve el código **y** hay que traer esos datos nuevos a Firebase |
| Meses después | Lo mismo, pero es mucho más | Igual, pero con mucho más para traer |

Por eso la migración se hace por etapas y con las dos bases andando en
paralelo un tiempo: mientras estén las dos, volver no cuesta nada.

---

## El procedimiento

### Si todavía nadie usó Supabase

Pedile a Claude: **"volvé el código a la marca `firebase-v1`"**. Listo. Tu
app queda exactamente como el día que empezamos.

Si querés hacerlo vos, es un comando:

```
git checkout firebase-v1 -- index.html firestore.rules
git push origin HEAD:main
```

Y después, si `firestore.rules` había cambiado, republicá en Firebase Console
la versión que sale de ahí.

### Si el equipo ya cargó cosas en Supabase

1. **Antes que nada, bajá todo de Supabase.** Desde el panel de Supabase se
   exporta la base entera. Guardá ese archivo.
2. Volvé el código, igual que arriba.
3. Pedile a Claude que **traiga a Firestore lo que se cargó en Supabase**
   usando ese archivo. Es un trabajo de un rato, no de días: las dos bases
   guardan lo mismo, con otra forma.
4. Volvé a publicar `firestore.rules` en Firebase Console.

---

## Qué NO hacer mientras dure la migración

- **No borres el proyecto de Firebase.** Aunque parezca que ya no se usa.
- **No saques las reglas publicadas.** Si las reemplazás por las de un
  proyecto nuevo, volver se complica.
- **No borres la marca `firebase-v1`** del historial.
- **No tires el archivo de la copia de seguridad.** Es tu red.

---

## Cómo saber si estás cubierto

Antes de cada etapa de la migración, chequeá estas tres:

- [ ] Tengo una copia de seguridad **completa** bajada hace poco, guardada
      fuera de la computadora.
- [ ] La marca `firebase-v1` sigue en el historial.
- [ ] El proyecto de Firebase sigue existiendo, con sus reglas publicadas.

Si las tres están, podés volver. Si falta alguna, paralo y arreglá eso
primero.
