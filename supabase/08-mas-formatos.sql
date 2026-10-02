-- ============================================================
-- Registro de Acciones — Paso 8: más formatos de adjunto
-- ============================================================
-- El bucket solo aceptaba PDF, imágenes y audio. Un reporte de viaje casi
-- nunca es un PDF: es un .docx, a veces un .txt, y los gastos vienen en
-- un .xlsx. Esto suma los formatos de oficina y de texto.
--
-- Lo que sigue AFUERA, a propósito:
--   - Cualquier cosa que el navegador pueda ejecutar o interpretar como
--     página (HTML, SVG, JS). Los archivos se sirven desde una URL
--     firmada del dominio de Supabase: no podrían tocar esta app, pero no
--     hay ninguna razón para permitirlos.
--   - Los comprimidos (.zip, .rar). No por el peso: un comprimido es una
--     bolsa, y adentro puede ir exactamente lo que esta lista deja afuera.
--     Si alguna vez hacen falta, se agregan sabiendo eso.
--   - El video, por la descarga (ver 07-adjuntos-grandes.sql).
--
-- Esta lista tiene que coincidir con TIPOS_DE_ARCHIVO de index.html y con
-- isValidFiles de firestore.rules.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/gif', 'image/webp',
         'application/pdf',
         'text/plain', 'text/markdown', 'text/csv', 'text/tab-separated-values',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.oasis.opendocument.text',
         'application/rtf', 'text/rtf',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.oasis.opendocument.spreadsheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.oasis.opendocument.presentation',
         'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
         'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/3gpp'
       ]
 where id = 'adjuntos';

-- ============================================================
-- Para comprobar que quedó bien:
-- ============================================================
--   select array_length(allowed_mime_types, 1) as cuantos_tipos
--     from storage.buckets where id = 'adjuntos';
-- ============================================================
