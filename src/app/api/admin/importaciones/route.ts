import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const allowedStatuses = new Set([
  'prepared',
  'validating',
  'needs_review',
  'validated',
  'applying',
  'applied',
  'failed',
  'cancelled',
])

export async function GET(request: NextRequest) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.prepare',
    forbiddenMessage: 'No autorizado para consultar importaciones por lotes.',
  })
  if (!auth.ok) return auth.response

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20')
  const limit = Number.isSafeInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20
  const status = request.nextUrl.searchParams.get('status')?.trim() ?? ''

  if (status && !allowedStatuses.has(status)) {
    return NextResponse.json({ error: 'El estado solicitado no es válido.' }, { status: 400 })
  }

  try {
    let query = auth.supabase
      .from('import_batches')
      .select('id, import_type, status, review_status, file_name, file_size_bytes, file_sha256, scope_entity_id, row_count, valid_rows, warning_rows, error_rows, duplicate_rows, unresolved_rows, created_by, validated_at, reviewed_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)

    const { data, error } = await query

    if (error) {
      console.error('Failed to list import batches', error)
      return NextResponse.json(
        { error: toSpanishAdminError(error, 'No se pudieron consultar los lotes de importación.') },
        { status: 400 },
      )
    }

    return NextResponse.json({ batches: data ?? [] })
  } catch (error) {
    console.error('Unexpected import batch list error', error)
    return NextResponse.json({ error: 'No se pudieron consultar los lotes de importación.' }, { status: 500 })
  }
}
