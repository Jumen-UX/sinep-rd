import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntityHierarchyEntity } from '@/components/admin/EntityHierarchyPicker'
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
  type OfficeConfig,
  type UploadedClergyPhoto,
} from '../../shared/services/clergy-admin-service'

export type { OfficeConfig } from '../../shared/services/clergy-admin-service'
export { loadAllowedOfficeIds } from '../../shared/services/clergy-admin-service'

export type DeaconOption = CanonicalRegistrationCandidate

export type PriestCatalogs = {
  entities: EntityHierarchyEntity[]
  offices: OfficeConfig[]
  deacons: DeaconOption[]
}

export type SavePriestResponse = CanonicalRegistrationResponse
export type UploadedPriestPhoto = UploadedClergyPhoto

export async function loadPriestCatalogs(supabase: SupabaseClient): Promise<PriestCatalogs> {
  const [placementCatalogs, deacons] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    loadCanonicalRegistrationCandidates(supabase, 'priest'),
  ])

  return {
    ...placementCatalogs,
    deacons,
  }
}

export async function uploadPriestPhoto(
  supabase: SupabaseClient,
  file: File,
  slug: string,
): Promise<UploadedPriestPhoto> {
  return uploadClergyPhoto(supabase, file, 'sacerdotes', slug)
}

export async function removePriestPhoto(
  supabase: SupabaseClient,
  photoPath: string | null | undefined,
) {
  await removeClergyPhoto(supabase, photoPath)
}

export async function savePriest(payload: Record<string, unknown>): Promise<SavePriestResponse> {
  const selectedPersonId = typeof payload.existing_deacon_person_id === 'string'
    ? payload.existing_deacon_person_id
    : null

  return saveCanonicalPersonRegistration('priest', {
    ...payload,
    mode: selectedPersonId ? 'existing' : 'new',
    selected_person_id: selectedPersonId,
  })
}
