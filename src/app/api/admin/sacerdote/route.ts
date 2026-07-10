import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import { oneOf, optionalText, optionalUuid, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'

type SavePriestResult = {
  person_id?: string
  clergy_profile_id?: string
  assignment_id?: string
  closed_previous_current_count?: number
  slug?: string
  internal_reference_code?: string
  priest_type?: 'diocesan' | 'religious'
}

const allowedPriestTypes = ['diocesan', 'religious'] as const

function cleanText(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({ permissionKey: 'people.create_proposal' })
    if (!auth.ok) return auth.response
    const supabase = auth.supabase

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const existingDeaconId = optionalUuid(payload.existing_deacon_person_id)
    const firstName = optionalText(payload.first_name, 120)
    const lastName = optionalText(payload.last_name, 120)

    if (!existingDeaconId && (!firstName || !lastName)) {
      return NextResponse.json({ error: 'Faltan nombre y apellido del sacerdote.' }, { status: 400 })
    }

    const requestedPriestType = optionalText(payload.priest_type, 40)
    const priestType = oneOf(
      requestedPriestType || (cleanText(payload.religious_institute_name) || cleanText(payload.religious_order) ? 'religious' : 'diocesan'),
      allowedPriestTypes,
      'tipo de sacerdote',
    )

    const normalizedPayload = {
      ...payload,
      existing_deacon_person_id: existingDeaconId || null,
      first_name: firstName || null,
      last_name: lastName || null,
      priest_type: priestType,
    }

    const { data, error } = await supabase.rpc('admin_save_priest', { payload: normalizedPayload })

    if (error) {
      console.error('Failed to save priest transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar el sacerdote.') }, { status: 400 })
    }

    const result = data as SavePriestResult

    await recordAdminAudit(supabase, {
      action: 'person.priest.create',
      targetTable: 'persons',
      targetId: result.person_id ?? null,
      metadata: {
        clergy_profile_id: result.clergy_profile_id ?? null,
        assignment_id: result.assignment_id ?? null,
        closed_previous_current_count: result.closed_previous_current_count ?? 0,
        existing_deacon: Boolean(existingDeaconId),
        priest_type: result.priest_type ?? priestType,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected priest admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el sacerdote' }, { status: 500 })
  }
}
