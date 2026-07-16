import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/admin/authorization'
import { toSpanishAdminError } from '@/lib/admin/postgresErrors'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RouteContext = { params: Promise<{ batchId: string }> }

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function safeFileStem(value: string) {
  return value.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'lote'
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdminAccess({
    permissionKey: 'imports.prepare',
    forbiddenMessage: 'No autorizado para descargar el reporte de este lote.',
  })
  if (!auth.ok) return auth.response

  const { batchId } = await context.params
  if (!uuidPattern.test(batchId)) return NextResponse.json({ error: 'El identificador del lote no es válido.' }, { status: 400 })

  try {
    const [batchResult, rowsResult, issuesResult, changesResult, reversalsResult] = await Promise.all([
      auth.supabase
        .from('import_batches')
        .select('id, import_type, status, review_status, file_name, file_sha256, row_count, applied_rows, application_summary, applied_at')
        .eq('id', batchId)
        .maybeSingle(),
      auth.supabase
        .from('import_batch_rows')
        .select('id, row_number, status, normalized_data, target_operation, target_table, target_record_id, applied_at')
        .eq('batch_id', batchId)
        .order('row_number', { ascending: true }),
      auth.supabase
        .from('import_batch_row_issues')
        .select('row_id, issue_type, code, field_name, message, status, resolution_notes')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true }),
      auth.supabase
        .from('import_batch_changes')
        .select('id, row_id, operation, target_table, target_record_id, audit_log_id, recorded_at')
        .eq('batch_id', batchId)
        .order('recorded_at', { ascending: true }),
      auth.supabase
        .from('import_batch_reversals')
        .select('status, reason, requested_at, processed_at, result, audit_log_id')
        .eq('batch_id', batchId)
        .order('requested_at', { ascending: false })
        .limit(1),
    ])

    const readError = batchResult.error ?? rowsResult.error ?? issuesResult.error ?? changesResult.error ?? reversalsResult.error
    if (readError) return NextResponse.json({ error: toSpanishAdminError(readError, 'No se pudo generar el reporte del lote.') }, { status: 400 })
    const batch = batchResult.data
    if (!batch) return NextResponse.json({ error: 'El lote no existe o está fuera de tu alcance.' }, { status: 404 })

    const issuesByRow = new Map<string, typeof issuesResult.data>()
    const changesByRow = new Map<string, typeof changesResult.data>()
    for (const issue of issuesResult.data ?? []) issuesByRow.set(issue.row_id, [...(issuesByRow.get(issue.row_id) ?? []), issue])
    for (const change of changesResult.data ?? []) changesByRow.set(change.row_id, [...(changesByRow.get(change.row_id) ?? []), change])
    const latestReversal = reversalsResult.data?.[0] ?? null

    const metadata = [
      ['# lote_id', batch.id],
      ['# tipo_importacion', batch.import_type],
      ['# archivo', batch.file_name],
      ['# sha256', batch.file_sha256],
      ['# estado_lote', batch.status],
      ['# revision', batch.review_status],
      ['# filas_totales', batch.row_count],
      ['# filas_aplicadas', batch.applied_rows],
      ['# finalizado_en', batch.applied_at],
      ['# resumen_aplicacion', batch.application_summary],
      ['# estado_reversion', latestReversal?.status],
      ['# motivo_reversion', latestReversal?.reason],
      ['# resultado_reversion', latestReversal?.result],
      ['# auditoria_reversion', latestReversal?.audit_log_id],
    ].map((values) => values.map(csvCell).join(','))

    const headers = [
      'fila', 'estado_validacion', 'operacion_proyectada', 'tabla_objetivo', 'registro_objetivo',
      'resultado_aplicado', 'cambio_id', 'auditoria_id', 'aplicada_en', 'incidencias', 'datos_normalizados',
    ]
    const records = (rowsResult.data ?? []).map((row) => {
      const rowChanges = changesByRow.get(row.id) ?? []
      const latestChange = rowChanges.at(-1)
      const rowIssues = (issuesByRow.get(row.id) ?? []).map((issue) => ({
        type: issue.issue_type,
        code: issue.code,
        field: issue.field_name,
        status: issue.status,
        message: issue.message,
        resolution: issue.resolution_notes,
      }))
      return [
        row.row_number,
        row.status,
        row.target_operation,
        row.target_table,
        row.target_record_id,
        latestChange?.operation ?? '',
        latestChange?.id,
        latestChange?.audit_log_id,
        latestChange?.recorded_at ?? row.applied_at,
        rowIssues,
        row.normalized_data,
      ].map(csvCell).join(',')
    })
    const csv = `\uFEFF${metadata.join('\r\n')}\r\n${headers.map(csvCell).join(',')}\r\n${records.join('\r\n')}\r\n`
    const fileName = `sinep-reporte-${safeFileStem(batch.file_name)}-${batch.id.slice(0, 8)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Unexpected import batch report error', error)
    return NextResponse.json({ error: 'No se pudo generar el reporte del lote.' }, { status: 500 })
  }
}
