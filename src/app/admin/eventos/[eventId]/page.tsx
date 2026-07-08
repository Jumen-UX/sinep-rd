'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

type ReviewEvent = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  effective_date: string | null
  status: string
  load_mode: string
  evidence_status: string
  source_name: string | null
  source_url: string | null
  notes: Record<string, unknown> | null
  event_type_key: string
  event_type_name: string
  created_at: string
  approved_at: string | null
  applied_at: string | null
}

type ReviewParticipant = {
  id: string
  role: string
  entity_id: string | null
  entity_name: string | null
  entity_type_key: string | null
  entity_type_name: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
}

type ReviewChecks = {
  has_title: boolean
  has_event_type: boolean
  has_date_or_initial_snapshot: boolean
  has_participant: boolean
  has_source_reference: boolean
  is_pending_review: boolean
  can_approve: boolean
}

type ReviewData = {
  event: ReviewEvent
  participants: ReviewParticipant[]
  review_checks: ReviewChecks
}

const pageStyles = `
  .event-review-page textarea{border:1px solid var(--border);border-radius:14px;font:inherit;min-height:90px;padding:12px 14px;resize:vertical;width:100%}
  .review-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .review-summary,.review-card,.check-card,.participant-card,.impact-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}
  .review-summary,.review-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}.review-layout,.review-grid,.check-grid,.participant-list,.impact-list{display:grid;gap:14px}.review-layout{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.review-grid,.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{align-items:center;display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.review-hero,.review-layout,.review-grid,.check-grid{grid-template-columns:1fr}}
`

function statusLabel(status: string) {
  if (status === 'pending_review') return 'Pendiente de revisión'
  if (status === 'approved') return 'Aprobado'
  if (status === 'applied') return 'Aplicado'
  if (status === 'cancelled') return 'Cancelado'
  if (status === 'draft') return 'Borrador'
  return status
}

function modeLabel(mode: string) {
  if (mode === 'carga_historica') return 'Carga histórica'
  if (mode === 'evento_nuevo') return 'Evento nuevo'
  if (mode === 'foto_inicial') return 'Foto inicial vigente'
  return mode
}

