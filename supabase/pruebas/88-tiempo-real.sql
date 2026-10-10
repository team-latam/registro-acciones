\set QUIET on
truncate lab.resultados;
\set QUIET off
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'las doce tablas mandan sus cambios en vivo (las ocho de siempre, personas y las tres de la Agenda)', true, count(*) = 12,
         'son ' || count(*)
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'los posteos, que es lo que más importa', true,
         bool_or(tablename='posts'), ''
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
  select 'y los comentarios', true, bool_or(tablename='replies'), ''
  from pg_publication_tables where pubname='supabase_realtime' and schemaname='public';
-- Lo que NO se manda en vivo (docs/AUDITORIA.md, R27). Publicar una tabla
-- le manda cada cambio a todo navegador suscripto, filtrado por las
-- políticas de cada uno; estas son de la base y de los trabajos con la llave
-- de servicio: nadie las lee desde la app, o las lee solo un admin. Y si
-- Supabase no filtrara bien un DELETE, estaría mandando a todos el correo
-- de los avisos, de los resúmenes, de las sugerencias o de lo sacado de
-- Calendar. Si alguna se agrega a propósito, que lo diga acá y por qué.
select lab.comprobar('los avisos ya enviados NO se publican en vivo', $q$select coalesce((select string_agg(tablename, ',') from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename = 'avisos_enviados'), 'no está')$q$, 'no está');
select lab.comprobar('ni los avisos listos para mandar (llevan los correos de los destinatarios)', $q$select coalesce((select string_agg(tablename, ',') from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename = 'avisos_listos'), 'no está')$q$, 'no está');
select lab.comprobar('ni cuándo salió el último resumen de cada uno', $q$select coalesce((select string_agg(tablename, ',') from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename = 'resumenes_enviados'), 'no está')$q$, 'no está');
select lab.comprobar('ni las sugerencias de Revisar lo de Calendar', $q$select coalesce((select string_agg(tablename, ',') from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename = 'calendar_sugerencias'), 'no está')$q$, 'no está');
select lab.comprobar('ni lo que se sacó del Registro (lleva una copia entera del posteo)', $q$select coalesce((select string_agg(tablename, ',') from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename = 'calendar_sacados'), 'no está')$q$, 'no está');
-- Y que las existen: si una de estas tablas cambiara de nombre, las cinco
-- de arriba pasarían en verde sin mirar nada.
select lab.comprobar('las cinco tablas de arriba existen (si no, esa prueba no miraba nada)', $q$select count(*)::text from pg_tables
  where schemaname='public' and tablename in ('avisos_enviados','avisos_listos','resumenes_enviados','calendar_sugerencias','calendar_sacados')$q$, '5');
select lab.comprobar('y las únicas publicadas son las doce de siempre', $q$select string_agg(tablename, ',' order by tablename) from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'$q$,
  'access_requests,agenda_listas,app_config,audit_log,contactos,former_members,instituciones,members,personas,posts,replies,user_prefs');
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
