import type { SupabaseClient } from '@supabase/supabase-js'

export type StructureKindKey = 'territorial' | 'pastoral' | 'administrative' | 'organic'

export type Diocese = {
  id: string
  name: string
  slug: string
}

export type StructureTemplate = {
  id: string
  diocese_id: string
  kind_key: StructureKindKey
  key: string
  name: string
  is_primary: boolean
  status: string
}

export type StructureLevel = {
  id: string
  level_key: string
  name: string
  plural_name: string | null
  level_order: number
  parent_level_id: string | null
  scope: string
}

export type OfficeConfiguration = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
}

export type LevelOfficeConfiguration = {
  id: string
  level_id: string
  office_configuration_id: string
  sort_order: number | null
  status: string
}

export type LevelOfficeBaseData = {
  dioceses: Diocese[]
  offices: OfficeConfiguration[]
}

export type LevelOfficeTemplateData = {
  levels: StructureLevel[]
  relations: LevelOfficeConfiguration[]
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

function isDioceseLike(name: string) {
  return /di[oó]cesis|arquidi[oó]cesis|ordinariato|vicariato apost[oó]lico/i.test(name)
}

export async function hasLevelOfficeAdminSession(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  throwIfError(error, 'No se pudo comprobar la sesión administrativa.')
  return Boolean(data.user)
}

export async function loadLevelOfficeBaseData(supabase: SupabaseClient): Promise<LevelOfficeBaseData> {
  const [entityResult, officeResult] = await Promise.all([
    supabase.from('ecclesiastical_entities').select('id,name,slug').eq('status', 'active').order('name'),
    supabase.from('office_configurations').select('id,key,display_name,organization_chart_id').eq('status', 'active').order('display_name'),
  ])

  throwIfError(entityResult.error, 'No se pudieron cargar las jurisdicciones.')
  throwIfError(officeResult.error, 'No se pudieron cargar los cargos configurados.')

  return {
    dioceses: ((entityResult.data ?? []) as Diocese[]).filter((entity) => isDioceseLike(entity.name)),
    offices: (officeResult.data ?? []) as OfficeConfiguration[],
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

  throwIfError(error, 'No se pudieron cargar los catálogos estructurales.')
  return (data ?? []) as StructureTemplate[]
}

export async function loadLevelOfficeTemplateData(
  supabase: SupabaseClient,
  templateId: string,
): Promise<LevelOfficeTemplateData> {
  const [levelResult, relationResult] = await Promise.all([
    supabase
      .from('structure_levels')
      .select('id,level_key,name,plural_name,level_order,parent_level_id,scope')
      .eq('template_id', templateId)
      .order('level_order'),
    supabase
      .from('structure_level_office_configurations')
      .select('id,level_id,office_configuration_id,sort_order,status')
      .eq('status', 'active')
      .order('sort_order'),
  ])

  throwIfError(levelResult.error, 'No se pudieron cargar los niveles estructurales.')
  throwIfError(relationResult.error, 'No se pudieron cargar los cargos permitidos por nivel.')

  return {
    levels: (levelResult.data ?? []) as StructureLevel[],
    relations: (relationResult.data ?? []) as LevelOfficeConfiguration[],
  }
}

export async function saveLevelOfficeConfiguration(
  supabase: SupabaseClient,
  levelId: string,
  selectedOfficeIds: string[],
  _existingRelationIds: string[],
): Promise<LevelOfficeConfiguration[]> {
  const uniqueOfficeIds = [...new Set(selectedOfficeIds)]
  const { data, error } = await supabase.rpc('admin_save_structure_level_offices', {
    payload: {
      level_id: levelId,
      office_configuration_ids: uniqueOfficeIds,
      default_office_configuration_id: uniqueOfficeIds[0] ?? null,
    },
  })

  throwIfError(error, 'No se pudieron guardar los cargos permitidos del nivel.')
  return (data ?? []) as LevelOfficeConfiguration[]
}
