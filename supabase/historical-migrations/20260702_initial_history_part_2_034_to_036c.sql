-- HISTORICAL COPY ONLY.
-- Source: supabase_migrations.schema_migrations.
-- Already applied to the operational project; do not execute blindly.

-- BEGIN MIGRATION 20260702214345_034_entity_evolution_and_statistics.sql
create table if not exists public.entity_evolution_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.ecclesiastical_entities(id) on delete cascade,
  event_type text not null,
  event_date date,
  title text not null,
  description text,
  from_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  to_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  related_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  from_entity_name text,
  to_entity_name text,
  related_entity_name text,
  territory_summary text,
  canonical_effect text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review',
  visibility text not null default 'public',
  status text not null default 'active',
  notes_public text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_evolution_event_type_check check (event_type in ('erection','elevation','dismemberment','erection_by_dismemberment','territory_loss','territory_gain','territorial_reorganization','name_change','province_change','suppression','union','restoration','seat_transfer','cathedral_change','other')),
  constraint entity_evolution_status_check check (status in ('active','inactive','archived','draft')),
  constraint entity_evolution_visibility_check check (visibility in ('public','internal','private')),
  constraint entity_evolution_verification_check check (verification_status in ('verified','pending_review','needs_correction','disputed'))
);

create index if not exists idx_entity_evolution_events_entity on public.entity_evolution_events(entity_id);
create index if not exists idx_entity_evolution_events_date on public.entity_evolution_events(event_date);
create index if not exists idx_entity_evolution_events_type on public.entity_evolution_events(event_type);
create unique index if not exists uq_entity_evolution_event_seed on public.entity_evolution_events(entity_id, event_type, event_date, title);

drop trigger if exists trg_entity_evolution_events_updated_at on public.entity_evolution_events;
create trigger trg_entity_evolution_events_updated_at
before update on public.entity_evolution_events
for each row execute function public.set_updated_at();

alter table public.entity_evolution_events enable row level security;

drop policy if exists entity_evolution_events_public_read on public.entity_evolution_events;
create policy entity_evolution_events_public_read
on public.entity_evolution_events
for select
to anon, authenticated
using (status = 'active' and visibility = 'public');

drop policy if exists entity_evolution_events_admin_all on public.entity_evolution_events;
create policy entity_evolution_events_admin_all
on public.entity_evolution_events
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create table if not exists public.entity_statistics_snapshots (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.ecclesiastical_entities(id) on delete cascade,
  statistics_year integer not null,
  catholics_total integer,
  population_total integer,
  catholics_percent numeric,
  diocesan_priests_count integer,
  religious_priests_count integer,
  total_priests_count integer,
  catholics_per_priest integer,
  permanent_deacons_count integer,
  male_religious_count integer,
  female_religious_count integer,
  parishes_count integer,
  source_code text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review',
  visibility text not null default 'public',
  status text not null default 'active',
  notes_public text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_statistics_year_check check (statistics_year >= 1),
  constraint entity_statistics_status_check check (status in ('active','inactive','archived','draft')),
  constraint entity_statistics_visibility_check check (visibility in ('public','internal','private')),
  constraint entity_statistics_verification_check check (verification_status in ('verified','pending_review','needs_correction','disputed')),
  constraint entity_statistics_unique_entity_year unique (entity_id, statistics_year)
);

create index if not exists idx_entity_statistics_snapshots_entity on public.entity_statistics_snapshots(entity_id);
create index if not exists idx_entity_statistics_snapshots_year on public.entity_statistics_snapshots(statistics_year);

drop trigger if exists trg_entity_statistics_snapshots_updated_at on public.entity_statistics_snapshots;
create trigger trg_entity_statistics_snapshots_updated_at
before update on public.entity_statistics_snapshots
for each row execute function public.set_updated_at();

alter table public.entity_statistics_snapshots enable row level security;

drop policy if exists entity_statistics_snapshots_public_read on public.entity_statistics_snapshots;
create policy entity_statistics_snapshots_public_read
on public.entity_statistics_snapshots
for select
to anon, authenticated
using (status = 'active' and visibility = 'public');

drop policy if exists entity_statistics_snapshots_admin_all on public.entity_statistics_snapshots;
create policy entity_statistics_snapshots_admin_all
on public.entity_statistics_snapshots
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop view if exists public.public_entity_evolution_events;
create view public.public_entity_evolution_events
with (security_invoker = true)
as
select
  ev.id,
  ev.entity_id,
  e.name as entity_name,
  e.slug as entity_slug,
  ev.event_type,
  ev.event_date,
  ev.title,
  ev.description,
  ev.from_entity_id,
  fe.name as from_entity_display_name,
  fe.slug as from_entity_slug,
  ev.from_entity_name,
  ev.to_entity_id,
  te.name as to_entity_display_name,
  te.slug as to_entity_slug,
  ev.to_entity_name,
  ev.related_entity_id,
  re.name as related_entity_display_name,
  re.slug as related_entity_slug,
  ev.related_entity_name,
  ev.territory_summary,
  ev.canonical_effect,
  ev.source_name,
  ev.source_url,
  ev.source_checked_at,
  ev.verification_status,
  ev.notes_public
