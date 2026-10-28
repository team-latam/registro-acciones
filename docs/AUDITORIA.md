# Auditoría completa — 28 de octubre de 2026

> Las anteriores están en `docs/informes/historial/`: la completa con
> énfasis en seguridad del 24/10/2026 (códigos S y D10–D13), la completa del
> 10/10 (R y D1–D9), la del 6/10 (U, I, M, B, O), la de lo nuevo del 7/10
> (C, E, P, G) y la de la Agenda del 9/10 (A). Los de esta van con **T**, y
> sus decisiones siguen la numeración: D14 en adelante. El método:
> `herramientas/auditoria/METODO.md`.

Pedido del usuario: una **review de todo el sistema** (empezó como una crítica
de diseño; se arreglaron la legibilidad, el celular y el Inicio en las tandas 103
y 104), y después **la auditoría completa**, sumando todo lo que no se había
revisado: la crítica del uso, el recorrido de bienvenida, el teclado y el lector
de pantalla, los flujos de borrar, de error y de carga, los cuatro idiomas, los
datos variados, el rendimiento, la seguridad, los permisos de la base, los
workflows, las copias, las integraciones, la privacidad y la operación.

El detalle de cada hallazgo (dónde, cómo se verificó) está en
`docs/informes/2026-10-28-completa.md`. La página para el usuario, en palabras
simples y con capturas: https://claude.ai/artifact/X2pEJqknBxPwLTSwDrWAzp (privada).

**Cómo se hizo.** Sobre `ed42ad9` de `main`. Las herramientas completas:
**3.969 comprobaciones de la app en 119 archivos, en verde**; Calendar, copias
y las **990 de la base**, en verde; las pantallas, 578 vistas en 13
combinaciones de tamaño, idioma, oscuro y letra ancha; datos variados con dos
semillas (800 y 1.500 posteos). A mano: el uso por tareas (compu y celular,
integrante y observador), el recorrido de bienvenida paso por paso (cinco
cuentas), el teclado y el árbol de accesibilidad de Chrome (3.307 controles en
45 vistas), los flujos de error con un Supabase de mentira al que se le pide
que rechace, que no conteste o que tarde, la velocidad con el procesador 4 y 6
veces más lento, las 45 pantallas en inglés, portugués y hebreo, una matriz de
permisos de las funciones de la base por rol en un Postgres local (persona de
afuera, observador, integrante, admin), y los 14 workflows con sus corridas de
las últimas semanas.

---

## En una página

**Nada urgente, y lo que se encontró ya está arreglado** (28/10, tanda 105).
La base, la app y las copias estaban bien. No hay datos de personas nuevos en
el repositorio. Lo que apareció estaba en el borde de lo que se ve al usar la
app y en cómo se arma la copia del domingo.

**Lo que más pesaba, y cómo quedó:**

1. **La copia del domingo se salteaba si su propia prueba estaba en rojo** (T1,
   importante). El 18/10 la prueba estaba en rojo (la tabla `problemas`, S5 de la
   anterior) y el trabajo «Copiar» figura como omitido: esa semana no hubo copia
   y nada lo avisó más que el tilde rojo. El usuario eligió (D14) que copie igual
   y avise: ✅.
2. **Hebreo** (T2, medio): 112 textos tenían el signo de puntuación o las partes
   en el orden en que se ven y no en el que se leen; lo primero que se veía,
   «?מה עשית היום», lo mostraba a la derecha. ✅
3. **Errores** (T3, T5, T6, medio): el aviso de un formulario no se anunciaba ni
   llevaba el foco; cuando algo fallaba se mostraba el mensaje de la base en
   inglés; en el celular los avisos tapaban la barra de abajo. ✅
