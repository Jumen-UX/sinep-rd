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

const pageStyles = `
  .verify-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.verify-summary,.verify-card,.check-card,.test-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.verify-summary,.verify-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}.metric-grid,.verify-grid,.check-grid,.test-list,.button-row{display:grid;gap:14px}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.verify-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,.4fr)}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.verify-hero,.metric-grid,.verify-grid,.check-grid{grid-template-columns:1fr}}
`

function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return <div className={`check-card ${ok ? 'ok' : 'fail'}`}><strong>{ok ? '✓ ' : '⚠ '}{title}</strong><span className="meta">{detail}</span></div>
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

  if (loading) return <main className="container"><div className="empty-state">Cargando verificación del flujo...</div></main>
  if (!health) return <main className="container"><div className="error-box">{error ?? 'No se pudo cargar la verificación del flujo.'}</div></main>

  const counts = health.counts
  const readiness = health.readiness

  return (
    <main className="container dashboard-page event-workflow-verification-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>
      <section className="dashboard-hero card verify-hero"><div><p className="eyebrow">Verificación interna</p><h1>Motor histórico-documental</h1><p className="lead">Valida si el flujo de eventos está listo para una prueba funcional completa.</p><div className="button-row"><Link className="button button-primary" href="/admin/eventos/nuevo">Crear evento de prueba</Link><Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link><Link className="button button-secondary" href="/admin/eventos">Registro de eventos</Link></div></div><div className="verify-summary"><span className={`mini-badge ${health.status === 'ready_for_functional_test' ? 'success' : 'warning'}`}>{statusLabel(health.status)}</span><strong>{health.workflow}</strong><span className="meta">Siguiente compuerta: {health.next_gate}</span></div></section>
      {error && <div className="error-box">{error}</div>}
      <section className="metric-grid"><div className="verify-card"><strong>{counts.canonical_events_total}</strong><span className="meta">eventos canónicos</span></div><div className="verify-card"><strong>{counts.event_action_types}</strong><span className="meta">tipos de acción</span></div><div className="verify-card"><strong>{counts.event_actions_total}</strong><span className="meta">acciones generadas</span></div><div className="verify-card"><strong>{counts.canonical_relationships_active}</strong><span className="meta">relaciones activas</span></div></section>
      <section className="metric-grid"><div className="verify-card"><strong>{counts.pending_review_events}</strong><span className="meta">pendientes</span></div><div className="verify-card"><strong>{counts.approved_events}</strong><span className="meta">aprobados</span></div><div className="verify-card"><strong>{counts.ready_actions}</strong><span className="meta">acciones listas</span></div><div className="verify-card"><strong>{counts.failed_actions}</strong><span className="meta">acciones con observación</span></div></section>
      <section className="verify-grid"><div className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Checklist técnico</p><h2>Condiciones de cierre</h2></div></div><div className="check-grid"><CheckCard ok={readiness.backend_schema_ready} title="Esquema backend" detail="Tablas centrales de evento, participante y acciones existen." /><CheckCard ok={readiness.event_lifecycle_rpcs_ready} title="Ciclo de evento" detail="Crear, leer y revisar evento está disponible." /><CheckCard ok={readiness.action_plan_ready} title="Plan de acciones" detail="Generación y lectura de plan están disponibles." /><CheckCard ok={readiness.relationship_review_ready} title="Revisión relacional" detail="Editor relacional y conflictos están disponibles." /><CheckCard ok={readiness.application_contract_ready} title="Contrato" detail="Contrato de aplicación está disponible." /><CheckCard ok={readiness.workflow_does_not_apply_state} title="Bloqueo de aplicación" detail="El flujo no modifica estado vigente." /><CheckCard ok={readiness.has_testable_event} title="Evento para prueba" detail="Debe existir al menos un evento pendiente o aprobado." /><CheckCard ok={!readiness.requires_functional_ui_test} title="Prueba funcional" detail="Se completa cuando se recorra un evento desde la interfaz." /></div></div><aside className="card dashboard-section"><div className="section-heading"><div><p className="eyebrow">Prueba manual requerida</p><h2>Recorrido de cierre</h2></div></div><div className="test-list">{(health.required_manual_test ?? []).map((item) => <div className="test-card" key={item}><span className="meta">{item}</span></div>)}</div><div className="verify-card highlight"><strong>Criterio</strong><span className="meta">El flujo se cierra cuando este recorrido funcione y luego pasen typecheck/build.</span></div></aside></section>
    </main>
  )
}
