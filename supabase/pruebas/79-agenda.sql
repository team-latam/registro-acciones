\set QUIET on
-- La Agenda (19-agenda.sql): quién la ve, quién suma, corrige y borra,
-- traer una lista entera, y cómo conviven sus contactos con unir y
-- vincular personas (18-personas.sql).
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.personas, public.audit_log,
  public.agenda_listas, public.instituciones, public.contactos cascade;
insert into public.members(email, name, nickname, role) values
  ('benny@team-latam.com', 'Benny', 'benny', 'admin'), ('ana@x.com', 'Ana Pérez', 'ana', 'member'),
  ('dario@x.com', 'Darío Gómez', 'dario', 'member'), ('obs@x.com', 'Obs', 'obs', 'observer');
-- Rosario, con su rab; y una persona sin cuenta de antes, «Shlomo Tawil».
insert into public.instituciones(id, name, country, city, address, tipo, created_by) values
  ('ros', 'Beit Chabad Rosario', 'Argentina', 'Rosario', 'Mendoza 1572', 'Sinagoga', 'benny@team-latam.com');
insert into public.personas(id, name, telefonos, created_by) values
  ('tawil', 'Shlomo Tawil', '[{"n":"+54 9 341 520 0739","wa":true}]', 'benny@team-latam.com');
insert into public.contactos(id, institucion, persona, cargo) values ('c1', 'ros', 'tawil', 'Rab a cargo');

-- ---------- Quién la ve ----------
select lab.probar('una integrante ve las instituciones', lab.como('ana@x.com'), $q$select * from public.instituciones$q$, true);
select lab.probar('un observador también (decisión del usuario)', lab.como('obs@x.com'), $q$select * from public.contactos$q$, true);
select lab.probar('alguien sin aprobar, no', lab.como('nadie@x.com'), $q$select * from public.instituciones$q$, false);
select lab.probar('sin sesión, nadie', '{"role":"anon"}'::jsonb, $q$select * from public.contactos$q$, false);
select lab.probar_valor_servicio('la copia de seguridad (llave de servicio) las lee', $q$select 1$q$,
  $q$select (select count(*) from public.instituciones) || ' ' || (select count(*) from public.contactos)$q$, '1 1');

-- ---------- Sumar y corregir ----------
select lab.probar_valor('una integrante suma una institución: queda firmada por ella y sin espacios de más', lab.como('ana@x.com'),
  $q$insert into public.instituciones(id, name, country, city, created_by) values ('cba', '  Chabad Córdoba ', 'Argentina', 'Cordoba', 'otro@x.com')$q$,
  $q$select created_by || ' «' || name || '»' from public.instituciones where id = 'cba'$q$, 'ana@x.com «Chabad Córdoba»');
select lab.probar('un observador no suma', lab.como('obs@x.com'),
  $q$insert into public.instituciones(id, name, country) values ('o', 'X', 'Argentina')$q$, false);
select lab.probar_valor('otra integrante corrige la dirección: queda quién la tocó', lab.como('dario@x.com'),
  $q$update public.instituciones set address = 'Mendoza 1580' where id = 'ros'$q$,
  $q$select tocado_por || ' ' || created_by from public.instituciones where id = 'ros'$q$, 'dario@x.com benny@team-latam.com');
select lab.probar('un estado que no existe no entra', lab.como('ana@x.com'),
  $q$update public.instituciones set estado = 'abierta' where id = 'ros'$q$, false);
