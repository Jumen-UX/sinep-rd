create table public.ordination_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.persons(id) on delete cascade,
  degree text not null check (degree in ('diaconate', 'presbyterate', 'episcopate')),
  ordination_date date,
  ordination_place text,
  principal_ordainer_person_id uuid references public.persons(id) on delete set null,
  assistant_ordainer_1_person_id uuid references public.persons(id) on delete set null,
  assistant_ordainer_2_person_id uuid references public.persons(id) on delete set null,
  principal_ordainer_name text,
  assistant_ordainer_1_name text,
  assistant_ordainer_2_name text,
  source_name text,
  source_url text,
  source_checked_at date,
  verification_status text not null default 'pending_review' check (verification_status in ('pending_review', 'verified', 'rejected', 'disputed')),
  visibility text not null default 'public' check (visibility in ('public', 'internal', 'private', 'confidential')),
  record_status text not null default 'active' check (record_status in ('active', 'archived', 'rejected')),
  record_origin text not null default 'manual',
  notes_public text,
  notes_internal text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, degree)
);

create index ordination_events_person_id_idx on public.ordination_events(person_id);
create index ordination_events_degree_status_idx on public.ordination_events(degree, record_status);
create index ordination_events_principal_ordainer_idx on public.ordination_events(principal_ordainer_person_id) where principal_ordainer_person_id is not null;

create trigger ordination_events_set_updated_at
before update on public.ordination_events
for each row execute function public.set_updated_at();

alter table public.ordination_events enable row level security;

create policy ordination_events_select_policy
on public.ordination_events
for select
to anon, authenticated
using (
  (select public.current_user_is_admin())
  or (
    record_status = 'active'
    and visibility = 'public'
    and exists (
      select 1 from public.persons p
      where p.id = ordination_events.person_id
        and public.can_view_visibility(p.visibility)
    )
  )
);

revoke all on public.ordination_events from public, anon, authenticated;
grant select (person_id, degree, record_status) on public.ordination_events to anon, authenticated;

insert into public.ordination_events (person_id, degree, ordination_date, record_origin, notes_internal, created_by)
select p.id, 'diaconate', cp.diaconal_ordination_date, 'legacy_backfill',
       'Migrado desde persons y clergy_profiles al historial sacramental canónico.', p.created_by
from public.persons p
left join public.clergy_profiles cp on cp.person_id = p.id
where p.person_type in ('deacon', 'priest', 'bishop') or cp.diaconal_ordination_date is not null
on conflict (person_id, degree) do update set
  ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
  updated_at = now();

insert into public.ordination_events (person_id, degree, ordination_date, record_origin, notes_internal, created_by)
select p.id, 'presbyterate', cp.priestly_ordination_date, 'legacy_backfill',
       'Migrado desde persons y clergy_profiles al historial sacramental canónico.', p.created_by
from public.persons p
left join public.clergy_profiles cp on cp.person_id = p.id
where p.person_type in ('priest', 'bishop') or cp.priestly_ordination_date is not null
on conflict (person_id, degree) do update set
  ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
  updated_at = now();

insert into public.ordination_events (
  person_id, degree, ordination_date, ordination_place,
  principal_ordainer_person_id, assistant_ordainer_1_person_id, assistant_ordainer_2_person_id,
  principal_ordainer_name, assistant_ordainer_1_name, assistant_ordainer_2_name,
  source_name, source_url, source_checked_at, verification_status, visibility,
  record_status, record_origin, notes_public, notes_internal, created_by
)
select
  p.id, 'episcopate', coalesce(eo.ordination_date, cp.episcopal_ordination_date), eo.ordination_place,
  eo.principal_consecrator_person_id, eo.co_consecrator_1_person_id, eo.co_consecrator_2_person_id,
  eo.principal_consecrator_name, eo.co_consecrator_1_name, eo.co_consecrator_2_name,
  eo.source_name, eo.source_url, eo.source_checked_at, coalesce(eo.verification_status, 'pending_review'),
  coalesce(eo.visibility, 'public'),
  case when eo.status is null or eo.status = 'active' then 'active' else 'archived' end,
  'legacy_backfill', eo.notes_public,
  coalesce(eo.notes_internal, 'Migrado desde persons, clergy_profiles y episcopal_ordinations al historial sacramental canónico.'),
  coalesce(eo.created_by, p.created_by)
