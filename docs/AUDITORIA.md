# Auditoría de la Agenda — 9 de octubre de 2026

> Las anteriores están en `docs/auditoria/historial/`: la completa del
> 6/10/2026 (`AUDITORIA-2026-10-06.md`; los códigos U, I, M, B y O que
> citan el código y los commits son de esa) y la de lo nuevo del 7/10/2026
> (`AUDITORIA-2026-10-07.md`; códigos C, E, P y G). Los de esta van con
> **A**. El método: `auditoria/METODO.md`.

Pedido del usuario, después de probar la Agenda en el celular: «hay
cuestiones que hay que ajustar de diseño, de cómo se abren las ventanas,
de que se abre directamente el teclado cuando es la versión de teléfono.
Quiero que hagas una revisión completa de todo eso para poder tener una
buena funcionalidad».

El detalle de cada hallazgo (cómo se midió, el arreglo) está en
`docs/auditoria/2026-10-09-agenda.md`. La página para el usuario, con capturas
de antes y ahora: https://claude.ai/artifact/CTFYVdZVsYzrsHbQcKUngw
(privada).

**Cómo se hizo.** Sobre `4e43ab3` de `main`. Primero se le enseñó la
Agenda a las herramientas de la auditoría, que no la miraban (datos en la
app de mentira, sus pasos en el recorrido, sus cuatro ventanas, y una
comprobación nueva para **todas** las ventanas: que en el celular no abran
el teclado solas). La auditoría completa: 2.053 comprobaciones de la app,
Calendar, copias y las 470 de la base; pantallas en 12 combinaciones de
tamaño, idioma y oscuro; datos variados con dos semillas (hasta 400
instituciones con nombres raros y HTML metido en cada campo). Y capturas
de cada paso de la Agenda en compu y celular, claro y oscuro, y hebreo,
midiendo el tamaño de la ventana y dónde queda el foco.

---

## En una página

**Lo que molestaba en el celular era real, y había más:**

1. **Se abría el teclado solo** al abrir la Agenda (y en «Otra
   institución», «Limpiar» y «Es esta»), tapando media ventana. La app ya
   tenía la regla de no hacerlo; la Agenda no la siguió.
2. **La ventana cambiaba de tamaño y de lugar con cada paso.** En la
   compu, la lista de 1040 px y una ficha de 620, cada una a otra altura;
   en el celular, la lista en pantalla completa y una ficha como una
   tarjeta flotando sobre la página.
3. **«+ Sumar» elegía sola la primera institución** de la lista: se podía
   guardar a alguien en otra institución sin darse cuenta.
4. **La Agenda vacía** mostraba todo en cero; en el celular había cuatro
   renglones de botones antes del primer contacto; y en hebreo una ciudad
   de una palabra larguísima se salía de la pantalla.

**Todo eso ya está arreglado**, con 43 comprobaciones nuevas
(`pruebas/agenda_ventanas_test.mjs`) que fallan con el código de antes.
Lo que queda es del usuario: **probarlo en su teléfono** (el teclado de
verdad no se puede simular).

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide.

### Urgente

Nada.

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| A1 | ~~En el celular, al abrir la Agenda se abre el teclado solo (el foco cae en el buscador; también en «Otra institución», «Limpiar», «Es esta»)~~ ✅ 9/10 (en pantalla táctil el foco entra por «Volver» o la ✕; en la compu sigue al buscador) | tapa media ventana antes de que se decida hacer algo; cada vez que se abre | Claude |
| A2 | ~~La ventana cambia de tamaño y de lugar con cada paso~~ ✅ 9/10 (el tamaño lo decide cómo se abrió: con «📇 Agenda», grande para todo, con la ficha a dos columnas y el formulario centrado; desde un lugar o «Buscar en todo», chica y colgada de arriba; en el celular, siempre pantalla completa) | se ve inestable; en el celular, una ficha flotando sobre la página con la barra de abajo asomando | Claude |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| A3 | ~~«+ Sumar» desde la lista elige sola la primera institución~~ ✅ 9/10 (si hay una sola a la vista, esa; si no, «Elegí la institución…», y no guarda sin elegir) | alguien queda guardado en otra institución sin que nadie lo note | Claude |
| A4 | ~~La Agenda vacía muestra buscador, filtros y «0 instituciones y 0 contactos en 0 ciudades de 0 países»~~ ✅ 9/10 (qué es y cómo se empieza) | la primera impresión, antes de traer la lista | Claude |
| A5 | ~~En el celular, cuatro renglones de controles antes del primer contacto~~ ✅ 9/10 («+ Sumar» al lado del título, la planilla al final, sin el resumen repetido) | el primer contacto queda a media pantalla | Claude |
| A6 | ~~En hebreo, una ciudad de una sola palabra larguísima se sale de la pantalla~~ ✅ 9/10 | corre la página de costado (ya estaba en RECURRENTES) | Claude |

