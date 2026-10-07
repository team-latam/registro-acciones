# Auditoría de lo nuevo — 7 de octubre de 2026

> La auditoría completa anterior (6/10/2026) está en
> `docs/auditoria/historial/AUDITORIA-2026-10-06.md`. **Los códigos U1–U5,
> I1–I10, M1–M13, B1–B10 y O1–O8 que citan el código y los commits son de
> esa.** Los de esta van con otra letra: C (correos), E (entrada y
> calendario), P (personas sin cuenta) y G (herramientas y GitHub).
> El método: `auditoria/METODO.md`.

Pedido del usuario: «revisar lo nuevo» desde la auditoría del 6/10, que
es lo que se sumó después: **los avisos por correo** (Resend, la función
`avisar`, los resúmenes, `16-` y `17-*.sql`), **la entrada con el botón
de Google de la página** (sin pasar por supabase.co), **el calendario
leído con la cuenta de servicio** y **las personas sin cuenta**
(`18-personas.sql`). Y arreglar lo que se encontrara.

El detalle de cada hallazgo (archivo, cómo se dispara, el arreglo) está en
`docs/auditoria/2026-10-07-lo-nuevo.md`.

**Cómo se hizo.** Sobre `fcd8082` de `main`. Las herramientas
(`auditoria/correr.sh`, completa): 1.752 comprobaciones de la app en
verde, Calendar y copias en verde; pantallas en 12 combinaciones de
tamaño, idioma y modo oscuro sin nada cortado ni texto roto; 1.500 y 800
posteos al azar sin errores (el Inicio se dibuja en 35 ms). Tres
revisiones a mano en paralelo (correos; entrada y calendario; personas),
con cada hallazgo reproducido en una base Postgres aparte o en la app
con el Supabase de mentira. Y capturas de las pantallas nuevas en
escritorio, celular, hebreo y oscuro.

---

## En una página

**Lo nuevo está bien armado**: nada se decide en el navegador, todo texto
llega escapado (con HTML metido en cada campo no se ejecutó nada en
ninguna pantalla), la función de los correos nunca acepta destinatarios
ni texto del que la llama, y las de Google guardan bien sus llaves.

Lo que se encontró, y ya está arreglado:

1. **Un observador podía leer el Google Calendar entero** (desde 2019, con
   los correos de los invitados y los links de Meet) llamando a la función
   `calendario` desde la consola, aunque la app nunca se lo muestra. Ahora
   la función atiende solo a quien puede escribir y devuelve solo los
   campos que la app usa.
2. **Cualquiera que pidiera entrar podía ver los correos de los admins**:
   la base se los devolvía a quien llamaba. Ahora devuelve un número de
   turno y lo demás lo lee la función con la llave del servidor.
3. **El resumen diario o semanal se perdía** si GitHub atrasaba la corrida
   de esa hora (pasa seguido con los trabajos que corren solos). Ahora
   llega en la primera corrida después de la hora elegida.
4. **Un aviso al momento que fallaba no llegaba nunca.** Ahora va al
   resumen. Y hay un tope por persona: 30 comentarios ya no son 30 correos.
5. **Personas sin cuenta**: el filtro de Reportes por una de ellas daba
   siempre vacío; al aprobar a alguien, su historial se juntaba con una
   ficha aunque el admin hubiera dicho «No es»; «Editar» en Revisar lo de
   Calendar convertía a alguien del equipo en una ficha nueva y lo sacaba
   del evento; y las fichas contaban como hechas las actividades que
   todavía no pasaron.
6. **La entrada con Google**: si la ventanita de Google no se abría, no
   quedaba otra forma de entrar; y al cambiar el idioma de la portada, la
   entrada directa fallaba y se terminaba yendo por supabase.co.
7. **La publicación del sitio se colgó 20 minutos** una vez bajando
   paquetes de Ubuntu para las pruebas. Ahora espera un tiempo máximo y
   reintenta sola.

