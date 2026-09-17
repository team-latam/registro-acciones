-- ============================================================
-- Registro de Acciones — Paso 2: los permisos
-- ============================================================
-- Esto es lo que hoy hace firestore.rules, traducido. NO es una
-- traducción línea por línea, porque Postgres y Firestore reparten el
-- trabajo distinto:
--
--   En Firestore              Acá
--   ------------------------  ----------------------------------------
--   allow read / write        una POLÍTICA por tabla y por operación
--   affectedKeys().hasOnly()  un DISPARADOR que compara qué cambió
--   isValidX() (largos,       restricciones de la tabla — van aparte,
--     formatos, listas)         en 03-validacion.sql
--
-- Este archivo contesta UNA sola pregunta: QUIÉN puede hacer QUÉ.
-- Qué forma tiene que tener lo que escribe es otra pregunta, y va en su
-- propio archivo para poder revisarlas y aplicarlas por separado.
--
-- Se puede correr más de una vez sin romper nada.
--
-- IMPORTANTE, lo mismo que dice firestore.rules: TODO el modelo descansa
-- en el CORREO. No en el identificador de Supabase, que cambia si alguna
-- vez se rehace el login. Es lo que permite volver a Firebase sin tocar
-- un dato.
-- ============================================================


-- ============================================================
-- 1. Quién sos
-- ============================================================

-- El admin fijo. Tiene que coincidir EXACTAMENTE con ADMIN_EMAIL en
-- index.html y con el de firestore.rules. Está en una función sola para
-- que cambiarlo sea tocar un solo lugar.
create or replace function public.admin_fijo() returns text
  language sql immutable as $$ select 'benny@team-latam.com'::text $$;

-- La sesión que aceptamos. Es el equivalente de signedIn() en
-- firestore.rules, y exige lo mismo: correo verificado Y que haya entrado
-- con Google. Si algún día se habilita otro modo de entrar (magic link,
-- contraseña), cualquiera podría presentarse con el correo del admin sin
-- probar que es suyo — por eso la exigencia está acá y no se relaja sola.
--
-- OJO al aplicar: la forma exacta de estas claves hay que confirmarla
-- contra un token real del proyecto (la página de prueba las muestra).
-- Si no coinciden, esto deniega TODO — que es el modo seguro de fallar,
-- pero deja a todo el mundo afuera.
create or replace function public.sesion_valida() returns boolean
  language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') <> ''
     and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, false)
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
$$;

create or replace function public.mi_correo() returns text
  language sql stable as $$
  select case when public.sesion_valida() then auth.jwt() ->> 'email' end
$$;

-- El coalesce NO es decorativo. Sin correo válido, mi_correo() es null, y
-- `null = 'benny@...'` en SQL no da false: da NULL. Las políticas de
-- acceso tratan un NULL como "no" y quedaban bien igual, pero un
-- `if not es_admin_fijo()` adentro de una función NO entra cuando la
-- condición es NULL — o sea que el control se salteaba solo. Apareció
-- probando la importación con una sesión que no entró por Google.
create or replace function public.es_admin_fijo() returns boolean
  language sql stable as $$
  select coalesce(public.mi_correo() = public.admin_fijo(), false)
$$;

-- Estas TRES leen la tabla `members`, que a su vez tiene sus propias
-- políticas. Sin `security definer` se morderían la cola: para saber si
-- podés leer members, Postgres necesita leer members. `security definer`
-- las hace correr con los permisos del dueño de la base, que no pasa por
-- las políticas — es el patrón estándar de Supabase para esto, no un
-- atajo. `set search_path = ''` va junto: una función con permisos
-- elevados nunca debe resolver nombres por un camino que otro pueda
-- alterar.
create or replace function public.esta_aprobado() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where m.email = public.mi_correo())
$$;

create or replace function public.mi_rol() returns text
  language sql stable security definer set search_path = '' as $$
  select coalesce((select m.role from public.members m where m.email = public.mi_correo()), 'member')
