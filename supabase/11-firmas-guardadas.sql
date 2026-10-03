-- ============================================================
-- Las fotos guardadas con su firma en vez de su ruta
-- ============================================================
-- Hasta el 2 de octubre, editar un posteo en Supabase podía guardar en la
-- fila la URL FIRMADA de una foto en lugar de su ruta (ver «Subir a
-- Supabase no puede perder la mitad del archivo» en pruebas/sb_test.mjs).
-- La firma vence a las horas: esas fotos se ven rotas desde entonces. Y
-- la limpieza semanal del bucket no las reconocería como usadas —la fila
-- no nombra su ruta— y las mandaría a la papelera.
--
-- La ruta está adentro de la firma (…/object/sign/adjuntos/<ruta>?token=…):
-- se saca de ahí y se guarda donde tenía que estar. De los adjuntos, la
-- ruta nunca se perdió; solo quedó al lado una copia de la firma vencida
-- (dataUrl), que la app no necesita guardada: la arma al leer.
--
-- Solo corrige datos, y repetirlo no cambia nada: la segunda vez no
-- encuentra ninguna fila.
update public.posts p set images = (
  select array_agg(regexp_replace(x, '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/adjuntos/([^?]+)(\?.*)?$', '\1') order by i)
    from unnest(p.images) with ordinality as u(x, i))
 where exists (select 1 from unnest(p.images) x
                where x ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/adjuntos/');

update public.replies r set images = (
  select array_agg(regexp_replace(x, '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/adjuntos/([^?]+)(\?.*)?$', '\1') order by i)
    from unnest(r.images) with ordinality as u(x, i))
 where exists (select 1 from unnest(r.images) x
                where x ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/sign/adjuntos/');

update public.posts p set files = (
  select jsonb_agg(case when f ->> 'dataUrl' like 'https://%' then f - 'dataUrl' else f end order by i)
    from jsonb_array_elements(p.files) with ordinality as u(f, i))
 where exists (select 1 from jsonb_array_elements(p.files) f where f ->> 'dataUrl' like 'https://%');

update public.replies r set files = (
  select jsonb_agg(case when f ->> 'dataUrl' like 'https://%' then f - 'dataUrl' else f end order by i)
    from jsonb_array_elements(r.files) with ordinality as u(f, i))
 where exists (select 1 from jsonb_array_elements(r.files) f where f ->> 'dataUrl' like 'https://%');
