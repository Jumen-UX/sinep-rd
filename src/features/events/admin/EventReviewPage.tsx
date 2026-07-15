'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import { loadDeterministicEventImpactPlan } from '../services/event-impact-admin-service'
import type { DeterministicImpactPlan, ImpactIssue, ImpactNode } from '../services/event-impact-plan'
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
  .review-summary,.review-card,.check-card,.participant-card,.impact-card,.impact-node,.impact-issue{background:#fff;border:1px solid var(--border);border-radius:16px;display:grid;gap:8px;padding:14px}
  .review-summary,.review-card.highlight,.check-card.ok,.impact-node.ready{background:#fbf8f1}.check-card.fail,.impact-issue.warning{background:#fff7ed;border-color:#fed7aa}.impact-issue.error{background:#fef2f2;border-color:#fecaca}
  .review-layout,.review-grid,.check-grid,.participant-list,.impact-list,.impact-node-list,.impact-issue-list,.derived-update-list{display:grid;gap:14px}.review-layout{align-items:start;grid-template-columns:minmax(0,1fr) minmax(320px,.42fr)}.review-grid,.check-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.button-row,.badge-row{align-items:center;display:flex;flex-wrap:wrap;gap:10px}.mini-badge{background:#fbf8f1;border:1px solid var(--border);border-radius:999px;color:var(--primary);display:inline-flex;font-size:12px;font-weight:900;padding:6px 9px}.mini-badge.warning{background:#fff7ed;color:#9a3412}.mini-badge.success{background:#f0fdf4;color:#166534}.mini-badge.danger{background:#fef2f2;color:#991b1b}.detail-backlink{margin-bottom:8px}.detail-backlink a{color:var(--primary);font-weight:800;text-decoration:none}@media(max-width:980px){.review-hero,.review-layout,.review-grid,.check-grid{grid-template-columns:1fr}}
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

function issueClass(issue: ImpactIssue) {
  return issue.severity === 'error' ? 'error' : 'warning'
}

function ImpactNodeCard({ node }: { node: ImpactNode }) {
  return (
    <article className={`impact-node ${node.blocking ? '' : 'ready'}`}>
      <div><p className="eyebrow">Acción {node.order}</p><strong>{node.title}</strong><span className="meta">{node.description ?? node.type}</span></div>
      <div className="badge-row">
        <span className="mini-badge">Destino: {node.target}</span>
        {node.changesState && <span className="mini-badge warning">Cambia estado</span>}
        {node.requiresManualReview && <span className="mini-badge warning">Revisión manual</span>}
        {node.blocking && <span className="mini-badge danger">Bloqueante</span>}
        {node.compensable && <span className="mini-badge success">Compensable</span>}
      </div>
      <span className="meta">Dependencias: {node.dependsOn.length > 0 ? node.dependsOn.join(', ') : 'ninguna'}</span>
    </article>
  )
}

function ImpactPreview({ impact }: { impact: DeterministicImpactPlan | null }) {
  if (!impact) {
    return <div className="empty-state">El evento todavía no tiene un plan de impacto. Genera el plan antes de aprobar.</div>
  }

  return (
    <>
      <div className="section-heading"><div><p className="eyebrow">Impacto determinista</p><h2>{impact.canApprove ? 'Plan listo para revisión' : 'Plan con bloqueos'}</h2><p className="meta">Proyección de solo lectura derivada de las acciones canónicas. No modifica el estado vigente.</p></div></div>
      <div className="check-grid">
        <CheckCard ok={impact.nodes.length > 0} title="Acciones" detail={`${impact.nodes.length} acciones ordenadas de forma estable.`} />
        <CheckCard ok={!impact.hasCycle} title="Dependencias" detail={impact.hasCycle ? 'El grafo contiene un ciclo.' : 'El grafo no contiene ciclos.'} />
        <CheckCard ok={impact.conflicts.length === 0} title="Bloqueos" detail={`${impact.conflicts.length} errores bloqueantes.`} />
        <CheckCard ok={impact.canApprove} title="Aprobación" detail={impact.canApprove ? 'El plan puede avanzar a aprobación.' : 'Debe resolverse el impacto antes de aprobar.'} />
      </div>
      <div className="impact-node-list">{impact.nodes.map((node) => <ImpactNodeCard key={node.id} node={node} />)}</div>
      {impact.issues.length > 0 && <div className="impact-issue-list">{impact.issues.map((issue, index) => <div className={`impact-issue ${issueClass(issue)}`} key={`${issue.code}-${issue.actionId ?? 'event'}-${index}`}><strong>{issue.severity === 'error' ? 'Error' : 'Advertencia'} · {issue.code}</strong><span className="meta">{issue.message}</span></div>)}</div>}
      <div className="derived-update-list">{impact.derivedUpdates.map((update) => <div className="impact-card" key={update}><strong>{update}</strong><span className="meta">Se recalculará o invalidará cuando el evento sea aplicado.</span></div>)}</div>
    </>
  )
}

export default function EventReviewPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo(() => createClient(), [])
  const [review, setReview] = useState<EventReviewData | null>(null)
  const [impact, setImpact] = useState<DeterministicImpactPlan | null>(null)
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

      const [reviewData, impactData] = await Promise.all([
        loadEventReview(supabase, eventId),
        loadDeterministicEventImpactPlan(supabase, eventId),
      ])
      setReview(reviewData)
      setImpact(impactData)
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar la revisión del evento.'))
    } finally {
      setLoading(false)
    }
  }

  async function reviewAction(action: EventReviewAction) {
    if (action === 'approve' && !impact?.canApprove) {
      setError('El evento no puede aprobarse hasta que el plan de impacto esté completo y sin bloqueos.')
      return
    }

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
  const canApprove = checks.can_approve && event.status === 'pending_review' && impact?.canApprove === true
  const isOrganizational = event.applies_to === 'organization_unit'

  return (
    <main className="container dashboard-page event-review-page">
      <style>{pageStyles}</style>
      <div className="detail-backlink"><Link href="/admin/eventos">← Volver a eventos</Link></div>

      <section className="dashboard-hero card review-hero">
        <div><p className="eyebrow">Revisión de evento</p><h1>{event.title}</h1><p className="lead">Revisa datos, fuente, destino y plan de impacto antes de aprobar. La aplicación es un paso posterior y explícito.</p></div>
        <div className="review-summary"><span className={`mini-badge ${event.status === 'pending_review' ? 'warning' : 'success'}`}>{statusLabel(event.status)}</span><strong>{modeLabel(event.load_mode)}</strong><span className="meta">{isOrganizational ? 'Unidad organizativa' : 'Entidad eclesiástica'} · {evidenceLabel(event.evidence_status)}</span></div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="review-layout">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Ficha</p><h2>Datos del evento</h2></div></div>
          <div className="review-grid">
            <div className="review-card"><strong>Tipo</strong><span className="meta">{event.event_type_name}</span></div><div className="review-card"><strong>Fecha</strong><span className="meta">{formatDate(event.event_date)}</span></div>
            <div className="review-card"><strong>Fecha efectiva</strong><span className="meta">{formatDate(event.effective_date)}</span></div><div className="review-card"><strong>Estado</strong><span className="meta">{statusLabel(event.status)}</span></div>
            <div className="review-card"><strong>Fuente</strong><span className="meta">{event.source_name ?? '—'}</span></div><div className="review-card"><strong>Referencia</strong><span className="meta">{event.source_url ?? '—'}</span></div>
            <div className="review-card highlight"><strong>Descripción</strong><span className="meta">{event.description ?? 'Sin descripción.'}</span></div><div className="review-card highlight"><strong>Notas</strong><span className="meta">{typeof event.notes?.notes === 'string' ? event.notes.notes : '—'}</span></div>
          </div>

          <div className="section-heading"><div><p className="eyebrow">Destinos</p><h2>{isOrganizational ? 'Unidades organizativas' : 'Entidades relacionadas'}</h2></div></div>
          <div className="participant-list">
            {review.participants.length === 0 && <div className="empty-state">{isOrganizational && event.event_type_key === 'organization_unit_creation' ? 'La unidad será creada al aplicar el evento.' : 'No hay destinos vinculados.'}</div>}
            {review.participants.map((participant) => <div className="participant-card" key={participant.id}><strong>{participantName(participant)}</strong><span className="meta">Rol: {participant.role}</span>{participant.target_kind === 'organization_unit' ? <><span className="meta">Organigrama: {participant.organization_chart_name ?? '—'}</span><span className="meta">Diócesis: {participant.scope_entity_name ?? '—'}</span></> : <span className="meta">Tipo: {participant.entity_type_name ?? '—'}</span>}</div>)}
          </div>

          <ImpactPreview impact={impact} />
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Control de revisión</p><h2>Validaciones</h2></div></div>
          <div className="check-grid">
            <CheckCard ok={checks.has_title} title="Título" detail="El evento tiene identificación legible." /><CheckCard ok={checks.has_event_type} title="Tipo" detail="El evento está clasificado." />
            <CheckCard ok={checks.has_date_or_initial_snapshot} title="Fecha" detail="Tiene fecha o es foto inicial vigente." /><CheckCard ok={checks.has_effective_date} title="Fecha efectiva" detail="Define cuándo produce efectos." />
            <CheckCard ok={checks.has_participant} title="Destino" detail={isOrganizational ? 'Tiene unidad vinculada o define una creación válida.' : 'Tiene entidad principal vinculada.'} /><CheckCard ok={checks.has_source_reference} title="Fuente" detail="Tiene fuente o referencia declarada." />
            <CheckCard ok={checks.has_verification_contract} title="Verificación" detail="La evidencia cumple el contrato común." /><CheckCard ok={impact?.canApprove === true} title="Impacto" detail="El plan determinista está completo y sin bloqueos." />
            {isOrganizational && <CheckCard ok={checks.has_action_plan} title="Plan" detail="El impacto organizativo fue generado." />}{isOrganizational && <CheckCard ok={!checks.has_blocking_action} title="Bloqueos" detail="No existen acciones fallidas ni revisión documental pendiente." />}
            <CheckCard ok={checks.is_pending_review} title="Flujo" detail="Está pendiente de revisión." />
          </div>

          <div className="impact-list"><div className="impact-card highlight"><strong>Impacto actual</strong><span className="meta">Aprobar valida el evento y deja listas sus acciones; no aplica el cambio por sí solo.</span></div><div className="impact-card"><strong>Aplicación</strong><span className="meta">La aplicación posterior deberá consumir el mismo plan determinista mostrado aquí.</span></div></div>

          <label className="meta">Nota de revisión<textarea value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} placeholder="Observación del revisor, corrección requerida o motivo de aprobación." /></label>
          <div className="button-row"><button className="button button-primary" disabled={!canApprove || saving} onClick={() => reviewAction('approve')} type="button">Aprobar</button><button className="button button-secondary" disabled={event.status !== 'pending_review' || saving} onClick={() => reviewAction('return_to_draft')} type="button">Devolver a borrador</button><button className="button button-secondary" disabled={saving || event.status === 'cancelled' || event.status === 'applied'} onClick={() => reviewAction('cancel')} type="button">Cancelar</button><Link className="button button-secondary" href={`/admin/eventos/${eventId}/plan`}>Plan de acciones</Link><Link className="button button-secondary" href={`/admin/eventos/${eventId}/contrato`}>Contrato de aplicación</Link></div>
        </aside>
      </section>
    </main>
  )
}
