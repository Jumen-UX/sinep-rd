-- Controlled growth model: allow internal change requests for structural catalogs.
-- Applied to project hrvgpceqaxujlttpimdz on 2026-07-06.

alter table change_requests drop constraint if exists change_requests_target_table_check;

alter table change_requests add constraint change_requests_target_table_check check (
  target_table = any (array[
    'ecclesiastical_entities',
    'entity_relationships',
    'diocese_structure_templates',
    'diocese_structure_levels',
    'entity_types',
    'persons',
    'clergy_profiles',
    'offices',
    'office_base_roles',
    'office_scopes',
    'office_categories',
    'office_configurations',
    'organization_charts',
    'organization_units',
    'appointments',
    'position_assignments',
    'movements',
    'pastoral_areas',
    'pastoral_structure_templates',
    'pastoral_structure_levels',
    'pastoral_entities',
    'pastoral_relationships',
    'pastoral_assignments',
    'documents',
    'commemorative_events',
    'event_visibility_settings',
    'event_reminders',
    'other'
  ]::text[])
);
