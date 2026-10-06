-- ============================================================
-- Datos al límite de lo que el esquema permite HOY
-- ============================================================
-- Para volver a aplicar el esquema sobre una base que no esté vacía
-- (reaplicar-con-datos.sh). Las pruebas de 9x aplican el esquema dos veces
-- sobre una base VACÍA, y por eso no vieron que el 03 recreaba una
-- restricción vieja (contenido de al menos 1) sobre filas que el 09 ya
-- había dejado vacías: en la base de verdad, el esquema dejaba de poder
-- aplicarse.
--
-- Cada fila está en el borde de lo que se acepta: el contenido vacío de un
-- evento de Calendar, los largos máximos, los topes de cada lista. Si
-- mañana un archivo endurece algo sin acordarse de lo que ya está
-- guardado, volver a aplicar se cae acá y no en Supabase.
--
-- Se carga como dueño de la base (sin persona detrás, como una migración)
-- y se puede correr más de una vez.
-- ============================================================
\set QUIET on

insert into public.members (email, name, nickname, photo_url, role, approved_at, approved_by,
                            calendar_shared, calendar_invite_sent_at, tour_seen_at) values
  ('limite@ejemplo.com', repeat('N', 120), 'josémaría_' || repeat('ñ', 30), 'https://' || repeat('f', 492),
   'admin', now(), repeat('a', 200), true, now(), now()),
  ('observa@ejemplo.com', 'Observa', null, null, 'observer', null, null, false, null, null)
on conflict (email) do nothing;

insert into public.former_members (email, name, nickname, photo_url, approved_at, revoked_at)
values ('se.fue@ejemplo.com', repeat('V', 120), repeat('v', 40), 'https://' || repeat('f', 492), now(), now())
on conflict (email) do nothing;

insert into public.access_requests (email, name, photo_url, status, requested_at) values
  -- Desde el 6/10/2026 la foto de una solicitud es solo la de Google
  -- (solicitudes_foto): la más larga que se acepta, con esa forma.
  ('pide@ejemplo.com', repeat('P', 120), 'https://lh3.googleusercontent.com/' || repeat('f', 466), 'pending', now()),
  ('rechazada@ejemplo.com', 'R', null, 'rejected', now())
on conflict (email) do nothing;

-- Un evento traído de Google Calendar sin descripción: contenido VACÍO.
-- Es la fila que tumbaba el 03.
insert into public.posts (id, title, content, date, start_date, end_date, activity_type,
                          author_name, author_email, calendar_event_id)
values ('limiteVacio000000001', 'Reunión de equipo', '', '2026-10-05', '2026-10-05', '2026-10-05',
        'virtual', 'Google Calendar', '', 'eventoSinDescripcion')
on conflict (id) do nothing;

-- Un posteo con TODO al máximo.
insert into public.posts (id, title, content, date, start_date, end_date, start_time, end_time,
  activity_type, author_name, author_email, organizer, location, cancelled,
  is_project, project_notes, project_status, project_done_by, project_done_at,
  milestones, editors, recurrence, recurrence_skip, recurrence_moves,
  scopes, participants, links, mentions, images, files, liked_by,
  calendar_event_id, last_edited_at, last_edited_by)
select 'limiteLleno000000001', repeat('T', 140), repeat('C', 5000),
  '2026-10-01', '2026-10-01', '2026-10-03', '09:00', '18:30',
  repeat('k', 40), repeat('A', 120), 'limite@ejemplo.com', repeat('O', 140), repeat('L', 200), false,
  true, repeat('n', 2000), 'done', repeat('d', 200), now(),
  (select jsonb_agg(jsonb_build_object('id', 'm' || g, 'label', 'Hito ' || g, 'date', '2026-10-01',
                                       'done', g % 2 = 0, 'owners', jsonb_build_array('limite@ejemplo.com')))
     from generate_series(1, 40) g),
  (select array_agg(repeat('e', 190) || g) from generate_series(1, 20) g),
  (select array_agg('RRULE:FREQ=WEEKLY;' || repeat('X', 470) || g) from generate_series(1, 10) g),
  (select array_agg(to_char(date '2026-01-01' + g, 'YYYY-MM-DD')) from generate_series(1, 200) g),
  (select jsonb_object_agg(to_char(date '2026-01-01' + g, 'YYYY-MM-DD'), to_char(date '2026-01-02' + g, 'YYYY-MM-DD'))
     from generate_series(1, 60) g),
  (select jsonb_agg(jsonb_build_object('type', 'country', 'country', 'Argentina')) from generate_series(1, 15) g),
  (select jsonb_agg(jsonb_build_object('email', repeat('p', 190) || g, 'name', repeat('N', 120))) from generate_series(1, 10) g),
  (select jsonb_agg(jsonb_build_object('label', repeat('l', 200), 'url', 'https://' || repeat('u', 1992))) from generate_series(1, 10) g),
  (select array_agg(repeat('m', 190) || g) from generate_series(1, 10) g),
  (select array_agg('posts/limiteLleno000000001/img' || g || '_1790000000000.jpg') from generate_series(0, 19) g),
  (select jsonb_agg(jsonb_build_object('name', repeat('a', 196) || '.pdf', 'path', 'posts/limiteLleno000000001/arch' || g || '_1790000000000.pdf',
                                       'mime', 'application/pdf', 'kind', 'pdf', 'doc', 'plan' || g, 'subidoEl', '2026-10-01T12:00:00.000Z'))
     from generate_series(0, 9) g),
  (select array_agg('persona' || g || '@ejemplo.com') from generate_series(1, 50) g),
  repeat('c', 200), now(), repeat('E', 120)
