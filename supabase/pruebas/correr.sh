#!/bin/bash
# ============================================================
# Corre todas las pruebas de SQL contra una base DESCARTABLE.
# ============================================================
# Uso:  ./correr.sh "postgresql://usuario:clave@host:puerto/base_de_prueba"
#
# NO apuntar esto a la base de verdad: cada archivo empieza vaciando las
# tablas, y 00-laboratorio.sql arma un auth/storage de mentira más una
# función para hacerse pasar por cualquier persona.
#
# Se cae con código 1 si falla aunque sea una comprobación, así que sirve
# igual para correrlo a mano y para que lo corra GitHub antes de tocar
# nada.
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

total=0; malas=0
for f in "$CARPETA"/9[0-9]-*.sql; do
  [ -f "$f" ] || continue
  nombre="$(basename "$f")"
  salida="$("$PSQL" "$DESTINO" --quiet -f "$f" 2>&1)"
  linea="$(echo "$salida" | grep -E '[0-9]+ pasaron,' | tail -1)"
  if [ -z "$linea" ]; then
    echo "✗ $nombre no llegó a dar un resultado:"
    echo "$salida" | grep -i error | head -5
    malas=$((malas + 1)); continue
  fi
  pasaron=$(echo "$linea" | grep -oE '^ *[0-9]+' | tr -d ' ')
  fallaron=$(echo "$linea" | grep -oE '[0-9]+ fallaron' | grep -oE '^[0-9]+')
  printf '  %-28s %s\n' "$nombre" "$(echo "$linea" | xargs)"
  total=$((total + ${pasaron:-0})); malas=$((malas + ${fallaron:-0}))
  if [ "${fallaron:-0}" != "0" ]; then echo "$salida" | grep -E 'FALLA' | head -10; fi
done

echo ""
if [ "$malas" = 0 ]; then
  echo "✓ $total comprobaciones, todas en verde."
else
  echo "✗ $malas fallaron (de $((total + malas)))."
  exit 1
fi
