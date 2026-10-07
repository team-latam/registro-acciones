-- ============================================================
-- Avisos por correo: menciones, respuestas y resúmenes (7/10/2026)
-- ============================================================
-- Sigue a 16-aviso-al-admin.sql (el correo del pedido de acceso). Ahora
-- cada persona elige en Mis preferencias → Notificaciones si quiere
-- correos, cuándo (al momento, una vez por día o por semana) y de qué
-- (menciones, respuestas a sus posteos, actividades nuevas, eventos que
-- empiezan pronto, y los admins los pedidos de acceso). Las preferencias
-- viven en user_prefs.prefs:
--   emailOn    boolean   prendido (de fábrica: sí)
--   emailWhen  text      'instant' | 'daily' | 'weekly' (de fábrica: daily)
--   emailHour  int       la hora del resumen, en Argentina (de fábrica: 9)
--   emailDay   int       el día del resumen semanal, 1 = lunes (de fábrica: 1)
--   emailWhat  text[]    'menciones','respuestas','nuevos','proximos','pedidos'
--                        (de fábrica: menciones y respuestas; los admins
--                        también pedidos)
--
-- QUIÉN puede recibir correos lo decide el admin (Administración →
-- Correos), en app_config 'preferences' → correos: {quienes: 'admin' |
-- 'todos' | 'elegidos', elegidos: [...]} (ahí y no en una clave aparte:
-- la app ya la lee entera, y la escribe solo un admin). Sin nada guardado, solo el admin fijo:
-- el usuario lo pidió así hasta decidir abrirlo al equipo.

-- ¿Esta persona puede recibir correos? El admin fijo siempre; el resto,
-- según lo que eligió el admin.
create or replace function public.puede_recibir_correos(p_email text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select p_email = public.admin_fijo() or coalesce((
    select case c.value -> 'correos' ->> 'quienes'
             when 'todos' then exists (select 1 from public.members m where m.email = p_email)
             when 'elegidos' then (c.value -> 'correos' -> 'elegidos') ? p_email
                                  and exists (select 1 from public.members m where m.email = p_email)
             else false end
      from public.app_config c where c.key = 'preferences'), false)
$$;
revoke execute on function public.puede_recibir_correos(text) from public, anon, authenticated;

-- Las preferencias de correo de alguien, con los valores de fábrica.
create or replace function public.prefs_de_correo(p_email text) returns jsonb
  language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'on',   coalesce((p.prefs ->> 'emailOn')::boolean, true),
    'when', coalesce(nullif(p.prefs ->> 'emailWhen', ''), 'daily'),
    'hour', coalesce((p.prefs ->> 'emailHour')::int, 9),
    'day',  coalesce((p.prefs ->> 'emailDay')::int, 1),
    'what', coalesce(p.prefs -> 'emailWhat',
              case when p_email = public.admin_fijo()
                     or exists (select 1 from public.members m where m.email = p_email and m.role = 'admin')
                   then '["menciones","respuestas","pedidos"]'::jsonb
                   else '["menciones","respuestas"]'::jsonb end))
  from (select p_email as email) x left join public.user_prefs p on p.email = x.email
$$;
revoke execute on function public.prefs_de_correo(text) from public, anon, authenticated;

-- Lo que ya salió, para no mandar dos veces lo mismo (un reintento, dos
-- pestañas, alguien que llama a la función de más). Nadie lo lee desde
-- la app: solo estas funciones y la llave de servicio.
create table if not exists public.avisos_enviados (
  tipo      text not null,
  objeto    text not null,
  email     text not null,
  enviado_el timestamptz not null default now(),
  primary key (tipo, objeto, email)
);
alter table public.avisos_enviados enable row level security;
revoke all on public.avisos_enviados from anon, authenticated;
grant all on public.avisos_enviados to service_role;

-- Cuándo salió el último resumen de cada uno (lo escribe el trabajo de
-- los resúmenes, con la llave de servicio).
create table if not exists public.resumenes_enviados (
  email  text primary key,
  ultimo timestamptz not null
);
alter table public.resumenes_enviados enable row level security;
revoke all on public.resumenes_enviados from anon, authenticated;
grant all on public.resumenes_enviados to service_role;

