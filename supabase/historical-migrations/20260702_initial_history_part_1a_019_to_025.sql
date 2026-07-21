-- HISTORICAL COPY ONLY.
-- Source: supabase_migrations.schema_migrations.
-- Already applied to the operational project; do not execute blindly.

-- BEGIN MIGRATION 20260702194346_019_grant_public_view_dependencies.sql
-- =========================================================
-- 019_grant_public_view_dependencies.sql
-- Grants necesarios para que las vistas public_* con
-- security_invoker puedan ser leidas por anon/authenticated
-- a traves del Data API, respetando RLS.
-- =========================================================

grant usage on schema public to anon, authenticated;

-- Tablas base usadas por las vistas public_*.
-- RLS sigue controlando que filas puede ver cada rol.
grant select on table public.entity_types to anon, authenticated;
grant select on table public.ecclesiastical_entities to anon, authenticated;
grant select on table public.entity_relationships to anon, authenticated;

grant select on table public.persons to anon, authenticated;
grant select on table public.clergy_profiles to anon, authenticated;
grant select on table public.offices to anon, authenticated;
grant select on table public.appointments to anon, authenticated;

grant select on table public.pastoral_areas to anon, authenticated;
grant select on table public.pastoral_entities to anon, authenticated;
grant select on table public.pastoral_assignments to anon, authenticated;

grant select on table public.event_types to anon, authenticated;
grant select on table public.event_occurrences to anon, authenticated;
grant select on table public.commemorative_events to anon, authenticated;

-- Vistas publicas y administrativas ya creadas.
grant select on public.public_ecclesiastical_entities to anon, authenticated;
grant select on public.public_dioceses to anon, authenticated;
grant select on public.public_entity_relationships_current to anon, authenticated;
grant select on public.public_parishes to anon, authenticated;
grant select on public.public_chapels to anon, authenticated;
grant select on public.public_people to anon, authenticated;
grant select on public.public_clergy to anon, authenticated;
grant select on public.public_current_appointments to anon, authenticated;
grant select on public.public_pastoral_areas to anon, authenticated;
grant select on public.public_pastoral_entities to anon, authenticated;
grant select on public.public_pastoral_assignments to anon, authenticated;
grant select on public.public_calendar_events to anon, authenticated;

grant select on public.admin_pending_change_requests to authenticated;
grant select on public.admin_dashboard_summary to authenticated;

notify pgrst, 'reload schema';
;
-- END MIGRATION 20260702194346_019_grant_public_view_dependencies.sql

-- BEGIN MIGRATION 20260702194703_020_grant_admin_identity_reads.sql
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select on public.user_role_assignments to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.admin_dashboard_summary to authenticated;
grant select on public.admin_pending_change_requests to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702194703_020_grant_admin_identity_reads.sql

-- BEGIN MIGRATION 20260702200922_021_enrich_rd_diocese_information_v2.sql
alter table public.ecclesiastical_entities
  add column if not exists latin_name text,
  add column if not exists cathedral_name text,
  add column if not exists current_ordinary_name text,
  add column if not exists current_ordinary_title text,
  add column if not exists territory_summary text,
  add column if not exists area_km2 numeric,
  add column if not exists statistics_year integer,
  add column if not exists population_total integer,
  add column if not exists catholics_total integer,
  add column if not exists catholics_percent numeric,
  add column if not exists parishes_count integer,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_checked_at date;

