-- Establish the jurisdiction account plan as the canonical product core.
-- Existing non-jurisdictional domains remain preserved but are not used by this plan.

create table if not exists public.jurisdiction_accounts (
  id uuid primary key default gen_random_uuid(),
  ecclesiastical_entity_id uuid not null unique references public.ecclesiastical_entities(id) on delete restrict,
  account_code text not null unique,
  canonical_status text not null default 'active' check (
    canonical_status in ('active','vacant','suppressed','united','elevated','restored','historical','under_review')
  ),
  sort_order integer not null default 100,
  valid_from date,
  valid_to date,
  is_current boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  visibility text not null default 'internal' check (visibility in ('public','internal','private','confidential')),
  source_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(account_code)) > 0),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

comment on table public.jurisdiction_accounts is
  'Canonical account catalog for ecclesiastical jurisdictions. This is the central SINEP product model.';
comment on column public.jurisdiction_accounts.account_code is
  'Stable internal account identifier. It does not encode the current hierarchy and must not change after reparenting.';

create table if not exists public.jurisdiction_account_edges (
  id uuid primary key default gen_random_uuid(),
  parent_account_id uuid not null references public.jurisdiction_accounts(id) on delete restrict,
  child_account_id uuid not null references public.jurisdiction_accounts(id) on delete restrict,
  relationship_type text not null check (
    relationship_type in (
      'root_of','contains','metropolitan_see','suffragan_of','directly_subject',
      'personal_jurisdiction','specialized_jurisdiction','belongs_to'
    )
  ),
  valid_from date not null,
  valid_to date,
  is_current boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  visibility text not null default 'internal' check (visibility in ('public','internal','private','confidential')),
  source_document_id uuid references public.documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_account_id <> child_account_id),
  check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists jurisdiction_account_edges_one_current_parent_idx
  on public.jurisdiction_account_edges(child_account_id)
  where is_current and status = 'active';
create index if not exists jurisdiction_account_edges_parent_idx
  on public.jurisdiction_account_edges(parent_account_id,is_current,status);
create index if not exists jurisdiction_account_edges_child_history_idx
  on public.jurisdiction_account_edges(child_account_id,valid_from desc);

comment on table public.jurisdiction_account_edges is
  'Historical canonical dependency relations between jurisdiction accounts. Civil countries are never account parents.';

create table if not exists public.jurisdiction_account_type_rules (
  id uuid primary key default gen_random_uuid(),
  parent_entity_type_id uuid not null references public.entity_types(id) on delete restrict,
  child_entity_type_id uuid not null references public.entity_types(id) on delete restrict,
  relationship_type text not null,
  is_allowed boolean not null default true,
  requires_source boolean not null default true,
  notes text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_entity_type_id,child_entity_type_id,relationship_type)
);

comment on table public.jurisdiction_account_type_rules is
  'Controlled parent-child combinations for the canonical jurisdiction account plan.';

-- Ensure the root identity exists without relying on a generated identifier.
insert into public.ecclesiastical_entities (
  entity_type_id,
  name,
  official_name,
  latin_name,
  slug,
  description,
  status,
  visibility
)
select
  type.id,
  'Santa Sede',
  'Santa Sede',
  'Sancta Sedes',
  'santa-sede',
  'Sede apostólica y raíz del plan de cuentas jurisdiccional de SINEP.',
  'active',
  'public'
from public.entity_types type
where type.key = 'holy_see'
  and not exists (
    select 1 from public.ecclesiastical_entities entity where entity.slug = 'santa-sede'
  );

-- Import only jurisdiction identities. Internal territorial nodes, parishes and
-- organizational units are intentionally excluded.
insert into public.jurisdiction_accounts (
  ecclesiastical_entity_id,
  account_code,
  canonical_status,
  sort_order,
  valid_from,
  valid_to,
  is_current,
  status,
  visibility,
  notes
)
select
  entity.id,
  case
    when type.key = 'holy_see' then 'JUR-HOLY-SEE'
    else 'JUR-' || upper(replace(entity.id::text,'-',''))
  end,
  case when entity.suppressed_at is not null then 'suppressed' else 'active' end,
  coalesce(type.default_level_order,100),
  entity.erected_at,
  entity.suppressed_at,
  entity.suppressed_at is null,
  entity.status,
  entity.visibility,
  'Importación inicial desde ecclesiastical_entities. Requiere validación documental antes de publicación definitiva.'