$$;

-- Administrar desde la app (aprobar, revocar, cambiar roles, Zonas,
-- Preferencias, Auditoría). Es INDEPENDIENTE del admin fijo: él lo es con
-- o sin fila en members, y a él nadie lo puede tocar.
create or replace function public.es_admin_rol() returns boolean
  language sql stable as $$ select public.esta_aprobado() and public.mi_rol() = 'admin' $$;

-- Aprobado que NO es observador: lo que puede crear posteos, comentar y
-- dar me gusta. El observador ve todo y no escribe nada (salvo sus
-- propias preferencias).
create or replace function public.puede_escribir() returns boolean
  language sql stable as $$ select public.esta_aprobado() and public.mi_rol() <> 'observer' $$;

-- Quién puede editar un posteo que ya existe: el autor siempre, y
-- cualquier aprobado los que no son Rutina (son eventos compartidos del
-- equipo, no una entrada personal). Mismo criterio que
-- isAuthorOrNonRoutine en firestore.rules.
create or replace function public.puede_editar_posteo(autor text, tipo text) returns boolean
  language sql stable as $$
  select coalesce(coalesce(autor, '') = public.mi_correo(), false)
      or coalesce(tipo, '') <> 'rutina'
$$;

-- ¿Esta escritura viene del navegador de una persona, o de adentro?
-- Importa para los disparadores de más abajo: una política de acceso NO
-- corre para la clave de administración (por diseño, es la que usan las
-- migraciones y la importación de datos), pero un disparador SÍ corre
-- siempre. Sin esta puerta, el día que traigamos los datos de Firebase la
-- propia base los rechazaría por "no podés cambiar de quién es un
-- posteo", que es justo lo que una importación tiene que hacer.
--
-- Que esto exista NO abre nada desde afuera: quien entra por el navegador
-- sin sesión válida no tiene correo acá, pero tampoco pasa las políticas
-- de acceso, que son las que lo frenan antes. Este permiso solo aplica a
-- quien YA está adentro de la base (el editor SQL, una migración, el
-- importador).
create or replace function public.sin_sesion_de_persona() returns boolean
  language sql stable as $$ select public.mi_correo() is null $$;

-- ¿Esto es una importación? Traer diez años de historia desde Firebase
-- necesita escribir cosas que ningún navegador puede: la fecha real de
-- creación de cada posteo, la firma de quien lo escribió. Los disparadores
-- de más abajo se hacen a un lado cuando esto es verdad.
--
-- No lo puede prender nadie desde afuera: lo enciende la función importar()
-- (ver 05-importar.sql), que antes comprueba que quien llama sea el
-- administrador, y solo dura lo que dura esa transacción.
create or replace function public.es_importacion() returns boolean
  language sql stable as $$
  select coalesce(current_setting('app.importando', true), '') = 'si'
$$;

-- Qué columnas cambiaron en un UPDATE. Es el equivalente de
-- diff().affectedKeys() de Firestore, que Postgres no trae de fábrica.
create or replace function public.campos_cambiados(viejo jsonb, nuevo jsonb) returns text[]
  language sql immutable as $$
  select coalesce(array_agg(k order by k), array[]::text[])
  from jsonb_object_keys(viejo || nuevo) as k
  where (viejo -> k) is distinct from (nuevo -> k)
$$;


-- ============================================================
-- 2. Quién entra a la base
-- ============================================================
-- En Supabase, el navegador se presenta como `anon` antes de entrar y
-- como `authenticated` después. `anon` no recibe NADA: sin haber entrado
-- no hay nada que ver, igual que hoy.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- Que un permiso exista no quiere decir que se pueda usar: todo lo de
-- abajo pasa igual por las políticas. Esto solo abre la puerta del
-- edificio; las políticas son las llaves de cada oficina.


