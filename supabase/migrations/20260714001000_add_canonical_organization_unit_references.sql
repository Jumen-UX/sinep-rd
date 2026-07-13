alter table public.appointments
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.audit_logs
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.change_requests
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.commemorative_events
  add column if not exists related_organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.documents
  add column if not exists related_organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.event_occurrences
  add column if not exists related_organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.event_reminders
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete cascade;

alter table public.movements
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.structure_nodes
  add column if not exists linked_organization_unit_id uuid references public.organization_units(id) on delete set null;

alter table public.user_role_assignments
  add column if not exists organization_unit_id uuid references public.organization_units(id) on delete set null;

update public.appointments set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.audit_logs set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.change_requests set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.commemorative_events set related_organization_unit_id = related_pastoral_entity_id where related_organization_unit_id is null and related_pastoral_entity_id is not null;
update public.documents set related_organization_unit_id = related_pastoral_entity_id where related_organization_unit_id is null and related_pastoral_entity_id is not null;
update public.event_occurrences set related_organization_unit_id = related_pastoral_entity_id where related_organization_unit_id is null and related_pastoral_entity_id is not null;
update public.event_reminders set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.movements set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.position_assignments set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;
update public.structure_nodes set linked_organization_unit_id = linked_pastoral_entity_id where linked_organization_unit_id is null and linked_pastoral_entity_id is not null;
update public.user_role_assignments set organization_unit_id = pastoral_entity_id where organization_unit_id is null and pastoral_entity_id is not null;

create index if not exists appointments_organization_unit_id_idx on public.appointments(organization_unit_id);
create index if not exists audit_logs_organization_unit_id_idx on public.audit_logs(organization_unit_id);
create index if not exists change_requests_organization_unit_id_idx on public.change_requests(organization_unit_id);
create index if not exists commemorative_events_related_organization_unit_id_idx on public.commemorative_events(related_organization_unit_id);
create index if not exists documents_related_organization_unit_id_idx on public.documents(related_organization_unit_id);
create index if not exists event_occurrences_related_organization_unit_id_idx on public.event_occurrences(related_organization_unit_id);
create index if not exists event_reminders_organization_unit_id_idx on public.event_reminders(organization_unit_id);
create index if not exists movements_organization_unit_id_idx on public.movements(organization_unit_id);
create index if not exists structure_nodes_linked_organization_unit_id_idx on public.structure_nodes(linked_organization_unit_id);
create index if not exists user_role_assignments_organization_unit_id_idx on public.user_role_assignments(organization_unit_id);
