import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadAllowedOfficeIds,
  loadPersonPlacementCatalogs,
  removePersonPhoto,
  uploadPersonPhoto,
  type OfficeConfig,
  type PersonPlacementCatalogs,
  type UploadedPersonPhoto,
} from '@/features/personas/shared/services/person-placement-service'

export type ReligiousLifeType = 'brother' | 'sister' | 'consecrated_lay' | 'other' | 'priest'
export type ReligiousCatalogs = PersonPlacementCatalogs
export type UploadedReligiousPhoto = UploadedPersonPhoto

export type SaveReligiousResponse = {
  person_id?: string
  religious_profile_id?: string
  assignment_id?: string | null
  slug?: string
  internal_reference_code?: string
  error?: string
}

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadReligiousCatalogs(supabase: SupabaseClient): Promise<ReligiousCatalogs> {
  return loadPersonPlacementCatalogs(supabase)
}

export async function uploadReligiousPhoto(supabase: SupabaseClient, file: File, slug: string): Promise<UploadedReligiousPhoto> {
  return uploadPersonPhoto(supabase, file, 'religiosos', slug)
}

export async function removeReligiousPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  await removePersonPhoto(supabase, photoPath)
}

export async function saveReligious(payload: Record<string, unknown>): Promise<SaveReligiousResponse> {
  const response = await fetch('/api/admin/religioso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json() as SaveReligiousResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el religioso.')
  return data
}
