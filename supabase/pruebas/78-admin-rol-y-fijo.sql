\set QUIET on
-- Un admin por rol (members.role = 'admin') no es el admin fijo
-- (benny@team-latam.com, ADMIN_EMAIL en index.html y admin_fijo() en la
-- base): el fijo lo es con o sin ficha, y «a él nadie lo puede tocar»
-- (02-politicas.sql). Acá, lo que el admin por rol NO puede y el fijo sí, y
-- lo del fijo que nadie más toca (docs/AUDITORIA.md, R27). Lo que ya prueba
-- 90-permisos.sql (borrar posteos, cambiar el propio rol, sacar al fijo del
-- equipo) no se repite.
truncate lab.resultados;
truncate public.posts, public.replies, public.members, public.former_members, public.access_requests,
  public.user_prefs, public.app_config, public.audit_log cascade;
-- El admin fijo SIN ficha en el equipo (como arranca el proyecto): lo que
-- se prueba de él es por su correo, no por su fila.
insert into public.members(email, name, nickname, role) values
  ('ana@x.com',  'Ana',  'ana',  'admin'),
  ('rol2@x.com', 'Rol2', 'rol2', 'admin'),   -- otro admin por rol
  ('juan@x.com', 'Juan', 'juan', 'member');
insert into public.posts(id, title, content, date, start_date, end_date, activity_type, author_name, author_email) values
  ('p_evento', 'Evento de Juan', 'texto', '2026-09-10','2026-09-10','2026-09-10','evento','Juan','juan@x.com');
insert into public.replies(id, post_id, content, author_name, author_email) values
  ('r_juan', 'p_evento', 'comentario de Juan', 'Juan', 'juan@x.com'),
  ('r_ana',  'p_evento', 'comentario de Ana',  'Ana',  'ana@x.com');
insert into public.user_prefs(email, prefs) values
  ('benny@team-latam.com', '{"emailWhen":"instant","weekStart":1}'),
  ('juan@x.com', '{"weekStart":1}');
insert into storage.objects(bucket_id, name) values ('adjuntos', 'posts/p_evento/foto.jpg');

-- ---------- Borrar un comentario: solo el admin fijo ----------
-- replies_borrar (02-politicas.sql) es solo es_admin_fijo(): ni el autor,
-- ni un admin por rol. La app también esconde el botón para los demás.
select lab.probar('un admin por rol NO borra el comentario de otro', lab.como('ana@x.com'),
  $q$delete from public.replies where id = 'r_juan'$q$, false);
select lab.probar('ni el suyo propio', lab.como('ana@x.com'),
  $q$delete from public.replies where id = 'r_ana'$q$, false);
select lab.probar('el autor de un comentario tampoco borra el suyo', lab.como('juan@x.com'),
  $q$delete from public.replies where id = 'r_juan'$q$, false);
select lab.probar('el admin fijo sí', lab.como('benny@team-latam.com'),
  $q$delete from public.replies where id = 'r_juan'$q$, true);
select lab.probar('y también el de un admin', lab.como('benny@team-latam.com'),
  $q$delete from public.replies where id = 'r_ana'$q$, true);
