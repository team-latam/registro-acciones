\set QUIET on
-- Brújula (30-brujula.sql): el catálogo de carpetas, los paquetes y las planillas.
-- Es solo del admin, tiene la forma que se acordó y los ID privados no se pueden
-- inventar con cualquier cosa. Todo con gente inventada.
truncate lab.resultados;
truncate public.brujula_paquete_carpetas, public.brujula_paquetes, public.brujula_carpetas, public.brujula_planillas;
truncate public.members cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana', 'ana', 'member'),
  ('olga@x.com', 'Olga', 'olga', 'observer'), ('otra.admin@x.com', 'Otra', 'otra', 'admin'),
  ('fina@x.com', 'Fina', 'fina', 'finance');

-- Hacer algo como una persona y que QUEDE: el rol y la sesión se ponen, se corre la
-- sentencia y se vuelve a lo de siempre. Devuelve el resultado o «error: …».
create or replace function lab.hacer(quien jsonb, sentencia text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', quien::text, true);
  execute sentencia into r;
  execute 'reset role';
  return r;
exception when others then
  execute 'reset role';
  return 'error: ' || left(sqlerrm, 200);
end $$;

-- Lo mismo, sin sesión (anon).
create or replace function lab.hacer_anon(sentencia text) returns text language plpgsql as $$
declare r text;
begin
  execute 'set local role anon';
  execute sentencia into r;
  execute 'reset role';
  return r;
exception when others then
  execute 'reset role';
  return 'error: ' || left(sqlerrm, 200);
end $$;

-- ---------- Quién puede gestionar Brújula ----------
select lab.comprobar('el admin fijo puede gestionar Brújula',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'true');
select lab.comprobar('un admin por rol también',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'true');
select lab.comprobar('una integrante, no',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'false');
select lab.comprobar('un observador, no',
  $q$select lab.hacer(lab.como('olga@x.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'false');
select lab.comprobar('Finanzas, no (no es admin)',
  $q$select lab.hacer(lab.como('fina@x.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'false');
select lab.comprobar('alguien de afuera, no',
  $q$select lab.hacer(lab.como('afuera@x.com'), $x$select public.puede_gestionar_brujula()::text$x$)$q$, 'false');

-- ---------- Las carpetas: sumar, ver, cambiar ----------
select lab.comprobar('el admin suma una carpeta con su ID de Drive',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, nombre_drive, orden) values ('1AbCdEfGhIjKlMnOp', 'Material 2027', 'Material 2027 📚', 1) returning id$x$)$q$, '1AbCdEfGhIjKlMnOp');
select lab.comprobar('…y la base pone quién la sumó (no lo que diga la app)',
  $q$select creada_por from public.brujula_carpetas where id = '1AbCdEfGhIjKlMnOp'$q$, 'benny@team-latam.com');
select lab.comprobar('quien la suma no puede escribir «creada_por» a mano',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, creada_por) values ('2ZyXwVuTsRqPoNmLk', 'Otra', 'otra@x.com') returning id$x$)$q$, 'error: permission denied for table brujula_carpetas');
select lab.comprobar('una carpeta nueva queda activa y sin planillas',
  $q$select activa || '|' || cardinality(planillas) from public.brujula_carpetas where id = '1AbCdEfGhIjKlMnOp'$q$, 'true|0');
select lab.comprobar('un admin por rol la puede cambiar (nombre y orden)',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$update public.brujula_carpetas set nombre = 'Material del año', orden = 3 where id = '1AbCdEfGhIjKlMnOp' returning nombre$x$)$q$, 'Material del año');
select lab.comprobar('…y desactivarla',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$update public.brujula_carpetas set activa = false where id = '1AbCdEfGhIjKlMnOp' returning activa::text$x$)$q$, 'false');
select lab.comprobar('el ID de Drive no se puede cambiar después',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$update public.brujula_carpetas set id = '9QqWwEeRrTtYyUuIi' where id = '1AbCdEfGhIjKlMnOp' returning id$x$)$q$, 'error: permission denied for table brujula_carpetas');

