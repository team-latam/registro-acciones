-- ============================================================
-- Contactos por lugar (10/10/2026)
-- ============================================================
-- Hasta hoy un contacto de la Agenda era siempre «alguien en una
-- institución» (19-agenda.sql). El usuario mostró su planilla de
-- comunidades: hay gente que no va con una institución sino con una
-- ciudad (el presidente de la comunidad de Rosario), con un país (quien
-- cubre Brasil), con una región o con toda LatAm. Pidió poder cargarla.
--
-- Cada contacto tiene ahora un «dónde» (`nivel`):
--   institucion  como siempre: `institucion` apunta a una
--   ciudad       `country` y `city` (como los nombra la app)
--   pais         `country`
--   region       `zona`: sur, central o norte (las claves fijas de la
--                app; el nombre que se ve se renombra en Configuración)
--   latam        nada más
-- La restricción de abajo no deja nada a medias: a cada nivel le va
-- exactamente lo suyo. La institución deja de ser obligatoria, y la misma
-- persona no se repite en el mismo lugar (la ciudad, sin tildes ni
-- mayúsculas, como las compara la app). Permisos: los de `contactos`
-- (19-agenda.sql), sin cambios.

alter table public.contactos alter column institucion drop not null;
alter table public.contactos add column if not exists nivel text not null default 'institucion';
alter table public.contactos add column if not exists country text;
alter table public.contactos add column if not exists city text;
alter table public.contactos add column if not exists zona text;
alter table public.contactos drop constraint if exists contactos_lugar_ok;
alter table public.contactos add constraint contactos_lugar_ok check (
  nivel in ('institucion', 'ciudad', 'pais', 'region', 'latam')
  and (country is null or length(country) between 1 and 80)
  and (city is null or length(city) between 1 and 80)
  and (zona is null or zona in ('sur', 'central', 'norte'))
  and case nivel
    when 'institucion' then institucion is not null and country is null and city is null and zona is null
    when 'ciudad'      then institucion is null and country is not null and city is not null and zona is null
    when 'pais'        then institucion is null and country is not null and city is null and zona is null
    when 'region'      then institucion is null and country is null and city is null and zona is not null
    else                    institucion is null and country is null and city is null and zona is null
  end);
create unique index if not exists contactos_lugar_unico on public.contactos
  (persona, nivel, coalesce(country, ''), lower(public.sin_tildes(coalesce(city, ''))), coalesce(zona, ''))
  where institucion is null;

-- Sin espacios de más (lo demás lo hace agenda_controlar, en 19-agenda.sql).
create or replace function public.contactos_lugar_controlar() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.nivel := coalesce(nullif(btrim(coalesce(new.nivel, '')), ''), 'institucion');
  new.country := nullif(btrim(coalesce(new.country, '')), '');
  new.city := nullif(btrim(coalesce(new.city, '')), '');
  new.zona := nullif(btrim(coalesce(new.zona, '')), '');
  return new;
end $$;
drop trigger if exists contactos_lugar_controlar on public.contactos;
create trigger contactos_lugar_controlar before insert or update on public.contactos
  for each row execute function public.contactos_lugar_controlar();
