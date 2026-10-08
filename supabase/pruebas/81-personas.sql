\set QUIET on
-- Personas sin cuenta (18-personas.sql): quién las crea y corrige, los
-- nombres sueltos que pasan a fichas, unir dos fichas, vincular a una
-- cuenta, y que nada de eso edite el posteo ni se anote como edición.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.personas, public.audit_log cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana Pérez', 'ana', 'member'),
  ('dario@x.com', 'Darío Gómez', 'dario', 'member'), ('obs@x.com', 'Obs', 'obs', 'observer');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants) values
  ('p1', 'Swimmers Online', '', '2026-10-07', '2026-10-07', '2026-10-07', 'otro', 'Google Calendar', '',
   '[{"name":"Dario"},{"name":"Guypo"},{"email":"ana@x.com","name":"Ana Pérez"}]'),
  ('p2', 'Visita a Córdoba', '', '2026-09-02', '2026-09-02', '2026-09-02', 'visita', 'Benny', 'benny@team-latam.com',
   '[{"name":"Darío"}]'),
  ('p3', 'Rutina de Ana', 'texto', '2026-09-03', '2026-09-03', '2026-09-03', 'rutina', 'Ana Pérez', 'ana@x.com',
   '[{"name":"dario"}]');

-- ---------- Los nombres sueltos pasan a fichas ----------
-- (en un statement aparte: lo que la función escribe no se ve desde el
-- mismo SELECT que la llama)
create temp table migracion as select public.personas_desde_nombres_sueltos() as n;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'los nombres sueltos pasan a fichas: «Dario», «Darío» y «dario» son UNA (sin tildes ni mayúsculas), y Guypo otra', true,
  (select n from migracion) = 2 and (select count(*) from public.personas) = 2
  and (select count(distinct e ->> 'persona') from public.posts p, jsonb_array_elements(p.participants) e where e ? 'persona') = 2,
  coalesce((select string_agg(name, ',' order by name) from public.personas), '(ninguna)');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'cada posteo apunta a la ficha (y Ana sigue como estaba)', true,
  (select participants from public.posts where id = 'p1') @> '[{"email":"ana@x.com","name":"Ana Pérez"}]'
  and not exists (select 1 from public.posts p, jsonb_array_elements(p.participants) e where coalesce(e ->> 'email', '') = '' and not (e ? 'persona')), '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'la segunda vez no encuentra nada', true, public.personas_desde_nombres_sueltos() = 0, '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'y nada de eso quedó en el registro de actividad', true, (select count(*) from public.audit_log) = 0, '';

-- ---------- Crear y corregir ----------
select lab.probar_valor('una integrante crea una persona: queda firmada por ella, con el correo en minúsculas', lab.como('ana@x.com'),
  $q$insert into public.personas(id, name, email) values ('rabino', 'Rabino Levy', ' Levy@X.com ')$q$,
  $q$select created_by || ' ' || email from public.personas where id = 'rabino'$q$, 'ana@x.com levy@x.com');
-- (lab.probar deshace lo que hace: la ficha se deja creada acá, como la dejaría Ana)
insert into public.personas(id, name, email, created_by) values ('rabino', 'Rabino Levy', 'levy@x.com', 'ana@x.com');
select lab.probar('un observador no', lab.como('obs@x.com'),
  $q$insert into public.personas(id, name) values ('obs', 'Alguien')$q$, false);
select lab.probar('sin sesión, nadie', '{"role":"anon"}'::jsonb,
  $q$insert into public.personas(id, name) values ('anon', 'Alguien')$q$, false);
select lab.probar('quien la creó la corrige', lab.como('ana@x.com'),
  $q$update public.personas set note = 'Rabino de la comunidad' where id = 'rabino'$q$, true);
-- Desde el 8/10/2026 (la Agenda) corrige cualquiera que carga eventos:
-- el que acaba de hablar con alguien es el que sabe que cambió de número.
select lab.probar('otra integrante también (desde la Agenda)', lab.como('dario@x.com'),
  $q$update public.personas set name = 'Otro' where id = 'rabino'$q$, true);
select lab.probar('un admin sí', lab.como('benny@team-latam.com'),
  $q$update public.personas set note = 'Rabino' where id = 'rabino'$q$, true);
select lab.probar_valor('quién la creó no se cambia', lab.como('ana@x.com'),
  $q$update public.personas set created_by = 'benny@team-latam.com' where id = 'rabino'$q$,
  $q$select created_by from public.personas where id = 'rabino'$q$, 'ana@x.com');
select lab.probar('un correo mal escrito no entra', lab.como('ana@x.com'),
  $q$update public.personas set email = 'no es un correo' where id = 'rabino'$q$, false);
select lab.probar('un participante con persona en un posteo: vale', lab.como('ana@x.com'),
  $q$update public.posts set participants = '[{"persona":"rabino","name":"Rabino Levy"}]' where id = 'p3'$q$, true);