from public.entity_evolution_events ev
join public.ecclesiastical_entities e on e.id = ev.entity_id
left join public.ecclesiastical_entities fe on fe.id = ev.from_entity_id
left join public.ecclesiastical_entities te on te.id = ev.to_entity_id
left join public.ecclesiastical_entities re on re.id = ev.related_entity_id
where ev.status = 'active' and ev.visibility = 'public';

drop view if exists public.public_entity_statistics_snapshots;
create view public.public_entity_statistics_snapshots
with (security_invoker = true)
as
select
  s.id,
  s.entity_id,
  e.name as entity_name,
  e.slug as entity_slug,
  s.statistics_year,
  s.catholics_total,
  s.population_total,
  s.catholics_percent,
  s.diocesan_priests_count,
  s.religious_priests_count,
  s.total_priests_count,
  s.catholics_per_priest,
  s.permanent_deacons_count,
  s.male_religious_count,
  s.female_religious_count,
  s.parishes_count,
  s.source_code,
  s.source_name,
  s.source_url,
  s.source_checked_at,
  s.verification_status,
  s.notes_public
from public.entity_statistics_snapshots s
join public.ecclesiastical_entities e on e.id = s.entity_id
where s.status = 'active' and s.visibility = 'public';

grant select on public.entity_evolution_events to anon, authenticated;
grant insert, update, delete on public.entity_evolution_events to authenticated;
grant select on public.entity_statistics_snapshots to anon, authenticated;
grant insert, update, delete on public.entity_statistics_snapshots to authenticated;
grant select on public.public_entity_evolution_events to anon, authenticated;
grant select on public.public_entity_statistics_snapshots to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214345_034_entity_evolution_and_statistics.sql

-- BEGIN MIGRATION 20260702214515_035a_uploaded_pdf_people_and_offices.sql
insert into public.offices (key, name, description, applies_to, is_clergy_office, is_pastoral_office, status)
values ('coadjutor_bishop', 'Obispo coadjutor', 'Obispo con derecho de sucesión en una diócesis.', 'entity', true, false, 'active')
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = now();

insert into public.persons (slug, display_name, first_name, last_name, person_type, gender, status, visibility, age_text)
values
  ('victor-emilio-masalles-pere','Víctor Emilio Masalles Pere','Víctor Emilio','Masalles Pere','bishop','male','active','public','65.00'),
  ('priamo-pericles-tejeda-rosario','Príamo Pericles Tejeda Rosario','Príamo Pericles','Tejeda Rosario','bishop','male','active','public',null),
  ('fabio-mamerto-rivas-santos','Fabio Mamerto Rivas Santos','Fabio Mamerto','Rivas Santos','bishop','male','active','public',null),
  ('thomas-francis-reilly','Thomas Francis (Tomás Francisco) Reilly','Thomas Francis','Reilly','bishop','male','active','public',null),
  ('ronald-gerard-connors','Ronald Gerard Connors','Ronald Gerard','Connors','bishop','male','active','public',null),
  ('juan-felix-pepen-y-soliman','Juan Félix Pepén y Soliman','Juan Félix','Pepén y Soliman','bishop','male','active','public',null),
  ('pablo-cedano-cedano','Pablo Cedano Cedano','Pablo','Cedano Cedano','bishop','male','active','public',null),
  ('ramon-benito-angeles-fernandez','Ramón Benito Ángeles Fernández','Ramón Benito','Ángeles Fernández','bishop','male','active','public','77.29'),
  ('manuel-antonio-ruiz-de-la-rosa','Manuel Antonio Ruíz de la Rosa','Manuel Antonio','Ruíz de la Rosa','bishop','male','active','public','60.84'),
  ('jesus-castro-marte','Jesús Castro Marte','Jesús','Castro Marte','bishop','male','active','public','60.28'),
  ('gregorio-nicanor-pena-rodriguez','Gregorio Nicanor Peña Rodríguez','Gregorio Nicanor','Peña Rodríguez','bishop','male','active','public','84.30'),
  ('tomas-alejo-concepcion','Tomás Alejo Concepción','Tomás Alejo','Concepción','bishop','male','active','public','63.04'),
  ('jose-dolores-grullon-estrella','José Dolores Grullón Estrella','José Dolores','Grullón Estrella','bishop','male','active','public','84.46'),
  ('santiago-rodriguez-rodriguez','Santiago Rodríguez Rodríguez','Santiago','Rodríguez Rodríguez','bishop','male','active','public','58.10'),
  ('francisco-ozoria-acosta','Francisco Ozoria Acosta','Francisco','Ozoria Acosta','bishop','male','active','public','74.72'),
  ('carlos-tomas-morel-diplan','Carlos Tomás','Carlos Tomás','Morel Diplán','bishop','male','active','public','56.66'),
  ('jose-amable-duran-tineo','José Amable Durán Tineo','José Amable','Durán Tineo','bishop','male','active','public','54.88'),
  ('nicolas-de-jesus-lopez-rodriguez','Nicolás de Jesús López Rodríguez','Nicolás de Jesús','López Rodríguez','bishop','male','active','public','89.67')