-- ¿A quién avisar AL MOMENTO de un posteo o comentario que acaba de
-- publicar quien llama? Solo su autor la puede pedir, y solo en los
-- primeros 15 minutos. Menciones (o @all) y, en un comentario, el autor
-- del posteo. Cada destinatario: que pueda recibir correos, que los tenga
-- prendidos al momento y que haya marcado ese tema. Cada uno, una sola
-- vez por objeto (avisos_enviados). Devuelve lo que hace falta para
-- armar el correo, o null si no hay a quién.
create or replace function public.preparar_aviso(p_tipo text, p_id text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  autor text; autor_nombre text; menciones text[]; creado timestamptz;
  post_id text; titulo text; tipo_act text; texto text; dueno text;
  candidatos jsonb := '[]'::jsonb; para jsonb := '[]'::jsonb; c record; pr jsonb;
begin
  if yo is null or not public.esta_aprobado() then return null; end if;
  if p_tipo = 'posteo' then
    select p.author_email, p.author_name, p.mentions, p.created_at, p.id, p.title, p.activity_type, p.content
      into autor, autor_nombre, menciones, creado, post_id, titulo, tipo_act, texto
      from public.posts p where p.id = p_id;
  elsif p_tipo = 'respuesta' then
    select r.author_email, r.author_name, r.mentions, r.created_at, r.post_id, p.title, p.activity_type, r.content, p.author_email
      into autor, autor_nombre, menciones, creado, post_id, titulo, tipo_act, texto, dueno
      from public.replies r join public.posts p on p.id = r.post_id where r.id = p_id;
  else
    return null;
  end if;
  if autor is distinct from yo or creado < now() - interval '15 minutes' then return null; end if;

  -- Los candidatos, con el motivo: mencionado gana sobre «respuesta».
  if 'all' = any(menciones) then
    select coalesce(jsonb_agg(jsonb_build_object('email', m.email, 'motivo', 'menciones')), '[]')
      into candidatos from public.members m;
  else
    select coalesce(jsonb_agg(jsonb_build_object('email', e, 'motivo', 'menciones')), '[]')
      into candidatos from unnest(menciones) e;
  end if;
  if dueno is not null and not candidatos @> jsonb_build_array(jsonb_build_object('email', dueno, 'motivo', 'menciones')) then
    candidatos := candidatos || jsonb_build_array(jsonb_build_object('email', dueno, 'motivo', 'respuestas'));
  end if;

  for c in select distinct on (x ->> 'email') x ->> 'email' as email, x ->> 'motivo' as motivo
             from jsonb_array_elements(candidatos) x order by x ->> 'email' loop
    continue when c.email = yo or not public.puede_recibir_correos(c.email);
    pr := public.prefs_de_correo(c.email);
    continue when not (pr ->> 'on')::boolean or pr ->> 'when' <> 'instant' or not (pr -> 'what') ? c.motivo;
    insert into public.avisos_enviados(tipo, objeto, email) values (p_tipo, p_id, c.email)
      on conflict do nothing;
    continue when not found;
    para := para || jsonb_build_array(jsonb_build_object('email', c.email, 'motivo', c.motivo,
      'nombre', (select m.name from public.members m where m.email = c.email)));
  end loop;
  if jsonb_array_length(para) = 0 then return null; end if;
  return jsonb_build_object('para', para, 'autor', autor_nombre, 'titulo', titulo, 'tipo', tipo_act,
    'texto', left(texto, 600), 'post', post_id, 'en', p_tipo);
end $$;
revoke execute on function public.preparar_aviso(text, text) from public, anon;
grant execute on function public.preparar_aviso(text, text) to authenticated;

-- «Mandarme un correo de prueba»: a quien lo pide, si puede recibir
-- correos, y como mucho uno cada 10 minutos.
create or replace function public.preparar_prueba() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo();
begin
  if yo is null or not public.puede_recibir_correos(yo) then return null; end if;
  insert into public.avisos_enviados(tipo, objeto, email)
    values ('prueba', to_char(now() at time zone 'utc', 'YYYYMMDDHH24') || (extract(minute from now())::int / 10)::text, yo)
    on conflict do nothing;
  if not found then return null; end if;
  return jsonb_build_object('para', jsonb_build_array(jsonb_build_object('email', yo,
    'nombre', (select m.name from public.members m where m.email = yo))));
end $$;
revoke execute on function public.preparar_prueba() from public, anon;
grant execute on function public.preparar_prueba() to authenticated;

-- El pedido de acceso (16-aviso-al-admin.sql) ahora respeta lo mismo:
-- a los admins que pueden recibir correos, los tienen prendidos y
-- marcaron «pedidos». Siempre al momento: es lo único que no espera al
-- resumen, porque hay alguien del otro lado esperando.
create or replace function public.pedir_aviso_al_admin() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare fila public.access_requests; para text[];
begin
  perform set_config('registro.aviso', '1', true);
  update public.access_requests set aviso_pedido_at = now()
   where email = public.mi_correo() and status = 'pending' and avisado_at is null
     and (aviso_pedido_at is null or aviso_pedido_at < now() - interval '1 hour')
  returning * into fila;
  perform set_config('registro.aviso', '', true);
  if fila.email is null then return null; end if;
  select array_agg(distinct e order by e) into para from (
    select public.admin_fijo() as e
    union select m.email from public.members m where m.role = 'admin') x
   where public.puede_recibir_correos(e)
     and (public.prefs_de_correo(e) ->> 'on')::boolean
     and (public.prefs_de_correo(e) -> 'what') ? 'pedidos';
  if para is null then return null; end if;
  return jsonb_build_object('para', to_jsonb(para), 'nombre', fila.name, 'correo', fila.email,
    'pedido_el', fila.requested_at);
end $$;

-- El trabajo de los resúmenes (supabase/avisos/resumen.mjs) usa las dos
-- reglas de arriba con la llave de servicio, para decidir igual que la base.
grant execute on function public.puede_recibir_correos(text) to service_role;
grant execute on function public.prefs_de_correo(text) to service_role;