-- ============================================================
-- 3. POSTEOS
-- ============================================================
drop policy if exists posts_leer on public.posts;
create policy posts_leer on public.posts for select
  using (public.es_admin_fijo() or public.esta_aprobado());

-- Al crear, la firma tiene que ser la propia. La segunda forma es la que
-- usa la app al importar un evento creado directo en Google Calendar
-- (autor "Google Calendar", sin correo, con id de evento). Esa forma
-- sigue siendo falsificable por alguien aprobado — sin un servidor propio
-- no hay manera de distinguirla — pero ya no se puede firmar como OTRA
-- persona real, que es lo que importa.
drop policy if exists posts_crear on public.posts;
create policy posts_crear on public.posts for insert
  with check (
    (public.es_admin_fijo() or public.puede_escribir())
    and (
      author_email = public.mi_correo()
      or (author_name = 'Google Calendar' and coalesce(author_email, '') = ''
          and calendar_event_id is not null)
    )
  );

-- La política deja pasar a cualquiera que pueda escribir; QUÉ puede
-- cambiar cada uno lo decide el disparador de más abajo. Se hace así
-- porque una política no ve qué columnas cambiaron, solo la fila antes
-- (using) y después (with check).
drop policy if exists posts_editar on public.posts;
create policy posts_editar on public.posts for update
  using (public.es_admin_fijo() or public.puede_escribir())
  with check (public.es_admin_fijo() or public.puede_escribir());

-- Borrar de verdad: SOLO el admin fijo. Los admin por rol no (igual que
-- en firestore.rules); el resto cancela el evento, que no lo borra.
drop policy if exists posts_borrar on public.posts;
create policy posts_borrar on public.posts for delete
  using (public.es_admin_fijo());


-- ============================================================
-- 4. COMENTARIOS
-- ============================================================
drop policy if exists replies_leer on public.replies;
create policy replies_leer on public.replies for select
  using (public.es_admin_fijo() or public.esta_aprobado());

-- Igual que los posteos, con una excepción: los mensajes de sistema que
-- escribe la sincronización con Calendar van sin correo.
drop policy if exists replies_crear on public.replies;
create policy replies_crear on public.replies for insert
  with check (
    (public.es_admin_fijo() or public.puede_escribir())
    and (
      author_email = public.mi_correo()
      or (system = true and author_name = 'Google Calendar' and author_email is null)
    )
  );

-- Lo único editable de un comentario es el me gusta (lo asegura el
-- disparador). El texto no se edita: así es hoy.
drop policy if exists replies_editar on public.replies;
create policy replies_editar on public.replies for update
  using (public.es_admin_fijo() or public.puede_escribir())
  with check (public.es_admin_fijo() or public.puede_escribir());

drop policy if exists replies_borrar on public.replies;
create policy replies_borrar on public.replies for delete
  using (public.es_admin_fijo());


-- ============================================================
-- 5. EL EQUIPO (members)
-- ============================================================
-- Cualquier aprobado lee la lista ENTERA, no solo su fila: es lo que
-- permite etiquetar a otros con @. Cada fila tiene correo, nombre,
-- @nickname y desde cuándo — nada sensible. Quien todavía no está
-- aprobado puede leer SU propia fila y nada más: es como la app se entera
-- de si tiene acceso.
drop policy if exists members_leer on public.members;
create policy members_leer on public.members for select
  using (public.es_admin_fijo() or public.esta_aprobado() or email = public.mi_correo());

drop policy if exists members_crear on public.members;
create policy members_crear on public.members for insert
  with check (
    public.es_admin_fijo()
    or (public.es_admin_rol() and email <> public.admin_fijo())
  );

