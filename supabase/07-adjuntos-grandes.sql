-- ============================================================
-- Registro de Acciones — Paso 7: soltar los topes de adjuntos
-- ============================================================
-- Los topes de 6 imágenes, 2 archivos y 500 KB no eran un criterio
-- nuestro: eran el techo de Firestore, que guarda el archivo ADENTRO del
-- documento del posteo, en base64, y no admite más de 1 MiB por
-- documento entero.
--
-- Acá el archivo vive en el bucket y el posteo guarda solo la ruta, así
-- que un posteo pesa lo mismo con una foto que con veinte. Este paso
-- sube los topes de la base para que acompañen a los de la app
-- (store.limites en index.html: 20 imágenes, 10 archivos, 25 MB c/u).
--
-- También le pone techo propio al bucket y una lista de tipos
-- permitidos: es lo único que puede crecer sin aviso, y una cuenta con
-- permiso de escribir no tiene por qué poder subir CUALQUIER cosa.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cuántos adjuntos entran en un posteo o comentario
-- ------------------------------------------------------------
create or replace function public.archivos_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 10) and (v is null or not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or length(coalesce(e ->> 'name', '')) > 200
       or coalesce(e ->> 'path', '') = ''
       or length(e ->> 'path') > 400
       or (e ->> 'path') like 'data:%'
       or position('..' in (e ->> 'path')) > 0))
$$;

-- ------------------------------------------------------------
-- 2. Cuántas imágenes
-- ------------------------------------------------------------
-- El número va escrito adentro de la restricción, así que hay que
-- rehacerla. Al volver a crearla, Postgres revisa lo que ya está
-- guardado: pasa siempre, porque el tope nuevo es más grande.
alter table public.posts drop constraint if exists posts_listas;
alter table public.posts
  add constraint posts_listas check (
    public.lista_ok(scopes, 15)
    and public.links_ok(links)
    and public.participantes_ok(participants)
    and public.rutas_ok(images, 20)
    and public.archivos_ok(files)
    and public.textos_ok(mentions, 10, 200)
    and public.textos_ok(editors, 20, 200)
    and public.textos_ok(liked_by, 1000, 200)
  );

alter table public.replies drop constraint if exists replies_listas;
alter table public.replies
  add constraint replies_listas check (
    public.lista_ok(scopes, 15)
    and public.links_ok(links)
    and public.rutas_ok(images, 20)
    and public.archivos_ok(files)
    and public.textos_ok(mentions, 10, 200)
    and public.textos_ok(liked_by, 1000, 200)
  );

-- ------------------------------------------------------------
-- 3. El techo del bucket
-- ------------------------------------------------------------
-- 25 MB por archivo: cómodo para un PDF o una nota de voz larga, y lejos
-- del 1 GB que da el plan. El video queda afuera a propósito por ahora
-- (no por el lugar, sino por la descarga: el plan da 5 GB por mes y un
-- video que mire todo el equipo se lo come).
update storage.buckets
   set file_size_limit    = 26214400,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/gif', 'image/webp',
         'application/pdf',
         'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
         'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/3gpp'
       ]
 where id = 'adjuntos';

-- ============================================================
-- Para comprobar que quedó bien:
-- ============================================================
--   select id, file_size_limit, allowed_mime_types from storage.buckets
--    where id = 'adjuntos';
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('posts_listas', 'replies_listas');
-- ============================================================
