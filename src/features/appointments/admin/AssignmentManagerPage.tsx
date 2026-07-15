'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StructureEntityPicker from '@/components/admin/StructureEntityPicker'
import { createClient } from '@/lib/supabase/client'
import { AssignmentImpactPreview } from './AssignmentImpactPreview'
import {
  checkAssignmentEligibility,
  loadAllowedOfficeIds,
  loadAssignmentCatalogs,
  saveAssignment,
  type AssignmentCatalogs,
  type AssignmentEligibility,
  type AssignmentOfficeConfiguration,
  type AssignmentPerson,
} from '../services/assignment-admin-service'

const statusOptions = [
  ['active', 'Activo'],
  ['term_expired_still_serving', 'Período vencido, continúa en funciones'],
  ['renewed', 'Renovado'],
  ['replaced', 'Sustituido'],
  ['vacant', 'Vacante'],
  ['suspended', 'Suspendido'],
  ['ended', 'Finalizado'],
] as const

const selectionOptions = [
  ['appointment', 'Nombramiento'],
  ['election', 'Elección'],
  ['confirmation', 'Confirmación'],
  ['ex_officio', 'Ex officio'],
  ['other', 'Otro'],
] as const

const visibilityOptions = [
  ['public', 'Pública'],
  ['internal', 'Interna'],
  ['private', 'Privada / confidencial'],
] as const

const publicationStatusOptions = [
  ['published', 'Publicada'],
  ['scheduled', 'Programada'],
  ['internal', 'Interna'],
  ['private', 'Privada'],
  ['draft', 'Borrador'],
] as const

