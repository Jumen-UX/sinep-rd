import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadCanonicalRegistrationCandidates,
  saveCanonicalPersonRegistration,
  type CanonicalRegistrationCandidate,
  type CanonicalRegistrationResponse,
} from '@/features/personas/shared/services/canonical-person-registration-service'
import {
  loadClergyPlacementCatalogs,
  removeClergyPhoto,
  uploadClergyPhoto,
  type ClergyPlacementCatalogs,
  type UploadedClergyPhoto,
} from '../../shared/services/clergy-admin-service'

export type { OfficeConfig } from '../../shared/services/clergy-admin-service'
export type DeaconType = 'permanent' | 'transitional' | 'external'
export type UnordainedPersonOption = CanonicalRegistrationCandidate

export type DeaconCatalogs = ClergyPlacementCatalogs & {
  unordainedPeople: UnordainedPersonOption[]
}

export type UploadedDeaconPhoto = UploadedClergyPhoto
export type SaveDeaconResponse = CanonicalRegistrationResponse

export { loadAllowedOfficeIds } from '../../shared/services/clergy-admin-service'

export async function loadDeaconCatalogs(supabase: SupabaseClient): Promise<DeaconCatalogs> {
  const [placementCatalogs, unordainedPeople] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    loadCanonicalRegistrationCandidates(supabase, 'deacon'),
  ])

  return {
    ...placementCatalogs,
    unordainedPeople,
  }
}

export async function uploadDeaconPhoto(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<UploadedDeaconPhoto> {
  return uploadClergyPhoto(supabase, file, 'diaconos', slug)
}

export async function removeDeaconPhoto(
  supabase: SupabaseClient,
  photoPath: string | null | undefined,
) {
  await removeClergyPhoto(supabase, photoPath)
}

export async function saveDeacon(payload: Record<string, unknown>): Promise<SaveDeaconResponse> {
  const selectedPersonId = typeof payload.selected_person_id === 'string'
    ? payload.selected_person_id
    : null

  return saveCanonicalPersonRegistration('deacon', {
    ...payload,
    mode: selectedPersonId ? 'existing' : 'new',
    selected_person_id: selectedPersonId,
  })
}
