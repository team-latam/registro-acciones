#!/bin/bash
# ============================================================
# Todas las pruebas de index.html.
# ============================================================
# Uso:  ./pruebas/correr.sh            (desde cualquier lado)
#
# Primero arma los harness —páginas de prueba con el código sacado del
# index.html DE VERDAD, nunca una copia a mano— y después corre cada
# prueba. Se cae con código 1 si falla aunque sea una comprobación, o si
# una prueba se cuelga, o si no encuentra ninguna: así sirve igual para
# correrlo a mano y para que lo corra GitHub en cada push.
#
# Para comprobar que una prueba nueva DE VERDAD falla contra el código
# viejo:   INDEX=/ruta/a/otra/copia/index.html ./pruebas/correr.sh
# ============================================================
set -u
cd "$(dirname "$0")"

# Playwright: en CI sale de `npm ci`; en el sandbox de Claude Code ya está
# instalado global y alcanza con apuntarle. NO correr `playwright install`
# en el sandbox: el navegador ya está en /opt/pw-browsers.
if [ ! -e node_modules/playwright ]; then
  if [ -d /opt/node22/lib/node_modules/playwright ]; then
    ln -sfn /opt/node22/lib/node_modules node_modules
  else
    echo "Falta Playwright. En esta carpeta: npm ci && npx playwright install chromium"
    exit 2
  fi
fi

# --- 1. Los harness, desde el index.html de verdad ---
for a in armar_*.py; do
  python3 "$a" >/dev/null || { echo "✗ $a no pudo armar su página de prueba"; exit 1; }
done
for b in build*.mjs; do
  node "$b" >/dev/null || { echo "✗ $b no pudo armar su página de prueba"; exit 1; }
done
rm -rf __pycache__

# --- 2. Las pruebas ---
total=0; malas=0; archivos=0; rotos=""
for f in *_test.mjs; do
  [ -f "$f" ] || continue
  archivos=$((archivos + 1))
  # Con tope de tiempo: una prueba colgada no puede dejar a CI esperando
  # seis horas para decir nada.
  salida="$(timeout 300 node "$f" 2>&1)"; codigo=$?
  linea="$(echo "$salida" | grep -oE '[0-9]+ pasaron, [0-9]+ fallaron' | tail -1)"
  if [ -z "$linea" ]; then
    [ "$codigo" = 124 ] && echo "✗ $f se colgó (más de 5 minutos)" || echo "✗ $f no llegó a dar un resultado:"
    echo "$salida" | tail -6 | sed 's/^/    /'
    malas=$((malas + 1)); rotos="$rotos $f"; continue
  fi
  pasaron=$(echo "$linea" | grep -oE '^[0-9]+'); fallaron=$(echo "$linea" | grep -oE '[0-9]+ fallaron' | grep -oE '^[0-9]+')
  total=$((total + pasaron)); malas=$((malas + fallaron))
  if [ "$fallaron" != "0" ] || [ "$codigo" != "0" ]; then
    printf '✗ %-30s %s\n' "$f" "$linea"
    echo "$salida" | grep -A2 '^✗' | head -12 | sed 's/^/    /'
    [ "$fallaron" = "0" ] && malas=$((malas + 1))   # dijo 0 fallas pero salió con error
    rotos="$rotos $f"
  else
    printf '  %-30s %s\n' "$f" "$linea"
  fi
done
rm -rf __pycache__

echo ""
# Un portero que no encuentra a quién revisar y dice "pasen todos" es peor
# que ninguno: si el patrón deja de encontrar archivos, esto tiene que
# gritar, no dar el visto bueno sobre cero pruebas.
if [ "$archivos" = 0 ]; then
  echo "✗ No encontré ninguna prueba en $(pwd). Eso NO es que estén todas bien."
  exit 1
fi
if [ "$malas" = 0 ]; then
  echo "✓ $total comprobaciones en $archivos archivos, todas en verde."
else
  echo "✗ $malas fallaron (de $((total + malas))):$rotos"
  exit 1
fi
