create table if not exists public.person_private_validation (
  person_id uuid primary key references public.persons(id) on delete cascade,
  internal_reference_code text not null default public.generate_person_internal_code(),
  validation_type text,
  validation_value text,
  validation_country text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists person_private_validation_code_key
  on public.person_private_validation (internal_reference_code);

create unique index if not exists person_private_validation_value_key
  on public.person_private_validation (validation_type, validation_country, validation_value)
  where validation_type is not null
    and validation_value is not null;

alter table public.person_private_validation enable row level security;

drop policy if exists person_private_validation_admin_all on public.person_private_validation;
create policy person_private_validation_admin_all
on public.person_private_validation
for all to authenticated
using (public.current_user_has_admin_role())
with check (public.current_user_has_admin_role());

grant select, insert, update, delete on public.person_private_validation to authenticated;
