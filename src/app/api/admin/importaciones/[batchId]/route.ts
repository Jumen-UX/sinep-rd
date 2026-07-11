import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = {
  params: Promise<{ batchId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.prepare',
    forbiddenMessage: 'No autorizado para consultar este lote de importación.',
  })
  if (!auth.ok) return auth.response

  const { batchId } = await context.params
  if (!uuidPattern.test(batchId)) {
    return NextResponse.json({ error: 'El identificador del lote no es válido.' }, { status: 400 })
  }

  try {
    const { data: batch, error: batchError } = await auth.supabase
      .from('import_batches')
      .select('id, import_type, status, template_version, file_name, file_extension, file_mime_type, file_size_bytes, file_sha256, file_last_modified_at, source_metadata, scope_entity_id, created_by, validated_by, row_count, valid_rows, warning_rows, error_rows, duplicate_rows, unresolved_rows, applied_rows, validation_summary, last_error, validated_at, reviewed_at, applied_at, created_at, updated_at')
      .eq('id', batchId)
      .maybeSingle()

    if (batchError) {
      console.error('Failed to read import batch', batchError)
      return NextResponse.json(
        { error: toSpanishAdminError(batchError, 'No se pudo consultar el lote de importación.') },
        { status: 400 },
      )
    }

    if (!batch) {
      return NextResponse.json({ error: 'El lote no existe o está fuera de tu alcance.' }, { status: 404 })
    }

    const [{ data: rows, error: rowsError }, { data: issues, error: issuesError }] = await Promise.all([
      auth.supabase
        .from('import_batch_rows')
        .select('id, batch_id, row_number, status, raw_data, normalized_data, row_hash, resolved_relations, target_operation, target_schema, target_table, target_record_id, corrected_by, corrected_at, applied_at, created_at, updated_at')
        .eq('batch_id', batchId)
        .order('row_number', { ascending: true }),
      auth.supabase
        .from('import_batch_row_issues')
        .select('id, batch_id, row_id, issue_type, code, field_name, message, details, status, resolved_by, resolved_at, resolution_notes, created_at')
        .eq('batch_id', batchId)
        .eq('status', 'open')
        .order('created_at', { ascending: true }),
    ])

    if (rowsError || issuesError) {
      const readError = rowsError ?? issuesError
      console.error('Failed to read import batch detail', readError)
      return NextResponse.json(
        { error: toSpanishAdminError(readError, 'No se pudo consultar el detalle del lote.') },
        { status: 400 },
      )
    }

    return NextResponse.json({ batch, rows: rows ?? [], issues: issues ?? [] })
  } catch (error) {
    console.error('Unexpected import batch detail error', error)
    return NextResponse.json({ error: 'No se pudo consultar el detalle del lote.' }, { status: 500 })
  }
}
