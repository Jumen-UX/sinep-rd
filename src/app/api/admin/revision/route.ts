import { NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import {
  oneOf,
  optionalText,
  optionalUuid,
  parseJsonObjectBody,
  requiredText,
  ValidationError,
} from '@/lib/admin/validation'

const allowedItemTypes = [
  'position_assignment',
  'person_candidate',
  'missing_field',
  'change_request',
] as const

const allowedDecisions = [
  'approve_internal',
  'publish',
  'needs_correction',
  'dispute',
  'keep_internal',
  'reject',
  'resolve',
  'not_applicable',
  'approved',
  'needs_changes',
  'rejected',
] as const

export async function GET() {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const { data, error } = await auth.supabase.rpc('admin_review_queue', { payload: { limit: 500 } })

    if (error) {
      console.error('Failed to load admin review queue', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo cargar la cola de revisión.') }, { status: 400 })
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    console.error('Unexpected admin review queue API error', error)
    return NextResponse.json({ error: 'No se pudo cargar la cola de revisión.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminAccess()
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud de revisión inválida.')
    const itemType = oneOf(payload.item_type, allowedItemTypes, 'tipo de pendiente')
    const decision = oneOf(payload.decision, allowedDecisions, 'decisión')
    const recordId = optionalUuid(payload.record_id)
    const sourceId = optionalText(payload.source_id, 120)

    if (!recordId && !sourceId) {
      throw new ValidationError('Falta el identificador del registro a revisar.')
    }

    const normalizedPayload = {
      item_type: itemType,
      record_id: recordId || null,
      source_id: sourceId || null,
      decision,
      notes: optionalText(payload.notes, 2000) || null,
      publish_person: payload.publish_person === true,
    }

    const { data, error } = await auth.supabase.rpc('admin_review_item', { payload: normalizedPayload })

    if (error) {
      console.error('Failed to review admin queue item', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo completar la revisión.') }, { status: 400 })
    }

    return NextResponse.json({ result: data })
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected admin review decision API error', error)
    return NextResponse.json({ error: 'No se pudo completar la revisión.' }, { status: 500 })
  }
}
