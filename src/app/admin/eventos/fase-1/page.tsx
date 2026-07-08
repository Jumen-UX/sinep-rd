'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type HealthCounts = {
  canonical_events_total: number
  draft_events: number
  pending_review_events: number
  approved_events: number
  applied_events: number
  cancelled_events: number
  event_action_types: number
  event_actions_total: number
  relationship_actions_total: number
  ready_actions: number
  planned_actions: number
  failed_actions: number
  canonical_relationship_types: number
  canonical_relationships_active: number
}

type HealthReadiness = {
  backend_schema_ready: boolean
  event_lifecycle_rpcs_ready: boolean
  action_plan_ready: boolean
  relationship_review_ready: boolean
  application_contract_ready: boolean
  phase_1_does_not_apply_state: boolean
  requires_functional_ui_test: boolean
  has_testable_event: boolean
}

type HealthResponse = {
  phase: string
  status: string
  counts: HealthCounts
  readiness: HealthReadiness
  required_manual_test: string[]
  next_gate: string
}

const pageStyles = `
  .phase-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .phase-summary,.phase-card,.check-card,.test-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.phase-summary,.phase-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}
  .metric-grid,.phase-grid,.check-grid,.test-list,.button-row{display:grid;gap:14px}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.phase-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,.4fr)}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.phase-hero,.metric-grid,.phase-grid,.check-grid{grid-template-columns:1fr}}
`

function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return <div className={`check-card ${ok ? 'ok' : 'fail'}`}><strong>{ok ? '✓ ' : '⚠ '}{title}</strong><span className="meta">{detail}</span></div>
}

function statusLabel(status?: string) {
  if (status === 'ready_for_functional_test') return 'Lista para prueba funcional'
  if (status === 'incomplete') return 'Incompleta'
  return status ?? '—'
}

export default function Phase1HealthPage() {
  const router = useRouter()
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHealth() {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/admin/login')
        return
      }

      const { data, error: healthError } = await supabase.rpc('get_phase1_event_workflow_health')
      if (healthError) {
        setError(healthError.message)
        setLoading(false)
        return
      }

      setHealth(data as HealthResponse | null)
      setLoading(false)
    }

    loadHealth()
  }, [router, supabase])

  if (loading) return <main className="container"><div className="empty-state">Cargando verificación de Fase 1...</div></main>
  if (!health) return <main className="container"><div className="error-box">No se pudo cargar el estado de Fase 1.</div></main>

  const counts = health.counts
  const readiness = health.readiness

  return (
    <main className="container dashboard-page phase1-health-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card phase-hero">
        <div>
          <p className="eyebrow">Fase 1 · verificación</p>
          <h1>Motor histórico-documental</h1>
          <p className="lead">Esta vista valida si el flujo de eventos está listo para la prueba funcional completa antes de cerrar Fase 1.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/admin/eventos/nuevo">Crear evento de prueba</Link>
            <Link className="button button-secondary" href="/admin/eventos/pendientes">Cola de revisión</Link>
            <Link className="button button-secondary" href="/admin/eventos">Registro de eventos</Link>
          </div>
        </div>
        <div className="phase-summary">
          <span className={`mini-badge ${health.status === 'ready_for_functional_test' ? 'success' : 'warning'}`}>{statusLabel(health.status)}</span>
          <strong>{health.phase}</strong>
          <span className="meta">Siguiente compuerta: {health.next_gate}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="phase-card"><strong>{counts.canonical_events_total}</strong><span className="meta">eventos canónicos</span></div>
        <div className="phase-card"><strong>{counts.event_action_types}</strong><span className="meta">tipos de acción</span></div>
        <div className="phase-card"><strong>{counts.event_actions_total}</strong><span className="meta">acciones generadas</span></div>
        <div className="phase-card"><strong>{counts.canonical_relationships_active}</strong><span className="meta">relaciones activas</span></div>
      </section>

      <section className="metric-grid">
        <div className="phase-card"><strong>{counts.pending_review_events}</strong><span className="meta">pendientes</span></div>
        <div className="phase-card"><strong>{counts.approved_events}</strong><span className="meta">aprobados</span></div>
        <div className="phase-card"><strong>{counts.ready_actions}</strong><span className="meta">acciones listas</span></div>
        <div className="phase-card"><strong>{counts.failed_actions}</strong><span className="meta">acciones con observación</span></div>
      </section>

      <section className="phase-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Checklist técnico</p><h2>Condiciones de cierre</h2></div></div>
          <div className="check-grid">
            <CheckCard ok={readiness.backend_schema_ready} title="Esquema backend" detail="Tablas centrales de evento, participante y acciones existen." />
            <CheckCard ok={readiness.event_lifecycle_rpcs_ready} title="Ciclo de evento" detail="Crear, leer y revisar evento está disponible." />
            <CheckCard ok={readiness.action_plan_ready} title="Plan de acciones" detail="Generación y lectura de plan están disponibles." />
            <CheckCard ok={readiness.relationship_review_ready} title="Revisión relacional" detail="Editor relacional y conflictos están disponibles." />
            <CheckCard ok={readiness.application_contract_ready} title="Contrato" detail="Contrato de aplicación está disponible." />
            <CheckCard ok={readiness.phase_1_does_not_apply_state} title="Bloqueo de aplicación" detail="Fase 1 no modifica estado vigente." />
            <CheckCard ok={readiness.has_testable_event} title="Evento para prueba" detail="Debe existir al menos un evento canónico pendiente o aprobado para probar el flujo completo." />
            <CheckCard ok={!readiness.requires_functional_ui_test} title="Prueba funcional" detail="Se completa cuando se cree y recorra un evento desde la interfaz." />
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Prueba manual requerida</p><h2>Recorrido de cierre</h2></div></div>
          <div className="test-list">
            {(health.required_manual_test ?? []).map((item) => <div className="test-card" key={item}><span className="meta">{item}</span></div>)}
          </div>
          <div className="phase-card highlight">
            <strong>Criterio</strong>
            <span className="meta">Fase 1 se cierra cuando este recorrido funcione y luego pasen typecheck/build.</span>
          </div>
        </aside>
      </section>
    </main>
  )
}
