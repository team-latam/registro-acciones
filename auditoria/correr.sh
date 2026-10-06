#!/bin/bash
# ============================================================
# Corre las herramientas de la auditoría y arma el informe.
# ============================================================
# Uso:  ./auditoria/correr.sh            todo (unos 15 minutos)
#       RAPIDO=1 ./auditoria/correr.sh   sin las combinaciones lentas
#
# Deja todo en auditoria/salida/<fecha>/ (no se versiona): un .json por
# herramienta, pruebas.txt y informe.md. El informe es la materia prima
# de la auditoría (ver METODO.md), no la auditoría.
#
# A diferencia de pruebas/correr.sh, esto NO falla: busca problemas
# nuevos y los anota. Lo que se arregla se protege después con una prueba.
# ============================================================
set -u
CARPETA="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$CARPETA/.." && pwd)"
export SALIDA="${SALIDA:-$CARPETA/salida/$(date -u +%Y-%m-%d_%H%M)}"
mkdir -p "$SALIDA"
echo "Auditoría → $SALIDA"

{
  echo "· App:"; "$RAIZ/pruebas/correr.sh" 2>&1 | tail -1
  echo "· Calendar:"; bash "$RAIZ/supabase/sync-calendar/pruebas/correr.sh" 2>&1 | tail -1
  echo "· Copias:"; bash "$RAIZ/supabase/respaldo/pruebas/correr.sh" 2>&1 | tail -1
  if command -v psql >/dev/null && [ -x /usr/lib/postgresql/16/bin/pg_ctl ]; then
    echo "· Base de datos:"
    bash "$RAIZ/supabase/pruebas/levantar.sh" >/dev/null 2>&1 \
      && bash "$RAIZ/supabase/pruebas/correr.sh" "postgresql:///registro?host=/var/run/postgresql&user=postgres" 2>&1 | tail -1
  else
    echo "· Base de datos: sin Postgres local (la corre GitHub en «Base de datos»)"
  fi
} > "$SALIDA/pruebas.txt" 2>&1
cat "$SALIDA/pruebas.txt"

for h in textos codigo seguridad; do node "$CARPETA/herramientas/$h.mjs"; done
if [ "${RAPIDO:-}" = "1" ]; then
  AUDITORIA_PANTALLAS="1280x800:es,390x844:es,390x844:he" node "$CARPETA/herramientas/pantallas.mjs"
  AUDITORIA_VOLUMEN=400 node "$CARPETA/herramientas/datos.mjs"
else
  node "$CARPETA/herramientas/pantallas.mjs"
  node "$CARPETA/herramientas/datos.mjs"
  # Una segunda semilla: otro azar destapa otras cosas.
  AUDITORIA_SEMILLA=$(( $(date +%s) % 100000 )) AUDITORIA_VOLUMEN=800 SALIDA="$SALIDA/semilla2" node "$CARPETA/herramientas/datos.mjs"
  [ -f "$SALIDA/semilla2/datos.json" ] && cp "$SALIDA/semilla2/datos.json" "$SALIDA/datos-semilla2.json"
fi
node "$CARPETA/herramientas/informe.mjs"
