'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  highest_ordination_degree: 'diaconate' | 'presbyterate' | 'episcopate' | null
  is_cleric: boolean
  is_lay: boolean
  is_religious: boolean
  religious_life_type: string | null
  photo_url: string | null
  biography_public: string | null
  status: string | null
  death_date: string | null
  age_text: string | null
}

type PersonFilter = 'all' | 'bishop' | 'priest' | 'deacon' | 'religious' | 'layperson' | 'active'

type DashboardSummary = {
  people: {
    total: number
    bishops: number
    priests: number
    deacons: number
    religious: number
    laypeople: number
    active: number
  }
}

function personTypeLabel(value: string | null, isReligious: boolean) {
  const labels: Record<string, string> = {
    bishop: 'Obispo',
    priest: 'Sacerdote',
    deacon: 'Diácono',
    religious: 'Religioso/a',
    layperson: 'Laico/a',
  }

  const baseLabel = value ? labels[value] ?? value : 'Persona'
  if (!isReligious || baseLabel === 'Religioso/a') return baseLabel
  return `${baseLabel} · Vida consagrada`
}

function filterLabel(value: PersonFilter) {
  const labels: Record<PersonFilter, string> = {
    all: 'Todas las personas',
    bishop: 'Obispos',
    priest: 'Sacerdotes',
    deacon: 'Diáconos',
    religious: 'Vida consagrada',
    layperson: 'Laicos/as',
    active: 'Activos',
  }

  return labels[value]
}

function normalizeFilter(value: string | null): PersonFilter {
  if (value === 'lay') return 'layperson'
  const allowed: PersonFilter[] = ['all', 'bishop', 'priest', 'deacon', 'religious', 'layperson', 'active']
  return allowed.includes(value as PersonFilter) ? value as PersonFilter : 'all'
}

function buildPeopleUrl(filter: PersonFilter) {
  if (filter === 'all') return '/api/personas'
  return `/api/personas?tipo=${encodeURIComponent(filter)}`
}

export default function PersonasPage() {
  const [items, setItems] = useState<Person[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PersonFilter>('all')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFilter(normalizeFilter(params.get('tipo')))
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
    async function loadPeople() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildPeopleUrl(filter))
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error ?? 'No se pudo cargar el directorio de personas')
        }

        setItems(data as Person[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    }

    loadPeople()
  }, [filter])

  function updateFilter(value: PersonFilter) {
    setFilter(value)
    const query = value === 'all' ? '' : `?tipo=${encodeURIComponent(value)}`
    window.history.replaceState(null, '', `/personas${query}`)
  }

  function FilterCard({ value, count, title, subtitle }: { value: PersonFilter; count: number; title: string; subtitle: string }) {
    return (
      <button
        className={`quick-link-card filter-card ${filter === value ? 'active-filter' : ''}`}
        type="button"
        onClick={() => updateFilter(value)}
      >
        <strong>{title}</strong>
        <span>{count} {subtitle}</span>
      </button>
    )
  }

  const peopleSummary = summary?.people

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Dashboard pastoral</p>
          <h1>Personas</h1>
          <p className="lead">
            Directorio filtrable por grado del Orden, condición laical y vida consagrada. Una misma persona puede pertenecer a más de una categoría transversal, sin duplicar su identidad.
          </p>
        </div>
      </div>

      {loading && <div className="empty-state">Cargando personas...</div>}
      {error && <div className="error-box">{error}</div>}

      {!error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('all')}>
              <strong>{peopleSummary?.total ?? '—'}</strong>
              <span>Personas públicas</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'bishop' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('bishop')}>
              <strong>{peopleSummary?.bishops ?? '—'}</strong>
              <span>Con episcopado</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'priest' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('priest')}>
              <strong>{peopleSummary?.priests ?? '—'}</strong>
              <span>Con presbiterado</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'deacon' ? 'active-filter' : ''}`} type="button" onClick={() => updateFilter('deacon')}>
              <strong>{peopleSummary?.deacons ?? '—'}</strong>
              <span>Con diaconado</span>
            </button>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Filtros</p>
                <h2>Acceso rápido</h2>
              </div>
              <span className="meta">Filtro activo: {filterLabel(filter)}</span>
            </div>
            <div className="quick-link-grid">
              <FilterCard value="bishop" count={peopleSummary?.bishops ?? 0} title="Obispos" subtitle="registrados" />
              <FilterCard value="priest" count={peopleSummary?.priests ?? 0} title="Sacerdotes" subtitle="registrados" />
              <FilterCard value="deacon" count={peopleSummary?.deacons ?? 0} title="Diáconos" subtitle="registrados" />
              <FilterCard value="active" count={peopleSummary?.active ?? 0} title="Activos" subtitle="vigentes" />
              <FilterCard value="religious" count={peopleSummary?.religious ?? 0} title="Vida consagrada" subtitle="registrados" />
              <FilterCard value="layperson" count={peopleSummary?.laypeople ?? 0} title="Laicos/as" subtitle="sin ordenación" />
            </div>
            <p className="meta">Las categorías no necesariamente suman el total: una persona de vida consagrada también puede ser diácono, sacerdote u obispo.</p>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Listado</p>
                <h2>{filterLabel(filter)}</h2>
              </div>
              <span className="meta">{items.length} resultados · clic en una fila para ver su historia canónica y ministerial</span>
            </div>

            {!loading && items.length === 0 ? (
              <div className="empty-state">No hay registros para este filtro.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table dashboard-list-table people-list-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Condición</th>
                      <th>Edad ref.</th>
                      <th>Estado</th>
                      <th>Resumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr className="clickable-table-row" key={item.id}>
                        <td>
                          <Link href={`/personas/${item.slug}`}>
                            <strong>{item.display_name}</strong>
                            <small>Ver ficha completa →</small>
                          </Link>
                        </td>
                        <td>{personTypeLabel(item.person_type, item.is_religious)}</td>
                        <td>{item.age_text ? `${item.age_text} años` : '—'}</td>
                        <td>{item.status === 'active' && !item.death_date ? 'Activo' : 'No activo'}</td>
                        <td>{item.biography_public ?? 'Sin resumen público'}</td>
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
