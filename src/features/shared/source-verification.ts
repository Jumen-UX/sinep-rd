export const verificationStatuses = [
  'pending_review',
  'verified',
  'rejected',
  'unverified',
] as const

export type VerificationStatus = typeof verificationStatuses[number]

export type SourceVerificationPayload = {
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  verification_status: VerificationStatus
}

function optionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function optionalIsoDate(value: unknown) {
  const normalized = optionalText(value)
  if (!normalized) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('La fecha de revisión de la fuente debe usar el formato AAAA-MM-DD.')
  }
  return normalized
}

function optionalHttpUrl(value: unknown) {
  const normalized = optionalText(value)
  if (!normalized) return null

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    throw new Error('La URL de la fuente no es válida.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('La URL de la fuente debe usar HTTP o HTTPS.')
  }

  return parsed.toString()
}

export function normalizeSourceVerification(
  payload: Record<string, unknown>,
): SourceVerificationPayload {
  const sourceName = optionalText(payload.source_name)
  const sourceUrl = optionalHttpUrl(payload.source_url)
  const sourceCheckedAt = optionalIsoDate(payload.source_checked_at)
  const requestedStatus = optionalText(payload.verification_status) ?? 'pending_review'

  if (!verificationStatuses.includes(requestedStatus as VerificationStatus)) {
    throw new Error('Estado de verificación inválido.')
  }

  const verificationStatus = requestedStatus as VerificationStatus
  if (verificationStatus === 'verified' && (!sourceName || !sourceCheckedAt)) {
    throw new Error('Una verificación confirmada requiere nombre de fuente y fecha de revisión.')
  }

  return {
    source_name: sourceName,
    source_url: sourceUrl,
    source_checked_at: sourceCheckedAt,
    verification_status: verificationStatus,
  }
}
