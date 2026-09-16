-- ============================================================
-- Registro de Acciones — Paso 4: las dos funciones del me gusta
-- ============================================================
-- Todo lo demás la app lo puede hacer con lecturas y escrituras normales.
-- El me gusta no, por un motivo concreto: si el navegador se trajera la
-- lista, le agregara su correo y la escribiera entera, dos personas
-- dándole me gusta al mismo tiempo se pisarían — la segunda guardaría una
-- lista armada sobre una foto vieja, sin el me gusta de la primera.
--
-- En Firestore eso lo resuelve arrayUnion, que suma un elemento sin
-- traerse la lista. Acá se resuelve con estas dos funciones: la suma la
-- hace la base, en una sola operación, sobre el valor que hay en ese
-- instante.
--
-- Quién da el me gusta NO es un parámetro: sale de la credencial. Así
-- nadie puede dar me gusta en nombre de otro ni pasándolo a mano.
--
-- `security invoker` a propósito: corren con los permisos de quien llama,
-- así que siguen pasando por las políticas del paso 2. No son una puerta
-- de atrás.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

create or replace function public.me_gusta_posteo(p_id text, p_puesto boolean)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para dar me gusta'
      using errcode = 'insufficient_privilege';
  end if;
  -- El `and` del final evita escribir cuando no hay nada que cambiar (dar
  -- me gusta dos veces, o sacar uno que no estaba). Sin eso, esa escritura
  -- vacía cae en el control de edición y un me gusta repetido sobre la
  -- Rutina de otra persona terminaría rebotando con un error confuso.
  update public.posts
     set liked_by = case when p_puesto then liked_by || yo
                         else array_remove(liked_by, yo) end
   where id = p_id
     and p_puesto <> (yo = any(liked_by));
end $$;

create or replace function public.me_gusta_comentario(p_id text, p_puesto boolean)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para dar me gusta'
      using errcode = 'insufficient_privilege';
  end if;
  update public.replies
     set liked_by = case when p_puesto then liked_by || yo
                         else array_remove(liked_by, yo) end
   where id = p_id
     and p_puesto <> (yo = any(liked_by));
end $$;

grant execute on function public.me_gusta_posteo(text, boolean) to authenticated;
grant execute on function public.me_gusta_comentario(text, boolean) to authenticated;


-- ============================================================
-- La marca de "poné vos la hora"
-- ============================================================
-- Hay fechas que la app manda adentro de otra escritura: cuándo se editó
-- un posteo, cuándo se dio un hito por cumplido, cuándo se compartió el
-- Calendar. En Firestore para eso existe un valor especial que el servidor
-- reemplaza por su propio reloj al escribir; acá no hay nada parecido, y
-- el navegador solo puede mandar una fecha.
--
-- Mandar la del navegador sería aflojar algo que hoy está firme: la hora
-- de una edición no puede depender del reloj de quien edita (que puede
-- estar mal, o mentir). Así que la base la pone ella, de dos maneras
-- según el caso:
--
--   posts   -> se PISA siempre lo que haya mandado el navegador. Da igual
--              qué fecha mande: la de verdad es la de la base.
--   members -> se usa una MARCA (el 1 de enero de 1970, que no es una
--              fecha posible acá), porque esas fechas a veces hay que
--              CONSERVARLAS: la de alta de alguien no se vuelve a poner
--              cada vez que el admin entra.
--
-- Las fechas de creación no pasan por acá: esas ya las pone el servidor
-- solo, en el paso 3.

create or replace function public.posts_marca_de_hora() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  -- La importación manda las fechas REALES de Firebase: no se tocan.
  if public.sin_sesion_de_persona() then return new; end if;

  -- Desde el navegador la hora la pone SIEMPRE la base, mire lo que mire
  -- el reloj de quien edita. No hace falta ninguna marca: da igual qué
  -- fecha mande, se ignora. Así nadie puede decir que editó algo ayer, que
  -- es exactamente la garantía que daba Firestore.
  if tg_op = 'INSERT' then
    if new.last_edited_at is not null  then new.last_edited_at  := now(); end if;
    if new.project_done_at is not null then new.project_done_at := now(); end if;
    return new;
  end if;

  if new.last_edited_at is distinct from old.last_edited_at and new.last_edited_at is not null then
    new.last_edited_at := now();
  end if;
  -- Al destildar un hito la app manda null, y eso hay que respetarlo: solo
  -- se pisa cuando se está poniendo una fecha.
  if new.project_done_at is distinct from old.project_done_at and new.project_done_at is not null then
    new.project_done_at := now();
  end if;
  return new;
end $$;

drop trigger if exists posts_marca_de_hora on public.posts;
create trigger posts_marca_de_hora before insert or update on public.posts
  for each row execute function public.posts_marca_de_hora();

-- En el roster es distinto y por eso acá SÍ se usa la marca: la fecha de
-- alta de alguien no se vuelve a poner cada vez que el admin entra (ver
-- roster.ensure en index.html, que reescribe el documento conservando la
-- fecha original). Pisarla siempre le borraría a cada uno desde cuándo
-- está en el equipo.
create or replace function public.members_marca_de_hora() returns trigger
  language plpgsql as $$
begin
  if new.approved_at = 'epoch'             then new.approved_at := now(); end if;
  if new.calendar_invite_sent_at = 'epoch' then new.calendar_invite_sent_at := now(); end if;
  if new.tour_seen_at = 'epoch'            then new.tour_seen_at := now(); end if;
  return new;
end $$;

drop trigger if exists members_marca_de_hora on public.members;
create trigger members_marca_de_hora before insert or update on public.members
  for each row execute function public.members_marca_de_hora();


-- ============================================================
-- Guardar "solo esto" sin pisar el resto
-- ============================================================
-- Las preferencias de cada persona y la configuración del equipo son un
-- bloque entero de datos donde cada control guarda UN campo. En Firestore
-- eso es merge:true y lo resuelve el servidor. Acá, si el navegador se
-- trajera el bloque, le cambiara un campo y lo escribiera entero, dos
-- controles tocados rápido se pisarían: el segundo guardaría un bloque
-- armado sobre una foto vieja y perdería el primero.
--
-- El `||` de Postgres sobre jsonb hace exactamente lo que hace merge:true,
-- y acá corre adentro de la escritura, sobre lo que hay en ese instante.
--
-- De quién son las preferencias NO es un parámetro: sale de la credencial.
-- `security invoker`: siguen pasando por las políticas del paso 2.

create or replace function public.guardar_preferencias(p_parche jsonb)
returns void language plpgsql security invoker as $$
declare yo text := public.mi_correo();
begin
  if yo is null then
    raise exception 'Hay que haber entrado para guardar preferencias'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.user_prefs (email, prefs) values (yo, p_parche)
  on conflict (email) do update set prefs = public.user_prefs.prefs || excluded.prefs;
end $$;

create or replace function public.guardar_config(p_clave text, p_parche jsonb)
returns void language plpgsql security invoker as $$
begin
  insert into public.app_config (key, value) values (p_clave, p_parche)
  on conflict (key) do update set value = public.app_config.value || excluded.value;
end $$;

grant execute on function public.guardar_preferencias(jsonb) to authenticated;
grant execute on function public.guardar_config(text, jsonb) to authenticated;
