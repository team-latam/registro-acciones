# La marca de Toldot

El sistema que se llamaba «Registro de Acciones» se llama **Toldot** desde el
14/11/2026 (en hebreo, **תולדות**: «generaciones», «historia de generaciones»).
Esta carpeta guarda los archivos de la marca tal como los entregó el diseño
(el paquete «Toldot-logo»), más el PNG de los correos. La app, a su vez, lleva
la marca incrustada (`marcaToldot()` y el encabezado de `index.html`): no lee
estos archivos, que sirven para todo lo demás (correos, video, presentaciones,
el día que se habilite instalar la app en el celular).

## El nombre

| Elemento | Valor |
|---|---|
| Nombre | **Toldot** (igual en español, inglés y portugués) |
| Nombre en hebreo | **תולדות** |
| Línea de abajo (qué es) | ES: Registro de Acciones · EN: Action Log · PT: Registro de Ações · HE: יומן פעולות |
| Firma | «· Team LatAm» |

«Registro de Acciones» no desapareció: es el concepto, lo que hace el sistema, y
queda como la línea de abajo del nombre. En hebreo había dos versiones («יומן
הפעילויות» en el encabezado y los correos, «יומן פעולות» en los informes); el
14/11/2026 se unificó en **«יומן פעולות»** (פעולות = acciones), a confirmar con
alguien que lea hebreo. «Memoria histórica» dejó de usarse debajo del nombre.

## Por qué este dibujo

Un árbol genealógico mínimo: un origen que se abre en dos. Toldot significa
«generaciones», y eso dibuja el logo: cada acción registrada da lugar a la
siguiente y todas quedan unidas. Los aros son las acciones y las personas que
las llevan adelante; las líneas, la continuidad entre ellas. El tronco y la rama
izquierda, en turquesa, son la historia acumulada; la rama derecha, en celeste,
lo más reciente.

## Los archivos

```
svg/
  toldot-marca-claro.svg          Marca sobre fondo claro (24 px o más)
  toldot-marca-oscuro.svg         Marca sobre petróleo / modo oscuro (24 px o más)
  toldot-marca-un-color.svg       Un solo color, para impresión
  toldot-marca-chica-claro.svg    Menos de 24 px, fondo claro
  toldot-marca-chica-oscuro.svg   Menos de 24 px, fondo oscuro
  toldot-favicon.svg              Pestaña del navegador (cuadrado petróleo)
  toldot-icono-app.svg            Ícono de app (cuadrado petróleo)
  toldot-logo-completo-claro.svg  Marca + «Toldot» + «Registro de Acciones» (texto en trazos)
  toldot-logo-completo-oscuro.svg Ídem, con fondo petróleo
png/
  toldot-favicon-16.png / -32.png
  toldot-icono-app-180.png / -512.png
  toldot-marca-claro-512.png / toldot-marca-oscuro-512.png
  toldot-logo-completo-claro.png / -oscuro.png   (para correos, PDF y video)
  toldot-correo.png                              108 px, la marca oscura del encabezado de los correos
```

Los logos completos tienen el texto convertido en trazos: no dependen de que
Montserrat esté instalada. **`png/toldot-correo.png` se publica con el sitio**
(`marca/toldot-correo.png`, ver `.github/workflows/pages.yml`): los correos lo
piden por esa dirección, porque los programas de correo no muestran SVG ni
imágenes incrustadas.

## Geometría

- Lienzo: `viewBox="0 0 64 64"`.
- Cuatro aros idénticos, centros en (11,13), (53,13), (32,24) y (30,52). Radio
  5,2, trazo 3,6.
- Tres líneas del mismo grosor que el aro (3,6), con extremos redondeados, que
  apuntan al centro de cada aro. El aro tapa la punta de la línea.
  - Rama izquierda: `M11 13C20 13 26 16 32 24` (historia)
  - Tronco: `M32 24C27 33 26 42 30 52` (historia)
  - Rama derecha: `M32 24C37 20 44 15 53 13` (reciente)
- El relleno del aro (el hueco) es **el color exacto del fondo** donde va la
  marca. Por eso en la app el hueco es una variable (`--tm-hueco`).
- Versión chica (menos de 24 px): puntos llenos de radio 8 y líneas de 7, sin hueco.

## Colores

| Rol | Fondo claro | Fondo petróleo / oscuro |
|---|---|---|
| Aros | `#0d3b3e` | `#ffffff` |
| Hueco del aro | color del fondo | color del fondo |
| Historia (tronco + rama izq.) | `#1a9fb8` | `#2fb3c9` |
| Reciente (rama der.) | `#4fc7e0` | `#8fe0ef` |
| «Toldot» | `#0d3b3e` | `#ffffff` |
| «Registro de Acciones» | `#3f6a6d` | `#a9dde8` |

Un solo color: todo en `#0a1719` sobre blanco. La tipografía es Montserrat 800
(«Toldot») y 700 en mayúsculas con espaciado amplio (la línea de abajo): la
misma que usa la app.

## Reglas de uso

1. **No espejar en hebreo.** Con la pantalla de derecha a izquierda, la marca
   queda igual (`dir="ltr"` en el SVG; ninguna regla le aplica `scaleX(-1)`).
2. Debajo de 24 px, siempre la versión chica.
3. Espacio libre alrededor: como mínimo, el diámetro de un aro.
4. No cambiar colores, proporciones ni grosores; sin sombras ni degradados.
5. El celeste (`#4fc7e0`) no se usa para texto chico sobre blanco (no alcanza contraste).
6. Accesibilidad: `role="img" aria-label="Toldot"`; si va junto al nombre
   escrito, la marca es decorativa (`aria-hidden="true"`).

## Dónde está puesta (14/11/2026)

| Lugar | Estado |
|---|---|
| Pestaña del navegador (título y ícono incrustado) | ✅ `index.html` |
| Encabezado (marca normal en la compu, chica en el celular; «Toldot» y «Registro de Acciones» debajo, sin «· Team LatAm» en el celular) | ✅ |
| Pantalla de entrada (marca de 48 px en el cuadrado de 68 px, nombre, línea y pie) | ✅ |
| Informes impresos y fichas: marca de 14 px y «Toldot · Registro de Acciones · Team LatAm» | ✅ |
| Modo «Presentar» y tarjeta «Mi año»: solo el texto («Toldot · Registro de Acciones…») | ✅ el texto; ❌ la marca dibujada |
| Planilla exportada: «Toldot - día-mes-año.xlsx» | ✅ |
| Correos: remitente y encabezado con la marca (`toldot-correo.png`) | ✅ (ver `supabase/functions/`) |
| «¿Está arriba?» busca «Toldot» en la página | ✅ |
| Video (títulos y cierre) | ❌ pendiente (`toldot-logo-completo-*.png`) |
| Dibujar la marca en la tarjeta «Mi año» (PNG) y en «Presentar» | ❌ pendiente |
| Instalar en el celular (`apple-touch-icon`, manifiesto) | ❌ si se habilita: `toldot-icono-app-180.png` y `-512.png` |
| Nombre del repositorio (`registro-acciones`) | se deja igual, para no romper enlaces |
| La ramita de olivo del «Me gusta» (logo de Sala Segura) | se deja: no se mezcla con la marca de Toldot |
| Las invitaciones de Google Calendar | siguen sin mostrar la marca (pedido previo) |
