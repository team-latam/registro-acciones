# Auditoría completa, con énfasis en seguridad — 24 de octubre de 2026

> Las anteriores están en `docs/informes/historial/`: la completa del
> 10/10/2026 (códigos R y D1–D9), la del 6/10 (U, I, M, B, O), la de lo
> nuevo del 7/10 (C, E, P, G) y la de la Agenda del 9/10 (A). Los de esta
> van con **S**, y sus decisiones siguen la numeración: D10 en adelante. El
> método: `herramientas/auditoria/METODO.md`.

Pedido del usuario: «una auditoría completa de mi sistema, haciendo especial
énfasis en todo lo que tiene que ver con seguridad», y entender si se pueden
reducir los tokens de cada cambio, que hoy «hace una revisión completa y
todas las comprobaciones, cuando quizás pueden ser menos».

El detalle de cada hallazgo (dónde, cómo se verificó, qué se hizo) está en
`docs/informes/2026-10-24-seguridad-y-costo.md`. La página para el usuario,
en palabras simples: https://claude.ai/artifact/1tSArcG1rHue5DaCvRuKhi (privada).

**Cómo se hizo.** Sobre `1ccc721` de `main`. Las herramientas completas:
**3.697 comprobaciones de la app en 112 archivos, en verde**; Calendar y las
**990 de la base**, en verde; **las de las copias, en rojo** (S5, una falla
de verdad que nadie había visto); las pantallas en 13 combinaciones de
tamaño, idioma, oscuro y letra ancha, y datos variados con dos semillas.
A mano, la seguridad de todo lo que entró después del 10/10 (los SQL 21 a
26, las dos funciones de Supabase y sus correos, los 14 workflows, la CSP,
cada librería de afuera, el visor de archivos, las planillas que se bajan,
«Algo no anda», el enlace del informe mensual, el historial de git de esas
dos semanas) y el costo de cada cambio (las corridas de Actions de la
semana, lo que se lee y lo que se corre).

---

## En una página

**La base y la app están bien cerradas.** Las funciones nuevas controlan
quién llama y tienen topes; lo escrito por alguien va escapado en la app y
en los correos; nadie de afuera ve nada. Lo que apareció está en el borde:
lo que se publica en el repositorio, lo que se carga de afuera y cómo se
protege la página si algún día algo fallara.

**Lo que más pesa:**

1. **Datos de personas en el repositorio público** (urgente). Al contar en
   `docs/REDISENO.md` cómo se corrigió el Excel del Mapeo (17/10) se copió
   entero el teléfono de una persona; y las pruebas de la Agenda usaban
   **ocho nombres con su teléfono, su ciudad y su cargo** que tienen toda la
   pinta de ser del Mapeo y del directorio (uno, de seguridad de una
   comunidad). Es la tercera vez del mismo error. Ya no están en los
   archivos; **siguen en el historial**: hace falta reescribirlo (D10).
2. **La librería de las planillas entraba sin verificar** (importante). Si
   su servidor sirviera otra cosa, correría con la sesión de quien abre un
   Excel, y con la del admin al traer una lista a la Agenda. Ahora va con
   huella, como las demás.
3. **«Algo no anda» no entraba en la copia del domingo** (importante), y la
   prueba que lo vigila estaba en rojo desde el 13/10 sin que GitHub la
   corriera. Arreglado las dos cosas.
4. **La página se defiende mejor** (medio): la política de contenido ya no
   deja correr un script colado, y otra página ya no puede mostrar la app
   dentro de la suya para hacerte tocar algo sin que lo veas.
5. **Las llaves de GitHub se pueden leer desde cualquier rama** (medio): la
   traba es un «entorno» que solo entrega las llaves a `main` (D11).

**El costo de cada cambio:** las pruebas tardaban 20 minutos y se corrían
tres veces por tanda (en la sesión, en la rama y en `main`), más una vez
entera por cada prueba nueva para ver que falla contra lo roto. Ahora corren
de a cuatro, se pueden correr de a una por nombre, muestran solo lo que
falla, y no se repiten en la rama. Cuántas correr antes de cada cambio lo
decidís vos (D12); la red que protege a la gente no cambia: **GitHub corre
siempre todas antes de publicar y, si algo falla, no publica**.

---

## La lista, por prioridad

**Quién**: Claude lo hace solo, o el **usuario** decide. Las cuatro decisiones (D10 a D13) las tomó el 24/10, en la misma sesión.

### Urgente

