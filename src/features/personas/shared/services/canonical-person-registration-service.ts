import type { SupabaseClient } from '@supabase/supabase-js'
import { reviewPotentialDuplicates } from '@/lib/admin/duplicateReview'
import {
  decidePersonIdentity,
  inspectPersonIdentity,
  type PersonIdentityDecision,
} from './person-identity-resolution-service'

export type CanonicalRegistrationFlow = 'layperson' | 'religious' | 'deacon' | 'priest' | 'bishop'
export type CanonicalRegistrationMode = 'existing' | 'new'

export type CanonicalRegistrationCandidate = {
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
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  effective_person_type: string | null
  is_religious: boolean
  religious_life_type: string | null
}

export type CanonicalRegistrationResponse = {
  person_id?: string
  clergy_profile_id?: string | null
  religious_profile_id?: string | null
  assignment_id?: string | null
  closed_previous_current_count?: number
  episcopal_role_id?: string | null
  slug?: string
  internal_reference_code?: string
  flow?: CanonicalRegistrationFlow
  mode?: CanonicalRegistrationMode
  effective_person_type?: string | null
  error?: string
}

export async function loadCanonicalRegistrationCandidates(
  supabase: SupabaseClient,
  flow: CanonicalRegistrationFlow,
  limit = 500,
): Promise<CanonicalRegistrationCandidate[]> {
  const { data, error } = await supabase.rpc('admin_list_canonical_registration_candidates', {
    p_flow: flow,
    p_limit: limit,
  })

  if (error) throw error
  return (data ?? []) as CanonicalRegistrationCandidate[]
}

function readIdentityDecision(value: unknown): PersonIdentityDecision | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>

  if (candidate.kind === 'create_new') return { kind: 'create_new' }
  if (candidate.kind === 'reuse' && typeof candidate.personId === 'string' && candidate.personId) {
    return { kind: 'reuse', personId: candidate.personId }
  }

  return null
}

export async function saveCanonicalPersonRegistration(
  flow: CanonicalRegistrationFlow,
  payload: Record<string, unknown>,
): Promise<CanonicalRegistrationResponse> {
  let selectedPersonId = typeof payload.selected_person_id === 'string'
    ? payload.selected_person_id
    : null
  let mode: CanonicalRegistrationMode = payload.mode === 'existing' || selectedPersonId
    ? 'existing'
    : 'new'
  let duplicateMatchCount = 0
  let duplicateReviewConfirmed = false

  if (mode === 'new') {
    const identityDecision = readIdentityDecision(payload.identity_decision)

    if (identityDecision) {
      const inspection = await inspectPersonIdentity(payload)
      const resolution = decidePersonIdentity(inspection, identityDecision)
      duplicateMatchCount = resolution.matches.length
      duplicateReviewConfirmed = resolution.duplicateReviewConfirmed

      if (resolution.status === 'reuse') {
        selectedPersonId = resolution.selectedPersonId
        mode = 'existing'
      }
    } else {
      duplicateMatchCount = await reviewPotentialDuplicates('person', payload)
      duplicateReviewConfirmed = duplicateMatchCount > 0
    }
  }

  const response = await fetch('/api/admin/persona-canonica', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      flow,
      mode,
      selected_person_id: selectedPersonId,
      duplicate_review_confirmed: duplicateReviewConfirmed,
      duplicate_match_count: duplicateMatchCount,
    }),
  })

  const data = await response.json() as CanonicalRegistrationResponse
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar la persona.')
  return data
}
