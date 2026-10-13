#!/bin/bash
# ============================================================
# El video de presentación: lo arma entero, de la app al MP4.
# ============================================================
# Uso:  bash herramientas/video/hacer_video.sh            (los dos: celular y compu)
#       bash herramientas/video/hacer_video.sh celu       (solo el celular, vertical 1080x1920)
#       bash herramientas/video/hacer_video.sh compu      (solo la compu, horizontal 1920x1080)
#
# Qué hace, en orden (todo queda en herramientas/video/salida/, que no se versiona):
#   1. piezas.mjs   → los fondos, el marco del celular, los carteles y las tarjetas (PNG)
#   2. capturar.mjs → graba la app de demostración escena por escena (datos inventados, fecha fija)
#   3. armar.mjs    → junta todo en un MP4 sin música de 74 s y anota cuándo entra la tarjeta final
#   4. pista.py     → sintetiza la música para esa duración exacta; pulir.sh la deja a -16 LUFS
#   5. ffmpeg       → le pone la música al video
# Resultado:  herramientas/video/salida/registro-acciones_celu.mp4  y  registro-acciones_compu.mp4
#
# Hace falta: node 22 con Playwright (igual que ./herramientas/pruebas/correr.sh), ffmpeg, python3 con numpy,
# y la tipografía Inter. Detalles y decisiones en herramientas/video/README.md.
# IMPORTANTE: la grabación va en tiempo real. No correr otra cosa pesada al mismo tiempo (por ejemplo
# ./herramientas/pruebas/correr.sh): la compu se atrasa y el video sale con tirones.
# ============================================================
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
cd "$AQUI"

# Playwright: en el sandbox de Claude Code ya está instalado global; NO correr `playwright install`.
if [ ! -e node_modules/playwright ]; then
  if [ -d /opt/node22/lib/node_modules/playwright ]; then
    ln -sfn /opt/node22/lib/node_modules node_modules
  else
    echo "Falta Playwright (npm i playwright && npx playwright install chromium)"; exit 2
  fi
fi
for h in ffmpeg ffprobe python3; do command -v "$h" >/dev/null || { echo "Falta $h"; exit 2; }; done
python3 -c "import numpy" 2>/dev/null || { echo "Falta numpy (pip install numpy)"; exit 2; }
# (se guarda la lista antes de buscar: con `pipefail`, `fc-list | grep -q` da error aunque la encuentre)
FUENTES="$(fc-list)"
case "$FUENTES" in *"Inter Display"*) ;; *) echo "⚠ No encuentro la tipografía Inter: los carteles saldrían con otra letra." ;; esac

FORMATOS="${1:-todo}"; [ "$FORMATOS" = "todo" ] && FORMATOS="celu compu"
mkdir -p salida && cd salida

echo "== 1. piezas gráficas"
node ../piezas.mjs piezas

for f in $FORMATOS; do
  echo "== 2. grabando ($f), en tiempo real"
  node ../capturar.mjs "$f"
  echo "== 3. armando el video sin música ($f)"
  node ../armar.mjs "$f" "grab_$f" "demo_$f.mp4"
  echo "== 4. música ($f)"
  DUR=$(python3 -c "import json;print(json.load(open('grab_$f/fin.txt'))['total'])")
  FIN=$(python3 -c "import json;print(json.load(open('grab_$f/fin.txt'))['fin'])")
  DUR=$DUR FIN=$FIN python3 ../musica/pista.py
  bash ../musica/pulir.sh
  mv musica.wav "musica_$f.wav"
  echo "== 5. video + música ($f)"
  ffmpeg -hide_banner -loglevel error -y -i "demo_$f.mp4" -i "musica_$f.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "registro-acciones_$f.mp4"
  echo "   → salida/registro-acciones_$f.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "registro-acciones_$f.mp4" | cut -c1-5) s)"
done