select lab.probar('un admin por rol NO borra un archivo del bucket', lab.como('ana@x.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, false);
select lab.probar('el admin fijo sí', lab.como('benny@team-latam.com'),
  $q$delete from storage.objects where name = 'posts/p_evento/foto.jpg'$q$, true);

-- ---------- Una ficha que se hace pasar por la del admin fijo ----------
-- El correo del fijo se compara SIN mayúsculas. Hasta el 10/10/2026 la
-- política decía `email <> admin_fijo()`, y un admin por rol podía crear
-- una ficha «Benny@Team-Latam.com»: el login siempre trae el correo en
-- minúsculas, así que no le servía a nadie para entrar, pero aparecía en el
-- equipo y en las @menciones.
select lab.probar('un admin por rol da de alta a alguien (control: la puerta anda)', lab.como('ana@x.com'),
  $q$insert into public.members(email, name, nickname) values ('nuevo@x.com', 'Nuevo', 'nuevo')$q$, true);
select lab.probar('pero NO una ficha con el correo del admin fijo', lab.como('ana@x.com'),
  $q$insert into public.members(email, name, nickname) values ('benny@team-latam.com', 'Benny', 'benny')$q$, false);
select lab.probar('ni con el correo del admin fijo en otras mayúsculas', lab.como('ana@x.com'),
  $q$insert into public.members(email, name, nickname) values ('Benny@Team-Latam.com', 'Benny', 'benny2')$q$, false);
select lab.probar('ni todo en mayúsculas', lab.como('ana@x.com'),
  $q$insert into public.members(email, name, nickname, role) values ('BENNY@TEAM-LATAM.COM', 'Benny', 'benny3', 'admin')$q$, false);
select lab.probar('el admin fijo sí puede darse de alta (así arranca todo)', lab.como('benny@team-latam.com'),
  $q$insert into public.members(email, name, nickname) values ('benny@team-latam.com', 'Benny', 'benny')$q$, true);
-- Una ficha así que ya existiera (la dejó el dueño de la base): un admin por
-- rol tampoco la edita ni la borra; la maneja el fijo.
insert into public.members(email, name, nickname, role) values ('Benny@Team-Latam.com', 'Benny', 'bennyviejo', 'member');
select lab.probar('un admin por rol NO edita una ficha con el correo del fijo en otras mayúsculas', lab.como('ana@x.com'),
  $q$update public.members set role = 'admin' where email = 'Benny@Team-Latam.com'$q$, false);
select lab.probar('ni la borra', lab.como('ana@x.com'),
  $q$delete from public.members where email = 'Benny@Team-Latam.com'$q$, false);
select lab.probar('el admin fijo sí', lab.como('benny@team-latam.com'),
  $q$delete from public.members where email = 'Benny@Team-Latam.com'$q$, true);
select lab.probar('un admin por rol edita la ficha de otro admin por rol (control)', lab.como('ana@x.com'),
  $q$update public.members set nickname = 'rol2b' where email = 'rol2@x.com'$q$, true);

-- ---------- Las preferencias del admin fijo ----------
-- olvidar_preferencias (04-funciones.sql) es de cualquier admin, para
-- limpiar lo de quien se va del equipo; las del admin fijo las borra solo
-- él (a él nadie lo toca; unificar_cuentas ya lo exige igual).
select lab.probar('un admin por rol NO borra las preferencias del admin fijo', lab.como('ana@x.com'),
  $q$select public.olvidar_preferencias('benny@team-latam.com')$q$, false);
select lab.probar('ni escribiendo su correo en otras mayúsculas', lab.como('ana@x.com'),
  $q$select public.olvidar_preferencias('Benny@Team-Latam.com')$q$, false);
select lab.probar('ni con espacios alrededor', lab.como('ana@x.com'),
  $q$select public.olvidar_preferencias(' benny@team-latam.com ')$q$, false);
select lab.comprobar('(y las preferencias del admin fijo siguen ahí)',
  $q$select count(*)::text from public.user_prefs where email = 'benny@team-latam.com'$q$, '1');
select lab.probar_valor('el admin fijo sí borra las suyas', lab.como('benny@team-latam.com'),
  $q$select public.olvidar_preferencias('benny@team-latam.com')$q$,
  $q$select count(*)::text from public.user_prefs where email = 'benny@team-latam.com'$q$, '0');
select lab.probar_valor('un admin por rol borra las de un integrante (para eso existe)', lab.como('ana@x.com'),
  $q$select public.olvidar_preferencias('juan@x.com')$q$,
  $q$select count(*)::text from public.user_prefs where email = 'juan@x.com'$q$, '0');
select lab.probar_valor('y escribiendo su correo en mayúsculas', lab.como('rol2@x.com'),
  $q$select public.olvidar_preferencias('JUAN@X.COM')$q$,
  $q$select count(*)::text from public.user_prefs where email = 'juan@x.com'$q$, '0');
select lab.probar('un integrante no borra las de nadie', lab.como('juan@x.com'),
  $q$select public.olvidar_preferencias('benny@team-latam.com')$q$, false);

-- ---------- Lo demás del admin fijo, de un vistazo ----------
-- (control de que la diferencia es esta y no que alguna función no ande;
-- ahora con la ficha del fijo puesta)
insert into public.members(email, name, nickname, role) values ('benny@team-latam.com', 'Benny', 'benny', 'member');
select lab.probar('un admin por rol cambia el rol de otro integrante', lab.como('ana@x.com'),
  $q$update public.members set role = 'observer' where email = 'juan@x.com'$q$, true);
select lab.probar('pero NO el del admin fijo (aunque tenga ficha y se escriba igual)', lab.como('ana@x.com'),
  $q$update public.members set role = 'observer' where email = 'benny@team-latam.com'$q$, false);
select lab.probar('el admin fijo cambia el rol de un admin por rol', lab.como('benny@team-latam.com'),
  $q$update public.members set role = 'member' where email = 'ana@x.com'$q$, true);
select lab.probar('un admin por rol NO unifica cuentas con el correo del admin fijo', lab.como('ana@x.com'),
  $q$select public.unificar_cuentas('juan@x.com', 'benny@team-latam.com')$q$, false);

\set QUIET off
select n, '  FALLA  ' || nombre || '  ' || detalle as falla from lab.resultados where esperado <> obtenido order by n;
select count(*) filter (where esperado = obtenido) || ' pasaron, ' ||
       count(*) filter (where esperado <> obtenido) || ' fallaron  (de ' || count(*) || ')' as resultado
from lab.resultados;
