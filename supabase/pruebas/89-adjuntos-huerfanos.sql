\set QUIET on
-- ============================================================
-- Qué archivos del bucket ya no nombra nadie (04-funciones.sql)
-- ============================================================
-- La limpieza semanal (supabase/limpieza/) mueve a la papelera lo que esta
-- función dice que sobra. Si la cuenta sale mal, se mueven fotos que se
-- están usando: por eso se prueba sobre todo lo que NO tiene que aparecer.
truncate lab.resultados;
truncate public.posts, public.replies cascade;
delete from storage.objects;
insert into storage.buckets (id, name) values ('otro', 'otro') on conflict (id) do nothing;

insert into public.posts (id, title, content, date, start_date, end_date, activity_type, author_name, author_email,
                          images, files)
values ('p1', 'Con fotos', 'C', '2026-09-10', '2026-09-10', '2026-09-10', 'visita', 'Ana', 'ana@x.com',
        array['posts/p1/img0_1.jpg'],
        '[{"name":"plan.pdf","path":"posts/p1/arch0_1.pdf","doc":"plan"}]');
insert into public.replies (id, post_id, content, author_name, author_email, images, files)
values ('r1', 'p1', 'hola', 'Juan', 'juan@x.com', array['replies/r1/img0_1.png'],
        '[{"name":"nota.m4a","path":"replies/r1/arch0_1.m4a"}]');

-- Viejos: de hace diez días. Nuevo: de recién.
insert into storage.objects (bucket_id, name, created_at) values
  ('adjuntos', 'posts/p1/img0_1.jpg',      now() - interval '10 days'),  -- la foto del posteo
  ('adjuntos', 'posts/p1/img0_1.min.jpg',  now() - interval '10 days'),  -- su miniatura
  ('adjuntos', 'posts/p1/arch0_1.pdf',     now() - interval '10 days'),  -- su adjunto
  ('adjuntos', 'replies/r1/img0_1.png',    now() - interval '10 days'),  -- la foto del comentario
  ('adjuntos', 'replies/r1/img0_1.min.jpg', now() - interval '10 days'), -- y su miniatura (de un .png)
  ('adjuntos', 'replies/r1/arch0_1.m4a',   now() - interval '10 days'),  -- la nota de voz
  ('adjuntos', 'posts/p1/img1_1.jpg',      now() - interval '10 days'),  -- una foto que se quitó
  ('adjuntos', 'posts/p1/img1_1.min.jpg',  now() - interval '10 days'),  -- y su miniatura
  ('adjuntos', 'posts/p_borrado/img0.jpg', now() - interval '10 days'),  -- la de un posteo borrado
  ('adjuntos', 'posts/p3/img0_9.jpg',      now() - interval '1 hour'),   -- recién subida, sin fila todavía
  ('otro',     'posts/p1/huerfano.jpg',    now() - interval '10 days'),  -- de otro bucket
  ('adjuntos', 'papelera/' || to_char(now() - interval '40 days', 'YYYY-MM-DD') || '/posts/x/img0.jpg', now() - interval '60 days'),
  ('adjuntos', 'papelera/' || to_char(now() - interval '3 days', 'YYYY-MM-DD') || '/posts/y/img0.jpg', now() - interval '60 days'),
  ('adjuntos', 'papelera/2026-02-30/posts/z/img0.jpg', now() - interval '60 days'),       -- una fecha que no existe
  ('adjuntos', 'papelera/sin-fecha/img0.jpg', now() - interval '60 days');
\set QUIET off

select lab.probar_valor_servicio('sobra lo que ninguna fila nombra: la foto quitada, su miniatura, y lo de un posteo borrado',
  'select 1', $q$select (public.limpieza_del_bucket() -> 'huerfanos')::text$q$,
  '["posts/p1/img1_1.jpg", "posts/p1/img1_1.min.jpg", "posts/p_borrado/img0.jpg"]');