Las tres decisiones sobre los correos ya están tomadas (7/10): cada uno
los recibe **en su idioma** y el resumen **a su hora** (hechas), y las
respuestas **siguen llegándole a Benny**. Quedan cuatro cosas chicas,
anotadas abajo.

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| E1 | ~~Un observador lee el Calendar entero, con invitados, por la función `calendario`~~ ✅ 7/10 (solo quien puede escribir; solo los campos que usa la app) | correos y datos de terceros a la vista de quien la app decidió no compartirle el calendario | Claude |
| C1 | ~~El resumen se pierde si la corrida de esa hora se atrasa o falla~~ ✅ 7/10 (toca hasta 12 h después en el diario y 48 h en el semanal, y lee desde el último que salió) | un día o una semana sin resumen, sin que nadie se entere | Claude |
| C2 | ~~Un aviso al momento que falla no llega nunca~~ ✅ 7/10 (se borra su marca y llega en el resumen; ante un 429 de Resend se reintenta) | se pierden menciones y respuestas en silencio | Claude |
| P1 | ~~El filtro de Reportes por una persona sin cuenta da vacío~~ ✅ 7/10 | el reporte dice «no hay nada» de alguien con actividades | Claude |
| P2 | ~~Al aprobar, el historial de una ficha pasa a la cuenta nueva aunque el admin dijo «No es»~~ ✅ 7/10 | no se deshace sin una copia; y el correo de la ficha lo puede escribir quien la creó | Claude |
| P3 | ~~«Editar» en Revisar lo de Calendar saca a alguien del equipo del evento y crea una ficha con su nombre~~ ✅ 7/10 | se pierde gente de los eventos y aparecen fichas basura | Claude |
| E2 | ~~El plan del dominio propio dice que `index.html` no nombra `github.io`, y hoy dos listas lo nombran~~ ✅ 7/10 (`docs/DOMINIO.md`, paso 4) | mudarse siguiendo el plan dejaba sin calendario ni avisos | Claude |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| C4 | ~~Quien pide entrar ve, llamando a la base, los correos de los admins (y un integrante, a quién le llegan avisos)~~ ✅ 7/10 (la base devuelve un turno; lo lee la función con la llave de servicio) | datos de otros a la vista | Claude |
| C3 | ~~Sin tope de avisos por persona, y el nombre del correo es la firma del posteo~~ ✅ 7/10 (30 por hora por autor; el nombre sale de su cuenta) | un integrante agota los 100 correos del día; un correo «de Benny (admin)» que no es de Benny | Claude |
| C5 | ~~Los correos salen siempre en español, sin derecha a izquierda para el hebreo~~ ✅ 7/10: el usuario eligió **A**, cada uno en el idioma que eligió en la app (español, inglés, portugués o hebreo, este de derecha a izquierda); lo que escribió alguien va con `dir="auto"` | a la gente de Israel le llegaban en español, y un comentario en hebreo se desordenaba | usuario → Claude |
| C6 | ~~Las horas del resumen son de Argentina: en Israel, la más temprana es la 1 de la tarde~~ ✅ 7/10: el usuario eligió **A**, cada uno elige la hora en SU hora (la zona del aparato, que la app guarda) | el resumen «de la mañana» no existía para ellos | usuario → Claude |
| C7 | Responder cualquier aviso le llega a Benny (el `reply_to`) — el usuario eligió **C**, dejarlo como está (7/10) | quien contesta una mención le escribe a Benny | usuario |
| E3 | ~~Si la ventanita de Google no se abre, no queda otra forma de entrar~~ ✅ 7/10 («¿No se abre? Entrar de otra forma») | la portada con un solo botón que no anda | Claude |
| E4 | ~~Cambiar el ID del calendario sin compartírselo a la cuenta de la app corta la lectura, y el error dice «Not Found»~~ ✅ 7/10 (la ayuda lo dice, y el error con palabras) | nadie entiende por qué dejó de sincronizar | Claude |
| P4 | ~~Un nombre larguísimo en Participantes se sale del formulario y esconde la ✕~~ ✅ 7/10 | no se puede sacar | Claude |
| P5 | ~~Se puede borrar una ficha que está en un evento (cancelado), y quien la creó la sigue tocando aunque sea observador o ya no esté~~ ✅ 7/10 (la base no lo deja) | eventos apuntando a nadie («?» en Reportes) | Claude |
| P6 | ~~Lo que todavía no pasó cuenta como hecho~~ ✅ 7/10 («1 actividad · 1 por venir»; «Quiénes trabajaron acá» solo lo pasado) | ya estaba en RECURRENTES: volvió a pasar | Claude |
| G1 | ~~«Publicar el sitio» se colgó 20 minutos bajando paquetes~~ ✅ 7/10 (tope de 6 minutos por intento, tres intentos, apt se rinde a los 30 s) | una publicación que tarda media hora y hay que repetir a mano | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| C8 | ~~El correo de prueba deja mandar uno cada 10 minutos (144 por día, más que el plan gratis)~~ ✅ 7/10 (uno por hora, tres por día) | Claude |
| C9 | ~~Lo enviado queda guardado para siempre~~ ✅ 7/10 (se borra a los 30 días) | Claude |
| C10 | ~~Rechazado con la pantalla abierta y vuelto a pedir sin recargar, al admin no le llega aviso~~ ✅ 7/10 | Claude |
| C11 | ~~Asunto con saltos de línea; sin pausa entre correos (Resend da 2 por segundo); comentarios viejos~~ ✅ 7/10 | Claude |
| E5 | ~~El nonce cambia en cada redibujado de la portada~~ ✅ 7/10 (reproducido: con el idioma cambiado, la entrada directa fallaba) | Claude |
| E6, E7 | ~~Mensaje viejo en `funciones.yml`; `docs/QUE-GUARDAR.md` sin las dependencias nuevas (Client IDs y nonce en Supabase, orígenes, cuenta de servicio)~~ ✅ 7/10 | Claude |
| E8 | La foto propia (de su cuenta de Google) se muestra sin pasar por `fotoSegura`. Está escapada y la CSP la limita: solo se afecta uno mismo | Claude, cuando se toque |
| P7 | «Dar acceso por adelantado» no vincula la ficha que tiene ese correo (sí lo hace aprobar un pedido) | Claude, cuando se toque |
| P8 | Unir, vincular, borrar o renombrar una ficha no queda en el registro de actividad | Claude, cuando se toque |
| P9–P11 | ~~Vincular con otras mayúsculas dejaba a la persona dos veces; unir y vincular reordenaban los participantes; «João» y «Joao» eran dos fichas~~ ✅ 7/10 | Claude |
| P12 | Dos fichas con el mismo correo: solo se vincula la primera; y dos personas cargando el mismo nombre a la vez pueden duplicarlo | Claude, cuando se toque |
| G2–G5 | ~~La herramienta de capturas no llegaba a Personas › Sin cuenta ni a Correos (la «ficha persona» era la copia de seguridad); la de seguridad se marcaba a sí misma como «llave secreta»; dos textos de ejemplo en español en los cuatro idiomas; correos con pinta real en las pruebas SQL; la base local del sandbox sin armar (la auditoría corría sin pruebas SQL sin decirlo)~~ ✅ 7/10 | Claude |

