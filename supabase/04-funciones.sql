-- ============================================================
-- Registro de Acciones — Paso 4: las dos funciones del me gusta
-- ============================================================
-- Todo lo demás la app lo puede hacer con lecturas y escrituras normales.
-- El me gusta no, por un motivo concreto: si el navegador se trajera la
-- lista, le agregara su correo y la escribiera entera, dos personas
-- dándole me gusta al mismo tiempo se pisarían — la segunda guardaría una
-- lista armada sobre una foto vieja, sin el me gusta de la primera.
--
-- En Firestore eso lo resuelve arrayUnion, que suma un elemento sin
-- traerse la lista. Acá se resuelve con estas dos funciones: la suma la
-- hace la base, en una sola operación, sobre el valor que hay en ese
-- instante.
--
-- Quién da el me gusta NO es un parámetro: sale de la credencial. Así
-- nadie puede dar me gusta en nombre de otro ni pasándolo a mano.
--
-- `security invoker` a propósito: corren con los permisos de quien llama,
-- así que siguen pasando por las políticas del paso 2. No son una puerta
-- de atrás.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

create or replace function public.me_gusta_posteo(p_id text, p_puesto boolean)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para dar me gusta'
      using errcode = 'insufficient_privilege';
  end if;
  -- El `and` del final evita escribir cuando no hay nada que cambiar (dar
  -- me gusta dos veces, o sacar uno que no estaba). Sin eso, esa escritura
  -- vacía cae en el control de edición y un me gusta repetido sobre la
  -- Rutina de otra persona terminaría rebotando con un error confuso.
  update public.posts
     set liked_by = case when p_puesto then liked_by || yo
                         else array_remove(liked_by, yo) end
   where id = p_id
     and p_puesto <> (yo = any(liked_by));
end $$;

create or replace function public.me_gusta_comentario(p_id text, p_puesto boolean)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para dar me gusta'
      using errcode = 'insufficient_privilege';
  end if;
  update public.replies
     set liked_by = case when p_puesto then liked_by || yo
                         else array_remove(liked_by, yo) end
   where id = p_id
     and p_puesto <> (yo = any(liked_by));
end $$;

grant execute on function public.me_gusta_posteo(text, boolean) to authenticated;
grant execute on function public.me_gusta_comentario(text, boolean) to authenticated;


-- ============================================================
-- La marca de "poné vos la hora"
-- ============================================================
-- Hay fechas que la app manda adentro de otra escritura: cuándo se editó
-- un posteo, cuándo se dio un hito por cumplido, cuándo se compartió el
-- Calendar. En Firestore para eso existe un valor especial que el servidor
-- reemplaza por su propio reloj al escribir; acá no hay nada parecido, y
-- el navegador solo puede mandar una fecha.
--
-- Mandar la del navegador sería aflojar algo que hoy está firme: la hora
-- de una edición no puede depender del reloj de quien edita (que puede
-- estar mal, o mentir). Así que la base la pone ella, de dos maneras
-- según el caso:
--
--   posts   -> se PISA siempre lo que haya mandado el navegador. Da igual
--              qué fecha mande: la de verdad es la de la base.
--   members -> se usa una MARCA (el 1 de enero de 1970, que no es una
--              fecha posible acá), porque esas fechas a veces hay que
--              CONSERVARLAS: la de alta de alguien no se vuelve a poner
--              cada vez que el admin entra.
--
-- Las fechas de creación no pasan por acá: esas ya las pone el servidor
-- solo, en el paso 3.

create or replace function public.posts_marca_de_hora() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  -- Sin una persona detrás (el sincronizador nocturno, con la llave de
  -- servicio) se respeta la fecha que venga, salvo la marca: si no, una
  -- edición que hacía el sincronizador quedaba fechada en 1970.
  if public.sin_sesion_de_persona() then
    if new.last_edited_at = 'epoch'  then new.last_edited_at  := now(); end if;
    if new.project_done_at = 'epoch' then new.project_done_at := now(); end if;
    return new;
  end if;

  -- Desde el navegador la hora la pone SIEMPRE la base, mire lo que mire
  -- el reloj de quien edita. No hace falta ninguna marca: da igual qué
  -- fecha mande, se ignora. Así nadie puede decir que editó algo ayer, que
  -- es exactamente la garantía que daba Firestore.
  if tg_op = 'INSERT' then
    if new.last_edited_at is not null  then new.last_edited_at  := now(); end if;
    if new.project_done_at is not null then new.project_done_at := now(); end if;
    return new;
  end if;

  if new.last_edited_at is distinct from old.last_edited_at and new.last_edited_at is not null then
    new.last_edited_at := now();
  end if;
  -- Al destildar un hito la app manda null, y eso hay que respetarlo: solo
  -- se pisa cuando se está poniendo una fecha.
  if new.project_done_at is distinct from old.project_done_at and new.project_done_at is not null then
    new.project_done_at := now();
  end if;
  return new;
