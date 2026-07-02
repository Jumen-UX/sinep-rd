'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
}

type OfficeConfiguration = {
  id: string
  key: string
  display_name: string
  organization_chart_id: string | null
  default_term_months: number | null
  continues_until_replaced: boolean
}

type Chart = {
  id: string
  key: string
  name: string
}

type Unit = {
  id: string
  name: string
  organization_chart_id: string
}

type Entity = {
  id: string
  name: string
  slug: string
  entity_type_id: string | null
}

type PastoralEntity = {
  id: string
  name: string
  slug: string
}

type AssignmentRow = {
  id: string
  person_name: string | null
  person_slug: string | null
  position_title: string | null
  organization_chart_name: string | null
  ecclesiastical_entity_name: string | null
  pastoral_entity_name: string | null
  predecessor_person_name: string | null
  successor_person_name: string | null
  start_date: string | null
  term_start_date: string | null
  term_end_date: string | null
  actual_end_date: string | null
  assignment_status: string | null
}

type RawAssignment = {
  id: string
  person_id: string | null
  office_configuration_id: string
  title_override: string | null
}

const statusOptions = [
  ['active', 'Activo'],
  ['term_expired_still_serving', 'Período vencido, continúa en funciones'],
  ['renewed', 'Renovado'],
  ['replaced', 'Sustituido'],
  ['vacant', 'Vacante'],
  ['suspended', 'Suspendido'],
  ['ended', 'Finalizado'],
]

const selectionOptions = [
  ['appointment', 'Nombramiento'],
  ['election', 'Elección'],
  ['confirmation', 'Confirmación'],
  ['ex_officio', 'Ex officio'],
  ['other', 'Otro'],
]

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
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

