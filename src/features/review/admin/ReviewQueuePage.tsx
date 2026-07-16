'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  formatReviewDate,
  getReviewDecisionPrompt,
  getReviewItemHref,
  getReviewItemTypeLabel,
  getReviewStatusLabel,
  isPrimaryReviewAction,
  loadReviewQueue,
  reviewActionLabels,
  submitReviewDecision,
  type ReviewDecision,
  type ReviewItem,
} from '../services/review-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  async function refreshReviewQueue() {
    setLoading(true)
    setError(null)

    try {
      setItems(await loadReviewQueue())
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar la cola de revisión.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshReviewQueue()
  }, [])

  async function reviewItem(item: ReviewItem, decision: ReviewDecision) {
    const notes = window.prompt(getReviewDecisionPrompt(decision), '')
    if (notes === null) return

    const publishPerson = item.item_type === 'position_assignment' && decision === 'publish'
      ? window.confirm('¿También publicar la ficha de la persona asociada?')
      : false

    if (
      ['publish', 'approved', 'rejected', 'reject', 'resolve', 'not_applicable'].includes(decision)
      && !window.confirm(`Vas a ejecutar: ${reviewActionLabels[decision]}. ¿Confirmas la acción?`)
    ) return

    setActionBusy(item.item_key)
    setActionMessage(null)
    setError(null)

    try {
      await submitReviewDecision(item, decision, notes, publishPerson)
      setActionMessage(`${getReviewItemTypeLabel(item.item_type)} actualizado correctamente.`)
      await refreshReviewQueue()
    } catch (reviewError) {
      setError(errorMessage(reviewError, 'No se pudo completar la revisión.'))
    } finally {
      setActionBusy(null)
    }
  }

  const statuses = useMemo(
    () => Array.from(new Set(items.map((item) => item.verification_status).filter(Boolean) as string[])).sort(),
    [items],
  )
  const itemTypes = useMemo(() => Array.from(new Set(items.map((item) => item.item_type))).sort(), [items])
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = !statusFilter || item.verification_status === statusFilter
      const matchesType = !typeFilter || item.item_type === typeFilter
      return matchesStatus && matchesType
    })
  }, [items, statusFilter, typeFilter])

  const counts = useMemo(() => {
    return {
      total: items.length,
      missingFields: items.filter((item) => item.item_type === 'missing_field').length,
      assignments: items.filter((item) => item.item_type === 'position_assignment').length,
      personCandidates: items.filter((item) => item.item_type === 'person_candidate').length,
      importBatches: items.filter((item) => item.item_type === 'import_batch').length,
      changeRequests: items.filter((item) => item.item_type === 'change_request').length,
    }
  }, [items])

  return (
    <main className="admin-review-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">REVISIÓN</span>
          <strong>Pendientes de revisión</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-secondary" href="/admin/eventos/pendientes">Eventos pendientes</Link>
          <Link className="button button-secondary" href="/admin/importar/lotes">Lotes de importación</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Auditoría y trazabilidad</p>
          <h1>Cola de revisión</h1>
          <p className="lead">Centraliza nombramientos, candidatos, solicitudes de cambio, lotes de importación y datos pendientes de verificación. Las acciones disponibles dependen del rol y del alcance territorial del usuario.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Validación editorial</span>
            <span className="role-pill">Publicación controlada</span>
            <span className="role-pill">Corrección documentada</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">!</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {actionMessage && <div className="success-box">{actionMessage}</div>}

      <section className="admin-stat-strip" aria-label="Resumen de revisión">
        <a href="#review-results"><span>!</span><strong>{counts.total}</strong><small>Total pendiente</small></a>
        <a href="#review-results"><span>▤</span><strong>{counts.missingFields}</strong><small>Datos faltantes</small></a>
        <a href="#review-results"><span>▣</span><strong>{counts.assignments}</strong><small>Cargos por verificar</small></a>
        <a href="#review-results"><span>◉</span><strong>{counts.personCandidates}</strong><small>Personas por revisar</small></a>
        <a href="#review-results"><span>⇩</span><strong>{counts.importBatches}</strong><small>Lotes por resolver</small></a>
        <a href="#review-results"><span>↻</span><strong>{counts.changeRequests}</strong><small>Solicitudes de cambio</small></a>
      </section>

      <section className="card dashboard-section" id="review-filters">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2>Cola operativa</h2>
            <p className="meta">Filtra por tipo de pendiente y estado de verificación para trabajar por prioridad.</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos los tipos</option>
            {itemTypes.map((itemType) => <option key={itemType} value={itemType}>{getReviewItemTypeLabel(itemType)}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {statuses.map((status) => <option key={status} value={status}>{getReviewStatusLabel(status)}</option>)}
          </select>
        </div>
      </section>

      <section className="card dashboard-section" id="review-results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>{filteredItems.length} registros encontrados</h2>
          </div>
          <button className="button button-secondary" disabled={loading} onClick={refreshReviewQueue} type="button">Actualizar</button>
        </div>

        {loading ? (
          <div className="empty-state">Cargando pendientes...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">No hay pendientes con los filtros seleccionados.</div>
        ) : (
          <div className="dashboard-list">
            {filteredItems.map((item) => {
              const busy = actionBusy === item.item_key
              const actions = item.allowed_actions ?? []
              const directHref = getReviewItemHref(item)

              return (
                <article className="list-card" key={item.item_key}>
                  <div>
                    <p className="eyebrow">{getReviewItemTypeLabel(item.item_type)} · {getReviewStatusLabel(item.verification_status)}</p>
                    <h3>{item.title || item.record_table}</h3>
                    <p className="meta">{item.detail || 'Sin detalle adicional.'}</p>
                    <p className="meta">
                      Tabla: {item.record_table} · Registro: {item.record_id ?? item.source_id ?? 'sin id directo'} · {formatReviewDate(item.created_at)}
                    </p>
                  </div>
                  <div className="admin-card-actions">
                    <span className="role-pill">{item.issue_count ?? 1} pendiente</span>
                    {directHref && (
                      <Link className="button button-primary" href={directHref}>Abrir y resolver</Link>
                    )}
                    {!directHref && actions.length === 0 ? (
                      <span className="role-pill">Solo lectura</span>
                    ) : !directHref && actions.map((decision) => (
                      <button
                        className={`button ${isPrimaryReviewAction(decision) ? 'button-primary' : 'button-secondary'}`}
                        disabled={busy}
                        key={decision}
                        onClick={() => reviewItem(item, decision)}
                        type="button"
                      >
                        {reviewActionLabels[decision]}
                      </button>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}