-- Un integrante o un observador NO es el admin fijo (aunque figure con ese rol: el admin fijo lo es siempre).
-- Lo que papelera.sql repite para cada rol (:rol). Va aparte porque psql no tiene bucles.
\echo
\echo == Como :rol ==
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
  set local role authenticated;
  do $$
  declare p int; v int;
  begin
    select count(*) into p from storage.objects where bucket_id = 'adjuntos' and split_part(name, '/', 1) = 'papelera';
    select count(*) into v from storage.objects where bucket_id = 'adjuntos' and split_part(name, '/', 1) in ('posts', 'replies');
    raise notice 've % archivos de la papelera y % de posts/ y replies/', p, v;
    if p > 0 then raise exception 'FALLÓ: este rol puede ver % archivos de la papelera', p; end if;
    -- El control: si hay archivos en posts/ y replies/ y este rol no ve ninguno, la prueba no está
    -- haciendo pasar bien a la cuenta, y un «0 en la papelera» no querría decir nada.
    if current_setting('verificar.publicos')::int > 0 and v = 0 then raise exception 'FALLÓ el control: no ve ni los archivos de posts/ y replies/ (la prueba no entró como esa cuenta)'; end if;
  end $$;
  reset role;
\else
  \echo (no hay ninguna cuenta de ese rol que haya entrado con Google: no se puede probar)
\endif
