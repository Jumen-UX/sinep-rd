import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadClergyPlacementCatalogs,
  removeClergyPhoto,
  uploadClergyPhoto,
  type ClergyPlacementCatalogs,
  type UploadedClergyPhoto,
} from '../../shared/services/clergy-admin-service'

export type { OfficeConfig } from '../../shared/services/clergy-admin-service'
export type DeaconType = 'permanent' | 'transitional' | 'external'

export type UnordainedPersonOption = {
  id: string
  display_name: string
  slug: string
}

export type DeaconCatalogs = ClergyPlacementCatalogs & {
  unordainedPeople: UnordainedPersonOption[]
}

export type UploadedDeaconPhoto = UploadedClergyPhoto

export type SaveDeaconResponse = {
  person_id?: string
  clergy_profile_id?: string
  assignment_id?: string | null
  slug?: string
  internal_reference_code?: string
  mode?: 'existing' | 'new'
  error?: string
}

export { loadAllowedOfficeIds } from '../../shared/services/clergy-admin-service'

export async function loadDeaconCatalogs(supabase: SupabaseClient): Promise<DeaconCatalogs> {
  const [placementCatalogs, personResult] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    supabase.rpc('admin_list_unordained_people', { p_limit: 500 }),
  ])

  if (personResult.error) throw personResult.error

  return {
    ...placementCatalogs,
    unordainedPeople: (personResult.data ?? []) as UnordainedPersonOption[],
  }
}

export async function uploadDeaconPhoto(supabase: SupabaseClient, file: File, slug: string): Promise<UploadedDeaconPhoto> {
  return uploadClergyPhoto(supabase, file, 'diaconos', slug)
}

export async function removeDeaconPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  await removeClergyPhoto(supabase, photoPath)
}

export async function saveDeacon(payload: Record<string, unknown>): Promise<SaveDeaconResponse> {
  const response = await fetch('/api/admin/diacono', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json() as SaveDeaconResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el diácono.')
  return data
}
