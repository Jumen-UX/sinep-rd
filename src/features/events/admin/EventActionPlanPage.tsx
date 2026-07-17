'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { hasEventAdminSession } from '../services/event-draft-admin-service'
import {
  configureEventAction,
  emptyConflictPreview,
  generateEventActionPlan,
  loadEventApplicationPlan,
  loadEventRelationshipConflictPreview,
  updateEventAction,
  type ActionStatus,
  type ApplicationPlan,
  type ConflictPreview,
  type EditorOptions,
  type PlanAction,
  type RelationshipConflict,
  type RelationshipConflictAction,
} from '../services/event-application-admin-service'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

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
  if (status === 'ready' || status === 'applied') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'skipped') return 'warning'
  return ''
}

function lockReasonLabel(reason?: string | null) {
  if (!reason) return 'El evento está listo para aplicar desde el contrato.'
  if (reason === 'entity_application_not_enabled') return 'La aplicación automática jurisdiccional todavía no está habilitada.'
  if (reason === 'event_not_approved') return 'El evento debe aprobarse antes de aplicar.'
  if (reason === 'event_actions_not_ready') return 'Todas las acciones deben quedar listas y sin observaciones.'
  return reason
}

function conflictClass(conflict: RelationshipConflict) {
  return conflict.severity === 'error' ? 'error' : 'warning'
}

function isRelationalAction(action: PlanAction) {
  return ['create_relationship', 'close_relationship', 'manual_relationship_review'].includes(action.action_type_key)
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload?.[key]
  return typeof value === 'string' ? value : ''
}

function RelationshipActionEditor({ action, options, saving, onSave }: {
  action: PlanAction
  options: EditorOptions | null
  saving: boolean
  onSave: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [subjectEntityId, setSubjectEntityId] = useState(action.subject_entity_id ?? '')
  const [targetEntityId, setTargetEntityId] = useState(action.target_entity_id ?? '')
  const [relationshipTypeId, setRelationshipTypeId] = useState(action.relationship_type_id ?? '')
  const [validFrom, setValidFrom] = useState(payloadString(action.payload, 'relationship_valid_from'))
  const [validTo, setValidTo] = useState(payloadString(action.payload, 'relationship_valid_to'))
  const [relationshipNotes, setRelationshipNotes] = useState(payloadString(action.payload, 'relationship_notes'))
  const editorTitleId = `relationship-editor-${action.id}-title`

  if (!isRelationalAction(action)) return null

  return (
    <section aria-labelledby={editorTitleId} className="relationship-editor">
      <strong id={editorTitleId}>Editor relacional</strong>
      <span className="meta">Define origen, destino y tipo de relación antes de marcar la acción como lista.</span>
      <div className="editor-grid">
        <label>Entidad origen
          <select value={subjectEntityId} onChange={(event) => setSubjectEntityId(event.target.value)}>
            <option value="">Seleccionar origen</option>
            {(options?.entities ?? []).map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type_name}</option>)}
          </select>
        </label>
        <label>Entidad destino
          <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)}>
            <option value="">Seleccionar destino</option>
            {(options?.entities ?? []).map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.entity_type_name}</option>)}
          </select>
        </label>
        <label className="full-width">Tipo de relación
          <select value={relationshipTypeId} onChange={(event) => setRelationshipTypeId(event.target.value)}>
            <option value="">Seleccionar relación</option>
            {(options?.relationship_types ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}{type.is_historical ? ' · histórica' : ''}</option>)}
          </select>
        </label>
        <label>Vigente desde<input value={validFrom} onChange={(event) => setValidFrom(event.target.value)} type="date" /></label>
        <label>Vigente hasta<input value={validTo} onChange={(event) => setValidTo(event.target.value)} type="date" /></label>
        <label className="full-width">Notas de relación<textarea value={relationshipNotes} onChange={(event) => setRelationshipNotes(event.target.value)} /></label>
      </div>
      <button
        aria-busy={saving}
        className="button button-primary"
        disabled={saving}
        onClick={() => onSave({
          action_id: action.id,
          subject_entity_id: subjectEntityId || null,
          target_entity_id: targetEntityId || null,
          relationship_type_id: relationshipTypeId || null,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          relationship_notes: relationshipNotes || null,
          status: subjectEntityId && targetEntityId && relationshipTypeId ? 'ready' : 'planned',
        })}
        type="button"
      >
        Guardar configuración relacional
      </button>
    </section>
  )
}

