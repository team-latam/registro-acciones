# Lo que se hace al publicar

El sitio es `index.html`, con **dos** diferencias que se hacen al publicar
(workflow «Publicar el sitio», `.github/workflows/pages.yml`) y no en el
fuente. El fuente sigue siendo uno solo, escrito para leerse, y las pruebas lo
usan tal cual:

| | |
|---|---|
| `achicar.mjs` | Saca los espacios, saltos de línea y comentarios del JavaScript y del CSS escritos en la página: de ~2,5 MB a ~1,8 MB, y de ~755 KB a ~515 KB por la red (un tercio menos para quien abre la app con datos del celular). **No cambia ningún nombre** (la app busca cosas por su nombre) ni baja a un JavaScript más viejo; los textos y el HTML de alrededor quedan igual. Usa `esbuild`, en la versión exacta de `package-lock.json` (`npm ci` controla su huella). |
| `csp.mjs` | Pone en la política de contenido (CSP) la huella de cada script escrito en la página. Con eso el navegador corre esos dos y ningún otro: un script que se colara por un error de la app (un XSS) ya no corre. En el fuente queda `'unsafe-inline'`, para no tener que recalcular la huella en cada cambio. **Va después de `achicar.mjs`**: la huella tiene que ser la de lo que se publica. |

Se arma así: `node achicar.mjs index.html > a.html` y `node csp.mjs a.html > _sitio/index.html`.

Lo prueba `herramientas/pruebas/achicar_test.mjs`: recorre **toda** la app (compu en
español y celular en hebreo, 52 pantallas y ventanas cada uno) con el fuente y con
la achicada, y compara el texto y cómo se dibuja cada elemento; se probó que falla
si el achicado rompe el JavaScript o cambia un estilo. Y
`herramientas/pruebas/csp_publicada_test.mjs`, con lo que sale de los dos pasos:
que la app arranca (si una huella no coincidiera, la página quedaría en blanco
para todos) y que un script colado no corre. «¿Está arriba la página?» avisa si
lo publicado deja de traer las huellas.

Para correrlo a mano hace falta bajar esbuild una vez: `cd herramientas/publicar && npm ci --ignore-scripts`.

La CSP se sumó en la auditoría del 24/10/2026 (S2); achicar, en la del 20/11/2026 (D21-A,
`docs/AUDITORIA.md`).

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

## `pdf/` — el armador de los PDF de Gastos

pdf-lib, la librería libre que arma en el aparato de quien descarga el PDF de entrega de cada actividad y el
resumen por mes: [`pdf/README.md`](./pdf/README.md). «Publicar el sitio» la copia al sitio (`pdf/`), igual
que el lector, y `herramientas/pruebas/pdf_integridad_test.mjs` controla que sea exactamente la de su versión.
