# Las pruebas de los permisos

Esto no hay que correrlo en Supabase — es para comprobar, antes de tocar
nada tuyo, que `02-politicas.sql` hace lo que dice.

Levanta una base PostgreSQL local, le pone las 8 tablas y los permisos, y
después se hace pasar por seis personas distintas (el admin fijo, un admin
por rol, un integrante común, un observador, un ex integrante y alguien de
afuera) para comprobar 66 cosas: que cada uno puede lo que tiene que poder
y **que no puede lo que no**.

Los archivos:

- `00-laboratorio.sql` — imita lo mínimo de Supabase (sus roles y su
  `auth.jwt()`). En Supabase esto ya existe; acá hay que fabricarlo.
- `90-permisos.sql` — quién puede hacer qué: los seis roles, y también
  alguien que se cambió el correo de su cuenta por el de otra persona (el
  correo tiene que ser el que autenticó Google), quién ve cuántas filas
  hay, y que un login se anote una vez por día.
- `91-base-vacia.sql` — el estado del proyecto recién creado (permisos
  puestos, equipo vacío): que el admin fijo pueda arrancar y que nadie más
  pueda absolutamente nada.
- `92-validacion.sql` — qué forma tiene que tener lo que se escribe:
  largos, formatos, que una imagen sea una ruta del bucket y no un archivo
  embebido, cuánto puede pesar una fila entera, y la forma de la
  configuración del equipo (tipos de actividad, zonas, sincronización).
- `93-me-gusta.sql` — que el me gusta sea atómico y que el correo salga de
  la credencial y no de un parámetro: 12 comprobaciones.
- `94-hora-del-servidor.sql` — que la hora de una edición la ponga la base
  y no el reloj de quien edita, que lo que escribe el sincronizador nocturno
  no quede en 1970, y que la importación conserve las fechas reales de
  Firebase.
- `95-guardar-por-partes.sql` — que guardar una preferencia no borre las
  otras, y que dos controles tocados rápido no se pisen.
- `97-de-punta-a-punta.sql` — lo que produce el importador con un respaldo
  de forma real, metido en una base Postgres de verdad con los permisos
  puestos: que las fechas viejas se conserven, que los adjuntos queden como
  rutas del bucket, y que correrlo de nuevo no duplique nada.
- `98-tiempo-real.sql` — que las ocho tablas estén habilitadas para mandar
  sus cambios en vivo. Viene apagado de fábrica y es fácil no enterarse:
  todo anda, uno escribe algo, y a los demás no les aparece hasta recargar.
- `datos-al-limite.sql` + `reaplicar-con-datos.sh` — carga filas al
  borde de lo que el esquema permite y lo vuelve a aplicar entero: la base
  de verdad no está vacía, y una restricción que se recrea más estricta
  que lo guardado se cae acá y no en Supabase. Lo corre GitHub después de
  las pruebas.
- `levantar.sh` — levanta el servidor local y reconstruye la base entera
  desde el laboratorio y todos los archivos del esquema, en orden.

Al final cada uno imprime cuáles fallaron, si falló alguna.
