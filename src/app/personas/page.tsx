'use client'

import { useEffect, useState } from 'react'
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

  return (
    <main className="container">
      <div className="page-heading">
        <p className="eyebrow">Directorio</p>
        <h1>Personas</h1>
        <p className="lead">
          Directorio inicial de obispos, sacerdotes, diáconos, religiosos y laicos responsables.
        </p>
      </div>

      {loading && <div className="empty-state">Cargando personas...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">Todavía no hay personas públicas registradas.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <section className="grid">
          {items.map((item) => (
            <article className="entity-card person-card" key={item.id}>
              <p className="entity-type">{personTypeLabel(item.person_type)}</p>
              <h2>{item.display_name}</h2>
              {item.biography_public && <p className="meta">{item.biography_public}</p>}
              {item.death_date && <p className="meta">Fallecido</p>}
              <Link className="button button-secondary card-action" href={`/personas/${item.slug}`}>
                Ver ficha completa
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
