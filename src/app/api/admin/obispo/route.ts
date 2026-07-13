import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, oneOf, optionalText, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { revalidatePublicContent } from '@/lib/public/cache'

const allowedModes = ['existing', 'new'] as const
const allowedEpiscopalRoles = [
  'diocesan',
  'auxiliary',
  'coadjutor',
  'titular',
  'emeritus',
  'apostolic_administrator',
  'apostolic_vicar',
  'apostolic_prefect',
  'other',
] as const
const allowedCanonicalStatuses = [
  'active',
  'retired',
  'emeritus',
  'suspended',
  'restricted',
  'inactive',
  'deceased',
  'lost_clerical_state',
  'unknown',
] as const
const allowedDignities = [
  'archbishop',
  'metropolitan',
  'cardinal',
  'monsignor',
  'patriarch',
  'major_archbishop',
  'other',
] as const

type SaveBishopResult = {
  person_id?: string
  assignment_id?: string
  episcopal_role_id?: string
  slug?: string
}

function getSaveResult(value: unknown): SaveBishopResult {
  if (!isJsonObject(value)) return {}

  return {
    person_id: typeof value.person_id === 'string' ? value.person_id : undefined,
    assignment_id: typeof value.assignment_id === 'string' ? value.assignment_id : undefined,
    episcopal_role_id: typeof value.episcopal_role_id === 'string' ? value.episcopal_role_id : undefined,
    slug: typeof value.slug === 'string' ? value.slug : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.create_proposal',
      forbiddenMessage: 'No autorizado para crear obispos.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const requestedRole = optionalText(payload.episcopal_role_type, 100)
    const normalizedRole = requestedRole
      ? oneOf(requestedRole, allowedEpiscopalRoles, 'función episcopal')
      : null
    const requestedStatus = payload.canonical_status ?? (normalizedRole === 'emeritus' ? 'emeritus' : 'active')
    const dignities = Array.isArray(payload.dignities)
      ? payload.dignities.map((value) => oneOf(value, allowedDignities, 'dignidad'))
      : []

    const normalizedPayload = {
      ...payload,
      mode: oneOf(payload.mode ?? 'existing', allowedModes, 'modo de registro'),
      episcopal_role_type: normalizedRole,
      canonical_status: oneOf(requestedStatus, allowedCanonicalStatuses, 'estado canónico'),
      dignities: [...new Set(dignities)],
    }

    const { data, error } = await auth.supabase.rpc('admin_save_bishop', { payload: normalizedPayload })

    if (error) {
      console.error('Failed to save bishop transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar el obispo.') }, { status: 400 })
    }

    const result = getSaveResult(data)
    await recordAdminAudit(auth.supabase, {
      action: 'person.bishop.create',
      targetTable: 'persons',
      targetId: result.person_id ?? null,
      metadata: {
        mode: normalizedPayload.mode,
        assignment_id: result.assignment_id ?? null,
        episcopal_role_id: result.episcopal_role_id ?? null,
        episcopal_role_type: normalizedPayload.episcopal_role_type,
        canonical_status: normalizedPayload.canonical_status,
        dignities: normalizedPayload.dignities,
        assignment_entity_id: typeof payload.assignment_entity_id === 'string' ? payload.assignment_entity_id : null,
      },
    })

    revalidatePublicContent({ personSlug: result.slug ?? null })
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected bishop admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el obispo' }, { status: 500 })
  }
}
