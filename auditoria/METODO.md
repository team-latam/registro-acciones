# Cómo se hace una auditoría del Registro

Una auditoría busca lo que está mal o se puede mejorar, lo explica en
palabras simples y lo ordena por prioridad. No arregla nada sola: lo que se
arregla después lleva su prueba en `pruebas/` (o `supabase/pruebas/`) para
que no vuelva.

Esto es el método fijo. Lo armó el usuario el 6/10/2026, a partir de su
pedido original («bugs, código muerto, seguridad, diseño, sobrecarga y
sobredimensionamiento de los objetos visuales, problemas estéticos, en
escritorio y celular, almacenamiento, uso de funcionalidades, y una crítica
completa del uso, con las mejoras por urgente, importante, medio, bajo y
opcional») y de lo que se fue sumando. **Queda abierto**: cada auditoría
suma lo que aprendió (ver «Cómo sumar algo nuevo», al final).

Tres principios, siempre:

- **Seguro.** Nunca contra la base ni el proyecto de verdad: todo corre
  contra el Supabase de mentira (`pruebas/app_de_mentira.mjs`) o una base
  descartable. Ningún dato real sale del sandbox. Las reglas fijas del
  usuario (CLAUDE.md) valen también acá.
- **Ágil.** Lo que se puede medir lo miden las herramientas; a mano queda
  solo lo que pide criterio. Una corrida rápida tarda unos 5 minutos.
- **Dinámico.** Datos al azar (con semilla, para poder repetir), todos los
  tamaños, los cuatro idiomas, claro y oscuro: lo que se repite se vuelve
  herramienta.

## Los pasos

1. **Ponerse al día.** Traer `main`. Leer `RECURRENTES.md` (lo que suele
   fallar), la última `docs/AUDITORIA.md` (qué quedó abierto y qué decidió
   el usuario: no se vuelve a proponer lo que ya descartó) y
   `conocidos.json` (lo ya revisado y aceptado).
2. **Correr las herramientas.** `./auditoria/correr.sh` (o `RAPIDO=1`).
   Deja `auditoria/salida/<fecha>/informe.md`.
3. **Verificar cada hallazgo.** Una herramienta marca candidatos, no
   verdades. Cada uno se mira en el código o en una captura. Si es un
   falso positivo: o se mejora la herramienta (lo mejor), o se anota en
   `conocidos.json` con el porqué. Nunca se reporta algo sin verificar.
4. **Revisar a mano** las áreas de abajo marcadas «a mano».
5. **Mirar la app.** Capturas de cada vista en escritorio y celular, claro
   y oscuro, y en hebreo (`pruebas/app_de_mentira.mjs` sirve para armarlas).
   Lo que se ve raro se mide.
6. **Clasificar** cada mejora (criterios abajo) y decir de quién es: Claude
   la hace, o el usuario decide.
7. **Escribir.** `docs/AUDITORIA.md` con la tabla de mejoras por prioridad
   (código, qué, por qué importa, esfuerzo, quién decide). El detalle
   técnico en `docs/auditoria/<área>.md`. La anterior pasa a
   `docs/auditoria/historial/AUDITORIA-<fecha>.md`. Y una página
   (artefacto) para el usuario, con capturas y en palabras simples.
8. **Las decisiones del usuario** se le presentan con opciones y una
   recomendación. Si está con el celular, como preguntas para tocar
   (AskUserQuestion), de a cuatro.
9. **Al arreglar** cada punto: la prueba que lo protege, verificada en rojo
   contra el código de antes; `./pruebas/correr.sh` en verde; push a
   `main`; tacharlo en `docs/AUDITORIA.md` y en la página.
10. **Al terminar**: sumar a `RECURRENTES.md` lo nuevo que se repitió, y
    convertir en herramienta lo que se pudo medir a mano.

## Las áreas

Cada una con qué se mira y quién lo mide. «Herramienta» = sale en el
informe; «a mano» = criterio de quien audita.

