#!/bin/bash
# ============================================================
# Aplica el esquema entero a una base de Postgres.
# ============================================================
# Uso:  ./aplicar.sh "postgresql://usuario:clave@host:puerto/postgres"
#
# Corre, en orden, los archivos NN-*.sql de esta carpeta. Todos están
# escritos para poder correrse más de una vez sin romper nada, así que
# aplicar de nuevo lo que ya estaba aplicado no hace daño: simplemente no
# cambia nada.
#
# Cada archivo va en SU PROPIA transacción (--single-transaction): si uno
# falla a la mitad, ese archivo no deja nada aplicado por partes, y el
# script corta ahí en vez de seguir con los que vienen después.
#
# Lo de pruebas/ NO entra acá a propósito: 00-laboratorio.sql arma un
# auth/storage de mentira y una función para hacerse pasar por cualquiera.
# Eso existe para probar en una base descartable y no tiene que acercarse
# nunca a la de verdad. Por eso vive en otra carpeta y el patrón de abajo
# no lo alcanza.
# ============================================================
set -u
DESTINO="${1:-}"
if [ -z "$DESTINO" ]; then
  echo "Falta la dirección de la base."
  echo "Uso: $0 \"postgresql://usuario:clave@host:puerto/postgres\""
  exit 2
fi
CARPETA="$(cd "$(dirname "$0")" && pwd)"
PSQL="${PSQL:-psql}"
# Los archivos hacen "drop ... if exists" antes de crear cada cosa, y cada
# uno de esos avisa que no existía. Son decenas de líneas que no dicen
# nada: quedan los WARNING y los errores, que sí.
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"

hubo=0
for f in "$CARPETA"/[0-9][0-9]-*.sql; do
  [ -f "$f" ] || continue
  hubo=1
  nombre="$(basename "$f")"
  echo "→ $nombre"
  if ! "$PSQL" "$DESTINO" --quiet --single-transaction -v ON_ERROR_STOP=1 -f "$f"; then
    echo ""
    echo "✗ Falló $nombre. No se aplicó NADA de ese archivo, ni los que seguían."
    exit 1
  fi
done
[ "$hubo" = 1 ] || { echo "✗ No encontré ningún archivo NN-*.sql en $CARPETA"; exit 1; }
echo ""
echo "✓ Esquema aplicado."
