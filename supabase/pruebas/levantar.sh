#!/bin/bash
# El servidor local se apaga solo entre tandas; esto lo vuelve a levantar y
# reconstruye la base desde cero con los cuatro archivos.
BIN=/usr/lib/postgresql/16/bin
su postgres -c "$BIN/pg_ctl -D /pgdata -o '-k /var/run/postgresql -h \"\"' -l /pgdata/log status" >/dev/null 2>&1 || \
  su postgres -c "$BIN/pg_ctl -D /pgdata -o '-k /var/run/postgresql -h \"\"' -l /pgdata/log start" >/dev/null 2>&1
for i in 1 2 3 4 5; do su postgres -c "$BIN/pg_isready -h /var/run/postgresql -q" && break; sleep 1; done
su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -tAc 'drop database if exists registro;'" >/dev/null
su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -tAc 'create database registro;'" >/dev/null
R=/home/user/registro-acciones/supabase
for f in /pglab/00-lab.sql $R/01-tablas.sql $R/02-politicas.sql $R/03-validacion.sql $R/04-funciones.sql $R/05-importar.sql; do
  [ -f "$f" ] || continue
  out=$(su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -d registro -q -v ON_ERROR_STOP=1 -f $f" 2>&1 | grep -i "error")
  [ -n "$out" ] && { echo "FALLÓ $f"; echo "$out" | head -5; exit 1; }
done
echo "base lista"