from public.ecclesiastical_entities entity
join public.entity_types type on type.id = entity.entity_type_id
where type.key = any(array[
  'holy_see','ecclesiastical_province','archdiocese','diocese','military_ordinariate',
  'personal_ordinariate','territorial_prelature','apostolic_vicariate','apostolic_prefecture',
  'apostolic_administration','eparchy','archeparchy','exarchate'
])
on conflict (ecclesiastical_entity_id) do nothing;

-- Import canonical ecclesial relations when both endpoints are jurisdiction accounts.
insert into public.jurisdiction_account_edges (
  parent_account_id,
  child_account_id,
  relationship_type,
  valid_from,
  valid_to,
  is_current,
  status,
  visibility,
  source_document_id,
  notes
)
select
  parent_account.id,
  child_account.id,
  case
    when relation.relationship_type in (
      'contains','metropolitan_see','suffragan_of','directly_subject','personal_jurisdiction'
    ) then relation.relationship_type
    else 'belongs_to'
  end,
  relation.start_date,
  relation.end_date,
  relation.is_current,
  relation.status,
  least(parent_account.visibility,child_account.visibility),
  relation.document_id,
  'Importación inicial desde entity_relationships.'
from public.entity_relationships relation
join public.jurisdiction_accounts parent_account
  on parent_account.ecclesiastical_entity_id = relation.parent_entity_id
join public.jurisdiction_accounts child_account
  on child_account.ecclesiastical_entity_id = relation.child_entity_id
where relation.status = 'active'
  and not exists (
    select 1
    from public.jurisdiction_account_edges existing
    where existing.parent_account_id = parent_account.id
      and existing.child_account_id = child_account.id
      and existing.valid_from = relation.start_date
  );

-- Attach roots, provinces and directly subject jurisdictions to the Holy See.
with holy_see as (
  select account.id
  from public.jurisdiction_accounts account
  join public.ecclesiastical_entities entity on entity.id = account.ecclesiastical_entity_id
  join public.entity_types type on type.id = entity.entity_type_id
  where type.key = 'holy_see'
  order by account.created_at
  limit 1
), root_candidates as (
  select account.id as child_account_id,
         entity.erected_at,
         entity.visibility,
         type.key as type_key
  from public.jurisdiction_accounts account
  join public.ecclesiastical_entities entity on entity.id = account.ecclesiastical_entity_id
  join public.entity_types type on type.id = entity.entity_type_id
  where type.key <> 'holy_see'
    and not exists (
      select 1
      from public.jurisdiction_account_edges edge
      where edge.child_account_id = account.id
        and edge.is_current
        and edge.status = 'active'
    )
)
insert into public.jurisdiction_account_edges (
  parent_account_id,
  child_account_id,
  relationship_type,
  valid_from,
  is_current,
  status,
  visibility,
  notes
)
select
  holy_see.id,
  candidate.child_account_id,
  case when candidate.type_key = 'ecclesiastical_province' then 'contains' else 'directly_subject' end,
  coalesce(candidate.erected_at,date '1900-01-01'),
  true,
  'active',
  candidate.visibility,
  'Relación inicial al plan canónico. Requiere verificación documental.'
from holy_see
cross join root_candidates candidate
on conflict do nothing;

-- Initial parent-child rules. They are deliberately conservative and extensible.
insert into public.jurisdiction_account_type_rules (
  parent_entity_type_id,
  child_entity_type_id,
  relationship_type,
  is_allowed,
  requires_source,
  notes
)
select parent.id,child.id,rule.relationship_type,true,true,rule.notes
from (values
  ('holy_see','ecclesiastical_province','contains','La Santa Sede puede contener provincias eclesiásticas.'),
  ('holy_see','archdiocese','directly_subject','Arquidiócesis inmediatamente sujeta.'),
  ('holy_see','diocese','directly_subject','Diócesis inmediatamente sujeta.'),
  ('holy_see','military_ordinariate','specialized_jurisdiction','Jurisdicción especializada.'),
  ('holy_see','personal_ordinariate','personal_jurisdiction','Jurisdicción personal.'),
  ('holy_see','territorial_prelature','directly_subject','Prelatura territorial inmediatamente sujeta.'),
  ('holy_see','apostolic_vicariate','directly_subject','Vicariato apostólico.'),
  ('holy_see','apostolic_prefecture','directly_subject','Prefectura apostólica.'),
  ('holy_see','apostolic_administration','directly_subject','Administración apostólica.'),
  ('holy_see','eparchy','directly_subject','Eparquía inmediatamente sujeta cuando corresponda.'),
  ('holy_see','archeparchy','directly_subject','Arcieparquía inmediatamente sujeta cuando corresponda.'),
  ('holy_see','exarchate','directly_subject','Exarcado.'),
  ('ecclesiastical_province','archdiocese','metropolitan_see','Sede metropolitana de la provincia.'),
  ('ecclesiastical_province','diocese','suffragan_of','Diócesis sufragánea.'),
  ('ecclesiastical_province','eparchy','suffragan_of','Eparquía sufragánea cuando corresponda.'),
  ('ecclesiastical_province','archeparchy','metropolitan_see','Arcieparquía metropolitana cuando corresponda.')
) as rule(parent_key,child_key,relationship_type,notes)
join public.entity_types parent on parent.key = rule.parent_key
join public.entity_types child on child.key = rule.child_key
on conflict (parent_entity_type_id,child_entity_type_id,relationship_type) do nothing;

