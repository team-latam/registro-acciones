# El lector de comprobantes

Las piezas del programa que lee los comprobantes de **Gastos** (la foto o el PDF escaneado de un ticket) y
sugiere la fecha, el total, la moneda y la tarjeta. Es [Tesseract](https://github.com/naptha/tesseract.js),
libre y gratuito, y corre **en el teléfono o la compu de quien carga**: el comprobante no sale del aparato
para leerse. Lo eligió el usuario el 15/11/2026 (opción 1 de `docs/rendicion-gastos/README.md`).

## Por qué están acá y no se traen de afuera

«Publicar el sitio» (`.github/workflows/pages.yml`) las copia junto a la página, en `lector/`, y la app las
pide de ahí. Traerlas de un servidor de afuera obligaba a confiar en dos piezas que no se pueden controlar
con una huella (el «trabajador» y el motor, que se cargan desde adentro de otro programa): si ese servidor
fuera atacado, podría correr código ajeno. Guardadas acá, cambian solo con un commit, y
`herramientas/pruebas/lector_integridad_test.mjs` controla que sean exactamente estas.

Tampoco hizo falta aflojar las reglas de seguridad de la página (la CSP de `index.html`): el motor corre en
un trabajador aparte del navegador (`worker-src 'self'`), y la página solo carga `tesseract.min.js` del
mismo sitio (`script-src 'self'`).

## Qué hay

| Archivo | De dónde sale | sha256 |
|---|---|---|
| `tesseract.min.js` | `tesseract.js@7.0.0`, `dist/` | `000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e` |
| `worker.min.js` | `tesseract.js@7.0.0`, `dist/` | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@7.0.0` | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `spa.traineddata.gz` | `@tesseract.js-data/spa@1.0.0`, `4.0.0_best_int/` | `40be52f97b5d4eb7460073dc1f94cd546b27150333c0bf854ed7e7132db6bceb` |

Pesan unos 6 MB. La primera vez que alguien lee un comprobante, su aparato baja el programa y el español
(el diccionario queda guardado en el navegador); las siguientes ya no.

Solo el motor con SIMD (lo tienen todos los navegadores desde 2023: Chrome 91, Safari 16.4, Firefox 89). En
uno más viejo el lector no arranca y la app lo dice: el gasto se completa a mano, como siempre.

Las licencias: Apache 2.0 (`LICENSE-tesseract.js.md`, `LICENSE-tesseract.js-core.txt`; lo que viene adentro
de cada `.min.js`, en su `.LICENSE.txt`) y MIT el diccionario.

## Para cambiarlas de versión

1. `npm pack tesseract.js@X tesseract.js-core@X @tesseract.js-data/spa@Y` y copiar los mismos archivos.
2. Poner las huellas nuevas en la tabla de arriba (`sha256sum`): la prueba de integridad las lee de acá.
3. Correr `herramientas/pruebas/lector_test.mjs`, que lee tickets de verdad con estas piezas.
