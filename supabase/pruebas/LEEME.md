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
- `90-permisos.sql` — quién puede hacer qué: 66 comprobaciones.
- `91-base-vacia.sql` — el estado del proyecto recién creado (permisos
  puestos, equipo vacío): que el admin fijo pueda arrancar y que nadie más
  pueda absolutamente nada.
- `92-validacion.sql` — qué forma tiene que tener lo que se escribe: 30
  comprobaciones (largos, formatos, que una imagen sea una ruta del bucket
  y no un archivo embebido, que la hora la ponga el servidor pero la
  importación conserve la fecha real).
- `93-me-gusta.sql` — que el me gusta sea atómico y que el correo salga de
  la credencial y no de un parámetro: 12 comprobaciones.
- `94-hora-del-servidor.sql` — que la hora de una edición la ponga la base
  y no el reloj de quien edita, pero que la importación conserve las fechas
  reales de Firebase.
- `95-guardar-por-partes.sql` — que guardar una preferencia no borre las
  otras, y que dos controles tocados rápido no se pisen.
- `97-de-punta-a-punta.sql` — lo que produce el importador con un respaldo
  de forma real, metido en una base Postgres de verdad con los permisos
  puestos: que las fechas viejas se conserven, que los adjuntos queden como
  rutas del bucket, y que correrlo de nuevo no duplique nada.
- `levantar.sh` — levanta el servidor local y reconstruye la base entera
  desde los archivos del paso 1 al 4, en orden.

Al final cada uno imprime cuáles fallaron, si falló alguna.
