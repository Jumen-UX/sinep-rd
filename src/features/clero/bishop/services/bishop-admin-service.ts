import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadCanonicalRegistrationCandidates,
  saveCanonicalPersonRegistration,
  type CanonicalRegistrationCandidate,
  type CanonicalRegistrationResponse,
} from '@/features/personas/shared/services/canonical-person-registration-service'
import {
  loadAllowedOfficeIds,
  loadClergyPlacementCatalogs,
  type ClergyPlacementCatalogs,
  type OfficeConfig,
} from '../../shared/services/clergy-admin-service'

export type BishopRoleType =
  | 'diocesan'
  | 'auxiliary'
  | 'coadjutor'
  | 'titular'
  | 'emeritus'
  | 'apostolic_administrator'
  | 'apostolic_vicar'
  | 'apostolic_prefect'
  | 'other'

export type ClericalStatusType =
  | 'active'
  | 'retired'
  | 'emeritus'
  | 'suspended'
  | 'restricted'
  | 'inactive'
  | 'deceased'
  | 'lost_clerical_state'
  | 'unknown'

export type EcclesiasticalDignity =
  | 'archbishop'
  | 'metropolitan'
  | 'cardinal'
  | 'monsignor'
  | 'patriarch'
  | 'major_archbishop'
  | 'other'

export type ClergyRecord = CanonicalRegistrationCandidate

export type BishopCatalogs = ClergyPlacementCatalogs & {
  clergyRecords: ClergyRecord[]
}

export type SaveBishopResponse = CanonicalRegistrationResponse

export type { OfficeConfig }
export { loadAllowedOfficeIds }

export async function loadBishopCatalogs(supabase: SupabaseClient): Promise<BishopCatalogs> {
  const [placementCatalogs, candidates, ordainerResult] = await Promise.all([
    loadClergyPlacementCatalogs(supabase),
    loadCanonicalRegistrationCandidates(supabase, 'bishop'),
    supabase
      .from('person_ecclesial_state')
      .select('id,first_name,middle_name,last_name,second_last_name,display_name,slug,gender,birth_date,birth_place,photo_url,biography_public,highest_ordination_degree,effective_person_type')
      .eq('has_episcopate', true)
      .eq('status', 'active')
      .order('display_name'),
  ])

  if (ordainerResult.error) throw ordainerResult.error

  const ordainers = (ordainerResult.data ?? []).map((person) => ({
    ...person,
    is_religious: false,
    religious_life_type: null,
  })) as ClergyRecord[]
  const clergyById = new Map<string, ClergyRecord>()
  for (const record of [...candidates, ...ordainers]) clergyById.set(record.id, record)

  return {
    ...placementCatalogs,
    clergyRecords: [...clergyById.values()],
  }
}

export async function saveBishop(payload: Record<string, unknown>): Promise<SaveBishopResponse> {
  const selectedPersonId = typeof payload.selected_clergy_id === 'string'
    ? payload.selected_clergy_id
    : null

  return saveCanonicalPersonRegistration('bishop', {
    ...payload,
    mode: selectedPersonId ? 'existing' : 'new',
    selected_person_id: selectedPersonId,
  })
}
