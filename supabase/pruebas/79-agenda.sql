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
-- Rosario, con su rab; y una persona sin cuenta de antes, «Shlomo Ejemplar».
insert into public.instituciones(id, name, country, city, address, tipo, created_by) values
  ('ros', 'Beit Chabad Rosario', 'Argentina', 'Rosario', 'Mendoza 1572', 'Sinagoga', 'benny@team-latam.com');
insert into public.personas(id, name, telefonos, created_by) values
  ('ejemplar', 'Shlomo Ejemplar', '[{"n":"+54 9 341 555 0739","wa":true}]', 'benny@team-latam.com');
insert into public.contactos(id, institucion, persona, cargo) values ('c1', 'ros', 'ejemplar', 'Rab a cargo');

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
  $q$insert into public.contactos(id, institucion, persona) values ('c3', 'ros', 'ejemplar')$q$, false);
select lab.probar('sacar a alguien que ya no está es corregir: una integrante puede', lab.como('dario@x.com'),
  $q$delete from public.contactos where id = 'c1'$q$, true);
select lab.probar('un observador no', lab.como('obs@x.com'),
  $q$delete from public.contactos where id = 'c1'$q$, false);
select lab.probar('otra integrante corrige el teléfono de una persona (desde la Agenda)', lab.como('dario@x.com'),
  $q$update public.personas set telefonos = '[{"n":"+54 9 341 555 0000","wa":true}]' where id = 'ejemplar'$q$, true);
select lab.probar_valor('y queda quién la tocó', lab.como('dario@x.com'),
  $q$update public.personas set idiomas = '{Español,עברית}' where id = 'ejemplar'$q$,
  $q$select tocado_por || ' ' || array_length(idiomas, 1) from public.personas where id = 'ejemplar'$q$, 'dario@x.com 2');
select lab.probar('un teléfono con letras no entra', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = '[{"n":"llamar al 4444","wa":false}]' where id = 'ejemplar'$q$, false);
select lab.probar('más de seis teléfonos, no', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = (select jsonb_agg(jsonb_build_object('n', '+54 11 ' || g, 'wa', false)) from generate_series(1000, 1006) g) where id = 'ejemplar'$q$, false);
select lab.probar('«wa» que no es sí o no, no', lab.como('ana@x.com'),
  $q$update public.personas set telefonos = '[{"n":"+54 11 4444","wa":"sí"}]' where id = 'ejemplar'$q$, false);

-- ---------- Borrar: solo un admin ----------
select lab.probar('una integrante no borra una institución', lab.como('ana@x.com'), $q$delete from public.instituciones where id = 'ros'$q$, false);
select lab.probar('ni una persona, aunque la haya sumado ella', lab.como('ana@x.com'), $q$delete from public.personas where id = 'pres'$q$, false);
select lab.probar_valor('un admin borra una institución, y con ella quién estaba ahí (no las fichas de la gente)', lab.como('benny@team-latam.com'),
  $q$delete from public.instituciones where id = 'ros'$q$,
  $q$select (select count(*) from public.contactos where institucion = 'ros') || ' ' || (select count(*) from public.personas where id in ('ejemplar', 'pres'))$q$, '0 2');
select lab.probar('las listas las maneja un admin: una integrante no crea una', lab.como('ana@x.com'),
  $q$insert into public.agenda_listas(id, name) values ('l', 'Mi lista')$q$, false);

-- ---------- Traer una lista ----------
select lab.probar('traer una lista lo hace un admin, no una integrante', lab.como('ana@x.com'),
  $q$select public.agenda_traer('Directorio', '[{"name":"X","country":"Argentina","gente":[]}]')$q$, false);
