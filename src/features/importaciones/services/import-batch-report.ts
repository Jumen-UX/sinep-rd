import type { ImportBatchDetail } from '@/features/importaciones/services/batch-import-admin-service'

function csvCell(value: unknown) {
  const text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value)
  return `"${text.replaceAll('"', '""')}"`
}

function safeFileStem(value: string) {
  return value.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'lote'
}

export function buildImportBatchReport(detail: ImportBatchDetail) {
  const { batch, rows } = detail
  const summary = batch.application_summary ?? {}
  const headers = [
    'lote_id', 'tipo_importacion', 'archivo', 'sha256', 'estado_lote', 'revision', 'fila', 'estado_fila',
    'operacion', 'tabla_objetivo', 'registro_objetivo', 'aplicada_en', 'datos_normalizados',
  ]
  const lines = [headers.map(csvCell).join(',')]

  for (const row of rows) {
    lines.push([
      batch.id,
      batch.import_type,
      batch.file_name,
      batch.file_sha256,
      batch.status,
      batch.review_status,
      row.row_number,
      row.status,
      row.target_operation,
      row.target_table,
      row.target_record_id,
      row.applied_at,
      row.normalized_data,
    ].map(csvCell).join(','))
  }

  const metadata = [
    ['# resumen_aplicacion', summary],
    ['# filas_totales', batch.row_count],
    ['# filas_aplicadas', batch.applied_rows],
    ['# finalizado_en', batch.applied_at],
  ].map(([key, value]) => `${csvCell(key)},${csvCell(value)}`)

  return {
    content: `\uFEFF${metadata.join('\n')}\n${lines.join('\n')}\n`,
    fileName: `sinep-reporte-${safeFileStem(batch.file_name)}-${batch.id.slice(0, 8)}.csv`,
  }
}

export function downloadImportBatchReport(detail: ImportBatchDetail) {
  const report = buildImportBatchReport(detail)
  const blob = new Blob([report.content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = report.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
