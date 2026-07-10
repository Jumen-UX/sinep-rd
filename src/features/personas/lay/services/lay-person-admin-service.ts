import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadCanonicalRegistrationCandidates,
  saveCanonicalPersonRegistration,
  type CanonicalRegistrationCandidate,
  type CanonicalRegistrationResponse,
} from '../../shared/services/canonical-person-registration-service'
import {
  loadAllowedOfficeIds,
  loadPersonPlacementCatalogs,
  removePersonPhoto,
  uploadPersonPhoto,
  type OfficeConfig,
  type PersonPlacementCatalogs,
  type UploadedPersonPhoto,
} from '../../shared/services/person-placement-service'

export type LayPersonCandidate = CanonicalRegistrationCandidate
export type LayPersonCatalogs = PersonPlacementCatalogs & {
  candidates: LayPersonCandidate[]
}
export type UploadedLayPersonPhoto = UploadedPersonPhoto
export type SaveLayPersonResponse = CanonicalRegistrationResponse

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadLayPersonCatalogs(supabase: SupabaseClient): Promise<LayPersonCatalogs> {
  const [placementCatalogs, candidates] = await Promise.all([
    loadPersonPlacementCatalogs(supabase),
    loadCanonicalRegistrationCandidates(supabase, 'layperson'),
  ])

  return {
    ...placementCatalogs,
    candidates,
  }
}

export async function uploadLayPersonPhoto(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<UploadedLayPersonPhoto> {
  return uploadPersonPhoto(supabase, file, 'laicos', slug)
}

export async function removeLayPersonPhoto(
  supabase: SupabaseClient,
  photoPath: string | null | undefined,
) {
  await removePersonPhoto(supabase, photoPath)
}

export async function saveLayPerson(payload: Record<string, unknown>): Promise<SaveLayPersonResponse> {
  const selectedPersonId = typeof payload.selected_person_id === 'string'
    ? payload.selected_person_id
    : null

  return saveCanonicalPersonRegistration('layperson', {
    ...payload,
    mode: selectedPersonId ? 'existing' : 'new',
    selected_person_id: selectedPersonId,
  })
}
