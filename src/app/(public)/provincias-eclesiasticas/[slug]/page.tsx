'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  population_total: number | null
  catholics_total: number | null
  parishes_count: number | null
  territory_summary: string | null
  statistics_year: number | null
}

type ProvinceDetail = {
  province: {
    name: string
    slug: string
    country_name: string
    metropolitan_see: Diocese | null
    current_metropolitan_name: string | null
    current_metropolitan_title: string | null
    jurisdiction_count: number
    total_population: number
    total_catholics: number
    reported_parishes: number
  }
  jurisdictions: Diocese[]
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

export default function EcclesiasticalProvincePage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [detail, setDetail] = useState<ProvinceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProvince() {
      try {
        const response = await fetch(`/api/provincias-eclesiasticas?slug=${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar la provincia eclesiástica.')
          return
        }
        setDetail(payload as ProvinceDetail)
      } finally {
        setLoading(false)
      }
    }

    loadProvince()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando provincia eclesiástica...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Provincia eclesiástica no encontrada.'}</div></main>

  const { province, jurisdictions } = detail

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href={`/?vista=territorial&provincia=${province.slug}`}>← Volver al explorador</Link></div>

      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Provincia eclesiástica</p>
          <h1>{province.name}</h1>
          <p className="lead">Ficha pública de la provincia eclesiástica, su sede metropolitana, jurisdicciones sufragáneas y datos agregados disponibles.</p>
          <div className="home-hero-actions">
            {province.metropolitan_see && <Link className="button button-primary" href={`/entidades/${province.metropolitan_see.slug}`}>Ver sede metropolitana</Link>}
            <Link className="button button-secondary" href={`/?vista=territorial&provincia=${province.slug}`}>Usar como filtro</Link>
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Sede metropolitana</p>
          <h2>{province.metropolitan_see?.name ?? 'Sin sede registrada'}</h2>
          <p className="meta">{province.current_metropolitan_title ?? 'Cargo no registrado'}{province.current_metropolitan_name ? ` · ${province.current_metropolitan_name}` : ''}</p>
        </aside>
      </section>

      <section className="home-metric-strip" aria-label="Resumen de provincia eclesiástica">
        <div className="home-metric-card"><span>Jurisdicciones</span><strong>{province.jurisdiction_count}</strong><small>Metropolitana y sufragáneas</small></div>
        <div className="home-metric-card"><span>Fieles católicos</span><strong>{formatNumber(province.total_catholics)}</strong><small>Dato agregado disponible</small></div>
        <div className="home-metric-card"><span>Población</span><strong>{formatNumber(province.total_population)}</strong><small>Dato agregado disponible</small></div>
        <div className="home-metric-card"><span>Parroquias reportadas</span><strong>{formatNumber(province.reported_parishes)}</strong><small>Estadística agregada</small></div>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Organigrama territorial</p><h2>Jurisdicciones de la provincia</h2></div></div>
        <div className="list-table compact-list-table">
          {jurisdictions.map((item) => (
            <Link className="list-row" href={`/entidades/${item.slug}`} key={item.id}>
              <span><strong>{item.name}</strong><small>{item.entity_type_name ?? 'Jurisdicción'}</small></span>
              <span>{item.current_ordinary_title ?? 'Sin cargo registrado'}</span>
              <span>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