4. **El recorrido de bienvenida no contaba el buscador** (T4, medio): la lupa del
   celular entró el 28/10 sin su paso. ✅

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| T1 | ~~La copia del domingo (`respaldo.yml`: `copiar` con `needs: probar`) no arrancaba si la prueba de la copia fallaba. El 18/10 (corrida 39125062263) la prueba falló en 1 segundo, «Copiar» quedó omitido, no hubo copia ese domingo. El 11/10 y el 25/10 sí.~~ ✅ 28/10 (D14-A): `copiar` corre con `!cancelled()` aunque la prueba haya fallado; un paso escribe en el resumen por qué la corrida quedó en rojo (por la prueba) y la copia sale igual; `workflows_test` lo exige (falla contra el workflow de antes) | Una copia incompleta sirve más que ninguna; una semana sin copia sin enterarse | **usuario** (D14) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| T2 | ~~En hebreo, 105 de 1.672 textos con el signo al principio («?מה עשית היום», «.לא ניתן…», «…הוספת עורך/ת») o con `{dato} :texto` (31, los errores) y paréntesis invertidos.~~ ✅ 28/10: eran **112** (al arreglar aparecieron 21 más escritos al revés: «(עיר) ?מה ההיקף», «{d}-לא מתקיים ב», «שימוש ב-» al final, la «ו-» de las listas de días). Todos al orden de lectura y mirados dibujados de derecha a izquierda; los trozos que siguen a otro texto («, por…», «: una está…») se dejaron a propósito. `hebreo_signos_test` (falla contra lo de antes en cinco reglas) | Es lo primero que ve quien usa la app en hebreo | Claude |
| T3 | ~~El aviso de un formulario («Escribí un título.») no era `role="alert"`, el campo no llevaba `aria-invalid` ni el foco, y estaba abajo de todo, chico~~ ✅ 28/10: todo `.form-error` es `role="alert"`; en la ventana del evento el aviso de un dato que falta (título, lugar, fecha, hora) va pegado debajo de su campo, que se pinta en rojo y se marca (`aria-invalid`, `aria-describedby`), y el cursor cae ahí, a la vista. `errores_formulario_test` | Con lector de pantalla no se oía; en el celular se perdía | Claude |
| T4 | ~~El recorrido (`tourSteps()`) no mencionaba el buscador~~ ✅ 28/10: paso «Buscar en todo» (la barra en la compu, la lupa en el celular), en los cuatro idiomas; `tour_test` lo espera y mide que el agujero caiga sobre el buscador, también con letra ancha | CLAUDE.md: lo nuevo que ve el equipo entra al recorrido en la misma tanda. Un olvido de la tanda 104 | Claude |
| T5 | ~~Los errores mostraban el mensaje de la base sin traducir («Failed to fetch», «new row violates row-level security policy…»); la carga fallida dejaba el reloj de arena sin salida; sin conexión no avisaba~~ ✅ 28/10: `detalleDeError()` dice «no hay conexión a internet», «tu cuenta no tiene permiso para hacerlo» o «venció tu sesión» en los cuatro idiomas (~50 avisos); cualquier otro error sigue mostrando lo que dijo la base; la carga fallida ofrece Reintentar y Cerrar sesión; al perderse internet, «Sin conexión…» (y «Volvió la conexión»). `errores_amables_test` | Alguien que no es técnico no sabe qué hacer | Claude |
| T6 | ~~En el celular `.calendar-notice` (fijo, `bottom:24px`) caía sobre la barra de abajo y tapaba el «+»; los de error no se van solos~~ ✅ 28/10: flota por encima (84 px del borde). `aviso_celular_test`, con letra ancha | Se perdían los botones mientras duraba | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| T7 | ~~Controles sin nombre en el árbol de accesibilidad de Chrome~~ ✅ 28/10: eran **14** (los 3 topes de «Adjuntos», las zonas, el nombre y el ícono de un tipo, el nombre de un hito, 5 selectores y 2 interruptores de «Mis preferencias»). `prefRow()` nombra el control con el título de su fila; los demás, `aria-label` o `aria-labelledby`. `arbol_accesibilidad_test` mide 45 pantallas en compu y celular. **Los títulos que saltan de h1 a h3 no se tocaron**: el CSS depende de las etiquetas (59 reglas) | Claude |
| T8 | ~~Al cancelar el cartel de «¿Borrar…?» el foco quedaba en el cuerpo de la página~~ ✅ 28/10: vuelve al «⋯» de ese posteo. `foco_confirmar_test` | Claude |
| T9 | Crear un evento tocando una casilla del calendario no se alcanza con el teclado (`cal-new` en `div`); el botón «+» hace lo mismo | Se deja anotado |
| T10 | Observado al arreglar, **sin verificar en un teléfono**: la ventana del evento cambia de alto al soltar el foco del título (la fila del lugar pasa de 81 a 98 px); en una pantalla corta el botón «Publicar» se corre bajo el dedo entre apretar y soltar y el toque no llega (reproducido con Playwright a 390×640, también con el código de antes). Probar en el teléfono junto con D8 | Claude, cuando haya un teléfono |

