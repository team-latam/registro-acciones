# La limpieza del bucket

Quitar una foto de un posteo, cambiarla por otra o borrar el posteo entero
dejaba el archivo en el bucket **para siempre**: la app no borra nunca
(solo el admin fijo puede). El bucket crecía sin techo —el plan trae
1 GB— y un archivo quitado se seguía pudiendo abrir con su ruta.

Esto lo limpia **una vez por semana**, los domingos de madrugada
(`.github/workflows/limpieza.yml`).

## Qué hace

1. Le pregunta a la base qué sobra (`limpieza_del_bucket()`, en
   `04-funciones.sql`): lo que **ninguna fila nombra** —ni como foto, ni
   como adjunto, ni como miniatura de una foto que sí está— y tiene **más
   de dos días** (un archivo se sube antes de escribir la fila que lo
   nombra, y en ese rato parece que sobra).
2. Lo **mueve** a `papelera/<fecha de hoy>/`, con la misma ruta adentro.
   No lo borra.
3. Borra de verdad lo que lleva **más de 30 días** en la papelera.

El resumen de cada corrida (qué movió, qué borró) queda en la pestaña
Actions, en la corrida de ese domingo.

## Cuándo no toca nada

Si lo que habría que mover es **más de un cuarto** de todo el bucket, no
mueve nada y la corrida queda en rojo. Eso no es limpieza: es casi seguro
una cuenta que salió mal (por ejemplo, una columna nueva con adjuntos que
la función no conoce). Si después de mirar la lista está todo bien, se
corre a mano con **«sin tope»**.

## A mano

En https://github.com/team-latam/registro-acciones/actions → **Limpieza
del bucket** → **Run workflow**:

- **en seco**: dice qué haría, sin mover ni borrar nada.
- **sin tope**: mueve aunque sea más de un cuarto del bucket.
- **restaurar** (una fecha, `AAAA-MM-DD`): devuelve a su lugar todo lo que
  la limpieza movió ese día. Es la marcha atrás, y sirve mientras no
  pasaron los 30 días.

## Lo que necesita

La llave de servicio de Supabase (`SUPABASE_SERVICE_ROLE_KEY`), la misma
que usa el sincronizador de Calendar: ya está cargada. La función de la
base solo la puede usar esa llave; desde el navegador, ni el admin.

## Si se agrega un lugar nuevo con adjuntos

Si mañana algo más guarda rutas del bucket (otra tabla, otra columna),
**hay que sumarlo a `limpieza_del_bucket()`**. Si no, esos archivos se van
a ver como sobrantes y se van a mover a la papelera. El tope y la papelera
están justamente para que ese olvido no cueste nada.
