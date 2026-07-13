'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadOrganizationUnitCatalogs,
  type OrganizationUnitCatalogs,
} from '@/features/organizacion/services/organization-unit-admin-service'
import {
  applyOrganizationEvent,
  createOrganizationEventDraft,
  generateOrganizationEventPlan,
  loadOrganizationEventPlan,
  loadOrganizationEventTypes,
  reviewOrganizationEvent,
  type OrganizationEventPlan,
  type OrganizationEventType,
} from '../services/organization-unit-event-service'

const emptyCatalogs: OrganizationUnitCatalogs = {
  entities: [],
  charts: [],
  pastoralAreas: [],
  units: [],
}

const statusOptions = [
  ['draft', 'Borrador'],
  ['active', 'Activa'],
  ['inactive', 'Inactiva'],
  ['archived', 'Archivada'],
] as const

const visibilityOptions = [
  ['internal', 'Interna'],
  ['public', 'Pública'],
  ['private', 'Privada'],
] as const

function eventStatusLabel(value?: string) {
  if (value === 'pending_review') return 'Pendiente de revisión'
  if (value === 'approved') return 'Aprobado'
  if (value === 'applied') return 'Aplicado'
  if (value === 'cancelled') return 'Cancelado'
  if (value === 'draft') return 'Devuelto a borrador'
  return value ?? 'Sin evento'
}

function actionStatusLabel(value: string) {
  if (value === 'ready') return 'Lista'
  if (value === 'applied') return 'Aplicada'
  if (value === 'planned') return 'Planificada'
  if (value === 'failed') return 'Fallida'
  if (value === 'skipped') return 'Omitida'
  return value
}

function defaultTitle(eventType: OrganizationEventType | undefined, unitName: string, proposedName: string) {
  const target = proposedName || unitName || 'unidad organizativa'
  return `${eventType?.name ?? 'Cambio organizativo'} — ${target}`
}

export default function OrganizationUnitEventManagerPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [catalogs, setCatalogs] = useState<OrganizationUnitCatalogs>(emptyCatalogs)
  const [eventTypes, setEventTypes] = useState<OrganizationEventType[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [eventId, setEventId] = useState('')
  const [plan, setPlan] = useState<OrganizationEventPlan | null>(null)

  const [eventTypeKey, setEventTypeKey] = useState('organization_unit_status_change')
  const [entityId, setEntityId] = useState('')
  const [chartId, setChartId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [parentUnitId, setParentUnitId] = useState('')
  const [pastoralAreaId, setPastoralAreaId] = useState('')
  const [proposedName, setProposedName] = useState('')
  const [proposedKey, setProposedKey] = useState('')
  const [newStatus, setNewStatus] = useState<'draft' | 'active' | 'inactive' | 'archived'>('active')
  const [newVisibility, setNewVisibility] = useState<'internal' | 'public' | 'private'>('public')
  const [eventDate, setEventDate] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validTo, setValidTo] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  const selectedEventType = eventTypes.find((item) => item.key === eventTypeKey)
  const filteredUnits = catalogs.units.filter((unit) => (
    unit.ecclesiastical_entity_id === entityId
    && (!chartId || unit.organization_chart_id === chartId)
  ))
  const selectedUnit = catalogs.units.find((unit) => unit.id === unitId)
  const parentOptions = filteredUnits.filter((unit) => unit.id !== unitId)
  const isCreation = eventTypeKey === 'organization_unit_creation'
  const isReparenting = eventTypeKey === 'organization_unit_reparenting'
  const isStatusChange = eventTypeKey === 'organization_unit_status_change'
  const isPublication = eventTypeKey === 'organization_unit_publication'
  const isValidityChange = eventTypeKey === 'organization_unit_validity_change'
  const computedTitle = title.trim() || defaultTitle(selectedEventType, selectedUnit?.name ?? '', proposedName.trim())

  async function reloadCatalogs() {
    const nextCatalogs = await loadOrganizationUnitCatalogs(supabase)
    setCatalogs(nextCatalogs)
    const nextEntityId = entityId
      || nextCatalogs.entities.find((item) => item.slug === 'arquidiocesis-metropolitana-de-santo-domingo')?.id
      || nextCatalogs.entities[0]?.id
      || ''
    const nextChartId = chartId
      || nextCatalogs.charts.find((item) => item.key === 'diocesan_pastoral')?.id
      || nextCatalogs.charts[0]?.id
      || ''
    setEntityId(nextEntityId)
    setChartId(nextChartId)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/admin/login')
        return
      }
      try {
        const [nextCatalogs, nextEventTypes] = await Promise.all([
          loadOrganizationUnitCatalogs(supabase),
          loadOrganizationEventTypes(supabase),
        ])
        if (cancelled) return
        setCatalogs(nextCatalogs)
        setEventTypes(nextEventTypes)
        setEntityId(
          nextCatalogs.entities.find((item) => item.slug === 'arquidiocesis-metropolitana-de-santo-domingo')?.id
          ?? nextCatalogs.entities[0]?.id
          ?? '',
        )
        setChartId(
          nextCatalogs.charts.find((item) => item.key === 'diocesan_pastoral')?.id
          ?? nextCatalogs.charts[0]?.id
          ?? '',
        )
        setEventTypeKey(nextEventTypes.find((item) => item.key === 'organization_unit_status_change')?.key ?? nextEventTypes[0]?.key ?? '')
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el asistente.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [router, supabase])

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.id === unitId)) setUnitId('')
    if (parentUnitId && !filteredUnits.some((unit) => unit.id === parentUnitId)) setParentUnitId('')
  }, [filteredUnits, parentUnitId, unitId])

  function resetWorkflow() {
    setEventId('')
    setPlan(null)
    setMessage(null)
    setError(null)
  }

  async function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!entityId || !eventTypeKey || !eventDate || !sourceName.trim()) {
      setError('Selecciona la diócesis, el tipo, la fecha y una fuente.')
      return
    }
    if (isCreation && (!chartId || !proposedName.trim())) {
      setError('Para crear una unidad debes indicar organigrama y nombre.')
      return
    }
    if (!isCreation && !unitId) {
      setError('Selecciona la unidad organizativa afectada.')
      return
    }

    const payload: Record<string, unknown> = {
      target_kind: 'organization_unit',
      event_type_key: eventTypeKey,
      scope_entity_id: entityId,
      organization_unit_id: isCreation ? null : unitId,
      organization_unit_role: isCreation ? 'created_unit' : 'affected_unit',
      load_mode: 'evento_nuevo',
      event_date: eventDate,
      effective_date: eventDate,
      title: computedTitle,
      description: description.trim() || null,
      source_name: sourceName.trim(),
      source_url: sourceUrl.trim() || null,
      evidence_status: 'confirmado_oficial',
    }

    if (isCreation) Object.assign(payload, {
      organization_chart_id: chartId,
      parent_unit_id: parentUnitId || null,
      pastoral_area_id: pastoralAreaId || null,
      name: proposedName.trim(),
      key: proposedKey.trim() || null,
      visibility: 'internal',
      status: 'draft',
      valid_from: validFrom || eventDate,
      valid_to: validTo || null,
      is_current: true,
    })
    if (isReparenting) payload.new_parent_unit_id = parentUnitId || null
    if (isStatusChange) Object.assign(payload, { new_status: newStatus, is_current: !['inactive', 'archived'].includes(newStatus) })
    if (isPublication) Object.assign(payload, { new_visibility: newVisibility, new_status: newStatus })
    if (isValidityChange) Object.assign(payload, { valid_from: validFrom || null, valid_to: validTo || null })

    setBusyAction('draft')
    try {
      const createdEventId = await createOrganizationEventDraft(supabase, payload)
      setEventId(createdEventId)
      setPlan(await loadOrganizationEventPlan(supabase, createdEventId))
      setMessage('Borrador creado. Genera el plan de impacto antes de aprobar.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo crear el evento.')
    } finally {
      setBusyAction(null)
    }
  }

  async function generatePlan() {
    if (!eventId) return
    setBusyAction('plan')
    setError(null)
    try {
      setPlan(await generateOrganizationEventPlan(supabase, eventId))
      setMessage('Plan de impacto generado. Revisa las acciones antes de aprobar.')
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'No se pudo generar el plan.')
    } finally {
      setBusyAction(null)
    }
  }

  async function approveEvent() {
    if (!eventId) return
    setBusyAction('approve')
    setError(null)
    try {
      await reviewOrganizationEvent(supabase, eventId, 'approve', reviewNote)
      setPlan(await loadOrganizationEventPlan(supabase, eventId))
      setMessage('Evento aprobado. Ya puede aplicarse si todas las acciones están listas.')
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'No se pudo aprobar el evento.')
    } finally {
      setBusyAction(null)
    }
  }

  async function applyEvent() {
    if (!eventId || !plan?.summary.can_apply_now) return
    setBusyAction('apply')
    setError(null)
    try {
      const result = await applyOrganizationEvent(supabase, eventId)
      setPlan(await loadOrganizationEventPlan(supabase, eventId))
      await reloadCatalogs()
      setMessage(`Evento aplicado. ${result.applied_action_count} acción(es) quedaron selladas.`)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'No se pudo aplicar el evento.')
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) return <div className="empty-state">Cargando eventos organizativos...</div>

  return (
    <main className="admin-organization-events-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title"><span className="admin-mini-mark">EVT</span><strong>Eventos organizativos</strong></div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin/organizacion">Volver a organización</Link>
          <Link className="button button-secondary" href="/admin/eventos">Registro de eventos</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Flujo controlado</p>
          <h1>Borrador, impacto, aprobación y aplicación</h1>
          <p className="lead">Los cambios en pastorales, curia y otras unidades funcionales se aplican únicamente mediante eventos aprobados y auditados.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Fuente obligatoria</span>
            <span className="role-pill">Plan transaccional</span>
            <span className="role-pill">Historial inmutable</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">◷</div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Definición</p><h2>Preparar cambio organizativo</h2></div><span className="meta">{eventStatusLabel(plan?.event.status)}</span></div>
        <form className="admin-form admin-config-form" onSubmit={handleCreateDraft}>
          <label>Tipo de evento
            <select disabled={Boolean(eventId)} value={eventTypeKey} onChange={(event) => { setEventTypeKey(event.target.value); resetWorkflow() }}>
              {eventTypes.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </label>
          <label>Diócesis
            <select disabled={Boolean(eventId)} value={entityId} onChange={(event) => { setEntityId(event.target.value); setUnitId(''); resetWorkflow() }}>
              <option value="">Seleccionar diócesis</option>
              {catalogs.entities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Organigrama
            <select disabled={Boolean(eventId)} value={chartId} onChange={(event) => { setChartId(event.target.value); setUnitId(''); resetWorkflow() }}>
              <option value="">Seleccionar organigrama</option>
              {catalogs.charts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          {!isCreation && <label>Unidad afectada
            <select disabled={Boolean(eventId)} value={unitId} onChange={(event) => { setUnitId(event.target.value); resetWorkflow() }}>
              <option value="">Seleccionar unidad</option>
              {filteredUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}

          {(isCreation || isReparenting) && <label>{isCreation ? 'Unidad superior inicial' : 'Nueva unidad superior'}
            <select disabled={Boolean(eventId)} value={parentUnitId} onChange={(event) => setParentUnitId(event.target.value)}>
              <option value="">Sin superior / unidad raíz</option>
              {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}

          {isCreation && <>
            <label>Nombre de la nueva unidad<input disabled={Boolean(eventId)} value={proposedName} onChange={(event) => setProposedName(event.target.value)} /></label>
            <label>Clave opcional<input disabled={Boolean(eventId)} value={proposedKey} onChange={(event) => setProposedKey(event.target.value)} /></label>
            <label>Área pastoral
              <select disabled={Boolean(eventId)} value={pastoralAreaId} onChange={(event) => setPastoralAreaId(event.target.value)}>
                <option value="">Sin área pastoral</option>
                {catalogs.pastoralAreas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </>}

          {(isStatusChange || isPublication) && <label>Nuevo estado
            <select disabled={Boolean(eventId)} value={newStatus} onChange={(event) => setNewStatus(event.target.value as typeof newStatus)}>
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          {isPublication && <label>Nueva visibilidad
            <select disabled={Boolean(eventId)} value={newVisibility} onChange={(event) => setNewVisibility(event.target.value as typeof newVisibility)}>
              {visibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          {(isCreation || isValidityChange) && <>
            <label>Vigente desde<input disabled={Boolean(eventId)} type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} /></label>
            <label>Vigente hasta<input disabled={Boolean(eventId)} type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} /></label>
          </>}

          <label>Fecha del evento<input disabled={Boolean(eventId)} required type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
          <label>Título<input disabled={Boolean(eventId)} placeholder={computedTitle} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Fuente<input disabled={Boolean(eventId)} required value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></label>
          <label>URL de fuente<input disabled={Boolean(eventId)} value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
          <label className="full-width">Descripción<textarea disabled={Boolean(eventId)} value={description} onChange={(event) => setDescription(event.target.value)} /></label>

          {!eventId
            ? <button className="button button-primary" disabled={Boolean(busyAction)}>{busyAction === 'draft' ? 'Guardando…' : 'Crear borrador'}</button>
            : <button className="button button-secondary" onClick={() => resetWorkflow()} type="button">Preparar otro evento</button>}
        </form>
      </section>

      {eventId && <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Flujo operativo</p><h2>{plan?.event.title ?? computedTitle}</h2></div><span className="meta">ID {eventId.slice(0, 8)}</span></div>
        <div className="admin-stat-strip" aria-label="Estado del plan">
          <a href="#event-actions"><span>▥</span><strong>{plan?.summary.action_count ?? 0}</strong><small>Acciones</small></a>
          <a href="#event-actions"><span>◷</span><strong>{plan?.summary.planned_count ?? 0}</strong><small>Planificadas</small></a>
          <a href="#event-actions"><span>✓</span><strong>{plan?.summary.ready_count ?? 0}</strong><small>Listas</small></a>
          <a href="#event-actions"><span>●</span><strong>{plan?.summary.applied_count ?? 0}</strong><small>Aplicadas</small></a>
        </div>

        <div className="button-row">
          <button className="button button-secondary" disabled={Boolean(busyAction) || plan?.event.status === 'applied'} onClick={generatePlan} type="button">{busyAction === 'plan' ? 'Generando…' : 'Generar plan'}</button>
          <input aria-label="Nota de revisión" placeholder="Nota de revisión opcional" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
          <button className="button button-secondary" disabled={Boolean(busyAction) || !plan || plan.event.status !== 'pending_review' || plan.summary.action_count === 0} onClick={approveEvent} type="button">{busyAction === 'approve' ? 'Aprobando…' : 'Aprobar'}</button>
          <button className="button button-primary" disabled={Boolean(busyAction) || !plan?.summary.can_apply_now} onClick={applyEvent} type="button">{busyAction === 'apply' ? 'Aplicando…' : 'Aplicar evento'}</button>
        </div>
        {plan?.summary.apply_lock_reason && <p className="meta">Bloqueo de aplicación: {plan.summary.apply_lock_reason}</p>}

        <div className="table-wrap" id="event-actions">
          <table className="data-table dashboard-list-table">
            <thead><tr><th>Orden</th><th>Acción</th><th>Unidad</th><th>Destino</th><th>Estado</th><th>Notas</th></tr></thead>
            <tbody>
              {(plan?.actions ?? []).map((action) => (
                <tr key={action.id}>
                  <td>{action.sort_order}</td>
                  <td><strong>{action.action_type_name}</strong><br /><span className="meta">{action.description}</span></td>
                  <td>{action.subject_organization_unit_name ?? '—'}</td>
                  <td>{action.target_organization_unit_name ?? '—'}</td>
                  <td>{actionStatusLabel(action.status)}</td>
                  <td>{action.notes ?? '—'}</td>
                </tr>
              ))}
              {(plan?.actions.length ?? 0) === 0 && <tr><td colSpan={6}>Genera el plan para ver el impacto.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </main>
  )
}
