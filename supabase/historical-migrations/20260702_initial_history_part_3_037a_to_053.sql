-- HISTORICAL COPY ONLY.
-- Source: supabase_migrations.schema_migrations.
-- Already applied to the operational project; do not execute blindly.

-- BEGIN MIGRATION 20260702222132_037a_organization_chart_schema.sql
create table if not exists public.organization_charts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 100,
  visibility text not null default 'public',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_charts_visibility_check check (visibility in ('public','internal','private')),
  constraint organization_charts_status_check check (status in ('active','inactive','archived','draft'))
);

drop trigger if exists trg_organization_charts_updated_at on public.organization_charts;
create trigger trg_organization_charts_updated_at before update on public.organization_charts for each row execute function public.set_updated_at();

create table if not exists public.office_base_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  feminine_name text,
  plural_name text,
  description text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_base_roles_status_check check (status in ('active','inactive','archived','draft'))
);

drop trigger if exists trg_office_base_roles_updated_at on public.office_base_roles;
create trigger trg_office_base_roles_updated_at before update on public.office_base_roles for each row execute function public.set_updated_at();

create table if not exists public.office_scopes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  adjective_masculine text,
  adjective_feminine text,
  description text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_scopes_status_check check (status in ('active','inactive','archived','draft'))
);

drop trigger if exists trg_office_scopes_updated_at on public.office_scopes;
create trigger trg_office_scopes_updated_at before update on public.office_scopes for each row execute function public.set_updated_at();

create table if not exists public.office_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_categories_status_check check (status in ('active','inactive','archived','draft'))
);

drop trigger if exists trg_office_categories_updated_at on public.office_categories;
create trigger trg_office_categories_updated_at before update on public.office_categories for each row execute function public.set_updated_at();

create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_chart_id uuid not null references public.organization_charts(id) on delete cascade,
  parent_unit_id uuid references public.organization_units(id) on delete set null,
  ecclesiastical_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  pastoral_entity_id uuid references public.pastoral_entities(id) on delete set null,
  key text,
  name text not null,
  description text,
  sort_order integer not null default 100,
  visibility text not null default 'public',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_units_visibility_check check (visibility in ('public','internal','private')),
  constraint organization_units_status_check check (status in ('active','inactive','archived','draft'))
);

create index if not exists idx_organization_units_chart on public.organization_units(organization_chart_id);
create index if not exists idx_organization_units_parent on public.organization_units(parent_unit_id);
create unique index if not exists uq_organization_units_chart_key on public.organization_units(organization_chart_id, key) where key is not null;

drop trigger if exists trg_organization_units_updated_at on public.organization_units;
create trigger trg_organization_units_updated_at before update on public.organization_units for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702222132_037a_organization_chart_schema.sql

-- BEGIN MIGRATION 20260702222145_037b_position_assignment_schema.sql
create table if not exists public.office_configurations (
  id uuid primary key default gen_random_uuid(),
  base_role_id uuid not null references public.office_base_roles(id) on delete restrict,
  scope_id uuid not null references public.office_scopes(id) on delete restrict,
  category_id uuid not null references public.office_categories(id) on delete restrict,
  organization_chart_id uuid references public.organization_charts(id) on delete set null,
  key text not null unique,
  display_name text not null,
  description text,
  requires_clergy boolean not null default false,
  allowed_person_types text[] not null default array['bishop','priest','deacon','religious','lay'],
  is_elective boolean not null default false,
  is_renewable boolean not null default true,
  default_term_months integer,
  continues_until_replaced boolean not null default true,
  sort_order integer not null default 100,
  visibility text not null default 'public',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_configurations_visibility_check check (visibility in ('public','internal','private')),
  constraint office_configurations_status_check check (status in ('active','inactive','archived','draft')),
  constraint office_configurations_term_check check (default_term_months is null or default_term_months > 0)
);

create index if not exists idx_office_configurations_base on public.office_configurations(base_role_id);
create index if not exists idx_office_configurations_scope on public.office_configurations(scope_id);
create index if not exists idx_office_configurations_category on public.office_configurations(category_id);
create index if not exists idx_office_configurations_chart on public.office_configurations(organization_chart_id);

drop trigger if exists trg_office_configurations_updated_at on public.office_configurations;
create trigger trg_office_configurations_updated_at before update on public.office_configurations for each row execute function public.set_updated_at();

create table if not exists public.position_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.persons(id) on delete set null,
  office_configuration_id uuid not null references public.office_configurations(id) on delete restrict,
  organization_chart_id uuid references public.organization_charts(id) on delete set null,
  organization_unit_id uuid references public.organization_units(id) on delete set null,
  ecclesiastical_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  pastoral_entity_id uuid references public.pastoral_entities(id) on delete set null,
  title_override text,
  start_date date,
  term_start_date date,
  term_end_date date,
  actual_end_date date,
  is_current boolean not null default true,
  assignment_status text not null default 'active',
  selection_method text not null default 'appointment',
  renewed_from_assignment_id uuid references public.position_assignments(id) on delete set null,
  replaced_by_assignment_id uuid references public.position_assignments(id) on delete set null,
  notes_public text,
  notes_internal text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review',
  visibility text not null default 'public',
  record_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint position_assignments_status_check check (assignment_status in ('active','term_expired_still_serving','renewed','replaced','vacant','suspended','ended')),
  constraint position_assignments_selection_check check (selection_method in ('appointment','election','confirmation','ex_officio','other')),
  constraint position_assignments_visibility_check check (visibility in ('public','internal','private')),
  constraint position_assignments_record_status_check check (record_status in ('active','inactive','archived','draft')),
  constraint position_assignments_verification_check check (verification_status in ('verified','pending_review','needs_correction','disputed'))
);

