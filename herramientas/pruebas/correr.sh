#!/bin/bash
# ============================================================
# Todas las pruebas de index.html.
# ============================================================
# Uso:  ./herramientas/pruebas/correr.sh                  todas
#       ./herramientas/pruebas/correr.sh agenda tour      solo las que se llaman
#                                                         así (agenda*_test.mjs,
#                                                         tour_test.mjs…)
#
# Primero arma los harness —páginas de prueba con el código sacado del
# index.html DE VERDAD, nunca una copia a mano— y después corre cada
# prueba. Se cae con código 1 si falla aunque sea una comprobación, o si
# una prueba se cuelga, o si no encuentra ninguna: así sirve igual para
# correrlo a mano y para que lo corra GitHub en cada push.
#
# Para comprobar que una prueba nueva DE VERDAD falla contra el código
# viejo (alcanza con correr ESA, no todas):
#   INDEX=/ruta/a/otra/copia/index.html ./herramientas/pruebas/correr.sh nueva
#
# Varias a la vez (24/10/2026, docs/AUDITORIA.md, S10): las pruebas no
# comparten nada (ni puertos ni archivos), así que corren de a
# PARALELO=N (de fábrica, tantas como procesadores, hasta 4). Las que
# miden tiempos (rendimiento_*) van solas al final: con el procesador
# compartido medirían de más. PARALELO=1 las corre de a una, como antes.
#
# Lo que muestra: en GitHub (CI=true), una línea por archivo, como
# siempre. En el sandbox, solo lo que falló y el total: la lista entera
# de 100 líneas verdes no dice nada y cuesta leerla (S10). El detalle
# queda igual en herramientas/pruebas/salida/ultima.txt; DETALLE=1 lo
# muestra en pantalla.
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
inicio=$(date +%s)

# --- 1. Los harness, desde el index.html de verdad ---
for a in armar_*.py; do
  python3 "$a" >/dev/null || { echo "✗ $a no pudo armar su página de prueba"; exit 1; }
done
for b in build*.mjs; do
  node "$b" >/dev/null || { echo "✗ $b no pudo armar su página de prueba"; exit 1; }
done
rm -rf __pycache__

# --- 2. Cuáles ---
pruebas=()
if [ "$#" -gt 0 ]; then
  for nombre in "$@"; do
    nombre="${nombre%.mjs}"; nombre="${nombre%_test}"
    encontradas=0
    for f in "$nombre"_test.mjs "$nombre"*_test.mjs; do
      [ -f "$f" ] || continue
      [[ " ${pruebas[*]-} " == *" $f "* ]] || pruebas+=("$f")
      encontradas=1
    done
    [ "$encontradas" = 1 ] || { echo "✗ No hay ninguna prueba que se llame «$nombre»."; exit 1; }
  done
else
  for f in *_test.mjs; do [ -f "$f" ] && pruebas+=("$f"); done
fi
# Un portero que no encuentra a quién revisar y dice "pasen todos" es peor
# que ninguno: si el patrón deja de encontrar archivos, esto tiene que
# gritar, no dar el visto bueno sobre cero pruebas.
if [ "${#pruebas[@]}" = 0 ]; then
  echo "✗ No encontré ninguna prueba en $(pwd). Eso NO es que estén todas bien."
  exit 1
fi
juntas=(); solas=()
for f in "${pruebas[@]}"; do
  case "$f" in rendimiento_*) solas+=("$f") ;; *) juntas+=("$f") ;; esac
done

# --- 3. Correrlas ---
procesadores=$(nproc 2>/dev/null || echo 2)
PARALELO="${PARALELO:-$(( procesadores < 4 ? procesadores : 4 ))}"
mkdir -p salida
tmp="$(mktemp -d)"
# Una prueba: su salida a un archivo propio y su código de salida al lado.
# Con tope de tiempo: una prueba colgada no puede dejar a CI esperando
# seis horas para decir nada.
una(){ timeout 300 node "$1" > "$2/$1.out" 2>&1; echo $? > "$2/$1.cod"; }
export -f una
[ "${#juntas[@]}" -gt 0 ] && printf '%s\n' "${juntas[@]}" | xargs -P "$PARALELO" -I{} bash -c 'una "$1" "$2"' _ {} "$tmp"
for f in ${solas[@]+"${solas[@]}"}; do una "$f" "$tmp"; done

# --- 4. Contarlas, en orden alfabético, como siempre ---
total=0; malas=0; rotos=""
: > salida/ultima.txt
mostrar(){ echo "$1" >> salida/ultima.txt; if [ "${CI:-}" = "true" ] || [ "${DETALLE:-}" = "1" ] || [ "$2" = "mal" ]; then echo "$1"; fi; }
for f in "${pruebas[@]}"; do
  salida="$(cat "$tmp/$f.out")"; codigo="$(cat "$tmp/$f.cod")"
  linea="$(echo "$salida" | grep -oE '[0-9]+ pasaron, [0-9]+ fallaron' | tail -1)"
  if [ -z "$linea" ]; then
    [ "$codigo" = 124 ] && mostrar "✗ $f se colgó (más de 5 minutos)" mal || mostrar "✗ $f no llegó a dar un resultado:" mal
    mostrar "$(echo "$salida" | tail -6 | sed 's/^/    /')" mal
    malas=$((malas + 1)); rotos="$rotos $f"; continue
  fi
  pasaron=$(echo "$linea" | grep -oE '^[0-9]+'); fallaron=$(echo "$linea" | grep -oE '[0-9]+ fallaron' | grep -oE '^[0-9]+')
  total=$((total + pasaron)); malas=$((malas + fallaron))
  if [ "$fallaron" != "0" ] || [ "$codigo" != "0" ]; then
    mostrar "$(printf '✗ %-30s %s' "$f" "$linea")" mal
    mostrar "$(echo "$salida" | grep -A2 '^✗' | head -12 | sed 's/^/    /')" mal
    [ "$fallaron" = "0" ] && malas=$((malas + 1))   # dijo 0 fallas pero salió con error
    rotos="$rotos $f"
  else
    mostrar "$(printf '  %-30s %s' "$f" "$linea")" bien
  fi
done
rm -rf "$tmp" __pycache__

echo ""
minutos=$(( ($(date +%s) - inicio + 30) / 60 ))
cuantas="${#pruebas[@]} archivos"; [ "$#" -gt 0 ] && cuantas="${#pruebas[@]} archivos (solo los pedidos)"
if [ "$malas" = 0 ]; then
  echo "✓ $total comprobaciones en $cuantas, todas en verde ($minutos min)."
else
  echo "✗ $malas fallaron (de $((total + malas))):$rotos"
  exit 1
fi