### Bajo

| # | Qué | Quién |
|---|---|---|
| A7 | ~~En hebreo, la raya de un dato vacío del lado contrario~~ ✅ 9/10 | Claude |
| A8 | ~~En el celular, las acciones de una persona en dos renglones~~ ✅ 9/10 («Copiar») | Claude |
| A9 | ~~Abierta desde «Buscar en todo», al cerrar el foco se pierde~~ ✅ 9/10 (vuelve al buscador) | Claude |
| A10 | ~~El ejemplo de correo, en español en los cuatro idiomas~~ ✅ 9/10 | Claude |
| A11 | ~~Tres clases de CSS que ya no usa nada (de tandas anteriores)~~ ✅ 9/10 | Claude |
| A16 | ~~En la tarjeta «Contactos en …» de la compu, el teléfono baja de renglón y deja un «·» colgando~~ ✅ 9/10 | Claude |
| A17 | `actions/setup-node` tiene la 7.1.0 (de antes, no de la Agenda) | Claude, cuando se toquen los workflows |

### Herramientas y pruebas

| # | Qué | Quién |
|---|---|---|
| A12 | ~~La auditoría no miraba la Agenda, ni revisaba si una ventana abre el teclado en el celular~~ ✅ 9/10 | Claude |
| A13 | ~~`codigo` contaba como «sin quién lo atienda» los 33 botones de la Agenda~~ ✅ 9/10 | Claude |
| A14 | ~~En el celular, el recorrido no llegaba a la ficha de una ciudad (la tarjeta «Ciudades» viene plegada) y seguía sin decirlo~~ ✅ 9/10 | Claude |
| A15 | ~~`ficha_celular_test` contaba las ciudades sumando las de la tarjeta de contactos~~ ✅ 9/10 | Claude |

### Para el usuario

| # | Qué | Quién |
|---|---|---|
| A18 | **Probarlo en el teléfono**: abrir la Agenda (no tiene que aparecer el teclado), tocar una persona, volver, «+ Sumar»; y desde la ficha de una ciudad, tocar a alguien de «Contactos en …». En un iPhone y en un Android si se puede | **usuario** |

---

## Lo que sigue abierto de las anteriores

De la del 7/10 (ver `historial/AUDITORIA-2026-10-07.md`): E8, P7, P8 y
P12 (bajos, cuando se toque); P13, E10 y E11 (opcionales). De la del
6/10: I7 (ensayar una restauración completa), M3 (clasificar lo de
Calendar), M4, B3, O1–O6 y la confirmación 6 (probar en un iPhone y un
Android de verdad, que ahora suma la Agenda: A18).

## Lo que está bien y conviene no tocar

- **Las ventanas de la Agenda** se anuncian como ventana, el foco entra,
  Tab no se escapa, Escape vuelve de a un paso y al final la cierra, y el
  foco vuelve al botón que la abrió.
- **Con HTML metido** en cada campo de 400 instituciones y 320 personas,
  no se ejecutó ni se coló nada en ninguna vista.
- **Los permisos** (`19-agenda.sql`): quien observa lee pero no escribe;
  sumar y corregir, quien carga eventos; borrar una institución y traer
  una lista, un admin; nadie de afuera lee nada.
- **Los teléfonos** viven en la base y en la copia privada del domingo;
  en el repositorio público solo hay números inventados.
