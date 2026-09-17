-- ============================================================
-- Registro de Acciones — Paso 5: traer los datos de Firebase
-- ============================================================
-- Una sola función, y existe por un motivo muy concreto: una importación
-- necesita escribir cosas que ningún navegador puede escribir.
--
-- Cuando alguien crea un posteo desde la app, la base le pone la fecha de
-- creación con su propio reloj, y no deja firmarlo con el correo de otro.
-- Está bien que sea así. Pero una importación tiene que hacer exactamente
-- las dos cosas: conservar la fecha REAL de cada posteo (si no, diez años
-- de historia quedan creados hoy) y conservar de quién es cada uno.
--
-- La forma habitual de resolver esto es usar la clave de administración
-- del proyecto, que se saltea todos los permisos. Acá NO se hace: esa
-- clave habría que ponerla en una página, y una clave así en una página es
-- una puerta abierta para siempre. En vez de eso:
--
--   - la función comprueba que quien llama sea el administrador fijo,
--     con su credencial de Google normal;
--   - prende una marca que dura lo que dura la escritura y nada más;
--   - los disparadores miran esa marca y se hacen a un lado.
--
-- Nadie puede prender esa marca por su cuenta: solo la prende esta
-- función, y solo después de comprobar quién llama.
--
-- Se puede correr más de una vez sin romper nada, y la importación
-- también: las filas que ya están se saltean en vez de duplicarse, así que
-- si se corta a la mitad se vuelve a empezar y listo.
-- ============================================================

create or replace function public.importar(p_tabla text, p_filas jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; v_defectos jsonb;
begin
  -- Con la credencial de Google del admin, no con una clave de servicio.
  if public.es_admin_fijo() is not true then
    raise exception 'Solo el administrador puede importar'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lista blanca: el nombre de la tabla entra en una consulta armada al
  -- vuelo, y ahí no se acepta lo que venga.
  if p_tabla not in ('posts','replies','members','former_members',
                     'access_requests','user_prefs','app_config','audit_log') then
    raise exception 'No existe la tabla %', p_tabla using errcode = 'check_violation';
  end if;

  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Se esperaba una lista de filas' using errcode = 'check_violation';
  end if;

  -- Los documentos de Firestore NO tienen todos los mismos campos: uno
  -- viejo puede no tener `cancelled`, otro no tener `images`. Al armar la
  -- fila, un campo ausente sale NULL y pisa el valor por omisión de la
  -- columna — y varias de esas columnas no aceptan NULL. Por eso cada fila
  -- se apoya primero sobre estos valores por omisión, y lo que trae de
  -- verdad los reemplaza.
  --
  -- Están escritos a mano y no sacados de la definición de las tablas: son
  -- pocos, se leen de un vistazo, y si mañana se agrega una columna que no
  -- acepta NULL es mejor que la importación falle con un error claro a que
  -- adivine mal en silencio.
  v_defectos := case p_tabla
    when 'posts' then jsonb_build_object(
      'cancelled', false, 'is_project', false, 'milestones', '[]'::jsonb,
      'editors', '[]'::jsonb, 'recurrence_skip', '[]'::jsonb,
      'recurrence_moves', '{}'::jsonb, 'scopes', '[]'::jsonb,
      'participants', '[]'::jsonb, 'links', '[]'::jsonb, 'mentions', '[]'::jsonb,
      'images', '[]'::jsonb, 'files', '[]'::jsonb, 'liked_by', '[]'::jsonb,
      'created_at', now())
    when 'replies' then jsonb_build_object(
      'scopes', '[]'::jsonb, 'links', '[]'::jsonb, 'images', '[]'::jsonb,
      'files', '[]'::jsonb, 'mentions', '[]'::jsonb, 'liked_by', '[]'::jsonb,
      'system', false, 'created_at', now())
    when 'members' then jsonb_build_object('role', 'member', 'calendar_shared', false)
    when 'former_members' then jsonb_build_object('revoked_at', now())
    when 'access_requests' then jsonb_build_object('status', 'pending', 'requested_at', now())
    when 'user_prefs' then jsonb_build_object('prefs', '{}'::jsonb)
    when 'app_config' then jsonb_build_object('value', '{}'::jsonb)
    when 'audit_log' then jsonb_build_object('created_at', now())
    else '{}'::jsonb end;

  -- La marca, que vale solo adentro de esta transacción (el `true` del
  -- final): cuando la función termina, se apaga sola.
  perform set_config('app.importando', 'si', true);

  -- `on conflict do nothing`: si esto se corta por la mitad y se vuelve a
  -- correr, lo que ya entró se saltea. No hay que llevar la cuenta de por
  -- dónde iba.
  execute format(
    'insert into public.%I select * from jsonb_populate_recordset(null::public.%I,
       (select coalesce(jsonb_agg($2 || f), ''[]''::jsonb) from jsonb_array_elements($1) f))
     on conflict do nothing',
    p_tabla, p_tabla) using p_filas, v_defectos;
  get diagnostics n = row_count;

  -- Y se apaga en cuanto termina, sin esperar a que cierre la transacción.
  -- Que dure de más no rompe nada en la app (cada pedido es su propia
  -- transacción), pero una puerta que se cierra sola en cuanto se usa es
  -- mejor que una que se cierra "cuando toque".
  perform set_config('app.importando', '', true);
  return n;
end $$;

-- Solo el admin puede usarla de hecho (lo comprueba adentro), pero el
-- permiso se le da a cualquiera que haya entrado: si no, ni siquiera
-- llegaría a la línea que lo rechaza y el error sería confuso.
grant execute on function public.importar(text, jsonb) to authenticated;


-- ============================================================
-- Cuántas filas hay de cada cosa
-- ============================================================
-- Para poder comprobar, después de importar, que está todo. Se lee con la
-- credencial normal y no dice nada que el admin no pueda ver igual.
create or replace function public.cuantas_filas()
returns table(tabla text, filas bigint) language sql security definer set search_path = '' as $$
  select 'posts', count(*) from public.posts
  union all select 'replies', count(*) from public.replies
  union all select 'members', count(*) from public.members
  union all select 'former_members', count(*) from public.former_members
  union all select 'access_requests', count(*) from public.access_requests
  union all select 'user_prefs', count(*) from public.user_prefs
  union all select 'app_config', count(*) from public.app_config
  union all select 'audit_log', count(*) from public.audit_log
$$;

grant execute on function public.cuantas_filas() to authenticated;
