'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  loadPendingEvents,
  type PendingEvent,
} from '../services/event-workflow-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function modeLabel(value: string) {
  if (value === 'carga_historica') return 'Carga histórica'
  if (value === 'evento_nuevo') return 'Evento nuevo'
  if (value === 'foto_inicial') return 'Foto inicial'
  return value
}

function evidenceLabel(value?: string | null) {
  if (value === 'confirmado_oficial' || value === 'documentado' || value === 'verified') return 'Documentado'
  if (value === 'fuente_secundaria') return 'Fuente secundaria'
  if (value === 'importado_vigente') return 'Importado vigente'
  if (value === 'pendiente_documento') return 'Documento pendiente'
  if (value === 'contradictorio') return 'Contradictorio'
  return value ?? 'Sin evidencia'
}

function workflowStatusLabel(value: string) {
  if (value === 'draft') return 'Borrador'
  if (value === 'pending_review') return 'Pendiente de revisión'
  if (value === 'approved') return 'Aprobado'
  if (value === 'applied') return 'Aplicado'
  if (value === 'cancelled') return 'Cancelado'
  return value
}

function workflowStatusClass(value: string) {
  if (value === 'approved' || value === 'applied') return 'success'
  if (value === 'cancelled') return 'danger'
  return 'warning'
}

export default function PendingEventsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadEvents() {
      setLoading(true)
      setError(null)

      try {
        if (!await hasEventAdminSession(supabase)) {
          router.replace('/admin/login')
          return
        }

        setEvents(await loadPendingEvents(supabase))
      } catch (loadError) {
        setError(errorMessage(loadError, 'No se pudo cargar la cola de eventos.'))
      } finally {
        setLoading(false)
      }
    }

    void loadEvents()
  }, [router, supabase])

  const counts = useMemo(() => ({
    total: events.length,
    draft: events.filter((event) => event.workflow_status === 'draft').length,
    pendingReview: events.filter((event) => event.workflow_status === 'pending_review').length,
    approved: events.filter((event) => event.workflow_status === 'approved').length,
    withSource: events.filter((event) => Boolean(event.source_name)).length,
  }), [events])

  if (loading) {
    return <div className="empty-state" role="status" aria-live="polite">Cargando cola de revisión...</div>
  }

  return (
    <main className="pending-events-page" id="top" aria-labelledby="pending-events-title">
      <header className="admin-top-header">
        <div className="admin-top-title">
          <span className="admin-mini-mark">EVENTOS</span>
          <strong>Cola de revisión</strong>
        </div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin/eventos">Volver a eventos</Link>
          <Link className="button button-primary" href="/admin/eventos/nuevo">Preparar evento</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Eventos · revisión</p>
          <h1 id="pending-events-title">Eventos pendientes</h1>
          <p className="lead">Eventos creados por el asistente que todavía no se han aplicado. La aprobación valida el evento, pero no altera el estado vigente hasta completar su contrato de aplicación.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Borrador</span>
            <span className="role-pill">Revisión</span>
            <span className="role-pill">Contrato de aplicación</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">◷</div>
      </section>

      {error && <div className="error-box" role="alert" aria-live="assertive">{error}</div>}

      <section className="admin-stat-strip" aria-label="Resumen de cola de eventos">
        <a href="#pending-events"><span aria-hidden="true">!</span><strong>{counts.total}</strong><small>Total en cola</small></a>
        <a href="#pending-events"><span aria-hidden="true">✎</span><strong>{counts.draft}</strong><small>Borradores</small></a>
        <a href="#pending-events"><span aria-hidden="true">◷</span><strong>{counts.pendingReview}</strong><small>En revisión</small></a>
        <a href="#pending-events"><span aria-hidden="true">✓</span><strong>{counts.approved}</strong><small>Aprobados</small></a>
        <a href="#pending-events"><span aria-hidden="true">§</span><strong>{counts.withSource}</strong><small>Con fuente</small></a>
      </section>

      <section className="card dashboard-section" id="pending-events" aria-labelledby="pending-events-results-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2 id="pending-events-results-title" aria-live="polite" aria-atomic="true">{events.length} eventos pendientes de aplicación</h2>
            <p className="meta">Revisa el evento, prepara su plan de acciones y confirma el contrato antes de aplicarlo al estado vigente.</p>
          </div>
        </div>

        <div className="pending-events-list" aria-label="Eventos pendientes de aplicación">
          {events.length === 0 && <div className="empty-state" role="status">No hay eventos pendientes de revisión.</div>}
          {events.map((event) => {
            const eventTitleId = `pending-event-${event.event_id}-title`
            const status = workflowStatusLabel(event.workflow_status)

            return (
              <article aria-labelledby={eventTitleId} className="pending-event-card" key={event.event_id}>
                <div>
                  <p className="eyebrow">{formatDate(event.event_date)}</p>
                  <h3 id={eventTitleId}>{event.title}</h3>
                  <p className="meta">{event.event_type_name ?? 'Tipo no definido'} · {event.related_entity_name ?? 'Sin entidad principal'}</p>
                </div>
                <div className="badge-row" role="list" aria-label={`Estado y clasificación de ${event.title}`}>
                  <span className={`mini-badge ${workflowStatusClass(event.workflow_status)}`} role="listitem">{status}</span>
                  <span className="mini-badge" role="listitem">{modeLabel(event.load_mode)}</span>
                  <span className="mini-badge" role="listitem">{evidenceLabel(event.evidence_status)}</span>
                  {event.source_name && <span className="mini-badge" role="listitem">Fuente: {event.source_name}</span>}
                </div>
                <div className="button-row" role="group" aria-label={`Acciones para ${event.title}`}>
                  <Link aria-label={`Revisar ${event.title}`} className="button button-primary" href={`/admin/eventos/${event.event_id}`}>Revisar</Link>
                  <Link aria-label={`Abrir plan de acciones de ${event.title}`} className="button button-secondary" href={`/admin/eventos/${event.event_id}/plan`}>Plan de acciones</Link>
                  <Link aria-label={`Abrir contrato de aplicación de ${event.title}`} className="button button-secondary" href={`/admin/eventos/${event.event_id}/contrato`}>Contrato de aplicación</Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}