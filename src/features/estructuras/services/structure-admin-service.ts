import type { SupabaseClient } from '@supabase/supabase-js'

export type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

export type EcclesiasticalEntity = {
  id: string
  name: string
  official_name: string | null
  slug: string
  entity_types?: { key: string; name: string }[] | { key: string; name: string } | null
}

export type EntityType = {
  id: string
  key: string
  name: string
}

export type StructureKind = {
  key: StructureKindKey
  name: string
  description: string | null
}

export type StructureTemplate = {
  id: string
  diocese_id: string
  kind_key: StructureKindKey
  key: string
  name: string
  description: string | null
  is_primary: boolean
  is_active: boolean
  status: string
}

export type StructureLevel = {
  id: string
  template_id: string
  level_key: string
  name: string
  plural_name: string | null
  description: string | null
  level_order: number
  parent_level_id: string | null
  linked_entity_type_id: string | null
  scope: string
  is_entry_point: boolean
  is_required: boolean
  allows_multiple_entities: boolean
  allows_new_nodes: boolean
}

export type ChildLevelOption = {
  level_id: string
  level_key: string
  level_name: string
  plural_name: string | null
  level_order: number
  parent_level_id: string | null
  edge_id: string | null
  allows_multiple: boolean
  is_required: boolean
}

export type StructureTreeNode = {
  node_id: string
  template_id: string
  level_id: string
  level_key: string
  level_name: string
  parent_node_id: string | null
  depth: number
  path_ids: string[]
  path_names: string[]
  name: string
  official_name: string | null
  slug: string
  code: string | null
  linked_ecclesiastical_entity_id: string | null
  linked_organization_unit_id: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  status: string
  visibility: string
  has_children: boolean
}

export type StructureBaseData = {
  entities: EcclesiasticalEntity[]
  dioceses: EcclesiasticalEntity[]
  kinds: StructureKind[]
  entityTypes: EntityType[]
}

export type StructureRpcResult = {
  success?: boolean
  id?: string
  message?: string
}

export type SaveStructureTemplatePayload = {
  id?: string | null
  diocese_id: string
  kind_key: StructureKindKey
  key: string
  name: string
  description?: string | null
  is_primary?: boolean
  is_active?: boolean
  status?: string
}

export type SaveStructureLevelPayload = {
  id?: string | null
  template_id: string
  parent_level_id: string | null
  linked_entity_type_id?: string | null
  level_key: string
  name: string
  plural_name?: string | null
  description?: string | null
  level_order: number
  scope?: string
  is_entry_point?: boolean
  is_required?: boolean
  allows_multiple_entities?: boolean
  allows_new_nodes?: boolean
}

export type SaveStructureNodePayload = {
  id?: string | null
  template_id: string
  level_id: string
  parent_node_id: string | null
  name: string
  official_name?: string | null
  slug: string
  code?: string | null
  description?: string | null
  linked_ecclesiastical_entity_id?: string | null
  linked_organization_unit_id?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  visibility?: string
}

const dioceseEntityTypeKeys = new Set([
  'archdiocese',
  'diocese',
  'military_ordinariate',
  'ordinariate',
  'apostolic_vicariate',
])

function relationArray(entity: EcclesiasticalEntity) {
  if (!entity.entity_types) return []
  return Array.isArray(entity.entity_types) ? entity.entity_types : [entity.entity_types]
}

function requireRpcId(data: unknown, operation: string) {
  const result = data as StructureRpcResult | null
  if (!result?.id) throw new Error(`La operación ${operation} no devolvió un identificador.`)
  return result.id
}

