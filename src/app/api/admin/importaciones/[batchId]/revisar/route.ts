import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const allowedDecisions = new Set(['approved', 'rejected'])

type RouteContext = {
  params: Promise<{ batchId: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.review',
    forbiddenMessage: 'No autorizado para aprobar o rechazar lotes de importación.',
  })
  if (!auth.ok) return auth.response

  const { batchId } = await context.params
  if (!uuidPattern.test(batchId)) {
    return NextResponse.json({ error: 'El identificador del lote no es válido.' }, { status: 400 })
  }

  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'La decisión de revisión no es válida.' }, { status: 400 })
    }

    const decision = typeof body.decision === 'string' ? body.decision.trim().toLowerCase() : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!allowedDecisions.has(decision)) {
      return NextResponse.json({ error: 'La decisión debe ser aprobar o rechazar.' }, { status: 400 })
    }

    if (decision === 'rejected' && !notes) {
      return NextResponse.json({ error: 'Debes indicar el motivo del rechazo.' }, { status: 400 })
    }

    const { data, error } = await auth.supabase.rpc('admin_review_import_batch', {
      payload: {
        batch_id: batchId,
        decision,
        notes: notes || null,
      },
    })

    if (error) {
      console.error('Failed to review import batch', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo registrar la revisión del lote.') },
        { status: 400 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected import batch review error', error)
    return NextResponse.json({ error: 'No se pudo registrar la revisión del lote.' }, { status: 500 })
  }
}
