-- Jurisdiction organigram change engine.
-- Keeps the current organigram separate from public institutional history and internal audit.

create table if not exists public.jurisdiction_event_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  affects_organigram boolean not null default true,
  supports_publication boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(key)) > 0),
  check (length(btrim(name)) > 0)
);

insert into public.jurisdiction_event_types(key,name,description,affects_organigram,sort_order)
values
  ('erection','Erección','Creación canónica de una jurisdicción.',true,10),
  ('elevation','Elevación','Cambio documentado de rango o tipo jurisdiccional.',true,20),
  ('official_name_change','Cambio oficial de nombre','Cambio oficial documentado de la denominación.',false,30),
  ('dependency_change','Cambio de dependencia','Cambio documentado de la cuenta superior vigente.',true,40),
  ('division','División','Creación de una o varias jurisdicciones a partir de otra.',true,50),
  ('union','Unión','Integración documentada de jurisdicciones.',true,60),
  ('suppression','Supresión','Cese canónico de una jurisdicción.',true,70),
  ('restoration','Restauración','Restablecimiento canónico de una jurisdicción.',true,80),
  ('territorial_change','Modificación territorial','Cambio territorial con relevancia jurisdiccional.',false,90),
  ('other_documented_event','Otro evento documentado','Acontecimiento institucional documentado no cubierto por otro tipo.',false,999)
on conflict(key) do update set
  name=excluded.name,
  description=excluded.description,
  affects_organigram=excluded.affects_organigram,
  sort_order=excluded.sort_order,
  updated_at=now();

create table if not exists public.jurisdiction_change_operations (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (origin in ('historical_event','organizational_change','administrative_correction')),
  status text not null default 'draft' check (status in ('draft','validated','applied','rejected','reverted')),
  publication_status text not null default 'internal' check (publication_status in ('internal','draft','reviewed','published')),
  primary_account_id uuid not null references public.jurisdiction_accounts(id) on delete restrict,
  event_type_id uuid references public.jurisdiction_event_types(id) on delete restrict,
  effective_date date,
  reason text not null,
  public_title text,
  public_summary text,
  source_document_id uuid references public.documents(id) on delete set null,
  external_reference text,
  operation_source text not null default 'admin_organigram' check (operation_source in ('admin_organigram','admin_detail','import','migration','system')),
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  applied_by uuid references auth.users(id) on delete set null,
  rejected_by uuid references auth.users(id) on delete set null,
  reverted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  applied_at timestamptz,
  rejected_at timestamptz,
  reverted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (length(btrim(reason)) > 0),
  check (
    origin <> 'historical_event'
    or (
      event_type_id is not null
      and effective_date is not null
      and source_document_id is not null
    )
  ),
  check (
    publication_status <> 'published'
    or (
      origin='historical_event'
      and status='applied'
      and public_title is not null
      and length(btrim(public_title)) > 0
      and public_summary is not null
      and length(btrim(public_summary)) > 0
    )
  ),
  check (origin='historical_event' or publication_status='internal'),
  check (status<>'applied' or applied_at is not null),
  check (status<>'rejected' or rejected_at is not null),
  check (status<>'reverted' or reverted_at is not null)
);

create index if not exists jurisdiction_change_operations_primary_idx
  on public.jurisdiction_change_operations(primary_account_id,effective_date desc,created_at desc);
create index if not exists jurisdiction_change_operations_review_idx
  on public.jurisdiction_change_operations(status,origin,created_at desc);
create index if not exists jurisdiction_change_operations_public_idx
  on public.jurisdiction_change_operations(effective_date desc)
  where origin='historical_event' and status='applied' and publication_status='published';

create table if not exists public.jurisdiction_change_operation_accounts (
  operation_id uuid not null references public.jurisdiction_change_operations(id) on delete cascade,
  account_id uuid not null references public.jurisdiction_accounts(id) on delete restrict,
  role text not null check (role in ('primary','origin','destination','predecessor','successor','related')),
  created_at timestamptz not null default now(),
  primary key(operation_id,account_id,role)
);

create unique index if not exists jurisdiction_change_operation_one_primary_idx
  on public.jurisdiction_change_operation_accounts(operation_id)
  where role='primary';