export async function loadStructureBaseData(supabase: SupabaseClient): Promise<StructureBaseData> {
  const [entityResult, kindResult, entityTypeResult] = await Promise.all([
    supabase
      .from('ecclesiastical_entities')
      .select('id,name,official_name,slug,entity_types(key,name)')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('structure_kinds')
      .select('key,name,description')
      .eq('status', 'active')
      .order('sort_order'),
    supabase
      .from('entity_types')
      .select('id,key,name')
      .eq('status', 'active')
      .order('default_level_order'),
  ])

  const error = entityResult.error ?? kindResult.error ?? entityTypeResult.error
  if (error) throw error

  const entities = (entityResult.data ?? []) as EcclesiasticalEntity[]
  const dioceses = entities.filter((entity) =>
    relationArray(entity).some((type) => dioceseEntityTypeKeys.has(type.key))
      || /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato apost[oó]lico/i.test(entity.name),
  )

  return {
    entities,
    dioceses,
    kinds: (kindResult.data ?? []) as StructureKind[],
    entityTypes: (entityTypeResult.data ?? []) as EntityType[],
  }
}

export async function loadStructureTemplates(
  supabase: SupabaseClient,
  dioceseId: string,
  kindKey: StructureKindKey,
): Promise<StructureTemplate[]> {
  const { data, error } = await supabase.rpc('get_structure_templates', {
    p_diocese_id: dioceseId,
    p_kind_key: kindKey,
    p_active_only: false,
  })

  if (error) throw error
  return (data ?? []) as StructureTemplate[]
}

export async function loadStructureTemplateDetails(
  supabase: SupabaseClient,
  templateId: string,
): Promise<{ levels: StructureLevel[]; nodes: StructureTreeNode[] }> {
  const [levelResult, treeResult] = await Promise.all([
    supabase
      .from('structure_levels')
      .select('id,template_id,level_key,name,plural_name,description,level_order,parent_level_id,linked_entity_type_id,scope,is_entry_point,is_required,allows_multiple_entities,allows_new_nodes')
      .eq('template_id', templateId)
      .order('level_order'),
    supabase.rpc('get_structure_tree', {
      p_template_id: templateId,
      p_root_node_id: null,
      p_as_of: new Date().toISOString().slice(0, 10),
      p_include_inactive: false,
    }),
  ])

  const error = levelResult.error ?? treeResult.error
  if (error) throw error

  return {
    levels: (levelResult.data ?? []) as StructureLevel[],
    nodes: (treeResult.data ?? []) as StructureTreeNode[],
  }
}

export async function loadStructureChildLevels(
  supabase: SupabaseClient,
  templateId: string,
  parentLevelId: string | null,
): Promise<ChildLevelOption[]> {
  const { data, error } = await supabase.rpc('get_structure_child_level_options', {
    p_template_id: templateId,
    p_parent_level_id: parentLevelId,
  })

  if (error) throw error
  return (data ?? []) as ChildLevelOption[]
}

export async function saveStructureTemplate(
  supabase: SupabaseClient,
  payload: SaveStructureTemplatePayload,
) {
  const { data, error } = await supabase.rpc('admin_save_structure_template', { payload })
  if (error) throw error
  return requireRpcId(data, 'guardar catálogo de estructura')
}

export async function saveStructureLevel(
  supabase: SupabaseClient,
  payload: SaveStructureLevelPayload,
) {
  const { data, error } = await supabase.rpc('admin_save_structure_level', { payload })
  if (error) throw error
  return requireRpcId(data, 'guardar nivel de estructura')
}

export async function saveStructureNode(
  supabase: SupabaseClient,
  payload: SaveStructureNodePayload,
) {
  const { data, error } = await supabase.rpc('admin_save_structure_node', { payload })
  if (error) throw error
  return requireRpcId(data, 'guardar unidad de estructura')
}

export async function createStructureRootNode(
  supabase: SupabaseClient,
  input: {
    templateId: string
    rootLevelId: string
    diocese: EcclesiasticalEntity
    startDate?: string
  },
) {
  return saveStructureNode(supabase, {
    template_id: input.templateId,
    level_id: input.rootLevelId,
    parent_node_id: null,
    name: input.diocese.name,
    official_name: input.diocese.official_name,
    slug: input.diocese.slug,
    linked_ecclesiastical_entity_id: input.diocese.id,
    start_date: input.startDate ?? new Date().toISOString().slice(0, 10),
    status: 'active',
    visibility: 'public',
  })
}
