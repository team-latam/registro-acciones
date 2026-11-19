-- ============================================================
-- Gastos y rendiciones: la etapa de prueba (15/11/2026)
-- ============================================================
-- Lo que se acordó con el usuario, pregunta por pregunta
-- (docs/rendicion-gastos/README.md): cada persona carga sus gastos —una foto o
-- un PDF del comprobante y sus datos— en una actividad en la que participó o
-- en «la rutina del mes»; manda la rendición entera; un admin la revisa, puede
-- OBSERVAR un gasto con un comentario (la persona corrige y la vuelve a
-- mandar) y la aprueba toda junta. Aparte, una cuenta corriente por persona y
-- por moneda: lo gastado de su bolsillo, lo que recibió (adelantos y
-- reintegros) y lo que devolvió.
--
-- LO QUE NO SE NEGOCIA: cada persona ve SOLO lo suyo (ni los gastos, ni los
-- comentarios, ni la cuenta de otra); los admins ven todo. Lo controla la
-- base, no la pantalla.
--
-- La etapa de prueba es solo para admins: para el resto se abre con
-- `app_config 'preferences' → gastos.abierto = true` (gastos_habilitado).
-- Mientras tanto, una cuenta común no lee ni escribe nada de acá aunque llame
-- a la base por su cuenta. Las reglas de cada persona ya quedan armadas:
-- abrirlo es prender eso, no reconstruir nada.
--
-- Todo es aparte: cuatro tablas nuevas, sin tocar posts ni replies. Volver
-- atrás es sacar este archivo (y las tablas), sin afectar lo demás.
--
-- Montos: el del comprobante, en su moneda (`monto`, `moneda`), y el que se
-- rinde (`rendido_monto`, `rendido_moneda`, casi siempre USD), que lo ESCRIBE
-- la persona con lo que le cobró su banco: la base nunca convierte. Un gasto
-- sin monto rendido cuenta en su moneda local.
--
-- Se puede correr más de una vez sin romper nada.
-- ============================================================

-- ---------- ¿Los gastos están abiertos para quien llama? ----------
-- Un admin, siempre. El resto, si puede cargar (un observador, nunca) y el
-- módulo está abierto al equipo: desde el 19/11/2026 lo está salvo que un
-- admin lo cierre (`gastos.abierto = false`): dejó de ser una prueba.
create or replace function public.gastos_habilitado() returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.es_admin_fijo() or public.es_admin_rol()
      or (public.puede_escribir()
          and coalesce((select (c.value -> 'gastos' ->> 'abierto') is distinct from 'false'
                          from public.app_config c where c.key = 'preferences'), true))
$$;

