# Herramientas

Páginas sueltas, aparte de la app (`index.html`), que se publican con ella
en GitHub Pages (`.github/workflows/pages.yml` copia esta carpeta) y
también andan abiertas desde la compu, sin servidor: no cargan nada de
afuera.

## `mapeo.html` — Revisar el Mapeo

https://team-latam.github.io/registro-acciones/herramientas/mapeo.html

Para ordenar, confirmar y corregir el Excel «Mapeo - LatAm.xlsx» (la
planilla de comunidades: ciudad, país, miembros, entidades, tamaño, y la
gente de cada área —comunidad, seguridad, CARE, MODA, organización, RM,
R Habtaja, R Hadraja, R KM, R Swimmers— con su teléfono) antes de subir
eso a la Agenda de la app.

**Qué hace**

1. **Abrir Excel…** elige el archivo (o se arrastra sobre la página). Se
   lee en el navegador: **nada sale del dispositivo**, y por eso la
   página no trae los datos adentro —el Excel tiene nombres y teléfonos
   de personas, y el repo y el sitio son públicos—. Lo que se va
   revisando queda guardado en ese mismo navegador (`localStorage`) hasta
   que se exporta; si se recarga la página, sigue donde estaba.
2. **Una ficha por comunidad**, agrupadas por región como en la planilla
   (los bloques de la columna A: el primero no tiene nombre, después
   NORTE y BRASIL; el nombre se puede escribir). Cada campo es un campo
   de texto, un número o la misma lista desplegable que tiene el Excel
   (las listas se leen de las validaciones del archivo). El resumen de
   cada región evalúa las fórmulas de su fila de TOTAL con los valores de
   ahora.
3. **Avisos** debajo del campo, en amarillo, con **Aplicar** cuando el
   arreglo es seguro: caracteres invisibles pegados de WhatsApp (marcas
   de dirección, espacios duros, guiones raros), espacios de más,
   teléfono sin «+», paréntesis sin cerrar; y sin arreglo automático:
   teléfono con dígitos de más o de menos para su país (por el prefijo
   del número, no por el país de la fila), nombre sin teléfono o teléfono
   sin nombre, «SI» sin nadie anotado al lado, «NO» con alguien anotado,
   un valor que no está en la lista, un país mal escrito (sugiere el
   parecido), una ciudad repetida, miembros/entidades/tamaño vacíos.
   **Aplicar N arreglos seguros** (en los contadores) los aplica todos.
4. **Revisada** en cada ficha, para llevar la cuenta (no va al Excel: se
   guarda en el navegador, por ciudad y país, así sobrevive a abrir el
   archivo ya exportado). Buscar, filtrar por país, «solo sin revisar»,
   «solo con avisos», «solo con cambios».
5. **Sumar una comunidad** al final de cada región, **quitar** una,
   **mover arriba/abajo** (menú ⋯ de la ficha) y **ordenar** una región
   (por país y ciudad, por miembros, o como estaba). Deshacer los cambios
   de una ficha.
6. **Exportar a Excel** baja un archivo **con el mismo nombre y el mismo
   formato**: no se arma un Excel nuevo, se reescriben los valores
   adentro del original (colores, bordes, anchos, listas desplegables,
   formato condicional, filas combinadas, filas de TOTAL con sus
   fórmulas, el comentario, el tema: todo intacto). Si se sumaron o
   sacaron filas, las filas combinadas, las listas, el formato
   condicional, el filtro y las fórmulas de los totales se estiran o se
   acortan como lo haría Excel al insertar o borrar una fila; los totales
   salen ya calculados y además el archivo le pide a Excel recalcular al
   abrirlo.

**El Sheet de Google y las copias.** El original vive en Google Drive
(«Mapeo - LatAm», una hoja de cálculo de Google). El Excel exportado desde
acá se vuelca ahí con Archivo → Importar → Subir: con **«Reemplazar la
hoja de cálculo»** queda igual que el Excel, mismo enlace y mismos
permisos, y la versión anterior se recupera desde Archivo → Historial de
versiones (conviene **nombrar la versión** antes de importar). Con
**«Insertar hojas nuevas»** el Excel entra como una pestaña más y la vieja
queda de copia. Si el Sheet tiene varias pestañas, el Excel que se baja
de él también, y la página **pregunta cuál abrir** (las otras salen
intactas al exportar; en el archivo de salida solo cambia la elegida). Lo
que no conviene es importar con «Insertar hojas nuevas» un Excel que ya
trae la copia: cada vuelta duplicaría las pestañas.

**Cómo está hecha.** Una sola página con todo adentro y sin bibliotecas:
un `.xlsx` es un zip con XML, y el navegador ya sabe descomprimir y
comprimir (`DecompressionStream`/`CompressionStream` con `deflate-raw`,
Chrome 103, Safari 16.4 y Firefox 113 en adelante). El bloque «NUCLEO
XLSX» lee el zip, parte la hoja en filas y celdas (como texto, sin
tocar lo que no cambia), corre las referencias de fila cuando una región
cambia de largo (`moverRango`), rearma las cadenas compartidas enteras y
evalúa `SUM` y `COUNTIF` para dejar los totales al día. El bloque
«MODELO» entiende la planilla (regiones, columnas, listas) y arma los
avisos. Los dos están entre marcas para que la prueba los saque y los
corra en Node.

**Pruebas.** `pruebas/mapeo_test.mjs` la recorre en Chromium con
`pruebas/mapeo_de_prueba.xlsx` (el archivo real con la misma estructura
y gente inventada; `pruebas/mapeo_revisar_xlsx.py` mira lo exportado con
Python de serie, sin nada del código de la página, y
`pruebas/mapeo_dos_hojas.py` arma un Excel con dos pestañas). Para
correrla contra otra copia de la página:
`MAPEO=/ruta/otra.html node pruebas/mapeo_test.mjs`.

**Lo que no hace (todavía).** No sube nada a la app: eso es el paso
siguiente, cuando la planilla esté confirmada. No agrega ni saca
regiones ni columnas: si la planilla cambia de forma, se abre igual
(lee lo que hay), pero las fichas pueden quedar raras.
