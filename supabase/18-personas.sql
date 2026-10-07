-- ============================================================
-- Personas sin cuenta (7/10/2026)
-- ============================================================
-- Gente que participa en actividades pero no tiene cuenta en la app: un
-- voluntario, un rabino, alguien de otra institución. Hasta ahora quedaban
-- como un nombre suelto adentro de `participants` ({name} sin email), solo
-- en lo traído de Google Calendar, y no contaban en ningún lado. El
-- usuario pidió poder cargarlas desde cualquier evento, que cuenten en las
-- fichas y los reportes, y que si un día una entra a la app, todo su
-- historial pase a su cuenta.
--
-- Cada persona tiene su ficha (nombre, correo si se sabe, una nota), y en
-- `participants` va {persona: id, name}: el nombre es la foto de cuando se
-- cargó; la app muestra el de la ficha, así renombrarla alcanza.
-- El correo de la ficha NO invita a nadie a Google Calendar (eso lo hace
-- solo el email de un participante): sirve para reconocerla si pide entrar.

create table if not exists public.personas (
  id         text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  name       text not null check (length(btrim(name)) between 1 and 120),
  email      text check (email is null or (length(email) <= 200 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  note       text check (note is null or length(note) <= 300),
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.personas enable row level security;
grant select, insert, update, delete on public.personas to authenticated;
grant all on public.personas to service_role;
revoke all on public.personas from anon;

-- Las lee todo aprobado (para sugerirlas al cargar un evento); las crea
-- cualquiera que carga eventos (lo decidió el usuario: la sugerencia evita
-- duplicados y lo que se cuele lo ordena el admin); las corrige o borra
-- un admin, o quien la creó.
drop policy if exists personas_leer on public.personas;
create policy personas_leer on public.personas for select
  using ((select public.es_admin_fijo()) or (select public.esta_aprobado()));
drop policy if exists personas_crear on public.personas;
create policy personas_crear on public.personas for insert
  with check ((select public.puede_escribir()) and created_by = (select public.mi_correo()));
drop policy if exists personas_editar on public.personas;
create policy personas_editar on public.personas for update
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()) or created_by = (select public.mi_correo()))
  with check ((select public.es_admin_fijo()) or (select public.es_admin_rol()) or created_by = (select public.mi_correo()));
drop policy if exists personas_borrar on public.personas;
create policy personas_borrar on public.personas for delete
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()) or created_by = (select public.mi_correo()));

-- Quién la creó y cuándo no se cambian; el correo, siempre en minúsculas.
create or replace function public.personas_controlar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.name := btrim(new.name);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if tg_op = 'INSERT' then
    if not public.sin_sesion_de_persona() then new.created_by := public.mi_correo(); new.created_at := now(); end if;
  elsif not public.sin_sesion_de_persona() then
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists personas_controlar on public.personas;
create trigger personas_controlar before insert or update on public.personas
  for each row execute function public.personas_controlar();

-- En vivo, como el padrón: al sumar una persona en una pestaña, las demás
-- la sugieren enseguida.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personas') then
    alter publication supabase_realtime add table public.personas;
  end if;
end $$;

