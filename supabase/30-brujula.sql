-- ============================================================
-- Brújula en Toldot: el catálogo de carpetas, los paquetes y las planillas (23/11/2026)
-- ============================================================
-- Brújula son carpetas de Google Drive que se comparten, en modo lectura, con
-- gente de las comunidades (docs/brujula/README.md). Esta parte de la base guarda
-- SOLO lo que Toldot decide y edita:
--   - `brujula_carpetas`: el catálogo. Cada carpeta se agrega pegando su link de
--     Drive; la clave es el ID de Drive que sale del link. Tiene un nombre propio
--     (el de Drive no se toca), un orden, si se ofrece al invitar (`activa`) y en
--     qué planillas se anota a quien la reciba (`planillas`).
--   - `brujula_planillas`: las planillas de Google («Users») donde el Script de los
--     lunes lee a quién darle acceso. Toldot las lee y, desde la etapa 2, escribe.
--   - `brujula_paquetes` y `brujula_paquete_carpetas`: grupos de carpetas para
--     elegirlas más rápido al invitar («Todo Brújula», «Solo CARE»).
--
-- LO QUE NO SE GUARDA ACÁ: quién tiene acceso a qué. Esa verdad vive en Drive y la
-- cambian también las planillas, así que Toldot la LEE de Drive cada vez (función
-- `brujula`, supabase/functions/). Así esta base no guarda una copia de los
-- nombres ni de los correos de las personas de afuera.
--
-- Es solo del admin (el fijo o el de rol): ni leer ni escribir lo puede otra persona.
-- Los ID de Drive y de las planillas son privados: no van al repo, solo a esta base.

-- La función que usa `brujula` (la función de Supabase) para saber si quien llama es admin,
-- con la sesión de quien llama: la decide la base, no la función.
create or replace function public.puede_gestionar_brujula() returns boolean
  language sql stable as $$ select public.es_admin_fijo() or public.es_admin_rol() $$;

-- ---------- Las tablas ----------
create table if not exists public.brujula_planillas (
  id      text primary key,
  nombre  text not null,
  orden   integer not null default 0
);

create table if not exists public.brujula_carpetas (
  id           text primary key,
  nombre       text not null,
  nombre_drive text,
  orden        integer not null default 0,
  activa       boolean not null default true,
  planillas    text[] not null default '{}',
  creada       timestamptz not null default now(),
  creada_por   text default public.mi_correo()
);

create table if not exists public.brujula_paquetes (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  orden   integer not null default 0
);

-- Con su propio `id` (y no con la pareja como clave) para que la copia de seguridad la pueda
-- leer de a páginas en un orden fijo, como a las demás tablas.
create table if not exists public.brujula_paquete_carpetas (
  id      uuid primary key default gen_random_uuid(),
  paquete uuid not null references public.brujula_paquetes(id) on delete cascade,
  carpeta text not null references public.brujula_carpetas(id) on delete cascade,
  unique (paquete, carpeta)
);

-- ---------- La forma de lo que se guarda ----------
-- Un ID de Drive o de una planilla: letras, números, guion y guion bajo. Lo que
-- no tiene esa forma (un link entero, algo con espacios o barras) no entra.
alter table public.brujula_planillas drop constraint if exists brujula_planillas_forma;
alter table public.brujula_planillas add constraint brujula_planillas_forma check (
  id ~ '^[A-Za-z0-9_-]{10,100}$'
  and char_length(btrim(nombre)) between 1 and 80
  and orden between 0 and 1000
);

alter table public.brujula_carpetas drop constraint if exists brujula_carpetas_forma;
alter table public.brujula_carpetas add constraint brujula_carpetas_forma check (
  id ~ '^[A-Za-z0-9_-]{10,100}$'
  and char_length(btrim(nombre)) between 1 and 120
  and char_length(coalesce(nombre_drive, '')) <= 300
  and orden between 0 and 1000
  -- hasta 10 planillas, cada una con la forma de un ID (se junta con comas: un CHECK no
  -- puede mirar adentro del arreglo con una subconsulta)
  and cardinality(planillas) <= 10
  and array_to_string(planillas, ',') ~ '^([A-Za-z0-9_-]{10,100}(,[A-Za-z0-9_-]{10,100})*)?$'
);

alter table public.brujula_paquetes drop constraint if exists brujula_paquetes_forma;
alter table public.brujula_paquetes add constraint brujula_paquetes_forma check (
  char_length(btrim(nombre)) between 1 and 60
  and orden between 0 and 1000
);
-- Dos paquetes con el mismo nombre (sin mirar mayúsculas) no tienen sentido.
create unique index if not exists brujula_paquetes_nombre on public.brujula_paquetes (lower(btrim(nombre)));
create index if not exists brujula_paquete_carpetas_carpeta on public.brujula_paquete_carpetas (carpeta);

-- ---------- Quién puede ----------
-- Solo el admin (el fijo o el de rol): ver, sumar, cambiar y sacar. Nadie más, ni
-- siquiera leer. De `brujula_carpetas` no se cambia a mano quién la sumó ni cuándo
-- (`creada_por` lo pone la base con el correo de quien llama).
do $$
declare t text;
begin
  foreach t in array array['brujula_planillas', 'brujula_carpetas', 'brujula_paquetes', 'brujula_paquete_carpetas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for all using ((select public.puede_gestionar_brujula())) with check ((select public.puede_gestionar_brujula()))', t || '_admin', t);
  end loop;
end $$;

grant select, delete on public.brujula_planillas, public.brujula_carpetas, public.brujula_paquetes, public.brujula_paquete_carpetas to authenticated;
grant insert (id, nombre, orden) on public.brujula_planillas to authenticated;
grant update (nombre, orden) on public.brujula_planillas to authenticated;
grant insert (id, nombre, nombre_drive, orden, activa, planillas) on public.brujula_carpetas to authenticated;
grant update (nombre, nombre_drive, orden, activa, planillas) on public.brujula_carpetas to authenticated;
grant insert (nombre, orden) on public.brujula_paquetes to authenticated;
grant update (nombre, orden) on public.brujula_paquetes to authenticated;
grant insert (paquete, carpeta) on public.brujula_paquete_carpetas to authenticated;
