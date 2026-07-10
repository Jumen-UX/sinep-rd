import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
import {
  loadClergyPlacementCatalogs,
  removeClergyPhoto,
  uploadClergyPhoto,
  type OfficeConfig,
  type UploadedClergyPhoto,
} from '../../shared/services/clergy-admin-service'

export type { OfficeConfig } from '../../shared/services/clergy-admin-service'
export { loadAllowedOfficeIds } from '../../shared/services/clergy-admin-service'

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

export type SavePriestResponse = {
  person_id?: string
  slug?: string
  internal_reference_code?: string
  error?: string
}

export type UploadedPriestPhoto = UploadedClergyPhoto

export async function loadPriestCatalogs(supabase: SupabaseClient): Promise<PriestCatalogs> {
  const [placementCatalogs, deaconResult] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    supabase
      .from('person_ecclesial_state')
      .select('id,first_name,middle_name,last_name,second_last_name,display_name,slug,gender,birth_date,birth_place,photo_url,biography_public')
      .eq('highest_ordination_degree', 'diaconate')
      .eq('status', 'active')
      .order('display_name'),
  ])

  if (deaconResult.error) throw deaconResult.error

  return {
    ...placementCatalogs,
    deacons: (deaconResult.data ?? []) as DeaconOption[],
  }
}

export async function uploadPriestPhoto(supabase: SupabaseClient, file: File, slug: string): Promise<UploadedPriestPhoto> {
  return uploadClergyPhoto(supabase, file, 'sacerdotes', slug)
}

export async function removePriestPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  await removeClergyPhoto(supabase, photoPath)
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
