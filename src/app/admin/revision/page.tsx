'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type ReviewItem = {
  item_key: string
  item_type: string
  record_table: string
  record_id: string
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

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(value))
}

function itemTypeLabel(value: string) {
  if (value === 'missing_field') return 'Dato faltante'
  if (value === 'position_assignment') return 'Cargo por verificar'
  return value
}

function statusLabel(value: string | null) {
  if (!value) return 'Pendiente'
  const labels: Record<string, string> = {
    unknown: 'No identificado',
    pending_review: 'Pendiente de revisión',
    not_identified: 'No identificado',
    incomplete: 'Incompleto',
    not_verified: 'No verificado',
    needs_review: 'Requiere revisión',
  }
  return labels[value] ?? value
}

export default function AdminRevisionPage() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
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

    loadReviewQueue()
  }, [])

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
    }
  }, [items])

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink"><Link href="/admin">← Volver al panel administrativo</Link></div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Auditoría y trazabilidad</p>
          <h1>Pendientes de revisión</h1>
          <p className="lead">Centraliza datos marcados como no identificados, incompletos o pendientes de verificación para que no se acumulen silenciosamente.</p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <div className="dashboard-grid dashboard-summary">
        <article className="metric-card"><span>Total pendiente</span><strong>{counts.total}</strong></article>
        <article className="metric-card"><span>Datos faltantes</span><strong>{counts.missingFields}</strong></article>
        <article className="metric-card"><span>Cargos por verificar</span><strong>{counts.assignments}</strong></article>
      </div>

      <section className="card dashboard-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Filtros</p>
            <h2>Cola operativa</h2>
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

      <section className="card dashboard-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>{filteredItems.length} registros encontrados</h2>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Cargando pendientes...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">No hay pendientes con los filtros seleccionados.</div>
        ) : (
          <div className="dashboard-list">
            {filteredItems.map((item) => (
              <article className="list-card" key={item.item_key}>
                <div>
                  <p className="eyebrow">{itemTypeLabel(item.item_type)} · {statusLabel(item.verification_status)}</p>
                  <h3>{item.title || item.record_table}</h3>
                  <p className="meta">{item.detail || 'Sin detalle adicional.'}</p>
                  <p className="meta">Tabla: {item.record_table} · Registro: {item.record_id} · {formatDate(item.created_at)}</p>
                </div>
                <span className="role-pill">{item.issue_count ?? 1} pendiente</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