with source_data as (
  select * from (values
    ('arquidiocesis-metropolitana-de-santo-domingo','Archidioecesis Sancti Dominici','Catedral Basílica Metropolitana Santa María de la Encarnación','Francisco Ozoria Acosta','Arzobispo metropolitano','Distrito Nacional, Monte Plata, Santo Domingo Norte, Santo Domingo Oeste, Los Alcarrizos y Pedro Brand. Sede primada de América.',3406::numeric,2025,2906306,2539412,87.4::numeric,156,'Catholic-Hierarchy / Boletín Santa Sede 2025','https://www.catholic-hierarchy.org/diocese/dsndo.html','2026-07-02'::date,'Arquidiócesis metropolitana de Santo Domingo; sede primada de América y provincia eclesiástica de Santo Domingo.'),
    ('arquidiocesis-metropolitana-de-santiago-de-los-caballeros','Archidioecesis Sancti Iacobi Equitum','Catedral de Santiago Apóstol','Héctor Rafael Rodríguez Rodríguez','Arzobispo metropolitano','Provincia de Santiago, parte de Espaillat y sección Arroyo del Toro de Puerto Plata.',3633::numeric,2022,1343000,1124000,83.7::numeric,108,'Catholic-Hierarchy / Anuario Pontificio 2023','https://www.catholic-hierarchy.org/diocese/dsnca.html','2026-07-02'::date,'Arquidiócesis metropolitana de Santiago de los Caballeros; cabecera de la provincia eclesiástica de Santiago de los Caballeros.'),
    ('diocesis-de-bani','Dioecesis Baniensis','Catedral Nuestra Señora de Regla','Faustino Burgos Brisman','Obispo','Provincias Peravia, San Cristóbal y San José de Ocoa, subregión de Valdesia.',2892::numeric,2022,901130,797280,88.5::numeric,30,'Catholic-Hierarchy / Anuario Pontificio 2023','https://www.catholic-hierarchy.org/diocese/dbani.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo con sede en Baní.'),
    ('diocesis-de-barahona','Dioecesis Barahonensis','Catedral Nuestra Señora del Rosario','Sede vacante','Sede vacante','Provincias Barahona, Bahoruco, Independencia y Pedernales.',6975::numeric,2022,460000,249000,54.1::numeric,24,'Catholic-Hierarchy / Anuario Pontificio 2023','https://www.catholic-hierarchy.org/diocese/dbara.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo con sede en Barahona.'),
    ('diocesis-de-la-vega','Dioecesis Vegensis','Catedral de la Inmaculada Concepción','Andrés Napoleón Romero Cárdenas','Obispo','Provincias La Vega, Monseñor Nouel, Hermanas Mirabal y Sánchez Ramírez.',4919::numeric,2023,850000,838000,98.6::numeric,60,'Catholic-Hierarchy / Anuario Pontificio 2024','https://www.catholic-hierarchy.org/diocese/dlave.html','2026-07-02'::date,'Diócesis sufragánea de Santiago de los Caballeros con sede en La Vega.'),
    ('diocesis-de-mao-monte-cristi','Dioecesis Maoensis-Montis Christi','Catedral de la Santa Cruz','Diómedes Antonio Espinal de León','Obispo','Provincias Valverde, Dajabón, Montecristi y Santiago Rodríguez.',4841::numeric,2021,688000,454000,66.0::numeric,33,'Catholic-Hierarchy / Anuario Pontificio 2022','https://www.catholic-hierarchy.org/diocese/dmamo.html','2026-07-02'::date,'Diócesis sufragánea de Santiago de los Caballeros con sede en Mao.'),
    ('diocesis-de-puerto-plata','Dioecesis Portus Argentarii','Catedral de San Felipe Apóstol','Julio César Corniel Amaro','Obispo','Provincia de Puerto Plata, con excepciones territoriales indicadas por la jurisdicción eclesiástica.',2383::numeric,2021,524000,429680,82.0::numeric,32,'Catholic-Hierarchy / Anuario Pontificio 2022','https://www.catholic-hierarchy.org/diocese/dpupl.html','2026-07-02'::date,'Diócesis sufragánea de Santiago de los Caballeros con sede en Puerto Plata.'),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','Dioecesis Higueyensis','Basílica Catedral Nuestra Señora de la Altagracia','Jesús Castro Marte','Obispo','Provincias El Seibo, La Altagracia y La Romana.',5451::numeric,2023,623500,517100,82.9::numeric,36,'Catholic-Hierarchy / Anuario Pontificio 2024','https://www.catholic-hierarchy.org/diocese/dhigu.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo con sede en Higüey.'),
    ('diocesis-de-san-francisco-de-macoris','Dioecesis Sancti Francisci de Macoris','Catedral de Santa Ana','Ramón Alfredo de la Cruz Baldera','Obispo','Provincias Duarte, María Trinidad Sánchez y Samaná.',4124::numeric,2022,774248,646620,83.5::numeric,48,'Catholic-Hierarchy / Anuario Pontificio 2023','https://www.catholic-hierarchy.org/diocese/dsfma.html','2026-07-02'::date,'Diócesis sufragánea de Santiago de los Caballeros con sede en San Francisco de Macorís.'),
    ('diocesis-de-san-juan-de-la-maguana','Dioecesis Sancti Ioannis Maguanensis','Catedral de San Juan Bautista','Tomás Alejo Concepción','Obispo','Provincias Azua, Elías Piña y San Juan.',7475::numeric,2023,532400,528300,99.2::numeric,39,'Catholic-Hierarchy / Anuario Pontificio 2024','https://www.catholic-hierarchy.org/diocese/dsjma.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo con sede en San Juan de la Maguana.'),
    ('diocesis-de-san-pedro-de-macoris','Dioecesis Sancti Petri de Macoris','Catedral San Pedro Apóstol','Santiago Rodríguez Rodríguez','Obispo','Provincias Hato Mayor y San Pedro de Macorís.',2588::numeric,2022,700000,607000,86.7::numeric,28,'Catholic-Hierarchy / Anuario Pontificio 2023','https://www.catholic-hierarchy.org/diocese/dspma.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo con sede en San Pedro de Macorís.'),
    ('diocesis-de-stella-maris','Dioecesis Stella Maris','Catedral Stella Maris','Manuel Antonio Ruíz de la Rosa','Obispo','Municipios Santo Domingo Este, San Antonio de Guerra y Boca Chica.',588.87::numeric,2025,1291516,943762,73.1::numeric,64,'Catholic-Hierarchy / Boletín Santa Sede 2025','https://www.catholic-hierarchy.org/diocese/dstel.html','2026-07-02'::date,'Diócesis sufragánea de Santo Domingo, erigida el 27 de agosto de 2025.'),
    ('obispado-castrense-de-republica-dominicana','Militaris Reipublicae Dominicianae','Catedral Castrense Santa Bárbara de los Hombres de la Mar','Francisco Ozoria Acosta','Obispo castrense','Jurisdicción personal para fieles católicos vinculados a las Fuerzas Armadas dominicanas y sus familias.',null::numeric,2014,null::integer,null::integer,null::numeric,47,'Catholic-Hierarchy / GCatholic','https://www.catholic-hierarchy.org/diocese/dmldo.html','2026-07-02'::date,'Obispado castrense de República Dominicana; jurisdicción personal inmediatamente sujeta a la Santa Sede.')
  ) as v(slug, latin_name, cathedral_name, current_ordinary_name, current_ordinary_title, territory_summary, area_km2, statistics_year, population_total, catholics_total, catholics_percent, parishes_count, source_name, source_url, source_checked_at, description)
)
update public.ecclesiastical_entities e
set latin_name = s.latin_name,
    cathedral_name = s.cathedral_name,
    current_ordinary_name = s.current_ordinary_name,
    current_ordinary_title = s.current_ordinary_title,
    territory_summary = s.territory_summary,
    area_km2 = s.area_km2,
    statistics_year = s.statistics_year,
    population_total = s.population_total,
    catholics_total = s.catholics_total,
    catholics_percent = s.catholics_percent,
    parishes_count = s.parishes_count,
    source_name = s.source_name,
    source_url = s.source_url,
    source_checked_at = s.source_checked_at,
    description = s.description,
    updated_at = now()
