import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { oneOf, optionalText, parseJsonObjectBody, requiredUuid, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { revalidatePublicContent } from '@/lib/public/cache'

const allowedDecisions = ['approved', 'rejected'] as const

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      forbiddenMessage: 'No autorizado para revisar solicitudes.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const changeRequestId = requiredUuid(payload.change_request_id, 'solicitud')
    const decision = oneOf(payload.decision, allowedDecisions, 'decisión')
    const rejectionReason = decision === 'rejected'
      ? optionalText(payload.rejection_reason, 2000)
      : null

    if (decision === 'rejected' && !rejectionReason) {
      return NextResponse.json({ error: 'Debes indicar el motivo del rechazo.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('admin_review_person_change_request', {
      p_change_request_id: changeRequestId,
      p_decision: decision,
      p_rejection_reason: rejectionReason,
    })

    if (error) {
      console.error('Failed to review person change request', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo revisar la solicitud.') },
        { status: 400 },
      )
    }

    if (decision === 'approved') revalidatePublicContent()
    return NextResponse.json(data ?? { decision })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected person change review API error', error)
    return NextResponse.json({ error: 'No se pudo revisar la solicitud.' }, { status: 500 })
  }
}
