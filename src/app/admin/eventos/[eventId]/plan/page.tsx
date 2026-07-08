'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

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
  status: string
  notes: string | null
  subject_entity_name: string | null
  target_entity_name: string | null
  relationship_type_name: string | null
  payload: Record<string, unknown>
  sort_order: number
}

type PlanSummary = {
  action_count: number
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
  .plan-summary,.plan-card.highlight{background:#fbf8f1}.plan-grid,.actions-list,.metric-grid{display:grid;gap:14px}.plan-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(300px,.4fr)}.metric-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.badge-row{display:flex;flex-wrap:wrap;gap:7px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.button-row{align-items:center;display:flex;flex-wrap:wrap;gap:12px}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.plan-hero,.plan-grid,.metric-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'pending_review') return 'Pendiente de revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'applied') return 'Aplicado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'draft') return 'Borrador'
  if (status === 'planned') return 'Planificada'
  if (status === 'ready') return 'Lista'
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

  useEffect(() => {
    if (eventId) loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando plan de acciones...</div></main>
  if (!plan?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  const summary = plan.summary

  return (
    <main className="container dashboard-page event-action-plan-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}`}>← Volver a revisión</Link></div>

      <section className="dashboard-hero card plan-hero">
        <div>
          <p className="eyebrow">Fase 1 · plan de aplicación</p>
          <h1>{plan.event.title}</h1>
          <p className="lead">Esta pantalla traduce el evento aprobado o pendiente en acciones aplicables. En esta fase solo se genera el plan: todavía no modifica relaciones ni fichas vigentes.</p>
          <div className="button-row">
            <button className="button button-primary" disabled={!summary.can_generate_plan || saving} onClick={generatePlan} type="button">{saving ? 'Generando...' : 'Generar / regenerar plan'}</button>
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
      </section>

      <section className="plan-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Plan generado</h2><p className="meta">Cada acción es una instrucción explícita que luego podrá aplicarse con control y auditoría.</p></div></div>
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
                  <span className={`mini-badge ${action.status === 'ready' ? 'success' : ''}`}>{statusLabel(action.status)}</span>
                  {action.changes_state && <span className="mini-badge warning">Cambia estado</span>}
                  {action.requires_manual_review && <span className="mini-badge warning">Revisión manual</span>}
                  {action.subject_entity_name && <span className="mini-badge">Entidad: {action.subject_entity_name}</span>}
                  {action.target_entity_name && <span className="mini-badge">Destino: {action.target_entity_name}</span>}
                  {action.relationship_type_name && <span className="mini-badge">Relación: {action.relationship_type_name}</span>}
                </div>
                {action.notes && <p className="meta">{action.notes}</p>}
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
