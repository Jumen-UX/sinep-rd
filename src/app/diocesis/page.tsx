'use client'

import { useEffect, useMemo, useState } from 'react'
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

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function formatArea(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(value)} km²`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

function isArchdiocese(item: Diocese) {
  return item.entity_type_name?.toLowerCase().includes('arquidiócesis') ?? false
}

function isDiocese(item: Diocese) {
  const name = item.entity_type_name?.toLowerCase() ?? ''
  return name.includes('diócesis') && !name.includes('arquidiócesis')
}

function isMilitary(item: Diocese) {
  const name = `${item.entity_type_name ?? ''} ${item.name}`.toLowerCase()
  return name.includes('castrense') || name.includes('militar')
}

export default function DiocesisPage() {
  const [items, setItems] = useState<Diocese[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DioceseFilter>('all')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tipo = params.get('tipo')
    if (tipo) setFilter(tipo)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/diocesis')
        if (!response.ok) {
          throw new Error('No se pudo cargar el directorio')
        }
        const data = (await response.json()) as Diocese[]
        setItems(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const dashboard = useMemo(() => {
    const totalCatholics = items.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0)
    const totalParishes = items.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0)
    const totalPopulation = items.reduce((sum, item) => sum + (item.population_total ?? 0), 0)
    const archdioceses = items.filter(isArchdiocese).length
    const dioceses = items.filter(isDiocese).length
    const military = items.filter(isMilitary).length
    const provinces = Array.from(
      new Set(items.map((item) => item.ecclesiastical_province_name).filter(Boolean) as string[])
    )

    return {
      total: items.length,
      archdioceses,
      dioceses,
      military,
      totalCatholics,
      totalParishes,
      totalPopulation,
      provinces,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'archdiocese') return items.filter(isArchdiocese)
    if (filter === 'diocese') return items.filter(isDiocese)
    if (filter === 'military') return items.filter(isMilitary)
    return items.filter((item) => item.ecclesiastical_province_name === filter)
  }, [filter, items])

  function filterTitle() {
    if (filter === 'all') return 'Todas las jurisdicciones'
    if (filter === 'archdiocese') return 'Arquidiócesis'
    if (filter === 'diocese') return 'Diócesis'
    if (filter === 'military') return 'Jurisdicción castrense'
    return filter
  }

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

      {!loading && !error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('all')}>
              <strong>{dashboard.total}</strong>
              <span>Jurisdicciones</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'archdiocese' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('archdiocese')}>
              <strong>{dashboard.archdioceses}</strong>
              <span>Arquidiócesis</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'diocese' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('diocese')}>
              <strong>{dashboard.dioceses}</strong>
              <span>Diócesis</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'military' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('military')}>
              <strong>{dashboard.military}</strong>
              <span>Castrense</span>
            </button>
          </section>

          <section className="dashboard-grid dashboard-summary">
            <div className="metric-card">
              <strong>{formatNumber(dashboard.totalCatholics)}</strong>
              <span>Fieles católicos reportados</span>
            </div>
            <div className="metric-card">
              <strong>{formatNumber(dashboard.totalPopulation)}</strong>
              <span>Población total reportada</span>
            </div>
            <div className="metric-card">
              <strong>{formatNumber(dashboard.totalParishes)}</strong>
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
              {dashboard.provinces.map((province) => {
                const provinceItems = items.filter((item) => item.ecclesiastical_province_name === province)
                return (
                  <button
                    className={`quick-link-card filter-card ${filter === province ? 'active-filter' : ''}`}
                    key={province}
                    type="button"
                    onClick={() => setFilter(province)}
                  >
                    <strong>{province}</strong>
                    <span>{provinceItems.length} jurisdicciones</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Listado</p>
                <h2>{filterTitle()}</h2>
              </div>
              <span className="meta">{filteredItems.length} resultados · clic en una fila para abrir la ficha</span>
            </div>

            {filteredItems.length === 0 ? (
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
                    {filteredItems.map((item) => (
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
