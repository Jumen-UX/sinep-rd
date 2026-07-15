import {
  findPotentialDuplicates,
  type DuplicateMatch,
} from '@/lib/admin/duplicateReview'

export type PersonIdentityDecision =
  | { kind: 'reuse'; personId: string }
  | { kind: 'create_new' }

export type PersonIdentityMatch = DuplicateMatch & {
  confidence: 'high' | 'medium' | 'low'
}

export type PersonIdentityResolution =
  | {
      status: 'clear'
      matches: []
      selectedPersonId: null
      duplicateReviewConfirmed: false
    }
  | {
      status: 'review_required'
      matches: PersonIdentityMatch[]
      selectedPersonId: null
      duplicateReviewConfirmed: false
    }
  | {
      status: 'reuse'
      matches: PersonIdentityMatch[]
      selectedPersonId: string
      duplicateReviewConfirmed: false
    }
  | {
      status: 'create_confirmed'
      matches: PersonIdentityMatch[]
      selectedPersonId: null
      duplicateReviewConfirmed: true
    }

function numericScore(value: DuplicateMatch['similarity_score']) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function confidenceFor(match: DuplicateMatch): PersonIdentityMatch['confidence'] {
  const score = numericScore(match.similarity_score)
  const reason = match.match_reason?.toLowerCase() ?? ''

  if (score >= 0.9 || reason.includes('document') || reason.includes('referencia')) return 'high'
  if (score >= 0.72 || match.birth_date) return 'medium'
  return 'low'
}

export function classifyPersonIdentityMatches(matches: DuplicateMatch[]): PersonIdentityMatch[] {
  return matches
    .map((match) => ({ ...match, confidence: confidenceFor(match) }))
    .sort((left, right) => numericScore(right.similarity_score) - numericScore(left.similarity_score))
}

export async function inspectPersonIdentity(
  payload: Record<string, unknown>,
): Promise<PersonIdentityResolution> {
  const matches = classifyPersonIdentityMatches(await findPotentialDuplicates('person', payload))

  if (matches.length === 0) {
    return {
      status: 'clear',
      matches: [],
      selectedPersonId: null,
      duplicateReviewConfirmed: false,
    }
  }

  return {
    status: 'review_required',
    matches,
    selectedPersonId: null,
    duplicateReviewConfirmed: false,
  }
}

export function decidePersonIdentity(
  resolution: PersonIdentityResolution,
  decision: PersonIdentityDecision,
): PersonIdentityResolution {
  if (decision.kind === 'reuse') {
    const selected = resolution.matches.find((match) => match.record_id === decision.personId)
    if (!selected) throw new Error('La persona seleccionada no pertenece a las coincidencias revisadas.')

    return {
      status: 'reuse',
      matches: resolution.matches,
      selectedPersonId: selected.record_id,
      duplicateReviewConfirmed: false,
    }
  }

  if (resolution.matches.length === 0) return resolution

  return {
    status: 'create_confirmed',
    matches: resolution.matches,
    selectedPersonId: null,
    duplicateReviewConfirmed: true,
  }
}
