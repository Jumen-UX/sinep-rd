create index if not exists idx_ecclesiastical_entities_country_iso2_fk
  on public.ecclesiastical_entities (country_iso2);

create index if not exists idx_import_clergy_directory_review_candidate_clergy_profile_fk
  on public.import_clergy_directory_review (candidate_clergy_profile_id);

create index if not exists idx_import_clergy_directory_review_candidate_person_fk
  on public.import_clergy_directory_review (candidate_person_id);

create index if not exists idx_import_clergy_directory_review_parish_node_fk
  on public.import_clergy_directory_review (parish_node_id);

create index if not exists idx_import_person_candidates_matched_person_fk
  on public.import_parish_directory_person_candidates_sto_dgo_2026 (matched_person_id);

create index if not exists idx_import_parish_directory_loaded_parish_node_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_parish_node_id);

create index if not exists idx_import_parish_directory_loaded_zone_entity_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_zone_entity_id);

create index if not exists idx_import_parish_directory_loaded_zone_node_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_zone_node_id);

create index if not exists idx_import_parish_directory_loaded_parish_entity_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_parish_entity_id);

create index if not exists idx_import_parish_directory_loaded_vicariate_node_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_vicariate_node_id);

create index if not exists idx_import_parish_directory_loaded_vicariate_entity_fk
  on public.import_parish_directory_sto_dgo_2026 (loaded_vicariate_entity_id);

create index if not exists idx_structure_event_actions_action_type_fk
  on public.structure_event_actions (action_type_key);

create index if not exists idx_structure_event_actions_applied_by_fk
  on public.structure_event_actions (applied_by);

create index if not exists idx_structure_event_actions_created_by_fk
  on public.structure_event_actions (created_by);

create index if not exists idx_structure_event_actions_level_after_fk
  on public.structure_event_actions (level_after_id);

create index if not exists idx_structure_event_actions_level_before_fk
  on public.structure_event_actions (level_before_id);

create index if not exists idx_structure_event_actions_parent_after_fk
  on public.structure_event_actions (parent_after_node_id);

create index if not exists idx_structure_event_actions_parent_before_fk
  on public.structure_event_actions (parent_before_node_id);

create index if not exists idx_structure_event_actions_subject_node_fk
  on public.structure_event_actions (subject_node_id);

create index if not exists idx_structure_event_actions_target_node_fk
  on public.structure_event_actions (target_node_id);
