-- ============================================================
-- La Agenda (8/10/2026)
-- ============================================================
-- Las instituciones de cada lugar (un Beit Jabad, una escuela, una
-- comunidad) y su gente, con teléfono y WhatsApp. Pedido del usuario:
-- tener a mano los contactos más importantes de cada lugar, empezando por
-- el «Directorio Chabad LatAm» (189 instituciones en 102 ciudades) y otras
-- listas parecidas. Lo decidió en tres vueltas de propuesta
-- (docs/REDISENO.md): la ven todos los aprobados, también los
-- observadores; la suma y corrige cualquiera que carga eventos; borrar,
-- solo un admin.
--
-- La gente de la Agenda son las mismas fichas que las personas sin cuenta
-- (18-personas.sql, con sus teléfonos e idiomas): si el rab participa de
-- una visita, se lo suma como participante y es la misma ficha.
--
--   agenda_listas  de dónde vino lo que se trajo de un archivo
--                  (Administración › Agenda). Lo sumado a mano no tiene.
--   instituciones  una por lugar con nombre: país y ciudad como los nombra
--                  la app (CITY_PRESETS), dirección, tipo y estado (activa,
--                  de temporada, cerrada).
--   contactos      quién está en qué institución y con qué cargo. Con id
--                  propio: la copia de seguridad necesita una clave de una
--                  sola columna (supabase/respaldo).