-- Sin tildes, para comparar nombres («Darío» = «Dario»).
create or replace function public.sin_tildes(s text) returns text
  language sql immutable as $$
  select translate(coalesce(s, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')
$$;

-- Un participante ahora puede ser {persona, name} además de {email, name}
-- o {name} (lo viejo). El id de la persona, con la forma de los ids.
create or replace function public.participantes_ok(v jsonb) returns boolean
  language sql immutable as $$
  select public.lista_ok(v, 10) and (v is null or not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or length(coalesce(e ->> 'email', '')) > 200
       or length(coalesce(e ->> 'name', '')) > 120
       or (e ? 'persona' and coalesce(e ->> 'persona', '') !~ '^[A-Za-z0-9_-]{1,40}$')))
$$;

-- Los participantes de todos los posteos que nombran a una persona, con
-- esa persona reemplazada por otra cosa (otra persona, o una cuenta), sin
-- duplicar. Lo usan unir y vincular. Admin solo. Reordenar participantes
-- no es editar el posteo: no va al registro de actividad ni pide ser su
-- autor (la marca es la misma que usa Revisar lo de Calendar).
create or replace function public.reemplazar_persona(p_id text, p_nuevo jsonb) returns integer
  language plpgsql security definer set search_path = '' as $$
declare n integer := 0; filas integer;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Unir o vincular una persona lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('registro.ordenando_calendar', 'si', true);
  update public.posts p set participants = (
    select coalesce(jsonb_agg(z.y), '[]'::jsonb) from (
      select distinct on (coalesce(y ->> 'email', ''), coalesce(y ->> 'persona', ''), case when y ? 'email' or y ? 'persona' then '' else lower(y ->> 'name') end) y
        from jsonb_array_elements(
          (select jsonb_agg(case when e ->> 'persona' = p_id then p_nuevo else e end)
             from jsonb_array_elements(p.participants) e)) y
      order by coalesce(y ->> 'email', ''), coalesce(y ->> 'persona', ''), case when y ? 'email' or y ? 'persona' then '' else lower(y ->> 'name') end) z)
  where jsonb_typeof(p.participants) = 'array'
    and exists (select 1 from jsonb_array_elements(p.participants) e where e ->> 'persona' = p_id);
  get diagnostics filas = row_count;
  n := n + filas;
  return n;
end $$;
revoke execute on function public.reemplazar_persona(text, jsonb) from public, anon, authenticated;

-- Unir dos fichas que son la misma persona («Dario» y «Darío»): la
-- primera se va, sus eventos pasan a la segunda. Si la que se va tenía
-- correo o nota y la otra no, se los queda.
create or replace function public.unir_personas(p_de text, p_a text) returns integer
  language plpgsql security definer set search_path = '' as $$
declare a public.personas; de public.personas; n integer;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Unir personas lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  select * into a from public.personas where id = p_a;
  select * into de from public.personas where id = p_de;
  if a.id is null or de.id is null or a.id = de.id then
    raise exception 'Hay que elegir dos personas distintas' using errcode = 'check_violation';
  end if;
  n := public.reemplazar_persona(p_de, jsonb_build_object('persona', a.id, 'name', a.name));
  update public.personas set email = coalesce(email, de.email), note = coalesce(note, de.note) where id = a.id;
  delete from public.personas where id = p_de;
  return n;
end $$;
revoke execute on function public.unir_personas(text, text) from public, anon;
grant execute on function public.unir_personas(text, text) to authenticated;

-- Ya tiene cuenta: sus eventos pasan a esa cuenta y la ficha se va. Lo
-- hace un admin a mano, y la app sola al aprobar a alguien cuyo correo
-- es el de una ficha.
create or replace function public.vincular_persona(p_id text, p_email text) returns integer
  language plpgsql security definer set search_path = '' as $$
declare m public.members; n integer;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Vincular una persona lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  select * into m from public.members where lower(email) = lower(p_email);
  if m.email is null then
    raise exception 'Esa cuenta no está en el equipo' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.personas where id = p_id) then
    raise exception 'Esa persona no existe' using errcode = 'check_violation';
  end if;
  n := public.reemplazar_persona(p_id, jsonb_build_object('email', m.email, 'name', coalesce(nullif(m.name, ''), m.email)));
  delete from public.personas where id = p_id;
  return n;
end $$;
revoke execute on function public.vincular_persona(text, text) from public, anon;
grant execute on function public.vincular_persona(text, text) to authenticated;

-- Lo que ya estaba: los nombres sueltos ({name} sin email ni persona) de
-- los posteos pasan a fichas, uno por nombre (sin tildes ni mayúsculas),
-- y el posteo queda apuntando a la ficha. Corre cada vez que se aplica el
-- esquema y no encuentra nada la segunda vez. Sin sesión (es el esquema
-- el que lo hace), así que no pasa por los controles de edición ni por
-- el registro de actividad.
create or replace function public.personas_desde_nombres_sueltos() returns integer
  language plpgsql security definer set search_path = '' as $$
declare r record; pid text; n integer := 0;
begin
  for r in
    select distinct lower(public.sin_tildes(btrim(e ->> 'name'))) as clave, min(btrim(e ->> 'name')) as nombre
      from public.posts p, jsonb_array_elements(case when jsonb_typeof(p.participants) = 'array' then p.participants else '[]'::jsonb end) e
     where coalesce(e ->> 'email', '') = '' and not (e ? 'persona') and length(btrim(coalesce(e ->> 'name', ''))) > 0
     group by 1
  loop
    select id into pid from public.personas where lower(public.sin_tildes(name)) = r.clave limit 1;
    if pid is null then
      pid := substr(md5(random()::text || clock_timestamp()::text), 1, 20);
      insert into public.personas(id, name, created_by) values (pid, r.nombre, null);
    end if;
    update public.posts p set participants = (
      select jsonb_agg(case when coalesce(e ->> 'email', '') = '' and not (e ? 'persona')
                             and lower(public.sin_tildes(btrim(coalesce(e ->> 'name', '')))) = r.clave
                            then jsonb_build_object('persona', pid, 'name', r.nombre) else e end)
        from jsonb_array_elements(p.participants) e)
    where jsonb_typeof(p.participants) = 'array'
      and exists (select 1 from jsonb_array_elements(p.participants) e
                   where coalesce(e ->> 'email', '') = '' and not (e ? 'persona')
                     and lower(public.sin_tildes(btrim(coalesce(e ->> 'name', '')))) = r.clave);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.personas_desde_nombres_sueltos() from public, anon, authenticated;

select public.personas_desde_nombres_sueltos();
