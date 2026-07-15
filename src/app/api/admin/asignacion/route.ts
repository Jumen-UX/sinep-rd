import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { revalidatePublicContent } from '@/lib/public/cache'
import { normalizeSourceVerification } from '@/features/shared/source-verification'

function getAssignmentId(value: unknown) {
  if (!isJsonObject(value)) return null
  return typeof value.assignment_id === 'string' ? value.assignment_id : null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'appointments.create_proposal',
      forbiddenMessage: 'No autorizado para crear nombramientos.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud inválida.')
    let sourceVerification
    try {
      sourceVerification = normalizeSourceVerification(payload)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'La fuente o verificación no es válida.' },
        { status: 400 },
      )
    }

    const normalizedPayload = { ...payload, ...sourceVerification }
    const { data, error } = await auth.supabase.rpc('admin_save_position_assignment', {
      payload: normalizedPayload,
    })

    if (error) {
      console.error('Failed to save position assignment transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar la asignación.') }, { status: 400 })
    }

    await recordAdminAudit(auth.supabase, {
      action: 'position_assignment.create',
      targetTable: 'position_assignments',
      targetId: getAssignmentId(data),
      metadata: {
        office_configuration_id: typeof payload.office_configuration_id === 'string' ? payload.office_configuration_id : null,
        person_id: typeof payload.person_id === 'string' ? payload.person_id : null,
        assignment_status: typeof payload.assignment_status === 'string' ? payload.assignment_status : null,
        source_name: sourceVerification.source_name,
        source_checked_at: sourceVerification.source_checked_at,
        verification_status: sourceVerification.verification_status,
      },
    })

    revalidatePublicContent()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected position assignment admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar la asignación' }, { status: 500 })
  }
}