export default function AdminAsignacionesPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [people, setPeople] = useState<Person[]>([])
  const [configs, setConfigs] = useState<OfficeConfiguration[]>([])
  const [charts, setCharts] = useState<Chart[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [pastoralEntities, setPastoralEntities] = useState<PastoralEntity[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [rawAssignments, setRawAssignments] = useState<RawAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [selectedStartDate, setSelectedStartDate] = useState('')
  const [selectedChartId, setSelectedChartId] = useState('')

  const selectedConfig = configs.find((item) => item.id === selectedConfigId)
  const defaultTermEnd = selectedConfig?.default_term_months && selectedStartDate
    ? addMonths(selectedStartDate, selectedConfig.default_term_months)
    : ''

  async function loadData() {
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [peopleRes, configRes, chartRes, unitRes, entityRes, pastoralRes, assignmentRes, rawAssignmentRes] = await Promise.all([
      supabase.from('persons').select('id,display_name,slug,person_type').eq('status', 'active').order('display_name'),
      supabase.from('office_configurations').select('id,key,display_name,organization_chart_id,default_term_months,continues_until_replaced').eq('status', 'active').order('display_name'),
      supabase.from('organization_charts').select('id,key,name').eq('status', 'active').order('sort_order'),
      supabase.from('organization_units').select('id,name,organization_chart_id').eq('status', 'active').order('name'),
      supabase.from('ecclesiastical_entities').select('id,name,slug,entity_type_id').eq('status', 'active').order('name'),
      supabase.from('pastoral_entities').select('id,name,slug').eq('status', 'active').order('name'),
      supabase.from('public_position_assignments').select('id,person_name,person_slug,position_title,organization_chart_name,ecclesiastical_entity_name,pastoral_entity_name,predecessor_person_name,successor_person_name,start_date,term_start_date,term_end_date,actual_end_date,assignment_status').order('start_date', { ascending: false, nullsFirst: false }).limit(100),
      supabase.from('position_assignments').select('id,person_id,office_configuration_id,title_override').order('created_at', { ascending: false }).limit(300),
    ])

    const failed = [peopleRes, configRes, chartRes, unitRes, entityRes, pastoralRes, assignmentRes, rawAssignmentRes].find((item) => item.error)
    if (failed?.error) {
      setError(failed.error.message)
    } else {
      setPeople((peopleRes.data ?? []) as Person[])
      setConfigs((configRes.data ?? []) as OfficeConfiguration[])
      setCharts((chartRes.data ?? []) as Chart[])
      setUnits((unitRes.data ?? []) as Unit[])
      setEntities((entityRes.data ?? []) as Entity[])
      setPastoralEntities((pastoralRes.data ?? []) as PastoralEntity[])
      setAssignments((assignmentRes.data ?? []) as AssignmentRow[])
      setRawAssignments((rawAssignmentRes.data ?? []) as RawAssignment[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)

    const form = new FormData(event.currentTarget)
    const officeConfigurationId = String(form.get('office_configuration_id') ?? '')
    const personId = emptyToNull(form.get('person_id'))
    const organizationChartId = emptyToNull(form.get('organization_chart_id'))
    const organizationUnitId = emptyToNull(form.get('organization_unit_id'))
    const ecclesiasticalEntityId = emptyToNull(form.get('ecclesiastical_entity_id'))
    const pastoralEntityId = emptyToNull(form.get('pastoral_entity_id'))
    const predecessorAssignmentId = emptyToNull(form.get('predecessor_assignment_id'))
    const successorAssignmentId = emptyToNull(form.get('successor_assignment_id'))
    const startDate = emptyToNull(form.get('start_date'))
    const termStartDate = emptyToNull(form.get('term_start_date')) || startDate
    const termEndDate = emptyToNull(form.get('term_end_date'))
    const actualEndDate = emptyToNull(form.get('actual_end_date'))

    if (!officeConfigurationId) {
      setError('Debes seleccionar un cargo configurado.')
      setSaving(false)
      return
    }

    if (!personId && String(form.get('assignment_status') ?? '') !== 'vacant') {
      setError('Debes seleccionar una persona, excepto cuando el estado sea Vacante.')
      setSaving(false)
      return
    }

    const { data: saved, error: saveError } = await supabase
      .from('position_assignments')
      .insert({
        person_id: personId,
        office_configuration_id: officeConfigurationId,
        organization_chart_id: organizationChartId,
        organization_unit_id: organizationUnitId,
        ecclesiastical_entity_id: ecclesiasticalEntityId,
        pastoral_entity_id: pastoralEntityId,
        title_override: emptyToNull(form.get('title_override')),
        start_date: startDate,
        term_start_date: termStartDate,
        term_end_date: termEndDate,
        actual_end_date: actualEndDate,
        is_current: !actualEndDate,
        assignment_status: String(form.get('assignment_status') ?? 'active'),
        selection_method: String(form.get('selection_method') ?? 'appointment'),
        predecessor_assignment_id: predecessorAssignmentId,
        successor_assignment_id: successorAssignmentId,
        notes_public: emptyToNull(form.get('notes_public')),
        verification_status: 'pending_review',
        visibility: 'public',
        record_status: 'active',
      })
      .select('id')
      .single()

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    if (saved?.id && predecessorAssignmentId) {
      await supabase.from('position_assignments').update({ successor_assignment_id: saved.id, replaced_by_assignment_id: saved.id }).eq('id', predecessorAssignmentId)
    }

    if (saved?.id && successorAssignmentId) {
      await supabase.from('position_assignments').update({ predecessor_assignment_id: saved.id }).eq('id', successorAssignmentId)
    }

    setMessage('Asignación guardada correctamente.')
    event.currentTarget.reset()
    setSelectedConfigId('')
    setSelectedStartDate('')
    setSelectedChartId('')
    await loadData()
    setSaving(false)
  }

  const filteredUnits = selectedChartId
    ? units.filter((unit) => unit.organization_chart_id === selectedChartId)
    : units

  const assignmentOptions = rawAssignments.map((assignment) => {
    const person = people.find((item) => item.id === assignment.person_id)
    const config = configs.find((item) => item.id === assignment.office_configuration_id)
    return {
      id: assignment.id,
      label: `${person?.display_name ?? 'Vacante'} — ${assignment.title_override ?? config?.display_name ?? 'Cargo'}`,
    }
  })

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando asignaciones...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Asignaciones de cargos</h1>
          <p className="lead">
            Asigna personas a cargos configurados dentro de un organigrama, entidad o unidad. Aquí se controla período, estado, predecesor y sucesor.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="empty-state">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nueva asignación</p>
            <h2>Persona, cargo, período y relación</h2>
          </div>
        </div>

        <form className="admin-form admin-config-form" onSubmit={handleSubmit}>
          <select name="person_id" defaultValue="">
            <option value="">Persona</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </select>

          <select name="office_configuration_id" value={selectedConfigId} onChange={(event) => setSelectedConfigId(event.target.value)}>
            <option value="">Cargo configurado</option>
            {configs.map((config) => <option key={config.id} value={config.id}>{config.display_name}</option>)}
          </select>

          <input name="title_override" placeholder="Título visible opcional" />

          <select name="organization_chart_id" value={selectedChartId} onChange={(event) => setSelectedChartId(event.target.value)}>
            <option value="">Organigrama</option>
            {charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
          </select>

          <select name="organization_unit_id" defaultValue="">
            <option value="">Unidad organizativa</option>
            {filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>

          <select name="ecclesiastical_entity_id" defaultValue="">
            <option value="">Entidad eclesiástica</option>
            {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>

          <select name="pastoral_entity_id" defaultValue="">
            <option value="">Entidad pastoral</option>
            {pastoralEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>

          <label>
            Fecha de inicio
            <input name="start_date" type="date" value={selectedStartDate} onChange={(event) => setSelectedStartDate(event.target.value)} />
          </label>

          <label>
            Inicio del período
            <input name="term_start_date" type="date" />
          </label>

          <label>
            Fin previsto
            <input name="term_end_date" type="date" defaultValue={defaultTermEnd} />
          </label>

          <label>
            Fin real
            <input name="actual_end_date" type="date" />
          </label>

          <select name="assignment_status" defaultValue="active">
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <select name="selection_method" defaultValue="appointment">
            {selectionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <select name="predecessor_assignment_id" defaultValue="">
            <option value="">Predecesor</option>
            {assignmentOptions.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}
          </select>

          <select name="successor_assignment_id" defaultValue="">
            <option value="">Sucesor</option>
            {assignmentOptions.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}
          </select>

          <textarea name="notes_public" placeholder="Notas públicas" />

          <button className="button button-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar asignación'}
          </button>
        </form>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Listado</p>
            <h2>Asignaciones recientes</h2>
          </div>
          <span className="meta">{assignments.length} registros</span>
        </div>

        <div className="table-wrap">
          <table className="data-table dashboard-list-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cargo</th>
                <th>Organigrama</th>
                <th>Entidad</th>
                <th>Período</th>
                <th>Estado</th>
                <th>Predecesor</th>
                <th>Sucesor</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.person_slug ? <Link href={`/personas/${assignment.person_slug}`}>{assignment.person_name}</Link> : assignment.person_name ?? 'Vacante'}</td>
                  <td><strong>{assignment.position_title ?? 'Cargo'}</strong></td>
                  <td>{assignment.organization_chart_name ?? '—'}</td>
                  <td>{assignment.ecclesiastical_entity_name ?? assignment.pastoral_entity_name ?? '—'}</td>
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
