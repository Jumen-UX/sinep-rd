'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Chart = {
  id: string
  key: string
  name: string
  description: string | null
  visibility: string
}

type Unit = {
  id: string
  organization_chart_id: string
  parent_unit_id: string | null
  key: string
  name: string
  description: string | null
  visibility: string
  status: string
}

type NamedRecord = {
  display_name?: string | null
  name?: string | null
}

type NamedRelation = NamedRecord | NamedRecord[] | null

type Assignment = {
  id: string
  organization_chart_id: string | null
  organization_unit_id: string | null
  assignment_status: string
  visibility: string
  publication_status: string
  persons: NamedRelation
  office_configurations: NamedRelation
}

function relationName(value: NamedRelation) {
  if (!value) return null
  const record = Array.isArray(value) ? value[0] : value
  return record?.display_name ?? record?.name ?? null
}

function visibilityLabel(value: string) {
  if (value === 'public') return 'Público'
  if (value === 'internal') return 'Interno'
  if (value === 'private') return 'Privado'
  return value
}

function statusLabel(value: string) {
  if (value === 'vacant') return 'Vacante'
  if (value === 'active') return 'Activo'
  if (value === 'term_expired_still_serving') return 'Período vencido'
  return value
}

function UnitNode({
  unit,
  units,
  assignments,
  level,
}: {
  unit: Unit
  units: Unit[]
  assignments: Assignment[]
  level: number
}) {
  const children = units.filter((item) => item.parent_unit_id === unit.id)
  const unitAssignments = assignments.filter((item) => item.organization_unit_id === unit.id)

  return (
    <div className="entity-card admin-module" style={{ marginLeft: level ? 24 : 0 }}>
      <p className="entity-type">{visibilityLabel(unit.visibility)} · {unit.status}</p>
      <h2>{unit.name}</h2>
      {unit.description && <p className="meta">{unit.description}</p>}

      <div className="timeline-list">
        {unitAssignments.length === 0 && <small className="meta">Sin responsable asignado en esta unidad.</small>}
        {unitAssignments.map((assignment) => {
          const personName = relationName(assignment.persons)
          const officeName = relationName(assignment.office_configurations)
          return (
            <div className="timeline-item" key={assignment.id}>
              <strong>{officeName ?? 'Cargo'}</strong>
              <span>{personName ?? 'Vacante'}</span>
              <small>{statusLabel(assignment.assignment_status)} · {visibilityLabel(assignment.visibility)} · {assignment.publication_status}</small>
            </div>
          )
        })}
      </div>

      {children.length > 0 && (
        <div className="timeline-list">
          {children.map((child) => (
            <UnitNode assignments={assignments} key={child.id} level={level + 1} unit={child} units={units} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminOrganigramasPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [charts, setCharts] = useState<Chart[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedChartId, setSelectedChartId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    setError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      router.push('/admin/login')
      return
    }

    const [chartRes, unitRes, assignmentRes] = await Promise.all([
      supabase.from('organization_charts').select('id,key,name,description,visibility').eq('status', 'active').order('sort_order'),
      supabase.from('organization_units').select('id,organization_chart_id,parent_unit_id,key,name,description,visibility,status').eq('status', 'active').order('sort_order'),
      supabase
        .from('position_assignments')
        .select('id,organization_chart_id,organization_unit_id,assignment_status,visibility,publication_status,persons(display_name),office_configurations(display_name)')
        .eq('record_status', 'active')
        .eq('is_current', true)
        .order('created_at', { ascending: false }),
    ])

    const failed = [chartRes, unitRes, assignmentRes].find((item) => item.error)
    if (failed?.error) setError(failed.error.message)

    const chartData = (chartRes.data ?? []) as Chart[]
    setCharts(chartData)
    setUnits((unitRes.data ?? []) as Unit[])
    setAssignments((assignmentRes.data ?? []) as unknown as Assignment[])
    if (!selectedChartId && chartData[0]?.id) setSelectedChartId(chartData[0].id)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedChart = charts.find((chart) => chart.id === selectedChartId) ?? null
  const selectedUnits = units.filter((unit) => unit.organization_chart_id === selectedChartId)
  const rootUnits = selectedUnits.filter((unit) => !unit.parent_unit_id)
  const selectedAssignments = assignments.filter((assignment) => assignment.organization_chart_id === selectedChartId)
  const chartLevelAssignments = selectedAssignments.filter((assignment) => !assignment.organization_unit_id)

  if (loading) {
    return <main className="container"><div className="empty-state">Cargando organigramas...</div></main>
  }

  return (
    <main className="container dashboard-page admin-config-page">
      <div className="detail-backlink">
        <Link href="/admin">← Volver al panel administrativo</Link>
      </div>

      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Vista institucional</p>
          <h1>Organigramas</h1>
          <p className="lead">
            Visualiza organigramas, unidades y responsables actuales. Las unidades sin responsable se muestran como alertas operativas para completar asignaciones.
          </p>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Organigrama</p>
            <h2>Seleccionar vista</h2>
          </div>
        </div>

        <select value={selectedChartId} onChange={(event) => setSelectedChartId(event.target.value)}>
          {charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
        </select>
      </section>

      {selectedChart && (
        <section className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{visibilityLabel(selectedChart.visibility)}</p>
              <h2>{selectedChart.name}</h2>
              {selectedChart.description && <p className="meta">{selectedChart.description}</p>}
            </div>
            <span className="meta">{selectedUnits.length} unidades · {selectedAssignments.length} asignaciones</span>
          </div>

          {chartLevelAssignments.length > 0 && (
            <div className="timeline-list">
              <h3>Asignaciones generales del organigrama</h3>
              {chartLevelAssignments.map((assignment) => (
                <div className="timeline-item" key={assignment.id}>
                  <strong>{relationName(assignment.office_configurations) ?? 'Cargo'}</strong>
                  <span>{relationName(assignment.persons) ?? 'Vacante'}</span>
                  <small>{statusLabel(assignment.assignment_status)} · {visibilityLabel(assignment.visibility)} · {assignment.publication_status}</small>
                </div>
              ))}
            </div>
          )}

          <div className="grid admin-modules">
            {rootUnits.length === 0 && <div className="empty-state">Este organigrama todavía no tiene unidades configuradas.</div>}
            {rootUnits.map((unit) => (
              <UnitNode assignments={selectedAssignments} key={unit.id} level={0} unit={unit} units={selectedUnits} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
