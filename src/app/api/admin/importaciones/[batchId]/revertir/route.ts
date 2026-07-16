import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ batchId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.apply',
    forbiddenMessage: 'No autorizado para revertir lotes de importación.',
  })
  if (!auth.ok) return auth.response

  const { batchId } = await context.params
  if (!uuidPattern.test(batchId)) {
    return NextResponse.json({ error: 'El identificador del lote no es válido.' }, { status: 400 })
  }

  const body: unknown = await request.json().catch(() => null)
  const reason = typeof body === 'object' && body !== null && 'reason' in body
    ? String((body as { reason?: unknown }).reason ?? '').trim()
    : ''
  if (reason.length < 10) {
    return NextResponse.json({ error: 'Indica un motivo de reversión de al menos 10 caracteres.' }, { status: 400 })
  }

  try {
    const { data, error } = await auth.supabase.rpc('admin_reverse_import_batch', {
      payload: { batch_id: batchId, reason },
    })
    if (error) {
      console.error('Failed to reverse import batch', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudo revertir lógicamente el lote.') },
        { status: 400 },
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected import batch reversal error', error)
    return NextResponse.json({ error: 'No se pudo revertir lógicamente el lote.' }, { status: 500 })
  }
}