-- Tres puertas distintas, y el disparador decide qué puede tocar cada
-- una: el admin fijo todo; un admin por rol, la fila de otro (nunca la
-- del admin fijo); y cada persona, la suya.
drop policy if exists members_editar on public.members;
create policy members_editar on public.members for update
  using (
    public.es_admin_fijo()
    or (public.es_admin_rol() and email <> public.admin_fijo())
    or email = public.mi_correo()
  )
  with check (
    public.es_admin_fijo()
    or (public.es_admin_rol() and email <> public.admin_fijo())
    or email = public.mi_correo()
  );

-- Nadie se saca a sí mismo, y al admin fijo no lo saca nadie.
drop policy if exists members_borrar on public.members;
create policy members_borrar on public.members for delete
  using (
    public.es_admin_fijo()
    or (public.es_admin_rol() and email <> public.admin_fijo() and email <> public.mi_correo())
  );


-- ============================================================
-- 6. EX INTEGRANTES
-- ============================================================
-- Lo lee cualquier aprobado, por el mismo motivo que el roster: resolver
-- el @nickname de quien escribió algo hace dos años. No da acceso a nada.
drop policy if exists former_leer on public.former_members;
create policy former_leer on public.former_members for select
  using (public.esta_aprobado());

drop policy if exists former_crear on public.former_members;
create policy former_crear on public.former_members for insert
  with check (public.es_admin_fijo() or public.es_admin_rol());

drop policy if exists former_editar on public.former_members;
create policy former_editar on public.former_members for update
  using (public.es_admin_fijo() or public.es_admin_rol())
  with check (public.es_admin_fijo() or public.es_admin_rol());

drop policy if exists former_borrar on public.former_members;
create policy former_borrar on public.former_members for delete
  using (public.es_admin_fijo() or public.es_admin_rol());


-- ============================================================
-- 7. PREFERENCIAS DE CADA PERSONA
-- ============================================================
-- Cada uno lee y escribe SOLO las suyas. Ni el admin ve las de los demás:
-- no las necesita para nada, y es configuración personal.
drop policy if exists prefs_leer on public.user_prefs;
create policy prefs_leer on public.user_prefs for select
  using (email = public.mi_correo());

drop policy if exists prefs_crear on public.user_prefs;
create policy prefs_crear on public.user_prefs for insert
  with check (email = public.mi_correo() and public.esta_aprobado());

drop policy if exists prefs_editar on public.user_prefs;
create policy prefs_editar on public.user_prefs for update
  using (email = public.mi_correo())
  with check (email = public.mi_correo() and public.esta_aprobado());


-- ============================================================
-- 8. SOLICITUDES DE ACCESO
-- ============================================================
-- La única tabla que toca alguien que NO está aprobado todavía: es cómo
-- pide entrar. Solo la suya, y solo en estado "pendiente" — aprobarse a
-- uno mismo no es una opción.
drop policy if exists solicitudes_leer on public.access_requests;
create policy solicitudes_leer on public.access_requests for select
  using (public.es_admin_fijo() or public.es_admin_rol() or email = public.mi_correo());

drop policy if exists solicitudes_crear on public.access_requests;
create policy solicitudes_crear on public.access_requests for insert
  with check (email = public.mi_correo() and status = 'pending');

drop policy if exists solicitudes_editar on public.access_requests;
create policy solicitudes_editar on public.access_requests for update
  using (public.es_admin_fijo() or public.es_admin_rol() or email = public.mi_correo())
  with check (
    public.es_admin_fijo() or public.es_admin_rol()
    or (email = public.mi_correo() and status = 'pending')
  );

drop policy if exists solicitudes_borrar on public.access_requests;
create policy solicitudes_borrar on public.access_requests for delete
  using (public.es_admin_fijo() or public.es_admin_rol());


-- ============================================================
-- 9. CONFIGURACIÓN DEL EQUIPO
-- ============================================================
-- Tres cosas distintas en una tabla, con permisos distintos:
--   territoryConfig y preferences  -> las lee todo el equipo, las escribe
--                                     un admin (son decisiones de todos)
--   calendarSync                   -> el estado de la sincronización, que
--                                     cualquiera que escriba va dejando
--                                     al vuelo mientras usa la app
drop policy if exists config_leer on public.app_config;
create policy config_leer on public.app_config for select
  using (public.es_admin_fijo() or public.esta_aprobado());

