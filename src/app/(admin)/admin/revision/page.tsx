'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type ReviewDecision =
  | 'approve_internal'
  | 'publish'
  | 'needs_correction'
  | 'dispute'
  | 'keep_internal'
  | 'reject'
  | 'resolve'
  | 'not_applicable'
  | 'approved'
  | 'needs_changes'
  | 'rejected'

type ReviewItem = {
  item_key: string
  item_type: string
  record_table: string
  record_id: string | null
  source_id: string | null
  title: string | null
  detail: string | null
  verification_status: string | null
  issue_count: number | null
  created_at: string | null
  allowed_actions: ReviewDecision[] | null
}

type ReviewResponse = {
  items?: ReviewItem[]
  error?: string
}

const actionLabels: Record<ReviewDecision, string> = {
  approve_internal: 'Aprobar interno',
  publish: 'Publicar',
  needs_correction: 'Solicitar corrección',
  dispute: 'Marcar disputa',
  keep_internal: 'Mantener interno',
  reject: 'Ignorar candidato',
  resolve: 'Marcar resuelto',
  not_applicable: 'No aplica',
  approved: 'Aprobar solicitud',
  needs_changes: 'Pedir cambios',
  rejected: 'Rechazar solicitud',
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(value))
}

function itemTypeLabel(value: string) {
  if (value === 'missing_field') return 'Dato faltante'
  if (value === 'position_assignment') return 'Cargo por verificar'
  if (value === 'person_candidate') return 'Persona por revisar'
  if (value === 'change_request') return 'Solicitud de cambio'
  return value
}

function statusLabel(value: string | null) {
  if (!value) return 'Pendiente'
  const labels: Record<string, string> = {
    unknown: 'No identificado',
    pending: 'Pendiente',
    pending_review: 'Pendiente de revisión',
    not_identified: 'No identificado',
    incomplete: 'Incompleto',
    not_verified: 'No verificado',
    needs_review: 'Requiere revisión',
    needs_correction: 'Requiere corrección',
    needs_changes: 'Requiere cambios',
    disputed: 'En disputa',
    verified: 'Verificado',
    matched: 'Coincidencia aprobada',
    ignored: 'Ignorado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    published: 'Publicado',
    internal: 'Uso interno',
    not_applicable: 'No aplica',
  }
  return labels[value] ?? value
}

function isPrimaryAction(decision: ReviewDecision) {
  return ['approve_internal', 'publish', 'resolve', 'approved'].includes(decision)
}

function decisionPrompt(decision: ReviewDecision) {
  if (decision === 'publish') return 'Nota de publicación. Deja vacío si no aplica.'
  if (decision === 'needs_correction' || decision === 'needs_changes') return 'Describe la corrección requerida.'
  if (decision === 'rejected' || decision === 'reject') return 'Indica el motivo de rechazo o descarte.'
  return 'Nota interna de revisión. Deja vacío si no aplica.'
}

export default function AdminRevisionPage() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  async function loadReviewQueue() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/revision')
      const data = await response.json() as ReviewResponse
      if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar la cola de revisión.')
      setItems(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la cola de revisión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviewQueue()
  }, [])

  async function reviewItem(item: ReviewItem, decision: ReviewDecision) {
    const notes = window.prompt(decisionPrompt(decision), '')
    if (notes === null) return

    const publishPerson = item.item_type === 'position_assignment' && decision === 'publish'
      ? window.confirm('¿También publicar la ficha de la persona asociada?')
      : false

    if (
      ['publish', 'approved', 'rejected', 'reject', 'resolve', 'not_applicable'].includes(decision)
      && !window.confirm(`Vas a ejecutar: ${actionLabels[decision]}. ¿Confirmas la acción?`)
    ) return

    setActionBusy(item.item_key)
    setActionMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: item.item_type,
          record_id: item.record_id,
          source_id: item.source_id,
          decision,
          notes,
          publish_person: publishPerson,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la revisión.')
      setActionMessage(`${itemTypeLabel(item.item_type)} actualizado correctamente.`)
      await loadReviewQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la revisión.')
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
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Auditoría y trazabilidad</p>
          <h1>Cola de revisión</h1>
          <p className="lead">Centraliza nombramientos, candidatos, solicitudes de cambio y datos pendientes de verificación. Las acciones disponibles dependen del rol y del alcance territorial del usuario.</p>
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
            {itemTypes.map((itemType) => <option key={itemType} value={itemType}>{itemTypeLabel(itemType)}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </div>
      </section>

      <section className="card dashboard-section" id="review-results">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>{filteredItems.length} registros encontrados</h2>
          </div>
          <button className="button button-secondary" disabled={loading} onClick={loadReviewQueue} type="button">Actualizar</button>
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

              return (
                <article className="list-card" key={item.item_key}>
                  <div>
                    <p className="eyebrow">{itemTypeLabel(item.item_type)} · {statusLabel(item.verification_status)}</p>
                    <h3>{item.title || item.record_table}</h3>
                    <p className="meta">{item.detail || 'Sin detalle adicional.'}</p>
                    <p className="meta">
                      Tabla: {item.record_table} · Registro: {item.record_id ?? item.source_id ?? 'sin id directo'} · {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="admin-card-actions">
                    <span className="role-pill">{item.issue_count ?? 1} pendiente</span>
                    {actions.length === 0 ? (
                      <span className="role-pill">Solo lectura</span>
                    ) : actions.map((decision) => (
                      <button
                        className={`button ${isPrimaryAction(decision) ? 'button-primary' : 'button-secondary'}`}
                        disabled={busy}
                        key={decision}
                        onClick={() => reviewItem(item, decision)}
                        type="button"
                      >
                        {actionLabels[decision]}
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
