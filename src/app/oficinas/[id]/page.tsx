'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type OrganizationDetail = {
  unit: { id: string; name: string; description: string | null; parent_unit_id: string | null }
  chart: { id: string; name: string; description: string | null } | null
}

export default function OfficePage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [detail, setDetail] = useState<OrganizationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDetail() {
      try {
        const response = await fetch(`/api/organizacion?id=${encodeURIComponent(id)}`)
        const payload = await response.json()
        if (!response.ok) {
          setError(payload.error ?? 'No se pudo cargar la oficina.')
          return
        }
        setDetail(payload as OrganizationDetail)
      } finally {
        setLoading(false)
      }
    }

    loadDetail()
  }, [id])

  if (loading) return <main className="container"><div className="empty-state">Cargando oficina...</div></main>
  if (error || !detail) return <main className="container"><div className="error-box">{error ?? 'Oficina no encontrada.'}</div></main>

  return (
    <main className="container dashboard-page home-dashboard">
      <div className="detail-backlink"><Link href="/?vista=administrativa">← Volver al explorador</Link></div>
      <section className="home-hero-panel card">
        <div className="home-hero-copy">
          <p className="eyebrow">Organización administrativa</p>
          <h1>{detail.unit.name}</h1>
          <p className="lead">{detail.unit.description ?? 'Ficha pública de la unidad administrativa seleccionada.'}</p>
        </div>
        <aside className="home-context-card">
          <p className="eyebrow">Organigrama</p>
          <h2>{detail.chart?.name ?? 'Sin organigrama publicado'}</h2>
          <p className="meta">Curia, oficinas, departamentos o dependencias administrativas.</p>
        </aside>
      </section>
    </main>
  )
}
