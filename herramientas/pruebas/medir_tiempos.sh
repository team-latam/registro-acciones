#!/bin/bash
# Mide cuánto tarda cada prueba (de a PARALELO, como el corredor) y renueva pesos.txt, que usa repartir.py para que las
# partes de GitHub queden parejas. Correrlo de vez en cuando (por ejemplo después de sumar varias pruebas grandes):
#   ./herramientas/pruebas/medir_tiempos.sh
# Tarda lo que tarda la suite entera. No toca nada más que pesos.txt.
set -u
cd "$(dirname "$0")"
D="$(mktemp -d)"
una(){ s=$(date +%s.%N); timeout 300 node "$1" > "$2/$1.out" 2>&1; c=$?; e=$(date +%s.%N); printf '%s %s %.1f\n' "$1" "$c" "$(echo "$e - $s" | bc)" >> "$2/tiempos.txt"; }
export -f una
for a in armar_*.py; do python3 "$a" >/dev/null || { echo "✗ $a no pudo armar su página de prueba"; exit 1; }; done
for b in build*.mjs; do node "$b" >/dev/null || { echo "✗ $b no pudo armar su página de prueba"; exit 1; }; done
rm -rf __pycache__
ls *_test.mjs | grep -v '^rendimiento_' | xargs -P "${PARALELO:-4}" -I{} bash -c 'una "$1" "$2"' _ {} "$D"
for f in rendimiento_*_test.mjs; do [ -f "$f" ] && una "$f" "$D"; done
{ echo "# Segundos que tarda cada prueba (medido con medir_tiempos.sh). Lo usa repartir.py. «archivo segundos»"
  awk '{ printf "%s %.0f\n", $1, ($3 < 1 ? 1 : $3) }' "$D/tiempos.txt" | sort; } > pesos.txt
malas=$(awk '$2 != 0 { print $1 }' "$D/tiempos.txt" | tr '\n' ' ')
rm -rf "$D"
echo "pesos.txt renovado ($(grep -vc '^#' pesos.txt) archivos)."
[ -z "$malas" ] || { echo "⚠ Ojo: salieron con error: $malas (sus tiempos pueden no valer)"; exit 1; }