on conflict (slug) do update
set display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    person_type = excluded.person_type,
    gender = excluded.gender,
    age_text = coalesce(excluded.age_text, public.persons.age_text),
    status = excluded.status,
    visibility = excluded.visibility,
    updated_at = now();

insert into public.clergy_profiles (person_id, priestly_ordination_date, episcopal_ordination_date, canonical_status)
select p.id, v.priestly_date, v.episcopal_date, 'active'
from (values
  ('victor-emilio-masalles-pere','1991-07-07'::date,'2010-05-08'::date),
  ('priamo-pericles-tejeda-rosario','1966-05-11'::date,'1975-05-10'::date),
  ('fabio-mamerto-rivas-santos',null::date,'1976-04-24'::date),
  ('thomas-francis-reilly',null::date,'1956-07-22'::date),
  ('ronald-gerard-connors',null::date,'1976-04-24'::date),
  ('juan-felix-pepen-y-soliman','1947-06-29'::date,'1959-04-01'::date),
  ('pablo-cedano-cedano','1967-07-02'::date,'1996-05-31'::date),
  ('ramon-benito-angeles-fernandez','2002-01-01'::date,'2017-07-01'::date),
  ('manuel-antonio-ruiz-de-la-rosa','1993-07-10'::date,'2025-08-27'::date),
  ('jose-amable-duran-tineo','2000-01-06'::date,'2020-09-12'::date),
  ('nicolas-de-jesus-lopez-rodriguez','1961-03-18'::date,'1978-02-25'::date),
  ('carlos-tomas-morel-diplan','2000-06-21'::date,'2017-02-25'::date),
  ('santiago-rodriguez-rodriguez',null::date,'2017-11-03'::date)
) as v(slug, priestly_date, episcopal_date)
join public.persons p on p.slug = v.slug
where not exists (select 1 from public.clergy_profiles cp where cp.person_id = p.id);

update public.clergy_profiles cp
set priestly_ordination_date = coalesce(cp.priestly_ordination_date, v.priestly_date),
    episcopal_ordination_date = coalesce(cp.episcopal_ordination_date, v.episcopal_date),
    updated_at = now()
from (values
  ('victor-emilio-masalles-pere','1991-07-07'::date,'2010-05-08'::date),
  ('priamo-pericles-tejeda-rosario','1966-05-11'::date,'1975-05-10'::date),
  ('fabio-mamerto-rivas-santos',null::date,'1976-04-24'::date),
  ('thomas-francis-reilly',null::date,'1956-07-22'::date),
  ('ronald-gerard-connors',null::date,'1976-04-24'::date),
  ('juan-felix-pepen-y-soliman','1947-06-29'::date,'1959-04-01'::date),
  ('pablo-cedano-cedano','1967-07-02'::date,'1996-05-31'::date),
  ('ramon-benito-angeles-fernandez','2002-01-01'::date,'2017-07-01'::date),
  ('manuel-antonio-ruiz-de-la-rosa','1993-07-10'::date,'2025-08-27'::date),
  ('jose-amable-duran-tineo','2000-01-06'::date,'2020-09-12'::date),
  ('nicolas-de-jesus-lopez-rodriguez','1961-03-18'::date,'1978-02-25'::date),
  ('carlos-tomas-morel-diplan','2000-06-21'::date,'2017-02-25'::date),
  ('santiago-rodriguez-rodriguez',null::date,'2017-11-03'::date)
) as v(slug, priestly_date, episcopal_date)
join public.persons p on p.slug = v.slug
where cp.person_id = p.id;

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214515_035a_uploaded_pdf_people_and_offices.sql

-- BEGIN MIGRATION 20260702214614_035b_bani_barahona_appointments.sql
update public.persons set display_name='Carlos Tomás Morel Diplán', updated_at=now() where slug='carlos-tomas-morel-diplan';

with target as (
  select a.id
  from public.appointments a
  join public.persons p on p.id=a.person_id
  join public.ecclesiastical_entities e on e.id=a.entity_id
  join public.offices o on o.id=a.office_id
  where p.slug='andres-napoleon-romero-cardenas' and e.slug='diocesis-de-barahona' and o.key='diocesan_bishop' and a.is_current=true
)
update public.appointments a
set is_current=false, end_date=coalesce(a.end_date,'2026-06-12'::date), updated_at=now()
from target where a.id=target.id;