const emptyCatalogs: AssignmentCatalogs = {
  people: [],
  configs: [],
  charts: [],
  units: [],
  assignments: [],
  rawAssignments: [],
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text.length > 0 ? text : null
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00`)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function degreeLabel(value: string | null | undefined) {
  if (value === 'episcopate') return 'Episcopado'
  if (value === 'presbyterate') return 'Presbiterado'
  if (value === 'diaconate') return 'Diaconado'
  if (value === 'none') return 'Sin grado mínimo'
  return 'Sin ordenación'
}

function personLabel(person: AssignmentPerson) {
  return `${person.display_name} · ${degreeLabel(person.highest_ordination_degree)}`
}

function cardinalityLabel(config: AssignmentOfficeConfiguration | undefined) {
  if (!config) return 'Selecciona un cargo para ver sus reglas.'
  if (config.holder_cardinality === 'single') {
    return 'Titular único: el nombramiento nuevo sustituirá automáticamente al titular vigente del mismo ámbito.'
  }
  return config.max_current_holders
    ? `Cargo múltiple: admite hasta ${config.max_current_holders} titulares vigentes.`
    : 'Cargo múltiple: admite varios titulares vigentes sin cerrar a los demás.'
}

function sameScopeValue(current: string | null, selected: string) {
  return current === (selected || null)
}

export default function AssignmentManagerPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [catalogs, setCatalogs] = useState<AssignmentCatalogs>(emptyCatalogs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [eligibility, setEligibility] = useState<AssignmentEligibility | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [levelOfficeConfigIds, setLevelOfficeConfigIds] = useState<string[]>([])
  const [levelFilterMessage, setLevelFilterMessage] = useState('Selecciona una entidad para filtrar cargos por nivel estructural.')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [selectedChartId, setSelectedChartId] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [selectedStartDate, setSelectedStartDate] = useState('')
  const [selectedPredecessorId, setSelectedPredecessorId] = useState('')
  const [closePreviousCurrent, setClosePreviousCurrent] = useState(false)
  const [assignmentStatus, setAssignmentStatus] = useState('active')

  const selectedConfig = catalogs.configs.find((item) => item.id === selectedConfigId)
  const selectedPerson = catalogs.people.find((item) => item.id === selectedPersonId)
  const filteredConfigs = selectedChartId
    ? catalogs.configs.filter((config) => config.organization_chart_id === selectedChartId)
    : selectedEntityId && levelOfficeConfigIds.length > 0
      ? catalogs.configs.filter((config) => levelOfficeConfigIds.includes(config.id))
      : catalogs.configs
  const filteredUnits = catalogs.units.filter((unit) => (
    (!selectedChartId || unit.organization_chart_id === selectedChartId)
    && (!selectedEntityId || unit.ecclesiastical_entity_id === selectedEntityId)
  ))
  const defaultTermEnd = selectedConfig?.default_term_months && selectedStartDate
    ? addMonths(selectedStartDate, selectedConfig.default_term_months)
    : ''
  const requiresPerson = assignmentStatus !== 'vacant'

  const currentScopeAssignments = catalogs.rawAssignments.filter((assignment) => (
    assignment.record_status === 'active'
    && assignment.is_current
    && assignment.office_configuration_id === selectedConfigId
    && sameScopeValue(assignment.organization_chart_id, selectedChartId)
    && sameScopeValue(assignment.organization_unit_id, selectedUnitId)
    && sameScopeValue(assignment.ecclesiastical_entity_id, selectedEntityId)
  ))
  const assignmentsToClose = selectedConfig?.holder_cardinality === 'single'
    ? currentScopeAssignments
    : closePreviousCurrent
      ? currentScopeAssignments.filter((assignment) => assignment.person_id === selectedPersonId)
      : []
  const projectedCurrentCount = assignmentStatus === 'vacant'
    ? currentScopeAssignments.length - assignmentsToClose.length
    : currentScopeAssignments.length - assignmentsToClose.length + 1
  const exceedsCapacity = selectedConfig?.holder_cardinality === 'multiple'
    && selectedConfig.max_current_holders !== null
    && projectedCurrentCount > selectedConfig.max_current_holders
  const canSubmit = !saving
    && !checkingEligibility
    && Boolean(selectedConfigId)
    && (!requiresPerson || Boolean(selectedPersonId && eligibility?.eligible))
    && !exceedsCapacity

  const assignmentOptions = catalogs.rawAssignments
    .filter((assignment) => assignment.record_status === 'active')
    .filter((assignment) => !selectedConfigId || assignment.office_configuration_id === selectedConfigId)
    .filter((assignment) => !selectedEntityId || assignment.ecclesiastical_entity_id === selectedEntityId)
    .map((assignment) => {
      const person = catalogs.people.find((item) => item.id === assignment.person_id)
      const config = catalogs.configs.find((item) => item.id === assignment.office_configuration_id)
      return {
        id: assignment.id,
        label: `${person?.display_name ?? 'Vacante'} — ${assignment.title_override ?? config?.display_name ?? 'Cargo'}`,
      }
    })

  async function loadData() {
    setError(null)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    try {
      setCatalogs(await loadAssignmentCatalogs(supabase))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los nombramientos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedEntity = params.get('entity') ?? params.get('entity_id')
    const requestedPerson = params.get('person') ?? params.get('person_id')
    if (requestedEntity) {
      setSelectedEntityId(requestedEntity)
      setLevelFilterMessage('Entidad cargada desde una alerta. Verifica el cargo y completa el nombramiento.')
    }
    if (requestedPerson) setSelectedPersonId(requestedPerson)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadLevelRules() {
      setLevelOfficeConfigIds([])
      if (!selectedEntityId) {
        setLevelFilterMessage('Selecciona una entidad para filtrar cargos por nivel estructural.')
        return
      }

      try {
        const ids = await loadAllowedOfficeIds(supabase, selectedEntityId)
        if (cancelled) return
        setLevelOfficeConfigIds(ids)
        setLevelFilterMessage(ids.length > 0
          ? 'Cargos filtrados por el nivel estructural seleccionado.'
          : 'Este nivel no tiene cargos configurados todavía. Selecciona un organigrama para aplicar sus cargos compatibles.')
      } catch (loadError) {
        if (!cancelled) setLevelFilterMessage(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los cargos permitidos.')
      }
    }

    void loadLevelRules()
    return () => { cancelled = true }
  }, [selectedEntityId, supabase])

  useEffect(() => {
    if (selectedConfigId && !filteredConfigs.some((config) => config.id === selectedConfigId)) {
      setSelectedConfigId('')
    }
  }, [filteredConfigs, selectedConfigId])

  useEffect(() => {
    if (selectedUnitId && !filteredUnits.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId('')
    }
  }, [filteredUnits, selectedUnitId])

  useEffect(() => {
    if (selectedPredecessorId && !currentScopeAssignments.some((assignment) => assignment.id === selectedPredecessorId)) {
      setSelectedPredecessorId('')
    }
  }, [currentScopeAssignments, selectedPredecessorId])

  useEffect(() => {
    let cancelled = false

    async function validateSelection() {
      setEligibility(null)
      if (!requiresPerson || !selectedPersonId || !selectedConfigId) return
      setCheckingEligibility(true)

      try {
        const result = await checkAssignmentEligibility(
          supabase,
          selectedPersonId,
          selectedConfigId,
          selectedEntityId || null,
        )
        if (!cancelled) setEligibility(result)
      } catch (eligibilityError) {
        if (!cancelled) {
          setEligibility({
            eligible: false,
            reason_code: 'eligibility_check_failed',
            message: eligibilityError instanceof Error ? eligibilityError.message : 'No se pudo comprobar la elegibilidad.',
          })
        }
      } finally {
        if (!cancelled) setCheckingEligibility(false)
      }
    }

    void validateSelection()
    return () => { cancelled = true }
  }, [requiresPerson, selectedPersonId, selectedConfigId, selectedEntityId, supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedConfigId) {
      setError('Debes seleccionar un cargo configurado.')
      return
    }
    if (requiresPerson && !selectedPersonId) {
      setError('Debes seleccionar una persona, excepto cuando el estado sea Vacante.')
      return
    }
    if (requiresPerson && !eligibility?.eligible) {
      setError(eligibility?.message ?? 'La persona seleccionada no cumple las condiciones del cargo.')
      return
    }
    if (exceedsCapacity) {
      setError('La operación excedería la cantidad máxima de titulares vigentes para este cargo.')
      return
    }

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setSaving(true)
    setError(null)
    setMessage(null)

    const payload = {
      person_id: requiresPerson ? selectedPersonId : null,
      office_configuration_id: selectedConfigId,
      organization_chart_id: selectedChartId || null,
      organization_unit_id: selectedUnitId || null,
      ecclesiastical_entity_id: selectedEntityId || null,
      title_override: emptyToNull(form.get('title_override')),
      start_date: emptyToNull(form.get('start_date')),
      term_start_date: emptyToNull(form.get('term_start_date')),
      term_end_date: emptyToNull(form.get('term_end_date')),
      actual_end_date: emptyToNull(form.get('actual_end_date')),
      effective_date: emptyToNull(form.get('effective_date')),
      public_from: emptyToNull(form.get('public_from')),
      public_until: emptyToNull(form.get('public_until')),
      confidential_until: emptyToNull(form.get('confidential_until')),
      publication_status: String(form.get('publication_status') ?? 'published'),
      assignment_status: assignmentStatus,
      selection_method: String(form.get('selection_method') ?? 'appointment'),
      predecessor_assignment_id: selectedPredecessorId || null,
      successor_assignment_id: emptyToNull(form.get('successor_assignment_id')),
      notes_public: emptyToNull(form.get('notes_public')),
      notes_internal: emptyToNull(form.get('notes_internal')),
      source_name: emptyToNull(form.get('source_name')),
      source_url: emptyToNull(form.get('source_url')),
      source_checked_at: emptyToNull(form.get('source_checked_at')),
      close_previous_current: selectedConfig?.holder_cardinality === 'multiple' && closePreviousCurrent,
      verification_status: 'pending_review',
      visibility: String(form.get('visibility') ?? 'public'),
    }

    try {
      const result = await saveAssignment(payload)
      const closed = result.closed_previous_current_count ?? 0
      setMessage(closed > 0
        ? `Asignación guardada. Se cerraron ${closed} nombramiento(s) anterior(es).`
        : 'Asignación guardada sin cerrar a otros titulares vigentes.')
      formElement.reset()
      setSelectedPersonId('')
      setSelectedConfigId('')
      setSelectedChartId('')
      setSelectedUnitId('')
      setSelectedEntityId('')
      setSelectedStartDate('')
      setSelectedPredecessorId('')
      setClosePreviousCurrent(false)
      setAssignmentStatus('active')
      setEligibility(null)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la asignación.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="empty-state">Cargando asignaciones...</div>

  return (
    <main className="admin-assignments-page" id="top">
      <header className="admin-top-header">
        <div className="admin-top-title"><span className="admin-mini-mark">CARGOS</span><strong>Asignaciones de cargos</strong></div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin">Volver al panel</Link>
          <Link className="button button-secondary" href="/admin/configuracion">Configurar cargos</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Nombramientos</p>
          <h1>Cargos, elegibilidad y sucesión</h1>
          <p className="lead">El sistema valida el grado del Orden, el estado canónico, la función episcopal y la cantidad de titulares permitida antes de registrar el nombramiento.</p>
          <div className="role-list admin-role-list">
            <span className="role-pill">Identidad única</span>
            <span className="role-pill">Elegibilidad canónica</span>
            <span className="role-pill">Cardinalidad configurable</span>
          </div>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">▣</div>
      </section>

      <section className="admin-stat-strip" aria-label="Resumen de asignaciones">
        <a href="#assignment-form"><span>◉</span><strong>{catalogs.people.length}</strong><small>Personas disponibles</small></a>
        <a href="#assignment-form"><span>▣</span><strong>{catalogs.configs.length}</strong><small>Cargos configurados</small></a>
        <a href="#assignment-form"><span>▥</span><strong>{catalogs.charts.length}</strong><small>Organigramas activos</small></a>
        <a href="#assignment-list"><span>◷</span><strong>{catalogs.assignments.length}</strong><small>Asignaciones recientes</small></a>
        <a href="#assignment-form"><span>＋</span><strong>Nuevo</strong><small>Registrar asignación</small></a>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="card dashboard-section" id="assignment-form">
        <div className="section-heading"><div><p className="eyebrow">Nueva asignación</p><h2>Persona, cargo, ámbito y período</h2></div></div>

        <form className="admin-form admin-config-form" onSubmit={handleSubmit}>
          <select
            value={selectedConfigId}
            onChange={(event) => {
              const configId = event.target.value
              setSelectedConfigId(configId)
              setSelectedPredecessorId('')
              setClosePreviousCurrent(false)
              const chartId = catalogs.configs.find((config) => config.id === configId)?.organization_chart_id
              if (chartId) setSelectedChartId(chartId)
            }}
          >
            <option value="">Cargo configurado</option>
            {filteredConfigs.map((config) => <option key={config.id} value={config.id}>{config.display_name}</option>)}
          </select>
          <p className="meta">{selectedChartId ? 'Cargos filtrados por el organigrama seleccionado.' : levelFilterMessage}</p>

          {selectedConfig && (
            <div className="empty-state">
              <strong>{selectedConfig.display_name}</strong>
              <span>Grado mínimo: {degreeLabel(selectedConfig.required_ordination_degree)}.</span>
              <span>{cardinalityLabel(selectedConfig)}</span>
              {selectedConfig.allowed_episcopal_role_types.length > 0 && <span>Función episcopal requerida: {selectedConfig.allowed_episcopal_role_types.join(', ')}.</span>}
            </div>
          )}

          <select value={assignmentStatus} onChange={(event) => setAssignmentStatus(event.target.value)}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          {requiresPerson && (
            <>
              <select value={selectedPersonId} onChange={(event) => setSelectedPersonId(event.target.value)}>
                <option value="">Persona</option>
                {catalogs.people.map((person) => <option key={person.id} value={person.id}>{personLabel(person)}</option>)}
              </select>
              <div className={`empty-state ${eligibility && !eligibility.eligible ? 'error-box' : ''}`}>
                <strong>{checkingEligibility ? 'Comprobando elegibilidad…' : selectedPerson?.display_name ?? 'Selecciona una persona'}</strong>
                <span>{checkingEligibility
                  ? 'Validando ordenación, estado canónico y función vigente.'
                  : eligibility?.message ?? 'La comprobación se ejecutará al seleccionar persona y cargo.'}</span>
              </div>
            </>
          )}

          <input name="title_override" placeholder="Título visible opcional" />

          <select
            name="organization_chart_id"
            value={selectedChartId}
            onChange={(event) => {
              setSelectedChartId(event.target.value)
              setSelectedUnitId('')
              setSelectedPredecessorId('')
            }}
          >
            <option value="">Organigrama</option>
            {catalogs.charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
          </select>

          <select
            name="organization_unit_id"
            value={selectedUnitId}
            onChange={(event) => {
              setSelectedUnitId(event.target.value)
              setSelectedPredecessorId('')
            }}
          >
            <option value="">Unidad organizativa</option>
            {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
          <p className="meta">Las unidades se limitan al organigrama y a la entidad eclesiástica seleccionados.</p>

          <StructureEntityPicker
            emptyLabel={selectedEntityId ? 'Entidad seleccionada' : 'Sin entidad eclesiástica seleccionada'}
            help="Selecciona la entidad del nombramiento. También se utiliza para validar la función episcopal, la cardinalidad y las unidades disponibles."
            label="Entidad eclesiástica"
            name="ecclesiastical_entity_id"
            value={selectedEntityId}
            onChange={(entityId) => {
              setSelectedEntityId(entityId)
              setSelectedUnitId('')
              setSelectedPredecessorId('')
            }}
          />

          <label>Fecha de inicio<input name="start_date" type="date" value={selectedStartDate} onChange={(event) => setSelectedStartDate(event.target.value)} /></label>
          <label>Inicio del período<input name="term_start_date" type="date" /></label>
          <label>Fin previsto<input name="term_end_date" type="date" defaultValue={defaultTermEnd} /></label>
          <label>Fin real<input name="actual_end_date" type="date" /></label>
          <label>Fecha efectiva<input name="effective_date" type="date" /></label>
          <label>Visible desde<input name="public_from" type="date" /></label>
          <label>Visible hasta<input name="public_until" type="date" /></label>
          <label>Confidencial hasta<input name="confidential_until" type="date" /></label>

          <select name="visibility" defaultValue="public">
            {visibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="publication_status" defaultValue="published">
            {publicationStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select name="selection_method" defaultValue="appointment">
            {selectionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <select
            name="predecessor_assignment_id"
            value={selectedPredecessorId}
            onChange={(event) => setSelectedPredecessorId(event.target.value)}
          >
            <option value="">Predecesor del mismo cargo y ámbito</option>
            {currentScopeAssignments.map((assignment) => {
              const person = catalogs.people.find((candidate) => candidate.id === assignment.person_id)
              return <option key={assignment.id} value={assignment.id}>{person?.display_name ?? 'Vacante'} — {selectedConfig?.display_name ?? 'Cargo'}</option>
            })}
          </select>
          <select name="successor_assignment_id" defaultValue="">
            <option value="">Sucesor del mismo cargo y ámbito</option>
            {assignmentOptions.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}
          </select>

          {selectedConfig?.holder_cardinality === 'single' && <p className="meta">El titular anterior se cerrará automáticamente; la vista previa muestra exactamente cuáles registros serán afectados.</p>}
          {selectedConfig?.holder_cardinality === 'multiple' && (
            <label className="role-pill">
              <input
                name="close_previous_current"
                type="checkbox"
                checked={closePreviousCurrent}
                onChange={(event) => setClosePreviousCurrent(event.target.checked)}
              />
              Cerrar únicamente la asignación vigente de esta misma persona
            </label>
          )}

          <AssignmentImpactPreview
            config={selectedConfig}
            person={selectedPerson}
            currentAssignments={currentScopeAssignments}
            startDate={selectedStartDate}
            assignmentStatus={assignmentStatus}
            predecessorAssignmentId={selectedPredecessorId}
            closePreviousCurrent={closePreviousCurrent}
            people={catalogs.people}
          />

          <input name="source_name" placeholder="Fuente del nombramiento" />
          <input name="source_url" placeholder="URL de fuente" />
          <label>Fecha de revisión de fuente<input name="source_checked_at" type="date" /></label>
          <textarea name="notes_public" placeholder="Notas públicas" />
          <textarea name="notes_internal" placeholder="Notas internas" />

          <button className="button button-primary" disabled={!canSubmit}>
            {saving ? 'Guardando…' : checkingEligibility ? 'Validando…' : exceedsCapacity ? 'Capacidad excedida' : 'Guardar asignación'}
          </button>
        </form>
      </section>

      <section className="card dashboard-section" id="assignment-list">
        <div className="section-heading"><div><p className="eyebrow">Listado</p><h2>Asignaciones recientes visibles públicamente</h2></div><span className="meta">{catalogs.assignments.length} registros</span></div>
        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead><tr><th>Persona</th><th>Cargo</th><th>Organigrama</th><th>Unidad o entidad</th><th>Ruta</th><th>Período</th><th>Estado</th><th>Predecesor</th><th>Sucesor</th></tr></thead>
            <tbody>
              {catalogs.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.person_slug ? <Link href={`/personas/${assignment.person_slug}`}>{assignment.person_name}</Link> : assignment.person_name ?? 'Vacante'}</td>
                  <td><strong>{assignment.position_title ?? 'Cargo'}</strong></td>
                  <td>{assignment.organization_chart_name ?? '—'}</td>
                  <td>{assignment.organization_unit_name ?? assignment.direct_entity_name ?? '—'}</td>
                  <td>{assignment.hierarchy_path ?? '—'}</td>
                  <td>{formatDate(assignment.term_start_date ?? assignment.start_date)} – {assignment.actual_end_date ? formatDate(assignment.actual_end_date) : assignment.term_end_date ? formatDate(assignment.term_end_date) : 'actual'}</td>
                  <td>{statusOptions.find(([value]) => value === assignment.assignment_status)?.[1] ?? assignment.assignment_status ?? '—'}</td>
                  <td>{assignment.predecessor_person_name ?? '—'}</td>
                  <td>{assignment.successor_person_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