end $$;

drop trigger if exists posts_marca_de_hora on public.posts;
create trigger posts_marca_de_hora before insert or update on public.posts
  for each row execute function public.posts_marca_de_hora();

-- En el roster es distinto y por eso acá SÍ se usa la marca: la fecha de
-- alta de alguien no se vuelve a poner cada vez que el admin entra (ver
-- roster.ensure en index.html, que reescribe el documento conservando la
-- fecha original). Pisarla siempre le borraría a cada uno desde cuándo
-- está en el equipo.
create or replace function public.members_marca_de_hora() returns trigger
  language plpgsql as $$
begin
  if new.approved_at = 'epoch'             then new.approved_at := now(); end if;
  if new.calendar_invite_sent_at = 'epoch' then new.calendar_invite_sent_at := now(); end if;
  if new.tour_seen_at = 'epoch'            then new.tour_seen_at := now(); end if;
  return new;
end $$;

drop trigger if exists members_marca_de_hora on public.members;
create trigger members_marca_de_hora before insert or update on public.members
  for each row execute function public.members_marca_de_hora();


-- ============================================================
-- Guardar "solo esto" sin pisar el resto
-- ============================================================
-- Las preferencias de cada persona y la configuración del equipo son un
-- bloque entero de datos donde cada control guarda UN campo. En Firestore
-- eso es merge:true y lo resuelve el servidor. Acá, si el navegador se
-- trajera el bloque, le cambiara un campo y lo escribiera entero, dos
-- controles tocados rápido se pisarían: el segundo guardaría un bloque
-- armado sobre una foto vieja y perdería el primero.
--
-- El `||` de Postgres sobre jsonb hace exactamente lo que hace merge:true,
-- y acá corre adentro de la escritura, sobre lo que hay en ese instante.
--
-- De quién son las preferencias NO es un parámetro: sale de la credencial.
-- `security invoker`: siguen pasando por las políticas del paso 2.

create or replace function public.guardar_preferencias(p_parche jsonb)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para guardar preferencias'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.user_prefs (email, prefs) values (yo, p_parche)
  on conflict (email) do update set prefs = public.user_prefs.prefs || excluded.prefs;
end $$;

create or replace function public.guardar_config(p_clave text, p_parche jsonb)
returns void language plpgsql security invoker as $$
begin
  insert into public.app_config (key, value) values (p_clave, p_parche)
  on conflict (key) do update set value = public.app_config.value || excluded.value;
end $$;

grant execute on function public.guardar_preferencias(jsonb) to authenticated;
grant execute on function public.guardar_config(text, jsonb) to authenticated;


-- ============================================================
-- Los adjuntos que ya no nombra nadie
-- ============================================================
-- Quitar una foto de un posteo, cambiarla por otra o borrar el posteo
-- entero deja el archivo en el bucket: la app no borra nunca (solo el
-- admin fijo puede, ver 02-politicas.sql). Así el bucket crece sin techo
-- —el plan trae 1 GB— y un archivo quitado se sigue pudiendo abrir con su
-- ruta.
--
-- Esto dice qué limpiar, y lo limpia el trabajo semanal de
-- supabase/limpieza/, por la API del bucket: borrar acá, de la tabla,
-- dejaría el archivo guardado igual. Devuelve:
--
--   total      cuántos archivos hay (sin contar la papelera), para que el
--              trabajo frene si lo que hay que mover es demasiado;
--   huerfanos  los que ninguna fila nombra —ni como foto, ni como
--              adjunto, ni como miniatura de una foto que sí está— y
--              tienen más de p_gracia días: un archivo se sube ANTES de
--              escribir la fila que lo nombra, y en ese rato parece
--              huérfano;
--   vencidos   lo que lleva más de p_papelera días en la papelera: eso sí
--              se borra de verdad;
--   restaurar  si se pide una fecha, lo que la limpieza movió ese día,
--              para devolverlo a su lugar.
--
-- Solo la puede usar la llave de servicio: lee el bucket y todas las
-- filas por encima de las políticas.
create or replace function public.fecha_de_papelera(nombre text) returns date
  language plpgsql immutable set search_path = '' as $$