create index if not exists idx_position_assignments_person on public.position_assignments(person_id);
create index if not exists idx_position_assignments_configuration on public.position_assignments(office_configuration_id);
create index if not exists idx_position_assignments_chart on public.position_assignments(organization_chart_id);
create index if not exists idx_position_assignments_unit on public.position_assignments(organization_unit_id);
create index if not exists idx_position_assignments_entity on public.position_assignments(ecclesiastical_entity_id);
create index if not exists idx_position_assignments_pastoral on public.position_assignments(pastoral_entity_id);
create index if not exists idx_position_assignments_current on public.position_assignments(is_current, assignment_status);

drop trigger if exists trg_position_assignments_updated_at on public.position_assignments;
create trigger trg_position_assignments_updated_at before update on public.position_assignments for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702222145_037b_position_assignment_schema.sql

-- BEGIN MIGRATION 20260702224043_038_position_assignment_predecessor_successor.sql
alter table public.position_assignments
  add column if not exists predecessor_assignment_id uuid references public.position_assignments(id) on delete set null,
  add column if not exists successor_assignment_id uuid references public.position_assignments(id) on delete set null;

create index if not exists idx_position_assignments_predecessor on public.position_assignments(predecessor_assignment_id);
create index if not exists idx_position_assignments_successor on public.position_assignments(successor_assignment_id);

comment on column public.position_assignments.predecessor_assignment_id is 'Asignación o titular anterior en el mismo cargo o función.';
comment on column public.position_assignments.successor_assignment_id is 'Asignación o titular posterior en el mismo cargo o función.';
comment on column public.position_assignments.replaced_by_assignment_id is 'Asignación que sustituyó formalmente esta asignación.';
comment on column public.position_assignments.renewed_from_assignment_id is 'Asignación anterior de la misma persona cuando el cargo fue renovado.';

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702224043_038_position_assignment_predecessor_successor.sql

-- BEGIN MIGRATION 20260702224109_039_position_assignment_views_with_successors.sql
drop view if exists public.public_position_assignments;
create view public.public_position_assignments with (security_invoker = true) as
select
  pa.id,
  pa.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  p.person_type,
  pa.office_configuration_id,
  coalesce(pa.title_override, oc.display_name) as position_title,
  oc.key as office_configuration_key,
  br.name as base_role_name,
  sc.name as scope_name,
  cat.name as category_name,
  ch.name as organization_chart_name,
  ch.key as organization_chart_key,
  ou.name as organization_unit_name,
  ee.name as ecclesiastical_entity_name,
  ee.slug as ecclesiastical_entity_slug,
  pe.name as pastoral_entity_name,
  pe.slug as pastoral_entity_slug,
  pred.person_id as predecessor_person_id,
  pred_person.display_name as predecessor_person_name,
  pred_person.slug as predecessor_person_slug,
  succ.person_id as successor_person_id,
  succ_person.display_name as successor_person_name,
  succ_person.slug as successor_person_slug,
  pa.start_date,
  pa.term_start_date,
  pa.term_end_date,
  pa.actual_end_date,
  pa.is_current,
  pa.assignment_status,
  pa.selection_method,
  pa.notes_public,
  pa.verification_status
from public.position_assignments pa
left join public.persons p on p.id = pa.person_id
join public.office_configurations oc on oc.id = pa.office_configuration_id
join public.office_base_roles br on br.id = oc.base_role_id
join public.office_scopes sc on sc.id = oc.scope_id
join public.office_categories cat on cat.id = oc.category_id
left join public.organization_charts ch on ch.id = pa.organization_chart_id
left join public.organization_units ou on ou.id = pa.organization_unit_id
left join public.ecclesiastical_entities ee on ee.id = pa.ecclesiastical_entity_id
left join public.pastoral_entities pe on pe.id = pa.pastoral_entity_id
left join public.position_assignments pred on pred.id = pa.predecessor_assignment_id
left join public.persons pred_person on pred_person.id = pred.person_id
left join public.position_assignments succ on succ.id = pa.successor_assignment_id
left join public.persons succ_person on succ_person.id = succ.person_id
where pa.record_status = 'active' and pa.visibility = 'public';

notify pgrst, 'reload schema';;
-- END MIGRATION 20260702224109_039_position_assignment_views_with_successors.sql

-- BEGIN MIGRATION 20260702225952_040_position_assignment_admin_access.sql
grant select, insert, update on public.position_assignments to authenticated;
grant select on public.public_position_assignments to authenticated;
grant select on public.office_configurations to authenticated;
grant select on public.organization_charts to authenticated;
grant select on public.organization_units to authenticated;
grant select on public.office_base_roles to authenticated;
grant select on public.office_scopes to authenticated;
grant select on public.office_categories to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702225952_040_position_assignment_admin_access.sql

