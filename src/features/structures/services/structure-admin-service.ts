import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChildLevelOption,
  EcclesiasticalEntity,
  EntityType,
  SaveStructureLevelPayload,
  SaveStructureNodePayload,
  SaveStructureTemplatePayload,
  StructureKind,
  StructureKindKey,
  StructureLevel,
  StructureNodeDetail,
  StructureRpcResult,
  StructureTemplate,
  StructureTreeNode,
} from '../types'

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export type StructureBaseData = {
  entities: EcclesiasticalEntity[]
  kinds: StructureKind[]
  entityTypes: EntityType[]
}

export type StructureTemplateDetails = {
  levels: StructureLevel[]
  nodes: StructureTreeNode[]
}

export async function loadStructureBaseData(client: SupabaseClient): Promise<StructureBaseData> {
  const [entityResult, kindResult, entityTypeResult] = await Promise.all([
    client.from('ecclesiastical_entities').select('id,name,official_name,slug').eq('status', 'active').order('name'),
    client.from('structure_kinds').select('key,name,description').eq('status', 'active').order('sort_order'),
    client.from('entity_types').select('id,key,name').eq('status', 'active').order('default_level_order'),
  ])

  throwIfError(entityResult.error)
  throwIfError(kindResult.error)
  throwIfError(entityTypeResult.error)

  return {
    entities: (entityResult.data ?? []) as EcclesiasticalEntity[],
    kinds: (kindResult.data ?? []) as StructureKind[],
    entityTypes: (entityTypeResult.data ?? []) as EntityType[],
  }
}

export async function loadStructureTemplates(client: SupabaseClient, dioceseId: string, kindKey: StructureKindKey): Promise<StructureTemplate[]> {
  const { data, error } = await client.rpc('get_structure_templates', {
    p_diocese_id: dioceseId,
    p_kind_key: kindKey,
    p_active_only: false,
  })
  throwIfError(error)
  return (data ?? []) as StructureTemplate[]
}

export async function loadStructureTemplateDetails(client: SupabaseClient, templateId: string, asOf: string): Promise<StructureTemplateDetails> {
  const [levelsResult, treeResult] = await Promise.all([
    client
      .from('structure_levels')
      .select('id,template_id,level_key,name,plural_name,description,level_order,parent_level_id,linked_entity_type_id,scope,is_entry_point,is_required,allows_multiple_entities,allows_new_nodes')
      .eq('template_id', templateId)
      .order('level_order'),
    client.rpc('get_structure_tree', {
      p_template_id: templateId,
      p_root_node_id: null,
      p_as_of: asOf,
      p_include_inactive: false,
    }),
  ])

  throwIfError(levelsResult.error)
  throwIfError(treeResult.error)

  return {
    levels: (levelsResult.data ?? []) as StructureLevel[],
    nodes: (treeResult.data ?? []) as StructureTreeNode[],
  }
}

export async function loadChildLevelOptions(client: SupabaseClient, templateId: string, parentLevelId: string | null): Promise<ChildLevelOption[]> {
  const { data, error } = await client.rpc('get_structure_child_level_options', {
    p_template_id: templateId,
    p_parent_level_id: parentLevelId,
  })
  throwIfError(error)
  return (data ?? []) as ChildLevelOption[]
}

export async function loadStructureNodeDetail(client: SupabaseClient, nodeId: string): Promise<StructureNodeDetail> {
  const { data, error } = await client.rpc('get_structure_node_detail', { p_node_id: nodeId })
  throwIfError(error)
  if (!data) throw new Error('No se recibió la ficha del nodo estructural.')
  return data as StructureNodeDetail
}

export async function saveStructureTemplate(client: SupabaseClient, payload: SaveStructureTemplatePayload): Promise<StructureRpcResult> {
  const { data, error } = await client.rpc('admin_save_structure_template', { payload })
  throwIfError(error)
  return (data ?? {}) as StructureRpcResult
}

export async function saveStructureLevel(client: SupabaseClient, payload: SaveStructureLevelPayload): Promise<StructureRpcResult> {
  const { data, error } = await client.rpc('admin_save_structure_level', { payload })
  throwIfError(error)
  return (data ?? {}) as StructureRpcResult
}

export async function saveStructureNode(client: SupabaseClient, payload: SaveStructureNodePayload): Promise<StructureRpcResult> {
  const { data, error } = await client.rpc('admin_save_structure_node', { payload })
  throwIfError(error)
  return (data ?? {}) as StructureRpcResult
}
