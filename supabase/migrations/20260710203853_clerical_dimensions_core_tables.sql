create table public.clerical_incardinations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  incardination_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  institute_name text,
  incardination_kind text not null default 'diocesan'
    check (incardination_kind in ('diocesan','religious_institute','society_apostolic_life','personal_prelature','military_ordinariate','other','unknown')),
  acquisition_method text not null default 'unknown'
    check (acquisition_method in ('ordination','incardination','transfer','profession','reception','unknown')),
  start_date date,
  end_date date,
  end_reason text check (end_reason is null or end_reason in ('excardination','transfer','death','lost_clerical_state','cessation','unknown')),
  is_current boolean not null default true,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','verified','needs_correction','disputed')),
  visibility text not null default 'internal'
    check (visibility in ('public','internal','private','confidential')),
  record_status text not null default 'active'
    check (record_status in ('active','inactive','archived','draft')),
  record_origin text not null default 'manual',
  notes_public text,
  notes_internal text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (incardination_entity_id is not null or nullif(btrim(institute_name), '') is not null),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.clerical_status_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  status_type text not null
    check (status_type in ('active','retired','emeritus','suspended','restricted','inactive','deceased','lost_clerical_state','unknown')),
  start_date date,
  end_date date,
  is_current boolean not null default true,
  reason text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','verified','needs_correction','disputed')),
  visibility text not null default 'internal'
    check (visibility in ('public','internal','private','confidential')),
  record_status text not null default 'active'
    check (record_status in ('active','inactive','archived','draft')),
  record_origin text not null default 'manual',
  notes_public text,
  notes_internal text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.episcopal_roles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  role_type text not null
    check (role_type in ('diocesan','auxiliary','coadjutor','titular','emeritus','apostolic_administrator','apostolic_vicar','apostolic_prefect','other')),
  jurisdiction_entity_id uuid references public.ecclesiastical_entities(id) on delete set null,
  title_see_name text,
  start_date date,
  end_date date,
  is_current boolean not null default true,
  has_right_of_succession boolean not null default false,
  source_appointment_id uuid unique references public.appointments(id) on delete set null,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','verified','needs_correction','disputed')),
  visibility text not null default 'public'
    check (visibility in ('public','internal','private','confidential')),
  record_status text not null default 'active'
    check (record_status in ('active','inactive','archived','draft')),
  record_origin text not null default 'manual',
  notes_public text,
  notes_internal text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (role_type <> 'coadjutor' or has_right_of_succession = true)
);

create table public.person_ecclesiastical_dignities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  dignity_type text not null
    check (dignity_type in ('archbishop','metropolitan','cardinal','monsignor','patriarch','major_archbishop','other')),
  title_text text,
  start_date date,
  end_date date,
  is_current boolean not null default true,
  source_appointment_id uuid references public.appointments(id) on delete set null,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review'
    check (verification_status in ('pending_review','verified','needs_correction','disputed')),
  visibility text not null default 'public'
    check (visibility in ('public','internal','private','confidential')),
  record_status text not null default 'active'
    check (record_status in ('active','inactive','archived','draft')),
  record_origin text not null default 'manual',
  notes_public text,
  notes_internal text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index clerical_incardinations_one_current_idx
  on public.clerical_incardinations(person_id)
  where is_current and record_status = 'active';
create index clerical_incardinations_person_history_idx
  on public.clerical_incardinations(person_id, start_date desc nulls last);
create index clerical_incardinations_entity_idx
  on public.clerical_incardinations(incardination_entity_id)
  where incardination_entity_id is not null;

create unique index clerical_status_history_one_current_idx
  on public.clerical_status_history(person_id)
  where is_current and record_status = 'active';
create index clerical_status_history_person_idx
  on public.clerical_status_history(person_id, start_date desc nulls last);
create index clerical_status_history_status_idx
  on public.clerical_status_history(status_type, is_current)
  where record_status = 'active';

create unique index episcopal_roles_current_identity_idx
  on public.episcopal_roles(person_id, role_type, coalesce(jurisdiction_entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_current and record_status = 'active';
create index episcopal_roles_person_history_idx
  on public.episcopal_roles(person_id, start_date desc nulls last);
create index episcopal_roles_jurisdiction_idx
  on public.episcopal_roles(jurisdiction_entity_id, is_current)
  where jurisdiction_entity_id is not null and record_status = 'active';

create unique index person_ecclesiastical_dignities_current_idx
  on public.person_ecclesiastical_dignities(person_id, dignity_type)
  where is_current and record_status = 'active';
create unique index person_ecclesiastical_dignities_source_idx
  on public.person_ecclesiastical_dignities(source_appointment_id, dignity_type)
  where source_appointment_id is not null;
create index person_ecclesiastical_dignities_person_idx
  on public.person_ecclesiastical_dignities(person_id, start_date desc nulls last);

create trigger clerical_incardinations_set_updated_at
before update on public.clerical_incardinations
for each row execute function public.set_updated_at();

create trigger clerical_status_history_set_updated_at
before update on public.clerical_status_history
for each row execute function public.set_updated_at();

create trigger episcopal_roles_set_updated_at
before update on public.episcopal_roles
for each row execute function public.set_updated_at();

create trigger person_ecclesiastical_dignities_set_updated_at
before update on public.person_ecclesiastical_dignities
for each row execute function public.set_updated_at();

comment on table public.clerical_incardinations is 'Historial canónico de incardinación o pertenencia clerical.';
comment on table public.clerical_status_history is 'Historial de estado canónico independiente del sacramento y de los cargos.';
comment on table public.episcopal_roles is 'Relaciones episcopales históricas con jurisdicciones.';
comment on table public.person_ecclesiastical_dignities is 'Títulos y dignidades que no constituyen grados del Orden.';