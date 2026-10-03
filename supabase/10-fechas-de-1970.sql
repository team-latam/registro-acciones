-- ============================================================
-- Lo que el sincronizador nocturno haya fechado en 1970
-- ============================================================
-- El sincronizador escribe con la llave de servicio y manda la MARCA
-- 1/1/1970 («poné vos la hora»). Hasta el 3 de octubre los disparadores
-- de la hora se hacían a un lado con esa llave, así que la marca quedaba
-- guardada tal cual (ver hora_del_servidor en 03 y posts_marca_de_hora en
-- 04, que ya la reemplazan).
--
-- Esto corrige lo que haya quedado así de antes. La fecha real de
-- creación no se guardó en ningún lado, así que se usa la más razonable:
--   - un posteo, el día del evento: queda ordenado entre los de su fecha y
--     no aparece como «nuevo» para nadie;
--   - un comentario de sistema y una edición, ahora: es lo último que pasó.
--
-- Corre en cada aplicación del esquema y es inofensivo repetirlo: la
-- segunda vez no encuentra ninguna fila.
update public.posts   set created_at     = start_date::timestamptz where created_at     = 'epoch';
update public.posts   set last_edited_at = now()                   where last_edited_at = 'epoch';
update public.replies set created_at     = now()                   where created_at     = 'epoch';
