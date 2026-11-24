# Las pruebas de la app

Todo lo que protege `index.html`: el acceso, los adjuntos, el calendario,
los permisos de cada pantalla, el adaptador de Supabase, el plegado de la
documentación. Corre solo en GitHub en cada push que toca la app.

```
./herramientas/pruebas/correr.sh
```

Desde cualquier carpeta. Primero arma las páginas de prueba y después
corre cada prueba; termina con el total, y con código 1 si falla aunque
sea una comprobación.

## La única regla

**Nada de copias a mano.** Cada prueba saca el código que prueba del
`index.html` de verdad, en cada corrida: las funciones con el extractor
(`grab.mjs` / `extractor.py`), los handlers del despachador por su nombre,
y el CSS entero. Una prueba que se escribe su propia versión de una función
prueba esa versión, no la que usa la gente — y pasa aunque la de verdad
esté rota.

No es una regla teórica. Cuando estas pruebas se mudaron al repo, tres
páginas de prueba resultaron ser copias guardadas a mediados de septiembre
que nadie regeneraba. Por suerte coincidían todavía con el código real.

Por eso las páginas de prueba (`*.html`) **no se versionan**: se arman en
cada corrida y están en `.gitignore`.

## Cómo comprobar que una prueba nueva sirve

Una prueba que no falla contra el código roto no prueba nada. Antes de dar
una por buena:

```
cp index.html /tmp/roto.html            # romper a mano lo que la prueba cuida
INDEX=/tmp/roto.html ./herramientas/pruebas/correr.sh
```

`INDEX` lo leen todos: las pruebas y los armadores.

## Qué hay

| | |
|---|---|
| `*_test.mjs` | las pruebas. Cada una termina con `N pasaron, M fallaron`. |
| `armar_*.py`, `build*.mjs` | arman las páginas de prueba desde `index.html`. |
| `grab.mjs`, `extractor.py` | el extractor, en JavaScript y en Python. Son gemelos: `extractor_test.mjs` exige que saquen exactamente lo mismo de cada declaración del archivo. |
| `carga_test.mjs` | la página entera, sin entrar, con cada uno de los enlaces que el equipo tiene guardados. |
| `app_dom_test.mjs` | la app entera con la sesión iniciada, en un Chromium de verdad, con un Supabase de mentira: el admin, un integrante y alguien nuevo la usan como de verdad. |
| `workflows_test.mjs` | los workflows de GitHub, no la app: acciones fijadas por huella y en versiones vigentes, permisos, tiempo máximo, llaves solo desde main, nada que escribe una persona pegado en un `run:`. `WORKFLOWS=/otra/carpeta` la corre contra una copia. |
| `lector_test.mjs` | el lector de comprobantes de Gastos leyendo tickets de verdad (dibujados en la prueba). La app se sirve por http, como en el sitio: desde un archivo local el navegador no deja crear el trabajador donde corre el lector. |
| `gastos_pdf_test.mjs` | los PDF de entrega de Gastos armados de verdad (con pdf-lib, servida por http al lado de la página como en el sitio) y vueltos a leer: páginas, sellos, idiomas, el comprobante que no se puede leer y el resumen por mes. |
| `brujula_test.mjs` | Administración › Brújula (docs/brujula/): la lista y la cuadrícula de quién tiene qué, los filtros, invitar (una persona o una lista), dar y quitar acceso, los pendientes de la planilla, el catálogo de carpetas por link (agregar, editar, ordenar, desactivar, dejar de gestionar), paquetes y planillas, y qué pasa cuando Google no contesta. La función `brujula` es de mentira; en los cuatro idiomas y en el celular. |
| `miniatura_test.mjs` | la miniatura de una foto, armada en un Chromium de verdad: un canvas no existe fuera del navegador, y `sb_test.mjs` usa una de mentira. |

## Para correrlas