drop policy if exists config_crear on public.app_config;
create policy config_crear on public.app_config for insert
  with check (
    public.es_admin_fijo() or public.es_admin_rol()
    or (key = 'calendarSync' and public.puede_escribir())
  );

drop policy if exists config_editar on public.app_config;
create policy config_editar on public.app_config for update
  using (
    public.es_admin_fijo() or public.es_admin_rol()
    or (key = 'calendarSync' and public.puede_escribir())
  )
  with check (
    public.es_admin_fijo() or public.es_admin_rol()
    or (key = 'calendarSync' and public.puede_escribir())
  );

-- Nadie borra configuración: se reemplaza.


-- ============================================================
-- 10. AUDITORÍA
-- ============================================================
-- Solo un admin la LEE: es información sobre personas, no sobre el
-- contenido. Pero cualquiera que entró puede registrar SU PROPIO login o
-- SU PROPIO pedido de acceso — si no, no se podría anotar la entrada de
-- alguien que todavía no está aprobado.
drop policy if exists audit_leer on public.audit_log;
create policy audit_leer on public.audit_log for select
  using (public.es_admin_fijo() or public.es_admin_rol());

drop policy if exists audit_crear on public.audit_log;
create policy audit_crear on public.audit_log for insert
  with check (
    actor_email = public.mi_correo()
    and (
      public.es_admin_fijo() or public.es_admin_rol()
      -- Sin ser admin: solo sobre uno mismo, y solo estos dos tipos.
      or (type in ('login', 'access_requested') and target_email is null)
    )
  );

-- Sin políticas de update ni delete: el registro no se corrige ni se
-- borra, ni siquiera por el admin. Es lo mismo que el
-- "allow update, delete: if false" de firestore.rules.


-- ============================================================
-- 11. LOS ADJUNTOS (el bucket)
-- ============================================================
-- El bucket es privado: no hay enlace público, se sirve con una URL
-- firmada que caduca. Estas políticas dicen quién puede pedir esa firma y
-- quién puede subir.
drop policy if exists adjuntos_leer on storage.objects;
create policy adjuntos_leer on storage.objects for select
  using (bucket_id = 'adjuntos' and (public.es_admin_fijo() or public.esta_aprobado()));

drop policy if exists adjuntos_subir on storage.objects;
create policy adjuntos_subir on storage.objects for insert
  with check (bucket_id = 'adjuntos' and (public.es_admin_fijo() or public.puede_escribir()));

-- Un archivo subido no se pisa: si cambia la imagen de un posteo, se sube
-- otra con otro nombre y se cambia la ruta guardada. Así una edición
-- nunca rompe una versión anterior que alguien tenga abierta.
drop policy if exists adjuntos_borrar on storage.objects;
create policy adjuntos_borrar on storage.objects for delete
  using (bucket_id = 'adjuntos' and public.es_admin_fijo());


-- ============================================================
-- 12. QUÉ se puede cambiar en una edición
-- ============================================================
-- Una política de Postgres ve la fila antes y la fila después, pero NO
-- puede preguntar "¿qué columnas cambiaron?". Eso en Firestore era
-- affectedKeys().hasOnly([...]). Acá va en disparadores, que corren antes
-- de cada UPDATE y cortan con un error si el cambio no está permitido.
--
-- Es la mitad que falta: la política dice "esta persona puede tocar esta
-- fila", el disparador dice "pero solo estas columnas".

-- ---------- Posteos ----------
create or replace function public.posts_controlar_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  cambios text[] := public.campos_cambiados(to_jsonb(old), to_jsonb(new));
  yo text := public.mi_correo();