alter table public.jurisdiction_accounts enable row level security;
alter table public.jurisdiction_account_edges enable row level security;
alter table public.jurisdiction_account_type_rules enable row level security;

revoke all on public.jurisdiction_accounts from public;
revoke all on public.jurisdiction_account_edges from public;
revoke all on public.jurisdiction_account_type_rules from public;
grant select on public.jurisdiction_accounts to anon,authenticated;
grant select on public.jurisdiction_account_edges to anon,authenticated;
grant select on public.jurisdiction_account_type_rules to anon,authenticated;

create policy jurisdiction_accounts_public_read
on public.jurisdiction_accounts for select to anon,authenticated
using (status='active' and visibility='public' and is_current);

create policy jurisdiction_account_edges_public_read
on public.jurisdiction_account_edges for select to anon,authenticated
using (status='active' and visibility='public' and is_current
  and valid_from <= current_date and (valid_to is null or valid_to >= current_date));

create policy jurisdiction_account_type_rules_public_read
on public.jurisdiction_account_type_rules for select to anon,authenticated
using (status='active' and is_allowed);

create or replace view public.public_jurisdiction_account_tree
with (security_invoker = true)
as
with recursive tree as (
  select
    account.id as account_id,
    account.account_code,
    account.ecclesiastical_entity_id,
    entity.slug,
    entity.name,
    entity.official_name,
    entity.latin_name,
    type.key as account_type_key,
    type.name as account_type_name,
    null::uuid as parent_account_id,
    null::text as parent_account_code,
    0 as depth,
    array[account.id]::uuid[] as path_ids,
    array[account.account_code]::text[] as path_codes,
    array[entity.name]::text[] as path_names,
    account.canonical_status,
    account.sort_order
  from public.jurisdiction_accounts account
  join public.ecclesiastical_entities entity on entity.id=account.ecclesiastical_entity_id
  join public.entity_types type on type.id=entity.entity_type_id
  where account.status='active' and account.visibility='public' and account.is_current
    and not exists (
      select 1 from public.jurisdiction_account_edges edge
      where edge.child_account_id=account.id and edge.status='active' and edge.is_current
        and edge.visibility='public' and edge.valid_from<=current_date
        and (edge.valid_to is null or edge.valid_to>=current_date)
    )

  union all

  select
    child.id,
    child.account_code,
    child.ecclesiastical_entity_id,
    child_entity.slug,
    child_entity.name,
    child_entity.official_name,
    child_entity.latin_name,
    child_type.key,
    child_type.name,
    parent.account_id,
    parent.account_code,
    parent.depth+1,
    parent.path_ids||child.id,
    parent.path_codes||child.account_code,
    parent.path_names||child_entity.name,
    child.canonical_status,
    child.sort_order
  from tree parent
  join public.jurisdiction_account_edges edge
    on edge.parent_account_id=parent.account_id and edge.status='active' and edge.is_current
   and edge.visibility='public' and edge.valid_from<=current_date
   and (edge.valid_to is null or edge.valid_to>=current_date)
  join public.jurisdiction_accounts child
    on child.id=edge.child_account_id and child.status='active' and child.visibility='public' and child.is_current
  join public.ecclesiastical_entities child_entity on child_entity.id=child.ecclesiastical_entity_id
  join public.entity_types child_type on child_type.id=child_entity.entity_type_id
  where not child.id=any(parent.path_ids)
)
select * from tree;

revoke all on public.public_jurisdiction_account_tree from public;
grant select on public.public_jurisdiction_account_tree to anon,authenticated;

comment on view public.public_jurisdiction_account_tree is
  'Current public canonical jurisdiction account tree rooted in the Holy See. Countries and internal diocesan structures are excluded.';
