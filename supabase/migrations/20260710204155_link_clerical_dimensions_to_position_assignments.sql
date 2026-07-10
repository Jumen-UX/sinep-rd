alter table public.episcopal_roles
  add column source_position_assignment_id uuid unique
  references public.position_assignments(id) on delete set null;

alter table public.person_ecclesiastical_dignities
  add column source_position_assignment_id uuid
  references public.position_assignments(id) on delete set null;

create unique index person_ecclesiastical_dignities_position_source_idx
  on public.person_ecclesiastical_dignities(source_position_assignment_id, dignity_type)
  where source_position_assignment_id is not null;

create index episcopal_roles_position_source_idx
  on public.episcopal_roles(source_position_assignment_id)
  where source_position_assignment_id is not null;