begin
  if nombre !~ '^papelera/\d{4}-\d{2}-\d{2}/' then return null; end if;
  return substr(nombre, 10, 10)::date;
exception when others then return null;   -- una fecha que no existe
end $$;

-- Lo «sacado del Registro» (12-revisar-calendar.sql) guarda una copia del
-- posteo en calendar_sacados.fila, para poder devolverlo. Sus archivos
-- también cuentan como usados: antes la limpieza los mandaba a la
-- papelera el domingo siguiente y a los 30 días se borraban, y «Devolver
-- al Registro» lo devolvía con las fotos rotas (docs/AUDITORIA.md, I4).
-- Esa tabla se crea recién en el 12: en una base vacía todavía no existe
-- cuando se aplica este archivo, así que acá no se revisa el cuerpo de la
-- función al crearla (se usa cuando ya está todo aplicado).
set check_function_bodies = off;
create or replace function public.limpieza_del_bucket(
  p_gracia integer default 2, p_papelera integer default 30, p_restaurar date default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with nombrados as (
    select unnest(p.images) as ruta from public.posts p
    union all select a ->> 'path' from public.posts p, jsonb_array_elements(p.files) a
    union all select unnest(r.images) from public.replies r
    union all select a ->> 'path' from public.replies r, jsonb_array_elements(r.files) a
    union all select x from public.calendar_sacados s,
      jsonb_array_elements_text(case when jsonb_typeof(s.fila -> 'images') = 'array' then s.fila -> 'images' else '[]'::jsonb end) x
    union all select a ->> 'path' from public.calendar_sacados s,
      jsonb_array_elements(case when jsonb_typeof(s.fila -> 'files') = 'array' then s.fila -> 'files' else '[]'::jsonb end) a
  ), usados as (
    select ruta from nombrados where ruta is not null
    union
    select regexp_replace(ruta, '\.[A-Za-z0-9]+$', '') || '.min.jpg' from nombrados where ruta is not null
  ), objetos as (
    select o.name, o.created_at from storage.objects o where o.bucket_id = 'adjuntos'
  )
  select jsonb_build_object(
    'total', (select count(*) from objetos where name not like 'papelera/%'),
    'huerfanos', coalesce((select jsonb_agg(o.name order by o.name) from objetos o
        where o.name not like 'papelera/%'
          and o.created_at < now() - make_interval(days => greatest(p_gracia, 1))
          and not exists (select 1 from usados u where u.ruta = o.name)), '[]'::jsonb),
    'vencidos', coalesce((select jsonb_agg(o.name order by o.name) from objetos o
        where public.fecha_de_papelera(o.name) < (now() at time zone 'utc')::date - greatest(p_papelera, 7)), '[]'::jsonb),
    'restaurar', coalesce((select jsonb_agg(o.name order by o.name) from objetos o
        where p_restaurar is not null and public.fecha_de_papelera(o.name) = p_restaurar), '[]'::jsonb))
$$;
reset check_function_bodies;

-- En Supabase toda función nueva de `public` se puede llamar de entrada
-- desde el navegador: hay que sacárselo explícitamente.
revoke execute on function public.limpieza_del_bucket(integer, integer, date) from public, anon, authenticated;
grant execute on function public.limpieza_del_bucket(integer, integer, date) to service_role;

-- Cuánto hay en el bucket: cuántos archivos y cuánto pesan, sin la
-- papelera. Para Administración (el medidor del GB del plan gratis, y el
-- aviso antes de bajar una copia completa, que baja todo eso;
-- docs/AUDITORIA.md, M8). Solo para admins: no dice qué archivos hay.
create or replace function public.tamano_del_bucket()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Lo ve un admin' using errcode = 'insufficient_privilege';
  end if;
  return (select jsonb_build_object(
      'archivos', count(*),
      'bytes', coalesce(sum(case when (o.metadata ->> 'size') ~ '^\d+$' then (o.metadata ->> 'size')::bigint end), 0))
    from storage.objects o
   where o.bucket_id = 'adjuntos' and o.name not like 'papelera/%');
end $$;
revoke execute on function public.tamano_del_bucket() from public, anon;
grant execute on function public.tamano_del_bucket() to authenticated;


-- ============================================================
-- Quién cargó, editó, canceló o borró cada posteo
-- ============================================================
-- Lo anota la base, al escribir el posteo. Hasta el 3 de octubre de 2026
-- lo anotaba la app con un segundo pedido (con Firebase no había otra:
-- no había código del lado del servidor sin pasar al plan pago), y eso
-- tenía dos agujeros: si la pestaña se cerraba entre una escritura y la
-- otra, el cambio quedaba sin anotar; y quien escribiera directo a la
-- base podía no anotar nada, o anotar algo que no hizo. Ahora la entrada
-- sale de la misma escritura, y nadie más que la base puede escribir
-- estos tipos (ver audit_crear en 02-politicas.sql).
--
-- Solo lo que hace una persona: lo que trae el sincronizador nocturno no
-- lo cargó nadie. Por la misma razón, lo que el navegador trae solo
-- desde Google Calendar tampoco cuenta: llega a nombre de "Google
-- Calendar" (lo creado, con author_email vacío; lo editado, con
-- last_edited_by = 'Google Calendar').

