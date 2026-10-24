# Lo que hay que tener presente

Hasta el 24/10/2026 esto estaba en `CLAUDE.md`, que cada sesión de Claude
lee entero en cada mensaje. Se mudó acá (decisión D13 de
`docs/AUDITORIA.md`) para que `CLAUDE.md` quede con las reglas y este
documento se lea cuando el pedido toque alguno de estos temas. Nada se
cambió de contenido: solo de lugar.

## Los documentos

En `docs/` (el índice, `docs/README.md`):

- `REDISENO.md`: las tandas hechas y las decisiones.
- `REVISION.md`: la revisión técnica y lo que queda.
- `QUE-GUARDAR.md`: qué tener a mano para reconstruir.
- `DOMINIO.md`: el plan, no ejecutado, de mudar el sitio a un dominio
  propio si `*.github.io` vuelve a bloquearse en Argentina.
- `AUDITORIA.md`: la última auditoría (24/10/2026, completa con énfasis en
  seguridad y en el costo de cada cambio, códigos S y D10–D13); el detalle
  en `informes/`, y las anteriores (la completa del 6/10, la de lo nuevo
  del 7/10, la de la Agenda del 9/10 y la completa del 10/10) en
  `informes/historial/`.
- `RESTAURAR.md`: cómo volver atrás con una copia (workflow «Restaurar una
  copia», `supabase/respaldo/restaurar.mjs`).
- `PROPUESTAS.md`: las 16 propuestas (abajo).

## Las 16 propuestas de mejoras (13/10/2026)

`docs/PROPUESTAS.md`: qué eligió el usuario (en dos vueltas), cómo se leyó
cada nota y el orden en que se hicieron; la página con las maquetas está
enlazada ahí. **Todo lo elegido ya está hecho** (tandas 70 a 78 de
`REDISENO.md`): planillas, «Repetir» con la fecha del año que viene,
«Tendencias» en Reportes y en el Inicio (los temas salen solos de lo que el
equipo escribe; el admin no define palabras: lo pidió así el 14/10/2026),
pasos con responsable y fecha, «Algo no anda», modo presentación, correo
mensual de lugares sin actividad, informe mensual con enlace de 48 horas y
«Mi año».

Falta que el usuario **prenda** en Administración › Correos el aviso de
lugares sin actividad (viene prendido, 6 meses) y el **informe mensual**
(viene apagado: hay que elegir a quién le llega); los correos nuevos solo
salen a quienes Administración › Correos habilita. Lo que dijo «no por
ahora» y el recorrido de un viaje en el mapa siguen en ese documento. Si
pide «las propuestas», arrancar de ahí.

## El video de presentación

En inglés, ~74 s, celular y compu; el usuario aprobó la v5 como final el
13/10/2026. Se rehace entero con `bash herramientas/video/hacer_video.sh`;
todo el proceso, las decisiones y lo que hay que revisar cuando la app
cambie están en `herramientas/video/README.md`. Los MP4 no están en el repo
(los tiene el usuario). Los datos de la demo son inventados: nunca ponerle
datos reales.

## El Mapeo de comunidades

El Excel («Mapeo - LatAm», un Sheet de Google del usuario) tiene nombres y
teléfonos de personas: no se commitea ni se embebe en ninguna página (el
repo y el sitio son públicos). La herramienta que lo revisaba
(`herramientas/mapeo.html`, 9/10/2026) se retiró a pedido del usuario el
10/10/2026; queda en el historial de Git (`REDISENO.md`, tanda 58), y lo
que sigue —subir ese Mapeo a la Agenda— es para otra conversación (lo de
«Traer una lista» en `REDISENO.md`).

## Copias de seguridad y tokens que vencen

Copias (`REVISION.md`, punto 13): andando desde el 5/10/2026 — workflow
«Copia de seguridad» (`supabase/respaldo/`) cada domingo al repo privado
`team-latam/registro-respaldos`, y Administración → Copia de seguridad
para bajar una.

- **`RESPALDOS_TOKEN` vence el 5/10/2027**: hay que renovarlo antes (pasos
  en `supabase/respaldo/LEEME.md`; la corrida avisa en rojo faltando 15
  días).
- **`SUPABASE_ACCESS_TOKEN`** (publica las funciones de Supabase,
  `supabase/functions/LEEME.md`) **vence el 30/9/2027**: renovarlo junto
  con el otro; si vence, las funciones siguen andando y solo falla publicar
  un cambio.

## El dominio

`team-latam.com` (el correo del equipo, y desde el 7/10/2026 el remitente
de los avisos de Resend) está en **Squarespace**
(account.squarespace.com/domains, la ex Google Domains) y **vence el
12/12/2026**, con renovación automática: confirmar antes de esa fecha que
se renovó y que la tarjeta sigue vigente. Si se cae el dominio, se cae el
correo `@team-latam.com` y con él el login del admin.

Lo que pidió el usuario sobre esto (y que sigue en `CLAUDE.md`, porque
vale en cada sesión): antes del 1/12 no mencionárselo; desde el 1/12,
recordárselo al empezar cualquier sesión y guiarlo paso a paso; el 5/12,
avisarle puntualmente (hay un recordatorio programado).

## Lo de GitHub

- Claude no puede crear repos en la cuenta `team-latam` (es una cuenta de
  usuario; la conexión de GitHub no tiene ese permiso).
- `main` está protegida contra `push --force` y contra el borrado.
