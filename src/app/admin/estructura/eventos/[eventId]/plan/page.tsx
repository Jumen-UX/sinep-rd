'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type ActionStatus = 'planned' | 'ready' | 'skipped' | 'failed' | 'applied'

type PlanEvent = {
  id: string
  title: string
  status: string
  event_type_key: string
  event_type_name: string
  effective_date: string | null
  template_name: string | null
  kind_key: string | null
}

type PlanSummary = {
  action_count: number
  planned_count: number
  ready_count: number
  skipped_count: number
  failed_count: number
  applied_count: number
  state_changing_count: number
  manual_review_count: number
  blocker_count: number
  warning_count: number
  can_generate_plan: boolean
  can_apply_now: boolean
  apply_lock_reason: string
}

type PlanAction = {
  id: string
  action_type_key: string
  action_type_name: string
  status: ActionStatus
  title: string
  description: string | null
  changes_state: boolean
  requires_manual_review: boolean
  requires_payload: boolean
  auto_apply_allowed: boolean
  apply_strategy: string
  subject_node_name: string | null
  target_node_name: string | null
  parent_before_node_name: string | null
  parent_after_node_name: string | null
  level_before_name: string | null
  level_after_name: string | null
  payload: Record<string, unknown>
  notes: string | null
  sort_order: number
}

type PlanResponse = {
  event: PlanEvent
  summary: PlanSummary
  actions: PlanAction[]
  impact: Record<string, unknown>
}

