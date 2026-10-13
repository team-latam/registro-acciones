-- ============================================================
-- «Algo no anda»: lo que cuenta la gente y lo que la app anota sola (13/10/2026)
-- ============================================================
-- Propuesta 8-C del usuario. Cuando algo falla en el celular de alguien, hasta
-- hoy el equipo se enteraba solo si esa persona lo contaba, y casi nunca sabía
-- decir qué pantalla, qué teléfono o qué error. Dos maneras de enterarse:
--   - `persona`: alguien aprieta «Algo no anda» y cuenta qué pasó (contar_problema);
--   - `automatico`: la app anota sola los errores que le saltan (anotar_error), y
--     el mismo error en la misma pantalla se AGRUPA en una fila: cuántas veces
--     y a cuántas personas. De los automáticos no se muestra quién: solo cuántos.
-- Lo lee, lo marca (nuevo, visto, resuelto) y lo borra un admin, en
-- Administración → Problemas. Nadie lo escribe directo: solo por estas dos
-- funciones, que ponen el correo de quien llama (no el que diga la app) y
-- tienen su tope por hora.
--
-- LO QUE NUNCA VIAJA: el contenido de los posteos, de los comentarios ni de la
-- Agenda. `tecnico` lleva solo el navegador, el tamaño de pantalla, el idioma y
-- la vista; `mensaje` de un error automático ya sale de la app sin textos entre
-- comillas ni correos ni direcciones (index.html, textoDeErrorSeguro).

create table if not exists public.problemas (
  id        uuid primary key default gen_random_uuid(),
  creado    timestamptz not null default now(),
  ultimo    timestamptz not null default now(),
  origen    text not null,
  autor     text not null,
  nombre    text,
  pantalla  text,
  mensaje   text,
  tecnico   jsonb,
  estado    text not null default 'nuevo',
  huella    text,
  veces     integer not null default 1,
  personas  text[] not null default '{}'
);
alter table public.problemas drop constraint if exists problemas_forma;
alter table public.problemas add constraint problemas_forma check (
  origen in ('persona', 'automatico')
  and estado in ('nuevo', 'visto', 'resuelto')
  and char_length(coalesce(pantalla, '')) <= 60
  and char_length(coalesce(mensaje, '')) <= 1000
  and char_length(coalesce(huella, '')) <= 64
  and char_length(coalesce(nombre, '')) <= 120
  and (tecnico is null or (jsonb_typeof(tecnico) = 'object' and pg_column_size(tecnico) <= 4096))
  and veces between 1 and 1000000
  and cardinality(personas) <= 200
);
create index if not exists problemas_huella on public.problemas (huella) where origen = 'automatico';

alter table public.problemas enable row level security;
revoke all on public.problemas from anon, authenticated;
-- Un admin ve, cambia SOLO el estado y borra. Nadie inserta directo.
grant select, delete on public.problemas to authenticated;
grant update (estado) on public.problemas to authenticated;
drop policy if exists problemas_leer on public.problemas;
create policy problemas_leer on public.problemas for select
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists problemas_cambiar on public.problemas;
create policy problemas_cambiar on public.problemas for update
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()))
  with check ((select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists problemas_borrar on public.problemas;
create policy problemas_borrar on public.problemas for delete
  using ((select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- «Algo no anda»: lo que cuenta una persona. Hasta 10 por hora por persona.
create or replace function public.contar_problema(p_pantalla text, p_mensaje text, p_tecnico jsonb) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); recientes integer;
begin
  if yo is null or not public.esta_aprobado() then return false; end if;
  if coalesce(btrim(p_mensaje), '') = '' then return false; end if;
  select count(*) into recientes from public.problemas
   where autor = yo and origen = 'persona' and creado > now() - interval '1 hour';
  if recientes >= 10 then return false; end if;
  -- Lo técnico va si es un objeto de tamaño razonable; si no, sin él.
  if p_tecnico is not null and (jsonb_typeof(p_tecnico) <> 'object' or pg_column_size(p_tecnico) > 4096) then p_tecnico := null; end if;
  insert into public.problemas(origen, autor, nombre, pantalla, mensaje, tecnico, personas)
    values ('persona', yo, (select nullif(m.name, '') from public.members m where m.email = yo),
            left(coalesce(p_pantalla, ''), 60), left(btrim(p_mensaje), 1000), p_tecnico, array[yo]);
  return true;
end $$;
revoke execute on function public.contar_problema(text, text, jsonb) from public, anon;
grant execute on function public.contar_problema(text, text, jsonb) to authenticated;

-- Un error que la app anotó sola. El mismo (la misma huella) que ya está sin
-- resolver suma una vez más y la persona a quien le pasó; si no hay o ya estaba
-- resuelto, se abre uno nuevo (si volvió a pasar, el admin lo tiene que ver).
-- Hasta 20 errores NUEVOS por hora por persona: sumar a uno que ya existe no
-- hace crecer la tabla.
create or replace function public.anotar_error(p_huella text, p_pantalla text, p_mensaje text, p_tecnico jsonb) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); nuevos integer;
begin
  if yo is null or not public.esta_aprobado() then return false; end if;
  if coalesce(p_huella, '') = '' or char_length(p_huella) > 64 then return false; end if;
  update public.problemas set veces = least(veces + 1, 1000000), ultimo = now(),
         personas = case when yo = any(personas) or cardinality(personas) >= 200 then personas else personas || yo end
   where origen = 'automatico' and huella = p_huella and estado <> 'resuelto';
  if found then return true; end if;
  select count(*) into nuevos from public.problemas
   where origen = 'automatico' and autor = yo and creado > now() - interval '1 hour';
  if nuevos >= 20 then return false; end if;
  if p_tecnico is not null and (jsonb_typeof(p_tecnico) <> 'object' or pg_column_size(p_tecnico) > 4096) then p_tecnico := null; end if;
  insert into public.problemas(origen, autor, pantalla, mensaje, tecnico, huella, personas)
    values ('automatico', yo, left(coalesce(p_pantalla, ''), 60), left(coalesce(p_mensaje, ''), 1000), p_tecnico, p_huella, array[yo]);
  return true;
end $$;
revoke execute on function public.anotar_error(text, text, text, jsonb) from public, anon;
grant execute on function public.anotar_error(text, text, text, jsonb) to authenticated;