select lab.probar('una lista vacía no', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Directorio', '[]')$q$, false);
create temp table traida as select public.agenda_traer('Directorio Chabad LatAm', $j$[
  {"name":"Chabad Central","country":"Argentina","city":"Buenos Aires (CABA)","address":"Aguero 1164","tipo":"Centro Comunitario",
   "gente":[{"name":"Tzvi Ficticio","cargo":"Rab a cargo","telefonos":[{"n":"+54 9 11 5555 1698","wa":true}]}]},
  {"name":"Escuela Oholey Jinuj","country":"Argentina","city":"Buenos Aires (CABA)","tipo":"Escuela",
   "gente":[{"name":"Tzvi Ficticio","cargo":"Rab a cargo","telefonos":[{"n":"54 9 11 5555 0000","wa":true}]}]},
  {"name":"Beit Chabad Rosario","country":"Argentina","city":"Rosario","estado":"temporada",
   "gente":[{"name":"Shlomó Ejemplar","cargo":"Rab a cargo","telefonos":[{"n":"+54 9 341 555-0739","wa":true}]}]}
]$j$::jsonb) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: tres instituciones, una lista, y lo que dice que hizo', true,
  (select r ->> 'instituciones' from traida) = '3' and (select count(*) from public.agenda_listas) = 1
  and (select r ->> 'personas_nuevas' from traida) = '1' and (select r ->> 'personas_que_ya_estaban' from traida) = '1',
  (select r::text from traida);
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: Tzvi en dos instituciones es UNA ficha, con sus dos teléfonos', true,
  (select count(*) from public.personas where name = 'Tzvi Ficticio') = 1
  and (select jsonb_array_length(telefonos) from public.personas where name = 'Tzvi Ficticio') = 2
  and (select count(*) from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Tzvi Ficticio') = 2, '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: «Shlomó Ejemplar» es la persona que ya estaba (sin tildes), y su número no se repite', true,
  (select count(*) from public.personas where public.sin_tildes(name) = 'Shlomo Ejemplar') = 1
  and (select jsonb_array_length(telefonos) from public.personas where id = 'ejemplar') = 1
  and exists (select 1 from public.contactos where persona = 'ejemplar'), '';
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer: cada institución y la persona nueva saben de qué lista vinieron, y quedan firmadas por el admin', true,
  (select count(*) from public.instituciones where lista = (select r ->> 'lista' from traida)) = 3
  and (select lista from public.personas where name = 'Tzvi Ficticio') = (select r ->> 'lista' from traida)
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
  $q$select public.unir_personas('tzvi2', (select id from public.personas where name = 'Tzvi Ficticio'))$q$,
  $q$select (select count(*) from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Tzvi Ficticio') || ' ' ||
          (select jsonb_array_length(telefonos) from public.personas where name = 'Tzvi Ficticio') || ' ' ||
          (select array_to_string(idiomas, ',') from public.personas where name = 'Tzvi Ficticio') || ' ' ||
          (select count(*) from public.personas where id = 'tzvi2')$q$, '3 3 English 0');
insert into public.members(email, name, nickname, role) values ('ejemplar@x.com', 'Shlomo Ejemplar', 'ejemplar', 'member');
select lab.probar_valor('vincular a alguien que está en la Agenda: la ficha se queda (con su correo), y sus instituciones también', lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona('ejemplar', 'ejemplar@x.com')$q$,
  $q$select (select email from public.personas where id = 'ejemplar') || ' ' || (select count(*) from public.contactos where persona = 'ejemplar')$q$, 'ejemplar@x.com 2');
select lab.probar_valor('vincular a alguien que no está en la Agenda: la ficha se va, como siempre', lab.como('benny@team-latam.com'),
  $q$select public.vincular_persona('pres', 'ana@x.com')$q$,
  $q$select count(*)::text from public.personas where id = 'pres'$q$, '0');

-- ---------- Contactos por lugar (20-contactos-por-lugar.sql) ----------
-- Gente que no va con una institución: con una ciudad, un país, una región
-- o toda LatAm. Lo suma cualquiera que carga eventos, como a una institución.
insert into public.personas(id, name, telefonos, created_by) values
  ('dobkin', 'Gabriel Supuesto', '[{"n":"+54 9 341 555 9150","wa":true}]', 'ana@x.com'),
  ('julia', 'Julia', '[{"n":"+55 11 95555 1099","wa":true}]', 'ana@x.com');
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
-- Los largos de país y ciudad (contactos_lugar_ok, 20-contactos-por-lugar.sql;
-- docs/AUDITORIA.md, R27): hasta 80 caracteres cada uno, y no pueden quedar
-- vacíos (un renglón en blanco se vuelve null y a ese nivel le falta lo suyo).
select lab.probar('un país de 80 caracteres entra', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('lg1', 'pais', repeat('P', 80), 'julia')$q$, true);
select lab.probar('uno de 81, NO', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('lg2', 'pais', repeat('P', 81), 'julia')$q$, false);
select lab.probar('una ciudad de 80 caracteres entra', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona) values ('lg3', 'ciudad', 'Chile', repeat('C', 80), 'julia')$q$, true);
select lab.probar('una de 81, NO', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona) values ('lg4', 'ciudad', 'Chile', repeat('C', 81), 'julia')$q$, false);
select lab.probar('un país en blanco, NO (queda sin país)', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, persona) values ('lg5', 'pais', '   ', 'julia')$q$, false);
select lab.probar('una ciudad en blanco, NO (queda sin ciudad)', lab.como('ana@x.com'),
  $q$insert into public.contactos(id, nivel, country, city, persona) values ('lg6', 'ciudad', 'Chile', '   ', 'julia')$q$, false);
