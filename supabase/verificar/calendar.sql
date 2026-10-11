-- ============================================================
-- Cómo va lo que llegó de Google Calendar (SOLO LECTURA)
-- ============================================================
-- Cuenta, contra la base de verdad, cuánto de lo importado de Calendar sigue
-- como vino y cuánto ya está ordenado, con la misma definición que usa la
-- pantalla Administración › Revisar lo de Calendar (index.html: esImportado,
-- rvTocado, rvPendiente):
--   importado = autor «Google Calendar», sin correo, con id de evento
--   tocado    = alguien le puso un tipo, un lugar, personas o un «dónde fue»
--   pendiente = importado y no tocado
-- No imprime títulos, fechas ni nombres de personas (el repo y los registros
-- de Actions son públicos): solo cantidades. Una transacción de solo lectura
-- que termina en rollback.
--
-- Uso:  psql "$SUPABASE_DB_URL" -X -q -f supabase/verificar/calendar.sql
-- ============================================================
\set ON_ERROR_STOP on
begin;
\pset border 1
\pset null '-'

create temp view imp as
  select p.id, p.calendar_event_id as evento, p.activity_type, p.cancelled,
         (p.activity_type <> 'otro'
          or jsonb_array_length(p.scopes) > 0
          or jsonb_array_length(p.participants) > 0
          or coalesce(p.location, '') <> '') as tocado
    from public.posts p
   where p.author_name = 'Google Calendar'
     and coalesce(p.author_email, '') = ''
     and coalesce(p.calendar_event_id, '') <> '';

-- Desde acá, nada se escribe (la vista temporal ya está hecha).
set local transaction_read_only = on;

\echo
\echo '== Lo importado de Calendar, en total'
select count(*) as importados,
       count(*) filter (where tocado) as ya_ordenados,
       count(*) filter (where not tocado) as pendientes,
       (select count(*) from public.calendar_sacados) as sacados_del_registro,
       (select count(*) from public.calendar_sugerencias) as con_sugerencia
  from imp;

\echo
\echo '== Lo que sigue pendiente, por la pestaña de la pantalla y la confianza de la sugerencia'
select coalesce(s.grupo, 'sin sugerencia') as pestana,
       count(*) as pendientes,
       count(*) filter (where s.confianza = 'alta') as seguros,
       count(*) filter (where s.confianza = 'media') as mas_o_menos,
       count(*) filter (where s.confianza = 'baja') as dudosos,
       count(*) filter (where s.tipo is null) as sin_tipo_sugerido
  from imp i left join public.calendar_sugerencias s on s.evento = i.evento
 where not i.tocado
 group by 1
 order by 2 desc;

\echo
\echo '== Lo ya ordenado, por tipo'
select activity_type as tipo, count(*) as cuantos,
       count(*) filter (where cancelled) as cancelados
  from imp where tocado
 group by 1
 order by 2 desc;

\echo
\echo '== Lo ya ordenado: ¿coincide con lo que se había sugerido?'
select coalesce(s.grupo, 'sin sugerencia') as pestana_sugerida,
       count(*) as ordenados,
       count(*) filter (where s.tipo is not null and i.activity_type = s.tipo) as mismo_tipo_que_lo_sugerido,
       count(*) filter (where s.tipo is not null and i.activity_type <> s.tipo) as otro_tipo_que_lo_sugerido
  from imp i left join public.calendar_sugerencias s on s.evento = i.evento
 where i.tocado
 group by 1
 order by 2 desc;

\echo
\echo '== Lo ya ordenado: qué tipo le pusiste a cada pestaña sugerida'
select coalesce(s.grupo, 'sin sugerencia') as pestana_sugerida, i.activity_type as tipo_puesto, count(*) as cuantos
  from imp i left join public.calendar_sugerencias s on s.evento = i.evento
 where i.tocado
 group by 1, 2
 order by 1, 3 desc;

rollback;
