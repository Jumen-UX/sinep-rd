import {
  normalizeSourceVerification,
  type SourceVerificationPayload,
  type VerificationStatus,
} from '@/features/shared/source-verification'

export const eventEvidenceStatuses = [
  'confirmado_oficial',
  'fuente_secundaria',
  'importado_vigente',
  'pendiente_documento',
  'contradictorio',
  'corregido',
] as const

export type EventEvidenceStatus = typeof eventEvidenceStatuses[number]

export type EventVerificationInput = {
  sourceName: string
  sourceUrl: string
  sourceCheckedAt: string
  verificationStatus: VerificationStatus
  evidenceStatus: EventEvidenceStatus
}

export type NormalizedEventVerification = SourceVerificationPayload & {
  evidence_status: EventEvidenceStatus
}

export function normalizeEventVerification(
  input: EventVerificationInput,
): NormalizedEventVerification {
  if (!eventEvidenceStatuses.includes(input.evidenceStatus)) {
    throw new Error('Estado de evidencia del evento inválido.')
  }

  const source = normalizeSourceVerification({
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    source_checked_at: input.sourceCheckedAt,
    verification_status: input.verificationStatus,
  })

  if (input.evidenceStatus === 'confirmado_oficial' && source.verification_status !== 'verified') {
    throw new Error('La evidencia oficial debe registrarse como verificada.')
  }

  if (source.verification_status === 'verified' && input.evidenceStatus === 'pendiente_documento') {
    throw new Error('Un evento verificado no puede conservar evidencia pendiente de documento.')
  }

  return {
    ...source,
    evidence_status: input.evidenceStatus,
  }
}