create table if not exists public.agenda_listas (
  id         text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  name       text not null check (length(btrim(name)) between 1 and 120),
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists public.instituciones (
  id         text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  name       text not null check (length(btrim(name)) between 1 and 160),
  country    text not null check (length(btrim(country)) between 1 and 80),
  city       text check (city is null or length(city) <= 80),
  address    text check (address is null or length(address) <= 300),
  tipo       text check (tipo is null or length(tipo) <= 60),
  estado     text not null default 'activa' check (estado in ('activa', 'temporada', 'cerrada')),
  nota       text check (nota is null or length(nota) <= 300),
  lista      text references public.agenda_listas(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  tocado_por text,
  tocado_el  timestamptz
);
create table if not exists public.contactos (
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  institucion text not null references public.instituciones(id) on delete cascade,
  persona     text not null references public.personas(id) on delete cascade,
  cargo       text check (cargo is null or length(cargo) <= 60),
  orden       integer not null default 0 check (orden between 0 and 999),
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (institucion, persona)
);
create index if not exists contactos_persona on public.contactos(persona);
create index if not exists instituciones_lugar on public.instituciones(country, city);

alter table public.agenda_listas enable row level security;
alter table public.instituciones enable row level security;
alter table public.contactos enable row level security;
grant select, insert, update, delete on public.agenda_listas, public.instituciones, public.contactos to authenticated;
grant all on public.agenda_listas, public.instituciones, public.contactos to service_role;
revoke all on public.agenda_listas, public.instituciones, public.contactos from anon;

-- Leen todos los aprobados, también los observadores (decisión del
-- usuario: ya los aprobó uno por uno, y el observador suele ser alguien de
-- dirección que también necesita llamar).
drop policy if exists agenda_listas_leer on public.agenda_listas;
create policy agenda_listas_leer on public.agenda_listas for select
  using ((select public.es_admin_fijo()) or (select public.esta_aprobado()));
drop policy if exists instituciones_leer on public.instituciones;
create policy instituciones_leer on public.instituciones for select
  using ((select public.es_admin_fijo()) or (select public.esta_aprobado()));
drop policy if exists contactos_leer on public.contactos;
create policy contactos_leer on public.contactos for select
  using ((select public.es_admin_fijo()) or (select public.esta_aprobado()));

-- Las listas son cosa del admin: se traen con agenda_traer (que las crea)
-- y se renombran o sacan desde Administración.
drop policy if exists agenda_listas_admin on public.agenda_listas;
create policy agenda_listas_admin on public.agenda_listas for all
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()))
  with check ((select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- Instituciones: las suma y corrige cualquiera que carga eventos; las
-- borra un admin (y con ellas quién estaba ahí, no las fichas de la gente).
drop policy if exists instituciones_crear on public.instituciones;
create policy instituciones_crear on public.instituciones for insert
  with check ((select public.es_admin_fijo()) or (select public.puede_escribir()));
drop policy if exists instituciones_editar on public.instituciones;
create policy instituciones_editar on public.instituciones for update
  using ((select public.es_admin_fijo()) or (select public.puede_escribir()))
  with check ((select public.es_admin_fijo()) or (select public.puede_escribir()));
drop policy if exists instituciones_borrar on public.instituciones;
create policy instituciones_borrar on public.instituciones for delete
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- Quién está en qué institución: sumar, cambiar el cargo y sacar a alguien
-- que ya no está es corregir; lo hace cualquiera que carga eventos. La
-- ficha de la persona no se toca.
drop policy if exists contactos_crear on public.contactos;
create policy contactos_crear on public.contactos for insert
  with check ((select public.es_admin_fijo()) or (select public.puede_escribir()));
drop policy if exists contactos_editar on public.contactos;
create policy contactos_editar on public.contactos for update
  using ((select public.es_admin_fijo()) or (select public.puede_escribir()))
  with check ((select public.es_admin_fijo()) or (select public.puede_escribir()));
drop policy if exists contactos_sacar on public.contactos;
create policy contactos_sacar on public.contactos for delete
  using ((select public.es_admin_fijo()) or (select public.puede_escribir()));

-- Prolijidad y firma: sin espacios de más, quién lo creó (y eso no se
-- cambia después) y, en una institución, quién la tocó por última vez.
-- Sin sesión (el esquema, una restauración), se deja como viene.
create or replace function public.agenda_controlar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'instituciones' then
    new.name := btrim(new.name); new.country := btrim(new.country);
    new.city := nullif(btrim(coalesce(new.city, '')), '');
    new.address := nullif(btrim(coalesce(new.address, '')), '');
    new.tipo := nullif(btrim(coalesce(new.tipo, '')), '');
    new.nota := nullif(btrim(coalesce(new.nota, '')), '');
  elsif tg_table_name = 'contactos' then
    new.cargo := nullif(btrim(coalesce(new.cargo, '')), '');
  else
    new.name := btrim(new.name);
  end if;
  if public.sin_sesion_de_persona() then return new; end if;
  if tg_op = 'INSERT' then
    new.created_by := public.mi_correo(); new.created_at := now();
  else
    new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  if tg_table_name = 'instituciones' then
    if tg_op = 'UPDATE' then new.tocado_por := public.mi_correo(); new.tocado_el := now();
    else new.tocado_por := null; new.tocado_el := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists agenda_listas_controlar on public.agenda_listas;
create trigger agenda_listas_controlar before insert or update on public.agenda_listas
  for each row execute function public.agenda_controlar();
drop trigger if exists instituciones_controlar on public.instituciones;
create trigger instituciones_controlar before insert or update on public.instituciones
  for each row execute function public.agenda_controlar();
drop trigger if exists contactos_controlar on public.contactos;
create trigger contactos_controlar before insert or update on public.contactos
  for each row execute function public.agenda_controlar();

-- De qué lista vino una persona (`personas.lista`, 18-personas.sql) tiene
-- que ser una lista de la Agenda que existe (10/10/2026, docs/AUDITORIA.md,
-- R20): hasta hoy aceptaba cualquier texto con la forma de un id. Es un
-- disparador y no una clave foránea a propósito: con una clave, restaurar
-- una copia (supabase/respaldo/restaurar.mjs, que carga `personas` antes
-- que `agenda_listas`) se caería, y lo que ya esté guardado con una lista
-- que no existe haría fallar al aplicar el esquema. El disparador mira solo
-- lo que se escribe: una ficha nueva, o una editada que CAMBIA su lista;
-- corregirle el teléfono a una ficha con la lista colgada anda igual. Sin
-- una persona detrás (restaurar una copia, el esquema, el editor SQL) no
-- se controla. La que escribe la Agenda al traer una lista (agenda_traer)
-- crea la lista un renglón antes que sus personas, y la ve.
create or replace function public.personas_controlar_lista() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() or new.lista is null then return new; end if;
  if tg_op = 'UPDATE' and new.lista is not distinct from old.lista then return new; end if;
  if not exists (select 1 from public.agenda_listas l where l.id = new.lista) then
    raise exception 'Esa lista de la Agenda no existe' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists personas_lista on public.personas;
create trigger personas_lista before insert or update on public.personas
  for each row execute function public.personas_controlar_lista();

-- En vivo, como las demás (supabase/pruebas/88-tiempo-real.sql las cuenta).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['agenda_listas', 'instituciones', 'contactos'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------- Traer una lista entera ----------
-- Lo usa Administración › Agenda. La app ya leyó el archivo y lo dejó
-- prolijo (país y ciudad como los nombra la app, «Rabbi» fuera del nombre,
-- teléfonos sin caracteres invisibles); acá se guarda todo junto o nada.
-- Una persona que ya está en la app (mismo nombre, sin tildes ni
-- mayúsculas: una persona sin cuenta o alguien que viene en otra
-- institución de la misma lista) no se duplica: es la misma ficha, y se le
-- suman los teléfonos que no tenía.
-- p_instituciones: [{name, country, city, address, tipo, estado,
--                    gente: [{name, cargo, telefonos: [{n, wa}]}]}]
create or replace function public.agenda_id() returns text
  language sql volatile set search_path = '' as $$
  select substr(md5(random()::text || clock_timestamp()::text), 1, 20)
$$;
revoke execute on function public.agenda_id() from public, anon, authenticated;

create or replace function public.agenda_traer(p_nombre text, p_instituciones jsonb) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  lid text := public.agenda_id(); i jsonb; g jsonb; iid text; pid text; orden int;
  creadas text[] := '{}'; ya_estaban text[] := '{}'; n_inst int := 0; n_contactos int := 0;
  ya public.personas; tel jsonb;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Traer una lista lo hace un admin' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(jsonb_typeof(p_instituciones), '') <> 'array' or jsonb_array_length(p_instituciones) not between 1 and 3000 then
    raise exception 'La lista viene vacía o es demasiado larga (hasta 3000 instituciones)' using errcode = 'check_violation';
  end if;
  insert into public.agenda_listas(id, name) values (lid, p_nombre);
  for i in select e from jsonb_array_elements(p_instituciones) e loop
    iid := public.agenda_id();
    insert into public.instituciones(id, name, country, city, address, tipo, estado, lista)
    values (iid, i ->> 'name', i ->> 'country', i ->> 'city', i ->> 'address', i ->> 'tipo', coalesce(i ->> 'estado', 'activa'), lid);
    n_inst := n_inst + 1;
    orden := 0;
    for g in select e from jsonb_array_elements(case when jsonb_typeof(i -> 'gente') = 'array' then i -> 'gente' else '[]'::jsonb end) e loop
      select * into ya from public.personas
       where lower(public.sin_tildes(btrim(name))) = lower(public.sin_tildes(btrim(g ->> 'name')))
       order by created_at limit 1;
      if ya.id is null then
        pid := public.agenda_id();
        insert into public.personas(id, name, telefonos, lista)
        values (pid, g ->> 'name', coalesce(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' end, '[]'::jsonb), lid);
        creadas := creadas || pid;
      else
        pid := ya.id;
        if not pid = any(creadas) and not pid = any(ya_estaban) then ya_estaban := ya_estaban || pid; end if;
        -- Los teléfonos que no tenía (por los números, sin espacios ni guiones), hasta seis.
        for tel in select e from jsonb_array_elements(case when jsonb_typeof(g -> 'telefonos') = 'array' then g -> 'telefonos' else '[]'::jsonb end) e loop
          update public.personas p set telefonos = p.telefonos || jsonb_build_array(tel)
           where p.id = pid and jsonb_array_length(p.telefonos) < 6
             and not exists (select 1 from jsonb_array_elements(p.telefonos) y
                              where regexp_replace(y ->> 'n', '[^0-9]', '', 'g') = regexp_replace(tel ->> 'n', '[^0-9]', '', 'g'));
        end loop;
      end if;
      insert into public.contactos(id, institucion, persona, cargo, orden)
      values (public.agenda_id(), iid, pid, g ->> 'cargo', orden)
      on conflict (institucion, persona) do nothing;
      orden := orden + 1; n_contactos := n_contactos + 1;
    end loop;
  end loop;
  return jsonb_build_object('lista', lid, 'instituciones', n_inst, 'contactos', n_contactos,
    'personas_nuevas', coalesce(array_length(creadas, 1), 0), 'personas_que_ya_estaban', coalesce(array_length(ya_estaban, 1), 0));
end $$;
revoke execute on function public.agenda_traer(text, jsonb) from public, anon;
grant execute on function public.agenda_traer(text, jsonb) to authenticated;
