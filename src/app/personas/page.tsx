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

export default function PersonasPage() {
  const [items, setItems] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      active: items.filter((item) => item.status === 'active' && !item.death_date).length,
    }
  }, [items])

  return (
    <main className="container dashboard-page">
      <div className="dashboard-hero card">
        <div>
          <p className="eyebrow">Dashboard pastoral</p>
          <h1>Personas</h1>
          <p className="lead">
            Directorio de obispos, sacerdotes, diáconos, religiosos y laicos responsables. Cada tarjeta conduce a su ficha personal con nombramientos e historial.
          </p>
        </div>
      </div>

      {loading && <div className="empty-state">Cargando personas...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <>
          <section className="dashboard-grid dashboard-summary">
            <div className="metric-card">
              <strong>{dashboard.total}</strong>
              <span>Personas públicas</span>
            </div>
            <div className="metric-card">
              <strong>{dashboard.bishops}</strong>
              <span>Obispos</span>
            </div>
            <div className="metric-card">
              <strong>{dashboard.priests}</strong>
              <span>Sacerdotes</span>
            </div>
            <div className="metric-card">
              <strong>{dashboard.deacons}</strong>
              <span>Diáconos</span>
            </div>
          </section>

          <section className="card dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Categorías</p>
                <h2>Acceso rápido</h2>
              </div>
              <span className="meta">Las categorías se actualizan con los datos cargados</span>
            </div>
            <div className="quick-link-grid">
              <div className="quick-link-card"><strong>Obispos</strong><span>{dashboard.bishops} registrados</span></div>
              <div className="quick-link-card"><strong>Sacerdotes</strong><span>{dashboard.priests} registrados</span></div>
              <div className="quick-link-card"><strong>Diáconos</strong><span>{dashboard.deacons} registrados</span></div>
              <div className="quick-link-card"><strong>Activos</strong><span>{dashboard.active} en servicio o vigentes</span></div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Fichas</p>
                <h2>Directorio de personas</h2>
              </div>
              <span className="meta">Haz clic para ver nombramientos e historial</span>
            </div>

            {items.length === 0 ? (
              <div className="empty-state">Todavía no hay personas públicas registradas.</div>
            ) : (
              <div className="grid">
                {items.map((item) => (
                  <Link className="entity-card person-card clickable-card" href={`/personas/${item.slug}`} key={item.id}>
                    <p className="entity-type">{personTypeLabel(item.person_type)}</p>
                    <h2>{item.display_name}</h2>
                    {item.biography_public && <p className="meta">{item.biography_public}</p>}
                    {item.death_date && <p className="meta">Fallecido</p>}
                    <span className="card-link-label">Ver ficha completa →</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
