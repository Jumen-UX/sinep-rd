import type { SupabaseClient } from '@supabase/supabase-js'

export type StructureOfficeOption = {
  id: string
  key: string
  display_name: string
  description?: string | null
  requires_clergy?: boolean
  is_default?: boolean
  sort_order?: number
}

export type StructureLevelOfficeOptions = {
  configured: StructureOfficeOption[]
  available: StructureOfficeOption[]
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadStructureLevelOfficeOptions(
  client: SupabaseClient,
  levelId: string,
): Promise<StructureLevelOfficeOptions> {
  const { data, error } = await client.rpc('get_structure_level_office_options', { p_level_id: levelId })
  throwIfError(error)
  return (data ?? { configured: [], available: [] }) as StructureLevelOfficeOptions
}

export async function saveStructureLevelOffices(
  client: SupabaseClient,
  levelId: string,
  officeConfigurationIds: string[],
  defaultOfficeConfigurationId: string | null,
) {
  const { data, error } = await client.rpc('admin_save_structure_level_offices', {
    payload: {
      level_id: levelId,
      office_configuration_ids: officeConfigurationIds,
      default_office_configuration_id: defaultOfficeConfigurationId,
    },
  })
  throwIfError(error)
  return data
}
