revoke insert, update, delete, truncate, references, trigger
  on public.canonical_events,
     public.clergy_profiles,
     public.ecclesiastical_entities,
     public.position_assignments
  from anon, authenticated;

drop policy if exists canonical_events_admin_insert on public.canonical_events;
drop policy if exists canonical_events_admin_update on public.canonical_events;
drop policy if exists canonical_events_admin_delete on public.canonical_events;

drop policy if exists phase0_clergy_profiles_insert_9a75860 on public.clergy_profiles;
drop policy if exists phase0_clergy_profiles_update_2bea18f on public.clergy_profiles;
drop policy if exists phase0_clergy_profiles_remove_f9cfcfe on public.clergy_profiles;

drop policy if exists phase0_ecclesiastical_entities_insert_52afb76 on public.ecclesiastical_entities;
drop policy if exists phase0_ecclesiastical_entities_update_0900fd7 on public.ecclesiastical_entities;
drop policy if exists phase0_ecclesiastical_entities_remove_fba1cdf on public.ecclesiastical_entities;

drop policy if exists phase0_position_assignments_insert_0ed47f9 on public.position_assignments;
drop policy if exists phase0_position_assignments_update_53c373e on public.position_assignments;
drop policy if exists phase0_position_assignments_remove_0314bcd on public.position_assignments;