function evidenceLabel(value: string) {
  if (value === 'confirmado_oficial' || value === 'documentado' || value === 'verified') return 'Confirmado / documentado'
  if (value === 'fuente_secundaria') return 'Fuente secundaria'
  if (value === 'importado_vigente') return 'Importado vigente'
  if (value === 'pendiente_documento') return 'Documento pendiente'
  if (value === 'contradictorio') return 'Contradictorio'
  if (value === 'corregido') return 'Corregido'
  return value
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function CheckCard({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return <div className={`check-card ${ok ? 'ok' : 'fail'}`}><strong>{ok ? '✓ ' : '⚠ '}{title}</strong><span className="meta">{detail}</span></div>
}

export default function EventReviewPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo<SupabaseClient>(() => createClient(), [])

  const [review, setReview] = useState<ReviewData | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadReview() {
    setError(null)
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const { data, error: loadError } = await supabase.rpc('get_event_review', { p_event_id: eventId })
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    setReview(data as ReviewData | null)
    setLoading(false)
  }

  async function reviewAction(action: 'approve' | 'cancel' | 'return_to_draft') {
    setSaving(true)
    setError(null)

    const { error: actionError } = await supabase.rpc('admin_review_event', {
      payload: { event_id: eventId, action, review_note: note || null },
    })

    if (actionError) {
      setError(actionError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    await loadReview()
  }

  useEffect(() => {
    if (eventId) loadReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando revisión de evento...</div></main>
  if (!review?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  const event = review.event
  const checks = review.review_checks
  const canApprove = checks.can_approve && event.status === 'pending_review'

  return (
    <main className="container dashboard-page event-review-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card review-hero">
        <div>
          <p className="eyebrow">Revisión de evento</p>
          <h1>{event.title}</h1>
          <p className="lead">Revisa datos, evidencia, participantes e impacto antes de aprobar. Aprobar todavía no aplica cambios al estado vigente.</p>
        </div>
        <div className="review-summary">
          <span className={`mini-badge ${event.status === 'pending_review' ? 'warning' : 'success'}`}>{statusLabel(event.status)}</span>
          <strong>{modeLabel(event.load_mode)}</strong>
          <span className="meta">{evidenceLabel(event.evidence_status)}</span>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="review-layout">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Ficha</p><h2>Datos del evento</h2></div></div>
          <div className="review-grid">
            <div className="review-card"><strong>Tipo</strong><span className="meta">{event.event_type_name}</span></div>
            <div className="review-card"><strong>Fecha</strong><span className="meta">{formatDate(event.event_date)}</span></div>
            <div className="review-card"><strong>Fecha efectiva</strong><span className="meta">{formatDate(event.effective_date)}</span></div>
            <div className="review-card"><strong>Estado</strong><span className="meta">{statusLabel(event.status)}</span></div>
            <div className="review-card"><strong>Fuente</strong><span className="meta">{event.source_name ?? '—'}</span></div>
            <div className="review-card"><strong>Referencia</strong><span className="meta">{event.source_url ?? '—'}</span></div>
            <div className="review-card highlight"><strong>Descripción</strong><span className="meta">{event.description ?? 'Sin descripción.'}</span></div>
            <div className="review-card highlight"><strong>Notas</strong><span className="meta">{typeof event.notes?.notes === 'string' ? event.notes.notes : '—'}</span></div>
          </div>

          <div className="section-heading"><div><p className="eyebrow">Participantes</p><h2>Entidades relacionadas</h2></div></div>
          <div className="participant-list">
            {review.participants.length === 0 && <div className="empty-state">No hay participantes vinculados.</div>}
            {review.participants.map((participant) => (
              <div className="participant-card" key={participant.id}>
                <strong>{participant.entity_name ?? 'Entidad no definida'}</strong>
                <span className="meta">Rol: {participant.role}</span>
                <span className="meta">Tipo: {participant.entity_type_name ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Control de revisión</p><h2>Validaciones</h2></div></div>
          <div className="check-grid">
            <CheckCard ok={checks.has_title} title="Título" detail="El evento tiene identificación legible." />
            <CheckCard ok={checks.has_event_type} title="Tipo" detail="El evento está clasificado." />
            <CheckCard ok={checks.has_date_or_initial_snapshot} title="Fecha" detail="Tiene fecha o es foto inicial vigente." />
            <CheckCard ok={checks.has_participant} title="Participante" detail="Tiene entidad principal vinculada." />
            <CheckCard ok={checks.has_source_reference} title="Fuente" detail="Tiene fuente o referencia declarada." />
            <CheckCard ok={checks.is_pending_review} title="Flujo" detail="Está pendiente de revisión." />
          </div>

          <div className="impact-list">
            <div className="impact-card highlight"><strong>Impacto actual</strong><span className="meta">Aprobar no aplica cambios. Solo deja el evento validado para una futura fase de aplicación.</span></div>
            <div className="impact-card"><strong>Siguiente fase</strong><span className="meta">Aplicar evento deberá crear/cerrar relaciones, actualizar estado vigente y conservar historial.</span></div>
          </div>

          <label className="meta">Nota de revisión
            <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Observación del revisor, corrección requerida o motivo de aprobación." />
          </label>

          <div className="button-row">
            <button className="button button-primary" disabled={!canApprove || saving} onClick={() => reviewAction('approve')} type="button">Aprobar</button>
            <button className="button button-secondary" disabled={event.status !== 'pending_review' || saving} onClick={() => reviewAction('return_to_draft')} type="button">Devolver a borrador</button>
            <button className="button button-secondary" disabled={saving || event.status === 'cancelled' || event.status === 'applied'} onClick={() => reviewAction('cancel')} type="button">Cancelar</button>
          </div>
        </aside>
      </section>
    </main>
  )
}
