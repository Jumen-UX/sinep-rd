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
    const [{ data: batch, error: batchError }, { data: rows, error: rowsError }] = await Promise.all([
      auth.supabase
        .from('import_batches')
        .select('id, import_type, status, review_status, file_name, file_sha256, row_count, applied_rows, application_summary, applied_at')
        .eq('id', batchId)
        .maybeSingle(),
      auth.supabase
        .from('import_batch_rows')
        .select('row_number, status, normalized_data, target_operation, target_table, target_record_id, applied_at')
        .eq('batch_id', batchId)
        .order('row_number', { ascending: true }),
    ])

    const readError = batchError ?? rowsError
    if (readError) return NextResponse.json({ error: toSpanishAdminError(readError, 'No se pudo generar el reporte del lote.') }, { status: 400 })
    if (!batch) return NextResponse.json({ error: 'El lote no existe o está fuera de tu alcance.' }, { status: 404 })
    if (batch.status !== 'applied') return NextResponse.json({ error: 'El reporte final solo está disponible para lotes aplicados.' }, { status: 409 })

    const metadata = [
      ['# lote_id', batch.id],
      ['# tipo_importacion', batch.import_type],
      ['# archivo', batch.file_name],
      ['# sha256', batch.file_sha256],
      ['# revision', batch.review_status],
      ['# filas_totales', batch.row_count],
      ['# filas_aplicadas', batch.applied_rows],
      ['# finalizado_en', batch.applied_at],
      ['# resumen_aplicacion', batch.application_summary],
    ].map((values) => values.map(csvCell).join(','))

    const headers = ['fila', 'estado', 'operacion', 'tabla_objetivo', 'registro_objetivo', 'aplicada_en', 'datos_normalizados']
    const records = (rows ?? []).map((row) => [
      row.row_number,
      row.status,
      row.target_operation,
      row.target_table,
      row.target_record_id,
      row.applied_at,
      row.normalized_data,
    ].map(csvCell).join(','))
    const csv = `\uFEFF${metadata.join('\n')}\n${headers.map(csvCell).join(',')}\n${records.join('\n')}\n`
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
