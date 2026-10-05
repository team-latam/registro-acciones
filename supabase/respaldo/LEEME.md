# La copia de seguridad semanal

Cada domingo a las 04:00 (Argentina), el trabajo **Copia de seguridad**
(`.github/workflows/respaldo.yml`) copia todo al repo **privado**
`team-latam/registro-respaldos`:

| Qué | Dónde | Para qué |
|---|---|---|
| Cada tabla, legible | `datos/<tabla>.json` | Recuperar algo puntual (un posteo borrado) |
| Fotos y adjuntos | `archivos/<ruta>` | Lo que se borra de la app se queda acá |
| La base entera | `base/registro.sql.gz` | Restaurar todo de una vez |

Las tablas se pisan cada semana: el historial de commits de ese repo es el
que guarda cómo estaba todo cada domingo. Los archivos solo se agregan.

Se puede correr a mano: pestaña **Actions → Copia de seguridad → Run
workflow**. La prueba (`pruebas/correr.sh`) corre antes de cada copia.

## Lo que necesita (una sola vez)

1. El repo privado `team-latam/registro-respaldos`.
2. Un token *fine-grained* de GitHub con acceso **solo** a ese repo y
   permiso **Contents: Read and write**, cargado en este repo como el
   secreto `RESPALDOS_TOKEN`.
3. Los secretos que ya están: `SUPABASE_SERVICE_ROLE_KEY` (el del
   sincronizador) y `SUPABASE_DB_URL` (el que aplica el SQL).

El token vence: **el actual, el 5 de octubre de 2027** (creado el
5/10/2026). Cada corrida anota cuántos días le quedan, y faltando menos de
15 la corrida queda en rojo (GitHub manda un mail cuando falla un trabajo
programado). Para renovarlo: generar otro igual (Settings → Developer
settings → Fine-grained tokens, acceso solo a `registro-respaldos`,
Contents: Read and write) y, en este repo, Settings → Secrets → Actions →
`RESPALDOS_TOKEN` → **Update**. Si vence sin renovarse, la corrida queda
en rojo diciendo que no pudo abrir el repo.

## Por qué así

Este repo es **público**, y sus registros de Actions también: una copia
como artefacto la podría bajar cualquiera. Por eso va derecho a un repo
privado, y el registro de la corrida solo dice cantidades.

## Restaurar

- **Algo puntual**: buscar la fila en `datos/<tabla>.json` del commit de
  la semana que corresponda y volver a cargarla (pedírselo a Claude).
- **Todo**: en una base vacía con el esquema de `supabase/`,
  `gunzip -c base/registro.sql.gz | psql "<dirección>"` (probado: el único
  aviso, «schema "public" already exists», no importa), y subir
  `archivos/` al bucket `adjuntos`.

Además de esta copia automática, la app tiene un botón en
**Administración → Copia de seguridad** para bajar una en el momento.
