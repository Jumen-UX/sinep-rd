'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  province: string | null
  municipality: string | null
  latin_name: string | null
  cathedral_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  territory_summary: string | null
  area_km2: number | null
  statistics_year: number | null
  population_total: number | null
  catholics_total: number | null
  catholics_percent: number | null
  parishes_count: number | null
  source_name: string | null
  source_url: string | null
  source_checked_at: string | null
  erected_at: string | null
}

type DioceseFilter = 'all' | 'archdiocese' | 'diocese' | 'military' | string

type DashboardSummary = {
  dioceses: {
    total: number
    archdioceses: number
    dioceses: number
    military: number
    provinces: { name: string; count: number }[]
    total_catholics: number
    total_population: number
    total_parishes: number
  }
}

const builtinFilters = new Set(['all', 'archdiocese', 'diocese', 'military'])

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function buildDioceseUrl(filter: DioceseFilter) {
  if (filter === 'all') return '/api/diocesis'
  if (filter === 'archdiocese' || filter === 'diocese' || filter === 'military') return `/api/diocesis?tipo=${filter}`
  return `/api/diocesis?provincia=${encodeURIComponent(filter)}`
}

export default function DiocesisPage() {
  const [items, setItems] = useState<Diocese[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DioceseFilter>('all')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tipo = params.get('tipo')
    const provincia = params.get('provincia')
    if (tipo) setFilter(tipo)
    if (provincia) setFilter(provincia)
  }, [])

  useEffect(() => {
    async function loadSummary() {
      const response = await fetch('/api/dashboard/resumen')
      if (response.ok) {
        setSummary((await response.json()) as DashboardSummary)
      }
    }

    loadSummary()
  }, [])

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildDioceseUrl(filter))
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error ?? 'No se pudo cargar el directorio')
        }

        setItems(data as Diocese[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [filter])

  function filterTitle() {
    if (filter === 'all') return 'Todas las jurisdicciones'
    if (filter === 'archdiocese') return 'Arquidiócesis'
    if (filter === 'diocese') return 'Diócesis'
    if (filter === 'military') return 'Jurisdicción castrense'
    return filter
  }

  function updateFilter(value: DioceseFilter) {
    setFilter(value)
    const query = value === 'all'
      ? ''
      : builtinFilters.has(value)
        ? `?tipo=${encodeURIComponent(value)}`
        : `?provincia=${encodeURIComponent(value)}`
    window.history.replaceState(null, '', `/diocesis${query}`)
  }

  const dashboard = summary?.dioceses

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Dashboard nacional</p>
          <h1>Diócesis y jurisdicciones</h1>
          <p className="lead">
            Lista filtrable de jurisdicciones. El dashboard resume datos generales; cada fila abre la ficha completa con ordinarios, evolución histórica y estadísticas.
          </p>
        </div>
      </div>

      {loading && <div className="empty-state">Cargando directorio...</div>}
      {error && <div className="error-box">{error}</div>}

      {!error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('all')}>
              <strong>{dashboard?.total ?? '—'}</strong>
              <span>Jurisdicciones</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'archdiocese' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('archdiocese')}>
              <strong>{dashboard?.archdioceses ?? '—'}</strong>
              <span>Arquidiócesis</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'diocese' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('diocese')}>
              <strong>{dashboard?.dioceses ?? '—'}</strong>
              <span>Diócesis</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'military' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('military')}>
              <strong>{dashboard?.military ?? '—'}</strong>
              <span>Castrense</span>
            </button>
          </section>

          <section className="dashboard-grid dashboard-summary">
            <div className="metric-card">
              <strong>{formatNumber(dashboard?.total_catholics)}</strong>
              <span>Fieles católicos reportados</span>
            </div>
            <div className="metric-card">
              <strong>{formatNumber(dashboard?.total_population)}</strong>
              <span>Población total reportada</span>
            </div>
            <div className="metric-card">
              <strong>{formatNumber(dashboard?.total_parishes)}</strong>
              <span>Parroquias reportadas</span>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Filtros</p>
                <h2>Acceso rápido</h2>
              </div>
              <span className="meta">Filtro activo: {filterTitle()}</span>
            </div>
            <div className="quick-link-grid">
              {(dashboard?.provinces ?? []).map((province) => (
                <button
                  className={`quick-link-card filter-card ${filter === province.name ? 'active-filter' : ''}`}
                  key={province.name}
                  type="button"
                  onClick={() => updateFilter(province.name)}
                >
                  <strong>{province.name}</strong>
                  <span>{province.count} jurisdicciones</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Listado</p>
                <h2>{filterTitle()}</h2>
              </div>
              <span className="meta">{items.length} resultados · clic en una fila para abrir la ficha</span>
            </div>

            {!loading && items.length === 0 ? (
              <div className="empty-state">No hay registros para este filtro.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table dashboard-list-table">
                  <thead>
                    <tr>
                      <th>Jurisdicción</th>
                      <th>Tipo</th>
                      <th>Ordinario</th>
                      <th>Provincia eclesiástica</th>
                      <th>Católicos</th>
                      <th>Parroquias</th>
                      <th>Erección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr className="clickable-table-row" key={item.id}>
                        <td>
                          <Link href={`/entidades/${item.slug}`}>
                            <strong>{item.name}</strong>
                            {item.latin_name && <small>{item.latin_name}</small>}
                          </Link>
                        </td>
                        <td>{item.entity_type_name ?? 'Jurisdicción'}</td>
                        <td>{item.current_ordinary_name ?? 'No indicado'}</td>
                        <td>{item.ecclesiastical_province_name ?? 'No indicada'}</td>
                        <td>{formatNumber(item.catholics_total)}</td>
                        <td>{formatNumber(item.parishes_count)}</td>
                        <td>{formatDate(item.erected_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
