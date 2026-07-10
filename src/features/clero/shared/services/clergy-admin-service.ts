import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'

export type OfficeConfig = {
  id: string
  display_name: string
  organization_chart_id: string | null
}

export type ClergyPlacementCatalogs = {
  entities: EntityHierarchyEntity[]
  offices: OfficeConfig[]
}

export type UploadedClergyPhoto = {
  photo_url: string | null
  photo_path: string | null
}

const PHOTO_BUCKET = 'person-photos'
const ENTITY_SELECTOR_COLUMNS = 'direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_key,direct_entity_type_name,jurisdiction_id,jurisdiction_name,jurisdiction_slug,vicariate_id,vicariate_name,vicariate_slug,zone_id,zone_name,zone_slug,parish_id,parish_name,parish_slug,hierarchy_path'

export async function loadClergyPlacementCatalogs(supabase: SupabaseClient): Promise<ClergyPlacementCatalogs> {
  const [entityResult, officeResult] = await Promise.all([
    supabase
      .from('admin_entity_hierarchy_selector')
      .select(ENTITY_SELECTOR_COLUMNS)
      .order('direct_entity_name'),
    supabase
      .from('office_configurations')
      .select('id,display_name,organization_chart_id')
      .eq('status', 'active')
      .order('display_name'),
  ])

  const error = entityResult.error ?? officeResult.error
  if (error) throw error

  return {
    entities: (entityResult.data ?? []) as EntityHierarchyEntity[],
    offices: (officeResult.data ?? []) as OfficeConfig[],
  }
}

export async function loadAllowedOfficeIds(supabase: SupabaseClient, entityId: string): Promise<string[]> {
  if (!entityId) return []

  const { data: nodes, error: nodeError } = await supabase
    .from('structure_nodes')
    .select('level_id')
    .eq('linked_ecclesiastical_entity_id', entityId)
    .eq('status', 'active')
    .limit(1)

  if (nodeError) throw nodeError
  const levelId = (nodes?.[0] as { level_id?: string | null } | undefined)?.level_id
  if (!levelId) return []

  const { data, error } = await supabase
    .from('structure_level_office_configurations')
    .select('office_configuration_id')
    .eq('level_id', levelId)
    .eq('status', 'active')
    .order('sort_order')

  if (error) throw error
  return (data ?? []).map((row) => String(row.office_configuration_id))
}

export async function uploadClergyPhoto(
  supabase: SupabaseClient,
  file: File,
  folder: string,
  slug: string,
): Promise<UploadedClergyPhoto> {
  if (!file || file.size === 0) return { photo_url: null, photo_path: null }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto no debe superar 5 MB.')

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'clero'
  const path = `${safeFolder}/${slug || 'persona'}-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  return { photo_url: data.publicUrl, photo_path: path }
}

export async function removeClergyPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  if (!photoPath) return
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photoPath])
  if (error) console.error('No se pudo limpiar la fotografía huérfana del clero.', error)
}
