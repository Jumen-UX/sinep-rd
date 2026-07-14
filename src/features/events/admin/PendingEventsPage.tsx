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

const pageStyles = `
  .pending-events-list {
    display: grid;
    gap: 14px;
  }

  .pending-event-card {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 18px;
    display: grid;
    gap: 12px;
    padding: 18px;
  }

  .badge-row,
  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .mini-badge {
    background: #fbf8f1;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--primary);
    display: inline-flex;
    font-size: 12px;
    font-weight: 900;
    padding: 6px 9px;
  }

  .mini-badge.warning {
    background: #fff7ed;
    color: #9a3412;
  }
`

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

  if (loading) return <div className="empty-state">Cargando cola de revisión...</div>

  return (
    <main className="pending-events-page" id="top">
      <style>{pageStyles}</style>
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
          <h1>Eventos pendientes</h1>
          <p className="lead">Eventos creados por el asistente que todavía no se han aplicado. La aprobación valida el evento, pero no altera el estado vigente hasta completar su contrato de aplicación.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Borrador</span>
            <span className="role-pill">Revisión</span>
            <span className="role-pill">Contrato de aplicación</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">◷</div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="admin-stat-strip" aria-label="Resumen de cola de eventos">
        <a href="#pending-events"><span>!</span><strong>{counts.total}</strong><small>Total en cola</small></a>
        <a href="#pending-events"><span>✎</span><strong>{counts.draft}</strong><small>Borradores</small></a>
        <a href="#pending-events"><span>◷</span><strong>{counts.pendingReview}</strong><small>En revisión</small></a>
        <a href="#pending-events"><span>✓</span><strong>{counts.approved}</strong><small>Aprobados</small></a>
        <a href="#pending-events"><span>§</span><strong>{counts.withSource}</strong><small>Con fuente</small></a>
      </section>

      <section className="card dashboard-section" id="pending-events">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>{events.length} eventos pendientes de aplicación</h2>
            <p className="meta">Revisa el evento, prepara su plan de acciones y confirma el contrato antes de aplicarlo al estado vigente.</p>
          </div>
        </div>

        <div className="pending-events-list">
          {events.length === 0 && <div className="empty-state">No hay eventos pendientes de revisión.</div>}
          {events.map((event) => (
            <article className="pending-event-card" key={event.event_id}>
              <div>
                <p className="eyebrow">{formatDate(event.event_date)}</p>
                <h2>{event.title}</h2>
                <p className="meta">{event.event_type_name ?? 'Tipo no definido'} · {event.related_entity_name ?? 'Sin entidad principal'}</p>
              </div>
              <div className="badge-row">
                <span className="mini-badge warning">{event.workflow_status}</span>
                <span className="mini-badge">{modeLabel(event.load_mode)}</span>
                <span className="mini-badge">{evidenceLabel(event.evidence_status)}</span>
                {event.source_name && <span className="mini-badge">Fuente: {event.source_name}</span>}
              </div>
              <div className="button-row">
                <Link className="button button-primary" href={`/admin/eventos/${event.event_id}`}>Revisar</Link>
                <Link className="button button-secondary" href={`/admin/eventos/${event.event_id}/plan`}>Plan de acciones</Link>
                <Link className="button button-secondary" href={`/admin/eventos/${event.event_id}/contrato`}>Contrato de aplicación</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
