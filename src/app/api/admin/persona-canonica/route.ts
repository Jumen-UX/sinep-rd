import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAudit } from '@/lib/admin/audit'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'
import {
  isJsonObject,
  oneOf,
  optionalUuid,
  parseJsonObjectBody,
  ValidationError,
} from '@/lib/admin/validation'

const allowedFlows = ['layperson', 'religious', 'deacon', 'priest', 'bishop'] as const
const allowedModes = ['existing', 'new'] as const

type SaveResult = {
  personId: string | null
  clergyProfileId: string | null
  religiousProfileId: string | null
  assignmentId: string | null
  episcopalRoleId: string | null
  effectivePersonType: string | null
}

function getSaveResult(value: unknown): SaveResult {
  if (!isJsonObject(value)) {
    return {
      personId: null,
      clergyProfileId: null,
      religiousProfileId: null,
      assignmentId: null,
      episcopalRoleId: null,
      effectivePersonType: null,
    }
  }

  return {
    personId: typeof value.person_id === 'string' ? value.person_id : null,
    clergyProfileId: typeof value.clergy_profile_id === 'string' ? value.clergy_profile_id : null,
    religiousProfileId: typeof value.religious_profile_id === 'string' ? value.religious_profile_id : null,
    assignmentId: typeof value.assignment_id === 'string' ? value.assignment_id : null,
    episcopalRoleId: typeof value.episcopal_role_id === 'string' ? value.episcopal_role_id : null,
    effectivePersonType: typeof value.effective_person_type === 'string' ? value.effective_person_type : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminAccess({
      permissionKey: 'people.create_proposal',
      forbiddenMessage: 'No autorizado para registrar personas.',
    })
    if (!auth.ok) return auth.response

    const payload = await parseJsonObjectBody(request, 'Solicitud inválida.')
    const flow = oneOf(payload.flow, allowedFlows, 'flujo de registro')
    const selectedPersonId = optionalUuid(payload.selected_person_id)
    const mode = oneOf(
      payload.mode ?? (selectedPersonId ? 'existing' : 'new'),
      allowedModes,
      'modo de registro',
    )

    if (mode === 'existing' && !selectedPersonId) {
      return NextResponse.json({ error: 'Debes seleccionar una persona existente.' }, { status: 400 })
    }

    const normalizedPayload = {
      ...payload,
      flow,
      mode,
      selected_person_id: selectedPersonId,
    }

    const { data, error } = await auth.supabase.rpc('admin_save_canonical_person', {
      payload: normalizedPayload,
    })

    if (error) {
      console.error('Failed to save canonical person registration', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo registrar la persona.') },
        { status: 400 },
      )
    }

    const result = getSaveResult(data)
    await recordAdminAudit(auth.supabase, {
      action: `person.canonical.${flow}.${mode}`,
      targetTable: 'persons',
      targetId: result.personId,
      metadata: {
        flow,
        mode,
        selected_person_id: selectedPersonId,
        clergy_profile_id: result.clergyProfileId,
        religious_profile_id: result.religiousProfileId,
        assignment_id: result.assignmentId,
        episcopal_role_id: result.episcopalRoleId,
        effective_person_type: result.effectivePersonType,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error('Unexpected canonical person registration error', error)
    return NextResponse.json({ error: 'No se pudo registrar la persona.' }, { status: 500 })
  }
}
