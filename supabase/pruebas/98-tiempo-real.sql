\set QUIET on
truncate lab.resultados;
\set QUIET off
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'las ocho tablas mandan sus cambios en vivo', true, count(*) = 8,
         'son ' || count(*)
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'los posteos, que es lo que más importa', true,
         bool_or(tablename='posts'), ''
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y los comentarios', true, bool_or(tablename='replies'), ''
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
