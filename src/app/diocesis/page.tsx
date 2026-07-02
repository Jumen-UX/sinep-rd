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

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function formatArea(value: number | null) {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(value)} km²`
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`))
}

export default function DiocesisPage() {
  const [items, setItems] = useState<Diocese[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    const archdioceses = items.filter((item) => item.entity_type_name?.toLowerCase().includes('arquidiócesis')).length
    const dioceses = items.filter((item) => item.entity_type_name?.toLowerCase().includes('diócesis')).length
    const provinces = Array.from(
      new Set(items.map((item) => item.ecclesiastical_province_name).filter(Boolean) as string[])
    )

    return {
      total: items.length,
      archdioceses,
      dioceses,
      totalCatholics,
      totalParishes,
      provinces,
    }
  }, [items])

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Dashboard nacional</p>
          <h1>Diócesis y jurisdicciones</h1>
          <p className="lead">
            Vista general de la estructura eclesiástica dominicana. Cada tarjeta abre su ficha completa con información, estadísticas e historial.
          </p>
        </div>
      </div>

      {loading && <div className="empty-state">Cargando directorio...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <div className="metric-card">
              <strong>{dashboard.total}</strong>
              <span>Jurisdicciones</span>
            </div>
            <div className="metric-card">
              <strong>{dashboard.archdioceses}</strong>
              <span>Arquidiócesis</span>
            </div>
            <div className="metric-card">
              <strong>{dashboard.totalParishes}</strong>
              <span>Parroquias reportadas</span>
            </div>
            <div className="metric-card">
              <strong>{formatNumber(dashboard.totalCatholics)}</strong>
              <span>Fieles católicos</span>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Provincias eclesiásticas</p>
                <h2>Acceso rápido</h2>
              </div>
              <span className="meta">{dashboard.provinces.length} provincias con jurisdicciones asociadas</span>
            </div>
            <div className="quick-link-grid">
              {dashboard.provinces.map((province) => {
                const provinceItems = items.filter((item) => item.ecclesiastical_province_name === province)
                return (
                  <div className="quick-link-card" key={province}>
                    <strong>{province}</strong>
                    <span>{provinceItems.length} jurisdicciones</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Fichas</p>
                <h2>Directorio de jurisdicciones</h2>
              </div>
              <span className="meta">Haz clic para ver la ficha individual</span>
            </div>

            <div className="grid diocese-grid">
              {items.map((item) => {
                const erectedAt = formatDate(item.erected_at)
                return (
                  <Link className="entity-card diocese-card clickable-card" href={`/entidades/${item.slug}`} key={item.id}>
                    <p className="entity-type">{item.entity_type_name ?? 'Jurisdicción'}</p>
                    <h2>{item.name}</h2>

                    {item.latin_name && <p className="meta italic-meta">{item.latin_name}</p>}

                    {item.ecclesiastical_province_name && (
                      <p className="meta"><strong>Provincia eclesiástica:</strong> {item.ecclesiastical_province_name}</p>
                    )}

                    {(item.current_ordinary_name || item.current_ordinary_title) && (
                      <p className="meta">
                        <strong>{item.current_ordinary_title ?? 'Ordinario'}:</strong> {item.current_ordinary_name ?? 'No indicado'}
                      </p>
                    )}

                    {item.cathedral_name && (
                      <p className="meta"><strong>Catedral:</strong> {item.cathedral_name}</p>
                    )}

                    <div className="diocese-stats">
                      <div>
                        <strong>{formatArea(item.area_km2)}</strong>
                        <span>Superficie</span>
                      </div>
                      <div>
                        <strong>{formatNumber(item.parishes_count)}</strong>
                        <span>Parroquias</span>
                      </div>
                      <div>
                        <strong>{formatNumber(item.catholics_total)}</strong>
                        <span>Fieles católicos</span>
                      </div>
                      <div>
                        <strong>{item.catholics_percent ?? '—'}%</strong>
                        <span>% católicos</span>
                      </div>
                    </div>

                    <div className="meta source-line">
                      {item.statistics_year && <span>Estadísticas: {item.statistics_year}</span>}
                      {erectedAt && <span> · Erección: {erectedAt}</span>}
                    </div>

                    <span className="card-link-label">Ver ficha completa →</span>
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