-- Cómo se nombra un posteo: «título o primeras palabras» y el tipo, igual
-- que lo hacía la app (resumenDePosteo). El nombre del tipo, el que eligió
-- el equipo en Configuración; si no lo cambió nunca, el de fábrica.
create or replace function public.resumen_de_posteo(p jsonb) returns text
  language sql stable set search_path = '' as $$
  select '«' || coalesce(nullif(left(btrim(regexp_replace(
           coalesce(nullif(p ->> 'title', ''), p ->> 'content', ''), '\s+', ' ', 'g')), 80), ''),
           'Sin título') || '»'
      || coalesce(' (' || left(coalesce(
           (select t ->> 'label' from public.app_config c,
                   jsonb_array_elements(case when jsonb_typeof(c.value -> 'activityTypes') = 'array'
                                             then c.value -> 'activityTypes' else '[]'::jsonb end) t
             where c.key = 'preferences' and t ->> 'key' = p ->> 'activity_type'
               and jsonb_typeof(t -> 'label') = 'string' limit 1),
           case p ->> 'activity_type'
             when 'rutina' then 'Rutina' when 'visita' then 'Visita' when 'curso' then 'Curso'
             when 'seminario' then 'Seminario' when 'congreso' then 'Congreso'
             when 'virtual' then 'Virtual' when 'otro' then 'Otro' end), 60) || ')', '')
$$;

-- Desde qué navegador y qué dirección: antes lo averiguaba la app (la IP,
-- preguntándole a un servicio de afuera). Acá sale del pedido mismo, que
-- Supabase le pasa a la base. Si no viene, queda vacío: nunca frena la
-- escritura del posteo.
create or replace function public.datos_del_pedido() returns table (device text, ip text)
  language plpgsql stable set search_path = '' as $$
declare
  h jsonb;
  ua text;
  nav text := 'Navegador';
  so text := '';
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then h := null;
  end;
  if h is null then device := null; ip := null; return next; return; end if;
  ua := coalesce(h ->> 'user-agent', '');
  if ua ~ 'Edg/' then nav := 'Edge';
  elsif ua ~ 'OPR/' then nav := 'Opera';
  elsif ua ~ 'Firefox/' then nav := 'Firefox';
  elsif ua ~ 'Chrome/' then nav := 'Chrome';
  elsif ua ~ 'Safari/' then nav := 'Safari';
  end if;
  if ua ~ 'iPhone|iPad|iPod' then so := 'iOS';
  elsif ua ~ 'Android' then so := 'Android';
  elsif ua ~ 'Windows' then so := 'Windows';
  elsif ua ~ 'Mac OS X' then so := 'Mac';
  elsif ua ~ 'Linux' then so := 'Linux';
  end if;
  device := case when ua = '' then null when so = '' then nav else nav || ' · ' || so end;
  ip := nullif(left(btrim(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip',
                                   split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1))), 45), '');
  return next;
end $$;

create or replace function public.registrar_posteo() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  tipo text;
  fila jsonb;
  nombre text;
  pedido record;