-- Quien no es admin no la ve ni la toca.
select lab.comprobar('una integrante no ve ninguna carpeta',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.brujula_carpetas$x$)$q$, '0');
select lab.comprobar('un observador no ve ninguna carpeta',
  $q$select lab.hacer(lab.como('olga@x.com'), $x$select count(*)::text from public.brujula_carpetas$x$)$q$, '0');
select lab.comprobar('Finanzas no ve ninguna carpeta',
  $q$select lab.hacer(lab.como('fina@x.com'), $x$select count(*)::text from public.brujula_carpetas$x$)$q$, '0');
select lab.comprobar('alguien de afuera no ve ninguna carpeta',
  $q$select lab.hacer(lab.como('afuera@x.com'), $x$select count(*)::text from public.brujula_carpetas$x$)$q$, '0');
select lab.comprobar('una integrante no puede sumar una carpeta',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.brujula_carpetas(id, nombre) values ('3KkJjHhGgFfDdSsAa', 'Mía') returning id$x$)$q$, 'error: new row violates row-level security policy for table "brujula_carpetas"');
select lab.comprobar('una integrante no puede cambiarla (no encuentra ninguna fila)',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$with c as (update public.brujula_carpetas set nombre = 'Hackeada' returning 1) select count(*)::text from c$x$)$q$, '0');
select lab.comprobar('una integrante no puede borrarla (no encuentra ninguna fila)',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$with c as (delete from public.brujula_carpetas returning 1) select count(*)::text from c$x$)$q$, '0');
select lab.comprobar('…y la carpeta sigue ahí con su nombre',
  $q$select nombre from public.brujula_carpetas where id = '1AbCdEfGhIjKlMnOp'$q$, 'Material del año');
select lab.comprobar('sin sesión (anon) no se llega a la tabla',
  $q$select lab.hacer_anon($x$select count(*)::text from public.brujula_carpetas$x$)$q$, 'error: permission denied for table brujula_carpetas');

