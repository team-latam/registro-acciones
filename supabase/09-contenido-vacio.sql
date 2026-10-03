-- ============================================================
-- Un evento de Calendar sin descripción no tiene contenido
-- ============================================================
-- Hasta acá el contenido de un posteo tenía que medir al menos 1, así que
-- un evento traído de Google Calendar que no trae descripción se guardaba
-- con un relleno: "Creado automáticamente desde Google Calendar." Esa
-- línea terminaba repetida en media pantalla del Feed sin decir nada.
--
-- El título y la fecha ya describen el evento. Que el contenido quede
-- vacío es correcto, y es lo que se permite acá.
--
-- Los COMENTARIOS no cambian: siguen exigiendo texto, porque un
-- comentario vacío no es un comentario.

-- ------------------------------------------------------------
-- 1. Permitir contenido vacío en los posteos
-- ------------------------------------------------------------
-- El número va escrito adentro de la restricción, así que hay que
-- rehacerla entera. Al volver a crearla Postgres revisa lo que ya está
-- guardado: pasa siempre, porque lo nuevo es más permisivo.
alter table public.posts drop constraint if exists posts_textos;
alter table public.posts
  add constraint posts_textos check (
    length(title) between 1 and 140
    and length(content) between 0 and 5000
    and length(author_name) between 1 and 120
    and length(coalesce(author_email, '')) <= 200
    and length(coalesce(organizer, '')) <= 140
    and length(coalesce(location, '')) <= 200
    and length(coalesce(project_notes, '')) <= 2000
    and length(coalesce(project_done_by, '')) <= 200
    and length(coalesce(calendar_event_id, '')) <= 200
    and length(coalesce(last_edited_by, '')) <= 120
  );

-- ------------------------------------------------------------
-- 2. Sacar el relleno de los que ya lo tienen
-- ------------------------------------------------------------
-- Se compara con el texto COMPLETO, no se busca adentro: así no hay forma
-- de comerle una frase a alguien que la haya escrito de verdad en medio de
-- un texto más largo. Y en los cuatro idiomas, porque se guardaba en el
-- que tuviera puesto quien hizo entrar el evento.
--
-- Esto corre en cada aplicación del esquema y es inofensivo repetirlo: la
-- segunda vez no encuentra ninguna fila.
update public.posts
   set content = ''
 where btrim(content) in (
   'Creado automáticamente desde Google Calendar.',
   'Automatically created from Google Calendar.',
   'Criado automaticamente a partir do Google Calendar.',
   '.נוצר אוטומטית מ-Google Calendar'
 );
