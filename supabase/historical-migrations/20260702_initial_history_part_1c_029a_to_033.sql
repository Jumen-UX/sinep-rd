-- HISTORICAL COPY ONLY.
-- Source: supabase_migrations.schema_migrations.
-- Already applied to the operational project; do not execute blindly.

-- BEGIN MIGRATION 20260702210104_029a_sf_people_min_v2.sql
insert into public.persons (slug, display_name, first_name, last_name, person_type, gender, status, visibility)
values
  ('nicolas-de-jesus-lopez-rodriguez','Nicolás de Jesús López Rodríguez','Nicolás','López Rodríguez','bishop','male','active','public'),
  ('jesus-maria-de-jesus-moya','Jesús María de Jesús Moya','Jesús','de Jesús Moya','bishop','male','active','public'),
  ('fausto-ramon-mejia-vallejo','Fausto Ramón Mejía Vallejo','Fausto','Mejía Vallejo','bishop','male','active','public'),
  ('ramon-alfredo-de-la-cruz-baldera','Ramón Alfredo de la Cruz Baldera','Ramón','de la Cruz Baldera','bishop','male','active','public')
on conflict (slug) do update set display_name = excluded.display_name, first_name = excluded.first_name, last_name = excluded.last_name, person_type = excluded.person_type, visibility = excluded.visibility, updated_at = now();
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210104_029a_sf_people_min_v2.sql

-- BEGIN MIGRATION 20260702210115_029b_sf_clergy_dates.sql
insert into public.clergy_profiles (person_id, priestly_ordination_date, canonical_status)
select p.id, v.priestly_date, 'active'
from (values
  ('ramon-alfredo-de-la-cruz-baldera','1991-01-12'::date)
) as v(slug, priestly_date)
join public.persons p on p.slug = v.slug
where not exists (select 1 from public.clergy_profiles cp where cp.person_id = p.id);

update public.clergy_profiles cp
set priestly_ordination_date = coalesce(cp.priestly_ordination_date, v.priestly_date), updated_at = now()
from (values
  ('ramon-alfredo-de-la-cruz-baldera','1991-01-12'::date)
) as v(slug, priestly_date)
join public.persons p on p.slug = v.slug
where cp.person_id = p.id;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210115_029b_sf_clergy_dates.sql

