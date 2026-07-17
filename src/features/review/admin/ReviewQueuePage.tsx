'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { PageState } from '@/components/ui/page-state'
import { StatusBadge } from '@/components/ui/status-badge'
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

function reviewStatusTone(status: string | null) {
  if (status === 'approved' || status === 'published' || status === 'verified') return 'success' as const
  if (status === 'rejected' || status === 'blocked') return 'danger' as const
  if (status === 'needs_changes' || status === 'pending') return 'warning' as const
  return 'info' as const
}

function reviewDecisionVariant(decision: ReviewDecision) {
  if (decision === 'reject' || decision === 'rejected') return 'destructive' as const
  return isPrimaryReviewAction(decision) ? 'default' as const : 'secondary' as const
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
    <main className="container admin-review-page" id="top">
      <PageHeader
        breadcrumbs={[{ label: 'Administración', href: '/admin' }, { label: 'Revisión' }]}
        eyebrow="Auditoría y trazabilidad"
        title="Cola de revisión"
        description="Centraliza nombramientos, candidatos, solicitudes de cambio, lotes de importación y datos pendientes de verificación según tu rol y alcance territorial."
        metadata={(
          <>
            <StatusBadge tone={counts.total > 0 ? 'warning' : 'success'} dot>
              {counts.total} pendiente{counts.total === 1 ? '' : 's'}
            </StatusBadge>
            <StatusBadge tone="info">Validación editorial</StatusBadge>
            <StatusBadge tone="institutional">Publicación controlada</StatusBadge>
          </>
        )}
        actions={(
          <>
            <Button asChild variant="secondary"><Link href="/admin">Volver al panel</Link></Button>
            <Button asChild variant="secondary"><Link href="/admin/eventos/pendientes">Eventos pendientes</Link></Button>
            <Button asChild variant="secondary"><Link href="/admin/importar/lotes">Lotes de importación</Link></Button>
          </>
        )}
      />

      {error ? (
        <Alert tone="danger" title="No pudimos completar la operación">{error}</Alert>
      ) : null}
      {actionMessage ? (
        <Alert tone="success" title="Revisión actualizada">{actionMessage}</Alert>
      ) : null}

      <section className="admin-stat-strip" aria-label="Resumen de revisión">
        <a href="#review-results"><span aria-hidden="true">!</span><strong>{counts.total}</strong><small>Total pendiente</small></a>
        <a href="#review-results"><span aria-hidden="true">▤</span><strong>{counts.missingFields}</strong><small>Datos faltantes</small></a>
        <a href="#review-results"><span aria-hidden="true">▣</span><strong>{counts.assignments}</strong><small>Cargos por verificar</small></a>
        <a href="#review-results"><span aria-hidden="true">◉</span><strong>{counts.personCandidates}</strong><small>Personas por revisar</small></a>
        <a href="#review-results"><span aria-hidden="true">⇩</span><strong>{counts.importBatches}</strong><small>Lotes por resolver</small></a>
        <a href="#review-results"><span aria-hidden="true">↻</span><strong>{counts.changeRequests}</strong><small>Solicitudes de cambio</small></a>
      </section>

      <section className="card dashboard-section" id="review-filters" aria-labelledby="review-filters-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2 id="review-filters-heading">Cola operativa</h2>
            <p className="meta">Filtra por tipo de pendiente y estado de verificación para trabajar por prioridad.</p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label htmlFor="review-type-filter">
            Tipo de pendiente
            <select id="review-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">Todos los tipos</option>
              {itemTypes.map((itemType) => <option key={itemType} value={itemType}>{getReviewItemTypeLabel(itemType)}</option>)}
            </select>
          </label>
          <label htmlFor="review-status-filter">
            Estado de verificación
            <select id="review-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos los estados</option>
              {statuses.map((status) => <option key={status} value={status}>{getReviewStatusLabel(status)}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card dashboard-section" id="review-results" aria-labelledby="review-results-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2 id="review-results-heading">Registros para revisar</h2>
            <p className="meta">{filteredItems.length} registro{filteredItems.length === 1 ? '' : 's'} visible{filteredItems.length === 1 ? '' : 's'} con los filtros actuales.</p>
          </div>
          <Button disabled={loading} onClick={refreshReviewQueue} variant="secondary">
            {loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        </div>

        {loading ? (
          <PageState compact kind="loading" title="Cargando pendientes" description="Estamos preparando la cola de revisión para tu alcance." />
        ) : filteredItems.length === 0 ? (
          <PageState
            kind="empty"
            title={items.length === 0 ? 'No hay pendientes de revisión' : 'No hay resultados con estos filtros'}
            description={items.length === 0
              ? 'Los nuevos registros que requieran validación aparecerán aquí.'
              : 'Cambia el tipo o el estado para ampliar la búsqueda.'}
          />
        ) : (
          <div className="dashboard-list">
            {filteredItems.map((item) => {
              const busy = actionBusy === item.item_key
              const actions = item.allowed_actions ?? []
              const directHref = getReviewItemHref(item)

              return (
                <article className="list-card" key={item.item_key}>
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge tone="institutional">{getReviewItemTypeLabel(item.item_type)}</StatusBadge>
                      <StatusBadge tone={reviewStatusTone(item.verification_status)}>{getReviewStatusLabel(item.verification_status)}</StatusBadge>
                    </div>
                    <h3>{item.title || item.record_table}</h3>
                    <p className="meta">{item.detail || 'Sin detalle adicional.'}</p>
                    <p className="meta">
                      Tabla: {item.record_table} · Registro: {item.record_id ?? item.source_id ?? 'sin id directo'} · {formatReviewDate(item.created_at)}
                    </p>
                  </div>
                  <div className="admin-card-actions">
                    <StatusBadge tone="warning">{item.issue_count ?? 1} pendiente{(item.issue_count ?? 1) === 1 ? '' : 's'}</StatusBadge>
                    {directHref ? (
                      <Button asChild><Link href={directHref}>Abrir y resolver</Link></Button>
                    ) : null}
                    {!directHref && actions.length === 0 ? (
                      <StatusBadge tone="neutral">Solo lectura</StatusBadge>
                    ) : null}
                    {!directHref ? actions.map((decision) => (
                      <Button
                        disabled={busy}
                        key={decision}
                        onClick={() => reviewItem(item, decision)}
                        variant={reviewDecisionVariant(decision)}
                      >
                        {busy ? 'Procesando…' : reviewActionLabels[decision]}
                      </Button>
                    )) : null}
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