select lab.probar_valor_servicio('una foto, su miniatura y los adjuntos que se usan NO sobran',
  'select 1', $q$select count(*)::text from jsonb_array_elements_text(public.limpieza_del_bucket() -> 'huerfanos') h
     where h in ('posts/p1/img0_1.jpg', 'posts/p1/img0_1.min.jpg', 'posts/p1/arch0_1.pdf',
                 'replies/r1/img0_1.png', 'replies/r1/img0_1.min.jpg', 'replies/r1/arch0_1.m4a')$q$, '0');
select lab.probar_valor_servicio('lo recién subido no sobra todavía: su fila se escribe después',
  'select 1', $q$select case when (public.limpieza_del_bucket() -> 'huerfanos') ? 'posts/p3/img0_9.jpg' then 'sobra' else 'no' end$q$, 'no');
select lab.probar_valor_servicio('ni con cero días de gracia: el mínimo es uno',
  'select 1', $q$select case when (public.limpieza_del_bucket(0) -> 'huerfanos') ? 'posts/p3/img0_9.jpg' then 'sobra' else 'no' end$q$, 'no');
select lab.probar_valor_servicio('lo de otro bucket no se mira',
  'select 1', $q$select case when (public.limpieza_del_bucket() -> 'huerfanos') ? 'posts/p1/huerfano.jpg' then 'sobra' else 'no' end$q$, 'no');
select lab.probar_valor_servicio('lo que ya está en la papelera no vuelve a sobrar',
  'select 1', $q$select count(*)::text from jsonb_array_elements_text(public.limpieza_del_bucket() -> 'huerfanos') h
     where h like 'papelera/%'$q$, '0');
select lab.probar_valor_servicio('el total cuenta todo el bucket menos la papelera (para el tope)',
  'select 1', $q$select (public.limpieza_del_bucket() ->> 'total')$q$, '10');

select lab.probar_valor_servicio('de la papelera se borra lo que lleva más de 30 días',
  'select 1', $q$select jsonb_array_length(public.limpieza_del_bucket() -> 'vencidos') || ' / ' ||
     ((public.limpieza_del_bucket() -> 'vencidos') ->> 0 like '%/posts/x/img0.jpg')$q$, '1 / true');
select lab.probar_valor_servicio('y nunca lo de menos de una semana, aunque se pida',
  'select 1', $q$select jsonb_array_length(public.limpieza_del_bucket(2, 0) -> 'vencidos')::text$q$, '1');
select lab.probar_valor_servicio('una fecha que no existe en el nombre no rompe nada (ni se borra)',
  'select 1', $q$select count(*)::text from jsonb_array_elements_text(public.limpieza_del_bucket(2, 7) -> 'vencidos') v
     where v like 'papelera/2026-02-30/%' or v like 'papelera/sin-fecha/%'$q$, '0');
select lab.probar_valor_servicio('para devolver lo movido un día, dice qué se movió ese día',
  'select 1', $q$select ((public.limpieza_del_bucket(2, 30, (now() - interval '3 days')::date) -> 'restaurar' ->> 0) like '%/posts/y/img0.jpg')::text
     || ' / ' || jsonb_array_length(public.limpieza_del_bucket(2, 30, (now() - interval '3 days')::date) -> 'restaurar')$q$, 'true / 1');
select lab.probar_valor_servicio('sin fecha, no hay nada que devolver',
  'select 1', $q$select (public.limpieza_del_bucket() -> 'restaurar')::text$q$, '[]');

-- Lee el bucket y todas las filas por encima de las políticas: nadie más
-- que la llave de servicio.
select lab.probar_valor('ni el admin fijo la puede llamar desde el navegador', lab.como('benny@team-latam.com'),
  'select 1', $q$select public.limpieza_del_bucket()::text$q$, 'permission denied for function limpieza_del_bucket');
select lab.probar_valor('ni alguien de afuera', lab.como('intruso@x.com'),
  'select 1', $q$select public.limpieza_del_bucket()::text$q$, 'permission denied for function limpieza_del_bucket');

\set QUIET on
delete from storage.objects;
\set QUIET off
select n, '  FALLA  ' || nombre || ' — ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado=obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado<>obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado from lab.resultados;