-- ---------- La forma ----------
select lab.comprobar('un link entero no es un ID: no entra',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre) values ('https://drive.google.com/drive/folders/abc', 'X') returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('un ID muy corto, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre) values ('abc', 'X') returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('un nombre vacío, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre) values ('4AaBbCcDdEeFfGgHh', '   ') returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('un nombre de más de 120 letras, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre) values ('4AaBbCcDdEeFfGgHh', repeat('x', 121)) returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('un orden fuera de rango, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, orden) values ('4AaBbCcDdEeFfGgHh', 'X', 5000) returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('una planilla que no tiene forma de ID, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, planillas) values ('4AaBbCcDdEeFfGgHh', 'X', array['no es un id']) returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');
select lab.comprobar('dos planillas con forma de ID, sí',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, planillas) values ('4AaBbCcDdEeFfGgHh', 'Dos planillas', array['PlanillaUnoAbCdEf', 'PlanillaDosGhIjKl']) returning cardinality(planillas)::text$x$)$q$, '2');
select lab.comprobar('más de 10 planillas, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_carpetas(id, nombre, planillas) values ('5BbCcDdEeFfGgHhIi', 'X', (select array_agg('Planilla' || lpad(g::text, 8, '0')) from generate_series(1, 11) g)) returning id$x$)$q$, 'error: new row for relation "brujula_carpetas" violates check constraint "brujula_carpetas_forma"');

-- ---------- Las planillas ----------
select lab.comprobar('el admin suma una planilla con su ID',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_planillas(id, nombre, orden) values ('PlanillaUnoAbCdEf', 'Users Brújula Cloud', 1) returning nombre$x$)$q$, 'Users Brújula Cloud');
select lab.comprobar('una integrante no ve las planillas',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select count(*)::text from public.brujula_planillas$x$)$q$, '0');
select lab.comprobar('una integrante no puede sumar una planilla',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$insert into public.brujula_planillas(id, nombre) values ('PlanillaTresMnOpQr', 'X') returning id$x$)$q$, 'error: new row violates row-level security policy for table "brujula_planillas"');
select lab.comprobar('un nombre de planilla vacío, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_planillas(id, nombre) values ('PlanillaTresMnOpQr', '') returning id$x$)$q$, 'error: new row for relation "brujula_planillas" violates check constraint "brujula_planillas_forma"');

-- ---------- Los paquetes ----------
select lab.comprobar('el admin arma un paquete',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_paquetes(nombre, orden) values ('Todo Brújula', 1) returning nombre$x$)$q$, 'Todo Brújula');
select lab.comprobar('dos paquetes con el mismo nombre (aunque cambien las mayúsculas), no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_paquetes(nombre) values ('  TODO brújula ') returning nombre$x$)$q$, 'error: duplicate key value violates unique constraint "brujula_paquetes_nombre"');
select lab.comprobar('le suma una carpeta al paquete',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_paquete_carpetas(paquete, carpeta) select id, '1AbCdEfGhIjKlMnOp' from public.brujula_paquetes where nombre = 'Todo Brújula' returning carpeta$x$)$q$, '1AbCdEfGhIjKlMnOp');
select lab.comprobar('la misma carpeta dos veces en el mismo paquete, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_paquete_carpetas(paquete, carpeta) select id, '1AbCdEfGhIjKlMnOp' from public.brujula_paquetes where nombre = 'Todo Brújula' returning carpeta$x$)$q$, 'error: duplicate key value violates unique constraint "brujula_paquete_carpetas_paquete_carpeta_key"');
select lab.comprobar('una carpeta que no existe, no',
  $q$select lab.hacer(lab.como('benny@team-latam.com'), $x$insert into public.brujula_paquete_carpetas(paquete, carpeta) select id, '9NoExisteAbCdEfGh' from public.brujula_paquetes where nombre = 'Todo Brújula' returning carpeta$x$)$q$, 'error: insert or update on table "brujula_paquete_carpetas" violates foreign key constraint "brujula_paquete_carpetas_carpeta_fkey"');
select lab.comprobar('una integrante no ve los paquetes ni lo que tienen',
  $q$select lab.hacer(lab.como('ana@x.com'), $x$select (select count(*) from public.brujula_paquetes)::text || '/' || (select count(*) from public.brujula_paquete_carpetas)::text$x$)$q$, '0/0');
select lab.comprobar('si se borra la carpeta, sale de los paquetes (y el paquete queda)',
  $q$select lab.hacer(lab.como('otra.admin@x.com'), $x$with c as (delete from public.brujula_carpetas where id = '1AbCdEfGhIjKlMnOp' returning 1) select (select count(*) from c)::text || '/' || (select count(*) from public.brujula_paquete_carpetas)::text$x$)$q$, '1/1');
-- (el «1/1» de arriba lee lo de antes de borrar: se comprueba aparte lo que quedó)
select lab.comprobar('…quedó el paquete y sin carpetas',
  $q$select (select count(*) from public.brujula_paquetes)::text || '/' || (select count(*) from public.brujula_paquete_carpetas)::text$q$, '1/0');

-- ---------- Nada se publica sin querer ----------
select lab.comprobar('las cuatro tablas tienen la seguridad por filas prendida',
  $q$select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in ('brujula_planillas', 'brujula_carpetas', 'brujula_paquetes', 'brujula_paquete_carpetas') and c.relrowsecurity$q$, '4');
select lab.comprobar('ninguna de las cuatro se publica por el tiempo real (no hace falta y llevaría los ID)',
  $q$select count(*)::text from pg_publication_tables where pubname = 'supabase_realtime' and tablename like 'brujula%'$q$, '0');

drop function lab.hacer(jsonb, text);
drop function lab.hacer_anon(text);
\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