with x as (
  select * from (values
    ('diocesis-de-bani','priamo-pericles-tejeda-rosario','diocesan_bishop','1986-11-08'::date,'1997-12-13'::date,false),
    ('diocesis-de-bani','freddy-antonio-de-jesus-breton-martinez','diocesan_bishop','1998-08-06'::date,'2015-02-23'::date,false),
    ('diocesis-de-bani','victor-emilio-masalles-pere','diocesan_bishop','2016-12-14'::date,'2023-09-12'::date,false),
    ('diocesis-de-bani','victor-emilio-masalles-pere','bishop_emeritus','2023-09-12'::date,null::date,true),
    ('diocesis-de-bani','faustino-burgos-brisman','apostolic_administrator','2023-09-12'::date,'2024-08-17'::date,false),
    ('diocesis-de-bani','faustino-burgos-brisman','diocesan_bishop','2024-08-17'::date,null::date,true),
    ('diocesis-de-barahona','fabio-mamerto-rivas-santos','diocesan_bishop','1976-04-24'::date,'1999-12-07'::date,false),
    ('diocesis-de-barahona','rafael-leonidas-felipe-y-nunez','diocesan_bishop','1999-12-07'::date,'2015-02-23'::date,false),
    ('diocesis-de-barahona','andres-napoleon-romero-cardenas','diocesan_bishop','2015-02-23'::date,'2026-06-12'::date,false)
  ) as v(entity_slug, person_slug, office_key, start_date, end_date, is_current)
), refs as (
  select e.id as entity_id,p.id as person_id,o.id as office_id,x.start_date,x.end_date,x.is_current
  from x join public.ecclesiastical_entities e on e.slug=x.entity_slug
  join public.persons p on p.slug=x.person_slug
  join public.offices o on o.key=x.office_key
)
insert into public.appointments (entity_id,person_id,office_id,start_date,end_date,is_current,appointment_type,status,visibility)
select entity_id,person_id,office_id,start_date,end_date,is_current,'canonical','active','public'
from refs r
where not exists (
  select 1 from public.appointments a where a.entity_id=r.entity_id and a.person_id=r.person_id and a.office_id=r.office_id and (a.start_date=r.start_date or (r.is_current and a.is_current))
);

update public.ecclesiastical_entities
set area_km2=892, statistics_year=2022, population_total=901130, catholics_total=797280, catholics_percent=88.5, parishes_count=30, current_ordinary_name='Faustino Burgos Brisman; Víctor Emilio Masalles Pere', current_ordinary_title='Obispo; Obispo emérito', source_name='Catholic-Hierarchy PDF de Baní', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-bani';

update public.ecclesiastical_entities
set area_km2=6975, statistics_year=2023, population_total=463680, catholics_total=251000, catholics_percent=54.1, parishes_count=25, current_ordinary_name='Vacante', current_ordinary_title='Sede vacante', website='https://diocesisdebarahona.org', phone='(809)524-4014', source_name='Catholic-Hierarchy PDF de Barahona', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-barahona';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214614_035b_bani_barahona_appointments.sql

-- BEGIN MIGRATION 20260702214630_035c_san_juan_higuey_appointments.sql
with x as (
  select * from (values
    ('diocesis-de-san-juan-de-la-maguana','thomas-francis-reilly','diocesan_bishop','1956-07-22'::date,'1977-07-20'::date,false),
    ('diocesis-de-san-juan-de-la-maguana','ronald-gerard-connors','coadjutor_bishop','1976-04-24'::date,'1977-07-20'::date,false),
    ('diocesis-de-san-juan-de-la-maguana','ronald-gerard-connors','diocesan_bishop','1977-07-20'::date,'1991-02-20'::date,false),
    ('diocesis-de-san-juan-de-la-maguana','jose-dolores-grullon-estrella','diocesan_bishop','1991-02-20'::date,'2020-11-07'::date,false),
    ('diocesis-de-san-juan-de-la-maguana','jose-dolores-grullon-estrella','bishop_emeritus','2020-11-07'::date,null::date,true),
    ('diocesis-de-san-juan-de-la-maguana','tomas-alejo-concepcion','diocesan_bishop','2020-11-07'::date,null::date,true),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','juan-felix-pepen-y-soliman','diocesan_bishop','1959-04-01'::date,'1975-05-10'::date,false),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','hugo-eduardo-polanco-brito','diocesan_bishop','1975-05-10'::date,'1995-03-25'::date,false),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','ramon-benito-de-la-rosa-y-carpio','diocesan_bishop','1995-03-25'::date,'2003-07-16'::date,false),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','gregorio-nicanor-pena-rodriguez','diocesan_bishop','2004-06-24'::date,'2020-05-30'::date,false),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','gregorio-nicanor-pena-rodriguez','bishop_emeritus','2020-05-30'::date,null::date,true),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','jesus-castro-marte','diocesan_bishop','2020-05-30'::date,null::date,true)
  ) as v(entity_slug, person_slug, office_key, start_date, end_date, is_current)
), refs as (
  select e.id as entity_id,p.id as person_id,o.id as office_id,x.start_date,x.end_date,x.is_current
  from x join public.ecclesiastical_entities e on e.slug=x.entity_slug
  join public.persons p on p.slug=x.person_slug
  join public.offices o on o.key=x.office_key
)
insert into public.appointments (entity_id,person_id,office_id,start_date,end_date,is_current,appointment_type,status,visibility)
select entity_id,person_id,office_id,start_date,end_date,is_current,'canonical','active','public'
from refs r
where not exists (
  select 1 from public.appointments a where a.entity_id=r.entity_id and a.person_id=r.person_id and a.office_id=r.office_id and (a.start_date=r.start_date or (r.is_current and a.is_current))
);

