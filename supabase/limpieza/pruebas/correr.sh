#!/bin/bash
# La prueba de la limpieza del bucket, contra un Supabase de mentira. La
# corre GitHub antes de cada limpieza: si se cae, la limpieza no corre.
set -u
CARPETA="$(cd "$(dirname "$0")" && pwd)"
salida="$(node "$CARPETA/de-punta-a-punta.mjs" 2>&1)"
linea="$(echo "$salida" | grep -E '^[0-9]+ pasaron' | tail -1)"
if [ -z "$linea" ]; then
  echo "✗ de-punta-a-punta.mjs no llegó a dar un resultado:"; echo "$salida" | tail -20; exit 1
fi
echo "  de-punta-a-punta.mjs   $linea"
echo "$salida" | grep -E '^✗' -A2 || true
echo "$linea" | grep -qE ', 0 fallaron' && { echo ""; echo "✓ En verde."; exit 0; }
echo ""; echo "✗ Algo falló."; exit 1
