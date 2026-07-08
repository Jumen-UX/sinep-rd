'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>
type ActionStatus = 'planned' | 'ready' | 'skipped' | 'failed'

type PlanEvent = {
  id: string
  title: string
  status: string
  load_mode: string
  evidence_status: string
  event_date: string | null
  effective_date: string | null
  event_type_key: string
  event_type_name: string
}

type PlanAction = {
  id: string
  action_type_key: string
  action_type_name: string
  description: string | null
  changes_state: boolean
  requires_manual_review: boolean
  status: ActionStatus
  notes: string | null
  subject_entity_name: string | null
  target_entity_name: string | null
  relationship_type_name: string | null
  payload: Record<string, unknown>
  sort_order: number
}

type PlanSummary = {
  action_count: number
  ready_count: number
  planned_count: number
  skipped_count: number
  failed_count: number
  state_changing_count: number
  manual_review_count: number
  can_generate_plan: boolean
  can_apply_now: boolean
  apply_lock_reason: string
}

type ApplicationPlan = {
  event: PlanEvent
  actions: PlanAction[]
  summary: PlanSummary
}

const pageStyles = `
  .plan-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .plan-summary,.plan-card,.action-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}
  .plan-summary,.plan-card.highlight{background:#fbf8f1}.plan-grid,.actions-list,.metric-grid,.status-grid{display:grid;gap:14px}.plan-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,.4fr)}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.status-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.badge-row,.button-row{display:flex;flex-wrap:wrap;gap:7px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.action-controls{border-top:1px solid var(--border);display:grid;gap:10px;margin-top:8px;padding-top:12px}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.plan-hero,.plan-grid,.metric-grid,.status-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'pending_review') return 'Pendiente de revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'applied') return 'Aplicado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'draft') return 'Borrador'
  if (status === 'planned') return 'Planificada'
  if (status === 'ready') return 'Lista'
  if (status === 'skipped') return 'Omitida'
  if (status === 'failed') return 'Con observación'
  return status ?? '—'
}

function modeLabel(mode?: string) {
  if (mode === 'carga_historica') return 'Carga histórica'
  if (mode === 'evento_nuevo') return 'Evento nuevo'
  if (mode === 'foto_inicial') return 'Foto inicial vigente'
  return mode ?? '—'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function statusClass(status: ActionStatus) {
  if (status === 'ready') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'skipped') return 'warning'
  return ''
}

export default function EventActionPlanPage() {
  const router = useRouter()
  const params = useParams()
  const eventIdParam = params?.eventId
  const eventId = Array.isArray(eventIdParam) ? eventIdParam[0] : String(eventIdParam ?? '')
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [plan, setPlan] = useState<ApplicationPlan | null>(null)
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

    const { data, error: loadError } = await supabase.rpc('get_event_application_plan', { p_event_id: eventId })
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setPlan(data as ApplicationPlan | null)
    setLoading(false)
  }

  async function generatePlan() {
    setSaving(true)
    setError(null)

    const { data, error: generateError } = await supabase.rpc('admin_generate_event_action_plan', {
      payload: { event_id: eventId },
    })

    if (generateError) {
      setError(generateError.message)
      setSaving(false)
      return
    }

    setPlan(data as ApplicationPlan | null)
    setSaving(false)
  }

  async function updateAction(actionId: string, status: ActionStatus) {
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await supabase.rpc('admin_update_event_action', {
      payload: { action_id: actionId, status },
    })

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setPlan(data as ApplicationPlan | null)
    setSaving(false)
  }

  useEffect(() => {
    if (eventId) loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando plan de acciones...</div></main>
  if (!plan?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  const summary = plan.summary
  const allReviewed = summary.action_count > 0 && summary.planned_count === 0

  return (
    <main className="container dashboard-page event-action-plan-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}`}>← Volver a revisión</Link></div>

      <section className="dashboard-hero card plan-hero">
        <div>
          <p className="eyebrow">Fase 1 · plan de aplicación</p>
          <h1>{plan.event.title}</h1>
          <p className="lead">Esta pantalla traduce el evento en acciones aplicables. En esta fase se revisa cada acción, pero todavía no modifica relaciones ni fichas vigentes.</p>
          <div className="button-row">
            <button className="button button-primary" disabled={!summary.can_generate_plan || saving} onClick={generatePlan} type="button">{saving ? 'Procesando...' : 'Generar / regenerar plan'}</button>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}`}>Revisar evento</Link>
          </div>
        </div>
        <div className="plan-summary">
          <span className="mini-badge">{statusLabel(plan.event.status)}</span>
          <strong>{modeLabel(plan.event.load_mode)}</strong>
          <span className="meta">{plan.event.event_type_name} · {formatDate(plan.event.event_date)}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="plan-card"><strong>{summary.action_count}</strong><span className="meta">acciones generadas</span></div>
        <div className="plan-card"><strong>{summary.state_changing_count}</strong><span className="meta">cambiarían estado</span></div>
        <div className="plan-card"><strong>{summary.manual_review_count}</strong><span className="meta">requieren revisión manual</span></div>
        <div className="plan-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
      </section>

      <section className="status-grid">
        <div className="plan-card"><strong>{summary.planned_count}</strong><span className="meta">planificadas</span></div>
        <div className="plan-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
        <div className="plan-card"><strong>{summary.skipped_count}</strong><span className="meta">omitidas</span></div>
        <div className="plan-card"><strong>{summary.failed_count}</strong><span className="meta">con observación</span></div>
      </section>

      <section className="plan-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Plan generado</h2><p className="meta">Marca cada acción como lista, planificada, omitida o con observación. Esto aún no aplica cambios.</p></div></div>
          <div className="actions-list">
            {plan.actions.length === 0 && <div className="empty-state">Este evento todavía no tiene plan. Usa Generar plan.</div>}
            {plan.actions.map((action) => (
              <article className="action-card" key={action.id}>
                <div>
                  <p className="eyebrow">Orden {action.sort_order}</p>
                  <h2>{action.action_type_name}</h2>
                  <p className="meta">{action.description ?? action.notes ?? 'Sin descripción.'}</p>
                </div>
                <div className="badge-row">
                  <span className={`mini-badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span>
                  {action.changes_state && <span className="mini-badge warning">Cambia estado</span>}
                  {action.requires_manual_review && <span className="mini-badge warning">Revisión manual</span>}
                  {action.subject_entity_name && <span className="mini-badge">Entidad: {action.subject_entity_name}</span>}
                  {action.target_entity_name && <span className="mini-badge">Destino: {action.target_entity_name}</span>}
                  {action.relationship_type_name && <span className="mini-badge">Relación: {action.relationship_type_name}</span>}
                </div>
                {action.notes && <p className="meta">{action.notes}</p>}
                <div className="action-controls">
                  <strong>Revisión de acción</strong>
                  <div className="button-row">
                    <button className="button button-secondary" disabled={saving || action.status === 'planned'} onClick={() => updateAction(action.id, 'planned')} type="button">Planificada</button>
                    <button className="button button-primary" disabled={saving || action.status === 'ready'} onClick={() => updateAction(action.id, 'ready')} type="button">Lista</button>
                    <button className="button button-secondary" disabled={saving || action.status === 'skipped'} onClick={() => updateAction(action.id, 'skipped')} type="button">Omitir</button>
                    <button className="button button-secondary" disabled={saving || action.status === 'failed'} onClick={() => updateAction(action.id, 'failed')} type="button">Observación</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Regla de fase</p><h2>Aplicación bloqueada</h2></div></div>
          <div className="plan-card highlight">
            <strong>No se aplican cambios todavía</strong>
            <span className="meta">{summary.apply_lock_reason}</span>
          </div>
          <div className="plan-card">
            <strong>Revisión del plan</strong>
            <span className="meta">{allReviewed ? 'Todas las acciones fueron revisadas.' : 'Todavía hay acciones planificadas sin decisión.'}</span>
          </div>
          <div className="plan-card">
            <strong>Qué se está validando</strong>
            <span className="meta">Que cada evento pueda convertirse en acciones explícitas: crear ficha, actualizar metadatos, crear/cerrar relaciones, registrar límites o marcar supresión.</span>
          </div>
          <div className="plan-card">
            <strong>Siguiente paso</strong>
            <span className="meta">Cuando esta lógica esté validada, la fase siguiente habilitará aplicar acciones una por una con auditoría.</span>
          </div>
        </aside>
      </section>
    </main>
  )
}