const pageStyles = `
  .structural-plan-page textarea{border:1px solid var(--border);border-radius:14px;font:inherit;min-height:74px;padding:11px 13px;resize:vertical;width:100%}
  .plan-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.plan-summary,.plan-card,.action-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.plan-summary,.plan-card.highlight{background:#fbf8f1}.layout-grid,.metric-grid,.status-grid,.action-list{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.metric-grid,.status-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.button-row,.badge-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.action-controls{border-top:1px solid var(--border);display:grid;gap:10px;margin-top:8px;padding-top:12px}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.plan-hero,.layout-grid,.metric-grid,.status-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'draft') return 'Borrador'
  if (status === 'submitted') return 'En revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'planned') return 'Planificada'
  if (status === 'ready') return 'Lista'
  if (status === 'skipped') return 'Omitida'
  if (status === 'failed') return 'Con observación'
  if (status === 'applied') return 'Aplicada'
  return status ?? '—'
}

function statusClass(status?: string) {
  if (status === 'approved' || status === 'ready') return 'success'
  if (status === 'submitted' || status === 'skipped' || status === 'planned') return 'warning'
  if (status === 'failed') return 'danger'
  return ''
}

function strategyLabel(strategy?: string) {
  if (strategy === 'metadata_only') return 'Solo metadatos'
  if (strategy === 'automatic_safe') return 'Automática segura'
  if (strategy === 'manual_review') return 'Revisión manual'
  if (strategy === 'manual_only') return 'Solo manual'
  if (strategy === 'never_apply') return 'No aplicable'
  return strategy ?? '—'
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha efectiva'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export default function StructuralApplicationPlanPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadPlan() {
    setError(null)
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const { data, error: loadError } = await supabase.rpc('get_structural_application_plan', { p_event_id: eventId })
    if (loadError) setError(loadError.message)
    setPlan((data ?? null) as PlanResponse | null)
    setLoading(false)
  }

  async function generatePlan() {
    setSaving(true)
    setError(null)
    const { data, error: generateError } = await supabase.rpc('admin_generate_structural_application_plan', { payload: { event_id: eventId } })
    if (generateError) {
      setError(generateError.message)
      setSaving(false)
      return
    }
    setPlan((data ?? null) as PlanResponse | null)
    setSaving(false)
  }

  async function updateAction(actionId: string, status: ActionStatus) {
    setSaving(true)
    setError(null)
    const { data, error: updateError } = await supabase.rpc('admin_update_structural_event_action', { payload: { action_id: actionId, status } })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }
    setPlan((data ?? null) as PlanResponse | null)
    setSaving(false)
  }

  useEffect(() => {
    if (eventId) loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando plan de aplicación estructural...</div></main>
  if (!plan?.event) return <main className="container"><div className="error-box">No se encontró el evento estructural.</div></main>

  const event = plan.event
  const summary = plan.summary
  const allReviewed = summary.action_count > 0 && summary.planned_count === 0

  return (
    <main className="container dashboard-page structural-plan-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/estructura/eventos/${eventId}`}>← Volver a impacto</Link></div>

      <section className="dashboard-hero card plan-hero">
        <div>
          <p className="eyebrow">Fase 2 · plan de aplicación estructural</p>
          <h1>{event.title}</h1>
          <p className="lead">Convierte el impacto estructural en acciones revisables. Todavía no crea, mueve, cierra ni renombra nodos.</p>
          <div className="button-row">
            <button className="button button-primary" disabled={!summary.can_generate_plan || saving} onClick={generatePlan} type="button">{saving ? 'Procesando...' : 'Generar / regenerar plan'}</button>
            <Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}`}>Vista de impacto</Link>
            <Link className="button button-secondary" href="/admin/estructura/eventos">Registro estructural</Link>
          </div>
        </div>
        <div className="plan-summary">
          <span className={`mini-badge ${statusClass(event.status)}`}>{statusLabel(event.status)}</span>
          <strong>{event.event_type_name}</strong>
          <span className="meta">{event.template_name ?? 'Sin estructura'} · {formatDate(event.effective_date)}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="plan-card"><strong>{summary.action_count}</strong><span className="meta">acciones</span></div>
        <div className="plan-card"><strong>{summary.state_changing_count}</strong><span className="meta">cambiarían estructura</span></div>
        <div className="plan-card"><strong>{summary.blocker_count}</strong><span className="meta">bloqueos de impacto</span></div>
        <div className="plan-card"><strong>{summary.warning_count}</strong><span className="meta">advertencias</span></div>
      </section>

      <section className="status-grid">
        <div className="plan-card"><strong>{summary.planned_count}</strong><span className="meta">planificadas</span></div>
        <div className="plan-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
        <div className="plan-card"><strong>{summary.skipped_count}</strong><span className="meta">omitidas</span></div>
        <div className="plan-card"><strong>{summary.failed_count}</strong><span className="meta">observadas</span></div>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Plan generado</h2><p className="meta">Cada acción debe revisarse antes de una futura aplicación auditada.</p></div></div>
          <div className="action-list">
            {plan.actions.length === 0 && <div className="empty-state">Este evento todavía no tiene plan. Usa Generar plan.</div>}
            {plan.actions.map((action) => (
              <article className="action-card" key={action.id}>
                <div><p className="eyebrow">Orden {action.sort_order} · {action.action_type_key}</p><h2>{action.title}</h2><p className="meta">{action.description ?? 'Sin descripción.'}</p></div>
                <div className="badge-row">
                  <span className={`mini-badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span>
                  <span className="mini-badge">{strategyLabel(action.apply_strategy)}</span>
                  {action.changes_state && <span className="mini-badge warning">Cambia estructura</span>}
                  {action.requires_payload && <span className="mini-badge warning">Requiere datos</span>}
                  {action.subject_node_name && <span className="mini-badge">Nodo: {action.subject_node_name}</span>}
                  {action.target_node_name && <span className="mini-badge">Destino: {action.target_node_name}</span>}
                  {action.parent_before_node_name && <span className="mini-badge">Padre anterior: {action.parent_before_node_name}</span>}
                  {action.parent_after_node_name && <span className="mini-badge">Padre posterior: {action.parent_after_node_name}</span>}
                  {action.level_after_name && <span className="mini-badge">Nivel posterior: {action.level_after_name}</span>}
                </div>
                {action.notes && <p className="meta">{action.notes}</p>}
                <div className="action-controls"><strong>Revisión de acción</strong><div className="button-row"><button className="button button-secondary" disabled={saving || action.status === 'planned' || action.status === 'applied'} onClick={() => updateAction(action.id, 'planned')} type="button">Planificada</button><button className="button button-primary" disabled={saving || action.status === 'ready' || action.status === 'applied'} onClick={() => updateAction(action.id, 'ready')} type="button">Lista</button><button className="button button-secondary" disabled={saving || action.status === 'skipped' || action.status === 'applied'} onClick={() => updateAction(action.id, 'skipped')} type="button">Omitir</button><button className="button button-secondary" disabled={saving || action.status === 'failed' || action.status === 'applied'} onClick={() => updateAction(action.id, 'failed')} type="button">Observación</button></div></div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Regla de fase</p><h2>Aplicación bloqueada</h2></div></div>
          <div className="plan-card highlight"><strong>No se modifica estructura</strong><span className="meta">{summary.apply_lock_reason}</span></div>
          <div className="plan-card"><strong>Revisión del plan</strong><span className="meta">{allReviewed ? 'Todas las acciones fueron revisadas.' : 'Todavía hay acciones planificadas sin decisión.'}</span></div>
          <div className="plan-card"><strong>Bloqueos de impacto</strong><span className="meta">{summary.blocker_count} bloqueos y {summary.warning_count} advertencias deben revisarse antes de aplicar.</span></div>
          <div className="plan-card"><strong>Siguiente compuerta</strong><span className="meta">Editor de datos faltantes por acción: nodo nuevo, padre posterior, nuevo nivel o nombre nuevo.</span></div>
        </aside>
      </section>
    </main>
  )
}