begin
  if yo is null then return null; end if;
  -- Revisar lo de Calendar (clasificar_importados) no es editar.
  if tg_op = 'UPDATE' and current_setting('registro.ordenando_calendar', true) = 'si' then return null; end if;

  if tg_op = 'INSERT' then
    if coalesce(new.author_email, '') <> yo then return null; end if;
    tipo := 'post_created'; fila := to_jsonb(new); nombre := new.author_name;
  elsif tg_op = 'UPDATE' then
    -- Una edición es lo que la app firma como tal (la hora y quién). Un me
    -- gusta, tildar un hito, lo del proyecto, el resumen leído de un Word o
    -- guardar el id del evento de Calendar no firman: no son ediciones del
    -- posteo. Quién, igual sale de la credencial: no del nombre firmado.
    --
    -- Hasta el 6/10/2026 lo que no venía firmado no se anotaba nunca, y
    -- eso dejaba editar el contenido sin rastro escribiendo directo a la
    -- base (docs/AUDITORIA.md, I6). Ahora, sin firma, se anota igual si
    -- cambió algo que no está en esa lista. Y lo firmado «Google Calendar»
    -- con la sesión de una persona (lo que aplica su navegador al
    -- sincronizar) se anota a nombre de esa cuenta, dicho así.
    if new.last_edited_at is not distinct from old.last_edited_at then
      if not exists (select 1 from unnest(public.campos_cambiados(to_jsonb(old), to_jsonb(new))) c
                      where c not in ('liked_by', 'milestones', 'editors', 'is_project', 'project_notes',
                                      'project_status', 'project_done_by', 'project_done_at',
                                      'calendar_event_id', 'sin_calendar', 'resumen',
                                      'recurrence_skip', 'recurrence_moves',
                                      'last_edited_by', 'last_edited_by_email')) then
        return null;
      end if;
    end if;
    tipo := case when new.cancelled is true and old.cancelled is not true
                 then 'post_cancelled' else 'post_edited' end;
    fila := to_jsonb(new);
    nombre := case
      when new.last_edited_by is not distinct from 'Google Calendar'
           and new.last_edited_at is distinct from old.last_edited_at
        then 'Google Calendar · ' || coalesce((select m.name from public.members m where m.email = yo), yo)
      when coalesce(new.last_edited_by_email, '') = yo then new.last_edited_by end;
  else
    tipo := 'post_deleted'; fila := to_jsonb(old);
  end if;

  nombre := coalesce(nullif(btrim(nombre), ''),
                     (select m.name from public.members m where m.email = yo), yo);
  select * into pedido from public.datos_del_pedido();
  insert into public.audit_log (id, type, actor_email, actor_name, detail, device, ip)
  values (replace(gen_random_uuid()::text, '-', ''), tipo, yo, left(nombre, 120),
          left(public.resumen_de_posteo(fila), 300), pedido.device, pedido.ip);
  return null;
end $$;

drop trigger if exists posts_registrar on public.posts;
create trigger posts_registrar after insert or update or delete on public.posts
  for each row execute function public.registrar_posteo();

revoke execute on function public.registrar_posteo() from public, anon, authenticated;

-- Al quitarle el acceso a alguien, sus preferencias (y sus marcas de
-- «visto») quedaban para siempre (docs/AUDITORIA.md, B6). Un admin las
-- borra con esto: por política no puede ni leer las ajenas.
create or replace function public.olvidar_preferencias(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Esto lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  delete from public.user_prefs where email = lower(p_email);
end $$;
revoke execute on function public.olvidar_preferencias(text) from public, anon;
grant execute on function public.olvidar_preferencias(text) to authenticated;

-- La IP de un login (y de todo lo que la app anota en la auditoría) sale
-- del pedido, como la de los post_*: antes cada navegador se la
-- preguntaba a un servicio de afuera (ipify) en cada login, y la que
-- llegaba era la que el navegador decía (docs/AUDITORIA.md, M1). Lo que
-- mande la app en `ip` se ignora; con la llave de servicio (sin pedido de
-- una persona) queda lo que venga.
create or replace function public.auditoria_ip_del_pedido() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() then return new; end if;
  new.ip := (select d.ip from public.datos_del_pedido() d);
  return new;
end $$;
drop trigger if exists audit_ip on public.audit_log;
create trigger audit_ip before insert on public.audit_log
  for each row execute function public.auditoria_ip_del_pedido();
