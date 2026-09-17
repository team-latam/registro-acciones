-- ============================================================
-- Registro de Acciones — Paso 6: los cambios en vivo
-- ============================================================
-- Supabase NO manda los cambios de una tabla a los navegadores conectados
-- hasta que se la agrega a su lista de publicación. Viene vacía de
-- fábrica, y es fácil no enterarse: todo anda, uno escribe algo, y a los
-- demás no les aparece hasta que recargan.
--
-- Es lo que en Firestore pasaba solo con onSnapshot.
--
-- Esto NO reemplaza los permisos: cada quien sigue recibiendo únicamente
-- los cambios de las filas que tiene derecho a ver.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

do $$
declare t text;
begin
  -- En Supabase la publicación ya existe; en una base local, no.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['posts','replies','members','former_members',
                           'access_requests','user_prefs','app_config','audit_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Para comprobar que quedaron las ocho:
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