- **En GitHub** no hay nada que hacer: `.github/workflows/app.yml`. Corre las pruebas **en cuatro trabajos a la vez**
  (`SHARD=i/4`; ~3 minutos cada uno): `repartir.py` las reparte en partes parejas según lo que tarda cada una
  (`pesos.txt`), y `reparto_test.mjs` comprueba que las cuatro partes juntas sean exactamente todas (si el reparto perdiera
  un archivo, ese archivo dejaría de probarse sin que nadie lo note). Una prueba nueva que no está en `pesos.txt` pesa lo de
  una mediana y se reparte igual; cuando se sumen varias grandes, `./herramientas/pruebas/medir_tiempos.sh` renueva los pesos.
- **Dos pasadas (decisión del usuario, 24/11/2026).** `RAPIDO=1 ./herramientas/pruebas/correr.sh` corre solo las pruebas livianas
  (las de 6 segundos o menos según `pesos.txt`; ~100 archivos, ~1 minuto) y sirve antes de cada commit, junto con las de lo que
  se toca (por nombre). La suite completa la corre GitHub sola en la rama (`claude/…`) apenas se la empuja; antes de pasar a
  `main` tiene que estar en verde (ver CLAUDE.md).
- **Un solo recorrido para cinco revisiones (24/11/2026).** Cinco pruebas recorrían cada una **toda** la app (unas 60 pantallas
  y ventanas): nada se corta, selectores, letra mínima, árbol de accesibilidad y hebreo (12 recorridos en total, ~250 s de
  trabajo). Ahora `barrido.mjs` recorre **una vez por tamaño e idioma** y en cada parada corre las revisiones que corresponden
  (las que solo miran, después recortes, y al final selectores, que abre y elige): `barrido_compu_test.mjs` (compu en español y en
  hebreo, y la letra del CSS), `barrido_celular_test.mjs` (celular oscuro, más la Vista Año) y `barrido_variantes_test.mjs` (celular
  chico y celular en hebreo): ~135 s de trabajo, casi la mitad, sin sacar ni una comprobación (cada rotura de prueba que detectaba
  una de las cinco la sigue detectando). **Una revisión nueva de «todas las pantallas» se escribe como una fábrica más de
  `barrido.mjs`** (`{ paso(p, parada), fin(eq) }`), no como otra prueba con su propio `recorrerApp`.
- **Más rápido sin perder nada (24/11/2026).** Más de la mitad del tiempo de la suite era *dormir*. Ahora `entrar()` en
  `app_de_mentira.mjs` hace que **todo `p.waitForTimeout(ms)`** (hasta 1,5 s) sea una espera inteligente: se corta apenas la
  página no tiene nada en marcha (temporizadores de hasta 2 s, pedidos, animaciones que terminan, cambios en el DOM) y nunca
  espera más de lo que pedía. Con `PAUSA_FIJA=1` las esperas vuelven a ser fijas (para investigar una prueba rara). Dos reglas
  para escribir pruebas: **(1)** una espera que cuenta vueltas (`for(i<50){…waitForTimeout(100)}`) ya no equivale a tiempo:
  tiene que medir tiempo real (`const fin = Date.now() + 5000; while(Date.now() < fin){…}`); y **(2)** lo que depende de que
  pase tiempo de verdad (esperar a que un desplazamiento se detenga) usa `p.dormir(ms)`, que duerme de verdad. Con el
  procesador frenado (`cpu`) o sin sesión, las esperas siguen siendo fijas.
- **En el sandbox de Claude Code** el corredor se arregla solo: Playwright
  y Chromium ya están instalados. No correr `playwright install` ahí.
- **En otra máquina:** `cd herramientas/pruebas && npm ci && npx playwright install chromium`.

Las pruebas del esquema de la base y del sync de Calendar están aparte, en
`supabase/pruebas/` y `supabase/sync-calendar/pruebas/`, con sus propios
workflows.

## La app de mentira compartida

`app_de_mentira.mjs` entra a la app (el `index.html` de verdad, o el que
diga `INDEX`) contra el Supabase de mentira de `app_dom_test.mjs`, con
datos parecidos a los reales, en el tamaño y el idioma que se pida; recorre
todas las pantallas (`recorrerApp`) y mide lo que queda cortado
(`revisarRecortes`). La usan los `barrido_*_test.mjs` y las herramientas de
`herramientas/auditoria/`. Una pantalla o ventana nueva se suma a `recorrerApp`: así la
revisan las dos.