on conflict (id) do nothing;

insert into public.replies (id, post_id, content, author_name, author_email, scopes, links,
                            images, files, mentions, liked_by, reply_to_id, system, icon, occ)
select 'limiteRespuesta00001', 'limiteLleno000000001', repeat('R', 3000), repeat('A', 120), 'limite@ejemplo.com',
  (select jsonb_agg(jsonb_build_object('type', 'region', 'region', 'sur')) from generate_series(1, 15) g),
  (select jsonb_agg(jsonb_build_object('label', repeat('l', 200), 'url', 'https://' || repeat('u', 1992))) from generate_series(1, 10) g),
  (select array_agg('replies/limiteRespuesta00001/img' || g || '_1790000000000.jpg') from generate_series(0, 19) g),
  (select jsonb_agg(jsonb_build_object('name', 'nota.m4a', 'path', 'replies/limiteRespuesta00001/arch' || g || '_1790000000000.m4a'))
     from generate_series(0, 9) g),
  (select array_agg(repeat('m', 190) || g) from generate_series(1, 10) g),
  (select array_agg('persona' || g || '@ejemplo.com') from generate_series(1, 50) g),
  repeat('r', 200), false, '📅', '2026-10-01'
on conflict (id) do nothing;

insert into public.replies (id, post_id, content, author_name, author_email, system, icon)
values ('limiteSistema0000001', 'limiteVacio000000001', '📅 Cambió en Google Calendar', 'Google Calendar', null, true, '📅')
on conflict (id) do nothing;

insert into public.user_prefs (email, prefs) values ('limite@ejemplo.com',
  '{"weekStart":1,"showWeekends":false,"customDays":4,"dimPast":true,"dateFormat":"dmy","timeFormat":"24",
    "holidayCountries":["Argentina","Chile","Uruguay"],"holidayColor":"#a3e635","notifyTypes":["visita"]}')
on conflict (email) do nothing;

-- La configuración del equipo, al tope de lo que se acepta: 30 tipos con
-- 10 documentos cada uno, 20 zonas y todos los países.
insert into public.app_config (key, value) values
  ('preferences', jsonb_build_object(
     'activityTypes', (select jsonb_agg(jsonb_build_object(
        'key', 'tipo' || g, 'label', rpad('Tipo ' || g, 60, 'x'), 'icon', '🏛️', 'calendarSync', g % 2 = 0,
        'docs', (select jsonb_agg(jsonb_build_object('id', 'doc' || h, 'label', rpad('Documento ' || h, 100, 'y')))
                   from generate_series(1, 10) h)))
       from generate_series(1, 30) g),
     'extraCities', jsonb_build_object('Argentina', jsonb_build_array('Ushuaia', 'Tandil')),
     'calendarId', 'equipo@group.calendar.google.com', 'calendarImportFrom', '2024-01-01',
     'maxImages', 20, 'maxAttachmentFiles', 10, 'maxAttachmentFileBytes', 26214400)),
  ('territoryConfig', jsonb_build_object(
     'zones', (select jsonb_object_agg('zona' || g, jsonb_build_object('label', rpad('Zona ' || g, 60, 'z'), 'color', '#2563eb'))
                 from generate_series(1, 20) g),
     'countryZones', (select jsonb_object_agg('País ' || g, 'zona' || (1 + g % 20)) from generate_series(1, 60) g))),
  ('calendarSync', jsonb_build_object('syncToken', repeat('t', 2000), 'lastSyncedAt', '2026-10-03T03:00:00.000Z'))
on conflict (key) do nothing;

insert into public.audit_log (id, type, actor_email, actor_name, target_email, detail, device, ip)
values ('limiteAuditoria00001', 'access_approved', repeat('a', 200), repeat('A', 120), repeat('t', 200),
        repeat('d', 300), repeat('v', 60), repeat('9', 45))
on conflict (id) do nothing;