-- BEGIN MIGRATION 20260702210128_029c_sf_appointments.sql
with x as (
  select * from (values
    ('nicolas-de-jesus-lopez-rodriguez','diocesan_bishop','1978-01-16'::date,'1981-11-15'::date,false),
    ('jesus-maria-de-jesus-moya','diocesan_bishop','1984-04-20'::date,'2012-05-31'::date,false),
    ('fausto-ramon-mejia-vallejo','diocesan_bishop','2012-05-31'::date,'2021-05-15'::date,false),
    ('jesus-maria-de-jesus-moya','bishop_emeritus','2012-05-31'::date,null::date,true),
    ('fausto-ramon-mejia-vallejo','bishop_emeritus','2021-05-15'::date,null::date,true)
  ) as v(person_slug, office_key, start_date, end_date, is_current)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, end_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, x.start_date, x.end_date, x.is_current, 'canonical', 'active', 'public'
from x
join public.persons p on p.slug = x.person_slug
join public.ecclesiastical_entities e on e.slug = 'diocesis-de-san-francisco-de-macoris'
join public.offices o on o.key = x.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id=p.id and a.entity_id=e.id and a.office_id=o.id and a.start_date=x.start_date
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210128_029c_sf_appointments.sql

-- BEGIN MIGRATION 20260702210252_029d_sf_current.sql
with ref as (
  select p.id as person_id, e.id as entity_id, o.id as office_id
  from public.persons p, public.ecclesiastical_entities e, public.offices o
  where p.slug='ramon-alfredo-de-la-cruz-baldera'
    and e.slug='diocesis-de-san-francisco-de-macoris'
    and o.key='diocesan_bishop'
)
insert into public.appointments (person_id, entity_id, office_id, start_date, is_current, appointment_type, status, visibility)
select person_id, entity_id, office_id, '2021-05-15'::date, true, 'canonical', 'active', 'public'
from ref
where not exists (
  select 1 from public.appointments a
  where a.person_id=ref.person_id and a.entity_id=ref.entity_id and a.office_id=ref.office_id and a.is_current=true
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210252_029d_sf_current.sql

-- BEGIN MIGRATION 20260702210301_029e_sf_entity_update.sql
update public.ecclesiastical_entities
set latin_name='Dioecesis Sancti Francisci de Macoris',
    phone='(809)588-2121; 588-8484',
    area_km2=4124,
    statistics_year=2023,
    catholics_total=588686,
    population_total=784413,
    catholics_percent=75.0,
    parishes_count=48,
    current_ordinary_name='Ramón Alfredo de la Cruz Baldera',
    current_ordinary_title='Obispo',
    source_name='Catholic-Hierarchy PDF de San Francisco de Macorís',
    source_checked_at='2026-07-02'::date,
    updated_at=now()
where slug='diocesis-de-san-francisco-de-macoris';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210301_029e_sf_entity_update.sql

-- BEGIN MIGRATION 20260702210329_030a_puerto_plata_appointments.sql
with x as (
  select * from (values
    ('gregorio-nicanor-pena-rodriguez','diocesan_bishop','1996-12-16'::date,'2004-06-24'::date,false),
    ('julio-cesar-corniel-amaro','diocesan_bishop','2005-05-31'::date,null::date,true)
  ) as v(person_slug, office_key, start_date, end_date, is_current)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, end_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, x.start_date, x.end_date, x.is_current, 'canonical', 'active', 'public'
from x
join public.persons p on p.slug = x.person_slug
join public.ecclesiastical_entities e on e.slug = 'diocesis-de-puerto-plata'
join public.offices o on o.key = x.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id=p.id and a.entity_id=e.id and a.office_id=o.id
    and (a.start_date=x.start_date or (x.is_current and a.is_current))
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210329_030a_puerto_plata_appointments.sql

-- BEGIN MIGRATION 20260702210354_030b_puerto_plata_entity_v2.sql
update public.ecclesiastical_entities
set latin_name='Dioecesis Portus Argentarii',
    phone='(809)586-2484; 970-0177',
    area_km2=2383,
    statistics_year=2023,
    catholics_total=436500,
    population_total=532200,
    catholics_percent=82.0,
    parishes_count=34,
    current_ordinary_name='Julio César Corniel Amaro',
    current_ordinary_title='Obispo',
    source_name='Catholic-Hierarchy PDF de Puerto Plata',
    source_checked_at='2026-07-02'::date,
    updated_at=now()
where slug='diocesis-de-puerto-plata';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210354_030b_puerto_plata_entity_v2.sql

-- BEGIN MIGRATION 20260702210406_031a_mao_people_and_appointments.sql
insert into public.persons (slug, display_name, first_name, last_name, person_type, gender, status, visibility)
values ('jeronimo-tomas-abreu-herrera','Jerónimo Tomás Abreu Herrera','Jerónimo','Abreu Herrera','bishop','male','active','public')
on conflict (slug) do update set display_name=excluded.display_name, first_name=excluded.first_name, last_name=excluded.last_name, person_type=excluded.person_type, visibility=excluded.visibility, updated_at=now();

with x as (
  select * from (values
    ('jeronimo-tomas-abreu-herrera','diocesan_bishop','1978-01-16'::date,'2006-05-24'::date,false),
    ('diomedes-antonio-espinal-de-leon','diocesan_bishop','2006-05-24'::date,null::date,true)
  ) as v(person_slug, office_key, start_date, end_date, is_current)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, end_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, x.start_date, x.end_date, x.is_current, 'canonical', 'active', 'public'
from x
join public.persons p on p.slug = x.person_slug
join public.ecclesiastical_entities e on e.slug = 'diocesis-de-mao-monte-cristi'
join public.offices o on o.key = x.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id=p.id and a.entity_id=e.id and a.office_id=o.id
    and (a.start_date=x.start_date or (x.is_current and a.is_current))
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210406_031a_mao_people_and_appointments.sql

-- BEGIN MIGRATION 20260702210415_031b_mao_entity.sql
update public.ecclesiastical_entities
set latin_name='Dioecesis Maoensis-Montis Christi',
    website='http://www.diocesismaomontecristi.org/',
    phone='(809)572-5022',
    area_km2=4841,
    statistics_year=2023,
    catholics_total=450000,
    population_total=691000,
    catholics_percent=65.1,
    parishes_count=33,
    current_ordinary_name='Diómedes Espinal de León',
    current_ordinary_title='Obispo',
    source_name='Catholic-Hierarchy PDF de Mao-Monte Cristi',
    source_checked_at='2026-07-02'::date,
    updated_at=now()
where slug='diocesis-de-mao-monte-cristi';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210415_031b_mao_entity.sql

-- BEGIN MIGRATION 20260702210425_032a_la_vega_people.sql
insert into public.persons (slug, display_name, first_name, last_name, person_type, gender, status, visibility)
values
  ('francisco-panal-ramirez','Francisco Panal Ramírez','Francisco','Panal Ramírez','bishop','male','active','public'),
  ('gabriel-antonio-camilo-gonzalez','Gabriel Antonio Camilo González','Gabriel','Camilo González','bishop','male','active','public')
on conflict (slug) do update set display_name=excluded.display_name, first_name=excluded.first_name, last_name=excluded.last_name, person_type=excluded.person_type, visibility=excluded.visibility, updated_at=now();
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210425_032a_la_vega_people.sql

-- BEGIN MIGRATION 20260702210434_032b_la_vega_appointments_past.sql
with x as (
  select * from (values
    ('francisco-panal-ramirez','diocesan_bishop','1956-07-22'::date,'1965-12-20'::date,false),
    ('juan-antonio-flores-santana','diocesan_bishop','1966-04-24'::date,'1992-07-13'::date,false),
    ('gabriel-antonio-camilo-gonzalez','diocesan_bishop','1992-10-10'::date,'2015-02-23'::date,false),
    ('hector-rafael-rodriguez-rodriguez','diocesan_bishop','2015-02-23'::date,'2023-10-07'::date,false),
    ('carlos-tomas-morel-diplan','diocesan_bishop','2024-10-18'::date,'2025-10-18'::date,false),
    ('gabriel-antonio-camilo-gonzalez','bishop_emeritus','2015-02-23'::date,null::date,true)
  ) as v(person_slug, office_key, start_date, end_date, is_current)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, end_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, x.start_date, x.end_date, x.is_current, 'canonical', 'active', 'public'
from x
join public.persons p on p.slug = x.person_slug
join public.ecclesiastical_entities e on e.slug = 'diocesis-de-la-vega'
join public.offices o on o.key = x.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id=p.id and a.entity_id=e.id and a.office_id=o.id and a.start_date=x.start_date
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210434_032b_la_vega_appointments_past.sql

-- BEGIN MIGRATION 20260702210448_032c_la_vega_current.sql
with x as (
  select * from (values
    ('jose-amable-duran-tineo','apostolic_administrator','2025-11-10'::date,true),
    ('andres-napoleon-romero-cardenas','diocesan_bishop','2026-06-12'::date,true)
  ) as v(person_slug, office_key, start_date, is_current)
)
insert into public.appointments (person_id, entity_id, office_id, start_date, is_current, appointment_type, status, visibility)
select p.id, e.id, o.id, x.start_date, x.is_current, 'canonical', 'active', 'public'
from x
join public.persons p on p.slug = x.person_slug
join public.ecclesiastical_entities e on e.slug = 'diocesis-de-la-vega'
join public.offices o on o.key = x.office_key
where not exists (
  select 1 from public.appointments a
  where a.person_id=p.id and a.entity_id=e.id and a.office_id=o.id and a.is_current=true
);
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210448_032c_la_vega_current.sql

-- BEGIN MIGRATION 20260702210503_032d_la_vega_entity.sql
update public.ecclesiastical_entities
set latin_name='Dioecesis Vegensis',
    phone='(809)573-2201',
    area_km2=4919,
    statistics_year=2023,
    catholics_total=838000,
    population_total=850000,
    catholics_percent=98.6,
    parishes_count=60,
    current_ordinary_name='Andrés Napoleón Romero Cárdenas; José Amable Durán Tineo',
    current_ordinary_title='Obispo; Administrador apostólico',
    source_name='Catholic-Hierarchy PDF de La Vega',
    source_checked_at='2026-07-02'::date,
    updated_at=now()
where slug='diocesis-de-la-vega';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702210503_032d_la_vega_entity.sql

-- BEGIN MIGRATION 20260702212717_033_add_age_text_and_refine_clergy_dates.sql
alter table public.persons
add column if not exists age_text text;

with age_data as (
  select * from (values
    ('hector-rafael-rodriguez-rodriguez','65.46'),
    ('andres-amauri-rosario-henriquez','49.77'),
    ('freddy-antonio-de-jesus-breton-martinez','78.71'),
    ('ramon-benito-de-la-rosa-y-carpio','86.78'),
    ('valentin-reynoso-hidalgo','83.54'),
    ('ramon-alfredo-de-la-cruz-baldera','64.99'),
    ('jesus-maria-de-jesus-moya','91.59'),
    ('fausto-ramon-mejia-vallejo','84.54'),
    ('julio-cesar-corniel-amaro','67.76'),
    ('diomedes-antonio-espinal-de-leon','76.85'),
    ('andres-napoleon-romero-cardenas','58.93'),
    ('jose-amable-duran-tineo','54.88'),
    ('gabriel-antonio-camilo-gonzalez','88.40')
  ) as v(slug, age_text)
)
update public.persons p
set age_text = age_data.age_text,
    updated_at = now()
from age_data
where p.slug = age_data.slug;

insert into public.clergy_profiles (person_id, priestly_ordination_date, episcopal_ordination_date, canonical_status)
select p.id, v.priestly_date, v.episcopal_date, 'active'
from (values
  ('freddy-antonio-de-jesus-breton-martinez','1977-09-10'::date,'2015-02-23'::date),
  ('jesus-maria-de-jesus-moya','1961-03-18'::date,'1977-04-13'::date),
  ('jose-amable-duran-tineo','2000-01-06'::date,'2020-06-20'::date),
  ('diomedes-antonio-espinal-de-leon','1978-07-22'::date,'2000-04-20'::date),
  ('jose-dolores-grullon-estrella','1970-12-13'::date,'1991-02-20'::date),
  ('carlos-tomas-morel-diplan','2000-06-21'::date,'2016-12-14'::date),
  ('gregorio-nicanor-pena-rodriguez','1968-06-22'::date,'1996-12-16'::date),
  ('valentin-reynoso-hidalgo',null::date,'2007-10-22'::date),
  ('andres-amauri-rosario-henriquez','2007-02-24'::date,'2025-06-23'::date),
  ('roque-antonio-adames-rodriguez','1954-04-17'::date,'1966-03-14'::date),
  ('rafael-leonidas-felipe-y-nunez','1965-03-25'::date,'1999-12-07'::date),
  ('juan-antonio-flores-santana',null::date,'1992-07-13'::date),
  ('hugo-eduardo-polanco-brito','1944-06-25'::date,'1953-09-25'::date),
  ('ramon-alfredo-de-la-cruz-baldera','1991-01-12'::date,'2021-05-15'::date),
  ('nicolas-de-jesus-lopez-rodriguez','1961-03-18'::date,'1978-01-16'::date),
  ('fausto-ramon-mejia-vallejo','1972-11-26'::date,'2012-05-31'::date),
  ('francisco-ozoria-acosta','1978-09-02'::date,'1997-02-01'::date),
  ('andres-napoleon-romero-cardenas','1995-07-08'::date,'2015-02-23'::date),
  ('julio-cesar-corniel-amaro','1986-06-21'::date,'2005-05-31'::date),
  ('santiago-rodriguez-rodriguez','2000-06-24'::date,'2017-11-03'::date),
  ('gabriel-antonio-camilo-gonzalez',null::date,'1992-10-10'::date),
  ('hector-rafael-rodriguez-rodriguez',null::date,'2015-02-23'::date),
  ('tomas-alejo-concepcion','1993-08-07'::date,'2020-11-07'::date),
  ('jeronimo-tomas-abreu-herrera',null::date,'1978-01-16'::date)
) as v(slug, priestly_date, episcopal_date)
join public.persons p on p.slug = v.slug
where not exists (select 1 from public.clergy_profiles cp where cp.person_id = p.id);

update public.clergy_profiles cp
set priestly_ordination_date = coalesce(cp.priestly_ordination_date, v.priestly_date),
    episcopal_ordination_date = coalesce(cp.episcopal_ordination_date, v.episcopal_date),
    updated_at = now()
from (values
  ('freddy-antonio-de-jesus-breton-martinez','1977-09-10'::date,'2015-02-23'::date),
  ('jesus-maria-de-jesus-moya','1961-03-18'::date,'1977-04-13'::date),
  ('jose-amable-duran-tineo','2000-01-06'::date,'2020-06-20'::date),
  ('diomedes-antonio-espinal-de-leon','1978-07-22'::date,'2000-04-20'::date),
  ('jose-dolores-grullon-estrella','1970-12-13'::date,'1991-02-20'::date),
  ('carlos-tomas-morel-diplan','2000-06-21'::date,'2016-12-14'::date),
  ('gregorio-nicanor-pena-rodriguez','1968-06-22'::date,'1996-12-16'::date),
  ('valentin-reynoso-hidalgo',null::date,'2007-10-22'::date),
  ('andres-amauri-rosario-henriquez','2007-02-24'::date,'2025-06-23'::date),
  ('roque-antonio-adames-rodriguez','1954-04-17'::date,'1966-03-14'::date),
  ('rafael-leonidas-felipe-y-nunez','1965-03-25'::date,'1999-12-07'::date),
  ('juan-antonio-flores-santana',null::date,'1992-07-13'::date),
  ('hugo-eduardo-polanco-brito','1944-06-25'::date,'1953-09-25'::date),
  ('ramon-alfredo-de-la-cruz-baldera','1991-01-12'::date,'2021-05-15'::date),
  ('nicolas-de-jesus-lopez-rodriguez','1961-03-18'::date,'1978-01-16'::date),
  ('fausto-ramon-mejia-vallejo','1972-11-26'::date,'2012-05-31'::date),
  ('francisco-ozoria-acosta','1978-09-02'::date,'1997-02-01'::date),
  ('andres-napoleon-romero-cardenas','1995-07-08'::date,'2015-02-23'::date),
  ('julio-cesar-corniel-amaro','1986-06-21'::date,'2005-05-31'::date),
  ('santiago-rodriguez-rodriguez','2000-06-24'::date,'2017-11-03'::date),
  ('gabriel-antonio-camilo-gonzalez',null::date,'1992-10-10'::date),
  ('hector-rafael-rodriguez-rodriguez',null::date,'2015-02-23'::date),
  ('tomas-alejo-concepcion','1993-08-07'::date,'2020-11-07'::date),
  ('jeronimo-tomas-abreu-herrera',null::date,'1978-01-16'::date)
) as v(slug, priestly_date, episcopal_date)
join public.persons p on p.slug = v.slug
where cp.person_id = p.id;

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702212717_033_add_age_text_and_refine_clergy_dates.sql
