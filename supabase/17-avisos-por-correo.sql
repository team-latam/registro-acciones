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
--   emailHour  int       la hora del resumen, en SU hora (de fábrica: 9)
--   emailLang  text      'es' | 'en' | 'pt' | 'he': el idioma de sus correos
--                        (lo guarda la app con el idioma que eligió; de
--                        fábrica: es)
--   emailTz    text      su zona horaria («Asia/Jerusalem»; la guarda la
--                        app; de fábrica: la de Argentina). Las dos, por
--                        decisión del usuario del 7/10/2026: el equipo
--                        también tiene gente en Israel.
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
    'lang', case when p.prefs ->> 'emailLang' in ('es', 'en', 'pt', 'he') then p.prefs ->> 'emailLang' else 'es' end,
    'tz',   case when coalesce(p.prefs ->> 'emailTz', '') ~ '^[A-Za-z][A-Za-z0-9_+/-]{1,60}$' then p.prefs ->> 'emailTz'
                 else 'America/Argentina/Buenos_Aires' end,
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
-- Quién lo provocó (el autor del posteo o comentario): para el tope por
-- persona de más abajo.
alter table public.avisos_enviados add column if not exists autor text;
alter table public.avisos_enviados enable row level security;
revoke all on public.avisos_enviados from anon, authenticated;
grant all on public.avisos_enviados to service_role;

-- Lo que la función `avisar` tiene que mandar, guardado un rato con un
-- número de turno (7/10/2026). Hasta ese día preparar_aviso() y
-- pedir_aviso_al_admin() le DEVOLVÍAN a quien las llamaba la lista de
-- destinatarios: cualquiera que pidiera entrar podía ver, llamándolas
-- directo, los correos de los admins (y un integrante, a quién le llegan
-- avisos y qué eligió). Ahora devuelven solo el turno; lo que hay adentro
-- lo lee la función con la llave de servicio (tomar_aviso), y nadie más.
create table if not exists public.avisos_listos (
  ticket text primary key default gen_random_uuid()::text,
  datos  jsonb not null,
  creado timestamptz not null default now()
);
alter table public.avisos_listos enable row level security;
revoke all on public.avisos_listos from anon, authenticated;
grant all on public.avisos_listos to service_role;

create or replace function public.guardar_aviso(p_datos jsonb) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  delete from public.avisos_listos where creado < now() - interval '1 day';
  insert into public.avisos_listos(datos) values (p_datos) returning ticket into t;
  return jsonb_build_object('ticket', t);
end $$;
revoke execute on function public.guardar_aviso(jsonb) from public, anon, authenticated;

-- La función `avisar`, con la llave de servicio: lo que hay que mandar
-- con ese turno, una sola vez y dentro de los 10 minutos.
create or replace function public.tomar_aviso(p_ticket text) returns jsonb
  language sql security definer set search_path = '' as $$
  delete from public.avisos_listos where ticket = p_ticket and creado > now() - interval '10 minutes'
  returning datos
$$;
revoke execute on function public.tomar_aviso(text) from public, anon, authenticated;
grant execute on function public.tomar_aviso(text) to service_role;

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
-- vez por objeto (avisos_enviados). Guarda lo que hace falta para armar
-- el correo y devuelve su turno (guardar_aviso), o null si no hay a quién.
-- Como mucho 30 avisos por hora por autor (hasta el 7/10/2026 no había
-- tope: 30 comentarios eran 30 correos, y el plan gratis de Resend da 100
-- por día); lo que pasa del tope no se marca como enviado, así que llega
-- en el resumen (supabase/avisos/resumen.mjs). El nombre del autor sale
-- de su cuenta, no de la firma del posteo, que la escribe quien publica.
create or replace function public.preparar_aviso(p_tipo text, p_id text) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  yo text := public.mi_correo();
  autor text; autor_nombre text; menciones text[]; creado timestamptz; ya_salieron integer;
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
  select count(*) into ya_salieron from public.avisos_enviados a
   where a.autor = yo and a.enviado_el > now() - interval '1 hour';
  if ya_salieron >= 30 then return null; end if;
  autor_nombre := coalesce((select nullif(m.name, '') from public.members m where m.email = autor), autor_nombre);

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
    insert into public.avisos_enviados(tipo, objeto, email, autor) values (p_tipo, p_id, c.email, yo)
      on conflict do nothing;
    continue when not found;
    para := para || jsonb_build_array(jsonb_build_object('email', c.email, 'motivo', c.motivo,
      'nombre', (select m.name from public.members m where m.email = c.email), 'lang', pr ->> 'lang'));
  end loop;
  if jsonb_array_length(para) = 0 then return null; end if;
  return public.guardar_aviso(jsonb_build_object('para', para, 'autor', autor_nombre, 'titulo', titulo, 'tipo', tipo_act,
    'texto', left(texto, 600), 'post', post_id, 'en', p_tipo, 'id', p_id));
end $$;
revoke execute on function public.preparar_aviso(text, text) from public, anon;
grant execute on function public.preparar_aviso(text, text) to authenticated;

-- «Mandarme un correo de prueba»: a quien lo pide, si puede recibir
-- correos, uno por hora y tres por día (hasta el 7/10/2026, uno cada 10
-- minutos: 144 por día, más que todo el plan gratis de Resend).
create or replace function public.preparar_prueba() returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo();
begin
  if yo is null or not public.puede_recibir_correos(yo) then return null; end if;
  if (select count(*) from public.avisos_enviados a where a.tipo = 'prueba' and a.email = yo
        and a.enviado_el > now() - interval '1 day') >= 3 then return null; end if;
  insert into public.avisos_enviados(tipo, objeto, email, autor)
    values ('prueba', to_char(now() at time zone 'utc', 'YYYYMMDDHH24'), yo, yo)
    on conflict do nothing;
  if not found then return null; end if;
  return public.guardar_aviso(jsonb_build_object('para', jsonb_build_array(jsonb_build_object('email', yo,
    'nombre', (select m.name from public.members m where m.email = yo), 'lang', public.prefs_de_correo(yo) ->> 'lang'))));
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
  -- Cada admin, en su idioma y con la fecha en su hora.
  return public.guardar_aviso(jsonb_build_object('para', to_jsonb(para), 'nombre', fila.name, 'correo', fila.email,
    'pedido_el', fila.requested_at,
    'idiomas', (select jsonb_object_agg(e, public.prefs_de_correo(e) ->> 'lang') from unnest(para) e),
    'zonas', (select jsonb_object_agg(e, public.prefs_de_correo(e) ->> 'tz') from unnest(para) e)));
end $$;

-- El trabajo de los resúmenes (supabase/avisos/resumen.mjs) usa las dos
-- reglas de arriba con la llave de servicio, para decidir igual que la base.
grant execute on function public.puede_recibir_correos(text) to service_role;
grant execute on function public.prefs_de_correo(text) to service_role;