insert into public.personas(id, name, created_by) values ('pres', 'Daniel Kohan', 'ana@x.com');
select lab.probar('una integrante suma a alguien a una institución, con su cargo', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, institucion, persona, cargo) values ('c2', 'ros', 'pres', 'Presidente/a de la comunidad')$q$, true);
select lab.probar('la misma persona dos veces en la misma institución, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, institucion, persona) values ('c3', 'ros', 'tawil')$q$, false);
select lab.probar('sacar a alguien que ya no está es corregir: una integrante puede', lab.como('dario@x.com'),
  $q$delete from public.contactos where id = 'c1'$q$, true);
select lab.probar('un observador no', lab.como('obs@x.com'),
  $q$delete from public.contactos where id = 'c1'$q$, false);
select lab.probar('otra integrante corrige el teléfono de una persona (desde la Agenda)', lab.como('dario@x.com'),
  $q$update public.personas set telefonos = '[{"n":"+54 9 341 555 0000","wa":true}]' where id = 'tawil'$q$, true);
select lab.probar_valor('y queda quién la tocó', lab.como('dario@x.com'),
  $q$update public.personas set idiomas = '{Español,עברית}' where id = 'tawil'$q$,
  $q$select tocado_por || ' ' || array_length(idiomas, 1) from public.personas where id = 'tawil'$q$, 'dario@x.com 2');
select lab.probar('un teléfono con letras no entra', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = '[{"n":"llamar al 4444","wa":false}]' where id = 'tawil'$q$, false);
select lab.probar('más de seis teléfonos, no', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = (select jsonb_agg(jsonb_build_object('n', '+54 11 ' || g, 'wa', false)) from generate_series(1000, 1006) g) where id = 'tawil'$q$, false);
select lab.probar('«wa» que no es sí o no, no', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = '[{"n":"+54 11 4444","wa":"sí"}]' where id = 'tawil'$q$, false);

-- ---------- Borrar: solo un admin ----------
select lab.probar('una integrante no borra una institución', lab.como('ana@x.com'), $q$delete from public.instituciones where id = 'ros'$q$, false);
select lab.probar('ni una persona, aunque la haya sumado ella', lab.como('ana@x.com'), $q$delete from public.personas where id = 'pres'$q$, false);
select lab.probar_valor('un admin borra una institución, y con ella quién estaba ahí (no las fichas de la gente)', lab.como('benny@team-latam.com'),
  $q$delete from public.instituciones where id = 'ros'$q$,
  $q$select (select count(*) from public.contactos where institucion = 'ros') || ' ' || (select count(*) from public.personas where id in ('tawil', 'pres'))$q$, '0 2');
select lab.probar('las listas las maneja un admin: una integrante no crea una', lab.como('ana@x.com'),
  $q$insert into public.agenda_listas(id, name) values ('l', 'Mi lista')$q$, false);

-- ---------- Traer una lista ----------
select lab.probar('traer una lista lo hace un admin, no una integrante', lab.como('ana@x.com'),
  $q$select public.agenda_traer('Directorio', '[{"name":"X","country":"Argentina","gente":[]}]')$q$, false);
select lab.probar('una lista vacía no', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Directorio', '[]')$q$, false);
create temp table traida as select public.agenda_traer('Directorio Chabad LatAm', $j$[
  {"name":"Chabad Central","country":"Argentina","city":"Buenos Aires (CABA)","address":"Aguero 1164","tipo":"Centro Comunitario",
   "gente":[{"name":"Tzvi Grumblat","cargo":"Rab a cargo","telefonos":[{"n":"+54 9 11 5316 1698","wa":true}]}]},
  {"name":"Escuela Oholey Jinuj","country":"Argentina","city":"Buenos Aires (CABA)","tipo":"Escuela",
   "gente":[{"name":"Tzvi Grumblat","cargo":"Rab a cargo","telefonos":[{"n":"54 9 11 5795 0000","wa":true}]}]},
  {"name":"Beit Chabad Rosario","country":"Argentina","city":"Rosario","estado":"temporada",
   "gente":[{"name":"Shlomó Tawil","cargo":"Rab a cargo","telefonos":[{"n":"+54 9 341 520-0739","wa":true}]}]}
]$j$::jsonb) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: tres instituciones, una lista, y lo que dice que hizo', true,
  (select r ->> 'instituciones' from traida) = '3' and (select count(*) from public.agenda_listas) = 1
  and (select r ->> 'personas_nuevas' from traida) = '1' and (select r ->> 'personas_que_ya_estaban' from traida) = '1',
  (select r::text from traida);
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: Tzvi en dos instituciones es UNA ficha, con sus dos teléfonos', true,
  (select count(*) from public.personas where name = 'Tzvi Grumblat') = 1
  and (select jsonb_array_length(telefonos) from public.personas where name = 'Tzvi Grumblat') = 2
  and (select count(*) from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Tzvi Grumblat') = 2, '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: «Shlomó Tawil» es la persona que ya estaba (sin tildes), y su número no se repite', true,
  (select count(*) from public.personas where public.sin_tildes(name) = 'Shlomo Tawil') = 1
  and (select jsonb_array_length(telefonos) from public.personas where id = 'tawil') = 1
  and exists (select 1 from public.contactos where persona = 'tawil'), '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: cada institución y la persona nueva saben de qué lista vinieron, y quedan firmadas por el admin', true,
  (select count(*) from public.instituciones where lista = (select r ->> 'lista' from traida)) = 3
  and (select lista from public.personas where name = 'Tzvi Grumblat') = (select r ->> 'lista' from traida)
  and (select created_by from public.instituciones where name = 'Chabad Central') = 'benny@team-latam.com'
  and (select estado from public.instituciones where name = 'Beit Chabad Rosario' and lista is not null) = 'temporada', '';
select lab.probar('traer: si una institución viene sin nombre, no entra nada', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Otra', '[{"name":"Bien","country":"Chile"},{"name":"","country":"Chile"}]')$q$, false);

-- ---------- Unir y vincular, con la Agenda ----------
insert into public.instituciones(id, name, country, city, created_by) values ('cba', 'Chabad Córdoba', 'Argentina', 'Cordoba', 'ana@x.com');
insert into public.personas(id, name, telefonos, idiomas, created_by) values
  ('tzvi2', 'Tzvi G.', '[{"n":"+54 9 11 4444 0000","wa":false}]', '{English}', 'ana@x.com');
insert into public.contactos(id, institucion, persona, cargo) values
  ('c9', (select id from public.instituciones where name = 'Chabad Central'), 'tzvi2', 'Rab a cargo'),
  ('c10', 'cba', 'tzvi2', 'Director');
select lab.probar_valor('unir: sus instituciones pasan a la que queda, sin repetir, con sus teléfonos e idiomas', lab.como('benny@team-latam.com'),
  $q$select public.unir_personas('tzvi2', (select id from public.personas where name = 'Tzvi Grumblat'))$q$,
  $q$select (select count(*) from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Tzvi Grumblat') || ' ' ||
          (select jsonb_array_length(telefonos) from public.personas where name = 'Tzvi Grumblat') || ' ' ||
          (select array_to_string(idiomas, ',') from public.personas where name = 'Tzvi Grumblat') || ' ' ||
          (select count(*) from public.personas where id = 'tzvi2')$q$, '3 3 English 0');
insert into public.members(email, name, nickname, role) values ('tawil@x.com', 'Shlomo Tawil', 'tawil', 'member');
select lab.probar_valor('vincular a alguien que está en la Agenda: la ficha se queda (con su correo), y sus instituciones también', lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona('tawil', 'tawil@x.com')$q$,
  $q$select (select email from public.personas where id = 'tawil') || ' ' || (select count(*) from public.contactos where persona = 'tawil')$q$, 'tawil@x.com 2');
select lab.probar_valor('vincular a alguien que no está en la Agenda: la ficha se va, como siempre', lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona('pres', 'ana@x.com')$q$,
  $q$select count(*)::text from public.personas where id = 'pres'$q$, '0');

-- ---------- Contactos por lugar (20-contactos-por-lugar.sql) ----------
-- Gente que no va con una institución: con una ciudad, un país, una región
-- o toda LatAm. Lo suma cualquiera que carga eventos, como a una institución.
insert into public.personas(id, name, telefonos, created_by) values
  ('dobkin', 'Gabriel Dobkin', '[{"n":"+54 9 341 368 9150","wa":true}]', 'ana@x.com'),
  ('julia', 'Julia', '[{"n":"+55 11 99478 1099","wa":true}]', 'ana@x.com');
select lab.probar_valor('una integrante suma al presidente de la comunidad de Rosario, sin institución', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona, cargo) values ('l1', 'ciudad', 'Argentina', ' Rosario ', 'dobkin', 'Presidente')$q$,
  $q$select nivel || ' ' || country || ' «' || city || '» ' || coalesce(institucion, '-') || ' ' || created_by from public.contactos where id = 'l1'$q$,
  'ciudad Argentina «Rosario» - ana@x.com');
select lab.probar('a alguien de todo Brasil', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona, cargo) values ('l2', 'pais', 'Brasil', 'julia', 'R Hadraja')$q$, true);
select lab.probar('a alguien de la región Sur', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, zona, persona, cargo) values ('l3', 'region', 'sur', 'julia', 'R KM')$q$, true);
select lab.probar('y a alguien de toda LatAm', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, persona, cargo) values ('l4', 'latam', 'julia', 'Director General')$q$, true);
select lab.probar('un observador no suma', lab.como('obs@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('l5', 'pais', 'Chile', 'julia')$q$, false);
select lab.probar('nada a medias: de una ciudad sin decir cuál, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('l6', 'ciudad', 'Argentina', 'julia')$q$, false);
select lab.probar('de un país y además con institución, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, institucion, persona) values ('l7', 'pais', 'Argentina', 'cba', 'julia')$q$, false);
select lab.probar('de una institución sin institución, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, persona) values ('l8', 'institucion', 'julia')$q$, false);
select lab.probar('una región que no existe, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, zona, persona) values ('l9', 'region', 'caribe', 'julia')$q$, false);
select lab.probar('un nivel que no existe, no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('l10', 'provincia', 'Argentina', 'julia')$q$, false);
-- Lo que probar() deja, se vuelve atrás: lo que tiene que quedar se inserta de una.
insert into public.contactos(id, nivel, country, city, persona, cargo) values ('l1', 'ciudad', 'Argentina', 'Rosario', 'dobkin', 'Presidente');
insert into public.contactos(id, nivel, country, persona, cargo) values ('l2', 'pais', 'Brasil', 'julia', 'R Hadraja');
insert into public.contactos(id, nivel, zona, persona, cargo) values ('l3', 'region', 'sur', 'julia', 'R KM');
insert into public.contactos(id, nivel, persona, cargo) values ('l4', 'latam', 'julia', 'Director General');
insert into public.contactos(id, nivel, country, city, persona, cargo) values ('l12', 'ciudad', 'Argentina', 'Santa Fe', 'dobkin', 'Asesor');
insert into public.contactos(id, institucion, persona, cargo) values ('l13', 'cba', 'dobkin', 'Director');
select lab.probar('la misma persona dos veces en la misma ciudad (aunque se escriba distinto), no', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona) values ('l11', 'ciudad', 'Argentina', 'rosario', 'dobkin')$q$, false);
select lab.probar('pero sí en otra ciudad', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona, cargo) values ('l16', 'ciudad', 'Argentina', 'Córdoba', 'dobkin', 'Asesor')$q$, true);
select lab.probar('lo de siempre sigue igual: a una institución, sin decir el nivel', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, institucion, persona, cargo) values ('l17', 'cba', 'julia', 'Director')$q$, true);
select lab.probar_valor('y queda como de institución', lab.como('ana@x.com'), $q$select 1$q$,
  $q$select nivel from public.contactos where id = 'l13'$q$, 'institucion');
select lab.probar('sacar a alguien de un lugar es corregir: una integrante puede', lab.como('dario@x.com'),
  $q$delete from public.contactos where id = 'l12'$q$, true);
-- Unir dos fichas que están en el mismo lugar: queda una sola vez ahí.
insert into public.personas(id, name, created_by) values ('julia2', 'Júlia', 'ana@x.com');
insert into public.contactos(id, nivel, country, persona, cargo) values ('l14', 'pais', 'Brasil', 'julia2', 'R Hadraja');
insert into public.contactos(id, nivel, country, city, persona, cargo) values ('l15', 'ciudad', 'Brasil', 'Recife', 'julia2', 'Referente');
select lab.probar_valor('unir: el mismo país no se repite, la otra ciudad pasa', lab.como('benny@team-latam.com'),
  $q$select public.unir_personas('julia2', 'julia')$q$,
  $q$select string_agg(nivel || ':' || coalesce(city, country, zona, '*'), ' ' order by id) from public.contactos where persona = 'julia'$q$,
  'ciudad:Recife pais:Brasil region:sur latam:*');

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
