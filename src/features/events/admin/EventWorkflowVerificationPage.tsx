'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  loadEventWorkflowHealth,
  type EventWorkflowHealth,
} from '../services/event-workflow-admin-service'

function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  const result = ok ? 'correcto' : 'requiere atención'

  return (
    <article aria-label={`${title}: ${result}`} className={`check-card ${ok ? 'ok' : 'fail'}`}>
      <strong><span aria-hidden="true">{ok ? '✓ ' : '⚠ '}</span>{title}</strong>
      <span className="meta">{detail}</span>
    </article>
  )
}

function statusLabel(status?: string) {
  if (status === 'ready_for_functional_test') return 'Lista para prueba funcional'
  if (status === 'incomplete') return 'Incompleta'
  return status ?? '—'
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function EventWorkflowVerificationPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [health, setHealth] = useState<EventWorkflowHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHealth() {
      try {
        if (!await hasEventAdminSession(supabase)) {
          router.replace('/admin/login')
          return
        }

        setHealth(await loadEventWorkflowHealth(supabase))
      } catch (loadError) {
        setError(errorMessage(loadError, 'No se pudo cargar la verificación del flujo.'))
      } finally {
        setLoading(false)
      }
    }

    void loadHealth()
  }, [router, supabase])

  if (loading) {
    return <main className="container"><div className="empty-state" role="status" aria-live="polite">Cargando verificación del flujo...</div></main>
  }

  if (!health) {
    return <main className="container"><div className="error-box" role="alert">{error ?? 'No se pudo cargar la verificación del flujo.'}</div></main>
  }

  const counts = health.counts
  const readiness = health.readiness
  const manualTests = health.required_manual_test ?? []

  return (
    <main className="container dashboard-page event-workflow-verification-page">
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card verify-hero">
        <div>
          <p className="eyebrow">Verificación interna</p>
          <h1>Motor histórico-documental</h1>
          <p className="lead">Valida si el flujo de eventos está listo para una prueba funcional completa.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/admin/eventos/nuevo">Crear evento de prueba</Link>
            <Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link>
            <Link className="button button-secondary" href="/admin/eventos">Registro de eventos</Link>
          </div>
        </div>
        <div className="verify-summary" aria-live="polite" aria-atomic="true">
          <span className={`mini-badge ${health.status === 'ready_for_functional_test' ? 'success' : 'warning'}`}>{statusLabel(health.status)}</span>
          <strong>{health.workflow}</strong>
          <span className="meta">Siguiente compuerta: {health.next_gate}</span>
        </div>
      </section>

      {error && <div className="error-box" role="alert" aria-live="assertive">{error}</div>}

      <section className="verify-metric-grid" aria-label="Volumen del flujo de eventos">
        <div className="verify-card"><strong>{counts.canonical_events_total}</strong><span className="meta">eventos canónicos</span></div>
        <div className="verify-card"><strong>{counts.event_action_types}</strong><span className="meta">tipos de acción</span></div>
        <div className="verify-card"><strong>{counts.event_actions_total}</strong><span className="meta">acciones generadas</span></div>
        <div className="verify-card"><strong>{counts.canonical_relationships_active}</strong><span className="meta">relaciones activas</span></div>
      </section>

      <section className="verify-metric-grid" aria-label="Estado operativo del flujo">
        <div className="verify-card"><strong>{counts.pending_review_events}</strong><span className="meta">pendientes</span></div>
        <div className="verify-card"><strong>{counts.approved_events}</strong><span className="meta">aprobados</span></div>
        <div className="verify-card"><strong>{counts.ready_actions}</strong><span className="meta">acciones listas</span></div>
        <div className="verify-card"><strong>{counts.failed_actions}</strong><span className="meta">acciones con observación</span></div>
      </section>

      <section className="verify-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Checklist técnico</p><h2>Condiciones de cierre</h2></div></div>
          <div className="check-grid" aria-label="Condiciones técnicas del flujo">
            <CheckCard ok={readiness.backend_schema_ready} title="Esquema backend" detail="Tablas centrales de evento, participante y acciones existen." />
            <CheckCard ok={readiness.event_lifecycle_rpcs_ready} title="Ciclo de evento" detail="Crear, leer y revisar evento está disponible." />
            <CheckCard ok={readiness.action_plan_ready} title="Plan de acciones" detail="Generación y lectura de plan están disponibles." />
            <CheckCard ok={readiness.relationship_review_ready} title="Revisión relacional" detail="Editor relacional y conflictos están disponibles." />
            <CheckCard ok={readiness.application_contract_ready} title="Contrato" detail="Contrato de aplicación está disponible." />
            <CheckCard ok={readiness.workflow_does_not_apply_state} title="Bloqueo de aplicación" detail="El flujo no modifica estado vigente." />
            <CheckCard ok={readiness.has_testable_event} title="Evento para prueba" detail="Debe existir al menos un evento pendiente o aprobado." />
            <CheckCard ok={!readiness.requires_functional_ui_test} title="Prueba funcional" detail="Se completa cuando se recorra un evento desde la interfaz." />
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Prueba manual requerida</p><h2>Recorrido de cierre</h2></div></div>
          <ol className="test-list" aria-label="Pasos de la prueba funcional manual">
            {manualTests.length === 0 && <li className="test-card" role="status"><span className="meta">No hay pasos manuales pendientes.</span></li>}
            {manualTests.map((item) => <li className="test-card" key={item}><span className="meta">{item}</span></li>)}
          </ol>
          <div className="verify-card highlight">
            <strong>Criterio</strong>
            <span className="meta">El flujo se cierra cuando este recorrido funcione y luego pasen typecheck/build.</span>
          </div>
        </aside>
      </section>
    </main>
  )
}
