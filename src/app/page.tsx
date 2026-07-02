'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Diocese = {
  id: string
  slug: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  current_ordinary_name: string | null
  current_ordinary_title: string | null
  catholics_total: number | null
  parishes_count: number | null
  statistics_year: number | null
}

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  status: string | null
  death_date: string | null
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-DO').format(value)
}

function personTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    lay: 'Laico/a',
  }

  if (!value) return 'Persona'
  return labels[value] ?? value
}

export default function HomePage() {
  const [dioceses, setDioceses] = useState<Diocese[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [dioceseResponse, peopleResponse] = await Promise.all([
          fetch('/api/diocesis'),
          fetch('/api/personas'),
        ])

        if (dioceseResponse.ok) {
          setDioceses((await dioceseResponse.json()) as Diocese[])
        }

        if (peopleResponse.ok) {
          setPeople((await peopleResponse.json()) as Person[])
        }
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  const summary = useMemo(() => {
    const bishops = people.filter((item) => item.person_type === 'bishop').length
    const priests = people.filter((item) => item.person_type === 'priest').length
    const deacons = people.filter((item) => item.person_type === 'deacon').length
    const activePeople = people.filter((item) => item.status === 'active' && !item.death_date).length
    const totalCatholics = dioceses.reduce((sum, item) => sum + (item.catholics_total ?? 0), 0)
    const totalParishes = dioceses.reduce((sum, item) => sum + (item.parishes_count ?? 0), 0)
    const provinces = new Set(dioceses.map((item) => item.ecclesiastical_province_name).filter(Boolean)).size

    return {
      jurisdictions: dioceses.length,
      provinces,
      totalCatholics,
      totalParishes,
      bishops,
      priests,
      deacons,
      activePeople,
    }
  }, [dioceses, people])

  const recentDioceses = dioceses.slice(0, 8)
  const bishops = people.filter((item) => item.person_type === 'bishop').slice(0, 8)

  return (
    <main className="container dashboard-page home-dashboard">
      <section className="hero home-hero">
        <div>
          <p className="eyebrow">República Dominicana</p>
          <h1>SINEP RD</h1>
          <p className="lead">
            Sistema Nacional de Información Eclesiástica y Pastoral. Dashboard de consulta, fichas históricas y administración de datos eclesiales.
          </p>

          <div className="actions">
            <Link className="button button-primary" href="/diocesis">
              Ver dashboard de diócesis
            </Link>
            <Link className="button button-secondary" href="/personas?tipo=bishop">
              Ver obispos
            </Link>
            <Link className="button button-secondary" href="/admin">
              Portal administrativo
            </Link>
          </div>
        </div>

        <aside className="card dashboard-note" aria-label="Modelo de trabajo">
          <p className="eyebrow">Estructura</p>
          <h2>Listas primero, ficha después</h2>
          <p className="meta">
            Los dashboards muestran listas filtrables con datos relevantes. Al hacer clic en un registro, entras a su ficha completa. La edición manual debe hacerse desde el módulo administrativo de cada ficha.
          </p>
        </aside>
      </section>

      <section className="dashboard-grid dashboard-summary">
        <Link className="metric-card metric-link" href="/diocesis">
          <strong>{loading ? '—' : summary.jurisdictions}</strong>
          <span>Jurisdicciones</span>
        </Link>
        <Link className="metric-card metric-link" href="/diocesis">
          <strong>{loading ? '—' : summary.provinces}</strong>
          <span>Provincias eclesiásticas</span>
        </Link>
        <Link className="metric-card metric-link" href="/personas?tipo=bishop">
          <strong>{loading ? '—' : summary.bishops}</strong>
          <span>Obispos registrados</span>
        </Link>
        <Link className="metric-card metric-link" href="/personas">
          <strong>{loading ? '—' : summary.activePeople}</strong>
          <span>Personas activas</span>
        </Link>
      </section>

      <section className="dashboard-grid dashboard-summary">
        <div className="metric-card">
          <strong>{loading ? '—' : formatNumber(summary.totalCatholics)}</strong>
          <span>Fieles católicos reportados</span>
        </div>
        <div className="metric-card">
          <strong>{loading ? '—' : formatNumber(summary.totalParishes)}</strong>
          <span>Parroquias reportadas</span>
        </div>
        <Link className="metric-card metric-link" href="/personas?tipo=priest">
          <strong>{loading ? '—' : summary.priests}</strong>
          <span>Sacerdotes registrados</span>
        </Link>
        <Link className="metric-card metric-link" href="/personas?tipo=deacon">
          <strong>{loading ? '—' : summary.deacons}</strong>
          <span>Diáconos registrados</span>
        </Link>
      </section>

      <section className="card dashboard-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Accesos rápidos</p>
            <h2>Filtros principales</h2>
          </div>
          <span className="meta">Clic para abrir la lista filtrada</span>
        </div>
        <div className="quick-link-grid">
          <Link className="quick-link-card" href="/diocesis?tipo=archdiocese"><strong>Arquidiócesis</strong><span>Ver sedes metropolitanas</span></Link>
          <Link className="quick-link-card" href="/diocesis?tipo=diocese"><strong>Diócesis</strong><span>Ver jurisdicciones diocesanas</span></Link>
          <Link className="quick-link-card" href="/personas?tipo=bishop"><strong>Obispos</strong><span>Ordinarios, auxiliares y eméritos</span></Link>
          <Link className="quick-link-card" href="/personas?tipo=priest"><strong>Sacerdotes</strong><span>Presbíteros registrados</span></Link>
        </div>
      </section>

      <section className="dashboard-grid two-panel-grid">
        <article className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Jurisdicciones</p>
              <h2>Resumen nacional</h2>
            </div>
            <Link className="inline-link" href="/diocesis">Ver todas</Link>
          </div>
          <div className="list-table compact-list-table">
            {recentDioceses.map((item) => (
              <Link className="list-row" href={`/entidades/${item.slug}`} key={item.id}>
                <span><strong>{item.name}</strong><small>{item.entity_type_name ?? 'Jurisdicción'}</small></span>
                <span>{item.current_ordinary_name ?? 'Sin ordinario registrado'}</span>
                <span>{formatNumber(item.parishes_count)} parroquias</span>
              </Link>
            ))}
          </div>
        </article>

        <article className="card dashboard-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Personas</p>
              <h2>Obispos</h2>
            </div>
            <Link className="inline-link" href="/personas?tipo=bishop">Ver todos</Link>
          </div>
          <div className="list-table compact-list-table">
            {bishops.map((item) => (
              <Link className="list-row" href={`/personas/${item.slug}`} key={item.id}>
                <span><strong>{item.display_name}</strong><small>{personTypeLabel(item.person_type)}</small></span>
                <span>{item.status === 'active' && !item.death_date ? 'Activo' : 'Histórico'}</span>
                <span>Ver ficha →</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}
