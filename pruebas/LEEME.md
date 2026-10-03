# Las pruebas de la app

Todo lo que protege `index.html`: el acceso, los adjuntos, el calendario,
los permisos de cada pantalla, el adaptador de Supabase, el plegado de la
documentación. Corre solo en GitHub en cada push que toca la app.

```
./pruebas/correr.sh
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
INDEX=/tmp/roto.html ./pruebas/correr.sh
```

`INDEX` lo leen todos: las pruebas y los armadores.

## Qué hay

| | |
|---|---|
| `*_test.mjs` | las pruebas. Cada una termina con `N pasaron, M fallaron`. |
| `armar_*.py`, `build*.mjs` | arman las páginas de prueba desde `index.html`. |
| `grab.mjs`, `extractor.py` | el extractor, en JavaScript y en Python. Son gemelos: `extractor_test.mjs` exige que saquen exactamente lo mismo de cada declaración del archivo. |
| `carga_test.mjs` | la página entera, en las dos bases. |

## Para correrlas

- **En GitHub** no hay nada que hacer: `.github/workflows/app.yml`.
- **En el sandbox de Claude Code** el corredor se arregla solo: Playwright
  y Chromium ya están instalados. No correr `playwright install` ahí.
- **En otra máquina:** `cd pruebas && npm ci && npx playwright install chromium`.

Las pruebas del esquema de la base y del sync de Calendar están aparte, en
`supabase/pruebas/` y `supabase/sync-calendar/pruebas/`, con sus propios
workflows.
