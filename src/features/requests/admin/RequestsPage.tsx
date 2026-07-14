'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  hasRequestAdminSession,
  loadRequestQueue,
  type PublicSuggestion,
  type RequestRow,
} from '../services/request-admin-service'

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function targetLink(item: PublicSuggestion) {
  if (item.page_url) return item.page_url
  if (item.target_table === 'persons' && item.target_slug) return `/personas/${item.target_slug}`
  if (item.target_table === 'ecclesiastical_entities' && item.target_slug) return `/entidades/${item.target_slug}`
  return null
}

export default function RequestsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [items, setItems] = useState<RequestRow[]>([])
  const [publicSuggestions, setPublicSuggestions] = useState<PublicSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRequests() {
      try {
        if (!await hasRequestAdminSession(supabase)) {
          router.replace('/admin/login')
          return
        }

        const queue = await loadRequestQueue(supabase)
        setItems(queue.requests)
        setPublicSuggestions(queue.publicSuggestions)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las solicitudes')
      } finally {
        setLoading(false)
      }
    }

    void loadRequests()
  }, [router, supabase])

  return (
    <main className="container admin-dashboard">
      <div className="page-heading">
        <Link className="meta" href="/admin">← Volver al panel</Link>
        <p className="eyebrow">Aprobaciones</p>
        <h1>Solicitudes de cambio</h1>
        <p className="lead">Bandeja de solicitudes administrativas y sugerencias públicas pendientes de revisión.</p>
      </div>

      {loading && <div className="empty-state">Cargando solicitudes...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && items.length === 0 && publicSuggestions.length === 0 && (
        <div className="empty-state">No hay solicitudes pendientes por ahora.</div>
      )}

      {!loading && !error && publicSuggestions.length > 0 && (
        <section className="request-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sugerencias públicas</p>
              <h2>Enviadas desde fichas públicas</h2>
            </div>
            <span className="meta">{publicSuggestions.length} pendientes</span>
          </div>
          {publicSuggestions.map((item) => {
            const href = targetLink(item)
            return (
              <article className="entity-card request-card" key={item.id}>
                <div className="request-card-header">
                  <div>
                    <p className="entity-type">{item.suggestion_type}</p>
                    <h2>{item.title}</h2>
                  </div>
                  <span className="role-pill">{item.status}</span>
                </div>
                <p className="meta">{item.description}</p>
                <div className="request-meta-grid">
                  <p className="meta"><strong>Ficha:</strong> {href ? <Link href={href}>{item.target_title ?? item.target_slug ?? item.target_table}</Link> : item.target_title ?? item.target_table}</p>
                  <p className="meta"><strong>Campo:</strong> {String(item.proposed_data?.field_name ?? 'No indicado')}</p>
                  <p className="meta"><strong>Valor propuesto:</strong> {String(item.proposed_data?.proposed_value ?? 'No indicado')}</p>
                  <p className="meta"><strong>Fuente:</strong> {item.source_url ? <a href={item.source_url}>{item.source_name ?? item.source_url}</a> : item.source_name ?? 'No indicada'}</p>
                  <p className="meta"><strong>Enviada por:</strong> {item.submitter_name ?? item.submitter_email ?? 'No indicado'} {item.submitter_country ? `· ${item.submitter_country}` : ''}</p>
                  <p className="meta"><strong>Fecha:</strong> {formatDate(item.created_at)}</p>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {!loading && !error && items.length > 0 && (
        <section className="request-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Solicitudes administrativas</p>
              <h2>Cambios propuestos por usuarios internos</h2>
            </div>
            <span className="meta">{items.length} pendientes</span>
          </div>
          {items.map((item) => (
            <article className="entity-card request-card" key={item.id}>
              <div className="request-card-header">
                <div>
                  <p className="entity-type">{item.action_type ?? 'Solicitud'}</p>
                  <h2>{item.title}</h2>
                </div>
                <span className="role-pill">{item.status}</span>
              </div>

              {item.description && <p className="meta">{item.description}</p>}

              <div className="request-meta-grid">
                <p className="meta"><strong>Tabla:</strong> {item.target_table ?? 'No definida'}</p>
                <p className="meta"><strong>Prioridad:</strong> {item.priority ?? 'Normal'}</p>
                <p className="meta"><strong>Ámbito:</strong> {item.scope_entity_name ?? item.diocese_name ?? item.scope_type ?? 'Nacional'}</p>
                <p className="meta"><strong>Pastoral:</strong> {item.pastoral_area_name ?? 'No aplica'}</p>
                <p className="meta"><strong>Enviada por:</strong> {item.submitted_by_name ?? item.submitted_by_email ?? 'No indicado'}</p>
                <p className="meta"><strong>Fecha:</strong> {formatDate(item.submitted_at ?? item.created_at)}</p>
              </div>

              <div className="admin-actions">
                <Link className="button button-primary" href={`/admin/solicitudes/${item.id}`}>Revisar solicitud</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