| # | Qué | Por qué | Quién |
|---|---|---|---|
| S4 | Datos de personas con toda la pinta de reales en el repo público: un teléfono del Mapeo («+1 (929) …») escrito entero en `docs/REDISENO.md` (17/10), y **en las pruebas de la Agenda y de la base, ocho nombres con su teléfono, su ciudad y su cargo** (de Córdoba, Rosario, Buenos Aires y Brasil; uno con el cargo «Seguridad · Kabat Kehila»), desde el primer commit del historial actual (12/10) y la mayoría del 16 y 17/10, cuando se probó «Traer una lista» con filas como las del Mapeo. ~~En los archivos~~ ✅ 24/10 (cambiados por nombres y teléfonos inventados, con 555, en las 11 partes donde estaban; las pruebas, en verde; `seguridad` ahora ve el «9» de los celulares, que antes se le escapaba, informa todo recortado y en nivel «importante»). **Queda en el historial** (D10) | el repo es público; datos privados del Mapeo y de una persona de seguridad; tercera vez (RECURRENTES) | Claude + **usuario** (D10) |

### Importante

| # | Qué | Por qué | Quién |
|---|---|---|---|
| S1 | ~~SheetJS (la librería de las planillas) se cargaba sin huella (SRI): el visor de un .xlsx (cualquiera) y «Traer una lista» (el admin, con su sesión)~~ ✅ 24/10 (`SHEETJS_SRI`, calculada en GitHub del archivo de su servidor; `sheetjs_integridad_test`; «¿Está arriba?» la verifica cada día) | si su servidor sirviera otra cosa, correría con la sesión del admin | Claude |
| S5 | ~~La tabla de «Algo no anda» (`problemas`, 13/10) no estaba en la copia del domingo ni en el botón de la app; la prueba que lo exige estaba en rojo y GitHub no la corría (solo si cambia `supabase/respaldo/`)~~ ✅ 24/10 (en la copia, en la restauración y en el botón; la prueba corre también cuando cambia un `.sql` o la app) | una restauración la perdía; la próxima tabla podía ser una que importe | Claude |

### Medio

| # | Qué | Por qué | Quién |
|---|---|---|---|
| S2 | ~~La CSP decía `'unsafe-inline'` (corre cualquier script escrito en la página) y nombraba jsDelivr y unpkg enteros~~ ✅ 24/10 (al publicar, la CSP lleva la huella de los dos scripts de la página, `herramientas/publicar/csp.mjs`; en el fuente, cada CDN nombra el archivo exacto; `csp_publicada_test`: arranca, no frena nada propio, y un script colado no corre) | la segunda llave, por si un día un dato sin escapar se cuela: detrás están la sesión y el permiso de Calendar de cada uno | Claude |
| S3 | ~~Otra página podía mostrar la app adentro de un marco invisible (*clickjacking*): GitHub Pages no manda el encabezado que lo impide~~ ✅ 24/10 (adentro de un marco de otro sitio, la página no se muestra; `marco_test`) | hacer tocar «Aprobar» o «Borrar» a alguien con la sesión abierta | Claude |
| S9 | Los secretos de GitHub (la llave de servicio, la de la base, Resend, Google, los tokens) están en el repositorio: un workflow empujado en cualquier rama los puede leer, diga lo que diga la línea «solo desde main». La traba es un entorno con la regla «solo `main`» (D11). Mientras tanto, regla nueva en `CLAUDE.md` | las sesiones de Claude empujan ramas y leen contenido de afuera | **usuario** (D11) |
| S10 | ~~El costo de cada cambio: la suite tardaba ~20 minutos, se corría tres veces por tanda y entera para ver que una prueba nueva falla; imprimía ~115 líneas verdes; el trabajo de GitHub tenía tope de 30 minutos y ya tardaba 24~~ ✅ 24/10 (de a cuatro, por nombre, solo lo que falla; no corre en las ramas `claude/…`; tope de 40). Cuántas correr en la sesión: D12 | cada paso de una sesión vuelve a pagar todo lo que tiene a la vista; y a poco del tope, «Publicar el sitio» iba a dejar de publicar | Claude + **usuario** (D12) |

### Bajo

| # | Qué | Quién |
|---|---|---|
| S6 | ~~Un paso de «Lo que sigue» con una fecha que no existe (solo por la API) tiraba la función de avisos y el aviso se perdía~~ ✅ 24/10 (sale sin fecha; `supabase/functions/_pruebas/avisos.mjs`) | Claude |
| S7 | ~~«¿Está arriba?» dio rojo (y mail) el 23/10 por una sola demora de Supabase~~ ✅ 24/10 (repite una vez antes de dar rojo) | Claude |
| S8 | ~~En hebreo, «N cerradas» de la vista previa de «Traer una lista» quedaba siempre en plural~~ ✅ 24/10 | Claude |
| S11 | El visor deja `<style>` y los `<animate>` de SVG (hoy inalcanzable; sacar `<style>` rompería los Word). Código sin usar: `diasEntre` y `csvDeTabla` (solo las usan las pruebas). Se miran cuando se toque esa parte | Claude, cuando se toque |
| S12 | ~~`seguridad` no veía la CSP floja, el marco ni un teléfono con paréntesis entre los inventados; `pantallas` podía dar «0 hallazgos» sin haber medido nada; dos falsos positivos y siete correos inventados~~ ✅ 24/10 (las herramientas los ven; `conocidos.json`; el correo de prueba que tenía nombre de persona real posible pasó a `@x.com`) | Claude |