function ConflictPanel({ conflictAction }: { conflictAction?: RelationshipConflictAction }) {
  if (!conflictAction) return null
  if (conflictAction.conflicts.length === 0) {
    return <div aria-atomic="true" aria-live="polite" className="conflict-panel clear" role="status"><strong>Sin conflictos detectados</strong><span className="meta">La relación configurada no presenta duplicados ni superposición conocida.</span></div>
  }

  return (
    <div aria-label="Conflictos relacionales" className="conflict-list">
      {conflictAction.conflicts.map((conflict) => {
        const isError = conflict.severity === 'error'
        return (
          <div
            aria-atomic="true"
            aria-live={isError ? 'assertive' : 'polite'}
            className={`conflict-panel ${conflictClass(conflict)}`}
            key={`${conflict.code}-${conflict.message}`}
            role={isError ? 'alert' : 'status'}
          >
            <strong>{isError ? 'Error' : 'Advertencia'} · {conflict.code}</strong>
            <span className="meta">{conflict.message}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function EventActionPlanPage() {
  const router = useRouter()
  const params = useParams<{ eventId: string }>()
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId
  const supabase = useMemo(() => createClient(), [])
  const [plan, setPlan] = useState<ApplicationPlan | null>(null)
  const [editorOptions, setEditorOptions] = useState<EditorOptions | null>(null)
  const [conflictPreview, setConflictPreview] = useState<ConflictPreview>(emptyConflictPreview)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshConflictPreview(currentPlan = plan) {
    const preview = await loadEventRelationshipConflictPreview(
      supabase,
      eventId,
      currentPlan?.event.applies_to,
    )
    setConflictPreview(preview)
  }

  async function loadPlan() {
    setError(null)
    setLoading(true)

    try {
      if (!await hasEventAdminSession(supabase)) {
        router.replace('/admin/login')
        return
      }

      const data = await loadEventApplicationPlan(supabase, eventId)
      setPlan(data.plan)
      setEditorOptions(data.editorOptions)
      setConflictPreview(data.conflictPreview)
    } catch (loadError) {
      setError(errorMessage(loadError, 'No se pudo cargar el plan de acciones.'))
    } finally {
      setLoading(false)
    }
  }

  async function generatePlan() {
    setSaving(true)
    setError(null)

    try {
      const nextPlan = await generateEventActionPlan(supabase, eventId)
      setPlan(nextPlan)
      await refreshConflictPreview(nextPlan)
    } catch (generateError) {
      setError(errorMessage(generateError, 'No se pudo generar el plan de acciones.'))
    } finally {
      setSaving(false)
    }
  }

  async function changeActionStatus(actionId: string, status: Exclude<ActionStatus, 'applied'>) {
    setSaving(true)
    setError(null)

    try {
      const nextPlan = await updateEventAction(supabase, actionId, status)
      setPlan(nextPlan)
      await refreshConflictPreview(nextPlan)
    } catch (updateError) {
      setError(errorMessage(updateError, 'No se pudo actualizar la acción del evento.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveActionConfiguration(payload: Record<string, unknown>) {
    setSaving(true)
    setError(null)

    try {
      const nextPlan = await configureEventAction(supabase, payload)
      setPlan(nextPlan)
      await refreshConflictPreview(nextPlan)
    } catch (configureError) {
      setError(errorMessage(configureError, 'No se pudo configurar la acción del evento.'))
    } finally {
      setSaving(false)
    }
  }

  async function reviewConflicts() {
    setError(null)
    try {
      await refreshConflictPreview()
    } catch (conflictError) {
      setError(errorMessage(conflictError, 'No se pudo revisar los conflictos relacionales.'))
    }
  }

  useEffect(() => {
    if (eventId) void loadPlan()
    // loadPlan uses the stable route id and Supabase client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (loading) return <main className="container"><div aria-live="polite" className="empty-state" role="status">Cargando plan de acciones...</div></main>
  if (!plan?.event) return <main className="container"><div className="error-box" role="alert">No se encontró el evento.</div></main>

  const summary = plan.summary
  const isOrganizational = plan.event.applies_to === 'organization_unit'
  const allReviewed = summary.action_count > 0 && summary.planned_count === 0
  const conflictFor = (actionId: string) => conflictPreview.actions.find((action) => action.action_id === actionId)

  return (
    <main aria-busy={saving} className="container dashboard-page event-action-plan-page">
      <div className="detail-backlink"><Link href={`/admin/eventos/${eventId}`}>← Volver a revisión</Link></div>

      <section className="dashboard-hero card plan-hero">
        <div>
          <p className="eyebrow">Plan de aplicación</p>
          <h1>{plan.event.title}</h1>
          <p className="lead">Traduce el evento en acciones revisables antes de modificar el estado vigente.</p>
          <div className="button-row">
            <button aria-busy={saving} className="button button-primary" disabled={!summary.can_generate_plan || saving || plan.event.status === 'applied'} onClick={generatePlan} type="button">{saving ? 'Procesando...' : 'Generar / regenerar plan'}</button>
            {!isOrganizational && <button className="button button-secondary" disabled={saving} onClick={reviewConflicts} type="button">Revisar conflictos</button>}
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}`}>Revisar evento</Link>
            <Link className="button button-secondary" href={`/admin/eventos/${eventId}/contrato`}>Contrato de aplicación</Link>
          </div>
        </div>
        <div aria-atomic="true" aria-live="polite" className="plan-summary">
          <span className="mini-badge">{statusLabel(plan.event.status)}</span>
          <strong>{modeLabel(plan.event.load_mode)}</strong>
          <span className="meta">{plan.event.event_type_name} · {formatDate(plan.event.event_date)}</span>
        </div>
      </section>

      {error && <div aria-live="assertive" className="error-box" role="alert">{error}</div>}

      <section aria-label="Métricas generales del plan" className="metric-grid">
        <div className="plan-card"><strong>{summary.action_count}</strong><span className="meta">acciones generadas</span></div>
        <div className="plan-card"><strong>{summary.state_changing_count}</strong><span className="meta">cambian estado</span></div>
        <div className="plan-card"><strong>{isOrganizational ? 0 : conflictPreview.error_count}</strong><span className="meta">errores relacionales</span></div>
        <div className="plan-card"><strong>{summary.applied_count}</strong><span className="meta">aplicadas</span></div>
      </section>

      <section aria-label="Estados de las acciones" className="status-grid">
        <div className="plan-card"><strong>{summary.planned_count}</strong><span className="meta">planificadas</span></div>
        <div className="plan-card"><strong>{summary.ready_count}</strong><span className="meta">listas</span></div>
        <div className="plan-card"><strong>{summary.skipped_count}</strong><span className="meta">omitidas</span></div>
        <div className="plan-card"><strong>{summary.failed_count}</strong><span className="meta">con observación</span></div>
      </section>

      <section className="plan-grid">
        <div className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Acciones</p><h2>Plan generado</h2><p className="meta">{isOrganizational ? 'Las acciones organizativas se habilitan al aprobar el evento.' : 'Configura relaciones y revisa conflictos antes de aprobar.'}</p></div></div>
          <div aria-busy={saving} aria-live="polite" className="actions-list">
            {plan.actions.length === 0 && <div className="empty-state" role="status">Este evento todavía no tiene plan. Usa Generar plan.</div>}
            {plan.actions.map((action) => {
              const actionTitleId = `event-action-${action.id}-title`
              return (
                <article aria-labelledby={actionTitleId} className="action-card" key={action.id}>
                  <div><p className="eyebrow">Orden {action.sort_order}</p><h3 id={actionTitleId}>{action.action_type_name}</h3><p className="meta">{action.description ?? action.notes ?? 'Sin descripción.'}</p></div>
                  <div className="badge-row">
                    <span className={`mini-badge ${statusClass(action.status)}`}>{statusLabel(action.status)}</span>
                    {action.changes_state && <span className="mini-badge warning">Cambia estado</span>}
                    {action.requires_manual_review && <span className="mini-badge warning">Revisión manual</span>}
                    {action.subject_entity_name && <span className="mini-badge">Origen: {action.subject_entity_name}</span>}
                    {action.target_entity_name && <span className="mini-badge">Destino: {action.target_entity_name}</span>}
                    {action.subject_organization_unit_name && <span className="mini-badge">Unidad: {action.subject_organization_unit_name}</span>}
                    {action.target_organization_unit_name && <span className="mini-badge">Superior: {action.target_organization_unit_name}</span>}
                    {action.relationship_type_name && <span className="mini-badge">Relación: {action.relationship_type_name}</span>}
                  </div>
                  {action.notes && <p className="meta">{action.notes}</p>}
                  {!isOrganizational && <RelationshipActionEditor action={action} options={editorOptions} saving={saving} onSave={saveActionConfiguration} />}
                  {!isOrganizational && isRelationalAction(action) && <ConflictPanel conflictAction={conflictFor(action.id)} />}
                  {!isOrganizational && action.status !== 'applied' && (
                    <div className="action-controls">
                      <strong>Revisión de acción</strong>
                      <div aria-label={`Estado de ${action.action_type_name}`} className="button-row" role="group">
                        <button aria-pressed={action.status === 'planned'} className="button button-secondary" disabled={saving || action.status === 'planned'} onClick={() => changeActionStatus(action.id, 'planned')} type="button">Planificada</button>
                        <button aria-pressed={action.status === 'ready'} className="button button-primary" disabled={saving || action.status === 'ready'} onClick={() => changeActionStatus(action.id, 'ready')} type="button">Lista</button>
                        <button aria-pressed={action.status === 'skipped'} className="button button-secondary" disabled={saving || action.status === 'skipped'} onClick={() => changeActionStatus(action.id, 'skipped')} type="button">Omitir</button>
                        <button aria-pressed={action.status === 'failed'} className="button button-secondary" disabled={saving || action.status === 'failed'} onClick={() => changeActionStatus(action.id, 'failed')} type="button">Observación</button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>

        <aside className="card dashboard-section">
          <div className="section-heading"><div><p className="eyebrow">Aplicación</p><h2>{summary.can_apply_now ? 'Lista para aplicar' : 'Condiciones pendientes'}</h2></div></div>
          <div className="plan-card highlight"><strong>{isOrganizational ? 'Contrato organizativo' : 'Contrato jurisdiccional'}</strong><span className="meta">{lockReasonLabel(summary.apply_lock_reason)}</span></div>
          {!isOrganizational && <div className="plan-card"><strong>Conflictos relacionales</strong><span className="meta">{conflictPreview.error_count} errores y {conflictPreview.warning_count} advertencias detectadas.</span></div>}
          <div className="plan-card"><strong>Revisión del plan</strong><span className="meta">{allReviewed ? 'Todas las acciones fueron revisadas.' : 'Todavía hay acciones planificadas.'}</span></div>
          <div className="plan-card"><strong>Contrato de aplicación</strong><span className="meta">Confirma permisos, estados y objetivos antes de aplicar.</span><Link className="button button-secondary" href={`/admin/eventos/${eventId}/contrato`}>Abrir contrato</Link></div>
        </aside>
      </section>
    </main>
  )
}
