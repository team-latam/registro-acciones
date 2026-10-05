\set QUIET on
truncate lab.resultados;
truncate public.posts, public.replies, public.app_config, public.audit_log cascade;

-- ============================================================
-- Los títulos, sin el tipo pegado adelante (14-titulos-sin-tipo.sql)
-- ============================================================
insert into public.app_config(key, value) values
  ('preferences', '{"activityTypes":[{"key":"taller","label":"Taller"},{"key":"curso","label":"Curso"}]}');
insert into public.posts(id,title,content,date,start_date,end_date,activity_type,author_name,author_email,last_edited_at) values
  ('t1','Curso: Curso de Moda','','2022-02-27','2022-02-27','2022-03-02','curso','Benny','benny@team-latam.com',null),
  ('t2','Visita: Visita: Quintana Roo','','2025-01-10','2025-01-10','2025-01-10','otro','Google Calendar','',null),
  ('t3','Course: Team Leader','','2026-05-25','2026-05-25','2026-05-31','curso','Benny','benny@team-latam.com',null),
  ('t4','Cursos de verano','','2026-01-10','2026-01-10','2026-01-10','curso','Benny','benny@team-latam.com',null),
  ('t5','Curso:','','2026-01-10','2026-01-10','2026-01-10','curso','Benny','benny@team-latam.com',null),
  ('t6','Taller: Fotografía','','2026-01-10','2026-01-10','2026-01-10','taller','Benny','benny@team-latam.com',null),
  ('t7','Reunión: equipo','','2026-01-10','2026-01-10','2026-01-10','otro','Benny','benny@team-latam.com',null),
  ('t8','קורס: מדריכים','','2026-01-10','2026-01-10','2026-01-10','curso','Benny','benny@team-latam.com',null);

select public.limpiar_tipo_en_titulos();

insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'se saca el tipo de adelante, aunque esté repetido, en cualquier idioma y con los tipos del admin', true,
       array_agg(title order by id) = array['Curso de Moda','Quintana Roo','Team Leader','Cursos de verano','Curso:','Fotografía','Reunión: equipo','מדריכים'],
       array_to_string(array_agg(title order by id), ' | ')
  from public.posts;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'no cuenta como edición (la fecha de edición no cambia)', true, count(*) = 0, count(*)::text
  from public.posts where last_edited_at is not null;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'correrlo de nuevo no encuentra nada', true, public.limpiar_tipo_en_titulos() = 0, '';
select lab.probar('nadie la puede llamar desde la app', lab.como('benny@team-latam.com'),
  $q$select public.limpiar_tipo_en_titulos()$q$, false);

\set QUIET off
select n, '  FALLA  ' || nombre as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