-- BEGIN MIGRATION 20260702230021_041_public_position_view_grant.sql
grant select on public.public_position_assignments to anon;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702230021_041_public_position_view_grant.sql

-- BEGIN MIGRATION 20260702230415_042_entity_hierarchy_paths_simple.sql
drop view if exists public.public_entity_hierarchy_paths;
create view public.public_entity_hierarchy_paths as
select
  e.id as direct_entity_id,
  e.name as direct_entity_name,
  e.slug as direct_entity_slug,
  et.key as direct_entity_type_key,
  et.name as direct_entity_type_name,
  case when et.key in ('parish','quasi_parish') then e.name end as parish_name,
  case when et.key in ('parish','quasi_parish') then e.slug end as parish_slug,
  coalesce(
    case when et.key in ('pastoral_zone','deanery','pastoral_region') then e.name end,
    case when t1.key in ('pastoral_zone','deanery','pastoral_region') then p1.name end,
    case when t2.key in ('pastoral_zone','deanery','pastoral_region') then p2.name end,
    case when t3.key in ('pastoral_zone','deanery','pastoral_region') then p3.name end
  ) as zone_name,
  coalesce(
    case when et.key in ('pastoral_zone','deanery','pastoral_region') then e.slug end,
    case when t1.key in ('pastoral_zone','deanery','pastoral_region') then p1.slug end,
    case when t2.key in ('pastoral_zone','deanery','pastoral_region') then p2.slug end,
    case when t3.key in ('pastoral_zone','deanery','pastoral_region') then p3.slug end
  ) as zone_slug,
  coalesce(case when et.key = 'vicariate' then e.name end, case when t1.key = 'vicariate' then p1.name end, case when t2.key = 'vicariate' then p2.name end, case when t3.key = 'vicariate' then p3.name end) as vicariate_name,
  coalesce(case when et.key = 'vicariate' then e.slug end, case when t1.key = 'vicariate' then p1.slug end, case when t2.key = 'vicariate' then p2.slug end, case when t3.key = 'vicariate' then p3.slug end) as vicariate_slug,
  coalesce(
    case when et.key in ('archdiocese','diocese','military_ordinariate') then e.name end,
    case when t1.key in ('archdiocese','diocese','military_ordinariate') then p1.name end,
    case when t2.key in ('archdiocese','diocese','military_ordinariate') then p2.name end,
    case when t3.key in ('archdiocese','diocese','military_ordinariate') then p3.name end
  ) as diocese_name,
  coalesce(
    case when et.key in ('archdiocese','diocese','military_ordinariate') then e.slug end,
    case when t1.key in ('archdiocese','diocese','military_ordinariate') then p1.slug end,
    case when t2.key in ('archdiocese','diocese','military_ordinariate') then p2.slug end,
    case when t3.key in ('archdiocese','diocese','military_ordinariate') then p3.slug end
  ) as diocese_slug,
  concat_ws(' / ', p3.name, p2.name, p1.name, e.name) as hierarchy_path
from public.ecclesiastical_entities e
left join public.entity_types et on et.id = e.entity_type_id
left join public.entity_relationships r1 on r1.child_entity_id = e.id and r1.is_current = true and r1.status = 'active'
left join public.ecclesiastical_entities p1 on p1.id = r1.parent_entity_id
left join public.entity_types t1 on t1.id = p1.entity_type_id
left join public.entity_relationships r2 on r2.child_entity_id = p1.id and r2.is_current = true and r2.status = 'active'
left join public.ecclesiastical_entities p2 on p2.id = r2.parent_entity_id
left join public.entity_types t2 on t2.id = p2.entity_type_id
left join public.entity_relationships r3 on r3.child_entity_id = p2.id and r3.is_current = true and r3.status = 'active'
left join public.ecclesiastical_entities p3 on p3.id = r3.parent_entity_id
left join public.entity_types t3 on t3.id = p3.entity_type_id
where e.status = 'active';
grant select on public.public_entity_hierarchy_paths to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702230415_042_entity_hierarchy_paths_simple.sql

-- BEGIN MIGRATION 20260702230426_043_position_assignments_with_hierarchy.sql
drop view if exists public.public_position_assignments_with_hierarchy;
create view public.public_position_assignments_with_hierarchy as
select
  pa.id,
  pa.person_id,
  p.display_name as person_name,
  p.slug as person_slug,
  p.person_type,
  pa.office_configuration_id,
  coalesce(pa.title_override, oc.display_name) as position_title,
  oc.key as office_configuration_key,
  br.name as base_role_name,
  sc.name as scope_name,
  cat.name as category_name,
  ch.name as organization_chart_name,
  ch.key as organization_chart_key,
  ou.name as organization_unit_name,
  h.direct_entity_name,
  h.direct_entity_slug,
  h.direct_entity_type_name,
  h.parish_name,
  h.parish_slug,
  h.zone_name,
  h.zone_slug,
  h.vicariate_name,
  h.vicariate_slug,
  h.diocese_name,
  h.diocese_slug,
  h.hierarchy_path,
  pe.name as pastoral_entity_name,
  pe.slug as pastoral_entity_slug,
  pred.person_id as predecessor_person_id,
  pred_person.display_name as predecessor_person_name,
  pred_person.slug as predecessor_person_slug,
  succ.person_id as successor_person_id,
  succ_person.display_name as successor_person_name,
  succ_person.slug as successor_person_slug,
  pa.start_date,
  pa.term_start_date,
  pa.term_end_date,
  pa.actual_end_date,
  pa.is_current,
  pa.assignment_status,
  pa.selection_method,
  pa.notes_public,
  pa.verification_status