insert into public.contactos(id, nivel, country, persona) values ('lg0', 'pais', 'Peru', 'julia');
select lab.probar('editar un contacto de un país para dejarlo en 80, sí', lab.como('ana@x.com'),
  $q$update public.contactos set country = repeat('P', 80) where id = 'lg0'$q$, true);
select lab.probar('y en 81, NO', lab.como('ana@x.com'),
  $q$update public.contactos set country = repeat('P', 81) where id = 'lg0'$q$, false);
delete from public.contactos where id = 'lg0';
-- Y las instituciones, que tienen el mismo tope (19-agenda.sql).
select lab.probar('una institución con país de 81 caracteres, NO', lab.como('ana@x.com'),
  $q$insert into public.instituciones(id, name, country) values ('lgi1', 'X', repeat('P', 81))$q$, false);
select lab.probar('con ciudad de 81, NO', lab.como('ana@x.com'),
  $q$insert into public.instituciones(id, name, country, city) values ('lgi2', 'X', 'Chile', repeat('C', 81))$q$, false);
select lab.probar('con ciudad de 80, sí', lab.como('ana@x.com'),
  $q$insert into public.instituciones(id, name, country, city) values ('lgi3', 'X', 'Chile', repeat('C', 80))$q$, true);
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

-- ---------- Traer una lista con gente de ciudades y de un país (24-agenda-lugares-al-traer.sql) ----------
-- El Mapeo de comunidades: el presidente de Córdoba, quien cubre Brasil… no van con una institución.
-- «Júlia» (julia2) quedó de la prueba de unir (esa se vuelve atrás): se saca para que «Julia» sea una sola ficha.
delete from public.personas where id = 'julia2';
create temp table n_antes as select (select count(*) from public.agenda_listas) as listas, (select count(*) from public.contactos) as contactos;
select lab.probar('traer gente de un lugar lo hace un admin, no una integrante', lab.como('ana@x.com'),
  $q$select public.agenda_traer('Mapeo', '[]', '[{"nivel":"pais","country":"Chile","gente":[]}]')$q$, false);
