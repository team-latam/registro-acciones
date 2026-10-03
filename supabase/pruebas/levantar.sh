#!/bin/bash
# El servidor local se apaga solo entre tandas; esto lo vuelve a levantar y
# reconstruye la base desde cero con todo el esquema.
BIN=/usr/lib/postgresql/16/bin
su postgres -c "$BIN/pg_ctl -D /pgdata -o '-k /var/run/postgresql -h \"\"' -l /pgdata/log status" >/dev/null 2>&1 || \
  su postgres -c "$BIN/pg_ctl -D /pgdata -o '-k /var/run/postgresql -h \"\"' -l /pgdata/log start" >/dev/null 2>&1
for i in 1 2 3 4 5; do su postgres -c "$BIN/pg_isready -h /var/run/postgresql -q" && break; sleep 1; done
su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -tAc 'drop database if exists registro;'" >/dev/null
su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -tAc 'create database registro;'" >/dev/null
R=/home/user/registro-acciones/supabase
# Con comodín y no con una lista a mano: estaba escrita hasta el 06, así
# que 07, 08 y 09 nunca entraban a la base de prueba y las pruebas corrían
# contra un esquema viejo sin que nadie se enterara. Mismo criterio que
# aplicar.sh.
# El laboratorio, también del repo: antes leía una copia guardada aparte
# (/pglab/00-lab.sql) que nadie actualizaba.
for f in $R/pruebas/00-laboratorio.sql $R/[0-9][0-9]-*.sql; do
  [ -f "$f" ] || continue
  out=$(su postgres -c "$BIN/psql -h /var/run/postgresql -U postgres -d registro -q -v ON_ERROR_STOP=1 -f $f" 2>&1 | grep -i "error")
  [ -n "$out" ] && { echo "FALLÓ $f"; echo "$out" | head -5; exit 1; }
done
echo "base lista"