| Área | Qué se mira | Quién |
|---|---|---|
| **Errores (bugs)** | Errores de la página en cualquier vista; texto roto («undefined», «NaN», «{n}»); fechas corridas (UTC contra hora local); cuentas que no cierran (lo planificado contado como hecho) | `pantallas`, `datos`; a mano: la lógica |
| **Código muerto** | Funciones, ramas del despachador y clases de CSS que nadie usa; reglas que se pisan | `codigo` |
| **Seguridad** | Lo escrito por alguien que entra al HTML sin escapar; un XSS de verdad (datos envenenados en cada campo); librerías sin SRI; CSP; servicios de afuera; llaves en el repo; workflows con llaves fuera de main | `seguridad`, `datos`; a mano: `supabase/02-politicas.sql` |
| **Permisos en la base** | Cada política de `02-politicas.sql` y validación de `03-validacion.sql`: ¿un integrante puede hacer algo de admin? ¿alguien de afuera lee algo? | a mano + `supabase/pruebas/` |
| **Diseño en escritorio y celular** | Lo cortado, lo que se sale de la pantalla, la página corrida de costado, el anillo de foco cortado; cinco tamaños | `pantallas` (y `pruebas/recortes_test.mjs` en cada corrida) |
| **Sobrecarga y tamaño de los objetos** | Pantallas con demasiado; botones de más; filas que no entran; objetos sobredimensionados para lo que muestran | a mano, con capturas |
| **Estética** | Alineación, espaciado, coherencia entre vistas, modo oscuro, cómo se ve lo vacío | a mano, con capturas |
| **Idiomas** | Cuatro idiomas en cada texto; hebreo en hebreo; {marcadores} iguales; texto suelto sin t(); RTL: lo espejado y lo que asoma por la izquierda | `textos`, `pantallas` (en, pt, he) |
| **Ventanas** | role="dialog", aria-modal, nombre; el foco entra, Tab no se escapa, Escape cierra, el foco vuelve | `pantallas` |
| **Datos variados** | Títulos largos y cortos, palabras sin espacios, emojis, hebreo dentro de un texto en español, campos vacíos, formas raras de la base, mucho volumen | `datos` (semilla en el informe) |
| **Rendimiento** | Tamaño del archivo; cuánto tarda en dibujar con mucho cargado; dibujados de más | `codigo`, `datos`; a mano: red lenta |
| **Almacenamiento** | Cuánto ocupa el bucket contra el plan gratis; huérfanos; miniaturas; la papelera | a mano: Administración › Copia de seguridad, `supabase/limpieza/` |
| **Copias y restauración** | Que la copia del domingo corra; que se pueda restaurar (`docs/RESTAURAR.md`); cuándo vence el token | a mano: Actions |
| **Integraciones** | Sincronización con Calendar; workflows en verde; «¿Está arriba?» | a mano: Actions; `supabase/sync-calendar/pruebas/` |
| **GitHub** | Acciones fijadas por huella y con versión nueva (sobre todo una mayor: suele venir porque la anterior quedó vieja); avisos amarillos en las corridas («deprecated»); sintaxis (actionlint); permisos, tiempos máximos, llaves solo desde main, nada pegado en un `run:`; lo que corre solo y cuándo; Settings: Pages, permisos de Actions, escaneo de secretos | `github`, `pruebas/workflows_test.mjs`; a mano: los avisos de la última corrida y los Settings |
| **Privacidad** | Datos personales en el repo público; qué se manda a servicios de afuera; qué se guarda de cada persona y por cuánto | `seguridad`; a mano |
| **Accesibilidad** | Teclado en todo; foco visible; contraste; movimiento reducido; lectores de pantalla | `pantallas`; a mano |
| **Uso de las funciones** | Qué se usa y qué no (en los datos de la base, sin sacar datos: solo cantidades); lo que confunde; duplicados | a mano |
| **Crítica del uso** | Recorrer la app como alguien del equipo: cargar, buscar, revisar, reportar. Qué cuesta, qué sobra, qué falta | a mano |
| **Operación** | Tokens y llaves que vencen; cuotas del plan gratis; Settings de Pages; dominio (`docs/DOMINIO.md`) | a mano |

## Los niveles

- **Urgente**: se pierden o se filtran datos, alguien hace lo que no
  debería, o la app no anda para todos. Se arregla ya.
- **Importante**: afecta a cada persona en su uso diario, o es un riesgo
  real que todavía no pasó.
- **Medio**: molesta o confunde, tiene arreglo razonable.
- **Bajo**: prolijidad, cuando se toque esa parte.
- **Opcional**: decisiones de producto o mejoras que cuestan más de lo que
  dan hoy.

Un mismo hallazgo sube de nivel si se repite (ver `RECURRENTES.md`).

## Lo que se revisa a mano

- [ ] Las políticas de la base (`supabase/02-politicas.sql`) con un rol por vez: afuera, observador, integrante, admin.
- [ ] Capturas de cada vista en escritorio y celular, claro y oscuro, y en hebreo: ¿algo se ve raro, desalineado o sobrecargado?
- [ ] Sobrecarga: ¿qué pantalla tiene más de lo que se usa? ¿Qué botón sobra?
- [ ] La crítica del uso: cargar un evento, una rutina, buscar algo viejo, armar un reporte, revisar lo de Calendar.
- [ ] Almacenamiento: el medidor del bucket y la última limpieza.
- [ ] Las corridas de Actions: copia del domingo, Calendar, «¿Está arriba?», «Base de datos». Y los avisos amarillos (*annotations*) de la última de cada una: ahí GitHub avisa lo que va a dejar de andar.
- [ ] Settings de GitHub (los mira el usuario, con los pasos): Pages → Source en «GitHub Actions»; Actions → Workflow permissions en «Read»; Code security → Secret scanning y Push protection prendidos.
- [ ] Lo que vence: el token de las copias (5/10/2027) y cualquier llave nueva.
- [ ] Privacidad: ¿algo nuevo manda datos afuera o guarda algo de las personas?
- [ ] Lo que quedó abierto en la auditoría anterior y lo que el usuario decidió.

## Cómo sumar algo nuevo

- **Algo que se repitió** → una entrada en `RECURRENTES.md` (síntoma,
  causa, cómo se detecta, regla para evitarlo).
- **Algo que se pudo medir** → a la herramienta que corresponda en
  `herramientas/`, o una nueva (devuelve hallazgos con `hallazgo()` y los
  entrega con `entregar()`, ver `comun.mjs`), y una línea en `correr.sh`.
- **Algo que ya se revisó y está bien** → `conocidos.json`, con el porqué.
- **Un área nueva** → una fila en la tabla de arriba.
- **Lo que se arregló** → una prueba en `pruebas/` que falle sin el arreglo.