select lab.probar('sin instituciones ni lugares, no', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Mapeo', '[]', '[]')$q$, false);
select lab.probar('un lugar de una ciudad sin decir cuál no entra, y no queda nada a medias (ni la lista)', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Mapeo', '[]', '[{"nivel":"ciudad","country":"Argentina","gente":[{"name":"Nadie"}]}]')$q$, false);
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'ese intento fallido no dejó ni la lista, ni un contacto, ni la persona', true,
  (select count(*) from public.agenda_listas) = (select listas from n_antes)
  and (select count(*) from public.contactos) = (select contactos from n_antes)
  and not exists (select 1 from public.personas where name = 'Nadie'), '';
create temp table mapeo as select public.agenda_traer('Mapeo LatAm', '[]', $j$[
  {"nivel":"ciudad","country":"Argentina","city":"Córdoba","gente":[
    {"name":"Adrian Muestral","cargo":"Presidente","telefonos":[{"n":"+54 9 351 555-0101","wa":true}]},
    {"name":"Gabriel Supuesto","cargo":"Seguridad · Kabat Kehila","telefonos":[{"n":"+54 9 341 555 9150","wa":true},{"n":"+54 9 341 555 0000","wa":true}]}]},
  {"nivel":"ciudad","country":"Argentina","city":"Rosario","gente":[
    {"name":"Gabriel Supuesto","cargo":"Presidente","telefonos":[]}]},
  {"nivel":"pais","country":"Brasil","gente":[
    {"name":"Júlia","cargo":"Presidente","telefonos":[{"n":"+55 11 95555 1099","wa":true}]},
    {"name":"Rafael Imaginario","cargo":"R KM","telefonos":[]}]}
]$j$::jsonb) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer lugares: ninguna institución, tres lugares, y lo que dice que hizo', true,
  (select r ->> 'instituciones' from mapeo) = '0' and (select r ->> 'lugares' from mapeo) = '3' and (select r ->> 'contactos' from mapeo) = '5'
  and (select r ->> 'personas_nuevas' from mapeo) = '2' and (select r ->> 'personas_que_ya_estaban' from mapeo) = '2',
  (select r::text from mapeo);
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer lugares: cada contacto nuevo queda como los que se suman a mano (nivel, país, ciudad, sin institución) y firmado con la lista (3: Supuesto en Rosario y Júlia en Brasil ya estaban en esos lugares)', true,
  (select count(*) from public.contactos where lista = (select r ->> 'lista' from mapeo) and institucion is null) = 3
  and exists (select 1 from public.contactos c join public.personas p on p.id = c.persona where c.lista = (select r ->> 'lista' from mapeo)
                 and c.nivel = 'ciudad' and c.country = 'Argentina' and c.city = 'Córdoba' and p.name = 'Adrian Muestral' and c.cargo = 'Presidente')
  and exists (select 1 from public.contactos c join public.personas p on p.id = c.persona where c.lista = (select r ->> 'lista' from mapeo)
                 and c.nivel = 'pais' and c.country = 'Brasil' and c.city is null and p.name = 'Rafael Imaginario'),
  (select count(*) from public.contactos where lista = (select r ->> 'lista' from mapeo))::text;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer lugares: Supuesto y Júlia ya estaban (sin tildes ni mayúsculas): la misma ficha, y a Supuesto se le suma el teléfono que no tenía', true,
  (select count(*) from public.personas where public.sin_tildes(name) in ('Gabriel Supuesto', 'Julia')) = 2
  and (select jsonb_array_length(telefonos) from public.personas where id = 'dobkin') = 2
  and (select lista from public.personas where name = 'Adrian Muestral') = (select r ->> 'lista' from mapeo),
  (select count(*) from public.personas where public.sin_tildes(name) in ('Gabriel Supuesto', 'Julia'))::text || ' ' ||
  (select jsonb_array_length(telefonos) from public.personas where id = 'dobkin')::text;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'traer lugares: Supuesto ya era el Presidente de Rosario: no se repite en ese lugar (y sigue siendo uno solo)', true,
  (select count(*) from public.contactos where persona = 'dobkin' and nivel = 'ciudad' and lower(public.sin_tildes(city)) = 'rosario') = 1
  and (select cargo from public.contactos where id = 'l1') = 'Presidente', '';
select lab.probar_valor('traer lo mismo otra vez no repite a nadie en su lugar', lab.como('benny@team-latam.com'),
  $q$select public.agenda_traer('Mapeo LatAm otra vez', '[]', '[{"nivel":"ciudad","country":"Argentina","city":"Córdoba","gente":[{"name":"Adrian Muestral","cargo":"Presidente"}]}]')$q$,
  $q$select count(*)::text from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Adrian Muestral'$q$, '1');
-- Y las dos cosas juntas: una institución con su gente y un lugar con la suya.
select lab.probar_valor('traer instituciones y lugares en la misma lista', lab.como('benny@team-latam.com'),
  $q$select (public.agenda_traer('Mixta', '[{"name":"Escuela Mixta","country":"Chile","city":"Santiago","gente":[{"name":"Dana Mixta","cargo":"Directora"}]}]',
          '[{"nivel":"pais","country":"Chile","gente":[{"name":"Dana Mixta","cargo":"Cubre el país"}]}]') ->> 'contactos')$q$,
  $q$select count(*)::text from public.contactos c join public.personas p on p.id = c.persona where p.name = 'Dana Mixta'$q$, '2');

-- ---------- La nota de cada persona al traer una lista (25-agenda-notas-al-traer.sql) ----------
update public.personas set note = 'Habla hebreo' where id = 'julia';
create temp table notas as select public.agenda_traer('Con notas', '[]', $j$[
  {"nivel":"pais","country":"Chile","gente":[
    {"name":"Persona Nueva","cargo":"Presidente","nota":"  Cubre el sur  "},
    {"name":"Gabriel Supuesto","cargo":"Asesor","nota":"Es de Rosario"},
    {"name":"Julia","cargo":"Asesora","nota":"Cubre Brasil"},
    {"name":"Sin Nota","cargo":"Asesor"}]}
]$j$::jsonb) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
create temp table nota_larga as select public.agenda_traer('Nota larga', '[]',
  jsonb_build_array(jsonb_build_object('nivel', 'pais', 'country', 'Peru', 'gente', jsonb_build_array(jsonb_build_object('name', 'Persona Larga', 'cargo', 'X', 'nota', repeat('x', 400)))))) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'notas: una persona nueva nace con su nota (sin espacios de más); sin nota, queda sin nota', true,
  (select note from public.personas where name = 'Persona Nueva') = 'Cubre el sur' and (select note from public.personas where name = 'Sin Nota') is null,
  coalesce((select note from public.personas where name = 'Persona Nueva'), '-');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'notas: a una que ya estaba sin nota se la recibe, y a una con nota se le suma al final (la suya queda)', true,
  (select note from public.personas where id = 'dobkin') = 'Es de Rosario' and (select note from public.personas where id = 'julia') = 'Habla hebreo · Cubre Brasil',
  coalesce((select note from public.personas where id = 'dobkin'), '-') || ' / ' || (select note from public.personas where id = 'julia');
select lab.probar_valor('notas: traer lo mismo otra vez no repite la nota', lab.como('benny@team-latam.com'),
  $q$select (public.agenda_traer('Con notas otra vez', '[]', '[{"nivel":"pais","country":"Chile","gente":[{"name":"Julia","nota":"Cubre Brasil"},{"name":"Gabriel Supuesto","nota":"es de rosario"}]}]') ->> 'lista') is not null$q$,
  $q$select (select note from public.personas where id = 'julia') || ' / ' || (select note from public.personas where id = 'dobkin')$q$, 'Habla hebreo · Cubre Brasil / Es de Rosario');
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'notas: una nota de más de 300 letras se corta en 300 (y la ficha la acepta)', true,
  (select length(note) from public.personas where name = 'Persona Larga') = 300, (select length(note)::text from public.personas where name = 'Persona Larga');


-- ---------- Sacar una lista (26-agenda-sacar-lista.sql) ----------
-- Una lista con dos instituciones y un lugar. Entre su gente: alguien sin nada
-- (se borra), con una nota (se queda), en un evento (se queda) y en otra
-- institución que no es de la lista (se queda). Y alguien sumado a mano a una
-- de esas instituciones, que no vino de la lista: deja de figurar y no se toca.
create temp table para_sacar as select public.agenda_traer('Para sacar', $j$[
  {"name":"Inst S1","country":"Chile","city":"Santiago","gente":[{"name":"Sin Nada Uno"},{"name":"Con Nota Uno","nota":"Habla hebreo"},{"name":"En Evento Uno"},{"name":"En Otra Uno"}]},
  {"name":"Inst S2","country":"Chile","gente":[{"name":"Sin Nada Uno"}]}
]$j$::jsonb, $j$[{"nivel":"ciudad","country":"Chile","city":"Santiago","gente":[{"name":"Lugar Uno"}]}]$j$::jsonb) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into public.personas(id, name, created_by) values ('mano', 'Mano Uno', 'benny@team-latam.com');
insert into public.contactos(id, institucion, persona, cargo) select 'c_mano', i.id, 'mano', 'Director' from public.instituciones i where i.name = 'Inst S1';
insert into public.contactos(id, institucion, persona, cargo) select 'c_otra', 'ros', p.id, 'Otro' from public.personas p where p.name = 'En Otra Uno';
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email, participants)
  select 'p_evento_s', 'Visita', '', current_date, current_date, current_date, 'visita', 'Benny', 'benny@team-latam.com',
         jsonb_build_array(jsonb_build_object('persona', p.id, 'name', p.name)) from public.personas p where p.name = 'En Evento Uno';
select lab.probar('sacar una lista lo hace un admin, no una integrante', lab.como('ana@x.com'),
  format($q$select public.agenda_sacar_lista(%L)$q$, (select (r ->> 'lista') from para_sacar)), false);
select lab.probar('ni mirando qué pasaría', lab.como('ana@x.com'),
  format($q$select public.agenda_sacar_lista(%L, false)$q$, (select (r ->> 'lista') from para_sacar)), false);
select lab.probar('una lista que no existe, no', lab.como('benny@team-latam.com'), $q$select public.agenda_sacar_lista('no_existe')$q$, false);
create temp table mirar as select public.agenda_sacar_lista((select r ->> 'lista' from para_sacar)) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'sacar: mirar cuenta lo que pasaría (2 instituciones, 7 contactos, 1 lugar; se borran 2 personas, se conservan 3: evento, nota y otro lugar; 1 de otra procedencia)', true,
  (r ->> 'instituciones') || '|' || (r ->> 'contactos') || '|' || (r ->> 'lugares') || '|' || (r ->> 'personas_borrar') || '|' || (r ->> 'personas_conservar') || '|' ||
  (r ->> 'por_evento') || '|' || (r ->> 'por_dato') || '|' || (r ->> 'por_otro_lugar') || '|' || (r ->> 'de_otra_procedencia') = '2|7|1|2|3|1|1|1|1' and (r ->> 'hecho') = 'false',
  r::text from mirar;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'sacar: mirar no toca nada', true,
  (select count(*) from public.instituciones where name in ('Inst S1', 'Inst S2')) = 2 and (select count(*) from public.agenda_listas where name = 'Para sacar') = 1
  and (select count(*) from public.personas where name = 'Sin Nada Uno') = 1, '-';
create temp table sacada as select public.agenda_sacar_lista((select r ->> 'lista' from para_sacar), true) as r
from (select set_config('request.jwt.claims', lab.como('benny@team-latam.com')::text, true)) _;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'sacar: la lista y sus instituciones se van (la otra lista y Rosario se quedan)', true,
  (select count(*) from public.agenda_listas where name = 'Para sacar') = 0 and (select count(*) from public.instituciones where name in ('Inst S1', 'Inst S2')) = 0
  and (select count(*) from public.agenda_listas where name = 'Directorio Chabad LatAm') = 1 and (select count(*) from public.instituciones where id = 'ros') = 1
  and (select count(*) from public.contactos where nivel = 'ciudad' and city = 'Santiago' and country = 'Chile') = 0, (r::text) from sacada;
insert into lab.resultados(nombre, esperado, obtenido, detalle)
select 'sacar: se borra a quien quedó sin nada y se conserva a quien tiene nota, evento, otro lugar o no vino de la lista', true,
  (select count(*) from public.personas where name in ('Sin Nada Uno', 'Lugar Uno')) = 0
  and (select count(*) from public.personas where name in ('Con Nota Uno', 'En Evento Uno', 'En Otra Uno', 'Mano Uno')) = 4
  and (select note from public.personas where name = 'Con Nota Uno') = 'Habla hebreo'
  and (select count(*) from public.contactos where id = 'c_otra') = 1 and (select count(*) from public.contactos where id = 'c_mano') = 0,
  (select string_agg(name, ', ') from public.personas where name like '%Uno');

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