update public.ecclesiastical_entities
set area_km2=7475, statistics_year=2023, population_total=532400, catholics_total=528300, catholics_percent=99.2, parishes_count=39, current_ordinary_name='Tomás Alejo Concepción; José Dolores Grullón Estrella', current_ordinary_title='Obispo; Obispo emérito', website='http://www.diocesissanjuandelamaguana.com/', phone='(809)557-2898', source_name='Catholic-Hierarchy PDF de San Juan de la Maguana', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-san-juan-de-la-maguana';

update public.ecclesiastical_entities
set area_km2=5451, statistics_year=2023, population_total=623500, catholics_total=517100, catholics_percent=82.9, parishes_count=36, current_ordinary_name='Jesús Castro Marte; Gregorio Nicanor Peña Rodríguez', current_ordinary_title='Obispo; Obispo emérito', phone='(809)554-2431; 554-4120', source_name='Catholic-Hierarchy PDF de Higüey', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-nuestra-senora-de-la-altagracia-en-higuey';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214630_035c_san_juan_higuey_appointments.sql

-- BEGIN MIGRATION 20260702214649_035d_san_pedro_stella_santo_domingo_updates.sql
with x as (
  select * from (values
    ('diocesis-de-san-pedro-de-macoris','francisco-ozoria-acosta','diocesan_bishop','1997-02-01'::date,'2016-07-04'::date,false),
    ('diocesis-de-san-pedro-de-macoris','rafael-leonidas-felipe-y-nunez','apostolic_administrator','2016-09-10'::date,'2017-12-30'::date,false),
    ('diocesis-de-san-pedro-de-macoris','santiago-rodriguez-rodriguez','diocesan_bishop','2017-11-03'::date,null::date,true),
    ('diocesis-de-stella-maris','manuel-antonio-ruiz-de-la-rosa','diocesan_bishop','2025-08-27'::date,null::date,true),
    ('arquidiocesis-metropolitana-de-santo-domingo','nicolas-de-jesus-lopez-rodriguez','metropolitan_archbishop','1981-11-15'::date,'2016-07-04'::date,false),
    ('arquidiocesis-metropolitana-de-santo-domingo','nicolas-de-jesus-lopez-rodriguez','bishop_emeritus','2016-07-04'::date,null::date,true),
    ('arquidiocesis-metropolitana-de-santo-domingo','francisco-ozoria-acosta','metropolitan_archbishop','2016-07-04'::date,null::date,true),
    ('arquidiocesis-metropolitana-de-santo-domingo','carlos-tomas-morel-diplan','coadjutor_archbishop','2025-10-18'::date,null::date,true),
    ('arquidiocesis-metropolitana-de-santo-domingo','jose-amable-duran-tineo','auxiliary_bishop','2020-06-20'::date,null::date,true),
    ('arquidiocesis-metropolitana-de-santo-domingo','ramon-benito-angeles-fernandez','bishop_emeritus','2024-03-18'::date,null::date,true)
  ) as v(entity_slug, person_slug, office_key, start_date, end_date, is_current)
), refs as (
  select e.id as entity_id,p.id as person_id,o.id as office_id,x.start_date,x.end_date,x.is_current
  from x join public.ecclesiastical_entities e on e.slug=x.entity_slug
  join public.persons p on p.slug=x.person_slug
  join public.offices o on o.key=x.office_key
)
insert into public.appointments (entity_id,person_id,office_id,start_date,end_date,is_current,appointment_type,status,visibility)
select entity_id,person_id,office_id,start_date,end_date,is_current,'canonical','active','public'
from refs r
where not exists (
  select 1 from public.appointments a where a.entity_id=r.entity_id and a.person_id=r.person_id and a.office_id=r.office_id and (a.start_date=r.start_date or (r.is_current and a.is_current))
);

update public.ecclesiastical_entities
set area_km2=2588, statistics_year=2023, population_total=705600, catholics_total=611900, catholics_percent=86.7, parishes_count=29, current_ordinary_name='Santiago Rodríguez Rodríguez', current_ordinary_title='Obispo', website='http://diocesissanpedrodemacoris.org', phone='(809)246-3800', source_name='Catholic-Hierarchy PDF de San Pedro de Macorís', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-san-pedro-de-macoris';

update public.ecclesiastical_entities
set area_km2=589, statistics_year=2025, population_total=1291516, catholics_total=943762, catholics_percent=73.1, parishes_count=64, current_ordinary_name='Manuel Antonio Ruíz de la Rosa', current_ordinary_title='Obispo', source_name='Catholic-Hierarchy PDF de Stella Maris', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='diocesis-de-stella-maris';

update public.ecclesiastical_entities
set area_km2=3406, statistics_year=2025, population_total=2906306, catholics_total=2539412, catholics_percent=87.4, parishes_count=156, current_ordinary_name='Francisco Ozoria Acosta; Carlos Tomás Morel Diplán; José Amable Durán Tineo', current_ordinary_title='Arzobispo; Arzobispo coadjutor; Obispo auxiliar', website='https://arquidiocesisd.org', phone='(809)685-3141/3; 622-1221', source_name='Catholic-Hierarchy PDF de Santo Domingo', source_checked_at='2026-07-02'::date, updated_at=now()
where slug='arquidiocesis-metropolitana-de-santo-domingo';
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214649_035d_san_pedro_stella_santo_domingo_updates.sql