from public.position_assignments pa
left join public.persons p on p.id = pa.person_id
join public.office_configurations oc on oc.id = pa.office_configuration_id
join public.office_base_roles br on br.id = oc.base_role_id
join public.office_scopes sc on sc.id = oc.scope_id
join public.office_categories cat on cat.id = oc.category_id
left join public.organization_charts ch on ch.id = pa.organization_chart_id
left join public.organization_units ou on ou.id = pa.organization_unit_id
left join public.public_entity_hierarchy_paths h on h.direct_entity_id = pa.ecclesiastical_entity_id
left join public.pastoral_entities pe on pe.id = pa.pastoral_entity_id
left join public.position_assignments pred on pred.id = pa.predecessor_assignment_id
left join public.persons pred_person on pred_person.id = pred.person_id
left join public.position_assignments succ on succ.id = pa.successor_assignment_id
left join public.persons succ_person on succ_person.id = succ.person_id
where pa.record_status = 'active' and pa.visibility = 'public';
grant select on public.public_position_assignments_with_hierarchy to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702230426_043_position_assignments_with_hierarchy.sql

-- BEGIN MIGRATION 20260702231831_044_admin_structure_access.sql
grant select, insert, update on public.entity_relationships to authenticated;
grant select, insert, update on public.pastoral_relationships to authenticated;
grant select, insert, update on public.organization_units to authenticated;
grant select on public.ecclesiastical_entities to authenticated;
grant select on public.pastoral_entities to authenticated;
grant select on public.organization_charts to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702231831_044_admin_structure_access.sql

-- BEGIN MIGRATION 20260702232441_045_data_quality_completion_core.sql
create table if not exists public.data_field_statuses (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  field_name text not null,
  status text not null default 'unknown' check (status in ('unknown','not_applicable','verified')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_table, record_id, field_name)
);

alter table public.data_field_statuses enable row level security;

drop policy if exists data_field_statuses_admin_all on public.data_field_statuses;
create policy data_field_statuses_admin_all on public.data_field_statuses
for all using (public.current_user_is_admin()) with check (public.current_user_is_admin());

grant select, insert, update on public.data_field_statuses to authenticated;

