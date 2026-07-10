create index clerical_incardinations_created_by_idx
  on public.clerical_incardinations(created_by)
  where created_by is not null;

create index clerical_status_history_created_by_idx
  on public.clerical_status_history(created_by)
  where created_by is not null;

create index episcopal_roles_created_by_idx
  on public.episcopal_roles(created_by)
  where created_by is not null;

create index person_ecclesiastical_dignities_created_by_idx
  on public.person_ecclesiastical_dignities(created_by)
  where created_by is not null;