-- BEGIN MIGRATION 20260702214715_036a_seed_diocese_evolution_events_uploaded_pdfs.sql
with seeds as (
  select * from (values
    ('diocesis-de-bani','erection_by_dismemberment','1986-11-08'::date,'Erección de la Diócesis de Baní','arquidiocesis-metropolitana-de-santo-domingo',null,'diocesis-de-bani','Peravia y San Cristóbal','La nueva diócesis fue erigida con territorio de la Arquidiócesis de Santo Domingo.','Catholic-Hierarchy PDF de Baní'),
    ('diocesis-de-barahona','erection_by_dismemberment','1976-04-24'::date,'Erección de la Diócesis de Barahona','diocesis-de-san-juan-de-la-maguana',null,'diocesis-de-barahona','Barahona, Bahoruco, Independencia y Pedernales','La nueva diócesis fue erigida con territorio de San Juan de la Maguana.','Catholic-Hierarchy PDF de Barahona'),
    ('diocesis-de-san-juan-de-la-maguana','erection','1953-09-25'::date,'Erección como prelatura territorial','arquidiocesis-metropolitana-de-santo-domingo',null,'diocesis-de-san-juan-de-la-maguana','S. Rafael, Benefactor, Baoruco, Independencia, Barahona y Azua','Erección de la Prelatura Territorial de San Juan de la Maguana.','Catholic-Hierarchy PDF de San Juan de la Maguana'),
    ('diocesis-de-san-juan-de-la-maguana','elevation','1969-11-19'::date,'Elevación a diócesis',null,null,'diocesis-de-san-juan-de-la-maguana',null,'La prelatura territorial fue elevada a diócesis.','Catholic-Hierarchy PDF de San Juan de la Maguana'),
    ('diocesis-de-san-juan-de-la-maguana','dismemberment','1976-04-24'::date,'Desmembramiento para erigir Barahona',null,'diocesis-de-barahona','diocesis-de-barahona','Barahona, Bahoruco, Independencia y Pedernales','Pérdida territorial para erigir la Diócesis de Barahona.','Catholic-Hierarchy PDF de San Juan de la Maguana'),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','erection_by_dismemberment','1959-04-01'::date,'Erección de la Diócesis de Higüey','arquidiocesis-metropolitana-de-santo-domingo',null,'diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','La Altagracia y El Seibo','La nueva diócesis fue erigida con territorio de Santo Domingo.','Catholic-Hierarchy PDF de Higüey'),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','dismemberment','1997-02-01'::date,'Desmembramiento para erigir San Pedro de Macorís',null,'diocesis-de-san-pedro-de-macoris','diocesis-de-san-pedro-de-macoris','Hato Mayor','Pérdida territorial para erigir San Pedro de Macorís.','Catholic-Hierarchy PDF de Higüey'),
    ('diocesis-de-san-pedro-de-macoris','erection_by_dismemberment','1997-02-01'::date,'Erección de la Diócesis de San Pedro de Macorís','diocesis-de-nuestra-senora-de-la-altagracia-en-higuey',null,'diocesis-de-san-pedro-de-macoris','Hato Mayor y San Pedro de Macorís','La nueva diócesis fue erigida con territorio de Higüey y Santo Domingo.','Catholic-Hierarchy PDF de San Pedro de Macorís'),
    ('diocesis-de-stella-maris','erection_by_dismemberment','2025-08-27'::date,'Erección de la Diócesis de Stella Maris','arquidiocesis-metropolitana-de-santo-domingo',null,'diocesis-de-stella-maris','Santo Domingo Este, San Antonio de Guerra y Boca Chica','La nueva diócesis fue erigida con territorio de Santo Domingo.','Catholic-Hierarchy PDF de Stella Maris')
  ) as v(entity_slug,event_type,event_date,title,from_slug,to_slug,related_slug,territory_summary,canonical_effect,source_name)
)
insert into public.entity_evolution_events (
  entity_id,event_type,event_date,title,from_entity_id,to_entity_id,related_entity_id,
  from_entity_name,to_entity_name,related_entity_name,territory_summary,canonical_effect,
  source_name,source_checked_at,verification_status,visibility,status
)
select e.id, s.event_type, s.event_date, s.title, fe.id, te.id, re.id,
       fe.name, te.name, re.name, s.territory_summary, s.canonical_effect,
       s.source_name, '2026-07-02'::date, 'verified', 'public', 'active'
from seeds s
join public.ecclesiastical_entities e on e.slug=s.entity_slug
left join public.ecclesiastical_entities fe on fe.slug=s.from_slug
left join public.ecclesiastical_entities te on te.slug=s.to_slug
left join public.ecclesiastical_entities re on re.slug=s.related_slug
on conflict (entity_id,event_type,event_date,title) do update
set from_entity_id=excluded.from_entity_id,
    to_entity_id=excluded.to_entity_id,
    related_entity_id=excluded.related_entity_id,
    from_entity_name=excluded.from_entity_name,
    to_entity_name=excluded.to_entity_name,
    related_entity_name=excluded.related_entity_name,
    territory_summary=excluded.territory_summary,
    canonical_effect=excluded.canonical_effect,
    source_name=excluded.source_name,
    verification_status=excluded.verification_status,
    updated_at=now();
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214715_036a_seed_diocese_evolution_events_uploaded_pdfs.sql

