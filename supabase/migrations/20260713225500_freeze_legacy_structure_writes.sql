-- Freeze obsolete structural models while preserving read compatibility.
-- pastoral_entities remains active because public views and scope resolution
-- still depend on it during the transition to the canonical structure engine.

revoke insert, update, delete on table public.diocese_structure_templates from anon, authenticated;
revoke insert, update, delete on table public.diocese_structure_levels from anon, authenticated;
revoke insert, update, delete on table public.pastoral_structure_templates from anon, authenticated;
revoke insert, update, delete on table public.pastoral_structure_levels from anon, authenticated;
revoke insert, update, delete on table public.pastoral_relationships from anon, authenticated;
revoke insert, update, delete on table public.pastoral_assignments from anon, authenticated;

drop policy if exists phase0_pastoral_relationships_insert_a1cfdab on public.pastoral_relationships;
drop policy if exists phase0_pastoral_relationships_update_7fd1b82 on public.pastoral_relationships;
drop policy if exists phase0_pastoral_relationships_remove_7c7b903 on public.pastoral_relationships;

comment on table public.diocese_structure_templates is
  'LEGACY READ-ONLY: replaced by public.structure_templates. Do not add new writes.';
comment on table public.diocese_structure_levels is
  'LEGACY READ-ONLY: replaced by public.structure_levels and structure_level_edges. Do not add new writes.';
comment on table public.pastoral_structure_templates is
  'LEGACY READ-ONLY: retained temporarily for compatibility. New structure definitions belong in public.structure_templates.';
comment on table public.pastoral_structure_levels is
  'LEGACY READ-ONLY: retained temporarily for compatibility. New hierarchy levels belong in public.structure_levels.';
comment on table public.pastoral_relationships is
  'LEGACY FROZEN: empty table retained for compatibility; use public.structure_node_edges for new hierarchy relations.';
comment on table public.pastoral_assignments is
  'LEGACY FROZEN: use public.position_assignments for new appointments and service assignments.';
