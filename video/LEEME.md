# El video de presentación — cómo se hizo y cómo se rehace

Un video de ~74 segundos, en inglés, sin voz y con música, para mostrarle el
sistema a los jefes. Hay dos versiones: **celular** (vertical, 1080×1920) y
**compu** (horizontal, 1920×1080). La versión final es la **v5**, que el usuario
aprobó el 13/10/2026 («Listo, está perfecto. Esta es la versión final»).

**Los MP4 no están en el repo** (pesan ~10 MB cada uno y el repo es público): el
usuario los tiene. Lo que sí está acá es la receta completa para rehacerlos —
y para rehacerlos *distintos* cuando la app cambie.

## Rehacerlo (un solo comando)

```
bash video/hacer_video.sh          # celular y compu
bash video/hacer_video.sh celu     # solo uno
```

Tarda unos 11 minutos (la grabación es en tiempo real) y deja todo en `video/salida/` (no se versiona):
`registro-acciones_celu.mp4` y `registro-acciones_compu.mp4`.

- Hace falta lo mismo que `./pruebas/correr.sh` (Node 22 + Playwright; en el
  sandbox ya están, **no** correr `playwright install`), más `ffmpeg`, `python3`
  con `numpy` y la tipografía **Inter** (`fc-list | grep "Inter Display"`).
- **La grabación va en tiempo real:** mientras corre, no ejecutar nada pesado
  (por ejemplo `./pruebas/correr.sh`). Si la máquina se atrasa, el video sale con
  tirones. Un video con tirones se nota enseguida: mirar las imágenes antes de
  entregarlo.
- Para probar una sola escena: `SOLO=reportes node capturar.mjs celu` (desde
  `video/salida/`; los nombres de las escenas están abajo).

## Qué hace cada pieza

| Archivo | Para qué |
|---|---|
| `datos_demo.mjs` | El equipo, los lugares, los eventos y la Agenda **inventados** (gente `@team-demo.org`, teléfonos 555, fotos dibujadas). Fecha fija: **12/10/2026, mediodía**. Nada es de la base real. |
| `comun.mjs` | Abre la app de mentira (`pruebas/app_de_mentira.mjs`) como «Daniel Rosen», en inglés, con la fecha fija, las fotos de mentira y el servicio de traducción de mentira (MyMemory contesta con la traducción al hebreo). |
| `capturar.mjs` | **El guion de las escenas.** Maneja la app (toques, escritura, desplazamientos) y la graba cuadro a cuadro a resolución completa. Dibuja un círculo en cada toque (celular) o un cursor (compu). |
| `piezas.mjs` | Los carteles de texto (los **textos del video están acá**, en `CAPS`), el marco del celular, los fondos y las tarjetas de título y final. |
| `armar.mjs` | Junta todo con ffmpeg: ajusta la velocidad si no entra en el tope, pone marco y carteles, tarjeta de título y final. Escribe `grab_*/fin.txt` con la duración total y el segundo en que entra la tarjeta final. |
| `musica/dsp.py`, `musica/pista.py` | Sintetizan la música (original, con numpy; no usa audio de nadie) para la duración exacta del video. |
| `musica/pulir.sh` | Filtros y volumen parejo (−16 LUFS). `musica/medir.py` mide una pista (volumen y balance de graves/medios/agudos). |
| `hacer_video.sh` | Los encadena en orden y le pone la música al video. |

## Las escenas (en orden) y los carteles

Duraciones nominales de `capturar.mjs`; cada escena se rellena hasta su duración
(`escena(nombre, segundos, fn)`) y la real queda en `marcas.json`.

| Escena | s | Qué se ve | Cartel |
|---|---|---|---|
| `home` | 10 | Escribir una acción y compartirla con el equipo | «Every action, shared with the team.» |
| `crear` | 13,5 | Crear un evento con fecha, lugar y personas | «Plan events with date, place and people.» + «Synced to the team’s Google Calendar» |
| `paises` | 5,8 | Los países de un vistazo | «Every country at a glance.» |
| `agenda` | 8 | La Agenda: personas e instituciones | «A shared directory of people and organizations.» |
| `calendario` | 5 | Calendario compartido | «One shared calendar.» |
| `proyectos` | 5 | Un evento hecho proyecto | «Turn any event into a project.» |
| `reportes` | 8,8 | Reportes y elegir un mes | «Reports that answer: how are we doing?» + «Tap any month to open its card» |
| `novedades` | 3,5 | Menciones y respuestas | «Mentions, replies and updates, as they happen.» |
| `hebreo` | 4 | La pantalla entera se espeja en hebreo | «In Hebrew, the whole screen flips.» |
| `traduccion` | 5,3 | «Ver traducción» de un post en español, leído en hebreo | «Any post, in your language, with one tap.» + «Written in Spanish, read in Hebrew» |

Tarjeta de título: «Action Log» / «The team’s work, made visible.» / «TEAM LATAM».
Tarjeta final: «Everything you need to fulfill your mission, in one place.» /
«Action Log · Team LatAm».

## Lo que el usuario pidió — decisiones que no hay que deshacer

