'use client'

import { useEffect, useState } from 'react'

type Diocese = {
  id: string
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

  return (
    <main className="container">
      <div className="page-heading">
        <p className="eyebrow">Directorio</p>
        <h1>Diócesis</h1>
        <p className="lead">
          Directorio enriquecido de arquidiócesis, diócesis y jurisdicciones especiales de República Dominicana.
        </p>
      </div>

      {loading && <div className="empty-state">Cargando directorio...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <section className="grid diocese-grid">
          {items.map((item) => {
            const erectedAt = formatDate(item.erected_at)
            return (
              <article className="entity-card diocese-card" key={item.id}>
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

                {item.territory_summary && (
                  <p className="meta"><strong>Territorio:</strong> {item.territory_summary}</p>
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
                  {item.source_name && <span> · Fuente: {item.source_name}</span>}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
