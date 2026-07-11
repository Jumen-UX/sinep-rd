'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getImportBatchDetail,
  revalidateImportBatch,
  updateImportBatchRow,
  type ImportBatchDetail,
  type ImportBatchRowDetail,
  type ImportBatchRowIssue,
} from '@/features/importaciones/services/batch-import-admin-service'

type Props = {
  batchId: string
}

const statusLabels: Record<string, string> = {
  prepared: 'Preparado',
  validating: 'Validando',
  needs_review: 'Requiere revisión',
  validated: 'Validado',
  applying: 'Aplicando',
  applied: 'Aplicado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
  valid: 'Válida',
  warning: 'Advertencia',
  error: 'Error',
  duplicate: 'Duplicada',
  unresolved: 'No resuelta',
  ready: 'Lista',
  skipped: 'Omitida',
}

const issueLabels: Record<string, string> = {
  validation_error: 'Error de validación',
  warning: 'Advertencia',
  duplicate: 'Posible duplicado',
  unresolved_relation: 'Relación no resuelta',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function toEditableValues(row: ImportBatchRowDetail): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row.normalized_data).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')]),
  )
}

function IssueList({ issues }: { issues: ImportBatchRowIssue[] }) {
  if (issues.length === 0) {
    return <p className="meta">La fila no tiene incidencias abiertas.</p>
  }

  return (
    <div className="admin-system-list">
      {issues.map((issue) => (
        <div key={issue.id}>
          <span>{issueLabels[issue.issue_type] ?? issue.issue_type}</span>
          <strong>{issue.field_name ? `${issue.field_name}: ` : ''}{issue.message}</strong>
        </div>
      ))}
    </div>
  )
}

