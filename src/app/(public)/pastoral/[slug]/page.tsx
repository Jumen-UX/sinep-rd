'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OrganizationUnitDetail = {
  item: {
    name: string
    slug: string
    description: string | null
    organization_chart_name: string | null
    parent_unit_name: string | null
    parent_unit_slug: string | null
    ecclesiastical_entity_name: string | null
    ecclesiastical_entity_slug: string | null
    pastoral_area_name: string | null
    pastoral_area_slug: string | null
    valid_from: string | null
  }
}

export default function OrganizationUnitPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const [detail, setDetail] = useState<OrganizationUnitDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDetail() {
      try {
        const response = await fetch(`/api/pastoral?slug=${encodeURIComponent(slug)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar la unidad organizativa.')
          return
        }
        setDetail(payload as OrganizationUnitDetail)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [slug])

  if (loading) return <main className="container"><div className="empty-state">Cargando unidad organizativa...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Unidad organizativa no encontrada.'}</div></main>

  const item = detail.item

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=pastoral">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Unidad organizativa</p>
          <h1>{item.name}</h1>
          <p className="lead">{item.description ?? 'Ficha pública de la unidad organizativa seleccionada.'}</p>
          <div className="home-hero-actions">
            {item.ecclesiastical_entity_slug && <Link className="button button-primary" href={`/entidades/${item.ecclesiastical_entity_slug}`}>Ver entidad vinculada</Link>}
          </div>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Ubicación organizativa</p>
          <h2>{item.organization_chart_name ?? 'Organigrama no indicado'}</h2>
          <p className="meta">
            {item.ecclesiastical_entity_name ?? item.pastoral_area_name ?? 'Sin ámbito registrado'}
            {item.parent_unit_name ? ` · ${item.parent_unit_name}` : ''}
          </p>
        </aside>
      </section>
    </main>
  )
}
