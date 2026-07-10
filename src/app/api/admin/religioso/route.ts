import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

type SaveReligiousResult = {
  personId: string | null
  profileId: string | null
  assignmentId: string | null
}

function getSaveResult(value: unknown): SaveReligiousResult {
  if (!isJsonObject(value)) {
    return { personId: null, profileId: null, assignmentId: null }
  }

  return {
    personId: typeof value.person_id === 'string' ? value.person_id : null,
    profileId: typeof value.religious_profile_id === 'string' ? value.religious_profile_id : null,
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.create_proposal',
      forbiddenMessage: 'No autorizado para crear religiosos.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const { data, error } = await auth.supabase.rpc('admin_save_religious', { payload })

    if (error) {
      console.error('Failed to save religious transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar el religioso.') }, { status: 400 })
    }

    const result = getSaveResult(data)
    await recordAdminAudit(auth.supabase, {
      action: 'person.religious.create',
      targetTable: 'persons',
      targetId: result.personId,
      metadata: {
        religious_profile_id: result.profileId,
        assignment_id: result.assignmentId,
        religious_life_type: typeof payload.religious_life_type === 'string' ? payload.religious_life_type : null,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected religious admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el religioso' }, { status: 500 })
  }
}
