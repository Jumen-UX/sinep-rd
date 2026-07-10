import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadAllowedOfficeIds,
  loadPersonPlacementCatalogs,
  removePersonPhoto,
  uploadPersonPhoto,
  type OfficeConfig,
  type PersonPlacementCatalogs,
  type UploadedPersonPhoto,
} from '../../shared/services/person-placement-service'

export type LayPersonCatalogs = PersonPlacementCatalogs
export type UploadedLayPersonPhoto = UploadedPersonPhoto

export type SaveLayPersonResponse = {
  person_id?: string
  assignment_id?: string | null
  slug?: string
  internal_reference_code?: string
  error?: string
}

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadLayPersonCatalogs(supabase: SupabaseClient): Promise<LayPersonCatalogs> {
  return loadPersonPlacementCatalogs(supabase)
}

export async function uploadLayPersonPhoto(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<UploadedLayPersonPhoto> {
  return uploadPersonPhoto(supabase, file, 'laicos', slug)
}

export async function removeLayPersonPhoto(supabase: SupabaseClient, photoPath: string | null | undefined) {
  await removePersonPhoto(supabase, photoPath)
}

export async function saveLayPerson(payload: Record<string, unknown>): Promise<SaveLayPersonResponse> {
  const response = await fetch('/api/admin/laico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json() as SaveLayPersonResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la persona laica.')
  return data
}