select lab.probar('con un id de persona con otra forma, no', lab.como('ana@x.com'),
  $q$update public.posts set participants = '[{"persona":"../x","name":"Rabino Levy"}]' where id = 'p3'$q$, false);

-- ---------- Unir ----------
-- Dos fichas más, cargadas a mano con el nombre partido: «Dario» (de los
-- sueltos) y «Dario G.».
insert into public.personas(id, name, email, created_by) values ('dariog', 'Dario G.', 'dario.g@x.com', 'ana@x.com');
update public.posts set participants = participants || '[{"persona":"dariog","name":"Dario G."}]' where id = 'p2';
select lab.probar('unir dos fichas lo hace un admin, no una integrante', lab.como('ana@x.com'),
  $q$select public.unir_personas('dariog', (select id from public.personas where name = 'Dario'))$q$, false);
select lab.probar_valor('unir: los eventos pasan a la que queda, sin duplicarla, y la que se va deja su correo',
  lab.como('benny@team-latam.com'),
  $q$select public.unir_personas('dariog', (select id from public.personas where name = 'Dario'))$q$,
  $q$select (select count(*) from public.personas where id = 'dariog')::text || ' ' ||
          (select email from public.personas where name = 'Dario') || ' ' ||
          (select count(*) from public.posts p, jsonb_array_elements(p.participants) e where p.id = 'p2' and e ? 'persona')::text$q$,
  '0 dario.g@x.com 1');
truncate public.audit_log;

-- ---------- Vincular a una cuenta ----------
select lab.probar('vincular: la cuenta tiene que estar en el equipo', lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona((select id from public.personas where name = 'Dario'), 'nadie@x.com')$q$, false);
select lab.probar_valor('vincular: todos sus eventos pasan a la cuenta (también una rutina ajena), y la ficha se va',
  lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona((select id from public.personas where name = 'Dario'), 'DARIO@x.com')$q$,
  $q$select (select count(*) from public.personas where name = 'Dario')::text || ' ' ||
          (select count(*) from public.posts p, jsonb_array_elements(p.participants) e where e ->> 'email' = 'dario@x.com' and e ->> 'name' = 'Darío Gómez')::text || ' ' ||
          (select count(*) from public.posts p, jsonb_array_elements(p.participants) e where e ? 'persona')::text$q$,
  -- (lo de «unir» se deshizo al terminar su prueba: p2 sigue con «Dario G.»)
  '0 3 2');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'unir y vincular no son ediciones: nada en el registro de actividad, y la fecha de edición sigue vacía', true,
  (select count(*) from public.audit_log) = 0 and not exists (select 1 from public.posts where last_edited_at is not null), '';

-- ---------- Lo que se ajustó el 7/10/2026 (la auditoría) ----------
-- El orden de los participantes y un mismo correo con otras mayúsculas.
update public.posts set participants = participants || '[{"email":"Dario@X.com","name":"Darío"}]' where id = 'p2';
select lab.probar_valor('vincular: el correo con otras mayúsculas no deja a la persona dos veces, y el orden se conserva',
  lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona((select id from public.personas where name = 'Dario'), 'dario@x.com')$q$,
  $q$select (select count(*) from public.posts p, jsonb_array_elements(p.participants) e where p.id = 'p2' and lower(e ->> 'email') = 'dario@x.com')::text || ' ' ||
          (select participants -> 0 ->> 'email' from public.posts where id = 'p1')$q$,
  '1 dario@x.com');
update public.posts set participants = participants - 2 where id = 'p2';
-- Una ficha que figura en un evento (aunque esté cancelado) no se borra.
insert into public.personas(id, name, created_by) values ('deobs', 'De Obs', 'obs@x.com');
update public.posts set participants = '[{"persona":"rabino","name":"Rabino Levy"}]', cancelled = true where id = 'p3';
select lab.probar('borrar una ficha que figura en un evento cancelado: no, ni siendo admin', lab.como('benny@team-latam.com'),
  $q$delete from public.personas where id = 'rabino'$q$, false);
update public.posts set participants = '[]', cancelled = false where id = 'p3';
select lab.probar('quien la creó y ahora es observador ya no la corrige', lab.como('obs@x.com'),
  $q$update public.personas set note = 'x' where id = 'deobs'$q$, false);
select lab.probar('ni la borra', lab.como('obs@x.com'),
  $q$delete from public.personas where id = 'deobs'$q$, false);
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'sin tildes también en portugués (João = Joao, Conceição = Conceicao)', true,
  public.sin_tildes('João Conceição') = 'Joao Conceicao', public.sin_tildes('João Conceição');

-- Borrar, desde el 8/10/2026, solo un admin (antes también quien la creó).
select lab.probar('borrar una ficha: quien la creó ya no', lab.como('ana@x.com'),
  $q$delete from public.personas where id = 'rabino'$q$, false);
select lab.probar('borrar una ficha: un admin sí', lab.como('benny@team-latam.com'),
  $q$delete from public.personas where id = 'rabino'$q$, true);

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
