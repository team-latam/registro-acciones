-- Un integrante o un observador NO es el admin fijo (aunque figure con ese rol: el admin fijo lo es siempre).
-- Lo que permisos.sql repite para cada rol (:rol). Va aparte porque psql no tiene bucles.
\echo
\echo == Lo que ve como :rol ==
select coalesce((select i.user_id::text from auth.identities i join public.members m on lower(m.email) = lower(i.identity_data ->> 'email')
                  where i.provider = 'google' and ((:'rol' = 'admin' and (m.role = 'admin' or lower(m.email) = lower(public.admin_fijo())))
                    or (:'rol' <> 'admin' and m.role = :'rol' and lower(m.email) <> lower(public.admin_fijo()))) order by m.email limit 1), '') as uid,
       coalesce((select lower(i.identity_data ->> 'email') from auth.identities i join public.members m on lower(m.email) = lower(i.identity_data ->> 'email')
                  where i.provider = 'google' and ((:'rol' = 'admin' and (m.role = 'admin' or lower(m.email) = lower(public.admin_fijo())))
                    or (:'rol' <> 'admin' and m.role = :'rol' and lower(m.email) <> lower(public.admin_fijo()))) order by m.email limit 1), '') as correo \gset
select (:'uid' <> '') as hay \gset
\if :hay
  select set_config('request.jwt.claims', json_build_object('sub', :'uid', 'email', :'correo', 'role', 'authenticated', 'aud', 'authenticated',
                    'app_metadata', json_build_object('provider', 'google'))::text, true) as _ \gset
  select set_config('verificar.rol', :'rol', true) as _ \gset
  select set_config('verificar.correo', :'correo', true) as _ \gset
  set local role authenticated;
  do $$
  declare rol text := current_setting('verificar.rol', true); posteos int; auditoria int; sugerencias int; sacados int; pedidos int; ajenos int;
  begin
    select count(*) into posteos from public.posts;
    select count(*) into auditoria from public.audit_log;
    select count(*) into sugerencias from public.calendar_sugerencias;
    select count(*) into sacados from public.calendar_sacados;
    select count(*) into pedidos from public.access_requests;
    select count(*) into ajenos from public.access_requests where lower(email) <> lower(current_setting('verificar.correo'));
    raise notice 've % posteos, % filas del registro de actividad, % sugerencias de Calendar, % posteos sacados y % pedidos de acceso', posteos, auditoria, sugerencias, sacados, pedidos;
    -- Las tablas vacías no prueban nada: que un rol no vea nada de una tabla sin filas no dice si la regla anda.
    if rol <> 'admin' then
      if current_setting('verificar.auditoria')::int = 0 then raise notice '(el registro de actividad está vacío: no se puede comprobar)'; end if;
      if current_setting('verificar.sugerencias')::int = 0 then raise notice '(no hay sugerencias de Calendar: no se puede comprobar)'; end if;
    end if;
    -- El control: si hay posteos y no ve ninguno, la prueba no entró bien como esa cuenta.
    if current_setting('verificar.posteos')::int > 0 and posteos = 0 then
      raise exception 'FALLÓ el control: no ve ni los posteos (la prueba no entró como esa cuenta)'; end if;
    -- Lo de administración lo ve un admin y nadie más (políticas audit_leer y sugerencias_leer).
    if rol <> 'admin' and (auditoria > 0 or sugerencias > 0) then
      raise exception 'FALLÓ: quien no es admin ve % filas del registro de actividad y % sugerencias de Calendar', auditoria, sugerencias; end if;
    -- Lo sacado del Registro lo lee quien puede escribir posteos; un observador, no (sacados_leer).
    if rol = 'observer' and sacados > 0 then raise exception 'FALLÓ: un observador ve % posteos sacados del Registro', sacados; end if;
    -- Los pedidos de acceso: un admin los ve todos; el resto, solo el suyo (policy solicitudes_leer: el suyo queda
    -- aunque ya lo hayan aprobado). Ver el de otra persona es la falla.
    if rol <> 'admin' and ajenos > 0 then raise exception 'FALLÓ: quien no es admin ve % pedidos de acceso de otras personas', ajenos; end if;
  end $$;
  reset role;
\else
  \echo (no hay ninguna cuenta de ese rol que haya entrado con Google: no se puede probar)
\endif
