export type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

export type EcclesiasticalEntity = { id: string; name: string; official_name: string | null; slug: string }
export type EntityType = { id: string; key: string; name: string }
export type StructureKind = { key: StructureKindKey; name: string; description: string | null }
export type StructureTemplate = { id: string; diocese_id: string; kind_key: StructureKindKey; key: string; name: string; description: string | null; is_primary: boolean; is_active: boolean; status: string }
export type StructureLevel = { id: string; template_id: string; level_key: string; name: string; plural_name: string | null; description: string | null; level_order: number; parent_level_id: string | null; linked_entity_type_id: string | null; scope: string; is_entry_point: boolean; is_required: boolean; allows_multiple_entities: boolean; allows_new_nodes: boolean }
export type ChildLevelOption = { level_id: string; level_key: string; level_name: string; plural_name: string | null; level_order: number; parent_level_id: string | null; edge_id: string | null; allows_multiple: boolean; is_required: boolean }
export type StructureTreeNode = { node_id: string; template_id: string; level_id: string; level_key: string; level_name: string; parent_node_id: string | null; depth: number; path_ids: string[]; path_names: string[]; name: string; official_name: string | null; slug: string; code: string | null; linked_ecclesiastical_entity_id: string | null; linked_pastoral_entity_id: string | null; start_date: string | null; end_date: string | null; is_current: boolean; status: string; visibility: string; has_children: boolean }
export type StructurePresetLevel = { levelKey: string; name: string; pluralName: string; scope?: string; entityTypeKeys?: string[] }
export type StructurePreset = { key: string; title: string; description: string; levels: StructurePresetLevel[] }
export type StructureRpcResult = { success?: boolean; id?: string; message?: string }

export type StructureNodeDetail = {
  node: {
    id: string; template_id: string; level_id: string; diocese_id: string; parent_node_id: string | null;
    name: string; official_name: string | null; slug: string; code: string | null; description: string | null;
    linked_ecclesiastical_entity_id: string | null; linked_pastoral_entity_id: string | null;
    start_date: string | null; end_date: string | null; is_current: boolean; status: string; visibility: string;
    source_name: string | null; source_url: string | null; source_checked_at: string | null;
    metadata: Record<string, unknown>; created_at: string; updated_at: string;
  }
  level: { id: string; key: string; name: string; plural_name: string | null; scope: string; level_order: number; is_required: boolean; allows_new_nodes: boolean }
  template: { id: string; name: string; kind_key: StructureKindKey; status: string; is_primary: boolean }
  parent: { id: string; name: string; level_id: string; status: string } | null
  allowed_offices: Array<{ mapping_id: string; office_configuration_id: string; key: string; display_name: string; description: string | null; requires_clergy: boolean; allowed_person_types: string[]; is_default: boolean; sort_order: number; status: string }>
  current_assignments: Array<{ assignment_id: string; office_configuration_id: string; office_name: string; person_id: string | null; person_name: string | null; start_date: string | null; end_date: string | null; assignment_status: string | null; record_status: string; publication_status: string | null; is_current: boolean }>
  history: { assignment_count: number; edge_count: number; structural_event_count: number }
}

export type SaveStructureTemplatePayload = { id?: string | null; diocese_id: string; kind_key: StructureKindKey; key: string; name: string; description?: string | null; is_primary?: boolean; is_active?: boolean; status?: string }
export type SaveStructureLevelPayload = { id?: string | null; template_id: string; parent_level_id?: string | null; linked_entity_type_id?: string | null; level_key: string; name: string; plural_name?: string | null; description?: string | null; level_order: number; scope: string; is_entry_point?: boolean; is_required?: boolean; allows_multiple_entities?: boolean; allows_new_nodes?: boolean }
export type SaveStructureNodePayload = { id?: string | null; template_id: string; level_id: string; parent_node_id?: string | null; name: string; official_name?: string | null; slug: string; code?: string | null; description?: string | null; linked_ecclesiastical_entity_id?: string | null; linked_pastoral_entity_id?: string | null; start_date?: string | null; end_date?: string | null; is_current?: boolean; source_name?: string | null; source_url?: string | null; source_checked_at?: string | null; metadata?: Record<string, unknown>; status?: string; visibility?: string }
