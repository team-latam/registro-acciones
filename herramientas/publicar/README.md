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
