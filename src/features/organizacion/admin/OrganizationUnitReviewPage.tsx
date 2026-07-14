'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadOrganizationUnitCatalogs,
  transitionOrganizationUnit,
  type OrganizationUnit,
  type OrganizationUnitCatalogs,
} from '../services/organization-unit-admin-service'

const emptyCatalogs: OrganizationUnitCatalogs = {
  entities: [],
  charts: [],
  pastoralAreas: [],
  units: [],
}

export default function OrganizationUnitReviewPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [catalogs, setCatalogs] = useState<OrganizationUnitCatalogs>(emptyCatalogs)
  const [entityId, setEntityId] = useState('')
  const [chartId, setChartId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function reload() {
    const next = await loadOrganizationUnitCatalogs(supabase)
    setCatalogs(next)
    setSelectedIds(new Set())
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/admin/login?next=/admin/organizacion/revision')
        return
      }

      try {
        const next = await loadOrganizationUnitCatalogs(supabase)
        if (!cancelled) setCatalogs(next)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la cola de revisión.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [router, supabase])

  const draftUnits = useMemo(() => catalogs.units.filter((unit) => (
    unit.status === 'draft'
    && unit.is_current
    && (!entityId || unit.ecclesiastical_entity_id === entityId)
    && (!chartId || unit.organization_chart_id === chartId)
    && (!areaId || unit.pastoral_area_id === areaId)
  )), [areaId, catalogs.units, chartId, entityId])

  const visibleIds = draftUnits.map((unit) => unit.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function approveSelected() {
    const ids = [...selectedIds].filter((id) => visibleIds.includes(id))
    if (ids.length === 0) return
    if (!window.confirm(`Se aprobarán ${ids.length} unidades. La publicación seguirá siendo una acción separada. ¿Continuar?`)) return

    setProcessing(true)
    setError(null)
    setMessage(null)
    try {
      const failures: string[] = []
      for (const id of ids) {
        try {
          await transitionOrganizationUnit(id, 'approve')
        } catch (transitionError) {
          const unit = catalogs.units.find((item) => item.id === id)
          failures.push(`${unit?.name ?? id}: ${transitionError instanceof Error ? transitionError.message : 'error desconocido'}`)
        }
      }
      await reload()
      if (failures.length > 0) {
        setError(`Se aprobaron ${ids.length - failures.length} de ${ids.length}. ${failures.join(' · ')}`)
      } else {
        setMessage(`${ids.length} unidades aprobadas. Permanecen con visibilidad interna.`)
      }
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <div className="empty-state">Cargando cola de revisión organizativa...</div>

  return (
    <main className="admin-organization-page">
      <header className="admin-top-header">
        <div className="admin-top-title"><span className="admin-mini-mark">REV</span><strong>Revisión de unidades organizativas</strong></div>
        <div className="admin-top-actions">
          <Link className="button button-secondary" href="/admin/organizacion">Volver a organización</Link>
          <Link className="button button-secondary" href="/admin">Panel administrativo</Link>
        </div>
      </header>

      <section className="admin-welcome-panel">
        <div>
          <p className="eyebrow">Aprobación controlada</p>
          <h1>Unidades en borrador</h1>
          <p className="lead">Revisa el ámbito, organigrama y área pastoral antes de aprobar. Aprobar no publica: las unidades permanecen internas hasta una acción explícita de publicación.</p>
        </div>
        <div className="admin-welcome-illustration" aria-hidden="true">✓</div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">Filtros</p><h2>Ámbito de revisión</h2></div>
          <span className="meta">{draftUnits.length} borradores visibles</span>
        </div>
        <div className="admin-form admin-config-form">
          <label>Diócesis
            <select value={entityId} onChange={(event) => setEntityId(event.target.value)}>
              <option value="">Todas</option>
              {catalogs.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
          </label>
          <label>Organigrama
            <select value={chartId} onChange={(event) => setChartId(event.target.value)}>
              <option value="">Todos</option>
              {catalogs.charts.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
            </select>
          </label>
          <label>Área pastoral
            <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
              <option value="">Todas</option>
              {catalogs.pastoralAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <section className="card dashboard-section">
        <div className="section-heading">
          <div><p className="eyebrow">Cola</p><h2>Revisión previa a aprobación</h2></div>
          <button className="button button-primary" disabled={processing || selectedIds.size === 0} onClick={approveSelected} type="button">
            {processing ? 'Aprobando…' : `Aprobar seleccionadas (${selectedIds.size})`}
          </button>
        </div>

        {draftUnits.length === 0 ? (
          <div className="empty-state">No hay unidades en borrador para los filtros seleccionados.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table dashboard-list-table">
              <thead>
                <tr>
                  <th><input aria-label="Seleccionar todas las unidades visibles" checked={allVisibleSelected} onChange={toggleVisible} type="checkbox" /></th>
                  <th>Unidad</th>
                  <th>Diócesis</th>
                  <th>Organigrama</th>
                  <th>Área pastoral</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {draftUnits.map((unit: OrganizationUnit) => {
                  const entity = catalogs.entities.find((item) => item.id === unit.ecclesiastical_entity_id)
                  const chart = catalogs.charts.find((item) => item.id === unit.organization_chart_id)
                  const area = catalogs.pastoralAreas.find((item) => item.id === unit.pastoral_area_id)
                  return (
                    <tr key={unit.id}>
                      <td><input aria-label={`Seleccionar ${unit.name}`} checked={selectedIds.has(unit.id)} onChange={() => toggleOne(unit.id)} type="checkbox" /></td>
                      <td><strong>{unit.name}</strong><small className="meta">{unit.key}</small></td>
                      <td>{entity?.name ?? 'Ámbito no disponible'}</td>
                      <td>{chart?.name ?? 'Organigrama no disponible'}</td>
                      <td>{area?.name ?? 'Unidad cabecera'}</td>
                      <td>Borrador · interna · vigente</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
