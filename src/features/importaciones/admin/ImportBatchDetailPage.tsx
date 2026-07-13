'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ImportApplicationPreviewPanel from '@/features/importaciones/admin/ImportApplicationPreviewPanel'
import { ImportRowFieldEditor } from '@/features/importaciones/admin/ImportRowFieldEditor'
import { getImportDomainContract } from '@/features/importaciones/domain/import-domain-contract'
import {
  applyImportBatch,
  getImportBatchDetail,
  revalidateImportBatch,
  reviewImportBatch,
  updateImportBatchRow,
  type ImportBatchDetail,
  type ImportBatchRowDetail,
  type ImportBatchRowIssue,
} from '@/features/importaciones/services/batch-import-admin-service'

type Props = { batchId: string }

const statusLabels: Record<string, string> = {
  prepared: 'Preparado', validating: 'Validando', needs_review: 'Requiere revisión',
  validated: 'Validado', applying: 'Aplicando', applied: 'Aplicado', failed: 'Fallido',
  cancelled: 'Cancelado', pending: 'Pendiente', valid: 'Válida', warning: 'Advertencia',
  error: 'Error', duplicate: 'Duplicada', unresolved: 'No resuelta', ready: 'Lista', skipped: 'Omitida',
}

const reviewLabels: Record<string, string> = {
  pending: 'Pendiente de aprobación', approved: 'Aprobado', rejected: 'Rechazado',
}