from source_data s
where e.slug = s.slug;

drop view if exists public.public_dioceses;

create view public.public_dioceses
with (security_invoker = true)
as
select
  ee.id,
  et.key as entity_type_key,
  et.name as entity_type_name,
  ee.name,
  ee.official_name,
  ee.slug,
  ee.description,
  ee.latin_name,
  ee.cathedral_name,
  ee.current_ordinary_name,
  ee.current_ordinary_title,
  ee.territory_summary,
  ee.area_km2,
  ee.statistics_year,
  ee.population_total,
  ee.catholics_total,
  ee.catholics_percent,
  ee.parishes_count,
  ee.source_name,
  ee.source_url,
  ee.source_checked_at,
  ee.country,
  ee.province,
  ee.municipality,
  ee.address,
  ee.email,
  ee.phone,
  ee.website,
  ee.facebook_url,
  ee.instagram_url,
  ee.youtube_url,
  ee.erected_at,
  parent.name as ecclesiastical_province_name,
  parent.slug as ecclesiastical_province_slug,
  er.relationship_type,
  ee.created_at,
  ee.updated_at
from public.ecclesiastical_entities ee
join public.entity_types et on et.id = ee.entity_type_id
left join public.entity_relationships er
  on er.child_entity_id = ee.id
 and er.is_current = true
 and er.status = 'active'
left join public.ecclesiastical_entities parent
  on parent.id = er.parent_entity_id
left join public.entity_types parent_type
  on parent_type.id = parent.entity_type_id
where et.key = any(array['archdiocese','diocese','military_ordinariate'])
  and ee.visibility = 'public'
  and ee.status = 'active'
  and (parent.id is null or parent_type.key = any(array['ecclesiastical_province','country']));

grant select on public.public_dioceses to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702200922_021_enrich_rd_diocese_information_v2.sql

-- BEGIN MIGRATION 20260702202113_022_grant_change_request_admin_reads.sql
grant select on public.change_requests to authenticated;
grant select on public.approval_flows to authenticated;
grant select on public.approval_steps to authenticated;
grant select on public.approval_actions to authenticated;
grant select on public.admin_pending_change_requests to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702202113_022_grant_change_request_admin_reads.sql

