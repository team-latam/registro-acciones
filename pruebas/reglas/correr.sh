#!/bin/bash
# ============================================================
# firestore.rules contra el emulador de Firestore.
# ============================================================
# Uso:  ./pruebas/reglas/correr.sh            (desde cualquier lado)
#
# Levanta el emulador (Java), corre reglas_test.mjs y lo apaga. Sale con
# código 1 si falla aunque sea una comprobación.
#
# Para comprobar que una prueba nueva DE VERDAD falla contra reglas rotas:
#   REGLAS=/ruta/a/otra/copia.rules ./pruebas/reglas/correr.sh
# ============================================================
set -u
cd "$(dirname "$0")"

# La versión de la CLI va fija: es la que levanta el emulador, y un
# emulador nuevo puede evaluar distinto.
FIREBASE_TOOLS="firebase-tools@15.32.1"

[ -d node_modules/@firebase/rules-unit-testing ] || npm ci --no-audit --no-fund >/dev/null || {
  echo "✗ No se pudieron instalar las dependencias (npm ci en pruebas/reglas)"; exit 2; }
command -v java >/dev/null || { echo "✗ El emulador de Firestore necesita Java (11 o más nuevo)"; exit 2; }

# En el sandbox de Claude Code se puede apuntar a una CLI ya bajada con
# FIREBASE_BIN; si no, npx la baja (y la deja en caché).
if [ -n "${FIREBASE_BIN:-}" ]; then FB="$FIREBASE_BIN"; else FB="npx -y $FIREBASE_TOOLS"; fi

salida="$(timeout 600 $FB emulators:exec --only firestore --project demo-registro "node reglas_test.mjs" 2>&1)"; codigo=$?
# Del emulador solo interesa si no arrancó; de la prueba, todo.
echo "$salida" | grep -vE "DeprecationWarning|trace-deprecation|punycode|MOTD|EAFNOSUPPORT|is available on 127.0.0.1 but not|consider switching to a different port|^i  |^✔  |websocket|multiple databases|rules file specified|default to allowing all|^Error: Script|exited unsuccessfully"
exit $codigo