### Opcional

| # | Qué | Quién |
|---|---|---|
| S13 | Cifrar las copias de seguridad (hoy van a un repo privado, sin cifrar). Obliga a guardar una llave más: si se pierde, la copia no sirve. Recomendación: todavía no | **usuario** |

### Para el usuario

| # | Qué | Recomendación |
|---|---|---|
| D10 | ~~**Reescribir el historial** para sacar esos datos (S4)~~ **Elegido el 24/10: sí.** Claude reescribe los 56 commits en cuanto el usuario destilda «Block force pushes»; después él lo vuelve a tildar y hace el pedido a GitHub de borrar las copias sueltas | Sí |
| D11 | ~~**Las llaves de GitHub en un entorno que solo las da a `main`** (S9)~~ **Elegido el 24/10: A.** Hecho de parte de Claude: los 11 trabajos que usan la llave de servicio o la de la base piden el entorno `produccion` (`workflows_test` lo exige). Falta del usuario: en Settings → Environments → `produccion`, la regla «solo `main`» y las dos llaves; después, borrar esas dos del repositorio. Las demás, al renovar los tokens en 2027 | A |
| D12 | ~~**Cuántas pruebas antes de cada cambio** (S10)~~ **Elegido el 24/10: todas, siempre** (B): con el corredor nuevo son 6 minutos y una línea; lo que ahorraba de verdad ya está (no se repiten, la prueba contra lo roto es solo la nueva, no imprimen de más). En `CLAUDE.md` | B |
| D13 | ~~**Un `CLAUDE.md` más corto** y **auditorías por nivel**~~ ✅ 24/10: `CLAUDE.md` de 13,3 a 9,5 KB (el estado y la historia, sin cambios, en `docs/ESTADO.md`); METODO.md y la skill con los dos niveles («de lo nuevo» y «completa») | Sí |

---

## Operación (para tenerlo a la vista)

- **El peso del archivo**: 576 KB comprimidos (514 el 10/10). D1 dijo
  «se vuelve a mirar al pasar los 600»: está a 24 KB.
- **Vence**: `RESPALDOS_TOKEN` 5/10/2027; `SUPABASE_ACCESS_TOKEN` 30/9/2027.
- **Workflows de la semana**: todo en verde salvo la falsa alarma del 23/10
  (S7). «Publicar el sitio» tardó 21 minutos en cada push.
- **Ramas**: `main` y `claude/bold-thompson-ebt8tz` (de la sesión del 22/10,
  igual a `main`: se puede borrar). Ningún pull request.

## Lo que sigue abierto de las anteriores

De la del 10/10: **R12** (el ensayo completo de restauración, cuando haya un
proyecto de prueba), **R18/D1** (el peso, arriba), **D4** (el pedido a GitHub
de borrar las copias sueltas, si no se hizo: va junto con D10), **D8**
(probar en el teléfono la Agenda, «+ Sumar» y una foto desde la cámara).
De las anteriores, lo mismo que listaba la del 10/10. Decidido y no se
vuelve a proponer: lo de esa lista.

## Lo que está bien y conviene no tocar

- **La base**: las 7 funciones nuevas con `security definer`, `search_path`
  fijo, cerradas a `anon`, cada una controla quién llama y tiene topes;
  `problemas` solo la ve un admin y nadie escribe directo.
- **Los correos**: a quién y si corresponde lo decide la base; la función
  solo recibe un turno; todo lo escrito por alguien va escapado.
- **«Algo no anda»** no manda textos, correos ni direcciones; **el informe
  mensual** no lleva números en el correo y el enlace lo valida la base.
- **Las planillas que se bajan** no ejecutan fórmulas; **el visor** limpia lo
  que muestra; **los workflows** no pegan entradas en un `run:`.
- **Ningún XSS**: con HTML metido en cada campo y miles de posteos, no corre
  nada.

## Cómo seguir

Todo lo de Claude está en `main` y publicado (24/10, «Publicar el sitio» en
7 minutos; «¿Está arriba?» confirmó desde afuera que la página sale con las
huellas en la CSP y que las 9 librerías llegan con la suya).

1. **Vos** (una sola visita a GitHub, con los pasos que te dio Claude):
   destildar «Block force pushes» para D10, y armar el entorno `produccion`
   con las dos llaves de Supabase para D11.
2. **Claude**: reescribir el historial (D10), revisar que no quede nada,
   comprobar que los trabajos lean las llaves del entorno, y avisarte para
   volver a tildar la protección y borrar las dos llaves viejas.
