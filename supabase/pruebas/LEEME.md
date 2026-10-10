# Las pruebas de los permisos

Esto no hay que correrlo en Supabase — es para comprobar, antes de tocar
nada tuyo, que `02-politicas.sql` hace lo que dice.

Levanta una base PostgreSQL local, le pone las 8 tablas y los permisos, y
después se hace pasar por seis personas distintas (el admin fijo, un admin
por rol, un integrante común, un observador, un ex integrante y alguien de
afuera) para comprobar que cada uno puede lo que tiene que poder y **que no
puede lo que no**. También se hace pasar por la llave de servicio, que es
como escriben el sincronizador nocturno y la limpieza del bucket.

Los archivos:

- `00-laboratorio.sql` — imita lo mínimo de Supabase (sus roles, su
  `auth.jwt()`, su bucket, y que una función nueva se pueda llamar desde
  el navegador si no se le saca el permiso). En Supabase esto ya existe;
  acá hay que fabricarlo.
- `75-funciones-ejecutables.sql` — qué funciones puede llamar cada rol: una
  lista blanca de las del esquema `public` que `anon` y `authenticated`
  pueden ejecutar. Si alguien suma una función que cualquiera pueda llamar,
  la prueba falla y dice cómo actualizar la lista (mirando antes qué
  devuelve y qué escribe). También que ninguna función `security definer`
  tenga el `search_path` sin fijar, y que los disparadores no se llamen a mano.
- `76-observador.sql` — el rol `observer`: ve todo lo del equipo y no escribe
  nada (ni posteos, ni comentarios, ni la Agenda, ni el bucket), no lee la
  auditoría ni lo de administración, y sí guarda sus preferencias y cambia su
  @nickname.
- `77-sin-aprobar.sql` — alguien con sesión de Google que no está en el
  equipo (sin ficha, ex integrante, con un pedido pendiente): todo rebota
  salvo anotar su login y su pedido y leer su propia solicitud.
- `78-admin-rol-y-fijo.sql` — un admin por rol contra el admin fijo: quién
  borra comentarios, una ficha que se hace pasar por la del fijo con otras
  mayúsculas, y sus preferencias, que solo él borra.
- `88-tiempo-real.sql` — que las doce tablas estén habilitadas para mandar
  sus cambios en vivo (viene apagado de fábrica y es fácil no enterarse:
  todo anda, uno escribe algo, y a los demás no les aparece hasta recargar),
  y que las de los avisos, los resúmenes y Calendar NO lo estén.
- `89-adjuntos-huerfanos.sql` — qué archivos del bucket ya no nombra
  nadie: que una foto en uso, su miniatura y sus adjuntos NUNCA aparezcan
  como sobrantes, que lo recién subido espere, y que solo la llave de
  servicio pueda preguntarlo.
- `90-permisos.sql` — quién puede hacer qué: los seis roles, y también
  alguien que se cambió el correo de su cuenta por el de otra persona (el
  correo tiene que ser el que autenticó Google), que un login se anote
  una vez por día y sin texto libre, quién escribe un mensaje de sistema en
  un hilo, y quién lee, cambia y borra del bucket.
- `91-base-vacia.sql` — el estado del proyecto recién creado (permisos
  puestos, equipo vacío): que el admin fijo pueda arrancar y que nadie más
  pueda absolutamente nada.
- `92-validacion.sql` — qué forma tiene que tener lo que se escribe:
  largos, formatos, que una imagen sea una ruta del bucket y no un archivo
  embebido, cuánto puede pesar una fila entera, y la forma de la
  configuración del equipo (tipos de actividad, zonas, sincronización).
- `93-me-gusta.sql` — que el me gusta sea atómico y que el correo salga de
  la credencial y no de un parámetro.
- `94-hora-del-servidor.sql` — que la hora de una edición la ponga la base
  y no el reloj de quien edita, que lo que escribe el sincronizador nocturno
  no quede en 1970, y que sin una persona detrás (el editor SQL, una
  migración) se respete la fecha que venga.
- `95-guardar-por-partes.sql` — que guardar una preferencia no borre las
  otras, y que dos controles tocados rápido no se pisen.
- `96-sin-importacion.sql` — que la puerta por la que entraron los datos de
  Firebase quedó cerrada: que sus funciones ya no existan, y que prender a
  mano la marca que hacía a un lado los controles no saltee ninguno.
- `98-contenido-vacio.sql` — un evento de Calendar sin descripción entra
  con el contenido vacío, sin relleno.
- `99-adjuntos-grandes.sql` — el techo del bucket y los tipos de archivo
  que acepta.
- `datos-al-limite.sql` + `reaplicar-con-datos.sh` — carga filas al
  borde de lo que el esquema permite y lo vuelve a aplicar entero: la base
  de verdad no está vacía, y una restricción que se recrea más estricta
  que lo guardado se cae acá y no en Supabase. Lo corre GitHub después de
  las pruebas.
- `levantar.sh` — levanta el servidor local y reconstruye la base entera
  desde el laboratorio y todos los archivos del esquema, en orden.

Al final cada uno imprime cuáles fallaron, si falló alguna.