-- BEGIN MIGRATION 20260702214738_036b_seed_santo_domingo_evolution_events_uploaded_pdf.sql
with seeds as (
  select * from (values
    ('erection','1511-08-08'::date,'Erección de la Diócesis de Santo Domingo',null,'Diócesis de Santo Domingo',null,'Erección de la diócesis original.'),
    ('territory_loss','1516-02-11'::date,'Pérdida territorial hacia Baracoa',null,'Diócesis de Baracoa',null,'Pérdida de territorio para la erección de Baracoa.'),
    ('territory_loss','1534-01-10'::date,'Pérdida territorial hacia Santa Marta',null,'Diócesis de Santa Marta',null,'Pérdida de territorio para la erección de Santa Marta.'),
    ('territory_loss','1534-11-03'::date,'Pérdida territorial hacia Nicaragua',null,'Diócesis de Nicaragua',null,'Pérdida de territorio para la erección de Nicaragua.'),
    ('territory_loss','1534-12-18'::date,'Pérdida territorial hacia Santiago de Guatemala',null,'Diócesis de Santiago de Guatemala',null,'Pérdida de territorio para la erección de Santiago de Guatemala.'),
    ('elevation','1546-02-12'::date,'Elevación a Arquidiócesis de Santo Domingo','Diócesis de Santo Domingo','Arquidiócesis de Santo Domingo',null,'La diócesis fue elevada a arquidiócesis.'),
    ('dismemberment','1953-09-25'::date,'Desmembramiento para erigir La Vega','Arquidiócesis de Santo Domingo','Diócesis de La Vega','diocesis-de-la-vega','Pérdida territorial: La Vega, Duarte, Samaná y Sánchez Ramírez.'),
    ('dismemberment','1953-09-25'::date,'Desmembramiento para erigir San Juan de la Maguana','Arquidiócesis de Santo Domingo','Prelatura Territorial de San Juan de la Maguana','diocesis-de-san-juan-de-la-maguana','Pérdida territorial: S. Rafael, Benefactor, Baoruco, Independencia, Barahona y Azua.'),
    ('dismemberment','1953-09-25'::date,'Desmembramiento para erigir Santiago de los Caballeros','Arquidiócesis de Santo Domingo','Diócesis de Santiago de los Caballeros','arquidiocesis-metropolitana-de-santiago-de-los-caballeros','Pérdida territorial: Monte Cristi, Libertador, Santiago Rodríguez, Puerto Plata, Santiago, Espaillat y Salcedo.'),
    ('elevation','1953-09-25'::date,'Santo Domingo vuelve a ser sede metropolitana','Arquidiócesis de Santo Domingo','Arquidiócesis metropolitana de Santo Domingo',null,'La arquidiócesis vuelve a ser metropolitana.'),
    ('dismemberment','1959-04-01'::date,'Desmembramiento para erigir Higüey','Arquidiócesis de Santo Domingo','Diócesis de Nuestra Señora de la Altagracia en Higüey','diocesis-de-nuestra-senora-de-la-altagracia-en-higuey','Pérdida territorial: La Altagracia y El Seibo.'),
    ('dismemberment','1986-11-08'::date,'Desmembramiento para erigir Baní','Arquidiócesis de Santo Domingo','Diócesis de Baní','diocesis-de-bani','Pérdida territorial: Peravia y San Cristóbal.'),
    ('dismemberment','1997-02-01'::date,'Desmembramiento para erigir San Pedro de Macorís','Arquidiócesis de Santo Domingo','Diócesis de San Pedro de Macorís','diocesis-de-san-pedro-de-macoris','Pérdida territorial: San Pedro de Macorís; junto con Hato Mayor procedente de Higüey.'),
    ('dismemberment','2025-08-27'::date,'Desmembramiento para erigir Stella Maris','Arquidiócesis de Santo Domingo','Diócesis de Stella Maris','diocesis-de-stella-maris','Pérdida territorial: Santo Domingo Este, San Antonio de Guerra y Boca Chica.')
  ) as v(event_type,event_date,title,from_entity_name,to_entity_name,related_slug,territory_summary)
), entity_ref as (
  select id from public.ecclesiastical_entities where slug='arquidiocesis-metropolitana-de-santo-domingo'
)
insert into public.entity_evolution_events (
  entity_id,event_type,event_date,title,from_entity_name,to_entity_name,related_entity_id,related_entity_name,territory_summary,canonical_effect,source_name,source_checked_at,verification_status,visibility,status
)
select entity_ref.id, s.event_type, s.event_date, s.title, s.from_entity_name, s.to_entity_name, re.id, re.name, s.territory_summary, s.title, 'Catholic-Hierarchy PDF de Santo Domingo', '2026-07-02'::date, 'verified','public','active'
from seeds s
cross join entity_ref
left join public.ecclesiastical_entities re on re.slug=s.related_slug
on conflict (entity_id,event_type,event_date,title) do update
set from_entity_name=excluded.from_entity_name,
    to_entity_name=excluded.to_entity_name,
    related_entity_id=excluded.related_entity_id,
    related_entity_name=excluded.related_entity_name,
    territory_summary=excluded.territory_summary,
    canonical_effect=excluded.canonical_effect,
    source_name=excluded.source_name,
    verification_status=excluded.verification_status,
    updated_at=now();
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214738_036b_seed_santo_domingo_evolution_events_uploaded_pdf.sql

