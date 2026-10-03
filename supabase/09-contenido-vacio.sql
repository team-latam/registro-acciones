-- ============================================================
-- Un evento de Calendar sin descripción no tiene contenido
-- ============================================================
-- Hasta el 3 de octubre el contenido de un posteo tenía que medir al menos
-- 1, así que un evento traído de Google Calendar sin descripción se
-- guardaba con un relleno: "Creado automáticamente desde Google Calendar."
-- Esa línea terminaba repetida en media pantalla del Feed sin decir nada.
--
-- Que el contenido pueda quedar vacío lo dice la restricción, en
-- 03-validacion.sql. Acá queda solo la limpieza de lo que ya estaba
-- guardado con el relleno.
--
-- (La restricción estuvo también acá, con 0, mientras el 03 la seguía
-- definiendo con 1. Como los archivos se vuelven a aplicar en orden en
-- cada push, el 03 intentaba recrear la vieja sobre filas que ya no la
-- cumplían y el esquema dejaba de poder aplicarse. Cada restricción va en
-- UN solo lugar.)
--
-- Se compara con el texto COMPLETO, no se busca adentro: así no hay forma
-- de comerle una frase a alguien que la haya escrito de verdad en medio de
-- un texto más largo. Y en los cuatro idiomas, porque se guardaba en el
-- que tuviera puesto quien hizo entrar el evento.
--
-- Corre en cada aplicación del esquema y es inofensivo repetirlo: la
-- segunda vez no encuentra ninguna fila.
update public.posts
   set content = ''
 where btrim(content) in (
   'Creado automáticamente desde Google Calendar.',
   'Automatically created from Google Calendar.',
   'Criado automaticamente a partir do Google Calendar.',
   '.נוצר אוטומטית מ-Google Calendar'
 );