### Para el usuario

| # | Qué | Resultado |
|---|---|---|
| D14 | **¿Que la copia del domingo se haga igual si su prueba falla?** (T1) A: que copie igual y que la prueba en rojo deje la corrida en rojo para avisar. B: dejarlo como está | ✅ 28/10: **A** (la recomendada) |
| D15 | **¿En qué orden seguir?** Los arreglos T2 a T8 primero, o el logo propio | ✅ 28/10: **arreglos primero**; el logo queda para después, con opciones y capturas |

---

## Lo que ya estaba anotado (no son hallazgos nuevos)

`diasEntre` y `csvDeTabla` sin usar (S11); 12 anchos de pantalla distintos en el
CSS; funciones largas (`crearSupabaseStore`, `renderFichaLugar`); el peso:
**585 KB comprimidos** de los 600 en los que D1 dijo volver a mirarlo.
Decidido y no se vuelve a proponer: cifrar las copias (S13), la traducción
automática con MyMemory.

## Operación (para tenerlo a la vista)

- **El peso del archivo**: 585 KB comprimidos (576 el 24/10; 581 antes de esta
  tanda: la tanda 105 sumó 4 KB). Faltan 15 KB para los 600. Cargar la página en un celular 6 veces más
  lento: el primer posteo a los 2,3 s; 4 veces más lento, 1,5 s; la compu, 0,3 s
  (`herramientas/auditoria/herramientas/carga.mjs`). Con 4G lento, la página baja
  en 3 s; con 3G, en 12 s la primera vez.
- **Vence**: `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN` 30/9/2027.
- **Workflows**: los programados de la semana, en verde. Las copias:
  11/10 ✓, 18/10 ✗ omitida (T1), 25/10 ✓.
- **Ramas**: `main` y la de esta sesión.

## Lo que sigue abierto de las anteriores

**R12** (el ensayo completo de restauración, cuando haya un proyecto de
prueba), **D8** (probar en el teléfono la Agenda, «+ Sumar» y una foto desde la
cámara; ahora también T10), el pedido a GitHub de borrar las copias sueltas del
24/10 (ticket 4899727, falta su respuesta). Del repaso de diseño: **el logo
propio**, con opciones y capturas antes de cambiar nada.

## Lo que está bien y conviene no tocar

- **Los permisos de la base**: probados por rol, función por función y en las
  tablas sensibles; las 990 pruebas de la base, en verde.
- **Usar la app**: una rutina, 3 pasos; un evento con lugar, 6; el observador
  ve que solo mira; un integrante no ve el menú de borrar en un posteo ajeno.
- **Borrar**: confirma con el nombre y la cantidad de respuestas, «Cancelar»
  viene marcado, «Borrar» es rojo; una escritura rechazada deja el texto en el
  cuadro y nada a medias; la sesión vencida vuelve a la entrada.
- **Las ventanas**: «Nuevo evento» atrapa el foco, se cierra con Escape y
  devuelve el foco al botón que la abrió.
- **Cuatro idiomas y celular**: 578 vistas en 13 combinaciones sin textos
  cortados ni desbordes.
- **Datos de personas**: ninguno nuevo en el repositorio (la herramienta marcó
  un correo de prueba con pinta de real, que se cambió el mismo día por uno
  inventado con `@x.com`).

## Cómo quedó

Todo lo de Claude está en `main` (tanda 105 en `docs/REDISENO.md`): 4.087
comprobaciones de la app en 125 archivos, en verde antes de empujar. Se sumaron
seis pruebas (`hebreo_signos`, `errores_formulario`, `errores_amables`,
`aviso_celular`, `foco_confirmar`, `arbol_accesibilidad`; y el paso del buscador
en `tour_test`), una herramienta (`carga`), nueve patrones en
`herramientas/auditoria/RECURRENTES.md` y el método de los errores en METODO.md.
Lo que queda: T9 (anotado), T10 (probar en un teléfono) y el logo propio.
