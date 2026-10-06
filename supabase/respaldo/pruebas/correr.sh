#!/bin/bash
# Las pruebas de la copia de seguridad y de su restauración, contra un
# Supabase de mentira. Las corre GitHub antes de cada copia y de cada
# restauración: si se caen, no corre ninguna de las dos.
set -u
CARPETA="$(cd "$(dirname "$0")" && pwd)"
mal=0
for prueba in de-punta-a-punta restaurar; do
  salida="$(node "$CARPETA/$prueba.mjs" 2>&1)"
  linea="$(echo "$salida" | grep -E '^[0-9]+ pasaron' | tail -1)"
  if [ -z "$linea" ]; then
    echo "✗ $prueba.mjs no llegó a dar un resultado:"; echo "$salida" | tail -20; mal=1; continue
  fi
  printf '  %-22s %s\n' "$prueba.mjs" "$linea"
  echo "$salida" | grep -E '^✗' -A2 || true
  echo "$linea" | grep -qE ', 0 fallaron' || mal=1
done
echo ""
[ "$mal" = 0 ] && { echo "✓ En verde."; exit 0; }
echo "✗ Algo falló."; exit 1
