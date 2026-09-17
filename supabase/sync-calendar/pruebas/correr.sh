#!/bin/bash
# Las dos pruebas del sync de Calendar del lado del servidor.
#
# La diferencial es la importante: corre la lógica de index.html y la de
# decidir.mjs contra los mismos eventos y compara escritura por escritura.
# Es lo único que evita que las dos copias se separen en silencio. Si se
# cae, NO la saltees: significa que alguien tocó una sola de las dos.
set -u
CARPETA="$(cd "$(dirname "$0")" && pwd)"
malas=0
for f in "$CARPETA"/diferencial.mjs "$CARPETA"/de-punta-a-punta.mjs; do
  nombre="$(basename "$f")"
  salida="$(node "$f" 2>&1)"
  linea="$(echo "$salida" | grep -E '^[0-9]+ pasaron' | tail -1)"
  if [ -z "$linea" ]; then
    echo "✗ $nombre no llegó a dar un resultado:"; echo "$salida" | tail -20; malas=$((malas+1)); continue
  fi
  printf '  %-22s %s\n' "$nombre" "$linea"
  echo "$salida" | grep -E '^✗' -A2 || true
  echo "$linea" | grep -qE ', 0 fallaron' || malas=$((malas+1))
done
echo ""
[ "$malas" = 0 ] && { echo "✓ Las dos, en verde."; exit 0; }
echo "✗ Algo falló."; exit 1
