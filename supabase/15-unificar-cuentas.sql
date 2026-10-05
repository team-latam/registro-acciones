-- ============================================================
-- Unificar dos cuentas de la misma persona
-- ============================================================
-- Pedido del usuario el 5/10/2026: alguien del equipo usó dos correos
-- (uno personal y uno del equipo) y va a dejar de usar uno. Todo lo que
-- figura con el viejo pasa al nuevo: lo que cargó y editó, sus
-- comentarios, sus me gusta, donde figura como participante, editor o
-- responsable de un hito, sus menciones (también el @usuario escrito en
-- los textos), los proyectos que dio por completados y lo que sacó de
-- Revisar lo de Calendar. Sus preferencias pasan si la cuenta nueva no
-- tiene propias.
--
-- Lo que NO se toca: el registro de actividad (es la historia de quién
-- hizo qué, y en ese momento fue el correo viejo) y la ficha de la cuenta
-- vieja en Personas (el acceso se saca a mano, como siempre).
--
-- Lo llama un admin desde Administración › Personas. Los correos no están
-- escritos acá: el repositorio es público.
-- ============================================================

create or replace function public.unificar_cuentas(p_viejo text, p_nuevo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  viejo text := lower(btrim(coalesce(p_viejo, '')));
  nuevo text := lower(btrim(coalesce(p_nuevo, '')));
  m_viejo public.members;
  m_nuevo public.members;
  nombre_nuevo text;
  n jsonb := '{}'::jsonb;
  filas integer;
  hay_prefs boolean;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Unificar cuentas lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  if viejo = '' or nuevo = '' or viejo = nuevo then
    raise exception 'Hacen falta dos correos distintos' using errcode = 'check_violation';
  end if;
  select * into m_nuevo from public.members where lower(email) = nuevo;
  if m_nuevo.email is null then
    raise exception 'La cuenta nueva tiene que estar en el equipo' using errcode = 'check_violation';
  end if;
  select * into m_viejo from public.members where lower(email) = viejo;
  if m_viejo.email is null then
    select email, name, nickname into m_viejo.email, m_viejo.name, m_viejo.nickname
      from public.former_members where lower(email) = viejo;
  end if;
  nombre_nuevo := m_nuevo.name;

  -- Sin sesión de persona hasta el final: los controles de edición (que no
  -- dejan cambiar el autor de un posteo, ni nada de un comentario ajeno)
  -- y el registro de actividad son para lo que hace la gente desde la
  -- app, no para este arreglo. Ya se comprobó arriba que es un admin.
  perform set_config('request.jwt.claims', '{}', true);

  -- ---------- Posteos ----------
  update public.posts set author_email = m_nuevo.email, author_name = nombre_nuevo
   where lower(coalesce(author_email, '')) = viejo;
  get diagnostics filas = row_count; n := n || jsonb_build_object('cargados', filas);

  update public.posts set last_edited_by_email = m_nuevo.email,
         last_edited_by = case when last_edited_by is null then null else nombre_nuevo end
   where lower(coalesce(last_edited_by_email, '')) = viejo;

  update public.posts set project_done_by = m_nuevo.email
   where lower(coalesce(project_done_by, '')) = viejo;

  -- Listas de correos: se reemplaza y, si ya estaban los dos, queda uno.
  update public.posts p set
    liked_by = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(p.liked_by, m_viejo.email, m_nuevo.email)) x),
    editors  = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(p.editors,  m_viejo.email, m_nuevo.email)) x),
    mentions = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(p.mentions, m_viejo.email, m_nuevo.email)) x)
   where m_viejo.email = any(p.liked_by) or m_viejo.email = any(p.editors) or m_viejo.email = any(p.mentions);
  get diagnostics filas = row_count; n := n || jsonb_build_object('listas', filas);

  -- Participantes: [{email, name, ...}]. Si ya estaban las dos cuentas,
  -- queda una sola vez (la primera).
  update public.posts p set participants = (
      select coalesce(jsonb_agg(z.e order by z.i), '[]'::jsonb) from (
        select distinct on (b.k) a.e, a.i from (
          select case when lower(coalesce(t.x ->> 'email', '')) = viejo
                      then t.x || jsonb_build_object('email', m_nuevo.email, 'name', nombre_nuevo) else t.x end as e, t.i
            from jsonb_array_elements(p.participants) with ordinality as t(x, i)) a,
          lateral (select coalesce(lower(a.e ->> 'email'), 'n:' || coalesce(a.e ->> 'name', '')) as k) b
        order by b.k, a.i) z)
   where jsonb_typeof(p.participants) = 'array'
     and exists (select 1 from jsonb_array_elements(p.participants) x where lower(coalesce(x ->> 'email', '')) = viejo);
  get diagnostics filas = row_count; n := n || jsonb_build_object('participa', filas);

  -- Hitos: el responsable (`owner`, los viejos) y los responsables (`owners`).
  update public.posts p set milestones = (
      select coalesce(jsonb_agg(
        case when jsonb_typeof(h) <> 'object' then h else
          (h - 'owner' - 'owners')
          || case when h ? 'owner' then jsonb_build_object('owner',
                case when lower(coalesce(h ->> 'owner', '')) = viejo then to_jsonb(m_nuevo.email) else h -> 'owner' end) else '{}'::jsonb end
          || case when jsonb_typeof(h -> 'owners') = 'array' then jsonb_build_object('owners', (
                select coalesce(jsonb_agg(distinct o), '[]'::jsonb) from (
                  select case when lower(o0 #>> '{}') = viejo then to_jsonb(m_nuevo.email) else o0 end as o
                    from jsonb_array_elements(h -> 'owners') o0) q)) else '{}'::jsonb end
        end order by i), '[]'::jsonb)
      from jsonb_array_elements(p.milestones) with ordinality as t(h, i))
   where jsonb_typeof(p.milestones) = 'array'
     and position(viejo in lower(p.milestones::text)) > 0;
  get diagnostics filas = row_count; n := n || jsonb_build_object('hitos', filas);

  -- ---------- Comentarios ----------
  update public.replies set author_email = m_nuevo.email, author_name = nombre_nuevo
   where lower(coalesce(author_email, '')) = viejo;
  get diagnostics filas = row_count; n := n || jsonb_build_object('comentarios', filas);
  update public.replies r set
    liked_by = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(r.liked_by, m_viejo.email, m_nuevo.email)) x),
    mentions = (select coalesce(array_agg(distinct x), '{}') from unnest(array_replace(r.mentions, m_viejo.email, m_nuevo.email)) x)
   where m_viejo.email = any(r.liked_by) or m_viejo.email = any(r.mentions);

  -- ---------- El @usuario escrito en los textos ----------
  if coalesce(m_viejo.nickname, '') <> '' and coalesce(m_nuevo.nickname, '') <> ''
     and lower(m_viejo.nickname) <> lower(m_nuevo.nickname) then
    update public.posts set content = regexp_replace(content, '(^|[^\w@])@' || m_viejo.nickname || '(?!\w)', '\1@' || m_nuevo.nickname, 'gi')
     where content ~* ('(^|[^\w@])@' || m_viejo.nickname || '(?!\w)');
    update public.replies set content = regexp_replace(content, '(^|[^\w@])@' || m_viejo.nickname || '(?!\w)', '\1@' || m_nuevo.nickname, 'gi')
     where content ~* ('(^|[^\w@])@' || m_viejo.nickname || '(?!\w)');
  end if;

  -- ---------- Lo demás ----------
  update public.calendar_sacados set sacado_por = m_nuevo.email where lower(sacado_por) = viejo;
  select exists (select 1 from public.user_prefs where lower(email) = nuevo) into hay_prefs;
  if not hay_prefs then
    insert into public.user_prefs (email, prefs)
    select m_nuevo.email, prefs from public.user_prefs where lower(email) = viejo;
  end if;

  return n;
end $$;

revoke execute on function public.unificar_cuentas(text, text) from public, anon;
grant execute on function public.unificar_cuentas(text, text) to authenticated;