### Opcional

| # | Qué | Quién |
|---|---|---|
| P13 | El correo de una persona sin cuenta (alguien de afuera) lo lee cualquier aprobado, observadores incluidos. Se podría limitar a los admins y a quien la creó | **usuario** |
| E10 | La función `calendario` no tiene tope de llamadas: alguien del equipo llamándola en bucle podría gastar la cuota de la cuenta de servicio | Claude, si hace falta |
| E11 | La CSP habilita todo `accounts.google.com`; Google recomienda solo `/gsi/…`. Con `'unsafe-inline'` presente, cambia poco | Claude, si hace falta |

---

## Lo que quedó abierto de la del 6/10

- **I7** — Ensayar una restauración completa en un proyecto de Supabase
  aparte (el **usuario** crea el proyecto gratis; Claude hace el resto).
- **M3** — Clasificar lo que vino de Google Calendar (Administración ›
  Revisar lo de Calendar): tiempo del **usuario**.
- **M4** (el resto) — Un solo buscador en escritorio.
- **B3** — Las funciones de más de 100 líneas, cuando se toquen.
- **O1** (dominio propio; ahora con `team-latam.com` ya en Squarespace),
  **O2** (escribir en Calendar con la cuenta de servicio), **O4**
  (instalable en el celular), **O5–O6** (publicar más liviano).
- Confirmación 6 — Probar en un iPhone y un Android de verdad: + ›
  «Nuevo posteo» con el teclado abierto, y una foto desde la cámara.

## Lo que está bien y conviene no tocar

- **La función `avisar`** toma del pedido solo `tipo` e `id`: a quién y
  qué decir lo decide la base. No se puede usar para escribirle a nadie
  de afuera. Dos pestañas o un reintento no duplican avisos.
- **El login con Google**: el nonce es de 32 bytes al azar, a Google va su
  huella y a Supabase el original; la app no decodifica ni confía en el
  token: lo valida Supabase, y la base vuelve a exigir la identidad de
  Google.
- **La cuenta de servicio**: la llave nunca se imprime ni vuelve en un
  error; el permiso de Google se guarda hasta un minuto antes de vencer;
  solo dos pedidos posibles, siempre del calendario del equipo.
- **Personas sin cuenta**: afuera, pendiente, rechazado y ex integrante no
  leen ni crean fichas; unir y vincular son solo de un admin, con
  `search_path` fijo; el sincronizador nocturno no toca los participantes;
  la copia y la restauración conservan ids y fechas.
- **Los workflows nuevos** (`resumenes.yml`, `funciones.yml`): permisos
  de solo lectura, acciones por huella, llaves solo desde `main`, nada
  pegado en un `run:`, y en los registros públicos solo cantidades.