- **Inglés, sin voz, con música** «profesional y agradable». Para los jefes.
  Celular (el principal) y compu.
- **Hasta 74 segundos** (empezó pidiendo 60; después aceptó 70 y 74). `TOPE` en
  `armar.mjs`. Si lo grabado no entra, se acelera parejo todo el video (la compu
  sale ~4 % más rápida); si entra, no se toca la velocidad.
- **Sin fundidos ni disolvencias entre pantallas.** «Cuando desaparece y aparece
  de nuevo no se ve el flujo del sistema»: el cambio de pantalla tiene que ser el
  de la propia app, con el círculo del toque visible un instante *antes* de que
  responda (`tocar(..., {previo})`). Solo hay fundido al entrar y al salir del
  video (`CON_FUNDIDOS = false` en `armar.mjs`).
- **Ritmo calmado:** las escenas respiran; elegir un mes en Reportes se hace
  despacio y con un cartel que lo explica.
- El primer mensaje es sobre **acciones compartidas con el equipo** (no «log your
  day in one line»), y se muestra la **Agenda**.
- Hebreo: **solo hebreo** (sin portugués ni inglés al lado), sin aclaraciones
  entre paréntesis ni «right to left», y después **una traducción de un post**
  con un toque.
- **Sin** la línea «Google Calendar sync…» al final.
- **La música cierra bien:** una cadencia (Mi♭ – Fa – Re → Sol menor) que cae
  justo cuando entra la tarjeta final, y el último acorde se apaga solo hasta el
  último cuadro. Por eso la música se genera *después* de armar el video, con su
  `total` y su `fin` exactos (`fin.txt`).
- La música es **original**: el usuario pasó un tema como referencia de estilo
  (Sol menor, ~114 BPM, bajo pulsante, empieza oscura y se va abriendo, cambio
  fuerte hacia el segundo 44) y pidió «algo similar», no su audio.

## Cuando la app cambie — qué revisar antes de rehacerlo

1. **Correr el video y mirar las imágenes** (`ffmpeg -ss 12 -i … -frames:v 1`, o
   una hoja de contactos con `montage`). `capturar.mjs` busca elementos por
   selector y, si la app cambió, una escena puede quedar vacía o trabada sin
   dar error. Los selectores que usa: `[data-action="new-evento"]`, `#fabMain`,
   `#cTitle`, `#cPlaceQuery`, `#cParticipantQuery`, `pick-place`,
   `pick-participant`, `#rutinaContent`, `#rutinaPublish`,
   `#postModalOverlay`, `drill-country`, `agenda-abrir` / `agenda-ver-persona` /
   `agenda-cerrar`, `cal-open`, `[data-mes=…]`, `set-lang`, `[data-id="rs1"]`
   (el botón «Ver traducción»).
2. **Los datos de mentira** (`datos_demo.mjs`) usan `BASE`, `post`, `ciudad` de
   `pruebas/app_de_mentira.mjs`. Si cambia el esquema de datos, las pruebas ya
   obligan a actualizar ese archivo; revisar que la demo siga viéndose bien.
3. **Los textos del video** (`CAPS` en `piezas.mjs`) cuentan lo que la app hace
   *hoy*: sumar o sacar escenas si cambió una pantalla grande. Es la misma idea
   del recorrido de bienvenida (`tourSteps()`, ver `CLAUDE.md`): si el recorrido
   se reescribe, revisar si el video sigue contando lo mismo.
4. Al editar `piezas.mjs` hay que **volver a correr `piezas.mjs`** (los carteles
   son PNG): `hacer_video.sh` ya lo hace siempre; si se arma a mano, no olvidarlo
   (una vez el video salió con el cartel viejo por esto).
5. Para otro idioma (la primera versión es en inglés): cambiar `lang: "en"` en
   `comun.mjs`, los textos de `CAPS` y las tarjetas, y la traducción de mentira
   (`TRADUCCIONES` en `datos_demo.mjs`). La música no cambia.

## Reglas que valen siempre

- **Los datos de la demo son inventados.** Nunca poner en el video ni en estos
  archivos nombres, teléfonos ni fotos reales, y **nunca el Excel del Mapeo de
  comunidades** (ver `CLAUDE.md`).
- Si no hay sonido o una pista suena rara, no se puede «escuchar» desde acá:
  se comprueba con `musica/medir.py` (volumen, balance de graves/medios/agudos) y
  se pide que el usuario la escuche. Nunca decir que «suena bien» sin eso.
- Los servicios de música gratuita (archive.org y similares) no se pueden bajar
  desde este entorno; por eso la música se sintetiza.

## Cómo se hizo (la historia corta)

Se arrancó con un guion en una página con capturas (aprobado por el usuario), una
demo corta, y después cinco versiones con sus comentarios (ritmo, Agenda, hebreo,
traducción, final, transiciones) hasta la v5. Cuatro pistas de música de prueba
(pop, cinematográfica, electrónica, acústica) para elegir en una página donde
escucharlas; el usuario eligió la electrónica y pidió una similar a su tema de
referencia. Todo lo que cambió entre versiones está en las decisiones de arriba.