-- BEGIN MIGRATION 20260702202302_023_public_person_movements_view.sql
create or replace view public.public_person_movements
with (security_invoker = true)
as
select
  m.id,
  m.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  m.entity_id,
  ee.name as entity_name,
  ee.slug as entity_slug,
  m.pastoral_entity_id,
  pe.name as pastoral_entity_name,
  pe.slug as pastoral_entity_slug,
  m.movement_type,
  m.title,
  m.description,
  m.effective_date,
  m.end_date,
  m.status,
  m.visibility,
  m.created_at,
  m.updated_at
from public.movements m
join public.persons p on p.id = m.person_id
left join public.ecclesiastical_entities ee on ee.id = m.entity_id
left join public.pastoral_entities pe on pe.id = m.pastoral_entity_id
where m.status = 'active'
  and m.visibility = 'public'
  and p.status = 'active'
  and p.visibility = 'public';

grant select on public.movements to anon, authenticated;
grant select on public.public_person_movements to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702202302_023_public_person_movements_view.sql

-- BEGIN MIGRATION 20260702203222_024_episcopal_succession_core.sql
create table if not exists public.episcopal_ordinations (
  id uuid primary key default gen_random_uuid(),
  bishop_person_id uuid not null references public.persons(id),
  ordination_date date,
  ordination_place text,
  principal_consecrator_person_id uuid references public.persons(id),
  co_consecrator_1_person_id uuid references public.persons(id),
  co_consecrator_2_person_id uuid references public.persons(id),
  principal_consecrator_name text,
  co_consecrator_1_name text,
  co_consecrator_2_name text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review',
  visibility text not null default 'public',
  status text not null default 'active',
  notes_public text,
  notes_internal text,
  created_by uuid references public.profiles(id),
  approved_change_request_id uuid references public.change_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint episcopal_ordinations_unique_bishop unique (bishop_person_id)
);

create index if not exists idx_episcopal_ordinations_bishop on public.episcopal_ordinations(bishop_person_id);
create index if not exists idx_episcopal_ordinations_principal on public.episcopal_ordinations(principal_consecrator_person_id);
create index if not exists idx_episcopal_ordinations_date on public.episcopal_ordinations(ordination_date);

drop trigger if exists trg_episcopal_ordinations_updated_at on public.episcopal_ordinations;
create trigger trg_episcopal_ordinations_updated_at
before update on public.episcopal_ordinations
for each row execute function public.set_updated_at();

alter table public.episcopal_ordinations enable row level security;

drop policy if exists episcopal_ordinations_public_read on public.episcopal_ordinations;
create policy episcopal_ordinations_public_read
on public.episcopal_ordinations
for select
to anon, authenticated
using (status = 'active' and visibility = 'public');

drop policy if exists episcopal_ordinations_admin_all on public.episcopal_ordinations;
create policy episcopal_ordinations_admin_all
on public.episcopal_ordinations
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant select on public.episcopal_ordinations to anon, authenticated;
grant insert, update on public.episcopal_ordinations to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702203222_024_episcopal_succession_core.sql

-- BEGIN MIGRATION 20260702203232_025_public_episcopal_succession_view.sql
drop view if exists public.public_episcopal_ordinations;
create view public.public_episcopal_ordinations
with (security_invoker = true)
as
select
  eo.id,
  eo.bishop_person_id,
  bishop.display_name as bishop_name,
  bishop.slug as bishop_slug,
  eo.ordination_date,
  eo.ordination_place,
  eo.principal_consecrator_person_id,
  principal.display_name as principal_consecrator_person_name,
  principal.slug as principal_consecrator_person_slug,
  eo.principal_consecrator_name,
  eo.co_consecrator_1_person_id,
  co1.display_name as co_consecrator_1_person_name,
  co1.slug as co_consecrator_1_person_slug,
  eo.co_consecrator_1_name,
  eo.co_consecrator_2_person_id,
  co2.display_name as co_consecrator_2_person_name,
  co2.slug as co_consecrator_2_person_slug,
  eo.co_consecrator_2_name,
  eo.source_name,
  eo.source_url,
  eo.source_checked_at,
  eo.verification_status,
  eo.notes_public,
  eo.created_at,
  eo.updated_at
from public.episcopal_ordinations eo
join public.persons bishop on bishop.id = eo.bishop_person_id
left join public.persons principal on principal.id = eo.principal_consecrator_person_id
left join public.persons co1 on co1.id = eo.co_consecrator_1_person_id
left join public.persons co2 on co2.id = eo.co_consecrator_2_person_id
where eo.status = 'active'
  and eo.visibility = 'public'
  and bishop.status = 'active'
  and bishop.visibility = 'public';

grant select on public.public_episcopal_ordinations to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702203232_025_public_episcopal_succession_view.sql