export default function ImportBatchDetailPage({ batchId }: Props) {
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRevalidating, setIsRevalidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setDetail(await getImportBatchDetail(batchId))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo consultar el lote.')
    } finally {
      setIsLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const issuesByRow = useMemo(() => {
    const grouped = new Map<string, ImportBatchRowIssue[]>()
    detail?.issues.forEach((issue) => {
      grouped.set(issue.row_id, [...(grouped.get(issue.row_id) ?? []), issue])
    })
    return grouped
  }, [detail])

  function startEditing(row: ImportBatchRowDetail) {
    setEditingRowId(row.id)
    setDraftValues(toEditableValues(row))
    setMessage(null)
    setError(null)
  }

  function cancelEditing() {
    setEditingRowId(null)
    setDraftValues({})
  }

  async function saveRow(rowId: string) {
    setIsSaving(true)
    setError(null)
    setMessage(null)

    try {
      const summary = await updateImportBatchRow(rowId, draftValues)
      setMessage(
        summary.status === 'validated'
          ? 'Fila corregida y lote validado sin bloqueos.'
          : 'Fila corregida. El lote fue revalidado y todavía requiere revisión.',
      )
      cancelEditing()
      await loadDetail()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo corregir la fila.')
    } finally {
      setIsSaving(false)
    }
  }

  async function revalidate() {
    setIsRevalidating(true)
    setError(null)
    setMessage(null)

    try {
      const summary = await revalidateImportBatch(batchId)
      setMessage(
        summary.status === 'validated'
          ? 'Lote revalidado sin bloqueos.'
          : 'Lote revalidado. Revisa las incidencias pendientes.',
      )
      await loadDetail()
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'No se pudo revalidar el lote.')
    } finally {
      setIsRevalidating(false)
    }
  }

  if (isLoading && !detail) {
    return (
      <div className="empty-state">
        <h1>Cargando lote</h1>
        <p>Consultando filas e incidencias.</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div id="top">
        <header className="admin-top-header">
          <div className="admin-top-title"><span className="admin-mini-mark">IMPORTAR</span><strong>Detalle de lote</strong></div>
          <a className="button button-secondary" href="/admin/importar/lotes">Volver al historial</a>
        </header>
        {error && <div className="error-box">{error}</div>}
      </div>
    )
  }

  const { batch, rows } = detail
  const blockingIssues = batch.error_rows + batch.duplicate_rows + batch.unresolved_rows

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">IMPORTAR</span>
          <strong>Detalle de lote</strong>
        </div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin/importar/lotes">Volver al historial</a>
          <a className="button button-secondary" href="/admin/importar">Preparar otro lote</a>
          <button className="button button-primary" disabled={isRevalidating} onClick={() => void revalidate()} type="button">
            {isRevalidating ? 'Revalidando…' : 'Revalidar lote'}
          </button>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">{batch.import_type}</p>
          <h1>{batch.file_name}</h1>
          <p className="lead">Lote persistido con hash {batch.file_sha256.slice(0, 16)}… Ninguna corrección de esta pantalla modifica registros canónicos.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">{statusLabels[batch.status] ?? batch.status}</span>
            <span className="role-pill">{formatBytes(batch.file_size_bytes)}</span>
            <span className="role-pill">{batch.row_count} filas</span>
            <span className="role-pill">Aplicación deshabilitada</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">≡</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resumen de validación</p>
            <h2>{blockingIssues > 0 ? 'El lote requiere correcciones' : 'El lote no tiene bloqueos'}</h2>
            <p className="meta">Creado {formatDate(batch.created_at)} · Validado {formatDate(batch.validated_at)}</p>
          </div>
          <span className="role-pill">can_apply: false</span>
        </div>
        <div className="admin-stat-strip" aria-label="Resumen del lote">
          <div><span>✓</span><strong>{batch.valid_rows}</strong><small>Válidas</small></div>
          <div><span>!</span><strong>{batch.warning_rows}</strong><small>Advertencias</small></div>
          <div><span>×</span><strong>{batch.error_rows}</strong><small>Errores</small></div>
          <div><span>≡</span><strong>{batch.duplicate_rows}</strong><small>Duplicadas</small></div>
          <div><span>?</span><strong>{batch.unresolved_rows}</strong><small>No resueltas</small></div>
        </div>
      </section>

      <section className="admin-module-group">
        <div className="admin-group-heading">
          <span>1</span>
          <div>
            <p className="eyebrow">Filas persistidas</p>
            <h2>Revisión y corrección</h2>
            <p className="meta">Edita únicamente la fila que presenta incidencias y vuelve a validarla.</p>
          </div>
          <button className="button button-secondary" disabled={isLoading} onClick={() => void loadDetail()} type="button">
            {isLoading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        <div className="admin-module-grid">
          {rows.map((row) => {
            const rowIssues = issuesByRow.get(row.id) ?? []
            const isEditing = editingRowId === row.id
            const entries = Object.entries(row.normalized_data)

            return (
              <article className="admin-module-card" key={row.id}>
                <div className="admin-module-card-head">
                  <span className="admin-module-icon">{row.row_number}</span>
                  <span className="admin-status-pill active">{statusLabels[row.status] ?? row.status}</span>
                </div>
                <p className="entity-type">Fila {row.row_number}</p>
                <h3>{rowIssues.length > 0 ? `${rowIssues.length} incidencia(s)` : 'Sin incidencias'}</h3>

                {isEditing ? (
                  <div className="auth-form access-form">
                    {Object.entries(draftValues).map(([key, value]) => (
                      <label key={key}>
                        {key}
                        <input
                          onChange={(event) => setDraftValues((current) => ({ ...current, [key]: event.target.value }))}
                          type="text"
                          value={value}
                        />
                      </label>
                    ))}
                    <div className="admin-top-actions">
                      <button className="button button-primary" disabled={isSaving} onClick={() => void saveRow(row.id)} type="button">
                        {isSaving ? 'Guardando…' : 'Guardar y revalidar'}
                      </button>
                      <button className="button button-secondary" disabled={isSaving} onClick={cancelEditing} type="button">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-system-list">
                      {entries.map(([key, value]) => (
                        <div key={key}><span>{key}</span><strong>{String(value || '—')}</strong></div>
                      ))}
                    </div>
                    <IssueList issues={rowIssues} />
                    <div className="admin-top-actions">
                      <button className="button button-secondary" onClick={() => startEditing(row)} type="button">Corregir fila</button>
                    </div>
                  </>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
