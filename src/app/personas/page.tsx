'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Person = {
  id: string
  display_name: string
  slug: string
  person_type: string | null
  photo_url: string | null
  biography_public: string | null
  status: string | null
  death_date: string | null
  age_text: string | null
}

type PersonFilter = 'all' | 'bishop' | 'priest' | 'deacon' | 'religious' | 'lay' | 'active'

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

function filterLabel(value: PersonFilter) {
  const labels: Record<PersonFilter, string> = {
    all: 'Todas las personas',
    bishop: 'Obispos',
    priest: 'Sacerdotes',
    deacon: 'Diáconos',
    religious: 'Religiosos/as',
    lay: 'Laicos/as',
    active: 'Activos',
  }

  return labels[value]
}

function normalizeFilter(value: string | null): PersonFilter {
  const allowed: PersonFilter[] = ['all', 'bishop', 'priest', 'deacon', 'religious', 'lay', 'active']
  return allowed.includes(value as PersonFilter) ? value as PersonFilter : 'all'
}

export default function PersonasPage() {
  const [items, setItems] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PersonFilter>('all')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFilter(normalizeFilter(params.get('tipo')))
  }, [])

  useEffect(() => {
    async function loadPeople() {
      try {
        const response = await fetch('/api/personas')
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
  }, [])

  const dashboard = useMemo(() => {
    const countByType = (type: string) => items.filter((item) => item.person_type === type).length
    return {
      total: items.length,
      bishops: countByType('bishop'),
      priests: countByType('priest'),
      deacons: countByType('deacon'),
      religious: countByType('religious'),
      lay: countByType('lay'),
      active: items.filter((item) => item.status === 'active' && !item.death_date).length,
    }
  }, [items])

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'active') return items.filter((item) => item.status === 'active' && !item.death_date)
    return items.filter((item) => item.person_type === filter)
  }, [filter, items])

  function FilterCard({ value, count, title, subtitle }: { value: PersonFilter; count: number; title: string; subtitle: string }) {
    return (
      <button
        className={`quick-link-card filter-card ${filter === value ? 'active-filter' : ''}`}
        type="button"
        onClick={() => setFilter(value)}
      >
        <strong>{title}</strong>
        <span>{count} {subtitle}</span>
      </button>
    )
  }

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Dashboard pastoral</p>
          <h1>Personas</h1>
          <p className="lead">
            Directorio filtrable de obispos, sacerdotes, diáconos, religiosos y laicos responsables. La lista muestra información esencial y cada fila abre su ficha personal.
          </p>
        </div>
      </div>

      {loading && <div className="empty-state">Cargando personas...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <button className={`metric-card metric-button ${filter === 'all' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('all')}>
              <strong>{dashboard.total}</strong>
              <span>Personas públicas</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'bishop' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('bishop')}>
              <strong>{dashboard.bishops}</strong>
              <span>Obispos</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'priest' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('priest')}>
              <strong>{dashboard.priests}</strong>
              <span>Sacerdotes</span>
            </button>
            <button className={`metric-card metric-button ${filter === 'deacon' ? 'active-filter' : ''}`} type="button" onClick={() => setFilter('deacon')}>
              <strong>{dashboard.deacons}</strong>
              <span>Diáconos</span>
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
              <FilterCard value="bishop" count={dashboard.bishops} title="Obispos" subtitle="registrados" />
              <FilterCard value="priest" count={dashboard.priests} title="Sacerdotes" subtitle="registrados" />
              <FilterCard value="deacon" count={dashboard.deacons} title="Diáconos" subtitle="registrados" />
              <FilterCard value="active" count={dashboard.active} title="Activos" subtitle="vigentes" />
              <FilterCard value="religious" count={dashboard.religious} title="Religiosos/as" subtitle="registrados" />
              <FilterCard value="lay" count={dashboard.lay} title="Laicos/as" subtitle="registrados" />
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Listado</p>
                <h2>{filterLabel(filter)}</h2>
              </div>
              <span className="meta">{filteredItems.length} resultados · clic en una fila para ver nombramientos e historial</span>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty-state">No hay registros para este filtro.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table dashboard-list-table people-list-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Edad ref.</th>
                      <th>Estado</th>
                      <th>Resumen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr className="clickable-table-row" key={item.id}>
                        <td>
                          <Link href={`/personas/${item.slug}`}>
                            <strong>{item.display_name}</strong>
                            <small>Ver ficha completa →</small>
                          </Link>
                        </td>
                        <td>{personTypeLabel(item.person_type)}</td>
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
