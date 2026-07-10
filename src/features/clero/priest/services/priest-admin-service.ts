import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'

export type OfficeConfig = {
  id: string
  display_name: string
  organization_chart_id: string | null
}

export type DeaconOption = {
  id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  second_last_name: string | null
  display_name: string
  slug: string
  gender: string | null
  birth_date: string | null
  birth_place: string | null
  photo_url: string | null
  biography_public: string | null
}

export type PriestCatalogs = {
  entities: EntityHierarchyEntity[]
  offices: OfficeConfig[]
  deacons: DeaconOption[]
}

export type AllowedOfficeResult = {
  ids: string[]
  message: string
}

export type SavePriestResponse = {
  person_id?: string
  slug?: string
  internal_reference_code?: string
  error?: string
}

export type UploadedPriestPhoto = {
  photo_url: string | null
  photo_path: string | null
}

const PHOTO_BUCKET = 'person-photos'

export async function loadPriestCatalogs(supabase: SupabaseClient): Promise<PriestCatalogs> {
  const [entityResult, officeResult, deaconResult] = await Promise.all([
    supabase
      .from('admin_entity_hierarchy_selector')
      .select('direct_entity_id,direct_entity_name,direct_entity_slug,direct_entity_type_key,direct_entity_type_name,jurisdiction_id,jurisdiction_name,jurisdiction_slug,vicariate_id,vicariate_name,vicariate_slug,zone_id,zone_name,zone_slug,parish_id,parish_name,parish_slug,hierarchy_path')
      .order('direct_entity_name'),
    supabase
      .from('office_configurations')
      .select('id,display_name,organization_chart_id')
      .eq('status', 'active')
      .order('display_name'),
    supabase
      .from('persons')
      .select('id,first_name,middle_name,last_name,second_last_name,display_name,slug,gender,birth_date,birth_place,photo_url,biography_public')
      .eq('person_type', 'deacon')
      .eq('status', 'active')
      .order('display_name'),
  ])

  const error = entityResult.error ?? officeResult.error ?? deaconResult.error
  if (error) throw error

  return {
    entities: (entityResult.data ?? []) as EntityHierarchyEntity[],
    offices: (officeResult.data ?? []) as OfficeConfig[],
    deacons: (deaconResult.data ?? []) as DeaconOption[],
  }
}

export async function loadAllowedOfficeIds(supabase: SupabaseClient, entityId: string): Promise<AllowedOfficeResult> {
  if (!entityId) {
    return {
      ids: [],
      message: 'Selecciona una entidad del cargo para filtrar cargos por nivel estructural.',
    }
  }

  const { data: nodes, error: nodeError } = await supabase
    .from('structure_nodes')
    .select('level_id')
    .eq('linked_ecclesiastical_entity_id', entityId)
    .eq('status', 'active')
    .limit(1)

  if (nodeError) throw nodeError
  const levelId = (nodes?.[0] as { level_id?: string | null } | undefined)?.level_id
  if (!levelId) {
    return {
      ids: [],
      message: 'La entidad seleccionada no tiene nodo estructural activo. Se muestran todos los cargos.',
    }
  }

  const { data, error } = await supabase
    .from('structure_level_office_configurations')
    .select('office_configuration_id')
    .eq('level_id', levelId)
    .eq('status', 'active')
    .order('sort_order')

  if (error) throw error
  const ids = (data ?? []).map((row) => String(row.office_configuration_id))
  return {
    ids,
    message: ids.length > 0
      ? 'Cargos filtrados por el nivel estructural seleccionado.'
      : 'Este nivel no tiene cargos configurados. Se muestran todos los cargos activos.',
  }
}

export async function uploadPriestPhoto(supabase: SupabaseClient, file: File, slug: string): Promise<UploadedPriestPhoto> {
  if (!file || file.size === 0) return { photo_url: null, photo_path: null }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('La foto debe estar en formato JPG, PNG o WEBP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('La foto no debe superar 5 MB.')

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `sacerdotes/${slug || 'sacerdote'}-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  return { photo_url: data.publicUrl, photo_path: path }
}

export async function removePriestPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  if (!photoPath) return
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photoPath])
  if (error) console.error('No se pudo limpiar la fotografía huérfana del sacerdote.', error)
}

export async function savePriest(payload: Record<string, unknown>): Promise<SavePriestResponse> {
  const response = await fetch('/api/admin/sacerdote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json() as SavePriestResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el sacerdote.')
  return data
}
