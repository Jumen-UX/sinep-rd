'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type PastoralDetail = {
  item: {
    name: string
    slug: string
    description: string | null
    diocese_name: string | null
    diocese_slug: string | null
    level_name: string | null
    parent_pastoral_entity_name: string | null
    parent_pastoral_entity_slug: string | null
    linked_entity_name: string | null
    linked_entity_slug: string | null
    start_date: string | null
  }
}

export default function PastoralEntityPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [detail, setDetail] = useState<PastoralDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDetail() {
      try {
        const response = await fetch(`/api/pastoral?slug=${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar la entidad pastoral.')
          return
        }
        setDetail(payload as PastoralDetail)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando entidad pastoral...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Entidad pastoral no encontrada.'}</div></main>

  const item = detail.item

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=pastoral">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Entidad pastoral</p>
          <h1>{item.name}</h1>
          <p className="lead">{item.description ?? 'Ficha pública de la estructura pastoral seleccionada.'}</p>
          <div className="home-hero-actions">
            {item.linked_entity_slug && <Link className="button button-primary" href={`/entidades/${item.linked_entity_slug}`}>Ver entidad vinculada</Link>}
            {item.diocese_slug && <Link className="button button-secondary" href={`/entidades/${item.diocese_slug}`}>Ver jurisdicción</Link>}
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Ubicación</p>
          <h2>{item.level_name ?? 'Nivel pastoral'}</h2>
          <p className="meta">{item.diocese_name ?? 'Sin jurisdicción registrada'}{item.parent_pastoral_entity_name ? ` · ${item.parent_pastoral_entity_name}` : ''}</p>
        </aside>
      </section>
    </main>
  )
}
