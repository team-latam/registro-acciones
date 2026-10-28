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

**Nada urgente.** La base, la app y las copias están bien. No hay datos de
personas nuevos en el repositorio. Lo que apareció está en el borde de lo que
se ve al usar la app y en cómo se arma la copia del domingo.

**Lo que más pesa:**

1. **La copia del domingo se salta si su propia prueba está en rojo** (T1,
   importante). El 18/10 la prueba estaba en rojo (la tabla `problemas`, S5 de la
   anterior) y el trabajo «Copiar» figura como omitido: esa semana no hubo copia
   y nada lo avisó más que el tilde rojo. Lo decide el usuario (D14).
2. **Hebreo** (T2, medio): 105 de los 1.672 textos tienen el signo de
   puntuación del lado equivocado; lo primero que se ve, «?מה עשית היום», lo
   muestra a la derecha.
3. **Errores** (T3, T5, T6, medio): el aviso de un formulario no se anuncia ni
   lleva el foco; cuando algo falla se muestra el mensaje de la base en inglés;
   y en el celular los avisos tapan la barra de abajo.
4. **El recorrido de bienvenida no cuenta el buscador** (T4, medio): la lupa del
   celular entró el 28/10 sin su paso.

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| T1 | La copia del domingo (`respaldo.yml`: `copiar` con `needs: probar`) no arranca si la prueba de la copia falla. El 18/10 (corrida 39125062263) la prueba falló en 1 segundo, «Copiar» quedó omitido, no hubo copia ese domingo. El 11/10 y el 25/10 sí. | Una copia incompleta sirve más que ninguna; una semana sin copia sin enterarse | **usuario** (D14) |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| T2 | En hebreo, 105 de 1.672 textos con el signo al principio («?מה עשית היום», «.לא ניתן…», «…הוספת עורך/ת») o con `{dato} :texto` (31, los errores) y paréntesis invertidos (2). Un signo guardado primero se pinta en el borde derecho. | Es lo primero que ve quien usa la app en hebreo | Claude |
| T3 | El aviso de un formulario («Escribí un título.») no es `role="alert"`, el campo no lleva `aria-invalid` ni el foco, y está abajo de todo, chico | Con lector de pantalla no se oye; en el celular se pierde | Claude |
| T4 | El recorrido (`tourSteps()`) no menciona el buscador (la barra en la compu; la lupa del celular, de la tanda 104) | CLAUDE.md: lo nuevo que ve el equipo entra al recorrido en la misma tanda. Un olvido de la tanda 104 | Claude |
| T5 | Los errores muestran el mensaje de la base sin traducir: «Failed to fetch», «new row violates row-level security policy for table "posts"». La carga inicial fallida muestra el cartel con «(Failed to fetch)» y el reloj de arena girando, sin botón de reintentar. Sin conexión, la app no avisa hasta que algo falla | Alguien que no es técnico no sabe qué hacer | Claude |
| T6 | En el celular `.calendar-notice` (fijo, `bottom:24px`) cae sobre la barra de abajo y tapa el «+»; los de error no se van solos | Se pierden los botones mientras dura | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| T7 | Nueve campos sin nombre accesible (los 3 topes de «Adjuntos», los nombres de zonas, nombre e ícono de un tipo, el nombre de un hito, un selector y una casilla de «Mis preferencias»); los títulos saltan de h1 a h3 | Claude |
| T8 | Al cancelar el cartel de «¿Borrar…?» (Cancelar o Escape) el foco queda en el cuerpo de la página: el menú «⋯» se cerró y el botón que tenía el foco ya no existe | Claude |
| T9 | Crear un evento tocando una casilla del calendario no se alcanza con el teclado (`cal-new` en `div`); el botón «+» hace lo mismo | Se deja anotado |

### Para el usuario

| # | Qué | Recomendación |
|---|---|---|
| D14 | **¿Que la copia del domingo se haga igual si su prueba falla?** (T1) A: que copie igual y que la prueba en rojo deje la corrida en rojo para avisar. B: dejarlo como está | A |
| D15 | **¿En qué orden seguir?** Los arreglos T2 a T8 primero, o el logo propio (pendiente del repaso de diseño) | Arreglos primero |

---

## Lo que ya estaba anotado (no son hallazgos nuevos)

`diasEntre` y `csvDeTabla` sin usar (S11); 12 anchos de pantalla distintos en el
CSS; funciones largas (`crearSupabaseStore`, `renderFichaLugar`); el peso:
**581 KB comprimidos** de los 600 en los que D1 dijo volver a mirarlo.
Decidido y no se vuelve a proponer: cifrar las copias (S13), la traducción
automática con MyMemory.

## Operación (para tenerlo a la vista)

- **El peso del archivo**: 581 KB comprimidos (576 el 24/10). Faltan 19 KB
  para los 600. Cargar la página en un celular 6 veces más lento: el primer
  posteo a los 2,9 s; 4 veces más lento, 1,8 s; la compu, 0,4 s. Con 4G lento,
  la página baja en 3 s; con 3G, en 12 s la primera vez.
- **Vence**: `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN` 30/9/2027.
- **Workflows**: los programados de la semana, en verde. Las copias:
  11/10 ✓, 18/10 ✗ omitida (T1), 25/10 ✓.
- **Ramas**: `main` y la de esta sesión.

## Lo que sigue abierto de las anteriores

**R12** (el ensayo completo de restauración, cuando haya un proyecto de
prueba), **D8** (probar en el teléfono la Agenda, «+ Sumar» y una foto desde la
cámara), el pedido a GitHub de borrar las copias sueltas del 24/10 (ticket
4899727, falta su respuesta). Del repaso de diseño: **el logo propio**, con
opciones y capturas antes de cambiar nada.

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
  cortados ni desbordes; el hebreo se espeja bien (salvo T2).
- **Datos de personas**: ninguno nuevo en el repositorio (la herramienta marcó
  un correo de prueba con pinta de real, que se cambió el mismo día por uno
  inventado con `@x.com`).

## Cómo seguir

1. **Usuario**: contestar D14 y D15.
2. **Claude**: T1 según D14; T2 a T8 uno por uno (cada uno con una prueba que
   falla contra el código roto, la suite completa en verde, y —lo que depende
   del ancho— verificado con letra ancha antes de empujar), push a `main`,
   mirar que «Publicar el sitio» salga en verde y tachar acá y en la página.
3. **Al terminar**: sumar lo nuevo a `herramientas/auditoria/RECURRENTES.md` y a
   las herramientas (que `textos` vea el signo mal puesto en hebreo; que la
   prueba de accesibilidad vea un aviso sin rol).
