'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type ReviewEvent = {
  id: string
  template_id: string | null
  template_name: string | null
  kind_key: string | null
  event_type_key: string
  event_type_name: string
  title: string
  description: string | null
  effective_date: string | null
  status: string
  reason: string | null
  source_name: string | null
  source_url: string | null
  payload: Record<string, unknown>
  created_at: string
  approved_at: string | null
}

type Participant = {
  id: string
  role_key: string
  role_name: string
  node_id: string | null
  node_name: string | null
  level_name: string | null
  parent_node_id?: string | null
  notes: string | null
  metadata: Record<string, unknown>
}

type ReviewChecks = {
  has_title: boolean
  has_event_type: boolean
  has_effective_date: boolean
  has_source_reference: boolean
  has_template_or_payload: boolean
  has_participant: boolean
  is_draft_or_submitted: boolean
  can_submit: boolean
  can_approve: boolean
}

type ReviewResponse = { event: ReviewEvent; participants: Participant[]; review_checks: ReviewChecks }
type ImpactMessage = { code: string; message: string; roles?: string[]; current_child_edges?: number }
type ProposedAction = { action_key: string; title: string; description: string; state_change: boolean; requires_payload: boolean; status: string }
type ImpactSummary = { participant_count: number; proposed_action_count: number; current_parent_edges_found: number; current_child_edges_found: number; blocker_count: number; warning_count: number; application_blocked: boolean; can_apply_in_phase_2: boolean }
type ImpactResponse = { event: ReviewEvent; participants: Participant[]; summary: ImpactSummary; proposed_actions: ProposedAction[]; blockers: ImpactMessage[]; warnings: ImpactMessage[]; required_roles: string[]; missing_roles: string[]; next_gate: string }

const pageStyles = `
  .structural-impact-page textarea{border:1px solid var(--border);border-radius:14px;font:inherit;min-height:86px;padding:11px 13px;resize:vertical;width:100%}
  .impact-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}.impact-summary,.impact-card,.check-card,.participant-card,.message-card,.action-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}.impact-summary,.impact-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail,.message-card.warning{background:#fff7ed;border-color:#fed7aa}.message-card.error{background:#fef2f2;border-color:#fecaca}.layout-grid,.metric-grid,.check-grid,.participant-list,.message-list,.action-list{display:grid;gap:14px}.layout-grid{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row,.badge-row{display:flex;flex-wrap:wrap;gap:8px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.impact-hero,.layout-grid,.metric-grid,.check-grid{grid-template-columns:1fr}}
`

function statusLabel(status?: string) {
  if (status === 'draft') return 'Borrador'
  if (status === 'submitted') return 'En revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'rejected') return 'Rechazado'
  if (status === 'archived') return 'Archivado'
  return status ?? '—'
}

function statusClass(status?: string) {
  if (status === 'approved') return 'success'
  if (status === 'submitted') return 'warning'
  if (status === 'rejected') return 'danger'
  return ''
}

function actionStatusLabel(status?: string) {
  if (status === 'ready_for_review') return 'Lista para revisión'
  if (status === 'manual_review_required') return 'Revisión manual'
  if (status === 'needs_node_definition') return 'Falta definir nodo'
  if (status === 'needs_parent_after') return 'Falta padre posterior'
  if (status === 'needs_source_and_created_node') return 'Falta origen/nodo creado'
  if (status === 'needs_divided_node') return 'Falta nodo dividido'
  if (status === 'needs_merged_and_target_node') return 'Falta fusión/destino'
  if (status === 'needs_suppressed_node') return 'Falta nodo suprimido'
  if (status === 'needs_new_name') return 'Falta nombre nuevo'
  if (status === 'needs_affected_and_parent_after') return 'Falta nodo y padre posterior'
  if (status === 'needs_new_level') return 'Falta nivel nuevo'
  return status ?? '—'
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha efectiva'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return <div className={`check-card ${ok ? 'ok' : 'fail'}`}><strong>{ok ? '✓ ' : '⚠ '}{title}</strong><span className="meta">{detail}</span></div>
}

export default function StructuralEvolutionImpactPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [impact, setImpact] = useState<ImpactResponse | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadDetail() {
    setError(null)
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [reviewRes, impactRes] = await Promise.all([
      supabase.rpc('get_structural_evolution_review', { p_event_id: eventId }),
      supabase.rpc('get_structural_evolution_impact', { p_event_id: eventId }),
    ])

    if (reviewRes.error) setError(reviewRes.error.message)
    if (impactRes.error) setError(impactRes.error.message)

    setReview((reviewRes.data ?? null) as ReviewResponse | null)
    setImpact((impactRes.data ?? null) as ImpactResponse | null)
    setLoading(false)
  }

  async function reviewEvent(action: 'submit' | 'approve' | 'return_to_draft' | 'reject' | 'archive') {
    setSaving(true)
    setError(null)
    const { error: reviewError } = await supabase.rpc('admin_review_structural_evolution_event', {
      payload: { event_id: eventId, action, review_note: reviewNote || null },
    })
    if (reviewError) {
      setError(reviewError.message)
      setSaving(false)
      return
    }
    setReviewNote('')
    await loadDetail()
    setSaving(false)
  }

  useEffect(() => {
    if (eventId) loadDetail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando impacto estructural...</div></main>
  if (!review?.event) return <main className="container"><div className="error-box">No se encontró el evento estructural.</div></main>

  const event = review.event
  const checks = review.review_checks
  const summary = impact?.summary

  return (
    <main className="container dashboard-page structural-impact-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/estructura/eventos">← Volver a eventos estructurales</Link></div>

      <section className="dashboard-hero card impact-hero">
        <div>
          <p className="eyebrow">Fase 2 · vista de impacto</p>
          <h1>{event.title}</h1>
          <p className="lead">Vista previa de lo que el evento estructural debería crear, cerrar, mover o dejar histórico. Esta pantalla no aplica cambios.</p>
          <div className="button-row">
            <Link className="button button-primary" href={`/admin/estructura/eventos/${eventId}/plan`}>Plan de aplicación</Link>
            <Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}/contrato`}>Contrato</Link>
            <Link className="button button-secondary" href="/admin/estructura/eventos">Registro estructural</Link>
            <Link className="button button-secondary" href="/admin/estructura">Motor de estructuras</Link>
          </div>
        </div>
        <div className="impact-summary">
          <span className={`mini-badge ${statusClass(event.status)}`}>{statusLabel(event.status)}</span>
          <strong>{event.event_type_name}</strong>
          <span className="meta">{event.template_name ?? 'Sin estructura'} · {formatDate(event.effective_date)}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="metric-grid">
        <div className="impact-card"><strong>{summary?.participant_count ?? 0}</strong><span className="meta">participantes</span></div>
        <div className="impact-card"><strong>{summary?.proposed_action_count ?? 0}</strong><span className="meta">acciones propuestas</span></div>
        <div className="impact-card"><strong>{summary?.blocker_count ?? 0}</strong><span className="meta">bloqueos</span></div>
        <div className="impact-card"><strong>{summary?.warning_count ?? 0}</strong><span className="meta">advertencias</span></div>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Impacto calculado</p><h2>Acciones estructurales propuestas</h2><p className="meta">Estas acciones alimentan el plan y el contrato antes de cualquier mutación real.</p></div></div>
          <div className="action-list">
            {(impact?.proposed_actions ?? []).length === 0 && <div className="empty-state">No hay acciones propuestas.</div>}
            {(impact?.proposed_actions ?? []).map((action) => (
              <article className="action-card" key={action.action_key}>
                <div><p className="eyebrow">{action.action_key}</p><h2>{action.title}</h2><p className="meta">{action.description}</p></div>
                <div className="badge-row">
                  <span className={`mini-badge ${action.status === 'ready_for_review' ? 'success' : 'warning'}`}>{actionStatusLabel(action.status)}</span>
                  {action.state_change && <span className="mini-badge warning">Cambia estado</span>}
                  {action.requires_payload && <span className="mini-badge warning">Requiere datos</span>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Revisión</p><h2>Estado del evento</h2></div></div>
          <div className="check-grid">
            <CheckCard ok={checks.has_title} title="Título" detail="El evento tiene título administrativo." />
            <CheckCard ok={checks.has_event_type} title="Tipo" detail="El evento tiene tipo estructural." />
            <CheckCard ok={checks.has_effective_date} title="Fecha efectiva" detail="Necesaria para vigencia histórica." />
            <CheckCard ok={checks.has_source_reference} title="Fuente" detail="Debe existir fuente o referencia." />
            <CheckCard ok={checks.has_template_or_payload} title="Estructura" detail="Debe estar vinculado a plantilla o payload." />
            <CheckCard ok={checks.has_participant} title="Participantes" detail="Debe tener al menos un nodo relacionado." />
          </div>
          <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Nota de revisión estructural..." />
          <div className="button-row">
            {event.status === 'draft' && <button className="button button-primary" disabled={saving} onClick={() => reviewEvent('submit')} type="button">Enviar a revisión</button>}
            {event.status === 'submitted' && <button className="button button-primary" disabled={saving || !checks.can_approve} onClick={() => reviewEvent('approve')} type="button">Aprobar</button>}
            {event.status === 'submitted' && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent('return_to_draft')} type="button">Devolver</button>}
            {['draft', 'submitted'].includes(event.status) && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent('reject')} type="button">Rechazar</button>}
            {event.status !== 'archived' && <button className="button button-secondary" disabled={saving} onClick={() => reviewEvent('archive')} type="button">Archivar</button>}
          </div>
          <div className="impact-card highlight"><strong>Siguiente compuerta</strong><span className="meta">Generar plan, completar datos, revisar conflictos y consultar contrato.</span><div className="button-row"><Link className="button button-primary" href={`/admin/estructura/eventos/${eventId}/plan`}>Abrir plan</Link><Link className="button button-secondary" href={`/admin/estructura/eventos/${eventId}/contrato`}>Abrir contrato</Link></div></div>
        </aside>
      </section>

      <section className="layout-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Nodos</p><h2>Participantes del evento</h2></div></div>
          <div className="participant-list">
            {(impact?.participants ?? review.participants ?? []).length === 0 && <div className="empty-state">Sin participantes.</div>}
            {(impact?.participants ?? review.participants ?? []).map((participant) => (
              <article className="participant-card" key={participant.id}>
                <strong>{participant.role_name}</strong>
                <span className="meta">{participant.node_name ?? 'Nodo no definido'} · {participant.level_name ?? 'Nivel no definido'}</span>
                {participant.notes && <span className="meta">{participant.notes}</span>}
              </article>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Bloqueos</p><h2>Faltantes antes de aplicar</h2></div></div>
          <div className="message-list">
            {(impact?.blockers ?? []).length === 0 && <div className="message-card"><strong>Sin bloqueos críticos</strong><span className="meta">Todavía puede requerir revisión manual antes de aplicar.</span></div>}
            {(impact?.blockers ?? []).map((message) => <div className="message-card error" key={message.code}><strong>{message.code}</strong><span className="meta">{message.message}</span></div>)}
            {(impact?.warnings ?? []).map((message) => <div className="message-card warning" key={message.code}><strong>{message.code}</strong><span className="meta">{message.message}</span>{message.roles && <span className="meta">Roles: {message.roles.join(', ')}</span>}</div>)}
          </div>
          <div className="impact-card highlight"><strong>Aplicación bloqueada</strong><span className="meta">Fase 2 registra, revisa e identifica impacto. La aplicación auditada será la siguiente compuerta: {impact?.next_gate ?? '—'}.</span></div>
        </aside>
      </section>
    </main>
  )
}