begin
  if public.sin_sesion_de_persona() or public.es_importacion() then return new; end if;

  -- De quién es y cuándo se creó no cambia NUNCA, ni para el admin.
  if cambios && array['id', 'author_email', 'author_name', 'created_at'] then
    raise exception 'No se puede cambiar de quién es un posteo ni cuándo se creó'
      using errcode = 'check_violation';
  end if;

  -- El me gusta va solo: o se toca el me gusta, o se edita el contenido,
  -- nunca las dos cosas en la misma escritura. Así una edición no puede
  -- llevarse puestos los me gusta de los demás de contrabando.
  if cambios = array['liked_by'] then
    if not (new.liked_by = old.liked_by || yo
            or new.liked_by = array_remove(old.liked_by, yo)) then
      raise exception 'Solo se puede poner o sacar el propio me gusta'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if 'liked_by' = any(cambios) then
    raise exception 'El me gusta se cambia solo, no junto con una edición'
      using errcode = 'check_violation';
  end if;

  -- Editar el contenido: el autor siempre puede; los demás, solo lo que
  -- no es Rutina. Se mira la fila VIEJA — si no, alguien podría cambiar
  -- el tipo a "no rutina" en la misma escritura y habilitarse solo.
  if not public.puede_editar_posteo(old.author_email, old.activity_type) then
    raise exception 'Una Rutina la edita solo quien la escribió'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

drop trigger if exists posts_controlar_update on public.posts;
create trigger posts_controlar_update before update on public.posts
  for each row execute function public.posts_controlar_update();


-- ---------- Comentarios ----------
-- Un comentario no se edita: lo único que cambia después de escrito es el
-- me gusta. Es como funciona hoy.
create or replace function public.replies_controlar_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  cambios text[] := public.campos_cambiados(to_jsonb(old), to_jsonb(new));
  yo text := public.mi_correo();
begin
  if public.sin_sesion_de_persona() or public.es_importacion() then return new; end if;

  if cambios <> array['liked_by'] then
    raise exception 'De un comentario solo se puede cambiar el me gusta'
      using errcode = 'insufficient_privilege';
  end if;
  if not (new.liked_by = old.liked_by || yo
          or new.liked_by = array_remove(old.liked_by, yo)) then
    raise exception 'Solo se puede poner o sacar el propio me gusta'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists replies_controlar_update on public.replies;
create trigger replies_controlar_update before update on public.replies
  for each row execute function public.replies_controlar_update();


-- ---------- El equipo ----------
-- Tres niveles, de más a menos permiso. El correo no cambia nunca: es la
-- identidad con la que están firmados todos los posteos de esa persona.
create or replace function public.members_controlar_update() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  cambios text[] := public.campos_cambiados(to_jsonb(old), to_jsonb(new));
  yo text := public.mi_correo();
begin
  if public.sin_sesion_de_persona() or public.es_importacion() then return new; end if;

  if 'email' = any(cambios) then
    raise exception 'El correo de una persona no se cambia: es su identidad en todo lo que escribió'
      using errcode = 'check_violation';
  end if;

  if public.es_admin_fijo() then
    return new;
  end if;

  if public.es_admin_rol() then
    -- Nadie se cambia el rol a sí mismo: que lo haga otro admin. Así
    -- nadie se baja por error ni se sube solo.
    if old.email = yo and new.role is distinct from old.role then
      raise exception 'El propio rol lo cambia otro admin, no uno mismo'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- Cualquier otro aprobado: solo su fila, y solo su @nickname o la marca
  -- de que ya vio el tutorial.
  if old.email <> yo then
    raise exception 'Solo un admin puede editar la ficha de otra persona'
      using errcode = 'insufficient_privilege';
  end if;
  if not (cambios <@ array['nickname', 'tour_seen_at']) then
    raise exception 'De tu ficha solo podés cambiar tu @nickname'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists members_controlar_update on public.members;
create trigger members_controlar_update before update on public.members
  for each row execute function public.members_controlar_update();
