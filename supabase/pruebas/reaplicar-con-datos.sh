#!/bin/bash
# ============================================================
# Volver a aplicar el esquema sobre una base CON DATOS.
# ============================================================
# Uso:  ./reaplicar-con-datos.sh "postgresql://…/base_descartable"
#
# aplicar.sh vuelve a correr TODOS los archivos en cada push, y Postgres
# revisa lo que ya está guardado cada vez que se recrea una restricción.
# Las pruebas aplican el esquema dos veces sobre una base VACÍA, así que un
# archivo que endurece algo sin acordarse de lo guardado pasa en verde y se
# cae recién contra la base de verdad. Pasó: el 03 recreaba "contenido de
# al menos 1" sobre los eventos de Calendar que el 09 había dejado vacíos.
#
# Esto carga filas al límite de lo que el esquema permite hoy
# (datos-al-limite.sql) y vuelve a aplicar todo. NO apuntarlo a la base de
# verdad: escribe datos de prueba.
# ============================================================
set -u
DESTINO="${1:-}"
if [ -z "$DESTINO" ]; then
  echo "Falta la dirección de la base de prueba."
  echo "Uso: $0 \"postgresql://usuario:clave@host:puerto/base_de_prueba\""
  exit 2
fi
CARPETA="$(cd "$(dirname "$0")" && pwd)"
PSQL="${PSQL:-psql}"

if ! "$PSQL" "$DESTINO" --quiet -v ON_ERROR_STOP=1 -f "$CARPETA/datos-al-limite.sql"; then
  echo "✗ No se pudieron cargar los datos al límite: el esquema de hoy ya no acepta algo que se guardaba."
  exit 1
fi
if ! "$CARPETA/../aplicar.sh" "$DESTINO"; then
  echo ""
  echo "✗ Con datos adentro, el esquema ya no se puede volver a aplicar."
  echo "  Algún archivo recrea una restricción que lo que ya está guardado no cumple."
  exit 1
fi
echo "✓ Con datos al límite de lo permitido adentro, el esquema se vuelve a aplicar sin problemas."
