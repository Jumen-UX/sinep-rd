-- Separate ecclesiastical jurisdiction identity from geographic discovery and coverage.
-- `ecclesiastical_entities.country_iso2` remains as a compatibility field and is
-- backfilled only as the country of the principal seat. It must not be interpreted
-- as proof that a jurisdiction covers the entire country.

create table if not exists public.jurisdiction_geographic_coverages (
  id uuid primary key default gen_random_uuid(),
  jurisdiction_id uuid not null references public.ecclesiastical_entities(id) on delete cascade,
  country_iso2 char(2) not null references public.countries(iso2) on update cascade on delete restrict,
  coverage_kind text not null default 'seat' check (
    coverage_kind in ('full','partial','personal','specialized','seat','historical')
  ),
  coverage_percentage numeric check (
    coverage_percentage is null or coverage_percentage between 0 and 100
  ),
  valid_from date,
  valid_to date,
  is_current boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  visibility text not null default 'internal' check (
    visibility in ('public','internal','private','confidential')
  ),
  source_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  unique nulls not distinct (
    jurisdiction_id,
    country_iso2,
    coverage_kind,
    valid_from,
    valid_to
  )
);

comment on table public.jurisdiction_geographic_coverages is
  'Historical many-to-many geographic coverage and presence of ecclesiastical jurisdictions. Countries are discovery dimensions, not canonical parents.';
comment on column public.jurisdiction_geographic_coverages.jurisdiction_id is
  'Canonical ecclesiastical jurisdiction whose geographic presence or coverage is described.';
comment on column public.jurisdiction_geographic_coverages.country_iso2 is
  'Civil country or territory related to the jurisdiction coverage record.';
comment on column public.jurisdiction_geographic_coverages.coverage_kind is
  'Nature of the geographic relation: full, partial, personal, specialized, seat or historical.';
comment on column public.jurisdiction_geographic_coverages.coverage_percentage is
  'Optional documented percentage; null when no reliable measurement exists.';

create index if not exists jurisdiction_coverages_country_current_idx
  on public.jurisdiction_geographic_coverages(country_iso2,is_current,status,visibility);
create index if not exists jurisdiction_coverages_jurisdiction_current_idx
  on public.jurisdiction_geographic_coverages(jurisdiction_id,is_current,status,visibility);
create index if not exists jurisdiction_coverages_source_idx
  on public.jurisdiction_geographic_coverages(source_document_id)
  where source_document_id is not null;

-- Preserve current data without asserting complete territorial coverage.
insert into public.jurisdiction_geographic_coverages (
  jurisdiction_id,
  country_iso2,
  coverage_kind,
  is_current,
  status,
  visibility,
  notes
)
select
  entity.id,
  entity.country_iso2,
  'seat',
  true,
  'active',
  entity.visibility,
  'Migración inicial desde ecclesiastical_entities.country_iso2. Representa país de sede o asociación heredada; requiere revisión antes de clasificar cobertura.'
from public.ecclesiastical_entities entity
join public.entity_types entity_type on entity_type.id = entity.entity_type_id
where entity.country_iso2 is not null
  and entity_type.key = any (array[
    'archdiocese',
    'diocese',
    'military_ordinariate',
    'personal_ordinariate',
    'territorial_prelature',
    'apostolic_vicariate',
    'apostolic_prefecture',
    'apostolic_administration',
    'eparchy',
    'archeparchy',
    'exarchate'
  ])
on conflict do nothing;

alter table public.jurisdiction_geographic_coverages enable row level security;

revoke all on public.jurisdiction_geographic_coverages from public;
grant select on public.jurisdiction_geographic_coverages to anon, authenticated;

create policy jurisdiction_coverages_public_read
on public.jurisdiction_geographic_coverages
for select
to anon
using (
  status = 'active'
  and visibility = 'public'
  and is_current
  and (valid_from is null or valid_from <= current_date)
  and (valid_to is null or valid_to >= current_date)
);

create policy jurisdiction_coverages_authenticated_read
on public.jurisdiction_geographic_coverages
for select
to authenticated
using (
  visibility <> 'confidential'
  or created_by = auth.uid()
);

-- No direct insert/update/delete policy is intentionally exposed. Administrative
-- writes must be added later through an audited, jurisdiction-scoped RPC.

create or replace view public.public_jurisdiction_geographic_coverages
with (security_invoker = true)
as
select
  coverage.id,
  coverage.jurisdiction_id,
  entity.slug as jurisdiction_slug,
  entity.name as jurisdiction_name,
  entity_type.key as jurisdiction_type_key,
  entity_type.name as jurisdiction_type_name,
  coverage.country_iso2,
  country.name as country_name,
  country.flag_emoji,
  coverage.coverage_kind,
  coverage.coverage_percentage,
  coverage.valid_from,
  coverage.valid_to,
  coverage.source_document_id,
  coverage.notes
from public.jurisdiction_geographic_coverages coverage
join public.ecclesiastical_entities entity on entity.id = coverage.jurisdiction_id
join public.entity_types entity_type on entity_type.id = entity.entity_type_id
join public.countries country on country.iso2 = coverage.country_iso2
where coverage.status = 'active'
  and coverage.visibility = 'public'
  and coverage.is_current
  and (coverage.valid_from is null or coverage.valid_from <= current_date)
  and (coverage.valid_to is null or coverage.valid_to >= current_date)
  and entity.status = 'active'
  and entity.visibility = 'public';

revoke all on public.public_jurisdiction_geographic_coverages from public;
grant select on public.public_jurisdiction_geographic_coverages to anon, authenticated;

comment on view public.public_jurisdiction_geographic_coverages is
  'Current public geographic discovery relations for ecclesiastical jurisdictions. Does not imply country-to-jurisdiction canonical parentage.';

-- Public country discovery now prefers explicit coverage records while retaining
-- the legacy single-country field during the transition.
create or replace view public.public_countries as
select
  country.id,
  country.iso2 as key,
  country.iso2,
  country.iso3,
  country.name,
  country.official_name,
  country.flag_emoji,
  country.flag_image_url,
  coalesce(country.flag_alt, 'Bandera de ' || country.name) as flag_alt
from public.countries country
where country.status = 'active'
  and country.visibility = 'public'
  and (
    exists (
      select 1
      from public.jurisdiction_geographic_coverages coverage
      join public.ecclesiastical_entities entity on entity.id = coverage.jurisdiction_id
      where coverage.country_iso2 = country.iso2
        and coverage.status = 'active'
        and coverage.visibility = 'public'
        and coverage.is_current
        and (coverage.valid_from is null or coverage.valid_from <= current_date)
        and (coverage.valid_to is null or coverage.valid_to >= current_date)
        and entity.status = 'active'
        and entity.visibility = 'public'
    )
    or exists (
      select 1
      from public.ecclesiastical_entities entity
      join public.entity_types entity_type on entity_type.id = entity.entity_type_id
      where entity.country_iso2 = country.iso2
        and entity.status = 'active'
        and entity.visibility = 'public'
        and entity_type.key = any (array['archdiocese','diocese','military_ordinariate'])
    )
  )
order by country.name;
