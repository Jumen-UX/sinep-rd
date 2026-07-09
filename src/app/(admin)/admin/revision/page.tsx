'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type ReviewItem = {
  item_key: string
  item_type: string
  record_table: string
  record_id: string | null
  title: string | null
  detail: string | null
  verification_status: string | null
  issue_count: number | null
  created_at: string | null
}

type ReviewResponse = {
  items?: ReviewItem[]
  error?: string
}

type ReviewDecision = 'approve_internal' | 'publish' | 'needs_correction' | 'dispute' | 'keep_internal'

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(value))
}

function itemTypeLabel(value: string) {
  if (value === 'missing_field') return 'Dato faltante'
  if (value === 'position_assignment') return 'Cargo por verificar'
  if (value === 'person_candidate') return 'Persona por revisar'
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
    disputed: 'En disputa',
    verified: 'Verificado',
  }
  return labels[value] ?? value
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

  async function reviewAssignment(item: ReviewItem, decision: ReviewDecision) {
    if (!item.record_id) return

    const isPublish = decision === 'publish'
    const notes = window.prompt(
      isPublish
        ? 'Nota de publicación. Deja vacío si no aplica.'
        : 'Nota interna de revisión. Deja vacío si no aplica.',
      '',
    )

    if (notes === null) return

    const publishPerson = isPublish
      ? window.confirm('¿También publicar la ficha de la persona asociada?')
      : false

    if (isPublish && !window.confirm('Vas a publicar este nombramiento. ¿Confirmas la acción?')) return

    setActionBusy(item.item_key)
    setActionMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/admin/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: item.record_id,
          decision,
          notes,
          publish_person: publishPerson,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el nombramiento.')
      setActionMessage('Nombramiento actualizado correctamente.')
      await loadReviewQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el nombramiento.')
    } finally {
      setActionBusy(null)
    }
  }

  const statuses = useMemo(() => Array.from(new Set(items.map((item) => item.verification_status).filter(Boolean) as string[])).sort(), [items])
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
          <p className="lead">Centraliza datos marcados como no identificados, incompletos o pendientes de verificación para que no se acumulen silenciosamente.</p>
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
        <a href="#review-filters"><span>⌕</span><strong>{filteredItems.length}</strong><small>Con filtros activos</small></a>
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
              const canActOnAssignment = item.item_type === 'position_assignment' && !!item.record_id

              return (
                <article className="list-card" key={item.item_key}>
                  <div>
                    <p className="eyebrow">{itemTypeLabel(item.item_type)} · {statusLabel(item.verification_status)}</p>
                    <h3>{item.title || item.record_table}</h3>
                    <p className="meta">{item.detail || 'Sin detalle adicional.'}</p>
                    <p className="meta">Tabla: {item.record_table} · Registro: {item.record_id ?? 'sin id directo'} · {formatDate(item.created_at)}</p>
                  </div>
                  <div className="admin-card-actions">
                    <span className="role-pill">{item.issue_count ?? 1} pendiente</span>
                    {canActOnAssignment && (
                      <>
                        <button className="button button-secondary" disabled={busy} onClick={() => reviewAssignment(item, 'approve_internal')} type="button">Aprobar interno</button>
                        <button className="button button-secondary" disabled={busy} onClick={() => reviewAssignment(item, 'needs_correction')} type="button">Corregir</button>
                        <button className="button button-primary" disabled={busy} onClick={() => reviewAssignment(item, 'publish')} type="button">Publicar</button>
                      </>
                    )}
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
