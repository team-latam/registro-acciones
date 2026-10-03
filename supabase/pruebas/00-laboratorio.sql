-- Laboratorio: lo mínimo de Supabase para poder probar los permisos acá.
-- NO forma parte de lo que se corre en Supabase: allá esto ya existe.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email'
$$;
create or replace function auth.role() returns text language sql stable as $$
  select auth.jwt() ->> 'role'
$$;

-- Las identidades: lo que guardó Supabase cuando el proveedor (Google)
-- autenticó a alguien. Es de donde sale el correo verdadero de cada cuenta
-- (ver sesion_valida en 02-politicas.sql). Solo las columnas que se usan.
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb,
  unique (user_id, provider));

-- En Supabase la llave de servicio tiene todos los permisos sobre lo que
-- se crea en `public`; acá hay que dárselos para poder probar como ella
-- (el sincronizador nocturno escribe así).
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Storage, lo imprescindible para que las políticas del bucket compilen.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean not null default false,
  -- Las dos que usa 01-tablas.sql para ponerle techo al bucket. En Supabase
  -- de verdad ya vienen; acá hay que declararlas o ese archivo se cae con
  -- "column does not exist" y la prueba no prueba nada.
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now(),
  updated_at timestamptz default now(), metadata jsonb);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;

-- ---------- El banco de pruebas ----------
-- Vive acá y no adentro de cada archivo de pruebas: así cualquiera de
-- ellos se puede correr solo, después de levantar la base.
create schema if not exists lab;

-- Una credencial de mentira, con la forma que manda Supabase de verdad, y
-- la identidad que Supabase guardó para esa cuenta. Cada correo tiene su
-- propio usuario (sub): el identificador sale del correo, así que la misma
-- persona es siempre la misma cuenta en todas las pruebas.
create or replace function lab.uid_de(correo text) returns uuid
  language sql immutable as $$ select md5('cuenta:' || lower(correo))::uuid $$;

-- `security definer`: hay pruebas que se pasan a `authenticated` antes de
-- pedir la credencial, y desde ahí no se puede escribir auth.identities.
create or replace function lab.como(correo text, proveedor text default 'google', verificado boolean default true)
returns jsonb language plpgsql security definer as $$
begin
  insert into auth.identities (user_id, provider, identity_data)
  values (lab.uid_de(correo), case when proveedor = 'google' then 'google' else 'email' end,
          jsonb_build_object('email', correo, 'email_verified', verificado))
  on conflict (user_id, provider) do update set identity_data = excluded.identity_data;
  return jsonb_build_object(
    'sub', lab.uid_de(correo),
    'email', correo, 'role', 'authenticated',
    'app_metadata', jsonb_build_object('provider', proveedor),
    'user_metadata', jsonb_build_object('email_verified', verificado));
end $$;

-- Alguien que entró con SU Google pero se cambió el correo de la cuenta de
-- Supabase por el de otra persona (posible si el panel tuviera apagado
-- «Confirm email»): el token dice `correo_del_token`, pero lo que Google
-- autenticó es `correo_de_google`. Hasta tiene user_metadata.email_verified
-- en true, porque eso también lo puede reescribir el propio usuario.
create or replace function lab.como_suplantando(correo_del_token text, correo_de_google text)
returns jsonb language plpgsql security definer as $$
begin
  perform lab.como(correo_de_google);
  return jsonb_build_object(
    'sub', lab.uid_de(correo_de_google),
    'email', correo_del_token, 'role', 'authenticated',
    'app_metadata', jsonb_build_object('provider', 'google'),
    'user_metadata', jsonb_build_object('email_verified', true));
end $$;

create table if not exists lab.resultados(n serial, nombre text, esperado boolean, obtenido boolean, detalle text);

-- Corre una sentencia haciéndose pasar por alguien, anota si la dejó o no,
-- y deshace lo que haya hecho: cada prueba arranca del mismo estado.
create or replace function lab.probar(nombre text, quien jsonb, sentencia text, espera boolean)
returns void language plpgsql as $$
declare n int; ok boolean; detalle text := '';
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', quien::text, true);
    execute sentencia;
    get diagnostics n = row_count;
    raise exception using errcode = '22000', message = 'FILAS=' || n;
  exception
    when sqlstate '22000' then
      if sqlerrm like 'FILAS=%' then
        n := replace(sqlerrm, 'FILAS=', '')::int;
        ok := n > 0;
        if not ok then detalle := 'no tocó ninguna fila'; end if;
      else ok := false; detalle := sqlerrm; end if;
    when others then ok := false; detalle := left(sqlerrm, 90);
  end;
  execute 'reset role';
  insert into lab.resultados(nombre, esperado, obtenido, detalle) values (nombre, espera, ok, detalle);
end $$;

-- Igual, pero comprueba un VALOR y no solo si dejó o no dejó.
create or replace function lab.probar_valor(nombre text, quien jsonb, sentencia text, consulta text, espera text)
returns void language plpgsql as $$
declare obtenido text; ok boolean;
begin
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', quien::text, true);
    execute sentencia;
    execute consulta into obtenido;
    raise exception using errcode = '22000', message = 'VAL=' || coalesce(obtenido, '(nulo)');
  exception
    when sqlstate '22000' then
      if sqlerrm like 'VAL=%' then obtenido := replace(sqlerrm, 'VAL=', '');
      else obtenido := left(sqlerrm, 70); end if;
    when others then obtenido := left(sqlerrm, 70);
  end;
  execute 'reset role';
  ok := obtenido = espera;
  insert into lab.resultados(nombre, esperado, obtenido, detalle)
    values (nombre, true, ok, case when ok then '' else 'dio: ' || obtenido end);
end $$;

-- Igual que probar_valor, pero escribiendo con la llave de servicio, como
-- el sincronizador nocturno: sin correo y por encima de las políticas.
create or replace function lab.probar_valor_servicio(nombre text, sentencia text, consulta text, espera text)
returns void language plpgsql as $$
declare obtenido text; ok boolean;
begin
  begin
    execute 'set local role service_role';
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    execute sentencia;
    execute consulta into obtenido;
    raise exception using errcode = '22000', message = 'VAL=' || coalesce(obtenido, '(nulo)');
  exception
    when sqlstate '22000' then
      if sqlerrm like 'VAL=%' then obtenido := replace(sqlerrm, 'VAL=', '');
      else obtenido := left(sqlerrm, 70); end if;
    when others then obtenido := left(sqlerrm, 70);
  end;
  execute 'reset role';
  ok := obtenido = espera;
  insert into lab.resultados(nombre, esperado, obtenido, detalle)
    values (nombre, true, ok, case when ok then '' else 'dio: ' || obtenido end);
end $$;

-- El banco de pruebas corre haciéndose pasar por `authenticated`, así que
-- necesita poder llegar a sus propias funciones. Esto es SOLO del
-- laboratorio local: en Supabase el esquema `lab` no existe.
grant usage on schema lab to anon, authenticated;
alter default privileges in schema lab grant execute on functions to authenticated;