-- BEGIN MIGRATION 20260702214801_036c_seed_statistics_snapshots_uploaded_pdfs.sql
with seeds as (
  select * from (values
    ('arquidiocesis-metropolitana-de-santo-domingo',1950,2165000,2185000,99.1,41,117,158,13702,null,94,331,65,'ap1951','Catholic-Hierarchy PDF de Santo Domingo'),
    ('arquidiocesis-metropolitana-de-santo-domingo',2025,2539412,2906306,87.4,150,166,316,8036,132,37,448,156,'bul:27Aug2025','Catholic-Hierarchy PDF de Santo Domingo'),
    ('diocesis-de-bani',1990,438000,477000,91.8,10,25,35,12514,null,3,46,14,'ap1991','Catholic-Hierarchy PDF de Baní'),
    ('diocesis-de-bani',2022,797280,901130,88.5,28,5,33,24160,5,9,48,30,'ap2023','Catholic-Hierarchy PDF de Baní'),
    ('diocesis-de-barahona',1980,247000,309000,79.9,3,22,25,9880,null,22,49,12,'ap1981','Catholic-Hierarchy PDF de Barahona'),
    ('diocesis-de-barahona',2023,251000,463680,54.1,10,32,42,5976,3,33,49,25,'ap2024','Catholic-Hierarchy PDF de Barahona'),
    ('diocesis-de-san-juan-de-la-maguana',1965,530000,550000,96.4,12,31,43,12325,null,31,51,16,'ap1967','Catholic-Hierarchy PDF de San Juan de la Maguana'),
    ('diocesis-de-san-juan-de-la-maguana',2023,528300,532400,99.2,29,14,43,12286,29,17,49,39,'ap2024','Catholic-Hierarchy PDF de San Juan de la Maguana'),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey',1966,9610,240000,4.0,9,5,14,686,null,6,30,9,'ap1967','Catholic-Hierarchy PDF de Higüey'),
    ('diocesis-de-nuestra-senora-de-la-altagracia-en-higuey',2023,517100,623500,82.9,25,15,40,12927,31,21,60,36,'ap2024','Catholic-Hierarchy PDF de Higüey'),
    ('diocesis-de-san-pedro-de-macoris',1999,405000,450000,90.0,10,7,17,23823,2,8,59,12,'ap2000','Catholic-Hierarchy PDF de San Pedro de Macorís'),
    ('diocesis-de-san-pedro-de-macoris',2023,611900,705600,86.7,26,6,32,19121,26,16,68,29,'ap2024','Catholic-Hierarchy PDF de San Pedro de Macorís'),
    ('diocesis-de-stella-maris',2025,943762,1291516,73.1,40,55,95,9934,39,12,83,64,'bul:27Aug2025','Catholic-Hierarchy PDF de Stella Maris')
  ) as v(entity_slug,statistics_year,catholics_total,population_total,catholics_percent,diocesan_priests_count,religious_priests_count,total_priests_count,catholics_per_priest,permanent_deacons_count,male_religious_count,female_religious_count,parishes_count,source_code,source_name)
)
insert into public.entity_statistics_snapshots (
  entity_id,statistics_year,catholics_total,population_total,catholics_percent,diocesan_priests_count,religious_priests_count,total_priests_count,catholics_per_priest,permanent_deacons_count,male_religious_count,female_religious_count,parishes_count,source_code,source_name,source_checked_at,verification_status,visibility,status
)
select e.id,s.statistics_year,s.catholics_total,s.population_total,s.catholics_percent,s.diocesan_priests_count,s.religious_priests_count,s.total_priests_count,s.catholics_per_priest,s.permanent_deacons_count,s.male_religious_count,s.female_religious_count,s.parishes_count,s.source_code,s.source_name,'2026-07-02'::date,'verified','public','active'
from seeds s
join public.ecclesiastical_entities e on e.slug=s.entity_slug
on conflict (entity_id,statistics_year) do update
set catholics_total=excluded.catholics_total,
    population_total=excluded.population_total,
    catholics_percent=excluded.catholics_percent,
    diocesan_priests_count=excluded.diocesan_priests_count,
    religious_priests_count=excluded.religious_priests_count,
    total_priests_count=excluded.total_priests_count,
    catholics_per_priest=excluded.catholics_per_priest,
    permanent_deacons_count=excluded.permanent_deacons_count,
    male_religious_count=excluded.male_religious_count,
    female_religious_count=excluded.female_religious_count,
    parishes_count=excluded.parishes_count,
    source_code=excluded.source_code,
    source_name=excluded.source_name,
    verification_status=excluded.verification_status,
    updated_at=now();
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702214801_036c_seed_statistics_snapshots_uploaded_pdfs.sql