create or replace view public.admin_entity_completeness as
select
  e.id,
  e.name,
  e.slug,
  et.key as entity_type_key,
  et.name as entity_type_name,
  8 as required_count,
  cardinality(array_remove(array[
    case when nullif(trim(coalesce(e.name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='name' and s.status in ('unknown','not_applicable')) then 'name' end,
    case when nullif(trim(coalesce(e.official_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='official_name' and s.status in ('unknown','not_applicable')) then 'official_name' end,
    case when nullif(trim(coalesce(e.address,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='address' and s.status in ('unknown','not_applicable')) then 'address' end,
    case when nullif(trim(coalesce(e.phone,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='phone' and s.status in ('unknown','not_applicable')) then 'phone' end,
    case when nullif(trim(coalesce(e.territory_summary,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='territory_summary' and s.status in ('unknown','not_applicable')) then 'territory_summary' end,
    case when e.erected_at is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='erected_at' and s.status in ('unknown','not_applicable')) then 'erected_at' end,
    case when nullif(trim(coalesce(e.email,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='email' and s.status in ('unknown','not_applicable')) then 'email' end,
    case when nullif(trim(coalesce(e.website,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='website' and s.status in ('unknown','not_applicable')) then 'website' end
  ], null)) as missing_count,
  array_remove(array[
    case when nullif(trim(coalesce(e.name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='name' and s.status in ('unknown','not_applicable')) then 'Nombre' end,
    case when nullif(trim(coalesce(e.official_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='official_name' and s.status in ('unknown','not_applicable')) then 'Nombre oficial' end,
    case when nullif(trim(coalesce(e.address,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='address' and s.status in ('unknown','not_applicable')) then 'Dirección' end,
    case when nullif(trim(coalesce(e.phone,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='phone' and s.status in ('unknown','not_applicable')) then 'Teléfono' end,
    case when nullif(trim(coalesce(e.territory_summary,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='territory_summary' and s.status in ('unknown','not_applicable')) then 'Territorio' end,
    case when e.erected_at is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='erected_at' and s.status in ('unknown','not_applicable')) then 'Fecha de erección/creación' end,
    case when nullif(trim(coalesce(e.email,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='email' and s.status in ('unknown','not_applicable')) then 'Correo' end,
    case when nullif(trim(coalesce(e.website,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='website' and s.status in ('unknown','not_applicable')) then 'Sitio web' end
  ], null) as missing_fields,
  round(((8 - cardinality(array_remove(array[
    case when nullif(trim(coalesce(e.name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='name' and s.status in ('unknown','not_applicable')) then 'name' end,
    case when nullif(trim(coalesce(e.official_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='official_name' and s.status in ('unknown','not_applicable')) then 'official_name' end,
    case when nullif(trim(coalesce(e.address,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='address' and s.status in ('unknown','not_applicable')) then 'address' end,
    case when nullif(trim(coalesce(e.phone,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='phone' and s.status in ('unknown','not_applicable')) then 'phone' end,
    case when nullif(trim(coalesce(e.territory_summary,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='territory_summary' and s.status in ('unknown','not_applicable')) then 'territory_summary' end,
    case when e.erected_at is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='erected_at' and s.status in ('unknown','not_applicable')) then 'erected_at' end,
    case when nullif(trim(coalesce(e.email,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='email' and s.status in ('unknown','not_applicable')) then 'email' end,
    case when nullif(trim(coalesce(e.website,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='ecclesiastical_entities' and s.record_id=e.id and s.field_name='website' and s.status in ('unknown','not_applicable')) then 'website' end
  ], null)))::numeric / 8) * 100, 0)::int as completion_percent
from public.ecclesiastical_entities e
left join public.entity_types et on et.id = e.entity_type_id
where e.status = 'active';

grant select on public.admin_entity_completeness to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702232441_045_data_quality_completion_core.sql

-- BEGIN MIGRATION 20260702232528_046_person_completeness_view_v2.sql
create or replace view public.admin_person_completeness as
select
  p.id,
  p.display_name as name,
  p.slug,
  p.person_type,
  6 as required_count,
  cardinality(array_remove(array[
    case when nullif(trim(coalesce(p.display_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='display_name' and s.status in ('unknown','not_applicable')) then 'display_name' end,
    case when nullif(trim(coalesce(p.person_type,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='person_type' and s.status in ('unknown','not_applicable')) then 'person_type' end,
    case when nullif(trim(coalesce(p.gender,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='gender' and s.status in ('unknown','not_applicable')) then 'gender' end,
    case when p.birth_date is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_date' and s.status in ('unknown','not_applicable')) then 'birth_date' end,
    case when nullif(trim(coalesce(p.birth_place,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_place' and s.status in ('unknown','not_applicable')) then 'birth_place' end,
    case when nullif(trim(coalesce(p.biography_public,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='biography_public' and s.status in ('unknown','not_applicable')) then 'biography_public' end
  ], null)) as missing_count,
  array_remove(array[
    case when nullif(trim(coalesce(p.display_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='display_name' and s.status in ('unknown','not_applicable')) then 'Nombre' end,
    case when nullif(trim(coalesce(p.person_type,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='person_type' and s.status in ('unknown','not_applicable')) then 'Tipo de persona' end,
    case when nullif(trim(coalesce(p.gender,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='gender' and s.status in ('unknown','not_applicable')) then 'Género' end,
    case when p.birth_date is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_date' and s.status in ('unknown','not_applicable')) then 'Fecha de nacimiento' end,
    case when nullif(trim(coalesce(p.birth_place,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_place' and s.status in ('unknown','not_applicable')) then 'Lugar de nacimiento' end,
    case when nullif(trim(coalesce(p.biography_public,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='biography_public' and s.status in ('unknown','not_applicable')) then 'Biografía pública' end
  ], null) as missing_fields,
  round(((6 - cardinality(array_remove(array[
    case when nullif(trim(coalesce(p.display_name,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='display_name' and s.status in ('unknown','not_applicable')) then 'display_name' end,
    case when nullif(trim(coalesce(p.person_type,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='person_type' and s.status in ('unknown','not_applicable')) then 'person_type' end,
    case when nullif(trim(coalesce(p.gender,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='gender' and s.status in ('unknown','not_applicable')) then 'gender' end,
    case when p.birth_date is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_date' and s.status in ('unknown','not_applicable')) then 'birth_date' end,
    case when nullif(trim(coalesce(p.birth_place,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='birth_place' and s.status in ('unknown','not_applicable')) then 'birth_place' end,
    case when nullif(trim(coalesce(p.biography_public,'')), '') is null and not exists (select 1 from public.data_field_statuses s where s.record_table='persons' and s.record_id=p.id and s.field_name='biography_public' and s.status in ('unknown','not_applicable')) then 'biography_public' end
  ], null)))::numeric / 6) * 100, 0)::int as completion_percent
from public.persons p
where p.status = 'active';

grant select on public.admin_person_completeness to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702232528_046_person_completeness_view_v2.sql

-- BEGIN MIGRATION 20260702233007_047_admin_entity_create_access.sql
grant select on public.entity_types to authenticated;
grant select, insert, update on public.ecclesiastical_entities to authenticated;
grant select, insert, update on public.entity_relationships to authenticated;
grant select, insert, update on public.data_field_statuses to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260702233007_047_admin_entity_create_access.sql

-- BEGIN MIGRATION 20260703031553_048_admin_person_create_access.sql
grant select, insert, update on public.persons to authenticated;
grant select, insert, update on public.clergy_profiles to authenticated;
grant select on public.public_entity_hierarchy_paths to authenticated;
grant select, insert, update on public.data_field_statuses to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703031553_048_admin_person_create_access.sql

-- BEGIN MIGRATION 20260703031852_049_quick_assignment_access.sql
grant select on public.office_configurations to authenticated;
grant select on public.office_base_roles to authenticated;
grant select on public.office_scopes to authenticated;
grant select on public.office_categories to authenticated;
grant select on public.organization_charts to authenticated;
grant select on public.organization_units to authenticated;
grant select, insert, update on public.position_assignments to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703031852_049_quick_assignment_access.sql

-- BEGIN MIGRATION 20260703032312_050_bishop_wizard_access.sql
grant select, insert, update on public.persons to authenticated;
grant select, insert, update on public.clergy_profiles to authenticated;
grant select, insert, update on public.episcopal_ordinations to authenticated;
grant select, insert, update on public.position_assignments to authenticated;
grant select on public.office_configurations to authenticated;
grant select on public.public_entity_hierarchy_paths to authenticated;
grant select, insert, update on public.data_field_statuses to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703032312_050_bishop_wizard_access.sql

-- BEGIN MIGRATION 20260703040048_051_canonical_office_definitions.sql
create table if not exists public.canonical_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  source_type text not null default 'canon_law',
  url text,
  language text not null default 'es',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canonical_office_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  short_definition text not null,
  full_definition text,
  canon_reference text not null,
  source_id uuid references public.canonical_sources(id),
  requires_priest boolean not null default false,
  requires_bishop boolean not null default false,
  canonical_context text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.office_canonical_links (
  id uuid primary key default gen_random_uuid(),
  office_configuration_id uuid references public.office_configurations(id) on delete cascade,
  base_role_id uuid references public.office_base_roles(id) on delete cascade,
  canonical_office_definition_id uuid not null references public.canonical_office_definitions(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_canonical_links_target_check check (office_configuration_id is not null or base_role_id is not null)
);

create unique index if not exists office_canonical_links_config_unique on public.office_canonical_links(office_configuration_id) where office_configuration_id is not null;
create unique index if not exists office_canonical_links_base_role_unique on public.office_canonical_links(base_role_id) where base_role_id is not null;

insert into public.canonical_sources (key, title, source_type, url, language, status)
values
  ('cic_1983_offices', 'Código de Derecho Canónico, oficios eclesiásticos, cc. 145-196', 'canon_law', 'https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib1-cann145-196_en.html', 'es', 'active'),
  ('cic_1983_particular_churches', 'Código de Derecho Canónico, Iglesias particulares y obispos, cc. 368-430', 'canon_law', 'https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib2-cann368-430_en.html', 'es', 'active'),
  ('cic_1983_groupings', 'Código de Derecho Canónico, agrupaciones de Iglesias particulares, cc. 431-459', 'canon_law', 'https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib2-cann431-459_en.html', 'es', 'active'),
  ('cic_1983_internal_ordering', 'Código de Derecho Canónico, ordenación interna de las Iglesias particulares, cc. 460-572', 'canon_law', 'https://www.vatican.va/archive/cod-iuris-canonici/eng/documents/cic_lib2-cann460-572_en.html', 'es', 'active')
on conflict (key) do update set title = excluded.title, url = excluded.url, updated_at = now();

with sources as (
  select key, id from public.canonical_sources
)
insert into public.canonical_office_definitions (
  key,
  name,
  short_definition,
  full_definition,
  canon_reference,
  source_id,
  requires_priest,
  requires_bishop,
  canonical_context,
  status
)
values
  ('ecclesiastical_office', 'Oficio eclesiástico', 'Función estable constituida por disposición divina o eclesiástica para un fin espiritual.', 'Base general para todo cargo eclesial. Sus derechos y obligaciones se determinan por la ley que lo constituye o por el decreto de la autoridad competente que lo confiere.', 'c. 145; cc. 146-196', (select id from sources where key='cic_1983_offices'), false, false, 'Norma general de cargos', 'active'),
  ('diocesan_bishop', 'Obispo diocesano', 'Obispo a quien se confía el cuidado pastoral de una diócesis.', 'En la diócesis encomendada tiene la potestad ordinaria, propia e inmediata necesaria para ejercer su función pastoral, salvo las reservas previstas por el derecho o por decreto del Romano Pontífice.', 'cc. 375-376; c. 381; cc. 391-393', (select id from sources where key='cic_1983_particular_churches'), false, true, 'Gobierno de Iglesia particular', 'active'),
  ('coadjutor_bishop', 'Obispo coadjutor', 'Obispo que ayuda al obispo diocesano y posee derecho de sucesión.', 'Es nombrado por la Santa Sede cuando parece oportuno, normalmente con facultades especiales. Al quedar vacante la sede, sucede al obispo de la diócesis si tomó posesión legítimamente.', 'cc. 403-411', (select id from sources where key='cic_1983_particular_churches'), false, true, 'Gobierno episcopal', 'active'),
  ('auxiliary_bishop', 'Obispo auxiliar', 'Obispo nombrado para ayudar pastoralmente al obispo diocesano sin derecho de sucesión.', 'Puede ser nombrado cuando las necesidades pastorales de una diócesis lo aconsejan. Debe ejercer su oficio en armonía con el obispo diocesano y conforme a la carta de nombramiento.', 'cc. 403-411', (select id from sources where key='cic_1983_particular_churches'), false, true, 'Gobierno episcopal', 'active'),
  ('metropolitan_archbishop', 'Arzobispo metropolitano', 'Arzobispo de la sede metropolitana que preside una provincia eclesiástica.', 'Preside la provincia eclesiástica. Sus facultades sobre las diócesis sufragáneas son las previstas por el derecho; no debe confundirse con gobierno ordinario directo sobre esas diócesis.', 'cc. 431-438', (select id from sources where key='cic_1983_groupings'), false, true, 'Provincia eclesiástica', 'active'),
  ('episcopal_conference_president', 'Presidente de conferencia episcopal', 'Obispo que preside la conferencia episcopal según sus estatutos y el derecho.', 'La conferencia episcopal es institución permanente de obispos de una nación o territorio. Sus estatutos deben prever, entre otros órganos y oficios, presidente, pro-presidente, consejo permanente y secretaría general.', 'cc. 447-459; especialmente cc. 451-452', (select id from sources where key='cic_1983_groupings'), false, true, 'Conferencia episcopal', 'active'),
  ('general_secretary_episcopal_conference', 'Secretario general de conferencia episcopal', 'Oficio de la conferencia episcopal previsto por sus estatutos para preparar y comunicar actos conforme al derecho.', 'La conferencia debe contar con secretaría general y estatutos propios. El secretario general prepara la relación de actos y decretos de la plenaria y del consejo permanente, y comunica actos según el derecho.', 'cc. 451-452; c. 458', (select id from sources where key='cic_1983_groupings'), false, false, 'Conferencia episcopal', 'active'),
  ('vicar_general', 'Vicario general', 'Sacerdote con potestad ordinaria para ayudar al obispo en el gobierno de toda la diócesis.', 'En cada diócesis debe nombrarse un vicario general, salvo las excepciones pastorales previstas por el derecho. Lo nombra libremente el obispo diocesano.', 'cc. 475-481', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Curia diocesana', 'active'),
  ('episcopal_vicar', 'Vicario episcopal', 'Sacerdote con potestad ordinaria como la del vicario general, limitada a un territorio, asunto, rito o grupo de fieles.', 'Puede ser nombrado cuando el buen gobierno de la diócesis lo requiera. Su ámbito específico queda determinado por el acto de nombramiento y por el derecho.', 'cc. 476-481', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Curia diocesana', 'active'),
  ('chancellor', 'Canciller', 'Oficio de la curia encargado de documentos, actas y archivo conforme al derecho.', 'La curia diocesana debe contar con un canciller cuya función principal es cuidar que se redacten, expidan y custodien las actas de la curia en el archivo correspondiente.', 'cc. 482-491', (select id from sources where key='cic_1983_internal_ordering'), false, false, 'Curia diocesana', 'active'),
  ('finance_officer', 'Ecónomo diocesano', 'Responsable de administrar los bienes de la diócesis bajo la autoridad del obispo y conforme al consejo de asuntos económicos.', 'El obispo debe nombrar un ecónomo verdaderamente experto en economía y distinguido por honradez, con funciones de administración según el modo determinado por el consejo de asuntos económicos.', 'cc. 492-494', (select id from sources where key='cic_1983_internal_ordering'), false, false, 'Administración económica diocesana', 'active'),
  ('pastor', 'Párroco', 'Sacerdote a quien se confía una parroquia como pastor propio bajo la autoridad del obispo diocesano.', 'Ejerce la cura pastoral de la comunidad parroquial mediante las funciones de enseñar, santificar y gobernar, con cooperación de otros presbíteros o diáconos y ayuda de fieles laicos conforme al derecho.', 'cc. 515-552; especialmente cc. 519-521', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Parroquia', 'active'),
  ('parochial_vicar', 'Vicario parroquial', 'Sacerdote que ayuda al párroco en el ministerio parroquial.', 'Sus derechos y obligaciones se definen por los cánones, estatutos diocesanos, carta del obispo y mandato del párroco. Asiste al párroco en todo el ministerio parroquial salvo lo exceptuado por el derecho.', 'cc. 545-552', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Parroquia', 'active'),
  ('vicar_forane', 'Vicario foráneo / decano / arcipreste', 'Sacerdote puesto al frente de un vicariato foráneo, decanato o estructura equivalente.', 'Promueve y coordina la actividad pastoral común en su distrito y cuida aspectos disciplinares, pastorales y administrativos indicados por el derecho y el derecho particular.', 'cc. 553-555', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Agrupación de parroquias', 'active'),
  ('rector_church', 'Rector de iglesia', 'Sacerdote a quien se encomienda el cuidado de una iglesia que no es parroquial ni capitular ni propia de una comunidad religiosa.', 'Cuida que las funciones sagradas se celebren dignamente y que se cumplan obligaciones, administración y conservación del lugar sagrado conforme al derecho.', 'cc. 556-563', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Iglesia no parroquial', 'active'),
  ('chaplain', 'Capellán', 'Sacerdote a quien se encomienda de modo estable la atención pastoral de una comunidad o grupo peculiar de fieles.', 'El oficio de capellán se define por el encargo estable de atención pastoral a una comunidad o grupo, conforme a las facultades y obligaciones determinadas por el derecho universal o particular.', 'cc. 564-572', (select id from sources where key='cic_1983_internal_ordering'), true, false, 'Atención pastoral especial', 'active')
on conflict (key) do update set
  name = excluded.name,
  short_definition = excluded.short_definition,
  full_definition = excluded.full_definition,
  canon_reference = excluded.canon_reference,
  source_id = excluded.source_id,
  requires_priest = excluded.requires_priest,
  requires_bishop = excluded.requires_bishop,
  canonical_context = excluded.canonical_context,
  status = excluded.status,
  updated_at = now();

create or replace view public.public_canonical_office_definitions as
select
  d.id,
  d.key,
  d.name,
  d.short_definition,
  d.full_definition,
  d.canon_reference,
  d.requires_priest,
  d.requires_bishop,
  d.canonical_context,
  s.title as source_title,
  s.url as source_url,
  d.status
from public.canonical_office_definitions d
left join public.canonical_sources s on s.id = d.source_id
where d.status = 'active';

create or replace view public.public_office_canonical_help as
select
  oc.id as office_configuration_id,
  oc.key as office_configuration_key,
  oc.display_name as office_display_name,
  br.id as base_role_id,
  br.key as base_role_key,
  br.name as base_role_name,
  d.key as canonical_key,
  d.name as canonical_name,
  d.short_definition,
  d.full_definition,
  d.canon_reference,
  d.requires_priest,
  d.requires_bishop,
  d.canonical_context,
  s.title as source_title,
  s.url as source_url
from public.office_configurations oc
left join public.office_base_roles br on br.id = oc.base_role_id
left join public.office_canonical_links l on l.office_configuration_id = oc.id or l.base_role_id = br.id
left join public.canonical_office_definitions d on d.id = l.canonical_office_definition_id and d.status = 'active'
left join public.canonical_sources s on s.id = d.source_id
where oc.status = 'active';

grant select on public.canonical_sources to authenticated;
grant select on public.canonical_office_definitions to authenticated;
grant select, insert, update on public.office_canonical_links to authenticated;
grant select on public.public_canonical_office_definitions to anon, authenticated;
grant select on public.public_office_canonical_help to anon, authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703040048_051_canonical_office_definitions.sql

-- BEGIN MIGRATION 20260703040131_052_canonical_link_upsert_constraints.sql
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'office_canonical_links_office_configuration_id_unique') then
    alter table public.office_canonical_links add constraint office_canonical_links_office_configuration_id_unique unique (office_configuration_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'office_canonical_links_base_role_id_unique') then
    alter table public.office_canonical_links add constraint office_canonical_links_base_role_id_unique unique (base_role_id);
  end if;
end $$;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703040131_052_canonical_link_upsert_constraints.sql

-- BEGIN MIGRATION 20260703042555_053_public_change_suggestions.sql
create table if not exists public.public_change_suggestions (
  id uuid primary key default gen_random_uuid(),
  target_table text not null,
  target_id uuid,
  target_slug text,
  target_title text,
  page_url text,
  suggestion_type text not null default 'correction',
  title text not null,
  description text not null,
  proposed_data jsonb not null default '{}'::jsonb,
  source_name text,
  source_url text,
  submitter_name text,
  submitter_email text,
  submitter_country text,
  status text not null default 'pending_review',
  priority text not null default 'normal',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  converted_change_request_id uuid references public.change_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_change_suggestions_status_idx on public.public_change_suggestions(status, created_at desc);
create index if not exists public_change_suggestions_target_idx on public.public_change_suggestions(target_table, target_id, target_slug);

alter table public.public_change_suggestions enable row level security;

drop policy if exists public_change_suggestions_public_insert on public.public_change_suggestions;
create policy public_change_suggestions_public_insert
on public.public_change_suggestions
for insert
to anon, authenticated
with check (status = 'pending_review');

drop policy if exists public_change_suggestions_admin_read on public.public_change_suggestions;
create policy public_change_suggestions_admin_read
on public.public_change_suggestions
for select
to authenticated
using (true);

drop policy if exists public_change_suggestions_admin_update on public.public_change_suggestions;
create policy public_change_suggestions_admin_update
on public.public_change_suggestions
for update
to authenticated
using (true)
with check (true);

create or replace view public.admin_public_change_suggestions as
select
  id,
  target_table,
  target_id,
  target_slug,
  target_title,
  page_url,
  suggestion_type,
  title,
  description,
  proposed_data,
  source_name,
  source_url,
  submitter_name,
  submitter_email,
  submitter_country,
  status,
  priority,
  reviewed_by,
  reviewed_at,
  review_notes,
  converted_change_request_id,
  created_at,
  updated_at
from public.public_change_suggestions;

grant insert on public.public_change_suggestions to anon, authenticated;
grant select, update on public.public_change_suggestions to authenticated;
grant select on public.admin_public_change_suggestions to authenticated;
notify pgrst, 'reload schema';;
-- END MIGRATION 20260703042555_053_public_change_suggestions.sql
