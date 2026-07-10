create index ordination_events_assistant_ordainer_1_idx
  on public.ordination_events(assistant_ordainer_1_person_id)
  where assistant_ordainer_1_person_id is not null;

create index ordination_events_assistant_ordainer_2_idx
  on public.ordination_events(assistant_ordainer_2_person_id)
  where assistant_ordainer_2_person_id is not null;
