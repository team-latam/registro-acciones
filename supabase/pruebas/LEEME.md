# Las pruebas de los permisos

Esto no hay que correrlo en Supabase — es para comprobar, antes de tocar
nada tuyo, que `02-politicas.sql` hace lo que dice.

Levanta una base PostgreSQL local, le pone las 8 tablas y los permisos, y
después se hace pasar por seis personas distintas (el admin fijo, un admin
por rol, un integrante común, un observador, un ex integrante y alguien de
afuera) para comprobar 66 cosas: que cada uno puede lo que tiene que poder
y **que no puede lo que no**.

Los dos archivos:

- `00-laboratorio.sql` — imita lo mínimo de Supabase (sus roles y su
  `auth.jwt()`). En Supabase esto ya existe; acá hay que fabricarlo.
- `90-permisos.sql` — los datos de prueba y las 66 comprobaciones.

Se corren en ese orden, con `01-tablas.sql` y `02-politicas.sql` en el
medio. Al final imprime cuáles fallaron, si falló alguna.
