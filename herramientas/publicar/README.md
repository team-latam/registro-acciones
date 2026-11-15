# Lo que se hace al publicar

El sitio es `index.html` tal cual, con **una** diferencia, que se hace al
publicar (workflow «Publicar el sitio», `.github/workflows/pages.yml`) y no
en el fuente:

| | |
|---|---|
| `csp.mjs` | Pone en la política de contenido (CSP) la huella de cada script escrito en la página. Con eso el navegador corre esos dos y ningún otro: un script que se colara por un error de la app (un XSS) ya no corre. En el fuente queda `'unsafe-inline'`, para no tener que recalcular la huella en cada cambio. |

Lo prueba `herramientas/pruebas/csp_publicada_test.mjs`, con lo que sale de
acá: que la app arranca (si una huella no coincidiera, la página quedaría en
blanco para todos) y que un script colado no corre. «¿Está arriba la
página?» avisa si lo publicado deja de traer las huellas.

Se sumó en la auditoría del 24/10/2026 (`docs/AUDITORIA.md`, S2).

## `marca/` — la marca de Toldot

Los archivos del logo (SVG y PNG), sus reglas de uso y dónde está puesto en el
sistema: [`marca/README.md`](./marca/README.md). El workflow «Publicar el sitio»
copia `marca/png/toldot-correo.png` al sitio (`marca/toldot-correo.png`): los
correos lo piden por esa dirección.

## `lector/` — el lector de comprobantes de Gastos

Las piezas de Tesseract (el programa libre que lee los tickets en el aparato de quien carga) y el español:
[`lector/README.md`](./lector/README.md). «Publicar el sitio» copia la carpeta entera al sitio (`lector/`): la
app las pide de ahí y no de un servidor de afuera. `herramientas/pruebas/lector_integridad_test.mjs` controla
que sean exactamente las de su versión.