const issueLabels: Record<string, string> = {
  validation_error: 'Error de validación', warning: 'Advertencia',
  duplicate: 'Posible duplicado', unresolved_relation: 'Relación no resuelta',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
  if (issues.length === 0) return <p className="meta">La fila no tiene incidencias abiertas.</p>

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
  const [reviewNotes, setReviewNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRevalidating, setIsRevalidating] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextDetail = await getImportBatchDetail(batchId)
      setDetail(nextDetail)
      setReviewNotes(nextDetail.batch.review_notes ?? '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo consultar el lote.')
    } finally {
      setIsLoading(false)
    }
  }, [batchId])

  useEffect(() => { void loadDetail() }, [loadDetail])

  const issuesByRow = useMemo(() => {
    const grouped = new Map<string, ImportBatchRowIssue[]>()
    detail?.issues.forEach((issue) => grouped.set(issue.row_id, [...(grouped.get(issue.row_id) ?? []), issue]))
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
      setMessage(summary.status === 'validated'
        ? 'Fila corregida y lote validado sin bloqueos. Cualquier aprobación anterior fue reiniciada.'
        : 'Fila corregida. El lote fue revalidado y todavía requiere revisión.')
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
      setMessage(summary.status === 'validated'
        ? 'Lote revalidado sin bloqueos. La aprobación editorial quedó nuevamente pendiente.'
        : 'Lote revalidado. Revisa las incidencias pendientes.')
      await loadDetail()
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'No se pudo revalidar el lote.')
    } finally {
      setIsRevalidating(false)
    }
  }

  async function submitReview(decision: 'approved' | 'rejected') {
    if (decision === 'rejected' && !reviewNotes.trim()) {
      setError('Debes indicar el motivo del rechazo.')
      return
    }

    setIsReviewing(true)
    setError(null)
    setMessage(null)
    try {
      const result = await reviewImportBatch(batchId, decision, reviewNotes)
      setMessage(decision === 'approved'
        ? result.can_apply
          ? 'Lote aprobado editorialmente y listo para aplicación canónica.'
          : 'Lote aprobado editorialmente. Este tipo de importación todavía no tiene contrato de aplicación.'
        : 'Lote rechazado y devuelto para corrección.')
      await loadDetail()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'No se pudo registrar la revisión del lote.')
    } finally {
      setIsReviewing(false)
    }
  }

  async function applyBatch() {
    if (!detail) return
    const domain = getImportDomainContract(detail.batch.import_type)
    if (!window.confirm(domain.confirmation)) return

    setIsApplying(true)
    setError(null)
    setMessage(null)
    try {
      const result = await applyImportBatch(batchId)
      if (result.status === 'failed') {
        setError(result.error ?? 'La aplicación fue revertida porque una fila no pudo procesarse.')
      } else {
        setMessage(result.idempotent_replay
          ? 'El lote ya estaba aplicado. No se crearon registros duplicados.'
          : `Lote aplicado correctamente: ${result.applied_rows} ${domain.plural} procesadas en el sistema canónico.`)
      }
      await loadDetail()
    } catch (applicationError) {
      setError(applicationError instanceof Error ? applicationError.message : 'No se pudo aplicar el lote.')
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoading && !detail) {
    return <div className="empty-state"><h1>Cargando lote</h1><p>Consultando filas e incidencias.</p></div>
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
  const domain = getImportDomainContract(batch.import_type)
  const blockingIssues = batch.error_rows + batch.duplicate_rows + batch.unresolved_rows
  const isApplicationLocked = batch.status === 'applying' || batch.status === 'applied'
  const canDecide = detail.can_review && batch.status === 'validated' && blockingIssues === 0
  const applicationLabel = batch.status === 'applied' ? 'Aplicación completada'
    : batch.status === 'failed' ? 'Último intento fallido'
      : detail.can_apply ? 'Listo para aplicar' : 'Aplicación pendiente'

  return (
    <div id="top">
      <header className="admin-top-header">
        <div className="admin-top-title"><span className="admin-mini-mark">IMPORTAR</span><strong>Detalle de lote</strong></div>
        <div className="admin-top-actions">
          <a className="button button-secondary" href="/admin/importar/lotes">Volver al historial</a>
          <a className="button button-secondary" href="/admin/importar">Preparar otro lote</a>
          <button className="button button-primary" disabled={isRevalidating || isReviewing || isApplying || isApplicationLocked} onClick={() => void revalidate()} type="button">
            {isRevalidating ? 'Revalidando…' : 'Revalidar lote'}
          </button>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">{domain.plural}</p>
          <h1>{batch.file_name}</h1>
          <p className="lead">Lote persistido con hash {batch.file_sha256.slice(0, 16)}… La aplicación {domain.applicationDescription}.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">{statusLabels[batch.status] ?? batch.status}</span>
            <span className="role-pill">{reviewLabels[batch.review_status] ?? batch.review_status}</span>
            <span className="role-pill">{formatBytes(batch.file_size_bytes)}</span>
            <span className="role-pill">{batch.row_count} filas</span>
            <span className="role-pill">{detail.application_rpc_available ? 'Contrato canónico disponible' : 'Solo preparación y revisión'}</span>
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
          <span className="role-pill">{detail.can_apply ? 'Puede aplicarse' : statusLabels[batch.status] ?? batch.status}</span>
        </div>
        <div className="admin-stat-strip" aria-label="Resumen del lote">
          <div><span>✓</span><strong>{batch.valid_rows}</strong><small>Válidas</small></div>
          <div><span>!</span><strong>{batch.warning_rows}</strong><small>Advertencias</small></div>
          <div><span>×</span><strong>{batch.error_rows}</strong><small>Errores</small></div>
          <div><span>≡</span><strong>{batch.duplicate_rows}</strong><small>Duplicadas</small></div>
          <div><span>?</span><strong>{batch.unresolved_rows}</strong><small>No resueltas</small></div>
        </div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Revisión editorial</p>
            <h2>{reviewLabels[batch.review_status] ?? batch.review_status}</h2>
            <p className="meta">Revisado {formatDate(batch.reviewed_at)}. Revalidar o corregir una fila reinicia esta decisión.</p>
          </div>
          <span className="role-pill">Permiso: imports.review</span>
        </div>
        {batch.review_notes && <div className="admin-info-box"><span>Nota registrada: {batch.review_notes}</span></div>}
        {detail.can_review ? (
          <div className="auth-form access-form">
            <label>Nota de revisión
              <textarea disabled={isApplicationLocked} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Opcional al aprobar; obligatoria al rechazar." value={reviewNotes} />
            </label>
            <div className="admin-top-actions">
              <button className="button button-primary" disabled={!canDecide || isReviewing || isApplying} onClick={() => void submitReview('approved')} type="button">{isReviewing ? 'Registrando…' : 'Aprobar lote'}</button>
              <button className="button button-secondary" disabled={!canDecide || isReviewing || isApplying} onClick={() => void submitReview('rejected')} type="button">Rechazar lote</button>
            </div>
            {!canDecide && !isApplicationLocked && <p className="meta">La aprobación requiere un lote validado sin errores, duplicados ni relaciones no resueltas.</p>}
          </div>
        ) : <div className="admin-info-box"><span>Tu usuario puede consultar y corregir este lote, pero no registrar la decisión editorial.</span></div>}
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Aplicación canónica</p>
            <h2>{applicationLabel}</h2>
            <p className="meta">La operación es transaccional: {domain.applicationDescription}. Si una fila falla, no se conserva ninguna aplicación parcial.</p>
          </div>
          <span className="role-pill">Permiso: imports.apply</span>
        </div>
        {detail.application_rpc_available ? (
          <>
            <ImportApplicationPreviewPanel rows={rows} serverCanApply={detail.can_apply} />
            <div className="admin-stat-strip" aria-label="Estado de aplicación">
              <div><span>↻</span><strong>{batch.application_attempt_count}</strong><small>Intentos</small></div>
              <div><span>✓</span><strong>{batch.applied_rows}</strong><small>Aplicadas</small></div>
              <div><span>◷</span><strong>{formatDate(batch.application_started_at)}</strong><small>Inicio</small></div>
              <div><span>●</span><strong>{formatDate(batch.applied_at)}</strong><small>Finalización</small></div>
            </div>
            {batch.last_error && <div className="error-box">Último error: {batch.last_error}</div>}
            {batch.status === 'applied' ? (
              <div className="success-box">El lote fue aplicado. Cada fila conserva su registro objetivo y su entrada de auditoría.</div>
            ) : (
              <div className="admin-top-actions">
                <button className="button button-primary" disabled={!detail.can_apply || isApplying} onClick={() => void applyBatch()} type="button">
                  {isApplying ? 'Aplicando lote…' : batch.status === 'failed' ? 'Reintentar aplicación' : domain.applicationAction}
                </button>
                <span className="meta">Solo se habilita con validación vigente, aprobación editorial, objetivos resueltos y alcance autorizado.</span>
              </div>
            )}
          </>
        ) : <div className="admin-info-box"><span>Este dominio todavía permite preparación, corrección y aprobación, pero no aplicación canónica.</span></div>}
      </section>

      <section className="admin-module-group">
        <div className="admin-group-heading">
          <span>1</span>
          <div><p className="eyebrow">Filas persistidas</p><h2>Revisión y corrección</h2><p className="meta">Edita únicamente la fila que presenta incidencias y vuelve a validarla.</p></div>
          <button className="button button-secondary" disabled={isLoading} onClick={() => void loadDetail()} type="button">{isLoading ? 'Actualizando…' : 'Actualizar'}</button>
        </div>
        <div className="admin-module-grid">
          {rows.map((row) => {
            const rowIssues = issuesByRow.get(row.id) ?? []
            const isEditing = editingRowId === row.id
            const entries = Object.entries(row.normalized_data)
            return (
              <article className="admin-module-card" key={row.id}>
                <div className="admin-module-card-head"><span className="admin-module-icon">{row.row_number}</span><span className="admin-status-pill active">{statusLabels[row.status] ?? row.status}</span></div>
                <p className="entity-type">Fila {row.row_number}</p>
                <h3>{rowIssues.length > 0 ? `${rowIssues.length} incidencia(s)` : 'Sin incidencias'}</h3>
                {isEditing ? (
                  <div className="auth-form access-form">
                    {Object.entries(draftValues).map(([key, value]) => (
                      <ImportRowFieldEditor
                        fieldName={key}
                        importType={batch.import_type}
                        key={key}
                        onChange={(nextValue) => setDraftValues((current) => ({ ...current, [key]: nextValue }))}
                        value={value}
                      />
                    ))}
                    <div className="admin-top-actions">
                      <button className="button button-primary" disabled={isSaving} onClick={() => void saveRow(row.id)} type="button">{isSaving ? 'Guardando…' : 'Guardar y revalidar'}</button>
                      <button className="button button-secondary" disabled={isSaving} onClick={cancelEditing} type="button">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-system-list">
                      {entries.map(([key, value]) => <div key={key}><span>{key}</span><strong>{String(value || '—')}</strong></div>)}
                      {row.target_operation && <div><span>Operación prevista</span><strong>{row.target_operation}</strong></div>}
                      {row.target_table && <div><span>Tabla objetivo</span><strong>{row.target_table}</strong></div>}
                      {row.target_record_id && <div><span>Registro canónico</span><strong>{row.target_record_id}</strong></div>}
                    </div>
                    <IssueList issues={rowIssues} />
                    <div className="admin-top-actions"><button className="button button-secondary" disabled={isApplicationLocked || isApplying} onClick={() => startEditing(row)} type="button">Corregir fila</button></div>
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
