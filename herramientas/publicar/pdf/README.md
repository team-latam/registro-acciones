# El armador de los PDF de Gastos

La pieza que arma los PDF de entrega de **Gastos** (desde el 18/11/2026, etapa 4 de
`docs/rendicion-gastos/README.md`): el de cada actividad aprobada —los comprobantes numerados, con su
sello, y la planilla al final— y el resumen de gastos por mes. Es [pdf-lib](https://pdf-lib.js.org/),
libre y gratuita, y corre **en el teléfono o la compu de quien descarga**: los comprobantes no salen del
aparato para armarse.

## Por qué está acá y no se trae de afuera

Por lo mismo que el lector de comprobantes (`../lector/README.md`): «Publicar el sitio»
(`.github/workflows/pages.yml`) la copia junto a la página, en `pdf/`, y la app la pide de ahí. Guardada
acá cambia solo con un commit, y `herramientas/pruebas/pdf_integridad_test.mjs` controla que sea
exactamente esta. La página la carga del mismo sitio (`script-src 'self'`): no hizo falta aflojar la CSP,
y la librería no usa `eval` ni crea código al vuelo.

Las letras de la planilla, el sello y el resumen no las escribe pdf-lib: la app las dibuja en el navegador
(así el hebreo sale de derecha a izquierda y con las letras del aparato) y pdf-lib pone ese dibujo como
una página más, junto a los comprobantes.

## Qué hay

| Archivo | De dónde sale | sha256 |
|---|---|---|
| `pdf-lib.min.js` | `pdf-lib@1.17.1`, `dist/` | `0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f` |

Pesa unos 510 KB y se baja recién la primera vez que alguien pide un PDF.

La licencia: MIT (`LICENSE-pdf-lib.md`). Adentro trae pako (MIT y zlib) para comprimir.

## Para cambiarla de versión

1. `npm pack pdf-lib@X` y copiar `package/dist/pdf-lib.min.js` y `package/LICENSE.md` (como `LICENSE-pdf-lib.md`).
2. Poner la huella nueva en la tabla de arriba (`sha256sum`): la prueba de integridad la lee de acá.
3. Correr `herramientas/pruebas/correr.sh gastos_pdf pdf_integridad`, que arma PDF de verdad con esta pieza.