-- Un total por moneda: {"USD": 1910.67, "BZD": 300}. Códigos de tres letras
-- en mayúscula, números con hasta dos decimales, hasta diez monedas.
create or replace function public.gastos_totales_ok(t jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(t) = 'object'
     and (select count(*) from jsonb_object_keys(t)) <= 10
     and not exists (
       select 1 from jsonb_each(t) e
        where e.key !~ '^[A-Z]{3}$'
           or jsonb_typeof(e.value) <> 'number'
           or abs((e.value #>> '{}')::numeric) >= 10000000000
           or (e.value #>> '{}')::numeric <> round((e.value #>> '{}')::numeric, 2))
$$;


-- ============================================================
-- Las tablas
-- ============================================================

-- Una rendición: lo de UNA persona en UNA actividad, o en su rutina de UN
-- mes. Si el admin borra el posteo, la rendición queda (con el título que
-- tenía) y sin actividad: un gasto ya rendido no desaparece.
create table if not exists public.gastos_rendiciones (
  id                      uuid primary key default gen_random_uuid(),
  autor                   text not null,
  post_id                 text references public.posts(id) on delete set null,
  rutina_mes              date,
  titulo                  text not null default '',
  estado                  text not null default 'abierta',
  enviada_el              timestamptz,
  aprobada_el             timestamptz,
  aprobada_por            text,
  -- «Total rápido»: lo que la persona anota que gastó, sin el detalle.
  total_manual            jsonb not null default '{}'::jsonb,
  total_manual_confirmado boolean not null default false,
  total_manual_por        text,
  total_manual_el         timestamptz,
  creada_el               timestamptz not null default now(),
  tocada_el               timestamptz not null default now()
);
alter table public.gastos_rendiciones drop constraint if exists rendiciones_forma;
alter table public.gastos_rendiciones add constraint rendiciones_forma check (
  estado in ('abierta', 'enviada', 'observada', 'aprobada')
  and length(autor) between 3 and 200
  and not (post_id is not null and rutina_mes is not null)
  and (rutina_mes is null or (extract(day from rutina_mes) = 1 and rutina_mes between '2000-01-01' and '2100-12-01'))
  and length(titulo) <= 200
  and public.gastos_totales_ok(total_manual)
  and length(coalesce(total_manual_por, '')) <= 200
  and length(coalesce(aprobada_por, '')) <= 200
);
create unique index if not exists rendiciones_por_actividad on public.gastos_rendiciones (autor, post_id) where post_id is not null;
create unique index if not exists rendiciones_por_mes on public.gastos_rendiciones (autor, rutina_mes) where rutina_mes is not null;
create index if not exists rendiciones_estado on public.gastos_rendiciones (estado);

-- Un gasto. Sin rendición = «sin vincular» (la actividad todavía no está
-- cargada): se asigna después.
create table if not exists public.gastos (
  id             uuid primary key default gen_random_uuid(),
  autor          text not null,
  rendicion_id   uuid references public.gastos_rendiciones(id) on delete restrict,
  fecha          date,
  concepto       text not null default '',
  tipo           text,
  moneda         text not null default 'USD',
  monto          numeric(14, 2),
  rendido_moneda text not null default 'USD',
  rendido_monto  numeric(14, 2),
  -- Quién puso la plata: la organización (tarjeta de la organización: a la
  -- persona no se le debe nada), la persona (de su bolsillo, o de un
  -- adelanto que tiene: entra en su cuenta corriente) u otra persona de la
  -- actividad ('otro', con pago_quien; más abajo).
  pago           text not null default 'persona',
  forma_pago     text,
  tarjeta        text,
  factura        boolean not null default true,
  observaciones  text not null default '',
  estado         text not null default 'borrador',
  -- El comprobante, en el bucket: gastos/<id del gasto>/<archivo>.
  archivo        text,
  archivo_nombre text,
  archivo_tipo   text,
  archivo_hash   text,
  -- Lo que leyó el lector del comprobante (las sugerencias y qué tan seguro
  -- estaba), para saber después de dónde salió cada dato.
  lectura        jsonb,
  creado_el      timestamptz not null default now(),
  tocado_el      timestamptz not null default now()
);
-- Otra persona que participó de la actividad también puede haber pagado un
-- gasto (lo pidió el usuario el 18/11): pago = 'otro' y en pago_quien quién
-- fue (su correo si tiene cuenta, o su nombre). No entra en ninguna cuenta
-- corriente: ni en la de quien rinde ni en la suya (gastos_cuenta cuenta solo
-- pago = 'persona').
alter table public.gastos add column if not exists pago_quien text;
-- Cuándo se aprobó cada gasto (18/11/2026). Al reabrir una rendición, lo ya
-- aprobado queda aprobado y lo que se suma (o se corrige) se revisa aparte
-- (lo pidió el usuario: «el único que debería quedar para revisar tiene que
-- ser el que tuvo cambios»). Y el PDF de entrega numera primero lo aprobado
-- antes y al final lo que llegó tarde, así los números de un PDF ya
-- entregado no cambian (lo eligió el usuario). Lo pone la base al aprobar;
-- nadie lo escribe desde el navegador.
alter table public.gastos add column if not exists aprobado_el timestamptz;
alter table public.gastos drop constraint if exists gastos_forma;
alter table public.gastos add constraint gastos_forma check (
  estado in ('borrador', 'confirmado', 'enviado', 'observado', 'aprobado')
  and length(autor) between 3 and 200
  and pago in ('organizacion', 'persona', 'otro')
  and (pago = 'otro' or pago_quien is null) and length(coalesce(pago_quien, '')) <= 200
  and (forma_pago is null or forma_pago in ('tarjeta', 'efectivo', 'transferencia'))
  and (tarjeta is null or tarjeta ~ '^[0-9]{4}$')
  and moneda ~ '^[A-Z]{3}$' and rendido_moneda ~ '^[A-Z]{3}$'
  and (tipo is null or tipo ~ '^[a-z0-9_]{1,40}$')
  and (monto is null or abs(monto) < 10000000000)
  and (rendido_monto is null or abs(rendido_monto) < 10000000000)
  and (fecha is null or fecha between '2000-01-01' and '2100-12-31')
  and length(concepto) <= 140 and length(observaciones) <= 500
  and (archivo is null or (archivo like 'gastos/%' and length(archivo) <= 300))
  and length(coalesce(archivo_nombre, '')) <= 200 and length(coalesce(archivo_tipo, '')) <= 100
  and (archivo_hash is null or archivo_hash ~ '^[0-9a-f]{64}$')
  and (lectura is null or (jsonb_typeof(lectura) = 'object' and pg_column_size(lectura) <= 8000))
  -- Un borrador puede estar a medias; confirmado en adelante, no.
  and (estado = 'borrador' or (fecha is not null and btrim(concepto) <> '' and tipo is not null
                               and (pago <> 'otro' or btrim(coalesce(pago_quien, '')) <> '')))
);
-- El mismo comprobante dos veces, de la misma persona: no (es un repetido).
create unique index if not exists gastos_comprobante_unico on public.gastos (autor, archivo_hash) where archivo_hash is not null;
-- Los aprobados de antes del 18/11, con la fecha de aprobación de su rendición.
update public.gastos g set aprobado_el = r.aprobada_el
  from public.gastos_rendiciones r
 where r.id = g.rendicion_id and g.estado = 'aprobado' and g.aprobado_el is null and r.aprobada_el is not null;
create index if not exists gastos_rendicion on public.gastos (rendicion_id);
create index if not exists gastos_autor on public.gastos (autor, estado);

-- Lo que se dijo de un gasto: la observación del admin y la respuesta.
create table if not exists public.gastos_comentarios (
  id        uuid primary key default gen_random_uuid(),
  gasto_id  uuid not null references public.gastos(id) on delete cascade,
  autor     text not null,
  texto     text not null,
  creado_el timestamptz not null default now()
);
alter table public.gastos_comentarios drop constraint if exists comentarios_forma;
alter table public.gastos_comentarios add constraint comentarios_forma check (
  length(btrim(texto)) between 1 and 1000 and length(autor) between 3 and 200
);
create index if not exists comentarios_gasto on public.gastos_comentarios (gasto_id, creado_el);

-- La cuenta corriente: la plata que se mueve entre la persona y la
-- organización. Lo GASTADO no se anota acá: sale de sus rendiciones aprobadas.
--   recibido  la organización le dio plata (un adelanto o un reintegro)
--   devuelto  la persona le devolvió plata a la organización
--   ajuste    un saldo inicial o una corrección (solo un admin; positivo = a
--             favor de la persona)
-- La persona puede anotar lo que recibió o devolvió: queda «pendiente» hasta
-- que un admin lo confirma, y mientras tanto no cuenta en el saldo.
create table if not exists public.gastos_movimientos (
  id             uuid primary key default gen_random_uuid(),
  persona        text not null,
  tipo           text not null,
  fecha          date not null,
  moneda         text not null,
  monto          numeric(14, 2) not null,
  descripcion    text not null default '',
  estado         text not null default 'pendiente',
  cargado_por    text not null,
  confirmado_por text,
  confirmado_el  timestamptz,
  creado_el      timestamptz not null default now()
);
alter table public.gastos_movimientos drop constraint if exists movimientos_forma;
alter table public.gastos_movimientos add constraint movimientos_forma check (
  tipo in ('recibido', 'devuelto', 'ajuste')
  and estado in ('pendiente', 'confirmado')
  and moneda ~ '^[A-Z]{3}$'
  and monto <> 0 and abs(monto) < 10000000000 and (tipo = 'ajuste' or monto > 0)
  and fecha between '2000-01-01' and '2100-12-31'
  and length(descripcion) <= 300
  and length(persona) between 3 and 200 and length(cargado_por) between 3 and 200
);
create index if not exists movimientos_persona on public.gastos_movimientos (persona, fecha);
-- Un comprobante, opcional, de lo recibido, devuelto o ajustado (lo pidió el
-- usuario el 17/11: que quede registro). En `gastos/mov-<id>/<archivo>`, al
-- lado de los de los gastos; el disparador cuida la carpeta.
alter table public.gastos_movimientos add column if not exists archivo text;
alter table public.gastos_movimientos add column if not exists archivo_nombre text;
alter table public.gastos_movimientos add column if not exists archivo_tipo text;
alter table public.gastos_movimientos drop constraint if exists movimientos_archivo;
alter table public.gastos_movimientos add constraint movimientos_archivo check (
  (archivo is null or (archivo like 'gastos/mov-%' and length(archivo) <= 300))
  and length(coalesce(archivo_nombre, '')) <= 200 and length(coalesce(archivo_tipo, '')) <= 100
);


-- Los cambios de moneda de una rendición (18/11/2026, etapa 4: lo eligió el
-- usuario junto con los PDF de entrega). Si en un viaje la persona cambió
-- plata en efectivo (dólares por florines), anota qué entregó, qué recibió
-- (ya con la comisión) y, si tiene, el comprobante. No es un gasto: no suma
-- ni entra en la cuenta corriente. Da la tasa con que se pasan a dólares los
-- gastos en efectivo de esa moneda, y va en el PDF de entrega (la tabla del
-- cambio y su comprobante como anexo), como lo hacía la skill del usuario.
create table if not exists public.gastos_cambios (
  id               uuid primary key default gen_random_uuid(),
  rendicion_id     uuid not null references public.gastos_rendiciones(id) on delete cascade,
  autor            text not null,
  fecha            date not null,
  entregado_moneda text not null default 'USD',
  entregado_monto  numeric(14, 2) not null,
  recibido_moneda  text not null,
  recibido_monto   numeric(14, 2) not null,
  observaciones    text not null default '',
  -- El comprobante (opcional), en el bucket: gastos/cambio-<id>/<archivo>.
  archivo          text,
  archivo_nombre   text,
  archivo_tipo     text,
  creado_el        timestamptz not null default now(),
  tocado_el        timestamptz not null default now()
);
alter table public.gastos_cambios drop constraint if exists cambios_forma;
alter table public.gastos_cambios add constraint cambios_forma check (
  entregado_moneda ~ '^[A-Z]{3}$' and recibido_moneda ~ '^[A-Z]{3}$' and entregado_moneda <> recibido_moneda
  and entregado_monto > 0 and entregado_monto < 10000000000 and recibido_monto > 0 and recibido_monto < 10000000000
  and fecha between '2000-01-01' and '2100-12-31'
  and length(observaciones) <= 300 and length(autor) between 3 and 200
  and (archivo is null or (archivo like 'gastos/cambio-%' and length(archivo) <= 300))
  and length(coalesce(archivo_nombre, '')) <= 200 and length(coalesce(archivo_tipo, '')) <= 100
);
create index if not exists cambios_rendicion on public.gastos_cambios (rendicion_id, fecha);


-- ============================================================
-- Quién puede qué
-- ============================================================
alter table public.gastos_rendiciones enable row level security;
alter table public.gastos             enable row level security;
alter table public.gastos_comentarios enable row level security;
alter table public.gastos_movimientos enable row level security;
alter table public.gastos_cambios     enable row level security;

-- 02-politicas.sql le da insert, update y delete sobre TODAS las tablas a
-- `authenticated` cada vez que se aplica: acá se saca y se da solo lo justo.
-- Rendiciones y comentarios se crean y cambian de estado con las funciones de
-- abajo; de una rendición, la persona toca directo solo su «total rápido».
revoke all on public.gastos_rendiciones, public.gastos, public.gastos_comentarios, public.gastos_movimientos, public.gastos_cambios from anon, authenticated;
grant select, insert, update, delete on public.gastos, public.gastos_movimientos, public.gastos_cambios to authenticated;
grant select, delete on public.gastos_rendiciones to authenticated;
grant update (total_manual, total_manual_confirmado) on public.gastos_rendiciones to authenticated;
grant select, delete on public.gastos_comentarios to authenticated;
grant all on public.gastos_rendiciones, public.gastos, public.gastos_comentarios, public.gastos_movimientos, public.gastos_cambios to service_role;

-- Rendiciones: cada uno las suyas; un admin, todas.
drop policy if exists rendiciones_leer on public.gastos_rendiciones;
create policy rendiciones_leer on public.gastos_rendiciones for select
  using ((autor = (select public.mi_correo()) and (select public.gastos_habilitado()))
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists rendiciones_total on public.gastos_rendiciones;
create policy rendiciones_total on public.gastos_rendiciones for update
  using (autor = (select public.mi_correo()) and (select public.gastos_habilitado()) and estado in ('abierta', 'observada'))
  with check (autor = (select public.mi_correo()));
-- Borrar una rendición: la persona, la suya mientras está abierta (una que
-- quedó vacía al elegir una actividad o en una subida: lo pidió el usuario el
-- 15/11); el admin fijo, cualquiera. Siempre vacía: los gastos la sostienen
-- (`on delete restrict`).
drop policy if exists rendiciones_borrar on public.gastos_rendiciones;
create policy rendiciones_borrar on public.gastos_rendiciones for delete
  using ((select public.es_admin_fijo())
         or (autor = (select public.mi_correo()) and (select public.gastos_habilitado()) and estado = 'abierta'));

-- Gastos: cada uno carga y corrige los suyos mientras no los mandó; un admin
-- los ve todos (los observa y aprueba con las funciones).
drop policy if exists gastos_leer on public.gastos;
create policy gastos_leer on public.gastos for select
  using ((autor = (select public.mi_correo()) and (select public.gastos_habilitado()))
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists gastos_crear on public.gastos;
create policy gastos_crear on public.gastos for insert
  with check (autor = (select public.mi_correo()) and (select public.gastos_habilitado()));
drop policy if exists gastos_editar on public.gastos;
-- Uno observado de una rendición que sigue en revisión (D18, 19/11: se devuelve
-- con todo junto) no se toca hasta que vuelva a la persona.
create policy gastos_editar on public.gastos for update
  using (autor = (select public.mi_correo()) and (select public.gastos_habilitado())
         and estado in ('borrador', 'confirmado', 'observado')
         and (rendicion_id is null or exists (select 1 from public.gastos_rendiciones r
                                               where r.id = rendicion_id and r.estado in ('abierta', 'observada'))))
  with check (autor = (select public.mi_correo()));
drop policy if exists gastos_borrar on public.gastos;
create policy gastos_borrar on public.gastos for delete
  using ((autor = (select public.mi_correo()) and (select public.gastos_habilitado())
          and estado in ('borrador', 'confirmado', 'observado')
          and (rendicion_id is null or exists (select 1 from public.gastos_rendiciones r
                                                where r.id = rendicion_id and r.estado in ('abierta', 'observada'))))
         or (select public.es_admin_fijo()));

-- Comentarios: los de los gastos que uno ve. Se escriben con gastos_observar
-- y gastos_comentar; quedan como historia (los borra solo el admin fijo).
drop policy if exists comentarios_leer on public.gastos_comentarios;
create policy comentarios_leer on public.gastos_comentarios for select
  using (exists (select 1 from public.gastos g where g.id = gasto_id));
drop policy if exists comentarios_borrar on public.gastos_comentarios;
create policy comentarios_borrar on public.gastos_comentarios for delete
  using ((select public.es_admin_fijo()));

-- Movimientos: cada uno los suyos; anota y corrige solo lo que está
-- pendiente. Un admin, todo (los detalles, en el disparador).
drop policy if exists movimientos_leer on public.gastos_movimientos;
create policy movimientos_leer on public.gastos_movimientos for select
  using ((persona = (select public.mi_correo()) and (select public.gastos_habilitado()))
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists movimientos_crear on public.gastos_movimientos;
create policy movimientos_crear on public.gastos_movimientos for insert
  with check ((select public.gastos_habilitado())
              and (persona = (select public.mi_correo()) or (select public.es_admin_fijo()) or (select public.es_admin_rol())));
drop policy if exists movimientos_editar on public.gastos_movimientos;
create policy movimientos_editar on public.gastos_movimientos for update
  using ((persona = (select public.mi_correo()) and (select public.gastos_habilitado()) and estado = 'pendiente')
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()))
  with check ((select public.gastos_habilitado())
              and (persona = (select public.mi_correo()) or (select public.es_admin_fijo()) or (select public.es_admin_rol())));
drop policy if exists movimientos_borrar on public.gastos_movimientos;
create policy movimientos_borrar on public.gastos_movimientos for delete
  using ((persona = (select public.mi_correo()) and (select public.gastos_habilitado()) and estado = 'pendiente')
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()));

-- Cambios de moneda: cada uno los suyos, y los toca mientras su rendición se
-- puede corregir (abierta u observada); un admin los ve todos y el admin
-- fijo los puede borrar. Que la rendición sea suya, en el disparador.
drop policy if exists cambios_leer on public.gastos_cambios;
create policy cambios_leer on public.gastos_cambios for select
  using ((autor = (select public.mi_correo()) and (select public.gastos_habilitado()))
         or (select public.es_admin_fijo()) or (select public.es_admin_rol()));
drop policy if exists cambios_crear on public.gastos_cambios;
create policy cambios_crear on public.gastos_cambios for insert
  with check (autor = (select public.mi_correo()) and (select public.gastos_habilitado()));
drop policy if exists cambios_editar on public.gastos_cambios;
create policy cambios_editar on public.gastos_cambios for update
  using (autor = (select public.mi_correo()) and (select public.gastos_habilitado())
         and exists (select 1 from public.gastos_rendiciones r where r.id = rendicion_id and r.estado in ('abierta', 'observada')))
  with check (autor = (select public.mi_correo()));
drop policy if exists cambios_borrar on public.gastos_cambios;
create policy cambios_borrar on public.gastos_cambios for delete
  using ((autor = (select public.mi_correo()) and (select public.gastos_habilitado())
          and exists (select 1 from public.gastos_rendiciones r where r.id = rendicion_id and r.estado in ('abierta', 'observada')))
         or (select public.es_admin_fijo()));


-- ============================================================
-- Lo que se controla al escribir
-- ============================================================
-- Los disparadores cuidan lo que una política no ve (qué columnas cambian, a
-- qué estado se pasa). Solo para lo que escribe una persona directo desde el
-- navegador (rol `authenticated`): las funciones de abajo corren con el rol
-- de su dueño y hacen sus propios controles; la llave de servicio (una
-- restauración) y el editor SQL escriben tal cual. Por eso estos disparadores
-- NO son `security definer`: adentro de uno así, `current_user` sería siempre
-- el dueño y no se sabría quién escribe.

create or replace function public.gastos_controlar() returns trigger
  language plpgsql set search_path = '' as $$
declare yo text := public.mi_correo(); r record; carpeta text;
begin
  new.concepto := btrim(coalesce(new.concepto, ''));
  new.observaciones := btrim(coalesce(new.observaciones, ''));
  new.moneda := upper(btrim(coalesce(new.moneda, '')));
  new.rendido_moneda := upper(btrim(coalesce(new.rendido_moneda, '')));
  if current_user not in ('authenticated', 'anon') then return new; end if;
  -- Cuándo se aprobó lo pone la base; si el gasto se pasa a otra rendición, se aprueba de nuevo allá.
  if tg_op = 'INSERT' then new.aprobado_el := null;
  elsif new.rendicion_id is distinct from old.rendicion_id then new.aprobado_el := null;
  else new.aprobado_el := old.aprobado_el; end if;
  if tg_op = 'INSERT' then
    new.autor := yo; new.creado_el := now();
    if new.estado not in ('borrador', 'confirmado') then
      raise exception 'Un gasto nuevo es un borrador o está confirmado' using errcode = 'check_violation';
    end if;
  else
    if new.autor is distinct from old.autor or new.creado_el is distinct from old.creado_el then
      raise exception 'De quién es un gasto no se cambia' using errcode = 'insufficient_privilege';
    end if;
    if new.estado not in ('borrador', 'confirmado', 'observado')
       or (new.estado = 'observado' and old.estado <> 'observado') then
      raise exception 'Ese cambio de estado lo hace la rendición' using errcode = 'insufficient_privilege';
    end if;
  end if;
  carpeta := 'gastos/' || new.id::text || '/';
  if new.archivo is not null and left(new.archivo, length(carpeta)) <> carpeta then
    raise exception 'El comprobante va en la carpeta de su gasto' using errcode = 'check_violation';
  end if;
  if new.rendicion_id is not null and (tg_op = 'INSERT' or new.rendicion_id is distinct from old.rendicion_id) then
    select x.autor, x.estado into r from public.gastos_rendiciones x where x.id = new.rendicion_id;
    if not found or r.autor <> yo then
      raise exception 'Esa rendición no es tuya' using errcode = 'insufficient_privilege';
    end if;
    if r.estado not in ('abierta', 'observada') then
      raise exception 'Esa rendición ya se mandó' using errcode = 'check_violation';
    end if;
  end if;
  new.tocado_el := now();
  return new;
end $$;
drop trigger if exists gastos_controlar on public.gastos;
create trigger gastos_controlar before insert or update on public.gastos
  for each row execute function public.gastos_controlar();

create or replace function public.gastos_rendiciones_controlar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  -- Por el navegador, una rendición solo se toca en su «total rápido»
  -- (los permisos de columna no dejan otra cosa) y mientras no se mandó.
  if old.estado not in ('abierta', 'observada') then
    raise exception 'Esa rendición ya se mandó' using errcode = 'check_violation';
  end if;
  if new.total_manual is distinct from old.total_manual
     or new.total_manual_confirmado is distinct from old.total_manual_confirmado then
    new.total_manual_por := public.mi_correo(); new.total_manual_el := now();
  end if;
  new.tocada_el := now();
  return new;
end $$;
drop trigger if exists gastos_rendiciones_controlar on public.gastos_rendiciones;
create trigger gastos_rendiciones_controlar before update on public.gastos_rendiciones
  for each row execute function public.gastos_rendiciones_controlar();

create or replace function public.gastos_movimientos_controlar() returns trigger
  language plpgsql set search_path = '' as $$
declare yo text := public.mi_correo(); admin boolean := public.es_admin_fijo() or public.es_admin_rol();
  carpeta text := 'gastos/mov-' || new.id::text || '/';
begin
  new.moneda := upper(btrim(coalesce(new.moneda, '')));
  new.descripcion := btrim(coalesce(new.descripcion, ''));
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.archivo is not null and left(new.archivo, length(carpeta)) <> carpeta then
    raise exception 'El comprobante va en la carpeta de su movimiento' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    new.cargado_por := yo; new.creado_el := now();
    if not admin then
      if new.persona is distinct from yo then
        raise exception 'Solo podés anotar movimientos tuyos' using errcode = 'insufficient_privilege';
      end if;
      if new.tipo not in ('recibido', 'devuelto') then
        raise exception 'Un ajuste lo anota un admin' using errcode = 'insufficient_privilege';
      end if;
      new.estado := 'pendiente';
    end if;
  else
    if new.persona is distinct from old.persona or new.cargado_por is distinct from old.cargado_por
       or new.creado_el is distinct from old.creado_el then
      raise exception 'De quién es un movimiento no se cambia' using errcode = 'insufficient_privilege';
    end if;
    if not admin then
      if new.estado <> 'pendiente' then
        raise exception 'Un movimiento lo confirma un admin' using errcode = 'insufficient_privilege';
      end if;
      if new.tipo not in ('recibido', 'devuelto') then
        raise exception 'Un ajuste lo anota un admin' using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  if new.estado = 'confirmado' and (tg_op = 'INSERT' or old.estado <> 'confirmado') then
    new.confirmado_por := yo; new.confirmado_el := now();
  elsif new.estado = 'pendiente' then
    new.confirmado_por := null; new.confirmado_el := null;
  end if;
  return new;
end $$;
drop trigger if exists gastos_movimientos_controlar on public.gastos_movimientos;
create trigger gastos_movimientos_controlar before insert or update on public.gastos_movimientos
  for each row execute function public.gastos_movimientos_controlar();

-- Un cambio de moneda: de quien lo anota, en una rendición suya que todavía
-- se corrige; no se pasa a otra rendición; el comprobante, en su carpeta.
create or replace function public.gastos_cambios_controlar() returns trigger
  language plpgsql set search_path = '' as $$
declare yo text := public.mi_correo(); r record; carpeta text := 'gastos/cambio-' || new.id::text || '/';
begin
  new.entregado_moneda := upper(btrim(coalesce(new.entregado_moneda, '')));
  new.recibido_moneda := upper(btrim(coalesce(new.recibido_moneda, '')));
  new.observaciones := btrim(coalesce(new.observaciones, ''));
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.autor := yo; new.creado_el := now();
  elsif new.autor is distinct from old.autor or new.creado_el is distinct from old.creado_el
        or new.rendicion_id is distinct from old.rendicion_id then
    raise exception 'De quién es un cambio, y en qué rendición, no se cambia' using errcode = 'insufficient_privilege';
  end if;
  select x.autor, x.estado into r from public.gastos_rendiciones x where x.id = new.rendicion_id;
  if not found or r.autor <> yo then
    raise exception 'Esa rendición no es tuya' using errcode = 'insufficient_privilege';
  end if;
  if r.estado not in ('abierta', 'observada') then
    raise exception 'Esa rendición ya se mandó' using errcode = 'check_violation';
  end if;
  if new.archivo is not null and left(new.archivo, length(carpeta)) <> carpeta then
    raise exception 'El comprobante va en la carpeta de su cambio' using errcode = 'check_violation';
  end if;
  new.tocado_el := now();
  return new;
end $$;
drop trigger if exists gastos_cambios_controlar on public.gastos_cambios;
create trigger gastos_cambios_controlar before insert or update on public.gastos_cambios
  for each row execute function public.gastos_cambios_controlar();


-- ============================================================
-- Las funciones (lo que pasa con una rendición)
-- ============================================================

-- Abrir (o encontrar) la rendición de quien llama en una actividad o en la
-- rutina de un mes. En una actividad, solo si participó en ella (figura como
-- participante o la cargó); un admin, en cualquiera.
create or replace function public.gastos_rendicion_abrir(p_post text default null, p_mes date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); p record; v_id uuid; v_mes date;
begin
  if yo is null or not public.gastos_habilitado() then
    raise exception 'Los gastos no están abiertos para tu cuenta' using errcode = 'insufficient_privilege';
  end if;
  if (p_post is null) = (p_mes is null) then
    raise exception 'Una actividad o un mes, uno de los dos' using errcode = 'invalid_parameter_value';
  end if;
  if p_post is not null then
    select x.id, x.title, x.activity_type, x.author_email, x.participants into p from public.posts x where x.id = p_post;
    if not found then
      raise exception 'Esa actividad no existe' using errcode = 'no_data_found';
    end if;
    if p.activity_type = 'rutina' then
      raise exception 'Los gastos de rutina van a la rutina del mes' using errcode = 'invalid_parameter_value';
    end if;
    if not (public.es_admin_fijo() or public.es_admin_rol()
            or lower(coalesce(p.author_email, '')) = lower(yo)
            or public.es_participante(p.participants, yo)) then
      raise exception 'Solo podés cargar gastos en actividades en las que participaste' using errcode = 'insufficient_privilege';
    end if;
    insert into public.gastos_rendiciones (autor, post_id, titulo) values (yo, p_post, left(coalesce(p.title, ''), 200))
      on conflict (autor, post_id) where post_id is not null do nothing;
    select x.id into v_id from public.gastos_rendiciones x where x.autor = yo and x.post_id = p_post;
  else
    v_mes := date_trunc('month', p_mes)::date;
    if v_mes < '2000-01-01' or v_mes > '2100-12-01' then
      raise exception 'Ese mes no' using errcode = 'invalid_parameter_value';
    end if;
    insert into public.gastos_rendiciones (autor, rutina_mes) values (yo, v_mes)
      on conflict (autor, rutina_mes) where rutina_mes is not null do nothing;
    select x.id into v_id from public.gastos_rendiciones x where x.autor = yo and x.rutina_mes = v_mes;
  end if;
  return v_id;
end $$;

-- Mandar la rendición para que la revise un admin: todos sus gastos tienen
-- que estar confirmados (o seguir mandados, los que no se observaron, o
-- aprobados, si la rendición se reabrió), y tiene que haber algo: un gasto o
-- un total. Lo ya aprobado no vuelve a revisión: pasan a «enviado» solo los
-- nuevos o corregidos.
create or replace function public.gastos_rendicion_enviar(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); r record; v_total integer; v_faltan integer;
begin
  select * into r from public.gastos_rendiciones x where x.id = p_id for update;
  if not found or r.autor is distinct from yo or not public.gastos_habilitado() then
    raise exception 'Esa rendición no es tuya' using errcode = 'insufficient_privilege';
  end if;
  if r.estado not in ('abierta', 'observada') then
    raise exception 'Esa rendición ya se mandó' using errcode = 'check_violation';
  end if;
  select count(*), count(*) filter (where g.estado not in ('confirmado', 'enviado', 'aprobado'))
    into v_total, v_faltan from public.gastos g where g.rendicion_id = p_id;
  if v_total = 0 and r.total_manual = '{}'::jsonb then
    raise exception 'No hay nada para mandar' using errcode = 'check_violation';
  end if;
  if v_faltan > 0 then
    raise exception 'Faltan confirmar % gasto(s)', v_faltan using errcode = 'check_violation';
  end if;
  update public.gastos set estado = 'enviado', tocado_el = now() where rendicion_id = p_id and estado <> 'aprobado';
  update public.gastos_rendiciones set estado = 'enviada', enviada_el = now(), tocada_el = now() where id = p_id;
  return true;
end $$;

-- Borrar una rendición entera, con sus gastos y sus comentarios, de una vez
-- (lo pidió el usuario el 16/11: una actividad cargada por error, aunque ya
-- tenga comprobantes). La persona, la suya, mientras es suya para corregir
-- (abierta u observada). El admin fijo, cualquiera, también mandada o
-- aprobada (lo pidió el usuario el 17/11): lo aprobado sale de la cuenta
-- corriente, y la app se lo advierte antes. Los archivos quedan sin fila y
-- los saca la limpieza semanal del bucket.
create or replace function public.gastos_rendicion_borrar(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); r record; n integer;
begin
  select * into r from public.gastos_rendiciones x where x.id = p_id for update;
  if not found or (not public.es_admin_fijo() and (r.autor is distinct from yo or not public.gastos_habilitado())) then
    raise exception 'Esa rendición no es tuya' using errcode = 'insufficient_privilege';
  end if;
  if r.estado not in ('abierta', 'observada') and not public.es_admin_fijo() then
    raise exception 'Una rendición mandada o aprobada la borra solo el admin' using errcode = 'check_violation';
  end if;
  if not public.es_admin_fijo() and exists (select 1 from public.gastos g where g.rendicion_id = p_id and g.estado = 'aprobado') then
    raise exception 'Tiene gastos aprobados (se reabrió): la borra solo el admin' using errcode = 'check_violation';
  end if;
  delete from public.gastos where rendicion_id = p_id;
  get diagnostics n = row_count;
  delete from public.gastos_rendiciones where id = p_id;
  return n;
end $$;

-- El aviso por correo de «te observaron un gasto» (17/11/2026; lo acordado el
-- 15/11: le llega a la persona por la campanita y por correo). Va como los
-- demás avisos al momento (17-avisos-por-correo.sql): la app del admin que
-- observó llama a la función `avisar`, que le pregunta a la base con SU
-- sesión; la base decide si corresponde y a quién, y devuelve solo un turno.
-- Reglas:
--   - lo pide un admin, sobre un gasto observado que no es suyo, de una
--     rendición que ya volvió a la persona (desde el 19/11, D18: las
--     observaciones salen al devolverla, no mientras sigue en revisión), con
--     un comentario suyo en ese gasto de esta vuelta (posterior al último
--     envío) y de la última semana (el que deja gastos_observar);
--   - la persona tiene que poder ver sus gastos (admin, o integrante con el
--     módulo abierto), poder recibir correos (Administración → Correos),
--     tenerlos prendidos y no haber apagado «gastos» (emailGastos);
--   - sale una vez por comentario (avisos_enviados) y cuenta para el tope de
--     30 avisos por hora de quien observa;
--   - llega al momento aunque la persona haya elegido el resumen diario o
--     semanal: es algo que tiene que corregir, y lo apaga en Tu cuenta.
create or replace function public.preparar_aviso_de_gasto(p_gasto uuid) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); g record; c record; r record; pr jsonb; ya integer;
begin
  if yo is null or not (public.es_admin_fijo() or public.es_admin_rol()) then return null; end if;
  select x.id, x.autor, x.concepto, x.estado, x.moneda, x.monto, x.fecha, x.rendicion_id, y.estado as r_estado, y.enviada_el into g
    from public.gastos x join public.gastos_rendiciones y on y.id = x.rendicion_id where x.id = p_gasto;
  if not found or g.estado <> 'observado' or g.autor = yo or g.r_estado = 'enviada' then return null; end if;
  select k.id, k.texto into c from public.gastos_comentarios k
   where k.gasto_id = g.id and k.autor = yo and k.creado_el > now() - interval '7 days'
     and k.creado_el > coalesce(g.enviada_el, '-infinity'::timestamptz)
   order by k.creado_el desc limit 1;
  if not found then return null; end if;
  select count(*) into ya from public.avisos_enviados a where a.autor = yo and a.enviado_el > now() - interval '1 hour';
  if ya >= 30 then return null; end if;
  if not exists (select 1 from public.members m where m.email = g.autor
                   and (m.role = 'admin' or m.email = public.admin_fijo()
                        or (m.role = 'member' and coalesce((select (k.value -> 'gastos' ->> 'abierto') is distinct from 'false'
                                                              from public.app_config k where k.key = 'preferences'), true))))
     or not public.puede_recibir_correos(g.autor) then
    return null;
  end if;
  pr := public.prefs_de_correo(g.autor);
  if not (pr ->> 'on')::boolean or not (pr ->> 'gastos')::boolean then return null; end if;
  insert into public.avisos_enviados(tipo, objeto, email, autor) values ('gasto', c.id::text, g.autor, yo)
    on conflict do nothing;
  if not found then return null; end if;
  select x.titulo, x.rutina_mes, p.title as post_titulo into r
    from public.gastos_rendiciones x left join public.posts p on p.id = x.post_id where x.id = g.rendicion_id;
  return public.guardar_aviso(jsonb_build_object(
    'para', jsonb_build_array(jsonb_build_object('email', g.autor, 'nombre', (select m.name from public.members m where m.email = g.autor), 'lang', pr ->> 'lang')),
    'autor', coalesce((select nullif(m.name, '') from public.members m where m.email = yo), yo),
    'concepto', g.concepto, 'texto', left(c.texto, 600), 'moneda', g.moneda, 'monto', g.monto, 'fecha', g.fecha,
    'actividad', coalesce(nullif(r.post_titulo, ''), nullif(r.titulo, '')), 'mes', r.rutina_mes, 'gasto', g.id, 'en', 'gasto'));
end $$;

-- Un admin observa un gasto de una rendición mandada: queda «observado» y el
-- comentario queda guardado. La rendición sigue en revisión hasta que el
-- admin la devuelve con todo lo que encontró (gastos_rendicion_devolver; lo
-- decidió el usuario el 19/11, D18: antes volvía a la persona con la primera
-- observación). Si ya está en manos de la persona (reabierta u observada),
-- vuelve en el momento. Uno ya aprobado se observa solo si su rendición se
-- reabrió (18/11): así se corrige uno aprobado sin volver a revisar todo.
create or replace function public.gastos_observar(p_gasto uuid, p_texto text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); g record; v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Observa un admin' using errcode = 'insufficient_privilege';
  end if;
  if v_texto = '' or length(v_texto) > 1000 then
    raise exception 'Hace falta un comentario (hasta 1000 letras)' using errcode = 'check_violation';
  end if;
  select x.id, x.rendicion_id, x.estado, r.estado as r_estado into g
    from public.gastos x join public.gastos_rendiciones r on r.id = x.rendicion_id
   where x.id = p_gasto for update of x;
  if not found then
    raise exception 'Ese gasto no está en una rendición' using errcode = 'no_data_found';
  end if;
  if not ((g.estado in ('enviado', 'observado') and g.r_estado in ('enviada', 'observada'))
          or (g.estado = 'aprobado' and g.r_estado in ('abierta', 'enviada', 'observada'))) then
    raise exception 'Se observa un gasto de una rendición mandada (o uno aprobado de una reabierta)' using errcode = 'check_violation';
  end if;
  update public.gastos set estado = 'observado', tocado_el = now() where id = p_gasto;
  if g.r_estado <> 'enviada' then
    update public.gastos_rendiciones set estado = 'observada', tocada_el = now() where id = g.rendicion_id;
  end if;
  insert into public.gastos_comentarios (gasto_id, autor, texto) values (p_gasto, yo, v_texto);
  return true;
end $$;

-- Devolver una rendición en revisión con lo observado (D18, 19/11): vuelve a
-- la persona para que corrija; devuelve cuántos gastos tiene observados. Sin
-- ninguno observado no hay nada que devolver.
create or replace function public.gastos_rendicion_devolver(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Devuelve un admin' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.gastos_rendiciones x where x.id = p_id for update;
  if not found then
    raise exception 'Esa rendición no existe' using errcode = 'no_data_found';
  end if;
  if r.estado <> 'enviada' then
    raise exception 'Se devuelve una rendición que está en revisión' using errcode = 'check_violation';
  end if;
  select count(*) into n from public.gastos where rendicion_id = p_id and estado = 'observado';
  if n = 0 then
    raise exception 'Para devolverla, observá al menos un gasto' using errcode = 'check_violation';
  end if;
  update public.gastos_rendiciones set estado = 'observada', tocada_el = now() where id = p_id;
  return n;
end $$;

-- Comentar un gasto (la respuesta de la persona, o un admin que agrega algo).
create or replace function public.gastos_comentar(p_gasto uuid, p_texto text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); v_autor text; v_id uuid; v_texto text := btrim(coalesce(p_texto, ''));
begin
  select x.autor into v_autor from public.gastos x where x.id = p_gasto;
  if not found or not ((v_autor = yo and public.gastos_habilitado()) or public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Ese gasto no es tuyo' using errcode = 'insufficient_privilege';
  end if;
  if v_texto = '' or length(v_texto) > 1000 then
    raise exception 'Un comentario de 1 a 1000 letras' using errcode = 'check_violation';
  end if;
  insert into public.gastos_comentarios (gasto_id, autor, texto) values (p_gasto, yo, v_texto) returning id into v_id;
  return v_id;
end $$;

-- Un admin aprueba la rendición entera (mandada y sin observaciones abiertas):
-- lo que estaba en revisión pasa a aprobado, con la hora (un gasto corregido
-- después de aprobado conserva la primera: su lugar en el PDF no cambia).
-- La suya la aprueba otro admin (D17, 19/11); si no hay otro, el admin fijo
-- aprueba la suya (la app se lo avisa).
create or replace function public.gastos_rendicion_aprobar(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo(); r record;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Aprueba un admin' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.gastos_rendiciones x where x.id = p_id for update;
  if not found then
    raise exception 'Esa rendición no existe' using errcode = 'no_data_found';
  end if;
  if r.estado <> 'enviada' or exists (select 1 from public.gastos x where x.rendicion_id = p_id and x.estado = 'observado') then
    raise exception 'Se aprueba una rendición mandada y sin observaciones pendientes' using errcode = 'check_violation';
  end if;
  if r.autor = yo and not (public.es_admin_fijo()
       and not exists (select 1 from public.members m where m.role = 'admin' and m.email <> yo)) then
    raise exception 'La tuya la aprueba otro admin' using errcode = 'insufficient_privilege';
  end if;
  update public.gastos set estado = 'aprobado', aprobado_el = coalesce(aprobado_el, now()), tocado_el = now()
   where rendicion_id = p_id and estado <> 'aprobado';
  update public.gastos_rendiciones set estado = 'aprobada', aprobada_el = now(), aprobada_por = yo, tocada_el = now() where id = p_id;
  return true;
end $$;

-- Reabrir una rendición ya aprobada (lo pidió el usuario el 18/11: un
-- comprobante que llegó tarde a una rutina del mes ya aprobada; la otra
-- salida, ponerlo en la rutina del mes siguiente, ya se puede desde «Va en»).
-- Solo un admin. Vuelve a «abierta» para que la persona sume lo que falta y
-- la mande de nuevo. Lo ya aprobado sigue aprobado (no se toca y sigue en la
-- cuenta corriente): al mandarla, se revisa solo lo nuevo; y si hay que
-- corregir uno aprobado, el admin lo observa (18/11).
create or replace function public.gastos_rendicion_reabrir(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Reabre un admin' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.gastos_rendiciones x where x.id = p_id for update;
  if not found then
    raise exception 'Esa rendición no existe' using errcode = 'no_data_found';
  end if;
  if r.estado <> 'aprobada' then
    raise exception 'Se reabre una rendición aprobada' using errcode = 'check_violation';
  end if;
  update public.gastos_rendiciones set estado = 'abierta', aprobada_el = null, aprobada_por = null, tocada_el = now() where id = p_id;
  return true;
end $$;

-- Un admin confirma un movimiento que anotó la persona.
create or replace function public.gastos_movimiento_confirmar(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare yo text := public.mi_correo();
begin
  if not (public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Confirma un admin' using errcode = 'insufficient_privilege';
  end if;
  update public.gastos_movimientos set estado = 'confirmado', confirmado_por = yo, confirmado_el = now()
   where id = p_id and estado = 'pendiente';
  return found;
end $$;

-- La cuenta corriente de una persona, por moneda. Lo ve ella misma o un admin.
--   gastado      sus gastos APROBADOS de su bolsillo (pago = persona), aunque
--                su rendición se haya reabierto: el monto rendido en su
--                moneda, o si no lo tiene, el del comprobante en la suya. Un
--                gasto sin monto no suma.
--   en_revision  lo que todavía no se aprobó de rendiciones mandadas
--   recibido, devuelto, ajuste   los movimientos confirmados
--   pendiente    lo que anotó la persona y falta que un admin confirme
--   saldo        gastado + devuelto + ajuste − recibido: positivo, la
--                organización le debe a la persona; negativo, la persona debe.
-- El «total rápido» no mueve la cuenta: es para los números grandes.
create or replace function public.gastos_cuenta(p_persona text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare yo text := public.mi_correo(); v jsonb;
begin
  if not ((p_persona = yo and public.gastos_habilitado()) or public.es_admin_fijo() or public.es_admin_rol()) then
    raise exception 'Esa cuenta no es tuya' using errcode = 'insufficient_privilege';
  end if;
  with gastos_persona as (
    select case when g.rendido_monto is not null then g.rendido_moneda else g.moneda end as moneda,
           coalesce(g.rendido_monto, g.monto) as monto, g.estado = 'aprobado' as aprobado
      from public.gastos g join public.gastos_rendiciones r on r.id = g.rendicion_id
     where g.autor = p_persona and g.pago = 'persona' and coalesce(g.rendido_monto, g.monto) is not null
       and (g.estado = 'aprobado' or r.estado in ('enviada', 'observada'))
  ), filas as (
    select moneda, sum(monto) filter (where aprobado) as gastado,
           sum(monto) filter (where not aprobado) as en_revision,
           0::numeric as recibido, 0::numeric as devuelto, 0::numeric as ajuste, 0::numeric as pendiente
      from gastos_persona group by moneda
    union all
    select m.moneda, 0, 0,
           sum(m.monto) filter (where m.tipo = 'recibido' and m.estado = 'confirmado'),
           sum(m.monto) filter (where m.tipo = 'devuelto' and m.estado = 'confirmado'),
           sum(m.monto) filter (where m.tipo = 'ajuste' and m.estado = 'confirmado'),
           sum(case when m.tipo = 'recibido' then -m.monto else m.monto end) filter (where m.estado = 'pendiente')
      from public.gastos_movimientos m where m.persona = p_persona group by m.moneda
  ), por_moneda as (
    select moneda,
           coalesce(sum(gastado), 0) as gastado, coalesce(sum(en_revision), 0) as en_revision,
           coalesce(sum(recibido), 0) as recibido, coalesce(sum(devuelto), 0) as devuelto,
           coalesce(sum(ajuste), 0) as ajuste, coalesce(sum(pendiente), 0) as pendiente
      from filas group by moneda
  )
  select coalesce(jsonb_object_agg(moneda, jsonb_build_object(
           'gastado', gastado, 'en_revision', en_revision, 'recibido', recibido, 'devuelto', devuelto,
           'ajuste', ajuste, 'pendiente', pendiente, 'saldo', gastado + devuelto + ajuste - recibido)), '{}'::jsonb)
    into v from por_moneda;
  return v;
end $$;

-- En Supabase toda función nueva de `public` se puede llamar desde el
-- navegador: se deja solo a quien corresponde (supabase/pruebas/
-- funciones-esperadas.sql tiene la lista).
revoke execute on function public.gastos_rendicion_abrir(text, date) from public, anon;
revoke execute on function public.gastos_rendicion_enviar(uuid) from public, anon;
revoke execute on function public.gastos_rendicion_borrar(uuid) from public, anon;
revoke execute on function public.gastos_observar(uuid, text) from public, anon;
revoke execute on function public.preparar_aviso_de_gasto(uuid) from public, anon;
revoke execute on function public.gastos_comentar(uuid, text) from public, anon;
revoke execute on function public.gastos_rendicion_aprobar(uuid) from public, anon;
revoke execute on function public.gastos_rendicion_devolver(uuid) from public, anon;
revoke execute on function public.gastos_rendicion_reabrir(uuid) from public, anon;
revoke execute on function public.gastos_movimiento_confirmar(uuid) from public, anon;
revoke execute on function public.gastos_cuenta(text) from public, anon;
grant execute on function public.gastos_rendicion_abrir(text, date) to authenticated;
grant execute on function public.gastos_rendicion_enviar(uuid) to authenticated;
grant execute on function public.gastos_rendicion_borrar(uuid) to authenticated;
grant execute on function public.gastos_observar(uuid, text) to authenticated;
grant execute on function public.preparar_aviso_de_gasto(uuid) to authenticated;
grant execute on function public.gastos_comentar(uuid, text) to authenticated;
grant execute on function public.gastos_rendicion_aprobar(uuid) to authenticated;
grant execute on function public.gastos_rendicion_devolver(uuid) to authenticated;
grant execute on function public.gastos_rendicion_reabrir(uuid) to authenticated;
grant execute on function public.gastos_movimiento_confirmar(uuid) to authenticated;
grant execute on function public.gastos_cuenta(text) to authenticated;


-- ============================================================
-- Los comprobantes, en el bucket de siempre
-- ============================================================
-- En `gastos/<id del gasto>/<archivo>`. Los ve quien ve el gasto (su autor y
-- los admins); los sube el autor mientras el gasto se puede corregir. Los de
-- la cuenta corriente, en `gastos/mov-<id del movimiento>/<archivo>`: los ve
-- quien ve el movimiento y los sube quien lo puede corregir (la persona,
-- mientras está pendiente; un admin, siempre). Las
-- reglas del bucket de 02-politicas.sql (posts/ y replies/) no cambian: estas
-- se suman a ellas. Borrar sigue siendo del admin fijo (02-politicas.sql) y
-- de la limpieza semanal, que sabe que estos archivos se usan
-- (limpieza_del_bucket, 04-funciones.sql).
-- La pregunta va en una función: así una cuenta sin permiso sobre la tabla
-- (anon) recibe un «no» y no un error.
create or replace function public.gastos_archivo_visible(ruta text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select split_part(ruta, '/', 1) = 'gastos'
     and (exists (select 1 from public.gastos g
                   where g.id::text = split_part(ruta, '/', 2)
                     and ((g.autor = public.mi_correo() and public.gastos_habilitado())
                          or public.es_admin_fijo() or public.es_admin_rol()))
          or exists (select 1 from public.gastos_movimientos m
                      where 'mov-' || m.id::text = split_part(ruta, '/', 2)
                        and ((m.persona = public.mi_correo() and public.gastos_habilitado())
                             or public.es_admin_fijo() or public.es_admin_rol()))
          or exists (select 1 from public.gastos_cambios c
                      where 'cambio-' || c.id::text = split_part(ruta, '/', 2)
                        and ((c.autor = public.mi_correo() and public.gastos_habilitado())
                             or public.es_admin_fijo() or public.es_admin_rol())))
$$;
create or replace function public.gastos_archivo_subible(ruta text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select split_part(ruta, '/', 1) = 'gastos' and split_part(ruta, '/', 3) <> '' and split_part(ruta, '/', 4) = ''
     and public.gastos_habilitado()
     and (exists (select 1 from public.gastos g
                   where g.id::text = split_part(ruta, '/', 2)
                     and g.autor = public.mi_correo()
                     and g.estado in ('borrador', 'confirmado', 'observado'))
          or exists (select 1 from public.gastos_movimientos m
                      where 'mov-' || m.id::text = split_part(ruta, '/', 2)
                        and ((m.persona = public.mi_correo() and m.estado = 'pendiente')
                             or public.es_admin_fijo() or public.es_admin_rol()))
          or exists (select 1 from public.gastos_cambios c join public.gastos_rendiciones r on r.id = c.rendicion_id
                      where 'cambio-' || c.id::text = split_part(ruta, '/', 2)
                        and c.autor = public.mi_correo() and r.estado in ('abierta', 'observada')))
$$;
drop policy if exists gastos_archivos_leer on storage.objects;
create policy gastos_archivos_leer on storage.objects for select
  using (bucket_id = 'adjuntos' and public.gastos_archivo_visible(name));
drop policy if exists gastos_archivos_subir on storage.objects;
create policy gastos_archivos_subir on storage.objects for insert
  with check (bucket_id = 'adjuntos' and public.gastos_archivo_subible(name));


-- ============================================================
-- La configuración del módulo: preferences → gastos
-- ============================================================
-- La escribe un admin desde Administración → Gastos (las políticas de
-- app_config, 02-politicas.sql) y la lee todo el equipo:
--   prendido  si la app muestra el módulo. Apagarlo esconde las pantallas
--             (a todos); lo cargado queda guardado.
--   abierto   si el resto del equipo puede usarlo (gastos_habilitado). Sin
--             nada guardado, sí (desde el 19/11/2026); `false` lo cierra y
--             queda solo para los admins.
--   tipos     los tipos de gasto: [{key, label?, oculto?}]. Los siete de
--             fábrica traen su nombre en los cuatro idiomas y `label` lo
--             reemplaza; uno `oculto` ya no se ofrece pero sigue nombrando a
--             los gastos que lo usan.
-- Como el resto de preferences, se controla la forma: es lo que lee cada
-- pantalla y no puede romperlas.
create or replace function public.gastos_config_ok(v jsonb) returns boolean
  language sql immutable as $$
  select jsonb_typeof(v) = 'object'
     and not exists (select 1 from jsonb_object_keys(v) k where k not in ('prendido', 'abierto', 'tipos'))
     and coalesce(jsonb_typeof(v -> 'prendido'), 'boolean') = 'boolean'
     and coalesce(jsonb_typeof(v -> 'abierto'), 'boolean') = 'boolean'
     and coalesce(jsonb_typeof(v -> 'tipos'), 'array') = 'array'
     and jsonb_array_length(coalesce(v -> 'tipos', '[]')) <= 40
     and not exists (
       select 1 from jsonb_array_elements(coalesce(v -> 'tipos', '[]')) e
        where jsonb_typeof(e) <> 'object'
           or exists (select 1 from jsonb_object_keys(e) k where k not in ('key', 'label', 'oculto'))
           or coalesce(e ->> 'key', '') !~ '^[a-z0-9_]{1,40}$'
           or coalesce(jsonb_typeof(e -> 'label'), 'string') <> 'string'
           or length(coalesce(e ->> 'label', '')) > 60
           or coalesce(jsonb_typeof(e -> 'oculto'), 'boolean') <> 'boolean')
     and (select count(distinct e ->> 'key') = count(*) from jsonb_array_elements(coalesce(v -> 'tipos', '[]')) e)
$$;

create or replace function public.gastos_config_controlar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if public.sin_sesion_de_persona() or new.key <> 'preferences' then return new; end if;
  if (new.value -> 'gastos') is distinct from (case when tg_op = 'UPDATE' then old.value -> 'gastos' end)
     and new.value ? 'gastos' and not public.gastos_config_ok(new.value -> 'gastos') then
    raise exception 'La configuración de los gastos no tiene la forma esperada (prendido, abierto y hasta 40 tipos con clave y nombre)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists gastos_config_controlar on public.app_config;
create trigger gastos_config_controlar before insert or update on public.app_config
  for each row execute function public.gastos_config_controlar();

-- En vivo, como las demás (supabase/pruebas/88-tiempo-real.sql las cuenta).
-- Cada uno recibe solo los cambios de lo que puede ver.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['gastos_rendiciones', 'gastos', 'gastos_comentarios', 'gastos_movimientos', 'gastos_cambios'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
