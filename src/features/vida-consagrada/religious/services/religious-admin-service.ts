import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadCanonicalRegistrationCandidates,
  saveCanonicalPersonRegistration,
  type CanonicalRegistrationCandidate,
  type CanonicalRegistrationResponse,
} from '@/features/personas/shared/services/canonical-person-registration-service'
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
export type ReligiousCandidate = CanonicalRegistrationCandidate
export type ReligiousCatalogs = PersonPlacementCatalogs & {
  candidates: ReligiousCandidate[]
}
export type UploadedReligiousPhoto = UploadedPersonPhoto
export type SaveReligiousResponse = CanonicalRegistrationResponse

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadReligiousCatalogs(supabase: SupabaseClient): Promise<ReligiousCatalogs> {
  const [placementCatalogs, candidates] = await Promise.all([
    loadPersonPlacementCatalogs(supabase),
    loadCanonicalRegistrationCandidates(supabase, 'religious'),
  ])

  return {
    ...placementCatalogs,
    candidates,
  }
}

export async function uploadReligiousPhoto(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<UploadedReligiousPhoto> {
  return uploadPersonPhoto(supabase, file, 'religiosos', slug)
}

export async function removeReligiousPhoto(
  supabase: SupabaseClient,
  photoPath: string | null | undefined,
) {
  await removePersonPhoto(supabase, photoPath)
}

export async function saveReligious(payload: Record<string, unknown>): Promise<SaveReligiousResponse> {
  const selectedPersonId = typeof payload.selected_person_id === 'string'
    ? payload.selected_person_id
    : null

  return saveCanonicalPersonRegistration('religious', {
    ...payload,
    mode: selectedPersonId ? 'existing' : 'new',
    selected_person_id: selectedPersonId,
  })
}