create table if not exists public.jurisdiction_change_effects (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.jurisdiction_change_operations(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  target_type text not null check (target_type in ('account','edge')),
  target_id uuid,
  action text not null check (action in (
    'create_account',
    'update_account',
    'activate_account',
    'deactivate_account',
    'create_dependency',
    'close_dependency'
  )),
  before_state jsonb,
  after_state jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique(operation_id,sequence),
  check (before_state is not null or after_state is not null),
  check (
    (target_type='account' and action in ('create_account','update_account','activate_account','deactivate_account'))
    or
    (target_type='edge' and action in ('create_dependency','close_dependency'))
  )
);

create index if not exists jurisdiction_change_effects_operation_idx
  on public.jurisdiction_change_effects(operation_id,sequence);
create index if not exists jurisdiction_change_effects_target_idx
  on public.jurisdiction_change_effects(target_type,target_id);

create or replace function public.enforce_jurisdiction_change_primary_account()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  insert into public.jurisdiction_change_operation_accounts(operation_id,account_id,role)
  values(new.id,new.primary_account_id,'primary')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists jurisdiction_change_operation_primary_account_trigger on public.jurisdiction_change_operations;
create trigger jurisdiction_change_operation_primary_account_trigger
after insert on public.jurisdiction_change_operations
for each row execute function public.enforce_jurisdiction_change_primary_account();

create or replace function public.prevent_applied_jurisdiction_change_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if old.status in ('applied','reverted') then
    raise exception 'Las operaciones aplicadas o revertidas son inmutables.';
  end if;
  return new;
end;
$$;

drop trigger if exists jurisdiction_change_operation_immutable_trigger on public.jurisdiction_change_operations;
create trigger jurisdiction_change_operation_immutable_trigger
before update or delete on public.jurisdiction_change_operations
for each row execute function public.prevent_applied_jurisdiction_change_mutation();

create or replace view public.public_jurisdiction_history with (security_invoker=true) as
select
  operation.id operation_id,
  operation.primary_account_id jurisdiction_account_id,
  account.account_code,
  account.ecclesiastical_entity_id,
  entity.slug jurisdiction_slug,
  entity.name jurisdiction_name,
  event_type.key event_type_key,
  event_type.name event_type_name,
  operation.effective_date,
  operation.public_title title,
  operation.public_summary summary,
  operation.source_document_id,
  operation.applied_at,
  operation.updated_at
from public.jurisdiction_change_operations operation
join public.jurisdiction_accounts account on account.id=operation.primary_account_id
join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
join public.jurisdiction_event_types event_type on event_type.id=operation.event_type_id
where operation.origin='historical_event'
  and operation.status='applied'
  and operation.publication_status='published'
  and operation.effective_date is not null
  and operation.public_title is not null
  and operation.public_summary is not null;

create or replace view public.admin_jurisdiction_change_operations with (security_invoker=true) as
select
  operation.id,
  operation.origin,
  operation.status,
  operation.publication_status,
  operation.primary_account_id,
  account.account_code,
  entity.name jurisdiction_name,
  event_type.key event_type_key,
  event_type.name event_type_name,
  operation.effective_date,
  operation.reason,
  operation.public_title,
  operation.source_document_id,
  operation.operation_source,
  operation.created_by,
  operation.validated_by,
  operation.applied_by,
  operation.created_at,
  operation.validated_at,
  operation.applied_at,
  count(effect.id)::integer effect_count
from public.jurisdiction_change_operations operation
join public.jurisdiction_accounts account on account.id=operation.primary_account_id
join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
left join public.jurisdiction_event_types event_type on event_type.id=operation.event_type_id
left join public.jurisdiction_change_effects effect on effect.operation_id=operation.id
group by operation.id,account.account_code,entity.name,event_type.key,event_type.name;

alter table public.jurisdiction_event_types enable row level security;
alter table public.jurisdiction_change_operations enable row level security;
alter table public.jurisdiction_change_operation_accounts enable row level security;
alter table public.jurisdiction_change_effects enable row level security;

revoke all on public.jurisdiction_event_types from public;
revoke all on public.jurisdiction_change_operations from public;
revoke all on public.jurisdiction_change_operation_accounts from public;
revoke all on public.jurisdiction_change_effects from public;
revoke all on public.public_jurisdiction_history from public;
revoke all on public.admin_jurisdiction_change_operations from public;

-- Event types are a public explanatory catalog. Mutations remain service/RPC only.
grant select on public.jurisdiction_event_types to anon,authenticated;
create policy jurisdiction_event_types_public_read
on public.jurisdiction_event_types for select to anon,authenticated
using(status='active');

-- Public users receive only the sanitized historical projection.
grant select on public.public_jurisdiction_history to anon,authenticated;

-- Administrative views are authenticated-only and still execute with caller privileges.
grant select on public.admin_jurisdiction_change_operations to authenticated;

-- No insert, update or delete grants are given to anon/authenticated.
-- A later migration will expose narrowly scoped transactional RPC facades.
