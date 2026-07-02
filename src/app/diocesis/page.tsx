'use client'

import { useEffect, useState } from 'react'

type Diocese = {
  id: string
  name: string
  entity_type_name: string | null
  ecclesiastical_province_name: string | null
  province: string | null
  municipality: string | null
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
        <p className="lead">Listado inicial de arquidiócesis, diócesis y jurisdicciones especiales.</p>
      </div>

      {loading && <div className="empty-state">Cargando directorio...</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <section className="grid">
          {items.map((item) => (
            <article className="entity-card" key={item.id}>
              <p className="entity-type">{item.entity_type_name ?? 'Jurisdicción'}</p>
              <h2>{item.name}</h2>
              {item.ecclesiastical_province_name && (
                <p className="meta">{item.ecclesiastical_province_name}</p>
              )}
              {(item.municipality || item.province) && (
                <p className="meta">
                  {[item.municipality, item.province].filter(Boolean).join(', ')}
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
