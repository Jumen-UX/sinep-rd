import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

type SaveDeaconResult = {
  personId: string | null
  profileId: string | null
  assignmentId: string | null
}

function getSaveResult(value: unknown): SaveDeaconResult {
  if (!isJsonObject(value)) {
    return { personId: null, profileId: null, assignmentId: null }
  }

  return {
    personId: typeof value.person_id === 'string' ? value.person_id : null,
    profileId: typeof value.clergy_profile_id === 'string' ? value.clergy_profile_id : null,
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.create_proposal',
      forbiddenMessage: 'No autorizado para registrar diáconos.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const mode = payload.mode === 'existing' ? 'existing' : 'new'
    const { data, error } = await auth.supabase.rpc('admin_save_deacon', { payload: { ...payload, mode } })

    if (error) {
      console.error('Failed to save deacon transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo registrar el diácono.') }, { status: 400 })
    }

    const result = getSaveResult(data)
    await recordAdminAudit(auth.supabase, {
      action: mode === 'existing' ? 'person.deacon.ordination' : 'person.deacon.create',
      targetTable: 'persons',
      targetId: result.personId,
      metadata: {
        mode,
        selected_person_id: typeof payload.selected_person_id === 'string' ? payload.selected_person_id : null,
        clergy_profile_id: result.profileId,
        assignment_id: result.assignmentId,
        deacon_type: typeof payload.deacon_type === 'string' ? payload.deacon_type : null,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected deacon admin API error', error)
    return NextResponse.json({ error: 'No se pudo registrar el diácono' }, { status: 500 })
  }
}
