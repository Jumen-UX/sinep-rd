'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  loadEventReview,
  submitEventReview,
  type EventReviewAction,
  type EventReviewData,
  type ReviewParticipant,
} from '../services/event-workflow-admin-service'

const pageStyles = `
  .event-review-page textarea{border:1px solid var(--border);border-radius:14px;font:inherit;min-height:90px;padding:12px 14px;resize:vertical;width:100%}
  .review-hero{align-items:stretch;grid-template-columns:minmax(0,1fr) minmax(280px,.42fr)}
  .review-summary,.review-card,.check-card,.participant-card,.impact-card{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}
  .review-summary,.review-card.highlight,.check-card.ok{background:#fbf8f1}.check-card.fail{background:#fff7ed;border-color:#fed7aa}.review-layout,.review-grid,.check-grid,.participant-list,.impact-list{display:grid;gap:14px}.review-layout{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.review-grid,.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row{align-items:center;display:flex;flex-wrap:wrap;gap:14px;margin-top:14px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.review-hero,.review-layout,.review-grid,.check-grid{grid-template-columns:1fr}}
`

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

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

function participantName(participant: ReviewParticipant) {
  return participant.organization_unit_name ?? participant.entity_name ?? 'Destino no definido'
}

export default function EventReviewPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo(() => createClient(), [])
  const [review, setReview] = useState<EventReviewData | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshReview() {
    setError(null)
    setLoading(true)

    try {
      if (!await hasEventAdminSession(supabase)) {
        router.replace('/admin/login')
        return
      }

      setReview(await loadEventReview(supabase, eventId))
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar la revisión del evento.'))
    } finally {
      setLoading(false)
    }
  }

  async function reviewAction(action: EventReviewAction) {
    setSaving(true)
    setError(null)

    try {
      await submitEventReview(supabase, eventId, action, note)
      await refreshReview()
    } catch (actionError) {
      setError(errorMessage(actionError, 'No se pudo completar la revisión del evento.'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (eventId) void refreshReview()
    // refreshReview uses the stable route id and Supabase client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div className="empty-state">Cargando revisión de evento...</div></main>
  if (!review?.event) return <main className="container"><div className="error-box">No se encontró el evento.</div></main>

  const event = review.event
  const checks = review.review_checks
  const canApprove = checks.can_approve && event.status === 'pending_review'
  const isOrganizational = event.applies_to === 'organization_unit'

  return (
    <main className="container dashboard-page event-review-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card review-hero">
        <div>
          <p className="eyebrow">Revisión de evento</p>
          <h1>{event.title}</h1>
          <p className="lead">Revisa datos, fuente, destino y plan de impacto antes de aprobar. La aplicación es un paso posterior y explícito.</p>
        </div>
        <div className="review-summary">
          <span className={`mini-badge ${event.status === 'pending_review' ? 'warning' : 'success'}`}>{statusLabel(event.status)}</span>
          <strong>{modeLabel(event.load_mode)}</strong>
          <span className="meta">{isOrganizational ? 'Unidad organizativa' : 'Entidad eclesiástica'} · {evidenceLabel(event.evidence_status)}</span>
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

          <div className="section-heading"><div><p className="eyebrow">Destinos</p><h2>{isOrganizational ? 'Unidades organizativas' : 'Entidades relacionadas'}</h2></div></div>
          <div className="participant-list">
            {review.participants.length === 0 && <div className="empty-state">{isOrganizational && event.event_type_key === 'organization_unit_creation' ? 'La unidad será creada al aplicar el evento.' : 'No hay destinos vinculados.'}</div>}
            {review.participants.map((participant) => (
              <div className="participant-card" key={participant.id}>
                <strong>{participantName(participant)}</strong>
                <span className="meta">Rol: {participant.role}</span>
                {participant.target_kind === 'organization_unit' ? <>
                  <span className="meta">Organigrama: {participant.organization_chart_name ?? '—'}</span>
                  <span className="meta">Diócesis: {participant.scope_entity_name ?? '—'}</span>
                </> : <span className="meta">Tipo: {participant.entity_type_name ?? '—'}</span>}
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
            <CheckCard ok={checks.has_participant} title="Destino" detail={isOrganizational ? 'Tiene unidad vinculada o define una creación válida.' : 'Tiene entidad principal vinculada.'} />
            <CheckCard ok={checks.has_source_reference} title="Fuente" detail="Tiene fuente o referencia declarada." />
            {isOrganizational && <CheckCard ok={checks.has_action_plan} title="Plan" detail="El impacto organizativo fue generado." />}
            {isOrganizational && <CheckCard ok={!checks.has_blocking_action} title="Bloqueos" detail="No existen acciones fallidas ni revisión documental pendiente." />}
            <CheckCard ok={checks.is_pending_review} title="Flujo" detail="Está pendiente de revisión." />
          </div>

          <div className="impact-list">
            <div className="impact-card highlight"><strong>Impacto actual</strong><span className="meta">Aprobar valida el evento y deja listas sus acciones; no aplica el cambio por sí solo.</span></div>
            <div className="impact-card"><strong>Aplicación</strong><span className="meta">{isOrganizational ? 'Después de aprobar, el contrato puede aplicar las acciones transaccionalmente y sellar el historial.' : 'La aplicación automática jurisdiccional continúa bloqueada.'}</span></div>
            <div className="impact-card"><strong>Flujo</strong><span className="meta">Revisión → plan de acciones → contrato → aplicación cuando corresponda.</span></div>
          </div>

          <label className="meta">Nota de revisión
            <textarea value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} placeholder="Observación del revisor, corrección requerida o motivo de aprobación." />
          </label>

          <div className="button-row">
            <button className="button button-primary" disabled={!canApprove || saving} onClick={() => reviewAction('approve')} type="button">Aprobar</button>
            <button className="button button-secondary" disabled={event.status !== 'pending_review' || saving} onClick={() => reviewAction('return_to_draft')} type="button">Devolver a borrador</button>
            <button className="button button-secondary" disabled={saving || event.status === 'cancelled' || event.status === 'applied'} onClick={() => reviewAction('cancel')} type="button">Cancelar</button>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}/plan`}>Plan de acciones</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}/contrato`}>Contrato de aplicación</Link>
          </div>
        </aside>
      </section>
    </main>
  )
}
