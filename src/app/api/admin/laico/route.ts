import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { isJsonObject, parseJsonObjectBody, ValidationError } from '@/lib/admin/validation'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

type SaveLaypersonResult = {
  personId: string | null
  assignmentId: string | null
}

function getSaveResult(value: unknown): SaveLaypersonResult {
  if (!isJsonObject(value)) {
    return { personId: null, assignmentId: null }
  }

  return {
    personId: typeof value.person_id === 'string' ? value.person_id : null,
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.create_proposal',
      forbiddenMessage: 'No autorizado para crear laicos.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud invalida.')
    const { data, error } = await auth.supabase.rpc('admin_save_layperson', { payload })

    if (error) {
      console.error('Failed to save layperson transactionally', error)
      return NextResponse.json({ error: toSpanishAdminError(error, 'No se pudo guardar el laico.') }, { status: 400 })
    }

    const result = getSaveResult(data)
    await recordAdminAudit(auth.supabase, {
      action: 'person.layperson.create',
      targetTable: 'persons',
      targetId: result.personId,
      metadata: {
        assignment_id: result.assignmentId,
        assignment_entity_id: typeof payload.quick_entity_id === 'string' ? payload.quick_entity_id : null,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected layperson admin API error', error)
    return NextResponse.json({ error: 'No se pudo guardar el laico' }, { status: 500 })
  }
}