from public.persons p
left join public.clergy_profiles cp on cp.person_id = p.id
left join public.episcopal_ordinations eo on eo.bishop_person_id = p.id
where p.person_type = 'bishop' or cp.episcopal_ordination_date is not null or eo.id is not null
on conflict (person_id, degree) do update set
  ordination_date = coalesce(excluded.ordination_date, public.ordination_events.ordination_date),
  ordination_place = coalesce(excluded.ordination_place, public.ordination_events.ordination_place),
  principal_ordainer_person_id = coalesce(excluded.principal_ordainer_person_id, public.ordination_events.principal_ordainer_person_id),
  assistant_ordainer_1_person_id = coalesce(excluded.assistant_ordainer_1_person_id, public.ordination_events.assistant_ordainer_1_person_id),
  assistant_ordainer_2_person_id = coalesce(excluded.assistant_ordainer_2_person_id, public.ordination_events.assistant_ordainer_2_person_id),
  principal_ordainer_name = coalesce(excluded.principal_ordainer_name, public.ordination_events.principal_ordainer_name),
  assistant_ordainer_1_name = coalesce(excluded.assistant_ordainer_1_name, public.ordination_events.assistant_ordainer_1_name),
  assistant_ordainer_2_name = coalesce(excluded.assistant_ordainer_2_name, public.ordination_events.assistant_ordainer_2_name),
  source_name = coalesce(excluded.source_name, public.ordination_events.source_name),
  source_url = coalesce(excluded.source_url, public.ordination_events.source_url),
  source_checked_at = coalesce(excluded.source_checked_at, public.ordination_events.source_checked_at),
  notes_public = coalesce(excluded.notes_public, public.ordination_events.notes_public),
  notes_internal = coalesce(excluded.notes_internal, public.ordination_events.notes_internal),
  updated_at = now();

create view public.person_ecclesial_state
with (security_invoker = true)
as
select
  p.id, p.first_name, p.middle_name, p.last_name, p.second_last_name,
  p.display_name, p.slug, p.gender, p.birth_date, p.birth_place,
  p.photo_url, p.biography_public, p.status, p.visibility,
  p.person_type as legacy_person_type,
  case ord.highest_rank when 3 then 'episcopate' when 2 then 'presbyterate' when 1 then 'diaconate' else null end as highest_ordination_degree,
  case when ord.highest_rank is null then 'lay' else 'cleric' end as ecclesial_condition,
  ord.highest_rank is not null as is_cleric,
  ord.highest_rank is null as is_lay,
  coalesce(ord.has_diaconate, false) as has_diaconate,
  coalesce(ord.has_presbyterate, false) as has_presbyterate,
  coalesce(ord.has_episcopate, false) as has_episcopate,
  case ord.highest_rank
    when 3 then 'bishop'
    when 2 then 'priest'
    when 1 then 'deacon'
    else case when p.person_type in ('bishop', 'priest', 'deacon') then 'layperson' else p.person_type end
  end as effective_person_type
from public.persons p
left join lateral (
  select
    max(case oe.degree when 'episcopate' then 3 when 'presbyterate' then 2 when 'diaconate' then 1 else 0 end) as highest_rank,
    bool_or(oe.degree = 'diaconate') as has_diaconate,
    bool_or(oe.degree = 'presbyterate') as has_presbyterate,
    bool_or(oe.degree = 'episcopate') as has_episcopate
  from public.ordination_events oe
  where oe.person_id = p.id and oe.record_status = 'active'
) ord on true;

revoke all on public.person_ecclesial_state from public, anon, authenticated;
grant select on public.person_ecclesial_state to anon, authenticated;

comment on table public.ordination_events is 'Fuente canónica del historial del sacramento del Orden. Cada persona conserva una identidad única y puede acumular diaconado, presbiterado y episcopado.';
comment on view public.person_ecclesial_state is 'Proyección derivada de la condición laical o clerical y del grado más alto del Orden para cada persona.';
comment on column public.persons.person_type is 'Clasificación heredada conservada temporalmente por compatibilidad. Para clérigos se deriva de ordination_events; no debe usarse como fuente canónica nueva.';
comment on column public.clergy_profiles.diaconal_ordination_date is 'Campo de compatibilidad. La fuente canónica es ordination_events con degree=diaconate.';
comment on column public.clergy_profiles.priestly_ordination_date is 'Campo de compatibilidad. La fuente canónica es ordination_events con degree=presbyterate.';
comment on column public.clergy_profiles.episcopal_ordination_date is 'Campo de compatibilidad. La fuente canónica es ordination_events con degree=episcopate.';
